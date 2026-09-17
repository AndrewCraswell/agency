// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { UIMessage } from "ai"
import { afterEach, expect, it } from "vitest"
import { ResearchActivity } from "./ResearchActivity"

afterEach(cleanup)

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
    expected: "House; From: Jan 1, 2026; Up to 100 votes"
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
    expected: "schools, CA; Classification: bill; Status: introduced; Subject: Education; Introduced from: Jan 1, 2024"
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
  expect(screen.getByText("House; From: Jan 1, 2026; Up to 100 votes")).toBeDefined()
  expect(screen.queryByText("Vote search failed.")).toBeNull()
  await userEvent.click(trigger)
  expect(screen.getByText("Vote search failed.")).toBeDefined()
  expect(screen.getAllByText("House; From: Jan 1, 2026; Up to 100 votes")).toHaveLength(1)
  await userEvent.click(trigger)
  expect(screen.queryByText("Vote search failed.")).toBeNull()
  expect(screen.getByText("House; From: Jan 1, 2026; Up to 100 votes")).toBeDefined()
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
  await userEvent.click(screen.getByRole("button", { name: "Search bills: Failed" }))
  expect(screen.getByText("This operation was not permitted.")).toBeDefined()
  expect(screen.getAllByText("Education, CA, 2023-2024")).toHaveLength(1)
})
