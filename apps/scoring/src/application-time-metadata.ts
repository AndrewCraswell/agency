/**
 * M2-09 host-side application time metadata.
 *
 * The STM32 decision timestamp is the scoring authority. This module only
 * attaches bounded, explicitly uncertain wall-clock metadata after a decision
 * has been accepted by the application. It never changes a decision record.
 */

import { parseDecisionRecord, type DecisionRecord } from "./decision-record.js"

export const DEFAULT_APPLICATION_TIME_MAX_ANCHORS = 16
export const DEFAULT_APPLICATION_TIME_MAX_ENTRIES = 32
export const MAX_APPLICATION_TIME_ANCHORS = 32
export const MAX_APPLICATION_TIME_ENTRIES = 32
export const MAX_APPLICATION_TIME_DRIFT_PPM = 1_000_000

export type WallClockAnchor = Readonly<{
  anchorId: string
  /** STM32 microseconds within the named scoring boot. */
  sampledAtUs: number
  scoringBootId: string
  source: "network-time" | "rtc"
  /** A UTC-like wall-clock coordinate. It may be negative before the epoch. */
  wallClockAtUs: number
  /** Declared error bound at sampledAtUs, not a protocol accuracy claim. */
  uncertaintyUs: number
}>

export type AppliedWallClockAnchor = Readonly<
  WallClockAnchor & {
    correctionFromPreviousUs: number | null
  }
>

export type WallClockMetadata =
  | Readonly<{
      anchorId: string
      correctionFromPreviousUs: number | null
      estimatedAtUs: number
      lowerBoundUs: number
      source: "network-time" | "rtc"
      status: "bounded"
      uncertaintyUs: number
      upperBoundUs: number
    }>
  | Readonly<{
      reason: "anchor-after-decision" | "offline" | "stale-anchor"
      status: "unavailable"
    }>

export type ApplicationTimelineEntry = Readonly<{
  applicationBootId: string
  applicationSequence: number
  decisionRecordId: string
  monotonic: Readonly<{
    decisionAtUs: number
    scoringBootId: string
  }>
  ordering: Readonly<{
    previousApplicationRecordId: string | null
    previousScoringBootRecordId: string | null
    relationToPreviousApplicationRecord: "first" | "indeterminate-across-scoring-boots" | "ordered"
    relationWithinScoringBoot: "first" | "ordered" | "same-authority-instant"
  }>
  wallClock: WallClockMetadata
}>

export type ApplicationTimeMetadataOptions = Readonly<{
  applicationBootId: string
  /** A declared upper drift bound. The model does not assume a crystal accuracy. */
  maximumDriftPpm: number
  maxAnchorAgeUs?: number
  maxAnchors?: number
  maxEntries?: number
}>

export type ApplicationTimeMetadata = Readonly<{
  readonly anchors: readonly AppliedWallClockAnchor[]
  readonly applicationBootId: string
  observe: (record: DecisionRecord) => ApplicationTimelineEntry
  synchronize: (anchor: WallClockAnchor) => AppliedWallClockAnchor
  readonly timeline: readonly ApplicationTimelineEntry[]
}>

type OrderingKey = Readonly<{
  decisionAtUs: number
  firstSequence: number
  lastSequence: number
}>

const DEFAULT_MAX_ANCHOR_AGE_US = 86_400_000_000
const MAX_IDENTIFIER_LENGTH = 128

function assertIdentifier(value: unknown, description: string): asserts value is string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > MAX_IDENTIFIER_LENGTH ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(value)
  ) {
    throw new TypeError(`${description} must be a bounded identifier`)
  }
}

function assertNonnegativeSafeInteger(value: unknown, description: string): asserts value is number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${description} must be a non-negative safe integer`)
  }
}

function assertSafeInteger(value: unknown, description: string): asserts value is number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new RangeError(`${description} must be a safe integer`)
  }
}

function assertBoundedCount(value: unknown, description: string, maximum: number): asserts value is number {
  assertNonnegativeSafeInteger(value, description)
  if (value === 0 || value > maximum) {
    throw new RangeError(`${description} must be from 1 through ${maximum}`)
  }
}

function assertPublicDataObject(
  value: unknown,
  description: string,
  allowedKeys: readonly string[],
  requiredKeys: readonly string[]
): asserts value is Record<string, unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw new TypeError(`${description} must be a plain object`)
  }
  const keys = Reflect.ownKeys(value)
  for (const key of keys) {
    if (typeof key !== "string" || !allowedKeys.includes(key)) {
      throw new TypeError(`${description} contains an unknown property`)
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
      throw new TypeError(`${description} properties must be enumerable data values`)
    }
  }
  for (const key of requiredKeys) {
    if (!Object.hasOwn(value, key)) {
      throw new TypeError(`${description} requires ${key}`)
    }
  }
}

function assertAnchor(value: unknown): asserts value is WallClockAnchor {
  assertPublicDataObject(
    value,
    "Wall-clock anchor",
    ["anchorId", "sampledAtUs", "scoringBootId", "source", "uncertaintyUs", "wallClockAtUs"],
    ["anchorId", "sampledAtUs", "scoringBootId", "source", "uncertaintyUs", "wallClockAtUs"]
  )
  const anchor = value
  assertIdentifier(anchor.anchorId, "Wall-clock anchor ID")
  assertNonnegativeSafeInteger(anchor.sampledAtUs, "Wall-clock anchor sampled timestamp")
  assertIdentifier(anchor.scoringBootId, "Wall-clock anchor scoring boot ID")
  if (anchor.source !== "network-time" && anchor.source !== "rtc") {
    throw new TypeError("Wall-clock anchor source must be network-time or rtc")
  }
  assertSafeInteger(anchor.wallClockAtUs, "Wall-clock anchor timestamp")
  assertNonnegativeSafeInteger(anchor.uncertaintyUs, "Wall-clock anchor uncertainty")
}

function freeze<T>(value: T): T {
  return Object.freeze(value)
}

function freezeWallClock(value: WallClockMetadata): WallClockMetadata {
  return freeze({ ...value })
}

function orderingKey(record: DecisionRecord): OrderingKey {
  return freeze({
    decisionAtUs: record.decisionAtUs,
    firstSequence: record.captureWindow.firstSequence,
    lastSequence: record.captureWindow.lastSequence
  })
}

/** Returns zero only when the source did not supply an ordering distinction. */
function compareOrderingKeys(left: OrderingKey, right: OrderingKey): number {
  if (left.decisionAtUs !== right.decisionAtUs) {
    return left.decisionAtUs < right.decisionAtUs ? -1 : 1
  }
  if (left.firstSequence !== right.firstSequence) {
    return left.firstSequence < right.firstSequence ? -1 : 1
  }
  if (left.lastSequence !== right.lastSequence) {
    return left.lastSequence < right.lastSequence ? -1 : 1
  }
  return 0
}

function checkedAdd(left: number, right: number, description: string): number {
  const result = left + right
  if (!Number.isSafeInteger(result)) {
    throw new RangeError(`${description} exceeds the safe integer range`)
  }
  return result
}

function checkedSubtract(left: number, right: number, description: string): number {
  const result = left - right
  if (!Number.isSafeInteger(result)) {
    throw new RangeError(`${description} exceeds the safe integer range`)
  }
  return result
}

function driftUncertaintyUs(elapsedUs: number, maximumDriftPpm: number): number {
  const numerator = elapsedUs * maximumDriftPpm
  if (!Number.isSafeInteger(numerator)) {
    throw new RangeError("Wall-clock drift calculation exceeds the safe integer range")
  }
  return Math.ceil(numerator / 1_000_000)
}

function estimateFromAnchor(
  anchor: AppliedWallClockAnchor,
  decisionAtUs: number,
  maxAnchorAgeUs: number,
  maximumDriftPpm: number
): WallClockMetadata {
  if (decisionAtUs < anchor.sampledAtUs) {
    return freezeWallClock({ reason: "anchor-after-decision", status: "unavailable" })
  }
  const elapsedUs = decisionAtUs - anchor.sampledAtUs
  if (elapsedUs > maxAnchorAgeUs) {
    return freezeWallClock({ reason: "stale-anchor", status: "unavailable" })
  }
  const estimatedAtUs = checkedAdd(anchor.wallClockAtUs, elapsedUs, "Wall-clock estimate")
  const uncertaintyUs = checkedAdd(
    anchor.uncertaintyUs,
    driftUncertaintyUs(elapsedUs, maximumDriftPpm),
    "Wall-clock uncertainty"
  )
  return freezeWallClock({
    anchorId: anchor.anchorId,
    correctionFromPreviousUs: anchor.correctionFromPreviousUs,
    estimatedAtUs,
    lowerBoundUs: checkedSubtract(estimatedAtUs, uncertaintyUs, "Wall-clock lower bound"),
    source: anchor.source,
    status: "bounded",
    uncertaintyUs,
    upperBoundUs: checkedAdd(estimatedAtUs, uncertaintyUs, "Wall-clock upper bound")
  })
}

function findAnchor(
  anchors: readonly AppliedWallClockAnchor[],
  scoringBootId: string,
  decisionAtUs: number
): AppliedWallClockAnchor | null {
  let latestApplicable: AppliedWallClockAnchor | null = null
  let earliestLater: AppliedWallClockAnchor | null = null
  for (const anchor of anchors) {
    if (anchor.scoringBootId === scoringBootId) {
      if (anchor.sampledAtUs <= decisionAtUs) {
        latestApplicable = anchor
      } else if (earliestLater === null) {
        earliestLater = anchor
      }
    }
  }
  return latestApplicable ?? earliestLater
}

/**
 * Creates the ESP application-side projection. An application boot ID is
 * explicit because it must come from durable boot identity handling later in
 * firmware; silently generating one would hide a persistence failure.
 */
export function createApplicationTimeMetadata(options: ApplicationTimeMetadataOptions): ApplicationTimeMetadata {
  assertPublicDataObject(
    options,
    "Application time metadata options",
    ["applicationBootId", "maximumDriftPpm", "maxAnchorAgeUs", "maxAnchors", "maxEntries"],
    ["applicationBootId", "maximumDriftPpm"]
  )
  assertIdentifier(options.applicationBootId, "Application boot ID")
  assertNonnegativeSafeInteger(options.maximumDriftPpm, "Maximum drift PPM")
  if (options.maximumDriftPpm > MAX_APPLICATION_TIME_DRIFT_PPM) {
    throw new RangeError(`Maximum drift PPM cannot exceed ${MAX_APPLICATION_TIME_DRIFT_PPM}`)
  }
  const maxAnchorAgeUs = options.maxAnchorAgeUs ?? DEFAULT_MAX_ANCHOR_AGE_US
  const maxAnchors = options.maxAnchors ?? DEFAULT_APPLICATION_TIME_MAX_ANCHORS
  const maxEntries = options.maxEntries ?? DEFAULT_APPLICATION_TIME_MAX_ENTRIES
  assertNonnegativeSafeInteger(maxAnchorAgeUs, "Maximum anchor age")
  assertBoundedCount(maxAnchors, "Application time anchor capacity", MAX_APPLICATION_TIME_ANCHORS)
  assertBoundedCount(maxEntries, "Application time entry capacity", MAX_APPLICATION_TIME_ENTRIES)

  const anchors: AppliedWallClockAnchor[] = []
  const anchorIds = new Set<string>()
  const timeline: ApplicationTimelineEntry[] = []
  const recordIds = new Set<string>()
  const lastAnchorByScoringBoot = new Map<string, AppliedWallClockAnchor>()
  const lastEntryByScoringBoot = new Map<string, Readonly<{ key: OrderingKey; recordId: string }>>()

  function synchronize(value: WallClockAnchor): AppliedWallClockAnchor {
    assertAnchor(value)
    if (anchors.length === maxAnchors) {
      throw new RangeError("Application time anchor capacity is exhausted")
    }
    if (anchorIds.has(value.anchorId)) {
      throw new RangeError("Wall-clock anchor ID is already present")
    }

    const previous = lastAnchorByScoringBoot.get(value.scoringBootId)
    if (previous !== undefined && value.sampledAtUs <= previous.sampledAtUs) {
      throw new RangeError("Wall-clock anchors must advance within a scoring boot")
    }
    const correctionFromPreviousUs =
      previous === undefined
        ? null
        : checkedSubtract(
            value.wallClockAtUs,
            checkedAdd(previous.wallClockAtUs, value.sampledAtUs - previous.sampledAtUs, "Prior wall-clock estimate"),
            "Wall-clock correction"
          )
    const applied = freeze({
      anchorId: value.anchorId,
      correctionFromPreviousUs,
      sampledAtUs: value.sampledAtUs,
      scoringBootId: value.scoringBootId,
      source: value.source,
      uncertaintyUs: value.uncertaintyUs,
      wallClockAtUs: value.wallClockAtUs
    })
    anchors.push(applied)
    anchorIds.add(applied.anchorId)
    lastAnchorByScoringBoot.set(applied.scoringBootId, applied)
    return applied
  }

  function observe(value: DecisionRecord): ApplicationTimelineEntry {
    const record = parseDecisionRecord(value)
    if (timeline.length === maxEntries) {
      throw new RangeError("Application time entry capacity is exhausted")
    }
    if (recordIds.has(record.recordId)) {
      throw new RangeError("Application time metadata cannot order a duplicate record ID")
    }
    const scoringBootId = record.provenance.firmware.scoringBootId
    const key = orderingKey(record)
    const previousScoringBootEntry = lastEntryByScoringBoot.get(scoringBootId)
    const comparison =
      previousScoringBootEntry === undefined ? 1 : compareOrderingKeys(key, previousScoringBootEntry.key)
    if (comparison < 0) {
      throw new RangeError("Application time metadata received an ambiguous scoring-boot order")
    }

    const previousApplication = timeline.at(-1)
    const anchor = findAnchor(anchors, scoringBootId, record.decisionAtUs)
    const wallClock =
      anchor === null
        ? freezeWallClock({ reason: "offline", status: "unavailable" })
        : estimateFromAnchor(anchor, record.decisionAtUs, maxAnchorAgeUs, options.maximumDriftPpm)
    const relationToPreviousApplicationRecord: ApplicationTimelineEntry["ordering"]["relationToPreviousApplicationRecord"] =
      previousApplication === undefined
        ? "first"
        : previousApplication.monotonic.scoringBootId === scoringBootId
          ? "ordered"
          : "indeterminate-across-scoring-boots"
    const relationWithinScoringBoot: ApplicationTimelineEntry["ordering"]["relationWithinScoringBoot"] =
      previousScoringBootEntry === undefined ? "first" : comparison === 0 ? "same-authority-instant" : "ordered"
    const entry = freeze({
      applicationBootId: options.applicationBootId,
      applicationSequence: timeline.length,
      decisionRecordId: record.recordId,
      monotonic: freeze({ decisionAtUs: record.decisionAtUs, scoringBootId }),
      ordering: freeze({
        previousApplicationRecordId: previousApplication?.decisionRecordId ?? null,
        previousScoringBootRecordId: previousScoringBootEntry?.recordId ?? null,
        relationToPreviousApplicationRecord,
        relationWithinScoringBoot
      }),
      wallClock
    })
    timeline.push(entry)
    recordIds.add(record.recordId)
    lastEntryByScoringBoot.set(scoringBootId, freeze({ key, recordId: record.recordId }))
    return entry
  }

  return freeze({
    get anchors() {
      return freeze(anchors.slice())
    },
    applicationBootId: options.applicationBootId,
    observe,
    synchronize,
    get timeline() {
      return freeze(timeline.slice())
    }
  })
}
