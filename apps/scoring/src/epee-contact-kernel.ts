export type EpeeKernelSide = "left" | "right"

export type EpeeKernelHit = {
  qualifiedAtUs: number
  side: EpeeKernelSide
  startedAtUs: number
}

export type EpeeContactLifecycleState = {
  candidateSinceUs: number | null
  isRegistered: boolean
}

export type EpeeLifecycleState = {
  firstHitAtUs: number | null
  hits: readonly EpeeKernelHit[]
  isLocked: boolean
  lastSampleAtUs: number | null
  left: EpeeContactLifecycleState
  right: EpeeContactLifecycleState
}

export type EpeeContactClassification<Candidate, Decision> =
  | { candidate: Candidate; type: "candidate" }
  | { type: "open" }
  | { decision: Decision; type: "decision" }

type EpeeSideAdvance<Candidate, Decision> = {
  contact: EpeeContactLifecycleState
  decision: Decision | null
  qualified: { candidate: Candidate; hit: EpeeKernelHit } | null
}

type EpeeLifecycleInput<Candidate, Decision> = {
  atUs: number
  classifyLeft: () => EpeeContactClassification<Candidate, Decision>
  classifyRight: () => EpeeContactClassification<Candidate, Decision>
  contactMinimumUs: number
  doubleHitWindowUs: number
  monotonicTimestampError: string
}

export type EpeeLifecycleAdvance<Candidate, Decision> = EpeeLifecycleState & {
  decisions: readonly Decision[]
  qualifiedHits: readonly { candidate: Candidate; hit: EpeeKernelHit }[]
}

const INITIAL_CONTACT_STATE: EpeeContactLifecycleState = {
  candidateSinceUs: null,
  isRegistered: false
}

function advanceSide<Candidate, Decision>(
  side: EpeeKernelSide,
  state: EpeeContactLifecycleState,
  classification: EpeeContactClassification<Candidate, Decision>,
  atUs: number,
  contactMinimumUs: number
): EpeeSideAdvance<Candidate, Decision> {
  if (classification.type === "decision") {
    return {
      contact: state.isRegistered ? state : INITIAL_CONTACT_STATE,
      decision: classification.decision,
      qualified: null
    }
  }

  if (classification.type === "open") {
    return { contact: state.isRegistered ? state : INITIAL_CONTACT_STATE, decision: null, qualified: null }
  }

  if (state.isRegistered) {
    return { contact: state, decision: null, qualified: null }
  }

  if (state.candidateSinceUs === null) {
    return {
      contact: { candidateSinceUs: atUs, isRegistered: false },
      decision: null,
      qualified: null
    }
  }

  if (atUs - state.candidateSinceUs < contactMinimumUs) {
    return { contact: state, decision: null, qualified: null }
  }

  const hit = { qualifiedAtUs: atUs, side, startedAtUs: state.candidateSinceUs }
  return {
    contact: { candidateSinceUs: null, isRegistered: true },
    decision: null,
    qualified: { candidate: classification.candidate, hit }
  }
}

function compareHits<Candidate>(
  left: { candidate: Candidate; hit: EpeeKernelHit },
  right: { candidate: Candidate; hit: EpeeKernelHit }
) {
  if (left.hit.startedAtUs !== right.hit.startedAtUs) {
    return left.hit.startedAtUs - right.hit.startedAtUs
  }

  return left.hit.side.localeCompare(right.hit.side)
}

function isPendingInsideLockout(contact: EpeeContactLifecycleState, firstHitAtUs: number, doubleHitWindowUs: number) {
  return contact.candidateSinceUs !== null && contact.candidateSinceUs - firstHitAtUs <= doubleHitWindowUs
}

export function createEpeeLifecycleState(): EpeeLifecycleState {
  return {
    firstHitAtUs: null,
    hits: [],
    isLocked: false,
    lastSampleAtUs: null,
    left: INITIAL_CONTACT_STATE,
    right: INITIAL_CONTACT_STATE
  }
}

export function advanceEpeeLifecycle<Candidate, Decision>(
  state: EpeeLifecycleState,
  input: EpeeLifecycleInput<Candidate, Decision>
): EpeeLifecycleAdvance<Candidate, Decision> {
  if (state.lastSampleAtUs !== null && input.atUs < state.lastSampleAtUs) {
    throw new RangeError(input.monotonicTimestampError)
  }

  if (state.isLocked) {
    return { ...state, decisions: [], lastSampleAtUs: input.atUs, qualifiedHits: [] }
  }

  const leftAdvance = advanceSide("left", state.left, input.classifyLeft(), input.atUs, input.contactMinimumUs)
  const rightAdvance = advanceSide("right", state.right, input.classifyRight(), input.atUs, input.contactMinimumUs)
  const newHits = [leftAdvance.qualified, rightAdvance.qualified]
    .filter((hit): hit is { candidate: Candidate; hit: EpeeKernelHit } => hit !== null)
    .sort(compareHits)

  let firstHitAtUs = state.firstHitAtUs
  const hits = [...state.hits]
  const qualifiedHits: { candidate: Candidate; hit: EpeeKernelHit }[] = []

  for (const qualified of newHits) {
    if (firstHitAtUs === null) {
      firstHitAtUs = qualified.hit.startedAtUs
      hits.push(qualified.hit)
      qualifiedHits.push(qualified)
      continue
    }

    if (qualified.hit.startedAtUs - firstHitAtUs <= input.doubleHitWindowUs) {
      hits.push(qualified.hit)
      qualifiedHits.push(qualified)
    }
  }

  const hasPendingHit =
    firstHitAtUs !== null &&
    (isPendingInsideLockout(leftAdvance.contact, firstHitAtUs, input.doubleHitWindowUs) ||
      isPendingInsideLockout(rightAdvance.contact, firstHitAtUs, input.doubleHitWindowUs))
  const isLocked = firstHitAtUs !== null && input.atUs - firstHitAtUs > input.doubleHitWindowUs && !hasPendingHit

  return {
    decisions: [leftAdvance.decision, rightAdvance.decision].filter(
      (decision): decision is Decision => decision !== null
    ),
    firstHitAtUs,
    hits,
    isLocked,
    lastSampleAtUs: input.atUs,
    left: leftAdvance.contact,
    qualifiedHits,
    right: rightAdvance.contact
  }
}
