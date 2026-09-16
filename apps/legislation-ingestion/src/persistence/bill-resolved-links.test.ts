import { describe, expect, it } from "vitest"
import { persistedVoteId } from "./bill-resolved-links.js"

describe("persisted vote identity", () => {
  const incoming = { id: "new-id", billId: "bill-1", sourceUrl: "https://example.org/vote/1", sourceId: "motion-1" }
  const previous = { ...incoming, id: "existing-id" }
  it("retains the existing identity for the exact bill and source", () => {
    expect(persistedVoteId(incoming, [previous])).toBe("existing-id")
  })
  it("does not match missing provenance or a different bill", () => {
    expect(persistedVoteId(incoming, [{ ...previous, sourceUrl: null }])).toBe("new-id")
    expect(persistedVoteId(incoming, [{ ...previous, billId: "bill-2" }])).toBe("new-id")
    expect(persistedVoteId(incoming, [{ ...previous, sourceId: "motion-2" }])).toBe("new-id")
  })
  it("rejects duplicate source identities rather than choosing a record", () => {
    expect(() => persistedVoteId(incoming, [previous, incoming])).toThrow("Ambiguous persisted vote source identity")
  })
  it.each([
    { billId: "bill-2" },
    { sourceUrl: "https://example.org/vote/2" },
    { sourceId: "motion-2" },
    { sourceId: null }
  ])("rejects changed provenance even when the primary ID matches: %j", (change) => {
    expect(() => persistedVoteId(incoming, [{ ...incoming, ...change }])).toThrow(
      "Persisted vote identity changed its source or bill ownership"
    )
  })
})
