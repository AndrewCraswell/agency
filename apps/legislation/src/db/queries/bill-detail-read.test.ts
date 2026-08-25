import { describe, expect, it } from "vitest"
import type { AmendmentSummary } from "../../api/canonical-projection.js"
import { LegislationError } from "../../legislation/errors.js"
import { decodeAmendmentContinuationCursor } from "./amendment-reads.js"
import { billDetailAmendmentPage, MAX_BILL_VOTE_LIMIT, parseBillVoteLimit } from "./bill-detail-read.js"
import { assertCanonicalVotePersistence, assertVotePositionSequence } from "./vote-reads.js"

const API_BASE_URL = "https://api.example.test"
const BILL_ID = "bill:us:119:hr:1"

function amendment(index: number, recordType: "document" | "structured"): AmendmentSummary {
  const id = recordType === "structured" ? `amendment:structured:${index}` : `amendment:document:document:${index}`
  return {
    billId: BILL_ID,
    canonicalUrl: `${API_BASE_URL}/api/amendments/${encodeURIComponent(id)}`,
    documentId: recordType === "document" ? `document:${index}` : null,
    id,
    identifier: `Amendment ${index}`,
    jurisdictionId: "jurisdiction:us",
    recordType,
    sources: [
      {
        isOfficial: true,
        provider: "fixture",
        retrievedAt: "2026-08-25T00:00:00.000Z",
        sourceUpdatedAt: null,
        sourceUrl: `https://source.example.test/amendment/${index}`
      }
    ],
    status: recordType === "structured" ? "introduced" : null,
    submittedDate: `2026-02-${String(index).padStart(2, "0")}`,
    title: `Amendment ${index}`,
    type: "amendment",
    updatedAt: "2026-08-25T00:00:00.000Z"
  }
}

describe("bill detail query contracts", () => {
  it("uses the shared amendment continuation codec across structured and document child pages", () => {
    const childLimit = 25
    const page = billDetailAmendmentPage(
      Array.from({ length: childLimit + 1 }, (_value, index) => amendment(index + 1, "structured")).concat(
        Array.from({ length: childLimit + 1 }, (_value, index) => amendment(index + 1, "document"))
      ),
      childLimit,
      BILL_ID
    )

    expect(page.items).toHaveLength(childLimit)
    expect(page.items.some((item) => item.recordType === "structured")).toBe(true)
    expect(page.items.some((item) => item.recordType === "document")).toBe(true)
    expect(page.truncated).toBe(true)
    expect(page.nextCursor).not.toBeNull()
    expect(decodeAmendmentContinuationCursor(page.nextCursor ?? undefined, { billId: BILL_ID })).toMatchObject({
      scope: { billId: BILL_ID, sort: "submitted-desc" },
      version: 1
    })
  })

  it("shares the canonical vote completeness failures and relationship page limit", () => {
    expect(parseBillVoteLimit(MAX_BILL_VOTE_LIMIT)).toBe(MAX_BILL_VOTE_LIMIT)
    expect(() => parseBillVoteLimit(MAX_BILL_VOTE_LIMIT + 1)).toThrowError(
      new LegislationError("invalid_request", "limit must be an integer between 1 and 25")
    )
    expect(() => assertCanonicalVotePersistence({ timelineComplete: false })).toThrowError(
      new LegislationError("unprocessable", "Vote canonical persistence is incomplete")
    )
    expect(() => assertVotePositionSequence({ sourceSequence: null })).toThrowError(
      new LegislationError("unprocessable", "Vote position source sequence is incomplete")
    )
  })
})
