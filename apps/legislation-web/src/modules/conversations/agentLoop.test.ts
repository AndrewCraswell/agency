import { dynamicTool } from "ai"
import { MockLanguageModelV4 } from "ai/test"
import { expect, it, vi } from "vitest"
import { z } from "zod"
import { runResearchAgent } from "./agent"
import { collectChatStream } from "./capture"
import { ResearchFailure } from "./researchFailure"

vi.mock("@langfuse/tracing", () => ({
  propagateAttributes: (_attributes: unknown, run: () => unknown) => run()
}))

it.each([
  { callsPerStep: 3, shouldFail: false, researchSteps: 12, ending: "answer" },
  { callsPerStep: 3, shouldFail: true, researchSteps: 12, ending: "answer" },
  { callsPerStep: 30, shouldFail: false, researchSteps: 1, ending: "answer" },
  { callsPerStep: 3, shouldFail: false, researchSteps: 12, ending: "clarification" },
  { callsPerStep: 1, shouldFail: false, researchSteps: 26, ending: "cancel" }
])(
  "continues for $researchSteps steps with $callsPerStep calls and failures=$shouldFail until $ending",
  async ({ callsPerStep, shouldFail, researchSteps, ending }) => {
    let generations = 0
    let calls = 0
    const abort = new AbortController()
    const prepareStep = vi.fn<NonNullable<Parameters<typeof runResearchAgent>[0]["prepareStep"]>>(() => ({
      toolChoice: "auto"
    }))
    const execute = vi.fn<() => Promise<unknown>>(async () => {
      calls++
      if (ending === "cancel" && calls === researchSteps * callsPerStep) {
        abort.abort()
      }
      if (shouldFail) {
        throw new ResearchFailure("dependency_unavailable", "fixture-failure")
      }
      return { evidence: "Agencies must publish procurement reports." }
    })
    const clarify = vi.fn<() => Promise<{ question: string }>>(async () => ({ question: "Which jurisdiction?" }))
    const model = new MockLanguageModelV4({
      doStream: async () => {
        generations++
        const isEnding = generations > researchSteps
        const isSynthesis = isEnding && ending !== "clarification"
        return {
          stream: new ReadableStream({
            start(controller) {
              controller.enqueue({ type: "stream-start", warnings: [] })
              if (isSynthesis) {
                controller.enqueue({ type: "text-start", id: "answer" })
                controller.enqueue({
                  type: "text-delta",
                  id: "answer",
                  delta: shouldFail ? "Research is incomplete." : "Agencies must publish procurement reports."
                })
                controller.enqueue({ type: "text-end", id: "answer" })
              } else if (isEnding) {
                controller.enqueue({
                  type: "tool-call",
                  toolCallId: "clarification",
                  toolName: "ask_clarification",
                  input: "{}"
                })
              } else {
                for (let call = 0; call < callsPerStep; call++) {
                  controller.enqueue({
                    type: "tool-call",
                    toolCallId: `read-${generations}-${call}`,
                    toolName: "get_bill",
                    input: "{}"
                  })
                }
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
        sessionId: "continued-research",
        model,
        instructions: "Answer the procurement question.",
        messages: [{ role: "user", content: "What must agencies disclose?" }],
        tools: {
          get_bill: dynamicTool({ inputSchema: z.object({}), execute }),
          ask_clarification: dynamicTool({ inputSchema: z.object({}), execute: clarify })
        },
        signal: abort.signal,
        prepareStep
      }).stream
    )
    const expectedGenerations = researchSteps + (ending === "cancel" ? 0 : 1)
    expect(model.doStreamCalls).toHaveLength(expectedGenerations)
    expect(model.doStreamCalls.every((call) => call.toolChoice?.type === "auto")).toBe(true)
    expect(prepareStep).toHaveBeenCalledTimes(expectedGenerations)
    expect(execute).toHaveBeenCalledTimes(researchSteps * callsPerStep)
    const expectedOutput =
      ending === "answer"
        ? {
            termination: "stop",
            text: shouldFail ? "Research is incomplete." : "Agencies must publish procurement reports."
          }
        : { termination: ending === "cancel" ? "abort" : "clarification", text: "" }
    expect(result.output).toMatchObject(expectedOutput)
    expect(clarify).toHaveBeenCalledTimes(ending === "clarification" ? 1 : 0)
    expect(result.events.filter((event) => event.type === "call" && event.tool === "get_bill")).toHaveLength(
      researchSteps * callsPerStep
    )
    expect(result.events.filter((event) => event.type === "error")).toHaveLength(
      shouldFail ? researchSteps * callsPerStep : 0
    )
  }
)
