import type { UIMessage } from "ai"
import { describe, expect, it } from "vitest"
import { createConversationExport } from "./conversationExport"

describe("conversation export", () => {
  it.each([
    {
      name: "inline credentials and public URL spelling",
      text: "See [source](https://reader:synthetic@EXAMPLE.org:443/bill?sessionKey=synthetic&id=AB%202&label=Basic%20Grant~#access_token=synthetic&section=Part%202).",
      expected: "See [source](https://EXAMPLE.org:443/bill?id=AB%202&label=Basic%20Grant~#section=Part%202)."
    },
    {
      name: "parentheses within credential values",
      text: "See [source](https://example.org/bill?token=synthetic(secret)&id=1#access_token=synthetic(secret)).",
      expected: "See [source](https://example.org/bill?id=1)."
    },
    {
      name: "adjacent Markdown links without intervening whitespace",
      text: "[one](https://example.org/bill(1)?token=synthetic)[two](https://example.org/bill(2)?token=synthetic&id=2)",
      expected: "[one](https://example.org/bill(1))[two](https://example.org/bill(2)?id=2)"
    },
    {
      name: "fragment routes after parenthesized public paths",
      text: "https://example.org/bill(2)#section(3)?access_token=synthetic&id=AB%202",
      expected: "https://example.org/bill(2)#section(3)?id=AB%202"
    },
    {
      name: "fragment routes with no public parameters",
      text: "https://example.org/bill#section(2)?access_token=synthetic",
      expected: "https://example.org/bill#section(2)"
    },
    {
      name: "encoded and duplicate credential parameter names",
      text: "https://example.org/bill?%61ccess_token=synthetic&id=1&SESSION_KEY=synthetic&id=2&access_token=synthetic",
      expected: "https://example.org/bill?id=1&id=2"
    },
    {
      name: "IPv6 authorities and user information",
      text: "[https://reader:synthetic@[::1]:8080/bill?api_key=synthetic&id=1]",
      expected: "[https://[::1]:8080/bill?id=1]"
    },
    {
      name: "known keys in standalone and embedded URL paths",
      text: "https://example.org/sk-or-v1-synthetic-key\nSee [source](https://example.org/sk-lf-synthetic-key?id=1).",
      expected: "https://example.org/[REDACTED]\nSee [source](https://example.org/[REDACTED]?id=1)."
    },
    {
      name: "public prose beginning with a URL",
      text: "https://EXAMPLE.org:443/bill?id=AB%202&label=Basic%20Grant~#section(2)\nBasic Grant rules. See [source](https://example.org/bill(3)).",
      expected:
        "https://EXAMPLE.org:443/bill?id=AB%202&label=Basic%20Grant~#section(2)\nBasic Grant rules. See [source](https://example.org/bill(3))."
    }
  ])("redacts $name at every export boundary", ({ text, expected }) => {
    const messages: UIMessage[] = [
      {
        id: "answer",
        role: "assistant",
        parts: [
          { type: "text", text },
          { type: "source-url", sourceId: "1", url: text },
          {
            type: "dynamic-tool",
            toolName: "get_bill",
            toolCallId: "call-1",
            state: "output-available",
            input: { source: text },
            output: { source: text }
          },
          {
            type: "dynamic-tool",
            toolName: "get_bill",
            toolCallId: "call-2",
            state: "output-error",
            input: {},
            errorText: text
          }
        ]
      }
    ]
    const exported = createConversationExport({
      conversationId: "conversation-1",
      status: "ready",
      messages,
      clarificationAnswers: { source: text }
    })
    expect(exported).toMatchObject({
      messages: [
        {
          parts: [
            { type: "text", text: expected },
            { type: "source-url", url: expected },
            { input: { source: expected }, output: { source: expected } },
            { errorText: expected }
          ]
        }
      ],
      toolCalls: [{ input: { source: expected }, output: { source: expected } }, { error: expected }],
      clarificationAnswers: { source: expected }
    })
    expect(JSON.stringify(exported)).not.toContain("synthetic")
    expect(messages[0]?.parts[0]).toEqual({ type: "text", text })
  })

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
