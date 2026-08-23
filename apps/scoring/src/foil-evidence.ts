import {
  foilResistanceRange,
  type FoilInsulationResistanceMeasurement,
  type FoilInsulationResistanceRange
} from "./foil-insulation.js"

export type FoilPermittedIndication = "valid" | "valid-and-non-valid" | "non-valid"

export type FoilExteriorResistanceDecision = {
  disposition:
    | "required-indication"
    | "permitted-indications"
    | "indeterminate"
    | "outside-published-range"
    | "unavailable"
  permittedIndications: readonly FoilPermittedIndication[]
  rangeMilliOhms: FoilInsulationResistanceRange | null
}

export type FoilClosedCircuitDecision = {
  disposition: "must-not-produce-non-valid" | "indeterminate" | "outside-published-range" | "unavailable"
  rangeMilliOhms: FoilInsulationResistanceRange | null
}

export type FoilEarthContactDecision = {
  disposition: "must-not-signal" | "indeterminate" | "outside-published-range" | "unavailable"
  rangeMilliOhms: FoilInsulationResistanceRange | null
}

export type FoilApparatusMode = "anti-blocking" | "standard"

export type FoilLogicalContactContext =
  | "blade-contact"
  | "conductive-jacket-without-tip-break"
  | "guard-or-piste"
  | "own-weapon-to-jacket-insulation-short"

export type FoilLogicalContextDecision = {
  disposition: "does-not-block-contact-scorer" | "must-not-signal" | "normal-contact-rules-apply" | "not-specified"
}

export const FOIL_STANDARD_RESISTANCE_MILLIOHMS = {
  closedCircuitMaximum: 200_000,
  earthPathMaximum: 100_000,
  exteriorClassificationMaximumExclusive: 500_000,
  exteriorValidMaximum: 200_000
} as const

const VALID_ONLY = Object.freeze(["valid"] as const)
const ALL_INDICATIONS = Object.freeze(["valid", "valid-and-non-valid", "non-valid"] as const)
const NO_INDICATIONS = Object.freeze([] as const)

function validatedRange(measurement: FoilInsulationResistanceMeasurement): FoilInsulationResistanceRange | null {
  return foilResistanceRange(measurement)
}

/**
 * Classifies the indication guarantee for a trusted standard-foil exterior
 * resistance interval. It does not qualify a contact or select a lamp.
 */
export function classifyFoilExteriorResistance(
  measurement: FoilInsulationResistanceMeasurement
): FoilExteriorResistanceDecision {
  const rangeMilliOhms = validatedRange(measurement)
  if (rangeMilliOhms === null)
    return { disposition: "unavailable", permittedIndications: NO_INDICATIONS, rangeMilliOhms }

  if (rangeMilliOhms.max <= FOIL_STANDARD_RESISTANCE_MILLIOHMS.exteriorValidMaximum)
    return { disposition: "required-indication", permittedIndications: VALID_ONLY, rangeMilliOhms }

  if (
    rangeMilliOhms.min > FOIL_STANDARD_RESISTANCE_MILLIOHMS.exteriorValidMaximum &&
    rangeMilliOhms.max < FOIL_STANDARD_RESISTANCE_MILLIOHMS.exteriorClassificationMaximumExclusive
  )
    return { disposition: "permitted-indications", permittedIndications: ALL_INDICATIONS, rangeMilliOhms }

  if (rangeMilliOhms.min >= FOIL_STANDARD_RESISTANCE_MILLIOHMS.exteriorClassificationMaximumExclusive)
    return { disposition: "outside-published-range", permittedIndications: NO_INDICATIONS, rangeMilliOhms }

  return { disposition: "indeterminate", permittedIndications: NO_INDICATIONS, rangeMilliOhms }
}

/** Classifies only the FOIL-03 closed-circuit 200-ohm non-valid-signal guarantee. */
export function classifyFoilClosedCircuitResistance(
  measurement: FoilInsulationResistanceMeasurement
): FoilClosedCircuitDecision {
  const rangeMilliOhms = validatedRange(measurement)
  if (rangeMilliOhms === null) return { disposition: "unavailable", rangeMilliOhms }
  if (rangeMilliOhms.max <= FOIL_STANDARD_RESISTANCE_MILLIOHMS.closedCircuitMaximum)
    return { disposition: "must-not-produce-non-valid", rangeMilliOhms }
  if (rangeMilliOhms.min > FOIL_STANDARD_RESISTANCE_MILLIOHMS.closedCircuitMaximum)
    return { disposition: "outside-published-range", rangeMilliOhms }
  return { disposition: "indeterminate", rangeMilliOhms }
}

/** Classifies only the FOIL-03 100-ohm guard/piste earth-path guarantee. */
export function classifyFoilEarthContactResistance(
  measurement: FoilInsulationResistanceMeasurement
): FoilEarthContactDecision {
  const rangeMilliOhms = validatedRange(measurement)
  if (rangeMilliOhms === null) return { disposition: "unavailable", rangeMilliOhms }
  if (rangeMilliOhms.max <= FOIL_STANDARD_RESISTANCE_MILLIOHMS.earthPathMaximum)
    return { disposition: "must-not-signal", rangeMilliOhms }
  if (rangeMilliOhms.min > FOIL_STANDARD_RESISTANCE_MILLIOHMS.earthPathMaximum)
    return { disposition: "outside-published-range", rangeMilliOhms }
  return { disposition: "indeterminate", rangeMilliOhms }
}

/**
 * States only whether a trusted logical context blocks or defers to the
 * existing contact scorer. It does not infer context from conductors.
 */
export function classifyFoilLogicalContext(
  mode: FoilApparatusMode,
  context: FoilLogicalContactContext
): FoilLogicalContextDecision {
  if (context === "guard-or-piste" || context === "conductive-jacket-without-tip-break")
    return { disposition: "must-not-signal" }
  if (context === "own-weapon-to-jacket-insulation-short")
    return { disposition: mode === "anti-blocking" ? "does-not-block-contact-scorer" : "not-specified" }
  return { disposition: mode === "standard" ? "normal-contact-rules-apply" : "not-specified" }
}
