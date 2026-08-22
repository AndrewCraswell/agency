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

export const EPEE_RULES = {
  contactTimeUs: 2_000,
  lockoutTimeUs: 45_000
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

function advanceContact(side: Side, state: ContactState, contact: EpeeContact, atUs: number): ContactAdvance {
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

  if (atUs - state.candidateSinceUs < EPEE_RULES.contactTimeUs) {
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

function isPendingInsideLockout(contact: ContactState, lockoutEndsAtUs: number) {
  return contact.candidateSinceUs !== null && contact.candidateSinceUs <= lockoutEndsAtUs
}

export function advanceEpeeScoring(state: EpeeScoringState, sample: EpeeSample): EpeeScoringState {
  if (state.lastSampleAtUs !== null && sample.atUs < state.lastSampleAtUs) {
    throw new RangeError("Epee samples must use monotonic timestamps")
  }

  if (state.isLocked) {
    return { ...state, lastSampleAtUs: sample.atUs }
  }

  const leftAdvance = advanceContact("left", state.left, sample.left, sample.atUs)
  const rightAdvance = advanceContact("right", state.right, sample.right, sample.atUs)
  const newHits = [leftAdvance.hit, rightAdvance.hit].filter((hit): hit is EpeeHit => hit !== null).sort(compareHits)

  let firstHitAtUs = state.firstHitAtUs
  const hits = [...state.hits]

  for (const hit of newHits) {
    if (firstHitAtUs === null) {
      firstHitAtUs = hit.startedAtUs
      hits.push(hit)
      continue
    }

    if (hit.startedAtUs - firstHitAtUs <= EPEE_RULES.lockoutTimeUs) {
      hits.push(hit)
    }
  }

  const lockoutEndsAtUs = firstHitAtUs === null ? null : firstHitAtUs + EPEE_RULES.lockoutTimeUs
  const hasPendingHit =
    lockoutEndsAtUs !== null &&
    (isPendingInsideLockout(leftAdvance.contact, lockoutEndsAtUs) ||
      isPendingInsideLockout(rightAdvance.contact, lockoutEndsAtUs))
  const isLocked = lockoutEndsAtUs !== null && sample.atUs > lockoutEndsAtUs && !hasPendingHit

  return {
    firstHitAtUs,
    hits,
    isLocked,
    lastSampleAtUs: sample.atUs,
    left: leftAdvance.contact,
    right: rightAdvance.contact
  }
}
