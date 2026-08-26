/** RC-02 logical remote-command and bout-event contracts; not a crypto or reducer implementation. */
import type { Weapon } from "./bout-state.js"

export const REMOTE_CONTROL_SCHEMA_VERSION = 1
export const REMOTE_COMMAND_KEYS = [
  "score.increment.left",
  "score.increment.right",
  "score.decrement.left",
  "score.decrement.right",
  "clock.toggle",
  "clock.adjust.positive",
  "clock.adjust.negative",
  "clock.loadConfigured",
  "clock.configure",
  "clock.loadOneMinute",
  "format.advance",
  "format.retreat",
  "penalty.award.left",
  "penalty.award.right",
  "passivityPenalty.award.left",
  "passivityPenalty.award.right",
  "break.start.oneMinute",
  "medical.start",
  "overtime.toggle",
  "workflow.undo",
  "sides.swap",
  "weapon.showOrAdvance",
  "modifier.opt",
  "scoring.rearm",
  "scoring.autoRearm.advance",
  "cards.reset",
  "bout.new",
  "device.sleep.request",
  "bout.snapshot.load",
  "controller.authority.transfer",
  "priority.assign.supervisor",
  "score.clear.supervisor"
] as const
export const REMOTE_PRESS_KINDS = ["direct", "modified", "held", "double"] as const
/** `stm32-rejection` is a schema-v1 wire token for a scoring-core rejection. */
export const REMOTE_COMMAND_REJECTION_REASONS = [
  "unauthenticated",
  "stale",
  "replayed",
  "wrong-apparatus",
  "wrong-controller-authority",
  "unsupported-command",
  "invalid-mode",
  "clock-running",
  "out-of-bounds",
  "incomplete-snapshot",
  "incompatible-snapshot-revision",
  "entry-timeout",
  "event-capacity-exhausted",
  "owner-unavailable",
  "stm32-rejection"
] as const
export const BOUT_STATE_EVENT_CAUSES = [
  "bout.snapshot.load",
  "score.increment",
  "score.decrement",
  "score.clear",
  "clock.start",
  "clock.stop",
  "clock.set",
  "clock.adjust",
  "break.start",
  "medical.start",
  "medical.stop",
  "overtime.start",
  "format.change",
  "priority.assign",
  "priority.clear",
  "penalty.award",
  "passivityPenalty.award",
  "scoring.rearm.result",
  "sides.swap",
  "cards.reset",
  "weapon.request.result",
  "workflow.undo",
  "controller.authority.transfer",
  "device.sleep.result",
  "bout.reset.result",
  "command.rejected"
] as const

export type RemoteCommandKey = (typeof REMOTE_COMMAND_KEYS)[number]
export type RemotePressKind = (typeof REMOTE_PRESS_KINDS)[number]
export type RemoteCommandRejectionReason = (typeof REMOTE_COMMAND_REJECTION_REASONS)[number]
export type BoutStateEventCause = (typeof BOUT_STATE_EVENT_CAUSES)[number]
export type ControllerKind = "local-application" | "paired-handheld" | "tournament-controller"
export type ControllerPermission = "referee" | "supervisor"
type ControllerAuthorityBase<K extends ControllerKind, P extends ControllerPermission> = Readonly<{
  authorityRevision: number
  controllerId: string
  kind: K
  permission: P
}>
export type ControllerAuthority =
  | ControllerAuthorityBase<"paired-handheld", "referee">
  | ControllerAuthorityBase<"paired-handheld", "supervisor">
  | ControllerAuthorityBase<"local-application" | "tournament-controller", "referee">
  | ControllerAuthorityBase<"local-application" | "tournament-controller", "supervisor">
type SupervisorAuthority = Extract<ControllerAuthority, Readonly<{ permission: "supervisor" }>>
type HandheldAuthority = Extract<ControllerAuthority, Readonly<{ kind: "paired-handheld" }>>
type NonHandheldAuthority = Exclude<ControllerAuthority, HandheldAuthority>
export type SourceCommandIdentity = Readonly<{
  apparatusId: string
  commandId: string
  controllerId: string
  counter: number
  remoteId: string | null
}>
export type TimedWorkflowState = Readonly<{
  configuredDurationCentiseconds: number
  remainingDurationCentiseconds: number
  status: "running" | "stopped"
}>
export type PriorityEntropyReceiptCorrelation = Readonly<{
  bit: 0 | 1
  ownerId: string
  ownerRevision: string
  sampleId: string
}>
export type CompetitionFormatAuthority = Readonly<{
  ownerId: string
  registryDigest: string
  registryId: string
  registryRevision: string
}>
export type BoutWorkflowSnapshot = Readonly<{
  apparatusId: string
  authority: ControllerAuthority
  autoRearm: "manual" | "one-second" | "three-seconds" | "five-seconds"
  boutId: string
  boutRevision: number
  clock: Readonly<{
    /** Configured bout-clock duration; a temporary break does not replace it. */
    configuredDurationCentiseconds: number
    mode: "bout" | "break" | "overtime"
    remainingDurationCentiseconds: number
    status: "running" | "stopped"
  }>
  competition: Readonly<{ kind: "match" | "period"; value: number }>
  competitionFormatAuthority: CompetitionFormatAuthority
  eventRevision: number
  lastScoredSide: "left" | "right" | null
  medical: TimedWorkflowState | null
  passivity: TimedWorkflowState | null
  priority: "left" | "right" | null
  priorityEntropyReceipt: PriorityEntropyReceiptCorrelation | null
  sides: Readonly<{
    left: Readonly<{ pCard: "none" | "yellow" | "red"; redCardCount: number; score: number; yellowCard: boolean }>
    right: Readonly<{ pCard: "none" | "yellow" | "red"; redCardCount: number; score: number; yellowCard: boolean }>
  }>
  sourceCommandDisposition: "accepted" | "rejected"
  sourceCommandIdentity: SourceCommandIdentity
  /** Schema-v1 wire field; it correlates a portable scoring-core record. */
  stm32RecordId: string | null
  timingConfigurationRevision: string
  weapon: Weapon
}>
export type EmptyRemoteCommandPayload = Readonly<Record<string, never>>
type Source<A extends ControllerAuthority> = A extends HandheldAuthority
  ? Readonly<{ authority: A; remoteId: string }>
  : Readonly<{ authority: A; remoteId: null }>
type CommandSource = Source<ControllerAuthority>
type SupervisorSource = Source<SupervisorAuthority>
type NonHandheldSupervisorSource = Source<Extract<NonHandheldAuthority, Readonly<{ permission: "supervisor" }>>>
type Base<
  C extends RemoteCommandKey,
  P extends RemotePressKind,
  V,
  S extends CommandSource = CommandSource
> = Readonly<{
  apparatusId: string
  command: C
  commandId: string
  counter: number
  payload: V
  pressKind: P
  schemaVersion: typeof REMOTE_CONTROL_SCHEMA_VERSION
}> &
  S
type DirectEmpty = Exclude<
  RemoteCommandKey,
  | "clock.configure"
  | "bout.snapshot.load"
  | "controller.authority.transfer"
  | "priority.assign.supervisor"
  | "score.clear.supervisor"
  | "passivityPenalty.award.left"
  | "passivityPenalty.award.right"
  | "medical.start"
  | "format.advance"
  | "format.retreat"
  | "sides.swap"
  | "scoring.autoRearm.advance"
  | "bout.new"
  | "overtime.toggle"
  | "device.sleep.request"
  | "clock.loadOneMinute"
>
/** Discriminated by command, press kind, and payload so mismatched constructions do not type-check. */
export type RemoteCommand =
  | Base<DirectEmpty, "direct", EmptyRemoteCommandPayload>
  | Base<
      | "passivityPenalty.award.left"
      | "passivityPenalty.award.right"
      | "medical.start"
      | "format.advance"
      | "format.retreat"
      | "sides.swap"
      | "scoring.autoRearm.advance",
      "modified",
      EmptyRemoteCommandPayload
    >
  | Base<"overtime.toggle" | "device.sleep.request", "held", EmptyRemoteCommandPayload>
  | Base<"clock.loadOneMinute", "double", EmptyRemoteCommandPayload>
  | Base<"clock.configure", "modified", Readonly<{ minutes: number; seconds: number }>>
  | Base<"bout.new", "modified", EmptyRemoteCommandPayload, SupervisorSource>
  | Base<"bout.snapshot.load", "direct", Readonly<{ snapshot: BoutWorkflowSnapshot }>, NonHandheldSupervisorSource>
  | Base<
      "controller.authority.transfer",
      "direct",
      Readonly<{ nextAuthority: ControllerAuthority }>,
      NonHandheldSupervisorSource
    >
  | Base<"priority.assign.supervisor", "direct", Readonly<{ side: "left" | "right" }>, NonHandheldSupervisorSource>
  | Base<"score.clear.supervisor", "direct", EmptyRemoteCommandPayload, NonHandheldSupervisorSource>
export type BoutStateEvent =
  | Readonly<{
      cause: Exclude<BoutStateEventCause, "command.rejected">
      disposition: "accepted"
      eventId: string
      eventRevision: number
      rejectionReason: null
      resultingBoutState: BoutWorkflowSnapshot
      schemaVersion: typeof REMOTE_CONTROL_SCHEMA_VERSION
      sourceCommand: RemoteCommand
      /** Schema-v1 wire field; it correlates a portable scoring-core record. */
      stm32RecordId: string | null
    }>
  | Readonly<{
      cause: "command.rejected"
      disposition: "rejected"
      eventId: string
      eventRevision: number
      rejectionReason: RemoteCommandRejectionReason
      resultingBoutState: null
      schemaVersion: typeof REMOTE_CONTROL_SCHEMA_VERSION
      sourceCommand: RemoteCommand
      stm32RecordId: null
    }>

const ID_MAX = 96
const SUPERVISOR_COMMANDS = new Set<RemoteCommandKey>([
  "bout.new",
  "bout.snapshot.load",
  "controller.authority.transfer",
  "priority.assign.supervisor",
  "score.clear.supervisor"
])
const SCORING_CORE_CAUSES = new Set<BoutStateEventCause>([
  "weapon.request.result",
  "scoring.rearm.result",
  "bout.reset.result"
])
const CAUSES = {
  "score.increment.left": ["score.increment"],
  "score.increment.right": ["score.increment"],
  "score.decrement.left": ["score.decrement"],
  "score.decrement.right": ["score.decrement"],
  "clock.toggle": ["clock.start", "clock.stop"],
  "clock.adjust.positive": ["clock.adjust"],
  "clock.adjust.negative": ["clock.adjust"],
  "clock.loadConfigured": ["clock.set"],
  "clock.configure": ["clock.set"],
  "clock.loadOneMinute": ["clock.set"],
  "format.advance": ["format.change"],
  "format.retreat": ["format.change"],
  "penalty.award.left": ["penalty.award"],
  "penalty.award.right": ["penalty.award"],
  "passivityPenalty.award.left": ["passivityPenalty.award"],
  "passivityPenalty.award.right": ["passivityPenalty.award"],
  "break.start.oneMinute": ["break.start"],
  "medical.start": ["medical.start", "medical.stop"],
  "overtime.toggle": ["overtime.start", "priority.assign", "priority.clear"],
  "workflow.undo": ["workflow.undo"],
  "sides.swap": ["sides.swap"],
  "weapon.showOrAdvance": ["weapon.request.result"],
  "modifier.opt": [],
  "scoring.rearm": ["scoring.rearm.result"],
  "scoring.autoRearm.advance": ["scoring.rearm.result"],
  "cards.reset": ["cards.reset"],
  "bout.new": ["bout.reset.result"],
  "device.sleep.request": ["device.sleep.result"],
  "bout.snapshot.load": ["bout.snapshot.load"],
  "controller.authority.transfer": ["controller.authority.transfer"],
  "priority.assign.supervisor": ["priority.assign"],
  "score.clear.supervisor": ["score.clear"]
} as const satisfies Record<RemoteCommandKey, readonly Exclude<BoutStateEventCause, "command.rejected">[]>

function record(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Object.getPrototypeOf(value) !== Object.prototype) return false
  return Reflect.ownKeys(value).every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    return typeof key === "string" && descriptor !== undefined && descriptor.enumerable && "value" in descriptor
  })
}
function keys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Reflect.ownKeys(value)
  return actual.length === expected.length && actual.every((key) => typeof key === "string" && expected.includes(key))
}
function oneOf<T extends string>(value: unknown, choices: readonly T[]): value is T {
  return typeof value === "string" && choices.some((choice) => choice === value)
}
function integer(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
}
function id(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= ID_MAX && value === value.trim()
}
function authority(value: unknown): value is ControllerAuthority {
  return (
    record(value) &&
    keys(value, ["authorityRevision", "controllerId", "kind", "permission"]) &&
    integer(value.authorityRevision) &&
    id(value.controllerId) &&
    oneOf(value.kind, ["local-application", "paired-handheld", "tournament-controller"]) &&
    oneOf(value.permission, ["referee", "supervisor"])
  )
}
function sourceIdentity(value: unknown): value is SourceCommandIdentity {
  return (
    record(value) &&
    keys(value, ["apparatusId", "commandId", "controllerId", "counter", "remoteId"]) &&
    id(value.apparatusId) &&
    id(value.commandId) &&
    id(value.controllerId) &&
    integer(value.counter) &&
    (value.remoteId === null || id(value.remoteId))
  )
}
function timed(value: unknown): value is TimedWorkflowState {
  return (
    record(value) &&
    keys(value, ["configuredDurationCentiseconds", "remainingDurationCentiseconds", "status"]) &&
    integer(value.configuredDurationCentiseconds) &&
    integer(value.remainingDurationCentiseconds) &&
    value.remainingDurationCentiseconds <= value.configuredDurationCentiseconds &&
    oneOf(value.status, ["running", "stopped"])
  )
}
function priorityEntropyReceipt(value: unknown): value is PriorityEntropyReceiptCorrelation {
  return (
    record(value) &&
    keys(value, ["bit", "ownerId", "ownerRevision", "sampleId"]) &&
    (value.bit === 0 || value.bit === 1) &&
    id(value.ownerId) &&
    id(value.ownerRevision) &&
    id(value.sampleId)
  )
}
function competitionFormatAuthority(value: unknown): value is CompetitionFormatAuthority {
  return (
    record(value) &&
    keys(value, ["ownerId", "registryDigest", "registryId", "registryRevision"]) &&
    id(value.ownerId) &&
    id(value.registryDigest) &&
    id(value.registryId) &&
    id(value.registryRevision)
  )
}
function side(value: unknown): boolean {
  return (
    record(value) &&
    keys(value, ["pCard", "redCardCount", "score", "yellowCard"]) &&
    oneOf(value.pCard, ["none", "yellow", "red"]) &&
    integer(value.redCardCount) &&
    integer(value.score) &&
    typeof value.yellowCard === "boolean"
  )
}
/** Strictly validates a complete persisted bout-workflow snapshot. */
export function isBoutWorkflowSnapshot(value: unknown): value is BoutWorkflowSnapshot {
  if (
    !record(value) ||
    !keys(value, [
      "apparatusId",
      "authority",
      "autoRearm",
      "boutId",
      "boutRevision",
      "clock",
      "competition",
      "competitionFormatAuthority",
      "eventRevision",
      "lastScoredSide",
      "medical",
      "passivity",
      "priority",
      "priorityEntropyReceipt",
      "sides",
      "sourceCommandDisposition",
      "sourceCommandIdentity",
      "stm32RecordId",
      "timingConfigurationRevision",
      "weapon"
    ]) ||
    !id(value.apparatusId) ||
    !authority(value.authority) ||
    !oneOf(value.autoRearm, ["manual", "one-second", "three-seconds", "five-seconds"]) ||
    !id(value.boutId) ||
    !integer(value.boutRevision) ||
    !integer(value.eventRevision) ||
    !id(value.timingConfigurationRevision) ||
    !oneOf(value.weapon, ["epee", "foil", "sabre"]) ||
    !oneOf(value.sourceCommandDisposition, ["accepted", "rejected"]) ||
    !sourceIdentity(value.sourceCommandIdentity) ||
    (value.stm32RecordId !== null && !id(value.stm32RecordId)) ||
    value.sourceCommandIdentity.apparatusId !== value.apparatusId ||
    (value.sourceCommandDisposition === "rejected" && value.stm32RecordId !== null)
  )
    return false
  return (
    record(value.clock) &&
    keys(value.clock, ["configuredDurationCentiseconds", "mode", "remainingDurationCentiseconds", "status"]) &&
    integer(value.clock.configuredDurationCentiseconds) &&
    integer(value.clock.remainingDurationCentiseconds) &&
    oneOf(value.clock.mode, ["bout", "break", "overtime"]) &&
    (value.clock.mode === "break" || value.clock.mode === "overtime"
      ? value.clock.remainingDurationCentiseconds <= 6_000
      : value.clock.remainingDurationCentiseconds <= value.clock.configuredDurationCentiseconds) &&
    oneOf(value.clock.status, ["running", "stopped"]) &&
    record(value.competition) &&
    keys(value.competition, ["kind", "value"]) &&
    oneOf(value.competition.kind, ["match", "period"]) &&
    integer(value.competition.value) &&
    competitionFormatAuthority(value.competitionFormatAuthority) &&
    (value.lastScoredSide === null || oneOf(value.lastScoredSide, ["left", "right"])) &&
    (value.priority === null || oneOf(value.priority, ["left", "right"])) &&
    (value.priorityEntropyReceipt === null || priorityEntropyReceipt(value.priorityEntropyReceipt)) &&
    (value.medical === null || timed(value.medical)) &&
    (value.passivity === null || timed(value.passivity)) &&
    record(value.sides) &&
    keys(value.sides, ["left", "right"]) &&
    side(value.sides.left) &&
    side(value.sides.right) &&
    (value.priority === null || value.clock.mode === "overtime") &&
    (value.priorityEntropyReceipt === null ||
      value.priority === (value.priorityEntropyReceipt.bit === 0 ? "left" : "right")) &&
    (value.clock.mode !== "overtime" ||
      (value.clock.status === "running" &&
        value.clock.remainingDurationCentiseconds > 0 &&
        value.priority !== null &&
        value.priorityEntropyReceipt !== null)) &&
    !(
      value.medical !== null &&
      value.medical.status === "running" &&
      (value.clock.mode !== "bout" ||
        value.clock.status !== "stopped" ||
        (value.passivity !== null && value.passivity.status === "running"))
    ) &&
    !(
      value.passivity !== null &&
      value.passivity.status === "running" &&
      (value.clock.mode !== "bout" || value.clock.status !== "running")
    )
  )
}
function permitted(command: RemoteCommandKey, controller: ControllerAuthority): boolean {
  return (
    (!SUPERVISOR_COMMANDS.has(command) || controller.permission === "supervisor") &&
    !(
      (command === "bout.snapshot.load" ||
        command === "controller.authority.transfer" ||
        command === "priority.assign.supervisor" ||
        command === "score.clear.supervisor") &&
      controller.kind === "paired-handheld"
    )
  )
}
function payload(command: RemoteCommandKey, value: unknown): boolean {
  if (!record(value)) return false
  if (command === "clock.configure")
    return (
      keys(value, ["minutes", "seconds"]) &&
      integer(value.minutes) &&
      value.minutes <= 99 &&
      integer(value.seconds) &&
      value.seconds <= 59
    )
  if (command === "bout.snapshot.load") return keys(value, ["snapshot"]) && isBoutWorkflowSnapshot(value.snapshot)
  if (command === "controller.authority.transfer")
    return keys(value, ["nextAuthority"]) && authority(value.nextAuthority)
  if (command === "priority.assign.supervisor") return keys(value, ["side"]) && oneOf(value.side, ["left", "right"])
  return keys(value, [])
}
function press(command: RemoteCommandKey, value: unknown): value is RemotePressKind {
  if (!oneOf(value, REMOTE_PRESS_KINDS)) return false
  if (
    [
      "passivityPenalty.award.left",
      "passivityPenalty.award.right",
      "medical.start",
      "format.advance",
      "format.retreat",
      "sides.swap",
      "scoring.autoRearm.advance",
      "bout.new",
      "clock.configure"
    ].includes(command)
  )
    return value === "modified"
  if (command === "overtime.toggle" || command === "device.sleep.request") return value === "held"
  return command === "clock.loadOneMinute" ? value === "double" : value === "direct"
}
export function isRemoteCommand(value: unknown): value is RemoteCommand {
  return (
    record(value) &&
    keys(value, [
      "apparatusId",
      "authority",
      "command",
      "commandId",
      "counter",
      "payload",
      "pressKind",
      "remoteId",
      "schemaVersion"
    ]) &&
    value.schemaVersion === REMOTE_CONTROL_SCHEMA_VERSION &&
    id(value.apparatusId) &&
    authority(value.authority) &&
    oneOf(value.command, REMOTE_COMMAND_KEYS) &&
    id(value.commandId) &&
    integer(value.counter) &&
    (value.remoteId === null || id(value.remoteId)) &&
    (value.authority.kind === "paired-handheld" ? value.remoteId !== null : value.remoteId === null) &&
    permitted(value.command, value.authority) &&
    press(value.command, value.pressKind) &&
    payload(value.command, value.payload)
  )
}
export function parseRemoteCommand(value: unknown): RemoteCommand {
  if (!isRemoteCommand(value)) throw new TypeError("Unsupported or invalid remote command")
  return value
}
function matches(snapshotValue: BoutWorkflowSnapshot, command: RemoteCommand): boolean {
  const source = snapshotValue.sourceCommandIdentity
  return (
    source.apparatusId === command.apparatusId &&
    source.commandId === command.commandId &&
    source.controllerId === command.authority.controllerId &&
    source.counter === command.counter &&
    source.remoteId === command.remoteId
  )
}
export function isBoutStateEvent(value: unknown): value is BoutStateEvent {
  if (
    !record(value) ||
    !keys(value, [
      "cause",
      "disposition",
      "eventId",
      "eventRevision",
      "rejectionReason",
      "resultingBoutState",
      "schemaVersion",
      "sourceCommand",
      "stm32RecordId"
    ]) ||
    value.schemaVersion !== REMOTE_CONTROL_SCHEMA_VERSION ||
    !id(value.eventId) ||
    !integer(value.eventRevision) ||
    !isRemoteCommand(value.sourceCommand)
  )
    return false
  if (value.disposition === "accepted")
    return (
      oneOf(value.cause, BOUT_STATE_EVENT_CAUSES) &&
      value.cause !== "command.rejected" &&
      CAUSES[value.sourceCommand.command].some((cause) => cause === value.cause) &&
      value.rejectionReason === null &&
      isBoutWorkflowSnapshot(value.resultingBoutState) &&
      value.resultingBoutState.apparatusId === value.sourceCommand.apparatusId &&
      value.resultingBoutState.eventRevision === value.eventRevision &&
      value.resultingBoutState.sourceCommandDisposition === "accepted" &&
      matches(value.resultingBoutState, value.sourceCommand) &&
      value.resultingBoutState.stm32RecordId === value.stm32RecordId &&
      (value.stm32RecordId === null || id(value.stm32RecordId)) &&
      (!SCORING_CORE_CAUSES.has(value.cause) || value.stm32RecordId !== null)
    )
  return (
    value.disposition === "rejected" &&
    value.cause === "command.rejected" &&
    oneOf(value.rejectionReason, REMOTE_COMMAND_REJECTION_REASONS) &&
    value.resultingBoutState === null &&
    value.stm32RecordId === null
  )
}
/** Rejects incomplete or incompatible persisted snapshot shapes before a load can begin. */
export function parseBoutWorkflowSnapshot(value: unknown): BoutWorkflowSnapshot {
  if (!isBoutWorkflowSnapshot(value)) throw new TypeError("Unsupported or invalid bout workflow snapshot")
  return value
}
export function parseBoutStateEvent(value: unknown): BoutStateEvent {
  if (!isBoutStateEvent(value)) throw new TypeError("Unsupported or invalid bout state event")
  return value
}
