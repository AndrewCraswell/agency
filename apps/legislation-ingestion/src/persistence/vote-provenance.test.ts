import type { CanonicalVote } from "@repo/legislation-core/domain/model"
import { describe, expect, it } from "vitest"
import { planVoteProvenance } from "./vote-provenance.js"

function evidence(): CanonicalVote {
  return {
    vote: {
      id: "new",
      billId: "bill-1",
      motion: "PASSED #1",
      result: "passed",
      yesCount: 1,
      noCount: 0,
      heldDate: "2026-05-07",
      sourceId: "journal-motion-1",
      sourceUrl: "https://example.org/journal/1",
      timelineComplete: true
    },
    positions: [{ voteId: "new", sourceIdentity: "source-name:A", sourceName: "A", option: "yes", sourceSequence: 0 }]
  }
}
function previous(): CanonicalVote {
  return {
    vote: {
      id: "existing",
      billId: "bill-1",
      motion: "PASSED #1",
      result: "pass",
      yesCount: 1,
      noCount: 0,
      timelineComplete: false
    }
  }
}

describe("explicit source vote reconciliation", () => {
  it("preserves canonical IDs and date precision without inventing people", () => {
    const [result] = planVoteProvenance([evidence()], [previous()])
    expect(result?.vote.id).toBe("existing")
    expect(result?.vote.heldDate).toBe("2026-05-07")
    expect(result?.vote.heldAt).toBeUndefined()
    expect(result?.positions[0]).toMatchObject({ voteId: "existing", sourceName: "A" })
    expect(result?.positions[0]?.personId).toBeUndefined()
    expect(planVoteProvenance([evidence()], result ? [result] : [])).toEqual([result])
  })
  it.each([
    { motion: "OTHER #1" },
    { yesCount: 2 },
    { noCount: null },
    { billId: "bill-2" },
    { sourceId: "other" },
    { sourceUrl: "https://example.org/other" },
    { heldDate: "2026-05-08" }
  ])("rejects contradictory or insufficient identity: %j", (change) => {
    const prior = previous()
    expect(() => planVoteProvenance([evidence()], [{ ...prior, vote: { ...prior.vote, ...change } }])).toThrow(
      "one distinct"
    )
  })
  it("rejects ambiguous same-motion same-tally records", () => {
    const second = evidence()
    second.vote.id = "new-2"
    second.vote.sourceId = "journal-motion-2"
    expect(() =>
      planVoteProvenance([evidence(), second], [previous(), { vote: { ...previous().vote, id: "old-2" } }])
    ).toThrow("one distinct")
  })
  it("preserves existing person resolution only on the same voter observation", () => {
    const prior = previous()
    prior.positions = [{ ...evidence().positions![0]!, personId: "person-1" }]
    expect(planVoteProvenance([evidence()], [prior])[0]?.positions[0]?.personId).toBe("person-1")
    prior.positions[0]!.sourceName = "Other"
    expect(() => planVoteProvenance([evidence()], [prior])).toThrow("conflicts")
  })
  it("requires the full vote inventory and complete source evidence", () => {
    expect(() => planVoteProvenance([evidence()], [])).toThrow("inventory")
    const source = evidence()
    source.positions = []
    expect(() => planVoteProvenance([source], [previous()])).toThrow("incomplete")
  })
})
