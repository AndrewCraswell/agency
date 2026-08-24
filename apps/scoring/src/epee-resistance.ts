import {
  advanceEpeeLifecycle,
  createEpeeLifecycleState,
  type EpeeContactClassification,
  type EpeeContactLifecycleState
} from "./epee-contact-kernel.js"
import { type EpeeHit, type Side } from "./epee.js"
import { isIntegerMicroseconds } from "./scoring-glossary-and-units.js"
import { resolveTimingTable, type TimingTable } from "./timing-table.js"

export type EpeeCircuitComplete = "closed" | "indeterminate" | "open" | "unavailable"

export type EpeeGroundedMaterial = "grounded" | "indeterminate" | "not-grounded" | "unavailable"

export type EpeeLineIntegrity = "cross-line" | "indeterminate" | "intact" | "out-of-range" | "unavailable"

export type ResistanceMeasurement = {
  resistanceMilliOhms: number | null
  resistanceUncertaintyMilliOhms: number | null
}

export type EpeeResistanceContact = {
  circuitComplete: EpeeCircuitComplete
  contactResistance: ResistanceMeasurement
  groundPathResistance: ResistanceMeasurement
  groundedMaterial: EpeeGroundedMaterial
  lineIntegrity: EpeeLineIntegrity
}

export type EpeeResistanceSample = {
  atUs: number
  left: EpeeResistanceContact
  right: EpeeResistanceContact
}

export type EpeeResistanceClass = "exceptional-100-ohm" | "normal-10-ohm"

export type EpeeResistanceDecision =
  | {
      atUs: number
      disposition: "grounded-material-rejection"
      groundPathResistance: ResistanceMeasurement
      side: Side
    }
  | {
      atUs: number
      disposition: "line-fault"
      lineIntegrity: "cross-line" | "out-of-range"
      side: Side
    }
  | {
      disposition: "qualified-hit"
      hit: EpeeHit
      resistanceClass: EpeeResistanceClass
    }
  | {
      atUs: number
      disposition: "uncertainty"
      rangeMilliOhms: { max: number; min: number } | null
      side: Side
      subject: "contact-resistance" | "ground-reference" | "line-integrity" | "tip-loop"
    }
  | {
      atUs: number
      disposition: "unavailable"
      side: Side
      subject: "contact-resistance" | "ground-reference" | "line-integrity" | "tip-loop"
    }

type ResistanceContactState = EpeeContactLifecycleState

export type EpeeResistanceScoringState = {
  decisions: readonly EpeeResistanceDecision[]
  firstHitAtUs: number | null
  hits: readonly EpeeHit[]
  isLocked: boolean
  lastSampleAtUs: number | null
  left: ResistanceContactState
  right: ResistanceContactState
}

const EXCEPTIONAL_CONTACT_RESISTANCE_MILLIOHMS = 100_000
const NORMAL_CONTACT_RESISTANCE_MILLIOHMS = 10_000

type ContactClassification = EpeeContactClassification<
  EpeeResistanceClass,
  Exclude<EpeeResistanceDecision, { disposition: "qualified-hit" }>
>

export function createEpeeResistanceScoringState(): EpeeResistanceScoringState {
  return {
    decisions: [],
    ...createEpeeLifecycleState()
  }
}

function getMeasurementRange(measurement: ResistanceMeasurement) {
  const resistanceMilliOhms = measurement.resistanceMilliOhms
  const resistanceUncertaintyMilliOhms = measurement.resistanceUncertaintyMilliOhms

  if (resistanceMilliOhms === null || resistanceUncertaintyMilliOhms === null) {
    return null
  }

  return {
    max: resistanceMilliOhms + resistanceUncertaintyMilliOhms,
    min: Math.max(0, resistanceMilliOhms - resistanceUncertaintyMilliOhms)
  }
}

function validateMeasurement(measurement: ResistanceMeasurement) {
  const values = [measurement.resistanceMilliOhms, measurement.resistanceUncertaintyMilliOhms]
  const hasKnownMeasurement = values.every((value) => value !== null)
  const hasNoMeasurement = values.every((value) => value === null)

  if (!hasKnownMeasurement && !hasNoMeasurement) {
    throw new RangeError("Epee resistance measurements must provide a value and uncertainty together")
  }

  if (hasKnownMeasurement && values.some((value) => !Number.isSafeInteger(value) || value < 0 || value === null)) {
    throw new RangeError("Epee resistance measurements must use non-negative safe integer milli-ohms")
  }
}

function classifyContactResistance(
  side: Side,
  atUs: number,
  measurement: ResistanceMeasurement
): ContactClassification {
  const range = getMeasurementRange(measurement)

  if (range === null) {
    return {
      decision: { atUs, disposition: "unavailable", side, subject: "contact-resistance" },
      type: "decision"
    }
  }

  if (range.min === NORMAL_CONTACT_RESISTANCE_MILLIOHMS && range.max === NORMAL_CONTACT_RESISTANCE_MILLIOHMS) {
    return { candidate: "normal-10-ohm", type: "candidate" }
  }

  if (
    range.min === EXCEPTIONAL_CONTACT_RESISTANCE_MILLIOHMS &&
    range.max === EXCEPTIONAL_CONTACT_RESISTANCE_MILLIOHMS
  ) {
    return { candidate: "exceptional-100-ohm", type: "candidate" }
  }

  return {
    decision: { atUs, disposition: "uncertainty", rangeMilliOhms: range, side, subject: "contact-resistance" },
    type: "decision"
  }
}

function classifyContact(side: Side, contact: EpeeResistanceContact, atUs: number): ContactClassification {
  if (contact.lineIntegrity === "cross-line" || contact.lineIntegrity === "out-of-range") {
    return {
      decision: { atUs, disposition: "line-fault", lineIntegrity: contact.lineIntegrity, side },
      type: "decision"
    }
  }

  if (contact.lineIntegrity === "indeterminate") {
    return {
      decision: { atUs, disposition: "uncertainty", rangeMilliOhms: null, side, subject: "line-integrity" },
      type: "decision"
    }
  }

  if (contact.lineIntegrity === "unavailable") {
    return {
      decision: { atUs, disposition: "unavailable", side, subject: "line-integrity" },
      type: "decision"
    }
  }

  if (contact.circuitComplete === "indeterminate") {
    return {
      decision: { atUs, disposition: "uncertainty", rangeMilliOhms: null, side, subject: "tip-loop" },
      type: "decision"
    }
  }

  if (contact.circuitComplete === "unavailable") {
    return {
      decision: { atUs, disposition: "unavailable", side, subject: "tip-loop" },
      type: "decision"
    }
  }

  if (contact.circuitComplete === "open") {
    return { type: "open" }
  }

  if (contact.groundedMaterial === "grounded") {
    return {
      decision: {
        atUs,
        disposition: "grounded-material-rejection",
        groundPathResistance: contact.groundPathResistance,
        side
      },
      type: "decision"
    }
  }

  if (contact.groundedMaterial === "indeterminate") {
    return {
      decision: { atUs, disposition: "uncertainty", rangeMilliOhms: null, side, subject: "ground-reference" },
      type: "decision"
    }
  }

  if (contact.groundedMaterial === "unavailable") {
    return {
      decision: { atUs, disposition: "unavailable", side, subject: "ground-reference" },
      type: "decision"
    }
  }

  return classifyContactResistance(side, atUs, contact.contactResistance)
}

function validateSample(sample: EpeeResistanceSample) {
  if (!isIntegerMicroseconds(sample.atUs)) {
    throw new RangeError("Epee resistance samples must use non-negative safe integer timestamps")
  }

  for (const contact of [sample.left, sample.right]) {
    validateMeasurement(contact.contactResistance)
    validateMeasurement(contact.groundPathResistance)
  }
}

export function advanceEpeeResistanceScoring(
  state: EpeeResistanceScoringState,
  sample: EpeeResistanceSample,
  timingTable?: TimingTable
): EpeeResistanceScoringState {
  const resolvedTimingTable = resolveTimingTable(timingTable)

  validateSample(sample)

  const lifecycle = advanceEpeeLifecycle(state, {
    atUs: sample.atUs,
    classifyLeft: () => classifyContact("left", sample.left, sample.atUs),
    classifyRight: () => classifyContact("right", sample.right, sample.atUs),
    contactMinimumUs: resolvedTimingTable.epee.contactMinimumUs,
    doubleHitWindowUs: resolvedTimingTable.epee.doubleHitWindowUs,
    monotonicTimestampError: "Epee resistance samples must use monotonic timestamps"
  })
  const decisions: EpeeResistanceDecision[] = [...state.decisions, ...lifecycle.decisions]

  for (const qualified of lifecycle.qualifiedHits) {
    decisions.push({
      disposition: "qualified-hit",
      hit: qualified.hit,
      resistanceClass: qualified.candidate
    })
  }

  return {
    decisions,
    firstHitAtUs: lifecycle.firstHitAtUs,
    hits: lifecycle.hits,
    isLocked: lifecycle.isLocked,
    lastSampleAtUs: lifecycle.lastSampleAtUs,
    left: lifecycle.left,
    right: lifecycle.right
  }
}
