import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  BOUT_WORKFLOW_COMMAND_ID_CAPACITY,
  COMPETITION_FORMAT_REGISTRY,
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

function entropyReceipt(bit: 0 | 1, sampleId: string) {
  return { bit, ownerId: "priority-entropy-owner", ownerRevision: "priority-entropy-1", sampleId }
}

function command(commandName: RemoteCommand["command"], commandId: string, payload: object = {}): RemoteCommand {
  const pressKind =
    commandName === "bout.new" ||
    commandName === "clock.configure" ||
    commandName === "passivityPenalty.award.left" ||
    commandName === "passivityPenalty.award.right" ||
    commandName === "medical.start" ||
    commandName === "format.advance" ||
    commandName === "format.retreat"
      ? "modified"
      : commandName === "clock.loadOneMinute"
        ? "double"
        : commandName === "overtime.toggle"
          ? "held"
          : "direct"
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
      competitionFormatAuthority: COMPETITION_FORMAT_REGISTRY.authority,
      eventRevision: 0,
      priority: null,
      priorityEntropyReceipt: null,
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
    const unsupported = command("modifier.opt", "modifier-unsupported")
    const rejected = reduceBoutWorkflow(initial, { command: unsupported, nextBout: null, type: "command" })
    expect(rejected).toMatchObject({ event: { cause: "command.rejected", rejectionReason: "unsupported-command" } })
    expect(rejected.state.snapshot).toEqual(initial.snapshot)
    const duplicate = reduceBoutWorkflow(rejected.state, { command: unsupported, nextBout: null, type: "command" })
    expect(duplicate).toMatchObject({ event: rejected.event, outcome: "duplicate" })
    expect(duplicate.state).toBe(rejected.state)
  })

  it("rejects an altered command that reuses a completed command identity", () => {
    const applied = reduceBoutWorkflow(state(), {
      command: command("score.increment.left", "identity-conflict"),
      nextBout: null,
      type: "command"
    })
    const conflict = reduceBoutWorkflow(applied.state, {
      command: command("score.increment.right", "identity-conflict"),
      nextBout: null,
      type: "command"
    })

    expect(conflict).toMatchObject({
      event: { cause: "command.rejected", rejectionReason: "replayed" },
      outcome: "rejected",
      reason: "replayed"
    })
    expect(conflict.state).toBe(applied.state)
    expect(conflict.state.snapshot.sides).toMatchObject({ left: { score: 1 }, right: { score: 0 } })
  })

  it("binds the complete pending new-bout action while allowing only exact retransmission", () => {
    const newBout = command("bout.new", "repeated-new-bout")
    const action = {
      command: newBout,
      nextBout: {
        boutId: "bout-next",
        clockDurationCentiseconds: 18_000,
        initialCompetition: { kind: "match", value: 1 },
        timingConfigurationRevision: "timing-01",
        weapon: "foil"
      },
      type: "command"
    } as const
    const pending = reduceBoutWorkflow(state(), action)
    const duplicate = reduceBoutWorkflow(pending.state, action)
    expect(duplicate).toMatchObject({ event: null, outcome: "pending" })
    expect(duplicate.state).toBe(pending.state)
    expect(
      reduceBoutWorkflow(pending.state, {
        ...action,
        nextBout: { ...action.nextBout, boutId: "changed-next-bout" }
      })
    ).toMatchObject({ event: { rejectionReason: "replayed" }, outcome: "rejected", reason: "replayed" })
  })

  it("binds the exact rejected action and never turns an altered retry into a duplicate", () => {
    const initial = createBoutWorkflowReducerState({
      ...state().snapshot,
      clock: { ...state().snapshot.clock, status: "running" }
    })
    const action = {
      command: command("bout.new", "rejected-new-bout"),
      nextBout: {
        boutId: "bout-next",
        clockDurationCentiseconds: 18_000,
        initialCompetition: { kind: "match", value: 1 },
        timingConfigurationRevision: "timing-01",
        weapon: "foil"
      },
      type: "command"
    } as const
    const rejected = reduceBoutWorkflow(initial, action)
    expect(rejected).toMatchObject({ event: { rejectionReason: "clock-running" }, outcome: "rejected" })
    expect(reduceBoutWorkflow(rejected.state, action)).toMatchObject({ event: rejected.event, outcome: "duplicate" })
    expect(
      reduceBoutWorkflow(rejected.state, {
        ...action,
        nextBout: { ...action.nextBout, timingConfigurationRevision: "timing-02" }
      })
    ).toMatchObject({ event: { rejectionReason: "replayed" }, outcome: "rejected", reason: "replayed" })
  })

  it("applies symmetric score operations in bout and overtime, and rejects zero-floor or break-mode changes", () => {
    const initial = state()
    const incremented = reduceBoutWorkflow(initial, {
      command: command("score.increment.left", "score-plus-left"),
      nextBout: null,
      type: "command"
    })
    expect(incremented).toMatchObject({
      event: { cause: "score.increment", eventRevision: 1 },
      outcome: "applied",
      state: { snapshot: { lastScoredSide: "left", sides: { left: { score: 1 } } } }
    })
    expect(isBoutStateEvent(incremented.event)).toBe(true)

    const decremented = reduceBoutWorkflow(incremented.state, {
      command: command("score.decrement.left", "score-minus-left"),
      nextBout: null,
      type: "command"
    })
    expect(decremented).toMatchObject({
      event: { cause: "score.decrement", eventRevision: 2 },
      state: { snapshot: { sides: { left: { score: 0 } } } }
    })
    const atFloor = reduceBoutWorkflow(decremented.state, {
      command: command("score.decrement.left", "score-floor"),
      nextBout: null,
      type: "command"
    })
    expect(atFloor).toMatchObject({ event: { rejectionReason: "out-of-bounds" }, outcome: "rejected" })
    expect(atFloor.state.snapshot).toEqual(decremented.state.snapshot)

    const overtime = createBoutWorkflowReducerState({
      ...initial.snapshot,
      clock: { ...initial.snapshot.clock, mode: "overtime", remainingDurationCentiseconds: 6_000, status: "running" },
      priority: "left",
      priorityEntropyReceipt: entropyReceipt(0, "overtime-score-priority")
    })
    expect(
      reduceBoutWorkflow(overtime, {
        command: command("score.increment.right", "overtime-score"),
        nextBout: null,
        type: "command"
      })
    ).toMatchObject({ outcome: "applied", state: { snapshot: { sides: { right: { score: 1 } } } } })
    const breakState = createBoutWorkflowReducerState({
      ...initial.snapshot,
      clock: { ...initial.snapshot.clock, mode: "break", remainingDurationCentiseconds: 6_000 }
    })
    expect(
      reduceBoutWorkflow(breakState, {
        command: command("score.increment.right", "break-score"),
        nextBout: null,
        type: "command"
      })
    ).toMatchObject({ event: { rejectionReason: "invalid-mode" } })

    const maximum = createBoutWorkflowReducerState({
      ...initial.snapshot,
      sides: {
        ...initial.snapshot.sides,
        right: { ...initial.snapshot.sides.right, score: Number.MAX_SAFE_INTEGER }
      }
    })
    const overflow = reduceBoutWorkflow(maximum, {
      command: command("score.increment.right", "score-overflow"),
      nextBout: null,
      type: "command"
    })
    expect(overflow).toMatchObject({ event: { rejectionReason: "out-of-bounds" }, outcome: "rejected" })
    expect(overflow.state.snapshot).toEqual(maximum.snapshot)
  })

  it("toggles the active clock and couples passivity only to an accepted bout-clock transition", () => {
    const initial = createBoutWorkflowReducerState({
      ...state().snapshot,
      passivity: { configuredDurationCentiseconds: 6_000, remainingDurationCentiseconds: 5_500, status: "stopped" }
    })
    const started = reduceBoutWorkflow(initial, {
      command: command("clock.toggle", "clock-start"),
      nextBout: null,
      type: "command"
    })
    expect(started).toMatchObject({
      event: { cause: "clock.start", eventRevision: 1 },
      state: { snapshot: { clock: { status: "running" }, passivity: { status: "running" } } }
    })
    const stopped = reduceBoutWorkflow(started.state, {
      command: command("clock.toggle", "clock-stop"),
      nextBout: null,
      type: "command"
    })
    expect(stopped).toMatchObject({
      event: { cause: "clock.stop", eventRevision: 2 },
      state: { snapshot: { clock: { status: "stopped" }, passivity: { status: "stopped" } } }
    })
    const breakState = createBoutWorkflowReducerState({
      ...initial.snapshot,
      clock: { ...initial.snapshot.clock, mode: "break", remainingDurationCentiseconds: 6_000 }
    })
    expect(
      reduceBoutWorkflow(breakState, {
        command: command("clock.toggle", "break-start"),
        nextBout: null,
        type: "command"
      })
    ).toMatchObject({ state: { snapshot: { clock: { status: "running" }, passivity: { status: "stopped" } } } })
    const expired = createBoutWorkflowReducerState({
      ...state().snapshot,
      clock: { ...state().snapshot.clock, remainingDurationCentiseconds: 0 }
    })
    const zeroStart = reduceBoutWorkflow(expired, {
      command: command("clock.toggle", "expired-clock-start"),
      nextBout: null,
      type: "command"
    })
    expect(zeroStart).toMatchObject({ event: { rejectionReason: "out-of-bounds" }, outcome: "rejected" })
    expect(zeroStart.state.snapshot).toEqual(expired.snapshot)
  })

  it("loads and configures a stopped clock, including the one-minute double press and all running guards", () => {
    const initial = state()
    const configured = reduceBoutWorkflow(initial, {
      command: command("clock.configure", "configure-1-23", { minutes: 1, seconds: 23 }),
      nextBout: null,
      type: "command"
    })
    expect(configured).toMatchObject({
      event: { cause: "clock.set", eventRevision: 1 },
      state: {
        snapshot: {
          clock: { configuredDurationCentiseconds: 8_300, mode: "bout", remainingDurationCentiseconds: 8_300 }
        }
      }
    })
    const oneMinute = reduceBoutWorkflow(configured.state, {
      command: command("clock.loadOneMinute", "load-one-minute"),
      nextBout: null,
      type: "command"
    })
    expect(oneMinute).toMatchObject({
      state: { snapshot: { clock: { configuredDurationCentiseconds: 6_000, remainingDurationCentiseconds: 6_000 } } }
    })
    const restored = reduceBoutWorkflow(
      createBoutWorkflowReducerState({
        ...initial.snapshot,
        clock: { ...initial.snapshot.clock, remainingDurationCentiseconds: 1_200 }
      }),
      { command: command("clock.loadConfigured", "load-configured"), nextBout: null, type: "command" }
    )
    expect(restored).toMatchObject({ state: { snapshot: { clock: { remainingDurationCentiseconds: 18_000 } } } })
    const noConfiguredTime = createBoutWorkflowReducerState({
      ...initial.snapshot,
      clock: { ...initial.snapshot.clock, configuredDurationCentiseconds: 0, remainingDurationCentiseconds: 0 }
    })
    expect(
      reduceBoutWorkflow(noConfiguredTime, {
        command: command("clock.loadConfigured", "load-missing"),
        nextBout: null,
        type: "command"
      })
    ).toMatchObject({ event: { rejectionReason: "invalid-mode" } })
    expect(
      reduceBoutWorkflow(initial, {
        command: command("clock.configure", "configure-zero", { minutes: 0, seconds: 0 }),
        nextBout: null,
        type: "command"
      })
    ).toMatchObject({ event: { rejectionReason: "out-of-bounds" } })
    const running = createBoutWorkflowReducerState({
      ...initial.snapshot,
      clock: { ...initial.snapshot.clock, status: "running" }
    })
    for (const [name, payload] of [
      ["clock.configure", { minutes: 1, seconds: 0 }],
      ["clock.loadConfigured", {}],
      ["clock.loadOneMinute", {}]
    ] as const) {
      expect(
        reduceBoutWorkflow(running, {
          command: command(name, `running-${name}`, payload),
          nextBout: null,
          type: "command"
        })
      ).toMatchObject({ event: { rejectionReason: "clock-running" } })
    }
  })

  it("adjusts a stopped bout clock by seconds normally and centiseconds only inside the final ten seconds", () => {
    const initial = state()
    const atTen = createBoutWorkflowReducerState({
      ...initial.snapshot,
      clock: { ...initial.snapshot.clock, remainingDurationCentiseconds: 1_000 }
    })
    const normal = reduceBoutWorkflow(atTen, {
      command: command("clock.adjust.positive", "at-ten-plus"),
      nextBout: null,
      type: "command"
    })
    expect(normal).toMatchObject({ state: { snapshot: { clock: { remainingDurationCentiseconds: 1_100 } } } })
    const finalTen = createBoutWorkflowReducerState({
      ...initial.snapshot,
      clock: { ...initial.snapshot.clock, remainingDurationCentiseconds: 999 }
    })
    const centisecond = reduceBoutWorkflow(finalTen, {
      command: command("clock.adjust.positive", "final-ten-plus"),
      nextBout: null,
      type: "command"
    })
    expect(centisecond).toMatchObject({
      event: { cause: "clock.adjust" },
      state: { snapshot: { clock: { remainingDurationCentiseconds: 1_000 } } }
    })
    const floor = reduceBoutWorkflow(
      createBoutWorkflowReducerState({
        ...initial.snapshot,
        clock: { ...initial.snapshot.clock, remainingDurationCentiseconds: 0 }
      }),
      { command: command("clock.adjust.negative", "time-floor"), nextBout: null, type: "command" }
    )
    expect(floor).toMatchObject({ event: { rejectionReason: "out-of-bounds" } })
    const cap = reduceBoutWorkflow(initial, {
      command: command("clock.adjust.positive", "time-cap"),
      nextBout: null,
      type: "command"
    })
    expect(cap).toMatchObject({ event: { rejectionReason: "out-of-bounds" } })
    const nonBout = createBoutWorkflowReducerState({
      ...initial.snapshot,
      clock: { ...initial.snapshot.clock, mode: "break", remainingDurationCentiseconds: 6_000 }
    })
    expect(
      reduceBoutWorkflow(nonBout, {
        command: command("clock.adjust.negative", "break-adjust"),
        nextBout: null,
        type: "command"
      })
    ).toMatchObject({ event: { rejectionReason: "invalid-mode" } })
  })

  it("fails closed without the trusted entropy issuer, then clears active overtime priority and restores the stopped bout clock", () => {
    const initial = state()
    const startAction = {
      command: command("overtime.toggle", "overtime-left"),
      nextBout: null,
      priorityEntropyReceipt: entropyReceipt(0, "priority-sample-left"),
      type: "command"
    } as const
    expect(reduceBoutWorkflow(initial, startAction)).toMatchObject({ outcome: "ignored", reason: "malformed-action" })
    expect(
      reduceBoutWorkflow(initial, {
        ...startAction,
        priorityEntropyReceipt: entropyReceipt(1, "changed-priority-sample")
      })
    ).toMatchObject({ outcome: "ignored", reason: "malformed-action" })

    const active = createBoutWorkflowReducerState({
      ...initial.snapshot,
      clock: { ...initial.snapshot.clock, mode: "overtime", remainingDurationCentiseconds: 6_000, status: "running" },
      priority: "left",
      priorityEntropyReceipt: entropyReceipt(0, "priority-sample-left")
    })
    const cleared = reduceBoutWorkflow(active, {
      command: command("overtime.toggle", "overtime-clear"),
      nextBout: null,
      type: "command"
    })
    expect(cleared).toMatchObject({
      event: { cause: "priority.clear", eventRevision: 1 },
      outcome: "applied",
      state: {
        snapshot: {
          clock: {
            configuredDurationCentiseconds: 18_000,
            mode: "bout",
            remainingDurationCentiseconds: 18_000,
            status: "stopped"
          },
          priority: null,
          priorityEntropyReceipt: null
        }
      }
    })

    const supervisorOverride = reduceBoutWorkflow(active, {
      command: command("priority.assign.supervisor", "priority-supervisor", { side: "left" }),
      nextBout: null,
      type: "command"
    })
    expect(supervisorOverride).toMatchObject({ event: { rejectionReason: "owner-unavailable" }, outcome: "rejected" })
    expect(supervisorOverride.state.snapshot).toEqual(active.snapshot)
  })

  it("rejects overtime without a valid injected entropy result or from a running, break, or medical state", () => {
    const initial = state()
    expect(
      callReduce(initial, {
        command: command("overtime.toggle", "missing-entropy"),
        nextBout: null,
        type: "command"
      })
    ).toMatchObject({ event: { rejectionReason: "owner-unavailable" }, outcome: "rejected" })
    expect(
      callReduce(initial, {
        command: command("overtime.toggle", "bad-entropy-source"),
        nextBout: null,
        priorityEntropyReceipt: {
          bit: 0,
          ownerId: "priority-entropy-owner",
          ownerRevision: "priority-entropy-1",
          sampleId: "unverified-sample"
        },
        type: "command"
      })
    ).toMatchObject({ outcome: "ignored", reason: "malformed-action", state: initial })
    expect(
      callReduce(initial, {
        command: command("overtime.toggle", "bad-entropy"),
        nextBout: null,
        priorityEntropyReceipt: {
          bit: 2,
          ownerId: "priority-entropy-owner",
          ownerRevision: "priority-entropy-1",
          sampleId: "bad-bit-sample"
        },
        type: "command"
      })
    ).toMatchObject({ outcome: "ignored", reason: "malformed-action", state: initial })
    for (const [name, source] of [
      [
        "running",
        createBoutWorkflowReducerState({ ...initial.snapshot, clock: { ...initial.snapshot.clock, status: "running" } })
      ],
      [
        "break",
        createBoutWorkflowReducerState({
          ...initial.snapshot,
          clock: { ...initial.snapshot.clock, mode: "break", remainingDurationCentiseconds: 6_000 }
        })
      ],
      [
        "medical",
        createBoutWorkflowReducerState({
          ...initial.snapshot,
          medical: { configuredDurationCentiseconds: 30_000, remainingDurationCentiseconds: 30_000, status: "running" }
        })
      ]
    ] as const) {
      const rejected = reduceBoutWorkflow(source, {
        command: command("overtime.toggle", `overtime-${name}`),
        nextBout: null,
        type: "command"
      })
      expect(rejected).toMatchObject({
        event: { rejectionReason: name === "running" ? "clock-running" : "invalid-mode" },
        outcome: "rejected"
      })
      expect(rejected.state.snapshot).toEqual(source.snapshot)
    }
  })

  it("starts the five-minute medical timer without replacing the stopped bout clock", () => {
    const initial = state()
    const started = reduceBoutWorkflow(initial, {
      command: command("medical.start", "medical-start"),
      nextBout: null,
      type: "command"
    })
    expect(started).toMatchObject({
      event: { cause: "medical.start", eventRevision: 1 },
      outcome: "applied",
      state: {
        snapshot: {
          clock: initial.snapshot.clock,
          medical: { configuredDurationCentiseconds: 30_000, remainingDurationCentiseconds: 30_000, status: "running" }
        }
      }
    })
    expect(
      reduceBoutWorkflow(started.state, {
        command: command("medical.start", "medical-duplicate-state"),
        nextBout: null,
        type: "command"
      })
    ).toMatchObject({ event: { rejectionReason: "invalid-mode" } })
    for (const [commandName, payload] of [
      ["clock.toggle", {}],
      ["clock.adjust.positive", {}],
      ["clock.loadConfigured", {}],
      ["clock.loadOneMinute", {}],
      ["clock.configure", { minutes: 3, seconds: 0 }],
      ["break.start.oneMinute", {}],
      ["overtime.toggle", {}]
    ] as const) {
      const action = {
        command: command(commandName, `medical-blocks-${commandName}`, payload),
        nextBout: null,
        type: "command"
      } as const
      const blocked = reduceBoutWorkflow(started.state, action)
      expect(blocked).toMatchObject({ event: { rejectionReason: "invalid-mode" }, outcome: "rejected" })
      expect(blocked.state.snapshot).toEqual(started.state.snapshot)
    }
    const running = createBoutWorkflowReducerState({
      ...initial.snapshot,
      clock: { ...initial.snapshot.clock, status: "running" }
    })
    expect(
      reduceBoutWorkflow(running, {
        command: command("medical.start", "medical-running"),
        nextBout: null,
        type: "command"
      })
    ).toMatchObject({ event: { rejectionReason: "clock-running" } })
  })

  it("changes only the configured typed competition value within the frozen rules-registry bounds", () => {
    const initial = state()
    const advanced = reduceBoutWorkflow(initial, {
      command: command("format.advance", "match-advance"),
      nextBout: null,
      type: "command"
    })
    expect(advanced).toMatchObject({
      event: { cause: "format.change", eventRevision: 1 },
      outcome: "applied",
      state: { snapshot: { competition: { kind: "match", value: 2 } } }
    })
    const maximum = reduceBoutWorkflow(advanced.state, {
      command: command("format.advance", "match-maximum"),
      nextBout: null,
      type: "command"
    })
    const capped = reduceBoutWorkflow(maximum.state, {
      command: command("format.advance", "match-cap"),
      nextBout: null,
      type: "command"
    })
    expect(capped).toMatchObject({ event: { rejectionReason: "out-of-bounds" } })
    const retreated = reduceBoutWorkflow(maximum.state, {
      command: command("format.retreat", "match-retreat"),
      nextBout: null,
      type: "command"
    })
    expect(retreated).toMatchObject({ state: { snapshot: { competition: { kind: "match", value: 2 } } } })

    const period = createBoutWorkflowReducerState({
      ...initial.snapshot,
      competition: { kind: "period", value: 2 }
    })
    expect(
      reduceBoutWorkflow(period, {
        command: command("format.advance", "period-advance"),
        nextBout: null,
        type: "command"
      })
    ).toMatchObject({ state: { snapshot: { competition: { kind: "period", value: 3 } } } })

    const running = createBoutWorkflowReducerState({
      ...initial.snapshot,
      clock: { ...initial.snapshot.clock, status: "running" }
    })
    expect(
      reduceBoutWorkflow(running, {
        command: command("format.advance", "format-running"),
        nextBout: null,
        type: "command"
      })
    ).toMatchObject({ event: { rejectionReason: "clock-running" } })
    expect(() =>
      createBoutWorkflowReducerState({
        ...initial.snapshot,
        competitionFormatAuthority: {
          ...COMPETITION_FORMAT_REGISTRY.authority,
          registryRevision: "unapproved-revision"
        }
      })
    ).toThrow(TypeError)

    const staleRegistrySnapshot = {
      ...initial.snapshot,
      competitionFormatAuthority: {
        ...COMPETITION_FORMAT_REGISTRY.authority,
        registryDigest: "sha256:stale-registry"
      },
      eventRevision: initial.snapshot.eventRevision + 1
    }
    const staleRegistryLoad = reduceBoutWorkflow(initial, {
      command: command("bout.snapshot.load", "load-stale-format-registry", { snapshot: staleRegistrySnapshot }),
      nextBout: null,
      type: "command"
    })
    expect(staleRegistryLoad).toMatchObject({ event: { rejectionReason: "owner-unavailable" }, outcome: "rejected" })
    expect(staleRegistryLoad.state.snapshot).toEqual(initial.snapshot)

    const forgedOvertimeLoad = reduceBoutWorkflow(initial, {
      command: command("bout.snapshot.load", "load-forged-overtime-receipt", {
        snapshot: {
          ...initial.snapshot,
          clock: {
            ...initial.snapshot.clock,
            mode: "overtime",
            remainingDurationCentiseconds: 6_000,
            status: "running"
          },
          eventRevision: initial.snapshot.eventRevision + 1,
          priority: "left",
          priorityEntropyReceipt: entropyReceipt(0, "forged-external-receipt")
        }
      }),
      nextBout: null,
      type: "command"
    })
    expect(forgedOvertimeLoad).toMatchObject({ event: { rejectionReason: "owner-unavailable" }, outcome: "rejected" })
    expect(forgedOvertimeLoad.state.snapshot).toEqual(initial.snapshot)
  })

  it("binds executable registry bytes and rejects out-of-bounds competition at every bout boundary", () => {
    const registryBytes = readFileSync(new URL("../docs/competition-format-rules-registry.json", import.meta.url))
    const parsedRegistry = JSON.parse(registryBytes.toString()) as {
      formats: typeof COMPETITION_FORMAT_REGISTRY.bounds
      ownerId: string
      registryId: string
      registryRevision: string
    }
    expect(`sha256:${createHash("sha256").update(registryBytes).digest("hex")}`).toBe(
      COMPETITION_FORMAT_REGISTRY.authority.registryDigest
    )
    expect(parsedRegistry).toEqual({
      formats: COMPETITION_FORMAT_REGISTRY.bounds,
      ownerId: COMPETITION_FORMAT_REGISTRY.authority.ownerId,
      registryId: COMPETITION_FORMAT_REGISTRY.authority.registryId,
      registryRevision: COMPETITION_FORMAT_REGISTRY.authority.registryRevision
    })

    const initial = state()
    expect(() =>
      createFreshBoutWorkflowSnapshot({
        apparatusId: "apparatus-01",
        authority,
        boutId: "out-of-bounds-fresh",
        clockDurationCentiseconds: 18_000,
        initialCompetition: { kind: "match", value: 4 },
        sourceCommandIdentity: initial.snapshot.sourceCommandIdentity,
        timingConfigurationRevision: "timing-01",
        weapon: "foil"
      })
    ).toThrow(TypeError)
    expect(() =>
      createBoutWorkflowReducerState({ ...initial.snapshot, competition: { kind: "period", value: 0 } })
    ).toThrow(TypeError)
    expect(
      reduceBoutWorkflow(initial, {
        command: command("bout.new", "out-of-bounds-new-bout"),
        nextBout: {
          boutId: "bout-02",
          clockDurationCentiseconds: 18_000,
          initialCompetition: { kind: "match", value: 4 },
          timingConfigurationRevision: "timing-02",
          weapon: "foil"
        },
        type: "command"
      })
    ).toMatchObject({ outcome: "ignored", reason: "malformed-action" })
  })

  it("starts exactly one running minute break only from a stopped bout clock and deduplicates its command identity", () => {
    const initial = state()
    const action = {
      command: command("break.start.oneMinute", "break-one-minute"),
      nextBout: null,
      type: "command"
    } as const
    const started = reduceBoutWorkflow(initial, action)
    expect(started).toMatchObject({
      event: { cause: "break.start", eventRevision: 1 },
      outcome: "applied",
      state: {
        snapshot: {
          clock: {
            configuredDurationCentiseconds: 18_000,
            mode: "break",
            remainingDurationCentiseconds: 6_000,
            status: "running"
          }
        }
      }
    })
    const duplicate = reduceBoutWorkflow(started.state, action)
    expect(duplicate).toMatchObject({ event: started.event, outcome: "duplicate" })
    expect(duplicate.state).toBe(started.state)
    const stoppedBreak = reduceBoutWorkflow(started.state, {
      command: command("clock.toggle", "stop-break"),
      nextBout: null,
      type: "command"
    })
    const restoredBout = reduceBoutWorkflow(stoppedBreak.state, {
      command: command("clock.loadConfigured", "restore-bout-duration"),
      nextBout: null,
      type: "command"
    })
    expect(restoredBout).toMatchObject({
      state: {
        snapshot: {
          clock: {
            configuredDurationCentiseconds: 18_000,
            mode: "bout",
            remainingDurationCentiseconds: 18_000,
            status: "stopped"
          }
        }
      }
    })
    const running = createBoutWorkflowReducerState({
      ...initial.snapshot,
      clock: { ...initial.snapshot.clock, status: "running" }
    })
    expect(reduceBoutWorkflow(running, action)).toMatchObject({ event: { rejectionReason: "clock-running" } })
    const otherMode = createBoutWorkflowReducerState({
      ...initial.snapshot,
      clock: { ...initial.snapshot.clock, mode: "overtime", remainingDurationCentiseconds: 6_000, status: "running" },
      priority: "left",
      priorityEntropyReceipt: entropyReceipt(0, "break-guard-priority")
    })
    expect(reduceBoutWorkflow(otherMode, action)).toMatchObject({ event: { rejectionReason: "invalid-mode" } })
  })

  it("awards yellow then cumulative red cards and atomically scores the opponent", () => {
    for (const [awarded, opponent] of [
      ["left", "right"],
      ["right", "left"]
    ] as const) {
      const initial = state()
      const yellow = reduceBoutWorkflow(initial, {
        command: command(`penalty.award.${awarded}`, `yellow-${awarded}`),
        nextBout: null,
        type: "command"
      })
      expect(yellow).toMatchObject({
        event: { cause: "penalty.award", eventRevision: 1 },
        outcome: "applied",
        state: { snapshot: { sides: { [awarded]: { redCardCount: 0, yellowCard: true } } } }
      })

      const red = reduceBoutWorkflow(yellow.state, {
        command: command(`penalty.award.${awarded}`, `red-${awarded}`),
        nextBout: null,
        type: "command"
      })
      expect(red).toMatchObject({
        event: { cause: "penalty.award", eventRevision: 2 },
        outcome: "applied",
        state: {
          snapshot: {
            lastScoredSide: opponent,
            sides: { [awarded]: { redCardCount: 1, yellowCard: true }, [opponent]: { score: 1 } }
          }
        }
      })
      expect(isBoutStateEvent(red.event)).toBe(true)

      const anotherRed = reduceBoutWorkflow(red.state, {
        command: command(`penalty.award.${awarded}`, `red-again-${awarded}`),
        nextBout: null,
        type: "command"
      })
      expect(anotherRed).toMatchObject({
        outcome: "applied",
        state: { snapshot: { sides: { [awarded]: { redCardCount: 2 }, [opponent]: { score: 2 } } } }
      })
    }
  })

  it("rejects an overflowing red award without partially changing either side", () => {
    const initial = state()
    const blocked = createBoutWorkflowReducerState({
      ...initial.snapshot,
      sides: {
        ...initial.snapshot.sides,
        left: { ...initial.snapshot.sides.left, redCardCount: Number.MAX_SAFE_INTEGER, yellowCard: true },
        right: { ...initial.snapshot.sides.right, score: Number.MAX_SAFE_INTEGER }
      }
    })
    const rejected = reduceBoutWorkflow(blocked, {
      command: command("penalty.award.left", "red-overflow"),
      nextBout: null,
      type: "command"
    })
    expect(rejected).toMatchObject({ event: { cause: "command.rejected", rejectionReason: "out-of-bounds" } })
    expect(rejected.state.snapshot).toEqual(blocked.snapshot)
  })

  it("fails closed on every P-card command until a source-backed rule table has an available owner", () => {
    for (const side of ["left", "right"] as const) {
      const initial = state()
      const rejected = reduceBoutWorkflow(initial, {
        command: command(`passivityPenalty.award.${side}`, `p-gated-${side}`),
        nextBout: null,
        type: "command"
      })
      expect(rejected).toMatchObject({ event: { cause: "command.rejected", rejectionReason: "owner-unavailable" } })
      expect(rejected.state.snapshot).toEqual(initial.snapshot)
    }
  })

  it("allows card awards while the active clock is running, rejects them during a break, and deduplicates them", () => {
    const initial = state()
    const running = createBoutWorkflowReducerState({
      ...initial.snapshot,
      clock: { ...initial.snapshot.clock, status: "running" }
    })
    const action = {
      command: command("penalty.award.left", "running-yellow"),
      nextBout: null,
      type: "command"
    } as const
    const applied = reduceBoutWorkflow(running, action)
    expect(applied).toMatchObject({
      outcome: "applied",
      state: { snapshot: { sides: { left: { yellowCard: true } } } }
    })
    expect(reduceBoutWorkflow(applied.state, action)).toMatchObject({ event: applied.event, outcome: "duplicate" })

    const breakState = createBoutWorkflowReducerState({
      ...initial.snapshot,
      clock: { ...initial.snapshot.clock, mode: "break", remainingDurationCentiseconds: 6_000, status: "running" }
    })
    expect(
      reduceBoutWorkflow(breakState, {
        command: command("penalty.award.left", "break-penalty.award.left"),
        nextBout: null,
        type: "command"
      })
    ).toMatchObject({ event: { cause: "command.rejected", rejectionReason: "invalid-mode" } })
    expect(
      reduceBoutWorkflow(breakState, {
        command: command("passivityPenalty.award.left", "break-passivityPenalty.award.left"),
        nextBout: null,
        type: "command"
      })
    ).toMatchObject({ event: { cause: "command.rejected", rejectionReason: "owner-unavailable" } })
  })

  it("resets only penalty and P-card presentation, leaving every bout value and card-caused score intact", () => {
    const current = state().snapshot
    const initial = createBoutWorkflowReducerState({
      ...current,
      clock: { ...current.clock, mode: "overtime", remainingDurationCentiseconds: 6_000, status: "running" },
      priority: "left",
      priorityEntropyReceipt: entropyReceipt(0, "cards-reset-priority"),
      sides: {
        left: { pCard: "red", redCardCount: 2, score: 7, yellowCard: true },
        right: { pCard: "yellow", redCardCount: 1, score: 9, yellowCard: true }
      }
    })
    const reset = reduceBoutWorkflow(initial, {
      command: command("cards.reset", "cards-reset"),
      nextBout: null,
      type: "command"
    })
    expect(reset).toMatchObject({
      event: { cause: "cards.reset", eventRevision: 1 },
      outcome: "applied",
      state: {
        snapshot: {
          boutId: "bout-01",
          clock: initial.snapshot.clock,
          priority: "left",
          sides: {
            left: { pCard: "none", redCardCount: 0, score: 7, yellowCard: false },
            right: { pCard: "none", redCardCount: 0, score: 9, yellowCard: false }
          }
        }
      }
    })
  })

  it("retains command identities beyond the event cache and fails closed at the explicit ledger capacity", () => {
    let current = state()
    const first = {
      command: command("score.increment.left", "retained-command-0"),
      nextBout: null,
      type: "command"
    } as const
    current = reduceBoutWorkflow(current, first).state
    for (let index = 1; index <= 256; index += 1) {
      const applied = reduceBoutWorkflow(current, {
        command: command("score.increment.left", `retained-command-${index}`),
        nextBout: null,
        type: "command"
      })
      expect(applied.outcome).toBe("applied")
      current = applied.state
    }
    expect(current.completedEvents).toHaveLength(256)
    expect(current.completedCommandIds).toHaveLength(257)
    expect(current.completedEvents.some((event) => event.eventId === first.command.commandId)).toBe(false)

    const oldDuplicate = reduceBoutWorkflow(current, first)
    expect(oldDuplicate).toMatchObject({ event: null, outcome: "duplicate", reason: null })
    expect(oldDuplicate.state).toBe(current)
    expect(oldDuplicate.state.snapshot.sides.left.score).toBe(257)

    const atCapacity: BoutWorkflowReducerState = Object.freeze({
      ...state(),
      completedCommandIds: Object.freeze(
        Array.from({ length: BOUT_WORKFLOW_COMMAND_ID_CAPACITY }, (_, index) => `completed-${index}`)
      ),
      completedActions: Object.freeze(
        Array.from(
          { length: BOUT_WORKFLOW_COMMAND_ID_CAPACITY },
          (_, index) =>
            ({
              command: command("score.increment.left", `completed-${index}`),
              nextBout: null,
              type: "command"
            }) as const
        )
      )
    })
    const rejected = reduceBoutWorkflow(atCapacity, {
      command: command("score.increment.left", "over-capacity"),
      nextBout: null,
      type: "command"
    })
    expect(rejected).toMatchObject({
      event: { rejectionReason: "event-capacity-exhausted" },
      outcome: "rejected",
      reason: "event-capacity-exhausted"
    })
    expect(rejected.state).toBe(atCapacity)
    expect(rejected.state.snapshot.sides.left.score).toBe(0)
    expect(isBoutStateEvent(rejected.event)).toBe(true)

    const duplicateAtCapacity = reduceBoutWorkflow(atCapacity, {
      command: command("score.increment.left", "completed-0"),
      nextBout: null,
      type: "command"
    })
    expect(duplicateAtCapacity).toMatchObject({ event: null, outcome: "duplicate", reason: null })
    expect(duplicateAtCapacity.state).toBe(atCapacity)
  })

  it("rejects wrong apparatus or authority, running-clock destructive operations, and stale snapshots", () => {
    const initial = state()
    const differentApp = createBoutWorkflowReducerState({
      ...initial.snapshot,
      apparatusId: "another-apparatus",
      sourceCommandIdentity: { ...initial.snapshot.sourceCommandIdentity, apparatusId: "another-apparatus" }
    })
    const wrongApp = reduceBoutWorkflow(initial, {
      command: command("modifier.opt", "wrong-app"),
      nextBout: null,
      type: "command"
    })
    expect(
      reduceBoutWorkflow(differentApp, {
        command: command("modifier.opt", "wrong-app"),
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
      command: command("modifier.opt", "wrong-authority"),
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
