import { z } from "zod"
import { correlationId, jsonResponse } from "../../api/next/http.js"
import { createApiAccessTokenProvider } from "../../auth/api-access-token.js"
import { runWithRequestContext } from "../../auth/request-context.js"
import { AuthenticationError, createWorkosAuthenticator, type WorkosAuthenticatorKeys } from "../../auth/workos.js"
import { createMcpHttpQueryAdapter } from "../../mcp/http-query-adapter.js"
import { createLegislationMcpHandler } from "../../mcp/tools.js"
import { createLogger } from "../../observability/logger.js"

const httpsUrl = z.url({ protocol: /^https$/ }).refine((value) => {
  const url = new URL(value)
  return url.username === "" && url.password === "" && url.search === "" && url.hash === ""
})
const settingsSchema = z
  .object({
    AUTH_MODE: z.literal("workos"),
    WORKOS_ISSUER: httpsUrl,
    WORKOS_JWKS_URL: httpsUrl,
    WORKOS_API_AUDIENCE: z.string().trim().min(1),
    WORKOS_MCP_AUDIENCE: httpsUrl.refine((value) => new URL(value).pathname === "/mcp"),
    MCP_API_BASE_URL: httpsUrl.refine((value) => new URL(value).pathname === "/"),
    WORKOS_API_M2M_CLIENT_ID: z.string().trim().min(1),
    WORKOS_API_M2M_CLIENT_SECRET: z.string().trim().min(1)
  })
  .refine((value) => value.WORKOS_API_AUDIENCE !== value.WORKOS_MCP_AUDIENCE)
  .refine((value) => new URL(value.MCP_API_BASE_URL).origin === new URL(value.WORKOS_MCP_AUDIENCE).origin)

/** Independent HTTP-only composition: no database or incoming-bearer dependency. */
export function createNextMcpApplication(
  environment: NodeJS.ProcessEnv,
  dependencies: { keys?: WorkosAuthenticatorKeys; fetch?: typeof fetch } = {}
) {
  const parsed = settingsSchema.safeParse(environment)
  if (!parsed.success) {
    return undefined
  }
  const config = parsed.data
  const resource = new URL(config.WORKOS_MCP_AUDIENCE)
  const authenticate = createWorkosAuthenticator(
    {
      m2m: { audience: resource.href, issuer: config.WORKOS_ISSUER, jwksUrl: config.WORKOS_JWKS_URL }
    },
    dependencies.keys
  )
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
      getApiAccessToken: provider,
      ...(dependencies.fetch === undefined ? {} : { fetch: dependencies.fetch })
    }),
    createLogger({ service: "legislation-mcp", level: "warn" })
  )
  const metadataUrl = `${resource.origin}/.well-known/oauth-protected-resource/mcp`

  return {
    close: transport.close,
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
        const body = await boundedBody(request)
        const id = correlationId(request)
        const incoming = new Request(request.url, {
          method: "POST",
          headers: request.headers,
          body,
          signal: request.signal
        })
        const response = await runWithRequestContext(
          { identity, correlationId: id },
          async () => await transport.fetch(incoming)
        )
        const headers = new Headers(response.headers)
        headers.set("x-correlation-id", id)
        headers.set("cache-control", "private, no-store")
        return new Response(response.body, { status: response.status, headers })
      } catch (error) {
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

async function boundedBody(request: Request): Promise<Uint8Array<ArrayBuffer>> {
  const reader = request.body?.getReader()
  if (reader === undefined) {
    return new Uint8Array()
  }
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(10_000)])
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
    void reader.cancel().catch(() => undefined)
  }
}

let application: ReturnType<typeof createNextMcpApplication>
function getApplication() {
  application ??= createNextMcpApplication(process.env)
  return application
}

export async function handleNextMcpRequest(request: Request): Promise<Response> {
  try {
    return await (getApplication()?.handle(request) ?? jsonResponse(request, 503, { error: "service_unavailable" }))
  } catch {
    return jsonResponse(request, 503, { error: "service_unavailable" })
  }
}

export function nextMcpResourceMetadata(request: Request): Response {
  try {
    return getApplication()?.metadata(request) ?? jsonResponse(request, 503, { error: "service_unavailable" })
  } catch {
    return jsonResponse(request, 503, { error: "service_unavailable" })
  }
}
