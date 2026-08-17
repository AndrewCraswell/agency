import { readFile } from "node:fs/promises"
import { beforeAll, describe, expect, it } from "vitest"
import { normalizeCongressBillBundle } from "./normalize.js"

let fixture: unknown

beforeAll(async () => {
  fixture = JSON.parse(
    await readFile(new URL("../../../tests/fixtures/congress/119-hr-1234.json", import.meta.url), "utf8")
  )
})

describe("Congress.gov normalization", () => {
  it("updates the same canonical federal bill as GovInfo while preserving omitted documents", () => {
    const aggregate = normalizeCongressBillBundle(fixture)
    expect(aggregate.bill).toMatchObject({
      id: "bill:us:119:hr:1234",
      summary: "Requires publication of structured legislative data and machine-readable updates.",
      upstreamIds: { congress: "119-hr-1234" }
    })
    expect(aggregate.actions).toHaveLength(3)
    expect(aggregate.people).toHaveLength(2)
    expect(aggregate.sponsors).toHaveLength(2)
    expect(aggregate.documents).toBeUndefined()
  })

  it("rejects malformed API bundles", () => {
    expect(() => normalizeCongressBillBundle({ bill: { congress: 119 } })).toThrow("Invalid input")
  })

  it("accepts null optional fields in older Congress records", () => {
    const source = structuredClone(fixture) as Record<string, unknown>
    source.textVersions = [
      { date: null, formats: [{ type: "PDF", url: "https://www.congress.gov/older.pdf" }], type: "Introduced" }
    ]
    const bill = source.bill as Record<string, unknown>
    bill.introducedDate = null
    bill.originChamber = null

    const aggregate = normalizeCongressBillBundle(source)

    expect(aggregate.bill.introducedAt).toBeUndefined()
    expect(aggregate.documents?.[0]?.document).toMatchObject({
      documentDate: undefined,
      sourceUrl: "https://www.congress.gov/older.pdf"
    })
  })
})
