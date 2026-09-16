import { describe, expect, it } from "vitest"
import { assertSafeArtifact } from "../evaluations/contracts"
import { redactCredentials, collectChatStream } from "./capture"

describe("complete chat capture", () => {
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
