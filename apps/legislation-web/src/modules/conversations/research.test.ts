import { dynamicTool, isStepCount, streamText } from "ai"
import { MockLanguageModelV4 } from "ai/test"
import { expect, it } from "vitest"
import { z } from "zod"
import { createCitationPresentation } from "./components/citationPresentation"
import { recordMentionHref } from "./composition"
import type { EntityPage } from "./entityResults"
import { createResearchTools, modelInputSchema, researchModelOutput } from "./research"
import { researchFailureCode } from "./researchFailure"

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
