import { describe, expect, it } from "vitest"
import { textIndexSampleRanges, validateSampleStratum } from "./text-index-sample-ranges.js"

describe("bounded jurisdiction sample ranges", () => {
  it("uses alphabetic upper bounds rather than locale-sensitive punctuation", () => {
    expect(textIndexSampleRanges.map((range) => [range.prefix, range.upperBound])).toEqual([
      ["bill:ak:", "bill:al:"],
      ["bill:ca:", "bill:cb:"],
      ["bill:ny:", "bill:nz:"],
      ["bill:tx:", "bill:ty:"],
      ["bill:us:", "bill:ut:"]
    ])
    expect(textIndexSampleRanges.reduce((count, range) => count + range.target, 0)).toBe(10_000)
  })
  it.each([0, 1, 1999, 2001, Number.NaN])("rejects incomplete or invalid sample count %s", (count) => {
    expect(() => validateSampleStratum("ak", count, 2000)).toThrow("Incomplete benchmark stratum ak")
  })
  it("accepts a fully populated stratum", () => {
    expect(() => validateSampleStratum("ak", 2000, 2000)).not.toThrow()
  })
})
