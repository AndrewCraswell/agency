import { describe, expect, it } from "vitest"
import {
  evaluateFoilAntiBlockingInsulation,
  foilResistanceRange,
  type FoilInsulationObservation,
  type FoilInsulationResistanceMeasurement,
  type FoilInsulationSample
} from "./foil-insulation.js"

const UNAVAILABLE: FoilInsulationResistanceMeasurement = {
  resistanceMilliOhms: null,
  resistanceUncertaintyMilliOhms: null
}

function measured(
  resistanceMilliOhms: number,
  resistanceUncertaintyMilliOhms = 0
): FoilInsulationResistanceMeasurement {
  return { resistanceMilliOhms, resistanceUncertaintyMilliOhms }
}

function observation(
  opponentReturnResistance: FoilInsulationResistanceMeasurement,
  ownWeaponToJacketInsulation: FoilInsulationResistanceMeasurement
): FoilInsulationObservation {
  return { opponentReturnResistance, ownWeaponToJacketInsulation }
}

function sample(
  left = observation(UNAVAILABLE, UNAVAILABLE),
  right = observation(UNAVAILABLE, UNAVAILABLE)
): FoilInsulationSample {
  return { atUs: 0, left, right }
}

describe("foil anti-blocking insulation decisions", () => {
  it("validates malformed input at the public resistance-range boundary", () => {
    expect(foilResistanceRange(UNAVAILABLE)).toBeNull()
    expect(foilResistanceRange(measured(0, 2))).toEqual({ max: 2, min: 0 })
    expect(() => foilResistanceRange({ resistanceMilliOhms: null, resistanceUncertaintyMilliOhms: 0 })).toThrow(
      new RangeError("Foil insulation measurements must provide a value and uncertainty together")
    )
    expect(() => foilResistanceRange(measured(-1))).toThrow(
      new RangeError("Foil insulation measurements must use non-negative safe integer milli-ohms")
    )
  })

  it.each([
    [0, "valid-hit-eligible"],
    [199_999, "valid-hit-eligible"],
    [200_000, "valid-hit-eligible"],
    [200_001, "non-valid-hit-eligible"],
    [500_000, "non-valid-hit-eligible"]
  ] as const)("uses the documented 200 ohm scoring endpoint at %i milli-ohms", (resistanceMilliOhms, disposition) => {
    const result = evaluateFoilAntiBlockingInsulation(sample(observation(measured(resistanceMilliOhms), UNAVAILABLE)))

    expect(result.left.scoring).toEqual({
      disposition,
      rangeMilliOhms: { max: resistanceMilliOhms, min: resistanceMilliOhms }
    })
  })

  it.each([
    [449_999, "yellow-on"],
    [450_000, "indeterminate"],
    [475_000, "indeterminate"],
    [475_001, "yellow-off"]
  ] as const)(
    "keeps the 450 to 475 ohm diagnostic band unresolved at %i milli-ohms",
    (resistanceMilliOhms, disposition) => {
      const result = evaluateFoilAntiBlockingInsulation(sample(observation(UNAVAILABLE, measured(resistanceMilliOhms))))

      expect(result.left.diagnostic).toEqual({
        disposition,
        rangeMilliOhms: { max: resistanceMilliOhms, min: resistanceMilliOhms }
      })
      expect(result.left.scoring.disposition).toBe("unavailable")
    }
  )

  it("fails closed when uncertainty overlaps the 200, 450, or 475 ohm boundary", () => {
    const result = evaluateFoilAntiBlockingInsulation(
      sample(
        observation(measured(200_000, 1), measured(450_000, 1)),
        observation(measured(200_001, 1), measured(475_000, 1))
      )
    )

    expect(result.left.scoring).toEqual({
      disposition: "indeterminate",
      rangeMilliOhms: { max: 200_001, min: 199_999 }
    })
    expect(result.left.diagnostic).toEqual({
      disposition: "indeterminate",
      rangeMilliOhms: { max: 450_001, min: 449_999 }
    })
    expect(result.right.scoring).toEqual({
      disposition: "indeterminate",
      rangeMilliOhms: { max: 200_002, min: 200_000 }
    })
    expect(result.right.diagnostic).toEqual({
      disposition: "indeterminate",
      rangeMilliOhms: { max: 475_001, min: 474_999 }
    })
  })

  it("keeps both sides and the scoring and diagnostic paths independent", () => {
    const result = evaluateFoilAntiBlockingInsulation(
      sample(observation(measured(200_001), measured(0)), observation(measured(0), measured(500_000)))
    )

    expect(result).toEqual({
      atUs: 0,
      left: {
        diagnostic: { disposition: "yellow-on", rangeMilliOhms: { max: 0, min: 0 } },
        scoring: { disposition: "non-valid-hit-eligible", rangeMilliOhms: { max: 200_001, min: 200_001 } },
        side: "left"
      },
      right: {
        diagnostic: { disposition: "yellow-off", rangeMilliOhms: { max: 500_000, min: 500_000 } },
        scoring: { disposition: "valid-hit-eligible", rangeMilliOhms: { max: 0, min: 0 } },
        side: "right"
      }
    })
  })

  it("returns unavailable only for the measurement path that lacks a trusted result", () => {
    const result = evaluateFoilAntiBlockingInsulation(sample(observation(UNAVAILABLE, measured(449_999))))

    expect(result.left.scoring).toEqual({ disposition: "unavailable", rangeMilliOhms: null })
    expect(result.left.diagnostic).toEqual({
      disposition: "yellow-on",
      rangeMilliOhms: { max: 449_999, min: 449_999 }
    })
  })

  it("rejects invalid timestamps and incomplete, invalid, or unsafe resistance intervals", () => {
    const incompleteValue = observation({ resistanceMilliOhms: null, resistanceUncertaintyMilliOhms: 0 }, UNAVAILABLE)
    const incompleteUncertainty = observation(
      { resistanceMilliOhms: 0, resistanceUncertaintyMilliOhms: null },
      UNAVAILABLE
    )
    const negative = observation(measured(-1), UNAVAILABLE)
    const fractional = observation(measured(0, 0.5), UNAVAILABLE)
    const overflowing = observation(measured(Number.MAX_SAFE_INTEGER, 1), UNAVAILABLE)

    expect(() => evaluateFoilAntiBlockingInsulation({ ...sample(), atUs: -1 })).toThrow(
      new RangeError("Foil insulation samples must use non-negative safe integer timestamps")
    )
    expect(() => evaluateFoilAntiBlockingInsulation({ ...sample(), atUs: 0.5 })).toThrow(
      new RangeError("Foil insulation samples must use non-negative safe integer timestamps")
    )
    expect(() => evaluateFoilAntiBlockingInsulation({ ...sample(), atUs: Number.MAX_SAFE_INTEGER + 1 })).toThrow(
      new RangeError("Foil insulation samples must use non-negative safe integer timestamps")
    )
    expect(() => evaluateFoilAntiBlockingInsulation(sample(incompleteValue))).toThrow(
      new RangeError("Foil insulation measurements must provide a value and uncertainty together")
    )
    expect(() => evaluateFoilAntiBlockingInsulation(sample(incompleteUncertainty))).toThrow(
      new RangeError("Foil insulation measurements must provide a value and uncertainty together")
    )
    expect(() => evaluateFoilAntiBlockingInsulation(sample(negative))).toThrow(
      new RangeError("Foil insulation measurements must use non-negative safe integer milli-ohms")
    )
    expect(() => evaluateFoilAntiBlockingInsulation(sample(fractional))).toThrow(
      new RangeError("Foil insulation measurements must use non-negative safe integer milli-ohms")
    )
    expect(() => evaluateFoilAntiBlockingInsulation(sample(overflowing))).toThrow(
      new RangeError("Foil insulation measurement ranges must remain safe integers")
    )
  })
})
