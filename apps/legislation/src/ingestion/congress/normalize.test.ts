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
})
