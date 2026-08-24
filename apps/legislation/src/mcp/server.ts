import { randomUUID } from "node:crypto"
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http"
import { sendApiError, type HttpApiHandler } from "../api/http.js"
import { runWithRequestContext, type RequestIdentity } from "../auth/request-context.js"
import { AuthenticationError } from "../auth/workos.js"
import type { LegislationConfig } from "../config/config.js"
import { isApprovedDocumentRelayUrl } from "../ingestion/documents/trusted-document-transport.js"
import { LegislationError } from "../legislation/errors.js"
import { errorContext, type Logger } from "../observability/logger.js"

type RelayedDocument = Readonly<{ bytes: Uint8Array; contentType: string; sourceUrl: string }>

type ServerDependencies = Readonly<{
  apiHandler?: HttpApiHandler
  apiAuthenticate?: (authorizationHeader: string | string[] | undefined) => Promise<RequestIdentity>
  documentFetchRelay?: Readonly<{
    fetch: (sourceUrl: string) => Promise<RelayedDocument>
    token: string
  }>
  isReady?: () => boolean | Promise<boolean>
  logger: Logger
  mcpAuthenticate?: (authorizationHeader: string | string[] | undefined) => Promise<RequestIdentity>
  mcpHandler?: (request: IncomingMessage, response: ServerResponse) => Promise<void>
  protectedResourceMetadata?: Readonly<{ authorizationServer: string; resource: string }>
  readinessDetails?: () => Readonly<Record<string, unknown>>
  requestBodyBytes?: number
}>

function sendJson(response: ServerResponse, statusCode: number, body: Readonly<Record<string, unknown>>) {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" })
  response.end(JSON.stringify(body))
}

function protectedResourceMetadataUrl(resource: string): string {
  const url = new URL(resource)
  const path = url.pathname === "/" ? "" : url.pathname.replace(/\/$/, "")
  return `${url.origin}/.well-known/oauth-protected-resource${path}`
}

export function createLegislationServer(dependencies: ServerDependencies): Server {
  const isReady = dependencies.isReady ?? (() => true)
  const requestBodyBytes = dependencies.requestBodyBytes ?? 1_048_576

  const server = createServer(async (request, response) => {
    const requestUrl = new URL(request.url ?? "/", "http://localhost")
    const correlationId = request.headers["x-correlation-id"] ?? randomUUID()
    response.setHeader("x-correlation-id", correlationId)

    try {
      if (request.method === "GET" && requestUrl.pathname === "/health") {
        sendJson(response, 200, { status: "ok" })
        return
      }

      if (request.method === "GET" && requestUrl.pathname === "/ready") {
        const isServiceReady = await isReady()
        const readinessDetails = dependencies.readinessDetails?.() ?? {}
        if (!isServiceReady) {
          dependencies.logger.warn("readiness check failed", {
            correlationId: String(correlationId),
            ...readinessDetails
          })
        }
        sendJson(response, isServiceReady ? 200 : 503, {
          ...readinessDetails,
          status: isServiceReady ? "ready" : "unavailable"
        })
        return
      }

      if (
        request.method === "GET" &&
        (requestUrl.pathname === "/.well-known/oauth-protected-resource" ||
          requestUrl.pathname === "/.well-known/oauth-protected-resource/mcp") &&
        dependencies.protectedResourceMetadata !== undefined
      ) {
        sendJson(response, 200, {
          authorization_servers: [dependencies.protectedResourceMetadata.authorizationServer],
          resource: dependencies.protectedResourceMetadata.resource
        })
        return
      }

      if (request.method === "POST" && requestUrl.pathname === "/internal/document-fetch") {
        const relay = dependencies.documentFetchRelay
        if (relay === undefined || request.headers.authorization !== `Bearer ${relay.token}`) {
          sendJson(response, 401, { error: "unauthorized" })
          return
        }
        const body = await readJsonBody(request, Math.min(requestBodyBytes, 4096))
        const sourceUrl = typeof body.sourceUrl === "string" ? body.sourceUrl : undefined
        let approvedUrl: URL | undefined
        try {
          approvedUrl = sourceUrl === undefined ? undefined : new URL(sourceUrl)
        } catch {
          approvedUrl = undefined
        }
        if (approvedUrl === undefined || !isApprovedDocumentRelayUrl(approvedUrl)) {
          sendJson(response, 400, { error: "unsupported_document_url" })
          return
        }
        const document = await relay.fetch(approvedUrl.href)
        response.writeHead(200, {
          "content-length": String(document.bytes.byteLength),
          "content-type": document.contentType,
          "x-legislation-relayed-source": document.sourceUrl
        })
        response.end(document.bytes)
        return
      }

      if (requestUrl.pathname.startsWith("/api/")) {
        if (dependencies.apiHandler === undefined) {
          runWithRequestContext({ correlationId: String(correlationId) }, () =>
            sendApiError(request, response, new LegislationError("not_found", "API route was not found"))
          )
          return
        }
        const identity = await runWithRequestContext(
          { correlationId: String(correlationId) },
          async () => await authenticateRequest(request, response, dependencies.apiAuthenticate, true)
        )
        if (identity === undefined && dependencies.apiAuthenticate !== undefined) {
          return
        }
        await runWithRequestContext({ correlationId: String(correlationId), identity }, async () => {
          const handled = await dependencies.apiHandler?.(request, response)
          if (handled !== true) {
            sendApiError(request, response, new LegislationError("not_found", "API route was not found"))
          }
        })
        return
      }

      if (requestUrl.pathname === "/mcp" && dependencies.mcpHandler !== undefined) {
        const identity = await authenticateRequest(
          request,
          response,
          dependencies.mcpAuthenticate,
          false,
          dependencies.protectedResourceMetadata
        )
        if (identity === undefined && dependencies.mcpAuthenticate !== undefined) {
          return
        }
        const contentLength = Number(request.headers["content-length"])
        if (Number.isFinite(contentLength) && contentLength > requestBodyBytes) {
          sendJson(response, 413, { error: "payload_too_large" })
          return
        }
        const bearerToken =
          dependencies.mcpAuthenticate === undefined ? undefined : bearerTokenFrom(request.headers.authorization)
        await runWithRequestContext({ bearerToken, correlationId: String(correlationId), identity }, () =>
          dependencies.mcpHandler?.(request, response)
        )
        return
      }

      sendJson(response, 404, { error: "not_found" })
    } catch (error) {
      dependencies.logger.error("request failed", errorContext(error))
      if (requestUrl.pathname.startsWith("/api/")) {
        runWithRequestContext({ correlationId: String(correlationId) }, () => sendApiError(request, response, error))
      } else {
        sendJson(response, 500, { error: "internal_error" })
      }
    }
  })
  server.headersTimeout = 15_000
  server.keepAliveTimeout = 5000
  server.requestTimeout = 60_000
  return server
}

function bearerTokenFrom(header: string | string[] | undefined): string | undefined {
  if (typeof header !== "string") {
    return undefined
  }
  const match = /^Bearer ([^\s]+)$/i.exec(header)
  return match?.[1]
}

async function authenticateRequest(
  request: IncomingMessage,
  response: ServerResponse,
  authenticate: ServerDependencies["apiAuthenticate"],
  apiRequest: boolean,
  protectedResourceMetadata?: ServerDependencies["protectedResourceMetadata"]
): Promise<RequestIdentity | undefined> {
  if (authenticate === undefined) {
    return undefined
  }
  try {
    return await authenticate(request.headers.authorization)
  } catch (error) {
    if (!(error instanceof AuthenticationError)) {
      throw error
    }
    const resourceMetadata =
      protectedResourceMetadata === undefined
        ? ""
        : `, resource_metadata="${protectedResourceMetadataUrl(protectedResourceMetadata.resource)}"`
    response.setHeader("www-authenticate", `Bearer realm="legislation", error="invalid_token"${resourceMetadata}`)
    if (apiRequest) {
      sendApiError(request, response, new LegislationError("unauthorized", "Bearer token is absent or invalid"))
    } else {
      sendJson(response, 401, { error: "unauthorized" })
    }
    return undefined
  }
}

async function readJsonBody(request: IncomingMessage, maximumBytes: number): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  let bytes = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    bytes += buffer.byteLength
    if (bytes > maximumBytes) {
      throw new Error("Request body exceeds the document relay limit")
    }
    chunks.push(buffer)
  }
  const value: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"))
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Document relay request body must be an object")
  }
  return value as Record<string, unknown>
}

export async function listen(server: Server, config: LegislationConfig["server"]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    function handleError(error: Error) {
      reject(error)
    }

    server.once("error", handleError)
    server.listen(config.port, config.host, () => {
      server.off("error", handleError)
      resolve()
    })
  })
}

export async function close(server: Server): Promise<void> {
  if (!server.listening) {
    return
  }

  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error)
        return
      }

      resolve()
    })
  })
}
