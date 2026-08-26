import { benchPrototypeBom } from "./bench-prototype-bom.js"
import { findFootprintReleaseEvidence } from "./footprint-release-evidence.js"

export type FootprintSourceEvidence = {
  readonly state: "not-acquired" | "acquired"
  readonly url: string | null
  readonly revision: string | null
  readonly sha256: string | null
}

export type FootprintArtworkEvidence = {
  readonly state: "not-generated" | "generated"
  readonly artifactPath: string | null
  readonly generator: string | null
  readonly sha256: string | null
}

export type FootprintOrientationEvidence = {
  readonly state: "unreviewed" | "documented"
  readonly assemblyRotationDeg: number | null
  readonly datum: string | null
  readonly notes: string | null
}

export type FootprintReviewDisposition =
  | "selection-blocked"
  | "excluded-dnp"
  | "unreviewed"
  | "collecting-evidence"
  | "rework-required"
  | "evidence-reviewed"

export type BenchPrototypeFootprintReviewRecord = {
  readonly reference: string
  readonly bomDisposition: "selected" | "TBD" | "DNP"
  readonly exactMpn: string | null
  readonly exactPackage: string | null
  readonly manufacturerDrawing: FootprintSourceEvidence
  readonly manufacturerCad: FootprintSourceEvidence
  readonly artwork: FootprintArtworkEvidence
  readonly orientation: FootprintOrientationEvidence
  readonly existingGateReferences: readonly string[]
  readonly reviewer: string | null
  readonly reviewedAt: string | null
  readonly disposition: FootprintReviewDisposition
  readonly findings: readonly string[]
}

export type BenchPrototypeFootprintReview = {
  readonly artifactKind: "bench-prototype-footprint-review"
  readonly methodId: "BP-030"
  readonly bomArtifactKind: "bench-prototype-baseline-bom"
  readonly fabricationRelease: false
  readonly footprintClosure: false
  readonly releaseState: "deny"
  readonly records: readonly BenchPrototypeFootprintReviewRecord[]
}

function emptySourceEvidence(): FootprintSourceEvidence {
  return { state: "not-acquired", url: null, revision: null, sha256: null }
}

function emptyArtworkEvidence(): FootprintArtworkEvidence {
  return { state: "not-generated", artifactPath: null, generator: null, sha256: null }
}

function emptyOrientationEvidence(): FootprintOrientationEvidence {
  return { state: "unreviewed", assemblyRotationDeg: null, datum: null, notes: null }
}

function initialDisposition(bomDisposition: "selected" | "TBD" | "DNP"): FootprintReviewDisposition {
  if (bomDisposition === "TBD") return "selection-blocked"
  if (bomDisposition === "DNP") return "excluded-dnp"
  return "unreviewed"
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (typeof value !== "object" || value === null || seen.has(value)) return value
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor !== undefined && "value" in descriptor) deepFreeze(descriptor.value, seen)
  }
  return Object.freeze(value)
}

export function createBenchPrototypeFootprintReviewTemplate(): BenchPrototypeFootprintReview {
  return {
    artifactKind: "bench-prototype-footprint-review",
    methodId: "BP-030",
    bomArtifactKind: benchPrototypeBom.artifactKind,
    fabricationRelease: false,
    footprintClosure: false,
    releaseState: "deny",
    records: benchPrototypeBom.rows.map((row) => {
      const priorEvidence = row.mpn === undefined ? undefined : findFootprintReleaseEvidence(row.mpn)
      return {
        reference: row.reference,
        bomDisposition: row.disposition,
        exactMpn: row.mpn ?? null,
        exactPackage: row.package ?? null,
        manufacturerDrawing: emptySourceEvidence(),
        manufacturerCad: emptySourceEvidence(),
        artwork: emptyArtworkEvidence(),
        orientation: emptyOrientationEvidence(),
        existingGateReferences: [...(priorEvidence?.gateReferences ?? [])],
        reviewer: null,
        reviewedAt: null,
        disposition: initialDisposition(row.disposition),
        findings: []
      }
    })
  }
}

export const benchPrototypeFootprintReviewTemplate = deepFreeze(createBenchPrototypeFootprintReviewTemplate())

function assertPlainObject(value: unknown, path: string): asserts value is object {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw new RangeError(`${path} must be a plain object`)
  }
}

function assertFresh(value: object, path: string, seen: WeakSet<object>): void {
  if (seen.has(value)) throw new RangeError(`${path} must not contain cycles or aliases`)
  seen.add(value)
}

function exactRecord(
  value: unknown,
  path: string,
  expectedKeys: readonly string[],
  seen: WeakSet<object>
): Record<string, unknown> {
  assertPlainObject(value, path)
  assertFresh(value, path, seen)
  const keys = Reflect.ownKeys(value)
  if (keys.some((key) => typeof key === "symbol")) throw new RangeError(`${path} must not contain symbol keys`)
  const actual = keys.filter((key): key is string => typeof key === "string").sort()
  const expected = [...expectedKeys].sort()
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new RangeError(`${path} must contain exactly the canonical keys`)
  }
  const record: Record<string, unknown> = {}
  for (const key of expectedKeys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
      throw new RangeError(`${path}.${key} must be an enumerable data property`)
    }
    record[key] = descriptor.value
  }
  return record
}

function denseArray(value: unknown, path: string, seen: WeakSet<object>): readonly unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
    throw new RangeError(`${path} must be a plain array`)
  }
  assertFresh(value, path, seen)
  const expectedKeys = Array.from({ length: value.length }, (_, index) => String(index))
    .concat("length")
    .sort()
  const actualKeys = Reflect.ownKeys(value)
  if (actualKeys.some((key) => typeof key === "symbol")) throw new RangeError(`${path} must not contain symbol keys`)
  const actual = actualKeys.filter((key): key is string => typeof key === "string").sort()
  if (actual.length !== expectedKeys.length || actual.some((key, index) => key !== expectedKeys[index])) {
    throw new RangeError(`${path} must be dense and contain no extra keys`)
  }
  return Array.from({ length: value.length }, (_, index) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index))
    if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
      throw new RangeError(`${path}[${index}] must be an enumerable data property`)
    }
    return descriptor.value
  })
}

function requiredString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim().length === 0) throw new RangeError(`${path} must be nonblank`)
  return value
}

function optionalString(value: unknown, path: string): string | null {
  if (value === null) return null
  return requiredString(value, path)
}

function assertSha256(value: string, path: string): void {
  if (!/^[0-9A-F]{64}$/.test(value)) throw new RangeError(`${path} must be 64 uppercase hexadecimal characters`)
}

function parseSource(value: unknown, path: string, seen: WeakSet<object>): FootprintSourceEvidence {
  const record = exactRecord(value, path, ["state", "url", "revision", "sha256"], seen)
  if (record.state !== "not-acquired" && record.state !== "acquired") throw new RangeError(`${path}.state is invalid`)
  const url = optionalString(record.url, `${path}.url`)
  const revision = optionalString(record.revision, `${path}.revision`)
  const sha256 = optionalString(record.sha256, `${path}.sha256`)
  if (record.state === "not-acquired") {
    if (url !== null || revision !== null || sha256 !== null)
      throw new RangeError(`${path} cannot contain unacquired evidence`)
  } else {
    if (url === null || revision === null || sha256 === null)
      throw new RangeError(`${path} acquired evidence is incomplete`)
    if (!url.startsWith("https://")) throw new RangeError(`${path}.url must use HTTPS`)
    assertSha256(sha256, `${path}.sha256`)
  }
  return { state: record.state, url, revision, sha256 }
}

function parseArtwork(value: unknown, path: string, seen: WeakSet<object>): FootprintArtworkEvidence {
  const record = exactRecord(value, path, ["state", "artifactPath", "generator", "sha256"], seen)
  if (record.state !== "not-generated" && record.state !== "generated") throw new RangeError(`${path}.state is invalid`)
  const artifactPath = optionalString(record.artifactPath, `${path}.artifactPath`)
  const generator = optionalString(record.generator, `${path}.generator`)
  const sha256 = optionalString(record.sha256, `${path}.sha256`)
  if (record.state === "not-generated") {
    if (artifactPath !== null || generator !== null || sha256 !== null)
      throw new RangeError(`${path} cannot contain absent artwork`)
  } else {
    if (artifactPath === null || generator === null || sha256 === null)
      throw new RangeError(`${path} generated artwork is incomplete`)
    assertSha256(sha256, `${path}.sha256`)
  }
  return { state: record.state, artifactPath, generator, sha256 }
}

function parseOrientation(value: unknown, path: string, seen: WeakSet<object>): FootprintOrientationEvidence {
  const record = exactRecord(value, path, ["state", "assemblyRotationDeg", "datum", "notes"], seen)
  if (record.state !== "unreviewed" && record.state !== "documented") throw new RangeError(`${path}.state is invalid`)
  const datum = optionalString(record.datum, `${path}.datum`)
  const notes = optionalString(record.notes, `${path}.notes`)
  const rotation = record.assemblyRotationDeg
  if (record.state === "unreviewed") {
    if (rotation !== null || datum !== null || notes !== null)
      throw new RangeError(`${path} cannot contain unreviewed orientation data`)
  } else {
    if (typeof rotation !== "number" || !Number.isFinite(rotation) || rotation < 0 || rotation >= 360) {
      throw new RangeError(`${path}.assemblyRotationDeg must be in [0, 360)`)
    }
    if (datum === null || notes === null) throw new RangeError(`${path} documented orientation is incomplete`)
  }
  return { state: record.state, assemblyRotationDeg: rotation as number | null, datum, notes }
}

function parseStringArray(value: unknown, path: string, seen: WeakSet<object>): readonly string[] {
  return denseArray(value, path, seen).map((item, index) => requiredString(item, `${path}[${index}]`))
}

function assertEqual(actual: unknown, expected: unknown, path: string): void {
  if (!Object.is(actual, expected)) throw new RangeError(`${path} does not match the BP-020 baseline`)
}

function validateRecord(value: unknown, index: number, seen: WeakSet<object>): void {
  const path = `review.records[${index}]`
  const record = exactRecord(
    value,
    path,
    [
      "reference",
      "bomDisposition",
      "exactMpn",
      "exactPackage",
      "manufacturerDrawing",
      "manufacturerCad",
      "artwork",
      "orientation",
      "existingGateReferences",
      "reviewer",
      "reviewedAt",
      "disposition",
      "findings"
    ],
    seen
  )
  const baseline = benchPrototypeBom.rows[index]
  if (baseline === undefined) throw new RangeError(`${path} has no BP-020 baseline row`)
  assertEqual(record.reference, baseline.reference, `${path}.reference`)
  assertEqual(record.bomDisposition, baseline.disposition, `${path}.bomDisposition`)
  assertEqual(record.exactMpn, baseline.mpn ?? null, `${path}.exactMpn`)
  assertEqual(record.exactPackage, baseline.package ?? null, `${path}.exactPackage`)

  const drawing = parseSource(record.manufacturerDrawing, `${path}.manufacturerDrawing`, seen)
  const cad = parseSource(record.manufacturerCad, `${path}.manufacturerCad`, seen)
  const artwork = parseArtwork(record.artwork, `${path}.artwork`, seen)
  const orientation = parseOrientation(record.orientation, `${path}.orientation`, seen)
  const gateReferences = parseStringArray(record.existingGateReferences, `${path}.existingGateReferences`, seen)
  const prior = baseline.mpn === undefined ? undefined : findFootprintReleaseEvidence(baseline.mpn)
  const expectedGates = prior?.gateReferences ?? []
  if (
    gateReferences.length !== expectedGates.length ||
    gateReferences.some((item, gateIndex) => item !== expectedGates[gateIndex])
  ) {
    throw new RangeError(`${path}.existingGateReferences does not match the existing evidence ledger`)
  }

  const reviewer = optionalString(record.reviewer, `${path}.reviewer`)
  const reviewedAt = optionalString(record.reviewedAt, `${path}.reviewedAt`)
  if (
    reviewedAt !== null &&
    (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(reviewedAt) ||
      new Date(reviewedAt).toISOString() !== reviewedAt)
  ) {
    throw new RangeError(`${path}.reviewedAt must be a canonical UTC timestamp`)
  }
  const findings = parseStringArray(record.findings, `${path}.findings`, seen)
  const disposition = record.disposition
  const allowed = [
    "selection-blocked",
    "excluded-dnp",
    "unreviewed",
    "collecting-evidence",
    "rework-required",
    "evidence-reviewed"
  ]
  if (typeof disposition !== "string" || !allowed.includes(disposition))
    throw new RangeError(`${path}.disposition is invalid`)

  if (baseline.disposition === "TBD") {
    if (disposition !== "selection-blocked") throw new RangeError(`${path} must remain selection-blocked`)
  } else if (baseline.disposition === "DNP") {
    if (disposition !== "excluded-dnp") throw new RangeError(`${path} must remain excluded-dnp`)
  } else if (disposition === "selection-blocked" || disposition === "excluded-dnp") {
    throw new RangeError(`${path} selected part has an incompatible disposition`)
  }

  const noEvidenceDisposition =
    disposition === "selection-blocked" || disposition === "excluded-dnp" || disposition === "unreviewed"
  if (
    noEvidenceDisposition &&
    (drawing.state !== "not-acquired" ||
      cad.state !== "not-acquired" ||
      artwork.state !== "not-generated" ||
      orientation.state !== "unreviewed" ||
      reviewer !== null ||
      reviewedAt !== null ||
      findings.length > 0)
  ) {
    throw new RangeError(`${path} must use collecting-evidence before recording evidence`)
  }
  if (
    disposition === "collecting-evidence" &&
    drawing.state === "not-acquired" &&
    cad.state === "not-acquired" &&
    artwork.state === "not-generated" &&
    orientation.state === "unreviewed" &&
    reviewer === null &&
    findings.length === 0
  ) {
    throw new RangeError(`${path} collecting-evidence requires recorded progress`)
  }

  const finalReview = disposition === "rework-required" || disposition === "evidence-reviewed"
  if (finalReview && (reviewer === null || reviewedAt === null))
    throw new RangeError(`${path} final review requires reviewer and time`)
  if (!finalReview && reviewedAt !== null) throw new RangeError(`${path} cannot have a review time before final review`)
  if (disposition === "rework-required" && findings.length === 0)
    throw new RangeError(`${path} rework requires findings`)
  if (disposition === "evidence-reviewed") {
    if (
      drawing.state !== "acquired" ||
      cad.state !== "acquired" ||
      artwork.state !== "generated" ||
      orientation.state !== "documented"
    ) {
      throw new RangeError(`${path} evidence review is incomplete`)
    }
  }
}

export function validateBenchPrototypeFootprintReview(value: unknown): true {
  try {
    const seen = new WeakSet<object>()
    const review = exactRecord(
      value,
      "review",
      [
        "artifactKind",
        "methodId",
        "bomArtifactKind",
        "fabricationRelease",
        "footprintClosure",
        "releaseState",
        "records"
      ],
      seen
    )
    assertEqual(review.artifactKind, "bench-prototype-footprint-review", "review.artifactKind")
    assertEqual(review.methodId, "BP-030", "review.methodId")
    assertEqual(review.bomArtifactKind, benchPrototypeBom.artifactKind, "review.bomArtifactKind")
    assertEqual(review.fabricationRelease, false, "review.fabricationRelease")
    assertEqual(review.footprintClosure, false, "review.footprintClosure")
    assertEqual(review.releaseState, "deny", "review.releaseState")
    const records = denseArray(review.records, "review.records", seen)
    if (records.length !== benchPrototypeBom.rows.length)
      throw new RangeError("review.records must cover every BP-020 row")
    records.forEach((record, index) => validateRecord(record, index, seen))
    return true
  } catch (error) {
    if (error instanceof RangeError) throw error
    throw new RangeError("bench prototype footprint review could not be validated safely")
  }
}

validateBenchPrototypeFootprintReview(benchPrototypeFootprintReviewTemplate)
