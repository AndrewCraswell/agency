import type { RemoteCommandKey, RemotePressKind } from "./remote-control.js"
import { assertIntegerMicroseconds } from "./scoring-glossary-and-units.js"

/** Physical controls understood by the referee handheld. Digits are only active in clock-entry mode. */
export const REMOTE_BUTTONS = [
  "scoreIncrementLeft",
  "scoreIncrementRight",
  "scoreDecrementLeft",
  "scoreDecrementRight",
  "startStop",
  "leftCard",
  "rightCard",
  "pauseOneMinute",
  "plusTime",
  "minusTime",
  "back",
  "opt",
  "rearm",
  "resetCards",
  "loadTime",
  "digit0",
  "digit1",
  "digit2",
  "digit3",
  "digit4",
  "digit5",
  "digit6",
  "digit7",
  "digit8",
  "digit9"
] as const
export type RemoteButton = (typeof REMOTE_BUTTONS)[number]

export const DEFAULT_REMOTE_GESTURE_TIMINGS = {
  doubleWindowUs: 350_000,
  entryTimeoutUs: 5_000_000,
  holdUs: 750_000
} as const
export type RemoteGestureTimings = Readonly<{
  doubleWindowUs: number
  entryTimeoutUs: number
  holdUs: number
}>

export type RemoteButtonSignal = Readonly<
  { atUs: number; button: string; kind: "down" | "up" } | { atUs: number; kind: "advance-time" }
>
export type RemoteCommandIntent = Readonly<{
  kind: "command"
  command: RemoteCommandKey
  payload: Readonly<Record<string, never>>
  pressKind: RemotePressKind
}>
export type ClockEntryIntent = Readonly<{
  command: "clock.configure"
  complete: boolean
  digits: string
  kind: "payload-entry"
  minutes: number | null
  pressKind: "modified"
  seconds: number | null
}>
export type RemoteLocalIntent = Readonly<{
  action: "open-configuration"
  kind: "local"
}>
export type RemoteGestureRejection = Readonly<{
  kind: "ignored"
  reason:
    | "invalid-time"
    | "non-monotonic-time"
    | "unknown-button"
    | "unmatched-release"
    | "reserved-button"
    | "repeat"
    | "digit-outside-entry"
    | "clock-entry-out-of-bounds"
    | "modifier-consumed"
}>
export type RemoteGestureIntent = RemoteCommandIntent | ClockEntryIntent | RemoteLocalIntent | RemoteGestureRejection

type Press = Readonly<{
  atUs: number
  button: RemoteButton
  blockedByOptHold: boolean
  chorded: boolean
  doubleCandidate: boolean
  holdEmitted: boolean
}>
type ClockEntry = Readonly<{ digits: string; expiresAtUs: number }>
export type RemoteGestureState = Readonly<{
  clockEntry: ClockEntry | null
  lastAtUs: number
  pendingLoadTimeReleaseAtUs: number | null
  pressed: readonly Press[]
}>
export type RemoteGestureReduction = Readonly<{
  intents: readonly RemoteGestureIntent[]
  state: RemoteGestureState
}>

export const INITIAL_REMOTE_GESTURE_STATE: RemoteGestureState = Object.freeze({
  clockEntry: null,
  lastAtUs: 0,
  pendingLoadTimeReleaseAtUs: null,
  pressed: []
})

const EMPTY_PAYLOAD = Object.freeze({}) as Readonly<Record<string, never>>
const DIGIT_PATTERN = /^digit[0-9]$/

function isRemoteButton(value: string): value is RemoteButton {
  return (REMOTE_BUTTONS as readonly string[]).includes(value)
}

function isDigit(button: RemoteButton): boolean {
  return DIGIT_PATTERN.test(button)
}

function digit(button: RemoteButton): string {
  return button.slice(-1)
}

function command(command: RemoteCommandKey, pressKind: RemotePressKind): RemoteCommandIntent {
  return { command, kind: "command", payload: EMPTY_PAYLOAD, pressKind }
}

function direct(button: RemoteButton): RemoteCommandIntent | null {
  const commands: Partial<Record<RemoteButton, RemoteCommandKey>> = {
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
  }
  const key = commands[button]
  return key === undefined ? null : command(key, "direct")
}

function modified(button: RemoteButton): RemoteCommandIntent | ClockEntryIntent | null {
  const commands: Partial<Record<RemoteButton, RemoteCommandKey>> = {
    back: "sides.swap",
    leftCard: "passivityPenalty.award.left",
    minusTime: "format.retreat",
    pauseOneMinute: "medical.start",
    plusTime: "format.advance",
    rearm: "scoring.autoRearm.advance",
    resetCards: "bout.new",
    rightCard: "passivityPenalty.award.right"
  }
  if (button === "loadTime")
    return {
      command: "clock.configure",
      complete: false,
      digits: "",
      kind: "payload-entry",
      minutes: null,
      pressKind: "modified",
      seconds: null
    }
  const key = commands[button]
  return key === undefined ? null : command(key, "modified")
}

function held(button: RemoteButton): RemoteCommandIntent | null {
  if (button === "pauseOneMinute") return command("overtime.toggle", "held")
  if (button === "resetCards") return command("device.sleep.request", "held")
  return null
}

function isValidMicroseconds(value: unknown, fieldName: string): value is number {
  try {
    assertIntegerMicroseconds(value, fieldName)
    return true
  } catch {
    return false
  }
}

function validTimings(timings: RemoteGestureTimings): boolean {
  return (
    isValidMicroseconds(timings.doubleWindowUs, "Remote gesture double window") &&
    timings.doubleWindowUs > 0 &&
    isValidMicroseconds(timings.entryTimeoutUs, "Remote gesture entry timeout") &&
    timings.entryTimeoutUs > 0 &&
    isValidMicroseconds(timings.holdUs, "Remote gesture hold threshold") &&
    timings.holdUs > 0
  )
}

function decodeEntry(digits: string): Pick<ClockEntryIntent, "complete" | "minutes" | "seconds"> | null {
  if (digits.length < 3) return { complete: false, minutes: null, seconds: null }
  const minutesDigits = digits.length === 3 ? digits.slice(0, 1) : digits.slice(0, 2)
  const seconds = Number(digits.slice(-2))
  if (seconds > 59) return null
  return {
    complete: true,
    minutes: Number(minutesDigits),
    seconds
  }
}

function entryIntent(entry: ClockEntry): ClockEntryIntent | null {
  const decoded = decodeEntry(entry.digits)
  if (decoded === null) return null
  return {
    command: "clock.configure",
    digits: entry.digits,
    kind: "payload-entry",
    pressKind: "modified",
    ...decoded
  }
}

function rejection(reason: RemoteGestureRejection["reason"]): RemoteGestureRejection {
  return { kind: "ignored", reason }
}

function updatePressed(state: RemoteGestureState, pressed: readonly Press[]): RemoteGestureState {
  return { ...state, pressed }
}

function expireEntry(state: RemoteGestureState, atUs: number): RemoteGestureState {
  return state.clockEntry !== null && atUs >= state.clockEntry.expiresAtUs ? { ...state, clockEntry: null } : state
}

function expirePendingLoadTime(
  state: RemoteGestureState,
  atUs: number,
  timings: RemoteGestureTimings
): RemoteGestureReduction {
  const releaseAt = state.pendingLoadTimeReleaseAtUs
  if (releaseAt === null || atUs - releaseAt <= timings.doubleWindowUs) return { intents: [], state }
  return {
    intents: [command("clock.loadConfigured", "direct")],
    state: { ...state, pendingLoadTimeReleaseAtUs: null }
  }
}

function withTimestamp(state: RemoteGestureState, atUs: number): RemoteGestureState {
  return { ...state, lastAtUs: atUs }
}

/**
 * Reduces one physical signal. The caller supplies `advance-time` signals when it wants a threshold evaluated;
 * this module never creates timers or repeats a command while a button remains down.
 */
export function reduceRemoteButtonSignal(
  inputState: RemoteGestureState,
  signal: RemoteButtonSignal,
  inputTimings: RemoteGestureTimings = DEFAULT_REMOTE_GESTURE_TIMINGS
): RemoteGestureReduction {
  if (!validTimings(inputTimings)) return { intents: [rejection("invalid-time")], state: inputState }
  if (!isValidMicroseconds(signal.atUs, "Remote gesture signal timestamp")) {
    return { intents: [rejection("invalid-time")], state: inputState }
  }
  if (signal.atUs < inputState.lastAtUs) return { intents: [rejection("non-monotonic-time")], state: inputState }

  const pending = expirePendingLoadTime(inputState, signal.atUs, inputTimings)
  let state = expireEntry(withTimestamp(expireEntry(pending.state, signal.atUs), signal.atUs), signal.atUs)
  const intents: RemoteGestureIntent[] = [...pending.intents]

  if (signal.kind === "advance-time") {
    const presses = [...state.pressed]
    for (let index = 0; index < presses.length; index += 1) {
      const press = presses[index]
      if (press.holdEmitted || signal.atUs - press.atUs < inputTimings.holdUs) continue
      const result =
        press.button === "opt" && !press.chorded
          ? ({ action: "open-configuration", kind: "local" } as const)
          : press.chorded
            ? null
            : held(press.button)
      if (result !== null) {
        intents.push(result)
        presses[index] = { ...press, holdEmitted: true }
      }
    }
    return { intents, state: updatePressed(state, presses) }
  }

  if (!isRemoteButton(signal.button)) return { intents: [...intents, rejection("unknown-button")], state }
  const button = signal.button
  const index = state.pressed.findIndex((press) => press.button === button)

  if (signal.kind === "down") {
    if (index !== -1) return { intents: [...intents, rejection("repeat")], state }
    const pendingRelease = state.pendingLoadTimeReleaseAtUs
    const pendingDouble = button === "loadTime" && pendingRelease !== null
    const withinDoubleWindow = pendingDouble && signal.atUs - pendingRelease <= inputTimings.doubleWindowUs
    if (pendingDouble && !withinDoubleWindow) {
      intents.push(command("clock.loadConfigured", "direct"))
      state = { ...state, pendingLoadTimeReleaseAtUs: null }
    }
    const optIndex = state.pressed.findIndex((press) => press.button === "opt")
    const optPress = optIndex === -1 ? undefined : state.pressed[optIndex]
    const blockedByOptHold = button !== "opt" && optPress?.holdEmitted === true
    const chorded = button !== "opt" && optPress !== undefined && !blockedByOptHold
    const presses = [
      ...state.pressed,
      {
        atUs: signal.atUs,
        blockedByOptHold: blockedByOptHold ?? false,
        button,
        chorded,
        doubleCandidate: withinDoubleWindow,
        holdEmitted: false
      }
    ]
    if (chorded) presses[optIndex] = { ...presses[optIndex], chorded: true }
    return {
      intents,
      state: updatePressed(
        {
          ...state,
          pendingLoadTimeReleaseAtUs: pendingDouble && withinDoubleWindow ? null : state.pendingLoadTimeReleaseAtUs
        },
        presses
      )
    }
  }

  if (index === -1) return { intents: [...intents, rejection("unmatched-release")], state }
  const press = state.pressed[index]
  const presses = state.pressed.filter((_, pressIndex) => pressIndex !== index)
  state = updatePressed(state, presses)
  if (isDigit(button)) {
    if (state.clockEntry === null) return { intents: [...intents, rejection("digit-outside-entry")], state }
    if (state.clockEntry.digits.length >= 4) return { intents: [...intents, rejection("reserved-button")], state }
    const entry = { ...state.clockEntry, digits: `${state.clockEntry.digits}${digit(button)}` }
    const intent = entryIntent(entry)
    if (intent === null) {
      return {
        intents: [...intents, rejection("clock-entry-out-of-bounds")],
        state: { ...state, clockEntry: { ...state.clockEntry, digits: "" } }
      }
    }
    return { intents: [...intents, intent], state: { ...state, clockEntry: entry } }
  }
  if (press.blockedByOptHold) return { intents: [...intents, rejection("modifier-consumed")], state }
  const holdResult = press.chorded ? null : held(button)
  if (holdResult !== null) {
    if (press.holdEmitted) return { intents, state }
    if (signal.atUs - press.atUs >= inputTimings.holdUs) return { intents: [...intents, holdResult], state }
  }
  if (button === "opt") {
    if (press.chorded || press.holdEmitted) return { intents, state }
    return { intents: [...intents, command("weapon.showOrAdvance", "direct")], state }
  }
  if (press.chorded) {
    const result = modified(button)
    if (result === null) return { intents: [...intents, rejection("reserved-button")], state }
    if (result.kind === "payload-entry") {
      const expiresAtUs = signal.atUs + inputTimings.entryTimeoutUs
      if (!isValidMicroseconds(expiresAtUs, "Remote gesture entry expiry")) {
        return { intents: [...intents, rejection("invalid-time")], state }
      }
      const entry = { digits: "", expiresAtUs }
      return { intents: [...intents, result], state: { ...state, clockEntry: entry } }
    }
    return { intents: [...intents, result], state }
  }
  if (button === "loadTime") {
    if (press.doubleCandidate) return { intents: [...intents, command("clock.loadOneMinute", "double")], state }
    return { intents, state: { ...state, pendingLoadTimeReleaseAtUs: signal.atUs } }
  }
  const result = direct(button)
  return result === null
    ? { intents: [...intents, rejection("reserved-button")], state }
    : { intents: [...intents, result], state }
}

export function reduceRemoteButtonSignals(
  signals: readonly RemoteButtonSignal[],
  timings: RemoteGestureTimings = DEFAULT_REMOTE_GESTURE_TIMINGS
): RemoteGestureReduction {
  let state = INITIAL_REMOTE_GESTURE_STATE
  const intents: RemoteGestureIntent[] = []
  for (const signal of signals) {
    const reduction = reduceRemoteButtonSignal(state, signal, timings)
    state = reduction.state
    intents.push(...reduction.intents)
  }
  return { intents, state }
}
