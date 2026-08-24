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
  type CompetitionFormatAuthority,
  type ControllerAuthority,
  type RemoteCommand,
  type RemoteCommandRejectionReason,
  type SourceCommandIdentity,
  type TimedWorkflowState
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
  command: RemoteCommand
  nextBout: NewBoutConfiguration
}>

type Stm32WorkflowOperation = "safe-idle-sleep" | "scoring-rearm" | "weapon-request"

export type PendingStm32WorkflowAction = Readonly<{
  command: RemoteCommand
  nextAutoRearm: BoutWorkflowSnapshot["autoRearm"]
  nextWeapon: Weapon
  operation: Stm32WorkflowOperation
}>

/** SHA-256 of docs/competition-format-rules-registry.json, including its trailing LF. */
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

export type BoutWorkflowReducerState = Readonly<{
  completedCommandIds: readonly string[]
  completedEvents: readonly BoutStateEvent[]
  pendingNewBout: PendingNewBout | null
  pendingStm32WorkflowAction: PendingStm32WorkflowAction | null
  snapshot: BoutWorkflowSnapshot
}>

export type BoutWorkflowCommandAction = Readonly<{
  command: RemoteCommand
  nextBout: NewBoutConfiguration | null
  type: "command"
}>

export type BoutWorkflowAction = BoutWorkflowCommandAction | Stm32BoutResetResult | Stm32WorkflowResult

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

export type Stm32WorkflowResult =
  | Readonly<{
      authority: "stm32-scoring"
      operation: Stm32WorkflowOperation
      requestId: string
      result: "accepted"
      stm32RecordId: string
      type: "stm32-workflow-result"
    }>
  | Readonly<{
      authority: "stm32-scoring"
      operation: Stm32WorkflowOperation
      requestId: string
      result: "rejected"
      stm32RecordId: null
      type: "stm32-workflow-result"
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
  pendingStm32WorkflowAction: PendingStm32WorkflowAction | null,
  completedEvents: readonly BoutStateEvent[],
  completedCommandIds: readonly string[]
): BoutWorkflowReducerState {
  return freeze({
    completedCommandIds: [...completedCommandIds],
    completedEvents: completedEvents.map((event) => freeze(structuredClone(event))),
    pendingNewBout: pendingNewBout === null ? null : freeze(structuredClone(pendingNewBout)),
    pendingStm32WorkflowAction:
      pendingStm32WorkflowAction === null ? null : freeze(structuredClone(pendingStm32WorkflowAction)),
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

function remember(state: BoutWorkflowReducerState, event: BoutStateEvent): BoutWorkflowReducerState {
  const completed = [...state.completedEvents, event]
  return freezeState(
    state.snapshot,
    state.pendingNewBout,
    state.pendingStm32WorkflowAction,
    completed.slice(-MAX_RETAINED_EVENTS),
    [...state.completedCommandIds, event.sourceCommand.commandId]
  )
}

function complete(
  state: BoutWorkflowReducerState,
  snapshot: BoutWorkflowSnapshot,
  event: BoutStateEvent
): BoutWorkflowReducerState {
  return freezeState(snapshot, null, null, [...state.completedEvents, event].slice(-MAX_RETAINED_EVENTS), [
    ...state.completedCommandIds,
    event.sourceCommand.commandId
  ])
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
  command: RemoteCommand,
  cause: Exclude<BoutStateEvent["cause"], "command.rejected">,
  next: BoutWorkflowSnapshot
): BoutWorkflowReduction {
  if (state.snapshot.eventRevision === Number.MAX_SAFE_INTEGER) return reject(state, command, "out-of-bounds")
  const snapshot = acceptedSnapshot(next, command, state.snapshot.eventRevision + 1, null)
  const event = eventFor(command, snapshot, cause, null)
  return {
    event,
    outcome: "applied",
    reason: null,
    state: complete(state, snapshot, event)
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
  return { event, outcome: "rejected", reason, state: remember(state, event) }
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
    isKnownCompetition(value.initialCompetition)
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

/** Strictly authenticates a correlated STM32 rearm, weapon, or safe-idle response. */
export function parseStm32WorkflowResult(value: unknown): Stm32WorkflowResult {
  if (
    !isStrictPlainRecord(value) ||
    !hasExactlyKeys(value, ["authority", "operation", "requestId", "result", "stm32RecordId", "type"]) ||
    value.authority !== "stm32-scoring" ||
    value.type !== "stm32-workflow-result" ||
    (value.operation !== "scoring-rearm" &&
      value.operation !== "weapon-request" &&
      value.operation !== "safe-idle-sleep") ||
    (value.result !== "accepted" && value.result !== "rejected") ||
    !isIdentifier(value.requestId)
  ) {
    throw new TypeError("STM32 workflow results have an invalid shape, authority, or correlation")
  }
  if (value.result === "accepted") {
    if (!isIdentifier(value.stm32RecordId))
      throw new TypeError("STM32 workflow results have an invalid shape, authority, or correlation")
    return {
      authority: "stm32-scoring",
      operation: value.operation,
      requestId: value.requestId,
      result: "accepted",
      stm32RecordId: value.stm32RecordId,
      type: "stm32-workflow-result"
    }
  }
  if (value.stm32RecordId !== null)
    throw new TypeError("STM32 workflow results have an invalid shape, authority, or correlation")
  return {
    authority: "stm32-scoring",
    operation: value.operation,
    requestId: value.requestId,
    result: "rejected",
    stm32RecordId: null,
    type: "stm32-workflow-result"
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
  if (!hasExactlyKeys(value, ["command", "nextBout", "type"])) return null
  return { command: value.command, nextBout: value.nextBout, type: "command" }
}

function nextAutoRearm(setting: BoutWorkflowSnapshot["autoRearm"]): BoutWorkflowSnapshot["autoRearm"] {
  switch (setting) {
    case "manual":
      return "one-second"
    case "one-second":
      return "three-seconds"
    case "three-seconds":
      return "five-seconds"
    case "five-seconds":
      return "manual"
  }
}

function nextWeapon(weapon: Weapon): Weapon {
  return weapon === "epee" ? "foil" : weapon === "foil" ? "sabre" : "epee"
}

function safeIdle(snapshot: BoutWorkflowSnapshot): boolean {
  return (
    snapshot.clock.mode === "bout" &&
    snapshot.clock.status === "stopped" &&
    (snapshot.medical === null || snapshot.medical.status === "stopped") &&
    (snapshot.passivity === null || snapshot.passivity.status === "stopped")
  )
}

function requestStm32WorkflowAction(
  state: BoutWorkflowReducerState,
  command: RemoteCommand,
  operation: Stm32WorkflowOperation
): BoutWorkflowReduction {
  const pending: PendingStm32WorkflowAction = freeze({
    command: structuredClone(command),
    nextAutoRearm:
      command.command === "scoring.autoRearm.advance"
        ? nextAutoRearm(state.snapshot.autoRearm)
        : state.snapshot.autoRearm,
    nextWeapon: command.command === "weapon.showOrAdvance" ? nextWeapon(state.snapshot.weapon) : state.snapshot.weapon,
    operation
  })
  return {
    event: null,
    outcome: "pending",
    reason: null,
    state: freezeState(state.snapshot, null, pending, state.completedEvents, state.completedCommandIds)
  }
}

function freshFromPending(
  pending: PendingNewBout,
  current: BoutWorkflowSnapshot,
  stm32RecordId: string
): BoutWorkflowSnapshot {
  const next = pending.nextBout
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
      sourceCommandIdentity: sourceFor(pending.command),
      stm32RecordId,
      timingConfigurationRevision: next.timingConfigurationRevision,
      weapon: next.weapon
    },
    pending.command,
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
  if (!isKnownFormatAuthority(parsed.competitionFormatAuthority))
    throw new TypeError("Bout snapshot does not reference the frozen competition-format registry")
  if (!isKnownCompetition(parsed.competition))
    throw new TypeError("Bout snapshot competition is outside the frozen competition-format registry")
  if (parsed.priorityEntropyReceipt !== null)
    throw new TypeError("Live priority entropy requires the unavailable trusted issuer")
  return freezeState(parsed, null, null, [], [])
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
  } else {
    try {
      safeAction = parseStm32BoutResetResult(action)
    } catch {
      try {
        safeAction = parseStm32WorkflowResult(action)
      } catch {
        return { event: null, outcome: "ignored", reason: "malformed-action", state }
      }
    }
  }

  if (safeAction.type === "command" && state.completedCommandIds.includes(safeAction.command.commandId)) {
    const duplicate = state.completedEvents.find(
      (event) => event.sourceCommand.commandId === safeAction.command.commandId
    )
    return { event: duplicate ?? null, outcome: "duplicate", reason: null, state }
  }

  if (
    safeAction.type === "command" &&
    (state.pendingNewBout?.command.commandId === safeAction.command.commandId ||
      state.pendingStm32WorkflowAction?.command.commandId === safeAction.command.commandId)
  ) {
    return { event: null, outcome: "pending", reason: null, state }
  }

  if (
    safeAction.type === "command" &&
    state.completedCommandIds.length >=
      (state.pendingNewBout === null && state.pendingStm32WorkflowAction === null
        ? BOUT_WORKFLOW_COMMAND_ID_CAPACITY
        : BOUT_WORKFLOW_COMMAND_ID_CAPACITY - 1)
  ) {
    const event = rejection(safeAction.command, "event-capacity-exhausted", state.snapshot.eventRevision)
    return { event, outcome: "rejected", reason: "event-capacity-exhausted", state }
  }

  if (safeAction.type === "stm32-bout-reset-result") {
    const pending = state.pendingNewBout
    if (pending === null || pending.command.commandId !== safeAction.requestId) {
      return { event: null, outcome: "ignored", reason: "unknown-stm32-request", state }
    }
    if (safeAction.result === "rejected") {
      const event = rejection(pending.command, "stm32-rejection", state.snapshot.eventRevision)
      const next = complete(state, state.snapshot, event)
      return { event, outcome: "rejected", reason: "stm32-rejection", state: next }
    }
    if (
      state.snapshot.eventRevision === Number.MAX_SAFE_INTEGER ||
      state.snapshot.boutRevision === Number.MAX_SAFE_INTEGER
    ) {
      const event = rejection(pending.command, "stm32-rejection", state.snapshot.eventRevision)
      const next = complete(state, state.snapshot, event)
      return { event, outcome: "rejected", reason: "stm32-rejection", state: next }
    }
    const snapshot = freshFromPending(pending, state.snapshot, safeAction.stm32RecordId)
    const event = eventFor(pending.command, snapshot, "bout.reset.result", safeAction.stm32RecordId)
    const next = complete(state, snapshot, event)
    return { event, outcome: "applied", reason: null, state: next }
  }

  if (safeAction.type === "stm32-workflow-result") {
    const pending = state.pendingStm32WorkflowAction
    if (
      pending === null ||
      pending.command.commandId !== safeAction.requestId ||
      pending.operation !== safeAction.operation
    ) {
      return { event: null, outcome: "ignored", reason: "unknown-stm32-request", state }
    }
    if (safeAction.result === "rejected") {
      const event = rejection(pending.command, "stm32-rejection", state.snapshot.eventRevision)
      return { event, outcome: "rejected", reason: "stm32-rejection", state: complete(state, state.snapshot, event) }
    }
    if (state.snapshot.eventRevision === Number.MAX_SAFE_INTEGER) {
      const event = rejection(pending.command, "stm32-rejection", state.snapshot.eventRevision)
      return { event, outcome: "rejected", reason: "stm32-rejection", state: complete(state, state.snapshot, event) }
    }
    const next: BoutWorkflowSnapshot = {
      ...copySnapshot(state.snapshot),
      autoRearm: pending.operation === "scoring-rearm" ? pending.nextAutoRearm : state.snapshot.autoRearm,
      weapon: pending.operation === "weapon-request" ? pending.nextWeapon : state.snapshot.weapon
    }
    const cause =
      pending.operation === "scoring-rearm"
        ? "scoring.rearm.result"
        : pending.operation === "weapon-request"
          ? "weapon.request.result"
          : "device.sleep.result"
    const snapshot = acceptedSnapshot(next, pending.command, state.snapshot.eventRevision + 1, safeAction.stm32RecordId)
    const event = eventFor(pending.command, snapshot, cause, safeAction.stm32RecordId)
    return { event, outcome: "applied", reason: null, state: complete(state, snapshot, event) }
  }

  const { command } = safeAction
  if (command.apparatusId !== state.snapshot.apparatusId) return reject(state, command, "wrong-apparatus")
  if (!sameAuthority(command.authority, state.snapshot.authority))
    return reject(state, command, "wrong-controller-authority")
  if (state.pendingNewBout !== null || state.pendingStm32WorkflowAction !== null)
    return reject(state, command, "invalid-mode")

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

  if (state.snapshot.clock.mode === "overtime" && command.command === "clock.toggle")
    return reject(state, command, "invalid-mode")

  if (command.command === "bout.snapshot.load") {
    if (state.snapshot.clock.status === "running") return reject(state, command, "clock-running")
    const loaded = parseBoutWorkflowSnapshot(command.payload.snapshot)
    if (!isKnownFormatAuthority(loaded.competitionFormatAuthority)) return reject(state, command, "owner-unavailable")
    if (!isKnownCompetition(loaded.competition)) return reject(state, command, "out-of-bounds")
    if (loaded.priorityEntropyReceipt !== null) return reject(state, command, "owner-unavailable")
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
    const next = complete(state, snapshot, event)
    return { event, outcome: "applied", reason: null, state: next }
  }

  if (command.command === "bout.new") {
    if (state.snapshot.clock.status === "running") return reject(state, command, "clock-running")
    if (safeAction.nextBout === null || !isNewBoutConfiguration(safeAction.nextBout, state.snapshot))
      return reject(state, command, "invalid-mode")
    const pending: PendingNewBout = freeze({
      command: structuredClone(command),
      nextBout: structuredClone(safeAction.nextBout)
    })
    return {
      event: null,
      outcome: "pending",
      reason: null,
      state: freezeState(state.snapshot, pending, null, state.completedEvents, state.completedCommandIds)
    }
  }

  if (command.command === "scoring.rearm" || command.command === "scoring.autoRearm.advance") {
    if (!isBoutClock(state.snapshot) || state.snapshot.clock.status === "running" || state.snapshot.medical !== null)
      return reject(state, command, "invalid-mode")
    return requestStm32WorkflowAction(state, command, "scoring-rearm")
  }

  if (command.command === "weapon.showOrAdvance") {
    if (!isBoutClock(state.snapshot) || state.snapshot.clock.status === "running" || state.snapshot.medical !== null)
      return reject(state, command, "invalid-mode")
    return requestStm32WorkflowAction(state, command, "weapon-request")
  }

  if (command.command === "device.sleep.request") {
    if (!safeIdle(state.snapshot)) return reject(state, command, "invalid-mode")
    return requestStm32WorkflowAction(state, command, "safe-idle-sleep")
  }

  if (command.command === "sides.swap") {
    if (!isBoutClock(state.snapshot) || state.snapshot.clock.status === "running" || state.snapshot.medical !== null)
      return reject(state, command, "invalid-mode")
    const opposite = (side: "left" | "right" | null): "left" | "right" | null =>
      side === null ? null : opposingSide(side)
    return apply(state, command, "sides.swap", {
      ...copySnapshot(state.snapshot),
      lastScoredSide: opposite(state.snapshot.lastScoredSide),
      priority: opposite(state.snapshot.priority),
      sides: {
        left: structuredClone(state.snapshot.sides.right),
        right: structuredClone(state.snapshot.sides.left)
      }
    })
  }

  const score = scoreCommand(command)
  if (score !== null) {
    if (state.snapshot.clock.mode === "break") return reject(state, command, "invalid-mode")
    const side = state.snapshot.sides[score.side]
    if (score.direction < 0 && side.score === 0) return reject(state, command, "out-of-bounds")
    if (score.direction > 0 && side.score === Number.MAX_SAFE_INTEGER) return reject(state, command, "out-of-bounds")
    return apply(state, command, score.direction > 0 ? "score.increment" : "score.decrement", {
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
    return apply(state, command, status === "running" ? "clock.start" : "clock.stop", {
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
    return apply(state, command, "clock.adjust", {
      ...copySnapshot(state.snapshot),
      clock: { ...structuredClone(state.snapshot.clock), remainingDurationCentiseconds: remaining }
    })
  }

  if (command.command === "clock.loadConfigured") {
    if (state.snapshot.clock.status === "running") return reject(state, command, "clock-running")
    if (state.snapshot.clock.configuredDurationCentiseconds === 0) return reject(state, command, "invalid-mode")
    return apply(state, command, "clock.set", {
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
    return apply(state, command, "clock.set", {
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
    return apply(state, command, "clock.set", {
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
    if (!isBoutClock(state.snapshot) || state.snapshot.medical !== null) return reject(state, command, "invalid-mode")
    if (state.snapshot.clock.status === "running") return reject(state, command, "clock-running")
    return reject(state, command, "owner-unavailable")
  }

  if (command.command === "medical.start") {
    if (!isBoutClock(state.snapshot) || state.snapshot.medical !== null) return reject(state, command, "invalid-mode")
    if (state.snapshot.clock.status === "running") return reject(state, command, "clock-running")
    return apply(state, command, "medical.start", {
      ...copySnapshot(state.snapshot),
      medical: { configuredDurationCentiseconds: 30_000, remainingDurationCentiseconds: 30_000, status: "running" }
    })
  }

  if (command.command === "priority.assign.supervisor") return reject(state, command, "owner-unavailable")

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
    return apply(state, command, "format.change", {
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
    return apply(state, command, "break.start", {
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
        return apply(state, command, "penalty.award", {
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
      return apply(state, command, "penalty.award", {
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
    return apply(state, command, "cards.reset", {
      ...copySnapshot(state.snapshot),
      sides: {
        left: { ...structuredClone(state.snapshot.sides.left), pCard: "none", redCardCount: 0, yellowCard: false },
        right: { ...structuredClone(state.snapshot.sides.right), pCard: "none", redCardCount: 0, yellowCard: false }
      }
    })
  }

  return reject(state, command, "unsupported-command")
}

export type { TimedWorkflowState }
