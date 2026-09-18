import { describe, expect, it } from "vitest"
import {
  planScraperVoteCompletenessRows,
  scraperVoteCompletenessPlanSha256,
  type ScraperVoteCompletenessInput
} from "./scraper-vote-completeness.js"

function row(overrides: Partial<ScraperVoteCompletenessInput> = {}): ScraperVoteCompletenessInput {
  return {
    absent_count: 1,
    abstain_count: 0,
    has_occurrence: true,
    has_source_evidence: true,
    id: "vote:one",
    no_count: 2,
    not_voting_count: 1,
    other_count: 0,
    paired_count: 0,
    position_count: 7,
    present_count: 0,
    proxy_count: 0,
    result: "unknown",
    source_no_count: 2,
    source_yes_count: 3,
    supported_options: true,
    yes_count: 3,
    ...overrides
  }
}

describe("scraper vote completeness reconciliation", () => {
  it("derives a complete non-binary result from exact named-position counts", () => {
    const plan = planScraperVoteCompletenessRows([row()], "ak", "34")
    expect(plan.rejected).toEqual({})
    expect(plan.rows).toEqual([
      expect.objectContaining({ absentCount: 1, noCount: 2, notVotingCount: 1, result: "other", yesCount: 3 })
    ])
  })

  it("preserves binary results and fails closed on evidence or count mismatches", () => {
    const plan = planScraperVoteCompletenessRows(
      [
        row({ id: "vote:passed", result: "pass" }),
        row({ has_source_evidence: false, id: "vote:no-source" }),
        row({ id: "vote:bad-count", position_count: 8 }),
        row({ id: "vote:no-tally", source_yes_count: null }),
        row({ id: "vote:tally-mismatch", source_yes_count: 4 })
      ],
      "nc",
      "2025"
    )
    expect(plan.rows).toEqual([expect.objectContaining({ id: "vote:passed", result: "passed" })])
    expect(plan.rejected).toEqual({
      "missing-source-evidence": 1,
      "missing-source-tally": 1,
      "position-count-mismatch": 1,
      "source-position-tally-mismatch": 1
    })
  })

  it("hashes the complete deterministic decision set", () => {
    const plan = planScraperVoteCompletenessRows([row()], "ak", "34")
    expect(scraperVoteCompletenessPlanSha256(plan)).toBe(scraperVoteCompletenessPlanSha256(structuredClone(plan)))
    expect(scraperVoteCompletenessPlanSha256({ ...plan, rows: [] })).not.toBe(scraperVoteCompletenessPlanSha256(plan))
  })
})
