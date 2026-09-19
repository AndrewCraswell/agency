import { describe, expect, it } from "vitest"
import { resolveAgendaBillReferences } from "../../persistence/event-bill-references.js"
import { resolveEventOrganizationReferences } from "../../persistence/event-organization-references.js"
import { normalizeWashingtonScraperEvents } from "./scraper-washington-events.js"

const context = { start: "2025-01-13", end: "2025-01-19", retrievedAt: new Date("2026-09-19T00:00:00Z") }
function fixture() {
  return {
    _id: "temporary-extraction-uuid",
    upstream_id: "32346",
    name: "House Education",
    start_date: "2025-01-14T13:30:00-08:00",
    status: "cancelled",
    classification: "committee-meeting",
    sources: [{ url: "https://app.leg.wa.gov/committeeschedules/Home/Agenda/32346" }],
    extras: { agendaId: "32346", committees: [{ id: "31641", agency: "House", code: "ED", name: "House Education" }] },
    participants: [
      { name: "House Education", entity_type: "committee", note: "host", organization: { id: "untrusted" } }
    ],
    agenda: [
      { description: "Agency briefing mentions HB 9999", related_entities: [] },
      {
        description: "Testimony",
        related_entities: [{ entity_type: "bill", name: "HB 1000", bill_id: '~{"identifier":"HB 1000"}' }]
      }
    ]
  }
}

describe("Washington shared event preparation", () => {
  it("preserves cancellations, non-bill agenda, provenance and publisher time", () => {
    const [row] = normalizeWashingtonScraperEvents([fixture()], context)
    expect(row?.event).toMatchObject({
      status: "cancelled",
      sourceId: "32346",
      publisherLocalDate: "2025-01-14",
      timezone: "America/Los_Angeles",
      sourceIsOfficial: true
    })
    expect(row?.event.startAt?.toISOString()).toBe("2025-01-14T21:30:00.000Z")
    expect(row?.agendaItems).toHaveLength(2)
    expect(row?.agendaItems[0]?.billReferences).toEqual([])
    expect(row?.agendaItems[1]?.billReferences).toEqual([
      { identifier: "HB 1000", jurisdictionId: "jurisdiction:wa", sessionId: "session:wa:2025-2026" }
    ])
    expect(row?.participants[0]?.organizationId).toBeUndefined()
    expect(row?.organizationReferences).toEqual(["waCommittee:house:ED"])
  })
  it("reuses relationship resolvers and refuses unresolved or ambiguous identities", () => {
    const rows = normalizeWashingtonScraperEvents([fixture()], context)
    const resolved = resolveEventOrganizationReferences(rows, [
      { id: "org-ed", jurisdictionId: "jurisdiction:wa", upstreamIds: { "waCommittee:house:ED": "source" } }
    ])
    expect(resolved[0]?.organizationIds).toEqual(["org-ed"])
    expect(resolveEventOrganizationReferences(rows, [])[0]?.event.organizationRelationsComplete).toBe(false)
    const bills = resolveAgendaBillReferences(rows, [
      { id: "bill", identifier: "HB1000", jurisdictionId: "jurisdiction:wa", sessionId: "session:wa:2025-2026" }
    ])
    expect(bills[0]?.agendaItems[1]?.billIds).toEqual(["bill"])
  })
  it("keeps meeting identity when a new extraction changes UUID, title or scheduled time", () => {
    const [first] = normalizeWashingtonScraperEvents([fixture()], context)
    const [changed] = normalizeWashingtonScraperEvents(
      [{ ...fixture(), _id: "new-uuid", name: "New title", start_date: "2025-01-15T14:00:00-08:00" }],
      context
    )
    expect(changed?.event.id).toBe(first?.event.id)
  })
  it("rejects invalid source identity, duplicate meetings, clock offsets and scope", () => {
    for (const change of [
      { sources: [{ url: "https://example.org/32346" }] },
      { sources: [{ url: fixture().sources[0]!.url + "?token=untrusted" }] },
      { start_date: "2025-01-14T13:30:00-05:00" },
      { start_date: "2025-01-20T13:30:00-08:00" },
      { participants: [] }
    ])
      expect(() => normalizeWashingtonScraperEvents([{ ...fixture(), ...change }], context)).toThrow()
    expect(() => normalizeWashingtonScraperEvents([fixture(), fixture()], context)).toThrow(/unique/)
    expect(() => normalizeWashingtonScraperEvents([], { ...context, end: "2025-01-20" })).toThrow(/bound/)
    expect(() => normalizeWashingtonScraperEvents([], { ...context, start: "2024-01-01", end: "2024-01-01" })).toThrow(
      /session/
    )
  })
})
