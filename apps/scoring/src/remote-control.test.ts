import { describe, expect, it } from "vitest"
import {
  BOUT_STATE_EVENT_CAUSES,
  REMOTE_COMMAND_KEYS,
  REMOTE_COMMAND_REJECTION_REASONS,
  REMOTE_CONTROL_SCHEMA_VERSION,
  parseBoutStateEvent,
  parseBoutWorkflowSnapshot,
  parseRemoteCommand,
  type BoutWorkflowSnapshot,
  type RemoteCommand,
  type RemoteCommandKey
} from "./remote-control.js"

const referee = {
  authorityRevision: 1,
  controllerId: "remote-operator",
  kind: "paired-handheld",
  permission: "referee"
} as const
const supervisor = { ...referee, permission: "supervisor" } as const
const appSupervisor = {
  authorityRevision: 2,
  controllerId: "app-operator",
  kind: "local-application",
  permission: "supervisor"
} as const
const score = {
  apparatusId: "apparatus-1",
  authority: referee,
  command: "score.increment.left",
  commandId: "command-1",
  counter: 1,
  payload: {},
  pressKind: "direct",
  remoteId: "remote-1",
  schemaVersion: REMOTE_CONTROL_SCHEMA_VERSION
} satisfies RemoteCommand
const snapshot = {
  apparatusId: "apparatus-1",
  authority: referee,
  autoRearm: "manual",
  boutId: "bout-1",
  boutRevision: 1,
  clock: {
    configuredDurationCentiseconds: 18_000,
    mode: "bout",
    remainingDurationCentiseconds: 17_000,
    status: "stopped"
  },
  competition: { kind: "period", value: 1 },
  eventRevision: 8,
  lastScoredSide: null,
  medical: null,
  passivity: null,
  priority: null,
  sides: {
    left: { pCard: "none", redCardCount: 0, score: 1, yellowCard: false },
    right: { pCard: "none", redCardCount: 0, score: 0, yellowCard: false }
  },
  sourceCommandDisposition: "accepted",
  sourceCommandIdentity: {
    apparatusId: score.apparatusId,
    commandId: score.commandId,
    controllerId: score.authority.controllerId,
    counter: score.counter,
    remoteId: score.remoteId
  },
  stm32RecordId: null,
  timingConfigurationRevision: "timing-1",
  weapon: "epee"
} satisfies BoutWorkflowSnapshot

const typeCoverage = [
  score,
  { ...score, command: "clock.configure", payload: { minutes: 3, seconds: 0 }, pressKind: "modified" },
  { ...score, command: "overtime.toggle", pressKind: "held" },
  { ...score, command: "clock.loadOneMinute", pressKind: "double" },
  { ...score, authority: appSupervisor, command: "bout.snapshot.load", payload: { snapshot }, remoteId: null },
  {
    ...score,
    authority: appSupervisor,
    command: "controller.authority.transfer",
    payload: { nextAuthority: supervisor },
    remoteId: null
  },
  {
    ...score,
    authority: appSupervisor,
    command: "priority.assign.supervisor",
    payload: { side: "left" },
    remoteId: null
  },
  { ...score, authority: appSupervisor, command: "score.clear.supervisor", remoteId: null }
] satisfies readonly RemoteCommand[]

const _invalidHandheldSnapshot = {
  ...score,
  command: "bout.snapshot.load",
  payload: { snapshot }
} as const
const _invalidRefereePriority = {
  ...score,
  command: "priority.assign.supervisor",
  payload: { side: "left" }
} as const
const _invalidHandheldScoreClear = { ...score, authority: supervisor, command: "score.clear.supervisor" } as const
type IsNotRemoteCommand<Value> = Value extends RemoteCommand ? false : true
const _handheldSnapshotIsNotRemoteCommand: IsNotRemoteCommand<typeof _invalidHandheldSnapshot> = true
const _refereePriorityIsNotRemoteCommand: IsNotRemoteCommand<typeof _invalidRefereePriority> = true
const _handheldScoreClearIsNotRemoteCommand: IsNotRemoteCommand<typeof _invalidHandheldScoreClear> = true

function commandFor(command: RemoteCommandKey): RemoteCommand {
  const authority =
    command === "bout.new"
      ? supervisor
      : command === "bout.snapshot.load" ||
          command === "controller.authority.transfer" ||
          command === "priority.assign.supervisor" ||
          command === "score.clear.supervisor"
        ? appSupervisor
        : referee
  const base = {
    apparatusId: "apparatus-1",
    authority,
    command,
    commandId: `command-${command}`,
    counter: 2,
    payload: {},
    pressKind: "direct",
    remoteId: authority.kind === "paired-handheld" ? "remote-1" : null,
    schemaVersion: REMOTE_CONTROL_SCHEMA_VERSION
  }
  if (command === "clock.configure")
    return parseRemoteCommand({ ...base, payload: { minutes: 3, seconds: 0 }, pressKind: "modified" })
  if (command === "bout.snapshot.load") return parseRemoteCommand({ ...base, payload: { snapshot } })
  if (command === "controller.authority.transfer")
    return parseRemoteCommand({ ...base, payload: { nextAuthority: supervisor } })
  if (command === "priority.assign.supervisor") return parseRemoteCommand({ ...base, payload: { side: "left" } })
  if (
    [
      "passivityPenalty.award.left",
      "passivityPenalty.award.right",
      "medical.start",
      "format.advance",
      "format.retreat",
      "sides.swap",
      "scoring.autoRearm.advance",
      "bout.new"
    ].includes(command)
  )
    return parseRemoteCommand({ ...base, pressKind: "modified" })
  if (command === "overtime.toggle" || command === "device.sleep.request")
    return parseRemoteCommand({ ...base, pressKind: "held" })
  if (command === "clock.loadOneMinute") return parseRemoteCommand({ ...base, pressKind: "double" })
  return parseRemoteCommand(base)
}

describe("RC-02 remote command schema", () => {
  it("accepts all canonical commands and static command classes", () => {
    expect(typeCoverage).toHaveLength(8)
    expect(REMOTE_COMMAND_KEYS).toHaveLength(32)
    expect(_handheldSnapshotIsNotRemoteCommand).toBe(true)
    expect(_refereePriorityIsNotRemoteCommand).toBe(true)
    expect(_handheldScoreClearIsNotRemoteCommand).toBe(true)
    for (const command of REMOTE_COMMAND_KEYS)
      expect(parseRemoteCommand(JSON.parse(JSON.stringify(commandFor(command))))).toEqual(commandFor(command))
  })
  it("fails closed for mismatched discriminants and exact keys", () => {
    let getterReads = 0
    const accessor = { ...score }
    Object.defineProperty(accessor, "command", {
      enumerable: true,
      get() {
        getterReads += 1
        return "score.increment.left"
      }
    })
    const nonEnumerable = { ...score }
    Object.defineProperty(nonEnumerable, "extra", { enumerable: false, value: true })
    const inherited = Object.create(score)
    class SubclassedCommand {
      apparatusId = score.apparatusId
    }
    for (const value of [
      { ...score, command: "clock.configure" },
      { ...score, command: "clock.configure", payload: { minutes: 3, seconds: 0 } },
      { ...score, payload: { x: true } },
      { ...score, extra: true },
      { ...score, [Symbol("x")]: true },
      accessor,
      nonEnumerable,
      inherited,
      new SubclassedCommand()
    ])
      expect(() => parseRemoteCommand(value)).toThrow(TypeError)
    expect(getterReads).toBe(0)
  })
  it("blocks handheld snapshot loads/transfers and referee destructive or priority commands", () => {
    for (const command of ["bout.snapshot.load", "controller.authority.transfer", "score.clear.supervisor"] as const)
      expect(() => parseRemoteCommand({ ...commandFor(command), authority: supervisor, remoteId: "remote-1" })).toThrow(
        TypeError
      )
    for (const command of [
      "bout.new",
      "bout.snapshot.load",
      "controller.authority.transfer",
      "priority.assign.supervisor",
      "score.clear.supervisor"
    ] as const) {
      const valid = commandFor(command)
      expect(() => parseRemoteCommand({ ...valid, authority: { ...valid.authority, permission: "referee" } })).toThrow(
        TypeError
      )
    }
  })
})

describe("RC-02 bout state event schema", () => {
  const accepted = {
    cause: "score.increment",
    disposition: "accepted",
    eventId: "event-8",
    eventRevision: 8,
    rejectionReason: null,
    resultingBoutState: snapshot,
    schemaVersion: REMOTE_CONTROL_SCHEMA_VERSION,
    sourceCommand: score,
    stm32RecordId: null
  } as const
  it("requires exact command-to-cause mapping and complete snapshot provenance", () => {
    expect(parseBoutStateEvent(accepted)).toEqual(accepted)
    for (const value of [
      { ...accepted, cause: "score.decrement" },
      { ...accepted, resultingBoutState: { ...snapshot, sourceCommandDisposition: "rejected" } },
      {
        ...accepted,
        resultingBoutState: {
          ...snapshot,
          sourceCommandIdentity: { ...snapshot.sourceCommandIdentity, commandId: "other" }
        }
      }
    ])
      expect(() => parseBoutStateEvent(value)).toThrow(TypeError)
  })
  it("requires matching non-null STM32 correlation for apparatus-owned results", () => {
    const rearm = commandFor("scoring.rearm")
    const rearmSnapshot = {
      ...snapshot,
      sourceCommandIdentity: {
        apparatusId: rearm.apparatusId,
        commandId: rearm.commandId,
        controllerId: rearm.authority.controllerId,
        counter: rearm.counter,
        remoteId: rearm.remoteId
      }
    }
    for (const value of [
      { ...accepted, cause: "scoring.rearm.result", sourceCommand: rearm, resultingBoutState: rearmSnapshot },
      {
        ...accepted,
        cause: "scoring.rearm.result",
        sourceCommand: rearm,
        resultingBoutState: { ...rearmSnapshot, stm32RecordId: "record-1" },
        stm32RecordId: "record-2"
      }
    ])
      expect(() => parseBoutStateEvent(value)).toThrow(TypeError)
  })
  it("requires new-bout completion to be the correlated STM32 reset result", () => {
    const newBout = commandFor("bout.new")
    const resultingBoutState = {
      ...snapshot,
      sourceCommandIdentity: {
        apparatusId: newBout.apparatusId,
        commandId: newBout.commandId,
        controllerId: newBout.authority.controllerId,
        counter: newBout.counter,
        remoteId: newBout.remoteId
      },
      stm32RecordId: "stm32-reset-1"
    }
    expect(
      parseBoutStateEvent({
        ...accepted,
        cause: "bout.reset.result",
        resultingBoutState,
        sourceCommand: newBout,
        stm32RecordId: "stm32-reset-1"
      })
    ).toMatchObject({ cause: "bout.reset.result" })
    expect(() =>
      parseBoutStateEvent({ ...accepted, cause: "bout.new", sourceCommand: newBout, resultingBoutState })
    ).toThrow(TypeError)
  })
  it("rejects loaded snapshots with invalid provenance and exercises every accepted/rejected outcome vocabulary", () => {
    for (const invalidSnapshot of [
      { ...snapshot, sourceCommandIdentity: { ...snapshot.sourceCommandIdentity, apparatusId: "other-apparatus" } },
      { ...snapshot, sourceCommandDisposition: "rejected", stm32RecordId: "stm32-record-1" }
    ])
      expect(() =>
        parseRemoteCommand({ ...commandFor("bout.snapshot.load"), payload: { snapshot: invalidSnapshot } })
      ).toThrow(TypeError)

    const pairs = [
      ["score.increment.left", "score.increment"],
      ["score.decrement.left", "score.decrement"],
      ["score.clear.supervisor", "score.clear"],
      ["clock.toggle", "clock.start"],
      ["clock.toggle", "clock.stop"],
      ["clock.configure", "clock.set"],
      ["clock.adjust.positive", "clock.adjust"],
      ["break.start.oneMinute", "break.start"],
      ["medical.start", "medical.start"],
      ["medical.start", "medical.stop"],
      ["overtime.toggle", "overtime.start"],
      ["overtime.toggle", "priority.assign"],
      ["overtime.toggle", "priority.clear"],
      ["format.advance", "format.change"],
      ["penalty.award.left", "penalty.award"],
      ["passivityPenalty.award.left", "passivityPenalty.award"],
      ["scoring.rearm", "scoring.rearm.result"],
      ["sides.swap", "sides.swap"],
      ["cards.reset", "cards.reset"],
      ["weapon.showOrAdvance", "weapon.request.result"],
      ["workflow.undo", "workflow.undo"],
      ["controller.authority.transfer", "controller.authority.transfer"],
      ["device.sleep.request", "device.sleep.result"],
      ["bout.snapshot.load", "bout.snapshot.load"],
      ["bout.new", "bout.reset.result"],
      ["priority.assign.supervisor", "priority.assign"]
    ] as const
    expect(new Set(pairs.map(([, cause]) => cause))).toEqual(
      new Set(BOUT_STATE_EVENT_CAUSES.filter((cause) => cause !== "command.rejected"))
    )
    for (const [command, cause] of pairs) {
      const sourceCommand = commandFor(command)
      const stm32RecordId =
        cause === "weapon.request.result" || cause === "scoring.rearm.result" || cause === "bout.reset.result"
          ? `stm32-${cause}`
          : null
      const resultingBoutState = {
        ...snapshot,
        eventRevision: 10,
        sourceCommandIdentity: {
          apparatusId: sourceCommand.apparatusId,
          commandId: sourceCommand.commandId,
          controllerId: sourceCommand.authority.controllerId,
          counter: sourceCommand.counter,
          remoteId: sourceCommand.remoteId
        },
        stm32RecordId
      }
      expect(
        parseBoutStateEvent({
          ...accepted,
          cause,
          eventId: `accepted-${cause}`,
          eventRevision: 10,
          resultingBoutState,
          sourceCommand,
          stm32RecordId
        })
      ).toMatchObject({ cause })
    }
    for (const rejectionReason of REMOTE_COMMAND_REJECTION_REASONS)
      expect(
        parseBoutStateEvent({
          cause: "command.rejected",
          disposition: "rejected",
          eventId: `rejected-${rejectionReason}`,
          eventRevision: 9,
          rejectionReason,
          resultingBoutState: null,
          schemaVersion: REMOTE_CONTROL_SCHEMA_VERSION,
          sourceCommand: score,
          stm32RecordId: null
        })
      ).toMatchObject({ rejectionReason })
  })
})

describe("RC-02 complete clock snapshot schema", () => {
  it("preserves a short configured bout duration while a one-minute break is active", () => {
    const activeBreak = {
      ...snapshot,
      clock: {
        configuredDurationCentiseconds: 3_000,
        mode: "break",
        remainingDurationCentiseconds: 6_000,
        status: "running"
      }
    } as const
    expect(parseBoutWorkflowSnapshot(activeBreak)).toEqual(activeBreak)
    expect(() =>
      parseBoutWorkflowSnapshot({
        ...activeBreak,
        clock: { ...activeBreak.clock, mode: "overtime" }
      })
    ).toThrow(TypeError)
    expect(() =>
      parseBoutWorkflowSnapshot({
        ...activeBreak,
        clock: { ...activeBreak.clock, remainingDurationCentiseconds: 6_001 }
      })
    ).toThrow(TypeError)
  })
})
