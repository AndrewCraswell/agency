import { expect, it } from "vitest"
import { normalizeAlaskaScraperEvent } from "../ingestion/openstates/scraper-event-batch.js"
import { resolveAgendaBillReferences } from "./event-bill-references.js"

function fixture() {
  return normalizeAlaskaScraperEvent(
    {
      upstream_id: "H:FIN:2025-01-22T13:30:00-09:00",
      start_date: "2025-01-22T13:30:00-09:00",
      name: "Finance",
      status: "tentative",
      sources: [{ url: "https://www.akleg.gov/basis/Meeting/Detail?Meeting=HFIN%202025-01-22%2013:30:00" }],
      agenda: [
        {
          description: "Bill hearing",
          related_entities: [{ entity_type: "bill", name: "HB 35", bill_id: '~{"identifier":"HB 35"}' }]
        }
      ]
    },
    new Date()
  )
}
const bill = {
  id: "bill:ak:34:hb:35",
  identifier: "HB35",
  sessionId: "session:ak:34",
  jurisdictionId: "jurisdiction:ak"
}

it("resolves a unique scoped identifier without modifying input or completeness claims", () => {
  const source = fixture()
  const [result] = resolveAgendaBillReferences([source], [bill, bill])
  expect(result?.agendaItems[0]?.billIds).toEqual([bill.id])
  expect(source.agendaItems[0]?.billIds).toEqual([])
  expect(result?.agendaItems[0]?.agendaItem.billRelationsComplete).toBe(false)
})
it("does not choose between ambiguous canonical records", () => {
  expect(
    resolveAgendaBillReferences([fixture()], [bill, { ...bill, id: "bill:other" }])[0]?.agendaItems[0]?.billIds
  ).toEqual([])
})
it("does not match other sessions, jurisdictions or identifiers", () => {
  const candidates = [
    { ...bill, sessionId: "session:ak:33" },
    { ...bill, jurisdictionId: "jurisdiction:nc" },
    { ...bill, identifier: "SB35" }
  ]
  expect(resolveAgendaBillReferences([fixture()], candidates)[0]?.agendaItems[0]?.billIds).toEqual([])
})
