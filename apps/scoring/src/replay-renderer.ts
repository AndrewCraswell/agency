/**
 * M2-11 stored-record replay renderer.
 *
 * This module validates and clones an already-authoritative decision record.
 * It deliberately has no dependency on a weapon scorer, timing table, or
 * front-end implementation: replay is presentation of recorded meaning, not
 * a second decision path.
 */

import type { ApplicationTimelineEntry, WallClockMetadata } from "./application-time-metadata.js"
import {
  MAX_RAW_CAPTURE_REFERENCES,
  parseDecisionRecord,
  type DecisionRecord,
  type DecisionRecordOutcome,
  type RecordProvenance,
  type RawCaptureReference
} from "./decision-record.js"

export const REPLAY_RENDER_SCHEMA_VERSION = 1
export const MAX_REPLAY_RENDER_STRING_LENGTH = 256
export const MAX_REPLAY_RENDER_RECORD_BYTES = 65_536

type SignalSnapshot = DecisionRecordOutcome["signal"]

/** The only input accepted by the renderer. The annotation is application-owned metadata. */
export type ReplayRenderInput = Readonly<{
  applicationTime?: ApplicationTimelineEntry | null
  record: DecisionRecord
}>

/**
 * A deterministic presentation model. `record` is the complete authoritative
 * STM32 payload; `applicationTime` can only add explicitly uncertain host
 * metadata and can never replace a field in `record`.
 */
export type ReplayRenderModel = Readonly<{
  applicationTime: ApplicationTimelineEntry | null
  record: DecisionRecord
  schemaVersion: typeof REPLAY_RENDER_SCHEMA_VERSION
}>

function isPlainDataObject(value: unknown, description: string): Record<string, unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw new TypeError(`${description} must be a plain object`)
  }

  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string") {
      throw new TypeError(`${description} must use string keys`)
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
      throw new TypeError(`${description} properties must be enumerable data values`)
    }
  }

  return value as Record<string, unknown>
}

function exactObject(value: unknown, keys: readonly string[], description: string): Record<string, unknown> {
  const object = isPlainDataObject(value, description)
  const actualKeys = Reflect.ownKeys(object)
  if (
    actualKeys.length !== keys.length ||
    actualKeys.some((key) => typeof key !== "string" || !keys.includes(key)) ||
    keys.some((key) => !Object.hasOwn(object, key))
  ) {
    throw new TypeError(`${description} has missing or unrecognized fields`)
  }
  return object
}

function objectWithOptionalFields(
  value: unknown,
  allowedKeys: readonly string[],
  requiredKeys: readonly string[],
  description: string
): Record<string, unknown> {
  const object = isPlainDataObject(value, description)
  const actualKeys = Reflect.ownKeys(object)
  if (
    actualKeys.some((key) => typeof key !== "string" || !allowedKeys.includes(key)) ||
    requiredKeys.some((key) => !Object.hasOwn(object, key))
  ) {
    throw new TypeError(`${description} has missing or unrecognized fields`)
  }
  return object
}

function exactArray(value: unknown, description: string, maximumLength: number): readonly unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > maximumLength) {
    throw new RangeError(`${description} must be an array of at most ${maximumLength} entries`)
  }

  const expectedKeys = new Set<string>(["length", ...value.map((_, index) => `${index}`)])
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string" || !expectedKeys.has(key)) {
      throw new TypeError(`${description} has unrecognized fields`)
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || (key !== "length" && !descriptor.enumerable) || !("value" in descriptor)) {
      throw new TypeError(`${description} entries must be enumerable data values`)
    }
  }
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.hasOwn(value, index)) {
      throw new TypeError(`${description} cannot contain sparse entries`)
    }
  }
  return value
}

function assertIdentifier(value: unknown, description: string): asserts value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_REPLAY_RENDER_STRING_LENGTH) {
    throw new RangeError(`${description} must be a bounded identifier`)
  }
}

function assertSafeInteger(value: unknown, description: string): asserts value is number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new RangeError(`${description} must be a safe integer`)
  }
}

function assertNonnegativeSafeInteger(value: unknown, description: string): asserts value is number {
  assertSafeInteger(value, description)
  if (value < 0) {
    throw new RangeError(`${description} must be non-negative`)
  }
}

function validateSignal(value: unknown): void {
  const signal = exactObject(value, ["audible", "latched", "visual"], "Replay signal")
  if (signal.audible !== "none" && signal.audible !== "requested") {
    throw new TypeError("Replay signal audible value is unknown")
  }
  if (typeof signal.latched !== "boolean") {
    throw new TypeError("Replay signal latched value must be boolean")
  }
  if (
    signal.visual !== "diagnostic" &&
    signal.visual !== "none" &&
    signal.visual !== "off-target" &&
    signal.visual !== "valid-hit"
  ) {
    throw new TypeError("Replay signal visual value is unknown")
  }
}

function validateCaptureWindow(value: unknown): void {
  const window = exactObject(value, ["firstSequence", "fromUs", "lastSequence", "throughUs"], "Replay capture window")
  assertNonnegativeSafeInteger(window.firstSequence, "Replay capture first sequence")
  assertNonnegativeSafeInteger(window.lastSequence, "Replay capture last sequence")
  assertNonnegativeSafeInteger(window.fromUs, "Replay capture start timestamp")
  assertNonnegativeSafeInteger(window.throughUs, "Replay capture end timestamp")
  if (window.lastSequence < window.firstSequence || window.throughUs < window.fromUs) {
    throw new RangeError("Replay capture window bounds must be ordered")
  }
}

function validateProvenance(value: unknown): void {
  const provenance = exactObject(
    value,
    [
      "calibrationProfileRevision",
      "firmware",
      "hardwareRevision",
      "lineContractRevision",
      "ruleSetRevision",
      "timingTableRevision"
    ],
    "Replay provenance"
  )
  const firmware = exactObject(
    provenance.firmware,
    ["buildDigest", "identity", "scoringBootId"],
    "Replay firmware provenance"
  )
  assertIdentifier(provenance.calibrationProfileRevision, "Replay calibration profile revision")
  assertIdentifier(provenance.hardwareRevision, "Replay hardware revision")
  assertIdentifier(provenance.lineContractRevision, "Replay line-contract revision")
  assertIdentifier(provenance.ruleSetRevision, "Replay rule-set revision")
  assertIdentifier(provenance.timingTableRevision, "Replay timing-table revision")
  assertIdentifier(firmware.identity, "Replay firmware identity")
  assertIdentifier(firmware.scoringBootId, "Replay scoring boot ID")
  if (typeof firmware.buildDigest !== "string" || !/^sha256:[0-9a-f]{64}$/u.test(firmware.buildDigest)) {
    throw new TypeError("Replay firmware build digest must be a lowercase SHA-256 digest")
  }
}

function validateRawCaptureReferences(value: unknown): void {
  const references = exactArray(value, "Replay raw capture references", MAX_RAW_CAPTURE_REFERENCES)
  for (const reference of references) {
    const raw = exactObject(
      reference,
      [
        "captureId",
        "contentDigest",
        "contentFormatRevision",
        "firstSequence",
        "fromUs",
        "kind",
        "lastSequence",
        "sampleCount",
        "throughUs"
      ],
      "Replay raw capture reference"
    )
    assertIdentifier(raw.captureId, "Replay capture ID")
    assertIdentifier(raw.contentFormatRevision, "Replay capture format revision")
    if (typeof raw.contentDigest !== "string" || !/^sha256:[0-9a-f]{64}$/u.test(raw.contentDigest)) {
      throw new TypeError("Replay capture content digest must be a lowercase SHA-256 digest")
    }
    assertNonnegativeSafeInteger(raw.firstSequence, "Replay capture reference first sequence")
    assertNonnegativeSafeInteger(raw.lastSequence, "Replay capture reference last sequence")
    assertNonnegativeSafeInteger(raw.fromUs, "Replay capture reference start timestamp")
    assertNonnegativeSafeInteger(raw.throughUs, "Replay capture reference end timestamp")
    assertNonnegativeSafeInteger(raw.sampleCount, "Replay capture reference sample count")
    if (raw.lastSequence < raw.firstSequence || raw.throughUs < raw.fromUs) {
      throw new RangeError("Replay raw capture reference bounds must be ordered")
    }
    if (
      raw.kind !== "acquisition-samples" &&
      raw.kind !== "calibration-measurements" &&
      raw.kind !== "fault-context" &&
      raw.kind !== "reset-context"
    ) {
      throw new TypeError("Replay raw capture reference kind is unknown")
    }
  }
}

function validateOutcome(value: unknown): void {
  const outcome = isPlainDataObject(value, "Replay outcome")
  validateSignal(outcome.signal)
  if (typeof outcome.disposition !== "string") {
    throw new TypeError("Replay outcome disposition is required")
  }

  const fieldsByDisposition: Readonly<Record<DecisionRecordOutcome["disposition"], readonly string[]>> = {
    calibration: ["calibrationId", "disposition", "performedAtUs", "signal", "status"],
    "line-fault": ["detectedAtUs", "diagnostic", "disposition", "lineId", "persistence", "side", "signal"],
    "off-target": ["disposition", "qualifiedAtUs", "side", "signal", "weapon"],
    "qualified-hit": ["disposition", "hitStartedAtUs", "qualifiedAtUs", "side", "signal", "weapon"],
    "rejected-contact": ["attemptedAtUs", "attemptedSide", "disposition", "reason", "signal", "weapon"],
    reset: ["cause", "disposition", "resetAtUs", "scope", "signal"],
    uncertainty: ["disposition", "effect", "lowerBound", "observedAtUs", "signal", "subject", "unit", "upperBound"]
  }
  const fields = fieldsByDisposition[outcome.disposition as DecisionRecordOutcome["disposition"]]
  if (fields === undefined) {
    throw new TypeError("Replay outcome disposition is unknown")
  }
  exactObject(value, fields, "Replay outcome")
  for (const field of fields) {
    if (field.endsWith("AtUs") || field === "lowerBound" || field === "upperBound") {
      assertNonnegativeSafeInteger(outcome[field], `Replay outcome ${field}`)
    }
  }
  for (const field of ["calibrationId", "lineId"] as const) {
    if (Object.hasOwn(outcome, field)) {
      assertIdentifier(outcome[field], `Replay outcome ${field}`)
    }
  }
  if (
    outcome.disposition === "line-fault" &&
    outcome.side !== null &&
    outcome.side !== "left" &&
    outcome.side !== "right"
  ) {
    throw new TypeError("Replay line-fault side is unknown")
  }
}

function validateRecord(value: unknown): DecisionRecord {
  const record = exactObject(
    value,
    ["captureWindow", "decisionAtUs", "outcome", "provenance", "rawCaptureRefs", "recordId", "schemaVersion"],
    "Replay decision record"
  )
  assertIdentifier(record.recordId, "Replay record ID")
  assertNonnegativeSafeInteger(record.decisionAtUs, "Replay decision timestamp")
  validateCaptureWindow(record.captureWindow)
  validateProvenance(record.provenance)
  validateRawCaptureReferences(record.rawCaptureRefs)
  validateOutcome(record.outcome)
  return parseDecisionRecord(record)
}

function validateWallClock(value: unknown): void {
  const wallClock = isPlainDataObject(value, "Replay wall-clock metadata")
  if (wallClock.status !== "bounded" && wallClock.status !== "unavailable") {
    throw new TypeError("Replay wall-clock status is unknown")
  }
  if (wallClock.status === "bounded") {
    exactObject(
      value,
      [
        "anchorId",
        "correctionFromPreviousUs",
        "estimatedAtUs",
        "lowerBoundUs",
        "source",
        "status",
        "uncertaintyUs",
        "upperBoundUs"
      ],
      "Replay bounded wall-clock metadata"
    )
    assertIdentifier(wallClock.anchorId, "Replay wall-clock anchor ID")
    if (wallClock.correctionFromPreviousUs !== null) {
      assertSafeInteger(wallClock.correctionFromPreviousUs, "Replay wall-clock correction")
    }
    assertSafeInteger(wallClock.estimatedAtUs, "Replay wall-clock estimate")
    assertSafeInteger(wallClock.lowerBoundUs, "Replay wall-clock lower bound")
    assertSafeInteger(wallClock.upperBoundUs, "Replay wall-clock upper bound")
    assertNonnegativeSafeInteger(wallClock.uncertaintyUs, "Replay wall-clock uncertainty")
    if (wallClock.source !== "network-time" && wallClock.source !== "rtc") {
      throw new TypeError("Replay wall-clock source is unknown")
    }
    if (
      wallClock.lowerBoundUs > wallClock.upperBoundUs ||
      wallClock.estimatedAtUs < wallClock.lowerBoundUs ||
      wallClock.estimatedAtUs > wallClock.upperBoundUs
    ) {
      throw new RangeError("Replay wall-clock bounds must contain the estimate")
    }
    const expectedLowerBoundUs = wallClock.estimatedAtUs - wallClock.uncertaintyUs
    const expectedUpperBoundUs = wallClock.estimatedAtUs + wallClock.uncertaintyUs
    if (!Number.isSafeInteger(expectedLowerBoundUs) || !Number.isSafeInteger(expectedUpperBoundUs)) {
      throw new RangeError("Replay wall-clock bound arithmetic exceeds the safe integer range")
    }
    if (wallClock.lowerBoundUs !== expectedLowerBoundUs || wallClock.upperBoundUs !== expectedUpperBoundUs) {
      throw new RangeError("Replay wall-clock bounds must equal estimate plus or minus uncertainty")
    }
    return
  }

  exactObject(value, ["reason", "status"], "Replay unavailable wall-clock metadata")
  if (
    wallClock.reason !== "anchor-after-decision" &&
    wallClock.reason !== "offline" &&
    wallClock.reason !== "stale-anchor"
  ) {
    throw new TypeError("Replay wall-clock reason is unknown")
  }
}

function validateApplicationTime(value: unknown, record: DecisionRecord): ApplicationTimelineEntry {
  const application = exactObject(
    value,
    ["applicationBootId", "applicationSequence", "decisionRecordId", "monotonic", "ordering", "wallClock"],
    "Replay application time metadata"
  )
  assertIdentifier(application.applicationBootId, "Replay application boot ID")
  assertNonnegativeSafeInteger(application.applicationSequence, "Replay application sequence")
  assertIdentifier(application.decisionRecordId, "Replay application decision record ID")
  if (application.decisionRecordId !== record.recordId) {
    throw new RangeError("Replay application metadata must identify the rendered record")
  }

  const monotonic = exactObject(application.monotonic, ["decisionAtUs", "scoringBootId"], "Replay monotonic metadata")
  assertNonnegativeSafeInteger(monotonic.decisionAtUs, "Replay monotonic decision timestamp")
  assertIdentifier(monotonic.scoringBootId, "Replay monotonic scoring boot ID")
  if (
    monotonic.decisionAtUs !== record.decisionAtUs ||
    monotonic.scoringBootId !== record.provenance.firmware.scoringBootId
  ) {
    throw new RangeError("Replay application metadata must preserve STM32 time and boot identity")
  }

  const ordering = exactObject(
    application.ordering,
    [
      "previousApplicationRecordId",
      "previousScoringBootRecordId",
      "relationToPreviousApplicationRecord",
      "relationWithinScoringBoot"
    ],
    "Replay application ordering metadata"
  )
  for (const key of ["previousApplicationRecordId", "previousScoringBootRecordId"] as const) {
    if (ordering[key] !== null) {
      assertIdentifier(ordering[key], `Replay ${key}`)
    }
  }
  if (
    ordering.relationToPreviousApplicationRecord !== "first" &&
    ordering.relationToPreviousApplicationRecord !== "indeterminate-across-scoring-boots" &&
    ordering.relationToPreviousApplicationRecord !== "ordered"
  ) {
    throw new TypeError("Replay application ordering relation is unknown")
  }
  if ((ordering.relationToPreviousApplicationRecord === "first") !== (ordering.previousApplicationRecordId === null)) {
    throw new RangeError("Replay application first relation must match its previous record ID")
  }
  if (
    ordering.relationWithinScoringBoot !== "first" &&
    ordering.relationWithinScoringBoot !== "ordered" &&
    ordering.relationWithinScoringBoot !== "same-authority-instant"
  ) {
    throw new TypeError("Replay within-boot ordering relation is unknown")
  }
  if ((ordering.relationWithinScoringBoot === "first") !== (ordering.previousScoringBootRecordId === null)) {
    throw new RangeError("Replay within-boot first relation must match its previous record ID")
  }
  validateWallClock(application.wallClock)
  return application as unknown as ApplicationTimelineEntry
}

function cloneSignal(value: SignalSnapshot): SignalSnapshot {
  return { audible: value.audible, latched: value.latched, visual: value.visual }
}

function cloneProvenance(value: RecordProvenance): RecordProvenance {
  return {
    calibrationProfileRevision: value.calibrationProfileRevision,
    firmware: {
      buildDigest: value.firmware.buildDigest,
      identity: value.firmware.identity,
      scoringBootId: value.firmware.scoringBootId
    },
    hardwareRevision: value.hardwareRevision,
    lineContractRevision: value.lineContractRevision,
    ruleSetRevision: value.ruleSetRevision,
    timingTableRevision: value.timingTableRevision
  }
}

function cloneRawCaptureReference(value: RawCaptureReference): RawCaptureReference {
  return {
    captureId: value.captureId,
    contentDigest: value.contentDigest,
    contentFormatRevision: value.contentFormatRevision,
    firstSequence: value.firstSequence,
    fromUs: value.fromUs,
    kind: value.kind,
    lastSequence: value.lastSequence,
    sampleCount: value.sampleCount,
    throughUs: value.throughUs
  }
}

function cloneOutcome(value: DecisionRecordOutcome): DecisionRecordOutcome {
  switch (value.disposition) {
    case "calibration":
      return {
        calibrationId: value.calibrationId,
        disposition: value.disposition,
        performedAtUs: value.performedAtUs,
        signal: cloneSignal(value.signal),
        status: value.status
      }
    case "line-fault":
      return {
        detectedAtUs: value.detectedAtUs,
        diagnostic: value.diagnostic,
        disposition: value.disposition,
        lineId: value.lineId,
        persistence: value.persistence,
        side: value.side,
        signal: cloneSignal(value.signal)
      }
    case "off-target":
      return {
        disposition: value.disposition,
        qualifiedAtUs: value.qualifiedAtUs,
        side: value.side,
        signal: cloneSignal(value.signal),
        weapon: value.weapon
      }
    case "qualified-hit":
      return {
        disposition: value.disposition,
        hitStartedAtUs: value.hitStartedAtUs,
        qualifiedAtUs: value.qualifiedAtUs,
        side: value.side,
        signal: cloneSignal(value.signal),
        weapon: value.weapon
      }
    case "rejected-contact":
      return {
        attemptedAtUs: value.attemptedAtUs,
        attemptedSide: value.attemptedSide,
        disposition: value.disposition,
        reason: value.reason,
        signal: cloneSignal(value.signal),
        weapon: value.weapon
      }
    case "reset":
      return {
        cause: value.cause,
        disposition: value.disposition,
        resetAtUs: value.resetAtUs,
        scope: value.scope,
        signal: cloneSignal(value.signal)
      }
    case "uncertainty":
      return {
        disposition: value.disposition,
        effect: value.effect,
        lowerBound: value.lowerBound,
        observedAtUs: value.observedAtUs,
        signal: cloneSignal(value.signal),
        subject: value.subject,
        unit: value.unit,
        upperBound: value.upperBound
      }
  }
}

function cloneRecord(value: DecisionRecord): DecisionRecord {
  return {
    captureWindow: {
      firstSequence: value.captureWindow.firstSequence,
      fromUs: value.captureWindow.fromUs,
      lastSequence: value.captureWindow.lastSequence,
      throughUs: value.captureWindow.throughUs
    },
    decisionAtUs: value.decisionAtUs,
    outcome: cloneOutcome(value.outcome),
    provenance: cloneProvenance(value.provenance),
    rawCaptureRefs: value.rawCaptureRefs.map(cloneRawCaptureReference),
    recordId: value.recordId,
    schemaVersion: value.schemaVersion
  }
}

function cloneWallClock(value: WallClockMetadata): WallClockMetadata {
  return value.status === "bounded"
    ? {
        anchorId: value.anchorId,
        correctionFromPreviousUs: value.correctionFromPreviousUs,
        estimatedAtUs: value.estimatedAtUs,
        lowerBoundUs: value.lowerBoundUs,
        source: value.source,
        status: value.status,
        uncertaintyUs: value.uncertaintyUs,
        upperBoundUs: value.upperBoundUs
      }
    : { reason: value.reason, status: value.status }
}

function cloneApplicationTime(value: ApplicationTimelineEntry): ApplicationTimelineEntry {
  return {
    applicationBootId: value.applicationBootId,
    applicationSequence: value.applicationSequence,
    decisionRecordId: value.decisionRecordId,
    monotonic: {
      decisionAtUs: value.monotonic.decisionAtUs,
      scoringBootId: value.monotonic.scoringBootId
    },
    ordering: {
      previousApplicationRecordId: value.ordering.previousApplicationRecordId,
      previousScoringBootRecordId: value.ordering.previousScoringBootRecordId,
      relationToPreviousApplicationRecord: value.ordering.relationToPreviousApplicationRecord,
      relationWithinScoringBoot: value.ordering.relationWithinScoringBoot
    },
    wallClock: cloneWallClock(value.wallClock)
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

function serializedByteLength(value: ReplayRenderModel): number {
  const serialized = JSON.stringify(value)
  const bytes = new TextEncoder().encode(serialized).byteLength
  /* v8 ignore next -- field-level bounds make this aggregate ceiling defensive and unreachable. */
  if (bytes > MAX_REPLAY_RENDER_RECORD_BYTES) {
    throw new RangeError(`Replay render model cannot exceed ${MAX_REPLAY_RENDER_RECORD_BYTES} bytes`)
  }
  return bytes
}

/**
 * Validates and renders one stored authoritative record. No samples are fed
 * into a scorer and no decision is recomputed.
 */
export function renderReplayRecord(value: ReplayRenderInput): ReplayRenderModel {
  const input = objectWithOptionalFields(value, ["applicationTime", "record"], ["record"], "Replay renderer input")
  const record = validateRecord(input.record)
  const applicationTime =
    !Object.hasOwn(input, "applicationTime") || input.applicationTime === null
      ? null
      : validateApplicationTime(input.applicationTime, record)
  const model = deepFreeze({
    applicationTime: applicationTime === null ? null : cloneApplicationTime(applicationTime),
    record: cloneRecord(record),
    schemaVersion: REPLAY_RENDER_SCHEMA_VERSION as typeof REPLAY_RENDER_SCHEMA_VERSION
  })
  serializedByteLength(model)
  return model
}
