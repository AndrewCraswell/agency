import { describe, expect, it } from "vitest"
import { type ScraperPersonBackfillPlan, scraperPersonBackfillPlanSha256 } from "./scraper-person-backfill.js"

function plan(): ScraperPersonBackfillPlan {
  return {
    jurisdictionId: "jurisdiction:ak",
    positions: [
      {
        personId: "person:a",
        sourceIdentity: "vote-name:ak:a",
        sourceName: "A",
        sourcePersonId: "ocd-person/a",
        voteId: "vote:a"
      }
    ],
    sessionId: "session:ak:34",
    sponsors: [
      {
        billId: "bill:a",
        classification: "primary",
        id: "sponsor:a",
        personId: "person:a",
        sourceName: "A",
        sourcePersonId: "ocd-person/a"
      }
    ],
    state: "ak",
    session: "34",
    summary: {
      candidates: 1,
      positions: { ambiguous: 0, notFound: 0, planned: 1, total: 1 },
      sponsorConflicts: 0,
      sponsors: { ambiguous: 0, notFound: 0, planned: 1, total: 1 }
    }
  }
}

describe("scraper person relationship backfill", () => {
  it("hashes every stable source-derived decision", () => {
    const first = plan()
    expect(scraperPersonBackfillPlanSha256(first)).toBe(scraperPersonBackfillPlanSha256(structuredClone(first)))
    expect(scraperPersonBackfillPlanSha256({ ...first, positions: [] })).not.toBe(
      scraperPersonBackfillPlanSha256(first)
    )
  })
})
