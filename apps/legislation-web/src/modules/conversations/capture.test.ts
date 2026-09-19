import type { TextStreamPart, ToolSet } from "ai"
import { describe, expect, it } from "vitest"
import { assertSafeArtifact } from "../evaluations/contracts"
import { collectChatStream } from "./capture"
import { redactCredentials } from "./redactCredentials"

describe("terminal capture precedence", () => {
  type Chunk = TextStreamPart<ToolSet>
  const clarification: Chunk = {
    type: "tool-result",
    toolName: "ask_clarification",
    toolCallId: "clarify-terminal",
    input: {},
    output: {}
  }
  const partial: Chunk = { type: "text-delta", id: "partial", text: "Partial answer" }
  const finish = Object.freeze({
    type: "finish",
    finishReason: "stop",
    rawFinishReason: "provider_stop",
    totalUsage: {
      inputTokens: 15,
      outputTokens: 4,
      totalTokens: 19,
      inputTokenDetails: { noCacheTokens: 15, cacheReadTokens: 0, cacheWriteTokens: 0 },
      outputTokenDetails: { textTokens: 4, reasoningTokens: 0 }
    }
  } satisfies Chunk)

  function streamOf(chunks: Chunk[], failure?: unknown) {
    let index = 0
    return new ReadableStream<Chunk>(
      {
        pull(controller) {
          const chunk = chunks[index++]
          if (chunk) {
            controller.enqueue(chunk)
          } else if (failure !== undefined) {
            throw failure
          } else {
            controller.close()
          }
        }
      },
      { highWaterMark: 0 }
    )
  }

  it.each([
    { termination: "error", clarificationFirst: true },
    { termination: "error", clarificationFirst: false },
    { termination: "abort", clarificationFirst: true },
    { termination: "abort", clarificationFirst: false }
  ] as const)(
    "keeps $termination authoritative over finish with clarificationFirst=$clarificationFirst",
    async ({ termination, clarificationFirst }) => {
      const terminal: Chunk =
        termination === "error"
          ? { type: "error", error: new Error("Provider unavailable") }
          : { type: "abort", reason: "User cancelled" }
      const chunks = clarificationFirst
        ? [clarification, partial, terminal, finish]
        : [partial, terminal, clarification, finish]
      const stream = streamOf(chunks)
      const result = await collectChatStream(stream)
      expect(result.output).toMatchObject({
        text: "Partial answer",
        termination,
        inputTokens: 15,
        outputTokens: 4
      })
      expect(result.events.filter((event) => event.tool === "generation")).toHaveLength(termination === "error" ? 1 : 0)
      expect(finish).toMatchObject({ finishReason: "stop", rawFinishReason: "provider_stop" })
      expect(stream.locked).toBe(false)
    }
  )

  const diagnostic = "Provider unavailable: https://example.org/retry?token=fixture-private&id=42"
  const sanitizedDiagnostic = "Provider unavailable: https://example.org/retry?id=42"
  it.each([
    {
      kind: "Error instance",
      failure: new Error(diagnostic),
      expected: { name: "Error", message: sanitizedDiagnostic }
    },
    {
      kind: "structured provider error",
      failure: {
        code: "provider_unavailable",
        message: diagnostic,
        headers: { authorization: "fixture-private" },
        details: { requestId: "request-42", access_token: "fixture-private", reasoning: "private-reasoning" }
      },
      expected: {
        code: "provider_unavailable",
        message: sanitizedDiagnostic,
        details: { requestId: "request-42" }
      }
    }
  ])("retains equivalent sanitized $kind diagnostics for emitted and thrown errors", async ({ failure, expected }) => {
    const emitted = streamOf([clarification, partial, { type: "error", error: failure }])
    const thrown = streamOf([clarification, partial], failure)
    const emittedResult = await collectChatStream(emitted)
    const thrownResult = await collectChatStream(thrown)
    for (const result of [emittedResult, thrownResult]) {
      expect(result.output).toMatchObject({ text: "Partial answer", termination: "error" })
      expect(result.output.firstTextMs).not.toBeNull()
      expect(result.events.filter((event) => event.tool === "generation")).toEqual([
        { turn: 0, step: 0, type: "error", tool: "generation", callId: "generation", value: expected }
      ])
      expect(JSON.stringify(result)).not.toContain("fixture-private")
      expect(JSON.stringify(result)).not.toContain("private-reasoning")
      expect(() => assertSafeArtifact(result)).not.toThrow()
    }
    expect(thrownResult.events).toEqual(emittedResult.events)
    expect(emitted.locked).toBe(false)
    expect(thrown.locked).toBe(false)
  })

  it.each([true, false])("keeps ordinary clarification distinct with finish=%s", async (hasFinish) => {
    const result = await collectChatStream(streamOf(hasFinish ? [clarification, finish] : [clarification]))
    expect(result.output).toMatchObject({
      text: "",
      termination: "clarification",
      inputTokens: hasFinish ? 15 : null,
      outputTokens: hasFinish ? 4 : null
    })
    expect(result.events).toEqual([
      { turn: 0, step: 0, type: "result", tool: "ask_clarification", callId: "clarify-terminal", value: {} }
    ])
  })

  it("does not promote a recoverable tool error to a terminal generation failure", async () => {
    const result = await collectChatStream(
      streamOf([
        { type: "tool-error", toolName: "get_vote", toolCallId: "vote-1", input: {}, error: new Error("Not found") },
        { type: "text-delta", id: "answer", text: "The requested vote could not be verified." },
        finish
      ])
    )
    expect(result.output).toMatchObject({ termination: "stop", inputTokens: 15, outputTokens: 4 })
    expect(result.events).toEqual([
      {
        turn: 0,
        step: 0,
        type: "error",
        tool: "get_vote",
        callId: "vote-1",
        value: { name: "Error", message: "Not found" }
      }
    ])
  })
})

describe("complete chat capture", () => {
  it("redacts inline URL credentials without rewriting public research prose", () => {
    const publicText =
      "https://example.org/bill\nBasic Grant rules remain unchanged. See [source](https://example.org/other#section-2)."
    expect(redactCredentials(publicText)).toBe(publicText)
    const privateText =
      "See [source](https://user:private-pass@example.org/bill?sessionKey=private-session&id=1#access_token=private-token)."
    expect(redactCredentials(privateText)).toBe("See [source](https://example.org/bill?id=1).")
    expect(redactCredentials("Source: https://example.org/sk-or-v1-private-key")).not.toContain("private-key")
  })

  it.each(["error", "abort"] as const)("retains %s after a clarification result", async (termination) => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue({
          type: "tool-result",
          toolName: "ask_clarification",
          toolCallId: "clarify-1",
          input: {},
          output: {}
        })
        controller.enqueue({ type: "text-delta", id: "text", text: "Partial answer" })
        controller.enqueue({ type: termination, error: new Error("Provider unavailable; Bearer private-token") })
        controller.close()
      }
    })
    const result = await collectChatStream(stream)
    expect(result.output).toMatchObject({ text: "Partial answer", termination })
    expect(JSON.stringify(result)).not.toContain("private-token")
    expect(result.events.filter((event) => event.tool === "generation")).toHaveLength(termination === "error" ? 1 : 0)
  })

  it("removes credentials and headers without limiting arrays or evidence", () => {
    const cleaned = redactCredentials({
      authorization: "Basic abcdefghijklmnop",
      headers: { private: "value" },
      values: Array.from({ length: 150 }, () => "A".repeat(3000)),
      link: "https://user:password@example.org/source?token=private&version=2",
      text: "Bearer private-value"
    })
    expect(() => assertSafeArtifact(cleaned)).not.toThrow()
    expect(JSON.stringify(cleaned)).not.toContain("private")
    expect(JSON.stringify(cleaned)).toContain("version=2")
    expect(JSON.stringify(cleaned).length).toBeGreaterThan(450000)
  })
  it("retains long content and usage rather than treating token counts as secrets", () => {
    const text = "evidence ".repeat(2000)
    expect(
      redactCredentials({ text, inputTokens: 4200, output_tokens: 150, authorization: "private", secretKey: "private" })
    ).toEqual({ text, inputTokens: 4200, output_tokens: 150 })
  })
  it("captures the answer and finish usage without persisting model reasoning", async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue({ type: "text-delta", id: "text", text: "Complete answer" })
        controller.enqueue({ type: "reasoning-delta", id: "reason", text: "hidden" })
        controller.enqueue({ type: "finish", finishReason: "stop", totalUsage: { inputTokens: 15, outputTokens: 4 } })
        controller.close()
      }
    })
    const result = await collectChatStream(stream)
    expect(result.output).toMatchObject({
      text: "Complete answer",
      inputTokens: 15,
      outputTokens: 4,
      termination: "stop"
    })
    expect(JSON.stringify(result)).not.toContain("hidden")
  })
})
