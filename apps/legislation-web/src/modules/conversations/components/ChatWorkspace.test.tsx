// @vitest-environment happy-dom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ChatProviders } from "./ChatProviders"
import { ChatWorkspace } from "./ChatWorkspace"
import * as composerStyles from "./ChatComposer.css"

const navigation = vi.hoisted(() => ({ push: vi.fn<(url: string) => void>() }))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

vi.mock("next/navigation", () => ({ useRouter: () => navigation }))
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn<typeof import("@sentry/nextjs").captureException>() }))

function streamedAnswer(text: string) {
  const chunks = [
    { type: "start", messageId: crypto.randomUUID() },
    { type: "text-start", id: "answer" },
    { type: "text-delta", id: "answer", delta: text },
    { type: "text-end", id: "answer" },
    { type: "finish" }
  ]
  return new Response(chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("") + "data: [DONE]\n\n", {
    headers: { "content-type": "text/event-stream", "x-vercel-ai-ui-message-stream": "v1" }
  })
}

describe("ChatWorkspace", () => {
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
    const view = render(<ChatWorkspace isAvailable />, { wrapper: ChatProviders })
    await user.type(screen.getByRole("textbox", { name: "Your question" }), "A streamed question")
    await user.click(screen.getByRole("button", { name: "Send question" }))
    await waitFor(() => expect(navigation.push).toHaveBeenCalledTimes(1))
    const conversationId = navigation.push.mock.calls[0]?.[0].split("/").at(-1)
    view.rerender(<ChatWorkspace key={conversationId} isAvailable conversationId={conversationId} />)

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
    const view = render(<ChatWorkspace isAvailable />, { wrapper: ChatProviders })
    const field = screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Your question" })
    expect(field.closest("form")?.classList.contains(composerStyles.homepageGlow)).toBe(true)
    await user.type(field, "First question")
    await user.click(screen.getByRole("button", { name: "Send question" }))
    await waitFor(() => expect(navigation.push).toHaveBeenCalledTimes(1))
    const path = navigation.push.mock.calls[0]?.[0]
    expect(path).toMatch(/^\/conversations\/[^/]+$/)
    const conversationId = path?.split("/").at(-1)
    view.rerender(<ChatWorkspace key={conversationId} isAvailable conversationId={conversationId} />)
    await screen.findByText("A retained response")
    expect(screen.getByText("First question")).toBeDefined()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const followUp = screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Your question" })
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

  it("keeps the demo question editable without enabling disconnected research", async () => {
    const user = userEvent.setup()
    render(<ChatWorkspace />, { wrapper: ChatProviders })
    const question = screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Your question" })
    await user.type(question, "Compare housing policy")
    expect(question.value).toBe("Compare housing policy")
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Send question" }).disabled).toBe(true)
    expect(screen.getByRole("status").textContent).toBe("Research is not connected yet.")
  })

  it("puts a selected suggestion into the question and returns focus for editing", async () => {
    const user = userEvent.setup()
    render(<ChatWorkspace />, { wrapper: ChatProviders })
    const suggestion = "Who has sponsored bills on AI in education?"
    await user.click(screen.getByRole("button", { name: suggestion }))
    const question = screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Your question" })
    expect(question.value).toBe(suggestion)
    expect(document.activeElement).toBe(question)
  })
})
