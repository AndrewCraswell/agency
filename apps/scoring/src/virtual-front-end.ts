/**
 * A deterministic logical acquisition boundary for the scoring emulator.
 *
 * This module models observations over the seven canonical conductors. It does
 * not choose an analogue threshold, create weapon inputs, or make scoring
 * decisions. Callers provide an explicit acquisition phase and preserve the
 * raw relation evidence needed by later projection and capture work.
 */

const DEFAULT_HISTORY_LIMIT = 64
const DEFAULT_MAX_RELATIONS_PER_SNAPSHOT = 32
const MAX_IDENTIFIER_LENGTH = 120

export const VIRTUAL_FRONT_END_CONDUCTOR_IDS = [
  "left.A",
  "left.B",
  "left.C",
  "right.A",
  "right.B",
  "right.C",
  "piste"
] as const

export const VIRTUAL_FRONT_END_PHASE_IDS = [
  "foil-circuit-integrity",
  "foil-target-context",
  "foil-insulation-diagnostic",
  "epee-tip-loop",
  "epee-ground-reference",
  "epee-line-integrity",
  "sabre-target-contact",
  "sabre-own-equipment",
  "sabre-blade-contact",
  "sabre-bc-control"
] as const

export type VirtualFrontEndConductorId = (typeof VIRTUAL_FRONT_END_CONDUCTOR_IDS)[number]

export type VirtualFrontEndPhaseId = (typeof VIRTUAL_FRONT_END_PHASE_IDS)[number]

export type VirtualFrontEndSide = "left" | "right"

export type VirtualFrontEndPerspective = "acting-side" | "affected-side"

export type VirtualFrontEndAvailability = "available" | "indeterminate" | "unavailable"

export type VirtualFrontEndRelationState =
  | "open"
  | "closed"
  | "grounded"
  | "crossLine"
  | "outOfRange"
  | "indeterminate"
  | "unavailable"

export type VirtualFrontEndFaultCode =
  | "acquisition-gap"
  | "cross-line"
  | "excitation-invalid"
  | "open-circuit"
  | "out-of-range-resistance"
  | "safe-state"
  | "sample-overrun"
  | "short-to-ground"

export type VirtualFrontEndResistanceBucket = "exact" | "interval" | "not-measured"

export type VirtualFrontEndResistanceInterval = {
  maxMilliOhms: number
  minMilliOhms: number
}

export type VirtualFrontEndResistance = {
  bucket: VirtualFrontEndResistanceBucket
  intervalMilliOhms: VirtualFrontEndResistanceInterval | null
  resistanceMilliOhms: number | null
  uncertaintyMilliOhms: number | null
}

export type VirtualFrontEndProvenance = {
  observedAtUs: number
  sourceId: string
}

export type VirtualFrontEndExcitation =
  | { owner: VirtualFrontEndConductorId; state: "active" }
  | { owner: null; state: "inactive" }

export type VirtualFrontEndPhase = {
  excitation: VirtualFrontEndExcitation
  id: VirtualFrontEndPhaseId
  perspective: VirtualFrontEndPerspective
  safeInactive: boolean
  side: VirtualFrontEndSide
  status: VirtualFrontEndAvailability
}

export type VirtualFrontEndRelationInput = {
  endpoints: readonly [VirtualFrontEndConductorId, VirtualFrontEndConductorId]
  faultCode: VirtualFrontEndFaultCode | null
  id: string
  provenance: VirtualFrontEndProvenance
  resistanceMilliOhms: number | null
  resistanceUncertaintyMilliOhms: number | null
  state: VirtualFrontEndRelationState
}

export type VirtualFrontEndRelationReading = {
  endpoints: readonly [VirtualFrontEndConductorId, VirtualFrontEndConductorId]
  faultCode: VirtualFrontEndFaultCode | null
  id: string
  provenance: VirtualFrontEndProvenance
  resistance: VirtualFrontEndResistance
  state: VirtualFrontEndRelationState
}

export type VirtualFrontEndFrame = {
  atUs: number
  phase: VirtualFrontEndPhase
  relations: readonly VirtualFrontEndRelationInput[]
}

export type VirtualFrontEndTransition = {
  atUs: number
  id: string
  kind: "added" | "changed" | "removed"
  next: VirtualFrontEndRelationReading | null
  previous: VirtualFrontEndRelationReading | null
}

export type VirtualFrontEndSnapshot = {
  atUs: number
  contradictoryRelationIds: readonly string[]
  phase: VirtualFrontEndPhase
  relations: readonly VirtualFrontEndRelationReading[]
  transitions: readonly VirtualFrontEndTransition[]
  trust: VirtualFrontEndAvailability
}

export type VirtualFrontEndOptions = {
  historyLimit?: number
  maxRelationsPerSnapshot?: number
}

export type VirtualFrontEndState = {
  current: VirtualFrontEndSnapshot | null
  lastAtUs: number | null
  snapshots: readonly VirtualFrontEndSnapshot[]
}

const PHASE_PERSPECTIVES: Readonly<Record<VirtualFrontEndPhaseId, VirtualFrontEndPerspective>> = {
  "epee-ground-reference": "affected-side",
  "epee-line-integrity": "affected-side",
  "epee-tip-loop": "affected-side",
  "foil-circuit-integrity": "acting-side",
  "foil-insulation-diagnostic": "affected-side",
  "foil-target-context": "acting-side",
  "sabre-bc-control": "affected-side",
  "sabre-blade-contact": "acting-side",
  "sabre-own-equipment": "affected-side",
  "sabre-target-contact": "acting-side"
}

function assertNonNegativeSafeInteger(value: number, description: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${description} must be a non-negative safe integer`)
  }
}

function assertIdentifier(value: string, description: string): void {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_IDENTIFIER_LENGTH) {
    throw new RangeError(`${description} must be a non-empty string no longer than ${MAX_IDENTIFIER_LENGTH} characters`)
  }
}

function isConductorId(value: unknown): value is VirtualFrontEndConductorId {
  return typeof value === "string" && VIRTUAL_FRONT_END_CONDUCTOR_IDS.some((conductorId) => conductorId === value)
}

function isPhaseId(value: unknown): value is VirtualFrontEndPhaseId {
  return typeof value === "string" && VIRTUAL_FRONT_END_PHASE_IDS.some((phaseId) => phaseId === value)
}

function isRelationState(value: unknown): value is VirtualFrontEndRelationState {
  return (
    value === "open" ||
    value === "closed" ||
    value === "grounded" ||
    value === "crossLine" ||
    value === "outOfRange" ||
    value === "indeterminate" ||
    value === "unavailable"
  )
}

function isFaultCode(value: unknown): value is VirtualFrontEndFaultCode {
  return (
    value === "acquisition-gap" ||
    value === "cross-line" ||
    value === "excitation-invalid" ||
    value === "open-circuit" ||
    value === "out-of-range-resistance" ||
    value === "safe-state" ||
    value === "sample-overrun" ||
    value === "short-to-ground"
  )
}

function assertPhase(phase: VirtualFrontEndPhase): void {
  if (!isPhaseId(phase.id)) {
    throw new RangeError("Virtual front-end phases must use a declared M0-03 phase ID")
  }

  if (phase.side !== "left" && phase.side !== "right") {
    throw new RangeError("Virtual front-end phases must identify the left or right side")
  }

  if (phase.perspective !== PHASE_PERSPECTIVES[phase.id]) {
    throw new RangeError("Virtual front-end phases must use their declared M0-03 perspective")
  }

  if (phase.status !== "available" && phase.status !== "indeterminate" && phase.status !== "unavailable") {
    throw new RangeError("Virtual front-end phases must have an explicit availability status")
  }

  if (typeof phase.safeInactive !== "boolean") {
    throw new TypeError("Virtual front-end safeInactive must be a boolean")
  }

  if (phase.excitation.state === "active") {
    if (!isConductorId(phase.excitation.owner)) {
      throw new RangeError("Active virtual front-end excitation requires one declared conductor owner")
    }
  } else if (phase.excitation.state === "inactive") {
    if (phase.excitation.owner !== null) {
      throw new RangeError("Inactive virtual front-end excitation cannot have a conductor owner")
    }
  } else {
    throw new RangeError("Virtual front-end excitation must be active or inactive")
  }

  if (phase.status !== "available") {
    if (!phase.safeInactive || phase.excitation.state !== "inactive") {
      throw new RangeError("Indeterminate or unavailable virtual front-end phases must be safe inactive")
    }
  }

  if (phase.safeInactive && phase.excitation.state !== "inactive") {
    throw new RangeError("Safe inactive virtual front-end phases cannot drive excitation")
  }
}

function toResistance(
  resistanceMilliOhms: number | null,
  uncertaintyMilliOhms: number | null
): VirtualFrontEndResistance {
  if (resistanceMilliOhms === null || uncertaintyMilliOhms === null) {
    if (resistanceMilliOhms !== null || uncertaintyMilliOhms !== null) {
      throw new RangeError("Virtual front-end resistance requires a value and uncertainty together")
    }

    return {
      bucket: "not-measured",
      intervalMilliOhms: null,
      resistanceMilliOhms: null,
      uncertaintyMilliOhms: null
    }
  }

  assertNonNegativeSafeInteger(resistanceMilliOhms, "Virtual front-end resistanceMilliOhms")
  assertNonNegativeSafeInteger(uncertaintyMilliOhms, "Virtual front-end resistanceUncertaintyMilliOhms")

  if (resistanceMilliOhms > Number.MAX_SAFE_INTEGER - uncertaintyMilliOhms) {
    throw new RangeError("Virtual front-end resistance intervals must remain safe integers")
  }

  return {
    bucket: uncertaintyMilliOhms === 0 ? "exact" : "interval",
    intervalMilliOhms: {
      maxMilliOhms: resistanceMilliOhms + uncertaintyMilliOhms,
      minMilliOhms: Math.max(0, resistanceMilliOhms - uncertaintyMilliOhms)
    },
    resistanceMilliOhms,
    uncertaintyMilliOhms
  }
}

function assertFaultState(state: VirtualFrontEndRelationState, faultCode: VirtualFrontEndFaultCode | null): void {
  if (faultCode !== null && !isFaultCode(faultCode)) {
    throw new RangeError("Virtual front-end fault codes must use the decision-record diagnostic vocabulary")
  }

  if (state === "crossLine" && faultCode !== "cross-line") {
    throw new RangeError("crossLine readings require the cross-line fault code")
  }

  if (state === "outOfRange" && faultCode !== "out-of-range-resistance") {
    throw new RangeError("outOfRange readings require the out-of-range-resistance fault code")
  }

  if (state === "grounded" && faultCode !== null && faultCode !== "short-to-ground") {
    throw new RangeError("grounded readings may only carry the short-to-ground fault code")
  }

  if (state === "open" && faultCode !== null && faultCode !== "open-circuit") {
    throw new RangeError("open readings may only carry the open-circuit fault code")
  }

  if ((state === "closed" || state === "indeterminate") && faultCode !== null) {
    throw new RangeError("closed and indeterminate readings cannot carry a fault code")
  }

  if (faultCode === "open-circuit" && state !== "open") {
    throw new RangeError("open-circuit faults require an open reading")
  }

  if (state === "unavailable" && (faultCode === "cross-line" || faultCode === "open-circuit")) {
    throw new RangeError("Unavailable readings cannot relabel a line fault")
  }
}

function normalizeRelation(input: VirtualFrontEndRelationInput): VirtualFrontEndRelationReading {
  assertIdentifier(input.id, "Virtual front-end relation IDs")

  const [first, second] = input.endpoints
  if (!isConductorId(first) || !isConductorId(second) || first >= second) {
    throw new RangeError("Virtual front-end relation endpoints must be distinct canonical conductors in lexical order")
  }

  if (!isRelationState(input.state)) {
    throw new RangeError("Virtual front-end readings must use a declared relation state")
  }

  assertFaultState(input.state, input.faultCode)
  assertIdentifier(input.provenance.sourceId, "Virtual front-end provenance source IDs")
  assertNonNegativeSafeInteger(input.provenance.observedAtUs, "Virtual front-end provenance timestamps")

  return {
    endpoints: [first, second],
    faultCode: input.faultCode,
    id: input.id,
    provenance: { ...input.provenance },
    resistance: toResistance(input.resistanceMilliOhms, input.resistanceUncertaintyMilliOhms),
    state: input.state
  }
}

function relationSignature(reading: VirtualFrontEndRelationReading): string {
  const interval = reading.resistance.intervalMilliOhms
  return [
    reading.endpoints[0],
    reading.endpoints[1],
    reading.faultCode ?? "",
    interval?.maxMilliOhms ?? "",
    interval?.minMilliOhms ?? "",
    reading.resistance.resistanceMilliOhms ?? "",
    reading.resistance.uncertaintyMilliOhms ?? "",
    reading.state
  ].join("\u0000")
}

function compareRelations(left: VirtualFrontEndRelationReading, right: VirtualFrontEndRelationReading): number {
  const leftKey = `${left.endpoints[0]}\u0000${left.endpoints[1]}\u0000${left.id}`
  const rightKey = `${right.endpoints[0]}\u0000${right.endpoints[1]}\u0000${right.id}`
  if (leftKey < rightKey) {
    return -1
  }

  // Relation IDs are unique before sorting, so equal relation keys are impossible.
  return 1
}

function collectContradictions(relations: readonly VirtualFrontEndRelationReading[]): readonly string[] {
  const byEndpoints = new Map<string, VirtualFrontEndRelationReading[]>()

  for (const relation of relations) {
    const key = `${relation.endpoints[0]}\u0000${relation.endpoints[1]}`
    const existing = byEndpoints.get(key)
    if (existing === undefined) {
      byEndpoints.set(key, [relation])
    } else {
      existing.push(relation)
    }
  }

  const contradictoryIds: string[] = []
  for (const relationsWithEndpoints of byEndpoints.values()) {
    const observedStates = new Set(
      relationsWithEndpoints
        .map((relation) => relation.state)
        .filter(
          (state): state is "open" | "closed" | "grounded" =>
            state === "open" || state === "closed" || state === "grounded"
        )
    )

    if (observedStates.size > 1) {
      contradictoryIds.push(...relationsWithEndpoints.map((relation) => relation.id))
    }
  }

  return contradictoryIds.sort()
}

function calculateTrust(
  phase: VirtualFrontEndPhase,
  relations: readonly VirtualFrontEndRelationReading[],
  contradictoryRelationIds: readonly string[]
): VirtualFrontEndAvailability {
  if (phase.status === "unavailable" || relations.some((relation) => relation.state === "unavailable")) {
    return "unavailable"
  }

  if (
    phase.status === "indeterminate" ||
    contradictoryRelationIds.length > 0 ||
    relations.some((relation) => relation.state === "indeterminate")
  ) {
    return "indeterminate"
  }

  return "available"
}

function validateDeclaredAvailability(
  phase: VirtualFrontEndPhase,
  relations: readonly VirtualFrontEndRelationReading[],
  contradictoryRelationIds: readonly string[]
): void {
  const derivedTrust = calculateTrust(phase, relations, contradictoryRelationIds)
  if (derivedTrust !== phase.status) {
    throw new RangeError("Virtual front-end phase status must preserve unavailable or indeterminate relation evidence")
  }
}

function compareTransitionIds(left: VirtualFrontEndTransition, right: VirtualFrontEndTransition): number {
  if (left.id < right.id) {
    return -1
  }

  // Transition IDs are drawn from unique relation IDs, so equality is impossible.
  return 1
}

function collectTransitions(
  previous: VirtualFrontEndSnapshot | null,
  nextRelations: readonly VirtualFrontEndRelationReading[],
  atUs: number
): readonly VirtualFrontEndTransition[] {
  const previousById = new Map(previous?.relations.map((relation) => [relation.id, relation]) ?? [])
  const nextById = new Map(nextRelations.map((relation) => [relation.id, relation]))
  const transitions: VirtualFrontEndTransition[] = []

  for (const [id, relation] of nextById) {
    const prior = previousById.get(id)
    if (prior === undefined) {
      transitions.push({ atUs, id, kind: "added", next: relation, previous: null })
    } else if (relationSignature(prior) !== relationSignature(relation)) {
      transitions.push({ atUs, id, kind: "changed", next: relation, previous: prior })
    }
  }

  for (const [id, relation] of previousById) {
    if (!nextById.has(id)) {
      transitions.push({ atUs, id, kind: "removed", next: null, previous: relation })
    }
  }

  return transitions.sort(compareTransitionIds)
}

function clonePhase(phase: VirtualFrontEndPhase): VirtualFrontEndPhase {
  return {
    ...phase,
    excitation: phase.excitation.state === "active" ? { ...phase.excitation } : { owner: null, state: "inactive" }
  }
}

function normalizeFrame(
  frame: VirtualFrontEndFrame,
  previous: VirtualFrontEndSnapshot | null,
  maxRelationsPerSnapshot: number
): VirtualFrontEndSnapshot {
  assertNonNegativeSafeInteger(frame.atUs, "Virtual front-end timestamps")
  assertPhase(frame.phase)

  if (!Array.isArray(frame.relations) || frame.relations.length > maxRelationsPerSnapshot) {
    throw new RangeError(`Virtual front-end snapshots may contain at most ${maxRelationsPerSnapshot} relations`)
  }

  const relationIds = new Set<string>()
  const relations = frame.relations.map((relation) => {
    const normalized = normalizeRelation(relation)
    if (normalized.provenance.observedAtUs > frame.atUs) {
      throw new RangeError("Virtual front-end provenance cannot be observed after its snapshot")
    }

    if (relationIds.has(normalized.id)) {
      throw new RangeError("Virtual front-end snapshots require unique relation IDs")
    }

    relationIds.add(normalized.id)
    return normalized
  })

  relations.sort(compareRelations)
  const contradictoryRelationIds = collectContradictions(relations)
  validateDeclaredAvailability(frame.phase, relations, contradictoryRelationIds)

  return {
    atUs: frame.atUs,
    contradictoryRelationIds,
    phase: clonePhase(frame.phase),
    relations,
    transitions: collectTransitions(previous, relations, frame.atUs),
    trust: calculateTrust(frame.phase, relations, contradictoryRelationIds)
  }
}

export function createVirtualFrontEndState(): VirtualFrontEndState {
  return { current: null, lastAtUs: null, snapshots: [] }
}

/**
 * Applies one complete phase snapshot. The caller supplies scoring-clock time;
 * no host clock, scheduler, resistance threshold, or weapon rule is used.
 */
export function advanceVirtualFrontEnd(
  state: VirtualFrontEndState,
  frame: VirtualFrontEndFrame,
  options: VirtualFrontEndOptions = {}
): VirtualFrontEndState {
  const historyLimit = options.historyLimit ?? DEFAULT_HISTORY_LIMIT
  const maxRelationsPerSnapshot = options.maxRelationsPerSnapshot ?? DEFAULT_MAX_RELATIONS_PER_SNAPSHOT
  assertNonNegativeSafeInteger(historyLimit, "Virtual front-end historyLimit")
  assertNonNegativeSafeInteger(maxRelationsPerSnapshot, "Virtual front-end maxRelationsPerSnapshot")

  if (historyLimit === 0 || maxRelationsPerSnapshot === 0) {
    throw new RangeError("Virtual front-end collection limits must be greater than zero")
  }

  if (state.lastAtUs !== null && frame.atUs < state.lastAtUs) {
    throw new RangeError("Virtual front-end snapshots must use monotonic timestamps")
  }

  const current = normalizeFrame(frame, state.current, maxRelationsPerSnapshot)
  const snapshots = [...state.snapshots, current].slice(-historyLimit)

  return { current, lastAtUs: frame.atUs, snapshots }
}
