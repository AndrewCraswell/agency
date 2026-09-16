// @vitest-environment happy-dom
import { cleanup, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ResultExpiredError } from "../../lib/entityResults"
import type { VoteDetails as VoteDetailsData } from "../../lib/recordDetails"
import { VoteDetails } from "./VoteDetails"

const session = vi.hoisted(() => ({
  loadVoteDetails: vi.fn<(resultId: string, recordId: string, signal: AbortSignal) => Promise<VoteDetailsData>>()
}))
vi.mock("./ConversationSession", () => ({ useConversationSession: () => session }))

afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})

const selection = { resultId: "result-check", recordId: "vote-check" }
const details: VoteDetailsData = {
  record: { id: "vote-check", kind: "vote", title: "Published motion", sourceUrl: null, fields: [], tallies: [] },
  hasCompleteTally: false,
  positions: []
}

describe("VoteDetails recovery", () => {
  it("focuses expiry guidance and offers close instead of an ineffective retry", async () => {
    session.loadVoteDetails.mockRejectedValue(new ResultExpiredError())
    const onClose = vi.fn<() => void>()
    render(<VoteDetails selection={selection} onClose={onClose} returnFocus={() => undefined} />)
    const notice = await screen.findByRole("alert")
    expect(notice.textContent).toContain("This result has expired")
    await waitFor(() => expect(document.activeElement).toBe(notice))
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull()
    await userEvent.setup().click(within(notice).getByRole("button", { name: /^Close$/ }))
    expect(onClose).toHaveBeenCalledOnce()
    expect(session.loadVoteDetails).toHaveBeenCalledOnce()
  })

  it("retries a temporary failure without displaying raw error details", async () => {
    session.loadVoteDetails
      .mockRejectedValueOnce(new Error("private upstream diagnostic"))
      .mockResolvedValueOnce(details)
    render(<VoteDetails selection={selection} onClose={() => undefined} returnFocus={() => undefined} />)
    const notice = await screen.findByRole("alert")
    expect(notice.textContent).not.toContain("private upstream diagnostic")
    await userEvent.setup().click(within(notice).getByRole("button", { name: "Try again" }))
    await screen.findByRole("heading", { name: "Published motion" })
    expect(screen.queryByRole("alert")).toBeNull()
    expect(session.loadVoteDetails).toHaveBeenCalledTimes(2)
  })

  it("aborts when closed and ignores a late response", async () => {
    const pending = Promise.withResolvers<VoteDetailsData>()
    session.loadVoteDetails.mockReturnValue(pending.promise)
    const view = render(<VoteDetails selection={selection} onClose={() => undefined} returnFocus={() => undefined} />)
    expect(screen.getByRole("status").textContent).toContain("Loading vote details")
    await waitFor(() => expect(session.loadVoteDetails).toHaveBeenCalledOnce())
    const signal = session.loadVoteDetails.mock.calls[0]?.[2]
    view.rerender(<VoteDetails selection={undefined} onClose={() => undefined} returnFocus={() => undefined} />)
    expect(signal?.aborted).toBe(true)
    pending.resolve(details)
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(screen.queryByRole("heading", { name: "Published motion" })).toBeNull()
  })
})
