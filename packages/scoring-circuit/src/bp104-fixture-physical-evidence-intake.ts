import { parseCanonicalUtcTimestamp, parseRealUtcDate } from "./bench-prototype-evidence-time.js"
import {
  benchPrototypeFixtureHarness,
  evaluateBenchPrototypeContinuityEvidence,
  evaluateBenchPrototypeFixturePhysicalEvidence,
  type BenchPrototypeContinuityEvidence
} from "./bench-prototype-fixture-harness.js"

type DataRecord = Record<PropertyKey, unknown>
type ManufacturerPartNumber = "43045-1200" | "43025-1200" | "43030-0007" | "44242-0005"
type Signal =
  | "LEFT_WEAPON_A"
  | "LEFT_WEAPON_B"
  | "LEFT_WEAPON_C"
  | "RIGHT_WEAPON_A"
  | "RIGHT_WEAPON_B"
  | "RIGHT_WEAPON_C"
  | "PISTE"
type PhysicalNegativeTestId = "BP104-NEG-SWAP" | "BP104-NEG-OPEN" | "BP104-NEG-RETURN-BOND" | "BP104-NEG-REVERSED-MATE"
const requiredIndependentReviewer = "root-final-reviewer"

export type Bp104IntakeArtifactMediaType =
  | "photo"
  | "pdf"
  | "review-record"
  | "measurement-record"
  | "calibration-certificate"

export type Bp104IntakeArtifact = {
  readonly artifactId: string
  readonly contentSha256: string
  readonly capturedAtUtc: string
  readonly reviewer: string
  readonly mediaType: Bp104IntakeArtifactMediaType
  readonly reviewStatus: "accepted"
}

export type Bp104IntakeSourceBinding = {
  readonly drawingUrl: string | null
  readonly drawingPath: string | null
  readonly drawingSha256: string | null
  readonly cadUrl: string | null
  readonly cadPath: string | null
  readonly cadSha256: string | null
}

export type Bp104FixturePhysicalEvidenceIntake = {
  readonly artifactKind: "bench-prototype-fixture-physical-evidence-intake"
  readonly intakeId: string | null
  readonly status: "incomplete" | "accepted"
  readonly recordedAtUtc: string | null
  readonly operator: string | null
  readonly reviewer: string | null
  readonly sourceReviews: readonly {
    readonly mpn: ManufacturerPartNumber
    readonly source: Bp104IntakeSourceBinding
    readonly cadDisposition: "not-acquired-pattern-probe-returned-404" | "exact-retained-cad-artifact" | null
    readonly drawingArtifact: Bp104IntakeArtifact | null
    readonly cadArtifact: Bp104IntakeArtifact | null
    readonly reviewArtifact: Bp104IntakeArtifact | null
    readonly reviewer: string | null
    readonly result: "incomplete" | "accepted"
  }[]
  readonly receivedParts: readonly {
    readonly mpn: ManufacturerPartNumber
    readonly receivedQuantity: number | null
    readonly identity: {
      readonly manufacturer: string | null
      readonly materialNumber: string | null
      readonly marking: string | null
      readonly photo: Bp104IntakeArtifact | null
    }
    readonly receiptPhoto: Bp104IntakeArtifact | null
    readonly reviewer: string | null
    readonly result: "incomplete" | "accepted"
  }[]
  readonly matingFitOrientationLabels: {
    readonly powerState: "off-and-discharged" | null
    readonly sampleFitPhoto: Bp104IntakeArtifact | null
    readonly circuitOneAligned: boolean | null
    readonly latchLockSeated: boolean | null
    readonly independentFixtureStopVerified: boolean | null
    readonly namedSignalLabelsLegible: boolean | null
    readonly pinOneMarkerLegible: boolean | null
    readonly forcedMateObserved: boolean | null
    readonly reviewer: string | null
    readonly result: "incomplete" | "accepted"
  }
  readonly miswireRejection: readonly {
    readonly id: PhysicalNegativeTestId
    readonly artifact: Bp104IntakeArtifact | null
    readonly result: "incomplete" | "rejected"
    readonly observation: string | null
    readonly reviewer: string | null
  }[]
  readonly crimpAndRetention: readonly {
    readonly signal: Signal
    readonly cavity: number | null
    readonly terminalMpn: "43030-0007" | null
    readonly crimpArtifact: Bp104IntakeArtifact | null
    readonly retentionArtifact: Bp104IntakeArtifact | null
    readonly reviewer: string | null
    readonly result: "incomplete" | "accepted"
  }[]
  readonly strainRelief: {
    readonly artifact: Bp104IntakeArtifact | null
    readonly pullLoadPathBypassesCrimpAndPcb: boolean | null
    readonly bendPathVerified: boolean | null
    readonly reviewer: string | null
    readonly result: "incomplete" | "accepted"
  }
  readonly continuity: {
    readonly record: BenchPrototypeContinuityEvidence | null
    readonly measurementArtifact: Bp104IntakeArtifact | null
    readonly instrumentAndCalibration: {
      readonly manufacturer: string | null
      readonly model: string | null
      readonly serialNumber: string | null
      readonly calibrationCertificate: string | null
      readonly calibrationDueDate: string | null
      readonly calibrationArtifact: Bp104IntakeArtifact | null
    }
    readonly reviewer: string | null
    readonly result: "incomplete" | "accepted"
  }
  readonly statement: string
}

export type Bp104FixturePhysicalEvidenceIntakeEvaluation = {
  readonly accepted: boolean
  readonly status: "incomplete" | "accepted"
  readonly reasons: readonly string[]
}

const requiredMpns: readonly ManufacturerPartNumber[] = ["43045-1200", "43025-1200", "43030-0007", "44242-0005"]
const requiredSignals: readonly Signal[] = [
  "LEFT_WEAPON_A",
  "LEFT_WEAPON_B",
  "LEFT_WEAPON_C",
  "RIGHT_WEAPON_A",
  "RIGHT_WEAPON_B",
  "RIGHT_WEAPON_C",
  "PISTE"
]
const requiredNegativeTestIds: readonly PhysicalNegativeTestId[] = [
  "BP104-NEG-SWAP",
  "BP104-NEG-OPEN",
  "BP104-NEG-RETURN-BOND",
  "BP104-NEG-REVERSED-MATE"
]
const minimumReceivedQuantity: Readonly<Record<ManufacturerPartNumber, number>> = {
  "43045-1200": 1,
  "43025-1200": 1,
  "43030-0007": 7,
  "44242-0005": 1
}
const expectedMaterialNumbers: Readonly<Record<ManufacturerPartNumber, string>> = {
  "43045-1200": "430451200",
  "43025-1200": "430251200",
  "43030-0007": "430300007",
  "44242-0005": "442420005"
}

function isPlainRecord(value: unknown): value is DataRecord {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  )
}

function hasExactKeys(value: unknown, expected: readonly string[]): value is DataRecord {
  if (!isPlainRecord(value)) return false
  const keys = Object.keys(value)
  return keys.length === expected.length && expected.every((key) => keys.includes(key))
}

function hasExactKeySet(value: unknown, expected: readonly string[]): boolean {
  return hasExactKeys(value, expected)
}

function validateIndependentReviewer(
  reviewer: string | null,
  section: string,
  operator: string | null,
  intakeReviewer: string | null,
  reasons: string[]
): boolean {
  const valid =
    nonEmptyString(reviewer) &&
    nonEmptyString(operator) &&
    nonEmptyString(intakeReviewer) &&
    reviewer !== operator &&
    intakeReviewer === requiredIndependentReviewer &&
    reviewer === requiredIndependentReviewer
  if (!valid) reasons.push(`${section} reviewer must be the independent intake reviewer and differ from the operator`)
  return valid
}

function inspectDataGraph(value: unknown, path: string, seen: WeakSet<object>, reasons: string[]): void {
  if (value === null || typeof value !== "object") return
  if (seen.has(value)) {
    reasons.push(`${path} contains a cycle or object alias`)
    return
  }
  seen.add(value)
  const keys = Reflect.ownKeys(value)
  if (Array.isArray(value)) {
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length")
    const expectedKeys = Array.from({ length: value.length }, (_, index) => String(index)).concat("length")
    if (
      Object.getPrototypeOf(value) !== Array.prototype ||
      lengthDescriptor === undefined ||
      !("value" in lengthDescriptor) ||
      keys.length !== expectedKeys.length ||
      keys.some((key, index) => key !== expectedKeys[index])
    ) {
      reasons.push(`${path} must be a dense plain array`)
      return
    }
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index))
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        reasons.push(`${path}[${index}] must be an enumerable data property`)
        return
      }
      inspectDataGraph(descriptor.value, `${path}[${index}]`, seen, reasons)
    }
    return
  }
  if (Object.getPrototypeOf(value) !== Object.prototype) {
    reasons.push(`${path} must be a plain data record`)
    return
  }
  for (const key of keys) {
    if (typeof key === "symbol") {
      reasons.push(`${path} must not contain symbol keys`)
      return
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
      reasons.push(`${path}.${key} must be an enumerable data property`)
      return
    }
    inspectDataGraph(descriptor.value, `${path}.${key}`, seen, reasons)
  }
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) throw new RangeError("BP-104 intake cannot contain cycles or aliases")
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError("BP-104 intake may contain only data properties")
    }
    deepFreeze(descriptor.value, seen)
  }
  return Object.freeze(value)
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value)
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function validateArtifact(
  value: Bp104IntakeArtifact | null,
  mediaType: Bp104IntakeArtifactMediaType,
  field: string,
  artifacts: Map<string, string>,
  reasons: string[]
): value is Bp104IntakeArtifact {
  if (value === null) {
    reasons.push(`${field} artifact is required`)
    return false
  }
  if (
    !hasExactKeySet(value, ["artifactId", "contentSha256", "capturedAtUtc", "reviewer", "mediaType", "reviewStatus"]) ||
    !nonEmptyString(value.artifactId) ||
    !isSha256(value.contentSha256) ||
    parseCanonicalUtcTimestamp(value.capturedAtUtc) === null ||
    !nonEmptyString(value.reviewer) ||
    value.mediaType !== mediaType ||
    value.reviewStatus !== "accepted"
  ) {
    reasons.push(`${field} artifact identity, hash, timestamp, reviewer, or media type is invalid`)
    return false
  }
  if (artifacts.has(value.artifactId)) {
    reasons.push(`${field} reuses artifact ID ${value.artifactId}`)
    return false
  }
  artifacts.set(value.artifactId, value.contentSha256)
  return true
}

function validateArtifactReviewers(value: Bp104FixturePhysicalEvidenceIntake, reasons: string[]): boolean {
  let complete = true
  const check = (artifact: Bp104IntakeArtifact | null, field: string): void => {
    if (
      artifact !== null &&
      !validateIndependentReviewer(artifact.reviewer, field, value.operator, value.reviewer, reasons)
    ) {
      complete = false
    }
  }
  value.sourceReviews.forEach((review) => {
    check(review.drawingArtifact, `${review.mpn}.drawing`)
    check(review.cadArtifact, `${review.mpn}.CAD`)
    check(review.reviewArtifact, `${review.mpn}.review`)
  })
  value.receivedParts.forEach((part) => {
    check(part.identity.photo, `${part.mpn}.identity-photo`)
    check(part.receiptPhoto, `${part.mpn}.receipt-photo`)
  })
  check(value.matingFitOrientationLabels.sampleFitPhoto, "sample fit")
  value.miswireRejection.forEach((result) => check(result.artifact, result.id))
  value.crimpAndRetention.forEach((record) => {
    check(record.crimpArtifact, `${record.signal}.crimp`)
    check(record.retentionArtifact, `${record.signal}.retention`)
  })
  check(value.strainRelief.artifact, "strain relief")
  check(value.continuity.measurementArtifact, "continuity measurement")
  check(value.continuity.instrumentAndCalibration.calibrationArtifact, "instrument calibration")
  return complete
}

function expectedSource(mpn: ManufacturerPartNumber) {
  return benchPrototypeFixtureHarness.evidence.manufacturerDrawingDiscovery.candidates.find(
    (candidate) => candidate.mpn === mpn
  )
}

function validateSourceReviews(
  value: Bp104FixturePhysicalEvidenceIntake,
  artifacts: Map<string, string>,
  reasons: string[]
): boolean {
  let complete = true
  if (
    !Array.isArray(value.sourceReviews) ||
    value.sourceReviews.length !== requiredMpns.length ||
    value.sourceReviews.some((review, index) => !isPlainRecord(review) || review.mpn !== requiredMpns[index])
  ) {
    reasons.push("source reviews must contain the four BP-104 MPNs in contract order")
    return false
  }
  value.sourceReviews.forEach((review, index) => {
    const mpn = requiredMpns[index]
    const candidate = expectedSource(mpn)
    if (
      !hasExactKeySet(review, [
        "mpn",
        "source",
        "cadDisposition",
        "drawingArtifact",
        "cadArtifact",
        "reviewArtifact",
        "reviewer",
        "result"
      ]) ||
      !hasExactKeySet(review.source, [
        "drawingUrl",
        "drawingPath",
        "drawingSha256",
        "cadUrl",
        "cadPath",
        "cadSha256"
      ]) ||
      candidate === undefined
    ) {
      reasons.push(`source review for ${mpn} has an invalid shape or missing contract source`)
      complete = false
      return
    }
    if (
      review.source.drawingUrl !== candidate.sourceUrl ||
      review.source.drawingPath !== candidate.retainedAsset ||
      review.source.drawingSha256 !== candidate.contentSha256
    ) {
      reasons.push(`drawing source binding for ${mpn} does not match the retained Molex artifact`)
      complete = false
    }
    const expectedCadDisposition =
      mpn === "43030-0007" ? "not-acquired-pattern-probe-returned-404" : "exact-retained-cad-artifact"
    if (review.cadDisposition !== expectedCadDisposition) {
      reasons.push(`CAD disposition for ${mpn} does not match the retained Molex evidence state`)
      complete = false
    }
    const drawingAccepted = validateArtifact(review.drawingArtifact, "pdf", `${mpn}.drawing`, artifacts, reasons)
    if (!drawingAccepted || review.drawingArtifact?.contentSha256 !== candidate.contentSha256) {
      reasons.push(`drawing artifact for ${mpn} is not bound to the retained Molex SHA-256`)
      complete = false
    }
    const cadIsAvailable =
      candidate.cadSourceUrl !== null && candidate.cadRetainedAsset !== null && candidate.cadContentSha256 !== null
    if (!cadIsAvailable) {
      if (
        review.source.cadUrl !== null ||
        review.source.cadPath !== null ||
        review.source.cadSha256 !== null ||
        review.cadArtifact !== null
      ) {
        reasons.push(`CAD source binding for ${mpn} must remain null until a source artifact is acquired`)
      }
      if (review.result !== "incomplete") {
        if (mpn !== "43030-0007")
          reasons.push(`source review for ${mpn} cannot be accepted without an acquired exact CAD artifact`)
      }
      if (mpn !== "43030-0007") complete = false
    } else {
      if (
        review.source.cadUrl !== candidate.cadSourceUrl ||
        review.source.cadPath !== candidate.cadRetainedAsset ||
        review.source.cadSha256 !== candidate.cadContentSha256
      ) {
        reasons.push(`CAD source binding for ${mpn} does not match the retained Molex artifact`)
        complete = false
      }
      const cadAccepted = validateArtifact(review.cadArtifact, "pdf", `${mpn}.CAD`, artifacts, reasons)
      if (!cadAccepted || review.cadArtifact?.contentSha256 !== candidate.cadContentSha256) {
        reasons.push(`CAD artifact for ${mpn} is not bound to the retained Molex SHA-256`)
        complete = false
      }
    }
    const reviewAccepted = validateArtifact(review.reviewArtifact, "review-record", `${mpn}.review`, artifacts, reasons)
    if (!reviewAccepted || !nonEmptyString(review.reviewer)) {
      reasons.push(`reviewer and review artifact for ${mpn} are required`)
      complete = false
    }
    if (
      (cadIsAvailable && review.result !== "accepted") ||
      (mpn === "43030-0007" && review.result !== "incomplete" && review.result !== "accepted")
    ) {
      reasons.push(`source review result for ${mpn} does not match its acquired-artifact state`)
      complete = false
    }
    if (!validateIndependentReviewer(review.reviewer, `${mpn} source review`, value.operator, value.reviewer, reasons))
      complete = false
  })
  return complete
}

function validateReceivedParts(
  value: Bp104FixturePhysicalEvidenceIntake,
  artifacts: Map<string, string>,
  reasons: string[]
): boolean {
  let complete = true
  if (
    !Array.isArray(value.receivedParts) ||
    value.receivedParts.length !== requiredMpns.length ||
    value.receivedParts.some((part, index) => !isPlainRecord(part) || part.mpn !== requiredMpns[index])
  ) {
    reasons.push("received parts must contain the four BP-104 MPNs in contract order")
    return false
  }
  value.receivedParts.forEach((part, index) => {
    const mpn = requiredMpns[index]
    if (
      !hasExactKeySet(part, ["mpn", "receivedQuantity", "identity", "receiptPhoto", "reviewer", "result"]) ||
      !hasExactKeySet(part.identity, ["manufacturer", "materialNumber", "marking", "photo"])
    ) {
      reasons.push(`received-part evidence for ${mpn} has an invalid shape`)
      complete = false
      return
    }
    const identityPhotoAccepted = validateArtifact(
      part.identity.photo,
      "photo",
      `${mpn}.identity-photo`,
      artifacts,
      reasons
    )
    const receiptPhotoAccepted = validateArtifact(
      part.receiptPhoto,
      "photo",
      `${mpn}.receipt-photo`,
      artifacts,
      reasons
    )
    if (
      !finiteNumber(part.receivedQuantity) ||
      !Number.isSafeInteger(part.receivedQuantity) ||
      part.receivedQuantity < minimumReceivedQuantity[mpn] ||
      part.identity.manufacturer !== "Molex" ||
      part.identity.materialNumber !== expectedMaterialNumbers[mpn] ||
      !nonEmptyString(part.identity.marking) ||
      !identityPhotoAccepted ||
      !receiptPhotoAccepted ||
      !validateIndependentReviewer(part.reviewer, `${mpn} received-part`, value.operator, value.reviewer, reasons) ||
      part.result !== "accepted"
    ) {
      reasons.push(`received-part identity, quantity, photo, or review evidence for ${mpn} is incomplete`)
      complete = false
    }
  })
  return complete
}

function validateMatingFitAndLabels(
  value: Bp104FixturePhysicalEvidenceIntake,
  artifacts: Map<string, string>,
  reasons: string[]
): boolean {
  const fit = value.matingFitOrientationLabels
  if (
    !hasExactKeySet(fit, [
      "powerState",
      "sampleFitPhoto",
      "circuitOneAligned",
      "latchLockSeated",
      "independentFixtureStopVerified",
      "namedSignalLabelsLegible",
      "pinOneMarkerLegible",
      "forcedMateObserved",
      "reviewer",
      "result"
    ])
  ) {
    reasons.push("mating fit, orientation, and label evidence has an invalid shape")
    return false
  }
  const photoAccepted = validateArtifact(fit.sampleFitPhoto, "photo", "sample fit", artifacts, reasons)
  const complete =
    fit.powerState === "off-and-discharged" &&
    photoAccepted &&
    fit.circuitOneAligned === true &&
    fit.latchLockSeated === true &&
    fit.independentFixtureStopVerified === true &&
    fit.namedSignalLabelsLegible === true &&
    fit.pinOneMarkerLegible === true &&
    fit.forcedMateObserved === false &&
    validateIndependentReviewer(fit.reviewer, "mating fit", value.operator, value.reviewer, reasons) &&
    fit.result === "accepted"
  if (!complete) reasons.push("de-energized mating fit, orientation, labels, and reviewer evidence is incomplete")
  return complete
}

function validateMiswireRejection(
  value: Bp104FixturePhysicalEvidenceIntake,
  artifacts: Map<string, string>,
  reasons: string[]
): boolean {
  let complete = true
  if (
    !Array.isArray(value.miswireRejection) ||
    value.miswireRejection.length !== requiredNegativeTestIds.length ||
    value.miswireRejection.some(
      (result, index) => !isPlainRecord(result) || result.id !== requiredNegativeTestIds[index]
    )
  ) {
    reasons.push("miswire rejection must contain all four BP-104 negative tests in contract order")
    return false
  }
  value.miswireRejection.forEach((result, index) => {
    const id = requiredNegativeTestIds[index]
    if (!hasExactKeySet(result, ["id", "artifact", "result", "observation", "reviewer"])) {
      reasons.push(`miswire rejection ${id} has an invalid shape`)
      complete = false
      return
    }
    const artifactAccepted = validateArtifact(result.artifact, "measurement-record", id, artifacts, reasons)
    if (
      !artifactAccepted ||
      result.result !== "rejected" ||
      !nonEmptyString(result.observation) ||
      !validateIndependentReviewer(result.reviewer, id, value.operator, value.reviewer, reasons)
    ) {
      reasons.push(`miswire rejection ${id} must have an observed rejected result and reviewer`)
      complete = false
    }
  })
  return complete
}

function validateCrimpAndRetention(
  value: Bp104FixturePhysicalEvidenceIntake,
  artifacts: Map<string, string>,
  reasons: string[]
): boolean {
  let complete = true
  if (
    !Array.isArray(value.crimpAndRetention) ||
    value.crimpAndRetention.length !== requiredSignals.length ||
    value.crimpAndRetention.some((record, index) => !isPlainRecord(record) || record.signal !== requiredSignals[index])
  ) {
    reasons.push("crimp and retention must contain all seven conductors in cavity order")
    return false
  }
  value.crimpAndRetention.forEach((record, index) => {
    const signal = requiredSignals[index]
    if (
      !hasExactKeySet(record, [
        "signal",
        "cavity",
        "terminalMpn",
        "crimpArtifact",
        "retentionArtifact",
        "reviewer",
        "result"
      ])
    ) {
      reasons.push(`crimp and retention for ${signal} has an invalid shape`)
      complete = false
      return
    }
    const crimpAccepted = validateArtifact(record.crimpArtifact, "photo", `${signal}.crimp`, artifacts, reasons)
    const retentionAccepted = validateArtifact(
      record.retentionArtifact,
      "photo",
      `${signal}.retention`,
      artifacts,
      reasons
    )
    if (
      record.cavity !== index + 1 ||
      record.terminalMpn !== "43030-0007" ||
      !crimpAccepted ||
      !retentionAccepted ||
      !validateIndependentReviewer(
        record.reviewer,
        `${signal} crimp and retention`,
        value.operator,
        value.reviewer,
        reasons
      ) ||
      record.result !== "accepted"
    ) {
      reasons.push(`crimp and retention for ${signal} is incomplete or not accepted`)
      complete = false
    }
  })
  return complete
}

function validateStrainRelief(
  value: Bp104FixturePhysicalEvidenceIntake,
  artifacts: Map<string, string>,
  reasons: string[]
): boolean {
  const strainRelief = value.strainRelief
  if (
    !hasExactKeySet(strainRelief, [
      "artifact",
      "pullLoadPathBypassesCrimpAndPcb",
      "bendPathVerified",
      "reviewer",
      "result"
    ])
  ) {
    reasons.push("strain-relief evidence has an invalid shape")
    return false
  }
  const artifactAccepted = validateArtifact(strainRelief.artifact, "photo", "strain relief", artifacts, reasons)
  const complete =
    artifactAccepted &&
    strainRelief.pullLoadPathBypassesCrimpAndPcb === true &&
    strainRelief.bendPathVerified === true &&
    validateIndependentReviewer(strainRelief.reviewer, "strain relief", value.operator, value.reviewer, reasons) &&
    strainRelief.result === "accepted"
  if (!complete) reasons.push("strain-relief evidence is incomplete or not accepted")
  return complete
}

function validateContinuity(
  value: Bp104FixturePhysicalEvidenceIntake,
  artifacts: Map<string, string>,
  reasons: string[]
): boolean {
  const continuity = value.continuity
  if (
    !hasExactKeySet(continuity, ["record", "measurementArtifact", "instrumentAndCalibration", "reviewer", "result"]) ||
    !hasExactKeySet(continuity.instrumentAndCalibration, [
      "manufacturer",
      "model",
      "serialNumber",
      "calibrationCertificate",
      "calibrationDueDate",
      "calibrationArtifact"
    ])
  ) {
    reasons.push("continuity and calibration evidence has an invalid shape")
    return false
  }
  const measurementAccepted = validateArtifact(
    continuity.measurementArtifact,
    "measurement-record",
    "continuity measurement",
    artifacts,
    reasons
  )
  const calibrationAccepted = validateArtifact(
    continuity.instrumentAndCalibration.calibrationArtifact,
    "calibration-certificate",
    "instrument calibration",
    artifacts,
    reasons
  )
  const instrument = continuity.instrumentAndCalibration
  const record = continuity.record
  const recordEvaluation =
    record === null
      ? { accepted: false, reasons: ["continuity record is required"] }
      : evaluateBenchPrototypeContinuityEvidence(record)
  if (record !== null && recordEvaluation.accepted === false) {
    reasons.push("calibrated continuity record failed the existing BP-104 continuity evaluator")
  }
  const calibrationDueDate = parseRealUtcDate(instrument.calibrationDueDate)
  const instrumentMatchesRecord =
    record !== null &&
    instrument.manufacturer === record.equipment.manufacturer &&
    instrument.model === record.equipment.model &&
    instrument.serialNumber === record.equipment.serialNumber &&
    instrument.calibrationCertificate === record.equipment.calibrationCertificate &&
    instrument.calibrationDueDate === record.equipment.calibrationDueDate
  const complete =
    record !== null &&
    recordEvaluation.accepted &&
    measurementAccepted &&
    calibrationAccepted &&
    nonEmptyString(instrument.manufacturer) &&
    nonEmptyString(instrument.model) &&
    nonEmptyString(instrument.serialNumber) &&
    nonEmptyString(instrument.calibrationCertificate) &&
    calibrationDueDate !== null &&
    instrumentMatchesRecord &&
    validateIndependentReviewer(continuity.reviewer, "continuity", value.operator, value.reviewer, reasons) &&
    continuity.result === "accepted"
  if (!complete) reasons.push("instrument IDs, calibration provenance, continuity hashes, and reviewer are incomplete")
  return complete
}

type CompleteSourceReview = Bp104FixturePhysicalEvidenceIntake["sourceReviews"][number] & {
  readonly drawingArtifact: Bp104IntakeArtifact
  readonly reviewArtifact: Bp104IntakeArtifact
} & (
    | {
        readonly mpn: "43030-0007"
        readonly cadDisposition: "not-acquired-pattern-probe-returned-404"
        readonly cadArtifact: null
      }
    | {
        readonly mpn: "43045-1200" | "43025-1200" | "44242-0005"
        readonly cadDisposition: "exact-retained-cad-artifact"
        readonly cadArtifact: Bp104IntakeArtifact
      }
  )

function isCompleteSourceReview(
  value: Bp104FixturePhysicalEvidenceIntake["sourceReviews"][number]
): value is CompleteSourceReview {
  if (value === null || typeof value !== "object") return false
  return (
    value.result === "accepted" &&
    value.drawingArtifact !== null &&
    value.reviewArtifact !== null &&
    ((value.mpn === "43030-0007" &&
      value.cadDisposition === "not-acquired-pattern-probe-returned-404" &&
      value.cadArtifact === null) ||
      (value.mpn !== "43030-0007" &&
        value.cadDisposition === "exact-retained-cad-artifact" &&
        value.cadArtifact !== null))
  )
}

type CompleteReceivedPart = Bp104FixturePhysicalEvidenceIntake["receivedParts"][number] & {
  readonly receivedQuantity: number
  readonly identity: Bp104FixturePhysicalEvidenceIntake["receivedParts"][number]["identity"] & {
    readonly photo: Bp104IntakeArtifact
  }
  readonly receiptPhoto: Bp104IntakeArtifact
}

function isCompleteReceivedPart(
  value: Bp104FixturePhysicalEvidenceIntake["receivedParts"][number]
): value is CompleteReceivedPart {
  if (value === null || typeof value !== "object") return false
  return (
    value.result === "accepted" &&
    value.receivedQuantity !== null &&
    value.receiptPhoto !== null &&
    value.identity.photo !== null
  )
}

function isCompleteFit(
  value: Bp104FixturePhysicalEvidenceIntake["matingFitOrientationLabels"]
): value is Bp104FixturePhysicalEvidenceIntake["matingFitOrientationLabels"] & {
  readonly powerState: "off-and-discharged"
  readonly sampleFitPhoto: Bp104IntakeArtifact
  readonly circuitOneAligned: true
  readonly latchLockSeated: true
  readonly independentFixtureStopVerified: true
  readonly namedSignalLabelsLegible: true
  readonly pinOneMarkerLegible: true
  readonly forcedMateObserved: false
} {
  if (value === null || typeof value !== "object") return false
  return (
    value.result === "accepted" &&
    value.powerState === "off-and-discharged" &&
    value.sampleFitPhoto !== null &&
    value.circuitOneAligned === true &&
    value.latchLockSeated === true &&
    value.independentFixtureStopVerified === true &&
    value.namedSignalLabelsLegible === true &&
    value.pinOneMarkerLegible === true &&
    value.forcedMateObserved === false
  )
}

function isCompleteMiswire(
  value: Bp104FixturePhysicalEvidenceIntake["miswireRejection"][number]
): value is Bp104FixturePhysicalEvidenceIntake["miswireRejection"][number] & {
  readonly artifact: Bp104IntakeArtifact
  readonly result: "rejected"
  readonly observation: string
} {
  if (value === null || typeof value !== "object") return false
  return value.result === "rejected" && value.artifact !== null && nonEmptyString(value.observation)
}

function isCompleteCrimp(
  value: Bp104FixturePhysicalEvidenceIntake["crimpAndRetention"][number]
): value is Bp104FixturePhysicalEvidenceIntake["crimpAndRetention"][number] & {
  readonly cavity: number
  readonly terminalMpn: "43030-0007"
  readonly crimpArtifact: Bp104IntakeArtifact
  readonly retentionArtifact: Bp104IntakeArtifact
  readonly result: "accepted"
} {
  if (value === null || typeof value !== "object") return false
  return (
    value.result === "accepted" &&
    value.cavity !== null &&
    value.terminalMpn === "43030-0007" &&
    value.crimpArtifact !== null &&
    value.retentionArtifact !== null
  )
}

function isCompleteStrainRelief(
  value: Bp104FixturePhysicalEvidenceIntake["strainRelief"]
): value is Bp104FixturePhysicalEvidenceIntake["strainRelief"] & {
  readonly artifact: Bp104IntakeArtifact
  readonly pullLoadPathBypassesCrimpAndPcb: true
  readonly bendPathVerified: true
  readonly result: "accepted"
} {
  if (value === null || typeof value !== "object") return false
  return (
    value.result === "accepted" &&
    value.artifact !== null &&
    value.pullLoadPathBypassesCrimpAndPcb === true &&
    value.bendPathVerified === true
  )
}

type CompleteContinuity = Bp104FixturePhysicalEvidenceIntake["continuity"] & {
  readonly record: BenchPrototypeContinuityEvidence
  readonly measurementArtifact: Bp104IntakeArtifact
  readonly instrumentAndCalibration: Bp104FixturePhysicalEvidenceIntake["continuity"]["instrumentAndCalibration"] & {
    readonly calibrationArtifact: Bp104IntakeArtifact
  }
  readonly result: "accepted"
}

function isCompleteContinuity(value: Bp104FixturePhysicalEvidenceIntake["continuity"]): value is CompleteContinuity {
  if (value === null || typeof value !== "object") return false
  return (
    value.result === "accepted" &&
    value.record !== null &&
    value.measurementArtifact !== null &&
    value.instrumentAndCalibration.calibrationArtifact !== null
  )
}

export function toBenchPrototypeFixturePhysicalEvidence(value: Bp104FixturePhysicalEvidenceIntake): unknown | null {
  if (
    !nonEmptyString(value.intakeId) ||
    !nonEmptyString(value.recordedAtUtc) ||
    !nonEmptyString(value.operator) ||
    !Array.isArray(value.sourceReviews) ||
    !Array.isArray(value.receivedParts) ||
    !Array.isArray(value.miswireRejection) ||
    !Array.isArray(value.crimpAndRetention) ||
    !value.sourceReviews.every(isCompleteSourceReview) ||
    !value.receivedParts.every(isCompleteReceivedPart) ||
    !isCompleteFit(value.matingFitOrientationLabels) ||
    !value.miswireRejection.every(isCompleteMiswire) ||
    !value.crimpAndRetention.every(isCompleteCrimp) ||
    !isCompleteStrainRelief(value.strainRelief) ||
    !isCompleteContinuity(value.continuity)
  ) {
    return null
  }
  const sourceReviews = value.sourceReviews
  const receivedParts = value.receivedParts
  const fit = value.matingFitOrientationLabels
  const miswire = value.miswireRejection
  const crimp = value.crimpAndRetention
  const strainRelief = value.strainRelief
  const continuity = value.continuity
  return {
    artifactKind: "bench-prototype-fixture-physical-evidence",
    evidenceId: value.intakeId,
    status: "measured",
    recordedAtUtc: value.recordedAtUtc,
    operator: value.operator,
    drawingCadReviews: sourceReviews.map((review) => ({
      mpn: review.mpn,
      drawingArtifactId: review.drawingArtifact.artifactId,
      cadDisposition: review.cadDisposition,
      cadArtifactId: review.cadArtifact?.artifactId ?? null,
      reviewArtifactId: review.reviewArtifact.artifactId,
      drawingSha256: review.drawingArtifact.contentSha256,
      cadSha256: review.cadArtifact?.contentSha256 ?? null,
      reviewSha256: review.reviewArtifact.contentSha256,
      reviewedAtUtc: review.reviewArtifact.capturedAtUtc,
      result: "accepted"
    })),
    receivedParts: receivedParts.map((part) => ({
      mpn: part.mpn,
      receivedQuantity: part.receivedQuantity,
      receiptArtifactId: part.receiptPhoto.artifactId,
      receiptSha256: part.receiptPhoto.contentSha256
    })),
    fitOrientationAndLabels: {
      powerState: fit.powerState,
      sampleFitArtifactId: fit.sampleFitPhoto.artifactId,
      sampleFitSha256: fit.sampleFitPhoto.contentSha256,
      circuitOneAligned: fit.circuitOneAligned,
      latchLockSeated: fit.latchLockSeated,
      independentFixtureStopVerified: fit.independentFixtureStopVerified,
      namedSignalLabelsLegible: fit.namedSignalLabelsLegible,
      pinOneMarkerLegible: fit.pinOneMarkerLegible,
      forcedMateObserved: fit.forcedMateObserved,
      result: "accepted"
    },
    negativeMiswireResults: miswire.map((result) => ({
      id: result.id,
      artifactId: result.artifact.artifactId,
      contentSha256: result.artifact.contentSha256,
      result: "rejected",
      observation: result.observation
    })),
    crimpAndRetention: crimp.map((record) => ({
      signal: record.signal,
      cavity: record.cavity,
      terminalMpn: record.terminalMpn,
      crimpArtifactId: record.crimpArtifact.artifactId,
      crimpSha256: record.crimpArtifact.contentSha256,
      retentionArtifactId: record.retentionArtifact.artifactId,
      retentionSha256: record.retentionArtifact.contentSha256,
      result: "accepted"
    })),
    strainRelief: {
      artifactId: strainRelief.artifact.artifactId,
      contentSha256: strainRelief.artifact.contentSha256,
      pullLoadPathBypassesCrimpAndPcb: strainRelief.pullLoadPathBypassesCrimpAndPcb,
      bendPathVerified: strainRelief.bendPathVerified,
      result: "accepted"
    },
    continuityEvidence: continuity.record
  }
}

export const blankBp104FixturePhysicalEvidenceIntake: Bp104FixturePhysicalEvidenceIntake = deepFreeze({
  artifactKind: "bench-prototype-fixture-physical-evidence-intake",
  intakeId: null,
  status: "incomplete",
  recordedAtUtc: null,
  operator: null,
  reviewer: null,
  sourceReviews: requiredMpns.map((mpn) => ({
    mpn,
    source: {
      drawingUrl: null,
      drawingPath: null,
      drawingSha256: null,
      cadUrl: null,
      cadPath: null,
      cadSha256: null
    },
    cadDisposition: null,
    drawingArtifact: null,
    cadArtifact: null,
    reviewArtifact: null,
    reviewer: null,
    result: "incomplete"
  })),
  receivedParts: requiredMpns.map((mpn) => ({
    mpn,
    receivedQuantity: null,
    identity: { manufacturer: null, materialNumber: null, marking: null, photo: null },
    receiptPhoto: null,
    reviewer: null,
    result: "incomplete"
  })),
  matingFitOrientationLabels: {
    powerState: null,
    sampleFitPhoto: null,
    circuitOneAligned: null,
    latchLockSeated: null,
    independentFixtureStopVerified: null,
    namedSignalLabelsLegible: null,
    pinOneMarkerLegible: null,
    forcedMateObserved: null,
    reviewer: null,
    result: "incomplete"
  },
  miswireRejection: requiredNegativeTestIds.map((id) => ({
    id,
    artifact: null,
    result: "incomplete",
    observation: null,
    reviewer: null
  })),
  crimpAndRetention: requiredSignals.map((signal) => ({
    signal,
    cavity: null,
    terminalMpn: null,
    crimpArtifact: null,
    retentionArtifact: null,
    reviewer: null,
    result: "incomplete"
  })),
  strainRelief: {
    artifact: null,
    pullLoadPathBypassesCrimpAndPcb: null,
    bendPathVerified: null,
    reviewer: null,
    result: "incomplete"
  },
  continuity: {
    record: null,
    measurementArtifact: null,
    instrumentAndCalibration: {
      manufacturer: null,
      model: null,
      serialNumber: null,
      calibrationCertificate: null,
      calibrationDueDate: null,
      calibrationArtifact: null
    },
    reviewer: null,
    result: "incomplete"
  },
  statement:
    "Blank intake template. No received hardware, physical fit, continuity, crimp, or fabrication result is claimed."
} as const)

function hasBp104IntakeShape(value: unknown): value is Bp104FixturePhysicalEvidenceIntake {
  return hasExactKeySet(value, [
    "artifactKind",
    "intakeId",
    "status",
    "recordedAtUtc",
    "operator",
    "reviewer",
    "sourceReviews",
    "receivedParts",
    "matingFitOrientationLabels",
    "miswireRejection",
    "crimpAndRetention",
    "strainRelief",
    "continuity",
    "statement"
  ])
}

export function evaluateBp104FixturePhysicalEvidenceIntake(
  value: unknown
): Bp104FixturePhysicalEvidenceIntakeEvaluation {
  const reasons: string[] = []
  inspectDataGraph(value, "intake", new WeakSet<object>(), reasons)
  if (reasons.length > 0 || !hasBp104IntakeShape(value)) {
    if (reasons.length === 0) reasons.push("intake must contain only the exact BP-104 enumerable data keys")
    return deepFreeze({ accepted: false, status: "incomplete", reasons })
  }
  const intake = value
  if (intake.artifactKind !== "bench-prototype-fixture-physical-evidence-intake")
    reasons.push("artifact kind is invalid")
  if (!nonEmptyString(intake.intakeId)) reasons.push("intakeId is required")
  if (parseCanonicalUtcTimestamp(intake.recordedAtUtc) === null)
    reasons.push("recordedAtUtc must be a real UTC ISO timestamp")
  if (!nonEmptyString(intake.operator) || !nonEmptyString(intake.reviewer))
    reasons.push("operator and reviewer are required")
  else if (intake.operator === intake.reviewer) reasons.push("intake reviewer must differ from the operator")
  if (intake.reviewer !== null && intake.reviewer !== requiredIndependentReviewer)
    reasons.push("intake reviewer must be root-final-reviewer")
  if (intake.status !== "incomplete" && intake.status !== "accepted")
    reasons.push("status must be incomplete or accepted")
  if (!nonEmptyString(intake.statement)) reasons.push("statement is required")

  const artifacts = new Map<string, string>()
  const sourceReviewsComplete = validateSourceReviews(intake, artifacts, reasons)
  const receivedPartsComplete = validateReceivedParts(intake, artifacts, reasons)
  const matingFitComplete = validateMatingFitAndLabels(intake, artifacts, reasons)
  const miswireComplete = validateMiswireRejection(intake, artifacts, reasons)
  const crimpComplete = validateCrimpAndRetention(intake, artifacts, reasons)
  const strainReliefComplete = validateStrainRelief(intake, artifacts, reasons)
  const continuityComplete = validateContinuity(intake, artifacts, reasons)
  if (
    sourceReviewsComplete &&
    receivedPartsComplete &&
    matingFitComplete &&
    miswireComplete &&
    crimpComplete &&
    strainReliefComplete &&
    continuityComplete
  ) {
    validateArtifactReviewers(intake, reasons)
  }

  const physicalEvidence = toBenchPrototypeFixturePhysicalEvidence(intake)
  if (physicalEvidence === null) {
    reasons.push("all intake sections must be complete before physical evidence can be evaluated")
  } else {
    const physicalEvaluation = evaluateBenchPrototypeFixturePhysicalEvidence(physicalEvidence)
    if (!physicalEvaluation.accepted) {
      physicalEvaluation.reasons.forEach((reason) => reasons.push(`underlying BP-104 evaluator: ${reason}`))
    }
  }
  const accepted = intake.status === "accepted" && reasons.length === 0
  if (intake.status === "accepted" && !accepted)
    reasons.push("accepted status requires every intake section and evaluator gate to pass")
  if (intake.status === "incomplete" && physicalEvidence !== null && reasons.length === 0) {
    reasons.push("complete intake evidence must declare accepted status")
  }
  return deepFreeze({ accepted, status: accepted ? "accepted" : "incomplete", reasons })
}

export function validateBp104FixturePhysicalEvidenceIntake(value: unknown): true {
  const evaluation = evaluateBp104FixturePhysicalEvidenceIntake(value)
  if (!evaluation.accepted) throw new RangeError(evaluation.reasons.join("; "))
  return true
}
