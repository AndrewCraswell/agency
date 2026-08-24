import {
  advanceEpeeLifecycle,
  createEpeeLifecycleState,
  type EpeeContactClassification,
  type EpeeContactLifecycleState
} from "./epee-contact-kernel.js"
import { isIntegerMicroseconds } from "./scoring-glossary-and-units.js"
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

type ContactState = EpeeContactLifecycleState

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

export function createEpeeScoringState(): EpeeScoringState {
  return createEpeeLifecycleState()
}

function classifyContact(contact: EpeeContact): EpeeContactClassification<undefined, never> {
  return contact.isTipClosed && !contact.isGrounded ? { candidate: undefined, type: "candidate" } : { type: "open" }
}

export function advanceEpeeScoring(
  state: EpeeScoringState,
  sample: EpeeSample,
  timingTable?: TimingTable
): EpeeScoringState {
  const resolvedTimingTable = resolveTimingTable(timingTable)

  if (!isIntegerMicroseconds(sample.atUs)) {
    throw new RangeError("Epee samples must use non-negative safe integer timestamps")
  }

  const lifecycle = advanceEpeeLifecycle(state, {
    atUs: sample.atUs,
    classifyLeft: () => classifyContact(sample.left),
    classifyRight: () => classifyContact(sample.right),
    contactMinimumUs: resolvedTimingTable.epee.contactMinimumUs,
    doubleHitWindowUs: resolvedTimingTable.epee.doubleHitWindowUs,
    monotonicTimestampError: "Epee samples must use monotonic timestamps"
  })

  return {
    firstHitAtUs: lifecycle.firstHitAtUs,
    hits: lifecycle.hits,
    isLocked: lifecycle.isLocked,
    lastSampleAtUs: lifecycle.lastSampleAtUs,
    left: lifecycle.left,
    right: lifecycle.right
  }
}
