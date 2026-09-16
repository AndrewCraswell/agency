// @vitest-environment happy-dom
import { cleanup, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { UIMessage } from "ai"
import invariant from "tiny-invariant"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { EvidenceSnapshot } from "../evidence"
import { ChatProviders } from "./ChatProviders"
import type { CitationSelection } from "./citationPresentation"
import { ConversationResponse } from "./ConversationResponse"
import { EvidencePanel } from "./EvidencePanel"

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn<typeof import("@sentry/nextjs").captureException>() }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const first: EvidenceSnapshot = {
  id: "first",
  title: "First provision",
  origin: "canonical",
  sourceUrl: "https://publisher.example/first.xml",
  readableUrl: "https://publisher.example/first.pdf",
  publisher: "Published record",
  versionLabel: "Introduced",
  locator: "Section 2",
  content: { state: "available", quote: "The exact supporting passage." }
}
const second: EvidenceSnapshot = {
  id: "second",
  title: "Second provision",
  origin: "canonical",
  sourceUrl: "https://publisher.example/second",
  content: { state: "not-collected" }
}
const unused: EvidenceSnapshot = { ...second, id: "unused", title: "Unused retrieval" }

function message(text: string, id = "answer"): UIMessage {
  return { id, role: "assistant", parts: [{ type: "text", text }] }
}

describe("ConversationResponse citations", () => {
  it("shares application numbers across repeated badges, cited-only rows and selection", async () => {
    const user = userEvent.setup()
    const onEvidence = vi.fn<(selection: CitationSelection) => void>()
    render(
      <ConversationResponse
        message={message("[99](#citation-second) [7](#citation-first) [88](#citation-second)")}
        evidence={[first, unused, second]}
        isRunning={false}
        isIncomplete={false}
        onEvidence={onEvidence}
      />,
      { wrapper: ChatProviders }
    )
    const repeated = screen.getAllByRole("button", { name: "Read source 1: Second provision" })
    expect(repeated.slice(0, 2).map((badge) => badge.textContent)).toEqual(["1", "1"])
    expect(screen.getAllByRole("button", { name: "Read source 2: First provision" })[0]?.textContent).toBe("2")
    const sources = within(screen.getByRole("region", { name: "Sources" }))
    const sourcesToggle = sources.getByRole("button", { name: /Sources/ })
    expect(sourcesToggle.getAttribute("aria-expanded")).toBe("false")
    expect(within(sourcesToggle).getByText("2")).toBeDefined()
    await user.click(sourcesToggle)
    const rows = sources.getAllByRole("button", { name: /^Read source/ })
    expect(rows.map((row) => row.getAttribute("aria-label"))).toEqual([
      "Read source 1: Second provision",
      "Read source 2: First provision"
    ])
    expect(screen.queryByText("Unused retrieval")).toBeNull()
    expect(screen.queryByText("Retrieved sources")).toBeNull()
    expect(screen.queryByText("99")).toBeNull()
    const firstBadge = repeated[0]
    invariant(firstBadge)
    await user.click(firstBadge)
    expect(onEvidence).toHaveBeenLastCalledWith({ answerId: "answer", number: 1, evidence: second })
    await user.click(
      within(screen.getByRole("region", { name: "Sources" })).getByRole("button", {
        name: "Read source 1: Second provision"
      })
    )
    expect(onEvidence).toHaveBeenLastCalledWith({ answerId: "answer", number: 1, evidence: second })
  })

  it.each([
    { interaction: "hover", evidence: first, expectedUrl: first.readableUrl },
    { interaction: "focus", evidence: first, expectedUrl: first.readableUrl },
    { interaction: "hover", evidence: { ...first, readableUrl: undefined }, expectedUrl: first.sourceUrl }
  ])("resolves $expectedUrl on $interaction", async ({ interaction, evidence, expectedUrl }) => {
    const user = userEvent.setup()
    const onEvidence = vi.fn<(selection: CitationSelection) => void>()
    const onClose = vi.fn<() => void>()
    const returnFocus = vi.fn<() => void>()
    render(
      <ConversationResponse
        message={message("[model label](#citation-first)")}
        evidence={[evidence]}
        isRunning={false}
        isIncomplete={false}
        onEvidence={onEvidence}
      />,
      { wrapper: ChatProviders }
    )
    const badge = screen.getAllByRole("button", { name: "Read source 1: First provision" })[0]
    invariant(badge)
    if (interaction === "hover") {
      await user.hover(badge)
    } else {
      await user.tab()
    }
    expect(document.activeElement === badge).toBe(interaction === "focus")
    expect((await screen.findByRole("tooltip")).textContent).toBe(expectedUrl)
    if (interaction === "focus") {
      await user.keyboard("{Enter}")
    } else {
      await user.click(badge)
    }
    const selection = onEvidence.mock.calls.at(-1)?.[0]
    expect(selection).toEqual({ answerId: "answer", number: 1, evidence })
    const panel = render(<EvidencePanel selection={selection} onClose={onClose} returnFocus={returnFocus} />)
    const dialog = await screen.findByRole("dialog", { name: "Source 1" })
    expect(within(dialog).getByRole("link", { name: "Open source" }).getAttribute("href")).toBe(expectedUrl)
    expect(within(dialog).getByText("The exact supporting passage.")).toBeDefined()
    expect(within(dialog).getByText("Introduced")).toBeDefined()
    expect(within(dialog).getByText("Section 2")).toBeDefined()
    expect(selection?.evidence.sourceUrl).toBe(evidence.sourceUrl)
    await user.click(within(dialog).getByRole("button", { name: "Close evidence" }))
    expect(onClose).toHaveBeenCalledOnce()
    panel.rerender(<EvidencePanel selection={undefined} onClose={onClose} returnFocus={returnFocus} />)
    await waitFor(() => expect(returnFocus).toHaveBeenCalledOnce())
  })

  it("keeps unknown IDs inactive and ambiguous URL aliases as ordinary links without source rows", () => {
    const onEvidence = vi.fn<(selection: CitationSelection) => void>()
    const shared = "https://publisher.example/shared"
    render(
      <ConversationResponse
        message={message(`[unknown](#citation-foreign) [Shared document](${shared})`)}
        evidence={[
          { ...first, sourceUrl: shared, readableUrl: undefined },
          { ...second, sourceUrl: shared }
        ]}
        isRunning={false}
        isIncomplete={false}
        onEvidence={onEvidence}
      />,
      { wrapper: ChatProviders }
    )
    expect(screen.getByText("unknown").tagName).toBe("SPAN")
    expect(screen.queryByRole("button", { name: /Read source/ })).toBeNull()
    expect(screen.getByRole("link", { name: "Shared document" }).getAttribute("href")).toBe(shared)
    expect(screen.queryByRole("region", { name: "Sources" })).toBeNull()
    expect(onEvidence).not.toHaveBeenCalled()
  })

  it("retains earlier numbers when streaming resolves an earlier reference and resets for another answer", () => {
    const onEvidence = vi.fn<(selection: CitationSelection) => void>()
    const evidence = [first, second]
    const view = render(
      <ConversationResponse
        message={message("[later] [99](#citation-second)")}
        evidence={evidence}
        isRunning
        isIncomplete={false}
        onEvidence={onEvidence}
      />,
      { wrapper: ChatProviders }
    )
    view.rerender(
      <ConversationResponse
        message={message("[later] [99](#citation-second) [88](#citation-second)\n\n[later]: #citation-first")}
        evidence={[...evidence]}
        isRunning={false}
        isIncomplete={false}
        onEvidence={onEvidence}
      />
    )
    const repeated = screen.getAllByRole("button", { name: "Read source 1: Second provision" })
    expect(repeated.slice(0, 2).map((badge) => badge.textContent)).toEqual(["1", "1"])
    expect(screen.getAllByRole("button", { name: "Read source 2: First provision" })[0]?.textContent).toBe("2")
    view.rerender(
      <ConversationResponse
        message={message("[9](#citation-first)", "another-answer")}
        evidence={evidence}
        isRunning={false}
        isIncomplete={false}
        onEvidence={onEvidence}
      />
    )
    expect(screen.getAllByRole("button", { name: "Read source 1: First provision" })[0]?.textContent).toBe("1")
    expect(screen.queryByRole("button", { name: /Read source 2/ })).toBeNull()
  })

  it("keeps a cited source with no safe URL inspectable without inventing a tooltip or external link", async () => {
    const user = userEvent.setup()
    const onEvidence = vi.fn<(selection: CitationSelection) => void>()
    const evidence: EvidenceSnapshot = { ...second, sourceUrl: null }
    render(
      <ConversationResponse
        message={message("[9](#citation-second)")}
        evidence={[evidence]}
        isRunning={false}
        isIncomplete={false}
        onEvidence={onEvidence}
      />,
      { wrapper: ChatProviders }
    )
    await user.tab()
    expect(screen.queryByRole("tooltip")).toBeNull()
    await user.keyboard("{Enter}")
    const selection = onEvidence.mock.calls.at(-1)?.[0]
    expect(selection).toEqual({ answerId: "answer", number: 1, evidence })
    render(<EvidencePanel selection={selection} onClose={() => undefined} returnFocus={() => undefined} />)
    const dialog = await screen.findByRole("dialog", { name: "Source 1" })
    expect(within(dialog).queryByRole("link", { name: "Open source" })).toBeNull()
    expect(within(dialog).getByText("Source unavailable")).toBeDefined()
    expect(within(dialog).getByText("No passage was retrieved for this source.")).toBeDefined()
  })
})
