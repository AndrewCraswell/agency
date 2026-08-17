import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client"
import { afterEach, describe, expect, it } from "vitest"
import { createLegislationMcpHandler } from "../src/mcp/tools.ts"
import { createLogger } from "../src/observability/logger.ts"
import { createFixtureService } from "./fixture-service.mjs"
import { loadEvaluationCases, parseEvaluationCases, PRIMARY_TOOL_NAMES, runEvaluation } from "./harness.mjs"

const handlers = new Set()
const transports = new Set()
const logger = createLogger({ level: "error", service: "legislation-evaluation-test", write: () => undefined })

afterEach(async () => {
  await Promise.all([...transports].map(async (transport) => transport.close()))
  await Promise.all([...handlers].map(async (handler) => handler.close()))
  transports.clear()
  handlers.clear()
})

describe("local MCP evaluation harness", () => {
  it("runs every primary tool and records passing evidence without credentials", async () => {
    const cases = await loadEvaluationCases(new URL("./cases.json", import.meta.url))
    const client = await createClient(createFixtureService())

    const evidence = await runEvaluation(client, cases, {
      wallClock: () => new Date("2026-08-17T12:00:00.000Z")
    })

    expect(evidence.environment).toEqual({
      authentication: "disabled",
      corpus: "deterministic-fixture",
      externalCredentialsUsed: false,
      liveInfrastructureChanged: false
    })
    expect(evidence.summary).toMatchObject({
      allPrimaryToolsCalled: true,
      failedCases: 0,
      failures: 0,
      passedCases: cases.length,
      totalCases: cases.length
    })
    expect(evidence.toolDiscovery.missingPrimaryTools).toEqual([])
    expect(new Set(evidence.cases.flatMap((evaluationCase) => evaluationCase.calls.map((call) => call.name)))).toEqual(
      new Set(PRIMARY_TOOL_NAMES)
    )
    expect(evidence.cases[0].calls[0]).toMatchObject({
      arguments: { mode: "lexical", query: "H.R. 1234" },
      name: "search_bills",
      response: { isError: false }
    })
    expect(evidence.cases[0].citations).toContain("https://www.congress.gov/bill/119th-congress/house-bill/1234")
    expect(evidence.scores.unsupportedClaims.status).toBe("not_scored")
  })

  it("retains actionable failure categories when retrieved evidence is wrong", async () => {
    const cases = await loadEvaluationCases(new URL("./cases.json", import.meta.url))
    const knownBillCase = cases.filter((evaluationCase) => evaluationCase.id === "known-federal")
    const client = await createClient(
      createFixtureService({ searchBills: async () => ({ items: [], truncated: false }) })
    )

    const evidence = await runEvaluation(client, knownBillCase)

    expect(evidence.summary.failedCases).toBe(1)
    expect(evidence.failures).toContainEqual(
      expect.objectContaining({ caseId: "known-federal", category: "retrieval" })
    )
    expect(evidence.cases[0].calls[0].response.data).toEqual({ items: [], truncated: false })
  })

  it("rejects evaluation definitions whose declared and executed tool paths diverge", () => {
    expect(() =>
      parseEvaluationCases([
        {
          evidence: ["canonical bill ID"],
          expectedTools: ["get_bill"],
          id: "mismatch",
          local: {
            assertions: [
              {
                call: 0,
                category: "evaluation",
                expected: 0,
                metric: "task_completion",
                operator: "length_equals",
                path: "items",
                source: "data"
              }
            ],
            calls: [{ arguments: { query: "bill" }, name: "search_bills" }]
          },
          prompt: "Find a bill.",
          scenario: "known_bill"
        }
      ])
    ).toThrow("Local calls must match expectedTools in order")
  })
})

async function createClient(service) {
  const handler = createLegislationMcpHandler(service, logger)
  handlers.add(handler)
  const transport = new StreamableHTTPClientTransport(new URL("http://evaluation.local/mcp"), {
    fetch: (input, init) => handler.fetch(new Request(input, init))
  })
  transports.add(transport)
  const client = new Client(
    { name: "legislation-local-evaluation-test", version: "1.0.0" },
    { versionNegotiation: { mode: "auto" } }
  )
  await client.connect(transport)
  return client
}
