import { createHash } from "node:crypto"
import { describe, expect, it } from "vitest"
import {
  GOLDEN_APPLIED_EVENTS,
  GOLDEN_APPLICATION_SUPERVISOR_AUTHORITY,
  GOLDEN_AUTHORITY_TRANSFER_SNAPSHOT,
  GOLDEN_EMPTY_STATE_VALUES,
  GOLDEN_HANDHELD_REFEREE_AUTHORITY,
  GOLDEN_INVALID_STATE_VALUES,
  GOLDEN_LOADED_SNAPSHOT,
  GOLDEN_NEW_BOUT_SNAPSHOT,
  GOLDEN_OVERTIME_SNAPSHOT,
  GOLDEN_REMOTE_COMMAND_KEYS,
  GOLDEN_REMOTE_COMMANDS,
  GOLDEN_REJECTED_EVENTS,
  GOLDEN_SNAPSHOT,
  GOLDEN_TOURNAMENT_SUPERVISOR_AUTHORITY,
  REMOTE_CONTROL_GOLDEN_FIXTURE_VERSION,
  REMOTE_CONTROL_GOLDEN_FIXTURES,
  type RemoteControlGoldenCommandKey
} from "./remote-control-golden-fixtures.js"
import {
  isBoutStateEvent,
  isBoutWorkflowSnapshot,
  isRemoteCommand,
  parseBoutStateEvent,
  parseBoutWorkflowSnapshot,
  parseRemoteCommand,
  REMOTE_COMMAND_KEYS,
  REMOTE_CONTROL_SCHEMA_VERSION,
  type BoutWorkflowSnapshot,
  type RemotePressKind
} from "./remote-control.js"

type ExpectedPayloadKind = "empty" | "configure" | "snapshot" | "transfer" | "priority"

const EXPECTED_HANDHELD_REFEREE_AUTHORITY = {
  authorityRevision: 10,
  controllerId: "remote-referee-01",
  kind: "paired-handheld",
  permission: "referee"
} as const

const EXPECTED_APPLICATION_SUPERVISOR_AUTHORITY = {
  authorityRevision: 11,
  controllerId: "local-supervisor-01",
  kind: "local-application",
  permission: "supervisor"
} as const

const EXPECTED_TOURNAMENT_SUPERVISOR_AUTHORITY = {
  authorityRevision: 12,
  controllerId: "tournament-supervisor-01",
  kind: "tournament-controller",
  permission: "supervisor"
} as const

const EXPECTED_COMMAND_DESCRIPTORS = {
  "score.increment.left": {
    authority: "handheld",
    commandId: "rc02-command-score-increment-left",
    counter: 1001,
    payload: "empty",
    pressKind: "direct"
  },
  "score.increment.right": {
    authority: "handheld",
    commandId: "rc02-command-score-increment-right",
    counter: 1002,
    payload: "empty",
    pressKind: "direct"
  },
  "score.decrement.left": {
    authority: "handheld",
    commandId: "rc02-command-score-decrement-left",
    counter: 1003,
    payload: "empty",
    pressKind: "direct"
  },
  "score.decrement.right": {
    authority: "handheld",
    commandId: "rc02-command-score-decrement-right",
    counter: 1004,
    payload: "empty",
    pressKind: "direct"
  },
  "clock.toggle": {
    authority: "handheld",
    commandId: "rc02-command-clock-toggle",
    counter: 1005,
    payload: "empty",
    pressKind: "direct"
  },
  "clock.adjust.positive": {
    authority: "handheld",
    commandId: "rc02-command-clock-adjust-positive",
    counter: 1006,
    payload: "empty",
    pressKind: "direct"
  },
  "clock.adjust.negative": {
    authority: "handheld",
    commandId: "rc02-command-clock-adjust-negative",
    counter: 1007,
    payload: "empty",
    pressKind: "direct"
  },
  "clock.loadConfigured": {
    authority: "handheld",
    commandId: "rc02-command-clock-load-configured",
    counter: 1008,
    payload: "empty",
    pressKind: "direct"
  },
  "clock.configure": {
    authority: "handheld",
    commandId: "rc02-command-clock-configure",
    counter: 1009,
    payload: "configure",
    pressKind: "modified"
  },
  "clock.loadOneMinute": {
    authority: "handheld",
    commandId: "rc02-command-clock-load-one-minute",
    counter: 1010,
    payload: "empty",
    pressKind: "double"
  },
  "format.advance": {
    authority: "handheld",
    commandId: "rc02-command-format-advance",
    counter: 1011,
    payload: "empty",
    pressKind: "modified"
  },
  "format.retreat": {
    authority: "handheld",
    commandId: "rc02-command-format-retreat",
    counter: 1012,
    payload: "empty",
    pressKind: "modified"
  },
  "penalty.award.left": {
    authority: "handheld",
    commandId: "rc02-command-penalty-award-left",
    counter: 1013,
    payload: "empty",
    pressKind: "direct"
  },
  "penalty.award.right": {
    authority: "handheld",
    commandId: "rc02-command-penalty-award-right",
    counter: 1014,
    payload: "empty",
    pressKind: "direct"
  },
  "passivityPenalty.award.left": {
    authority: "handheld",
    commandId: "rc02-command-passivity-award-left",
    counter: 1015,
    payload: "empty",
    pressKind: "modified"
  },
  "passivityPenalty.award.right": {
    authority: "handheld",
    commandId: "rc02-command-passivity-award-right",
    counter: 1016,
    payload: "empty",
    pressKind: "modified"
  },
  "break.start.oneMinute": {
    authority: "handheld",
    commandId: "rc02-command-break-start-one-minute",
    counter: 1017,
    payload: "empty",
    pressKind: "direct"
  },
  "medical.start": {
    authority: "handheld",
    commandId: "rc02-command-medical-start",
    counter: 1018,
    payload: "empty",
    pressKind: "modified"
  },
  "overtime.toggle": {
    authority: "handheld",
    commandId: "rc02-command-overtime-toggle",
    counter: 1019,
    payload: "empty",
    pressKind: "held"
  },
  "workflow.undo": {
    authority: "handheld",
    commandId: "rc02-command-workflow-undo",
    counter: 1020,
    payload: "empty",
    pressKind: "direct"
  },
  "sides.swap": {
    authority: "handheld",
    commandId: "rc02-command-sides-swap",
    counter: 1021,
    payload: "empty",
    pressKind: "modified"
  },
  "weapon.showOrAdvance": {
    authority: "handheld",
    commandId: "rc02-command-weapon-show-or-advance",
    counter: 1022,
    payload: "empty",
    pressKind: "direct"
  },
  "modifier.opt": {
    authority: "handheld",
    commandId: "rc02-command-modifier-opt",
    counter: 1023,
    payload: "empty",
    pressKind: "direct"
  },
  "scoring.rearm": {
    authority: "handheld",
    commandId: "rc02-command-scoring-rearm",
    counter: 1024,
    payload: "empty",
    pressKind: "direct"
  },
  "scoring.autoRearm.advance": {
    authority: "handheld",
    commandId: "rc02-command-auto-rearm-advance",
    counter: 1025,
    payload: "empty",
    pressKind: "modified"
  },
  "cards.reset": {
    authority: "handheld",
    commandId: "rc02-command-cards-reset",
    counter: 1026,
    payload: "empty",
    pressKind: "direct"
  },
  "bout.new": {
    authority: "application",
    commandId: "rc02-command-bout-new",
    counter: 1027,
    payload: "empty",
    pressKind: "modified"
  },
  "device.sleep.request": {
    authority: "handheld",
    commandId: "rc02-command-device-sleep-request",
    counter: 1028,
    payload: "empty",
    pressKind: "held"
  },
  "bout.snapshot.load": {
    authority: "application",
    commandId: "rc02-command-bout-snapshot-load",
    counter: 1029,
    payload: "snapshot",
    pressKind: "direct"
  },
  "controller.authority.transfer": {
    authority: "application",
    commandId: "rc02-command-authority-transfer",
    counter: 1030,
    payload: "transfer",
    pressKind: "direct"
  },
  "priority.assign.supervisor": {
    authority: "application",
    commandId: "rc02-command-priority-assign",
    counter: 1031,
    payload: "priority",
    pressKind: "direct"
  },
  "score.clear.supervisor": {
    authority: "application",
    commandId: "rc02-command-score-clear",
    counter: 1032,
    payload: "empty",
    pressKind: "direct"
  }
} as const satisfies Readonly<
  Record<
    RemoteControlGoldenCommandKey,
    Readonly<{
      authority: "handheld" | "application"
      commandId: string
      counter: number
      payload: ExpectedPayloadKind
      pressKind: RemotePressKind
    }>
  >
>

function expectedCommandPayload(kind: ExpectedPayloadKind): object {
  switch (kind) {
    case "empty":
      return {}
    case "configure":
      return { minutes: 2, seconds: 37 }
    case "snapshot":
      return { snapshot: GOLDEN_LOADED_SNAPSHOT }
    case "transfer":
      return { nextAuthority: EXPECTED_TOURNAMENT_SUPERVISOR_AUTHORITY }
    case "priority":
      return { side: "right" }
  }
}

function jsonRoundTrip(value: object): unknown {
  return JSON.parse(JSON.stringify(value))
}

const EXPECTED_COMMAND_IDENTITY_DIGEST = "sha256:a50a8bec2817a085b4ea281e287a1e04422a304633c04c60b9e3c46f3ac42f2f"

function hasCanonicalCommandKeySequence(keys: readonly string[]): boolean {
  const canonicalKeys = [...GOLDEN_REMOTE_COMMAND_KEYS]
  return (
    keys.length === canonicalKeys.length &&
    new Set(keys).size === canonicalKeys.length &&
    keys.every((key, index) => key === canonicalKeys[index])
  )
}

function canonicalCommandIdentity(value: typeof GOLDEN_REMOTE_COMMANDS): string {
  return JSON.stringify(
    GOLDEN_REMOTE_COMMAND_KEYS.map((key) => {
      const command = value[key]
      return {
        key,
        apparatusId: command.apparatusId,
        commandId: command.commandId,
        counter: command.counter,
        controllerId: command.authority.controllerId,
        remoteId: command.remoteId,
        pressKind: command.pressKind
      }
    })
  )
}

function withoutKey(value: object, key: string): Record<string, unknown> {
  const copy = { ...value }
  Reflect.deleteProperty(copy, key)
  return copy
}

function assertDeepFrozen(value: unknown): void {
  if (typeof value !== "object" || value === null) return

  expect(Object.isFrozen(value)).toBe(true)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    expect(descriptor).toBeDefined()
    if (descriptor === undefined) continue
    expect("value" in descriptor).toBe(true)
    expect(descriptor.configurable).toBe(false)
    expect(descriptor.writable).toBe(false)
  }
  for (const nested of Object.values(value)) assertDeepFrozen(nested)
}

describe("RC-02 immutable remote-control golden fixtures", () => {
  it("pins the fixture version and deeply freezes every exported value", () => {
    expect(REMOTE_CONTROL_GOLDEN_FIXTURE_VERSION).toBe("rc-02-golden-1.0.0")
    expect(REMOTE_CONTROL_GOLDEN_FIXTURES.fixtureVersion).toBe(REMOTE_CONTROL_GOLDEN_FIXTURE_VERSION)
    expect(REMOTE_CONTROL_GOLDEN_FIXTURES.schemaVersion).toBe(REMOTE_CONTROL_SCHEMA_VERSION)
    expect(REMOTE_CONTROL_GOLDEN_FIXTURES.commandKeys).toBe(GOLDEN_REMOTE_COMMAND_KEYS)
    assertDeepFrozen(REMOTE_CONTROL_GOLDEN_FIXTURES)
    assertDeepFrozen(GOLDEN_REMOTE_COMMAND_KEYS)
    assertDeepFrozen(GOLDEN_REMOTE_COMMANDS)
    assertDeepFrozen(GOLDEN_APPLIED_EVENTS)
    assertDeepFrozen(GOLDEN_REJECTED_EVENTS)
    assertDeepFrozen(GOLDEN_EMPTY_STATE_VALUES)
    assertDeepFrozen(GOLDEN_INVALID_STATE_VALUES)
  })

  it("pins the authority descriptor values used by every fixture source", () => {
    expect(GOLDEN_HANDHELD_REFEREE_AUTHORITY).toEqual(EXPECTED_HANDHELD_REFEREE_AUTHORITY)
    expect(GOLDEN_APPLICATION_SUPERVISOR_AUTHORITY).toEqual(EXPECTED_APPLICATION_SUPERVISOR_AUTHORITY)
    expect(GOLDEN_TOURNAMENT_SUPERVISOR_AUTHORITY).toEqual(EXPECTED_TOURNAMENT_SUPERVISOR_AUTHORITY)
  })

  it("contains an explicit accepted command fixture for all 32 canonical keys", () => {
    expect(GOLDEN_REMOTE_COMMAND_KEYS).toEqual([...REMOTE_COMMAND_KEYS])
    expect(Object.keys(GOLDEN_REMOTE_COMMANDS)).toEqual([...GOLDEN_REMOTE_COMMAND_KEYS])
    expect(GOLDEN_REMOTE_COMMAND_KEYS).toHaveLength(32)

    for (const key of GOLDEN_REMOTE_COMMAND_KEYS) {
      const command = GOLDEN_REMOTE_COMMANDS[key]
      const expected = EXPECTED_COMMAND_DESCRIPTORS[key]
      const expectedAuthority =
        expected.authority === "handheld"
          ? EXPECTED_HANDHELD_REFEREE_AUTHORITY
          : EXPECTED_APPLICATION_SUPERVISOR_AUTHORITY
      expect(command.command).toBe(key)
      expect(command).toEqual({
        apparatusId: "apparatus-rc02-01",
        authority: expectedAuthority,
        command: key,
        commandId: expected.commandId,
        counter: expected.counter,
        payload: expectedCommandPayload(expected.payload),
        pressKind: expected.pressKind,
        remoteId: expected.authority === "handheld" ? "ir-remote-01" : null,
        schemaVersion: REMOTE_CONTROL_SCHEMA_VERSION
      })
      expect(isRemoteCommand(command)).toBe(true)
      expect(parseRemoteCommand(jsonRoundTrip(command))).toEqual(command)
    }
  })

  it("rejects missing, extra, duplicate, and reordered command fixture keys", () => {
    const canonicalKeys = [...GOLDEN_REMOTE_COMMAND_KEYS]
    const missing = canonicalKeys.slice(0, -1)
    const extra = [...canonicalKeys, "unknown.command"]
    const duplicate = [...canonicalKeys.slice(0, 8), canonicalKeys[7], ...canonicalKeys.slice(8)]
    const reordered = [canonicalKeys[1], canonicalKeys[0], ...canonicalKeys.slice(2)]

    expect(hasCanonicalCommandKeySequence(canonicalKeys)).toBe(true)
    for (const invalid of [missing, extra, duplicate, reordered]) {
      expect(hasCanonicalCommandKeySequence(invalid)).toBe(false)
    }

    const missingMap = { ...GOLDEN_REMOTE_COMMANDS }
    Reflect.deleteProperty(missingMap, canonicalKeys[0])
    const extraMap = { ...GOLDEN_REMOTE_COMMANDS, "unknown.command": GOLDEN_REMOTE_COMMANDS[canonicalKeys[0]] }
    const reorderedMap = Object.fromEntries(Object.entries(GOLDEN_REMOTE_COMMANDS).reverse())
    expect(hasCanonicalCommandKeySequence(Object.keys(GOLDEN_REMOTE_COMMANDS))).toBe(true)
    expect(hasCanonicalCommandKeySequence(Object.keys(missingMap))).toBe(false)
    expect(hasCanonicalCommandKeySequence(Object.keys(extraMap))).toBe(false)
    expect(hasCanonicalCommandKeySequence(Object.keys(reorderedMap))).toBe(false)
  })

  it("pins bounded command identity and a canonical digest independent of scoring code", () => {
    const canonical = canonicalCommandIdentity(GOLDEN_REMOTE_COMMANDS)
    expect(createHash("sha256").update(canonical, "utf8").digest("hex")).toBe(
      EXPECTED_COMMAND_IDENTITY_DIGEST.slice("sha256:".length)
    )

    for (const key of GOLDEN_REMOTE_COMMAND_KEYS) {
      const command = GOLDEN_REMOTE_COMMANDS[key]
      expect(command.apparatusId).toMatch(/^[a-z0-9-]{1,64}$/u)
      expect(command.commandId).toMatch(/^[a-z0-9-]{1,64}$/u)
      expect(command.authority.controllerId).toMatch(/^[a-z0-9-]{1,64}$/u)
      expect(Number.isSafeInteger(command.counter)).toBe(true)
      expect(command.counter).toBeGreaterThanOrEqual(0)
      if (command.remoteId !== null) expect(command.remoteId).toMatch(/^[a-z0-9-]{1,64}$/u)
    }
  })

  it("round-trips complete fresh, loaded, overtime, new-bout, and transfer snapshots", () => {
    const snapshots = [
      GOLDEN_SNAPSHOT,
      GOLDEN_LOADED_SNAPSHOT,
      GOLDEN_OVERTIME_SNAPSHOT,
      GOLDEN_NEW_BOUT_SNAPSHOT,
      GOLDEN_AUTHORITY_TRANSFER_SNAPSHOT
    ] as const satisfies readonly BoutWorkflowSnapshot[]

    for (const snapshot of snapshots) {
      expect(isBoutWorkflowSnapshot(snapshot)).toBe(true)
      expect(parseBoutWorkflowSnapshot(jsonRoundTrip(snapshot))).toEqual(snapshot)
    }
    expect(GOLDEN_LOADED_SNAPSHOT.sides.left.score).toBe(7)
    expect(GOLDEN_LOADED_SNAPSHOT.sides.right.score).toBe(9)
    expect(GOLDEN_LOADED_SNAPSHOT.clock.status).toBe("stopped")
    expect(GOLDEN_OVERTIME_SNAPSHOT.priority).toBe("right")
  })

  it("round-trips explicit applied and rejected event records", () => {
    expect(GOLDEN_APPLIED_EVENTS.map((event) => event.cause)).toEqual([
      "score.increment",
      "bout.snapshot.load",
      "bout.reset.result",
      "controller.authority.transfer"
    ])
    for (const event of GOLDEN_APPLIED_EVENTS) {
      expect(isBoutStateEvent(event)).toBe(true)
      expect(parseBoutStateEvent(jsonRoundTrip(event))).toEqual(event)
      expect(event.disposition).toBe("accepted")
      expect(event.resultingBoutState).not.toBeNull()
    }

    expect(GOLDEN_REJECTED_EVENTS).toHaveLength(1)
    for (const event of GOLDEN_REJECTED_EVENTS) {
      expect(isBoutStateEvent(event)).toBe(true)
      expect(parseBoutStateEvent(jsonRoundTrip(event))).toEqual(event)
      expect(event.disposition).toBe("rejected")
      expect(event.resultingBoutState).toBeNull()
    }
  })

  it("rejects empty and explicitly invalid state values", () => {
    for (const value of GOLDEN_EMPTY_STATE_VALUES) {
      expect(isBoutWorkflowSnapshot(value)).toBe(false)
      expect(() => parseBoutWorkflowSnapshot(value)).toThrow(TypeError)
    }
    for (const value of GOLDEN_INVALID_STATE_VALUES) {
      expect(isBoutWorkflowSnapshot(value)).toBe(false)
      expect(() => parseBoutWorkflowSnapshot(value)).toThrow(TypeError)
    }
  })

  it("rejects extra, missing, accessor, alias, and drifted command shapes", () => {
    const command = GOLDEN_REMOTE_COMMANDS["score.increment.left"]
    const extraField = { ...command, unexpected: true }
    const nonEnumerableExtra = { ...command }
    Object.defineProperty(nonEnumerableExtra, "unexpected", { enumerable: false, value: true })
    const symbolExtra = { ...command, [Symbol("unexpected")]: true }
    const missingCommandId = withoutKey(command, "commandId")
    const remoteIdAlias = { ...withoutKey(command, "remoteId"), remoteID: "ir-remote-01" }
    const schemaDrift = { ...command, schemaVersion: REMOTE_CONTROL_SCHEMA_VERSION + 1 }
    const mismatchedPress = { ...command, pressKind: "held" }
    const mismatchedPayload = { ...command, payload: { value: 1 } }
    const inherited = Object.create(command) as object
    let commandGetterReads = 0
    const accessor = { ...command }
    Object.defineProperty(accessor, "command", {
      enumerable: true,
      get() {
        commandGetterReads += 1
        return command.command
      }
    })

    for (const value of [
      extraField,
      nonEnumerableExtra,
      symbolExtra,
      missingCommandId,
      remoteIdAlias,
      schemaDrift,
      mismatchedPress,
      mismatchedPayload,
      inherited,
      accessor
    ])
      expect(() => parseRemoteCommand(value)).toThrow(TypeError)
    expect(commandGetterReads).toBe(0)
  })

  it("rejects nested snapshot drift without invoking accessor values", () => {
    const loadCommand = GOLDEN_REMOTE_COMMANDS["bout.snapshot.load"]
    const missingSnapshotField = withoutKey(GOLDEN_SNAPSHOT, "competitionFormatAuthority")
    const snapshotAlias = {
      ...withoutKey(GOLDEN_SNAPSHOT, "timingConfigurationRevision"),
      timing_configuration_revision: GOLDEN_SNAPSHOT.timingConfigurationRevision
    }
    const missingPayloadSnapshot = { ...loadCommand, payload: {} }
    const extraPayloadField = { ...loadCommand, payload: { snapshot: GOLDEN_LOADED_SNAPSHOT, extra: true } }
    let snapshotGetterReads = 0
    const accessorSnapshot = { ...GOLDEN_SNAPSHOT }
    Object.defineProperty(accessorSnapshot, "eventRevision", {
      enumerable: true,
      get() {
        snapshotGetterReads += 1
        return GOLDEN_SNAPSHOT.eventRevision
      }
    })

    for (const value of [
      missingSnapshotField,
      snapshotAlias,
      { ...loadCommand, payload: { snapshot: missingSnapshotField } },
      { ...loadCommand, payload: { snapshot: snapshotAlias } },
      { ...loadCommand, payload: { snapshot: accessorSnapshot } },
      missingPayloadSnapshot,
      extraPayloadField
    ]) {
      expect(() => parseBoutWorkflowSnapshot(value)).toThrow(TypeError)
    }
    expect(() => parseRemoteCommand({ ...loadCommand, payload: { snapshot: missingSnapshotField } })).toThrow(TypeError)
    expect(() => parseRemoteCommand({ ...loadCommand, payload: { snapshot: snapshotAlias } })).toThrow(TypeError)
    expect(() => parseRemoteCommand({ ...loadCommand, payload: { snapshot: accessorSnapshot } })).toThrow(TypeError)
    expect(() => parseRemoteCommand(missingPayloadSnapshot)).toThrow(TypeError)
    expect(() => parseRemoteCommand(extraPayloadField)).toThrow(TypeError)
    expect(snapshotGetterReads).toBe(0)
  })

  it("rejects event-schema drift, aliases, and provenance mismatches", () => {
    const accepted = GOLDEN_APPLIED_EVENTS[0]
    const eventExtra = { ...accepted, extra: true }
    const eventMissingCause = withoutKey(accepted, "cause")
    const eventAlias = { ...withoutKey(accepted, "eventRevision"), event_revision: accepted.eventRevision }
    const wrongCause = { ...accepted, cause: "score.decrement" }
    const wrongSourceIdentity = {
      ...accepted,
      resultingBoutState: {
        ...accepted.resultingBoutState,
        sourceCommandIdentity: {
          ...accepted.resultingBoutState.sourceCommandIdentity,
          commandId: "rc02-command-other"
        }
      }
    }
    const rejectedWithState = {
      ...GOLDEN_REJECTED_EVENTS[0],
      resultingBoutState: GOLDEN_SNAPSHOT
    }

    for (const value of [eventExtra, eventMissingCause, eventAlias, wrongCause, wrongSourceIdentity, rejectedWithState])
      expect(() => parseBoutStateEvent(value)).toThrow(TypeError)
  })

  it("keeps authority transfer ownership and snapshot-load permissions explicit", () => {
    const transfer = GOLDEN_REMOTE_COMMANDS["controller.authority.transfer"]
    const snapshotLoad = GOLDEN_REMOTE_COMMANDS["bout.snapshot.load"]
    expect(transfer.authority).toEqual(GOLDEN_APPLICATION_SUPERVISOR_AUTHORITY)
    expect(snapshotLoad.authority).toEqual(GOLDEN_APPLICATION_SUPERVISOR_AUTHORITY)
    expect(transfer.remoteId).toBeNull()
    expect(snapshotLoad.remoteId).toBeNull()
    expect(transfer.payload.nextAuthority).not.toEqual(transfer.authority)
    expect(GOLDEN_AUTHORITY_TRANSFER_SNAPSHOT.authority).toEqual(transfer.payload.nextAuthority)
  })

  it("does not accept handheld authority for application-only commands", () => {
    const snapshotLoad = GOLDEN_REMOTE_COMMANDS["bout.snapshot.load"]
    const transfer = GOLDEN_REMOTE_COMMANDS["controller.authority.transfer"]
    const handheldSnapshotLoad = {
      ...snapshotLoad,
      authority: GOLDEN_HANDHELD_REFEREE_AUTHORITY,
      remoteId: "ir-remote-01"
    }
    const handheldTransfer = {
      ...transfer,
      authority: GOLDEN_HANDHELD_REFEREE_AUTHORITY,
      remoteId: "ir-remote-01"
    }
    expect(() => parseRemoteCommand(handheldSnapshotLoad)).toThrow(TypeError)
    expect(() => parseRemoteCommand(handheldTransfer)).toThrow(TypeError)
  })
})
