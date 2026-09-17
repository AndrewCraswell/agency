// @vitest-environment happy-dom
import { cleanup, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { UIMessage } from "ai"
import type { ReactNode } from "react"
import invariant from "tiny-invariant"
import { StickToBottom } from "use-stick-to-bottom"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { PresentationBlock } from "../composition"
import type { EntityCard, EntityPage } from "../entityResults"
import type { EvidenceSnapshot } from "../evidence"
import type { MeetingDetails, VoteDetails } from "../recordDetails"
import { ChatProviders } from "./ChatProviders"
import type { CitationSelection } from "./citationPresentation"
import { ConversationResponse } from "./ConversationResponse"
import { EvidencePanel } from "./EvidencePanel"
import { ResearchActivity } from "./ResearchActivity"

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn<typeof import("@sentry/nextjs").captureException>() }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.restoreAllMocks()
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

const resultId = "11111111-1111-4111-8111-111111111111"
const selectedRecord: EntityCard = {
  id: "selected-bill",
  kind: "bill",
  title: "Selected published bill",
  sourceUrl: "https://publisher.example/bill",
  billSummary: { status: "In committee" },
  fields: [],
  tallies: []
}

function presentationPart(record: EntityCard = selectedRecord, blockId = "selected-record") {
  const data = {
    state: "ready",
    blockId,
    spec: {
      root: "record",
      elements: { record: { type: "RecordCard", props: { resultId, recordId: record.id }, children: [] } }
    },
    record
  } satisfies PresentationBlock
  return { type: "data-presentation", id: blockId, data } satisfies UIMessage["parts"][number]
}

function resultPart(warnings: string[] = [], toolCallId = "search-results") {
  const resultSet: EntityPage = {
    id: resultId,
    kind: "bill",
    presentation: "list",
    page: 0,
    items: [selectedRecord, { ...selectedRecord, id: "unselected", title: "Unselected search record" }],
    start: 1,
    end: 2,
    hasNext: true,
    hasPrevious: false,
    warnings
  }
  return {
    type: "dynamic-tool",
    toolCallId,
    toolName: "search_bills",
    state: "output-available",
    input: { query: "published bills" },
    output: { resultSet }
  } satisfies UIMessage["parts"][number]
}

function InlineProviders({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <ChatProviders>
      <StickToBottom initial={false} resize="instant">
        {children}
      </StickToBottom>
    </ChatProviders>
  )
}

function inlineResponse(parts: UIMessage["parts"], isRunning = false) {
  return (
    <ConversationResponse
      message={{ id: "inline-answer", role: "assistant", parts }}
      evidence={[]}
      isRunning={isRunning}
      isIncomplete={false}
      onEvidence={() => undefined}
    />
  )
}

describe("ResearchActivity details", () => {
  const bill = {
    ...selectedRecord,
    id: "bill:ca:20232024:ab:2652",
    title: "AB 2652 Artificial intelligence working group"
  }

  it("identifies the requested bill using its matching returned label", () => {
    render(
      <ResearchActivity
        isRunning={false}
        part={{
          type: "dynamic-tool",
          toolCallId: "read-bill",
          toolName: "get_bill",
          state: "output-available",
          input: { id: bill.id },
          output: { resultSet: { items: [selectedRecord, bill] } }
        }}
      />
    )
    expect(screen.getByText(bill.title)).toBeDefined()
    expect(screen.getByLabelText("Read bill: Complete")).toBeDefined()
    expect(screen.queryByText(selectedRecord.title)).toBeNull()
  })

  it.each([true, false])("keeps the requested bill visible before output with running=%s", (isRunning) => {
    render(
      <ResearchActivity
        isRunning={isRunning}
        part={{
          type: "dynamic-tool",
          toolCallId: "read-bill",
          toolName: "get_bill",
          state: "input-available",
          input: { id: bill.id }
        }}
      />
    )
    expect(screen.getByText(bill.id)).toBeDefined()
    expect(screen.getByLabelText(`Read bill: ${isRunning ? "Running" : "Interrupted"}`)).toBeDefined()
  })

  it("keeps the requested bill in failure details", () => {
    render(
      <ResearchActivity
        isRunning={false}
        part={{
          type: "dynamic-tool",
          toolCallId: "read-bill",
          toolName: "get_bill",
          state: "output-error",
          input: { id: bill.id },
          errorText: "Unable to read bill."
        }}
      />
    )
    expect(screen.getByText(bill.id)).toBeDefined()
    expect(screen.getByText("Unable to read bill.")).toBeDefined()
  })

  it("does not substitute an unrelated returned record for the requested bill", () => {
    render(
      <ResearchActivity
        isRunning={false}
        part={{
          type: "dynamic-tool",
          toolCallId: "read-bill",
          toolName: "get_bill",
          state: "output-available",
          input: { id: bill.id },
          output: { resultSet: { items: [selectedRecord] } }
        }}
      />
    )
    expect(screen.getByText(bill.id)).toBeDefined()
    expect(screen.queryByText(selectedRecord.title)).toBeNull()
  })

  it("preserves search query and result count details", () => {
    render(
      <ResearchActivity
        isRunning={false}
        part={{
          type: "dynamic-tool",
          toolCallId: "search-bills",
          toolName: "search_bills",
          state: "output-available",
          input: { query: "artificial intelligence" },
          output: { data: { items: [bill] } }
        }}
      />
    )
    expect(screen.getByText("artificial intelligence")).toBeDefined()
    expect(screen.getByText("1 returned")).toBeDefined()
  })
})

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
    expect(repeated.map((badge) => badge.textContent)).toEqual(["1"])
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

  it("keeps unknown IDs inactive and ambiguous URL aliases as ordinary links", () => {
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
    expect(screen.getByRole("button", { name: "Citation 1 unavailable" }).textContent).toBe("1")
    expect(screen.getByRole("button", { name: "Citation 1 unavailable" }).getAttribute("aria-disabled")).toBe("true")
    expect(screen.queryByRole("button", { name: /Read source/ })).toBeNull()
    expect(screen.getByRole("link", { name: "Shared document" }).getAttribute("href")).toBe(shared)
    expect(screen.getByRole("button", { name: "Sources 1" })).toBeDefined()
    expect(onEvidence).not.toHaveBeenCalled()
  })

  it("renders unmatched numeric anchors as unavailable superscripts without guessing a source", async () => {
    const user = userEvent.setup()
    const onEvidence = vi.fn<(selection: CitationSelection) => void>()
    render(
      <ConversationResponse
        message={message("[2](#citation-first) [3](#citation-unknown) [4](#citation-second)")}
        evidence={[first, second]}
        isRunning={false}
        isIncomplete={false}
        onEvidence={onEvidence}
      />,
      { wrapper: ChatProviders }
    )
    const marker = screen.getByRole("button", { name: "Citation 2 unavailable" })
    expect(marker.textContent).toBe("2")
    expect(marker.getAttribute("aria-disabled")).toBe("true")
    expect(screen.queryByText("4")).toBeNull()
    await user.hover(marker)
    expect((await screen.findByRole("tooltip")).textContent).toBe("This citation does not match a retrieved source.")
    await user.click(marker)
    expect(onEvidence).not.toHaveBeenCalled()
    await user.click(screen.getByRole("button", { name: "Sources 3" }))
    expect(
      within(screen.getByRole("region", { name: "Sources" })).getAllByRole("button", { name: /^Read source/ })
    ).toHaveLength(2)
    expect(screen.getByRole("note", { name: "Source 2 unavailable" }).textContent).toBe("2Source unavailable")
    expect(screen.getByRole("region", { name: "Sources" }).textContent).not.toContain("Unknown")
  })

  it("resolves a pending citation only when matching evidence arrives", () => {
    const onEvidence = vi.fn<(selection: CitationSelection) => void>()
    const response = (evidence: EvidenceSnapshot[], isRunning: boolean) => (
      <ConversationResponse
        message={message("[8](#citation-e1)")}
        evidence={evidence}
        isRunning={isRunning}
        isIncomplete={false}
        onEvidence={onEvidence}
      />
    )
    const view = render(response([], true), { wrapper: ChatProviders })
    expect(screen.getByRole("button", { name: "Citation 1 pending" }).textContent).toBe("1")
    expect(screen.getByRole("button", { name: "Sources 1" })).toBeDefined()
    view.rerender(response([{ ...first, citationRef: "e1" }], false))
    expect(screen.queryByRole("button", { name: "Citation 1 pending" })).toBeNull()
    expect(screen.getByRole("button", { name: "Read source 1: First provision" }).textContent).toBe("1")
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
    expect(repeated.map((badge) => badge.textContent)).toEqual(["1"])
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

describe("ConversationResponse inline composition", () => {
  it("renders prose, the selected snapshot, then prose without appending unselected result records", () => {
    render(
      inlineResponse([
        { type: "text", text: "Before the selected record." },
        resultPart(),
        presentationPart(),
        { type: "text", text: "After the selected record." }
      ]),
      { wrapper: InlineProviders }
    )
    const before = screen.getByText("Before the selected record.")
    const card = screen.getByRole("region", { name: "Bill: Selected published bill" })
    const after = screen.getByText("After the selected record.")
    expect(before.compareDocumentPosition(card)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(card.compareDocumentPosition(after)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(within(card).getByText("In committee")).toBeDefined()
    expect(screen.queryByText("Unselected search record")).toBeNull()
    expect(screen.queryByRole("heading", { name: "Bills" })).toBeNull()
    expect(screen.queryByRole("navigation", { name: /Bills in answer/ })).toBeNull()
    expect(screen.queryByRole("region", { name: "Sources" })).toBeNull()
  })

  it("retains distinct coverage warnings even without cards or valid result items", () => {
    const firstResult = resultPart(["Publisher coverage is incomplete.", "Related records were truncated."])
    const secondResult = resultPart(
      [" Publisher coverage is incomplete. ", "A source was unavailable."],
      "more-results"
    )
    render(
      inlineResponse([
        firstResult,
        {
          ...secondResult,
          output: { resultSet: { ...secondResult.output.resultSet, items: [null] } }
        },
        { type: "text", text: "A prose-only answer." }
      ]),
      { wrapper: InlineProviders }
    )
    expect(screen.getAllByText("Publisher coverage is incomplete.")).toHaveLength(1)
    expect(screen.getByText("Related records were truncated.")).toBeDefined()
    expect(screen.getByText("A source was unavailable.")).toBeDefined()
    expect(screen.queryByText(selectedRecord.title)).toBeNull()
    expect(screen.queryByText("Unselected search record")).toBeNull()
    expect(screen.getByRole("button", { name: /Research activity/ })).toBeDefined()
  })

  it("shares citation numbers and reference definitions across prose separated by a card", async () => {
    render(
      <ConversationResponse
        message={{
          id: "inline-answer",
          role: "assistant",
          parts: [
            { type: "text", text: "First claim [published][shared]." },
            presentationPart(),
            {
              type: "text",
              text: "Second claim [8](#citation-second), repeated [shared].\n\n[shared]: #citation-first"
            }
          ]
        }}
        evidence={[second, unused, first]}
        isRunning={false}
        isIncomplete={false}
        onEvidence={() => undefined}
      />,
      { wrapper: InlineProviders }
    )
    const badges = screen.getAllByRole("button", { name: "Read source 1: First provision" })
    expect(badges.map((badge) => badge.textContent)).toEqual(["1", "1"])
    expect(screen.getByRole("button", { name: "Read source 2: Second provision" }).textContent).toBe("2")
    const card = screen.getByRole("region", { name: "Bill: Selected published bill" })
    invariant(badges[0] && badges[1])
    expect(badges[0].compareDocumentPosition(card)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(card.compareDocumentPosition(badges[1])).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    await userEvent.setup().click(screen.getByRole("button", { name: /Sources/ }))
    const sources = within(screen.getByRole("region", { name: "Sources" }))
    expect(sources.getAllByRole("button", { name: /^Read source/ })).toHaveLength(2)
    expect(screen.queryByText("Unused retrieval")).toBeNull()
  })

  it("replaces a pending block in place and shows the incomplete error when a pending answer stops", () => {
    const pending: UIMessage["parts"][number] = {
      type: "data-presentation",
      id: "selected-record",
      data: { state: "pending", blockId: "selected-record" }
    }
    const view = render(inlineResponse([pending], true), { wrapper: InlineProviders })
    expect(screen.getByText("Loading record...").tagName).toBe("OUTPUT")
    view.rerender(inlineResponse([pending, presentationPart()], true))
    expect(screen.queryByText("Loading record...")).toBeNull()
    expect(screen.getAllByRole("region", { name: "Bill: Selected published bill" })).toHaveLength(1)
    view.rerender(inlineResponse([pending]))
    expect(screen.getByText("This record could not be displayed.")).toBeDefined()
    expect(screen.queryByText("Loading record...")).toBeNull()
    expect(screen.queryByText(selectedRecord.title)).toBeNull()
  })

  it("keeps a vote drawer open through duplicate-ID snapshot updates and restores focus to the same trigger", async () => {
    const vote: EntityCard = { ...selectedRecord, id: "selected-vote", kind: "vote", title: "Selected vote" }
    const details: VoteDetails = { record: vote, hasCompleteTally: false, positions: [] }
    const fetchDetails = vi.spyOn(globalThis, "fetch").mockImplementation(async () => Response.json(details))
    const parts: UIMessage["parts"] = [
      { type: "text", text: "Before the vote." },
      presentationPart(vote),
      { type: "text", text: "After the vote." }
    ]
    const user = userEvent.setup()
    const view = render(inlineResponse(parts, true), { wrapper: InlineProviders })
    const trigger = screen.getByRole("button", { name: "Selected vote" })
    await user.click(trigger)
    const dialog = await screen.findByRole("dialog", { name: "Vote details" })
    await within(dialog).findByRole("heading", { name: "Selected vote" })
    const callsBeforeUpdate = fetchDetails.mock.calls.length
    view.rerender(inlineResponse([...parts, presentationPart({ ...vote, title: "Updated vote label" })]))
    expect(screen.getByRole("dialog", { name: "Vote details" })).toBe(dialog)
    expect(within(dialog).getByRole("heading", { name: "Selected vote" })).toBeDefined()
    expect(fetchDetails.mock.calls).toHaveLength(callsBeforeUpdate)
    await user.keyboard("{Escape}")
    await waitFor(() => expect(document.activeElement).toBe(trigger))
    expect(screen.getByRole("button", { name: "Updated vote label" })).toBe(trigger)
    expect(screen.getAllByRole("region", { name: "Vote: Updated vote label" })).toHaveLength(1)
    const before = screen.getByText("Before the vote.")
    const after = screen.getByText("After the vote.")
    expect(before.compareDocumentPosition(trigger)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(trigger.compareDocumentPosition(after)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })

  it("opens only the selected meeting from a shared result set and restores keyboard focus", async () => {
    const meeting: EntityCard = {
      ...selectedRecord,
      id: "selected-meeting",
      kind: "meeting",
      title: "Selected meeting"
    }
    const details: MeetingDetails = { record: meeting, agenda: [], participants: [], documents: [] }
    const fetchDetails = vi.spyOn(globalThis, "fetch").mockImplementation(async () => Response.json(details))
    const user = userEvent.setup()
    render(
      inlineResponse([
        presentationPart({ ...meeting, id: "another-meeting", title: "Another meeting" }, "another-block"),
        presentationPart(meeting)
      ]),
      { wrapper: InlineProviders }
    )
    const trigger = screen.getByRole("button", { name: "Selected meeting" })
    trigger.focus()
    await user.keyboard("{Enter}")
    const dialog = await screen.findByRole("dialog", { name: "Meeting" })
    await within(dialog).findByRole("heading", { name: "Selected meeting" })
    expect(screen.getAllByRole("dialog")).toHaveLength(1)
    for (const [, options] of fetchDetails.mock.calls) {
      expect(options?.body).toEqual(expect.stringContaining('"recordId":"selected-meeting"'))
    }
    await user.keyboard("{Escape}")
    await waitFor(() => expect(document.activeElement).toBe(trigger))
  })

  it.each(["person", "organization", "material"] as const)("preserves the trusted %s profile route", (kind) => {
    const record: EntityCard = { ...selectedRecord, kind, id: "record/with spaces" }
    render(inlineResponse([presentationPart(record)]), { wrapper: InlineProviders })
    expect(screen.getByRole("link", { name: record.title }).getAttribute("href")).toBe(
      `/records/${kind}/record%2Fwith%20spaces?result=${resultId}`
    )
  })

  it("ignores unknown data parts without inventing visible records or sources", () => {
    render(
      inlineResponse([
        { type: "data-unrecognized", data: { record: selectedRecord, evidence: [first] } },
        { type: "text", text: "Prose remains visible." }
      ]),
      { wrapper: InlineProviders }
    )
    expect(screen.getByText("Prose remains visible.")).toBeDefined()
    expect(screen.queryByText(selectedRecord.title)).toBeNull()
    expect(screen.queryByText("This record could not be displayed.")).toBeNull()
    expect(screen.queryByRole("region", { name: "Sources" })).toBeNull()
  })

  const ready = presentationPart()
  const invalidParts: { name: string; part: UIMessage["parts"][number] }[] = [
    { name: "missing transport ID", part: { type: "data-presentation", data: ready.data } },
    { name: "mismatched transport ID", part: { ...ready, id: "another-block" } },
    { name: "missing payload", part: { ...ready, data: undefined } },
    { name: "missing record", part: { ...ready, data: { ...ready.data, record: undefined } } },
    {
      name: "mismatched record",
      part: { ...ready, data: { ...ready.data, record: { ...selectedRecord, id: "other" } } }
    },
    { name: "unknown block state", part: { ...ready, data: { state: "unknown", blockId: ready.id } } },
    { name: "explicit error", part: { ...ready, data: { state: "error", blockId: ready.id } } },
    {
      name: "missing root element",
      part: { ...ready, data: { ...ready.data, spec: { root: "absent", elements: {} } } }
    },
    {
      name: "unknown component",
      part: {
        ...ready,
        data: { ...ready.data, spec: { ...ready.data.spec, elements: { record: { type: "Unknown" } } } }
      }
    },
    {
      name: "model display fields",
      part: {
        ...ready,
        data: {
          ...ready.data,
          spec: {
            ...ready.data.spec,
            elements: {
              record: {
                ...ready.data.spec.elements.record,
                props: { resultId, recordId: selectedRecord.id, title: "Model display title" }
              }
            }
          }
        }
      }
    },
    {
      name: "generic state",
      part: { ...ready, data: { ...ready.data, spec: { ...ready.data.spec, state: { record: selectedRecord } } } }
    },
    {
      name: "model actions",
      part: {
        ...ready,
        data: {
          ...ready.data,
          spec: {
            ...ready.data.spec,
            elements: { record: { ...ready.data.spec.elements.record, on: { press: { action: "navigate" } } } }
          }
        }
      }
    },
    {
      name: "dynamic bindings",
      part: {
        ...ready,
        data: {
          ...ready.data,
          spec: {
            ...ready.data.spec,
            elements: {
              record: {
                ...ready.data.spec.elements.record,
                props: { resultId, recordId: { $state: "/record/id" } }
              }
            }
          }
        }
      }
    }
  ]

  it.each(invalidParts)("bounds $name without displaying a bogus record or source", ({ part }) => {
    render(inlineResponse([part], true), { wrapper: InlineProviders })
    expect(screen.getAllByText("This record could not be displayed.")).toHaveLength(1)
    expect(screen.queryByText(selectedRecord.title)).toBeNull()
    expect(screen.queryByText("Model display title")).toBeNull()
    expect(screen.queryByRole("button", { name: /Read source/ })).toBeNull()
    expect(screen.queryByRole("region", { name: "Sources" })).toBeNull()
  })
})
