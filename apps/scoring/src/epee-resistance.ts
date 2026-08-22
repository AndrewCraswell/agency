import { EPEE_RULES, type EpeeHit, type Side } from "./epee.js"

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

type ResistanceContactState = {
  candidateSinceUs: number | null
  isRegistered: boolean
}

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

const INITIAL_CONTACT_STATE: ResistanceContactState = {
  candidateSinceUs: null,
  isRegistered: false
}

type ContactClassification =
  | { resistanceClass: EpeeResistanceClass; type: "candidate" }
  | { type: "open" }
  | {
      decision: Exclude<EpeeResistanceDecision, { disposition: "qualified-hit" }>
      type: "decision"
    }

type ContactAdvance = {
  contact: ResistanceContactState
  decisions: readonly EpeeResistanceDecision[]
  hit: { hit: EpeeHit; resistanceClass: EpeeResistanceClass } | null
}

export function createEpeeResistanceScoringState(): EpeeResistanceScoringState {
  return {
    decisions: [],
    firstHitAtUs: null,
    hits: [],
    isLocked: false,
    lastSampleAtUs: null,
    left: INITIAL_CONTACT_STATE,
    right: INITIAL_CONTACT_STATE
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
    return { resistanceClass: "normal-10-ohm", type: "candidate" }
  }

  if (
    range.min === EXCEPTIONAL_CONTACT_RESISTANCE_MILLIOHMS &&
    range.max === EXCEPTIONAL_CONTACT_RESISTANCE_MILLIOHMS
  ) {
    return { resistanceClass: "exceptional-100-ohm", type: "candidate" }
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

function advanceContact(
  side: Side,
  state: ResistanceContactState,
  contact: EpeeResistanceContact,
  atUs: number
): ContactAdvance {
  const classification = classifyContact(side, contact, atUs)

  if (classification.type === "decision") {
    return {
      contact: state.isRegistered ? state : INITIAL_CONTACT_STATE,
      decisions: [classification.decision],
      hit: null
    }
  }

  if (classification.type === "open") {
    return { contact: state.isRegistered ? state : INITIAL_CONTACT_STATE, decisions: [], hit: null }
  }

  if (state.isRegistered) {
    return { contact: state, decisions: [], hit: null }
  }

  if (state.candidateSinceUs === null) {
    return {
      contact: { candidateSinceUs: atUs, isRegistered: false },
      decisions: [],
      hit: null
    }
  }

  if (atUs - state.candidateSinceUs < EPEE_RULES.contactTimeUs) {
    return { contact: state, decisions: [], hit: null }
  }

  return {
    contact: { candidateSinceUs: null, isRegistered: true },
    decisions: [],
    hit: {
      hit: { qualifiedAtUs: atUs, side, startedAtUs: state.candidateSinceUs },
      resistanceClass: classification.resistanceClass
    }
  }
}

function compareHits(
  left: { hit: EpeeHit; resistanceClass: EpeeResistanceClass },
  right: { hit: EpeeHit; resistanceClass: EpeeResistanceClass }
) {
  if (left.hit.startedAtUs !== right.hit.startedAtUs) {
    return left.hit.startedAtUs - right.hit.startedAtUs
  }

  return left.hit.side.localeCompare(right.hit.side)
}

function isPendingInsideLockout(contact: ResistanceContactState, firstHitAtUs: number) {
  return contact.candidateSinceUs !== null && contact.candidateSinceUs - firstHitAtUs <= EPEE_RULES.lockoutTimeUs
}

function validateSample(sample: EpeeResistanceSample) {
  if (!Number.isSafeInteger(sample.atUs) || sample.atUs < 0) {
    throw new RangeError("Epee resistance samples must use non-negative safe integer timestamps")
  }

  for (const contact of [sample.left, sample.right]) {
    validateMeasurement(contact.contactResistance)
    validateMeasurement(contact.groundPathResistance)
  }
}

export function advanceEpeeResistanceScoring(
  state: EpeeResistanceScoringState,
  sample: EpeeResistanceSample
): EpeeResistanceScoringState {
  validateSample(sample)

  if (state.lastSampleAtUs !== null && sample.atUs < state.lastSampleAtUs) {
    throw new RangeError("Epee resistance samples must use monotonic timestamps")
  }

  if (state.isLocked) {
    return { ...state, lastSampleAtUs: sample.atUs }
  }

  const leftAdvance = advanceContact("left", state.left, sample.left, sample.atUs)
  const rightAdvance = advanceContact("right", state.right, sample.right, sample.atUs)
  const newHits = [leftAdvance.hit, rightAdvance.hit]
    .filter((hit): hit is { hit: EpeeHit; resistanceClass: EpeeResistanceClass } => hit !== null)
    .sort(compareHits)

  let firstHitAtUs = state.firstHitAtUs
  const hits = [...state.hits]
  const decisions = [...state.decisions, ...leftAdvance.decisions, ...rightAdvance.decisions]

  for (const qualified of newHits) {
    if (firstHitAtUs === null) {
      firstHitAtUs = qualified.hit.startedAtUs
      hits.push(qualified.hit)
      decisions.push({ disposition: "qualified-hit", hit: qualified.hit, resistanceClass: qualified.resistanceClass })
      continue
    }

    if (qualified.hit.startedAtUs - firstHitAtUs <= EPEE_RULES.lockoutTimeUs) {
      hits.push(qualified.hit)
      decisions.push({ disposition: "qualified-hit", hit: qualified.hit, resistanceClass: qualified.resistanceClass })
    }
  }

  const hasPendingHit =
    firstHitAtUs !== null &&
    (isPendingInsideLockout(leftAdvance.contact, firstHitAtUs) ||
      isPendingInsideLockout(rightAdvance.contact, firstHitAtUs))
  const isLocked = firstHitAtUs !== null && sample.atUs - firstHitAtUs > EPEE_RULES.lockoutTimeUs && !hasPendingHit

  return {
    decisions,
    firstHitAtUs,
    hits,
    isLocked,
    lastSampleAtUs: sample.atUs,
    left: leftAdvance.contact,
    right: rightAdvance.contact
  }
}
