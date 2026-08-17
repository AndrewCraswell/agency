import { describe, expect, it } from "vitest"
import { normalizeOpenStatesEvent } from "./events.js"

describe("Open States event normalization", () => {
  it("retains schedule state and children without fabricating missing links", () => {
    const snapshot = normalizeOpenStatesEvent(
      {
        agenda: [{ classification: [], description: "Rules", order: 0 }],
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
    expect(snapshot.documents).toHaveLength(1)
  })
})
