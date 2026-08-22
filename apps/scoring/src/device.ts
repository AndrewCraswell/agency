import {
  advanceEpeeScoring,
  createEpeeScoringState,
  type EpeeContact,
  type EpeeHit,
  type EpeeScoringState
} from "./epee.js"

export type FrontEndReading = {
  aToBClosed: boolean
  guardOrPisteGrounded: boolean
}

export type SensorFrame = {
  atUs: number
  left: FrontEndReading
  right: FrontEndReading
}

export type ScoringEvent = {
  hit: EpeeHit
  protocolVersion: 1
  sequence: number
  type: "hit"
}

export type VirtualStm32State = {
  nextSequence: number
  scoring: EpeeScoringState
}

export type VirtualEsp32State = {
  hits: readonly EpeeHit[]
  lastSequence: number
}

export type EmulatedDeviceState = {
  esp32: VirtualEsp32State
  stm32: VirtualStm32State
}

function toContact(reading: FrontEndReading): EpeeContact {
  return {
    isGrounded: reading.guardOrPisteGrounded,
    isTipClosed: reading.aToBClosed
  }
}

export function createEmulatedDeviceState(): EmulatedDeviceState {
  return {
    esp32: { hits: [], lastSequence: -1 },
    stm32: { nextSequence: 0, scoring: createEpeeScoringState() }
  }
}

export function advanceVirtualStm32(
  state: VirtualStm32State,
  frame: SensorFrame
): { events: readonly ScoringEvent[]; state: VirtualStm32State } {
  const scoring = advanceEpeeScoring(state.scoring, {
    atUs: frame.atUs,
    left: toContact(frame.left),
    right: toContact(frame.right)
  })
  const newHits = scoring.hits.slice(state.scoring.hits.length)
  const events = newHits.map<ScoringEvent>((hit, index) => ({
    hit,
    protocolVersion: 1,
    sequence: state.nextSequence + index,
    type: "hit"
  }))

  return {
    events,
    state: {
      nextSequence: state.nextSequence + events.length,
      scoring
    }
  }
}

export function receiveEsp32Event(state: VirtualEsp32State, event: ScoringEvent): VirtualEsp32State {
  if (event.sequence !== state.lastSequence + 1) {
    throw new RangeError("Scoring events must arrive exactly once and in sequence")
  }

  return {
    hits: [...state.hits, event.hit],
    lastSequence: event.sequence
  }
}

export function advanceEmulatedDevice(state: EmulatedDeviceState, frame: SensorFrame): EmulatedDeviceState {
  const advanced = advanceVirtualStm32(state.stm32, frame)
  const esp32 = advanced.events.reduce(receiveEsp32Event, state.esp32)

  return { esp32, stm32: advanced.state }
}

export function encodeScoringEvent(event: ScoringEvent): string {
  return `${JSON.stringify(event)}\n`
}

export function decodeScoringEvent(line: string): ScoringEvent {
  const value: unknown = JSON.parse(line)

  if (!isScoringEvent(value)) {
    throw new TypeError("Invalid STM32 scoring event")
  }

  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isHit(value: unknown): value is EpeeHit {
  return (
    isRecord(value) &&
    (value.side === "left" || value.side === "right") &&
    Number.isSafeInteger(value.startedAtUs) &&
    Number(value.startedAtUs) >= 0 &&
    Number.isSafeInteger(value.qualifiedAtUs) &&
    Number(value.qualifiedAtUs) >= Number(value.startedAtUs)
  )
}

function isScoringEvent(value: unknown): value is ScoringEvent {
  return (
    isRecord(value) &&
    value.protocolVersion === 1 &&
    value.type === "hit" &&
    Number.isSafeInteger(value.sequence) &&
    Number(value.sequence) >= 0 &&
    isHit(value.hit)
  )
}
