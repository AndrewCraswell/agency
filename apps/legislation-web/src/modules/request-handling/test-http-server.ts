import { randomUUID } from "node:crypto"
import { createServer, type Server } from "node:http"
import { runWithRequestContext, type RequestIdentity } from "@repo/legislation-core/auth/request-context"
import { AuthenticationError } from "@repo/legislation-core/auth/workos"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import { errorContext, type Logger } from "@repo/legislation-core/observability/logger"
import { prepareApiResponse, sendApiError, type HttpApiHandler } from "./api/http.js"

type ServerDependencies = Readonly<{
  apiHandler?: HttpApiHandler
  apiAuthenticate?: (authorizationHeader: string | string[] | undefined) => Promise<RequestIdentity>
  isReady?: () => boolean | Promise<boolean>
  logger: Logger
  readinessDetails?: () => Readonly<Record<string, unknown>>
}>

export function createLegislationServer(dependencies: ServerDependencies): Server {
  const server = createServer(async (request, response) => {
    const path = new URL(request.url ?? "/", "http://localhost").pathname
    const supplied = request.headers["x-correlation-id"]
    const correlationId = typeof supplied === "string" ? supplied : randomUUID()
    response.setHeader("x-correlation-id", correlationId)
    const sendJson = (status: number, body: unknown) => {
      response.writeHead(status, { "content-type": "application/json; charset=utf-8" })
      response.end(JSON.stringify(body))
    }
    await runWithRequestContext({ correlationId }, async () => {
      try {
        if (request.method === "GET" && path === "/health") {
          sendJson(200, { status: "ok" })
          return
        }
        if (request.method === "GET" && path === "/ready") {
          const isReady = await (dependencies.isReady?.() ?? true)
          const details = dependencies.readinessDetails?.() ?? {}
          if (!isReady) {
            dependencies.logger.warn("readiness check failed", { correlationId, ...details })
          }
          sendJson(isReady ? 200 : 503, { ...details, status: isReady ? "ready" : "unavailable" })
          return
        }
        if (!path.startsWith("/api/")) {
          sendJson(404, { error: "not_found" })
          return
        }
        response.setHeader("cache-control", "private, no-store")
        prepareApiResponse(response, request)
        if (dependencies.apiHandler === undefined) {
          sendApiError(request, response, new LegislationError("not_found", "API route was not found"))
          return
        }
        let identity: RequestIdentity | undefined
        try {
          identity = await dependencies.apiAuthenticate?.(request.headers.authorization)
        } catch (error) {
          if (!(error instanceof AuthenticationError)) {
            throw error
          }
          response.setHeader("www-authenticate", 'Bearer realm="legislation", error="invalid_token"')
          sendApiError(request, response, new LegislationError("unauthorized", "Bearer token is absent or invalid"))
          return
        }
        await runWithRequestContext({ correlationId, identity }, async () => {
          const handled = await dependencies.apiHandler?.(request, response)
          if (handled !== true) {
            sendApiError(request, response, new LegislationError("not_found", "API route was not found"))
          }
        })
      } catch (error) {
        dependencies.logger.error("request failed", errorContext(error))
        if (path.startsWith("/api/")) {
          sendApiError(request, response, error)
        } else {
          sendJson(500, { error: "internal_error" })
        }
      }
    })
  })
  server.headersTimeout = 15_000
  server.keepAliveTimeout = 5000
  server.requestTimeout = 60_000
  return server
}

export async function listen(server: Server, config: { port: number; host: string }): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject)
    server.listen(config.port, config.host, () => {
      server.off("error", reject)
      resolve()
    })
  })
}

export async function close(server: Server): Promise<void> {
  if (!server.listening) {
    return
  }
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
}
