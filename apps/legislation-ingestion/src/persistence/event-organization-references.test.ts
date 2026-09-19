import { expect, it } from "vitest"
import { normalizeAlaskaScraperEvent } from "../ingestion/openstates/scraper-event-batch.js"
import { resolveEventOrganizationReferences } from "./event-organization-references.js"

it("requires unique same-jurisdiction resolution for every source organization reference", () => {
  const snapshot = normalizeAlaskaScraperEvent(
    {
      upstream_id: "H:FIN:2025-01-22T13:30:00-09:00",
      start_date: "2025-01-22T22:30:00+00:00",
      name: "HOUSE FINANCE",
      status: "tentative",
      sources: [{ url: "https://www.akleg.gov/basis/Meeting/Detail?Meeting=HFIN%202025-01-22%2013:30:00" }],
      participants: [{ entity_type: "committee", note: "host", name: "HOUSE FINANCE" }]
    },
    new Date()
  )
  const candidate = {
    id: "organization:finance",
    jurisdictionId: "jurisdiction:ak",
    upstreamIds: { "akCommittee:34:HFIN": "source" }
  }
  expect(resolveEventOrganizationReferences([snapshot], [candidate])[0]?.event.organizationRelationsComplete).toBe(true)
  for (const candidates of [
    [],
    [{ ...candidate, jurisdictionId: "jurisdiction:nc" }],
    [candidate, { ...candidate, id: "organization:other" }]
  ]) {
    const result = resolveEventOrganizationReferences([snapshot], candidates)[0]
    expect(result?.event.organizationRelationsComplete).toBe(false)
    expect(result?.organizationIds).toEqual([])
  }
  expect(snapshot.event.organizationRelationsComplete).toBe(true)

  const aliases = { ...snapshot, organizationReferences: [["publisher:id:42", "akCommittee:34:HFIN"]] }
  const byStableId = { ...candidate, upstreamIds: { "publisher:id:42": "source" } }
  const byBoth = { ...candidate, upstreamIds: { ...candidate.upstreamIds, ...byStableId.upstreamIds } }
  for (const candidates of [[candidate], [byStableId], [byBoth], [candidate, byStableId]]) {
    const result = resolveEventOrganizationReferences([aliases], candidates)[0]
    expect(result?.event.organizationRelationsComplete).toBe(true)
    expect(result?.organizationIds).toEqual([candidate.id])
  }
  const conflicting = resolveEventOrganizationReferences(
    [aliases],
    [candidate, { ...byStableId, id: "organization:conflict" }]
  )[0]
  expect(conflicting?.event.organizationRelationsComplete).toBe(false)
  expect(conflicting?.organizationIds).toEqual([])

  for (const organizationReferences of [[[]], [["publisher:missing"]], [["akCommittee:34:HFIN"], []]]) {
    const result = resolveEventOrganizationReferences([{ ...snapshot, organizationReferences }], [candidate])[0]
    expect(result?.event.organizationRelationsComplete).toBe(false)
  }
  const twoHosts = resolveEventOrganizationReferences(
    [{ ...snapshot, organizationReferences: [["akCommittee:34:HFIN"], ["publisher:id:42"]] }],
    [candidate, { ...byStableId, id: "organization:second" }]
  )[0]
  expect(twoHosts?.event.organizationRelationsComplete).toBe(true)
  expect(twoHosts?.organizationIds).toEqual([candidate.id, "organization:second"])
  expect(
    resolveEventOrganizationReferences(
      [{ ...aliases, event: { ...aliases.event, organizationRelationsComplete: false } }],
      [byBoth]
    )[0]?.event.organizationRelationsComplete
  ).toBe(false)
})
