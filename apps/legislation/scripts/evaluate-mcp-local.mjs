import { mkdir, writeFile } from "node:fs/promises"
import { dirname, isAbsolute, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client"
import { createFixtureService } from "../evals/fixture-service.mjs"
import { loadEvaluationCases, runEvaluation } from "../evals/harness.mjs"
import { createLegislationMcpHandler } from "../src/mcp/tools.ts"
import { createLogger } from "../src/observability/logger.ts"

const appDirectory = fileURLToPath(new URL("../", import.meta.url))
const outputPath = resolve(appDirectory, process.env.LEGISLATION_EVAL_OUTPUT ?? "work/evaluation/local-mcp.json")
const outputRelativePath = relative(appDirectory, outputPath)
if (outputRelativePath.startsWith("..") || isAbsolute(outputRelativePath)) {
  throw new Error("LEGISLATION_EVAL_OUTPUT must resolve inside apps/legislation")
}
const logger = createLogger({ level: "error", service: "legislation-local-evaluation", write: () => undefined })
const handler = createLegislationMcpHandler(createFixtureService(), logger)
const transport = new StreamableHTTPClientTransport(new URL("http://evaluation.local/mcp"), {
  fetch: (input, init) => handler.fetch(new Request(input, init))
})
const client = new Client(
  { name: "legislation-local-evaluation", version: "1.0.0" },
  { versionNegotiation: { mode: "auto" } }
)

try {
  await client.connect(transport)
  const cases = await loadEvaluationCases(new URL("../evals/cases.json", import.meta.url))
  const evidence = await runEvaluation(client, cases)
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8")
  process.stdout.write(
    `${JSON.stringify({ outputPath, passedCases: evidence.summary.passedCases, toolCalls: evidence.summary.toolCalls, totalCases: evidence.summary.totalCases })}\n`
  )
  if (evidence.summary.failures > 0) {
    throw new Error(`Local MCP evaluation recorded ${evidence.summary.failures} failure(s)`)
  }
} finally {
  await transport.close()
  await handler.close()
}
