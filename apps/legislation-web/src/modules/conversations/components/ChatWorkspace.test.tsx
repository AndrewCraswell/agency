// @vitest-environment happy-dom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { UIMessageChunk } from "ai"
import { afterEach, describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { HomepageLanding } from "../../homepage/components/HomepageLanding"
import { chatRequestSchema, referenceSearchSchema, type StagedReference } from "../chatRequest"
import { downloadConversationExport } from "../conversationExport"
import { incompleteAnswerText } from "../responseOutcome"
import { ChatProviders } from "./ChatProviders"
import { ChatWorkspace } from "./ChatWorkspace"
import { useConversationSession } from "./ConversationSession"
import * as composerStyles from "./ChatComposer.css"

const navigation = vi.hoisted(() => ({ push: vi.fn<(url: string) => void>() }))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

vi.mock("next/navigation", () => ({ useRouter: () => navigation }))
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn<typeof import("@sentry/nextjs").captureException>(),
  getReplay: () => ({ getReplayId: () => "replay-1" })
}))
vi.mock("../conversationExport", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../conversationExport")>()),
  downloadConversationExport: vi.fn<typeof downloadConversationExport>()
}))
// The independent homepage mention example has its own lookup coverage in page.test.tsx.
vi.mock("../../homepage/components/HomepageConnections", () => ({ HomepageConnections: () => null }))

function navigatedConversationId() {
  return z.string().parse(navigation.push.mock.lastCall?.[0].split("/").at(-1))
}

function streamedAnswer(text: string) {
  return streamedChunks([
    { type: "start", messageId: crypto.randomUUID() },
    { type: "text-start", id: "answer" },
    { type: "text-delta", id: "answer", delta: text },
    { type: "text-end", id: "answer" },
    { type: "finish", finishReason: "stop" }
  ])
}

function streamedChunks(chunks: UIMessageChunk[]) {
  return new Response(chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("") + "data: [DONE]\n\n", {
    headers: { "content-type": "text/event-stream", "x-vercel-ai-ui-message-stream": "v1" }
  })
}

describe("ChatWorkspace", () => {
  it.each([
    {
      status: "failed",
      finishReason: "stop",
      text: incompleteAnswerText,
      hasAnswer: false,
      notice: "Research could not be completed. Your question is still in this conversation."
    },
    {
      status: "exhausted",
      finishReason: "length",
      text: "Findings received before the limit.",
      hasAnswer: true,
      notice: "Research reached its response limit. The answer may be incomplete."
    },
    {
      status: "partial",
      finishReason: null,
      text: "Partial findings.",
      hasAnswer: true,
      notice: "This response may be incomplete. Any research received is still available."
    }
  ])(
    "keeps $status outcomes visible with a usable composer and truthful export",
    async ({ status, finishReason, text, hasAnswer, notice }) => {
      const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () =>
        streamedChunks([
          { type: "start", messageId: "answer" },
          { type: "text-start", id: "answer-text" },
          { type: "text-delta", id: "answer-text", delta: text },
          { type: "text-end", id: "answer-text" },
          {
            type: "data-response-outcome",
            data: {
              status,
              finishReason,
              hasAnswer,
              pendingToolCalls: [],
              failedToolCalls: status === "failed" ? ["search"] : []
            }
          },
          { type: "finish", finishReason: finishReason === "length" ? "length" : "stop" }
        ])
      )
      vi.stubGlobal("fetch", fetchMock)
      const user = userEvent.setup()
      const view = render(<HomepageLanding isAvailable />, { wrapper: ChatProviders })
      await user.type(await screen.findByRole("textbox", { name: "Your question" }), "Research question")
      await user.click(screen.getByRole("button", { name: "Send question" }))
      await waitFor(() => expect(navigation.push).toHaveBeenCalledOnce())
      const conversationId = navigatedConversationId()
      view.rerender(<ChatWorkspace isAvailable conversationId={conversationId} />)
      await screen.findByText(notice)
      expect(screen.getByText(text)).toBeDefined()
      await user.type(await screen.findByRole("textbox", { name: "Your question" }), "/export")
      await user.keyboard("{Enter}")
      expect(downloadConversationExport).toHaveBeenCalledWith(
        conversationId,
        expect.objectContaining({
          interactionStatus: "ready",
          currentResponseOutcome: expect.objectContaining({ status, hasAnswer, finishReason })
        })
      )
      expect(fetchMock).toHaveBeenCalledOnce()
    }
  )

  it("retains a complete terminal answer without an interruption alert after a late abort", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockImplementation(async () =>
        streamedChunks([
          { type: "start", messageId: "answer" },
          { type: "text-start", id: "text" },
          { type: "text-delta", id: "text", delta: "A fully delivered answer." },
          { type: "text-end", id: "text" },
          {
            type: "data-response-outcome",
            data: {
              status: "completed",
              finishReason: "stop",
              hasAnswer: true,
              pendingToolCalls: [],
              failedToolCalls: []
            }
          },
          { type: "finish", finishReason: "stop" },
          { type: "abort" }
        ])
      )
    )
    const user = userEvent.setup()
    const view = render(<HomepageLanding isAvailable />, { wrapper: ChatProviders })
    await user.type(await screen.findByRole("textbox", { name: "Your question" }), "Research question")
    await user.click(screen.getByRole("button", { name: "Send question" }))
    await waitFor(() => expect(navigation.push).toHaveBeenCalledOnce())
    const conversationId = navigatedConversationId()
    view.rerender(<ChatWorkspace isAvailable conversationId={conversationId} />)
    await screen.findByText("A fully delivered answer.")
    await waitFor(() => expect(screen.queryByRole("button", { name: "Stop response" })).toBeNull())
    expect(screen.queryByRole("alert")).toBeNull()
    await user.type(await screen.findByRole("textbox", { name: "Your question" }), "/export")
    await user.keyboard("{Enter}")
    expect(downloadConversationExport).toHaveBeenCalledWith(
      conversationId,
      expect.objectContaining({
        currentResponseOutcome: expect.objectContaining({ status: "completed", hasAnswer: true })
      })
    )
  })

  it("does not silently mark an early EOF with a pending search as a completed answer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockImplementation(async () =>
        streamedChunks([
          { type: "start", messageId: "answer" },
          { type: "tool-input-start", toolCallId: "pending-search", toolName: "search_bill_text" }
        ])
      )
    )
    const user = userEvent.setup()
    const view = render(<HomepageLanding isAvailable />, { wrapper: ChatProviders })
    await user.type(await screen.findByRole("textbox", { name: "Your question" }), "Research question")
    await user.click(screen.getByRole("button", { name: "Send question" }))
    await waitFor(() => expect(navigation.push).toHaveBeenCalledOnce())
    const conversationId = navigatedConversationId()
    view.rerender(<ChatWorkspace isAvailable conversationId={conversationId} />)
    await screen.findByText("Completion could not be confirmed. Your question is still in this conversation.")
    await user.type(await screen.findByRole("textbox", { name: "Your question" }), "/export")
    await user.keyboard("{Enter}")
    expect(downloadConversationExport).toHaveBeenCalledWith(
      conversationId,
      expect.objectContaining({
        interactionStatus: "ready",
        currentResponseOutcome: expect.objectContaining({
          status: "unknown",
          hasAnswer: false,
          finishReason: null,
          pendingToolCalls: ["pending-search"]
        })
      })
    )
  })

  it("records explicit Stop separately from a transport abort and keeps partial text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockImplementation(
        async (_request, init) =>
          new Response(
            new ReadableStream({
              start(controller) {
                const encoder = new TextEncoder()
                for (const chunk of [
                  { type: "start", messageId: "answer" },
                  { type: "text-start", id: "text" },
                  { type: "text-delta", id: "text", delta: "Findings before Stop." }
                ]) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`))
                }
                init?.signal?.addEventListener(
                  "abort",
                  () => controller.error(new DOMException("Aborted", "AbortError")),
                  { once: true }
                )
              }
            }),
            { headers: { "content-type": "text/event-stream", "x-vercel-ai-ui-message-stream": "v1" } }
          )
      )
    )
    const user = userEvent.setup()
    const view = render(<HomepageLanding isAvailable />, { wrapper: ChatProviders })
    await user.type(await screen.findByRole("textbox", { name: "Your question" }), "Research question")
    await user.click(screen.getByRole("button", { name: "Send question" }))
    await waitFor(() => expect(navigation.push).toHaveBeenCalledOnce())
    const conversationId = navigatedConversationId()
    view.rerender(<ChatWorkspace isAvailable conversationId={conversationId} />)
    const response = await screen.findByRole("article", { name: "Rostra response" })
    // Streaming prose is split across animation spans.
    await waitFor(() => expect(response.textContent).toContain("Findings before Stop."))
    await user.click(screen.getByRole("button", { name: "Stop response" }))
    await screen.findByText("Response stopped. Any research received is still available.")
    expect(response.textContent).toContain("Findings before Stop.")
    await user.type(await screen.findByRole("textbox", { name: "Your question" }), "/export")
    await user.keyboard("{Enter}")
    expect(downloadConversationExport).toHaveBeenCalledWith(
      conversationId,
      expect.objectContaining({
        currentResponseOutcome: expect.objectContaining({ status: "cancelled", hasAnswer: true }),
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: "assistant",
            parts: expect.arrayContaining([expect.objectContaining({ type: "text", text: "Findings before Stop." })])
          })
        ])
      })
    )
  })

  it("exports locally by command without another model request, even when research is disconnected", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () => streamedAnswer("An exportable response"))
    vi.stubGlobal("fetch", fetchMock)
    const user = userEvent.setup()
    const view = render(<HomepageLanding isAvailable />, { wrapper: ChatProviders })
    await user.type(await screen.findByRole("textbox", { name: "Your question" }), "First question")
    await user.click(screen.getByRole("button", { name: "Send question" }))
    await waitFor(() => expect(navigation.push).toHaveBeenCalledOnce())
    const conversationId = navigatedConversationId()
    view.rerender(<ChatWorkspace conversationId={conversationId} />)
    await screen.findByText("An exportable response")
    await waitFor(() => expect(screen.queryByRole("button", { name: "Stop response" })).toBeNull())
    const input = screen.getByRole("textbox", { name: "Your question" })
    await user.type(input, "/export")
    await user.keyboard("{Enter}")
    await waitFor(() => expect(downloadConversationExport).toHaveBeenCalledOnce())
    expect(downloadConversationExport).toHaveBeenCalledWith(
      conversationId,
      expect.objectContaining({
        sessionId: conversationId,
        replayId: "replay-1",
        messages: expect.arrayContaining([
          expect.objectContaining({ role: "user" }),
          expect.objectContaining({ role: "assistant" })
        ])
      })
    )
    expect(JSON.stringify(vi.mocked(downloadConversationExport).mock.calls)).not.toContain("sessionKey")
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toHaveProperty("sessionId", conversationId)
    await waitFor(() => expect(input.textContent).toBe(""))
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(screen.queryByRole("button", { name: "Export conversation" })).toBeNull()
  })

  it("does not send an export command from an empty conversation to the model", async () => {
    function EmptyConversation() {
      const { chat } = useConversationSession()
      return <ChatWorkspace conversationId={chat.id} />
    }
    const fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal("fetch", fetchMock)
    const user = userEvent.setup()
    render(<EmptyConversation />, { wrapper: ChatProviders })
    await user.type(await screen.findByRole("textbox", { name: "Your question" }), "/export")
    await user.keyboard("{Enter}")
    expect(await screen.findByText("Start a conversation before exporting.")).toBeDefined()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(navigation.push).not.toHaveBeenCalled()
  })

  const person: StagedReference = {
    resultId: "23974c17-3898-4b92-96f7-1c600704e12e",
    recordId: "person:ocasio-cortez",
    record: {
      id: "person:ocasio-cortez",
      kind: "person",
      title: "Alexandria Ocasio-Cortez",
      subtitle: "New York, U.S. House",
      sourceUrl: null,
      fields: [],
      tallies: []
    }
  }
  const committee: StagedReference = {
    resultId: "969e397c-2013-4525-aab6-e206d64ac3e2",
    recordId: "organization:education",
    record: {
      id: "organization:education",
      kind: "organization",
      title: "House Education and Workforce",
      subtitle: "U.S. House",
      sourceUrl: null,
      fields: [],
      tallies: [],
      organizationSummary: { classification: "committee", membershipCompleteness: "unknown" }
    }
  }

  it.each([12, 13])("applies the homepage submission limit to %s staged references", async (count) => {
    const references = Array.from(
      { length: count },
      (_, index): StagedReference => ({
        ...person,
        recordId: `person:staged-${index}`,
        record: { ...person.record, id: `person:staged-${index}`, title: `Staged person ${index}` }
      })
    )
    function StagedHomepage() {
      const session = useConversationSession()
      return (
        <HomepageLanding isAvailable>
          <button
            onClick={() => {
              session.setReferences(references)
              session.setDraft([{ type: "text", text: "Compare these sponsors" }])
            }}
          >
            Stage references
          </button>
        </HomepageLanding>
      )
    }
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () => streamedAnswer("References received"))
    vi.stubGlobal("fetch", fetchMock)
    const user = userEvent.setup()
    const view = render(<StagedHomepage />, { wrapper: ChatProviders })
    await user.click(screen.getByRole("button", { name: "Stage references" }))
    const input = await screen.findByRole("textbox", { name: "Your question" })
    await waitFor(() => expect(input.textContent).toBe("Compare these sponsors"))
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Send question" }).disabled).toBe(count > 12)
    await user.click(input)
    await user.keyboard("{Enter}")
    await waitFor(() => expect(navigation.push).toHaveBeenCalledTimes(count > 12 ? 0 : 1))
    expect(fetchMock).toHaveBeenCalledTimes(count > 12 ? 0 : 1)
    if (count > 12) {
      return
    }
    const submission = chatRequestSchema.parse(JSON.parse(z.string().parse(fetchMock.mock.calls[0]?.[1]?.body)))
    expect(submission.references).toEqual(references.map(({ resultId, recordId }) => ({ resultId, recordId })))
    view.rerender(<ChatWorkspace isAvailable conversationId={navigatedConversationId()} />)
    await screen.findByText("References received")
    expect(screen.getByRole("list", { name: "Submitted references" }).children).toHaveLength(12)
  })

  it("does not submit an empty or whitespace-only homepage question", async () => {
    const fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal("fetch", fetchMock)
    const user = userEvent.setup()
    render(<HomepageLanding isAvailable />, { wrapper: ChatProviders })
    const input = await screen.findByRole("textbox", { name: "Your question" })
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Send question" }).disabled).toBe(true)
    await user.type(input, "   ")
    await user.keyboard("{Enter}")
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Send question" }).disabled).toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(navigation.push).not.toHaveBeenCalled()
  })

  it("blocks another homepage submission while researching and awaiting navigation", async () => {
    const response = Promise.withResolvers<Response>()
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(() => response.promise)
    vi.stubGlobal("fetch", fetchMock)
    const user = userEvent.setup()
    render(<HomepageLanding isAvailable />, { wrapper: ChatProviders })
    const input = await screen.findByRole("textbox", { name: "Your question" })
    await user.type(input, "First question")
    await user.keyboard("{Enter}")
    await waitFor(() => expect(navigation.push).toHaveBeenCalledOnce())
    await waitFor(() => expect(input.textContent).toBe(""))
    await user.type(input, "Do not start another session")
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Send question" }).disabled).toBe(true)
    await user.keyboard("{Enter}")
    expect(fetchMock).toHaveBeenCalledOnce()
    await act(async () => response.resolve(streamedAnswer("Completed before navigation")))
    await waitFor(() =>
      expect(screen.getByRole<HTMLButtonElement>("button", { name: "Send question" }).disabled).toBe(false)
    )
    await user.keyboard("{Enter}")
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(navigation.push).toHaveBeenCalledOnce()
  })

  it("debounces name lookup and sends exact inline references with the first message", async () => {
    const lookups: z.infer<typeof referenceSearchSchema>[] = []
    const submissions: z.infer<typeof chatRequestSchema>[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockImplementation(async (_input, init) => {
        const body: unknown = JSON.parse(z.string().parse(init?.body))
        const lookup = referenceSearchSchema.safeParse(body)
        if (lookup.success) {
          lookups.push(lookup.data)
          return Response.json({ references: lookup.data.query.includes("education") ? [committee] : [person] })
        }
        submissions.push(chatRequestSchema.parse(body))
        return streamedAnswer("Research context received")
      })
    )
    const user = userEvent.setup()
    const view = render(<HomepageLanding isAvailable />, { wrapper: ChatProviders })
    const input = await screen.findByRole("textbox", { name: "Your question" })
    input.focus()
    window.getSelection()?.collapse(input.querySelector("p"), 0)
    await user.type(input, "Ask @Ocasio", { skipClick: true })
    expect(lookups).toHaveLength(0)
    await screen.findByRole("option", { name: /Alexandria Ocasio-Cortez/ })
    expect(lookups).toHaveLength(1)
    expect(lookups[0]).toMatchObject({ action: "search-references", query: "Ocasio", kind: "mention" })
    await user.keyboard("{Enter}")
    await waitFor(() => expect(input.querySelectorAll('[data-type="mention"]')).toHaveLength(1))
    expect(input.querySelectorAll("p")).toHaveLength(1)
    expect(submissions).toHaveLength(0)
    await user.type(input, "about @education")
    await user.click(await screen.findByRole("option", { name: /House Education and Workforce/ }))
    await waitFor(() => expect(input.querySelectorAll('[data-type="mention"]')).toHaveLength(2))
    expect(input.querySelectorAll("p")).toHaveLength(1)
    await user.click(screen.getByRole("button", { name: "Send question" }))
    await waitFor(() => expect(submissions).toHaveLength(1))
    expect(submissions[0]).toMatchObject({
      sessionKey: lookups[0]?.sessionKey,
      references: [
        { resultId: person.resultId, recordId: person.recordId },
        { resultId: committee.resultId, recordId: committee.recordId }
      ],
      messages: [
        {
          role: "user",
          parts: [{ type: "text", text: "Ask @Alexandria Ocasio-Cortez about @House Education and Workforce " }]
        }
      ]
    })
    expect(navigation.push).toHaveBeenCalledOnce()
    const conversationId = navigatedConversationId()
    view.rerender(<ChatWorkspace isAvailable conversationId={conversationId} />)
    const question = await screen.findByRole("article", { name: "Your question" })
    await waitFor(() => expect(question.querySelectorAll('[data-type="mention"]')).toHaveLength(2))
    expect(question.querySelector('[data-id="person:ocasio-cortez"]')?.textContent).toBe("Alexandria Ocasio-Cortez")
    expect(screen.queryByRole("list", { name: "Submitted references" })).toBeNull()
  })

  it("aborts superseded name searches and ignores their late results", async () => {
    const first = Promise.withResolvers<Response>()
    const signals: (AbortSignal | null | undefined)[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockImplementation(async (_input, init) => {
        signals.push(init?.signal)
        if (signals.length === 1) {
          return first.promise
        }
        return Response.json({ references: [person] })
      })
    )
    const user = userEvent.setup()
    render(<HomepageLanding isAvailable />, { wrapper: ChatProviders })
    const input = await screen.findByRole("textbox", { name: "Your question" })
    await user.type(input, "@Oc")
    await waitFor(() => expect(signals).toHaveLength(1))
    await user.type(input, "asio")
    await screen.findByRole("option", { name: /Alexandria Ocasio-Cortez/ })
    expect(signals[0]?.aborted).toBe(true)
    await act(async () => {
      first.resolve(Response.json({ references: [committee] }))
      await first.promise
    })
    expect(screen.queryByRole("option", { name: /House Education and Workforce/ })).toBeNull()
    expect(screen.getByRole("option", { name: /Alexandria Ocasio-Cortez/ })).toBeDefined()
  })

  it("keeps progress in the conversation without adding a status row below the composer", async () => {
    const response = Promise.withResolvers<Response>()
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockImplementation(() => response.promise)
    )
    const stream = new TransformStream<Uint8Array, Uint8Array>()
    const writer = stream.writable.getWriter()
    const encoder = new TextEncoder()
    const user = userEvent.setup()
    const view = render(<HomepageLanding isAvailable />, { wrapper: ChatProviders })
    await user.type(await screen.findByRole("textbox", { name: "Your question" }), "A streamed question")
    await user.click(screen.getByRole("button", { name: "Send question" }))
    await waitFor(() => expect(navigation.push).toHaveBeenCalledTimes(1))
    const conversationId = navigatedConversationId()
    view.rerender(<ChatWorkspace key={conversationId} isAvailable conversationId={conversationId} />)
    await screen.findByRole("textbox", { name: "Your question" })

    function expectNoComposerStatus() {
      const field = screen.getByRole("textbox", { name: "Your question" })
      expect(field.closest("form")?.parentElement?.querySelector("output")).toBeNull()
      expect(field.getAttribute("aria-describedby")).toBeNull()
    }

    expect(screen.getByText("Preparing research...")).toBeDefined()
    expectNoComposerStatus()
    await act(async () => {
      response.resolve(
        new Response(stream.readable, {
          headers: { "content-type": "text/event-stream", "x-vercel-ai-ui-message-stream": "v1" }
        })
      )
      await writer.write(encoder.encode('data: {"type":"start","messageId":"progress-answer"}\n\n'))
    })
    await screen.findByText("Researching...")
    expectNoComposerStatus()
    await act(async () => {
      await writer.write(encoder.encode('data: {"type":"text-start","id":"answer"}\n\n'))
      await writer.write(encoder.encode('data: {"type":"text-delta","id":"answer","delta":"Received text"}\n\n'))
    })
    await waitFor(() =>
      expect(screen.getByRole("article", { name: "Rostra response" }).textContent).toContain("Received text")
    )
    expect(screen.queryByText("Researching...")).toBeNull()
    expect(screen.queryByText("Writing response...")).toBeNull()
    expect(screen.getByRole("article", { name: "Rostra response" }).querySelector("output")).toBeNull()
    expect(screen.getByRole("button", { name: "Stop response" })).toBeDefined()
    expectNoComposerStatus()
    await act(async () => {
      await writer.write(encoder.encode('data: {"type":"text-end","id":"answer"}\n\ndata: {"type":"finish"}\n\n'))
      await writer.close()
    })
    await waitFor(() => expect(screen.queryByRole("button", { name: "Stop response" })).toBeNull())
    expectNoComposerStatus()
  })

  it("sends the first question once, navigates, and retains the stream without the homepage glow", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () => streamedAnswer("A retained response"))
    vi.stubGlobal("fetch", fetchMock)
    const user = userEvent.setup()
    const view = render(<HomepageLanding isAvailable />, { wrapper: ChatProviders })
    const field = await screen.findByRole("textbox", { name: "Your question" })
    expect(field.closest("form")?.classList.contains(composerStyles.homepageGlow)).toBe(true)
    await user.type(field, "First question")
    await waitFor(() => expect(field.textContent).toBe("First question"))
    await user.click(screen.getByRole("button", { name: "Send question" }))
    await waitFor(() => expect(navigation.push).toHaveBeenCalledTimes(1))
    const path = navigation.push.mock.calls[0]?.[0]
    expect(path).toMatch(/^\/conversations\/[^/]+$/)
    const conversationId = navigatedConversationId()
    view.rerender(<ChatWorkspace key={conversationId} isAvailable conversationId={conversationId} />)
    await screen.findByText("A retained response")
    expect(screen.getByText("First question")).toBeDefined()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const followUp = await screen.findByRole("textbox", { name: "Your question" })
    expect(followUp.closest("form")?.classList.contains(composerStyles.homepageGlow)).toBe(false)
    await waitFor(() => expect(screen.queryByRole("button", { name: "Stop response" })).toBeNull())
    await user.type(followUp, "Follow-up question")
    await user.click(screen.getByRole("button", { name: "Send question" }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(navigation.push).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[1]?.[1]?.body).toContain("First question")
    expect(fetchMock.mock.calls[1]?.[1]?.body).toContain("Follow-up question")
    await waitFor(() => expect(screen.queryByRole("button", { name: "Stop response" })).toBeNull())
  })

  it("does not replay or display another conversation for a stale route", () => {
    const fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal("fetch", fetchMock)
    render(<ChatWorkspace isAvailable conversationId="expired" />, { wrapper: ChatProviders })
    expect(screen.getByRole("heading", { name: "This conversation is no longer available" })).toBeDefined()
    expect(screen.queryByRole("textbox")).toBeNull()
    expect(screen.getByRole("link", { name: "New conversation" }).getAttribute("href")).toBe("/")
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("keeps the research question editable without enabling disconnected research", async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal("fetch", fetchMock)
    render(<HomepageLanding />, { wrapper: ChatProviders })
    const question = await screen.findByRole("textbox", { name: "Your question" })
    await user.type(question, "Compare housing policy")
    expect(question.textContent).toBe("Compare housing policy")
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Send question" }).disabled).toBe(true)
    expect(question.getAttribute("aria-describedby")).toBe(screen.getByText("Research is not connected yet.").id)
    await user.keyboard("{Enter}")
    expect(fetchMock).not.toHaveBeenCalled()
    expect(navigation.push).not.toHaveBeenCalled()
  })

  it("puts a selected suggestion into the question and returns focus for editing", async () => {
    const user = userEvent.setup()
    const suggestion = "How do state bills address repair access for farm equipment?"
    await act(async () => {
      render(
        <HomepageLanding
          suggestions={Promise.resolve([
            { text: suggestion, description: "Compare repair access proposals", kind: "comparison" }
          ])}
        />,
        { wrapper: ChatProviders }
      )
    })
    await user.click(await screen.findByRole("button", { name: suggestion }))
    const question = screen.getByRole("textbox", { name: "Your question" })
    expect(question.textContent).toBe(suggestion)
    expect(document.activeElement).toBe(question)
    expect(navigation.push).not.toHaveBeenCalled()
  })

  it("keeps the composer usable while suggestions load and omits unavailable suggestions", async () => {
    const suggestions = Promise.withResolvers<never[]>()
    const user = userEvent.setup()
    await act(async () => {
      render(<HomepageLanding suggestions={suggestions.promise} />, { wrapper: ChatProviders })
    })
    expect(screen.getByRole("status", { name: "Loading research questions" })).toBeDefined()
    const input = await screen.findByRole("textbox", { name: "Your question" })
    await act(async () => {
      await user.type(input, "My own question")
      suggestions.resolve([])
      await suggestions.promise
    })
    await waitFor(() => expect(screen.queryByRole("status", { name: "Loading research questions" })).toBeNull())
    expect(screen.queryByLabelText("Suggested research questions")).toBeNull()
    expect(screen.getByRole("textbox", { name: "Your question" }).textContent).toBe("My own question")
  })
})
