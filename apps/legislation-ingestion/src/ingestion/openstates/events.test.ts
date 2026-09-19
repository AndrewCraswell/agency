import { describe, expect, it } from "vitest"
import { normalizeOpenStatesEvent } from "./events.js"

describe("Open States event normalization", () => {
  it("retains schedule state and children without fabricating missing links", () => {
    const snapshot = normalizeOpenStatesEvent(
      {
        agenda: [
          {
            classification: [],
            description: "Rules",
            order: 0,
            status: "in-progress",
            title: "Rules agenda"
          }
        ],
        all_day: true,
        classification: "committee-meeting",
        deleted: false,
        documents: [
          {
            links: [{ media_type: "application/pdf", text: "Agenda", url: "https://example.test/agenda.pdf" }]
          }
        ],
        end_date: "",
        id: "ocd-event/example",
        is_remote: true,
        location: { name: "State Capitol", url: "https://example.test/watch" },
        name: "Rules",
        participants: [{ entity_type: "committee", name: "Rules", note: "host" }],
        start_date: "2026-08-17T07:00:00+00:00",
        status: "confirmed",
        timezone: "America/Los_Angeles",
        upstream_id: ""
      },
      { jurisdictionCode: "ca" }
    )

    expect(snapshot.event).toMatchObject({
      allDay: true,
      id: "event:openstates:ocd-event-example",
      jurisdictionId: "jurisdiction:ca",
      isRemote: true,
      status: "scheduled",
      timezone: "America/Los_Angeles",
      virtualAccess: { url: "https://example.test/watch" }
    })
    expect(snapshot.event.endAt).toBeUndefined()
    expect(snapshot.participants).toHaveLength(1)
    expect(snapshot.agendaItems).toHaveLength(1)
    expect(snapshot.agendaItems[0]).toMatchObject({
      agendaItem: {
        amendmentRelationsComplete: false,
        billRelationsComplete: false,
        canonicalFactsComplete: true,
        description: "Rules",
        materialRelationsComplete: false,
        status: "in-progress",
        title: "Rules agenda"
      },
      amendmentIds: [],
      billIds: [],
      materialIds: []
    })
    expect(snapshot.documents).toHaveLength(1)
  })

  it("normalizes cancellation and deletion state and deduplicates provider children", () => {
    const base = {
      agenda: [
        { classification: [], description: "First description", order: 0 },
        { classification: ["bill"], description: "Corrected description", order: 0 }
      ],
      all_day: false,
      classification: "committee-meeting",
      deleted: false,
      documents: [
        { links: [{ text: "Agenda", url: "https://example.test/agenda.pdf" }] },
        { links: [{ text: "Duplicate agenda", url: "https://example.test/agenda.pdf" }] }
      ],
      id: "ocd-event/repeated",
      name: "Repeated source children",
      participants: [
        { entity_type: "committee", name: "Rules" },
        { entity_type: "committee", name: "Rules" }
      ],
      start_date: "2026-08-17T10:00:00-07:00",
      status: "canceled"
    }
    const cancelled = normalizeOpenStatesEvent(base, { jurisdictionCode: "wa" })
    expect(cancelled.event.status).toBe("cancelled")
    expect(cancelled.agendaItems).toHaveLength(1)
    expect(cancelled.agendaItems[0]?.agendaItem.description).toBe("Corrected description")
    expect(cancelled.agendaItems[0]?.agendaItem.title).toBe("Corrected description")
    expect(cancelled.documents).toHaveLength(1)
    expect(cancelled.participants).toHaveLength(1)

    const deleted = normalizeOpenStatesEvent(
      { ...base, deleted: true, status: "confirmed" },
      { jurisdictionCode: "wa" }
    )
    expect(deleted.event).toMatchObject({ isDeleted: true, status: "scheduled" })
    expect(deleted.event.id).toBe(cancelled.event.id)
  })

  it("retains an agenda item with missing optional facts as incomplete", () => {
    const snapshot = normalizeOpenStatesEvent(
      {
        agenda: [{ classification: [], order: 0 }],
        id: "ocd-event/incomplete-agenda",
        name: "Incomplete agenda",
        start_date: "2026-08-17T10:00:00-07:00",
        status: "confirmed"
      },
      { jurisdictionCode: "wa" }
    )

    expect(snapshot.agendaItems[0]).toMatchObject({
      agendaItem: {
        amendmentRelationsComplete: false,
        billRelationsComplete: false,
        canonicalFactsComplete: false,
        materialRelationsComplete: false,
        title: undefined
      }
    })
    expect(snapshot.agendaItems[0]?.agendaItem.description).toBeUndefined()
  })

  it("retains actual participant and agenda evidence without fabricating complete meeting relationships", () => {
    const snapshot = normalizeOpenStatesEvent(
      {
        agenda: [
          {
            classification: [],
            order: 0,
            related_entities: [{ bill: { session: "2026" }, entity_type: "bill" }]
          }
        ],
        classification: "committee-meeting",
        id: "ocd-event/source-evidence",
        name: "Rules Committee",
        participants: [
          {
            entity_type: "organization",
            name: "Rules Committee",
            organization: { id: "ocd-organization/committee:rules" }
          }
        ],
        sources: [{ url: "https://leg.example.test/events/source-evidence" }],
        start_date: "2026-08-17T10:00:00-07:00",
        status: "confirmed"
      },
      { jurisdictionCode: "wa", retrievedAt: new Date("2026-08-01T00:00:00Z") }
    )

    expect(snapshot.event).toMatchObject({
      canonicalFactsComplete: false,
      classification: "meeting",
      organizationRelationsComplete: false,
      provenanceComplete: true,
      publisherLocalDate: "2026-08-17",
      sessionRelationsComplete: false,
      sourceIsOfficial: false,
      sourceProvider: "openstates",
      status: "scheduled"
    })
    expect(snapshot.event.isRemote).toBeUndefined()
    expect(snapshot.organizationIds).toEqual([])
    expect(snapshot.sessionIds).toEqual(["session:wa:2026"])
    expect(snapshot.participants[0]?.organizationId).toBe("organization:openstates:ocd-organization-committee-rules")
  })

  it("leaves a record incomplete when the publisher omits remote or relationship facts", () => {
    const snapshot = normalizeOpenStatesEvent(
      {
        id: "ocd-event/no-inference",
        name: "No inference",
        sources: [{ url: "https://leg.example.test/events/no-inference" }],
        start_date: "2026-08-17T10:00:00-07:00",
        status: "confirmed"
      },
      { jurisdictionCode: "wa", retrievedAt: new Date("2026-08-01T00:00:00Z") }
    )

    expect(snapshot.event).toMatchObject({
      canonicalFactsComplete: false,
      organizationRelationsComplete: false,
      sessionRelationsComplete: false
    })
    expect(snapshot.organizationIds).toEqual([])
    expect(snapshot.sessionIds).toEqual([])
  })

  it("does not mark HTTP-only provenance complete", () => {
    const snapshot = normalizeOpenStatesEvent(
      {
        id: "ocd-event/http-source",
        name: "HTTP source",
        sources: [{ url: "http://leg.example.test/events/http-source" }],
        start_date: "2026-08-17T10:00:00-07:00",
        status: "confirmed"
      },
      { jurisdictionCode: "wa", retrievedAt: new Date("2026-08-01T00:00:00Z") }
    )

    expect(snapshot.event).toMatchObject({ canonicalFactsComplete: false, provenanceComplete: false })
  })

  it("converges an NC API event on its exact official notice identity", () => {
    const snapshot = normalizeOpenStatesEvent(
      {
        id: "ocd-event/api-uuid",
        name: "Child Fatality Task Force",
        sources: [
          { url: "https://www.ncleg.gov/Committees/CommitteeInfo/NonStanding/680" },
          { url: "https://www.ncleg.gov/Committees/NoticeDocument/12345/CommitteeMeetingNotice" }
        ],
        start_date: "2026-09-21T13:00:00-04:00",
        status: "confirmed",
        upstream_id: "12345"
      },
      { jurisdictionCode: "nc", retrievedAt: new Date("2026-09-17T00:00:00Z") }
    )

    expect(snapshot.event).toMatchObject({
      id: "event:openstates:nc-notice-12345",
      organizationRelationsComplete: true,
      sourceId: "nc-notice-12345",
      sourceUrl: "https://www.ncleg.gov/Committees/NoticeDocument/12345/CommitteeMeetingNotice",
      upstreamIds: { ncNoticeDocument: "12345", openstates: "ocd-event/api-uuid" }
    })
    expect(snapshot.organizationReferences).toEqual([["ncCommittee:NonStanding:680"]])
  })

  it("does not trust an NC numeric upstream ID without its matching notice URL", () => {
    const snapshot = normalizeOpenStatesEvent(
      {
        id: "ocd-event/api-uuid",
        name: "Child Fatality Task Force",
        sources: [{ url: "https://www.ncleg.gov/Committees/CommitteeInfo/NonStanding/680" }],
        start_date: "2026-09-21T13:00:00-04:00",
        status: "confirmed",
        upstream_id: "12345"
      },
      { jurisdictionCode: "nc", retrievedAt: new Date("2026-09-17T00:00:00Z") }
    )

    expect(snapshot.event).toMatchObject({
      id: "event:openstates:ocd-event-api-uuid",
      sourceId: "ocd-event/api-uuid",
      upstreamIds: { openstates: "ocd-event/api-uuid", provider: "12345" }
    })
  })
})
