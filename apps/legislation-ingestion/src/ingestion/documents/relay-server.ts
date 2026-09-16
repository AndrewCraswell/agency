import { randomUUID, timingSafeEqual } from "node:crypto"
import { createServer, type ServerResponse } from "node:http"
import { z } from "zod"
import { isApprovedDocumentRelayUrl } from "./trusted-document-transport.js"

type RelayedDocument = Readonly<{ bytes: Uint8Array; contentType: string; sourceUrl: string }>
const requestSchema = z.object({ sourceUrl: z.string().url() })

export function createDocumentRelayServer(options: {
  token: string
  fetch: (sourceUrl: string) => Promise<RelayedDocument>
}) {
  if (!options.token.trim()) throw new Error("DOCUMENT_FETCH_RELAY_TOKEN is required")
  const expected = Buffer.from(`Bearer ${options.token}`)
  const send = (response: ServerResponse, status: number, body: Readonly<Record<string, unknown>>) => {
    response.writeHead(status, { "content-type": "application/json; charset=utf-8" })
    response.end(JSON.stringify(body))
  }
  const server = createServer(async (request, response) => {
    response.setHeader("cache-control", "no-store")
    response.setHeader("x-correlation-id", randomUUID())
    const path = new URL(request.url ?? "/", "http://localhost").pathname
    if (request.method === "GET" && (path === "/health" || path === "/ready")) {
      send(response, 200, { status: path === "/health" ? "ok" : "ready" })
      return
    }
    if (path !== "/internal/document-fetch") {
      send(response, 404, { error: "not_found" })
      return
    }
    if (request.method !== "POST") {
      response.setHeader("allow", "POST")
      send(response, 405, { error: "method_not_allowed" })
      return
    }
    const authorization = Buffer.from(request.headers.authorization ?? "")
    if (authorization.length !== expected.length || !timingSafeEqual(authorization, expected)) {
      send(response, 401, { error: "unauthorized" })
      return
    }
    const timer = setTimeout(() => {
      if (!response.headersSent) send(response, 408, { error: "request_timeout" })
      request.destroy()
    }, 15_000)
    timer.unref()
    let sourceUrl: URL
    try {
      const chunks: Buffer[] = []
      let bytes = 0
      for await (const chunk of request) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
        bytes += buffer.byteLength
        if (bytes > 4096) {
          send(response, 413, { error: "payload_too_large" })
          return
        }
        chunks.push(buffer)
      }
      const body = requestSchema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")))
      sourceUrl = new URL(body.sourceUrl)
      if (!isApprovedDocumentRelayUrl(sourceUrl)) {
        send(response, 400, { error: "unsupported_document_url" })
        return
      }
    } catch {
      if (!response.headersSent && !response.destroyed) send(response, 400, { error: "invalid_request" })
      return
    } finally {
      clearTimeout(timer)
    }
    try {
      const document = await options.fetch(sourceUrl.href)
      response.writeHead(200, {
        "content-length": String(document.bytes.byteLength),
        "content-type": document.contentType,
        "x-legislation-relayed-source": document.sourceUrl
      })
      response.end(document.bytes)
    } catch {
      if (!response.headersSent && !response.destroyed) send(response, 502, { error: "document_fetch_failed" })
    }
  })
  server.headersTimeout = 15_000
  server.keepAliveTimeout = 5000
  server.requestTimeout = 60_000
  return server
}
