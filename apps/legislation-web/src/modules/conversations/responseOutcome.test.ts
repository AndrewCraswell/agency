import type { UIMessage } from "ai"
import { describe, expect, it } from "vitest"
import { parseDevelopmentConversation } from "./developmentConversation"
import { classifyResponse, messageResponseOutcome, responseIsIncomplete } from "./responseOutcome"

describe("response outcomes", () => {
  it.each([
    { hasAnswer: true, finishReason: "stop", expected: "completed" },
    { hasAnswer: false, hasClarification: true, finishReason: "tool-calls", expected: "clarification" },
    { hasAnswer: false, hasClarification: true, finishReason: "error", expected: "failed" },
    { hasAnswer: false, hasClarification: true, finishReason: "content-filter", expected: "failed" },
    {
      hasAnswer: false,
      hasClarification: true,
      finishReason: "tool-calls",
      pendingToolCalls: ["pending"],
      expected: "unknown"
    },
    { hasAnswer: true, finishReason: null, expected: "partial" },
    { hasAnswer: false, isCancelled: true, expected: "cancelled" },
    { hasAnswer: true, finishReason: "length", expected: "exhausted" },
    { hasAnswer: false, finishReason: "tool-calls", expected: "unknown" },
    { hasAnswer: false, isExhausted: true, finishReason: "stop", expected: "exhausted" },
    { hasAnswer: true, isExhausted: true, finishReason: "stop", expected: "completed" },
    { hasAnswer: false, isError: true, expected: "failed" },
    { hasAnswer: false, finishReason: null, expected: "unknown" },
    { hasAnswer: false, finishReason: "stop", expected: "partial" },
    { hasAnswer: true, finishReason: "stop", pendingToolCalls: ["pending"], expected: "partial" },
    { hasAnswer: true, finishReason: "stop", isInterrupted: true, expected: "partial" }
  ])("classifies $expected independently of interaction readiness", ({ expected, ...options }) => {
    const outcome = classifyResponse(options)
    expect(outcome.status).toBe(expected)
    expect(responseIsIncomplete(outcome)).toBe(expected !== "completed" && expected !== "clarification")
  })

  it("does not mistake a cancelled user question for an assistant answer", () => {
    expect(
      messageResponseOutcome({
        id: "question",
        role: "user",
        metadata: { responseObservation: { isCancelled: true } },
        parts: [{ type: "text", text: "Research this" }]
      })
    ).toMatchObject({ status: "cancelled", hasAnswer: false, finishReason: null })
  })

  it("requires a valid delivered clarification, not a failed or malformed tool", () => {
    const message: UIMessage = {
      id: "answer",
      role: "assistant",
      parts: [
        {
          type: "dynamic-tool",
          toolName: "ask_clarification",
          toolCallId: "question",
          state: "output-available",
          input: {},
          output: { clarificationId: "not-a-question" }
        }
      ]
    }
    expect(messageResponseOutcome(message)).toMatchObject({ status: "unknown", hasAnswer: false })
  })

  it("does not count failed or pending presentation as an answer", () => {
    for (const state of ["pending", "error"]) {
      expect(
        messageResponseOutcome({
          id: "answer",
          role: "assistant",
          parts: [
            {
              type: "data-presentation",
              data:
                state === "error" ? { state, blockId: "block", reason: "presentation" } : { state, blockId: "block" }
            }
          ]
        })
      ).toMatchObject({ status: state === "error" ? "failed" : "unknown", hasAnswer: false })
    }
  })

  it("keeps the terminal outcome and transport observation through reload recovery", async () => {
    const message: UIMessage = {
      id: "answer",
      role: "assistant",
      metadata: { responseObservation: { isAbort: true, finishReason: null } },
      parts: [
        { type: "text", text: "Delivered answer.", state: "done" },
        {
          type: "data-response-outcome",
          id: "response-outcome",
          data: {
            status: "completed",
            finishReason: "stop",
            hasAnswer: true,
            pendingToolCalls: [],
            failedToolCalls: []
          }
        }
      ]
    }
    const snapshot = await parseDevelopmentConversation(
      JSON.stringify({
        id: "session",
        sessionKey: "11111111-1111-4111-8111-111111111111",
        messages: [message],
        draft: [],
        references: [],
        clarificationAnswers: {}
      })
    )
    expect(snapshot?.messages).toEqual([message])
    expect(snapshot?.messages[0] && messageResponseOutcome(snapshot.messages[0])).toMatchObject({ status: "completed" })
  })
})
