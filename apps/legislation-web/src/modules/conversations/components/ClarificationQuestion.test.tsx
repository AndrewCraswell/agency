// @vitest-environment happy-dom
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { clarificationRequestSchema, type ClarificationResponse } from "../clarification"
import { ClarificationQuestion } from "./ClarificationQuestion"

const request = clarificationRequestSchema.parse({
  id: "2f1b652a-b068-4c44-bb0a-daf032ab958e",
  revision: 1,
  state: "pending",
  input: {
    kind: "single",
    question: "Which jurisdiction?",
    allowSkip: true,
    allowFreeText: true,
    options: [
      { id: "wa", label: "Washington", description: "Washington State Legislature" },
      { id: "co", label: "Colorado", description: "Colorado General Assembly" }
    ]
  }
})

afterEach(cleanup)

describe("ClarificationQuestion", () => {
  it("requires explicit submission and shows the accepted answer", async () => {
    const user = userEvent.setup()
    const onAnswer = vi.fn<(response: ClarificationResponse) => Promise<void>>().mockResolvedValue()
    render(<ClarificationQuestion request={request} onAnswer={onAnswer} />)
    expect(screen.getByRole("radio", { name: "Washington" }).getAttribute("data-state")).toBe("unchecked")
    await user.click(screen.getByRole("radio", { name: "Washington" }))
    expect(onAnswer).not.toHaveBeenCalled()
    await user.click(screen.getByRole("button", { name: "Continue" }))
    await waitFor(() =>
      expect(onAnswer).toHaveBeenCalledExactlyOnceWith({
        requestId: request.id,
        revision: 1,
        status: "answered",
        selectedIds: ["wa"],
        text: ""
      })
    )
    expect(await screen.findByText("Answered")).toBeDefined()
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: request.input.question }))
    expect(screen.queryByRole("button", { name: "Continue" })).toBeNull()
  })

  it("shows a validation error rather than sending an empty response", async () => {
    const user = userEvent.setup()
    const onAnswer = vi.fn<(response: ClarificationResponse) => Promise<void>>()
    render(<ClarificationQuestion request={request} onAnswer={onAnswer} />)
    await user.click(screen.getByRole("button", { name: "Continue" }))
    expect((await screen.findByRole("alert")).textContent).toBe("Choose one option.")
    expect(onAnswer).not.toHaveBeenCalled()
  })

  it("validates multiple choices before submitting", async () => {
    const user = userEvent.setup()
    const onAnswer = vi.fn<(response: ClarificationResponse) => Promise<void>>().mockResolvedValue()
    const multiple = clarificationRequestSchema.parse({
      ...request,
      input: { ...request.input, kind: "multiple", minSelections: 2, maxSelections: 2 }
    })
    render(<ClarificationQuestion request={multiple} onAnswer={onAnswer} />)
    await user.click(screen.getByRole("checkbox", { name: "Washington" }))
    await user.click(screen.getByRole("button", { name: "Continue" }))
    expect(onAnswer).not.toHaveBeenCalled()
    await user.click(screen.getByRole("checkbox", { name: "Colorado" }))
    await user.click(screen.getByRole("button", { name: "Continue" }))
    await waitFor(() => expect(onAnswer).toHaveBeenCalledTimes(1))
    expect(onAnswer.mock.calls[0]?.[0]).toMatchObject({ selectedIds: ["wa", "co"] })
  })

  it("preserves free text after failure and allows retry", async () => {
    const user = userEvent.setup()
    const onAnswer = vi
      .fn<(response: ClarificationResponse) => Promise<void>>()
      .mockRejectedValueOnce(new Error("Private provider detail"))
      .mockResolvedValue()
    const text = clarificationRequestSchema.parse({
      ...request,
      input: { kind: "text", question: "What is your research goal?", allowSkip: false }
    })
    render(<ClarificationQuestion request={text} onAnswer={onAnswer} />)
    await user.type(screen.getByRole("textbox", { name: "Your answer" }), "Housing affordability")
    await user.click(screen.getByRole("button", { name: "Continue" }))
    expect((await screen.findByRole("alert")).textContent).toBe("Your answer could not be confirmed. Try again.")
    expect(screen.queryByText("Private provider detail")).toBeNull()
    expect(screen.getByRole<HTMLTextAreaElement>("textbox").value).toBe("Housing affordability")
    await user.click(screen.getByRole("button", { name: "Continue" }))
    expect(await screen.findByText("Answered")).toBeDefined()
    expect(onAnswer).toHaveBeenCalledTimes(2)
  })

  it("submits a permitted skip without the draft answer", async () => {
    const user = userEvent.setup()
    const onAnswer = vi.fn<(response: ClarificationResponse) => Promise<void>>().mockResolvedValue()
    render(<ClarificationQuestion request={request} onAnswer={onAnswer} />)
    await user.type(screen.getByRole("textbox"), "Unsent draft")
    await user.click(screen.getByRole("button", { name: "Skip" }))
    await waitFor(() =>
      expect(onAnswer).toHaveBeenCalledExactlyOnceWith({ requestId: request.id, revision: 1, status: "skipped" })
    )
    expect(await screen.findByText("Skipped")).toBeDefined()
  })

  it("does not submit twice while the first answer is pending", async () => {
    const user = userEvent.setup()
    const pending = Promise.withResolvers<void>()
    const onAnswer = vi.fn<(response: ClarificationResponse) => Promise<void>>().mockReturnValue(pending.promise)
    render(<ClarificationQuestion request={request} onAnswer={onAnswer} />)
    await user.click(screen.getByRole("radio", { name: "Washington" }))
    await user.dblClick(screen.getByRole("button", { name: "Continue" }))
    expect(onAnswer).toHaveBeenCalledTimes(1)
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Submitting" }).closest("fieldset")?.disabled).toBe(
      true
    )
    pending.resolve()
    expect(await screen.findByText("Answered")).toBeDefined()
  })

  it("clears the draft when the question revision changes", async () => {
    const user = userEvent.setup()
    const onAnswer = vi.fn<(response: ClarificationResponse) => Promise<void>>()
    const { rerender } = render(<ClarificationQuestion request={request} onAnswer={onAnswer} />)
    await user.click(screen.getByRole("radio", { name: "Washington" }))
    await user.type(screen.getByRole("textbox"), "Draft")
    rerender(<ClarificationQuestion request={{ ...request, revision: 2 }} onAnswer={onAnswer} />)
    expect(screen.getByRole<HTMLTextAreaElement>("textbox").value).toBe("")
    expect(screen.getByRole("radio", { name: "Washington" }).getAttribute("data-state")).toBe("unchecked")
  })

  it.each(["expired", "superseded", "answered", "skipped"])("does not offer input for a %s question", (state) => {
    const inactive = clarificationRequestSchema.parse({ ...request, state })
    render(
      <ClarificationQuestion
        request={inactive}
        onAnswer={vi.fn<(response: ClarificationResponse) => Promise<void>>()}
      />
    )
    expect(screen.queryByRole("textbox")).toBeNull()
    expect(screen.queryByRole("button")).toBeNull()
  })
})
