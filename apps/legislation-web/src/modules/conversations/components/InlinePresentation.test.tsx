// @vitest-environment happy-dom
import { cleanup, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { UIMessage } from "ai"
import { StickToBottom } from "use-stick-to-bottom"
import { afterEach, expect, it, vi } from "vitest"
import { presentationBlockSchema } from "../composition"
import type { EvidenceSnapshot } from "../evidence"
import type { ContentComponent, PresentationContent } from "../presentationContent"
import { ChatProviders } from "./ChatProviders"
import type { CitationSelection } from "./citationPresentation"
import { ConversationResponse } from "./ConversationResponse"
import { CompactRecordCard, RecordCard, recordHref } from "./EntityResults"
import { InlinePresentation } from "./InlinePresentation"

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn<typeof import("@sentry/nextjs").captureException>() }))
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
const source: EvidenceSnapshot = {
  id: "exact-source",
  citationRef: "e1",
  title: "Retrieved bill text",
  origin: "canonical",
  recordId: "document-one",
  sourceUrl: "https://example.org/version.pdf",
  publisher: "Publisher",
  versionLabel: "Introduced",
  locator: "Section 2",
  content: { state: "available", quote: "Exact words.\n".repeat(140) }
}
const content: PresentationContent = { id: "33333333-3333-4333-8333-333333333333", kind: "evidence", evidence: source }

it.each(["full", "compact"])("opens human bill pages from %s GovInfo cards", (variant) => {
  const Card = variant === "full" ? RecordCard : CompactRecordCard
  const record = {
    id: "bill:us:116:hr:5826",
    kind: "bill" as const,
    title: "HR 5826",
    fields: [],
    tallies: [],
    sourceUrl: "https://www.govinfo.gov/bulkdata/BILLSTATUS/116/hr/BILLSTATUS-116hr5826.xml"
  }
  render(<Card record={record} resultId="result" onOpenVote={() => undefined} />)
  const links = screen.getAllByRole("link")
  expect(links.length).toBeGreaterThan(0)
  for (const link of links) {
    expect(link.getAttribute("href")).toBe("https://www.congress.gov/bill/116th-congress/house-bill/5826")
    expect(link.getAttribute("target")).toBe("_blank")
  }
  expect(record.sourceUrl).toContain(".xml")
})

it.each(["full", "compact"])("keeps %s unknown XML document cards non-navigable", (variant) => {
  const Card = variant === "full" ? RecordCard : CompactRecordCard
  render(
    <Card
      record={{
        id: "document:one",
        kind: "document",
        title: "Version",
        fields: [],
        tallies: [],
        sourceUrl: "https://example.org/version.xml"
      }}
      resultId="result"
      onOpenVote={() => undefined}
    />
  )
  expect(screen.queryByRole("link")).toBeNull()
})

it("uses the document's retained readable rendition instead of its raw provenance", () => {
  render(
    <RecordCard
      record={{
        id: "document:one",
        kind: "document",
        title: "Version",
        fields: [],
        tallies: [],
        sourceUrl: "https://example.org/version.xml",
        readableUrl: "https://example.org/version.pdf"
      }}
      resultId="result"
      onOpenVote={() => undefined}
    />
  )
  expect(screen.getByRole("link", { name: "Open in reader" }).getAttribute("href")).toBe(
    "https://example.org/version.pdf"
  )
})

it.each(["CitationCard", "PassageQuote"] as const)("does not offer raw XML from %s", (variant) => {
  show({ ...content, evidence: { ...source, sourceUrl: "https://example.org/version.xml" } }, variant)
  expect(screen.queryByRole("link", { name: "Read in full" })).toBeNull()
})

it("renders the bill progress identity, milestones and actions without invented progress", () => {
  show(
    {
      id: content.id,
      kind: "bill-progress",
      resultId: "11111111-1111-4111-8111-111111111111",
      record: {
        id: "bill:one",
        kind: "bill",
        title: "HB 1 Housing",
        identifier: "HB 1",
        sourceUrl: "https://api.congress.gov/v3/bill/119/hr/1?format=json",
        fields: [],
        tallies: []
      },
      stages: [
        { id: "introduced", label: "Introduced", state: "recorded", date: "2025-01-01" },
        { id: "committee", label: "Committee", state: "current", date: "2025-01-02" },
        { id: "floor", label: "House floor", state: "unknown" }
      ],
      hasMore: false
    },
    "BillProgressCard"
  )
  const region = screen.getByRole("region", { name: "Bill milestones" })
  expect(within(region).getAllByRole("listitem")).toHaveLength(3)
  expect(region.querySelector('[aria-current="step"]')?.textContent).toContain("Committee")
  expect(within(region).getByText("Not recorded")).toBeDefined()
  expect(screen.queryByText("Not reached")).toBeNull()
  const open = screen.getByRole("link", { name: "Open" })
  expect(open.getAttribute("href")).toBe("https://www.congress.gov/bill/119th-congress/house-bill/1")
  expect(open.getAttribute("target")).toBe("_blank")
  expect(open.getAttribute("rel")).toBe("noopener noreferrer")
})

it.each([
  ["119/hr/1", "119th-congress/house-bill/1"],
  ["121/s/2", "121st-congress/senate-bill/2"],
  ["122/hjres/3", "122nd-congress/house-joint-resolution/3"],
  ["123/sjres/4", "123rd-congress/senate-joint-resolution/4"],
  ["111/hconres/5", "111th-congress/house-concurrent-resolution/5"],
  ["112/sconres/6", "112th-congress/senate-concurrent-resolution/6"],
  ["113/hres/7", "113th-congress/house-resolution/7"],
  ["119/sres/8", "119th-congress/senate-resolution/8"]
])("opens the human-readable Congress bill page for %s without changing provenance", (apiPath, publicPath) => {
  const record = {
    id: "bill:one",
    kind: "bill" as const,
    title: "Bill",
    fields: [],
    tallies: [],
    sourceUrl: `https://api.congress.gov/v3/bill/${apiPath}?format=json`
  }
  expect(recordHref(record, "result")).toBe(`https://www.congress.gov/bill/${publicPath}`)
  expect(record.sourceUrl).toBe(`https://api.congress.gov/v3/bill/${apiPath}?format=json`)
})

it.each([
  "https://example.org/v3/bill/119/hr/1",
  "https://www.congress.gov/bill/119th-congress/house-bill/1",
  "https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202320240AB2652"
])("preserves other bill source destinations: %s", (sourceUrl) => {
  expect(
    recordHref({ id: "bill:one", kind: "bill", title: "Bill", sourceUrl, fields: [], tallies: [] }, "result")
  ).toBe(sourceUrl)
})

it.each([
  "https://api.congress.gov.example.org/v3/bill/119/hr/1",
  "https://api.congress.gov/v3/bill/119/hr/1/actions",
  "https://api.congress.gov/v3/bill/119/unknown/1",
  "https://publisher.example/bill.xml"
])("does not expose machine-only record navigation: %s", (sourceUrl) => {
  expect(
    recordHref({ id: "bill:one", kind: "bill", title: "Bill", sourceUrl, fields: [], tallies: [] }, "result")
  ).toBeUndefined()
})

function part(value: PresentationContent, component: ContentComponent): UIMessage["parts"][number] {
  const data = presentationBlockSchema.parse({
    state: "ready",
    blockId: "view",
    records: [],
    content: value,
    spec: { root: "view", elements: { view: { type: component, props: { contentId: value.id }, children: [] } } }
  })
  return { type: "data-presentation", id: data.blockId, data }
}
function show(value: PresentationContent, component: ContentComponent) {
  const onEvidence = vi.fn<(selection: CitationSelection) => void>()
  render(
    <ChatProviders>
      <StickToBottom initial={false}>
        <ConversationResponse
          message={{
            id: "answer",
            role: "assistant",
            parts: [part(value, component), { type: "text", text: "Supporting claim [1](#citation-e1)." }]
          }}
          isRunning={false}
          isIncomplete={false}
          evidence={value.kind === "evidence" ? [value.evidence] : []}
          onEvidence={onEvidence}
        />
      </StickToBottom>
    </ChatProviders>
  )
  return onEvidence
}

it.each(["CitationCard", "PassageQuote"] as const)(
  "renders exact %s excerpts with shared citation numbering and full expansion",
  async (component) => {
    const onEvidence = show(content, component)
    const user = userEvent.setup()
    const markers = screen.getAllByRole("button", { name: "Read source 1: Retrieved bill text" })
    expect(markers).toHaveLength(2)
    expect(screen.getByText("Introduced")).toBeDefined()
    expect(screen.getByText("Section 2")).toBeDefined()
    const excerpt = screen.getByRole("button", { name: "Show full passage" })
    expect(excerpt.getAttribute("aria-expanded")).toBe("false")
    await user.click(excerpt)
    expect(document.querySelector("blockquote")?.textContent).toBe(
      source.content.state === "available" ? source.content.quote : ""
    )
    await user.click(screen.getByRole("button", { name: "Show less" }))
    expect(document.querySelector("blockquote")?.textContent?.length).toBeLessThan(601)
    await user.click(markers[0]!)
    expect(onEvidence).toHaveBeenCalledWith({ answerId: "answer", number: 1, evidence: source })
    expect(screen.getByRole("link", { name: "Read in full" }).getAttribute("href")).toBe(source.sourceUrl)
    await user.click(screen.getByRole("button", { name: "Sources 1" }))
    expect(
      within(screen.getByRole("region", { name: "Sources" })).getAllByRole("button", { name: /^Read source/ })
    ).toHaveLength(1)
  }
)

it("renders missing passages without a fabricated quotation or source link", () => {
  show({ ...content, evidence: { ...source, sourceUrl: null, content: { state: "unavailable" } } }, "CitationCard")
  expect(document.querySelector("blockquote")).toBeNull()
  expect(screen.getByText("The source passage is unavailable.")).toBeDefined()
  expect(screen.queryByRole("link", { name: "Read in full" })).toBeNull()
})

it("does not describe a truncated retrieved excerpt as the full passage", async () => {
  show(
    {
      ...content,
      evidence: {
        ...source,
        content: { state: "available", quote: "Exact words. ".repeat(100), truncated: true, totalCharacters: 20001 }
      }
    },
    "CitationCard"
  )
  expect(screen.getByText("Only part of the retrieved passage is shown.")).toBeDefined()
  expect(screen.queryByRole("button", { name: "Show full passage" })).toBeNull()
  await userEvent.setup().click(screen.getByRole("button", { name: "Show retrieved excerpt" }))
  expect(document.querySelector("blockquote")?.textContent).toBe("Exact words. ".repeat(100))
})

it("renders the designed compact passage row and opens the exact numbered evidence without a quote body", async () => {
  const onEvidence = show(content, "CompactPassageCard")
  const markers = screen.getAllByRole("button", { name: "Read source 1: Retrieved bill text" })
  expect(markers).toHaveLength(2)
  expect(document.querySelector("blockquote")).toBeNull()
  expect(screen.getByText("Publisher, Introduced")).toBeDefined()
  expect(screen.getByText("Section 2")).toBeDefined()
  expect(screen.queryByRole("button", { name: "Copy citation" })).toBeNull()
  await userEvent.setup().click(markers[0]!)
  expect(onEvidence).toHaveBeenCalledWith({ answerId: "answer", number: 1, evidence: source })
})

it.each(["ProgressPath", "RecordTimeline"] as const)(
  "renders %s with recorded events only and explicit partial coverage",
  (component) => {
    show(
      {
        id: content.id,
        kind: "timeline",
        billId: "bill-one",
        hasMore: true,
        events: [
          { id: "first", type: "action", date: "2026-01-01", description: "Introduced" },
          { id: "second", type: "vote", date: null, description: "Reported vote" }
        ]
      },
      component
    )
    expect(screen.getByText("Introduced")).toBeDefined()
    expect(screen.getByText(/More recorded events/)).toBeDefined()
    expect(screen.queryByText("Governor")).toBeNull()
    expect(screen.getAllByRole("listitem")).toHaveLength(component === "ProgressPath" ? 1 : 2)
  }
)

it.each(["not-found", "not-collected"] as const)("renders the %s state without prototype actions", (state) => {
  show(
    {
      id: content.id,
      kind: "record-status",
      recordId: "record-one",
      title: "Requested record",
      state,
      sourceUrl: null
    },
    "RecordStatus"
  )
  expect(
    screen.getByRole("region", { name: state === "not-found" ? "Record not found" : "Passage not collected" })
  ).toBeDefined()
  expect(screen.queryByRole("button", { name: "Retry" })).toBeNull()
  expect(screen.queryByRole("button", { name: "Request coverage" })).toBeNull()
})

it("rejects a valid content ID paired with the wrong component", () => {
  expect(() => part(content, "RollCall")).toThrow(/Presentation content does not match/)
})

it("copies the source citation without changing the retrieved passage", async () => {
  const user = userEvent.setup()
  const copy = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue()
  show(content, "CitationCard")
  await user.click(screen.getByRole("button", { name: "Copy citation" }))
  expect(copy).toHaveBeenCalledWith(expect.stringContaining("Retrieved bill text"))
  expect(copy).toHaveBeenCalledWith(expect.stringContaining("Section 2"))
  expect(copy).toHaveBeenCalledWith(expect.stringContaining("https://example.org/version.pdf"))
})

it("paginates selected result lists through the existing session-owned endpoint", async () => {
  const record = {
    id: "bill-first",
    kind: "bill" as const,
    title: "First bill",
    sourceUrl: "https://example.org/first",
    fields: [],
    tallies: []
  }
  const page = {
    id: "11111111-1111-4111-8111-111111111111",
    kind: "bill" as const,
    presentation: "list" as const,
    page: 0,
    items: [record],
    start: 1,
    end: 1,
    hasNext: true,
    hasPrevious: false,
    warnings: []
  }
  const next = {
    ...page,
    page: 1,
    items: [{ ...record, id: "bill-second", title: "Second bill" }],
    start: 2,
    end: 2,
    hasPrevious: true,
    hasNext: false
  }
  const fetchPage = vi.spyOn(globalThis, "fetch").mockImplementation(async () => Response.json(next))
  show({ id: content.id, kind: "result-list", page }, "ResultList")
  await userEvent.setup().click(screen.getByRole("button", { name: "Next" }))
  await screen.findByRole("link", { name: /Second bill/ })
  expect(screen.queryByRole("link", { name: /First bill/ })).toBeNull()
  expect(fetchPage.mock.calls[0]?.[1]?.body).toContain('"action":"page-results"')
  expect(fetchPage.mock.calls[0]?.[1]?.body).toContain('"page":1')
})

it("shows a bounded roll call and keeps the inspector open through snapshot rerenders", async () => {
  const record = { id: "vote-one", kind: "vote" as const, title: "Test vote", sourceUrl: null, fields: [], tallies: [] }
  const details = {
    record,
    hasCompleteTally: false,
    positions: Array.from({ length: 8 }, (_, index) => ({
      id: `member-${index}`,
      name: `Member ${index}`,
      option: "yes"
    }))
  }
  const source: PresentationContent = {
    id: content.id,
    kind: "roll-call",
    details,
    resultId: "11111111-1111-4111-8111-111111111111",
    offset: 0,
    hasMore: true
  }
  const fetchDetails = vi.spyOn(globalThis, "fetch").mockImplementation(async () => Response.json(details))
  function view(value: PresentationContent) {
    return (
      <ChatProviders>
        <StickToBottom initial={false}>
          <InlinePresentation content={value} variant="RollCall" answerId="answer" />
        </StickToBottom>
      </ChatProviders>
    )
  }
  const rendered = render(view(source))
  expect(within(screen.getByRole("table", { name: "Member votes" })).getAllByRole("cell")).toHaveLength(6)
  expect(screen.getByText(/Showing 6 of 8 retrieved positions/)).toBeDefined()
  const trigger = screen.getByRole("button", { name: "Open full roll call" })
  const user = userEvent.setup()
  await user.click(trigger)
  const dialog = await screen.findByRole("dialog", { name: "Vote details" })
  await within(dialog).findByRole("heading", { name: "Test vote" })
  const calls = fetchDetails.mock.calls.length
  rendered.rerender(view(structuredClone(source)))
  expect(screen.getByRole("dialog", { name: "Vote details" })).toBe(dialog)
  expect(fetchDetails).toHaveBeenCalledTimes(calls)
  await user.keyboard("{Escape}")
  await waitFor(() => expect(document.activeElement).toBe(trigger))
})
