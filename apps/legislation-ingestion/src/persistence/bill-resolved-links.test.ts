import { describe, expect, it } from "vitest"
import { persistedVoteId, preserveResolvedSponsorObservations } from "./bill-resolved-links.js"

describe("persisted vote identity", () => {
  const incoming = { id: "new-id", billId: "bill-1", sourceUrl: "https://example.org/vote/1", sourceId: "motion-1" }
  const previousVote = { ...incoming, id: "existing-id" }
  it("retains the existing identity for the exact bill and source", () => {
    expect(persistedVoteId(incoming, [previousVote])).toBe("existing-id")
  })
  it("does not match missing provenance or a different bill", () => {
    expect(persistedVoteId(incoming, [{ ...previousVote, sourceUrl: null }])).toBe("new-id")
    expect(persistedVoteId(incoming, [{ ...previousVote, billId: "bill-2" }])).toBe("new-id")
    expect(persistedVoteId(incoming, [{ ...previousVote, sourceId: "motion-2" }])).toBe("new-id")
  })
  it("rejects duplicate source identities rather than choosing a record", () => {
    expect(() => persistedVoteId(incoming, [previousVote, incoming])).toThrow(
      "Ambiguous persisted vote source identity"
    )
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

const billId = "bill:ak:34:hb:1"
const previous = {
  id: "sponsor:prior",
  billId,
  personId: "person:openstates:prior",
  name: "Example Sponsor",
  classification: "primary",
  isPrimary: true,
  sourceUrl: null,
  firstObservedAt: null,
  latestObservedAt: null,
  createdAt: new Date("2026-09-17T00:00:00Z")
}

describe("resolved sponsor preservation", () => {
  it("retains an exact prior resolution", () => {
    expect(
      preserveResolvedSponsorObservations(
        billId,
        [{ ...previous, personId: undefined, createdAt: undefined }],
        [previous]
      )
    ).toMatchObject([{ id: previous.id, personId: previous.personId }])
  })

  it("keeps a differently identified resolved observation separate from unresolved input", () => {
    const unresolved = {
      ...previous,
      id: "sponsor:current-source-observation",
      personId: undefined,
      createdAt: undefined
    }
    const result = preserveResolvedSponsorObservations(billId, [unresolved], [previous])
    expect(result).toHaveLength(2)
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: unresolved.id, personId: undefined }),
        expect.objectContaining({ id: previous.id, personId: previous.personId })
      ])
    )
  })

  it("does not retain absent observations when the incoming collection is fully resolved", () => {
    const current = { ...previous, id: "sponsor:current", personId: "person:openstates:current", createdAt: undefined }
    expect(preserveResolvedSponsorObservations(billId, [current], [previous])).toEqual([current])
  })

  it("rejects changed source identity under the same observation id", () => {
    expect(() =>
      preserveResolvedSponsorObservations(
        billId,
        [{ ...previous, name: "Changed Sponsor", personId: undefined, createdAt: undefined }],
        [previous]
      )
    ).toThrow("source identity")
  })
})
