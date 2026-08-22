import { loadTimingTable, resolveTimingTable, type TimingTable } from "./timing-table.js"

export type EpeeContact = {
  isGrounded: boolean
  isTipClosed: boolean
}

export type EpeeSample = {
  atUs: number
  left: EpeeContact
  right: EpeeContact
}

export type Side = "left" | "right"

export type EpeeHit = {
  qualifiedAtUs: number
  side: Side
  startedAtUs: number
}

type ContactState = {
  candidateSinceUs: number | null
  isRegistered: boolean
}

export type EpeeScoringState = {
  firstHitAtUs: number | null
  hits: readonly EpeeHit[]
  isLocked: boolean
  lastSampleAtUs: number | null
  left: ContactState
  right: ContactState
}

const DEFAULT_TIMING_TABLE = loadTimingTable("timing-1")

/** Compatibility names for existing callers; runtime decisions use a loaded table. */
export const EPEE_RULES = {
  contactTimeUs: DEFAULT_TIMING_TABLE.epee.contactMinimumUs,
  lockoutTimeUs: DEFAULT_TIMING_TABLE.epee.doubleHitWindowUs
} as const

const INITIAL_CONTACT_STATE: ContactState = {
  candidateSinceUs: null,
  isRegistered: false
}

export function createEpeeScoringState(): EpeeScoringState {
  return {
    firstHitAtUs: null,
    hits: [],
    isLocked: false,
    lastSampleAtUs: null,
    left: INITIAL_CONTACT_STATE,
    right: INITIAL_CONTACT_STATE
  }
}

type ContactAdvance = {
  contact: ContactState
  hit: EpeeHit | null
}

function advanceContact(
  side: Side,
  state: ContactState,
  contact: EpeeContact,
  atUs: number,
  contactMinimumUs: number
): ContactAdvance {
  if (state.isRegistered) {
    return { contact: state, hit: null }
  }

  const isValidContact = contact.isTipClosed && !contact.isGrounded

  if (!isValidContact) {
    return {
      contact: { candidateSinceUs: null, isRegistered: false },
      hit: null
    }
  }

  if (state.candidateSinceUs === null) {
    return {
      contact: { candidateSinceUs: atUs, isRegistered: false },
      hit: null
    }
  }

  if (atUs - state.candidateSinceUs < contactMinimumUs) {
    return { contact: state, hit: null }
  }

  return {
    contact: { candidateSinceUs: null, isRegistered: true },
    hit: {
      qualifiedAtUs: atUs,
      side,
      startedAtUs: state.candidateSinceUs
    }
  }
}

function compareHits(left: EpeeHit, right: EpeeHit) {
  if (left.startedAtUs !== right.startedAtUs) {
    return left.startedAtUs - right.startedAtUs
  }

  return left.side.localeCompare(right.side)
}

function isPendingInsideLockout(contact: ContactState, firstHitAtUs: number, doubleHitWindowUs: number) {
  return contact.candidateSinceUs !== null && contact.candidateSinceUs - firstHitAtUs <= doubleHitWindowUs
}

export function advanceEpeeScoring(
  state: EpeeScoringState,
  sample: EpeeSample,
  timingTable?: TimingTable
): EpeeScoringState {
  const resolvedTimingTable = resolveTimingTable(timingTable)

  if (!Number.isSafeInteger(sample.atUs) || sample.atUs < 0) {
    throw new RangeError("Epee samples must use non-negative safe integer timestamps")
  }

  if (state.lastSampleAtUs !== null && sample.atUs < state.lastSampleAtUs) {
    throw new RangeError("Epee samples must use monotonic timestamps")
  }

  if (state.isLocked) {
    return { ...state, lastSampleAtUs: sample.atUs }
  }

  const leftAdvance = advanceContact(
    "left",
    state.left,
    sample.left,
    sample.atUs,
    resolvedTimingTable.epee.contactMinimumUs
  )
  const rightAdvance = advanceContact(
    "right",
    state.right,
    sample.right,
    sample.atUs,
    resolvedTimingTable.epee.contactMinimumUs
  )
  const newHits = [leftAdvance.hit, rightAdvance.hit].filter((hit): hit is EpeeHit => hit !== null).sort(compareHits)

  let firstHitAtUs = state.firstHitAtUs
  const hits = [...state.hits]

  for (const hit of newHits) {
    if (firstHitAtUs === null) {
      firstHitAtUs = hit.startedAtUs
      hits.push(hit)
      continue
    }

    if (hit.startedAtUs - firstHitAtUs <= resolvedTimingTable.epee.doubleHitWindowUs) {
      hits.push(hit)
    }
  }

  const hasPendingHit =
    firstHitAtUs !== null &&
    (isPendingInsideLockout(leftAdvance.contact, firstHitAtUs, resolvedTimingTable.epee.doubleHitWindowUs) ||
      isPendingInsideLockout(rightAdvance.contact, firstHitAtUs, resolvedTimingTable.epee.doubleHitWindowUs))
  const isLocked =
    firstHitAtUs !== null && sample.atUs - firstHitAtUs > resolvedTimingTable.epee.doubleHitWindowUs && !hasPendingHit

  return {
    firstHitAtUs,
    hits,
    isLocked,
    lastSampleAtUs: sample.atUs,
    left: leftAdvance.contact,
    right: rightAdvance.contact
  }
}
