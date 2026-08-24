/**
 * M2-04 authoritative event capture.
 *
 * This layer preserves a decision already made by the STM32-owned scorer with
 * bounded canonical acquisition evidence. It never derives a scoring outcome,
 * supplies a fallback classification, or serializes a record for transport.
 */

import {
  DECISION_RECORD_SCHEMA_VERSION,
  parseRecordProvenance,
  RecordProvenanceValidationError,
  parseDecisionRecord,
  type DecisionRecord,
  type DecisionRecordOutcome,
  type RecordProvenance
} from "./decision-record.js"
import { validateVirtualFrontEndSnapshot, type VirtualFrontEndSnapshot } from "./virtual-front-end.js"
import type { VirtualStm32AuthoritativeOutcome } from "./virtual-stm32.js"

export const DEFAULT_EVENT_CAPTURE_PRE_SAMPLES = 4
export const DEFAULT_EVENT_CAPTURE_POST_SAMPLES = 4
export const DEFAULT_EVENT_CAPTURE_MAX_PENDING = 32
export const DEFAULT_EVENT_CAPTURE_MAX_RECORDS = 64
export const MAX_EVENT_CAPTURE_SAMPLES = 16
export const MAX_EVENT_CAPTURE_PENDING = 256
export const MAX_EVENT_CAPTURE_RECORDS = 1_024
export const MAX_EVENT_CAPTURE_IDENTIFIER_LENGTH = 120

export type EventCaptureSample = Readonly<{
  sequence: number
  snapshot: VirtualFrontEndSnapshot
}>

/** Outcomes that may originate from the STM32 weapon scorer. Lifecycle records have separate owners. */
export type CapturableDecisionOutcome = DecisionRecordOutcome &
  Readonly<{
    disposition: "line-fault" | "off-target" | "qualified-hit" | "rejected-contact" | "uncertainty"
  }>

/** An M0-05 decision record paired with the immutable M2-04 evidence window. */
export type CapturedDecisionRecord = Readonly<{
  decision: DecisionRecord
  postSamples: readonly EventCaptureSample[]
  preSamples: readonly EventCaptureSample[]
}>

export type EventCaptureOptions = Readonly<{
  maxPending?: number
  maxRecords?: number
  postSampleCount?: number
  preSampleCount?: number
  provenance: RecordProvenance
  recordIdPrefix: string
}>

export type EventCapture = Readonly<{
  readonly pendingCount: number
  readonly records: readonly CapturedDecisionRecord[]
  capture: (outcome: VirtualStm32AuthoritativeOutcome<CapturableDecisionOutcome>) => void
  observe: (sample: EventCaptureSample) => void
}>

type PendingCapture = Readonly<{
  outcome: VirtualStm32AuthoritativeOutcome<CapturableDecisionOutcome>
  preSamples: readonly EventCaptureSample[]
  postSamples: readonly EventCaptureSample[]
  triggerSequence: number
}>

type DecisionRecordParserInput = Omit<DecisionRecord, "outcome"> &
  Readonly<{
    outcome: CapturableDecisionOutcome
  }>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function assertExactKeys(value: Record<string, unknown>, keys: readonly string[], description: string): void {
  const actualKeys = Reflect.ownKeys(value)
  if (actualKeys.length !== keys.length || actualKeys.some((key) => typeof key !== "string" || !keys.includes(key))) {
    throw new TypeError(`${description} has missing or unrecognized fields`)
  }
}

function assertAllowedKeys(value: Record<string, unknown>, keys: readonly string[], description: string): void {
  if (Reflect.ownKeys(value).some((key) => typeof key !== "string" || !keys.includes(key))) {
    throw new TypeError(`${description} has unrecognized fields`)
  }
}

function assertBoundedIdentifier(value: unknown, description: string): asserts value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_EVENT_CAPTURE_IDENTIFIER_LENGTH) {
    throw new RangeError(
      `${description} must be a non-empty string no longer than ${MAX_EVENT_CAPTURE_IDENTIFIER_LENGTH} characters`
    )
  }
}

function assertPositiveSafeInteger(value: unknown, description: string, maximum: number): asserts value is number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1 || value > maximum) {
    throw new RangeError(`${description} must be a safe integer from 1 through ${maximum}`)
  }
}

function assertNonnegativeSafeInteger(value: unknown, description: string): asserts value is number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${description} must be a non-negative safe integer`)
  }
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) {
      deepFreeze(child)
    }
    Object.freeze(value)
  }
  return value
}

function cloneSample(value: unknown): EventCaptureSample {
  if (!isRecord(value)) {
    throw new TypeError("Event capture samples must be objects")
  }
  assertExactKeys(value, ["sequence", "snapshot"], "Event capture samples")
  assertNonnegativeSafeInteger(value.sequence, "Event capture sample sequences")
  validateVirtualFrontEndSnapshot(value.snapshot)
  return deepFreeze({ sequence: value.sequence, snapshot: structuredClone(value.snapshot) })
}

function cloneOutcome(
  value: VirtualStm32AuthoritativeOutcome<CapturableDecisionOutcome>
): VirtualStm32AuthoritativeOutcome<CapturableDecisionOutcome> {
  if (!isRecord(value)) {
    throw new TypeError("Event capture outcomes must be STM32 authoritative outcomes")
  }
  assertExactKeys(value, ["atUs", "outcome", "source", "timingTableRevision", "weapon"], "Event capture outcomes")
  assertNonnegativeSafeInteger(value.atUs, "Event capture outcome timestamps")
  if (value.source !== "weapon-scorer") {
    throw new TypeError("Event capture only accepts weapon-scorer outcomes")
  }
  const suppliedOutcome = value.outcome as unknown
  if (
    isRecord(suppliedOutcome) &&
    (suppliedOutcome.disposition === "reset" || suppliedOutcome.disposition === "calibration")
  ) {
    throw new TypeError("Event capture defers reset and calibration lifecycle records to their owning layers")
  }
  if (value.weapon !== "epee" && value.weapon !== "foil" && value.weapon !== "sabre") {
    throw new TypeError("Event capture outcomes must identify an approved weapon")
  }
  assertBoundedIdentifier(value.timingTableRevision, "Event capture timing-table revisions")

  return deepFreeze(structuredClone(value) as VirtualStm32AuthoritativeOutcome<CapturableDecisionOutcome>)
}

function assertProvenance(value: unknown): RecordProvenance {
  let provenance: RecordProvenance
  try {
    provenance = parseRecordProvenance(value)
  } catch (error) {
    if (!(error instanceof RecordProvenanceValidationError)) {
      throw new TypeError("Event capture provenance must be an M0-05 provenance object")
    }
    switch (error.issue) {
      case "shape":
        throw new TypeError("Event capture provenance must be an M0-05 provenance object")
      case "firmware-build-digest":
        throw new TypeError(
          "Event capture firmware build digests must be a sha256 digest with 64 lowercase hexadecimal characters"
        )
      case "calibration-profile-revision":
        throw new RangeError(
          `Event capture calibration revisions must be a non-empty string no longer than ${MAX_EVENT_CAPTURE_IDENTIFIER_LENGTH} characters`
        )
      case "firmware-identity":
        throw new RangeError(
          `Event capture firmware identities must be a non-empty STM32 identifier no longer than ${MAX_EVENT_CAPTURE_IDENTIFIER_LENGTH} characters`
        )
      case "scoring-boot-id":
        throw new RangeError(
          `Event capture scoring boot IDs must be a non-empty string no longer than ${MAX_EVENT_CAPTURE_IDENTIFIER_LENGTH} characters`
        )
      case "hardware-revision":
        throw new RangeError(
          `Event capture hardware revisions must be a non-empty string no longer than ${MAX_EVENT_CAPTURE_IDENTIFIER_LENGTH} characters`
        )
      case "line-contract-revision":
        throw new RangeError(
          `Event capture line-contract revisions must be a non-empty string no longer than ${MAX_EVENT_CAPTURE_IDENTIFIER_LENGTH} characters`
        )
      case "rule-set-revision":
        throw new RangeError(
          `Event capture rule-set revisions must be a non-empty string no longer than ${MAX_EVENT_CAPTURE_IDENTIFIER_LENGTH} characters`
        )
      case "timing-table-revision":
        throw new RangeError(
          `Event capture timing-table revisions must be a non-empty string no longer than ${MAX_EVENT_CAPTURE_IDENTIFIER_LENGTH} characters`
        )
    }
  }
  assertBoundedIdentifier(provenance.calibrationProfileRevision, "Event capture calibration revisions")
  assertBoundedIdentifier(provenance.firmware.identity, "Event capture firmware identities")
  assertBoundedIdentifier(provenance.firmware.scoringBootId, "Event capture scoring boot IDs")
  assertBoundedIdentifier(provenance.hardwareRevision, "Event capture hardware revisions")
  assertBoundedIdentifier(provenance.lineContractRevision, "Event capture line-contract revisions")
  assertBoundedIdentifier(provenance.ruleSetRevision, "Event capture rule-set revisions")
  assertBoundedIdentifier(provenance.timingTableRevision, "Event capture timing-table revisions")
  return provenance
}

function decisionAtUs(outcome: CapturableDecisionOutcome): number {
  switch (outcome.disposition) {
    case "qualified-hit":
    case "off-target":
      return outcome.qualifiedAtUs
    case "rejected-contact":
      return outcome.attemptedAtUs
    case "line-fault":
      return outcome.detectedAtUs
    case "uncertainty":
      return outcome.observedAtUs
  }
}

function createDecisionRecordParserInput(
  outcome: VirtualStm32AuthoritativeOutcome<CapturableDecisionOutcome>,
  first: EventCaptureSample,
  last: EventCaptureSample,
  provenance: RecordProvenance,
  recordId: string
): DecisionRecordParserInput {
  return {
    captureWindow: {
      firstSequence: first.sequence,
      fromUs: first.snapshot.atUs,
      lastSequence: last.sequence,
      throughUs: last.snapshot.atUs
    },
    decisionAtUs: outcome.atUs,
    outcome: outcome.outcome,
    provenance,
    rawCaptureRefs: [],
    recordId,
    schemaVersion: DECISION_RECORD_SCHEMA_VERSION
  }
}

function assertAuthoritativeDecision(
  outcome: VirtualStm32AuthoritativeOutcome<CapturableDecisionOutcome>,
  provenance: RecordProvenance,
  sample: EventCaptureSample
): void {
  if (outcome.atUs !== sample.snapshot.atUs || decisionAtUs(outcome.outcome) !== outcome.atUs) {
    throw new RangeError("Event capture outcomes must match the current canonical evidence timestamp")
  }
  if (outcome.timingTableRevision !== provenance.timingTableRevision) {
    throw new RangeError("Event capture outcomes must preserve the configured timing-table revision")
  }
  if ("weapon" in outcome.outcome && outcome.outcome.weapon !== outcome.weapon) {
    throw new RangeError("Event capture outcomes must preserve the STM32-selected weapon")
  }

  parseDecisionRecord(createDecisionRecordParserInput(outcome, sample, sample, provenance, "capture-validation"))
}

function createRecord(
  outcome: VirtualStm32AuthoritativeOutcome<CapturableDecisionOutcome>,
  preSamples: readonly EventCaptureSample[],
  postSamples: readonly EventCaptureSample[],
  provenance: RecordProvenance,
  recordId: string
): CapturedDecisionRecord {
  const samples = [...preSamples, ...postSamples]
  const first = samples[0]!
  const last = samples.at(-1)!
  const decision = parseDecisionRecord(createDecisionRecordParserInput(outcome, first, last, provenance, recordId))
  return deepFreeze({ decision, postSamples: [...postSamples], preSamples: [...preSamples] })
}

/**
 * Captures only decisions already emitted by the STM32 weapon scorer. Call
 * `observe` for each canonical front-end snapshot, then `capture` for its
 * authoritative outcome. Records are emitted after the configured post-window.
 */
export function createEventCapture(options: EventCaptureOptions): EventCapture {
  if (!isRecord(options)) {
    throw new TypeError("Event capture options must be an object")
  }
  assertAllowedKeys(
    options,
    ["maxPending", "maxRecords", "postSampleCount", "preSampleCount", "provenance", "recordIdPrefix"],
    "Event capture options"
  )
  const provenance = assertProvenance(options.provenance)
  assertBoundedIdentifier(options.recordIdPrefix, "Event capture record ID prefixes")

  const preSampleCount = options.preSampleCount ?? DEFAULT_EVENT_CAPTURE_PRE_SAMPLES
  const postSampleCount = options.postSampleCount ?? DEFAULT_EVENT_CAPTURE_POST_SAMPLES
  const maxPending = options.maxPending ?? DEFAULT_EVENT_CAPTURE_MAX_PENDING
  const maxRecords = options.maxRecords ?? DEFAULT_EVENT_CAPTURE_MAX_RECORDS
  assertPositiveSafeInteger(preSampleCount, "Event capture pre-sample counts", MAX_EVENT_CAPTURE_SAMPLES)
  assertPositiveSafeInteger(postSampleCount, "Event capture post-sample counts", MAX_EVENT_CAPTURE_SAMPLES)
  assertPositiveSafeInteger(maxPending, "Event capture pending limits", MAX_EVENT_CAPTURE_PENDING)
  assertPositiveSafeInteger(maxRecords, "Event capture record limits", MAX_EVENT_CAPTURE_RECORDS)

  const history: EventCaptureSample[] = []
  const pending: PendingCapture[] = []
  const completed: CapturedDecisionRecord[] = []
  let lastSequence: number | null = null
  let lastAtUs: number | null = null
  let nextRecordNumber = 0

  function observe(value: EventCaptureSample): void {
    const sample = cloneSample(value)
    if (lastSequence !== null && sample.sequence <= lastSequence) {
      throw new RangeError("Event capture samples must use strictly increasing sequences")
    }
    if (lastAtUs !== null && sample.snapshot.atUs < lastAtUs) {
      throw new RangeError("Event capture samples must use monotonic timestamps")
    }
    lastSequence = sample.sequence
    lastAtUs = sample.snapshot.atUs
    history.push(sample)
    if (history.length > preSampleCount) {
      history.shift()
    }

    const remaining: PendingCapture[] = []
    const completedNow: CapturedDecisionRecord[] = []
    for (const capture of pending) {
      const postSamples = [...capture.postSamples, sample]
      if (postSamples.length < postSampleCount) {
        remaining.push({ ...capture, postSamples })
        continue
      }
      completedNow.push(
        createRecord(
          capture.outcome,
          capture.preSamples,
          postSamples,
          provenance,
          `${options.recordIdPrefix}-${nextRecordNumber++}`
        )
      )
    }
    pending.splice(0, pending.length, ...remaining)
    completed.push(...completedNow)
    if (completed.length > maxRecords) {
      completed.splice(0, completed.length - maxRecords)
    }
  }

  function capture(value: VirtualStm32AuthoritativeOutcome<CapturableDecisionOutcome>): void {
    if (lastSequence === null || history.length === 0) {
      throw new RangeError("Event capture requires current canonical evidence before an outcome")
    }
    if (pending.length === maxPending) {
      throw new RangeError(`Event capture pending limit of ${maxPending} reached`)
    }
    const outcome = cloneOutcome(value)
    const current = history.at(-1)!
    assertAuthoritativeDecision(outcome, provenance, current)
    pending.push({ outcome, postSamples: [], preSamples: [...history], triggerSequence: current.sequence })
  }

  return {
    capture,
    observe,
    get pendingCount() {
      return pending.length
    },
    get records() {
      return completed.slice()
    }
  }
}
