/**
 * M2-11 stored-record replay renderer.
 *
 * This module validates and clones an already-authoritative decision record.
 * It deliberately has no dependency on a weapon scorer, timing table, or
 * front-end implementation: replay is presentation of recorded meaning, not
 * a second decision path.
 */

import {
  parseApplicationTimeMetadata,
  type ApplicationTimelineEntry,
  type WallClockMetadata
} from "./application-time-metadata.js"
import {
  parseDecisionRecord,
  type DecisionRecord,
  type DecisionRecordOutcome,
  type RecordProvenance,
  type RawCaptureReference
} from "./decision-record.js"

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

function cloneSignal(value: DecisionRecordOutcome["signal"]): DecisionRecordOutcome["signal"] {
  return { audible: value.audible, latched: value.latched, visual: value.visual }
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
      if (value.subject === "identity") {
        return {
          disposition: value.disposition,
          effect: value.effect,
          identity: {
            field: value.identity.field,
            observed: value.identity.observed,
            status: value.identity.status
          },
          lowerBound: value.lowerBound,
          observedAtUs: value.observedAtUs,
          signal: cloneSignal(value.signal),
          subject: value.subject,
          unit: value.unit,
          upperBound: value.upperBound
        }
      }
      if (value.subject === "resistance") {
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
      if (value.subject === "clock" || value.subject === "timing") {
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
      return {
        disposition: value.disposition,
        effect: value.effect,
        lowerBound: value.lowerBound,
        observedAtUs: value.observedAtUs,
        signal: cloneSignal(value.signal),
        subject: value.subject,
        unit: null,
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
  const parsedRecord = parseDecisionRecord(input.record)
  const parsedApplicationTime =
    !Object.hasOwn(input, "applicationTime") || input.applicationTime === null
      ? null
      : parseApplicationTimeMetadata(input.applicationTime, parsedRecord)
  const record = cloneRecord(parsedRecord)
  const applicationTime = parsedApplicationTime === null ? null : cloneApplicationTime(parsedApplicationTime)
  const model = deepFreeze({
    applicationTime,
    record,
    schemaVersion: REPLAY_RENDER_SCHEMA_VERSION as typeof REPLAY_RENDER_SCHEMA_VERSION
  })
  serializedByteLength(model)
  return model
}
