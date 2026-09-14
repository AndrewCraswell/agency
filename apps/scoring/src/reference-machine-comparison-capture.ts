/**
 * M1-10 reference-machine comparison evidence boundary.
 *
 * A capture is a record of observations, not a scoring input or an expected
 * result. This parser deliberately has no path that produces a decision,
 * timing value, threshold, or golden-scenario expectation.
 */

import { strictExactDataObject, strictDataObject, type StrictDataObject } from "./strict-data-object.js"

export const REFERENCE_MACHINE_COMPARISON_CAPTURE_SCHEMA_VERSION = "1.0.0" as const
export const REFERENCE_MACHINE_COMPARISON_CAPTURE_FORMAT = "scoring-reference-machine-comparison-capture" as const

export const MAX_REFERENCE_CAPTURE_SOURCES = 16
export const MAX_REFERENCE_CAPTURE_MACHINES = 4
export const MAX_REFERENCE_CAPTURE_INSTRUMENTS = 8
export const MAX_REFERENCE_CAPTURE_INPUTS = 128
export const MAX_REFERENCE_CAPTURE_OUTPUTS = 128
export const MAX_REFERENCE_CAPTURE_ARTIFACTS = 24
export const MAX_REFERENCE_CAPTURE_COMPARISONS = 128

const MAX_SCENARIO_INPUTS = 64
const MAX_MACHINE_SOURCES = 8
const MAX_OBSERVATION_ARTIFACTS = 8
const MAX_COMPARISON_ARTIFACTS = 8
const MAX_CAPTURE_ID_LENGTH = 96
const MAX_LABEL_LENGTH = 240
const MAX_NOTE_LENGTH = 4_000
const MAX_SAFE = Number.MAX_SAFE_INTEGER
const ISO_UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/u
const IDENTIFIER = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/u
const DIGEST = /^sha256:[0-9a-f]{64}$/u
const CONTENT_FORMAT = /^[a-z0-9][a-z0-9.+-]{0,31}$/u
const GOLDEN_SCENARIO_PATH = /^golden-scenarios\/[a-z0-9]+(?:[._-][a-z0-9]+)*\.json$/u

export type ReferenceCaptureAuthority = "fie" | "implementation" | "fixture" | "prior-art"
export type ReferenceCaptureSourceUse =
  | "normative-context"
  | "contract-context"
  | "machine-identity"
  | "fixture-context"
  | "comparison-context"
export type ReferenceCaptureObservationQuality = "clear" | "partial" | "ambiguous" | "unavailable"
export type ReferenceCaptureReportedDisposition =
  | "qualified-hit"
  | "off-target"
  | "rejected-contact"
  | "line-fault"
  | "reset"
  | "uncertainty"
  | "calibration"
export type ReferenceCaptureComparisonRelationship =
  | "same"
  | "different"
  | "left-only"
  | "right-only"
  | "inconclusive"
  | "not-observed"
  | "not-comparable"

export type ReferenceCaptureTimestamp = string
export type ReferenceCaptureDigest = string

export type ReferenceCaptureSession = Readonly<{
  startedAt: ReferenceCaptureTimestamp
  endedAt: ReferenceCaptureTimestamp
  timeUnit: "us"
  clockOrigin: "capture-start" | "fixture-trigger" | "machine-power-on" | "unknown"
  wallClockUncertaintyUs: number
}>

export type ReferenceCaptureScenarioRef = Readonly<{
  scenarioId: string
  path: string
  schemaVersion: "1.0.0"
  contentDigest: ReferenceCaptureDigest
  inputIds: readonly string[]
}>

export type ReferenceCaptureSourceRef = Readonly<{
  id: string
  authority: ReferenceCaptureAuthority
  document: string
  contentDigest: ReferenceCaptureDigest
  page: number | null
  locator: string
  use: ReferenceCaptureSourceUse
}>

export type ReferenceCaptureFirmware = Readonly<{
  identityStatus: "identified" | "unknown" | "not-applicable"
  identity: string | null
  version: string | null
  buildDigest: ReferenceCaptureDigest | null
  identityBasis: string
}>

export type ReferenceCaptureMachine = Readonly<{
  id: string
  role: "reference-machine" | "system-under-test" | "fixture" | "repeater"
  manufacturer: string | null
  model: string | null
  serialNumber: string | null
  hardwareRevision: string | null
  firmware: ReferenceCaptureFirmware
  sourceIds: readonly string[]
}>

export type ReferenceCaptureCalibration = Readonly<{
  status: "current" | "expired" | "unknown" | "not-applicable"
  calibratedAt: ReferenceCaptureTimestamp | null
  validThrough: ReferenceCaptureTimestamp | null
  certificateDigest: ReferenceCaptureDigest | null
}>

export type ReferenceCaptureInstrument = Readonly<{
  id: string
  kind: "oscilloscope" | "logic-analyzer" | "multimeter" | "audio-meter" | "video-camera" | "thermometer" | "other"
  manufacturer: string | null
  model: string | null
  serialNumber: string | null
  firmwareVersion: string | null
  calibration: ReferenceCaptureCalibration
}>

export type ReferenceCaptureMeasurementUncertainty = Readonly<{
  kind: "absolute" | "expanded" | "unknown"
  value: number | null
}>

export type ReferenceCaptureMeasurement = Readonly<{
  value: number
  unit: "milliOhm" | "milliVolt" | "us" | "milliCelsius" | "basisPoint" | "count"
  uncertainty: ReferenceCaptureMeasurementUncertainty
  instrumentId: string | null
  method: string
}>

export type ReferenceCaptureLineConnection = Readonly<{
  id: string
  logicalLine: string
  endpoint: string
  state: "connected" | "disconnected" | "unknown"
  verification: "not-checked" | "operator" | "instrument"
}>

export type ReferenceCaptureEnvironmentReading = Readonly<{
  name: "temperature" | "relative-humidity" | "supply-voltage" | "other"
  measurement: ReferenceCaptureMeasurement
}>

export type ReferenceCaptureSetup = Readonly<{
  weapon: "epee" | "foil" | "sabre"
  mode: "bench" | "venue" | "fixture" | "training"
  fixtureId: string | null
  lineConnections: readonly ReferenceCaptureLineConnection[]
  environment: readonly ReferenceCaptureEnvironmentReading[]
  operatorNotes: string
}>

export type ReferenceCaptureInputObservation = Readonly<{
  id: string
  sourceId: string
  atUs: number
  atUncertaintyUs: number
  sourceInputIds: readonly string[]
  channel: string
  state: "open" | "closed" | "grounded" | "shorted" | "disconnected" | "indeterminate" | "not-applicable"
  measurement?: ReferenceCaptureMeasurement | null
  artifactIds: readonly string[]
  notes?: string
}>

export type ReferenceCaptureIndication = Readonly<{
  visual: "red" | "green" | "white" | "yellow" | "both" | "none" | "unknown"
  audible: "heard" | "not-heard" | "none" | "unknown"
  latched: boolean | null
}>

export type ReferenceCaptureDecisionRecordRef = Readonly<{
  recordId: string
  schemaVersion: 1
  contentDigest: ReferenceCaptureDigest
}>

export type ReferenceCaptureOutputObservation = Readonly<{
  id: string
  machineId: string
  atUs: number
  atUncertaintyUs: number
  kind:
    | "panel-indication"
    | "audible-indication"
    | "decision-observation"
    | "diagnostic-indication"
    | "no-indication"
    | "measurement"
  observationQuality: ReferenceCaptureObservationQuality
  reportedDisposition: ReferenceCaptureReportedDisposition | null
  indication: ReferenceCaptureIndication
  measurement: ReferenceCaptureMeasurement | null
  artifactIds: readonly string[]
  decisionRecordRef?: ReferenceCaptureDecisionRecordRef | null
  notes?: string
}>

export type ReferenceCaptureArtifact = Readonly<{
  id: string
  kind:
    | "video"
    | "oscilloscope"
    | "logic-analyzer"
    | "instrument-export"
    | "audio"
    | "photo"
    | "setup-photo"
    | "report"
    | "firmware-image"
  contentDigest: ReferenceCaptureDigest
  contentFormat: string
  byteLength: number
  capturedAt: ReferenceCaptureTimestamp
  fromUs: number
  throughUs: number
  description: string
}>

export type ReferenceCaptureObservationRef = Readonly<{
  machineId: string
  observationId: string
}>

export type ReferenceCaptureComparison = Readonly<{
  id: string
  basis: "observed-pair"
  left: ReferenceCaptureObservationRef
  right: ReferenceCaptureObservationRef
  dimension:
    | "input-state"
    | "disposition"
    | "visual-signal"
    | "audible-signal"
    | "event-time"
    | "diagnostic"
    | "measurement"
  relationship: ReferenceCaptureComparisonRelationship
  delta: ReferenceCaptureMeasurement | null
  evidenceArtifactIds: readonly string[]
  annotation: string
}>

export type ReferenceMachineComparisonCapture = Readonly<{
  $schema: "https://json-schema.org/draft/2020-12/schema"
  format: typeof REFERENCE_MACHINE_COMPARISON_CAPTURE_FORMAT
  schemaVersion: typeof REFERENCE_MACHINE_COMPARISON_CAPTURE_SCHEMA_VERSION
  captureId: string
  title: string
  recordedAt: ReferenceCaptureTimestamp
  session: ReferenceCaptureSession
  scenarioRef: ReferenceCaptureScenarioRef
  sources: readonly ReferenceCaptureSourceRef[]
  machines: readonly ReferenceCaptureMachine[]
  instruments: readonly ReferenceCaptureInstrument[]
  setup: ReferenceCaptureSetup
  inputs: readonly ReferenceCaptureInputObservation[]
  outputs: readonly ReferenceCaptureOutputObservation[]
  artifacts: readonly ReferenceCaptureArtifact[]
  comparisons: readonly ReferenceCaptureComparison[]
  notes?: string
}>

export type ReferenceCaptureErrorCode =
  | "authority"
  | "bounds"
  | "fields"
  | "integer"
  | "reference"
  | "timestamp"
  | "value"

export class ReferenceMachineComparisonCaptureError extends TypeError {
  readonly code: ReferenceCaptureErrorCode
  readonly path: string

  constructor(code: ReferenceCaptureErrorCode, path: string, message: string) {
    super(`Invalid reference-machine comparison capture at ${path}: ${message}`)
    this.code = code
    this.path = path
    this.name = "ReferenceMachineComparisonCaptureError"
  }
}

function invalid(code: ReferenceCaptureErrorCode, path: string, message: string): never {
  throw new ReferenceMachineComparisonCaptureError(code, path, message)
}

function exact(value: unknown, keys: readonly string[], path: string): StrictDataObject {
  try {
    return strictExactDataObject(value, keys, path)
  } catch (error) {
    const message = error instanceof Error ? error.message : "must be a plain object"
    invalid("fields", path, message)
  }
}

function shape(
  value: unknown,
  required: readonly string[],
  optional: readonly string[],
  path: string
): StrictDataObject {
  let object: StrictDataObject
  try {
    object = strictDataObject(value, path)
  } catch (error) {
    const message = error instanceof Error ? error.message : "must be a plain object"
    invalid("fields", path, message)
  }
  const allowed = [...required, ...optional]
  const actual = Reflect.ownKeys(object)
  if (
    required.some((key) => !Object.hasOwn(object, key)) ||
    actual.length !== new Set(actual).size ||
    actual.some((key) => typeof key !== "string" || !allowed.includes(key))
  ) {
    invalid("fields", path, "has missing or unrecognized fields")
  }
  return object
}

function list<T>(
  value: unknown,
  path: string,
  maximum: number,
  parser: (value: unknown, path: string) => T,
  minimum = 0
): T[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
    invalid("value", path, "must be a plain array")
  }
  if (value.length < minimum || value.length > maximum) {
    invalid("bounds", path, `must contain between ${minimum} and ${maximum} items`)
  }
  const keys = Reflect.ownKeys(value)
  if (keys.length !== value.length + 1 || !keys.includes("length") || keys.some((key) => typeof key !== "string")) {
    invalid("fields", path, "must contain only indexed data items")
  }
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length")
  if (lengthDescriptor === undefined || !("value" in lengthDescriptor) || lengthDescriptor.value !== value.length) {
    invalid("fields", path, "must contain a data length property")
  }
  const parsed: T[] = []
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index))
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
      invalid("fields", `${path}[${index}]`, "must be an enumerable data value")
    }
    parsed.push(parser(descriptor.value, `${path}[${index}]`))
  }
  return parsed
}

function stringValue(value: unknown, path: string, maximum: number, minimum = 1): string {
  if (typeof value !== "string" || value.length < minimum || value.length > maximum) {
    invalid("value", path, `must be a string with length ${minimum}..${maximum}`)
  }
  return value
}

function nullableString(value: unknown, path: string, maximum: number): string | null {
  return value === null ? null : stringValue(value, path, maximum)
}

function identifier(value: unknown, path: string): string {
  const result = stringValue(value, path, MAX_CAPTURE_ID_LENGTH)
  if (!IDENTIFIER.test(result)) {
    invalid("value", path, "must be a lowercase bounded identifier")
  }
  return result
}

function digest(value: unknown, path: string): ReferenceCaptureDigest {
  const result = stringValue(value, path, 71)
  if (!DIGEST.test(result)) {
    invalid("value", path, "must be a lowercase sha256 digest")
  }
  return result
}

function timestamp(value: unknown, path: string): ReferenceCaptureTimestamp {
  const result = stringValue(value, path, 32)
  if (!ISO_UTC_TIMESTAMP.test(result) || !Number.isFinite(Date.parse(result))) {
    invalid("timestamp", path, "must be a valid UTC ISO timestamp ending in Z")
  }
  return result
}

function integer(value: unknown, path: string, minimum: number, maximum = MAX_SAFE): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum || value > maximum) {
    invalid("integer", path, `must be a safe integer in ${minimum}..${maximum}`)
  }
  return value
}

function oneOf<T extends string>(value: unknown, path: string, allowed: readonly T[]): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    invalid("value", path, `must be one of ${allowed.join(", ")}`)
  }
  return value as T
}

function nullableTimestamp(value: unknown, path: string): ReferenceCaptureTimestamp | null {
  return value === null ? null : timestamp(value, path)
}

function nullableDigest(value: unknown, path: string): ReferenceCaptureDigest | null {
  return value === null ? null : digest(value, path)
}

function unique(values: readonly string[], path: string): void {
  if (new Set(values).size !== values.length) {
    invalid("value", path, "must contain unique identifiers")
  }
}

function parseSession(value: unknown): ReferenceCaptureSession {
  const object = exact(value, ["startedAt", "endedAt", "timeUnit", "clockOrigin", "wallClockUncertaintyUs"], "session")
  const startedAt = timestamp(object.startedAt, "session.startedAt")
  const endedAt = timestamp(object.endedAt, "session.endedAt")
  if (Date.parse(startedAt) > Date.parse(endedAt)) {
    invalid("value", "session", "endedAt must not precede startedAt")
  }
  return Object.freeze({
    clockOrigin: oneOf(object.clockOrigin, "session.clockOrigin", [
      "capture-start",
      "fixture-trigger",
      "machine-power-on",
      "unknown"
    ]),
    endedAt,
    startedAt,
    timeUnit: oneOf(object.timeUnit, "session.timeUnit", ["us"]),
    wallClockUncertaintyUs: integer(object.wallClockUncertaintyUs, "session.wallClockUncertaintyUs", 0)
  })
}

function parseScenarioRef(value: unknown): ReferenceCaptureScenarioRef {
  const object = exact(value, ["scenarioId", "path", "schemaVersion", "contentDigest", "inputIds"], "scenarioRef")
  const inputIds = list(object.inputIds, "scenarioRef.inputIds", MAX_SCENARIO_INPUTS, identifier, 1)
  unique(inputIds, "scenarioRef.inputIds")
  const path = stringValue(object.path, "scenarioRef.path", MAX_LABEL_LENGTH)
  if (!GOLDEN_SCENARIO_PATH.test(path)) {
    invalid("value", "scenarioRef.path", "must point to a golden-scenarios JSON file")
  }
  if (object.schemaVersion !== REFERENCE_MACHINE_COMPARISON_CAPTURE_SCHEMA_VERSION) {
    invalid("value", "scenarioRef.schemaVersion", "unsupported golden scenario schema version")
  }
  return Object.freeze({
    contentDigest: digest(object.contentDigest, "scenarioRef.contentDigest"),
    inputIds: Object.freeze(inputIds),
    path,
    scenarioId: identifier(object.scenarioId, "scenarioRef.scenarioId"),
    schemaVersion: REFERENCE_MACHINE_COMPARISON_CAPTURE_SCHEMA_VERSION
  })
}

const AUTHORITY_USES: Readonly<Record<ReferenceCaptureAuthority, readonly ReferenceCaptureSourceUse[]>> = {
  fie: ["normative-context"],
  fixture: ["fixture-context"],
  implementation: ["contract-context"],
  "prior-art": ["comparison-context", "fixture-context", "machine-identity"]
}

function parseSource(value: unknown, path: string): ReferenceCaptureSourceRef {
  const object = exact(value, ["id", "authority", "document", "contentDigest", "page", "locator", "use"], path)
  const authority = oneOf(object.authority, `${path}.authority`, ["fie", "implementation", "fixture", "prior-art"])
  const use = oneOf(object.use, `${path}.use`, [
    "normative-context",
    "contract-context",
    "machine-identity",
    "fixture-context",
    "comparison-context"
  ])
  if (!AUTHORITY_USES[authority].includes(use)) {
    invalid("authority", `${path}.use`, `${authority} sources cannot be used as ${use}; observations are evidence only`)
  }
  const page = object.page === null ? null : integer(object.page, `${path}.page`, 1)
  if ((authority === "fie" || authority === "prior-art") && page === null) {
    invalid("authority", `${path}.page`, `${authority} sources require a page locator`)
  }
  if ((authority === "implementation" || authority === "fixture") && page !== null) {
    invalid("authority", `${path}.page`, `${authority} sources cannot claim a published page authority`)
  }
  return Object.freeze({
    authority,
    contentDigest: digest(object.contentDigest, `${path}.contentDigest`),
    document: stringValue(object.document, `${path}.document`, MAX_LABEL_LENGTH),
    id: identifier(object.id, `${path}.id`),
    locator: stringValue(object.locator, `${path}.locator`, MAX_LABEL_LENGTH),
    page,
    use
  })
}

function parseFirmware(value: unknown, path: string): ReferenceCaptureFirmware {
  const object = exact(value, ["identityStatus", "identity", "version", "buildDigest", "identityBasis"], path)
  const identityStatus = oneOf(object.identityStatus, `${path}.identityStatus`, [
    "identified",
    "unknown",
    "not-applicable"
  ])
  const identity = nullableString(object.identity, `${path}.identity`, 160)
  const version = nullableString(object.version, `${path}.version`, 96)
  if (identityStatus === "identified" && (identity === null || version === null)) {
    invalid("value", path, "identified firmware requires identity and version")
  }
  if (identityStatus === "unknown" && (identity !== null || version !== null || object.buildDigest !== null)) {
    invalid("value", path, "unknown firmware cannot carry an identity or build digest")
  }
  if (identityStatus === "not-applicable" && (identity !== null || version !== null || object.buildDigest !== null)) {
    invalid("value", path, "not-applicable firmware cannot carry an identity or build digest")
  }
  return Object.freeze({
    buildDigest: nullableDigest(object.buildDigest, `${path}.buildDigest`),
    identity,
    identityBasis: stringValue(object.identityBasis, `${path}.identityBasis`, MAX_LABEL_LENGTH),
    identityStatus,
    version
  })
}

function parseMachine(value: unknown, path: string): ReferenceCaptureMachine {
  const object = exact(
    value,
    ["id", "role", "manufacturer", "model", "serialNumber", "hardwareRevision", "firmware", "sourceIds"],
    path
  )
  const sourceIds = list(object.sourceIds, `${path}.sourceIds`, MAX_MACHINE_SOURCES, identifier)
  unique(sourceIds, `${path}.sourceIds`)
  return Object.freeze({
    firmware: parseFirmware(object.firmware, `${path}.firmware`),
    hardwareRevision: nullableString(object.hardwareRevision, `${path}.hardwareRevision`, 96),
    id: identifier(object.id, `${path}.id`),
    manufacturer: nullableString(object.manufacturer, `${path}.manufacturer`, 120),
    model: nullableString(object.model, `${path}.model`, 120),
    role: oneOf(object.role, `${path}.role`, ["reference-machine", "system-under-test", "fixture", "repeater"]),
    serialNumber: nullableString(object.serialNumber, `${path}.serialNumber`, 120),
    sourceIds: Object.freeze(sourceIds)
  })
}

function parseCalibration(value: unknown, path: string): ReferenceCaptureCalibration {
  const object = exact(value, ["status", "calibratedAt", "validThrough", "certificateDigest"], path)
  const status = oneOf(object.status, `${path}.status`, ["current", "expired", "unknown", "not-applicable"])
  const calibratedAt = nullableTimestamp(object.calibratedAt, `${path}.calibratedAt`)
  const validThrough = nullableTimestamp(object.validThrough, `${path}.validThrough`)
  const certificateDigest = nullableDigest(object.certificateDigest, `${path}.certificateDigest`)
  if (status === "current" && (calibratedAt === null || validThrough === null || certificateDigest === null)) {
    invalid("authority", path, "current calibration requires dates and a certificate digest")
  }
  if (
    (status === "unknown" || status === "not-applicable") &&
    (calibratedAt !== null || validThrough !== null || certificateDigest !== null)
  ) {
    invalid("authority", path, `${status} calibration cannot claim calibration evidence`)
  }
  if (calibratedAt !== null && validThrough !== null && Date.parse(calibratedAt) > Date.parse(validThrough)) {
    invalid("value", path, "validThrough must not precede calibratedAt")
  }
  return Object.freeze({ calibratedAt, certificateDigest, status, validThrough })
}

function parseInstrument(value: unknown, path: string): ReferenceCaptureInstrument {
  const object = exact(
    value,
    ["id", "kind", "manufacturer", "model", "serialNumber", "firmwareVersion", "calibration"],
    path
  )
  return Object.freeze({
    calibration: parseCalibration(object.calibration, `${path}.calibration`),
    firmwareVersion: nullableString(object.firmwareVersion, `${path}.firmwareVersion`, 96),
    id: identifier(object.id, `${path}.id`),
    kind: oneOf(object.kind, `${path}.kind`, [
      "oscilloscope",
      "logic-analyzer",
      "multimeter",
      "audio-meter",
      "video-camera",
      "thermometer",
      "other"
    ]),
    manufacturer: nullableString(object.manufacturer, `${path}.manufacturer`, 120),
    model: nullableString(object.model, `${path}.model`, 120),
    serialNumber: nullableString(object.serialNumber, `${path}.serialNumber`, 120)
  })
}

function parseMeasurementUncertainty(value: unknown, path: string): ReferenceCaptureMeasurementUncertainty {
  const object = exact(value, ["kind", "value"], path)
  const kind = oneOf(object.kind, `${path}.kind`, ["absolute", "expanded", "unknown"])
  const uncertaintyValue = object.value === null ? null : integer(object.value, `${path}.value`, 0)
  if (kind === "unknown" && uncertaintyValue !== null) {
    invalid("value", path, "unknown uncertainty must use a null value")
  }
  if (kind !== "unknown" && uncertaintyValue === null) {
    invalid("value", path, `${kind} uncertainty requires a non-negative value`)
  }
  return Object.freeze({ kind, value: uncertaintyValue })
}

function parseMeasurement(value: unknown, path: string, instruments: ReadonlySet<string>): ReferenceCaptureMeasurement {
  const object = exact(value, ["value", "unit", "uncertainty", "instrumentId", "method"], path)
  const unit = oneOf(object.unit, `${path}.unit`, [
    "milliOhm",
    "milliVolt",
    "us",
    "milliCelsius",
    "basisPoint",
    "count"
  ])
  const measurementValue = integer(
    object.value,
    `${path}.value`,
    unit === "milliOhm" || unit === "us" || unit === "count" ? 0 : -MAX_SAFE
  )
  const instrumentId = object.instrumentId === null ? null : identifier(object.instrumentId, `${path}.instrumentId`)
  if (instrumentId !== null && !instruments.has(instrumentId)) {
    invalid("reference", `${path}.instrumentId`, `unknown instrument ${instrumentId}`)
  }
  return Object.freeze({
    instrumentId,
    method: stringValue(object.method, `${path}.method`, 240),
    uncertainty: parseMeasurementUncertainty(object.uncertainty, `${path}.uncertainty`),
    unit,
    value: measurementValue
  })
}

function parseSetup(value: unknown, instruments: ReadonlySet<string>): ReferenceCaptureSetup {
  const object = exact(
    value,
    ["weapon", "mode", "fixtureId", "lineConnections", "environment", "operatorNotes"],
    "setup"
  )
  const lineConnections = list(object.lineConnections, "setup.lineConnections", 16, parseLineConnection)
  const environment = list(object.environment, "setup.environment", 16, (item, path) =>
    parseEnvironmentReading(item, path, instruments)
  )
  const connectionIds = lineConnections.map((connection) => connection.id)
  unique(connectionIds, "setup.lineConnections")
  return Object.freeze({
    environment: Object.freeze(environment),
    fixtureId: object.fixtureId === null ? null : identifier(object.fixtureId, "setup.fixtureId"),
    lineConnections: Object.freeze(lineConnections),
    mode: oneOf(object.mode, "setup.mode", ["bench", "venue", "fixture", "training"]),
    operatorNotes: stringValue(object.operatorNotes, "setup.operatorNotes", 2_000, 0),
    weapon: oneOf(object.weapon, "setup.weapon", ["epee", "foil", "sabre"])
  })
}

function parseLineConnection(value: unknown, path: string): ReferenceCaptureLineConnection {
  const object = exact(value, ["id", "logicalLine", "endpoint", "state", "verification"], path)
  return Object.freeze({
    endpoint: stringValue(object.endpoint, `${path}.endpoint`, MAX_LABEL_LENGTH),
    id: identifier(object.id, `${path}.id`),
    logicalLine: stringValue(object.logicalLine, `${path}.logicalLine`, 120),
    state: oneOf(object.state, `${path}.state`, ["connected", "disconnected", "unknown"]),
    verification: oneOf(object.verification, `${path}.verification`, ["not-checked", "operator", "instrument"])
  })
}

function parseEnvironmentReading(
  value: unknown,
  path: string,
  instruments: ReadonlySet<string>
): ReferenceCaptureEnvironmentReading {
  const object = exact(value, ["name", "measurement"], path)
  return Object.freeze({
    measurement: parseMeasurement(object.measurement, `${path}.measurement`, instruments),
    name: oneOf<ReferenceCaptureEnvironmentReading["name"]>(object.name, `${path}.name`, [
      "temperature",
      "relative-humidity",
      "supply-voltage",
      "other"
    ])
  })
}

function optionalMeasurement(
  object: StrictDataObject,
  key: string,
  path: string,
  instruments: ReadonlySet<string>
): ReferenceCaptureMeasurement | null | undefined {
  if (!Object.hasOwn(object, key) || object[key] === undefined || object[key] === null) {
    return Object.hasOwn(object, key) ? null : undefined
  }
  return parseMeasurement(object[key], `${path}.${key}`, instruments)
}

function optionalNotes(object: StrictDataObject, key: string, path: string, maximum: number): string | undefined {
  return Object.hasOwn(object, key) ? stringValue(object[key], `${path}.${key}`, maximum, 0) : undefined
}

function parseInput(
  value: unknown,
  path: string,
  scenarioInputIds: ReadonlySet<string>,
  artifacts: ReadonlySet<string>,
  instruments: ReadonlySet<string>,
  machines: ReadonlySet<string>
): ReferenceCaptureInputObservation {
  const object = shape(
    value,
    ["id", "sourceId", "atUs", "atUncertaintyUs", "sourceInputIds", "channel", "state", "artifactIds"],
    ["measurement", "notes"],
    path
  )
  const sourceInputIds = list(object.sourceInputIds, `${path}.sourceInputIds`, MAX_OBSERVATION_ARTIFACTS, identifier)
  unique(sourceInputIds, `${path}.sourceInputIds`)
  for (const sourceInputId of sourceInputIds) {
    if (!scenarioInputIds.has(sourceInputId)) {
      invalid("reference", `${path}.sourceInputIds`, `unknown golden scenario input ${sourceInputId}`)
    }
  }
  const artifactIds = list(object.artifactIds, `${path}.artifactIds`, MAX_OBSERVATION_ARTIFACTS, identifier)
  unique(artifactIds, `${path}.artifactIds`)
  for (const artifactId of artifactIds) {
    if (!artifacts.has(artifactId)) invalid("reference", `${path}.artifactIds`, `unknown artifact ${artifactId}`)
  }
  const sourceId = identifier(object.sourceId, `${path}.sourceId`)
  if (!machines.has(sourceId)) invalid("reference", `${path}.sourceId`, `unknown source machine ${sourceId}`)
  const parsed: {
    id: string
    sourceId: string
    atUs: number
    atUncertaintyUs: number
    sourceInputIds: readonly string[]
    channel: string
    state: ReferenceCaptureInputObservation["state"]
    artifactIds: readonly string[]
    measurement?: ReferenceCaptureMeasurement | null
    notes?: string
  } = {
    artifactIds: Object.freeze(artifactIds),
    atUncertaintyUs: integer(object.atUncertaintyUs, `${path}.atUncertaintyUs`, 0),
    atUs: integer(object.atUs, `${path}.atUs`, 0),
    channel: stringValue(object.channel, `${path}.channel`, 120),
    id: identifier(object.id, `${path}.id`),
    sourceId,
    sourceInputIds: Object.freeze(sourceInputIds),
    state: oneOf(object.state, `${path}.state`, [
      "open",
      "closed",
      "grounded",
      "shorted",
      "disconnected",
      "indeterminate",
      "not-applicable"
    ])
  }
  const measurement = optionalMeasurement(object, "measurement", path, instruments)
  if (measurement !== undefined) parsed.measurement = measurement
  const notes = optionalNotes(object, "notes", path, 500)
  if (notes !== undefined) parsed.notes = notes
  return Object.freeze(parsed)
}

function parseIndication(value: unknown, path: string): ReferenceCaptureIndication {
  const object = exact(value, ["visual", "audible", "latched"], path)
  return Object.freeze({
    audible: oneOf(object.audible, `${path}.audible`, ["heard", "not-heard", "none", "unknown"]),
    latched:
      object.latched === null
        ? null
        : typeof object.latched === "boolean"
          ? object.latched
          : invalid("value", `${path}.latched`, "must be boolean or null"),
    visual: oneOf(object.visual, `${path}.visual`, ["red", "green", "white", "yellow", "both", "none", "unknown"])
  })
}

function parseDecisionRecordRef(value: unknown, path: string): ReferenceCaptureDecisionRecordRef {
  const object = exact(value, ["recordId", "schemaVersion", "contentDigest"], path)
  if (object.schemaVersion !== 1)
    invalid("value", `${path}.schemaVersion`, "unsupported decision-record schema version")
  return Object.freeze({
    contentDigest: digest(object.contentDigest, `${path}.contentDigest`),
    recordId: identifier(object.recordId, `${path}.recordId`),
    schemaVersion: 1
  })
}

function parseOutput(
  value: unknown,
  path: string,
  artifacts: ReadonlySet<string>,
  instruments: ReadonlySet<string>,
  machines: ReadonlySet<string>
): ReferenceCaptureOutputObservation {
  const object = shape(
    value,
    [
      "id",
      "machineId",
      "atUs",
      "atUncertaintyUs",
      "kind",
      "observationQuality",
      "reportedDisposition",
      "indication",
      "measurement",
      "artifactIds"
    ],
    ["decisionRecordRef", "notes"],
    path
  )
  const machineId = identifier(object.machineId, `${path}.machineId`)
  if (!machines.has(machineId)) invalid("reference", `${path}.machineId`, `unknown machine ${machineId}`)
  const artifactIds = list(object.artifactIds, `${path}.artifactIds`, MAX_OBSERVATION_ARTIFACTS, identifier)
  unique(artifactIds, `${path}.artifactIds`)
  for (const artifactId of artifactIds)
    if (!artifacts.has(artifactId)) invalid("reference", `${path}.artifactIds`, `unknown artifact ${artifactId}`)
  const parsed: {
    id: string
    machineId: string
    atUs: number
    atUncertaintyUs: number
    kind: ReferenceCaptureOutputObservation["kind"]
    observationQuality: ReferenceCaptureObservationQuality
    reportedDisposition: ReferenceCaptureReportedDisposition | null
    indication: ReferenceCaptureIndication
    measurement: ReferenceCaptureMeasurement | null
    artifactIds: readonly string[]
    decisionRecordRef?: ReferenceCaptureDecisionRecordRef | null
    notes?: string
  } = {
    artifactIds: Object.freeze(artifactIds),
    atUncertaintyUs: integer(object.atUncertaintyUs, `${path}.atUncertaintyUs`, 0),
    atUs: integer(object.atUs, `${path}.atUs`, 0),
    id: identifier(object.id, `${path}.id`),
    indication: parseIndication(object.indication, `${path}.indication`),
    kind: oneOf(object.kind, `${path}.kind`, [
      "panel-indication",
      "audible-indication",
      "decision-observation",
      "diagnostic-indication",
      "no-indication",
      "measurement"
    ]),
    machineId,
    measurement:
      object.measurement === null ? null : parseMeasurement(object.measurement, `${path}.measurement`, instruments),
    observationQuality: oneOf(object.observationQuality, `${path}.observationQuality`, [
      "clear",
      "partial",
      "ambiguous",
      "unavailable"
    ]),
    reportedDisposition:
      object.reportedDisposition === null
        ? null
        : oneOf<ReferenceCaptureReportedDisposition>(object.reportedDisposition, `${path}.reportedDisposition`, [
            "qualified-hit",
            "off-target",
            "rejected-contact",
            "line-fault",
            "reset",
            "uncertainty",
            "calibration"
          ])
  }
  if (Object.hasOwn(object, "decisionRecordRef")) {
    parsed.decisionRecordRef =
      object.decisionRecordRef === null
        ? null
        : parseDecisionRecordRef(object.decisionRecordRef, `${path}.decisionRecordRef`)
  }
  const notes = optionalNotes(object, "notes", path, 500)
  if (notes !== undefined) parsed.notes = notes
  return Object.freeze(parsed)
}

function parseArtifact(value: unknown, path: string, session: ReferenceCaptureSession): ReferenceCaptureArtifact {
  const object = exact(
    value,
    ["id", "kind", "contentDigest", "contentFormat", "byteLength", "capturedAt", "fromUs", "throughUs", "description"],
    path
  )
  const fromUs = integer(object.fromUs, `${path}.fromUs`, 0)
  const throughUs = integer(object.throughUs, `${path}.throughUs`, 0)
  if (throughUs < fromUs) invalid("value", path, "throughUs must not precede fromUs")
  const capturedAt = timestamp(object.capturedAt, `${path}.capturedAt`)
  if (Date.parse(capturedAt) < Date.parse(session.startedAt) || Date.parse(capturedAt) > Date.parse(session.endedAt)) {
    invalid("value", `${path}.capturedAt`, "must be within the capture session")
  }
  return Object.freeze({
    byteLength: integer(object.byteLength, `${path}.byteLength`, 0),
    capturedAt,
    contentDigest: digest(object.contentDigest, `${path}.contentDigest`),
    contentFormat: (() => {
      const result = stringValue(object.contentFormat, `${path}.contentFormat`, 32)
      if (!CONTENT_FORMAT.test(result)) invalid("value", `${path}.contentFormat`, "must be a lowercase content format")
      return result
    })(),
    description: stringValue(object.description, `${path}.description`, MAX_LABEL_LENGTH),
    fromUs,
    id: identifier(object.id, `${path}.id`),
    kind: oneOf(object.kind, `${path}.kind`, [
      "video",
      "oscilloscope",
      "logic-analyzer",
      "instrument-export",
      "audio",
      "photo",
      "setup-photo",
      "report",
      "firmware-image"
    ]),
    throughUs
  })
}

function parseObservationRef(value: unknown, path: string): ReferenceCaptureObservationRef {
  const object = exact(value, ["machineId", "observationId"], path)
  return Object.freeze({
    machineId: identifier(object.machineId, `${path}.machineId`),
    observationId: identifier(object.observationId, `${path}.observationId`)
  })
}

function sessionWindowUs(session: ReferenceCaptureSession): number {
  const durationMilliseconds = Date.parse(session.endedAt) - Date.parse(session.startedAt)
  const durationUs = durationMilliseconds > Math.floor(MAX_SAFE / 1_000) ? MAX_SAFE : durationMilliseconds * 1_000
  return durationUs > MAX_SAFE - session.wallClockUncertaintyUs ? MAX_SAFE : durationUs + session.wallClockUncertaintyUs
}

function assertWithinSessionWindow(value: number, path: string, upperBoundUs: number): void {
  if (value > upperBoundUs) {
    invalid("bounds", path, "must be bounded by the capture session")
  }
}

function observationThroughUs(atUs: number, uncertaintyUs: number, path: string): number {
  if (atUs > MAX_SAFE - uncertaintyUs) {
    invalid("integer", path, "timestamp plus uncertainty exceeds the safe integer range")
  }
  return atUs + uncertaintyUs
}

function parseComparison(
  value: unknown,
  path: string,
  artifacts: ReadonlySet<string>,
  instruments: ReadonlySet<string>
): ReferenceCaptureComparison {
  const object = exact(
    value,
    ["id", "basis", "left", "right", "dimension", "relationship", "delta", "evidenceArtifactIds", "annotation"],
    path
  )
  const evidenceArtifactIds = list(
    object.evidenceArtifactIds,
    `${path}.evidenceArtifactIds`,
    MAX_COMPARISON_ARTIFACTS,
    identifier,
    1
  )
  unique(evidenceArtifactIds, `${path}.evidenceArtifactIds`)
  for (const artifactId of evidenceArtifactIds)
    if (!artifacts.has(artifactId))
      invalid("reference", `${path}.evidenceArtifactIds`, `unknown artifact ${artifactId}`)
  return Object.freeze({
    annotation: stringValue(object.annotation, `${path}.annotation`, 1_000),
    basis: oneOf(object.basis, `${path}.basis`, ["observed-pair"]),
    delta: object.delta === null ? null : parseMeasurement(object.delta, `${path}.delta`, instruments),
    dimension: oneOf(object.dimension, `${path}.dimension`, [
      "input-state",
      "disposition",
      "visual-signal",
      "audible-signal",
      "event-time",
      "diagnostic",
      "measurement"
    ]),
    evidenceArtifactIds: Object.freeze(evidenceArtifactIds),
    id: identifier(object.id, `${path}.id`),
    left: parseObservationRef(object.left, `${path}.left`),
    relationship: oneOf(object.relationship, `${path}.relationship`, [
      "same",
      "different",
      "left-only",
      "right-only",
      "inconclusive",
      "not-observed",
      "not-comparable"
    ]),
    right: parseObservationRef(object.right, `${path}.right`)
  })
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value
  for (const child of Object.values(value)) deepFreeze(child)
  return Object.freeze(value)
}

function parseRoot(value: unknown): ReferenceMachineComparisonCapture {
  const object = shape(
    value,
    [
      "$schema",
      "format",
      "schemaVersion",
      "captureId",
      "title",
      "recordedAt",
      "session",
      "scenarioRef",
      "sources",
      "machines",
      "instruments",
      "setup",
      "inputs",
      "outputs",
      "artifacts",
      "comparisons"
    ],
    ["notes"],
    "capture"
  )
  if (object.$schema !== "https://json-schema.org/draft/2020-12/schema")
    invalid("value", "capture.$schema", "unsupported schema identifier")
  if (object.format !== REFERENCE_MACHINE_COMPARISON_CAPTURE_FORMAT)
    invalid("value", "capture.format", "unsupported capture format")
  if (object.schemaVersion !== REFERENCE_MACHINE_COMPARISON_CAPTURE_SCHEMA_VERSION)
    invalid("value", "capture.schemaVersion", "unsupported capture schema version")
  const session = parseSession(object.session)
  const scenarioRef = parseScenarioRef(object.scenarioRef)
  const sources = list(object.sources, "capture.sources", MAX_REFERENCE_CAPTURE_SOURCES, parseSource, 1)
  const sourceIds = sources.map((source) => source.id)
  unique(sourceIds, "capture.sources")
  const sourceSet = new Set(sourceIds)
  const machines = list(object.machines, "capture.machines", MAX_REFERENCE_CAPTURE_MACHINES, parseMachine, 1)
  const machineIds = machines.map((machine) => machine.id)
  unique(machineIds, "capture.machines")
  for (const machine of machines) {
    for (const sourceId of machine.sourceIds)
      if (!sourceSet.has(sourceId)) invalid("reference", "capture.machines", `unknown source ${sourceId}`)
  }
  const machineSet = new Set(machineIds)
  const instruments = list(
    object.instruments,
    "capture.instruments",
    MAX_REFERENCE_CAPTURE_INSTRUMENTS,
    parseInstrument
  )
  const instrumentIds = instruments.map((instrument) => instrument.id)
  unique(instrumentIds, "capture.instruments")
  const instrumentSet = new Set(instrumentIds)
  const artifacts = list(object.artifacts, "capture.artifacts", MAX_REFERENCE_CAPTURE_ARTIFACTS, (item, path) =>
    parseArtifact(item, path, session)
  )
  const artifactIds = artifacts.map((artifact) => artifact.id)
  unique(artifactIds, "capture.artifacts")
  const artifactSet = new Set(artifactIds)
  const setup = parseSetup(object.setup, instrumentSet)
  if (setup.fixtureId !== null && !machineSet.has(setup.fixtureId))
    invalid("reference", "capture.setup.fixtureId", `unknown fixture machine ${setup.fixtureId}`)
  const scenarioInputs = new Set(scenarioRef.inputIds)
  const inputs = list(
    object.inputs,
    "capture.inputs",
    MAX_REFERENCE_CAPTURE_INPUTS,
    (item, path) => parseInput(item, path, scenarioInputs, artifactSet, instrumentSet, machineSet),
    1
  )
  const inputIds = inputs.map((input) => input.id)
  unique(inputIds, "capture.inputs")
  const outputs = list(
    object.outputs,
    "capture.outputs",
    MAX_REFERENCE_CAPTURE_OUTPUTS,
    (item, path) => parseOutput(item, path, artifactSet, instrumentSet, machineSet),
    1
  )
  const outputIds = outputs.map((output) => output.id)
  unique(outputIds, "capture.outputs")
  const sessionUpperBoundUs = sessionWindowUs(session)
  for (const input of inputs) {
    assertWithinSessionWindow(input.atUs, `capture.inputs.${input.id}.atUs`, sessionUpperBoundUs)
    assertWithinSessionWindow(
      observationThroughUs(input.atUs, input.atUncertaintyUs, `capture.inputs.${input.id}.atUs`),
      `capture.inputs.${input.id}.atUs`,
      sessionUpperBoundUs
    )
  }
  for (const output of outputs) {
    assertWithinSessionWindow(output.atUs, `capture.outputs.${output.id}.atUs`, sessionUpperBoundUs)
    assertWithinSessionWindow(
      observationThroughUs(output.atUs, output.atUncertaintyUs, `capture.outputs.${output.id}.atUs`),
      `capture.outputs.${output.id}.atUs`,
      sessionUpperBoundUs
    )
  }
  for (const artifact of artifacts) {
    assertWithinSessionWindow(artifact.fromUs, `capture.artifacts.${artifact.id}.fromUs`, sessionUpperBoundUs)
    assertWithinSessionWindow(artifact.throughUs, `capture.artifacts.${artifact.id}.throughUs`, sessionUpperBoundUs)
  }
  const comparisons = list(object.comparisons, "capture.comparisons", MAX_REFERENCE_CAPTURE_COMPARISONS, (item, path) =>
    parseComparison(item, path, artifactSet, instrumentSet)
  )
  const comparisonIds = comparisons.map((comparison) => comparison.id)
  unique(comparisonIds, "capture.comparisons")
  if (inputIds.some((inputId) => outputIds.includes(inputId))) {
    invalid("value", "capture.observations", "input and output observation IDs must be globally unique")
  }
  const inputById = new Map(inputs.map((input) => [input.id, input]))
  const outputById = new Map(outputs.map((output) => [output.id, output]))
  for (const comparison of comparisons) {
    const leftInput = inputById.get(comparison.left.observationId)
    const rightInput = inputById.get(comparison.right.observationId)
    const leftOutput = outputById.get(comparison.left.observationId)
    const rightOutput = outputById.get(comparison.right.observationId)
    const leftIsInput = leftInput !== undefined
    const rightIsInput = rightInput !== undefined
    const leftIsOutput = leftOutput !== undefined
    const rightIsOutput = rightOutput !== undefined
    if (!leftIsInput && !leftIsOutput)
      invalid("reference", "capture.comparisons", `unknown observation ${comparison.left.observationId}`)
    if (!rightIsInput && !rightIsOutput)
      invalid("reference", "capture.comparisons", `unknown observation ${comparison.right.observationId}`)
    const leftMachineId = leftInput?.sourceId ?? leftOutput?.machineId
    const rightMachineId = rightInput?.sourceId ?? rightOutput?.machineId
    if (leftMachineId !== comparison.left.machineId || rightMachineId !== comparison.right.machineId) {
      invalid("reference", "capture.comparisons", "observation references must preserve the observed machine identity")
    }
    if (comparison.left.machineId === comparison.right.machineId)
      invalid("value", "capture.comparisons", "comparison sides must identify different machines")
    if (comparison.dimension === "input-state" && (!leftIsInput || !rightIsInput))
      invalid("reference", "capture.comparisons", "input-state comparisons require input observations")
    if (comparison.dimension !== "input-state" && (!leftIsOutput || !rightIsOutput))
      invalid("reference", "capture.comparisons", "output comparisons require output observations")
  }
  const result: {
    $schema: "https://json-schema.org/draft/2020-12/schema"
    format: typeof REFERENCE_MACHINE_COMPARISON_CAPTURE_FORMAT
    schemaVersion: typeof REFERENCE_MACHINE_COMPARISON_CAPTURE_SCHEMA_VERSION
    captureId: string
    title: string
    recordedAt: string
    session: ReferenceCaptureSession
    scenarioRef: ReferenceCaptureScenarioRef
    sources: readonly ReferenceCaptureSourceRef[]
    machines: readonly ReferenceCaptureMachine[]
    instruments: readonly ReferenceCaptureInstrument[]
    setup: ReferenceCaptureSetup
    inputs: readonly ReferenceCaptureInputObservation[]
    outputs: readonly ReferenceCaptureOutputObservation[]
    artifacts: readonly ReferenceCaptureArtifact[]
    comparisons: readonly ReferenceCaptureComparison[]
    notes?: string
  } = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    artifacts: Object.freeze(artifacts),
    captureId: identifier(object.captureId, "capture.captureId"),
    comparisons: Object.freeze(comparisons),
    format: REFERENCE_MACHINE_COMPARISON_CAPTURE_FORMAT,
    inputs: Object.freeze(inputs),
    instruments: Object.freeze(instruments),
    machines: Object.freeze(machines),
    outputs: Object.freeze(outputs),
    recordedAt: timestamp(object.recordedAt, "capture.recordedAt"),
    scenarioRef,
    schemaVersion: REFERENCE_MACHINE_COMPARISON_CAPTURE_SCHEMA_VERSION,
    session,
    setup,
    sources: Object.freeze(sources),
    title: stringValue(object.title, "capture.title", MAX_LABEL_LENGTH)
  }
  const notes = optionalNotes(object, "notes", "capture", MAX_NOTE_LENGTH)
  if (notes !== undefined) result.notes = notes
  return deepFreeze(result)
}

/**
 * Parse and freeze a comparison capture. Unknown schema versions, fields,
 * authorities, references, and out-of-bounds values are rejected. The return
 * value contains observations only; it cannot be used as a scorer expectation.
 */
export function parseReferenceMachineComparisonCapture(value: unknown): ReferenceMachineComparisonCapture {
  return parseRoot(value)
}

/**
 * A narrow type guard for callers that need to reject non-record values before
 * handing them to the parser. It intentionally does not validate the record.
 */
export function isReferenceMachineComparisonCapture(value: unknown): value is ReferenceMachineComparisonCapture {
  try {
    parseReferenceMachineComparisonCapture(value)
    return true
  } catch (error) {
    if (error instanceof ReferenceMachineComparisonCaptureError) return false
    throw error
  }
}
