import { readFile } from "node:fs/promises"
import { createServer } from "node:http"
import { resolve, relative, isAbsolute } from "node:path"
import { pathToFileURL } from "node:url"
import { parseArgs } from "node:util"
import type { LanguageModel } from "ai"
import { z } from "zod"
import { redactCredentials } from "../../src/modules/conversations/redactCredentials"
import { createChatModel } from "../../src/services/openrouter/chat-model"
import { scenarioBrowser } from "./scenario-browser"
import { applicationUrl, scenarioSchema } from "./scenario-policy"
import { parseCapture, ScenarioSession } from "./scenario-session"

export function createScenarioCoordinator(session: ScenarioSession, model: LanguageModel, origin: string) {
  let busy = false
  const cancellation = new AbortController()
  const server = createServer(async (request, response) => {
    response.setHeader("content-type", "application/json")
    response.setHeader("cache-control", "no-store")
    if (request.headers.origin !== origin) {
      response.writeHead(403).end("{}")
      return
    }
    response.setHeader("access-control-allow-origin", origin)
    response.setHeader("access-control-allow-methods", "GET, POST, OPTIONS")
    response.setHeader("access-control-allow-headers", "content-type")
    if (request.method === "OPTIONS") {
      response.writeHead(204).end()
      return
    }
    if (request.method === "GET" && request.url === "/state") {
      response.end(JSON.stringify(session.summary))
      return
    }
    if (request.method === "GET" && request.url === "/browser") {
      response.end(
        JSON.stringify({
          source: scenarioBrowser.toString(),
          instructions:
            "Execute this shared function with the integrated tool's page and an inspect, submit, or export operation. Do not replace it with a separate runner."
        })
      )
      return
    }
    if (request.method !== "POST") {
      response.writeHead(404).end("{}")
      return
    }
    if (busy) {
      response
        .writeHead(409)
        .end(
          '{"error":"An operation is already running. Read /state before retrying; do not repeat browser submissions."}'
        )
      return
    }
    busy = true
    try {
      const chunks: Buffer[] = []
      for await (const chunk of request) {
        chunks.push(Buffer.from(chunk))
      }
      const raw = Buffer.concat(chunks).toString("utf8")
      const body: unknown = raw ? JSON.parse(raw) : {}
      let result: unknown
      if (request.url === "/next") {
        result = await session.next(model, cancellation.signal)
      } else if (request.url === "/prepare") {
        const fresh = z.object({ empty: z.boolean(), url: z.string() }).optional().parse(body)
        result = await session.prepare(fresh)
      } else if (request.url === "/acknowledge") {
        await session.acknowledge(z.object({ status: z.number(), requestId: z.string().nullable() }).parse(body))
        result = { saved: true }
      } else if (request.url === "/capture") {
        const capture = parseCapture(body)
        result = await session.capture(capture.snapshot, capture.visible)
      } else if (request.url === "/checkpoint") {
        await session.checkpoint(z.object({ reason: z.string() }).parse(body).reason)
        result = { saved: true }
      } else if (request.url === "/continue") {
        await session.continueAfterBlocker(z.object({ reason: z.string().trim().min(1) }).parse(body).reason)
        result = { saved: true }
      } else {
        response.writeHead(404).end("{}")
        return
      }
      response.end(JSON.stringify(redactCredentials(result)))
    } catch (error) {
      response.writeHead(503).end(
        JSON.stringify(
          redactCredentials({
            error: error instanceof Error ? error.message : "Coordinator unavailable",
            resumable: true
          })
        )
      )
    } finally {
      busy = false
    }
  })
  return { server, cancel: () => cancellation.abort(new Error("Coordinator stopped; state retained for resume.")) }
}

async function main() {
  const { values } = parseArgs({
    options: {
      scenario: { type: "string" },
      directory: { type: "string" },
      model: { type: "string" },
      origin: { type: "string", default: "http://127.0.0.1:3000" },
      port: { type: "string", default: "3050" }
    }
  })
  if (!values.directory || !values.model || !process.env.OPENROUTER_API_KEY) {
    throw new Error(
      "Provide --directory and --model with planner credentials; --scenario is required only for a new attempt."
    )
  }
  const origin = applicationUrl(values.origin)
  if (origin.origin !== values.origin) {
    throw new Error("Specify the exact authorized application origin, without a path.")
  }
  const directory = resolve(values.directory)
  const local = relative(process.cwd(), directory)
  if (local.startsWith("..") || isAbsolute(local)) {
    throw new Error("Evidence directory must be inside the workspace.")
  }
  const port = z.coerce.number().int().min(1).max(65535).parse(values.port)
  const scenario = values.scenario
    ? scenarioSchema.parse(JSON.parse(await readFile(resolve(values.scenario), "utf8")))
    : undefined
  const session = await ScenarioSession.open(directory, scenario)
  await session.authorizeOrigin(origin.origin)
  const model = createChatModel(process.env.OPENROUTER_API_KEY, values.model, { reasoning: { effort: "low" } })
  const { server, cancel } = createScenarioCoordinator(session, model, origin.origin)
  process.once("SIGTERM", () => {
    cancel()
    server.close()
  })
  process.once("SIGINT", () => {
    cancel()
    server.close()
  })
  server.listen(port, "127.0.0.1", () => process.stdout.write(`Scenario coordinator: http://127.0.0.1:${port}\n`))
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  void main().catch((error: unknown) => {
    process.stderr.write(String(redactCredentials(String(error))) + "\n")
    process.exitCode = 1
  })
}
