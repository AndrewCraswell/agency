import {
  benchPrototypeResetWatchdog,
  evaluateBenchPrototypeResetWatchdogPhysicalEvidence
} from "./bench-prototype-reset-watchdog.js"

type PlainRecord = Record<string, unknown>

type RawArtifact = { readonly artifactId: unknown; readonly contentSha256: unknown }
type RawCaptureRecord = {
  readonly captureId: unknown
  readonly captureArtifact: RawArtifact
  readonly operator: unknown
  readonly prototype: { readonly assemblyId: unknown; readonly boardRevision: unknown; readonly serialNumber: unknown }
}
type RawCapture = {
  readonly record: RawCaptureRecord
  readonly waveform: { readonly artifactId: unknown; readonly contentSha256: unknown; readonly fileName: unknown }
}
type RawSubmission = {
  readonly artifactKind: unknown
  readonly captures: readonly RawCapture[]
  readonly evidenceId: unknown
  readonly reviewer: {
    readonly reviewArtifact: RawArtifact
    readonly reviewedAtUtc: unknown
    readonly reviewerId: unknown
  }
  readonly sample: { readonly assemblyId: unknown; readonly boardRevision: unknown; readonly serialNumber: unknown }
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) throw new RangeError("BP-123 physical-evidence contract cannot contain aliases or cycles")
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError("BP-123 physical-evidence contract may contain only data properties")
    }
    deepFreeze(descriptor.value, seen)
  }
  return Object.freeze(value)
}

function isPlainRecord(value: unknown): value is PlainRecord {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  )
}

function hasExactKeys(value: unknown, keys: readonly string[]): value is PlainRecord {
  if (!isPlainRecord(value)) return false
  const actualKeys = Object.keys(value)
  return actualKeys.length === keys.length && keys.every((key) => actualKeys.includes(key))
}

function hasKeys(value: unknown, keys: readonly string[]): value is PlainRecord {
  return isPlainRecord(value) && keys.every((key) => key in value)
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function isCanonicalUtcTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)) return false
  const parsed = new Date(value)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value
}

function isWaveformFileName(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^(?!.*(?:^|[\\/])\.\.(?:[\\/]|$))[A-Za-z0-9][A-Za-z0-9._-]*\.(?:bin|csv|trc|wfm)$/u.test(value)
  )
}

function hasRawCaptureRecord(value: unknown): value is RawCaptureRecord {
  return (
    hasKeys(value, ["captureId", "captureArtifact", "operator", "prototype"]) &&
    hasExactKeys(value.captureArtifact, ["artifactId", "contentSha256"]) &&
    hasExactKeys(value.prototype, ["assemblyId", "boardRevision", "serialNumber"])
  )
}

function hasRawCapture(value: unknown): value is RawCapture {
  return (
    hasExactKeys(value, ["record", "waveform"]) &&
    hasRawCaptureRecord(value.record) &&
    hasExactKeys(value.waveform, ["artifactId", "contentSha256", "fileName"])
  )
}

function hasRawSubmission(value: unknown): value is RawSubmission {
  return (
    hasExactKeys(value, ["artifactKind", "captures", "evidenceId", "reviewer", "sample"]) &&
    Array.isArray(value.captures) &&
    value.captures.every(hasRawCapture) &&
    hasExactKeys(value.sample, ["assemblyId", "boardRevision", "serialNumber"]) &&
    hasExactKeys(value.reviewer, ["reviewArtifact", "reviewedAtUtc", "reviewerId"]) &&
    hasExactKeys(value.reviewer.reviewArtifact, ["artifactId", "contentSha256"])
  )
}

export const bp123ResetWatchdogPhysicalCaptureRequirements =
  benchPrototypeResetWatchdog.physicalEvidenceIntake.requiredCaptures

/** Empty intake template. It intentionally contains no sample, instrument, capture, or reviewer identity. */
export const bp123ResetWatchdogPhysicalEvidenceTemplate = deepFreeze({
  artifactKind: "bp123-reset-watchdog-physical-capture-intake",
  authority: {
    fabricationAuthorized: false,
    physicalEvidenceAccepted: false,
    schematicIntegrationAuthorized: false
  },
  captures: [],
  reviewer: null,
  sample: null,
  state: "blank"
})

export type Bp123ResetWatchdogPhysicalEvidenceEvaluation = {
  readonly canonicalReconciliationAccepted: boolean
  readonly physicalEvidenceAccepted: false
  readonly reasons: readonly string[]
  readonly state: "incomplete" | "ready-for-independent-review"
}

function deniedEvaluation(
  state: Bp123ResetWatchdogPhysicalEvidenceEvaluation["state"],
  canonicalReconciliationAccepted: boolean,
  reasons: readonly string[]
): Bp123ResetWatchdogPhysicalEvidenceEvaluation {
  return deepFreeze({
    canonicalReconciliationAccepted,
    physicalEvidenceAccepted: false,
    reasons: [...reasons],
    state
  })
}

/**
 * Reconciles a submitted physical-capture package to BP-123's canonical
 * measurements while retaining physical authority as denied. A caller must
 * supply real artifacts and an independent review before any later gate can
 * change; this evaluator never manufactures a physical-evidence pass.
 */
export function evaluateBp123ResetWatchdogPhysicalEvidence(
  value: unknown
): Bp123ResetWatchdogPhysicalEvidenceEvaluation {
  if (!hasRawSubmission(value)) {
    return deniedEvaluation("incomplete", false, ["submission must contain the exact BP-123 intake envelope"])
  }
  const reasons: string[] = []
  if (value.artifactKind !== "bp123-reset-watchdog-physical-capture-submission") {
    reasons.push("artifactKind must identify a BP-123 physical-capture submission")
  }
  if (!isNonEmptyString(value.evidenceId)) reasons.push("evidenceId is required")
  if (
    !isNonEmptyString(value.sample.assemblyId) ||
    !isNonEmptyString(value.sample.boardRevision) ||
    !isNonEmptyString(value.sample.serialNumber)
  ) {
    reasons.push("sample requires assemblyId, boardRevision, and serialNumber")
  }
  if (
    !isNonEmptyString(value.reviewer.reviewerId) ||
    !isCanonicalUtcTimestamp(value.reviewer.reviewedAtUtc) ||
    !isNonEmptyString(value.reviewer.reviewArtifact.artifactId) ||
    !isSha256(value.reviewer.reviewArtifact.contentSha256)
  ) {
    reasons.push("reviewer requires identity, canonical UTC timestamp, and a hashed review artifact")
  }
  if (value.captures.length !== bp123ResetWatchdogPhysicalCaptureRequirements.length) {
    reasons.push("all six canonical BP-123 capture classes are required")
  }
  const captureOperators = new Set<string>()
  const captureArtifactIds = new Set<string>()
  const captureArtifactDigests = new Set<string>()
  for (const [index, capture] of value.captures.entries()) {
    const required = bp123ResetWatchdogPhysicalCaptureRequirements[index]
    if (required === undefined || capture.record.captureId !== required.captureId) {
      reasons.push(`capture ${index + 1} must retain canonical BP-123 capture order`)
    }
    if (
      capture.record.prototype.assemblyId !== value.sample.assemblyId ||
      capture.record.prototype.boardRevision !== value.sample.boardRevision ||
      capture.record.prototype.serialNumber !== value.sample.serialNumber
    ) {
      reasons.push(`capture ${index + 1} must bind the submitted sample identity`)
    }
    if (
      !isWaveformFileName(capture.waveform.fileName) ||
      capture.waveform.artifactId !== capture.record.captureArtifact.artifactId ||
      capture.waveform.contentSha256 !== capture.record.captureArtifact.contentSha256 ||
      !isSha256(capture.waveform.contentSha256)
    ) {
      reasons.push(`capture ${index + 1} requires a safe waveform file name and matching hashed capture artifact`)
    }
    if (isNonEmptyString(capture.record.operator)) captureOperators.add(capture.record.operator)
    if (isNonEmptyString(capture.record.captureArtifact.artifactId)) {
      captureArtifactIds.add(capture.record.captureArtifact.artifactId)
    }
    if (isSha256(capture.record.captureArtifact.contentSha256)) {
      captureArtifactDigests.add(capture.record.captureArtifact.contentSha256)
    }
  }
  if (isNonEmptyString(value.reviewer.reviewerId) && captureOperators.has(value.reviewer.reviewerId)) {
    reasons.push("reviewerId must differ from every capture operator")
  }
  if (
    isNonEmptyString(value.reviewer.reviewArtifact.artifactId) &&
    captureArtifactIds.has(value.reviewer.reviewArtifact.artifactId)
  ) {
    reasons.push("reviewer review artifact ID must not reuse a capture waveform artifact")
  }
  if (
    isSha256(value.reviewer.reviewArtifact.contentSha256) &&
    captureArtifactDigests.has(value.reviewer.reviewArtifact.contentSha256)
  ) {
    reasons.push("reviewer review artifact digest must not reuse a capture waveform artifact")
  }
  const canonical = evaluateBenchPrototypeResetWatchdogPhysicalEvidence({
    artifactKind: "bench-prototype-reset-watchdog-physical-evidence",
    captures: value.captures.map((capture) => capture.record),
    evidenceId: value.evidenceId
  })
  if (!canonical.accepted) reasons.push(...canonical.reasons.map((reason) => `canonical: ${reason}`))
  const canonicalReconciliationAccepted = canonical.accepted && reasons.length === 0
  return deniedEvaluation(
    canonicalReconciliationAccepted ? "ready-for-independent-review" : "incomplete",
    canonicalReconciliationAccepted,
    reasons.length === 0
      ? [
          "static reconciliation is complete; physical evidence remains denied pending independent review and real artifacts"
        ]
      : reasons
  )
}
