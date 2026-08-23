import { describe, expect, it } from "vitest"
import {
  classifyFoilClosedCircuitResistance,
  classifyFoilEarthContactResistance,
  classifyFoilExteriorResistance,
  classifyFoilLogicalContext
} from "./foil-evidence.js"
import type { FoilInsulationResistanceMeasurement } from "./foil-insulation.js"

const UNAVAILABLE: FoilInsulationResistanceMeasurement = {
  resistanceMilliOhms: null,
  resistanceUncertaintyMilliOhms: null
}

function measured(resistanceMilliOhms: number, resistanceUncertaintyMilliOhms = 0) {
  return { resistanceMilliOhms, resistanceUncertaintyMilliOhms }
}

describe("foil host evidence classifications", () => {
  it.each([
    [0, "required-indication", ["valid"]],
    [200_000, "required-indication", ["valid"]],
    [200_001, "permitted-indications", ["valid", "valid-and-non-valid", "non-valid"]],
    [499_999, "permitted-indications", ["valid", "valid-and-non-valid", "non-valid"]],
    [500_000, "outside-published-range", []]
  ] as const)("classifies the exterior resistance boundary at %i milli-ohms", (value, disposition, indications) => {
    expect(classifyFoilExteriorResistance(measured(value))).toEqual({
      disposition,
      permittedIndications: indications,
      rangeMilliOhms: { max: value, min: value }
    })
  })

  it("fails closed for unavailable or boundary-overlapping exterior resistance", () => {
    expect(classifyFoilExteriorResistance(UNAVAILABLE)).toEqual({
      disposition: "unavailable",
      permittedIndications: [],
      rangeMilliOhms: null
    })
    expect(classifyFoilExteriorResistance(measured(200_000, 1))).toMatchObject({
      disposition: "indeterminate",
      permittedIndications: []
    })
    expect(classifyFoilExteriorResistance(measured(500_000, 1))).toMatchObject({
      disposition: "indeterminate",
      permittedIndications: []
    })
  })

  it.each([
    [0, "must-not-produce-non-valid"],
    [200_000, "must-not-produce-non-valid"],
    [200_001, "outside-published-range"]
  ] as const)("classifies closed-circuit resistance at %i milli-ohms", (value, disposition) => {
    expect(classifyFoilClosedCircuitResistance(measured(value))).toMatchObject({ disposition })
  })

  it("fails closed for unavailable or boundary-overlapping closed-circuit resistance", () => {
    expect(classifyFoilClosedCircuitResistance(UNAVAILABLE)).toEqual({
      disposition: "unavailable",
      rangeMilliOhms: null
    })
    expect(classifyFoilClosedCircuitResistance(measured(200_000, 1))).toMatchObject({ disposition: "indeterminate" })
  })

  it.each([
    [0, "must-not-signal"],
    [100_000, "must-not-signal"],
    [100_001, "outside-published-range"]
  ] as const)("classifies guard or piste earth resistance at %i milli-ohms", (value, disposition) => {
    expect(classifyFoilEarthContactResistance(measured(value))).toMatchObject({ disposition })
  })

  it("fails closed for unavailable or boundary-overlapping earth resistance", () => {
    expect(classifyFoilEarthContactResistance(UNAVAILABLE)).toEqual({
      disposition: "unavailable",
      rangeMilliOhms: null
    })
    expect(classifyFoilEarthContactResistance(measured(100_000, 1))).toMatchObject({ disposition: "indeterminate" })
  })

  it.each([
    ["standard", "guard-or-piste", "must-not-signal"],
    ["anti-blocking", "guard-or-piste", "must-not-signal"],
    ["standard", "conductive-jacket-without-tip-break", "must-not-signal"],
    ["anti-blocking", "conductive-jacket-without-tip-break", "must-not-signal"],
    ["standard", "blade-contact", "normal-contact-rules-apply"],
    ["anti-blocking", "blade-contact", "not-specified"],
    ["standard", "own-weapon-to-jacket-insulation-short", "not-specified"],
    ["anti-blocking", "own-weapon-to-jacket-insulation-short", "does-not-block-contact-scorer"]
  ] as const)("classifies %s %s as %s", (mode, context, disposition) => {
    expect(classifyFoilLogicalContext(mode, context)).toEqual({ disposition })
  })

  it("reuses strict resistance validation", () => {
    expect(() => classifyFoilExteriorResistance(measured(-1))).toThrow(
      new RangeError("Foil insulation measurements must use non-negative safe integer milli-ohms")
    )
  })
})
