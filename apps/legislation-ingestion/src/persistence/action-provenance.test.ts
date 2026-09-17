import { expect, it } from "vitest"
import { planActionProvenance } from "./action-provenance.js"

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
