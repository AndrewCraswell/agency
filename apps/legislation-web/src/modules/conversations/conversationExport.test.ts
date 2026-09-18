import type { UIMessage } from "ai"
import { describe, expect, it } from "vitest"
import { createConversationExport } from "./conversationExport"

describe("conversation export", () => {
  it("removes nested provider reasoning metadata", () => {
    const exported = createConversationExport({
      conversationId: "conversation-1",
      status: "ready",
      messages: [
        {
          id: "answer",
          role: "assistant",
          parts: [
            {
              type: "text",
              text: "Public answer",
              providerMetadata: {
                openrouter: {
                  reasoning_details: [{ type: "reasoning.encrypted", data: "private" }],
                  reasoningContent: "private",
                  responseId: "response-1"
                }
              }
            }
          ]
        }
      ]
    })
    expect(JSON.stringify(exported)).not.toContain("private")
    expect(JSON.stringify(exported)).not.toContain("reasoning_details")
    expect(JSON.stringify(exported)).toContain("response-1")
  })

  it("preserves Basic Grant policy text while removing encoded basic credentials", () => {
    const exported = createConversationExport({
      conversationId: "conversation-1",
      status: "ready",
      messages: [
        { id: "answer", role: "assistant", parts: [{ type: "text", text: "Basic Grant rules. Basic dXNlcjpwYXNz" }] }
      ]
    })
    expect(JSON.stringify(exported)).toContain("Basic Grant rules. [REDACTED]")
    expect(JSON.stringify(exported)).not.toContain("dXNlcjpwYXNz")
  })

  it("preserves text, citations, tool inputs, outputs, errors and pending calls", () => {
    const messages: UIMessage[] = [
      { id: "question", role: "user", parts: [{ type: "text", text: "Investigate school AI policy" }] },
      {
        id: "answer",
        role: "assistant",
        metadata: { createdAt: "2026-09-18T12:00:00.000Z", traceId: "trace-1", runId: "run-1" },
        parts: [
          { type: "text", text: "See [1]." },
          { type: "source-url", sourceId: "1", url: "https://example.org/bill" },
          {
            type: "dynamic-tool",
            toolName: "search_bills",
            toolCallId: "call-1",
            state: "output-available",
            input: { query: "school AI", cursor: "page-2" },
            output: { data: { bills: [{ id: "bill-1" }] } }
          },
          {
            type: "dynamic-tool",
            toolName: "get_bill_timeline",
            toolCallId: "call-2",
            state: "output-error",
            input: { id: "bill-1" },
            errorText: "Request failed: reference-1"
          },
          {
            type: "dynamic-tool",
            toolName: "get_bill",
            toolCallId: "call-3",
            state: "input-available",
            input: { id: "bill-1" }
          }
        ]
      }
    ]
    expect(createConversationExport({ conversationId: "conversation-1", messages, status: "error" })).toMatchObject({
      conversationId: "conversation-1",
      sessionId: "conversation-1",
      status: "error",
      replayId: null,
      messages,
      toolCalls: [
        {
          toolCallId: "call-1",
          messageId: "answer",
          input: { cursor: "page-2" },
          output: { data: { bills: [{ id: "bill-1" }] } }
        },
        { toolCallId: "call-2", error: "Request failed: reference-1", durationMs: null },
        { toolCallId: "call-3", state: "input-available", output: null }
      ],
      capture: { toolCallCount: 3 }
    })
  })

  it("omits session credentials and reasoning without mutating the live conversation", () => {
    const messages: UIMessage[] = [
      {
        id: "answer",
        role: "assistant",
        metadata: { sessionKey: "private-session", authorization: "private-header", traceId: "trace-1" },
        parts: [
          { type: "reasoning", text: "private reasoning" },
          { type: "text", text: "Public answer" },
          {
            type: "source-url",
            sourceId: "1",
            url: "https://user:password@example.org/bill?token=private&secret=private&sessionKey=private-session&id=1"
          }
        ]
      }
    ]
    const exported = createConversationExport({
      conversationId: "conversation-1",
      messages,
      status: "ready",
      replayId: "replay-1"
    })
    const serialized = JSON.stringify(exported)
    expect(serialized).not.toContain("private")
    expect(serialized).not.toContain("password")
    expect(exported).toMatchObject({
      replayId: "replay-1",
      messages: [
        {
          metadata: { traceId: "trace-1" },
          parts: [
            { type: "text", text: "Public answer" },
            { type: "source-url", url: "https://example.org/bill?id=1" }
          ]
        }
      ]
    })
    expect(messages[0]?.parts).toHaveLength(3)
    expect(messages[0]?.metadata).toHaveProperty("sessionKey", "private-session")
  })
})
