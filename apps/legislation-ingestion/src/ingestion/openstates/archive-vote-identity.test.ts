import { describe, expect, it } from "vitest"
import { normalizeOpenStatesBill } from "./normalize.js"

const vote = {
  identifier: "",
  motion_text: "Final Passage (#18)",
  start_date: "2025-03-07",
  organization__classification: "lower",
  result: "pass",
  counts: [{ option: "yes", value: 97 }]
}

function normalize(votes: unknown[]) {
  return (
    normalizeOpenStatesBill(
      {
        identifier: "HB 1023",
        session: "2025-2026",
        title: "Archive identity regression",
        sources: [{ url: "https://example.test/bill/1023" }],
        votes
      },
      { jurisdictionCode: "wa", jurisdictionName: "Washington" }
    ).aggregate.votes ?? []
  )
}

describe("archive vote identities", () => {
  it("keeps each same-day roll call attached to its motion after archive reordering", () => {
    const other = { ...vote, motion_text: "Reconsideration (#19)", result: "fail" }
    const before = normalize([vote, other])
    const after = normalize([other, vote])
    expect(after.map((item) => item.vote.id)).toEqual(before.map((item) => item.vote.id).reverse())
    expect(new Set(before.map((item) => item.vote.id)).size).toBe(2)
    expect(before[0]?.vote.chamber).toBe("lower")
  })

  it("does not change identity when an outcome is corrected", () => {
    const corrected = { ...vote, result: "fail", counts: [{ option: "yes", value: 40 }] }
    expect(normalize([corrected])[0]?.vote.id).toBe(normalize([vote])[0]?.vote.id)
  })

  it("scopes repeated roll-call numbers by chamber and date", () => {
    const numbered = { ...vote, identifier: "18" }
    const rows = normalize([
      numbered,
      { ...numbered, organization__classification: "upper" },
      { ...numbered, start_date: "2025-03-08" }
    ])
    expect(new Set(rows.map((item) => item.vote.id)).size).toBe(3)
  })

  it("preserves publisher IDs despite corrected event descriptions", () => {
    const identified = { ...vote, id: "ocd-vote/test" }
    expect(normalize([{ ...identified, motion_text: "Corrected title" }])[0]?.vote.id).toBe(
      normalize([identified])[0]?.vote.id
    )
  })

  it("rejects conflicting observations rather than silently dropping a roll call", () => {
    expect(() => normalize([vote, { ...vote, result: "fail" }])).toThrow("Conflicting Open States vote")
    expect(() =>
      normalize([
        { ...vote, id: "shared" },
        { ...vote, id: "shared", counts: [{ option: "yes", value: 40 }] }
      ])
    ).toThrow("Conflicting Open States vote")
  })

  it("deduplicates identical observations without depending on position order", () => {
    const named = {
      ...vote,
      votes: [
        { voter_name: "First", option: "yes" },
        { voter_name: "Second", option: "no" }
      ]
    }
    expect(normalize([named, { ...named, votes: [...named.votes].reverse() }])).toHaveLength(1)
  })
})
