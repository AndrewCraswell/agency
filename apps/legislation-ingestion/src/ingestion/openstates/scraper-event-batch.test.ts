import { describe, expect, it } from "vitest"
import { normalizeAlaskaScraperEvent } from "./scraper-event-batch.js"

function fixture() {
  return {
    upstream_id: "H:FIN:2025-01-22T13:30:00-09:00",
    start_date: "2025-01-22T14:30:00-08:00",
    name: "Finance",
    status: "tentative",
    location: { name: "" },
    sources: [{ url: "https://www.akleg.gov/basis/Meeting/Detail?Meeting=HFIN%202025-01-22%2013:30:00" }],
    participants: [{ name: "Finance", organization: { id: "untrusted" } }],
    agenda: [{ description: "Budget", related_entities: [] }]
  }
}

describe("Alaska event normalization", () => {
  it("declares readiness only for an explicit single host; persistence must resolve its source code", () => {
    const input = { ...fixture(), participants: [{ entity_type: "committee", note: "host", name: "HOUSE FINANCE" }] }
    const accepted = normalizeAlaskaScraperEvent(input, new Date())
    expect(accepted.event).toMatchObject({
      sessionRelationsComplete: true,
      organizationRelationsComplete: true,
      canonicalFactsComplete: true
    })
    expect(normalizeAlaskaScraperEvent({ ...input, participants: [] }, new Date()).event.canonicalFactsComplete).toBe(
      false
    )
    expect(
      normalizeAlaskaScraperEvent(
        { ...input, participants: [...input.participants, ...input.participants] },
        new Date()
      ).event.organizationRelationsComplete
    ).toBe(false)
  })
  it("retains explicit bill references but does not guess from descriptions or conflicting names", () => {
    const result = normalizeAlaskaScraperEvent(
      {
        ...fixture(),
        agenda: [
          {
            description: "HB 999 mentioned in prose",
            related_entities: [
              { entity_type: "bill", name: "HB 35", bill_id: '~{"identifier":"HB 35"}' },
              { entity_type: "bill", name: "HB 36", bill_id: '~{"identifier":"HB 37"}' }
            ]
          }
        ]
      },
      new Date()
    )
    expect(result.agendaItems[0]?.billReferences).toEqual([
      { identifier: "HB 35", jurisdictionId: "jurisdiction:ak", sessionId: "session:ak:34" }
    ])
    expect(result.agendaItems[0]?.billIds).toEqual([])
    expect(result.agendaItems[0]?.agendaItem.billRelationsComplete).toBe(false)
  })
  it("retains publisher committee codes containing ampersands", () => {
    const result = normalizeAlaskaScraperEvent(
      {
        ...fixture(),
        upstream_id: "H:L&C:2025-01-22T13:30:00-09:00",
        sources: [{ url: "https://www.akleg.gov/basis/Meeting/Detail?Meeting=HL%26C%202025-01-22%2013:30:00" }]
      },
      new Date()
    )
    expect(result.event.sourceId).toBe("H:L&C:2025-01-22T13:30:00-09:00")
  })
  it("preserves publisher time and agenda without guessing organization identities", () => {
    const result = normalizeAlaskaScraperEvent(fixture(), new Date())
    expect(result.event.publisherLocalDate).toBe("2025-01-22")
    expect(result.event.startAt?.toISOString()).toBe("2025-01-22T22:30:00.000Z")
    expect(result.event.sourceId).toBe(fixture().upstream_id)
    expect(result.agendaItems).toHaveLength(1)
    expect(result.organizationIds).toEqual([])
    expect(result.sessionIds).toEqual(["session:ak:34"])
  })
  it("keeps identity across title and location corrections but not rescheduling", () => {
    const input = fixture()
    const first = normalizeAlaskaScraperEvent(input, new Date())
    const corrected = normalizeAlaskaScraperEvent(
      { ...input, name: "Corrected", location: { name: "New room" } },
      new Date()
    )
    expect(corrected.event.id).toBe(first.event.id)
    const rescheduled = normalizeAlaskaScraperEvent(
      {
        ...input,
        upstream_id: "H:FIN:2025-01-22T14:30:00-09:00",
        start_date: "2025-01-22T14:30:00-09:00",
        sources: [{ url: "https://www.akleg.gov/basis/Meeting/Detail?Meeting=HFIN%202025-01-22%2014:30:00" }]
      },
      new Date()
    )
    expect(rescheduled.event.id).not.toBe(first.event.id)
  })
  it("rejects timestamp disagreement and mismatched official source", () => {
    expect(() =>
      normalizeAlaskaScraperEvent({ ...fixture(), start_date: "2025-01-22T15:30:00-08:00" }, new Date())
    ).toThrow(/timestamp disagrees/)
    expect(() =>
      normalizeAlaskaScraperEvent({ ...fixture(), sources: [{ url: "https://example.org/" }] }, new Date())
    ).toThrow(/matching official/)
  })
})
