import { createHash } from "node:crypto"
import { captureException } from "@sentry/core"
import type { UIMessageChunk } from "ai"
import invariant from "tiny-invariant"
import { afterEach, describe, expect, it, vi } from "vitest"
import { sentryOptions } from "../../services/sentry/sentryOptions"
import { checkRun } from "../evaluations/checks"
import type { EvalEvent, EvalTurn } from "../evaluations/contracts"
import { smokeDataset } from "../evaluations/smoke"
import { observeChatResponse } from "./capture"
import { createCitationFailureReporter } from "./citationFailures.server"
import { createCompositionStream } from "./compositionStream"

vi.mock("@sentry/core", () => ({ captureException: vi.fn<typeof captureException>() }))

afterEach(() => vi.clearAllMocks())

const context = {
  runId: "11111111-1111-4111-8111-111111111111",
  model: "openai/research-model",
  promptVersion: 2
}
const events: EvalEvent[] = [
  {
    turn: 0,
    step: 1,
    type: "result",
    tool: "get_bill",
    callId: "call-one",
    value: {
      evidence: [
        {
          id: "known",
          title: "PRIVATE TITLE",
          origin: "canonical",
          sourceUrl: "https://publisher.example/private.xml",
          content: { state: "available", quote: "PRIVATE SOURCE TEXT" }
        }
      ]
    }
  }
]
const answer = { text: "Claim [1](#citation-known).", events, termination: "stop", isInterrupted: false }

describe("missing citation telemetry", () => {
  it("accepts newly registered retained evidence without a current-turn tool result", () => {
    createCitationFailureReporter(context)({
      ...answer,
      events: [],
      text: "Previously collected text [1](#citation-e42).",
      retainedEvidence: [
        {
          id: "prior",
          citationRef: "e42",
          title: "Prior source",
          origin: "canonical",
          sourceUrl: null,
          content: { state: "available", quote: "Proposed remedy." }
        }
      ]
    })
    expect(captureException).not.toHaveBeenCalled()
  })

  it("accepts exact short references in evaluation without treating unknown aliases as valid", () => {
    const item = smokeDataset.cases.find((candidate) => candidate.id === "bill-identity")
    invariant(item)
    const event: EvalEvent = {
      turn: 0,
      step: 1,
      type: "result",
      tool: "get_bill",
      callId: "call",
      value: {
        evidence: [
          {
            id: "current",
            citationRef: "e1",
            title: "Current text",
            origin: "canonical",
            sourceUrl: null,
            content: { state: "not-collected" }
          }
        ]
      }
    }
    const turn: EvalTurn = {
      text: "Answer [1](#citation-e1)",
      termination: "stop",
      durationMs: 5,
      firstTextMs: 1,
      inputTokens: 1,
      outputTokens: 1,
      responses: []
    }
    const valid = checkRun(item, [turn], [event])
    expect(valid.find((score) => score.name === "citation-validity")?.value).toBe(1)
    expect(valid.find((score) => score.name === "required-citation")?.value).toBe(1)
    const invalid = checkRun(item, [{ ...turn, text: "Answer [1](#citation-e2)" }], [event])
    expect(invalid.find((score) => score.name === "citation-validity")?.value).toBe(0)
  })

  it("reports distinct missing references separately even when model labels collide", () => {
    createCitationFailureReporter(context)({
      ...answer,
      text: "[4](#citation-one) [4](#citation-two) [5](#citation-one)"
    })
    expect(captureException).toHaveBeenCalledTimes(2)
    expect(vi.mocked(captureException).mock.calls.map(([, details]) => details)).toEqual([
      expect.objectContaining({
        tags: expect.objectContaining({ citationReferenceHash: createHash("sha256").update("one").digest("hex") })
      }),
      expect.objectContaining({
        tags: expect.objectContaining({ citationReferenceHash: createHash("sha256").update("two").digest("hex") })
      })
    ])
  })

  it("reports from completed observation capture using composed rather than raw model text", async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue({
          type: "tool-result",
          toolName: "get_bill",
          toolCallId: "call-one",
          output: events[0]?.value
        })
        controller.enqueue({ type: "text-delta", id: "text", text: "Raw spec [1](#citation-not-displayed)" })
        controller.enqueue({ type: "finish", finishReason: "stop", totalUsage: { inputTokens: 15, outputTokens: 4 } })
        controller.close()
      }
    })
    await observeChatResponse({
      sessionId: context.runId,
      input: "PRIVATE QUESTION",
      metadata: {},
      start: () => stream,
      composed: Promise.resolve({
        text: "Claim [1](#citation-known) [2](#citation-missing)",
        blocks: [],
        isInterrupted: false,
        outcome: {
          status: "completed",
          finishReason: "stop",
          hasAnswer: true,
          pendingToolCalls: [],
          failedToolCalls: []
        }
      }),
      citationTelemetry: context
    }).completed
    expect(captureException).toHaveBeenCalledOnce()
    expect(captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        tags: expect.objectContaining({
          citationReferenceHash: createHash("sha256").update("missing").digest("hex")
        })
      })
    )
  })

  it("resolves short references in telemetry while still reporting unknown references", () => {
    const currentEvents = events.map((event) => ({
      ...event,
      value: {
        evidence: [
          {
            id: "canonical-evidence",
            citationRef: "e1",
            title: "Text",
            origin: "canonical",
            sourceUrl: null,
            content: { state: "not-collected" }
          }
        ]
      }
    }))
    createCitationFailureReporter(context)({
      ...answer,
      events: currentEvents,
      text: "[1](#citation-e1) [2](#citation-e2)"
    })
    expect(captureException).toHaveBeenCalledOnce()
    expect(captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        tags: expect.objectContaining({ citationReferenceHash: createHash("sha256").update("e2").digest("hex") })
      })
    )
  })

  it("reports each missing reference once per response without logging its contents", () => {
    const report = createCitationFailureReporter(context)
    const missing = "PRIVATE_REFERENCE"
    const input = {
      ...answer,
      text: `PRIVATE QUESTION [3](#citation-${missing}) [4](#citation-${missing}) [1](#citation-known)`
    }
    report(input)
    report(input)
    expect(captureException).toHaveBeenCalledOnce()
    expect(captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        tags: expect.objectContaining({
          operation: "citation_resolution",
          category: "invalid_response",
          ...context,
          promptVersion: "2",
          citationReferenceHash: createHash("sha256").update(missing).digest("hex")
        }),
        extra: { unresolvedCitationCount: 1, evidenceCount: 1 }
      })
    )
    expect(JSON.stringify(vi.mocked(captureException).mock.calls)).not.toMatch(/PRIVATE|publisher\.example/)
    createCitationFailureReporter({ ...context, runId: "22222222-2222-4222-8222-222222222222" })(input)
    expect(captureException).toHaveBeenCalledTimes(2)
  })

  it("does not report valid citations, code examples, unused definitions, or images", () => {
    createCitationFailureReporter(context)({
      ...answer,
      text: [
        "A claim [1](#citation-known).",
        "`[2](#citation-example)`",
        "```md\n[3](#citation-example)\n```",
        "![image](#citation-image)",
        "[unused]: #citation-definition"
      ].join("\n\n")
    })
    expect(captureException).not.toHaveBeenCalled()
  })

  it("uses only successful tool evidence from this response and handles reference links", () => {
    createCitationFailureReporter(context)({
      ...answer,
      text: "[1][missing] [again][missing]\n\n[missing]: #citation-known",
      events: events.map((event) => ({ ...event, type: "error" }))
    })
    expect(captureException).toHaveBeenCalledOnce()
  })

  it.each(["incomplete", "abort", "error", "length", "clarification"])("skips %s responses", (termination) => {
    createCitationFailureReporter(context)({ ...answer, text: "[1](#citation-unknown)", termination })
    expect(captureException).not.toHaveBeenCalled()
  })

  it("ignores downstream cancellation even if model generation finished", () => {
    createCitationFailureReporter(context)({ ...answer, text: "[1](#citation-unknown)", isInterrupted: true })
    expect(captureException).not.toHaveBeenCalled()
  })

  it("waits for complete composed text rather than reporting partial streamed anchors", async () => {
    const report = createCitationFailureReporter(context)
    const chunks: UIMessageChunk[] = [
      { type: "text-start", id: "text" },
      { type: "text-delta", id: "text", delta: "Claim [1](#citation-k" },
      { type: "text-delta", id: "text", delta: "nown) and [2](#citation-missing)." },
      { type: "text-end", id: "text" },
      { type: "finish", finishReason: "stop" }
    ]
    const source = new ReadableStream<UIMessageChunk>({
      start(controller) {
        chunks.forEach((chunk) => controller.enqueue(chunk))
        controller.close()
      }
    })
    const reader = createCompositionStream(source, {
      resolveRecord: () => {
        throw new Error("No card requested")
      },
      onComplete: (composition) =>
        report({ ...answer, text: composition.text, isInterrupted: composition.isInterrupted })
    }).getReader()
    await reader.read()
    expect(captureException).not.toHaveBeenCalled()
    let result = await reader.read()
    while (!result.done) {
      result = await reader.read()
    }
    reader.releaseLock()
    expect(captureException).toHaveBeenCalledOnce()
    expect(captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        tags: expect.objectContaining({
          citationReferenceHash: createHash("sha256").update("missing").digest("hex")
        })
      })
    )
  })

  it("keeps citation grouping through the export privacy boundary", () => {
    expect(sentryOptions.sendDefaultPii).toBe(false)
    createCitationFailureReporter(context)({ ...answer, text: "[1](#citation-missing)" })
    expect(captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ fingerprint: ["citation_resolution", "unmatched_reference"] })
    )
    const projected = sentryOptions.beforeSend({
      type: undefined,
      fingerprint: ["citation_resolution", "unmatched_reference"],
      exception: { values: [{ type: "Error", value: "PRIVATE research" }] },
      tags: { operation: "citation_resolution", category: "invalid_response" }
    })
    expect(projected).toMatchObject({
      fingerprint: ["citation_resolution", "unmatched_reference"],
      tags: { operation: "citation_resolution", category: "invalid_response" }
    })
    expect(JSON.stringify(projected)).not.toContain("PRIVATE")
  })
})
