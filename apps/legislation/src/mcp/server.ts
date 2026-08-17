import { randomUUID } from "node:crypto"
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http"
import { runWithRequestContext, type RequestIdentity } from "../auth/request-context.js"
import { AuthenticationError } from "../auth/workos.js"
import type { LegislationConfig } from "../config/config.js"
import { errorContext, type Logger } from "../observability/logger.js"

type ServerDependencies = Readonly<{
  authenticate?: (authorizationHeader: string | string[] | undefined) => Promise<RequestIdentity>
  isReady?: () => boolean | Promise<boolean>
  logger: Logger
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
        sendJson(response, isServiceReady ? 200 : 503, {
          ...dependencies.readinessDetails?.(),
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

      if (requestUrl.pathname === "/mcp" && dependencies.mcpHandler !== undefined) {
        let identity: RequestIdentity | undefined
        if (dependencies.authenticate !== undefined) {
          try {
            identity = await dependencies.authenticate(request.headers.authorization)
          } catch (error) {
            if (error instanceof AuthenticationError) {
              const resourceMetadata =
                dependencies.protectedResourceMetadata === undefined
                  ? ""
                  : `, resource_metadata="${protectedResourceMetadataUrl(dependencies.protectedResourceMetadata.resource)}"`
              response.setHeader(
                "www-authenticate",
                `Bearer realm="legislation", error="invalid_token"${resourceMetadata}`
              )
              sendJson(response, 401, { error: "unauthorized" })
              return
            }
            throw error
          }
        }
        const contentLength = Number(request.headers["content-length"])
        if (Number.isFinite(contentLength) && contentLength > requestBodyBytes) {
          sendJson(response, 413, { error: "payload_too_large" })
          return
        }
        await runWithRequestContext({ correlationId: String(correlationId), identity }, () =>
          dependencies.mcpHandler?.(request, response)
        )
        return
      }

      sendJson(response, 404, { error: "not_found" })
    } catch (error) {
      dependencies.logger.error("request failed", errorContext(error))
      sendJson(response, 500, { error: "internal_error" })
    }
  })
  server.headersTimeout = 15_000
  server.keepAliveTimeout = 5000
  server.requestTimeout = 60_000
  return server
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
