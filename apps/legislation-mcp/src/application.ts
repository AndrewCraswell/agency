import { createApiAccessTokenProvider } from "@repo/legislation-core/auth/api-access-token"
import { createIdentityBoundApiAccessTokenProvider } from "@repo/legislation-core/auth/identity-bound-api-token"
import { runWithRequestContext } from "@repo/legislation-core/auth/request-context"
import {
  AuthenticationError,
  createWorkosAuthenticator,
  type WorkosAuthenticatorKeys
} from "@repo/legislation-core/auth/workos"
import { createLogger } from "@repo/legislation-core/observability/logger"
import { z } from "zod"
import { correlationId, jsonResponse } from "./http.js"
import { createMcpHttpQueryAdapter } from "./mcp/http-query-adapter.js"
import { createLegislationMcpHandler } from "./mcp/tools.js"
import { requestSignals } from "./request-signal.js"
import { createMcpTelemetry } from "./telemetry.js"

const httpsUrl = z.url({ protocol: /^https$/ }).refine((value) => {
  const url = URL.parse(value)
  return url !== null && url.username === "" && url.password === "" && url.search === "" && url.hash === ""
})
const settingsSchema = z
  .object({
    AUTH_MODE: z.literal("workos"),
    WORKOS_ISSUER: httpsUrl,
    WORKOS_JWKS_URL: httpsUrl,
    WORKOS_API_AUDIENCE: z.string().trim().min(1),
    WORKOS_MCP_AUDIENCE: httpsUrl.refine((value) => URL.parse(value)?.pathname === "/mcp"),
    WORKOS_MCP_M2M_CLIENT_ID: z.string().trim().min(1).optional(),
    MCP_API_BASE_URL: httpsUrl.refine((value) => URL.parse(value)?.pathname === "/"),
    WORKOS_API_M2M_CLIENT_ID: z.string().trim().min(1),
    WORKOS_API_M2M_CLIENT_SECRET: z.string().trim().min(1),
    MCP_API_TIMEOUT_MS: z.coerce.number().int().min(1).max(30_000).default(25_000),
    LEGISLATION_LEGAL_API_ORGANIZATIONS: z
      .string()
      .default("")
      .transform((value) =>
        value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      )
      .pipe(z.array(z.string().max(256)).max(1000))
  })
  .refine((value) => value.WORKOS_API_AUDIENCE !== value.WORKOS_MCP_AUDIENCE)
  .refine(
    (value) =>
      value.WORKOS_MCP_M2M_CLIENT_ID === undefined || value.WORKOS_MCP_M2M_CLIENT_ID !== value.WORKOS_API_M2M_CLIENT_ID
  )

/** Independent HTTP-only composition: no database or incoming-bearer dependency. */
export function createMcpApplication(
  environment: NodeJS.ProcessEnv,
  dependencies: { keys?: WorkosAuthenticatorKeys; fetch?: typeof fetch } = {}
) {
  const parsed = settingsSchema.safeParse(environment)
  if (!parsed.success) {
    throw new Error("Invalid MCP configuration")
  }
  const config = parsed.data
  const telemetry = createMcpTelemetry()
  const resource = new URL(config.WORKOS_MCP_AUDIENCE)
  const authenticateResourceToken = createWorkosAuthenticator(
    {
      m2m: { audience: resource.href, issuer: config.WORKOS_ISSUER, jwksUrl: config.WORKOS_JWKS_URL }
    },
    dependencies.keys
  )
  const authenticateSmokeClient =
    config.WORKOS_MCP_M2M_CLIENT_ID === undefined
      ? undefined
      : createWorkosAuthenticator(
          {
            m2m: {
              audience: config.WORKOS_API_AUDIENCE,
              issuer: config.WORKOS_ISSUER,
              jwksUrl: config.WORKOS_JWKS_URL
            }
          },
          dependencies.keys
        )
  const authenticate = async (authorization: string | undefined) => {
    try {
      return await authenticateResourceToken(authorization)
    } catch (error) {
      if (
        authenticateSmokeClient === undefined ||
        !(error instanceof AuthenticationError) ||
        error.category !== "invalid"
      ) {
        throw error
      }
      const identity = await authenticateSmokeClient(authorization)
      if (identity.userId !== config.WORKOS_MCP_M2M_CLIENT_ID) {
        throw new AuthenticationError("invalid")
      }
      return identity
    }
  }
  const provider = createApiAccessTokenProvider(
    {
      issuer: config.WORKOS_ISSUER,
      clientId: config.WORKOS_API_M2M_CLIENT_ID,
      clientSecret: config.WORKOS_API_M2M_CLIENT_SECRET
    },
    dependencies.fetch === undefined ? {} : { fetch: dependencies.fetch }
  )
  const transport = createLegislationMcpHandler(
    createMcpHttpQueryAdapter({
      apiBaseUrl: config.MCP_API_BASE_URL,
      timeoutMs: config.MCP_API_TIMEOUT_MS,
      getApiAccessToken: provider,
      ...(config.LEGISLATION_LEGAL_API_ORGANIZATIONS.length === 0
        ? {}
        : {
            legalText: {
              allowedOrganizationIds: config.LEGISLATION_LEGAL_API_ORGANIZATIONS,
              getApiAccessToken: createIdentityBoundApiAccessTokenProvider({
                getToken: provider,
                authenticateApiToken: createWorkosAuthenticator(
                  {
                    m2m: {
                      audience: config.WORKOS_API_AUDIENCE,
                      issuer: config.WORKOS_ISSUER,
                      jwksUrl: config.WORKOS_JWKS_URL
                    }
                  },
                  dependencies.keys
                )
              })
            }
          }),
      ...(dependencies.fetch === undefined ? {} : { fetch: dependencies.fetch })
    }),
    createLogger({ service: "legislation-mcp", level: "warn" }),
    telemetry
  )
  const metadataUrl = `${resource.origin}/.well-known/oauth-protected-resource/mcp`
  let isClosed = false
  let closing: Promise<void> | undefined
  const shutdown = new AbortController()

  return {
    isReady: () => !isClosed,
    close: async () => {
      isClosed = true
      shutdown.abort()
      closing ??= transport.close()
      await closing
      await telemetry.shutdown()
    },
    metadata: (request: Request) =>
      jsonResponse(
        request,
        200,
        {
          resource: resource.href,
          authorization_servers: [config.WORKOS_ISSUER],
          bearer_methods_supported: ["header"]
        },
        { headers: { "cache-control": "no-store" } }
      ),
    handle: async (request: Request): Promise<Response> => {
      if (isClosed) {
        return jsonResponse(request, 503, { error: "service_unavailable" })
      }
      const host = request.headers.get("host") ?? new URL(request.url).host
      const origin = request.headers.get("origin")
      if (host.toLowerCase() !== resource.host.toLowerCase() || (origin !== null && origin !== resource.origin)) {
        return jsonResponse(request, 403, { error: "forbidden_origin" })
      }
      // Stateless MCP does not expose an indefinite GET event stream or sessions.
      if (request.method !== "POST") {
        return jsonResponse(request, 405, { error: "method_not_allowed" }, { headers: { allow: "POST" } })
      }
      try {
        const identity = await authenticate(request.headers.get("authorization") ?? undefined)
        const body = await boundedBody(request, shutdown.signal)
        const id = correlationId(request)
        const signal = AbortSignal.any([request.signal, shutdown.signal, AbortSignal.timeout(30_000)])
        const incoming = new Request(resource.href, {
          method: "POST",
          headers: request.headers,
          body,
          signal
        })
        const response = await runWithRequestContext(
          { identity, correlationId: id },
          async () => await requestSignals.run(signal, () => transport.fetch(incoming))
        )
        const headers = new Headers(response.headers)
        headers.set("x-correlation-id", id)
        headers.set("cache-control", "private, no-store")
        return new Response(response.body, { status: response.status, headers })
      } catch (error) {
        telemetry.reportFailure?.(
          "mcp.request",
          { stage: "request", correlationId: correlationId(request), method: request.method },
          error
        )
        if (error instanceof McpBodyError) {
          return jsonResponse(request, error.status, { error: "invalid_request_body" })
        }
        if (error instanceof AuthenticationError && error.category !== "temporary") {
          return jsonResponse(
            request,
            401,
            { error: "unauthorized" },
            {
              headers: {
                "www-authenticate": `Bearer resource_metadata="${metadataUrl}", error="invalid_token"`
              }
            }
          )
        }
        return jsonResponse(request, 503, { error: "service_unavailable" })
      }
    }
  }
}

class McpBodyError extends Error {
  readonly status: 408 | 413
  constructor(status: 408 | 413) {
    super("MCP request body rejected")
    this.status = status
  }
}

async function boundedBody(request: Request, shutdown: AbortSignal): Promise<Uint8Array<ArrayBuffer>> {
  const reader = request.body?.getReader()
  if (reader === undefined) {
    return new Uint8Array()
  }
  const signal = AbortSignal.any([request.signal, shutdown, AbortSignal.timeout(10_000)])
  const chunks: Uint8Array[] = []
  let size = 0
  let abort: () => void = () => undefined
  const interrupted = new Promise<never>((_resolve, reject) => {
    abort = () => reject(new McpBodyError(408))
    signal.addEventListener("abort", abort, { once: true })
  })
  try {
    while (true) {
      if (signal.aborted) {
        throw new McpBodyError(408)
      }
      const { value, done } = await Promise.race([reader.read(), interrupted])
      if (done) {
        break
      }
      size += value.byteLength
      if (size > 1_048_576) {
        throw new McpBodyError(413)
      }
      chunks.push(value)
    }
    const body = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) {
      body.set(chunk, offset)
      offset += chunk.byteLength
    }
    return body
  } finally {
    signal.removeEventListener("abort", abort)
    reader.releaseLock()
  }
}
