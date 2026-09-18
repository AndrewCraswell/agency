import { describe, expect, it } from "vitest"
import { assertSafeArtifact } from "../evaluations/contracts"
import { collectChatStream } from "./capture"
import { redactCredentials } from "./redactCredentials"

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
