import { describe, expect, it } from "vitest"
import type { LegislationDatabase } from "../database.js"
import { normalizeCanonicalEventOutcome, upsertCanonicalEventOutcomes } from "./event-outcomes.js"

function canonicalOutcome() {
  return {
    actionId: "action:us:119:hr:1:2",
    agendaAssociation: "explicit",
    agendaItemId: "agenda:us:119:hearing:1:2",
    classification: "action",
    description: "Committee recommendation adopted",
    occurredAt: new Date("2026-08-23T15:30:00.000Z"),
    occurredDate: "2026-08-23",
    eventId: "meeting:us:119:hearing:1",
    id: "outcome:us:119:hearing:1:2",
    linkMethod: "explicit",
    sourceIsOfficial: true,
    sourceProvider: "Congress.gov",
    sourceRetrievedAt: new Date("2026-08-24T15:00:00.000Z"),
    sourceSequence: 2,
    sourceUpdatedAt: new Date("2026-08-23T15:00:00.000Z"),
    sourceUrl: "https://api.congress.gov/v3/committee-meeting/1"
  }
}

describe("canonical event outcome ingestion", () => {
  it("does not touch persistence for an empty canonical batch", async () => {
    await expect(upsertCanonicalEventOutcomes({} as LegislationDatabase, [])).resolves.toBeUndefined()
  })

  it("retains only explicit, complete canonical facts", () => {
    expect(normalizeCanonicalEventOutcome(canonicalOutcome())).toMatchObject({
      actionId: "action:us:119:hr:1:2",
      agendaAssociation: "explicit",
      agendaItemId: "agenda:us:119:hearing:1:2",
      classification: "action",
      description: "Committee recommendation adopted",
      occurredAt: new Date("2026-08-23T15:30:00.000Z"),
      occurredDate: "2026-08-23",
      sourceSequence: 2,
      voteId: null
    })
  })

  it("rejects unknown agenda association and relationship-derived target shapes", () => {
    expect(() => normalizeCanonicalEventOutcome({ ...canonicalOutcome(), agendaAssociation: "unknown" })).toThrow(
      "Agenda association must be explicitly complete"
    )
    expect(() => normalizeCanonicalEventOutcome({ ...canonicalOutcome(), actionId: undefined })).toThrow(
      "Outcome target must match its canonical classification"
    )
    expect(() => normalizeCanonicalEventOutcome({ ...canonicalOutcome(), voteId: "vote:us:119:1" })).toThrow(
      "Outcome target must match its canonical classification"
    )
  })

  it("rejects incomplete description and provenance instead of fabricating canonical data", () => {
    expect(() => normalizeCanonicalEventOutcome({ ...canonicalOutcome(), description: " " })).toThrow(
      "description must be non-empty"
    )
    expect(() =>
      normalizeCanonicalEventOutcome({ ...canonicalOutcome(), sourceUrl: "http://example.test/outcome" })
    ).toThrow("sourceUrl must use HTTPS")
    expect(() => normalizeCanonicalEventOutcome({ ...canonicalOutcome(), sourceRetrievedAt: undefined })).toThrow(
      "sourceRetrievedAt must be a valid Date"
    )
    expect(() => normalizeCanonicalEventOutcome({ ...canonicalOutcome(), sourceSequence: -1 })).toThrow(
      "sourceSequence must be a non-negative integer"
    )
    expect(() => normalizeCanonicalEventOutcome({ ...canonicalOutcome(), occurredAt: undefined })).toThrow(
      "occurredAt must be a valid Date"
    )
  })
})
