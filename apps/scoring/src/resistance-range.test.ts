import { describe, expect, it } from "vitest"
import { getResistanceRange } from "./resistance-range.js"

const errors = {
  incomplete: () => new TypeError("incomplete"),
  invalid: () => new RangeError("invalid"),
  overflow: () => new RangeError("overflow")
}

describe("resistance range validation", () => {
  it("returns null only when both measurement fields are null", () => {
    expect(getResistanceRange({ resistanceMilliOhms: null, resistanceUncertaintyMilliOhms: null }, errors)).toBeNull()
  })

  it.each([
    { resistanceMilliOhms: null, resistanceUncertaintyMilliOhms: 0 },
    { resistanceMilliOhms: 0, resistanceUncertaintyMilliOhms: null }
  ])("rejects a partially null measurement: %o", (measurement) => {
    expect(() => getResistanceRange(measurement, errors)).toThrow(new TypeError("incomplete"))
  })

  it.each([
    { resistanceMilliOhms: -1, resistanceUncertaintyMilliOhms: 0 },
    { resistanceMilliOhms: 0, resistanceUncertaintyMilliOhms: -1 },
    { resistanceMilliOhms: 0.5, resistanceUncertaintyMilliOhms: 0 },
    { resistanceMilliOhms: 0, resistanceUncertaintyMilliOhms: 0.5 },
    { resistanceMilliOhms: Number.MAX_SAFE_INTEGER + 1, resistanceUncertaintyMilliOhms: 0 }
  ])("rejects non-negative safe-integer violations: %o", (measurement) => {
    expect(() => getResistanceRange(measurement, errors)).toThrow(new RangeError("invalid"))
  })

  it("accepts the maximum safe center value when uncertainty is zero", () => {
    expect(
      getResistanceRange({ resistanceMilliOhms: Number.MAX_SAFE_INTEGER, resistanceUncertaintyMilliOhms: 0 }, errors)
    ).toEqual({ max: Number.MAX_SAFE_INTEGER, min: Number.MAX_SAFE_INTEGER })
  })

  it("rejects a safe-integer center whose upper bound would overflow", () => {
    expect(() =>
      getResistanceRange({ resistanceMilliOhms: Number.MAX_SAFE_INTEGER, resistanceUncertaintyMilliOhms: 1 }, errors)
    ).toThrow(new RangeError("overflow"))
  })

  it.each([
    [0, 2, { max: 2, min: 0 }],
    [10_000, 1, { max: 10_001, min: 9_999 }],
    [1, 10, { max: 11, min: 0 }]
  ] as const)("constructs a clamped interval for %i +/- %i", (center, uncertainty, expected) => {
    expect(
      getResistanceRange({ resistanceMilliOhms: center, resistanceUncertaintyMilliOhms: uncertainty }, errors)
    ).toEqual(expected)
  })
})
