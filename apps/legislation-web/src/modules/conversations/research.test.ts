import type { LookupAddress } from "node:dns"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import { describeAnalytics } from "@repo/legislation-core/research/analytics-catalog"
import { researchResultByteLimit, researchResultFragmentSchema } from "@repo/legislation-core/research/result-pages"
import type { LegislationQueryApi } from "@repo/legislation-core/research/tools"
import { dynamicTool, isStepCount, streamText } from "ai"
import { MockLanguageModelV4 } from "ai/test"
import { afterEach, expect, it, vi } from "vitest"
import { z } from "zod"
import { runResearchAgent } from "./agent"
import { createCitationPresentation } from "./components/citationPresentation"
import { compositionInstructions, recordMentionHref } from "./composition"
import type { EntityPage } from "./entityResults"
import { evidenceSnapshotSchema, projectResearchEvidence } from "./evidence"
import { createResearchTools, modelInputSchema, researchModelOutput } from "./research"
import { researchFailureCode } from "./researchFailure"
import type { ResearchToolMeasurement } from "./researchMeasurement"
import type { ResearchObservation } from "./researchMemory"
import { resultStore } from "./resultStore"

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

function webTools(signal = new AbortController().signal, canResearch = () => true, environment = webEnvironment) {
  return createResearchTools(environment, signal, canResearch, vi.fn<() => void>())
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
  const source = z.object({ evidence: z.tuple([z.object({ id: z.string() })]) }).parse(result).evidence[0]
  expect(researchModelOutput({ output: result }).value).toContain(`#citation-${source.id}`)
  expect(researchModelOutput({ output: result }).value).not.toContain("(#citation-e1)")
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

it("retries an empty tag selection on the same public page without discarding available text", async () => {
  const fetchMock = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json({ success: true, data: { markdown: "", metadata: { statusCode: 200 } } }))
    .mockResolvedValueOnce(
      Response.json({ success: true, data: { markdown: "Official bill text", metadata: { statusCode: 200 } } })
    )
  vi.stubGlobal("fetch", fetchMock)
  const result = await callWebTool("read_web_page", { url: "https://example.org/bill", includeTags: ["main"] })
  expect(result).toMatchObject({
    evidence: [{ content: { state: "available", quote: "Official bill text" } }],
    data: { sourceLocator: null, truncated: false }
  })
  const first = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
  const second = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))
  expect(first).toMatchObject({ url: "https://example.org/bill", includeTags: ["main"] })
  expect(second).toMatchObject({ url: "https://example.org/bill", skipTlsVerification: false })
  expect(second).not.toHaveProperty("includeTags")
})

it("does not turn a genuinely empty page into evidence or retry it indefinitely", async () => {
  const fetchMock = vi.fn<typeof fetch>(async () =>
    Response.json({ success: true, data: { markdown: "  ", metadata: {} } })
  )
  vi.stubGlobal("fetch", fetchMock)
  await expect(
    callWebTool("read_web_page", { url: "https://example.org/bill", includeTags: ["main"] })
  ).rejects.toMatchObject({ code: "invalid_response" })
  expect(fetchMock).toHaveBeenCalledTimes(2)
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

it("does not claim complete PDF coverage when the provider omits the total page count", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>(async () =>
      Response.json({
        success: true,
        data: { markdown: "PDF excerpt", metadata: { sourceURL: "https://example.org/report.pdf" } }
      })
    )
  )
  const result = await callWebTool("read_web_page", { url: "https://example.org/report.pdf" })
  expect(result).toMatchObject({
    evidence: [{ locator: "Requested first 10 PDF pages", content: { state: "available", truncated: true } }]
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
    code: "not_found",
    recovery: { action: "narrow", instruction: expect.stringContaining("Do not guess replacement URL paths") }
  })
})

it.each([
  [401, "forbidden"],
  [403, "forbidden"],
  [408, "timeout"],
  [410, "not_found"],
  [500, "dependency_unavailable"],
  [504, "timeout"]
])(
  "preserves publisher status %s instead of treating every source error as a provider outage",
  async (statusCode, code) => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json({
        success: true,
        data: { markdown: "Error page, not evidence", metadata: { statusCode, error: "Publisher error" } }
      })
    )
    vi.stubGlobal("fetch", fetchMock)
    await expect(
      callWebTool("read_web_page", { url: "https://example.org/bill", includeTags: ["main"] })
    ).rejects.toMatchObject({ code })
    expect(fetchMock).toHaveBeenCalledOnce()
  }
)

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

it("uses separate configured search and read deadlines with the existing defaults", async () => {
  const timeout = vi.spyOn(AbortSignal, "timeout")
  const fetchMock = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json({ success: true, data: { web: [] } }))
    .mockResolvedValueOnce(Response.json({ success: true, data: { markdown: "Text", metadata: {} } }))
    .mockResolvedValueOnce(Response.json({ success: true, data: { web: [] } }))
  vi.stubGlobal("fetch", fetchMock)
  const tools = webTools(undefined, undefined, {
    ...webEnvironment,
    FIRECRAWL_SEARCH_TIMEOUT_MS: "45000",
    FIRECRAWL_READ_TIMEOUT_MS: "90000"
  })
  await callWebTool("search_web", { query: "policy" }, tools)
  await callWebTool("read_web_page", { url: "https://example.org" }, tools)
  await callWebTool("search_web", { query: "policy" })
  expect(timeout.mock.calls.map(([milliseconds]) => milliseconds)).toEqual([45000, 90000, 30000])
  expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toHaveProperty("timeout", 40000)
  expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toHaveProperty("timeout", 85000)
  expect(JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body))).toHaveProperty("timeout", 25000)
})

it.each([408, 429, 500, 502, 503, 504])("recovers a transient web HTTP %s response", async (status) => {
  const timeout = vi.spyOn(AbortSignal, "timeout")
  const fetchMock = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(new Response("private provider detail", { status }))
    .mockResolvedValueOnce(Response.json({ success: true, data: { web: [] } }))
  vi.stubGlobal("fetch", fetchMock)
  await expect(callWebTool("search_web", { query: "policy" })).resolves.toMatchObject({ data: { items: [] } })
  expect(fetchMock).toHaveBeenCalledTimes(2)
  expect(timeout).toHaveBeenCalledTimes(1)
  expect(fetchMock.mock.calls[0]?.[1]?.signal).toBe(fetchMock.mock.calls[1]?.[1]?.signal)
})

it.each([400, 401, 402, 403, 413, 422, 501])("does not retry permanent web HTTP %s", async (status) => {
  const fetchMock = vi.fn<typeof fetch>(async () => new Response("fixture-secret", { status }))
  vi.stubGlobal("fetch", fetchMock)
  await expect(callWebTool("search_web", { query: "policy" })).rejects.toMatchObject({ code: "dependency_unavailable" })
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it("bounds repeated transient web failures and sanitizes retry diagnostics", async () => {
  const output = vi.spyOn(process.stdout, "write").mockReturnValue(true)
  const fetchMock = vi.fn<typeof fetch>(async () => new Response("fixture-secret provider detail", { status: 503 }))
  vi.stubGlobal("fetch", fetchMock)
  const result = callWebTool("search_web", { query: "private query fixture" })
  await expect(result).rejects.toMatchObject({ code: "dependency_unavailable" })
  expect(fetchMock).toHaveBeenCalledTimes(3)
  const diagnostics = JSON.stringify(output.mock.calls)
  expect(diagnostics).toContain("web_dependency_retry")
  expect(diagnostics).not.toContain("fixture-secret")
  expect(diagnostics).not.toContain("private query fixture")
  expect(diagnostics).not.toContain("provider detail")
})

it("recovers a known socket failure but does not retry arbitrary exceptions", async () => {
  const failure = new TypeError("fetch failed", {
    cause: Object.assign(new Error("socket reset"), { code: "ECONNRESET" })
  })
  const fetchMock = vi
    .fn<typeof fetch>()
    .mockRejectedValueOnce(failure)
    .mockResolvedValueOnce(Response.json({ success: true, data: { web: [] } }))
  vi.stubGlobal("fetch", fetchMock)
  await callWebTool("search_web", { query: "policy" })
  expect(fetchMock).toHaveBeenCalledTimes(2)
  fetchMock.mockReset().mockRejectedValue(new TypeError("programming failure"))
  await expect(callWebTool("search_web", { query: "policy" })).rejects.toMatchObject({ code: "dependency_unavailable" })
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it("stops during web retry backoff without making another request", async () => {
  const controller = new AbortController()
  const fetchMock = vi.fn<typeof fetch>(async () => {
    setTimeout(() => controller.abort(), 20)
    return new Response("busy", { status: 503 })
  })
  vi.stubGlobal("fetch", fetchMock)
  await expect(callWebTool("search_web", { query: "policy" }, webTools(controller.signal))).rejects.toMatchObject({
    code: "interrupted"
  })
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it("cancels a stalled response body when the operation deadline expires", async () => {
  const deadline = new AbortController()
  vi.spyOn(AbortSignal, "timeout").mockReturnValue(deadline.signal)
  const cancel = vi.fn<() => void>()
  const fetchMock = vi.fn<typeof fetch>(
    async () =>
      new Response(
        new ReadableStream({
          start() {
            setTimeout(() => deadline.abort(new DOMException("deadline", "TimeoutError")), 20)
          },
          cancel
        })
      )
  )
  vi.stubGlobal("fetch", fetchMock)
  await expect(callWebTool("search_web", { query: "policy" })).rejects.toMatchObject({ code: "timeout" })
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(cancel).toHaveBeenCalledTimes(1)
})

it("applies the read deadline to DNS validation before any provider request", async () => {
  const deadline = new AbortController()
  vi.spyOn(AbortSignal, "timeout").mockReturnValue(deadline.signal)
  lookupMock.mockImplementationOnce(async () => {
    setTimeout(() => deadline.abort(new DOMException("deadline", "TimeoutError")), 20)
    return await new Promise<LookupAddress[]>(() => undefined)
  })
  const fetchMock = vi.fn<typeof fetch>()
  vi.stubGlobal("fetch", fetchMock)
  await expect(callWebTool("read_web_page", { url: "https://example.org" })).rejects.toMatchObject({ code: "timeout" })
  expect(fetchMock).not.toHaveBeenCalled()
})

it("cancels oversized streamed bodies without parsing partial JSON or retrying", async () => {
  const cancel = vi.fn<() => void>()
  const fetchMock = vi.fn<typeof fetch>(
    async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('{"success":true,"data":{"markdown":"'))
            controller.enqueue(new Uint8Array(1_000_000))
          },
          cancel
        })
      )
  )
  vi.stubGlobal("fetch", fetchMock)
  await expect(
    callWebTool("read_web_page", {
      url: "https://example.org/large",
      includeTags: ["article"]
    })
  ).rejects.toMatchObject({ code: "result_limit" })
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(cancel).toHaveBeenCalledTimes(1)
})

it.each(["malformed", "oversized", "schema"])("does not retry a %s response", async (kind) => {
  const fetchMock = vi.fn<typeof fetch>(async () => {
    if (kind === "malformed") {
      return new Response("not JSON")
    }
    if (kind === "oversized") {
      return new Response("x".repeat(1_000_001))
    }
    return Response.json({ success: true, data: {} })
  })
  vi.stubGlobal("fetch", fetchMock)
  await expect(callWebTool("search_web", { query: "policy" })).rejects.toMatchObject({
    code: kind === "oversized" ? "result_limit" : "invalid_response"
  })
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it("requests provider-supported selected content and marks its coverage incomplete", async () => {
  const fetchMock = vi.fn<typeof fetch>(async () =>
    Response.json({ success: true, data: { markdown: "Selected text", metadata: {} } })
  )
  vi.stubGlobal("fetch", fetchMock)
  const result = await callWebTool("read_web_page", {
    url: "https://example.org/large",
    includeTags: ["article"],
    maxPdfPages: 1
  })
  expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
    formats: ["markdown"],
    onlyMainContent: true,
    includeTags: ["article"],
    parsers: [{ type: "pdf", maxPages: 1 }]
  })
  expect(result).toMatchObject({
    evidence: [{ locator: "Selected HTML tags: article", content: { state: "available", truncated: true } }]
  })
})

it.each([{ includeTags: [] }, { includeTags: ["<script>"] }, { maxPdfPages: 0 }, { maxPdfPages: 11 }])(
  "rejects invalid content selection before fetching: %j",
  async (selection) => {
    const fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal("fetch", fetchMock)
    await expect(callWebTool("read_web_page", { url: "https://example.org", ...selection })).rejects.toMatchObject({
      code: "invalid_request"
    })
    expect(fetchMock).not.toHaveBeenCalled()
  }
)

it("allows web research beyond 24 calls while preserving the clarification gate", async () => {
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
  for (let index = 0; index < 30; index++) {
    await callWebTool("search_web", { query: "policy" }, tools)
  }
  expect(fetchMock).toHaveBeenCalledTimes(30)
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
  ["conflict", "precondition_failed"],
  ["precondition_failed", "precondition_failed"],
  ["unprocessable", "invalid_request"]
])("preserves actionable failure category %s", (input, expected) => {
  expect(researchFailureCode(input)).toBe(expected)
})

it("passes copy-ready evidence citations through the actual SDK tool-result boundary", async () => {
  const evidenceId = "11111111-1111-4111-8111-111111111111"
  const output = {
    data: { id: "bill:ca:20232024:ab:2652" },
    presentationOptions: [
      {
        contentId: "33333333-3333-4333-8333-333333333333",
        components: ["CitationCard", "PassageQuote"],
        label: "Bill record",
        evidenceId
      }
    ],
    evidence: [
      {
        id: evidenceId,
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
              controller.enqueue({
                type: "text-delta",
                id: "answer",
                delta: `Bill record [1](#citation-${evidenceId}).`
              })
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
  expect(prompt).toContain(`#citation-${evidenceId}`)
  expect(prompt).toContain("presentationOptions")
  expect(prompt).toContain("33333333-3333-4333-8333-333333333333")
  expect(prompt).toContain("PassageQuote")
  expect(prompt).not.toContain("#citation-e7")
  expect(prompt).not.toContain("citationRef")
  expect(model.doStreamCalls).toHaveLength(2)
})

it("keeps opaque citation targets independent of result order and short reference numbers", () => {
  const firstId = "11111111-1111-4111-8111-111111111111"
  const secondId = "22222222-2222-4222-8222-222222222222"
  const evidence = [
    {
      id: firstId,
      citationRef: "e9",
      title: "First source",
      origin: "canonical",
      sourceUrl: null,
      content: { state: "not-collected" }
    },
    {
      id: secondId,
      citationRef: "e1",
      title: "Second source",
      origin: "canonical",
      sourceUrl: null,
      content: { state: "not-collected" }
    }
  ]
  const schema = z.object({ evidence: z.array(z.object({ id: z.string(), citation: z.string() })) })
  const forward = schema.parse(JSON.parse(researchModelOutput({ output: { evidence } }).value))
  const reverse = schema.parse(JSON.parse(researchModelOutput({ output: { evidence: evidence.toReversed() } }).value))
  expect(forward.evidence).toEqual([
    { id: firstId, citation: `[1](#citation-${firstId})` },
    { id: secondId, citation: `[2](#citation-${secondId})` }
  ])
  expect(reverse.evidence).toEqual([
    { id: secondId, citation: `[1](#citation-${secondId})` },
    { id: firstId, citation: `[2](#citation-${firstId})` }
  ])
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

it("exposes immutable evidence ids to the model without mutating browser snapshots or record references", () => {
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
        id: evidence.id,
        citation: `[1](#citation-${evidence.id})`,
        recordId: evidence.recordId,
        billId: evidence.billId,
        title: evidence.title,
        origin: evidence.origin,
        sourceUrl: evidence.sourceUrl,
        content: evidence.content
      }
    ]
  })
  expect(model.value).not.toContain("citationRef")
  expect(output.evidence[0]?.id).toBe("stable-evidence-identity")
  const presentation = createCitationPresentation("answer", "Claim [1](#citation-stable-evidence-identity).", [
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
  expect(schema.parse({ query: "education" })).toEqual({ query: "education" })
  expect(schema.safeParse({ limit: 25 }).success).toBe(false)
  expect(schema.safeParse({ query: "education", invented: true }).success).toBe(false)
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

it("executes model web calls that omit unused optional fields through SDK validation", async () => {
  const fetchMock = vi.fn<typeof fetch>(async () =>
    Response.json({
      success: true,
      data: { markdown: "Official source text", metadata: { statusCode: 200 } }
    })
  )
  vi.stubGlobal("fetch", fetchMock)
  const model = new MockLanguageModelV4({
    doStream: async ({ prompt }) => ({
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue({ type: "stream-start", warnings: [] })
          const hasResult = prompt.some((message) => message.role === "tool")
          if (hasResult) {
            controller.enqueue({ type: "text-start", id: "answer" })
            controller.enqueue({ type: "text-delta", id: "answer", delta: "The source was read." })
            controller.enqueue({ type: "text-end", id: "answer" })
          } else {
            controller.enqueue({
              type: "tool-call",
              toolCallId: "read-page",
              toolName: "read_web_page",
              input: JSON.stringify({ url: "https://example.org/bill", includeTags: ["main"] })
            })
          }
          controller.enqueue({
            type: "finish",
            finishReason: { unified: hasResult ? "stop" : "tool-calls", raw: "stop" },
            usage: {
              inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
              outputTokens: { total: 1, text: 1, reasoning: 0 }
            }
          })
          controller.close()
        }
      })
    })
  })
  const result = streamText({
    model,
    messages: [{ role: "user", content: "Read this public bill page." }],
    tools: await webTools(),
    stopWhen: isStepCount(2)
  })
  const outputs: unknown[] = []
  for await (const chunk of result.stream) {
    expect(chunk.type).not.toBe("tool-error")
    expect(chunk.type).not.toBe("error")
    if (chunk.type === "tool-result") {
      outputs.push(chunk.output)
    }
  }
  expect(fetchMock).toHaveBeenCalledOnce()
  expect(outputs).toEqual([
    expect.objectContaining({
      evidence: [
        expect.objectContaining({
          content: expect.objectContaining({ state: "available", quote: "Official source text" })
        })
      ]
    })
  ])
})

it("retains normalization when model inputs use an object schema pipeline", () => {
  const schema = modelInputSchema(
    z
      .object({ query: z.string(), limit: z.number().optional(), cursor: z.string().optional() })
      .transform((input) => ({ ...input, limit: input.limit ?? 10 }))
  )
  expect(schema.parse({ query: "regulations", limit: null, cursor: null })).toEqual({
    query: "regulations",
    limit: 10
  })
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
    sessionKey?: string
    onResultSet?: Parameters<typeof createResearchTools>[7]
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
      options.sessionKey,
      service,
      undefined,
      options.onResultSet,
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

it("reports an oversized full-document comparison with actionable section-level recovery", async () => {
  const compareBillVersions = vi.fn<LegislationQueryApi["compareBillVersions"]>(async () => {
    throw new LegislationError("payload_too_large", "The line comparison exceeds the edit-distance or time limit.")
  })
  const fixture = selectionTools({ compareBillVersions })
  await expect(
    callWebTool(
      "compare_bill_versions",
      { billId: selectionBillId, documentIds: [selectionDocument.id, "document:second"], limit: 100 },
      fixture.tools
    )
  ).rejects.toMatchObject({
    code: "result_limit",
    recovery: {
      action: "narrow",
      instruction: expect.stringContaining("Changing limit only changes output pagination")
    }
  })
  expect(compareBillVersions).toHaveBeenCalledOnce()
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
  ).rejects.toMatchObject({ code: "invalid_cursor", recovery: { action: "restart" } })
  await expect(
    callWebTool("search_bill_text", { ...searchInput, jurisdictionIds: ["jurisdiction:ca"], cursor }, fixture.tools)
  ).rejects.toMatchObject({ code: "invalid_cursor", recovery: { action: "restart" } })
  expect(searchBillText).toHaveBeenCalledTimes(2)
})

it("keeps selection validation beyond 24 calls and permits valid research after rejected selections", async () => {
  const getBillText = vi.fn<LegislationQueryApi["getBillText"]>(async () => ({
    document: selectionDocument,
    sections: [],
    nextCursor: null
  }))
  const fixture = selectionTools({ getBillText })
  const input = { ...selectionInput, cursor: "invented" }
  await expect(callWebTool("get_bill_text", input, fixture.tools)).rejects.toMatchObject({
    code: "invalid_cursor",
    recovery: { action: "restart" }
  })
  for (let index = 1; index < 30; index++) {
    await expect(callWebTool("get_bill_text", input, fixture.tools)).rejects.toMatchObject({
      code: "invalid_cursor",
      recovery: { action: "answer" }
    })
  }
  expect(getBillText).not.toHaveBeenCalled()
  expect(fixture.report).toHaveBeenCalledTimes(30)
  await callWebTool("get_bill_text", selectionInput, fixture.tools)
  expect(getBillText).toHaveBeenCalledOnce()
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
    { name: "get_bill", input: { id: selectionBillId, childLimit: null, cursor: null } },
    { name: "get_bill_text", input: { ...selectionInput, documentId: alteredDocumentId, cursor: null } },
    { name: "get_bill_text", input: { ...selectionInput, cursor: null } }
  ]
  const answer =
    "Research is incomplete: the read failed, and a definitions heading does not establish whether duties are absent."
  let generations = 0
  const model = new MockLanguageModelV4({
    doStream: async () => {
      const call = scriptedCalls[generations] ?? {
        name: "get_bill_text",
        input: { ...selectionInput, cursor: "invented" }
      }
      generations++
      const isSynthesis = generations > 12
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
  expect(model.doStreamCalls).toHaveLength(13)
  expect(model.doStreamCalls.at(-1)?.toolChoice?.type).not.toBe("none")
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

it("pages search results that overflow after enrichment without dropping evidence or retrying", async () => {
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
  expect(
    Buffer.byteLength(JSON.stringify({ data: { items, nextCursor: "unread-page", truncated: true } }))
  ).toBeLessThan(researchResultByteLimit)
  const output = await callWebTool("search_bill_text", broadTextInput, fixture.tools)
  const pageSchema = z.object({
    data: z.object({ items: z.array(z.unknown()), nextCursor: z.string(), truncated: z.boolean() }),
    evidence: z.array(z.object({ content: z.object({ state: z.string() }) }))
  })
  const first = pageSchema.parse(output)
  expect(first.data.items.length).toBeGreaterThan(0)
  expect(first.data.items.length).toBeLessThan(items.length)
  expect(first.evidence.every((source) => source.content.state === "available")).toBe(true)
  expect(Buffer.byteLength(researchModelOutput({ output }).value)).toBeLessThanOrEqual(researchResultByteLimit)
  const { classifications, ...selection } = broadTextInput
  expect(searchBillText).toHaveBeenCalledExactlyOnceWith({
    ...selection,
    billIds: undefined,
    documentClassifications: classifications
  })
  expect(onContents).toHaveBeenCalledOnce()
  expect(fixture.record).toHaveBeenCalledExactlyOnceWith({
    tool: "search_bill_text",
    input: broadTextInput,
    data: first.data,
    evidence: expect.any(Array)
  })
  expect(onMeasurement).toHaveBeenCalledOnce()
  const measured = onMeasurement.mock.calls[0]?.[0]
  expect(measured?.rawResultBytes).toBeLessThan(researchResultByteLimit)
  expect(measured?.enrichedResultBytes).toBe(Buffer.byteLength(JSON.stringify(output)))
  expect(measured?.modelResultBytes).toBe(Buffer.byteLength(researchModelOutput({ output }).value))
  expect(measured).toMatchObject({
    outcome: "success",
    failureCode: null,
    resultCount: first.data.items.length,
    hasNextPage: true,
    attemptCount: 1
  })
  const collected = [...first.data.items]
  let cursor = first.data.nextCursor
  let pages = 1
  while (collected.length < items.length) {
    const output = await callWebTool("search_bill_text", { ...broadTextInput, cursor }, fixture.tools)
    const next = pageSchema.parse(output)
    expect(Buffer.byteLength(researchModelOutput({ output }).value)).toBeLessThanOrEqual(researchResultByteLimit)
    collected.push(...next.data.items)
    cursor = next.data.nextCursor
    expect(++pages).toBeLessThanOrEqual(items.length)
  }
  expect(collected).toEqual(items)
  expect(searchBillText).toHaveBeenCalledTimes(pages)
  expect(fixture.report).not.toHaveBeenCalled()
})

it.each(
  [
    { name: "get_bill_timeline", collection: "events", textKey: "sourceUrl", id: selectionBillId },
    { name: "get_supporting_material", collection: "sections", textKey: "text", id: "material:us:one" }
  ].flatMap((tool) => [178500, 320000].map((bytes) => ({ ...tool, bytes })))
)(
  "delivers every $name record from $bytes raw bytes through the model serializer",
  async ({ name, collection, textKey, id, bytes }) => {
    vi.spyOn(resultStore, "persist").mockResolvedValue(undefined)
    const records = Array.from({ length: name === "get_bill_timeline" ? 100 : 5 }, (_, index) => ({
      id: `section:${index}`,
      title: `Source passage ${index}`,
      ordinal: index,
      type: "action",
      description: "Recorded action",
      date: index === 0 ? null : "2025-01-01",
      sourceUrl: `https://example.gov/report#${index}`,
      [textKey]: textKey === "sourceUrl" ? `https://example.gov/report#${index}` : ""
    }))
    const metadata =
      name === "get_bill_timeline"
        ? { billId: id, warnings: [] }
        : {
            material: { id, title: "Report", sourceUrl: "https://example.gov/report" },
            links: [],
            linksTruncated: false
          }
    const data = { ...metadata, [collection]: records, truncated: false }
    const padding = Math.floor((bytes - Buffer.byteLength(JSON.stringify({ data }))) / records.length)
    for (const record of records) {
      record[textKey] = `${record[textKey]}${"x".repeat(padding)}`
    }
    expect(Buffer.byteLength(JSON.stringify({ data }))).toBeGreaterThanOrEqual(bytes - records.length)
    expect(Buffer.byteLength(JSON.stringify({ data }))).toBeLessThanOrEqual(bytes)
    const read = vi.fn<LegislationQueryApi["getBillTimeline"]>(async () => data)
    const fixture = selectionTools(
      { getBillTimeline: read, getSupportingMaterial: read },
      {
        sessionKey: crypto.randomUUID(),
        onResultSet: () => "r1",
        onContents: vi.fn<NonNullable<Parameters<typeof createResearchTools>[9]>>()
      }
    )
    const collected: unknown[] = []
    let cursor: string | undefined
    let pages = 0
    do {
      const output = await callWebTool(name, { id, limit: records.length, cursor }, fixture.tools)
      const page = z.object({ data: z.record(z.string(), z.json()), evidence: z.array(z.unknown()) }).parse(output)
      const items = z.array(z.json()).parse(page.data[collection])
      expect(page.data).toMatchObject(metadata)
      expect(page.evidence.length).toBeGreaterThan(0)
      expect(Buffer.byteLength(researchModelOutput({ output }).value)).toBeLessThanOrEqual(researchResultByteLimit)
      expect(items.length).toBeGreaterThan(0)
      collected.push(...items)
      cursor = z.string().optional().parse(page.data.nextCursor)
      expect(++pages).toBeLessThanOrEqual(records.length)
    } while (cursor)
    expect(pages).toBeGreaterThan(1)
    expect(collected).toEqual(records)
    expect(read).toHaveBeenCalledTimes(pages)
    expect(fixture.record).toHaveBeenCalledTimes(pages)
    expect(fixture.report).not.toHaveBeenCalled()
  }
)

it.each(
  [
    {
      name: "get_organization",
      root: "organization",
      key: "children",
      collection: "organization-children",
      id: "organization:us:one"
    },
    { name: "get_event", root: "event", key: "agendaItems", collection: "meeting-agenda", id: "event:us:one" },
    {
      name: "get_supporting_material",
      root: "material",
      key: "links",
      collection: "material-links",
      id: "material:us:one"
    }
  ].flatMap((tool) => [178500, 320000].map((bytes) => ({ ...tool, bytes })))
)(
  "delivers $name previews from $bytes raw bytes with complete relationship reads",
  async ({ name, root, key, collection, id, bytes }) => {
    vi.spyOn(resultStore, "persist").mockResolvedValue(undefined)
    const identity = { id, name: "Source record", title: "Source record", sourceUrl: "https://example.gov/record" }
    const records = Array.from({ length: 5 }, (_, index) => ({
      id: `record:${index}`,
      title: `Relationship ${index}`,
      sourceUrl: `https://example.gov/record#${index}`,
      text: ""
    }))
    const data = { [root]: identity, [key]: records, truncated: false }
    const padding = Math.floor((bytes - Buffer.byteLength(JSON.stringify({ data }))) / records.length)
    for (const record of records) {
      record.text = "x".repeat(padding)
    }
    expect(Buffer.byteLength(JSON.stringify({ data }))).toBeGreaterThanOrEqual(bytes - records.length)
    expect(Buffer.byteLength(JSON.stringify({ data }))).toBeLessThanOrEqual(bytes)
    const read = vi.fn<LegislationQueryApi["getOrganization"]>(async () => data)
    const readRecordCollection = vi.fn<NonNullable<LegislationQueryApi["readRecordCollection"]>>(async () => ({
      items: records,
      truncated: false
    }))
    const fixture = selectionTools(
      { getOrganization: read, getEvent: read, getSupportingMaterial: read, readRecordCollection },
      {
        sessionKey: crypto.randomUUID(),
        onResultSet: () => "r1",
        onContents: vi.fn<NonNullable<Parameters<typeof createResearchTools>[9]>>()
      }
    )
    const output = await callWebTool(name, { id }, fixture.tools)
    const preview = z
      .object({
        data: z.record(z.string(), z.json()),
        resultHandle: z.string(),
        evidence: z.array(z.unknown())
      })
      .parse(output)
    expect(preview.data[root]).toEqual(identity)
    expect(preview.data.truncated).toBe(true)
    expect(z.array(z.json()).parse(preview.data[key]).length).toBeLessThan(records.length)
    expect(preview.evidence.length).toBeGreaterThan(0)
    const serialized = researchModelOutput({ output }).value
    expect(Buffer.byteLength(serialized)).toBeLessThanOrEqual(researchResultByteLimit)
    expect(JSON.parse(serialized)).toMatchObject({
      recordLinks: expect.any(Array),
      presentationOptions: expect.any(Array)
    })
    expect(read).toHaveBeenCalledOnce()
    expect(readRecordCollection).not.toHaveBeenCalled()
    const handoff = z
      .record(z.string(), z.object({ tool: z.string(), input: z.record(z.string(), z.unknown()) }))
      .parse(preview.data.continuations)[key]
    expect(handoff).toEqual({ tool: "read_record_collection", input: { collection, recordId: id } })
    if (!handoff) {
      throw new Error("Missing collection handoff")
    }
    const collected: unknown[] = []
    let cursor: string | undefined
    let pages = 0
    do {
      const output = await callWebTool(handoff.tool, { ...handoff.input, cursor }, fixture.tools)
      expect(Buffer.byteLength(researchModelOutput({ output }).value)).toBeLessThanOrEqual(researchResultByteLimit)
      const page = z
        .object({ data: z.object({ items: z.array(z.json()), nextCursor: z.string().optional() }) })
        .parse(output)
      collected.push(...page.data.items)
      cursor = page.data.nextCursor
      expect(++pages).toBeLessThanOrEqual(records.length)
    } while (cursor)
    expect(collected).toEqual(records)
    expect(readRecordCollection).toHaveBeenCalledTimes(pages)
    expect(fixture.report).not.toHaveBeenCalled()
  }
)

it.each([
  { name: "get_organization", root: "organization", id: "organization:us:one" },
  { name: "get_event", root: "event", id: "event:us:one" },
  { name: "get_supporting_material", root: "material", id: "material:us:one" }
])("reconstructs $name identity when it exceeds one transport page", async ({ name, root, id }) => {
  const read = vi.fn<LegislationQueryApi["getOrganization"]>(async () => ({
    [root]: { id, description: "x".repeat(researchResultByteLimit) }
  }))
  const onContents = vi.fn<NonNullable<Parameters<typeof createResearchTools>[9]>>()
  const fixture = selectionTools({ getOrganization: read, getEvent: read, getSupportingMaterial: read }, { onContents })
  const result = await readFragmentedTool(name, { id }, fixture.tools)
  expect(result.data).toMatchObject({ [root]: { id, description: "x".repeat(researchResultByteLimit) } })
  expect(read).toHaveBeenCalledTimes(result.count)
  expect(onContents).toHaveBeenCalledOnce()
  expect(fixture.report).not.toHaveBeenCalled()
})

it.each([178500, 320000])(
  "delivers a bounded person preview and complete collection reads from %i raw bytes",
  async (bytes) => {
    vi.spyOn(resultStore, "persist").mockResolvedValue(undefined)
    const person = {
      id: "person:congress:m001111",
      name: "Patty Murray",
      sourceUrl: "https://www.congress.gov/member/patty-murray/M001111",
      party: "Democratic",
      isActive: true
    }
    const terms = Array.from({ length: 10 }, (_, index) => ({
      id: `term:${index}`,
      officeTitle: "Senator",
      sourceUrl: person.sourceUrl
    }))
    const memberships = Array.from({ length: 10 }, (_, index) => ({
      membership: { id: `membership:${index}`, sourceUrl: person.sourceUrl },
      organization: { id: `organization:congress:${index}`, name: `Committee ${index}`, description: "" }
    }))
    const sponsoredBills = Array.from({ length: 10 }, (_, index) => ({
      bill: { id: `bill:us:119:s:${index + 1}`, title: `Bill ${index}`, sourceUrl: person.sourceUrl }
    }))
    const data = {
      person,
      terms,
      termsTruncated: false,
      memberships: { items: memberships, truncated: false },
      sponsoredBills: { items: sponsoredBills, truncated: false },
      truncated: false
    }
    const padding = Math.floor((bytes - Buffer.byteLength(JSON.stringify({ data }))) / memberships.length)
    for (const membership of memberships) {
      membership.organization.description = "x".repeat(padding)
    }
    const rawBytes = Buffer.byteLength(JSON.stringify({ data }))
    expect(rawBytes).toBeGreaterThanOrEqual(bytes - memberships.length)
    expect(rawBytes).toBeLessThanOrEqual(bytes)
    const getPerson = vi.fn<LegislationQueryApi["getPerson"]>(async () => data)
    const getMemberships = vi.fn<NonNullable<LegislationQueryApi["getMemberships"]>>(async () => ({
      items: memberships,
      truncated: false
    }))
    const getSponsoredBills = vi.fn<NonNullable<LegislationQueryApi["getSponsoredBills"]>>(async () => ({
      items: sponsoredBills,
      truncated: false
    }))
    const readRecordCollection = vi.fn<NonNullable<LegislationQueryApi["readRecordCollection"]>>(async () => ({
      items: terms,
      truncated: false
    }))
    const onMeasurement = vi.fn<(measurement: ResearchToolMeasurement) => void>()
    const fixture = selectionTools(
      { getPerson, getMemberships, getSponsoredBills, readRecordCollection },
      {
        sessionKey: crypto.randomUUID(),
        onResultSet: () => "r1",
        onContents: vi.fn<NonNullable<Parameters<typeof createResearchTools>[9]>>(),
        onMeasurement
      }
    )
    const output = await callWebTool("get_person", { id: person.id }, fixture.tools)
    const preview = z
      .object({
        data: z.object({
          person: z.json(),
          terms: z.array(z.json()),
          truncated: z.literal(true),
          continuations: z.record(z.string(), z.object({ tool: z.string(), input: z.record(z.string(), z.unknown()) }))
        }),
        evidence: z.array(z.unknown()),
        resultHandle: z.string()
      })
      .parse(output)
    expect(preview.data.person).toEqual(person)
    expect(preview.data.terms.length).toBeLessThan(terms.length)
    expect(preview.evidence.length).toBeGreaterThan(0)
    const model = researchModelOutput({ output }).value
    const delivered = z.object({ data: z.json() }).parse(output).data
    expect(Buffer.byteLength(model)).toBeLessThanOrEqual(researchResultByteLimit)
    expect(JSON.parse(model)).toMatchObject({ recordLinks: expect.any(Array), presentationOptions: expect.any(Array) })
    expect(onMeasurement.mock.calls[0]?.[0]).toMatchObject({
      rawResultBytes: Buffer.byteLength(JSON.stringify({ data: delivered })),
      enrichedResultBytes: Buffer.byteLength(JSON.stringify(output)),
      modelResultBytes: Buffer.byteLength(model),
      outcome: "success",
      attemptCount: 1
    })
    expect(getPerson).toHaveBeenCalledExactlyOnceWith({ id: person.id })
    expect(getMemberships).not.toHaveBeenCalled()
    const expected = { terms, memberships, sponsoredBills }
    for (const key of ["terms", "memberships", "sponsoredBills"] as const) {
      const handoff = preview.data.continuations[key]
      expect(handoff).toBeDefined()
      if (!handoff) {
        throw new Error("Missing collection handoff")
      }
      const collected: unknown[] = []
      let cursor: string | undefined
      let pages = 0
      do {
        const output = await callWebTool(handoff.tool, { ...handoff.input, cursor }, fixture.tools)
        expect(Buffer.byteLength(researchModelOutput({ output }).value)).toBeLessThanOrEqual(researchResultByteLimit)
        const page = z
          .object({ data: z.object({ items: z.array(z.json()), nextCursor: z.string().optional() }) })
          .parse(output)
        collected.push(...page.data.items)
        cursor = page.data.nextCursor
        expect(++pages).toBeLessThan(20)
      } while (cursor)
      expect(collected).toEqual(expected[key])
    }
    expect(fixture.report).not.toHaveBeenCalled()
  }
)

async function readFragmentedTool(
  name: string,
  input: Record<string, unknown>,
  tools: ReturnType<typeof createResearchTools>
) {
  let cursor: string | undefined
  let text = ""
  for (let count = 0; count < 100; count++) {
    const output = await callWebTool(name, { ...input, cursor }, tools)
    expect(Buffer.byteLength(researchModelOutput({ output }).value, "utf8")).toBeLessThanOrEqual(
      researchResultByteLimit
    )
    const page = z
      .object({
        data: researchResultFragmentSchema,
        evidence: z.array(evidenceSnapshotSchema),
        assembly: z.object({ status: z.enum(["pending", "complete"]) }),
        evidencePage: z.object({ nextCursor: z.string().nullable(), partial: z.boolean() }).optional(),
        resultSet: z.unknown().optional()
      })
      .parse(output)
    expect(page.data.partialResult.textOffset).toBe(text.length)
    text += page.data.partialResult.text
    const complete = page.data.partialResult.nextTextOffset === null
    expect(page.assembly.status).toBe(complete ? "complete" : "pending")
    if (complete) {
      return { data: z.json().parse(JSON.parse(text)), page, count: count + 1 }
    }
    expect(page.evidence).toEqual([])
    expect(page.resultSet).toBeUndefined()
    cursor = page.data.nextCursor ?? undefined
    expect(cursor).toBeDefined()
  }
  throw new Error("Fragment continuation did not terminate")
}

it("reconstructs oversized person identity before registering citations or presentation content", async () => {
  const id = "person:congress:d000617"
  const person = { id, name: "Suzan DelBene", biography: "x".repeat(researchResultByteLimit) }
  const getPerson = vi.fn<LegislationQueryApi["getPerson"]>(async () => ({
    person,
    terms: [],
    memberships: { items: [] },
    sponsoredBills: { items: [] }
  }))
  const onContents = vi.fn<NonNullable<Parameters<typeof createResearchTools>[9]>>()
  const fixture = selectionTools({ getPerson }, { onContents })
  const result = await readFragmentedTool("get_person", { id }, fixture.tools)
  expect(result.data).toMatchObject({ person })
  expect(result.page.evidence).toEqual(
    expect.arrayContaining([expect.objectContaining({ recordId: id, title: person.name, citationRef: "e1" })])
  )
  expect(getPerson).toHaveBeenCalledTimes(result.count)
  expect(onContents).toHaveBeenCalledOnce()
  expect(fixture.report).not.toHaveBeenCalled()
})

it.each(["get_vote", "get_votes", "get_bill_votes"])(
  "sizes %s for evidence, presentation and record links while preserving every position",
  async (name) => {
    vi.spyOn(resultStore, "persist").mockResolvedValue(undefined)
    const details = Array.from({ length: name === "get_vote" ? 1 : 2 }, (_, voteIndex) => ({
      vote: {
        id: `vote:congress:house-119-1-${190 + voteIndex}`,
        identifier: `Roll call ${190 + voteIndex}`,
        motion: "On passage",
        question: "On passage",
        sourceUrl: `https://clerk.house.gov/Votes/2025${190 + voteIndex}`,
        yesCount: 15,
        noCount: 0
      },
      positions: Array.from({ length: 15 }, (_, index) => ({
        person: {
          id: `person:congress:member-${voteIndex}-${index}`,
          name: `Member ${voteIndex}-${index} \u20ac`,
          biography: ""
        },
        position: { sourceIdentity: `${voteIndex}-${index}`, option: "yes" }
      }))
    }))
    const raw =
      name === "get_vote"
        ? details[0]
        : { items: details.map((detail) => (name === "get_votes" ? { id: detail.vote.id, data: detail } : detail)) }
    const positions = details.flatMap((detail) => detail.positions)
    const padding = Math.floor(
      (researchResultByteLimit - 500 - Buffer.byteLength(JSON.stringify({ data: raw }))) / positions.length
    )
    for (const position of positions) {
      position.person.biography = "x".repeat(padding)
    }
    expect(Buffer.byteLength(JSON.stringify({ data: raw }))).toBeLessThan(researchResultByteLimit)
    const getVote = vi.fn<LegislationQueryApi["getVote"]>(async ({ id }) => {
      const detail = details.find((detail) => detail.vote.id === id)
      if (!detail) {
        throw new Error("Unknown fixture vote")
      }
      return detail
    })
    const getBillVotes = vi.fn<LegislationQueryApi["getBillVotes"]>(async () => ({ items: details }))
    const onContents = vi.fn<NonNullable<Parameters<typeof createResearchTools>[9]>>()
    const onResultSet = vi.fn<NonNullable<Parameters<typeof createResearchTools>[7]>>(() => "r1")
    const onMeasurement = vi.fn<(measurement: ResearchToolMeasurement) => void>()
    const fixture = selectionTools(
      { getVote, getBillVotes },
      { sessionKey: crypto.randomUUID(), onContents, onResultSet, onMeasurement }
    )
    let input: Record<string, unknown> = { billId: selectionBillId, limit: 2 }
    if (name === "get_vote") {
      input = { id: details[0]?.vote.id }
    } else if (name === "get_votes") {
      input = { ids: details.map((detail) => detail.vote.id) }
    }
    let cursor: string | undefined
    const collected: unknown[] = []
    let pages = 0
    do {
      const output = await callWebTool(name, { ...input, cursor }, fixture.tools)
      const result = z
        .object({ data: z.json(), evidence: z.array(z.unknown()), resultHandle: z.string() })
        .parse(output)
      const page = z.object({ nextCursor: z.string().optional() }).parse(result.data)
      const records =
        name === "get_vote" ? [result.data] : z.object({ items: z.array(z.json()) }).parse(result.data).items
      for (const record of records) {
        const data = name === "get_votes" ? z.object({ data: z.json() }).parse(record).data : record
        const detail = z.object({ vote: z.object({ id: z.string() }), positions: z.array(z.json()) }).parse(data)
        expect(details.map((detail) => detail.vote.id)).toContain(detail.vote.id)
        collected.push(...detail.positions)
      }
      const model = researchModelOutput({ output }).value
      expect(Buffer.byteLength(model)).toBeLessThanOrEqual(researchResultByteLimit)
      expect(JSON.parse(model)).toMatchObject({
        recordLinks: expect.any(Array),
        presentationOptions: expect.any(Array)
      })
      expect(result.evidence.length).toBeGreaterThan(0)
      expect(onMeasurement.mock.calls.at(-1)?.[0]).toMatchObject({
        rawResultBytes: Buffer.byteLength(JSON.stringify({ data: result.data })),
        enrichedResultBytes: Buffer.byteLength(JSON.stringify(output)),
        modelResultBytes: Buffer.byteLength(model),
        outcome: "success",
        attemptCount: 1
      })
      cursor = page.nextCursor
      expect(++pages).toBeLessThan(10)
    } while (cursor)
    expect(pages).toBeGreaterThan(1)
    expect(collected).toEqual(positions)
    expect(onContents).toHaveBeenCalledTimes(pages)
    expect(onResultSet).toHaveBeenCalledTimes(pages)
    expect(resultStore.persist).toHaveBeenCalledTimes(pages)
    expect(getVote).toHaveBeenCalledTimes(name === "get_bill_votes" ? 0 : details.length * pages)
    expect(getBillVotes).toHaveBeenCalledTimes(name === "get_bill_votes" ? pages : 0)
    expect(fixture.report).not.toHaveBeenCalled()
  }
)

it("reconstructs an indivisible vote position that exceeds the enriched budget", async () => {
  vi.spyOn(resultStore, "persist").mockResolvedValue(undefined)
  const detail = {
    vote: { id: "vote:congress:house-119-1-190", question: "On passage", motion: "On passage" },
    positions: [
      {
        person: { id: "person:congress:one", name: "Member", biography: "" },
        position: { sourceIdentity: "one", option: "yes" }
      }
    ]
  }
  detail.positions[0]!.person.biography = "x".repeat(
    researchResultByteLimit - 100 - Buffer.byteLength(JSON.stringify({ data: detail }))
  )
  const getVote = vi.fn<LegislationQueryApi["getVote"]>(async () => detail)
  const onContents = vi.fn<NonNullable<Parameters<typeof createResearchTools>[9]>>()
  const onResultSet = vi.fn<NonNullable<Parameters<typeof createResearchTools>[7]>>(() => "r1")
  const fixture = selectionTools({ getVote }, { sessionKey: crypto.randomUUID(), onContents, onResultSet })
  const result = await readFragmentedTool("get_vote", { id: detail.vote.id }, fixture.tools)
  expect(result.data).toMatchObject(detail)
  expect(result.page.evidence.length).toBeGreaterThan(0)
  expect(getVote).toHaveBeenCalledTimes(result.count)
  expect(onContents).toHaveBeenCalledOnce()
  expect(onResultSet).toHaveBeenCalledOnce()
  expect(fixture.report).not.toHaveBeenCalled()
})

it("measures finite transport pages and keeps exact oversized titles behind bounded citation labels", async () => {
  const bill = { id: selectionBillId, title: "Recorded bill ".repeat(15000), detail: "Exact metadata" }
  const getBill = vi.fn<LegislationQueryApi["getBill"]>(async () => ({
    bill
  }))
  const onMeasurement = vi.fn<(measurement: ResearchToolMeasurement) => void>()
  const fixture = selectionTools({ getBill }, { onMeasurement })
  const result = await readFragmentedTool("get_bill", { id: selectionBillId }, fixture.tools)
  expect(result.data).toMatchObject({ bill })
  expect(result.page.evidence[0]?.title).toHaveLength(1000)
  expect(result.page.evidence[0]?.billIdentity?.id).toBe(selectionBillId)
  const measured = onMeasurement.mock.calls[0]?.[0]
  expect(measured?.rawResultBytes).toBeLessThanOrEqual(researchResultByteLimit)
  expect(measured).toMatchObject({ outcome: "success" })
  expect(getBill).toHaveBeenCalledTimes(result.count)
  expect(fixture.report).not.toHaveBeenCalled()
})

it("pages reconstructed citation enrichment independently without extra dependency reads or lost quotes", async () => {
  const attachments = Array.from({ length: 12 }, (_, index) => ({
    id: `material:us:report-${index}`,
    title: `Report ${index}`,
    sourceUrl: `https://example.org/report-${index}`,
    text: `${index}:` + "Exact passage ".repeat(1100)
  }))
  const data = { bill: { id: selectionBillId, title: "Bill" }, attachments }
  const getBill = vi.fn<LegislationQueryApi["getBill"]>(async () => data)
  const fixture = selectionTools(
    { getBill },
    { onContents: vi.fn<NonNullable<Parameters<typeof createResearchTools>[9]>>() }
  )
  const result = await readFragmentedTool("get_bill", { id: selectionBillId }, fixture.tools)
  expect(result.data).toEqual(data)
  const evidence = [...result.page.evidence]
  let cursor = result.page.evidencePage?.nextCursor
  expect(cursor).toBeTruthy()
  const calls = getBill.mock.calls.length
  while (cursor) {
    const output = await callWebTool("get_bill", { id: selectionBillId, cursor }, fixture.tools)
    expect(Buffer.byteLength(researchModelOutput({ output }).value)).toBeLessThanOrEqual(researchResultByteLimit)
    const page = z
      .object({
        evidence: z.array(evidenceSnapshotSchema),
        evidencePage: z.object({ nextCursor: z.string().nullable() })
      })
      .parse(output)
    expect(page.evidence.length).toBeGreaterThan(0)
    evidence.push(...page.evidence)
    cursor = page.evidencePage.nextCursor
  }
  expect(getBill).toHaveBeenCalledTimes(calls)
  for (const attachment of attachments) {
    expect(evidence).toContainEqual(
      expect.objectContaining({
        recordId: attachment.id,
        sourceUrl: attachment.sourceUrl,
        citationRef: expect.any(String),
        content: expect.objectContaining({ state: "available", quote: attachment.text })
      })
    )
  }
  expect(new Set(evidence.map((source) => source.citationRef)).size).toBe(evidence.length)
  expect(fixture.report).not.toHaveBeenCalled()
})

it("registers catalog transport continuations without treating schema examples as evidence", async () => {
  const catalog = { ...describeAnalytics(), explanation: "Catalog detail ".repeat(15000) }
  const fixture = selectionTools({ describeAnalytics: async () => catalog, analyzeLegislation: async () => ({}) })
  const result = await readFragmentedTool("describe_analytics", {}, fixture.tools)
  expect(result.data).toEqual(catalog)
  expect(result.page.evidence).toEqual([])
  expect(fixture.record).not.toHaveBeenCalled()
  expect(fixture.report).not.toHaveBeenCalled()
  expect((await fixture.tools).get_bill?.description).toContain("assembly.status")
  expect((await fixture.tools).get_bill?.description).toContain("evidencePage.nextCursor")
})

it("continues oversized analytics from the same receipt snapshot instead of reexecuting a volatile query", async () => {
  const analyzeLegislation = vi.fn<NonNullable<LegislationQueryApi["analyzeLegislation"]>>(async () => ({
    rows: [{ title: "Exact grouped title ".repeat(10000), total: 1 }],
    receipt: { executedAt: new Date().toISOString(), execution: crypto.randomUUID() }
  }))
  const fixture = selectionTools({ analyzeLegislation })
  const input = { dataset: "bills", metrics: [{ name: "total", operation: "countDistinct", field: "id" }] }
  const result = await readFragmentedTool("analyze_legislation", input, fixture.tools)
  expect(result.data).toEqual(await analyzeLegislation.mock.results[0]?.value)
  expect(analyzeLegislation).toHaveBeenCalledOnce()
  expect(fixture.report).not.toHaveBeenCalled()
})

it("keeps section-window citations distinct, explicitly partial and faithful to the selected document", async () => {
  const text = "🏛".repeat(50000)
  const sourceUrl = "https://example.org/selected-version"
  const fixture = selectionTools({
    getBillText: async () => ({
      document: { ...selectionDocument, title: "Selected version", sourceUrl },
      sections: [{ id: "section:large", documentId: selectionDocument.id, heading: "Section 1", text }],
      nextCursor: null
    })
  })
  let cursor: string | undefined
  let reconstructed = ""
  const references = new Set<string>()
  for (let index = 0; index < 10; index++) {
    const output = await callWebTool("get_bill_text", { ...selectionInput, cursor }, fixture.tools)
    expect(Buffer.byteLength(researchModelOutput({ output }).value)).toBeLessThanOrEqual(researchResultByteLimit)
    const page = z
      .object({
        data: z.object({
          partial: z.literal(true),
          sections: z.array(z.object({ text: z.string(), textOffset: z.number() })),
          nextCursor: z.string().nullish()
        }),
        evidence: z.array(evidenceSnapshotSchema)
      })
      .parse(output)
    const section = page.data.sections[0]!
    expect(section.textOffset).toBe(Array.from(reconstructed).length)
    const citation = page.evidence.find((source) => source.content.state === "available")!
    expect(citation).toMatchObject({
      recordId: selectionDocument.id,
      billId: selectionBillId,
      sourceUrl,
      content: { state: "available", quote: section.text, truncated: true }
    })
    expect(references.has(citation.id)).toBe(false)
    references.add(citation.id)
    reconstructed += section.text
    cursor = page.data.nextCursor ?? undefined
    if (!cursor) {
      break
    }
  }
  expect(cursor).toBeUndefined()
  expect(reconstructed).toBe(text)
  expect(references.size).toBeGreaterThan(1)
  expect(fixture.report).not.toHaveBeenCalled()
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

it("reports an acquisition timeout accurately without exposing the driver error or blaming the question", async () => {
  runtimeRun.mockRejectedValueOnce(
    new LegislationError("dependency_unavailable", "The database connection timed out.", {
      cause: new Error("timeout exceeded when trying to connect"),
      details: { reason: "timeout", retryable: true }
    })
  )
  const report = vi.fn<() => void>()
  const tools = createResearchTools({ NODE_ENV: "development" }, new AbortController().signal, () => true, report)
  await expect(callWebTool("get_bill_timeline", { limit: 100, id: "bill:us:119:hr:1" }, tools)).rejects.toMatchObject({
    code: "timeout",
    message: expect.stringContaining("This research operation timed out before it could finish. Try again.")
  })
  expect(report).toHaveBeenCalledWith(
    expect.objectContaining({
      stage: "dependency",
      error: expect.objectContaining({ code: "timeout" }),
      measurement: expect.objectContaining({ failureCode: "timeout", outcome: "error" })
    })
  )
  expect(runtimeRun).toHaveBeenCalledOnce()
  expect(JSON.stringify(report.mock.calls)).not.toContain("timeout exceeded when trying to connect")
})

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
