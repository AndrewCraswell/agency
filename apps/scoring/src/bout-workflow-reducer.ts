import type { Weapon } from "./bout-state.js"
/**
 * RC-05 authoritative reducer for the application-owned bout workflow.
 *
 * This module deliberately does not create or mutate STM32 DecisionRecords.
 * New-bout completion is represented as a pending request until a separately
 * authenticated STM32 response supplies its immutable correlation id.
 */
import {
  isRemoteCommand,
  parseBoutWorkflowSnapshot,
  type BoutStateEvent,
  type BoutWorkflowSnapshot,
  type ControllerAuthority,
  type RemoteCommand,
  type RemoteCommandRejectionReason,
  type SourceCommandIdentity
} from "./remote-control.js"

export type FreshBoutWorkflowInput = Readonly<{
  apparatusId: string
  authority: ControllerAuthority
  boutId: string
  boutRevision?: number
  clockDurationCentiseconds: number
  eventRevision?: number
  initialCompetition: Readonly<{ kind: "match" | "period"; value: number }>
  sourceCommandIdentity: SourceCommandIdentity
  timingConfigurationRevision: string
  weapon: Weapon
}>

export type NewBoutConfiguration = Readonly<{
  boutId: string
  clockDurationCentiseconds: number
  initialCompetition: Readonly<{ kind: "match" | "period"; value: number }>
  timingConfigurationRevision: string
  weapon: Weapon
}>

export type PendingNewBout = Readonly<{
  action: Readonly<{
    command: RemoteCommand
    nextBout: NewBoutConfiguration
    type: "command"
  }>
}>

/** A validated bit from the separately reviewed priority-entropy owner. */
export type PriorityEntropyReceipt = Readonly<{
  bit: 0 | 1
  ownerId: string
  ownerRevision: string
  sampleId: string
}>

export type CompetitionFormatAuthority = Readonly<{
  registryDigest: string
  registryId: string
  ownerId: string
  registryRevision: string
}>

export const COMPETITION_FORMAT_REGISTRY = Object.freeze({
  authority: Object.freeze({
    ownerId: "scoring-product-rules",
    registryDigest: "sha256:8ccfc9c878c8758bde503fec7bba2f81308da66528b3b7b6ab1e4b8046770d98",
    registryId: "prototype-bout-format-registry",
    registryRevision: "2026-08-23.1"
  }),
  bounds: Object.freeze({
    match: Object.freeze({ maximum: 3, minimum: 1 }),
    period: Object.freeze({ maximum: 3, minimum: 1 })
  })
})

export const PRIORITY_ENTROPY_OWNER = Object.freeze({
  ownerId: "priority-entropy-owner",
  ownerRevision: "priority-entropy-1"
})

/**
 * An opaque receipt issued only by the authenticated priority-entropy owner.
 *
 * This reducer intentionally exposes no receipt factory: accepting a caller
 * supplied verification callback would let that caller mint a trusted bit.
 * The reviewed transport/security boundary owns the only issuer and passes
 * its opaque object directly to this reducer.
 */
const verifiedPriorityEntropyReceipts = new WeakSet<object>()
const parsedCommandActions = new WeakMap<RemoteCommand, BoutWorkflowCommandAction>()

export type BoutWorkflowReducerState = Readonly<{
  completedCommandIds: readonly string[]
  completedActions: readonly BoutWorkflowCommandAction[]
  completedEvents: readonly BoutStateEvent[]
  pendingNewBout: PendingNewBout | null
  snapshot: BoutWorkflowSnapshot
}>

export type BoutWorkflowCommandAction = Readonly<{
  command: RemoteCommand
  nextBout: NewBoutConfiguration | null
  priorityEntropyReceipt?: PriorityEntropyReceipt
  type: "command"
}>

export type BoutWorkflowAction = BoutWorkflowCommandAction | Stm32BoutResetResult

export type Stm32BoutResetResult =
  | Readonly<{
      authority: "stm32-scoring"
      requestId: string
      result: "accepted"
      stm32RecordId: string
      type: "stm32-bout-reset-result"
    }>
  | Readonly<{
      authority: "stm32-scoring"
      requestId: string
      result: "rejected"
      stm32RecordId: null
      type: "stm32-bout-reset-result"
    }>

export type BoutWorkflowReduction = Readonly<{
  event: BoutStateEvent | null
  outcome: "applied" | "duplicate" | "ignored" | "pending" | "rejected"
  reason: RemoteCommandRejectionReason | "malformed-action" | "unknown-stm32-request" | null
  state: BoutWorkflowReducerState
}>

/**
 * The event replay cache is intentionally shorter than the command-ID ledger.
 * The reducer never evicts command IDs. Once full, it stays unavailable for
 * new commands until the owning service performs an explicit audited lifecycle
 * reset; retransmissions of retained IDs still resolve as duplicates.
 */
export const BOUT_WORKFLOW_COMMAND_ID_CAPACITY = 4_096
const MAX_RETAINED_EVENTS = 256
const IDENTIFIER_MAX = 96

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= IDENTIFIER_MAX && value === value.trim()
}

/** Verifies descriptors before any untrusted STM32 field is read. */
function isStrictPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Object.getPrototypeOf(value) !== Object.prototype) return false
  return Reflect.ownKeys(value).every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    return typeof key === "string" && descriptor !== undefined && descriptor.enumerable && "value" in descriptor
  })
}

function hasExactlyKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Reflect.ownKeys(value)
  return actual.length === expected.length && actual.every((key) => typeof key === "string" && expected.includes(key))
}

function isNonnegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
}

function isPositiveInteger(value: unknown): value is number {
  return isNonnegativeInteger(value) && value > 0
}

function sameAuthority(left: ControllerAuthority, right: ControllerAuthority): boolean {
  return (
    left.authorityRevision === right.authorityRevision &&
    left.controllerId === right.controllerId &&
    left.kind === right.kind &&
    left.permission === right.permission
  )
}

function sourceFor(command: RemoteCommand): SourceCommandIdentity {
  return {
    apparatusId: command.apparatusId,
    commandId: command.commandId,
    controllerId: command.authority.controllerId,
    counter: command.counter,
    remoteId: command.remoteId
  }
}

function copySnapshot(snapshot: BoutWorkflowSnapshot): BoutWorkflowSnapshot {
  return structuredClone(snapshot)
}

function freeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value
  for (const child of Object.values(value)) freeze(child)
  return Object.freeze(value)
}

function freezeState(
  snapshot: BoutWorkflowSnapshot,
  pendingNewBout: PendingNewBout | null,
  completedEvents: readonly BoutStateEvent[],
  completedCommandIds: readonly string[],
  completedActions: readonly BoutWorkflowCommandAction[]
): BoutWorkflowReducerState {
  return freeze({
    completedCommandIds: [...completedCommandIds],
    completedActions: completedActions.map((action) => structuredClone(action)),
    completedEvents: completedEvents.map((event) => freeze(structuredClone(event))),
    pendingNewBout: pendingNewBout === null ? null : freeze(structuredClone(pendingNewBout)),
    snapshot: freeze(copySnapshot(snapshot))
  })
}

function eventFor(
  command: RemoteCommand,
  snapshot: BoutWorkflowSnapshot,
  cause: Exclude<BoutStateEvent["cause"], "command.rejected">,
  stm32RecordId: string | null
): BoutStateEvent {
  return freeze({
    cause,
    disposition: "accepted",
    eventId: command.commandId,
    eventRevision: snapshot.eventRevision,
    rejectionReason: null,
    resultingBoutState: snapshot,
    schemaVersion: 1,
    sourceCommand: structuredClone(command),
    stm32RecordId
  })
}

function rejection(
  command: RemoteCommand,
  reason: RemoteCommandRejectionReason,
  eventRevision: number
): BoutStateEvent {
  return freeze({
    cause: "command.rejected",
    disposition: "rejected",
    eventId: command.commandId,
    eventRevision,
    rejectionReason: reason,
    resultingBoutState: null,
    schemaVersion: 1,
    sourceCommand: structuredClone(command),
    stm32RecordId: null
  })
}

function remember(
  state: BoutWorkflowReducerState,
  event: BoutStateEvent,
  action: BoutWorkflowCommandAction
): BoutWorkflowReducerState {
  const completed = [...state.completedEvents, event]
  return freezeState(
    state.snapshot,
    state.pendingNewBout,
    completed.slice(-MAX_RETAINED_EVENTS),
    [...state.completedCommandIds, event.sourceCommand.commandId],
    [...state.completedActions, action]
  )
}

function complete(
  state: BoutWorkflowReducerState,
  snapshot: BoutWorkflowSnapshot,
  pendingNewBout: PendingNewBout | null,
  event: BoutStateEvent,
  completedAction: BoutWorkflowCommandAction
): BoutWorkflowReducerState {
  return freezeState(
    snapshot,
    pendingNewBout,
    [...state.completedEvents, event].slice(-MAX_RETAINED_EVENTS),
    [...state.completedCommandIds, event.sourceCommand.commandId],
    [...state.completedActions, completedAction]
  )
}

function acceptedSnapshot(
  snapshot: BoutWorkflowSnapshot,
  command: RemoteCommand,
  eventRevision: number,
  stm32RecordId: string | null
): BoutWorkflowSnapshot {
  return freeze({
    ...copySnapshot(snapshot),
    eventRevision,
    sourceCommandDisposition: "accepted",
    sourceCommandIdentity: sourceFor(command),
    stm32RecordId
  })
}

function apply(
  state: BoutWorkflowReducerState,
  action: BoutWorkflowCommandAction,
  cause: Exclude<BoutStateEvent["cause"], "command.rejected">,
  next: BoutWorkflowSnapshot
): BoutWorkflowReduction {
  const { command } = action
  if (state.snapshot.eventRevision === Number.MAX_SAFE_INTEGER) return reject(state, command, "out-of-bounds")
  const snapshot = acceptedSnapshot(next, command, state.snapshot.eventRevision + 1, null)
  const event = eventFor(command, snapshot, cause, null)
  return {
    event,
    outcome: "applied",
    reason: null,
    state: complete(state, snapshot, null, event, action)
  }
}

function isBoutClock(snapshot: BoutWorkflowSnapshot): boolean {
  return snapshot.clock.mode === "bout"
}

function adjustedClockDuration(snapshot: BoutWorkflowSnapshot): number {
  return snapshot.clock.remainingDurationCentiseconds < 1_000 ? 1 : 100
}

function scoreCommand(command: RemoteCommand): Readonly<{ direction: -1 | 1; side: "left" | "right" }> | null {
  switch (command.command) {
    case "score.increment.left":
      return { direction: 1, side: "left" }
    case "score.increment.right":
      return { direction: 1, side: "right" }
    case "score.decrement.left":
      return { direction: -1, side: "left" }
    case "score.decrement.right":
      return { direction: -1, side: "right" }
    default:
      return null
  }
}

function awardedSide(command: RemoteCommand): "left" | "right" | null {
  switch (command.command) {
    case "penalty.award.left":
    case "passivityPenalty.award.left":
      return "left"
    case "penalty.award.right":
    case "passivityPenalty.award.right":
      return "right"
    default:
      return null
  }
}

function opposingSide(side: "left" | "right"): "left" | "right" {
  return side === "left" ? "right" : "left"
}

function reject(
  state: BoutWorkflowReducerState,
  command: RemoteCommand,
  reason: RemoteCommandRejectionReason
): BoutWorkflowReduction {
  const event = rejection(command, reason, state.snapshot.eventRevision)
  const action = parsedCommandActions.get(command) ?? { command, nextBout: null, type: "command" }
  return { event, outcome: "rejected", reason, state: remember(state, event, action) }
}

function isNewBoutConfiguration(value: unknown, current: BoutWorkflowSnapshot): value is NewBoutConfiguration {
  return (
    isStrictPlainRecord(value) &&
    hasExactlyKeys(value, [
      "boutId",
      "clockDurationCentiseconds",
      "initialCompetition",
      "timingConfigurationRevision",
      "weapon"
    ]) &&
    isIdentifier(value.boutId) &&
    value.boutId !== current.boutId &&
    isPositiveInteger(value.clockDurationCentiseconds) &&
    isIdentifier(value.timingConfigurationRevision) &&
    (value.weapon === "epee" || value.weapon === "foil" || value.weapon === "sabre") &&
    isStrictPlainRecord(value.initialCompetition) &&
    hasExactlyKeys(value.initialCompetition, ["kind", "value"]) &&
    isKnownCompetition(value.initialCompetition)
  )
}

function isPriorityEntropyReceiptShape(value: unknown): value is PriorityEntropyReceipt {
  return (
    isStrictPlainRecord(value) &&
    hasExactlyKeys(value, ["bit", "ownerId", "ownerRevision", "sampleId"]) &&
    (value.bit === 0 || value.bit === 1) &&
    value.ownerId === PRIORITY_ENTROPY_OWNER.ownerId &&
    value.ownerRevision === PRIORITY_ENTROPY_OWNER.ownerRevision &&
    isIdentifier(value.sampleId)
  )
}

function hasKnownPriorityEntropyProvenance(value: unknown): boolean {
  return value === null || isPriorityEntropyReceiptShape(value)
}

function isKnownFormatAuthority(value: unknown): value is CompetitionFormatAuthority {
  const known = COMPETITION_FORMAT_REGISTRY.authority
  return (
    isStrictPlainRecord(value) &&
    hasExactlyKeys(value, ["ownerId", "registryDigest", "registryId", "registryRevision"]) &&
    value.ownerId === known.ownerId &&
    value.registryDigest === known.registryDigest &&
    value.registryId === known.registryId &&
    value.registryRevision === known.registryRevision
  )
}

function isKnownCompetition(value: unknown): value is Readonly<{ kind: "match" | "period"; value: number }> {
  if (
    !isStrictPlainRecord(value) ||
    !hasExactlyKeys(value, ["kind", "value"]) ||
    (value.kind !== "match" && value.kind !== "period") ||
    !isPositiveInteger(value.value)
  ) {
    return false
  }
  const bounds = COMPETITION_FORMAT_REGISTRY.bounds[value.kind]
  return value.value >= bounds.minimum && value.value <= bounds.maximum
}

function knownFormatAuthority(): CompetitionFormatAuthority {
  return structuredClone(COMPETITION_FORMAT_REGISTRY.authority)
}

function samePlainValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => samePlainValue(value, right[index]))
    )
  }
  if (!isStrictPlainRecord(left) || !isStrictPlainRecord(right)) return false
  const leftKeys = Object.keys(left).sort()
  const rightKeys = Object.keys(right).sort()
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every((key, index) => key === rightKeys[index] && samePlainValue(left[key], right[key]))
  )
}

/** Strictly authenticates the shape and authority asserted by a new-bout STM32 result. */
export function parseStm32BoutResetResult(value: unknown): Stm32BoutResetResult {
  if (
    !isStrictPlainRecord(value) ||
    !hasExactlyKeys(value, ["authority", "requestId", "result", "stm32RecordId", "type"]) ||
    value.authority !== "stm32-scoring" ||
    value.type !== "stm32-bout-reset-result" ||
    (value.result !== "accepted" && value.result !== "rejected") ||
    !isIdentifier(value.requestId)
  ) {
    throw new TypeError("STM32 bout-reset results have an invalid shape, authority, or correlation")
  }
  if (value.result === "accepted") {
    if (!isIdentifier(value.stm32RecordId)) {
      throw new TypeError("STM32 bout-reset results have an invalid shape, authority, or correlation")
    }
    return {
      authority: "stm32-scoring",
      requestId: value.requestId,
      result: "accepted",
      stm32RecordId: value.stm32RecordId,
      type: "stm32-bout-reset-result"
    }
  }
  if (value.stm32RecordId !== null) {
    throw new TypeError("STM32 bout-reset results have an invalid shape, authority, or correlation")
  }
  return {
    authority: "stm32-scoring",
    requestId: value.requestId,
    result: "rejected",
    stm32RecordId: null,
    type: "stm32-bout-reset-result"
  }
}

function parseCommandAction(value: unknown, current: BoutWorkflowSnapshot): BoutWorkflowCommandAction | null {
  if (
    !isStrictPlainRecord(value) ||
    value.type !== "command" ||
    !isRemoteCommand(value.command) ||
    (value.nextBout !== null && !isNewBoutConfiguration(value.nextBout, current))
  ) {
    return null
  }
  if (value.command.command === "overtime.toggle") {
    if (hasExactlyKeys(value, ["command", "nextBout", "type"])) {
      return { command: value.command, nextBout: value.nextBout, type: "command" }
    }
    if (!hasExactlyKeys(value, ["command", "nextBout", "priorityEntropyReceipt", "type"])) return null
    if (!isPriorityEntropyReceiptShape(value.priorityEntropyReceipt)) return null
    if (!verifiedPriorityEntropyReceipts.has(value.priorityEntropyReceipt)) return null
    return {
      command: value.command,
      nextBout: value.nextBout,
      priorityEntropyReceipt: value.priorityEntropyReceipt,
      type: "command"
    }
  }
  if (!hasExactlyKeys(value, ["command", "nextBout", "type"])) return null
  return { command: value.command, nextBout: value.nextBout, type: "command" }
}

function freshFromPending(
  pending: PendingNewBout,
  current: BoutWorkflowSnapshot,
  stm32RecordId: string
): BoutWorkflowSnapshot {
  const next = pending.action.nextBout
  return acceptedSnapshot(
    {
      apparatusId: current.apparatusId,
      authority: current.authority,
      autoRearm: "manual",
      boutId: next.boutId,
      boutRevision: current.boutRevision + 1,
      clock: {
        configuredDurationCentiseconds: next.clockDurationCentiseconds,
        mode: "bout",
        remainingDurationCentiseconds: next.clockDurationCentiseconds,
        status: "stopped"
      },
      competition: structuredClone(next.initialCompetition),
      competitionFormatAuthority: knownFormatAuthority(),
      eventRevision: current.eventRevision + 1,
      lastScoredSide: null,
      medical: null,
      passivity: null,
      priority: null,
      priorityEntropyReceipt: null,
      sides: {
        left: { pCard: "none", redCardCount: 0, score: 0, yellowCard: false },
        right: { pCard: "none", redCardCount: 0, score: 0, yellowCard: false }
      },
      sourceCommandDisposition: "accepted",
      sourceCommandIdentity: sourceFor(pending.action.command),
      stm32RecordId,
      timingConfigurationRevision: next.timingConfigurationRevision,
      weapon: next.weapon
    },
    pending.action.command,
    current.eventRevision + 1,
    stm32RecordId
  )
}

/** Creates the complete, explicit state used for boot or a test fixture. */
export function createFreshBoutWorkflowSnapshot(input: FreshBoutWorkflowInput): BoutWorkflowSnapshot {
  if (
    !isIdentifier(input.apparatusId) ||
    !isIdentifier(input.boutId) ||
    !isPositiveInteger(input.clockDurationCentiseconds) ||
    !isIdentifier(input.timingConfigurationRevision) ||
    !isNonnegativeInteger(input.boutRevision ?? 0) ||
    !isNonnegativeInteger(input.eventRevision ?? 0) ||
    !isIdentifier(input.sourceCommandIdentity.apparatusId) ||
    input.sourceCommandIdentity.apparatusId !== input.apparatusId ||
    !isIdentifier(input.sourceCommandIdentity.commandId) ||
    !isIdentifier(input.sourceCommandIdentity.controllerId) ||
    !isNonnegativeInteger(input.sourceCommandIdentity.counter) ||
    (input.sourceCommandIdentity.remoteId !== null && !isIdentifier(input.sourceCommandIdentity.remoteId)) ||
    (input.weapon !== "epee" && input.weapon !== "foil" && input.weapon !== "sabre") ||
    !isKnownCompetition(input.initialCompetition)
  ) {
    throw new TypeError("Fresh bout workflow input is incomplete or invalid")
  }

  const snapshot = {
    apparatusId: input.apparatusId,
    authority: structuredClone(input.authority),
    autoRearm: "manual",
    boutId: input.boutId,
    boutRevision: input.boutRevision ?? 0,
    clock: {
      configuredDurationCentiseconds: input.clockDurationCentiseconds,
      mode: "bout",
      remainingDurationCentiseconds: input.clockDurationCentiseconds,
      status: "stopped"
    },
    competition: structuredClone(input.initialCompetition),
    competitionFormatAuthority: knownFormatAuthority(),
    eventRevision: input.eventRevision ?? 0,
    lastScoredSide: null,
    medical: null,
    passivity: null,
    priority: null,
    priorityEntropyReceipt: null,
    sides: {
      left: { pCard: "none", redCardCount: 0, score: 0, yellowCard: false },
      right: { pCard: "none", redCardCount: 0, score: 0, yellowCard: false }
    },
    sourceCommandDisposition: "accepted",
    sourceCommandIdentity: structuredClone(input.sourceCommandIdentity),
    stm32RecordId: null,
    timingConfigurationRevision: input.timingConfigurationRevision,
    weapon: input.weapon
  }
  return freeze(parseBoutWorkflowSnapshot(snapshot))
}

/** Creates a reducer state only from a full, strictly parseable snapshot. */
export function createBoutWorkflowReducerState(snapshot: unknown): BoutWorkflowReducerState {
  const parsed = parseBoutWorkflowSnapshot(snapshot)
  if (!isKnownFormatAuthority(parsed.competitionFormatAuthority)) {
    throw new TypeError("Bout snapshot does not reference the frozen competition-format registry")
  }
  if (!isKnownCompetition(parsed.competition)) {
    throw new TypeError("Bout snapshot competition is outside the frozen competition-format registry")
  }
  if (!hasKnownPriorityEntropyProvenance(parsed.priorityEntropyReceipt)) {
    throw new TypeError("Bout snapshot does not reference the approved priority-entropy owner")
  }
  return freezeState(parsed, null, [], [], [])
}

/**
 * Reduces one already authenticated command or one STM32 new-bout response.
 * Commands outside the implemented RC-05/RC-06 slices intentionally receive
 * a rejection event until their dedicated workflow slice is implemented.
 */
export function reduceBoutWorkflow(state: BoutWorkflowReducerState, action: BoutWorkflowAction): BoutWorkflowReduction {
  const safeCommandAction = parseCommandAction(action, state.snapshot)
  let safeAction: BoutWorkflowAction
  if (safeCommandAction !== null) {
    safeAction = safeCommandAction
    parsedCommandActions.set(safeAction.command, safeAction)
  } else {
    try {
      safeAction = parseStm32BoutResetResult(action)
    } catch {
      return { event: null, outcome: "ignored", reason: "malformed-action", state }
    }
  }

  if (safeAction.type === "command" && state.completedCommandIds.includes(safeAction.command.commandId)) {
    const commandIndex = state.completedCommandIds.indexOf(safeAction.command.commandId)
    const completedAction = state.completedActions[commandIndex]
    if (completedAction === undefined || !samePlainValue(completedAction, safeAction)) {
      const event = rejection(safeAction.command, "replayed", state.snapshot.eventRevision)
      return { event, outcome: "rejected", reason: "replayed", state }
    }
    const duplicate = state.completedEvents.find(
      (event) => event.sourceCommand.commandId === safeAction.command.commandId
    )
    return { event: duplicate ?? null, outcome: "duplicate", reason: null, state }
  }

  if (
    safeAction.type === "command" &&
    state.pendingNewBout?.action.command.commandId === safeAction.command.commandId
  ) {
    if (!samePlainValue(state.pendingNewBout.action, safeAction)) {
      const event = rejection(safeAction.command, "replayed", state.snapshot.eventRevision)
      return { event, outcome: "rejected", reason: "replayed", state }
    }
    return { event: null, outcome: "pending", reason: null, state }
  }

  if (
    safeAction.type === "command" &&
    state.completedCommandIds.length >=
      (state.pendingNewBout === null ? BOUT_WORKFLOW_COMMAND_ID_CAPACITY : BOUT_WORKFLOW_COMMAND_ID_CAPACITY - 1)
  ) {
    const event = rejection(safeAction.command, "event-capacity-exhausted", state.snapshot.eventRevision)
    return { event, outcome: "rejected", reason: "event-capacity-exhausted", state }
  }

  if (safeAction.type === "stm32-bout-reset-result") {
    const pending = state.pendingNewBout
    if (pending === null || pending.action.command.commandId !== safeAction.requestId) {
      return { event: null, outcome: "ignored", reason: "unknown-stm32-request", state }
    }
    if (safeAction.result === "rejected") {
      const event = rejection(pending.action.command, "stm32-rejection", state.snapshot.eventRevision)
      const next = complete(state, state.snapshot, null, event, {
        command: pending.action.command,
        nextBout: pending.action.nextBout,
        type: "command"
      })
      return { event, outcome: "rejected", reason: "stm32-rejection", state: next }
    }
    if (
      state.snapshot.eventRevision === Number.MAX_SAFE_INTEGER ||
      state.snapshot.boutRevision === Number.MAX_SAFE_INTEGER
    ) {
      const event = rejection(pending.action.command, "stm32-rejection", state.snapshot.eventRevision)
      const next = complete(state, state.snapshot, null, event, {
        command: pending.action.command,
        nextBout: pending.action.nextBout,
        type: "command"
      })
      return { event, outcome: "rejected", reason: "stm32-rejection", state: next }
    }
    const snapshot = freshFromPending(pending, state.snapshot, safeAction.stm32RecordId)
    const event = eventFor(pending.action.command, snapshot, "bout.reset.result", safeAction.stm32RecordId)
    const next = complete(state, snapshot, null, event, {
      command: pending.action.command,
      nextBout: pending.action.nextBout,
      type: "command"
    })
    return { event, outcome: "applied", reason: null, state: next }
  }

  const { command } = safeAction
  if (command.apparatusId !== state.snapshot.apparatusId) return reject(state, command, "wrong-apparatus")
  if (!sameAuthority(command.authority, state.snapshot.authority))
    return reject(state, command, "wrong-controller-authority")
  if (state.pendingNewBout !== null) return reject(state, command, "invalid-mode")

  if (
    state.snapshot.medical?.status === "running" &&
    (command.command === "clock.toggle" ||
      command.command === "clock.adjust.positive" ||
      command.command === "clock.adjust.negative" ||
      command.command === "clock.loadConfigured" ||
      command.command === "clock.loadOneMinute" ||
      command.command === "clock.configure" ||
      command.command === "break.start.oneMinute" ||
      command.command === "overtime.toggle")
  ) {
    return reject(state, command, "invalid-mode")
  }

  if (state.snapshot.clock.mode === "overtime" && command.command === "clock.toggle") {
    return reject(state, command, "invalid-mode")
  }

  if (command.command === "bout.snapshot.load") {
    if (state.snapshot.clock.status === "running") return reject(state, command, "clock-running")
    const loaded = parseBoutWorkflowSnapshot(command.payload.snapshot)
    if (!isKnownFormatAuthority(loaded.competitionFormatAuthority)) return reject(state, command, "owner-unavailable")
    if (!isKnownCompetition(loaded.competition)) return reject(state, command, "out-of-bounds")
    // Snapshot bytes retain correlation for audit, not the in-memory capability
    // needed to start overtime. No verified issuer is integrated yet, so an
    // external load with any live entropy receipt fails closed.
    if (loaded.priorityEntropyReceipt !== null || !hasKnownPriorityEntropyProvenance(loaded.priorityEntropyReceipt))
      return reject(state, command, "owner-unavailable")
    if (
      loaded.apparatusId !== state.snapshot.apparatusId ||
      loaded.eventRevision <= state.snapshot.eventRevision ||
      loaded.boutRevision < state.snapshot.boutRevision ||
      loaded.authority.authorityRevision < state.snapshot.authority.authorityRevision ||
      (loaded.authority.authorityRevision === state.snapshot.authority.authorityRevision &&
        !sameAuthority(loaded.authority, state.snapshot.authority))
    ) {
      return reject(state, command, "incompatible-snapshot-revision")
    }
    if (loaded.sourceCommandDisposition !== "accepted") return reject(state, command, "incomplete-snapshot")
    const snapshot = acceptedSnapshot(loaded, command, loaded.eventRevision, loaded.stm32RecordId)
    const event = eventFor(command, snapshot, "bout.snapshot.load", loaded.stm32RecordId)
    const next = complete(state, snapshot, null, event, safeAction)
    return { event, outcome: "applied", reason: null, state: next }
  }

  if (command.command === "bout.new") {
    if (state.snapshot.clock.status === "running") return reject(state, command, "clock-running")
    const nextBout = safeAction.nextBout
    if (nextBout === null || !isNewBoutConfiguration(nextBout, state.snapshot))
      return reject(state, command, "invalid-mode")
    const pending: PendingNewBout = freeze({ action: { command: structuredClone(command), nextBout, type: "command" } })
    return {
      event: null,
      outcome: "pending",
      reason: null,
      state: freezeState(
        state.snapshot,
        pending,
        state.completedEvents,
        state.completedCommandIds,
        state.completedActions
      )
    }
  }

  const score = scoreCommand(command)
  if (score !== null) {
    if (state.snapshot.clock.mode === "break") return reject(state, command, "invalid-mode")
    const side = state.snapshot.sides[score.side]
    if (score.direction < 0 && side.score === 0) return reject(state, command, "out-of-bounds")
    if (score.direction > 0 && side.score === Number.MAX_SAFE_INTEGER) return reject(state, command, "out-of-bounds")
    return apply(state, safeAction, score.direction > 0 ? "score.increment" : "score.decrement", {
      ...copySnapshot(state.snapshot),
      lastScoredSide: score.direction > 0 ? score.side : state.snapshot.lastScoredSide,
      sides: {
        ...structuredClone(state.snapshot.sides),
        [score.side]: { ...structuredClone(side), score: side.score + score.direction }
      }
    })
  }

  if (command.command === "clock.toggle") {
    const status = state.snapshot.clock.status === "running" ? "stopped" : "running"
    if (status === "running" && state.snapshot.clock.remainingDurationCentiseconds === 0)
      return reject(state, command, "out-of-bounds")
    return apply(state, safeAction, status === "running" ? "clock.start" : "clock.stop", {
      ...copySnapshot(state.snapshot),
      clock: { ...structuredClone(state.snapshot.clock), status },
      passivity:
        state.snapshot.clock.mode === "bout" && state.snapshot.passivity !== null
          ? { ...structuredClone(state.snapshot.passivity), status }
          : state.snapshot.passivity === null
            ? null
            : structuredClone(state.snapshot.passivity)
    })
  }

  if (command.command === "clock.adjust.positive" || command.command === "clock.adjust.negative") {
    if (state.snapshot.clock.status === "running") return reject(state, command, "clock-running")
    if (!isBoutClock(state.snapshot)) return reject(state, command, "invalid-mode")
    const amount = adjustedClockDuration(state.snapshot)
    const remaining =
      command.command === "clock.adjust.positive"
        ? state.snapshot.clock.remainingDurationCentiseconds + amount
        : state.snapshot.clock.remainingDurationCentiseconds - amount
    if (remaining < 0 || remaining > state.snapshot.clock.configuredDurationCentiseconds)
      return reject(state, command, "out-of-bounds")
    return apply(state, safeAction, "clock.adjust", {
      ...copySnapshot(state.snapshot),
      clock: { ...structuredClone(state.snapshot.clock), remainingDurationCentiseconds: remaining }
    })
  }

  if (command.command === "clock.loadConfigured") {
    if (state.snapshot.clock.status === "running") return reject(state, command, "clock-running")
    if (state.snapshot.clock.configuredDurationCentiseconds === 0) return reject(state, command, "invalid-mode")
    return apply(state, safeAction, "clock.set", {
      ...copySnapshot(state.snapshot),
      clock: {
        ...structuredClone(state.snapshot.clock),
        mode: "bout",
        remainingDurationCentiseconds: state.snapshot.clock.configuredDurationCentiseconds,
        status: "stopped"
      }
    })
  }

  if (command.command === "clock.loadOneMinute") {
    if (state.snapshot.clock.status === "running") return reject(state, command, "clock-running")
    return apply(state, safeAction, "clock.set", {
      ...copySnapshot(state.snapshot),
      clock: {
        ...structuredClone(state.snapshot.clock),
        mode: "bout",
        remainingDurationCentiseconds: 6_000,
        configuredDurationCentiseconds: 6_000,
        status: "stopped"
      }
    })
  }

  if (command.command === "clock.configure") {
    if (state.snapshot.clock.status === "running") return reject(state, command, "clock-running")
    const duration = (command.payload.minutes * 60 + command.payload.seconds) * 100
    if (duration === 0) return reject(state, command, "out-of-bounds")
    return apply(state, safeAction, "clock.set", {
      ...copySnapshot(state.snapshot),
      clock: {
        ...structuredClone(state.snapshot.clock),
        configuredDurationCentiseconds: duration,
        mode: "bout",
        remainingDurationCentiseconds: duration,
        status: "stopped"
      }
    })
  }

  if (command.command === "overtime.toggle") {
    if (state.snapshot.clock.mode === "overtime") {
      return apply(state, safeAction, "priority.clear", {
        ...copySnapshot(state.snapshot),
        clock: {
          ...structuredClone(state.snapshot.clock),
          mode: "bout",
          remainingDurationCentiseconds: state.snapshot.clock.configuredDurationCentiseconds,
          status: "stopped"
        },
        priority: null,
        priorityEntropyReceipt: null
      })
    }
    if (!isBoutClock(state.snapshot) || state.snapshot.medical !== null) return reject(state, command, "invalid-mode")
    if (state.snapshot.clock.status === "running") return reject(state, command, "clock-running")
    const entropyReceipt = safeAction.priorityEntropyReceipt
    if (entropyReceipt === undefined) return reject(state, command, "owner-unavailable")
    return apply(state, safeAction, "overtime.start", {
      ...copySnapshot(state.snapshot),
      clock: {
        ...structuredClone(state.snapshot.clock),
        mode: "overtime",
        remainingDurationCentiseconds: 6_000,
        status: "running"
      },
      priority: entropyReceipt.bit === 0 ? "left" : "right",
      priorityEntropyReceipt: structuredClone(entropyReceipt)
    })
  }

  if (command.command === "medical.start") {
    if (!isBoutClock(state.snapshot) || state.snapshot.medical !== null) return reject(state, command, "invalid-mode")
    if (state.snapshot.clock.status === "running") return reject(state, command, "clock-running")
    return apply(state, safeAction, "medical.start", {
      ...copySnapshot(state.snapshot),
      medical: { configuredDurationCentiseconds: 30_000, remainingDurationCentiseconds: 30_000, status: "running" }
    })
  }

  if (command.command === "priority.assign.supervisor") {
    return reject(state, command, "owner-unavailable")
  }

  if (command.command === "format.advance" || command.command === "format.retreat") {
    if (!isKnownFormatAuthority(state.snapshot.competitionFormatAuthority))
      return reject(state, command, "owner-unavailable")
    if (!isBoutClock(state.snapshot) || state.snapshot.medical !== null) return reject(state, command, "invalid-mode")
    if (state.snapshot.clock.status === "running") return reject(state, command, "clock-running")
    const format = COMPETITION_FORMAT_REGISTRY.bounds[state.snapshot.competition.kind]
    const current = state.snapshot.competition.value
    if (current < format.minimum || current > format.maximum) return reject(state, command, "out-of-bounds")
    if (command.command === "format.advance" && current === format.maximum)
      return reject(state, command, "out-of-bounds")
    if (command.command === "format.retreat" && current === format.minimum)
      return reject(state, command, "out-of-bounds")
    return apply(state, safeAction, "format.change", {
      ...copySnapshot(state.snapshot),
      competition: {
        ...structuredClone(state.snapshot.competition),
        value: current + (command.command === "format.advance" ? 1 : -1)
      }
    })
  }

  if (command.command === "break.start.oneMinute") {
    if (!isBoutClock(state.snapshot)) return reject(state, command, "invalid-mode")
    if (state.snapshot.clock.status === "running") return reject(state, command, "clock-running")
    return apply(state, safeAction, "break.start", {
      ...copySnapshot(state.snapshot),
      clock: {
        configuredDurationCentiseconds: state.snapshot.clock.configuredDurationCentiseconds,
        mode: "break",
        remainingDurationCentiseconds: 6_000,
        status: "running"
      }
    })
  }

  const awarded = awardedSide(command)
  if (awarded !== null) {
    if (command.command.startsWith("passivityPenalty.award.")) {
      // RC-07 cannot select an outcome until its rules owner approves a source-backed P-card table.
      return reject(state, command, "owner-unavailable")
    }
    if (state.snapshot.clock.mode === "break") return reject(state, command, "invalid-mode")

    const awardedState = state.snapshot.sides[awarded]
    if (command.command.startsWith("penalty.award.")) {
      if (!awardedState.yellowCard) {
        return apply(state, safeAction, "penalty.award", {
          ...copySnapshot(state.snapshot),
          sides: {
            ...structuredClone(state.snapshot.sides),
            [awarded]: { ...structuredClone(awardedState), yellowCard: true }
          }
        })
      }

      const opponent = opposingSide(awarded)
      const opponentState = state.snapshot.sides[opponent]
      if (awardedState.redCardCount === Number.MAX_SAFE_INTEGER || opponentState.score === Number.MAX_SAFE_INTEGER) {
        return reject(state, command, "out-of-bounds")
      }
      return apply(state, safeAction, "penalty.award", {
        ...copySnapshot(state.snapshot),
        lastScoredSide: opponent,
        sides: {
          ...structuredClone(state.snapshot.sides),
          [awarded]: { ...structuredClone(awardedState), redCardCount: awardedState.redCardCount + 1 },
          [opponent]: { ...structuredClone(opponentState), score: opponentState.score + 1 }
        }
      })
    }
  }

  if (command.command === "cards.reset") {
    return apply(state, safeAction, "cards.reset", {
      ...copySnapshot(state.snapshot),
      sides: {
        left: { ...structuredClone(state.snapshot.sides.left), pCard: "none", redCardCount: 0, yellowCard: false },
        right: { ...structuredClone(state.snapshot.sides.right), pCard: "none", redCardCount: 0, yellowCard: false }
      }
    })
  }

  return reject(state, command, "unsupported-command")
}
