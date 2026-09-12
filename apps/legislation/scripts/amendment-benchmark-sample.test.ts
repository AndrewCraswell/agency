import { describe, expect, it } from "vitest"
import { selectAmendmentSample } from "./amendment-benchmark-sample.js"

describe("balanced amendment sampling", () => {
  it("caps each jurisdiction separately and ignores source date ordering", () => {
    const ids = ["bill:ca:1", "bill:ca:2", "bill:co:1", "bill:co:2", "bill:us:1"]
    const selected = selectAmendmentSample(ids, 1)
    expect(selected.map(({ jurisdiction, ids: documents }) => [jurisdiction, documents.length])).toEqual([
      ["ca", 1],
      ["co", 1],
      ["us", 1]
    ])
    expect(selectAmendmentSample([...ids].reverse(), 1)).toEqual(selected)
  })
  it("deduplicates keys and rejects unknown identifier formats", () => {
    expect(selectAmendmentSample(["bill:ca:1", "bill:ca:1"])[0]?.available).toBe(1)
    expect(() => selectAmendmentSample(["unknown"])).toThrow("Unrecognized")
  })
  it.each([0, -1, 1.5, 1001, Number.NaN])("rejects invalid per-jurisdiction bounds: %s", (limit) => {
    expect(() => selectAmendmentSample([], limit)).toThrow("Sample size")
  })
})
