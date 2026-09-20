// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { UIMessage } from "ai"
import { afterEach, expect, it } from "vitest"
import { ResearchActivity } from "./ResearchActivity"

afterEach(cleanup)

it.each([
  { output: { assembly: { status: "pending" }, data: { partial: true } }, status: "Partial record" },
  { output: { assembly: { status: "complete" }, data: { partial: true } }, status: "Record assembled" },
  { output: { evidencePage: { partial: true } }, status: "More evidence available" },
  { output: { data: { partial: true } }, status: "Partial text" }
])("exposes $status without presenting transport fragments as completed evidence", ({ output, status }) => {
  render(
    <ResearchActivity
      isRunning={false}
      part={{
        type: "dynamic-tool",
        toolCallId: "partial",
        toolName: "get_bill",
        state: "output-available",
        input: {},
        output
      }}
    />
  )
  expect(screen.getByLabelText(`Read bill: ${status}`)).toBeDefined()
  expect(screen.queryByText("Complete")).toBeNull()
  expect(screen.queryByText("0 returned")).toBeNull()
})

it.each([
  { toolName: "search_people", input: { limit: 5, mode: "lexical" }, label: "List people" },
  { toolName: "search_people", input: { isActive: false, limit: 5 }, label: "Search people" },
  { toolName: "search_organizations", input: { limit: 5 }, label: "List organizations" },
  { toolName: "search_organizations", input: { classification: "committee" }, label: "Search organizations" },
  { toolName: "search_votes", input: { limit: 5, cursor: "hidden" }, label: "List votes" },
  { toolName: "search_amendments", input: { limit: 5 }, label: "List amendments" },
  { toolName: "search_supporting_materials", input: { limit: 5 }, label: "List supporting materials" },
  { toolName: "search_changes", input: { limit: 5 }, label: "List recorded changes" },
  { toolName: "search_changes", input: { recordType: "bill" }, label: "Search recorded changes" },
  { toolName: "search_bills", input: { query: "", sessionIds: [], limit: 5 }, label: "List bills" }
])("labels the supplied $toolName scope as $label", ({ toolName, input, label }) => {
  render(
    <ResearchActivity
      isRunning
      part={{ type: "dynamic-tool", toolCallId: "scope", toolName, state: "input-available", input }}
    />
  )
  expect(screen.getByLabelText(`${label}: Running`)).toBeDefined()
  expect(screen.queryByText(/Mode:|hidden/)).toBeNull()
})

it("does not assume an unfiltered list before arguments arrive", () => {
  render(
    <ResearchActivity
      isRunning
      part={{
        type: "dynamic-tool",
        toolCallId: "waiting",
        toolName: "search_votes",
        state: "input-streaming",
        input: undefined
      }}
    />
  )
  expect(screen.getByLabelText("Search votes: Pending")).toBeDefined()
  expect(screen.queryByText(/All jurisdictions|Up to/)).toBeNull()
})

it("groups distinct unnamed votes while retaining named votes and deduplicating IDs", () => {
  render(
    <ResearchActivity
      isRunning
      previousParts={[
        {
          type: "dynamic-tool",
          toolCallId: "prior",
          toolName: "get_vote",
          state: "output-available",
          input: {},
          output: {
            resultSet: {
              items: [{ id: "vote:known", kind: "vote", title: "On passage", sourceUrl: null, fields: [], tallies: [] }]
            }
          }
        }
      ]}
      part={{
        type: "dynamic-tool",
        toolCallId: "batch",
        toolName: "get_votes",
        state: "input-available",
        input: { ids: ["vote:unknown-first", "vote:known", "vote:unknown-second", "vote:unknown-first"] }
      }}
    />
  )
  expect(screen.getByText("2 selected votes; On passage")).toBeDefined()
  expect(screen.queryByText(/vote:unknown/)).toBeNull()
})

it("uses readable legal scope labels without exposing mode or traversal field names", () => {
  render(
    <ResearchActivity
      isRunning
      part={{
        type: "dynamic-tool",
        toolCallId: "scope",
        toolName: "list_legal_provisions",
        state: "input-available",
        input: { kind: "regulation", nodeKind: "section", traversal: "all", mode: "semantic", limit: 1 }
      }}
    />
  )
  expect(screen.getByText("Regulations; Section; All provisions; Up to 1 result")).toBeDefined()
  expect(screen.queryByText(/Mode:|Node kind:|Traversal:|Kind:/)).toBeNull()
})

it("keeps recorded-change summaries to the short bill, date range, and limit", () => {
  const input = {
    recordId: "bill:us:113:hr:152",
    classification: "update",
    observedFrom: "2026-09-01T00:00:00Z",
    observedTo: "2026-09-16T23:59:59Z",
    limit: 5
  }
  const { rerender } = render(
    <ResearchActivity
      isRunning
      part={{
        type: "dynamic-tool",
        toolCallId: "changes",
        toolName: "search_changes",
        state: "input-available",
        input
      }}
    />
  )
  const expected = "HR 152; Between Sep 1, 2026 \u2014 Sep 16, 2026; Up to 5 results"
  expect(screen.getByText(expected)).toBeDefined()
  rerender(
    <ResearchActivity
      isRunning={false}
      part={{
        type: "dynamic-tool",
        toolCallId: "changes",
        toolName: "search_changes",
        state: "output-available",
        input,
        output: { data: { items: [] } }
      }}
    />
  )
  expect(screen.getByText(expected)).toBeDefined()
  expect(screen.getByText("0 returned")).toBeDefined()
  expect(screen.queryByText(/Updates|Change:|Up to 5 recorded changes/)).toBeNull()
})

it.each([
  { input: { limit: 5, mode: "lexical" }, expected: "All supporting materials; Up to 5 results" },
  { input: { billId: "bill:us:113:hr:152", limit: 5, mode: "hybrid" }, expected: "HR 152; Up to 5 results" },
  {
    input: { query: "Fiscal analysis", billId: "bill:us:113:hr:152", limit: 5 },
    expected: "Fiscal analysis; HR 152; Up to 5 results"
  },
  {
    input: { jurisdictionId: "jurisdiction:ca", classification: "report", limit: 5 },
    expected: "CA; Reports; Up to 5 results"
  }
])("summarizes supporting-material scope as $expected", ({ input, expected }) => {
  const { rerender } = render(
    <ResearchActivity
      isRunning
      part={{
        type: "dynamic-tool",
        toolCallId: "materials",
        toolName: "search_supporting_materials",
        state: "input-available",
        input
      }}
    />
  )
  expect(screen.getByText(expected)).toBeDefined()
  rerender(
    <ResearchActivity
      isRunning={false}
      part={{
        type: "dynamic-tool",
        toolCallId: "materials",
        toolName: "search_supporting_materials",
        state: "output-available",
        input,
        output: { data: { items: [] } }
      }}
    />
  )
  expect(screen.getByText(expected)).toBeDefined()
  expect(screen.getByText("0 returned")).toBeDefined()
  expect(screen.queryByText(/Mode:/)).toBeNull()
})

it("uses a material title when known and otherwise hides its opaque ID", () => {
  const input = { id: "material:congress:opaque" }
  const base = { type: "dynamic-tool", toolCallId: "material", toolName: "get_supporting_material", input } as const
  const completed = {
    ...base,
    state: "output-available",
    output: {
      resultSet: {
        items: [
          {
            id: input.id,
            kind: "material",
            title: "SAMDT 1255 Submitted (PDF)",
            sourceUrl: null,
            fields: [],
            tallies: []
          }
        ]
      }
    }
  } satisfies UIMessage["parts"][number]
  const { rerender } = render(<ResearchActivity isRunning part={{ ...base, state: "input-available" }} />)
  expect(screen.getByText("Selected supporting material")).toBeDefined()
  expect(screen.queryByText(input.id)).toBeNull()
  rerender(<ResearchActivity isRunning previousParts={[completed]} part={{ ...base, state: "input-available" }} />)
  expect(screen.getByText("SAMDT 1255 Submitted (PDF)")).toBeDefined()
  rerender(<ResearchActivity isRunning={false} part={completed} />)
  expect(screen.getByText("SAMDT 1255 Submitted (PDF)")).toBeDefined()
})

it.each([
  { billId: "bill:us:113:hr:152", expected: "HR 152: HAMDT 10" },
  { billId: null, expected: "HAMDT 10" }
])("keeps amendment identifiers compact with related bill $billId", ({ billId, expected }) => {
  const input = { id: "amendment:us:113:hamdt:10" }
  const output = {
    data: {
      amendment: {
        ...input,
        printedIdentifier: "HAMDT 10",
        billId,
        purpose: "Long published purpose",
        description: "Long description"
      }
    }
  }
  const prior: UIMessage["parts"] = [
    {
      type: "dynamic-tool",
      toolCallId: "prior",
      toolName: "get_amendment",
      state: "output-available",
      input,
      output
    }
  ]
  const { rerender } = render(
    <ResearchActivity
      isRunning
      previousParts={prior}
      part={{
        type: "dynamic-tool",
        toolCallId: "read",
        toolName: "get_amendment",
        state: "input-available",
        input
      }}
    />
  )
  expect(screen.getByText(expected)).toBeDefined()
  rerender(
    <ResearchActivity
      isRunning={false}
      part={{
        type: "dynamic-tool",
        toolCallId: "read",
        toolName: "get_amendment",
        state: "output-available",
        input,
        output
      }}
    />
  )
  expect(screen.getByText(expected)).toBeDefined()
  expect(screen.queryByText(/Long published purpose|Long description/)).toBeNull()
})

it("uses the same compact names for batch amendments in request order", () => {
  const first = { id: "amendment:us:113:hamdt:10", printedIdentifier: "HAMDT 10", billId: "bill:us:113:hr:152" }
  const second = { id: "amendment:us:113:hamdt:11", printedIdentifier: "HAMDT 11", billId: null }
  const input = { ids: [second.id, first.id] }
  const part = {
    type: "dynamic-tool",
    toolCallId: "batch",
    toolName: "get_amendments",
    state: "output-available",
    input,
    output: {
      data: {
        items: [
          { id: first.id, data: { amendment: first } },
          { id: second.id, data: { amendment: second } }
        ]
      }
    }
  } satisfies UIMessage["parts"][number]
  const { rerender } = render(<ResearchActivity isRunning={false} part={part} />)
  expect(screen.getByText("HAMDT 11; HR 152: HAMDT 10")).toBeDefined()
  rerender(
    <ResearchActivity
      isRunning
      previousParts={[part]}
      part={{ type: "dynamic-tool", toolCallId: "next", toolName: "get_amendments", state: "input-available", input }}
    />
  )
  expect(screen.getByText("HAMDT 11; HR 152: HAMDT 10")).toBeDefined()
})

it.each([
  { input: { limit: 5, mode: "lexical" }, expected: "All bills, all jurisdictions; Up to 5 results" },
  { input: { limit: 1 }, expected: "All bills, all jurisdictions; Up to 1 result" },
  { input: { jurisdictionId: "jurisdiction:ca", limit: 5 }, expected: "All bills; CA; Up to 5 results" },
  {
    input: { billId: "bill:ca:20232024:ab:2652", limit: 5 },
    expected: "Amendments to AB 2652, CA, 2023-2024; Up to 5 results"
  }
])("describes amendment scope as $expected", ({ input, expected }) => {
  const { rerender } = render(
    <ResearchActivity
      isRunning
      part={{
        type: "dynamic-tool",
        toolCallId: "scope",
        toolName: "search_amendments",
        state: "input-available",
        input
      }}
    />
  )
  expect(screen.getByText(expected)).toBeDefined()
  rerender(
    <ResearchActivity
      isRunning={false}
      part={{
        type: "dynamic-tool",
        toolCallId: "scope",
        toolName: "search_amendments",
        state: "output-available",
        input,
        output: { data: { items: [] } }
      }}
    />
  )
  expect(screen.getByText(expected)).toBeDefined()
  expect(screen.getByText("0 returned")).toBeDefined()
  expect(screen.queryByText(/Mode:/)).toBeNull()
})

it.each([
  ["get_vote", "vote:congress:house-115-1-10", "House roll call 10, 115th Congress, session 1"],
  ["get_vote", "vote:congress:senate-118-2-20", "Senate roll call 20, 118th Congress, session 2"],
  ["get_vote", "vote:openstates:opaque-hash", "Selected vote"],
  ["get_person", "person:openstates:opaque-hash", "Selected person"],
  ["get_organization", "organization:openstates:opaque-hash", "Selected organization"],
  ["get_event", "event:congress:opaque-hash", "Selected meeting"],
  ["get_amendment", "amendment:openstates:opaque-hash", "Selected amendment"],
  ["get_supporting_material", "material:congress:opaque-hash", "Selected supporting material"]
])("uses a readable fallback for %s: %s", (toolName, id, expected) => {
  render(
    <ResearchActivity
      isRunning
      part={{ type: "dynamic-tool", toolCallId: "read", toolName, state: "input-available", input: { id } }}
    />
  )
  expect(screen.getByText(expected)).toBeDefined()
  expect(screen.queryByText(id)).toBeNull()
})

it("retains the vote label through interruption and failure, then prefers its returned title", async () => {
  const base = {
    type: "dynamic-tool",
    toolCallId: "read",
    toolName: "get_vote",
    input: { id: "vote:congress:house-115-1-10" }
  } as const
  const { rerender } = render(<ResearchActivity isRunning={false} part={{ ...base, state: "input-streaming" }} />)
  expect(screen.getByText("House roll call 10, 115th Congress, session 1")).toBeDefined()
  rerender(
    <ResearchActivity isRunning={false} part={{ ...base, state: "output-error", errorText: "Unable to read vote." }} />
  )
  expect(screen.getByText("House roll call 10, 115th Congress, session 1")).toBeDefined()
  await userEvent.click(screen.getByRole("button", { name: "Read vote: Failed" }))
  expect(screen.getByText("Unable to read vote.")).toBeDefined()
  rerender(
    <ResearchActivity
      isRunning={false}
      part={{
        ...base,
        state: "output-available",
        output: {
          resultSet: {
            items: [
              {
                id: base.input.id,
                kind: "vote",
                title: "On Agreeing to the Resolution",
                sourceUrl: null,
                fields: [],
                tallies: []
              }
            ]
          }
        }
      }}
    />
  )
  expect(screen.getByText("On Agreeing to the Resolution")).toBeDefined()
  expect(screen.queryByText(base.input.id)).toBeNull()
})

it.each([
  {
    toolName: "search_events",
    input: { from: "2026-09-01T00:00:00Z", to: "2026-09-16T23:59:59Z" },
    expected: "Between Sep 1, 2026 \u2014 Sep 16, 2026"
  },
  {
    toolName: "search_changes",
    input: { observedFrom: "2026-09-01T00:00:00Z", observedTo: "2026-09-16T23:59:59Z" },
    expected: "Between Sep 1, 2026 \u2014 Sep 16, 2026"
  },
  { toolName: "search_events", input: { from: "2026-09-01T00:00:00Z" }, expected: "From Sep 1, 2026" },
  { toolName: "search_events", input: { to: "2026-09-16T23:59:59Z" }, expected: "To Sep 16, 2026" }
])("formats $toolName date bounds as $expected", ({ toolName, input, expected }) => {
  render(
    <ResearchActivity
      isRunning
      part={{ type: "dynamic-tool", toolCallId: "date-range", toolName, state: "input-available", input }}
    />
  )
  expect(screen.getByText(expected)).toBeDefined()
})

const previousParts: UIMessage["parts"] = [
  {
    type: "dynamic-tool",
    toolCallId: "prior",
    toolName: "search_people",
    state: "output-available",
    input: {},
    output: {
      resultSet: {
        items: [
          { kind: "person", id: "person:known", title: "Known sponsor", sourceUrl: null, fields: [], tallies: [] },
          {
            kind: "amendment",
            id: "amendment:known",
            title: "Known amendment",
            sourceUrl: null,
            fields: [],
            tallies: []
          },
          { kind: "meeting", id: "event:known", title: "Known meeting", sourceUrl: null, fields: [], tallies: [] }
        ]
      }
    }
  }
]

it.each([
  {
    toolName: "search_votes",
    input: { organizationId: "organization:congress:house", from: "2026-01-01T00:00:00Z", limit: 100 },
    expected: "House; From Jan 1, 2026; Up to 100 results"
  },
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
    expected: "Education; House; Committees; Active only"
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
    expected: "schools, CA; Bills; Status: introduced; Subject: Education; Introduced from Jan 1, 2024"
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
    expected: "AB 2652, CA, 2023-2024; Companion bills"
  },
  {
    toolName: "search_amendments",
    input: { query: "education", billId: "bill:ca:20232024:ab:2652", sponsorPersonId: "person:known", mode: "hybrid" },
    expected: "education; Amendments to AB 2652, CA, 2023-2024; Known sponsor"
  },
  {
    toolName: "search_amendments_for_bills",
    input: {
      query: "education",
      billIds: ["bill:ca:20232024:ab:2652", "bill:ca:20232024:sb:1047"],
      sponsorPersonId: "person:known"
    },
    expected: "education; AB 2652; SB 1047; Known sponsor"
  },
  {
    toolName: "search_supporting_materials",
    input: { query: "analysis", amendmentId: "amendment:known", eventId: "event:known", classification: "report" },
    expected: "analysis; Known amendment; Known meeting; Reports"
  },
  {
    toolName: "search_regulations",
    input: { query: "safety", corpora: ["regulation"], codeIds: ["code-id"], asOf: "2024-01-01", limit: 10 },
    expected: "safety; Regulations; Code: 1 selected; As of Jan 1, 2024; Up to 10 results"
  }
])("retains query and semantic filters for $toolName", ({ toolName, input, expected }) => {
  render(
    <ResearchActivity
      isRunning
      previousParts={previousParts}
      part={{
        type: "dynamic-tool",
        toolCallId: "summary",
        toolName,
        state: "input-available",
        input: { ...input, cursor: "hidden-cursor", anchor: "hidden-anchor" }
      }}
    />
  )
  expect(screen.getByText(expected)).toBeDefined()
  expect(screen.queryByText(/hidden-cursor|hidden-anchor|hidden-document-hash/)).toBeNull()
})

it("keeps vote filters visible while only the error explanation collapses", async () => {
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
  const trigger = screen.getByRole("button", { name: "Search votes: Failed" })
  expect(trigger.getAttribute("aria-expanded")).toBe("false")
  expect(screen.getByText("House; From Jan 1, 2026; Up to 100 results")).toBeDefined()
  expect(screen.queryByText("Vote search failed.")).toBeNull()
  await userEvent.click(trigger)
  expect(screen.getByText("Vote search failed.")).toBeDefined()
  expect(screen.getAllByText("House; From Jan 1, 2026; Up to 100 results")).toHaveLength(1)
  await userEvent.click(trigger)
  expect(screen.queryByText("Vote search failed.")).toBeNull()
  expect(screen.getByText("House; From Jan 1, 2026; Up to 100 results")).toBeDefined()
  expect(screen.queryByText(/hidden-cursor/)).toBeNull()
})

it("keeps a denied query and session visible before opening the explanation", async () => {
  render(
    <ResearchActivity
      isRunning={false}
      part={{
        type: "dynamic-tool",
        toolCallId: "denied",
        toolName: "search_bills",
        state: "output-denied",
        input: { query: "Education", sessionIds: ["session:ca:20232024"] },
        approval: { id: "denied", approved: false }
      }}
    />
  )
  expect(screen.getByText("Education, CA, 2023-2024")).toBeDefined()
  expect(screen.queryByText("This operation was not permitted.")).toBeNull()
  await userEvent.click(screen.getByRole("button", { name: "Search bills: Denied" }))
  expect(screen.getByText("This operation was not permitted.")).toBeDefined()
  expect(screen.getAllByText("Education, CA, 2023-2024")).toHaveLength(1)
})
