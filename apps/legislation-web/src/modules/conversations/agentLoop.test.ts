import { dynamicTool } from "ai"
import { MockLanguageModelV4 } from "ai/test"
import { expect, it, vi } from "vitest"
import { z } from "zod"
import { researchAgentLimits, runResearchAgent } from "./agent"
import { collectChatStream } from "./capture"
import { ResearchFailure } from "./researchFailure"

vi.mock("@langfuse/tracing", () => ({
  propagateAttributes: (_attributes: unknown, run: () => unknown) => run()
}))

it.each([
  { callsPerStep: 1, shouldFail: false, expectedSteps: 8 },
  { callsPerStep: 1, shouldFail: true, expectedSteps: 8 },
  { callsPerStep: 24, shouldFail: false, expectedSteps: 1 },
  { callsPerStep: 25, shouldFail: true, expectedSteps: 1 }
])(
  "synthesizes after $expectedSteps tool-only steps with $callsPerStep calls and failures=$shouldFail",
  async ({ callsPerStep, shouldFail, expectedSteps }) => {
    let generations = 0
    let calls = 0
    const prepareStep = vi.fn<NonNullable<Parameters<typeof runResearchAgent>[0]["prepareStep"]>>(() => ({
      toolChoice: "auto"
    }))
    const execute = vi.fn<() => Promise<unknown>>(async () => {
      calls++
      if (calls > researchAgentLimits.calls) {
        throw new ResearchFailure("step_limit", "fixture-budget")
      }
      if (shouldFail) {
        throw new ResearchFailure("dependency_unavailable", "fixture-failure")
      }
      return { evidence: "Agencies must publish procurement reports." }
    })
    const model = new MockLanguageModelV4({
      doStream: async ({ toolChoice }) => {
        generations++
        const isSynthesis = toolChoice?.type === "none"
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
        sessionId: "bounded-research",
        model,
        instructions: "Answer the procurement question.",
        messages: [{ role: "user", content: "What must agencies disclose?" }],
        tools: { get_bill: dynamicTool({ inputSchema: z.object({}), execute }) },
        signal: new AbortController().signal,
        prepareStep
      }).stream
    )
    expect(model.doStreamCalls).toHaveLength(expectedSteps + 1)
    const synthesis = model.doStreamCalls.at(-1)
    expect(JSON.stringify(synthesis?.prompt)).toContain("finish with an answer from the evidence already retrieved")
    expect(synthesis?.prompt.some((message) => message.role === "tool")).toBe(true)
    expect(synthesis?.toolChoice?.type).toBe("none")
    expect(prepareStep).toHaveBeenCalledTimes(expectedSteps + 1)
    expect(execute).toHaveBeenCalledTimes(expectedSteps * callsPerStep)
    expect(result.output).toMatchObject({
      termination: "stop",
      text: shouldFail ? "Research is incomplete." : "Agencies must publish procurement reports."
    })
    expect(result.events.filter((event) => event.type === "call")).toHaveLength(expectedSteps * callsPerStep)
    expect(result.events.filter((event) => event.type === "error")).toHaveLength(
      shouldFail ? expectedSteps * callsPerStep : 0
    )
  }
)
