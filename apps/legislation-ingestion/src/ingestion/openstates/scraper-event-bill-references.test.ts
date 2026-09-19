import { expect, it } from "vitest"
import { scraperEventBillReferences } from "./scraper-event-bill-references.js"

const scope = { state: "wa", session: "2025-2026", identifier: /^HB \d+$/ }
const bill = { entity_type: "bill", name: "HB 1000", bill_id: '~{"identifier":"HB 1000"}' }

it("distinguishes explicit empty lists from missing lists", () => {
  expect(scraperEventBillReferences([], scope)).toEqual({ references: [], complete: true })
  expect(scraperEventBillReferences(undefined, scope)).toEqual({ references: [], complete: false })
})

it("retains valid references but fails completeness for malformed or inconsistent bills", () => {
  expect(scraperEventBillReferences([bill], scope)).toMatchObject({
    complete: true,
    references: [{ identifier: "HB 1000" }]
  })
  for (const invalid of [
    null,
    {},
    { ...bill, bill_id: "~invalid" },
    { ...bill, name: "HB 2000" },
    { ...bill, bill_id: "ocd-bill/unknown" }
  ]) {
    const result = scraperEventBillReferences([bill, invalid], scope)
    expect(result.complete).toBe(false)
    expect(result.references).toHaveLength(1)
  }
})
