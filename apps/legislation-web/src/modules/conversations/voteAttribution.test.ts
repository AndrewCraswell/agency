import { MockLanguageModelV4 } from "ai/test"
import invariant from "tiny-invariant"
import { describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { caseSchema, type EvalCase } from "../evaluations/contracts"
import { createFixtureService } from "../evaluations/fixtures"
import { runResearchAgent } from "./agent"
import { collectChatStream } from "./capture"
import { compositionInstructions } from "./composition"
import { createResearchTools } from "./research"

vi.mock("@langfuse/tracing", () => ({
  propagateAttributes: (_attributes: unknown, run: () => unknown) => run()
}))
vi.mock("../legislation/runtime/runtime", () => {
  throw new Error("Fixture tools must not import the live application runtime")
})
vi.mock("../search/research-runtime", () => {
  throw new Error("Fixture tools must not import the live database research runtime")
})
vi.mock("../legislation/analytics-telemetry", () => {
  throw new Error("Fixture tools must not import live analytics telemetry")
})
vi.mock("./toolFailures", () => {
  throw new Error("Fixture tools with an injected reporter must not import live failure reporting")
})

type Scenario = {
  name: string
  removal: "adopted" | "failed" | "withdrawn"
  hasTarget: boolean
  hasText: boolean
  isPartial: boolean
  hasRestoration: boolean
  isVoiceVote: boolean
}
type Request = Extract<EvalCase["fixtures"][number], { output: unknown }> & {
  toolName: "get_amendment" | "get_vote" | "get_bill_text"
}

const base: Scenario = {
  name: "adopted removal before amended package adoption",
  removal: "adopted",
  hasTarget: true,
  hasText: true,
  isPartial: false,
  hasRestoration: false,
  isVoiceVote: false
}
const scenarios: Scenario[] = [
  base,
  { ...base, name: "unknown amendment target", hasTarget: false, hasText: false },
  { ...base, name: "unread operative text", hasText: false },
  { ...base, name: "partial amendment history and member positions", isPartial: true, hasText: false },
  { ...base, name: "failed removal", removal: "failed" },
  { ...base, name: "withdrawn removal without a vote", removal: "withdrawn" },
  { ...base, name: "adopted restoration after removal", hasRestoration: true },
  { ...base, name: "package adoption by voice vote", isVoiceVote: true }
]
const billId = "bill:us:119:hr:9000"
const packageId = "amendment:us:119:samdt:9000"
const removalId = "amendment:us:119:samdt:9001"
const restorationId = "amendment:us:119:samdt:9002"
const documentId = "document:us:119:hr:9000:eas"
const sectionId = "section:us:119:hr:9000:eas:900"
const memberId = "person:us:fixture-member"
const removalPurpose = "Strike section 900 of S.Amdt. 9000 to H.R. 9000, the state AI-law funding restriction."
const restorationPurpose = "Restore section 900 of S.Amdt. 9000 to H.R. 9000 after adoption of S.Amdt. 9001."
const restriction = "SEC. 900. A State regulating artificial intelligence is ineligible for the specified grant."
const removedText = "SEC. 900. [Stricken.]"

function amendment(
  id: string,
  number: string,
  purpose: string | null,
  status: string,
  description: string,
  actionAt: string,
  truncated = false
) {
  const sourceUrl = `https://example.org/amendments/${number}.html`
  return {
    amendment: {
      id,
      billId,
      jurisdictionId: "jurisdiction:us",
      sessionId: "session:us:119",
      sourceId: `119-samdt-${number}`,
      amendmentType: "samdt",
      amendmentNumber: number,
      printedIdentifier: `S.Amdt. ${number}`,
      chamber: "senate",
      purpose,
      description: null,
      status,
      submittedDate: "2025-07-01",
      sourceUrl,
      upstreamIds: {},
      recordType: "structured",
      billIdentifier: "H.R. 9000",
      billTitle: "Synthetic grant package"
    },
    actions: [
      {
        id: `action:${number}:1`,
        amendmentId: id,
        ordinal: 1,
        description,
        classification: [],
        actionDate: "2025-07-01",
        actionAt,
        sourceUrl
      }
    ],
    materials: [],
    votes: [],
    truncated
  }
}

function vote(
  id: string,
  amendmentId: string,
  motion: string,
  result: string,
  heldAt: string,
  yesCount: number | null,
  noCount: number | null,
  voteType = "roll-call"
) {
  return {
    id,
    billId,
    amendmentId,
    motion,
    question: motion,
    result,
    heldAt,
    heldDate: null,
    voteType,
    yesCount,
    noCount,
    chamber: "senate",
    sourceUrl: `https://example.org/votes/${id.split(":").at(-1)}.html`,
    timelineComplete: false
  }
}

function requestsFor(scenario: Scenario): Request[] {
  const packageVote = vote(
    "vote:us:119:package",
    packageId,
    "On agreeing to S.Amdt. 9000 to H.R. 9000, as amended",
    "passed",
    "2025-07-01T12:00:00.000Z",
    scenario.isVoiceVote ? null : 51,
    scenario.isVoiceVote ? null : 50,
    scenario.isVoiceVote ? "voice" : "roll-call"
  )
  const positions = scenario.isPartial
    ? [
        {
          person: { id: memberId, name: "Fixture Member" },
          position: {
            voteId: packageVote.id,
            personId: memberId,
            sourceIdentity: "fixture-member",
            option: "yes"
          }
        }
      ]
    : []
  const removalAction = {
    adopted: "S.Amdt. 9001 agreed to by recorded vote.",
    failed: "S.Amdt. 9001 not agreed to by recorded vote.",
    withdrawn: "S.Amdt. 9001 withdrawn; no vote taken."
  }[scenario.removal]
  const requests: Request[] = [
    {
      toolName: "get_amendment",
      method: "getAmendment",
      input: { id: packageId },
      output: amendment(
        packageId,
        "9000",
        "Substitute grant package for H.R. 9000.",
        "adopted",
        "S.Amdt. 9000 agreed to, as amended.",
        "2025-07-01T12:00:00.000Z"
      )
    },
    {
      toolName: "get_amendment",
      method: "getAmendment",
      input: { id: removalId },
      output: amendment(
        removalId,
        "9001",
        scenario.hasTarget ? removalPurpose : null,
        scenario.removal,
        removalAction,
        "2025-07-01T10:00:00.000Z",
        scenario.isPartial
      )
    }
  ]
  if (scenario.removal !== "withdrawn") {
    requests.push({
      toolName: "get_vote",
      method: "getVote",
      input: { id: "vote:us:119:removal" },
      output: {
        vote: vote(
          "vote:us:119:removal",
          removalId,
          "On agreeing to S.Amdt. 9001",
          scenario.removal === "adopted" ? "passed" : "failed",
          "2025-07-01T10:00:00.000Z",
          scenario.removal === "adopted" ? 99 : 1,
          scenario.removal === "adopted" ? 1 : 99
        ),
        positions: [],
        positionsTruncated: false
      }
    })
  }
  if (scenario.hasRestoration) {
    requests.push(
      {
        toolName: "get_amendment",
        method: "getAmendment",
        input: { id: restorationId },
        output: amendment(
          restorationId,
          "9002",
          restorationPurpose,
          "adopted",
          "S.Amdt. 9002 agreed to by recorded vote.",
          "2025-07-01T11:00:00.000Z"
        )
      },
      {
        toolName: "get_vote",
        method: "getVote",
        input: { id: "vote:us:119:restoration" },
        output: {
          vote: vote(
            "vote:us:119:restoration",
            restorationId,
            "On agreeing to S.Amdt. 9002",
            "passed",
            "2025-07-01T11:00:00.000Z",
            60,
            40
          ),
          positions: [],
          positionsTruncated: false
        }
      }
    )
  }
  requests.push({
    toolName: "get_vote",
    method: "getVote",
    input: { id: packageVote.id },
    output: {
      vote: packageVote,
      positions,
      positionsTruncated: scenario.isPartial,
      ...(scenario.isPartial ? { continuation: { collection: "vote-positions", recordId: packageVote.id } } : {})
    }
  })
  if (scenario.hasText) {
    const text = scenario.removal === "adopted" && !scenario.hasRestoration ? removedText : restriction
    requests.push({
      toolName: "get_bill_text",
      method: "getBillText",
      input: { id: billId, documentId },
      output: {
        billId,
        document: {
          id: documentId,
          billId,
          billIdentifier: "H.R. 9000",
          classification: "version",
          versionCode: "eas",
          documentDate: "2025-07-01",
          title: "Synthetic engrossed Senate amendment",
          sourceUrl: "https://example.org/bills/hr9000-eas.html",
          processingStatus: "processed",
          sectionCount: 1
        },
        sections: [
          {
            id: sectionId,
            documentId,
            ordinal: 0,
            sectionIdentifier: "Section 900",
            heading: "Grant eligibility",
            sourceStartOffset: 0,
            sourceEndOffset: text.length,
            text
          }
        ],
        truncated: false
      }
    })
  }
  return requests
}

const toolPartSchema = z.object({
  type: z.literal("tool-result"),
  toolCallId: z.string(),
  toolName: z.string(),
  output: z.object({ type: z.literal("text"), value: z.string() })
})
const modelResultSchema = z.object({
  data: z.json(),
  evidence: z.array(
    z.looseObject({
      id: z.string(),
      citation: z.string(),
      recordId: z.string().optional(),
      billId: z.string().optional(),
      versionLabel: z.string().optional(),
      locator: z.string().optional(),
      content: z.looseObject({ state: z.string(), quote: z.string().optional() })
    })
  )
})

describe("vote attribution evidence-to-synthesis boundary", () => {
  // The scripted response is only a transport sentinel, not a legal-accuracy oracle.
  it.each(scenarios)("preserves $name in the actual synthesis request", async (scenario) => {
    const requests = requestsFor(scenario)
    const fixture = createFixtureService(
      caseSchema.parse({
        id: "vote-attribution-boundary",
        family: "vote-attribution",
        tags: ["synthetic", "transport"],
        review: "draft",
        provenance: "synthetic",
        reference: "Synthetic query-service shapes; not historical vote evidence.",
        messages: [{ role: "user", content: "Did the package vote establish support for the AI-law restriction?" }],
        fixtures: requests.map(({ method, input, output }) => ({ method, input, output })),
        expected: { terminal: "answer", requiresCitation: false }
      })
    )
    const signal = new AbortController().signal
    const reportFailure = vi.fn<NonNullable<Parameters<typeof createResearchTools>[3]>>()
    const tools = await createResearchTools(
      { NODE_ENV: "development" },
      signal,
      () => true,
      reportFailure,
      undefined,
      fixture.service
    )
    let generations = 0
    const model = new MockLanguageModelV4({
      doStream: async () => {
        const isSynthesis = generations++ > 0
        return {
          stream: new ReadableStream({
            start(controller) {
              controller.enqueue({ type: "stream-start", warnings: [] })
              if (isSynthesis) {
                controller.enqueue({ type: "text-start", id: "answer" })
                controller.enqueue({ type: "text-delta", id: "answer", delta: "Synthetic transport complete." })
                controller.enqueue({ type: "text-end", id: "answer" })
              } else {
                requests.forEach((request, index) => {
                  let input = request.input
                  if (request.toolName === "get_bill_text") {
                    input = { cursor: null, documentId: null, limit: null, versionCode: null, ...request.input }
                  } else if (request.toolName === "get_vote") {
                    input = { cursor: null, ...request.input }
                  }
                  controller.enqueue({
                    type: "tool-call",
                    toolCallId: `read-${index}`,
                    toolName: request.toolName,
                    input: JSON.stringify(input)
                  })
                })
              }
              controller.enqueue({
                type: "finish",
                finishReason: {
                  unified: isSynthesis ? "stop" : "tool-calls",
                  raw: isSynthesis ? "stop" : "tool_calls"
                },
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
    const result = await collectChatStream(
      runResearchAgent({
        sessionId: "vote-attribution-boundary",
        model,
        instructions: compositionInstructions,
        messages: [{ role: "user", content: "Did the package vote establish support for the AI-law restriction?" }],
        tools,
        signal
      }).stream
    )
    expect(result.output.termination).toBe("stop")
    expect(result.events.filter((event) => event.type === "error")).toEqual([])
    expect(reportFailure).not.toHaveBeenCalled()
    expect(fixture.missing).toEqual([])
    expect(model.doStreamCalls).toHaveLength(2)
    const synthesis = model.doStreamCalls[1]
    invariant(synthesis, "The SDK must make a second model request after research")
    const system = synthesis.prompt
      .filter((message) => message.role === "system")
      .map((message) => message.content)
      .join("\n")
    expect(system).toContain(compositionInstructions)
    const parts = synthesis.prompt
      .filter((message) => message.role === "tool")
      .flatMap((message) => message.content)
      .map((part) => toolPartSchema.parse(part))
    expect(parts).toHaveLength(requests.length)
    const results = new Map(
      parts.map((part) => [
        part.toolCallId,
        { name: part.toolName, ...modelResultSchema.parse(JSON.parse(part.output.value)) }
      ])
    )
    expect(results.size).toBe(requests.length)
    requests.forEach((request, index) => {
      const observed = results.get(`read-${index}`)
      invariant(observed, "Every requested record must reach the next model prompt")
      expect(observed.name).toBe(request.toolName)
      // Exact equality protects motion, target-bearing prose, dates, disposition, nulls and partial flags.
      expect(observed.data).toEqual(request.output)
      for (const evidence of observed.evidence) {
        // Model citation anchors use stable evidence identity, not the internal run-local citationRef.
        expect(evidence.id).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-8[a-f0-9]{3}-a[a-f0-9]{3}-[a-f0-9]{12}$/)
        expect(evidence.citation).toMatch(new RegExp(`^\\[[1-9][0-9]*\\]\\(#citation-${evidence.id}\\)$`))
      }
    })
    const availablePassages = [...results.values()].flatMap((entry) =>
      entry.evidence.filter((evidence) => evidence.content.state === "available")
    )
    const expectedQuote = scenario.removal === "adopted" && !scenario.hasRestoration ? removedText : restriction
    const expectedPassage = expect.objectContaining({
      recordId: documentId,
      billId,
      versionLabel: "eas, 2025-07-01",
      locator: "Section 900",
      content: { state: "available", quote: expectedQuote }
    })
    expect(availablePassages).toEqual(scenario.hasText ? [expectedPassage] : [])
  })
})
