import type { FoilSide } from "./foil.js"
import { getResistanceRange, type ResistanceMeasurement } from "./resistance-range.js"

/**
 * A calibrated host-side resistance result. Both fields are null only when no
 * trusted measurement is available; zero is a measured value, not absence.
 */
export type FoilInsulationResistanceMeasurement = ResistanceMeasurement

export type FoilInsulationObservation = {
  /** Resistance in the acting fencer's opposing target-return circuit. */
  opponentReturnResistance: FoilInsulationResistanceMeasurement
  /** Resistance from this side's weapon to its own conductive equipment. */
  ownWeaponToJacketInsulation: FoilInsulationResistanceMeasurement
}

export type FoilInsulationSample = {
  atUs: number
  left: FoilInsulationObservation
  right: FoilInsulationObservation
}

export type FoilReturnCircuitScoringDisposition =
  | "valid-hit-eligible"
  | "non-valid-hit-eligible"
  | "indeterminate"
  | "unavailable"

export type FoilYellowDiagnosticDisposition = "yellow-on" | "yellow-off" | "indeterminate" | "unavailable"

export type FoilInsulationDecision = {
  diagnostic: {
    disposition: FoilYellowDiagnosticDisposition
    rangeMilliOhms: FoilInsulationResistanceRange | null
  }
  scoring: {
    disposition: FoilReturnCircuitScoringDisposition
    rangeMilliOhms: FoilInsulationResistanceRange | null
  }
  side: FoilSide
}

export type FoilInsulationEvaluation = {
  atUs: number
  left: FoilInsulationDecision
  right: FoilInsulationDecision
}

export type FoilInsulationResistanceRange = {
  max: number
  min: number
}

export const FOIL_ANTI_BLOCKING_RESISTANCE_MILLIOHMS = {
  /** FIE's valid-hit resistance point; equality is the documented product policy. */
  validHitMaximum: 200_000,
  /** FIE guarantees automatic yellow indication only strictly below this point. */
  yellowOnBelow: 450_000,
  /** FIE guarantees yellow is never on only strictly above this point. */
  yellowOffAbove: 475_000
} as const

export function validateFoilResistanceMeasurement(measurement: FoilInsulationResistanceMeasurement) {
  getResistanceRange(measurement, {
    incomplete: () => new RangeError("Foil insulation measurements must provide a value and uncertainty together"),
    invalid: () => new RangeError("Foil insulation measurements must use non-negative safe integer milli-ohms"),
    overflow: () => new RangeError("Foil insulation measurement ranges must remain safe integers")
  })
}

export function foilResistanceRange(
  measurement: FoilInsulationResistanceMeasurement
): FoilInsulationResistanceRange | null {
  return getResistanceRange(measurement, {
    incomplete: () => new RangeError("Foil insulation measurements must provide a value and uncertainty together"),
    invalid: () => new RangeError("Foil insulation measurements must use non-negative safe integer milli-ohms"),
    overflow: () => new RangeError("Foil insulation measurement ranges must remain safe integers")
  })
}

function decideReturnCircuit(measurement: FoilInsulationResistanceMeasurement): FoilInsulationDecision["scoring"] {
  const rangeMilliOhms = foilResistanceRange(measurement)

  if (rangeMilliOhms === null) {
    return { disposition: "unavailable", rangeMilliOhms }
  }

  if (rangeMilliOhms.max <= FOIL_ANTI_BLOCKING_RESISTANCE_MILLIOHMS.validHitMaximum) {
    return { disposition: "valid-hit-eligible", rangeMilliOhms }
  }

  if (rangeMilliOhms.min > FOIL_ANTI_BLOCKING_RESISTANCE_MILLIOHMS.validHitMaximum) {
    return { disposition: "non-valid-hit-eligible", rangeMilliOhms }
  }

  return { disposition: "indeterminate", rangeMilliOhms }
}

function decideYellowDiagnostic(
  measurement: FoilInsulationResistanceMeasurement
): FoilInsulationDecision["diagnostic"] {
  const rangeMilliOhms = foilResistanceRange(measurement)

  if (rangeMilliOhms === null) {
    return { disposition: "unavailable", rangeMilliOhms }
  }

  if (rangeMilliOhms.max < FOIL_ANTI_BLOCKING_RESISTANCE_MILLIOHMS.yellowOnBelow) {
    return { disposition: "yellow-on", rangeMilliOhms }
  }

  if (rangeMilliOhms.min > FOIL_ANTI_BLOCKING_RESISTANCE_MILLIOHMS.yellowOffAbove) {
    return { disposition: "yellow-off", rangeMilliOhms }
  }

  return { disposition: "indeterminate", rangeMilliOhms }
}

function decideSide(side: FoilSide, observation: FoilInsulationObservation): FoilInsulationDecision {
  return {
    diagnostic: decideYellowDiagnostic(observation.ownWeaponToJacketInsulation),
    scoring: decideReturnCircuit(observation.opponentReturnResistance),
    side
  }
}

/**
 * Evaluates only FOIL-04 resistance behavior for an anti-blocking apparatus.
 * It cannot create, suppress, or reclassify a foil contact-break hit.
 */
export function evaluateFoilAntiBlockingInsulation(sample: FoilInsulationSample): FoilInsulationEvaluation {
  if (!Number.isSafeInteger(sample.atUs) || sample.atUs < 0) {
    throw new RangeError("Foil insulation samples must use non-negative safe integer timestamps")
  }

  return {
    atUs: sample.atUs,
    left: decideSide("left", sample.left),
    right: decideSide("right", sample.right)
  }
}
