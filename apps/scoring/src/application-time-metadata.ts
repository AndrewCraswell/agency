/**
 * M2-09 host-side application time metadata.
 *
 * The STM32 decision timestamp is the scoring authority. This module only
 * attaches bounded, explicitly uncertain wall-clock metadata after a decision
 * has been accepted by the application. It never changes a decision record.
 */

import { parseDecisionRecord, type DecisionRecord } from "./decision-record.js"
import { strictDataObject, strictExactDataObject } from "./strict-data-object.js"

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
  const object = strictDataObject(value, description, `${description} contains an unknown property`)
  const keys = Reflect.ownKeys(object)
  for (const key of keys) {
    if (typeof key !== "string" || !allowedKeys.includes(key)) {
      throw new TypeError(`${description} contains an unknown property`)
    }
  }
  for (const key of requiredKeys) {
    if (!Object.hasOwn(object, key)) {
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

function parseWallClockMetadata(value: unknown): WallClockMetadata {
  const wallClock = strictDataObject(value, "Application wall-clock metadata")
  if (wallClock.status === "bounded") {
    const bounded = strictExactDataObject(
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
      "Application bounded wall-clock metadata"
    )
    assertIdentifier(bounded.anchorId, "Application wall-clock anchor ID")
    if (bounded.correctionFromPreviousUs !== null) {
      assertSafeInteger(bounded.correctionFromPreviousUs, "Application wall-clock correction")
    }
    assertSafeInteger(bounded.estimatedAtUs, "Application wall-clock estimate")
    assertSafeInteger(bounded.lowerBoundUs, "Application wall-clock lower bound")
    assertSafeInteger(bounded.upperBoundUs, "Application wall-clock upper bound")
    assertNonnegativeSafeInteger(bounded.uncertaintyUs, "Application wall-clock uncertainty")
    if (bounded.source !== "network-time" && bounded.source !== "rtc") {
      throw new TypeError("Application wall-clock source is unknown")
    }
    if (
      bounded.lowerBoundUs > bounded.upperBoundUs ||
      bounded.estimatedAtUs < bounded.lowerBoundUs ||
      bounded.estimatedAtUs > bounded.upperBoundUs
    ) {
      throw new RangeError("Application wall-clock bounds must contain the estimate")
    }
    const expectedLowerBoundUs = checkedSubtract(
      bounded.estimatedAtUs,
      bounded.uncertaintyUs,
      "Application wall-clock lower bound arithmetic"
    )
    const expectedUpperBoundUs = checkedAdd(
      bounded.estimatedAtUs,
      bounded.uncertaintyUs,
      "Application wall-clock upper bound arithmetic"
    )
    if (bounded.lowerBoundUs !== expectedLowerBoundUs || bounded.upperBoundUs !== expectedUpperBoundUs) {
      throw new RangeError("Application wall-clock bounds must equal estimate plus or minus uncertainty")
    }
    return freezeWallClock({
      anchorId: bounded.anchorId,
      correctionFromPreviousUs: bounded.correctionFromPreviousUs,
      estimatedAtUs: bounded.estimatedAtUs,
      lowerBoundUs: bounded.lowerBoundUs,
      source: bounded.source,
      status: "bounded",
      uncertaintyUs: bounded.uncertaintyUs,
      upperBoundUs: bounded.upperBoundUs
    })
  }

  if (wallClock.status !== "unavailable") {
    throw new TypeError("Application wall-clock status is unknown")
  }
  const unavailable = strictExactDataObject(value, ["reason", "status"], "Application unavailable wall-clock metadata")
  if (
    unavailable.reason !== "anchor-after-decision" &&
    unavailable.reason !== "offline" &&
    unavailable.reason !== "stale-anchor"
  ) {
    throw new TypeError("Application wall-clock reason is unknown")
  }
  return freezeWallClock({ reason: unavailable.reason, status: "unavailable" })
}

/**
 * Parses application-owned metadata against the authoritative record it
 * annotates. The returned value is a new deeply frozen projection, so replay
 * and other consumers cannot retain mutable or accessor-backed input objects.
 */
export function parseApplicationTimeMetadata(
  value: unknown,
  associatedRecord: DecisionRecord
): ApplicationTimelineEntry {
  const record = parseDecisionRecord(associatedRecord)
  const application = strictExactDataObject(
    value,
    ["applicationBootId", "applicationSequence", "decisionRecordId", "monotonic", "ordering", "wallClock"],
    "Application time metadata"
  )
  assertIdentifier(application.applicationBootId, "Application boot ID")
  assertNonnegativeSafeInteger(application.applicationSequence, "Application sequence")
  assertIdentifier(application.decisionRecordId, "Application decision record ID")
  if (application.decisionRecordId !== record.recordId) {
    throw new RangeError("Application metadata must identify the rendered record")
  }

  const monotonic = strictExactDataObject(
    application.monotonic,
    ["decisionAtUs", "scoringBootId"],
    "Application monotonic metadata"
  )
  assertNonnegativeSafeInteger(monotonic.decisionAtUs, "Application monotonic decision timestamp")
  assertIdentifier(monotonic.scoringBootId, "Application monotonic scoring boot ID")
  if (
    monotonic.decisionAtUs !== record.decisionAtUs ||
    monotonic.scoringBootId !== record.provenance.firmware.scoringBootId
  ) {
    throw new RangeError("Application metadata must preserve STM32 time and boot identity")
  }

  const ordering = strictExactDataObject(
    application.ordering,
    [
      "previousApplicationRecordId",
      "previousScoringBootRecordId",
      "relationToPreviousApplicationRecord",
      "relationWithinScoringBoot"
    ],
    "Application ordering metadata"
  )
  let previousApplicationRecordId: string | null
  let previousScoringBootRecordId: string | null
  const previousApplicationRecordIdValue = ordering.previousApplicationRecordId
  const previousScoringBootRecordIdValue = ordering.previousScoringBootRecordId
  if (previousApplicationRecordIdValue === null) {
    previousApplicationRecordId = null
  } else {
    assertIdentifier(previousApplicationRecordIdValue, "Application previous application record ID")
    previousApplicationRecordId = previousApplicationRecordIdValue
  }
  if (previousScoringBootRecordIdValue === null) {
    previousScoringBootRecordId = null
  } else {
    assertIdentifier(previousScoringBootRecordIdValue, "Application previous scoring-boot record ID")
    previousScoringBootRecordId = previousScoringBootRecordIdValue
  }
  if (
    ordering.relationToPreviousApplicationRecord !== "first" &&
    ordering.relationToPreviousApplicationRecord !== "indeterminate-across-scoring-boots" &&
    ordering.relationToPreviousApplicationRecord !== "ordered"
  ) {
    throw new TypeError("Application ordering relation is unknown")
  }
  if ((ordering.relationToPreviousApplicationRecord === "first") !== (previousApplicationRecordId === null)) {
    throw new RangeError("Application first relation must match its previous record ID")
  }
  if (
    ordering.relationWithinScoringBoot !== "first" &&
    ordering.relationWithinScoringBoot !== "ordered" &&
    ordering.relationWithinScoringBoot !== "same-authority-instant"
  ) {
    throw new TypeError("Application within-boot ordering relation is unknown")
  }
  if ((ordering.relationWithinScoringBoot === "first") !== (previousScoringBootRecordId === null)) {
    throw new RangeError("Application within-boot first relation must match its previous record ID")
  }

  return freeze({
    applicationBootId: application.applicationBootId,
    applicationSequence: application.applicationSequence,
    decisionRecordId: application.decisionRecordId,
    monotonic: freeze({
      decisionAtUs: monotonic.decisionAtUs,
      scoringBootId: monotonic.scoringBootId
    }),
    ordering: freeze({
      previousApplicationRecordId,
      previousScoringBootRecordId,
      relationToPreviousApplicationRecord: ordering.relationToPreviousApplicationRecord,
      relationWithinScoringBoot: ordering.relationWithinScoringBoot
    }),
    wallClock: parseWallClockMetadata(application.wallClock)
  })
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
