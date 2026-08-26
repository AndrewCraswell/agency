/**
 * M0-05 logical decision record validation.
 *
 * This module deliberately does not encode, frame, journal, or transmit records.
 * Those concerns belong to M0-06 and M2.  It defines the immutable payload that
 * those later layers must preserve.
 */

export const DECISION_RECORD_SCHEMA_VERSION = 1
export const MAX_RAW_CAPTURE_REFERENCES = 8
export const MAX_DECISION_RECORD_ID_LENGTH = 128

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
  calibration: null,
  "capture-completeness": null,
  clock: "us",
  identity: null,
  "line-state": null,
  resistance: "milliOhm",
  timing: "us"
} as const satisfies Record<UncertaintySubject, "milliOhm" | "us" | null>

/**
 * M0-03 cycle-receipt diagnostics that map to a recordable line fault. A null
 * mapping deliberately remains an uncertainty record instead of a guessed fault.
 */
export const M003_DIAGNOSTIC_TO_LINE_FAULT = Object.freeze({
  "cross-line": "cross-line",
  "cycle-incomplete": "acquisition-gap",
  "out-of-range-resistance": "out-of-range-resistance",
  "safe-state": "safe-state",
  "sample-overrun": "sample-overrun",
  "stale-sample": "acquisition-gap",
  "uncertain-evidence": null,
  "unauthorized-excitation": "excitation-invalid"
} as const)

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

type UncertaintyEffect = "decision-with-caveat" | "diagnostic-only" | "not-qualified" | "unavailable"
type IdentityUncertaintyField =
  | "calibration-profile-revision"
  | "firmware-build-digest"
  | "firmware-identity"
  | "hardware-revision"
  | "line-contract-revision"
  | "rule-set-revision"
  | "scoring-boot-id"
  | "timing-table-revision"

type UncertaintyOutcomeBase = Readonly<{
  disposition: "uncertainty"
  effect: UncertaintyEffect
  lowerBound: number
  observedAtUs: number
  signal: SignalSnapshot
  upperBound: number
}>

type NonIdentityUncertaintyOutcome =
  | (UncertaintyOutcomeBase &
      Readonly<{
        subject: "calibration" | "capture-completeness" | "line-state"
        unit: null
      }>)
  | (UncertaintyOutcomeBase &
      Readonly<{
        subject: "clock" | "timing"
        unit: "us"
      }>)
  | (UncertaintyOutcomeBase &
      Readonly<{
        subject: "resistance"
        unit: "milliOhm"
      }>)

type IdentityUncertaintyOutcome = UncertaintyOutcomeBase &
  Readonly<{
    identity: Readonly<{
      field: IdentityUncertaintyField
      observed: string | null
      status: "mismatch" | "missing" | "untrusted"
    }>
    lowerBound: 0
    subject: "identity"
    unit: null
    upperBound: 0
  }>

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
  | NonIdentityUncertaintyOutcome
  | IdentityUncertaintyOutcome
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
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  )
}

function isNonnegativeSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
}

function isIdentifier(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_DECISION_RECORD_ID_LENGTH &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(value)
  )
}

function isStm32FirmwareIdentity(value: unknown): value is string {
  return isIdentifier(value) && /^stm32(?:-|$)/u.test(value)
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && /^sha256:[0-9a-f]{64}$/u.test(value)
}

function isOneOf<T extends string>(value: unknown, choices: readonly T[]): value is T {
  return typeof value === "string" && choices.some((choice) => choice === value)
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value)
  return actual.length === keys.length && actual.every((key) => keys.includes(key))
}

function isSignalSnapshot(value: unknown): value is SignalSnapshot {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["audible", "latched", "visual"]) &&
    isOneOf(value.audible, ["none", "requested"]) &&
    typeof value.latched === "boolean" &&
    isOneOf(value.visual, ["diagnostic", "none", "off-target", "valid-hit"])
  )
}

function isRawCaptureReference(value: unknown): value is RawCaptureReference {
  return (
    isRecord(value) &&
    hasExactKeys(value, [
      "captureId",
      "contentDigest",
      "contentFormatRevision",
      "firstSequence",
      "fromUs",
      "kind",
      "lastSequence",
      "sampleCount",
      "throughUs"
    ]) &&
    isIdentifier(value.captureId) &&
    isDigest(value.contentDigest) &&
    isIdentifier(value.contentFormatRevision) &&
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
    hasExactKeys(value, [
      "calibrationProfileRevision",
      "firmware",
      "hardwareRevision",
      "lineContractRevision",
      "ruleSetRevision",
      "timingTableRevision"
    ]) &&
    hasExactKeys(value.firmware, ["buildDigest", "identity", "scoringBootId"]) &&
    isIdentifier(value.calibrationProfileRevision) &&
    isDigest(value.firmware.buildDigest) &&
    isStm32FirmwareIdentity(value.firmware.identity) &&
    isIdentifier(value.firmware.scoringBootId) &&
    isIdentifier(value.hardwareRevision) &&
    isIdentifier(value.lineContractRevision) &&
    isIdentifier(value.ruleSetRevision) &&
    isIdentifier(value.timingTableRevision)
  )
}

function isDecisionRecordOutcome(value: unknown): value is DecisionRecordOutcome {
  if (!isRecord(value) || typeof value.disposition !== "string") {
    return false
  }

  switch (value.disposition) {
    case "qualified-hit":
      return (
        hasExactKeys(value, ["disposition", "hitStartedAtUs", "qualifiedAtUs", "side", "signal", "weapon"]) &&
        isNonnegativeSafeInteger(value.hitStartedAtUs) &&
        isNonnegativeSafeInteger(value.qualifiedAtUs) &&
        value.qualifiedAtUs >= value.hitStartedAtUs &&
        isOneOf(value.side, ["left", "right"]) &&
        isSignalSnapshot(value.signal) &&
        isOneOf(value.weapon, ["epee", "foil", "sabre"])
      )
    case "off-target":
      return (
        hasExactKeys(value, ["disposition", "qualifiedAtUs", "side", "signal", "weapon"]) &&
        isNonnegativeSafeInteger(value.qualifiedAtUs) &&
        isOneOf(value.side, ["left", "right"]) &&
        isSignalSnapshot(value.signal) &&
        value.weapon === "foil"
      )
    case "rejected-contact":
      return (
        hasExactKeys(value, ["attemptedAtUs", "attemptedSide", "disposition", "reason", "signal", "weapon"]) &&
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
        isSignalSnapshot(value.signal) &&
        isOneOf(value.weapon, ["epee", "foil", "sabre"])
      )
    case "line-fault":
      return (
        hasExactKeys(value, ["detectedAtUs", "diagnostic", "disposition", "lineId", "persistence", "side", "signal"]) &&
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
        isIdentifier(value.lineId) &&
        isOneOf(value.persistence, ["transient", "latched-until-reset"]) &&
        isSignalSnapshot(value.signal) &&
        (value.side === null || isOneOf(value.side, ["left", "right"]))
      )
    case "reset":
      return (
        hasExactKeys(value, ["cause", "disposition", "resetAtUs", "scope", "signal"]) &&
        isOneOf(value.cause, ["brownout", "firmware-update", "operator", "power-on", "watchdog"]) &&
        isNonnegativeSafeInteger(value.resetAtUs) &&
        isSignalSnapshot(value.signal) &&
        isOneOf(value.scope, ["esp32", "scoring-apparatus", "stm32"])
      )
    case "uncertainty":
      if (
        !isOneOf(value.effect, ["decision-with-caveat", "diagnostic-only", "not-qualified", "unavailable"]) ||
        !isNonnegativeSafeInteger(value.observedAtUs)
      )
        return false
      if (value.subject === "identity") {
        return (
          hasExactKeys(value, [
            "disposition",
            "effect",
            "identity",
            "lowerBound",
            "observedAtUs",
            "signal",
            "subject",
            "unit",
            "upperBound"
          ]) &&
          isSignalSnapshot(value.signal) &&
          isRecord(value.identity) &&
          hasExactKeys(value.identity, ["field", "observed", "status"]) &&
          isOneOf(value.identity.field, [
            "calibration-profile-revision",
            "firmware-build-digest",
            "firmware-identity",
            "hardware-revision",
            "line-contract-revision",
            "rule-set-revision",
            "scoring-boot-id",
            "timing-table-revision"
          ]) &&
          (value.identity.observed === null ||
            isIdentifier(value.identity.observed) ||
            isDigest(value.identity.observed)) &&
          isOneOf(value.identity.status, ["mismatch", "missing", "untrusted"]) &&
          value.lowerBound === 0 &&
          value.unit === null &&
          value.upperBound === 0
        )
      }
      return (
        hasExactKeys(value, [
          "disposition",
          "effect",
          "lowerBound",
          "observedAtUs",
          "signal",
          "subject",
          "unit",
          "upperBound"
        ]) &&
        isNonnegativeSafeInteger(value.lowerBound) &&
        isOneOf(value.subject, UNCERTAINTY_SUBJECTS) &&
        isSignalSnapshot(value.signal) &&
        value.unit === UNCERTAINTY_UNIT_BY_SUBJECT[value.subject] &&
        isNonnegativeSafeInteger(value.upperBound) &&
        value.upperBound >= value.lowerBound
      )
    case "calibration":
      return (
        hasExactKeys(value, ["calibrationId", "disposition", "performedAtUs", "signal", "status"]) &&
        isIdentifier(value.calibrationId) &&
        isNonnegativeSafeInteger(value.performedAtUs) &&
        isSignalSnapshot(value.signal) &&
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

function isStrictPlainData(value: unknown, seen = new WeakSet<object>()): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true
  if (typeof value === "number") return Number.isFinite(value)
  if (typeof value !== "object" || seen.has(value)) return false
  seen.add(value)

  if (Array.isArray(value)) {
    const keys = Reflect.ownKeys(value)
    if (
      Object.getPrototypeOf(value) !== Array.prototype ||
      keys.length !== value.length + 1 ||
      keys.at(-1) !== "length" ||
      Object.keys(value).length !== value.length
    ) {
      return false
    }
    return value.every((entry, index) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index))
      return (
        descriptor !== undefined && descriptor.enumerable && "value" in descriptor && isStrictPlainData(entry, seen)
      )
    })
  }
  const keys = Reflect.ownKeys(value)
  if (Object.getPrototypeOf(value) !== Object.prototype || keys.some((key) => typeof key !== "string")) {
    return false
  }
  return keys.every((key) => {
    if (typeof key !== "string") return false
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    return (
      descriptor !== undefined &&
      descriptor.enumerable &&
      "value" in descriptor &&
      isStrictPlainData(descriptor.value, seen)
    )
  })
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nestedValue of Object.values(value)) deepFreeze(nestedValue)
    Object.freeze(value)
  }
  return value
}

export function isDecisionRecord(value: unknown): value is DecisionRecord {
  if (
    !(
      isStrictPlainData(value) &&
      isRecord(value) &&
      hasExactKeys(value, [
        "captureWindow",
        "decisionAtUs",
        "outcome",
        "provenance",
        "rawCaptureRefs",
        "recordId",
        "schemaVersion"
      ]) &&
      value.schemaVersion === DECISION_RECORD_SCHEMA_VERSION &&
      isIdentifier(value.recordId) &&
      isNonnegativeSafeInteger(value.decisionAtUs) &&
      isRecord(value.captureWindow) &&
      hasExactKeys(value.captureWindow, ["firstSequence", "fromUs", "lastSequence", "throughUs"]) &&
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

  return (
    outcomeDecisionAtUs(value.outcome) === value.decisionAtUs &&
    (value.outcome.disposition !== "calibration" ||
      value.rawCaptureRefs.some((reference) => reference.kind === "calibration-measurements"))
  )
}

/** Rejects an incompatible schema revision or an incomplete decision payload. */
export function parseDecisionRecord(value: unknown): DecisionRecord {
  if (!isDecisionRecord(value)) {
    throw new TypeError("Unsupported or invalid decision record")
  }

  return deepFreeze(structuredClone(value))
}
