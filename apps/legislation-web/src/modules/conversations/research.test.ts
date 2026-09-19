import type { LookupAddress } from "node:dns"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import { describeAnalytics } from "@repo/legislation-core/research/analytics-catalog"
import { researchResultByteLimit } from "@repo/legislation-core/research/result-pages"
import type { LegislationQueryApi } from "@repo/legislation-core/research/tools"
import { dynamicTool, isStepCount, streamText } from "ai"
import { MockLanguageModelV4 } from "ai/test"
import { afterEach, expect, it, vi } from "vitest"
import { z } from "zod"
import { researchAgentLimits, runResearchAgent } from "./agent"
import { createCitationPresentation } from "./components/citationPresentation"
import { compositionInstructions, recordMentionHref } from "./composition"
import type { EntityPage } from "./entityResults"
import { projectResearchEvidence } from "./evidence"
import { createResearchTools, modelInputSchema, researchModelOutput } from "./research"
import { researchFailureCode } from "./researchFailure"
import type { ResearchToolMeasurement } from "./researchMeasurement"
import type { ResearchObservation } from "./researchMemory"

const { lookupMock, applicationQueryService, runtimeRun, analyticsObserve } = vi.hoisted(() => ({
  lookupMock: vi.fn<() => Promise<LookupAddress[]>>(async () => [{ address: "8.8.8.8", family: 4 }]),
  applicationQueryService: vi.fn<() => Partial<LegislationQueryApi>>(() => ({})),
  runtimeRun: vi.fn<() => Promise<never>>(async () => {
    throw new Error("Unexpected database runtime call")
  }),
  analyticsObserve: vi.fn<(name: string, metadata: unknown, operation: () => Promise<unknown>) => Promise<unknown>>(
    async (_name, _metadata, operation) => operation()
  )
}))
vi.mock("node:dns/promises", () => ({ lookup: lookupMock }))
vi.mock("../legislation/runtime/runtime", () => ({
  getNextLegislationApplication: () => ({ queryService: applicationQueryService() })
}))
vi.mock("../search/research-runtime", () => ({ getResearchRuntime: () => ({ run: runtimeRun }) }))
vi.mock("../legislation/analytics-telemetry", () => ({
  createAnalyticsTelemetry: () => ({ observe: analyticsObserve })
}))
vi.mock("@langfuse/tracing", () => ({
  propagateAttributes: (_attributes: unknown, operation: () => unknown) => operation()
}))
const webEnvironment: NodeJS.ProcessEnv = {
  NODE_ENV: "development",
  FIRECRAWL_API_KEY: "fixture-secret",
  FIRECRAWL_BASE_URL: "https://firecrawl.example"
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
  vi.restoreAllMocks()
  vi.useRealTimers()
  applicationQueryService.mockReturnValue({})
  runtimeRun.mockReset()
  runtimeRun.mockRejectedValue(new Error("Unexpected database runtime call"))
})

function webTools(signal = new AbortController().signal, canResearch = () => true) {
  return createResearchTools(webEnvironment, signal, canResearch, vi.fn<() => void>())
}

async function callWebTool(name: string, input: unknown, tools = webTools(), toolCallId: string = crypto.randomUUID()) {
  const definition = (await tools)[name]
  if (definition?.type !== "dynamic" || !definition.execute) {
    throw new Error("Missing tool")
  }
  const execute = dynamicTool(definition).execute
  if (!execute) {
    throw new Error("Missing tool execution")
  }
  return execute(input, { toolCallId, messages: [], context: {} })
}

it("only registers web tools when both provider settings are configured", async () => {
  expect(await webTools()).toHaveProperty("search_web")
  expect(await webTools()).toHaveProperty("read_web_page")
  expect(await createResearchTools({ NODE_ENV: "development" }, new AbortController().signal)).not.toHaveProperty(
    "search_web"
  )
  expect(
    await createResearchTools({ NODE_ENV: "development", FIRECRAWL_API_KEY: "fixture" }, new AbortController().signal)
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

it("admits configured production research before checking cancellation", async () => {
  const cancellation = new Error("Request cancelled")
  await expect(
    createResearchTools(
      {
        NODE_ENV: "production",
        OPENROUTER_API_KEY: "fixture",
        LEGISLATION_PUBLIC_API_BASE_URL: "https://research.example"
      },
      AbortSignal.abort(cancellation)
    )
  ).rejects.toThrow(cancellation)
})

it("rejects unconfigured production research", async () => {
  await expect(createResearchTools({ NODE_ENV: "production" }, new AbortController().signal)).rejects.toThrow(
    "Research is unavailable in this environment."
  )
})

// Public record IDs from campaign case 091; no retained conversation or telemetry payloads.
const selectionBillId = "bill:us:119:hr:9619"
const selectionDocument = {
  id: `${selectionBillId}:document:51af43854225cf7d760326df`,
  billId: selectionBillId,
  versionCode: "ih"
}
const alteredDocumentId = `${selectionBillId}:document:51af43854225cf7d760760df`
const selectionInput = { id: selectionBillId, documentId: selectionDocument.id, versionCode: "ih", limit: 50 }

function selectionTools(
  overrides: Partial<LegislationQueryApi> = {},
  options: {
    canResearch?: () => boolean
    signal?: AbortSignal
    onContents?: Parameters<typeof createResearchTools>[9]
    onMeasurement?: (measurement: ResearchToolMeasurement) => void
  } = {}
) {
  const unexpected = async () => {
    throw new Error("Unexpected query-service call in selection fixture")
  }
  const service: LegislationQueryApi = {
    compareBillVersions: unexpected,
    findRelatedBills: unexpected,
    getAmendment: unexpected,
    getBill: async () => ({
      bill: { id: selectionBillId, identifier: "HR 9619", title: "School AI procurement" },
      documents: [selectionDocument]
    }),
    getBillVotes: unexpected,
    getBillText: unexpected,
    getBillTimeline: unexpected,
    getEvent: unexpected,
    getOrganization: unexpected,
    getPerson: unexpected,
    getSupportingMaterial: unexpected,
    getVote: unexpected,
    searchAmendments: unexpected,
    searchBills: unexpected,
    searchBillText: unexpected,
    searchChanges: unexpected,
    searchEvents: unexpected,
    searchOrganizations: unexpected,
    searchPeople: unexpected,
    searchSupportingMaterials: unexpected,
    searchVotes: unexpected,
    ...overrides
  }
  const record = vi.fn<(observation: ResearchObservation) => void>()
  const report = vi.fn<() => void>()
  return {
    record,
    report,
    tools: createResearchTools(
      { NODE_ENV: "development" },
      options.signal ?? new AbortController().signal,
      options.canResearch ?? (() => true),
      report,
      undefined,
      service,
      undefined,
      undefined,
      [],
      options.onContents,
      { evidence: [], record },
      options.onMeasurement
    )
  }
}

it("dispatches first-call and undiscovered explicit document IDs unchanged and retains canonical observations", async () => {
  const getBillText = vi.fn<LegislationQueryApi["getBillText"]>(async (input) => ({
    document: { ...selectionDocument, id: input.documentId },
    sections: [],
    nextCursor: null
  }))
  const fixture = selectionTools({ getBillText })
  await callWebTool("get_bill_text", selectionInput, fixture.tools)
  await callWebTool("get_bill", { id: selectionBillId }, fixture.tools)
  const another = { ...selectionInput, documentId: `${selectionBillId}:document:explicit-new-id` }
  await callWebTool("get_bill_text", another, fixture.tools)
  expect(getBillText.mock.calls).toEqual([[selectionInput], [another]])
  expect(fixture.record).toHaveBeenLastCalledWith(
    expect.objectContaining({
      input: another,
      data: { document: { ...selectionDocument, id: another.documentId }, sections: [], nextCursor: null }
    })
  )
  expect(fixture.report).not.toHaveBeenCalled()
})

it("keeps a mutated document read as a reported failure and offers exact choices without automatic substitution", async () => {
  const getBillText = vi.fn<LegislationQueryApi["getBillText"]>(async ({ documentId }) => {
    if (documentId !== selectionDocument.id) {
      throw new LegislationError("not_found", "Document was not found")
    }
    return { document: selectionDocument, sections: [], nextCursor: null }
  })
  const fixture = selectionTools({ getBillText })
  await callWebTool("get_bill", { id: selectionBillId }, fixture.tools)
  const altered = { ...selectionInput, documentId: alteredDocumentId }
  await expect(callWebTool("get_bill_text", altered, fixture.tools)).rejects.toMatchObject({
    code: "not_found",
    recovery: { action: "select_returned", documents: [selectionDocument] }
  })
  expect(getBillText.mock.calls).toEqual([[altered]])
  expect(fixture.report).toHaveBeenCalledWith(
    expect.objectContaining({
      toolName: "get_bill_text",
      error: expect.objectContaining({
        code: "not_found",
        recovery: {
          action: "select_returned",
          instruction: expect.any(String),
          documents: [selectionDocument]
        }
      })
    })
  )
  expect(fixture.record).toHaveBeenLastCalledWith({ tool: "get_bill_text", input: altered, failure: "not_found" })
  await callWebTool("get_bill_text", selectionInput, fixture.tools)
  expect(getBillText.mock.calls).toEqual([[altered], [selectionInput]])
})

it("rejects a known document's wrong parent before any backend read", async () => {
  const getBillText = vi.fn<LegislationQueryApi["getBillText"]>()
  const fixture = selectionTools({ getBillText })
  await callWebTool("get_bill", { id: selectionBillId }, fixture.tools)
  await expect(
    callWebTool("get_bill_text", { ...selectionInput, id: "bill:us:118:hr:9619" }, fixture.tools)
  ).rejects.toMatchObject({ code: "invalid_request", recovery: { action: "resolve_document" } })
  expect(getBillText).not.toHaveBeenCalled()
})

it("preserves exact document selectors across collection, section, comparison and text-search tools", async () => {
  const getDocumentSections = vi.fn<NonNullable<LegislationQueryApi["getDocumentSections"]>>(async () => ({
    items: []
  }))
  const readRecordCollection = vi.fn<NonNullable<LegislationQueryApi["readRecordCollection"]>>(async () => ({
    items: []
  }))
  const compareBillVersions = vi.fn<LegislationQueryApi["compareBillVersions"]>(async () => ({ sections: [] }))
  const searchBillText = vi.fn<LegislationQueryApi["searchBillText"]>(async () => ({ items: [] }))
  const fixture = selectionTools({ getDocumentSections, readRecordCollection, compareBillVersions, searchBillText })
  await callWebTool("get_bill", { id: selectionBillId }, fixture.tools)
  const sectionInput = { documentId: selectionDocument.id, limit: 10 }
  const collectionInput = {
    collection: "document-sections",
    recordId: selectionDocument.id,
    sectionId: "section:2",
    textOffset: 10000,
    limit: 1
  }
  const comparisonInput = {
    billId: selectionBillId,
    documentIds: [selectionDocument.id, `${selectionBillId}:document:explicit-second-version`],
    limit: 10
  }
  await callWebTool("get_document_sections", sectionInput, fixture.tools)
  await callWebTool("read_record_collection", collectionInput, fixture.tools)
  await callWebTool("compare_bill_versions", comparisonInput, fixture.tools)
  await callWebTool(
    "search_bill_text",
    { query: "procurement", billId: selectionBillId, documentIds: [selectionDocument.id] },
    fixture.tools
  )
  expect(getDocumentSections).toHaveBeenCalledExactlyOnceWith(sectionInput)
  expect(readRecordCollection).toHaveBeenCalledExactlyOnceWith(collectionInput)
  expect(compareBillVersions).toHaveBeenCalledExactlyOnceWith({ ...comparisonInput, cursor: undefined })
  expect(searchBillText).toHaveBeenCalledExactlyOnceWith({
    query: "procurement",
    billIds: [selectionBillId],
    documentIds: [selectionDocument.id],
    documentClassifications: undefined,
    mode: "lexical"
  })
})

it("passes the exact returned continuation through core and rejects mutation or another turn before service execution", async () => {
  const getBillText = vi.fn<LegislationQueryApi["getBillText"]>(async ({ cursor }) => ({
    document: selectionDocument,
    sections: [],
    nextCursor: cursor ? null : "upstream-offset-50"
  }))
  const fixture = selectionTools({ getBillText })
  const first = await callWebTool("get_bill_text", selectionInput, fixture.tools)
  const cursor = z.object({ data: z.object({ nextCursor: z.string() }) }).parse(first).data.nextCursor
  const altered = `${cursor.slice(0, -4)}AAAA`
  await expect(
    callWebTool("get_bill_text", { ...selectionInput, cursor: altered }, fixture.tools)
  ).rejects.toMatchObject({
    code: "invalid_cursor",
    recovery: { action: "select_returned", continuation: { field: "cursor", value: cursor } }
  })
  expect(getBillText).toHaveBeenCalledTimes(1)
  await callWebTool("get_bill_text", { ...selectionInput, cursor }, fixture.tools)
  expect(getBillText).toHaveBeenLastCalledWith({ ...selectionInput, cursor: "upstream-offset-50" })
  const anotherTurn = selectionTools({ getBillText })
  await expect(callWebTool("get_bill_text", { ...selectionInput, cursor }, anotherTurn.tools)).rejects.toMatchObject({
    code: "invalid_cursor",
    recovery: { action: "restart" }
  })
  expect(getBillText).toHaveBeenCalledTimes(2)
})

it("uses canonical schema defaults when validating continuation filters", async () => {
  const searchBillText = vi.fn<LegislationQueryApi["searchBillText"]>(async () => ({
    items: [],
    nextCursor: "next-search-page"
  }))
  const fixture = selectionTools({ searchBillText })
  const searchInput = {
    query: "school procurement",
    sessionIds: ["session:us:119"],
    jurisdictionIds: ["jurisdiction:us"]
  }
  const first = await callWebTool("search_bill_text", searchInput, fixture.tools)
  const cursor = z.object({ data: z.object({ nextCursor: z.string() }) }).parse(first).data.nextCursor
  await callWebTool("search_bill_text", { ...searchInput, cursor }, fixture.tools)
  expect(searchBillText).toHaveBeenLastCalledWith(
    expect.objectContaining({ ...searchInput, mode: "lexical", cursor: "next-search-page" })
  )
  await expect(
    callWebTool("search_bill_text", { ...searchInput, limit: 25, cursor }, fixture.tools)
  ).rejects.toMatchObject({ code: "invalid_cursor", recovery: { action: "restart" } })
  await expect(
    callWebTool("search_bill_text", { ...searchInput, sessionIds: ["session:us:118"], cursor }, fixture.tools)
  ).rejects.toMatchObject({ code: "invalid_cursor", recovery: { action: "answer" } })
  await expect(
    callWebTool("search_bill_text", { ...searchInput, jurisdictionIds: ["jurisdiction:ca"], cursor }, fixture.tools)
  ).rejects.toMatchObject({ code: "invalid_cursor", recovery: { action: "answer" } })
  expect(searchBillText).toHaveBeenCalledTimes(2)
})

it("charges every rejected selection to the existing call budget and offers recovery only once", async () => {
  const getBillText = vi.fn<LegislationQueryApi["getBillText"]>()
  const fixture = selectionTools({ getBillText })
  const input = { ...selectionInput, cursor: "invented" }
  await expect(callWebTool("get_bill_text", input, fixture.tools)).rejects.toMatchObject({
    code: "invalid_cursor",
    recovery: { action: "restart" }
  })
  for (let index = 1; index < researchAgentLimits.calls; index++) {
    await expect(callWebTool("get_bill_text", input, fixture.tools)).rejects.toMatchObject({
      code: "invalid_cursor",
      recovery: { action: "answer" }
    })
  }
  await expect(callWebTool("get_bill_text", input, fixture.tools)).rejects.toMatchObject({ code: "step_limit" })
  expect(getBillText).not.toHaveBeenCalled()
  expect(fixture.report).toHaveBeenCalledTimes(researchAgentLimits.calls + 1)
})

it("delivers exact recovery to the SDK model and preserves answer synthesis after repeated failed reads", async () => {
  const getBillText = vi.fn<LegislationQueryApi["getBillText"]>(async ({ documentId }) => {
    if (documentId !== selectionDocument.id) {
      throw new LegislationError("not_found", "Document was not found")
    }
    return {
      document: selectionDocument,
      sections: [{ id: "section:definitions", documentId, heading: "Definitions", text: "SEC. 2. DEFINITIONS." }],
      nextCursor: "more-sections"
    }
  })
  const fixture = selectionTools({ getBillText })
  const scriptedCalls = [
    { name: "get_bill", input: { id: selectionBillId, childLimit: null } },
    { name: "get_bill_text", input: { ...selectionInput, documentId: alteredDocumentId, cursor: null } },
    { name: "get_bill_text", input: { ...selectionInput, cursor: null } }
  ]
  const answer =
    "Research is incomplete: the read failed, and a definitions heading does not establish whether duties are absent."
  let generations = 0
  const model = new MockLanguageModelV4({
    doStream: async ({ toolChoice }) => {
      const call = scriptedCalls[generations] ?? {
        name: "get_bill_text",
        input: { ...selectionInput, cursor: "invented" }
      }
      generations++
      const isSynthesis = toolChoice?.type === "none"
      return {
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: "stream-start", warnings: [] })
            if (isSynthesis) {
              controller.enqueue({ type: "text-start", id: "answer" })
              controller.enqueue({ type: "text-delta", id: "answer", delta: answer })
              controller.enqueue({ type: "text-end", id: "answer" })
            } else {
              controller.enqueue({
                type: "tool-call",
                toolCallId: `selection-${generations}`,
                toolName: call.name,
                input: JSON.stringify(call.input)
              })
            }
            controller.enqueue({
              type: "finish",
              finishReason: { unified: isSynthesis ? "stop" : "tool-calls", raw: isSynthesis ? "stop" : "tool_calls" },
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
  const result = runResearchAgent({
    sessionId: "selection-regression",
    model,
    instructions: compositionInstructions,
    messages: [{ role: "user", content: "Read this bill's operative requirements." }],
    tools: await fixture.tools,
    signal: new AbortController().signal
  })
  let text = ""
  for await (const chunk of result.stream) {
    expect(chunk.type).not.toBe("error")
    if (chunk.type === "text-delta") {
      text += chunk.text
    }
  }
  const errorResults = model.doStreamCalls[2]?.prompt
    .filter((message) => message.role === "tool")
    .flatMap((message) => message.content)
    .filter((content) => content.type === "tool-result" && content.output.type === "error-text")
  expect(errorResults).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        output: expect.objectContaining({
          type: "error-text",
          value: expect.stringContaining(JSON.stringify([selectionDocument]))
        })
      })
    ])
  )
  expect(getBillText.mock.calls).toEqual([[{ ...selectionInput, documentId: alteredDocumentId }], [selectionInput]])
  expect(model.doStreamCalls).toHaveLength(researchAgentLimits.steps)
  expect(model.doStreamCalls.at(-1)?.toolChoice?.type).toBe("none")
  expect(text).toBe(answer)
  expect(fixture.record).toHaveBeenCalledWith(
    expect.objectContaining({
      tool: "get_bill_text",
      input: selectionInput,
      data: expect.objectContaining({ document: selectionDocument })
    })
  )
})

const broadTextInput = {
  limit: 20,
  query: "patient cost sharing rebate pass through spread pricing fees compensation pharmacy benefit managers",
  jurisdictionIds: ["jurisdiction:us"],
  sessionIds: ["session:us:119"],
  classifications: ["version"],
  mode: "lexical"
}

it("rejects enrichment overflow with actionable narrowing without dropping evidence or retrying", async () => {
  const items = Array.from({ length: 5 }, (_, index) => ({
    id: `section:${index}`,
    documentId: `${selectionBillId}:document:${index}`,
    billId: selectionBillId,
    sectionIdentifier: `SEC. ${index + 1}`,
    title: "Pharmacy benefit manager compensation",
    sourceUrl: `https://www.congress.gov/bill/119th-congress/house-bill/9619/text?section=${index}`,
    text: "Patient cost sharing and rebate pass through. ".repeat(650)
  }))
  const searchBillText = vi.fn<LegislationQueryApi["searchBillText"]>(async (input) => ({
    items: items.slice(0, input.limit ?? items.length),
    nextCursor: "unread-page",
    truncated: true
  }))
  const onContents = vi.fn<NonNullable<Parameters<typeof createResearchTools>[9]>>()
  const onMeasurement = vi.fn<(measurement: ResearchToolMeasurement) => void>()
  const fixture = selectionTools({ searchBillText }, { onContents, onMeasurement })
  await expect(callWebTool("search_bill_text", broadTextInput, fixture.tools)).rejects.toMatchObject({
    code: "result_limit",
    recovery: {
      action: "narrow",
      instruction: expect.stringContaining("limit: 1")
    },
    message: expect.stringContaining("coverage remains incomplete")
  })
  const { classifications, ...selection } = broadTextInput
  expect(searchBillText).toHaveBeenCalledExactlyOnceWith({
    ...selection,
    billIds: undefined,
    documentClassifications: classifications
  })
  expect(onContents).not.toHaveBeenCalled()
  expect(fixture.record).toHaveBeenCalledExactlyOnceWith({
    tool: "search_bill_text",
    input: broadTextInput,
    failure: "result_limit"
  })
  expect(onMeasurement).toHaveBeenCalledOnce()
  const measured = onMeasurement.mock.calls[0]?.[0]
  expect(measured?.rawResultBytes).toBeLessThan(researchResultByteLimit)
  expect(measured?.enrichedResultBytes).toBeGreaterThan(researchResultByteLimit)
  expect(measured?.modelResultBytes).toBeGreaterThan(researchResultByteLimit)
  expect(measured).toMatchObject({
    outcome: "error",
    failureCode: "result_limit",
    resultCount: 5,
    hasNextPage: true,
    attemptCount: 1
  })
  expect(fixture.report).toHaveBeenCalledWith(expect.objectContaining({ measurement: measured }))
  const narrowed = { ...broadTextInput, limit: 1, billId: selectionBillId }
  const output = await callWebTool("search_bill_text", narrowed, fixture.tools)
  expect(output).toMatchObject({
    data: { items: [items[0]], nextCursor: expect.any(String), truncated: true },
    evidence: [
      {
        recordId: items[0]?.documentId,
        billId: selectionBillId,
        sourceUrl: items[0]?.sourceUrl,
        content: { state: "available", truncated: true }
      }
    ]
  })
  expect(Buffer.byteLength(researchModelOutput({ output }).value, "utf8")).toBeLessThan(researchResultByteLimit)
  expect(searchBillText).toHaveBeenCalledTimes(2)
  expect(fixture.record).toHaveBeenLastCalledWith(
    expect.objectContaining({ input: narrowed, evidence: expect.any(Array) })
  )
})

it("keeps raw-budget rejection measured and does not treat an oversized record as no evidence", async () => {
  const getBill = vi.fn<LegislationQueryApi["getBill"]>(async () => ({
    bill: { id: selectionBillId, title: "Recorded bill", detail: "x".repeat(researchResultByteLimit) }
  }))
  const onMeasurement = vi.fn<(measurement: ResearchToolMeasurement) => void>()
  const fixture = selectionTools({ getBill }, { onMeasurement })
  await expect(callWebTool("get_bill", { id: selectionBillId }, fixture.tools)).rejects.toMatchObject({
    code: "result_limit",
    recovery: { action: "narrow", instruction: expect.stringContaining("childLimit: 1") }
  })
  const measured = onMeasurement.mock.calls[0]?.[0]
  expect(measured?.rawResultBytes).toBeGreaterThan(researchResultByteLimit)
  expect(measured).toMatchObject({ enrichedResultBytes: null, modelResultBytes: null, outcome: "error" })
  expect(getBill).toHaveBeenCalledOnce()
})

it("measures accepted output in UTF-8 bytes and distinguishes dependency time from whole-tool time", async () => {
  vi.useFakeTimers()
  const start = new Date("2026-09-18T12:00:00.000Z")
  vi.setSystemTime(start)
  let clock = 0
  vi.spyOn(performance, "now").mockImplementation(() => clock)
  const data = {
    items: [
      {
        documentId: selectionDocument.id,
        billId: selectionBillId,
        title: "Recorded compensation",
        sourceUrl: "https://www.congress.gov/bill/119th-congress/house-bill/9619/text",
        text: "A recorded rule costs €12."
      }
    ],
    truncated: false
  }
  const searchBillText = vi.fn<LegislationQueryApi["searchBillText"]>(async () => {
    clock += 23
    vi.setSystemTime(new Date(start.getTime() + clock))
    return data
  })
  const onMeasurement = vi.fn<(measurement: ResearchToolMeasurement) => void>()
  const fixture = selectionTools(
    { searchBillText },
    {
      onMeasurement,
      onContents: () => {
        clock += 8
        vi.setSystemTime(new Date(start.getTime() + clock))
      }
    }
  )
  const output = await callWebTool("search_bill_text", broadTextInput, fixture.tools)
  expect(onMeasurement).toHaveBeenCalledExactlyOnceWith({
    runId: expect.any(String),
    toolCallId: expect.any(String),
    toolName: "search_bill_text",
    startedAt: start.toISOString(),
    finishedAt: "2026-09-18T12:00:00.031Z",
    durationMs: 31,
    dependencyDurationMs: 23,
    rawResultBytes: Buffer.byteLength(JSON.stringify({ data }), "utf8"),
    enrichedResultBytes: Buffer.byteLength(JSON.stringify(output), "utf8"),
    modelResultBytes: Buffer.byteLength(researchModelOutput({ output }).value, "utf8"),
    resultCount: 1,
    hasNextPage: false,
    outcome: "success",
    failureCode: null,
    attemptCount: 1,
    internalRetryCount: null,
    retryOfToolCallId: null
  })
  const measuredText = JSON.stringify(onMeasurement.mock.calls)
  expect(measuredText).not.toContain("€12")
  expect(measuredText).not.toContain(broadTextInput.query)
  expect(output).toMatchObject({
    evidence: [
      {
        recordId: selectionDocument.id,
        billId: selectionBillId,
        content: { state: "available", quote: data.items[0]?.text }
      }
    ]
  })
})

it("enforces the exact model boundary including added record links and multibyte text", () => {
  const empty = { evidence: [], data: { text: "€" } }
  const bytes = Buffer.byteLength(researchModelOutput({ output: empty }).value, "utf8")
  const atLimit = { ...empty, data: { text: `€${"x".repeat(researchResultByteLimit - bytes)}` } }
  expect(Buffer.byteLength(researchModelOutput({ output: atLimit }).value, "utf8")).toBe(researchResultByteLimit)
  expect(() => researchModelOutput({ output: { ...atLimit, data: { text: `${atLimit.data.text}x` } } })).toThrow(
    expect.objectContaining({ code: "result_limit" })
  )

  const resultSet: EntityPage = {
    id: "11111111-1111-4111-8111-111111111111",
    kind: "bill",
    presentation: "list",
    page: 0,
    start: 1,
    end: 1,
    items: [{ id: selectionBillId, kind: "bill", title: "HR 9619", sourceUrl: null, fields: [], tallies: [] }],
    hasNext: false,
    hasPrevious: false,
    warnings: []
  }
  const enriched = { evidence: [], resultSet, padding: "" }
  enriched.padding = "x".repeat(researchResultByteLimit - Buffer.byteLength(JSON.stringify(enriched), "utf8"))
  expect(Buffer.byteLength(JSON.stringify(enriched), "utf8")).toBe(researchResultByteLimit)
  expect(() => researchModelOutput({ output: enriched })).toThrow(expect.objectContaining({ code: "result_limit" }))
})

it("serves the static analytics catalog through shared telemetry without opening the research database runtime", async () => {
  const catalog = vi.fn<NonNullable<LegislationQueryApi["describeAnalytics"]>>(async (datasets) =>
    describeAnalytics(datasets)
  )
  const aggregate = vi.fn<NonNullable<LegislationQueryApi["analyzeLegislation"]>>()
  applicationQueryService.mockReturnValue({ describeAnalytics: catalog, analyzeLegislation: aggregate })
  const tools = createResearchTools(
    { NODE_ENV: "development" },
    new AbortController().signal,
    () => true,
    vi.fn<() => void>()
  )
  const output = await callWebTool("describe_analytics", {}, tools)
  expect(output).toMatchObject({ data: describeAnalytics(), evidence: [] })
  expect(catalog).toHaveBeenCalledExactlyOnceWith(undefined)
  expect(analyticsObserve).toHaveBeenCalledWith("mcp.describe_analytics", expect.any(Object), expect.any(Function))
  expect(runtimeRun).not.toHaveBeenCalled()
  expect(aggregate).not.toHaveBeenCalled()
})

it("keeps catalog examples out of evidence, selections and memory without stripping aggregate data", async () => {
  const catalog = {
    ...describeAnalytics(["bills"]),
    examples: {
      documents: [{ ...selectionDocument, billId: "bill:us:118:hr:9619", title: "string" }],
      nextCursor: "placeholder-cursor"
    }
  }
  const aggregate = {
    rows: [{ total: 4 }],
    receipt: { queryId: "aq_fixture", queryHash: "fixture-hash", nextOffset: null }
  }
  const onContents = vi.fn<NonNullable<Parameters<typeof createResearchTools>[9]>>()
  const getBillText = vi.fn<LegislationQueryApi["getBillText"]>(async () => ({
    document: selectionDocument,
    sections: []
  }))
  const fixture = selectionTools(
    {
      describeAnalytics: async () => catalog,
      analyzeLegislation: async () => aggregate,
      getBillText
    },
    { onContents }
  )
  const output = await callWebTool("describe_analytics", { datasets: ["bills"] }, fixture.tools)
  expect(output).toMatchObject({
    data: { details: catalog.details, examples: { documents: catalog.examples.documents } },
    evidence: [],
    presentationOptions: []
  })
  expect(researchModelOutput({ output }).value).not.toContain("#citation-")
  expect(onContents).not.toHaveBeenCalled()
  expect(fixture.record).not.toHaveBeenCalled()
  await callWebTool("get_bill_text", selectionInput, fixture.tools)
  expect(getBillText).toHaveBeenCalledExactlyOnceWith(selectionInput)
  await expect(
    callWebTool(
      "analyze_legislation",
      { dataset: "bills", metrics: [{ name: "total", operation: "countDistinct", field: "id" }] },
      fixture.tools
    )
  ).resolves.toMatchObject({ data: aggregate })
  expect(fixture.record).toHaveBeenLastCalledWith(
    expect.objectContaining({
      tool: "analyze_legislation",
      data: aggregate
    })
  )
})

it("retains analytics admission and aggregate execution boundaries", async () => {
  const catalog = vi.fn<NonNullable<LegislationQueryApi["describeAnalytics"]>>(async () => describeAnalytics())
  applicationQueryService.mockReturnValue({
    describeAnalytics: catalog,
    analyzeLegislation: vi.fn<NonNullable<LegislationQueryApi["analyzeLegislation"]>>()
  })
  const denied = createResearchTools(
    { NODE_ENV: "development" },
    new AbortController().signal,
    () => false,
    vi.fn<() => void>()
  )
  await expect(callWebTool("describe_analytics", {}, denied)).rejects.toMatchObject({ code: "interrupted" })
  expect(catalog).not.toHaveBeenCalled()
  runtimeRun.mockRejectedValueOnce(new LegislationError("dependency_unavailable", "Database fixture unavailable"))
  await expect(
    callWebTool(
      "analyze_legislation",
      { dataset: "bills", metrics: [{ name: "total", operation: "countDistinct", field: "id" }] },
      createResearchTools({ NODE_ENV: "development" }, new AbortController().signal, () => true, vi.fn<() => void>())
    )
  ).rejects.toMatchObject({ code: "dependency_unavailable" })
  expect(runtimeRun).toHaveBeenCalledOnce()
})

it.each([
  { databaseCode: "57014", expected: "timeout" },
  { databaseCode: "08006", expected: "dependency_unavailable" },
  { databaseCode: "42804", expected: "internal" }
])(
  "classifies an observed outer-runtime $databaseCode without leaking its exception or retrying",
  async ({ databaseCode, expected }) => {
    runtimeRun.mockRejectedValueOnce(
      new Error("Database wrapper with private connection information", {
        cause: Object.assign(new Error("Private database detail"), { code: databaseCode })
      })
    )
    const report = vi.fn<() => void>()
    const tools = createResearchTools({ NODE_ENV: "development" }, new AbortController().signal, () => true, report)
    await expect(callWebTool("get_bill_timeline", { limit: 100, id: "bill:us:119:hr:1" }, tools)).rejects.toMatchObject(
      {
        code: expected
      }
    )
    expect(runtimeRun).toHaveBeenCalledOnce()
    expect(JSON.stringify(report.mock.calls)).not.toMatch(/private|Private/)
  }
)

it("preserves the exact timeline call and date/null evidence without a hidden retry", async () => {
  const events = [
    { id: "action:1", type: "action", date: "2025-07-03", description: "Date-only event" },
    { id: "vote:1", type: "vote", date: "2025-07-04T00:15:12.345Z", description: "Timestamp event" },
    { id: "action:2", type: "action", date: null, description: "Undated event" }
  ]
  const getBillTimeline = vi.fn<LegislationQueryApi["getBillTimeline"]>(async () => ({
    billId: "bill:us:119:hr:1",
    events,
    truncated: false,
    warnings: []
  }))
  const fixture = selectionTools({ getBillTimeline })
  const input = { limit: 100, id: "bill:us:119:hr:1" }
  const output = await callWebTool("get_bill_timeline", input, fixture.tools)
  expect(output).toMatchObject({ data: { events } })
  expect(getBillTimeline).toHaveBeenCalledExactlyOnceWith(input)
})

it.each([
  { error: new LegislationError("dependency_unavailable", "The database query timed out."), code: "timeout" },
  { error: new LegislationError("dependency_unavailable", "Unavailable fixture"), code: "dependency_unavailable" },
  { error: new Error("Unknown historical cause; private-token and raw reasoning must not leak"), code: "internal" }
])(
  "reports scoped $code failures for the retained material query without inventing absent evidence",
  async ({ error, code }) => {
    const input = {
      limit: 20,
      sessionIds: ["session:us:119"],
      documentFrom: "2025-01-01",
      documentTo: "2026-09-18",
      jurisdictionId: "jurisdiction:us",
      mode: "hybrid",
      query: "AI education claims procurement evidence schools tutoring assessment hearings testimony"
    }
    const searchSupportingMaterials = vi.fn<LegislationQueryApi["searchSupportingMaterials"]>(async () => {
      throw error
    })
    const onMeasurement = vi.fn<(measurement: ResearchToolMeasurement) => void>()
    const fixture = selectionTools({ searchSupportingMaterials }, { onMeasurement })
    await expect(callWebTool("search_supporting_materials", input, fixture.tools)).rejects.toMatchObject({ code })
    expect(searchSupportingMaterials).toHaveBeenCalledExactlyOnceWith(input)
    expect(fixture.record).toHaveBeenCalledExactlyOnceWith({
      tool: "search_supporting_materials",
      input,
      failure: code
    })
    expect(onMeasurement).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        outcome: "error",
        failureCode: code,
        rawResultBytes: null,
        enrichedResultBytes: null,
        modelResultBytes: null,
        resultCount: null,
        hasNextPage: null,
        attemptCount: 1
      })
    )
    expect(JSON.stringify(onMeasurement.mock.calls)).not.toMatch(/private-token|raw reasoning/)
  }
)

it("records rejected admission without fabricating dependency duration and tolerates an unavailable measurement sink", async () => {
  const onMeasurement = vi.fn<(measurement: ResearchToolMeasurement) => void>()
  const denied = selectionTools({}, { canResearch: () => false, onMeasurement })
  await expect(callWebTool("get_bill", { id: selectionBillId }, denied.tools)).rejects.toMatchObject({
    code: "interrupted"
  })
  expect(onMeasurement).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ outcome: "error", failureCode: "interrupted", dependencyDurationMs: null })
  )
  onMeasurement.mockImplementation(() => {
    throw new Error("Telemetry sink unavailable")
  })
  const accepted = selectionTools({}, { onMeasurement })
  await expect(callWebTool("get_bill", { id: selectionBillId }, accepted.tools)).resolves.toMatchObject({
    data: { bill: { id: selectionBillId } }
  })
  expect(accepted.report).not.toHaveBeenCalled()
})

it("measures repeated inputs as distinct calls without inventing retry relationships", async () => {
  const onMeasurement = vi.fn<(measurement: ResearchToolMeasurement) => void>()
  const fixture = selectionTools({}, { onMeasurement })
  const input = { id: selectionBillId }
  await callWebTool("get_bill", input, fixture.tools, "call-first")
  await callWebTool("get_bill", input, fixture.tools, "call-second")
  expect(onMeasurement.mock.calls.map(([value]) => value.toolCallId)).toEqual(["call-first", "call-second"])
  expect(onMeasurement.mock.calls.map(([value]) => value.retryOfToolCallId)).toEqual([null, null])
  expect(onMeasurement.mock.calls.map(([value]) => value.outcome)).toEqual(["success", "success"])
})
