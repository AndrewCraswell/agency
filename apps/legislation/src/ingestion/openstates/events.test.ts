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
        location: { name: "State Capitol", url: "https://example.test/watch" },
        name: "Rules",
        participants: [{ entity_type: "committee", name: "Rules", note: "host" }],
        start_date: "2026-08-17T07:00:00+00:00",
        status: "confirmed",
        upstream_id: ""
      },
      { jurisdictionCode: "ca" }
    )

    expect(snapshot.event).toMatchObject({
      allDay: true,
      id: "event:openstates:ocd-event-example",
      jurisdictionId: "jurisdiction:ca",
      status: "confirmed",
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
    expect(cancelled.documents).toHaveLength(1)
    expect(cancelled.participants).toHaveLength(1)

    const deleted = normalizeOpenStatesEvent(
      { ...base, deleted: true, status: "confirmed" },
      { jurisdictionCode: "wa" }
    )
    expect(deleted.event).toMatchObject({ isDeleted: true, status: "deleted" })
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
})
