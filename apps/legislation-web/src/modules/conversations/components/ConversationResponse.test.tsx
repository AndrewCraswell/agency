// @vitest-environment happy-dom
import { cleanup, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { UIMessage } from "ai"
import type { ReactNode } from "react"
import invariant from "tiny-invariant"
import { StickToBottom } from "use-stick-to-bottom"
import { afterEach, describe, expect, it, vi } from "vitest"
import { recordMentionHref, type BillComparisonProps, type PresentationBlock } from "../composition"
import type { EntityCard, EntityPage } from "../entityResults"
import type { EvidenceSnapshot } from "../evidence"
import type { MeetingDetails, VoteDetails } from "../recordDetails"
import { ChatProviders } from "./ChatProviders"
import { createCitationPresentation, type CitationSelection } from "./citationPresentation"
import { ConversationResponse } from "./ConversationResponse"
import { EvidencePanel } from "./EvidencePanel"
import { ResearchActivity } from "./ResearchActivity"

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn<typeof import("@sentry/nextjs").captureException>() }))
vi.mock("./citationPresentation", { spy: true })

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
    records: [record]
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

describe("response presentation snapshots", () => {
  it("reuses unchanged answer parsing while still applying new message snapshots", () => {
    const current = message("Existing answer text.")
    const onEvidence = vi.fn<(selection: CitationSelection) => void>()
    function view(answer: UIMessage, isRunning: boolean) {
      return (
        <InlineProviders>
          <ConversationResponse message={answer} isRunning={isRunning} isIncomplete={false} onEvidence={onEvidence} />
        </InlineProviders>
      )
    }
    const rendered = render(view(current, true))
    const initialCalls = vi.mocked(createCitationPresentation).mock.calls.length
    rendered.rerender(view(current, false))
    expect(createCitationPresentation).toHaveBeenCalledTimes(initialCalls)
    rendered.rerender(view(message("Updated answer text."), false))
    expect(createCitationPresentation).toHaveBeenCalledTimes(initialCalls + 1)
    expect(screen.getByText("Updated answer text.")).toBeDefined()
  })
})

describe("ResearchActivity details", () => {
  it("counts failed calls and keeps them between successful calls in research order", async () => {
    render(
      inlineResponse([
        resultPart([], "first-search"),
        {
          type: "dynamic-tool",
          toolCallId: "failed-search",
          toolName: "search_bills",
          state: "output-error",
          input: { cursor: "next-page" },
          errorText: "Unable to load the next page."
        },
        resultPart([], "last-search")
      ]),
      { wrapper: InlineProviders }
    )
    const activity = screen.getByRole("button", { name: "Research activity 3 steps" })
    expect(screen.queryByRole("button", { name: "Search bills: Failed" })).toBeNull()
    await userEvent.click(activity)
    expect(screen.getAllByLabelText(/^Search bills:/).map((row) => row.getAttribute("aria-label"))).toEqual([
      "Search bills: Complete",
      "Search bills: Failed",
      "Search bills: Complete"
    ])
    const failure = screen.getByRole("button", { name: "Search bills: Failed" })
    expect(failure.querySelector("svg.lucide-circle-alert")).not.toBeNull()
    await userEvent.click(failure)
    expect(screen.getByText("Unable to load the next page.")).toBeDefined()
    expect(screen.getByText("Failed")).toBeDefined()
  })

  it("includes a denied-only request in research activity", async () => {
    render(
      inlineResponse([
        {
          type: "dynamic-tool",
          toolCallId: "denied-search",
          toolName: "search_bills",
          state: "output-denied",
          input: {},
          approval: { id: "denied", approved: false }
        }
      ]),
      { wrapper: InlineProviders }
    )
    await userEvent.click(screen.getByRole("button", { name: "Research activity 1 step" }))
    await userEvent.click(screen.getByRole("button", { name: "Search bills: Failed" }))
    expect(screen.getByText("This operation was not permitted.")).toBeDefined()
  })

  it("groups jurisdiction and session metadata in completed bill search activity", () => {
    render(
      <ResearchActivity
        isRunning={false}
        part={{
          type: "dynamic-tool",
          toolCallId: "search",
          toolName: "search_bills",
          state: "output-available",
          input: { query: "Education", sessionIds: ["session:ca:2023S1"] },
          output: {
            resultSet: {
              items: [
                {
                  ...selectedRecord,
                  billSummary: { sessionId: "session:ca:2023S1", sessionName: "2023 First Extraordinary Session" }
                }
              ]
            }
          }
        }}
      />
    )
    expect(screen.getByText("Education, CA, 2023 First Extraordinary Session")).toBeDefined()
    expect(screen.queryByText(/session:ca:/)).toBeNull()
  })

  it("groups jurisdiction and session filters in running bill search activity", () => {
    render(
      <ResearchActivity
        isRunning
        part={{
          type: "dynamic-tool",
          toolCallId: "search",
          toolName: "search_bills",
          state: "input-available",
          input: { query: "Education", sessionIds: ["session:ca:20232024", "session:us:118"] }
        }}
      />
    )
    expect(screen.getByText("Education, CA, US, 2023-2024, 118th Congress")).toBeDefined()
    expect(screen.queryByText(/session:ca:/)).toBeNull()
  })

  it("uses readable session names in expanded failed activity without hiding the query", async () => {
    render(
      <ResearchActivity
        isRunning={false}
        part={{
          type: "dynamic-tool",
          toolCallId: "search",
          toolName: "search_bills",
          state: "output-error",
          input: { query: "Education in session:ca:20232024", sessionIds: ["session:us:118"] },
          errorText: "Search failed."
        }}
      />
    )
    await userEvent.click(screen.getByRole("button", { name: "Search bills: Failed" }))
    expect(screen.getByText("Education in 2023-2024, US, 118th Congress")).toBeDefined()
    expect(screen.queryByText(/session:ca:/)).toBeNull()
  })

  const bill = {
    ...selectedRecord,
    id: "bill:ca:20232024:ab:2652",
    title: "AB 2652 Artificial intelligence working group"
  }

  it.each([
    { state: "input-streaming", isRunning: true },
    { state: "input-streaming", isRunning: false },
    { state: "input-available", isRunning: true },
    { state: "input-available", isRunning: false },
    { state: "output-error", isRunning: false },
    { state: "output-denied", isRunning: false }
  ] as const)(
    "uses an earlier matching person name for $state with running=$isRunning",
    async ({ state, isRunning }) => {
      const base = {
        type: "dynamic-tool",
        toolCallId: "read-person",
        toolName: "get_person",
        input: { id: "person:congress:a000014" }
      } as const
      let part: Extract<UIMessage["parts"][number], { type: "dynamic-tool" }>
      if (state === "output-error") {
        part = { ...base, state, errorText: "Unable to read person." }
      } else if (state === "output-denied") {
        part = { ...base, state, approval: { id: "denied-person", approved: false } }
      } else {
        part = { ...base, state }
      }
      render(
        <ResearchActivity
          part={part}
          isRunning={isRunning}
          previousParts={[
            {
              type: "dynamic-tool",
              toolCallId: "search-people",
              toolName: "search_people",
              state: "output-available",
              input: { query: "Abercrombie" },
              output: {
                resultSet: {
                  items: [
                    { ...selectedRecord, kind: "person", id: base.input.id, title: "Abercrombie, Neil" },
                    { ...selectedRecord, kind: "person", id: "person:other", title: "Unrelated person" }
                  ]
                }
              }
            }
          ]}
        />
      )
      if (state === "output-error" || state === "output-denied") {
        await userEvent.click(screen.getByRole("button", { name: "Read person: Failed" }))
      }
      expect(screen.getByText("Abercrombie, Neil")).toBeDefined()
      expect(screen.queryByText(base.input.id)).toBeNull()
      expect(screen.queryByText("Unrelated person")).toBeNull()
    }
  )

  it("does not use a prior title from a failed read or an unrelated person", () => {
    render(
      <ResearchActivity
        isRunning
        part={{
          type: "dynamic-tool",
          toolCallId: "read-person",
          toolName: "get_person",
          state: "input-available",
          input: { id: "person:congress:a000014" }
        }}
        previousParts={[
          {
            type: "dynamic-tool",
            toolCallId: "search-people",
            toolName: "search_people",
            state: "output-available",
            input: {},
            output: { resultSet: { items: [{ ...selectedRecord, id: "person:other", title: "Unrelated person" }] } }
          },
          {
            type: "dynamic-tool",
            toolCallId: "failed-person",
            toolName: "get_person",
            state: "output-error",
            input: { id: "person:congress:a000014" },
            errorText: "Failed"
          }
        ]}
      />
    )
    expect(screen.getByText("person:congress:a000014")).toBeDefined()
    expect(screen.queryByText("Unrelated person")).toBeNull()
  })

  it.each([
    {
      toolName: "search_events",
      input: { jurisdictionId: "jurisdiction:us", from: "2026-09-01T00:00:00Z", to: "2026-09-16T23:59:59Z" },
      expected: "US; From: Sep 1, 2026; To: Sep 16, 2026"
    },
    {
      toolName: "search_changes",
      input: {
        recordId: "bill:ca:20232024:ab:2652",
        recordType: "bill",
        classification: "relationship-change",
        observedFrom: "2026-09-01T00:00:00Z"
      },
      expected: "AB 2652, CA, 2023-2024; Record type: bill; Change: relationship change; From: Sep 1, 2026"
    }
  ])("shows actual filters for $toolName", ({ toolName, input, expected }) => {
    render(
      <ResearchActivity
        isRunning
        part={{ type: "dynamic-tool", toolCallId: "filtered-search", toolName, state: "input-available", input }}
      />
    )
    expect(screen.getByText(expected)).toBeDefined()
  })

  it.each([
    { toolName: "search_events", limit: 5, expected: "All jurisdictions; Earliest first; Up to 5 meetings" },
    { toolName: "search_changes", limit: 5, expected: "Up to 5 recorded changes" },
    { toolName: "search_events", limit: 1, expected: "All jurisdictions; Earliest first; Up to 1 meeting" },
    { toolName: "search_changes", limit: 1, expected: "Up to 1 recorded change" }
  ])("describes an unfiltered $toolName request with limit $limit", ({ toolName, limit, expected }) => {
    const { rerender } = render(
      <ResearchActivity
        isRunning
        part={{
          type: "dynamic-tool",
          toolCallId: "limited-search",
          toolName,
          state: "input-available",
          input: { limit }
        }}
      />
    )
    expect(screen.getByText(expected)).toBeDefined()
    rerender(
      <ResearchActivity
        isRunning={false}
        part={{
          type: "dynamic-tool",
          toolCallId: "limited-search",
          toolName,
          state: "output-available",
          input: { limit },
          output: { data: { items: [] } }
        }}
      />
    )
    expect(screen.getByText(expected)).toBeDefined()
    expect(screen.getByText("0 returned")).toBeDefined()
  })

  it("shows vote filters and limit with a previously retrieved organization name", () => {
    render(
      <ResearchActivity
        isRunning
        part={{
          type: "dynamic-tool",
          toolCallId: "search-votes",
          toolName: "search_votes",
          state: "input-available",
          input: {
            organizationId: "organization:congress:house",
            from: "2026-01-01T00:00:00Z",
            limit: 100,
            cursor: "private-cursor"
          }
        }}
        previousParts={[
          {
            type: "dynamic-tool",
            toolCallId: "organizations",
            toolName: "search_organizations",
            state: "output-available",
            input: {},
            output: {
              resultSet: {
                items: [{ ...selectedRecord, kind: "organization", id: "organization:congress:house", title: "House" }]
              }
            }
          }
        ]}
      />
    )
    expect(screen.getByText("House; From: Jan 1, 2026; Up to 100 votes")).toBeDefined()
    expect(screen.queryByText(/private-cursor/)).toBeNull()
  })

  it.each([
    {
      toolName: "search_people",
      input: { query: "Neil", jurisdictionId: "jurisdiction:us", isActive: false, limit: 5 },
      expected: "Neil; US; Inactive only; Up to 5 results"
    },
    {
      toolName: "search_organizations",
      input: {
        query: "Education",
        parentOrganizationId: "organization:congress:house",
        classification: "committee",
        isActive: true
      },
      expected: "Education; House; Classification: committee; Active only"
    },
    {
      toolName: "search_bills",
      input: {
        query: "schools",
        jurisdictionIds: ["jurisdiction:ca"],
        classifications: ["bill"],
        statuses: ["introduced"],
        subjects: ["Education"],
        introducedFrom: "2024-01-01",
        mode: "hybrid"
      },
      expected:
        "schools, CA; Classification: bill; Status: introduced; Subject: Education; Introduced from: Jan 1, 2024"
    },
    {
      toolName: "search_bill_text",
      input: { query: "working group", billId: "bill:ca:20232024:ab:2652", documentIds: ["hidden-document-hash"] },
      expected: "working group; AB 2652, CA, 2023-2024"
    },
    {
      toolName: "get_bill_text",
      input: { id: "bill:ca:20232024:ab:2652", versionCode: "Amended", documentId: "hidden-document-hash" },
      expected: "AB 2652, CA, 2023-2024"
    },
    {
      toolName: "get_bill_votes",
      input: { billId: "bill:ca:20232024:ab:2652", limit: 25 },
      expected: "AB 2652, CA, 2023-2024; Up to 25 results"
    },
    {
      toolName: "find_related_bills",
      input: { id: "bill:ca:20232024:ab:2652", classification: "companion", mode: "semantic" },
      expected: "AB 2652, CA, 2023-2024; Classification: companion; Mode: semantic"
    },
    {
      toolName: "search_amendments",
      input: { query: "education", billId: "bill:ca:20232024:ab:2652", sponsorPersonId: "person:known" },
      expected: "education; AB 2652, CA, 2023-2024; Known sponsor"
    },
    {
      toolName: "search_amendments_for_bills",
      input: {
        query: "education",
        billIds: ["bill:ca:20232024:ab:2652", "bill:ca:20232024:sb:1047"],
        sponsorPersonId: "person:known"
      },
      expected: "education; AB 2652, CA, 2023-2024; SB 1047, CA, 2023-2024; Known sponsor"
    },
    {
      toolName: "search_supporting_materials",
      input: { query: "analysis", amendmentId: "amendment:known", eventId: "event:known", classification: "report" },
      expected: "analysis; Known amendment; Known meeting; Classification: report"
    },
    {
      toolName: "search_regulations",
      input: { query: "safety", corpora: ["regulation"], codeIds: ["code-id"], asOf: "2024-01-01", limit: 10 },
      expected: "safety; Corpus: regulation; Code: code-id; As of: Jan 1, 2024; Up to 10 results"
    }
  ])("retains query and semantic filters for $toolName", ({ toolName, input, expected }) => {
    render(
      <ResearchActivity
        isRunning
        part={{
          type: "dynamic-tool",
          toolCallId: "summary",
          toolName,
          state: "input-available",
          input: { ...input, cursor: "hidden-cursor", anchor: "hidden-anchor" }
        }}
        previousParts={[
          {
            type: "dynamic-tool",
            toolCallId: "prior",
            toolName: "search_people",
            state: "output-available",
            input: {},
            output: {
              resultSet: {
                items: [
                  { ...selectedRecord, id: "person:known", title: "Known sponsor" },
                  { ...selectedRecord, id: "amendment:known", title: "Known amendment" },
                  { ...selectedRecord, id: "event:known", title: "Known meeting" }
                ]
              }
            }
          }
        ]}
      />
    )
    expect(screen.getByText(expected)).toBeDefined()
    expect(screen.queryByText(/hidden-cursor|hidden-anchor|hidden-document-hash/)).toBeNull()
  })

  it("keeps vote filters in expanded failed pagination steps", async () => {
    render(
      <ResearchActivity
        isRunning={false}
        part={{
          type: "dynamic-tool",
          toolCallId: "vote-page",
          toolName: "search_votes",
          state: "output-error",
          input: {
            organizationId: "organization:congress:house",
            from: "2026-01-01T00:00:00Z",
            limit: 100,
            cursor: "hidden-cursor"
          },
          errorText: "Vote search failed."
        }}
      />
    )
    await userEvent.click(screen.getByRole("button", { name: "Search votes: Failed" }))
    expect(screen.getByText("House; From: Jan 1, 2026; Up to 100 votes")).toBeDefined()
    expect(screen.queryByText(/hidden-cursor/)).toBeNull()
  })

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

  it.each([
    { state: "input-streaming", isRunning: true, label: "Pending" },
    { state: "input-streaming", isRunning: false, label: "Interrupted" },
    { state: "input-available", isRunning: true, label: "Running" },
    { state: "input-available", isRunning: false, label: "Interrupted" }
  ] as const)("shows a readable bill label for $state with running=$isRunning", ({ state, isRunning, label }) => {
    render(
      <ResearchActivity
        isRunning={isRunning}
        part={{
          type: "dynamic-tool",
          toolCallId: "read-bill",
          toolName: "get_bill",
          state,
          input: { id: bill.id }
        }}
      />
    )
    expect(screen.getByText("AB 2652, CA, 2023-2024")).toBeDefined()
    expect(screen.queryByText(bill.id)).toBeNull()
    expect(screen.getByLabelText(`Read bill: ${label}`)).toBeDefined()
  })

  it.each([
    ["bill:us:118:hr:1234", "HR 1234, US, 118th Congress"],
    ["bill:ca:2023s1:ab:2", "AB 2, CA, Session 2023s1"],
    ["bill:ny:2025-2026:a:123", "A 123, NY, 2025-2026"],
    ["bill:ca:20232024:ab:", "bill:ca:20232024:ab:"],
    ["bill:ca:20232024:ab:2652:document:abc", "bill:ca:20232024:ab:2652:document:abc"],
    ["person:openstates:abc", "person:openstates:abc"]
  ])("formats only complete canonical bill identifiers: %s", (id, label) => {
    render(
      <ResearchActivity
        isRunning
        part={{
          type: "dynamic-tool",
          toolCallId: "read-record",
          toolName: "get_bill",
          state: "input-available",
          input: { id }
        }}
      />
    )
    expect(screen.getByText(label)).toBeDefined()
  })

  it.each([
    { state: "input-streaming", isRunning: true },
    { state: "input-streaming", isRunning: false },
    { state: "input-available", isRunning: true },
    { state: "input-available", isRunning: false }
  ] as const)("shows requested batch bills for $state with running=$isRunning", ({ state, isRunning }) => {
    render(
      <ResearchActivity
        isRunning={isRunning}
        part={{
          type: "dynamic-tool",
          toolCallId: "read-bills",
          toolName: "get_bills",
          state,
          input: { ids: [bill.id, "bill:ca:20232024:sb:1047"] }
        }}
      />
    )
    expect(screen.getByText("AB 2652, CA, 2023-2024; SB 1047, CA, 2023-2024")).toBeDefined()
    expect(screen.queryByText(/bill:ca:/)).toBeNull()
  })

  it("keeps compact batch labels in request order after titles arrive alongside returned counts", () => {
    render(
      <ResearchActivity
        isRunning={false}
        part={{
          type: "dynamic-tool",
          toolCallId: "read-bills",
          toolName: "get_bills",
          state: "output-available",
          input: { ids: ["bill:ca:20232024:sb:1047", bill.id] },
          output: { resultSet: { items: [bill, selectedRecord] }, data: { items: [bill, selectedRecord] } }
        }}
      />
    )
    expect(screen.getByText("SB 1047, CA, 2023-2024; AB 2652, CA, 2023-2024")).toBeDefined()
    expect(screen.getByText("2 returned")).toBeDefined()
    expect(screen.queryByText(bill.title)).toBeNull()
    expect(screen.queryByText(selectedRecord.title)).toBeNull()
  })

  it.each([
    { state: "input-streaming", isRunning: true },
    { state: "input-streaming", isRunning: false },
    { state: "input-available", isRunning: true },
    { state: "input-available", isRunning: false },
    { state: "output-available", isRunning: false },
    { state: "output-error", isRunning: false }
  ] as const)("identifies the bill being compared for $state with running=$isRunning", async ({ state, isRunning }) => {
    const base = {
      type: "dynamic-tool",
      toolCallId: "compare-bill",
      toolName: "compare_bill_versions",
      input: { billId: bill.id, documentIds: [`${bill.id}:document:first`, `${bill.id}:document:second`] }
    } as const
    const input = { billId: bill.id, documentIds: [...base.input.documentIds] }
    let part: Extract<UIMessage["parts"][number], { type: "dynamic-tool" }>
    if (state === "output-available") {
      part = { ...base, input, state, output: { data: { billId: bill.id, changes: [] } } }
    } else if (state === "output-error") {
      part = { ...base, input, state, errorText: "Unable to compare versions." }
    } else {
      part = { ...base, input, state }
    }
    render(<ResearchActivity isRunning={isRunning} part={part} />)
    if (state === "output-error") {
      await userEvent.click(screen.getByRole("button", { name: "Compare bill versions: Failed" }))
    }
    expect(screen.getByText("AB 2652, CA, 2023-2024")).toBeDefined()
    expect(screen.getByText("Version 1 (label unavailable) vs. Version 2 (label unavailable)")).toBeDefined()
    expect(screen.queryByText(/bill:ca:|document:/)).toBeNull()
  })

  it.each([
    { first: "Introduced", second: "Amended", expected: "Introduced vs. Amended" },
    { first: "Amended", second: "Amended", expected: "Amended (2024-04-08) vs. Amended (2024-04-18)" }
  ])("shows real comparison labels in input order: $expected", ({ first, second, expected }) => {
    render(
      <ResearchActivity
        isRunning={false}
        part={{
          type: "dynamic-tool",
          toolCallId: "compare-bill",
          toolName: "compare_bill_versions",
          state: "output-available",
          input: { billId: bill.id, documentIds: ["first", "second"] },
          output: {
            data: {
              billId: bill.id,
              documents: [
                { id: "second", versionCode: second, documentDate: "2024-04-18" },
                { id: "unrelated", title: "Unrelated version" },
                { id: "first", title: first, documentDate: "2024-04-08" }
              ]
            }
          }
        }}
      />
    )
    expect(screen.getByText(expected)).toBeDefined()
    expect(screen.queryByText("Unrelated version")).toBeNull()
  })

  it("resolves comparison versions from earlier bill and text reads before execution", () => {
    render(
      <ResearchActivity
        isRunning
        previousParts={[
          {
            type: "dynamic-tool",
            toolCallId: "read",
            toolName: "get_bill",
            state: "output-available",
            input: { id: bill.id },
            output: { data: { documents: [{ id: "first", billId: bill.id, title: "Introduced" }] } }
          },
          {
            type: "dynamic-tool",
            toolCallId: "text",
            toolName: "get_bill_text",
            state: "output-available",
            input: { id: bill.id },
            output: { data: { document: { id: "second", billId: bill.id, versionCode: "Amended April 18, 2024" } } }
          }
        ]}
        part={{
          type: "dynamic-tool",
          toolCallId: "compare",
          toolName: "compare_bill_versions",
          state: "input-available",
          input: { billId: bill.id, documentIds: ["first", "second"] }
        }}
      />
    )
    expect(screen.getByText("Introduced vs. Amended April 18, 2024")).toBeDefined()
  })

  it("shows requested batch bills in expanded failure details", async () => {
    render(
      <ResearchActivity
        isRunning={false}
        part={{
          type: "dynamic-tool",
          toolCallId: "read-bills",
          toolName: "get_bills",
          state: "output-error",
          input: { ids: [bill.id, "bill:ca:20232024:sb:1047"] },
          errorText: "Unable to read bills."
        }}
      />
    )
    await userEvent.click(screen.getByRole("button", { name: "Read bills: Failed" }))
    expect(screen.getByText("AB 2652, CA, 2023-2024; SB 1047, CA, 2023-2024")).toBeDefined()
    expect(screen.getByText("Unable to read bills.")).toBeDefined()
    expect(screen.getByText("Failed")).toBeDefined()
  })

  it("keeps the failure status visible while toggling details and retains the requested bill", async () => {
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
    const trigger = screen.getByRole("button", { name: "Read bill: Failed" })
    expect(trigger.getAttribute("aria-expanded")).toBe("false")
    expect(screen.queryByText("Unable to read bill.")).toBeNull()
    await userEvent.click(trigger)
    expect(trigger.getAttribute("aria-expanded")).toBe("true")
    expect(screen.getByText("Failed")).toBeDefined()
    expect(screen.getByText("AB 2652, CA, 2023-2024")).toBeDefined()
    expect(screen.queryByText(bill.id)).toBeNull()
    expect(screen.getByText("Unable to read bill.")).toBeDefined()
    await userEvent.click(trigger)
    expect(trigger.getAttribute("aria-expanded")).toBe("false")
    expect(screen.getByText("Failed")).toBeDefined()
    expect(screen.queryByText("Unable to read bill.")).toBeNull()
  })

  it("keeps denied activity collapsed until opened and retains its failure status", async () => {
    render(
      <ResearchActivity
        isRunning={false}
        part={{
          type: "dynamic-tool",
          toolCallId: "denied-search",
          toolName: "search_bills",
          state: "output-denied",
          input: { query: "Education" },
          approval: { id: "denied", approved: false }
        }}
      />
    )
    const trigger = screen.getByRole("button", { name: "Search bills: Failed" })
    expect(trigger.getAttribute("aria-expanded")).toBe("false")
    expect(screen.queryByText("This operation was not permitted.")).toBeNull()
    await userEvent.click(trigger)
    expect(trigger.getAttribute("aria-expanded")).toBe("true")
    expect(screen.getByText("Failed")).toBeDefined()
    expect(screen.getByText("This operation was not permitted.")).toBeDefined()
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
    expect(screen.getByText("AB 2652, CA, 2023-2024")).toBeDefined()
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
  it.each([true, false])("uses a 700px maximum height for Markdown tables with running=%s", (isRunning) => {
    render(
      inlineResponse([{ type: "text", text: "| Bill | Status |\n| --- | --- |\n| AB 2652 | Introduced |" }], isRunning),
      { wrapper: InlineProviders }
    )
    const table = screen.getByRole("table")
    expect(table.parentElement?.style.maxHeight).toBe("700px")
    expect(table.parentElement?.style.height).toBe("")
  })

  const comparisonBills: EntityCard[] = [
    {
      ...selectedRecord,
      id: "bill:first",
      title: "First education bill",
      subtitle: "2023-2024",
      billSummary: {
        status: "In committee",
        latestAction: { date: "2024-04-18", description: "Referred to Education" }
      }
    },
    { ...selectedRecord, id: "bill:second", title: "Second education bill", sourceUrl: null, billSummary: undefined }
  ]
  function comparisonPart(columns: BillComparisonProps["columns"] = ["status", "latestAction"]) {
    const data = {
      state: "ready",
      blockId: "comparison",
      spec: {
        root: "comparison",
        elements: {
          comparison: {
            type: "BillComparison",
            props: {
              records: comparisonBills.map((record) => ({ resultId, recordId: record.id })),
              columns
            },
            children: []
          }
        }
      },
      records: comparisonBills
    } satisfies PresentationBlock
    return { type: "data-presentation", id: data.blockId, data } satisfies UIMessage["parts"][number]
  }

  it("renders only selected comparison columns in order between prose without duplicate cards or sources", async () => {
    const user = userEvent.setup()
    render(
      inlineResponse([
        { type: "text", text: "Before comparison." },
        comparisonPart(),
        { type: "text", text: "After comparison." }
      ]),
      { wrapper: InlineProviders }
    )
    const table = screen.getByRole("table", { name: "Bill comparison" })
    const content = within(table)
    expect(content.getAllByRole("columnheader").map((header) => header.textContent)).toEqual([
      "Bill",
      "Status",
      "Latest action"
    ])
    expect(content.getAllByRole("rowheader").map((header) => header.textContent)).toEqual([
      "First education billOpen record in a new tab: First education bill",
      "Second education bill"
    ])
    expect(content.getByText("2024-04-18: Referred to Education")).toBeDefined()
    expect(content.getAllByText("Not returned")).toHaveLength(2)
    expect(screen.queryByText("2023-2024")).toBeNull()
    expect(screen.queryByRole("region", { name: /^Bill:/ })).toBeNull()
    expect(screen.queryByRole("region", { name: "Sources" })).toBeNull()
    expect(screen.getByText("Before comparison.").compareDocumentPosition(table)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(table.compareDocumentPosition(screen.getByText("After comparison."))).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole("region", { name: "Bill comparison" }))
    await user.tab()
    expect(document.activeElement).toBe(content.getByRole("link", { name: "First education bill" }))
  })

  it("respects selected column order and replaces a pending comparison in place", () => {
    const pending: UIMessage["parts"][number] = {
      type: "data-presentation",
      id: "comparison",
      data: { state: "pending", blockId: "comparison" }
    }
    const view = render(inlineResponse([pending], true), { wrapper: InlineProviders })
    expect(screen.getByText("Loading content...")).toBeDefined()
    view.rerender(inlineResponse([pending, comparisonPart(["latestAction", "session"])], true))
    const table = screen.getByRole("table", { name: "Bill comparison" })
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((header) => header.textContent)
    ).toEqual(["Bill", "Latest action", "Session"])
    expect(within(table).getByText("2023-2024")).toBeDefined()
    expect(within(table).queryByText("In committee")).toBeNull()
    view.rerender(
      inlineResponse([comparisonPart(["latestAction", "session"]), { type: "text", text: "Appended prose" }])
    )
    expect(screen.getByRole("table", { name: "Bill comparison" })).toBe(table)
  })

  it("does not render an entire comparison when any snapshot does not match", () => {
    const part = comparisonPart()
    render(
      inlineResponse([
        { ...part, data: { ...part.data, records: [{ ...selectedRecord, id: "foreign" }, comparisonBills[1]] } }
      ]),
      { wrapper: InlineProviders }
    )
    expect(screen.getByText("This content could not be displayed.")).toBeDefined()
    expect(screen.queryByRole("table")).toBeNull()
    expect(screen.queryByText("First education bill")).toBeNull()
  })

  function mentionedResult(record: EntityCard = selectedRecord) {
    const part = resultPart()
    return { ...part, output: { resultSet: { ...part.output.resultSet, kind: record.kind, items: [record] } } }
  }

  function mention(record: EntityCard = selectedRecord, label = "This record") {
    return `[${label}](${recordMentionHref({ resultId, recordId: record.id })})`
  }

  it("renders passing mentions as grounded publisher links without cards or citation rows", () => {
    render(
      inlineResponse([
        mentionedResult(),
        {
          type: "text",
          text: `${mention(selectedRecord, "The bill")} addresses education. Read ${mention(selectedRecord, "the same bill")} again.`
        }
      ]),
      { wrapper: InlineProviders }
    )
    const links = screen.getAllByRole("link")
    expect(links.map((link) => link.getAttribute("href"))).toEqual([selectedRecord.sourceUrl, selectedRecord.sourceUrl])
    expect(links.map((link) => link.textContent)).toEqual(["The bill", "the same bill"])
    expect(document.getElementById(links[0]?.getAttribute("aria-describedby") ?? "")?.textContent).toBe(
      `Open record in a new tab: ${selectedRecord.title}`
    )
    expect(links[0]?.getAttribute("rel")).toBe("noopener noreferrer")
    expect(links[0]?.getAttribute("target")).toBe("_blank")
    expect(screen.queryByRole("region", { name: /^Bill:/ })).toBeNull()
    expect(screen.queryByRole("region", { name: "Sources" })).toBeNull()
    expect(screen.queryByText("Unselected search record")).toBeNull()
  })

  it.each(["person", "organization", "material"] as const)("reuses the %s profile route for mentions", (kind) => {
    const record = { ...selectedRecord, kind, id: "record/with spaces" }
    render(inlineResponse([mentionedResult(record), { type: "text", text: mention(record) }]), {
      wrapper: InlineProviders
    })
    expect(screen.getByRole("link", { name: "This record" }).getAttribute("href")).toBe(
      `/records/${kind}/record%2Fwith%20spaces?result=${resultId}`
    )
  })

  it("leaves stale, unknown, unsafe, failed and pending references inactive", () => {
    const current = mentionedResult()
    const content: UIMessage["parts"][number] = {
      type: "text",
      text: `${mention()} [Unknown](#record-unknown) [Unsafe](javascript:alert(1))`
    }
    const view = render(inlineResponse([content], true), { wrapper: InlineProviders })
    expect(screen.queryByRole("link", { name: "This record" })).toBeNull()
    expect(screen.getByRole("article", { name: "Rostra response" }).textContent).toContain("This record")
    view.rerender(inlineResponse([{ ...current, state: "input-available", output: undefined }, content], true))
    expect(screen.queryByRole("link", { name: "This record" })).toBeNull()
    view.rerender(
      inlineResponse([{ ...current, state: "output-error", output: undefined, errorText: "Read failed." }, content])
    )
    expect(screen.queryByRole("link", { name: "This record" })).toBeNull()
    view.rerender(inlineResponse([current, content]))
    expect(screen.getByRole("link", { name: "This record" })).toBeDefined()
    expect(screen.getByText("Unknown").tagName).toBe("SPAN")
    expect(screen.queryByRole("link", { name: /Unsafe/ })).toBeNull()
    view.rerender(
      inlineResponse([
        {
          ...current,
          output: { resultSet: { ...current.output.resultSet, id: "22222222-2222-4222-8222-222222222222" } }
        },
        content
      ])
    )
    expect(screen.queryByRole("link", { name: "This record" })).toBeNull()
  })

  it("does not substitute another record or expose unsafe publisher URLs", () => {
    const current = mentionedResult()
    const content: UIMessage["parts"][number] = { type: "text", text: mention() }
    const view = render(inlineResponse([mentionedResult({ ...selectedRecord, id: "other" }), content]), {
      wrapper: InlineProviders
    })
    expect(screen.queryByRole("link", { name: "This record" })).toBeNull()
    view.rerender(
      inlineResponse([
        {
          ...current,
          output: {
            resultSet: {
              ...current.output.resultSet,
              items: [{ ...selectedRecord, sourceUrl: "https://publisher.example/bill?token=private" }]
            }
          }
        },
        content
      ])
    )
    expect(screen.queryByRole("link", { name: "This record" })).toBeNull()
    view.rerender(inlineResponse([mentionedResult({ ...selectedRecord, sourceUrl: null }), content]))
    expect(screen.queryByRole("link", { name: "This record" })).toBeNull()
  })

  it("resolves Markdown references around a card without converting examples to record links", () => {
    const href = recordMentionHref({ resultId, recordId: selectedRecord.id })
    render(
      inlineResponse([
        mentionedResult(),
        { type: "text", text: "Discuss [this bill][bill]." },
        presentationPart(),
        { type: "text", text: `Return to [the bill][bill]. Example: \`[bill](${href})\`.\n\n[bill]: ${href}` }
      ]),
      { wrapper: InlineProviders }
    )
    expect(screen.getByRole("link", { name: "this bill" })).toBeDefined()
    expect(screen.getByRole("link", { name: "the bill" })).toBeDefined()
    expect(screen.getByText(`[bill](${href})`).closest("code")).not.toBeNull()
  })

  it.each(["vote", "meeting"] as const)(
    "opens only the activated repeated %s mention and restores focus",
    async (kind) => {
      const record = { ...selectedRecord, kind, id: `selected-${kind}`, title: `Selected ${kind}` }
      const data =
        kind === "vote"
          ? { record, hasCompleteTally: false, positions: [] }
          : { record, agenda: [], participants: [], documents: [] }
      const fetchDetails = vi.spyOn(globalThis, "fetch").mockImplementation(async () => Response.json(data))
      const user = userEvent.setup()
      render(
        inlineResponse([
          mentionedResult(record),
          { type: "text", text: `${mention(record, "First mention")}. Then ${mention(record, "second mention")}.` }
        ]),
        { wrapper: InlineProviders }
      )
      const trigger = screen.getByRole("button", { name: "second mention" })
      invariant(trigger)
      trigger.focus()
      await user.keyboard("{Enter}")
      const dialog = await screen.findByRole("dialog", { name: kind === "vote" ? "Vote details" : "Meeting" })
      await within(dialog).findByRole("heading", { name: record.title })
      expect(screen.getAllByRole("dialog")).toHaveLength(1)
      expect(fetchDetails).toHaveBeenCalled()
      for (const [, options] of fetchDetails.mock.calls) {
        expect(JSON.parse(String(options?.body))).toMatchObject({ resultId, recordId: record.id })
      }
      await user.keyboard("{Escape}")
      await waitFor(() => expect(document.activeElement).toBe(trigger))
      expect(screen.queryByRole("region", { name: "Sources" })).toBeNull()
    }
  )

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
    expect(screen.getByText("Loading content...").tagName).toBe("OUTPUT")
    view.rerender(inlineResponse([pending, presentationPart()], true))
    expect(screen.queryByText("Loading content...")).toBeNull()
    expect(screen.getAllByRole("region", { name: "Bill: Selected published bill" })).toHaveLength(1)
    view.rerender(inlineResponse([pending]))
    expect(screen.getByText("This content could not be displayed.")).toBeDefined()
    expect(screen.queryByText("Loading content...")).toBeNull()
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
    expect(screen.queryByText("This content could not be displayed.")).toBeNull()
    expect(screen.queryByRole("region", { name: "Sources" })).toBeNull()
  })

  const ready = presentationPart()
  const invalidParts: { name: string; part: UIMessage["parts"][number] }[] = [
    { name: "missing transport ID", part: { type: "data-presentation", data: ready.data } },
    { name: "mismatched transport ID", part: { ...ready, id: "another-block" } },
    { name: "missing payload", part: { ...ready, data: undefined } },
    { name: "missing record", part: { ...ready, data: { ...ready.data, records: undefined } } },
    {
      name: "mismatched record",
      part: { ...ready, data: { ...ready.data, records: [{ ...selectedRecord, id: "other" }] } }
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
    expect(screen.getAllByText("This content could not be displayed.")).toHaveLength(1)
    expect(screen.queryByText(selectedRecord.title)).toBeNull()
    expect(screen.queryByText("Model display title")).toBeNull()
    expect(screen.queryByRole("button", { name: /Read source/ })).toBeNull()
    expect(screen.queryByRole("region", { name: "Sources" })).toBeNull()
  })
})
