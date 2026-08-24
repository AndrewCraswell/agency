import { describe, expect, it } from "vitest"
import {
  createBoutWorkflowReducerState,
  createFreshBoutWorkflowSnapshot,
  parseStm32BoutResetResult,
  reduceBoutWorkflow,
  type BoutWorkflowReduction,
  type BoutWorkflowReducerState
} from "./bout-workflow-reducer.js"
import { isBoutStateEvent, parseRemoteCommand, type ControllerAuthority, type RemoteCommand } from "./remote-control.js"

const authority: ControllerAuthority = {
  authorityRevision: 4,
  controllerId: "console-supervisor",
  kind: "local-application",
  permission: "supervisor"
}

function state(): BoutWorkflowReducerState {
  return createBoutWorkflowReducerState(
    createFreshBoutWorkflowSnapshot({
      apparatusId: "apparatus-01",
      authority,
      boutId: "bout-01",
      clockDurationCentiseconds: 18_000,
      initialCompetition: { kind: "match", value: 1 },
      sourceCommandIdentity: {
        apparatusId: "apparatus-01",
        commandId: "boot-01",
        controllerId: "console-supervisor",
        counter: 0,
        remoteId: null
      },
      timingConfigurationRevision: "timing-01",
      weapon: "foil"
    })
  )
}

function command(commandName: RemoteCommand["command"], commandId: string, payload: object = {}): RemoteCommand {
  const pressKind = commandName === "bout.new" ? "modified" : "direct"
  return parseRemoteCommand({
    apparatusId: "apparatus-01",
    authority,
    command: commandName,
    commandId,
    counter: 10,
    payload,
    pressKind,
    remoteId: null,
    schemaVersion: 1
  })
}

function callReduce(stateValue: BoutWorkflowReducerState, action: unknown): BoutWorkflowReduction {
  return Reflect.apply(reduceBoutWorkflow, undefined, [stateValue, action])
}

describe("RC-05 bout workflow reducer", () => {
  it("creates a complete fresh, stopped bout without implicit timer or score values", () => {
    const snapshot = state().snapshot
    expect(snapshot).toMatchObject({
      autoRearm: "manual",
      boutId: "bout-01",
      boutRevision: 0,
      clock: { configuredDurationCentiseconds: 18_000, remainingDurationCentiseconds: 18_000, status: "stopped" },
      eventRevision: 0,
      priority: null,
      sides: {
        left: { pCard: "none", redCardCount: 0, score: 0, yellowCard: false },
        right: { pCard: "none", redCardCount: 0, score: 0, yellowCard: false }
      }
    })
    expect(Object.isFrozen(snapshot)).toBe(true)
  })

  it("holds new bout unchanged until STM32 accepts, then atomically creates its fresh successor", () => {
    const initial = state()
    const requested = reduceBoutWorkflow(initial, {
      command: command("bout.new", "new-bout-01"),
      nextBout: {
        boutId: "bout-02",
        clockDurationCentiseconds: 12_000,
        initialCompetition: { kind: "period", value: 1 },
        timingConfigurationRevision: "timing-02",
        weapon: "epee"
      },
      type: "command"
    })
    expect(requested).toMatchObject({ event: null, outcome: "pending" })
    expect(requested.state.snapshot).toEqual(initial.snapshot)

    const applied = reduceBoutWorkflow(requested.state, {
      authority: "stm32-scoring",
      requestId: "new-bout-01",
      result: "accepted",
      stm32RecordId: "stm32-reset-01",
      type: "stm32-bout-reset-result"
    })
    expect(applied).toMatchObject({
      event: {
        cause: "bout.reset.result",
        disposition: "accepted",
        eventRevision: 1,
        stm32RecordId: "stm32-reset-01"
      },
      outcome: "applied",
      state: {
        pendingNewBout: null,
        snapshot: {
          boutId: "bout-02",
          boutRevision: 1,
          clock: { configuredDurationCentiseconds: 12_000, remainingDurationCentiseconds: 12_000, status: "stopped" },
          eventRevision: 1,
          weapon: "epee"
        }
      }
    })
    expect(isBoutStateEvent(applied.event)).toBe(true)
  })

  it("rejects STM32 reset refusal without changing the current snapshot", () => {
    const pending = reduceBoutWorkflow(state(), {
      command: command("bout.new", "new-bout-rejected"),
      nextBout: {
        boutId: "bout-next",
        clockDurationCentiseconds: 18_000,
        initialCompetition: { kind: "match", value: 1 },
        timingConfigurationRevision: "timing-01",
        weapon: "foil"
      },
      type: "command"
    })
    const refused = reduceBoutWorkflow(pending.state, {
      authority: "stm32-scoring",
      requestId: "new-bout-rejected",
      result: "rejected",
      stm32RecordId: null,
      type: "stm32-bout-reset-result"
    })
    expect(refused).toMatchObject({ event: { disposition: "rejected", rejectionReason: "stm32-rejection" } })
    expect(refused.state.snapshot).toEqual(pending.state.snapshot)
  })

  it("strictly loads a complete compatible snapshot and rewrites only its command correlation", () => {
    const current = state()
    const loaded = createFreshBoutWorkflowSnapshot({
      apparatusId: "apparatus-01",
      authority,
      boutId: "bout-from-snapshot",
      boutRevision: 2,
      clockDurationCentiseconds: 20_000,
      eventRevision: 8,
      initialCompetition: { kind: "period", value: 3 },
      sourceCommandIdentity: {
        apparatusId: "apparatus-01",
        commandId: "saved-state",
        controllerId: "console-supervisor",
        counter: 6,
        remoteId: null
      },
      timingConfigurationRevision: "timing-saved",
      weapon: "sabre"
    })
    const applied = reduceBoutWorkflow(current, {
      command: command("bout.snapshot.load", "load-01", { snapshot: loaded }),
      nextBout: null,
      type: "command"
    })
    expect(applied).toMatchObject({
      event: { cause: "bout.snapshot.load", disposition: "accepted", eventRevision: 8 },
      outcome: "applied",
      state: {
        snapshot: { boutId: "bout-from-snapshot", eventRevision: 8, sourceCommandIdentity: { commandId: "load-01" } }
      }
    })
    expect(isBoutStateEvent(applied.event)).toBe(true)
  })

  it("does not load an older authority revision or revive different ownership at the current revision", () => {
    const initial = state()
    const saved = createFreshBoutWorkflowSnapshot({
      apparatusId: "apparatus-01",
      authority: { ...authority, authorityRevision: 3 },
      boutId: "stale-authority-bout",
      boutRevision: 2,
      clockDurationCentiseconds: 18_000,
      eventRevision: 8,
      initialCompetition: { kind: "match", value: 1 },
      sourceCommandIdentity: {
        apparatusId: "apparatus-01",
        commandId: "saved-stale-authority",
        controllerId: "old-console",
        counter: 5,
        remoteId: null
      },
      timingConfigurationRevision: "timing-saved",
      weapon: "foil"
    })
    const older = reduceBoutWorkflow(initial, {
      command: command("bout.snapshot.load", "load-old-authority", { snapshot: saved }),
      nextBout: null,
      type: "command"
    })
    expect(older).toMatchObject({ event: { rejectionReason: "incompatible-snapshot-revision" } })
    expect(older.state.snapshot).toEqual(initial.snapshot)

    const revivedOwner = {
      ...saved,
      authority: { ...authority, authorityRevision: 4, controllerId: "retired-console" }
    }
    const sameRevision = reduceBoutWorkflow(initial, {
      command: command("bout.snapshot.load", "load-retired-owner", { snapshot: revivedOwner }),
      nextBout: null,
      type: "command"
    })
    expect(sameRevision).toMatchObject({ event: { rejectionReason: "incompatible-snapshot-revision" } })
    expect(sameRevision.state.snapshot).toEqual(initial.snapshot)
  })

  it("strictly parses STM32 bout-reset results and fails closed for malformed or uncorrelated replies", () => {
    const pending = reduceBoutWorkflow(state(), {
      command: command("bout.new", "strict-reset"),
      nextBout: {
        boutId: "strict-next",
        clockDurationCentiseconds: 18_000,
        initialCompetition: { kind: "match", value: 1 },
        timingConfigurationRevision: "timing-01",
        weapon: "foil"
      },
      type: "command"
    })
    const valid = {
      authority: "stm32-scoring",
      requestId: "strict-reset",
      result: "accepted",
      stm32RecordId: "stm32-strict-reset",
      type: "stm32-bout-reset-result"
    }
    expect(parseStm32BoutResetResult(valid)).toEqual(valid)

    const inherited = Object.create(valid)
    const accessor = { ...valid }
    Object.defineProperty(accessor, "result", {
      enumerable: true,
      get: () => {
        throw new Error("must not read")
      }
    })
    const nonEnumerable = { ...valid }
    Object.defineProperty(nonEnumerable, "result", { enumerable: false, value: "accepted" })
    const malformed: readonly unknown[] = [
      null,
      { ...valid, authority: "application" },
      { ...valid, type: "scoring-reset-result" },
      { ...valid, result: "maybe" },
      { ...valid, requestId: "" },
      { ...valid, requestId: "r".repeat(97) },
      { ...valid, stm32RecordId: null },
      { ...valid, stm32RecordId: "r".repeat(97) },
      { ...valid, extra: true },
      { authority: "stm32-scoring", requestId: "strict-reset", result: "accepted", type: "stm32-bout-reset-result" },
      {
        authority: "stm32-scoring",
        requestId: "strict-reset",
        result: "rejected",
        stm32RecordId: "must-be-null",
        type: "stm32-bout-reset-result"
      },
      inherited,
      accessor,
      nonEnumerable
    ]
    for (const response of malformed) {
      expect(() => parseStm32BoutResetResult(response)).toThrow(TypeError)
      const ignored = callReduce(pending.state, response)
      expect(ignored).toMatchObject({ event: null, outcome: "ignored", reason: "malformed-action" })
      expect(ignored.state).toBe(pending.state)
    }

    const unknown = callReduce(pending.state, { ...valid, requestId: "another-request" })
    expect(unknown).toMatchObject({ event: null, outcome: "ignored", reason: "unknown-stm32-request" })
    expect(unknown.state).toBe(pending.state)
  })

  it("is idempotent for a completed command and never alters state for rejected commands", () => {
    const initial = state()
    const unsupported = command("clock.toggle", "toggle-unsupported")
    const rejected = reduceBoutWorkflow(initial, { command: unsupported, nextBout: null, type: "command" })
    expect(rejected).toMatchObject({ event: { cause: "command.rejected", rejectionReason: "unsupported-command" } })
    expect(rejected.state.snapshot).toEqual(initial.snapshot)
    const duplicate = reduceBoutWorkflow(rejected.state, { command: unsupported, nextBout: null, type: "command" })
    expect(duplicate).toMatchObject({ event: rejected.event, outcome: "duplicate" })
    expect(duplicate.state).toBe(rejected.state)
  })

  it("does not turn a retransmitted pending new-bout command into a second request or a rejection", () => {
    const newBout = command("bout.new", "repeated-new-bout")
    const pending = reduceBoutWorkflow(state(), {
      command: newBout,
      nextBout: {
        boutId: "bout-next",
        clockDurationCentiseconds: 18_000,
        initialCompetition: { kind: "match", value: 1 },
        timingConfigurationRevision: "timing-01",
        weapon: "foil"
      },
      type: "command"
    })
    const duplicate = reduceBoutWorkflow(pending.state, { command: newBout, nextBout: null, type: "command" })
    expect(duplicate).toMatchObject({ event: null, outcome: "pending" })
    expect(duplicate.state).toBe(pending.state)
  })

  it("rejects wrong apparatus or authority, running-clock destructive operations, and stale snapshots", () => {
    const initial = state()
    const differentApp = createBoutWorkflowReducerState({
      ...initial.snapshot,
      apparatusId: "another-apparatus",
      sourceCommandIdentity: { ...initial.snapshot.sourceCommandIdentity, apparatusId: "another-apparatus" }
    })
    const wrongApp = reduceBoutWorkflow(initial, {
      command: command("clock.toggle", "wrong-app"),
      nextBout: null,
      type: "command"
    })
    expect(
      reduceBoutWorkflow(differentApp, {
        command: command("clock.toggle", "wrong-app"),
        nextBout: null,
        type: "command"
      })
    ).toMatchObject({
      event: { rejectionReason: "wrong-apparatus" }
    })
    expect(wrongApp).toMatchObject({ event: { rejectionReason: "unsupported-command" } })
    const differentAuthority = createBoutWorkflowReducerState({
      ...initial.snapshot,
      authority: { ...authority, authorityRevision: 3 }
    })
    const wrongAuthority = reduceBoutWorkflow(differentAuthority, {
      command: command("clock.toggle", "wrong-authority"),
      nextBout: null,
      type: "command"
    })
    expect(wrongAuthority).toMatchObject({ event: { rejectionReason: "wrong-controller-authority" } })
    const running = createBoutWorkflowReducerState({
      ...initial.snapshot,
      clock: { ...initial.snapshot.clock, status: "running" }
    })
    expect(
      reduceBoutWorkflow(running, { command: command("bout.new", "running-new"), nextBout: null, type: "command" })
    ).toMatchObject({ event: { rejectionReason: "clock-running" } })
    const stale = reduceBoutWorkflow(initial, {
      command: command("bout.snapshot.load", "stale-load", { snapshot: initial.snapshot }),
      nextBout: null,
      type: "command"
    })
    expect(stale).toMatchObject({ event: { rejectionReason: "incompatible-snapshot-revision" } })
  })
})
