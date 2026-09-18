import type { LookupAddress } from "node:dns"
import { dynamicTool, isStepCount, streamText } from "ai"
import { MockLanguageModelV4 } from "ai/test"
import { afterEach, expect, it, vi } from "vitest"
import { z } from "zod"
import { createCitationPresentation } from "./components/citationPresentation"
import { recordMentionHref } from "./composition"
import type { EntityPage } from "./entityResults"
import { projectResearchEvidence } from "./evidence"
import { createResearchTools, modelInputSchema, researchModelOutput } from "./research"
import { researchFailureCode } from "./researchFailure"

const { lookupMock } = vi.hoisted(() => ({
  lookupMock: vi.fn<() => Promise<LookupAddress[]>>(async () => [{ address: "8.8.8.8", family: 4 }])
}))
vi.mock("node:dns/promises", () => ({ lookup: lookupMock }))
vi.mock("../legislation/runtime/runtime", () => ({ getNextLegislationApplication: () => ({ queryService: {} }) }))
const webEnvironment: NodeJS.ProcessEnv = {
  NODE_ENV: "development",
  FIRECRAWL_API_KEY: "fixture-secret",
  FIRECRAWL_BASE_URL: "https://firecrawl.example"
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

function webTools(signal = new AbortController().signal, canResearch = () => true) {
  return createResearchTools(webEnvironment, signal, canResearch, vi.fn<() => void>())
}

async function callWebTool(name: string, input: unknown, tools = webTools()) {
  const definition = tools[name]
  if (definition?.type !== "dynamic" || !definition.execute) {
    throw new Error("Missing tool")
  }
  const execute = dynamicTool(definition).execute
  if (!execute) {
    throw new Error("Missing tool execution")
  }
  return execute(input, { toolCallId: crypto.randomUUID(), messages: [], context: {} })
}

it("only registers web tools when both provider settings are configured", () => {
  expect(webTools()).toHaveProperty("search_web")
  expect(webTools()).toHaveProperty("read_web_page")
  expect(createResearchTools({ NODE_ENV: "development" }, new AbortController().signal)).not.toHaveProperty(
    "search_web"
  )
  expect(
    createResearchTools({ NODE_ENV: "development", FIRECRAWL_API_KEY: "fixture" }, new AbortController().signal)
  ).not.toHaveProperty("read_web_page")
})

it("returns web search citations without presenting snippets as collected text", async () => {
  const fetchMock = vi.fn<typeof fetch>(async () =>
    Response.json({
      success: true,
      data: {
        web: [
          {
            url: "https://example.org/report",
            title: "Report",
            description: "Search excerpt",
            markdown: "Not requested"
          },
          { url: "http://127.0.0.1/private", title: "Private" },
          { url: "https://example.org/?api_key=private", title: "Credential" }
        ]
      }
    })
  )
  vi.stubGlobal("fetch", fetchMock)
  const result = await callWebTool("search_web", { query: "public policy" })
  expect(result).toMatchObject({
    evidence: [{ origin: "web", citationRef: "e1", content: { state: "not-collected" } }],
    data: { items: [{ sourceUrl: "https://example.org/report", snippet: "Search excerpt" }] }
  })
  expect(fetchMock).toHaveBeenCalledWith(
    new URL("https://firecrawl.example/v2/search"),
    expect.objectContaining({
      redirect: "error",
      body: JSON.stringify({ query: "public policy", limit: 5, sources: ["web"], timeout: 25000 })
    })
  )
  expect(researchModelOutput({ output: result }).value).toContain("#citation-e1")
  expect(JSON.stringify(result)).not.toContain("fixture-secret")
})

it("projects page text and truncation into attributable web evidence", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>(async () =>
      Response.json({
        success: true,
        data: {
          markdown: "Text ".repeat(5000),
          metadata: { title: ["Agency", "guidance"], url: "https://example.org/final", statusCode: 200 }
        }
      })
    )
  )
  const result = await callWebTool("read_web_page", { url: "https://example.org/start" })
  expect(result).toMatchObject({
    evidence: [
      {
        origin: "web",
        sourceUrl: "https://example.org/final",
        title: "Agency guidance",
        content: { state: "available", truncated: true }
      }
    ]
  })
})

it("marks a page-capped PDF excerpt incomplete even when its text is short", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>(async () =>
      Response.json({
        success: true,
        data: {
          markdown: "First pages only",
          metadata: { sourceURL: "https://example.org/report.pdf", numPages: 10, totalPages: 100 }
        }
      })
    )
  )
  const result = await callWebTool("read_web_page", { url: "https://example.org/report.pdf" })
  expect(result).toMatchObject({
    evidence: [{ locator: "First 10 of 100 PDF pages", content: { state: "available", truncated: true } }]
  })
})

it("rejects unsafe final URLs and publisher error pages", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>(async () =>
      Response.json({ success: true, data: { markdown: "Private", metadata: { url: "http://127.0.0.1/private" } } })
    )
  )
  await expect(callWebTool("read_web_page", { url: "https://example.org" })).rejects.toMatchObject({
    code: "forbidden"
  })
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>(async () =>
      Response.json({ success: true, data: { markdown: "Missing page", metadata: { statusCode: 404 } } })
    )
  )
  await expect(callWebTool("read_web_page", { url: "https://example.org" })).rejects.toMatchObject({
    code: "dependency_unavailable"
  })
})

it("cancels in-flight web calls and discards late responses", async () => {
  const controller = new AbortController()
  const fetchMock = vi.fn<typeof fetch>(async () => {
    controller.abort()
    return Response.json({ success: true, data: { web: [] } })
  })
  vi.stubGlobal("fetch", fetchMock)
  await expect(callWebTool("search_web", { query: "policy" }, webTools(controller.signal))).rejects.toMatchObject({
    code: "interrupted"
  })
})

it("maps provider deadlines to research timeout failures", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>(async () => new Response("Timed out", { status: 408 }))
  )
  await expect(callWebTool("search_web", { query: "policy" })).rejects.toMatchObject({ code: "timeout" })
})

it.each([
  "http://127.0.0.1",
  "http://[::1]",
  "http://169.254.169.254",
  "https://localhost",
  "https://service.internal",
  "file:///private",
  "https://user:secret@example.org",
  "https://example.org?token=secret",
  "https://example.org:8443"
])("rejects unsafe web input %s without a provider call", async (url) => {
  const fetchMock = vi.fn<typeof fetch>()
  vi.stubGlobal("fetch", fetchMock)
  await expect(callWebTool("read_web_page", { url })).rejects.toMatchObject({ code: "invalid_request" })
  expect(fetchMock).not.toHaveBeenCalled()
})

it("rejects public hostnames resolving to private addresses", async () => {
  lookupMock.mockResolvedValueOnce([{ address: "10.0.0.1", family: 4 }])
  const fetchMock = vi.fn<typeof fetch>()
  vi.stubGlobal("fetch", fetchMock)
  await expect(callWebTool("read_web_page", { url: "https://example.org" })).rejects.toMatchObject({
    code: "forbidden"
  })
  expect(fetchMock).not.toHaveBeenCalled()
})

it.each([401, 402, 429, 500])("sanitizes web provider failure %s", async (status) => {
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>(async () => new Response("fixture-secret", { status }))
  )
  await expect(callWebTool("search_web", { query: "policy" })).rejects.toMatchObject({ code: "dependency_unavailable" })
})

it("rejects malformed and oversized web responses", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>(async () => Response.json({ success: true, data: {} }))
  )
  await expect(callWebTool("search_web", { query: "policy" })).rejects.toMatchObject({ code: "invalid_response" })
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>(async () => new Response("x".repeat(1_000_001)))
  )
  await expect(callWebTool("search_web", { query: "policy" })).rejects.toMatchObject({ code: "result_limit" })
})

it("shares the research call budget and clarification gate with web tools", async () => {
  const fetchMock = vi.fn<typeof fetch>(async () => Response.json({ success: true, data: { web: [] } }))
  vi.stubGlobal("fetch", fetchMock)
  await expect(
    callWebTool(
      "search_web",
      { query: "policy" },
      webTools(undefined, () => false)
    )
  ).rejects.toMatchObject({ code: "interrupted" })
  const tools = webTools()
  for (let index = 0; index < 24; index++) {
    await callWebTool("search_web", { query: "policy" }, tools)
  }
  await expect(callWebTool("search_web", { query: "policy" }, tools)).rejects.toMatchObject({ code: "step_limit" })
  expect(fetchMock).toHaveBeenCalledTimes(24)
})

it("preserves web provenance without treating search snippets as collected page text", () => {
  const evidence = projectResearchEvidence(
    { origin: "web", title: "Public source", sourceUrl: "https://example.org", snippet: "Search excerpt" },
    () => "web-source"
  )
  expect(evidence[0]).toMatchObject({ origin: "web", content: { state: "not-collected" } })
})

it.each([
  ["payload_too_large", "result_limit"],
  ["conflict", "not_processed"],
  ["precondition_failed", "not_processed"],
  ["unprocessable", "invalid_request"]
])("preserves actionable failure category %s", (input, expected) => {
  expect(researchFailureCode(input)).toBe(expected)
})

it("passes copy-ready evidence citations through the actual SDK tool-result boundary", async () => {
  const output = {
    data: { id: "bill:ca:20232024:ab:2652" },
    presentationOptions: [
      {
        contentId: "33333333-3333-4333-8333-333333333333",
        components: ["CitationCard", "PassageQuote"],
        label: "Bill record",
        evidenceId: "e7"
      }
    ],
    evidence: [
      {
        id: "stable-snapshot-id",
        citationRef: "e7",
        title: "Bill record",
        origin: "canonical",
        sourceUrl: null,
        content: { state: "not-collected" }
      }
    ],
    resultSet: { id: "f88cf4be-024e-407e-928a-0fd6a20e2e1d" }
  }
  const model = new MockLanguageModelV4({
    doStream: async ({ prompt }) => {
      const hasToolResult = prompt.some((message) => message.role === "tool")
      return {
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: "stream-start", warnings: [] })
            if (hasToolResult) {
              controller.enqueue({ type: "text-start", id: "answer" })
              controller.enqueue({ type: "text-delta", id: "answer", delta: "Bill record [1](#citation-e7)." })
              controller.enqueue({ type: "text-end", id: "answer" })
            } else {
              controller.enqueue({ type: "tool-call", toolCallId: "read-bill", toolName: "get_bill", input: "{}" })
            }
            controller.enqueue({
              type: "finish",
              finishReason: { unified: hasToolResult ? "stop" : "tool-calls", raw: "stop" },
              usage: {
                inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
                outputTokens: { total: 1, text: 1, reasoning: 0 }
              }
            })
            controller.close()
          }
        })
      }
    }
  })
  const result = streamText({
    model,
    messages: [{ role: "user", content: "Read the bill." }],
    tools: {
      get_bill: dynamicTool({
        inputSchema: z.object({}),
        execute: async () => output,
        toModelOutput: researchModelOutput
      })
    },
    stopWhen: isStepCount(2)
  })
  const toolOutputs: unknown[] = []
  for await (const chunk of result.stream) {
    expect(chunk.type).not.toBe("error")
    if (chunk.type === "tool-result") {
      toolOutputs.push(chunk.output)
    }
  }
  expect(toolOutputs).toEqual([output])
  const prompt = JSON.stringify(model.doStreamCalls[1]?.prompt)
  expect(prompt).toContain("#citation-e7")
  expect(prompt).toContain("presentationOptions")
  expect(prompt).toContain("33333333-3333-4333-8333-333333333333")
  expect(prompt).toContain("PassageQuote")
  expect(prompt).not.toContain("stable-snapshot-id")
  expect(model.doStreamCalls).toHaveLength(2)
})

it("supplies exact record mention links only for validated result snapshots", () => {
  const resultSet: EntityPage = {
    id: "11111111-1111-4111-8111-111111111111",
    kind: "bill",
    presentation: "list",
    page: 0,
    start: 1,
    end: 1,
    items: [
      {
        id: "bill:ca:2023/2024:ab:2652",
        kind: "bill",
        title: "AB 2652",
        sourceUrl: "https://publisher.example/bill",
        fields: [],
        tallies: []
      }
    ],
    hasNext: false,
    hasPrevious: false,
    warnings: []
  }
  const output = { evidence: [], resultSet }
  expect(JSON.parse(researchModelOutput({ output }).value).recordLinks).toEqual([
    {
      recordId: "bill:ca:2023/2024:ab:2652",
      label: "AB 2652",
      href: recordMentionHref({ resultId: resultSet.id, recordId: "bill:ca:2023/2024:ab:2652" })
    }
  ])
  expect(output.resultSet).toBe(resultSet)
  expect(recordMentionHref({ resultId: resultSet.id, recordId: "bill:ca:2023/2024:ab:2652" })).toBe(
    "#record-11111111-1111-4111-8111-111111111111/bill%3Aca%3A2023%2F2024%3Aab%3A2652"
  )
  expect(
    JSON.parse(researchModelOutput({ output: { evidence: [], resultSet: { ...resultSet, id: "invented" } } }).value)
      .recordLinks
  ).toBeUndefined()
})

it("exposes short evidence ids to the model without mutating browser snapshots or record references", () => {
  const evidence = {
    id: "stable-evidence-identity",
    citationRef: "e1",
    recordId: "document:us:119:hr:1:ih",
    billId: "bill:us:119:hr:1",
    title: "Introduced text",
    origin: "canonical",
    sourceUrl: "https://publisher.example/bill",
    content: { state: "not-collected" }
  }
  const output = { data: { bill: { id: "bill:us:119:hr:1" } }, evidence: [evidence], resultSet: { id: "result-set" } }
  const model = researchModelOutput({ output })
  expect(model.type).toBe("text")
  expect(JSON.parse(model.value)).toEqual({
    ...output,
    evidence: [
      {
        id: "e1",
        citation: "[1](#citation-e1)",
        recordId: evidence.recordId,
        billId: evidence.billId,
        title: evidence.title,
        origin: evidence.origin,
        sourceUrl: evidence.sourceUrl,
        content: evidence.content
      }
    ]
  })
  expect(model.value).not.toContain("stable-evidence-identity")
  expect(output.evidence[0]?.id).toBe("stable-evidence-identity")
  const presentation = createCitationPresentation("answer", "Claim [1](#citation-e1).", [
    { ...evidence, origin: "canonical", content: { state: "not-collected" } }
  ])
  expect(presentation.missingReferences).toEqual([])
  expect(presentation.citations[0]?.evidence.id).toBe("stable-evidence-identity")
})

it("does not offer an empty result-set ID as a citation", () => {
  const output = { evidence: [], resultSet: { id: "6631c9ce-74a7-4c9e-b489-22b15b4ee6d3", items: [] } }
  const model = JSON.parse(researchModelOutput({ output }).value)
  expect(model.evidence).toEqual([])
  expect(JSON.stringify(model)).not.toContain("#citation-")
})

it("requires run-scoped references in model output instead of falling back to long evidence ids", () => {
  expect(() =>
    researchModelOutput({
      output: {
        evidence: [
          { id: "stable", title: "Text", origin: "canonical", sourceUrl: null, content: { state: "not-collected" } }
        ]
      }
    })
  ).toThrow(z.ZodError)
})

it("preserves canonical search limits and cursor inputs", () => {
  const schema = modelInputSchema(
    z.object({ query: z.string(), limit: z.number().int().min(1).max(100).optional(), cursor: z.string().optional() })
  )
  expect(schema.parse({ query: "education", limit: null, cursor: null })).toEqual({ query: "education" })
  expect(schema.parse({ query: "education", limit: 100, cursor: "opaque" })).toEqual({
    query: "education",
    limit: 100,
    cursor: "opaque"
  })
  expect(schema.safeParse({ query: "education", limit: 101, cursor: null }).success).toBe(false)
})

it("preserves canonical batch sizes and child limits", () => {
  const schema = modelInputSchema(
    z.object({ ids: z.array(z.string().startsWith("bill:")).max(25), childLimit: z.number().max(25).optional() })
  )
  expect(schema.parse({ ids: ["bill:1"], childLimit: null })).toEqual({ ids: ["bill:1"] })
  expect(schema.safeParse({ ids: Array.from({ length: 25 }, () => "bill:1"), childLimit: 25 }).success).toBe(true)
  expect(schema.safeParse({ ids: ["bill:1"], childLimit: 26 }).success).toBe(false)
  expect(schema.safeParse({ ids: ["invalid"], childLimit: 1 }).success).toBe(false)
})

it("admits configured production research before checking cancellation", () => {
  const cancellation = new Error("Request cancelled")
  expect(() =>
    createResearchTools(
      {
        NODE_ENV: "production",
        OPENROUTER_API_KEY: "fixture",
        LEGISLATION_PUBLIC_API_BASE_URL: "https://research.example"
      },
      AbortSignal.abort(cancellation)
    )
  ).toThrow(cancellation)
})

it("rejects unconfigured production research", () => {
  expect(() => createResearchTools({ NODE_ENV: "production" }, new AbortController().signal)).toThrow(
    "Research is unavailable in this environment."
  )
})
