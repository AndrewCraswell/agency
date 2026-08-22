/**
 * M0-05 logical decision record validation.
 *
 * This module deliberately does not encode, frame, journal, or transmit records.
 * Those concerns belong to M0-06 and M2.  It defines the immutable payload that
 * those later layers must preserve.
 */

export const DECISION_RECORD_SCHEMA_VERSION = 1
export const MAX_RAW_CAPTURE_REFERENCES = 8

export type DecisionSide = "left" | "right"
export type Weapon = "epee" | "foil" | "sabre"
type UncertaintySubject =
  | "calibration"
  | "capture-completeness"
  | "clock"
  | "identity"
  | "line-state"
  | "resistance"
  | "timing"

const UNCERTAINTY_SUBJECTS = [
  "calibration",
  "capture-completeness",
  "clock",
  "identity",
  "line-state",
  "resistance",
  "timing"
] as const satisfies readonly UncertaintySubject[]

const UNCERTAINTY_UNIT_BY_SUBJECT = {
  calibration: "none",
  "capture-completeness": "none",
  clock: "us",
  identity: "none",
  "line-state": "none",
  resistance: "milliOhm",
  timing: "us"
} as const satisfies Record<UncertaintySubject, "milliOhm" | "none" | "us">

export type RawCaptureReference = Readonly<{
  captureId: string
  contentDigest: string
  contentFormatRevision: string
  firstSequence: number
  fromUs: number
  kind: "acquisition-samples" | "calibration-measurements" | "fault-context" | "reset-context"
  lastSequence: number
  sampleCount: number
  throughUs: number
}>

export type RecordProvenance = Readonly<{
  calibrationProfileRevision: string
  firmware: Readonly<{
    buildDigest: string
    identity: string
    scoringBootId: string
  }>
  hardwareRevision: string
  lineContractRevision: string
  ruleSetRevision: string
  timingTableRevision: string
}>

type SignalSnapshot = Readonly<{
  audible: "none" | "requested"
  latched: boolean
  visual: "diagnostic" | "none" | "off-target" | "valid-hit"
}>

export type RejectionReason =
  | "candidate-cancelled-before-qualification"
  | "contact-below-minimum-duration"
  | "contact-inside-lockout"
  | "grounded-contact"
  | "invalid-line-state"
  | "measurement-outside-qualified-range"
  | "non-target-surface"
  | "reset-in-progress"
  | "same-side-inhibit"
  | "whipover-while-blade-contact"

export type DecisionRecordOutcome =
  | Readonly<{
      disposition: "qualified-hit"
      hitStartedAtUs: number
      qualifiedAtUs: number
      side: DecisionSide
      signal: SignalSnapshot
      weapon: Weapon
    }>
  | Readonly<{
      disposition: "off-target"
      qualifiedAtUs: number
      side: DecisionSide
      signal: SignalSnapshot
      weapon: "foil"
    }>
  | Readonly<{
      attemptedAtUs: number
      attemptedSide: DecisionSide
      disposition: "rejected-contact"
      reason: RejectionReason
      signal: SignalSnapshot
      weapon: Weapon
    }>
  | Readonly<{
      detectedAtUs: number
      diagnostic:
        | "acquisition-gap"
        | "cross-line"
        | "excitation-invalid"
        | "open-circuit"
        | "out-of-range-resistance"
        | "safe-state"
        | "sample-overrun"
        | "short-to-ground"
      disposition: "line-fault"
      lineId: string
      persistence: "transient" | "latched-until-reset"
      side: DecisionSide | null
      signal: SignalSnapshot
    }>
  | Readonly<{
      cause: "brownout" | "firmware-update" | "operator" | "power-on" | "watchdog"
      disposition: "reset"
      resetAtUs: number
      scope: "esp32" | "scoring-apparatus" | "stm32"
      signal: SignalSnapshot
    }>
  | Readonly<{
      disposition: "uncertainty"
      effect: "decision-with-caveat" | "diagnostic-only" | "not-qualified" | "unavailable"
      lowerBound: number
      observedAtUs: number
      signal: SignalSnapshot
      subject: UncertaintySubject
      unit: "milliOhm" | "none" | "us"
      upperBound: number
    }>
  | Readonly<{
      calibrationId: string
      disposition: "calibration"
      performedAtUs: number
      signal: SignalSnapshot
      status: "expired" | "failed" | "passed" | "unavailable"
    }>

export type DecisionRecord = Readonly<{
  captureWindow: Readonly<{
    firstSequence: number
    fromUs: number
    lastSequence: number
    throughUs: number
  }>
  decisionAtUs: number
  outcome: DecisionRecordOutcome
  provenance: RecordProvenance
  rawCaptureRefs: readonly RawCaptureReference[]
  recordId: string
  schemaVersion: typeof DECISION_RECORD_SCHEMA_VERSION
}>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isNonnegativeSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
}

function isNonemptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && /^sha256:[0-9a-f]{64}$/u.test(value)
}

function isOneOf<T extends string>(value: unknown, choices: readonly T[]): value is T {
  return typeof value === "string" && choices.some((choice) => choice === value)
}

function isSignalSnapshot(value: unknown): value is SignalSnapshot {
  return (
    isRecord(value) &&
    isOneOf(value.audible, ["none", "requested"]) &&
    typeof value.latched === "boolean" &&
    isOneOf(value.visual, ["diagnostic", "none", "off-target", "valid-hit"])
  )
}

function isRawCaptureReference(value: unknown): value is RawCaptureReference {
  return (
    isRecord(value) &&
    isNonemptyString(value.captureId) &&
    isDigest(value.contentDigest) &&
    isNonemptyString(value.contentFormatRevision) &&
    isNonnegativeSafeInteger(value.firstSequence) &&
    isNonnegativeSafeInteger(value.lastSequence) &&
    value.lastSequence >= value.firstSequence &&
    isNonnegativeSafeInteger(value.fromUs) &&
    isNonnegativeSafeInteger(value.throughUs) &&
    value.throughUs >= value.fromUs &&
    isNonnegativeSafeInteger(value.sampleCount) &&
    isOneOf(value.kind, ["acquisition-samples", "calibration-measurements", "fault-context", "reset-context"])
  )
}

function isProvenance(value: unknown): value is RecordProvenance {
  if (!isRecord(value) || !isRecord(value.firmware)) {
    return false
  }

  return (
    isNonemptyString(value.calibrationProfileRevision) &&
    isDigest(value.firmware.buildDigest) &&
    isNonemptyString(value.firmware.identity) &&
    isNonemptyString(value.firmware.scoringBootId) &&
    isNonemptyString(value.hardwareRevision) &&
    isNonemptyString(value.lineContractRevision) &&
    isNonemptyString(value.ruleSetRevision) &&
    isNonemptyString(value.timingTableRevision)
  )
}

function isDecisionRecordOutcome(value: unknown): value is DecisionRecordOutcome {
  if (!isRecord(value) || !isNonemptyString(value.disposition) || !isSignalSnapshot(value.signal)) {
    return false
  }

  switch (value.disposition) {
    case "qualified-hit":
      return (
        isNonnegativeSafeInteger(value.hitStartedAtUs) &&
        isNonnegativeSafeInteger(value.qualifiedAtUs) &&
        value.qualifiedAtUs >= value.hitStartedAtUs &&
        isOneOf(value.side, ["left", "right"]) &&
        isOneOf(value.weapon, ["epee", "foil", "sabre"])
      )
    case "off-target":
      return (
        isNonnegativeSafeInteger(value.qualifiedAtUs) &&
        isOneOf(value.side, ["left", "right"]) &&
        value.weapon === "foil"
      )
    case "rejected-contact":
      return (
        isNonnegativeSafeInteger(value.attemptedAtUs) &&
        isOneOf(value.attemptedSide, ["left", "right"]) &&
        isOneOf(value.reason, [
          "candidate-cancelled-before-qualification",
          "contact-below-minimum-duration",
          "contact-inside-lockout",
          "grounded-contact",
          "invalid-line-state",
          "measurement-outside-qualified-range",
          "non-target-surface",
          "reset-in-progress",
          "same-side-inhibit",
          "whipover-while-blade-contact"
        ]) &&
        isOneOf(value.weapon, ["epee", "foil", "sabre"])
      )
    case "line-fault":
      return (
        isNonnegativeSafeInteger(value.detectedAtUs) &&
        isOneOf(value.diagnostic, [
          "acquisition-gap",
          "cross-line",
          "excitation-invalid",
          "open-circuit",
          "out-of-range-resistance",
          "safe-state",
          "sample-overrun",
          "short-to-ground"
        ]) &&
        isNonemptyString(value.lineId) &&
        isOneOf(value.persistence, ["transient", "latched-until-reset"]) &&
        (value.side === null || isOneOf(value.side, ["left", "right"]))
      )
    case "reset":
      return (
        isOneOf(value.cause, ["brownout", "firmware-update", "operator", "power-on", "watchdog"]) &&
        isNonnegativeSafeInteger(value.resetAtUs) &&
        isOneOf(value.scope, ["esp32", "scoring-apparatus", "stm32"])
      )
    case "uncertainty":
      return (
        isOneOf(value.effect, ["decision-with-caveat", "diagnostic-only", "not-qualified", "unavailable"]) &&
        isNonnegativeSafeInteger(value.lowerBound) &&
        isNonnegativeSafeInteger(value.observedAtUs) &&
        isOneOf(value.subject, UNCERTAINTY_SUBJECTS) &&
        value.unit === UNCERTAINTY_UNIT_BY_SUBJECT[value.subject] &&
        isNonnegativeSafeInteger(value.upperBound) &&
        value.upperBound >= value.lowerBound
      )
    case "calibration":
      return (
        isNonemptyString(value.calibrationId) &&
        isNonnegativeSafeInteger(value.performedAtUs) &&
        isOneOf(value.status, ["expired", "failed", "passed", "unavailable"])
      )
    default:
      return false
  }
}

function outcomeDecisionAtUs(outcome: DecisionRecordOutcome): number {
  switch (outcome.disposition) {
    case "qualified-hit":
    case "off-target":
      return outcome.qualifiedAtUs
    case "rejected-contact":
      return outcome.attemptedAtUs
    case "line-fault":
      return outcome.detectedAtUs
    case "reset":
      return outcome.resetAtUs
    case "uncertainty":
      return outcome.observedAtUs
    case "calibration":
      return outcome.performedAtUs
  }
}

export function isDecisionRecord(value: unknown): value is DecisionRecord {
  if (
    !(
      isRecord(value) &&
      value.schemaVersion === DECISION_RECORD_SCHEMA_VERSION &&
      isNonemptyString(value.recordId) &&
      isNonnegativeSafeInteger(value.decisionAtUs) &&
      isRecord(value.captureWindow) &&
      isNonnegativeSafeInteger(value.captureWindow.firstSequence) &&
      isNonnegativeSafeInteger(value.captureWindow.lastSequence) &&
      value.captureWindow.lastSequence >= value.captureWindow.firstSequence &&
      isNonnegativeSafeInteger(value.captureWindow.fromUs) &&
      isNonnegativeSafeInteger(value.captureWindow.throughUs) &&
      value.captureWindow.throughUs >= value.captureWindow.fromUs &&
      value.decisionAtUs >= value.captureWindow.fromUs &&
      value.decisionAtUs <= value.captureWindow.throughUs &&
      Array.isArray(value.rawCaptureRefs) &&
      value.rawCaptureRefs.length <= MAX_RAW_CAPTURE_REFERENCES &&
      value.rawCaptureRefs.every(isRawCaptureReference) &&
      isProvenance(value.provenance) &&
      isDecisionRecordOutcome(value.outcome)
    )
  ) {
    return false
  }

  return outcomeDecisionAtUs(value.outcome) === value.decisionAtUs
}

/** Rejects an incompatible schema revision or an incomplete decision payload. */
export function parseDecisionRecord(value: unknown): DecisionRecord {
  if (!isDecisionRecord(value)) {
    throw new TypeError("Unsupported or invalid decision record")
  }

  return value
}
