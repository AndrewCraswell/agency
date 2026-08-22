import {
  advanceEpeeScoring,
  createEpeeScoringState,
  type EpeeContact,
  type EpeeHit,
  type EpeeScoringState
} from "./epee.js"

const PRE_EVENT_US = 100_000
const POST_EVENT_US = 25_000
const RETAINED_SENSOR_HISTORY_US = PRE_EVENT_US + POST_EVENT_US + 10_000

export type FrontEndReading = {
  aToBClosed: boolean
  guardOrPisteGrounded: boolean
}

export type SensorFrame = {
  atUs: number
  left: FrontEndReading
  right: FrontEndReading
}

export type ReplaySample = {
  atUs: number
  packedInputs: number
}

export type ScoringDecisionRecord = {
  capturedFromUs: number
  capturedThroughUs: number
  classification: "on-target"
  firmwareDigest: string
  firmwareIdentity: string
  hit: EpeeHit
  rejectionReason: null
  samples: readonly ReplaySample[]
  scoringBootId: string
  sequenceRange: { first: number; last: number }
  timing: {
    contactMinimumUs: number
    postCaptureUs: number
    preCaptureUs: number
  }
  timingRevision: string
}

export type ScoringEvent = {
  protocolVersion: 2
  record: ScoringDecisionRecord
  recordCrc32c: number
  sequence: number
  type: "decision-record"
}

type PendingDecision = {
  completeAfterUs: number
  hit: EpeeHit
}

export type VirtualStm32State = {
  firmwareIdentity: string
  firmwareDigest: string
  nextSequence: number
  pendingDecisions: readonly PendingDecision[]
  samples: readonly ReplaySample[]
  scoring: EpeeScoringState
  scoringBootId: string
  timingRevision: string
}

export type VirtualEsp32State = {
  hits: readonly EpeeHit[]
  lastSequence: number
  records: readonly ScoringDecisionRecord[]
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

function packFrame(frame: SensorFrame): ReplaySample {
  const bits = [
    frame.left.aToBClosed,
    frame.left.guardOrPisteGrounded,
    frame.right.aToBClosed,
    frame.right.guardOrPisteGrounded
  ]
  const packedInputs = bits.reduce((value, enabled, index) => value | (enabled ? 1 << index : 0), 0)

  return { atUs: frame.atUs, packedInputs }
}

export function createEmulatedDeviceState(): EmulatedDeviceState {
  return {
    esp32: { hits: [], lastSequence: -1, records: [] },
    stm32: {
      firmwareIdentity: "stm32-emulator-dev",
      firmwareDigest: "sha256:stm32-emulator-dev",
      nextSequence: 0,
      pendingDecisions: [],
      samples: [],
      scoring: createEpeeScoringState(),
      scoringBootId: "stm32-boot-0",
      timingRevision: "fie-2026-epee"
    }
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
  const retainedAfterUs = Math.max(0, frame.atUs - RETAINED_SENSOR_HISTORY_US)
  const samples = [...state.samples, packFrame(frame)].filter((sample) => sample.atUs >= retainedAfterUs)
  const newHits = scoring.hits.slice(state.scoring.hits.length)
  const pendingDecisions = [
    ...state.pendingDecisions,
    ...newHits.map<PendingDecision>((hit) => ({ completeAfterUs: hit.qualifiedAtUs + POST_EVENT_US, hit }))
  ]
  const completed = pendingDecisions.filter((pending) => pending.completeAfterUs <= frame.atUs)
  const events = completed.map<ScoringEvent>((pending, index) => {
    const eventSamples = samples.filter(
      (sample) =>
        sample.atUs >= Math.max(0, pending.hit.startedAtUs - PRE_EVENT_US) && sample.atUs <= pending.completeAfterUs
    )

    const sequence = state.nextSequence + index
    const record: ScoringDecisionRecord = {
      /* v8 ignore next -- the completing frame is always retained in eventSamples */
      capturedFromUs: eventSamples.at(0)?.atUs ?? pending.hit.startedAtUs,
      /* v8 ignore next -- the completing frame is always retained in eventSamples */
      capturedThroughUs: eventSamples.at(-1)?.atUs ?? pending.hit.qualifiedAtUs,
      classification: "on-target",
      firmwareDigest: state.firmwareDigest,
      firmwareIdentity: state.firmwareIdentity,
      hit: pending.hit,
      rejectionReason: null,
      samples: eventSamples,
      scoringBootId: state.scoringBootId,
      sequenceRange: { first: sequence, last: sequence },
      timing: {
        contactMinimumUs: 2_000,
        postCaptureUs: POST_EVENT_US,
        preCaptureUs: PRE_EVENT_US
      },
      timingRevision: state.timingRevision
    }

    return {
      protocolVersion: 2,
      record,
      recordCrc32c: calculateDecisionRecordCrc32c(record),
      sequence,
      type: "decision-record"
    }
  })

  return {
    events,
    state: {
      ...state,
      nextSequence: state.nextSequence + events.length,
      pendingDecisions: pendingDecisions.filter((pending) => pending.completeAfterUs > frame.atUs),
      samples,
      scoring
    }
  }
}

export function receiveEsp32Event(state: VirtualEsp32State, event: ScoringEvent): VirtualEsp32State {
  if (event.sequence !== state.lastSequence + 1) {
    throw new RangeError("Scoring events must arrive exactly once and in sequence")
  }

  return {
    hits: [...state.hits, event.record.hit],
    lastSequence: event.sequence,
    records: [...state.records, event.record]
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

export function calculateDecisionRecordCrc32c(record: ScoringDecisionRecord): number {
  const bytes = new TextEncoder().encode(JSON.stringify(record))
  let crc = 0xffff_ffff

  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0x82f6_3b78 : 0)
    }
  }

  return (crc ^ 0xffff_ffff) >>> 0
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

function isNonnegativeSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0
}

function isHit(value: unknown): value is EpeeHit {
  return (
    isRecord(value) &&
    (value.side === "left" || value.side === "right") &&
    isNonnegativeSafeInteger(value.startedAtUs) &&
    isNonnegativeSafeInteger(value.qualifiedAtUs) &&
    value.qualifiedAtUs >= value.startedAtUs
  )
}

function isReplaySample(value: unknown): value is ReplaySample {
  return (
    isRecord(value) &&
    isNonnegativeSafeInteger(value.atUs) &&
    isNonnegativeSafeInteger(value.packedInputs) &&
    value.packedInputs <= 0x0f
  )
}

function isDecisionRecord(value: unknown): value is ScoringDecisionRecord {
  if (!isRecord(value)) {
    return false
  }

  const samples = Array.isArray(value.samples) ? value.samples : []
  const orderedSamples = samples.every(
    (sample, index) =>
      isReplaySample(sample) && (index === 0 || sample.atUs > Number((samples[index - 1] as ReplaySample).atUs))
  )

  return (
    value.classification === "on-target" &&
    typeof value.firmwareDigest === "string" &&
    value.firmwareDigest.startsWith("sha256:") &&
    typeof value.firmwareIdentity === "string" &&
    value.firmwareIdentity.length > 0 &&
    typeof value.timingRevision === "string" &&
    value.timingRevision.length > 0 &&
    isNonnegativeSafeInteger(value.capturedFromUs) &&
    isNonnegativeSafeInteger(value.capturedThroughUs) &&
    value.capturedThroughUs >= value.capturedFromUs &&
    isHit(value.hit) &&
    value.rejectionReason === null &&
    typeof value.scoringBootId === "string" &&
    value.scoringBootId.length > 0 &&
    isRecord(value.sequenceRange) &&
    isNonnegativeSafeInteger(value.sequenceRange.first) &&
    isNonnegativeSafeInteger(value.sequenceRange.last) &&
    value.sequenceRange.last >= value.sequenceRange.first &&
    isRecord(value.timing) &&
    isNonnegativeSafeInteger(value.timing.contactMinimumUs) &&
    isNonnegativeSafeInteger(value.timing.postCaptureUs) &&
    isNonnegativeSafeInteger(value.timing.preCaptureUs) &&
    orderedSamples &&
    samples.length > 0 &&
    (samples[0] as ReplaySample).atUs === value.capturedFromUs &&
    (samples.at(-1) as ReplaySample).atUs === value.capturedThroughUs
  )
}

function isScoringEvent(value: unknown): value is ScoringEvent {
  return (
    isRecord(value) &&
    value.protocolVersion === 2 &&
    value.type === "decision-record" &&
    isNonnegativeSafeInteger(value.sequence) &&
    isNonnegativeSafeInteger(value.recordCrc32c) &&
    isDecisionRecord(value.record) &&
    value.record.sequenceRange.first === value.sequence &&
    value.record.sequenceRange.last === value.sequence &&
    calculateDecisionRecordCrc32c(value.record) === value.recordCrc32c
  )
}
