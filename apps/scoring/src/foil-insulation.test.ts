import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import {
  evaluateFoilAntiBlockingInsulation,
  foilResistanceRange,
  type FoilInsulationObservation,
  type FoilInsulationResistanceMeasurement,
  type FoilReturnCircuitScoringDisposition,
  type FoilInsulationSample
} from "./foil-insulation.js"

type BoundaryVector = {
  id: string
  returnResistance: FoilInsulationResistanceMeasurement
  insulationResistance: FoilInsulationResistanceMeasurement
  expected: {
    scoring: FoilReturnCircuitScoringDisposition
    diagnostic: "yellow-on" | "yellow-off" | "indeterminate" | "unavailable"
  }
}

type BoundaryFixture = {
  format: "foil-insulation-boundary-vectors"
  schemaVersion: "1.0.0"
  source: { authority: "fie"; document: string; sha256: string; page: number; locator: string }
  vectors: BoundaryVector[]
}

type BoundarySource = BoundaryFixture["source"]

function isScoringDisposition(value: unknown): value is FoilReturnCircuitScoringDisposition {
  return (
    value === "valid-hit-eligible" ||
    value === "non-valid-hit-eligible" ||
    value === "indeterminate" ||
    value === "unavailable"
  )
}

function isDiagnosticDisposition(value: unknown): value is BoundaryVector["expected"]["diagnostic"] {
  return value === "yellow-on" || value === "yellow-off" || value === "indeterminate" || value === "unavailable"
}

function isMeasurement(value: unknown): value is FoilInsulationResistanceMeasurement {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false
  const candidate = value as Record<string, unknown>
  const resistance = candidate.resistanceMilliOhms
  const uncertainty = candidate.resistanceUncertaintyMilliOhms
  if (resistance === null && uncertainty === null) return true
  if (
    typeof resistance !== "number" ||
    typeof uncertainty !== "number" ||
    !Number.isFinite(resistance) ||
    !Number.isFinite(uncertainty) ||
    !Number.isSafeInteger(resistance) ||
    !Number.isSafeInteger(uncertainty) ||
    resistance < 0 ||
    uncertainty < 0
  )
    return false
  return resistance <= Number.MAX_SAFE_INTEGER - uncertainty
}

function isBoundarySource(value: unknown): value is BoundarySource {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false
  const candidate = value as Record<string, unknown>
  return (
    candidate.authority === "fie" &&
    candidate.document === "fie-material-rules-2026-08-en.pdf" &&
    typeof candidate.sha256 === "string" &&
    /^[0-9A-F]{64}$/.test(candidate.sha256) &&
    typeof candidate.page === "number" &&
    Number.isSafeInteger(candidate.page) &&
    candidate.page >= 1 &&
    typeof candidate.locator === "string"
  )
}

function readBoundaryFixture(): BoundaryFixture {
  const parsed: unknown = JSON.parse(
    readFileSync(new URL("../fixtures/foil-insulation-boundary-vectors.json", import.meta.url), "utf8")
  )
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new TypeError("Foil insulation boundary fixture must be an object")
  }
  const candidate = parsed as Record<string, unknown>
  if (candidate.format !== "foil-insulation-boundary-vectors" || candidate.schemaVersion !== "1.0.0") {
    throw new TypeError("Foil insulation boundary fixture has an unsupported identity")
  }
  const source = candidate.source
  if (!isBoundarySource(source)) {
    throw new TypeError("Foil insulation boundary fixture has an incomplete source")
  }
  const repositoryRoot = resolve(import.meta.dirname, "../../..")
  const sourcePath = resolve(repositoryRoot, "apps/scoring/docs/specifications/fie-material-rules-2026-08-en.pdf")
  const actualSourceDigest = createHash("sha256").update(readFileSync(sourcePath)).digest("hex").toUpperCase()
  if (actualSourceDigest !== source.sha256) {
    throw new TypeError("Foil insulation boundary fixture source digest does not match the local FIE PDF")
  }
  if (!Array.isArray(candidate.vectors)) throw new TypeError("Foil insulation boundary fixture must list vectors")
  const vectors: BoundaryVector[] = []
  const vectorIds = new Set<string>()
  for (const vector of candidate.vectors) {
    if (typeof vector !== "object" || vector === null || Array.isArray(vector)) {
      throw new TypeError("Foil insulation boundary fixture contains a malformed vector")
    }
    const candidateVector = vector as Record<string, unknown>
    const expected = candidateVector.expected
    if (
      typeof candidateVector.id !== "string" ||
      candidateVector.id.length === 0 ||
      !isMeasurement(candidateVector.returnResistance) ||
      !isMeasurement(candidateVector.insulationResistance) ||
      typeof expected !== "object" ||
      expected === null ||
      Array.isArray(expected)
    ) {
      throw new TypeError("Foil insulation boundary fixture contains an incomplete vector")
    }
    if (vectorIds.has(candidateVector.id)) {
      throw new TypeError(`Foil insulation boundary fixture repeats vector id ${candidateVector.id}`)
    }
    vectorIds.add(candidateVector.id)
    const candidateExpected = expected as Record<string, unknown>
    if (!isScoringDisposition(candidateExpected.scoring) || !isDiagnosticDisposition(candidateExpected.diagnostic)) {
      throw new TypeError("Foil insulation boundary fixture contains an incomplete expectation")
    }
    vectors.push({
      id: candidateVector.id,
      returnResistance: candidateVector.returnResistance,
      insulationResistance: candidateVector.insulationResistance,
      expected: {
        scoring: candidateExpected.scoring,
        diagnostic: candidateExpected.diagnostic
      }
    })
  }
  return {
    format: "foil-insulation-boundary-vectors",
    schemaVersion: "1.0.0",
    source,
    vectors
  }
}

const BOUNDARY_FIXTURE = readBoundaryFixture()

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
  it("keeps independently authored boundary expectations separate from the scorer", () => {
    expect(BOUNDARY_FIXTURE.source).toEqual({
      authority: "fie",
      document: "fie-material-rules-2026-08-en.pdf",
      sha256: "1489D28ED6F3C91E27ECDF75BB29B4ED65C688A012F544D37D946A9DA81AFC26",
      page: 79,
      locator: "Annex B, A.2, FOIL-04"
    })
    expect(BOUNDARY_FIXTURE.vectors.map(({ id }) => id)).toEqual([
      "yellow-at-449-ohms",
      "yellow-at-450-ohms",
      "yellow-at-475-ohms",
      "yellow-at-476-ohms",
      "uncertainty-touches-450-ohms",
      "uncertainty-touches-475-ohms",
      "both-measurements-unavailable"
    ])

    for (const vector of BOUNDARY_FIXTURE.vectors) {
      const result = evaluateFoilAntiBlockingInsulation(
        sample(
          observation(vector.returnResistance, vector.insulationResistance),
          observation(vector.returnResistance, vector.insulationResistance)
        )
      )
      expect(result.left.scoring.disposition, vector.id).toBe(vector.expected.scoring)
      expect(result.left.diagnostic.disposition, vector.id).toBe(vector.expected.diagnostic)
      expect(result.right.scoring.disposition, vector.id).toBe(vector.expected.scoring)
      expect(result.right.diagnostic.disposition, vector.id).toBe(vector.expected.diagnostic)
    }
  })

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
