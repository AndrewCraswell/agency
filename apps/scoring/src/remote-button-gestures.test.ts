import { describe, expect, it } from "vitest"
import {
  DEFAULT_REMOTE_GESTURE_TIMINGS,
  INITIAL_REMOTE_GESTURE_STATE,
  REMOTE_BUTTONS,
  reduceRemoteButtonSignal,
  reduceRemoteButtonSignals,
  type RemoteButton,
  type RemoteGestureState,
  type RemoteButtonSignal
} from "./remote-button-gestures.js"

function signal(kind: "down" | "up", button: string, atUs: number) {
  return { atUs, button, kind } as const
}

function tap(button: RemoteButton, atUs = 10_000) {
  return [signal("down", button, atUs), signal("up", button, atUs + 1_000)]
}

function commands(signals: readonly RemoteButtonSignal[]) {
  return reduceRemoteButtonSignals(signals).intents.filter((intent) => intent.kind === "command")
}

describe("remote button gesture interpreter", () => {
  it("maps every direct face control to exactly one canonical command", () => {
    const expected = {
      back: "workflow.undo",
      leftCard: "penalty.award.left",
      loadTime: "clock.loadConfigured",
      minusTime: "clock.adjust.negative",
      pauseOneMinute: "break.start.oneMinute",
      plusTime: "clock.adjust.positive",
      rearm: "scoring.rearm",
      resetCards: "cards.reset",
      rightCard: "penalty.award.right",
      scoreDecrementLeft: "score.decrement.left",
      scoreDecrementRight: "score.decrement.right",
      scoreIncrementLeft: "score.increment.left",
      scoreIncrementRight: "score.increment.right",
      startStop: "clock.toggle"
    } as const
    for (const [button, command] of Object.entries(expected)) {
      const result = reduceRemoteButtonSignals(tap(button as RemoteButton))
      if (button === "loadTime") continue
      expect(result.intents).toEqual([{ command, kind: "command", payload: {}, pressKind: "direct" }])
    }
  })

  it("maps every supported OPT chord without emitting standalone OPT", () => {
    const expected = {
      back: ["sides.swap", "modified"],
      leftCard: ["passivityPenalty.award.left", "modified"],
      minusTime: ["format.retreat", "modified"],
      pauseOneMinute: ["medical.start", "modified"],
      plusTime: ["format.advance", "modified"],
      rearm: ["scoring.autoRearm.advance", "modified"],
      resetCards: ["bout.new", "modified"],
      rightCard: ["passivityPenalty.award.right", "modified"]
    } as const
    for (const [button, [command, pressKind]] of Object.entries(expected)) {
      const result = reduceRemoteButtonSignals([
        signal("down", "opt", 10_000),
        signal("down", button, 20_000),
        signal("up", button, 21_000),
        signal("up", "opt", 22_000)
      ])
      expect(result.intents).toEqual([{ command, kind: "command", payload: {}, pressKind }])
      expect(
        result.intents.some((intent) => intent.kind === "command" && intent.command === "weapon.showOrAdvance")
      ).toBe(false)
    }
    const config = reduceRemoteButtonSignals([
      signal("down", "opt", 10),
      signal("down", "loadTime", 20),
      signal("up", "loadTime", 21),
      signal("up", "opt", 22)
    ])
    expect(config.intents).toEqual([
      {
        command: "clock.configure",
        complete: false,
        digits: "",
        kind: "payload-entry",
        minutes: null,
        pressKind: "modified",
        seconds: null
      }
    ])
  })

  it("emits standalone OPT weapon selection once per press, including repeated selection presses", () => {
    const result = reduceRemoteButtonSignals([...tap("opt", 10_000), ...tap("opt", 100_000), ...tap("opt", 200_000)])
    expect(result.intents).toHaveLength(3)
    expect(
      result.intents.every((intent) => intent.kind === "command" && intent.command === "weapon.showOrAdvance")
    ).toBe(true)
  })

  it("consumes OPT after its hold action so a later chord cannot emit a modified command", () => {
    const result = reduceRemoteButtonSignals([
      signal("down", "opt", 10_000),
      { atUs: 760_000, kind: "advance-time" as const },
      signal("down", "loadTime", 800_000),
      signal("up", "loadTime", 801_000),
      signal("up", "opt", 802_000)
    ])
    expect(result.intents).toEqual([
      { action: "open-configuration", kind: "local" },
      { kind: "ignored", reason: "modifier-consumed" }
    ])
    expect(result.intents.some((intent) => intent.kind === "command")).toBe(false)
  })

  it("emits held actions once at the explicit threshold and never repeats", () => {
    const signals = [
      signal("down", "pauseOneMinute", 10_000),
      { atUs: 759_000, kind: "advance-time" as const },
      { atUs: 760_000, kind: "advance-time" as const },
      { atUs: 2_000_000, kind: "advance-time" as const },
      signal("up", "pauseOneMinute", 2_001_000)
    ]
    const result = reduceRemoteButtonSignals(signals)
    expect(result.intents).toEqual([{ command: "overtime.toggle", kind: "command", payload: {}, pressKind: "held" }])
  })

  it("recognizes held action at release when no time sample crossed the threshold", () => {
    expect(commands([signal("down", "resetCards", 10_000), signal("up", "resetCards", 800_000)])).toEqual([
      { command: "device.sleep.request", kind: "command", payload: {}, pressKind: "held" }
    ])
  })

  it("distinguishes double Load Time from a delayed single press with an explicit time advance", () => {
    const double = commands([
      signal("down", "loadTime", 10_000),
      signal("up", "loadTime", 20_000),
      signal("down", "loadTime", 100_000),
      signal("up", "loadTime", 110_000)
    ])
    expect(double).toEqual([{ command: "clock.loadOneMinute", kind: "command", payload: {}, pressKind: "double" }])
    const single = commands([
      signal("down", "loadTime", 10_000),
      signal("up", "loadTime", 20_000),
      { atUs: 371_000, kind: "advance-time" as const }
    ])
    expect(single).toEqual([{ command: "clock.loadConfigured", kind: "command", payload: {}, pressKind: "direct" }])
  })

  it("keeps one-microsecond ordering at gesture boundaries", () => {
    const result = commands([
      signal("down", "loadTime", 10_000),
      signal("up", "loadTime", 20_000),
      { atUs: 370_001, kind: "advance-time" as const }
    ])
    expect(result).toEqual([{ command: "clock.loadConfigured", kind: "command", payload: {}, pressKind: "direct" }])
  })

  it("accepts digits only after OPT+Load Time opens bounded entry and reports payload intent", () => {
    const result = reduceRemoteButtonSignals([
      signal("down", "opt", 10_000),
      signal("down", "loadTime", 11_000),
      signal("up", "loadTime", 12_000),
      signal("up", "opt", 13_000),
      ...tap("digit5", 20_000),
      ...tap("digit3", 30_000),
      ...tap("digit0", 40_000)
    ])
    expect(result.intents.slice(1)).toEqual([
      {
        command: "clock.configure",
        complete: false,
        digits: "5",
        kind: "payload-entry",
        minutes: null,
        pressKind: "modified",
        seconds: null
      },
      {
        command: "clock.configure",
        complete: false,
        digits: "53",
        kind: "payload-entry",
        minutes: null,
        pressKind: "modified",
        seconds: null
      },
      {
        command: "clock.configure",
        complete: true,
        digits: "530",
        kind: "payload-entry",
        minutes: 5,
        pressKind: "modified",
        seconds: 30
      }
    ])
    expect(reduceRemoteButtonSignals(tap("digit5")).intents).toEqual([
      { kind: "ignored", reason: "digit-outside-entry" }
    ])
  })

  it("rejects seconds above 59, resets the active entry, and never emits a complete command", () => {
    const result = reduceRemoteButtonSignals([
      signal("down", "opt", 10_000),
      signal("down", "loadTime", 11_000),
      signal("up", "loadTime", 12_000),
      signal("up", "opt", 13_000),
      ...tap("digit1", 20_000),
      ...tap("digit9", 30_000),
      ...tap("digit9", 40_000)
    ])
    expect(result.intents.at(-1)).toEqual({ kind: "ignored", reason: "clock-entry-out-of-bounds" })
    expect(result.intents.some((intent) => intent.kind === "payload-entry" && intent.complete)).toBe(false)
    expect(result.state.clockEntry?.digits).toBe("")
  })

  it("retains partial entry digits and resets them when a new configuration gesture opens", () => {
    const result = reduceRemoteButtonSignals([
      signal("down", "opt", 10_000),
      signal("down", "loadTime", 11_000),
      signal("up", "loadTime", 12_000),
      signal("up", "opt", 13_000),
      ...tap("digit1", 20_000),
      ...tap("digit2", 30_000),
      signal("down", "opt", 100_000),
      signal("down", "loadTime", 101_000),
      signal("up", "loadTime", 102_000),
      signal("up", "opt", 103_000)
    ])
    expect(result.state.clockEntry?.digits).toBe("")
    expect(result.intents.at(-1)).toEqual({
      command: "clock.configure",
      complete: false,
      digits: "",
      kind: "payload-entry",
      minutes: null,
      pressKind: "modified",
      seconds: null
    })
  })

  it("expires clock entry deterministically and rejects overflow digits", () => {
    const opening = reduceRemoteButtonSignals([
      signal("down", "opt", 10_000),
      signal("down", "loadTime", 11_000),
      signal("up", "loadTime", 12_000),
      signal("up", "opt", 13_000),
      ...tap("digit1", 20_000),
      ...tap("digit2", 30_000),
      ...tap("digit3", 40_000),
      ...tap("digit4", 50_000)
    ])
    const expired = reduceRemoteButtonSignal(opening.state, { atUs: 5_050_000, kind: "advance-time" })
    expect(expired.state.clockEntry).toBeNull()
    expect(reduceRemoteButtonSignal(expired.state, signal("up", "digit5", 5_051_000)).intents).toEqual([
      { kind: "ignored", reason: "unmatched-release" }
    ])
  })

  it("fails closed for unknown, reserved, duplicate, unmatched, and adversarial time signals", () => {
    expect(reduceRemoteButtonSignal(INITIAL_REMOTE_GESTURE_STATE, signal("down", "reserved", 1_000)).intents).toEqual([
      { kind: "ignored", reason: "unknown-button" }
    ])
    const repeated = reduceRemoteButtonSignal(INITIAL_REMOTE_GESTURE_STATE, signal("down", "back", 1_000))
    expect(reduceRemoteButtonSignal(repeated.state, signal("down", "back", 2_000)).intents).toEqual([
      { kind: "ignored", reason: "repeat" }
    ])
    expect(reduceRemoteButtonSignal(repeated.state, signal("up", "opt", 2_000)).intents).toEqual([
      { kind: "ignored", reason: "unmatched-release" }
    ])
    expect(reduceRemoteButtonSignal(repeated.state, signal("up", "back", 0)).intents).toEqual([
      { kind: "ignored", reason: "non-monotonic-time" }
    ])
    expect(reduceRemoteButtonSignal(INITIAL_REMOTE_GESTURE_STATE, { atUs: 1_000, kind: "advance-time" }).state).toEqual(
      {
        ...INITIAL_REMOTE_GESTURE_STATE,
        lastAtUs: 1_000
      }
    )
    expect(DEFAULT_REMOTE_GESTURE_TIMINGS.holdUs).toBeGreaterThan(0)
  })

  it("requires non-negative safe integer microseconds for signals and timings", () => {
    expect(DEFAULT_REMOTE_GESTURE_TIMINGS).toEqual({
      doubleWindowUs: 350_000,
      entryTimeoutUs: 5_000_000,
      holdUs: 750_000
    })
    const invalidSignals = [
      { atUs: -1, kind: "advance-time" as const },
      { atUs: 1.5, kind: "advance-time" as const },
      { atUs: Number.MAX_SAFE_INTEGER + 1, kind: "advance-time" as const }
    ]
    for (const invalidSignal of invalidSignals) {
      expect(reduceRemoteButtonSignal(INITIAL_REMOTE_GESTURE_STATE, invalidSignal).intents).toEqual([
        { kind: "ignored", reason: "invalid-time" }
      ])
    }

    expect(
      reduceRemoteButtonSignal(
        INITIAL_REMOTE_GESTURE_STATE,
        { atUs: 1_000, kind: "advance-time" },
        {
          doubleWindowUs: 350_000.5,
          entryTimeoutUs: 5_000_000,
          holdUs: 750_000
        }
      ).intents
    ).toEqual([{ kind: "ignored", reason: "invalid-time" }])
  })

  it("never emits a command for digit buttons outside entry, including held and repeated signals", () => {
    const signals = [
      signal("down", "digit9", 10_000),
      signal("down", "digit9", 11_000),
      { atUs: 900_000, kind: "advance-time" as const },
      signal("up", "digit9", 901_000)
    ]
    const result = reduceRemoteButtonSignals(signals)
    expect(result.intents.some((intent) => intent.kind === "command")).toBe(false)
  })

  it("does not mutate caller state", () => {
    const state: RemoteGestureState = INITIAL_REMOTE_GESTURE_STATE
    const result = reduceRemoteButtonSignal(state, signal("down", "opt", 10_000))
    expect(state).toBe(INITIAL_REMOTE_GESTURE_STATE)
    expect(result.state).not.toBe(state)
  })

  it("covers every declared button with a deterministic result", () => {
    for (const button of REMOTE_BUTTONS) {
      const result = reduceRemoteButtonSignals(tap(button))
      expect(result.state.lastAtUs).toBe(11_000)
      if (button.startsWith("digit")) expect(result.intents.every((intent) => intent.kind !== "command")).toBe(true)
    }
  })
})
