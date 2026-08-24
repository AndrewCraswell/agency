import { getResistanceRange, type ResistanceMeasurement } from "./resistance-range.js"
import { isIntegerMicroseconds } from "./scoring-glossary-and-units.js"
import {
  FIE_TIMING_BANDS,
  getFieTimingBandEndpointUs,
  loadTimingTable,
  resolveTimingTable,
  type TimingTable
} from "./timing-table.js"

export type SabreSide = "left" | "right"

/** A trusted projection of the acting sabre onto the opposing return path. */
export type SabreTargetContact = "target" | "nonConductiveSurface" | "indeterminate" | "unavailable"

/**
 * The acquisition layer has already evaluated the FIE 100-ohm external-path
 * requirement. This rule layer deliberately receives no raw analogue value.
 */
export type SabreExternalPathEligibility = "eligible" | "ineligible" | "indeterminate" | "unavailable"

export type SabreExternalPathMeasurement = ResistanceMeasurement

export type SabreOwnEquipmentFault = "present" | "absent" | "indeterminate" | "unavailable"

export type SabreBladeContact = "present" | "absent" | "indeterminate" | "unavailable"

/**
 * `controlBreak` is the trusted projection of a B/C break strictly above
 * 250 ohms. Its three-millisecond duration is qualified below.
 */
export type SabreCircuitBCFault = "normal" | "controlBreak" | "abnormalChange" | "indeterminate" | "unavailable"

export type SabreContact = {
  bladeContact: SabreBladeContact
  circuitBCFault: SabreCircuitBCFault
  externalPathEligibility: SabreExternalPathEligibility
  ownEquipmentFault: SabreOwnEquipmentFault
  targetContact: SabreTargetContact
}

export type SabreSample = {
  atUs: number
  left: SabreContact
  right: SabreContact
}

export type SabreHit = {
  qualifiedAtUs: number
  side: SabreSide
  startedAtUs: number
}

export type SabreDiagnosticDecision = {
  atUs: number
  audible: "none" | "requested"
  indication: "white-on" | "yellow-off" | "yellow-on"
  latched: boolean
  reason: "circuit-bc-abnormal-change" | "control-break-qualified" | "own-equipment-clear" | "own-equipment-fault"
  side: SabreSide
}

export type SabreYellowDiagnostic = "yellow-on" | "yellow-off" | "indeterminate" | "unavailable"

export type SabreWhiteDiagnostic = "white-on" | "white-off" | "indeterminate" | "unavailable"

export type SabreObservationStatus =
  | "ready"
  | "non-conductive-surface"
  | "external-path-ineligible"
  | "whipover-rejection"
  | "indeterminate"
  | "unavailable"

type SabreSideState = {
  bladeMediated: SabreBladeMediatedHistory | null
  candidateSinceUs: number | null
  controlBreakSinceUs: number | null
  isRegistered: boolean
  observationStatus: SabreObservationStatus
  whiteDiagnostic: SabreWhiteDiagnostic
  yellowDiagnostic: SabreYellowDiagnostic
}

export type SabreBladeMediatedHistory = {
  interruptionCount: number
  lastBladeContact: "present" | "absent"
  startedAtUs: number
}

export type SabreScoringState = {
  diagnostics: readonly SabreDiagnosticDecision[]
  firstHitSignalledAtUs: number | null
  hits: readonly SabreHit[]
  isLocked: boolean
  lastSampleAtUs: number | null
  left: SabreSideState
  lockoutEndsAtUs: number | null
  right: SabreSideState
}

const DEFAULT_TIMING_TABLE = loadTimingTable("timing-1")

/** Compatibility names for existing callers; runtime decisions use a loaded table. */
export const SABRE_RULES = {
  /** FIE SABRE-03: contacts below this duration must not signal. */
  minimumContactUs: DEFAULT_TIMING_TABLE.sabre.minimumContactUs,
  /** FIE SABRE-03 sensitivity upper test point. It is not an expiry timer. */
  sensitivityTestPointUs: DEFAULT_TIMING_TABLE.sabre.sensitivityTestPointUs,
  /** FIE SABRE-07's nominal control-break duration. */
  provisionalControlBreakUs: DEFAULT_TIMING_TABLE.sabre.controlBreakUs,
  /** Selected inclusive endpoint for SABRE-06's 0-4 ms (+1 ms) region. */
  provisionalBladeRegistrationLatestUs: DEFAULT_TIMING_TABLE.sabre.bladeRegistrationLatestUs,
  /** Selected recovery endpoint for SABRE-06's 15 ms +/- 5 ms behaviour. A retained unsignalled blade-mediated sequence suppresses candidates below this instant. */
  provisionalBladeRecoveryUs: DEFAULT_TIMING_TABLE.sabre.bladeRecoveryUs,
  /** SABRE-06's stated maximum number of blade-contact interruptions. */
  maximumBladeContactInterruptions: DEFAULT_TIMING_TABLE.sabre.maximumBladeContactInterruptions,
  /** FIE SABRE-05 tolerance references, not active product endpoints. */
  eventWindowEarliestUs: getFieTimingBandEndpointUs(FIE_TIMING_BANDS.sabre.lockoutUs, "earliest"),
  eventWindowLatestUs: getFieTimingBandEndpointUs(FIE_TIMING_BANDS.sabre.lockoutUs, "latest"),
  /** Selected endpoint inside FIE SABRE-05's 170 ms +/- 10 ms band. */
  provisionalLockoutUs: DEFAULT_TIMING_TABLE.sabre.lockoutUs
} as const

export const SABRE_EXTERNAL_PATH_MAXIMUM_MILLI_OHMS = 100_000

const INITIAL_SIDE_STATE: SabreSideState = {
  bladeMediated: null,
  candidateSinceUs: null,
  controlBreakSinceUs: null,
  isRegistered: false,
  observationStatus: "unavailable",
  whiteDiagnostic: "unavailable",
  yellowDiagnostic: "unavailable"
}

export function createSabreScoringState(): SabreScoringState {
  return {
    diagnostics: [],
    firstHitSignalledAtUs: null,
    hits: [],
    isLocked: false,
    lastSampleAtUs: null,
    left: INITIAL_SIDE_STATE,
    lockoutEndsAtUs: null,
    right: INITIAL_SIDE_STATE
  }
}

/**
 * Classifies a supplied host-level external-path measurement at the FIE
 * 100-ohm boundary. This does not select an ADC threshold or prove a physical
 * acquisition path.
 */
export function classifySabreExternalPath(measurement: SabreExternalPathMeasurement): SabreExternalPathEligibility {
  const range = getResistanceRange(measurement, {
    incomplete: () =>
      new TypeError("Sabre external-path resistance and uncertainty must both be present or both be null"),
    invalid: () => new RangeError("Sabre external-path resistance values must be non-negative safe integers"),
    overflow: () => new RangeError("Sabre external-path resistance values must be non-negative safe integers")
  })

  if (range === null) {
    return "unavailable"
  }

  const { min: lowerBound, max: upperBound } = range

  if (upperBound <= SABRE_EXTERNAL_PATH_MAXIMUM_MILLI_OHMS) {
    return "eligible"
  }

  if (lowerBound > SABRE_EXTERNAL_PATH_MAXIMUM_MILLI_OHMS) {
    return "ineligible"
  }

  return "indeterminate"
}

function toYellowDiagnostic(ownEquipmentFault: SabreOwnEquipmentFault): SabreYellowDiagnostic {
  if (ownEquipmentFault === "present") {
    return "yellow-on"
  }

  if (ownEquipmentFault === "absent") {
    return "yellow-off"
  }

  return ownEquipmentFault
}

function advanceBladeMediatedHistory(
  state: SabreSideState,
  contact: SabreContact,
  atUs: number,
  bladeRecoveryUs: number
): SabreBladeMediatedHistory | null {
  if (contact.bladeContact === "indeterminate" || contact.bladeContact === "unavailable") {
    return null
  }

  const history = state.bladeMediated

  if (history === null) {
    return contact.targetContact === "target" &&
      contact.externalPathEligibility === "eligible" &&
      contact.bladeContact === "present"
      ? { interruptionCount: 0, lastBladeContact: "present", startedAtUs: atUs }
      : null
  }

  if (atUs - history.startedAtUs >= bladeRecoveryUs) {
    return null
  }

  const interruptionCount =
    history.lastBladeContact === "present" && contact.bladeContact === "absent"
      ? history.interruptionCount + 1
      : history.interruptionCount

  return {
    interruptionCount,
    lastBladeContact: contact.bladeContact,
    startedAtUs: history.startedAtUs
  }
}

function toObservationStatus(
  contact: SabreContact,
  bladeMediated: SabreBladeMediatedHistory | null,
  atUs: number,
  bladeRegistrationLatestUs: number,
  maximumBladeContactInterruptions: number
): SabreObservationStatus {
  if (contact.targetContact === "indeterminate" || contact.externalPathEligibility === "indeterminate") {
    return "indeterminate"
  }

  if (contact.targetContact === "unavailable" || contact.externalPathEligibility === "unavailable") {
    return "unavailable"
  }

  if (contact.bladeContact === "indeterminate") {
    return "indeterminate"
  }

  if (contact.bladeContact === "unavailable") {
    return "unavailable"
  }

  if (contact.targetContact === "nonConductiveSurface") {
    return "non-conductive-surface"
  }

  if (contact.externalPathEligibility === "ineligible") {
    return "external-path-ineligible"
  }

  if (bladeMediated === null) {
    return "ready"
  }

  const elapsedUs = atUs - bladeMediated.startedAtUs

  if (elapsedUs <= bladeRegistrationLatestUs) {
    return "ready"
  }

  if (bladeMediated.interruptionCount > maximumBladeContactInterruptions) {
    return "indeterminate"
  }

  return "whipover-rejection"
}

type ContactAdvance = {
  contact: SabreSideState
  diagnostics: SabreDiagnosticDecision[]
  hit: SabreHit | null
}

/**
 * A non-conductive observation is a known end of a previously trusted target
 * interval. It may therefore qualify that interval at its exact end. Unknown
 * or unavailable inputs remain fail-closed and never capture a candidate.
 */
function isKnownTargetRelease(observationStatus: SabreObservationStatus): boolean {
  return observationStatus === "non-conductive-surface"
}

function collectDiagnosticDecisions(
  side: SabreSide,
  state: SabreSideState,
  contact: SabreContact,
  yellowDiagnostic: SabreYellowDiagnostic,
  whiteDiagnostic: SabreWhiteDiagnostic,
  atUs: number
): SabreDiagnosticDecision[] {
  const diagnostics: SabreDiagnosticDecision[] = []

  if (yellowDiagnostic === "yellow-on" && state.yellowDiagnostic !== "yellow-on") {
    diagnostics.push({
      atUs,
      audible: "none",
      indication: "yellow-on",
      latched: false,
      reason: "own-equipment-fault",
      side
    })
  } else if (yellowDiagnostic === "yellow-off" && state.yellowDiagnostic === "yellow-on") {
    diagnostics.push({
      atUs,
      audible: "none",
      indication: "yellow-off",
      latched: false,
      reason: "own-equipment-clear",
      side
    })
  }

  if (whiteDiagnostic === "white-on" && state.whiteDiagnostic !== "white-on") {
    diagnostics.push({
      atUs,
      audible: "requested",
      indication: "white-on",
      latched: true,
      reason: contact.circuitBCFault === "abnormalChange" ? "circuit-bc-abnormal-change" : "control-break-qualified",
      side
    })
  }

  return diagnostics
}

function advanceContact(
  side: SabreSide,
  state: SabreSideState,
  contact: SabreContact,
  atUs: number,
  minimumContactUs: number,
  bladeRegistrationLatestUs: number,
  bladeRecoveryUs: number,
  maximumBladeContactInterruptions: number,
  controlBreakUs: number,
  hitRegistrationBlocked: boolean
): ContactAdvance {
  const bladeMediated = advanceBladeMediatedHistory(state, contact, atUs, bladeRecoveryUs)
  const observationStatus = toObservationStatus(
    contact,
    bladeMediated,
    atUs,
    bladeRegistrationLatestUs,
    maximumBladeContactInterruptions
  )
  const yellowDiagnostic = toYellowDiagnostic(contact.ownEquipmentFault)
  const controlBreakSinceUs = contact.circuitBCFault === "controlBreak" ? (state.controlBreakSinceUs ?? atUs) : null
  const controlBreakQualified = controlBreakSinceUs !== null && atUs - controlBreakSinceUs >= controlBreakUs
  const hasWhiteDiagnostic =
    state.whiteDiagnostic === "white-on" || contact.circuitBCFault === "abnormalChange" || controlBreakQualified
  const whiteDiagnostic: SabreWhiteDiagnostic = hasWhiteDiagnostic
    ? "white-on"
    : contact.circuitBCFault === "indeterminate" || contact.circuitBCFault === "unavailable"
      ? contact.circuitBCFault
      : "white-off"
  const diagnostics = collectDiagnosticDecisions(side, state, contact, yellowDiagnostic, whiteDiagnostic, atUs)

  const nextState = {
    bladeMediated,
    controlBreakSinceUs,
    isRegistered: state.isRegistered,
    observationStatus,
    whiteDiagnostic,
    yellowDiagnostic
  }

  if (state.isRegistered || hitRegistrationBlocked) {
    return { contact: { ...nextState, candidateSinceUs: null }, diagnostics, hit: null }
  }

  const releasedCandidateSinceUs = state.candidateSinceUs
  if (
    releasedCandidateSinceUs !== null &&
    isKnownTargetRelease(observationStatus) &&
    atUs - releasedCandidateSinceUs >= minimumContactUs
  ) {
    return {
      contact: { ...nextState, candidateSinceUs: null, isRegistered: true },
      diagnostics,
      hit: { qualifiedAtUs: atUs, side, startedAtUs: releasedCandidateSinceUs }
    }
  }

  if (observationStatus !== "ready") {
    return { contact: { ...nextState, candidateSinceUs: null }, diagnostics, hit: null }
  }

  const candidateSinceUs = state.candidateSinceUs ?? atUs

  if (atUs - candidateSinceUs < minimumContactUs) {
    return { contact: { ...nextState, candidateSinceUs }, diagnostics, hit: null }
  }

  return {
    contact: { ...nextState, candidateSinceUs: null, isRegistered: true },
    diagnostics,
    hit: { qualifiedAtUs: atUs, side, startedAtUs: candidateSinceUs }
  }
}

function compareHits(left: SabreHit, right: SabreHit) {
  if (left.startedAtUs !== right.startedAtUs) {
    return left.startedAtUs - right.startedAtUs
  }

  return left.side.localeCompare(right.side)
}

function compareDiagnostics(left: SabreDiagnosticDecision, right: SabreDiagnosticDecision) {
  if (left.atUs !== right.atUs) {
    return left.atUs - right.atUs
  }

  return left.side.localeCompare(right.side)
}

function appendDiagnostics(
  existing: readonly SabreDiagnosticDecision[],
  additions: readonly SabreDiagnosticDecision[]
): SabreDiagnosticDecision[] {
  return [...existing, ...additions].sort(compareDiagnostics)
}

export function advanceSabreScoring(
  state: SabreScoringState,
  sample: SabreSample,
  timingTable?: TimingTable
): SabreScoringState {
  const resolvedTimingTable = resolveTimingTable(timingTable)

  if (!isIntegerMicroseconds(sample.atUs)) {
    throw new RangeError("Sabre samples must use non-negative safe integer timestamps")
  }

  if (state.lastSampleAtUs !== null && sample.atUs < state.lastSampleAtUs) {
    throw new RangeError("Sabre samples must use monotonic timestamps")
  }

  const hasReachedLockout = state.lockoutEndsAtUs !== null && sample.atUs >= state.lockoutEndsAtUs
  const hitRegistrationBlocked = state.isLocked || hasReachedLockout

  const leftAdvance = advanceContact(
    "left",
    state.left,
    sample.left,
    sample.atUs,
    resolvedTimingTable.sabre.minimumContactUs,
    resolvedTimingTable.sabre.bladeRegistrationLatestUs,
    resolvedTimingTable.sabre.bladeRecoveryUs,
    resolvedTimingTable.sabre.maximumBladeContactInterruptions,
    resolvedTimingTable.sabre.controlBreakUs,
    hitRegistrationBlocked
  )
  const rightAdvance = advanceContact(
    "right",
    state.right,
    sample.right,
    sample.atUs,
    resolvedTimingTable.sabre.minimumContactUs,
    resolvedTimingTable.sabre.bladeRegistrationLatestUs,
    resolvedTimingTable.sabre.bladeRecoveryUs,
    resolvedTimingTable.sabre.maximumBladeContactInterruptions,
    resolvedTimingTable.sabre.controlBreakUs,
    hitRegistrationBlocked
  )
  const newDiagnostics = [...leftAdvance.diagnostics, ...rightAdvance.diagnostics]

  if (hitRegistrationBlocked) {
    return {
      ...state,
      diagnostics: appendDiagnostics(state.diagnostics, newDiagnostics),
      isLocked: true,
      lastSampleAtUs: sample.atUs,
      left: leftAdvance.contact,
      right: rightAdvance.contact
    }
  }

  const newHits = [leftAdvance.hit, rightAdvance.hit].filter((hit): hit is SabreHit => hit !== null).sort(compareHits)
  const firstHit = newHits.at(0)
  const firstHitSignalledAtUs = state.firstHitSignalledAtUs ?? firstHit?.qualifiedAtUs ?? null
  const lockoutEndsAtUs =
    state.lockoutEndsAtUs ??
    (firstHitSignalledAtUs === null ? null : firstHitSignalledAtUs + resolvedTimingTable.sabre.lockoutUs)

  return {
    diagnostics: appendDiagnostics(state.diagnostics, newDiagnostics),
    firstHitSignalledAtUs,
    hits: [...state.hits, ...newHits],
    isLocked: false,
    lastSampleAtUs: sample.atUs,
    left: leftAdvance.contact,
    lockoutEndsAtUs,
    right: rightAdvance.contact
  }
}
