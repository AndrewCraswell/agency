import type { TextStreamPart, ToolSet } from "ai"
import { describe, expect, it } from "vitest"
import { exposeReasoningSummaries } from "./reasoningSummary"

function stream(parts: TextStreamPart<ToolSet>[]) {
  return new ReadableStream<TextStreamPart<ToolSet>>({
    start(controller) {
      for (const part of parts) {
        controller.enqueue(part)
      }
      controller.close()
    }
  })
}

async function collect(parts: TextStreamPart<ToolSet>[]) {
  const output: TextStreamPart<ToolSet>[] = []
  for await (const part of exposeReasoningSummaries(stream(parts))) {
    output.push(part)
  }
  return output
}

describe("reasoning summaries", () => {
  it("emits provider summaries before buffered tool activity without exposing raw or encrypted reasoning", async () => {
    const tool = {
      type: "tool-call",
      toolCallId: "search",
      toolName: "search_bills",
      input: { query: "housing" }
    } satisfies TextStreamPart<ToolSet>
    const output = await collect([
      { type: "reasoning-start", id: "reasoning" },
      { type: "reasoning-delta", id: "reasoning", text: "private deliberation" },
      tool,
      {
        type: "reasoning-end",
        id: "reasoning",
        providerMetadata: {
          openrouter: {
            reasoning_details: [
              { type: "reasoning.text", text: "private deliberation" },
              { type: "reasoning.summary", summary: "**Identifying bills**\n\nI’ll identify " },
              { type: "reasoning.summary", summary: "the relevant bills, then verify their text." },
              { type: "reasoning.encrypted", data: "private" }
            ]
          }
        }
      }
    ])

    expect(output).toEqual([
      { type: "reasoning-start", id: "reasoning" },
      {
        type: "reasoning-delta",
        id: "reasoning",
        text: "**Identifying bills**\n\nI’ll identify the relevant bills, then verify their text."
      },
      { type: "reasoning-end", id: "reasoning" },
      tool
    ])
    expect(JSON.stringify(output)).not.toContain("private deliberation")
    expect(JSON.stringify(output)).not.toContain("reasoning.encrypted")
  })

  it("drops non-summary reasoning and releases buffered activity", async () => {
    const tool = {
      type: "tool-call",
      toolCallId: "read",
      toolName: "get_bill",
      input: { id: "bill:one" }
    } satisfies TextStreamPart<ToolSet>
    await expect(
      collect([
        { type: "reasoning-start", id: "reasoning" },
        { type: "reasoning-delta", id: "reasoning", text: "private deliberation" },
        tool,
        {
          type: "reasoning-end",
          id: "reasoning",
          providerMetadata: {
            openrouter: { reasoning_details: [{ type: "reasoning.text", text: "private deliberation" }] }
          }
        }
      ])
    ).resolves.toEqual([tool])
  })

  it("never exposes incomplete reasoning blocks", async () => {
    const text = { type: "text-start", id: "answer" } satisfies TextStreamPart<ToolSet>
    await expect(
      collect([
        { type: "reasoning-start", id: "reasoning" },
        { type: "reasoning-delta", id: "reasoning", text: "private deliberation" },
        text
      ])
    ).resolves.toEqual([text])
  })

  it("does not discard buffered activity when a provider restarts an incomplete reasoning block", async () => {
    const tool = {
      type: "tool-call",
      toolCallId: "read",
      toolName: "get_bill",
      input: { id: "bill:one" }
    } satisfies TextStreamPart<ToolSet>
    await expect(
      collect([
        { type: "reasoning-start", id: "first" },
        tool,
        { type: "reasoning-start", id: "second" },
        { type: "reasoning-end", id: "second" }
      ])
    ).resolves.toEqual([tool])
  })
})
