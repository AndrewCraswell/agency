/**
 * M2-11 stored-record replay renderer.
 *
 * This module validates and clones an already-authoritative decision record.
 * It deliberately has no dependency on a weapon scorer, timing table, or
 * front-end implementation: replay is presentation of recorded meaning, not
 * a second decision path.
 */

import { parseApplicationTimeMetadata, type ApplicationTimelineEntry } from "./application-time-metadata.js"
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
      : parseApplicationTimeMetadata(input.applicationTime, record)
  const model = deepFreeze({
    applicationTime,
    record,
    schemaVersion: REPLAY_RENDER_SCHEMA_VERSION as typeof REPLAY_RENDER_SCHEMA_VERSION
  })
  serializedByteLength(model)
  return model
}
