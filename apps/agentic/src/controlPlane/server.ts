import { createServer, type ServerResponse } from "node:http"
import { z } from "zod"
import type { GitHubWebhookService } from "../webhooks/service"
import { ApiErrorSchema } from "./contracts"
import type { ControlPlaneService } from "./service"

const MAX_REQUEST_BYTES = 65_536
const MAX_WEBHOOK_BYTES = 262_144

function writeJson(response: ServerResponse, status: number, body: unknown, allowedOrigin: string): void {
  response.writeHead(status, {
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Origin": allowedOrigin,
    "Content-Type": "application/json; charset=utf-8"
  })
  response.end(JSON.stringify(body))
}

async function readBody(request: AsyncIterable<Buffer>, maximumBytes = MAX_REQUEST_BYTES): Promise<Buffer> {
  const chunks: Buffer[] = []
  let byteLength = 0
  for await (const chunk of request) {
    byteLength += chunk.byteLength
    if (byteLength > maximumBytes) {
      throw new Error(`Request body exceeds ${maximumBytes} bytes`)
    }
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

async function readJson(request: AsyncIterable<Buffer>): Promise<unknown> {
  return JSON.parse((await readBody(request)).toString("utf8"))
}

export function createControlPlaneServer(
  service: ControlPlaneService,
  allowedOrigin: string,
  webhookService?: GitHubWebhookService
) {
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://control-plane.local")
      if (request.method === "OPTIONS") {
        writeJson(response, 204, {}, allowedOrigin)
        return
      }
      if (request.method === "GET" && url.pathname === "/api/health") {
        writeJson(response, 200, { status: "ok" }, allowedOrigin)
        return
      }
      if (request.method === "GET" && url.pathname === "/api/control-plane") {
        writeJson(response, 200, await service.snapshot(), allowedOrigin)
        return
      }
      const runDetailMatch = /^\/api\/control-plane\/runs\/([0-9a-f-]+)$/u.exec(url.pathname)
      if (request.method === "GET" && runDetailMatch !== null) {
        writeJson(response, 200, await service.runDetail(runDetailMatch[1] ?? ""), allowedOrigin)
        return
      }
      if (request.method === "POST" && url.pathname === "/api/control-plane/assign") {
        writeJson(response, 201, await service.assign(await readJson(request)), allowedOrigin)
        return
      }
      if (request.method === "POST" && url.pathname === "/api/webhooks/github" && webhookService !== undefined) {
        if (request.headers["content-type"]?.split(";", 1)[0] !== "application/json") {
          writeJson(response, 415, ApiErrorSchema.parse({ error: "Expected application/json" }), allowedOrigin)
          return
        }
        const result = await webhookService.receive({
          deliveryId: request.headers["x-github-delivery"] as string | undefined,
          eventName: request.headers["x-github-event"] as string | undefined,
          signature: request.headers["x-hub-signature-256"] as string | undefined,
          rawBody: await readBody(request, MAX_WEBHOOK_BYTES)
        })
        writeJson(response, 202, { accepted: true, duplicate: !result.created }, allowedOrigin)
        return
      }
      writeJson(response, 404, ApiErrorSchema.parse({ error: "Route not found" }), allowedOrigin)
    } catch (error) {
      const status = error instanceof z.ZodError || error instanceof SyntaxError ? 400 : 409
      const message = error instanceof Error ? error.message : "Control-plane request failed"
      writeJson(response, status, ApiErrorSchema.parse({ error: message }), allowedOrigin)
    }
  })
}
