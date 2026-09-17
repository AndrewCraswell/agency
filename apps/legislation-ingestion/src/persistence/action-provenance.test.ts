import { expect, it } from "vitest"
import { parseActionProvenanceScope, planActionProvenance } from "./action-provenance.js"

it.each([
  { state: "ak", session: "34", billId: "bill:ak:34:hb:1", jurisdictionName: "Alaska" },
  { state: "nc", session: "2025-2026", billId: "bill:nc:2025-2026:sb:1", jurisdictionName: "North Carolina" },
  { state: "ca", session: "20232024", billId: "bill:ca:20232024:ab:2652", jurisdictionName: "California" }
])("accepts the authorized action repair scope: $billId", ({ state, session, billId, jurisdictionName }) => {
  expect(parseActionProvenanceScope({ state, session, billId })).toEqual({ state, session, jurisdictionName })
})

it.each([
  { state: "ca", session: "20232024", billId: "bill:ca:20232024:ab:2653" },
  { state: "ca", session: "20252026", billId: "bill:ca:20252026:ab:2652" },
  { state: "ca", session: "20232024", billId: "bill:ca:20232024:sb:2652" },
  { state: "ca", session: "20232024", billId: "bill:ca:20232024:ab:2652:other" },
  { state: "ca", session: "20252026", billId: "bill:ca:20232024:ab:2652" },
  { state: "ak", session: "34", billId: "bill:ca:20232024:ab:2652" },
  { state: "ny", session: "2023-2024", billId: "bill:ny:2023-2024:ab:2652" }
])("rejects action repair outside the authorized scope: %j", (scope) => {
  expect(() => parseActionProvenanceScope(scope)).toThrow()
})

const source = {
  id: "action:1",
  ordinal: 0,
  description: "Introduced",
  classification: ["introduction"],
  actionDate: "2025-01-21",
  sourceUrl: "https://example.org/bill/1"
}
const stored = { ...source, sourceUrl: null }

it("fills missing provenance and becomes a no-op when already reconciled", () => {
  expect(planActionProvenance([source], [stored])).toEqual([{ id: source.id, sourceUrl: source.sourceUrl }])
  expect(planActionProvenance([source], [source])).toEqual([])
})

it.each([
  { id: "other" },
  { ordinal: 1 },
  { description: "Passed" },
  { actionDate: "2025-02-01" },
  { classification: ["passage"] },
  { sourceUrl: "https://example.org/other" }
])("rejects changed timeline fields or conflicting provenance: %j", (change) => {
  expect(() => planActionProvenance([source], [{ ...stored, ...change }])).toThrow()
})

it("rejects absent and duplicate records instead of inferring a partial match", () => {
  expect(() => planActionProvenance([source], [])).toThrow()
  expect(() => planActionProvenance([source, source], [stored, stored])).toThrow()
  expect(() => planActionProvenance([], [])).toThrow()
})

it("rejects source evidence without provenance", () => {
  expect(() => planActionProvenance([stored], [stored])).toThrow()
})
