/**
 * M2-11 stored-record replay renderer.
 *
 * This module validates and clones an already-authoritative decision record.
 * It deliberately has no dependency on a weapon scorer, timing table, or
 * front-end implementation: replay is presentation of recorded meaning, not
 * a second decision path.
 */

import type { ApplicationTimelineEntry, WallClockMetadata } from "./application-time-metadata.js"
import { parseDecisionRecord, type DecisionRecord } from "./decision-record.js"

export const REPLAY_RENDER_SCHEMA_VERSION = 1
export const MAX_REPLAY_RENDER_STRING_LENGTH = 256
export const MAX_REPLAY_RENDER_RECORD_BYTES = 65_536

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
  const record = parseDecisionRecord(input.record)
  const applicationTime =
    !Object.hasOwn(input, "applicationTime") || input.applicationTime === null
      ? null
      : validateApplicationTime(input.applicationTime, record)
  const model = deepFreeze({
    applicationTime: applicationTime === null ? null : cloneApplicationTime(applicationTime),
    record,
    schemaVersion: REPLAY_RENDER_SCHEMA_VERSION as typeof REPLAY_RENDER_SCHEMA_VERSION
  })
  serializedByteLength(model)
  return model
}
