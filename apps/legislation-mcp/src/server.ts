import { createServer, type IncomingMessage, type Server } from "node:http"
import { Readable } from "node:stream"
import { toNodeHandler } from "@modelcontextprotocol/node"
import { deploymentCommitSha } from "@repo/legislation-core/observability/deployment-identity"
import { createMcpApplication } from "./application.js"
import { jsonResponse } from "./http.js"
import { createMcpTelemetry } from "./telemetry.js"

export { createMcpApplication }

export function createMcpServer(application: ReturnType<typeof createMcpApplication>): Server {
  const telemetry = createMcpTelemetry()
  const server = createServer((request, response) => {
    const handler = toNodeHandler({
      fetch: async (converted) => {
        const path = new URL(converted.url).pathname
        if (path === "/health" || path === "/ready") {
          if (converted.method !== "GET") {
            return jsonResponse(converted, 405, { error: "method_not_allowed" }, { headers: { allow: "GET" } })
          }
          if (path === "/health") {
            return jsonResponse(converted, 200, {
              commitSha: deploymentCommitSha(process.env) ?? null,
              status: "ok"
            })
          }
          const isReady = application.isReady()
          return jsonResponse(converted, isReady ? 200 : 503, {
            commitSha: deploymentCommitSha(process.env) ?? null,
            status: isReady ? "ready" : "unavailable"
          })
        }
        if (path === "/.well-known/oauth-protected-resource" || path === "/.well-known/oauth-protected-resource/mcp") {
          if (converted.method !== "GET") {
            return jsonResponse(converted, 405, { error: "method_not_allowed" }, { headers: { allow: "GET" } })
          }
          return application.metadata(converted)
        }
        if (path !== "/mcp") {
          return jsonResponse(converted, 404, { error: "not_found" })
        }
        const init = {
          method: converted.method,
          signal: converted.signal,
          duplex: "half" as const,
          ...(converted.method === "POST"
            ? {
                body: requestBody(request)
              }
            : {})
        }
        const headers = new Headers(converted.headers)
        for (const name of ["content-length", "transfer-encoding", "content-encoding"]) {
          const value = request.headers[name]
          if (typeof value === "string") {
            headers.set(name, value)
          }
        }
        return application.handle(new Request(converted.url, { ...init, headers }))
      }
    })
    response.setHeader("cache-control", "private, no-store")
    response.shouldKeepAlive = false
    void handler(request, response, null).catch((error: unknown) => {
      telemetry.reportFailure?.("mcp.http", { stage: "transport", method: request.method }, error)
      response.destroy()
    })
  })
  server.headersTimeout = 15_000
  server.requestTimeout = 60_000
  server.keepAliveTimeout = 5000
  return server
}

function requestBody(request: IncomingMessage): ReadableStream<Uint8Array> {
  const reader = Readable.toWeb(request, {
    strategy: { highWaterMark: 65_536, size: (chunk: Uint8Array) => chunk.byteLength }
  }).getReader()
  return new ReadableStream<Uint8Array>(
    {
      async pull(controller) {
        const { done, value } = await reader.read()
        if (done) {
          reader.releaseLock()
          controller.close()
        } else {
          controller.enqueue(value)
        }
      },
      async cancel(reason: unknown) {
        try {
          await reader.cancel(reason)
        } finally {
          reader.releaseLock()
        }
      }
    },
    { highWaterMark: 0 }
  )
}

export async function listen(server: Server, port: number, host = "0.0.0.0"): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject)
    server.listen(port, host, () => {
      server.off("error", reject)
      resolve()
    })
  })
}

export async function close(server: Server, application: ReturnType<typeof createMcpApplication>): Promise<void> {
  const deadline = setTimeout(() => server.closeAllConnections(), 10_000)
  deadline.unref()
  try {
    await Promise.all([
      application.close(),
      new Promise<void>((resolve, reject) => {
        if (!server.listening) {
          resolve()
          return
        }
        server.close((error) => {
          if (error) reject(error)
          else resolve()
        })
        server.closeIdleConnections()
      })
    ])
  } finally {
    clearTimeout(deadline)
  }
}
