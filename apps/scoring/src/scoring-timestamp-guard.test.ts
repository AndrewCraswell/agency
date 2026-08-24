import { describe, expect, it } from "vitest"
import {
  advanceEpeeResistanceScoring,
  createEpeeResistanceScoringState,
  type EpeeResistanceContact,
  type EpeeResistanceSample
} from "./epee-resistance.js"
import { advanceEpeeScoring, createEpeeScoringState, type EpeeSample } from "./epee.js"
import { advanceFoilScoring, createFoilScoringState, type FoilSample } from "./foil.js"
import { advanceSabreScoring, createSabreScoringState, type SabreSample } from "./sabre.js"

const EPEE_OPEN = { isGrounded: false, isTipClosed: false }
const EPEE_RESISTANCE_OPEN: EpeeResistanceContact = {
  circuitComplete: "open",
  contactResistance: { resistanceMilliOhms: null, resistanceUncertaintyMilliOhms: null },
  groundPathResistance: { resistanceMilliOhms: null, resistanceUncertaintyMilliOhms: null },
  groundedMaterial: "not-grounded",
  lineIntegrity: "intact"
}
const FOIL_CLOSED = {
  circuitBreak: "closed",
  insulationDiagnostic: "unavailable",
  integrity: "intact",
  targetContext: "target"
} as const
const SABRE_READY = {
  bladeContact: "absent",
  circuitBCFault: "normal",
  externalPathEligibility: "eligible",
  ownEquipmentFault: "absent",
  targetContact: "target"
} as const

type TimestampCase = {
  readonly label: string
  readonly value: number
}

const INVALID_TIMESTAMPS: readonly TimestampCase[] = [
  { label: "negative", value: -1 },
  { label: "fractional", value: 0.5 },
  { label: "NaN", value: Number.NaN },
  { label: "positive infinity", value: Number.POSITIVE_INFINITY },
  { label: "negative infinity", value: Number.NEGATIVE_INFINITY },
  { label: "unsafe", value: Number.MAX_SAFE_INTEGER + 1 }
]

const EXPECTED_ERROR = {
  epee: "Epee samples must use non-negative safe integer timestamps",
  epeeResistance: "Epee resistance samples must use non-negative safe integer timestamps",
  foil: "Foil samples must use non-negative safe integer timestamps",
  sabre: "Sabre samples must use non-negative safe integer timestamps"
} as const

function epeeSample(atUs: number): EpeeSample {
  return { atUs, left: EPEE_OPEN, right: EPEE_OPEN }
}

function epeeResistanceSample(atUs: number): EpeeResistanceSample {
  return { atUs, left: EPEE_RESISTANCE_OPEN, right: EPEE_RESISTANCE_OPEN }
}

function foilSample(atUs: number): FoilSample {
  return { atUs, left: FOIL_CLOSED, right: FOIL_CLOSED }
}

function sabreSample(atUs: number): SabreSample {
  return { atUs, left: SABRE_READY, right: SABRE_READY }
}

describe("canonical scoring timestamp guards", () => {
  it.each(INVALID_TIMESTAMPS)("rejects $label values for epee", ({ value }) => {
    expect(() => advanceEpeeScoring(createEpeeScoringState(), epeeSample(value))).toThrow(
      new RangeError(EXPECTED_ERROR.epee)
    )
  })

  it.each(INVALID_TIMESTAMPS)("rejects $label values for epee resistance", ({ value }) => {
    expect(() => advanceEpeeResistanceScoring(createEpeeResistanceScoringState(), epeeResistanceSample(value))).toThrow(
      new RangeError(EXPECTED_ERROR.epeeResistance)
    )
  })

  it.each(INVALID_TIMESTAMPS)("rejects $label values for foil", ({ value }) => {
    expect(() => advanceFoilScoring(createFoilScoringState(), foilSample(value))).toThrow(
      new RangeError(EXPECTED_ERROR.foil)
    )
  })

  it.each(INVALID_TIMESTAMPS)("rejects $label values for sabre", ({ value }) => {
    expect(() => advanceSabreScoring(createSabreScoringState(), sabreSample(value))).toThrow(
      new RangeError(EXPECTED_ERROR.sabre)
    )
  })

  it.each([0, Number.MAX_SAFE_INTEGER])("accepts the canonical boundary timestamp %s for every weapon", (atUs) => {
    expect(advanceEpeeScoring(createEpeeScoringState(), epeeSample(atUs)).lastSampleAtUs).toBe(atUs)
    expect(
      advanceEpeeResistanceScoring(createEpeeResistanceScoringState(), epeeResistanceSample(atUs)).lastSampleAtUs
    ).toBe(atUs)
    expect(advanceFoilScoring(createFoilScoringState(), foilSample(atUs)).lastSampleAtUs).toBe(atUs)
    expect(advanceSabreScoring(createSabreScoringState(), sabreSample(atUs)).lastSampleAtUs).toBe(atUs)
  })
})
