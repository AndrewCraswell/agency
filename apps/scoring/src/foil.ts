import { loadTimingTable, resolveTimingTable, type TimingTable } from "./timing-table.js"

export type FoilSide = "left" | "right"

export type FoilCircuitBreak = "closed" | "open" | "indeterminate" | "unavailable"

export type FoilTargetContext = "target" | "nonTarget" | "grounded" | "indeterminate" | "unavailable"

/**
 * A trusted acquisition projection, not a raw resistance or conductor reading.
 * `lameFault` identifies the opposing conductive-target return and `weaponFault`
 * identifies the acting-side foil loop.
 */
export type FoilIntegrity = "intact" | "lameFault" | "weaponFault" | "indeterminate" | "unavailable"

/** M1-04 owns the meaning and output policy for this diagnostic. */
export type FoilInsulationDiagnostic = "withinRange" | "outsideRange" | "indeterminate" | "unavailable"

export type FoilContact = {
  circuitBreak: FoilCircuitBreak
  insulationDiagnostic: FoilInsulationDiagnostic
  integrity: FoilIntegrity
  targetContext: FoilTargetContext
}

export type FoilSample = {
  atUs: number
  left: FoilContact
  right: FoilContact
}

export type FoilClassification = "on-target" | "off-target"

export type FoilHit = {
  classification: FoilClassification
  qualifiedAtUs: number
  side: FoilSide
  startedAtUs: number
}

export type FoilObservationStatus =
  | "ready"
  | "grounded-contact"
  | "lame-fault"
  | "weapon-fault"
  | "indeterminate"
  | "unavailable"

type FoilCandidate = {
  classification: FoilClassification
  startedAtUs: number
}

type FoilSideState = {
  candidate: FoilCandidate | null
  insulationDiagnostic: FoilInsulationDiagnostic
  isRegistered: boolean
  observationStatus: FoilObservationStatus
}

export type FoilScoringState = {
  firstHitSignalledAtUs: number | null
  hits: readonly FoilHit[]
  isLocked: boolean
  lastSampleAtUs: number | null
  left: FoilSideState
  lockoutEndsAtUs: number | null
  right: FoilSideState
}

const DEFAULT_TIMING_TABLE = loadTimingTable("timing-1")

/** Compatibility names for existing callers; runtime decisions use a loaded table. */
export const FOIL_RULES = {
  /** Conservative product floor at the start of FIE FOIL-02's guaranteed registration band. */
  minimumBreakUs: DEFAULT_TIMING_TABLE.foil.contactBreakMinimumUs,
  /** FIE FOIL-05 tolerance band, retained as references rather than active endpoints. */
  eventWindowEarliestUs: 275_000,
  eventWindowLatestUs: 325_000,
  /** Selected endpoint inside FIE's 300 ms +/- 25 ms tolerance. */
  provisionalLockoutUs: DEFAULT_TIMING_TABLE.foil.lockoutUs
} as const

const INITIAL_SIDE_STATE: FoilSideState = {
  candidate: null,
  insulationDiagnostic: "unavailable",
  isRegistered: false,
  observationStatus: "unavailable"
}

export function createFoilScoringState(): FoilScoringState {
  return {
    firstHitSignalledAtUs: null,
    hits: [],
    isLocked: false,
    lastSampleAtUs: null,
    left: INITIAL_SIDE_STATE,
    lockoutEndsAtUs: null,
    right: INITIAL_SIDE_STATE
  }
}

type ContactAdvance = {
  contact: FoilSideState
  hit: FoilHit | null
}

function toClassification(targetContext: FoilTargetContext): FoilClassification {
  return targetContext === "target" ? "on-target" : "off-target"
}

function toObservationStatus(contact: FoilContact): FoilObservationStatus {
  if (contact.integrity === "lameFault") {
    return "lame-fault"
  }

  if (contact.integrity === "weaponFault") {
    return "weapon-fault"
  }

  if (contact.integrity === "indeterminate" || contact.circuitBreak === "indeterminate") {
    return "indeterminate"
  }

  if (contact.integrity === "unavailable" || contact.circuitBreak === "unavailable") {
    return "unavailable"
  }

  if (contact.targetContext === "grounded") {
    return "grounded-contact"
  }

  if (contact.targetContext === "indeterminate") {
    return "indeterminate"
  }

  if (contact.targetContext === "unavailable") {
    return "unavailable"
  }

  return "ready"
}

function advanceContact(
  side: FoilSide,
  state: FoilSideState,
  contact: FoilContact,
  atUs: number,
  contactBreakMinimumUs: number
): ContactAdvance {
  const observationStatus = toObservationStatus(contact)
  const nextState = {
    insulationDiagnostic: contact.insulationDiagnostic,
    isRegistered: state.isRegistered,
    observationStatus
  }

  if (state.isRegistered || observationStatus !== "ready" || contact.circuitBreak !== "open") {
    return { contact: { ...nextState, candidate: null }, hit: null }
  }

  const classification = toClassification(contact.targetContext)

  const candidate =
    state.candidate?.classification === classification ? state.candidate : { classification, startedAtUs: atUs }

  if (atUs - candidate.startedAtUs < contactBreakMinimumUs) {
    return { contact: { ...nextState, candidate }, hit: null }
  }

  return {
    contact: { ...nextState, candidate: null, isRegistered: true },
    hit: { classification, qualifiedAtUs: atUs, side, startedAtUs: candidate.startedAtUs }
  }
}

function compareHits(left: FoilHit, right: FoilHit) {
  if (left.startedAtUs !== right.startedAtUs) {
    return left.startedAtUs - right.startedAtUs
  }

  return left.side.localeCompare(right.side)
}

function isValidAtUs(atUs: number) {
  return Number.isSafeInteger(atUs) && atUs >= 0
}

export function advanceFoilScoring(
  state: FoilScoringState,
  sample: FoilSample,
  timingTable?: TimingTable
): FoilScoringState {
  const resolvedTimingTable = resolveTimingTable(timingTable)

  if (!isValidAtUs(sample.atUs)) {
    throw new RangeError("Foil samples must use non-negative safe integer timestamps")
  }

  if (state.lastSampleAtUs !== null && sample.atUs < state.lastSampleAtUs) {
    throw new RangeError("Foil samples must use monotonic timestamps")
  }

  const hasReachedLockout = state.lockoutEndsAtUs !== null && sample.atUs >= state.lockoutEndsAtUs

  if (state.isLocked || hasReachedLockout) {
    return {
      ...state,
      isLocked: true,
      lastSampleAtUs: sample.atUs,
      left: { ...state.left, candidate: null },
      right: { ...state.right, candidate: null }
    }
  }

  const leftAdvance = advanceContact(
    "left",
    state.left,
    sample.left,
    sample.atUs,
    resolvedTimingTable.foil.contactBreakMinimumUs
  )
  const rightAdvance = advanceContact(
    "right",
    state.right,
    sample.right,
    sample.atUs,
    resolvedTimingTable.foil.contactBreakMinimumUs
  )
  const newHits = [leftAdvance.hit, rightAdvance.hit].filter((hit): hit is FoilHit => hit !== null).sort(compareHits)
  const firstHit = newHits.at(0)
  const firstHitSignalledAtUs = state.firstHitSignalledAtUs ?? firstHit?.qualifiedAtUs ?? null
  const lockoutEndsAtUs =
    state.lockoutEndsAtUs ??
    (firstHitSignalledAtUs === null ? null : firstHitSignalledAtUs + resolvedTimingTable.foil.lockoutUs)

  return {
    firstHitSignalledAtUs,
    hits: [...state.hits, ...newHits],
    isLocked: false,
    lastSampleAtUs: sample.atUs,
    left: leftAdvance.contact,
    lockoutEndsAtUs,
    right: rightAdvance.contact
  }
}
