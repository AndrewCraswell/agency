import { describe, expect, it } from "vitest"
import { validateSenateCoverage, type SenateCoverageRow } from "./senate-corpus-validation.js"

const completeRow = {
  congress: 101,
  distinctSequenceCount: 2,
  firstSequence: 1,
  lastSequence: 2,
  positions: 198,
  session: 1,
  votes: 2,
  votesWithPositions: 2,
  votesWithSourceUrl: 2
} satisfies SenateCoverageRow

describe("Senate corpus validation", () => {
  it("accepts complete contiguous sessions", () => {
    expect(validateSenateCoverage([completeRow, { ...completeRow, positions: 200, session: 2 }], 4, 101, 101)).toEqual({
      sessions: 2,
      totalPositions: 398,
      totalVotes: 4
    })
  })

  it.each([
    { expectedVotes: 5, rows: [completeRow, { ...completeRow, session: 2 }] },
    { expectedVotes: 2, rows: [completeRow] },
    {
      expectedVotes: 4,
      rows: [completeRow, { ...completeRow, distinctSequenceCount: 1, session: 2 }]
    },
    { expectedVotes: 4, rows: [completeRow, { ...completeRow, session: 2, votesWithPositions: 1 }] },
    { expectedVotes: 4, rows: [completeRow, { ...completeRow, session: 2, votesWithSourceUrl: 1 }] }
  ])("rejects incomplete coverage", ({ expectedVotes, rows }) => {
    expect(() => validateSenateCoverage(rows, expectedVotes, 101, 101)).toThrow("Senate coverage validation failed")
  })
})
