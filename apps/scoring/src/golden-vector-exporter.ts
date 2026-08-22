import { createHash } from "node:crypto"
import {
  advanceEpeeResistanceScoring,
  createEpeeResistanceScoringState,
  type EpeeResistanceSample
} from "./epee-resistance.js"
import { advanceFoilScoring, createFoilScoringState, type FoilSample } from "./foil.js"
import { advanceSabreScoring, createSabreScoringState, type SabreContact, type SabreSample } from "./sabre.js"
import { generateTimingBoundaryVectors, type TimingBoundarySide, type TimingBoundaryVector } from "./timing-boundary.js"
import { loadTimingTable, type TimingTable } from "./timing-table.js"

/** The language-neutral fixture format consumed by host firmware tests. */
export const GOLDEN_VECTOR_EXPORT_FORMAT = "scoring-firmware-golden-vectors" as const
export const GOLDEN_VECTOR_EXPORT_SCHEMA_VERSION = "1.0.0" as const
export const GOLDEN_VECTOR_EXPORT_RULE_SET_REVISION = "rules-1" as const
export const GOLDEN_VECTOR_EXPORT_SOURCE = "m1-08-runtime-boundary-vectors" as const

type EpeeStimulus = Readonly<{
  format: "epee-resistance-v1"
  samples: readonly EpeeResistanceSample[]
}>

type FoilStimulus = Readonly<{
  format: "foil-v1"
  samples: readonly FoilSample[]
}>

type SabreStimulus = Readonly<{
  format: "sabre-v1"
  samples: readonly SabreSample[]
}>

export type GoldenVectorStimulus = EpeeStimulus | FoilStimulus | SabreStimulus

export type GoldenVectorHit = Readonly<{
  classification: "on-target" | "off-target" | null
  qualifiedAtUs: number
  side: TimingBoundarySide
  startedAtUs: number
}>

export type GoldenVectorDiagnostic = Readonly<{
  code: "sabre-white"
  side: TimingBoundarySide
  value: string
}>

export type GoldenVectorExpected = Readonly<{
  disposition: "diagnostic" | "no-hit" | "qualified-hit"
  diagnostics: readonly GoldenVectorDiagnostic[]
  hits: readonly GoldenVectorHit[]
}>

export type GoldenVectorFixture = Readonly<{
  boundary: string
  boundaryUs: number
  elapsedUs: number
  expected: GoldenVectorExpected
  id: string
  position: "above" | "at" | "below"
  side: TimingBoundarySide
  stimulus: GoldenVectorStimulus
  weapon: "epee" | "foil" | "sabre"
}>

export type GoldenVectorExport = Readonly<{
  digest: string
  format: typeof GOLDEN_VECTOR_EXPORT_FORMAT
  ordering: "m1-08-generation-order"
  resistanceUnit: "milliOhm"
  ruleSetRevision: typeof GOLDEN_VECTOR_EXPORT_RULE_SET_REVISION
  schemaVersion: typeof GOLDEN_VECTOR_EXPORT_SCHEMA_VERSION
  source: typeof GOLDEN_VECTOR_EXPORT_SOURCE
  timeUnit: "us"
  timingTableRevision: "timing-1"
  vectors: readonly GoldenVectorFixture[]
}>

export type GoldenVectorExportOptions = Readonly<{
  /** Only the released M1-08 runtime boundary source is exportable here. */
  source?: unknown
  /** M1-08 loads this immutable table directly; no epee-only rule mapping is used. */
  timingTableRevision?: unknown
  /** M0-07 planned scenarios are not silently turned into firmware vectors. */
  scenarioStatus?: unknown
}>

const DEFAULT_OPTIONS: GoldenVectorExportOptions = Object.freeze({
  source: GOLDEN_VECTOR_EXPORT_SOURCE,
  timingTableRevision: "timing-1"
})

const NO_MEASUREMENT = Object.freeze({
  resistanceMilliOhms: null,
  resistanceUncertaintyMilliOhms: null
})

const NORMAL_10_OHM = Object.freeze({
  resistanceMilliOhms: 10_000,
  resistanceUncertaintyMilliOhms: 0
})

const EPEE_OPEN = Object.freeze({
  circuitComplete: "open" as const,
  contactResistance: NO_MEASUREMENT,
  groundPathResistance: NO_MEASUREMENT,
  groundedMaterial: "not-grounded" as const,
  lineIntegrity: "intact" as const
})

const EPEE_HIT = Object.freeze({
  circuitComplete: "closed" as const,
  contactResistance: NORMAL_10_OHM,
  groundPathResistance: NO_MEASUREMENT,
  groundedMaterial: "not-grounded" as const,
  lineIntegrity: "intact" as const
})

const FOIL_CLOSED = Object.freeze({
  circuitBreak: "closed" as const,
  insulationDiagnostic: "unavailable" as const,
  integrity: "intact" as const,
  targetContext: "target" as const
})

const FOIL_ON_TARGET = Object.freeze({ ...FOIL_CLOSED, circuitBreak: "open" as const })

const SABRE_READY = Object.freeze({
  bladeContact: "absent" as const,
  circuitBCFault: "normal" as const,
  externalPathEligibility: "eligible" as const,
  ownEquipmentFault: "absent" as const,
  targetContact: "target" as const
})

const SABRE_NON_CONDUCTIVE = Object.freeze({ ...SABRE_READY, targetContact: "nonConductiveSurface" as const })
const SABRE_BLADE_TARGET = Object.freeze({ ...SABRE_READY, bladeContact: "present" as const })
const SABRE_BLADE_NON_CONDUCTIVE = Object.freeze({
  ...SABRE_NON_CONDUCTIVE,
  bladeContact: "present" as const
})

function oppositeSide(side: TimingBoundarySide): TimingBoundarySide {
  return side === "left" ? "right" : "left"
}

function epeeSample(atUs: number, side: TimingBoundarySide, contact: typeof EPEE_OPEN | typeof EPEE_HIT) {
  return side === "left" ? { atUs, left: contact, right: EPEE_OPEN } : { atUs, left: EPEE_OPEN, right: contact }
}

function foilSample(atUs: number, side: TimingBoundarySide, contact: typeof FOIL_CLOSED | typeof FOIL_ON_TARGET) {
  return side === "left" ? { atUs, left: contact, right: FOIL_CLOSED } : { atUs, left: FOIL_CLOSED, right: contact }
}

function sabreSample(atUs: number, side: TimingBoundarySide, contact: SabreContact) {
  return side === "left"
    ? { atUs, left: contact, right: SABRE_NON_CONDUCTIVE }
    : { atUs, left: SABRE_NON_CONDUCTIVE, right: contact }
}

/** Derives the immediately pre-boundary sabre sample without copying timing. */
export function deriveSabreInterruptionAtUs(minimumContactUs: unknown): number {
  if (typeof minimumContactUs !== "number" || !Number.isSafeInteger(minimumContactUs) || minimumContactUs < 1) {
    throw new RangeError("timing-1 sabre minimum contact must permit a pre-boundary sample")
  }

  return minimumContactUs - 1
}

function sabreInterruptionAtUs(table: TimingTable): number {
  return deriveSabreInterruptionAtUs(table.sabre.minimumContactUs)
}

function replayEpee(samples: readonly EpeeResistanceSample[], table: TimingTable) {
  let state = createEpeeResistanceScoringState()

  for (const sample of samples) {
    state = advanceEpeeResistanceScoring(state, sample, table)
  }

  return state
}

function replayFoil(samples: readonly FoilSample[], table: TimingTable) {
  let state = createFoilScoringState()

  for (const sample of samples) {
    state = advanceFoilScoring(state, sample, table)
  }

  return state
}

function replaySabre(samples: readonly SabreSample[], table: TimingTable) {
  let state = createSabreScoringState()

  for (const sample of samples) {
    state = advanceSabreScoring(state, sample, table)
  }

  return state
}

function makeExpected(
  hits: readonly GoldenVectorHit[],
  diagnostics: readonly GoldenVectorDiagnostic[] = []
): GoldenVectorExpected {
  return Object.freeze({
    diagnostics: Object.freeze([...diagnostics]),
    disposition: hits.length > 0 ? "qualified-hit" : diagnostics.length > 0 ? "diagnostic" : "no-hit",
    hits: Object.freeze([...hits])
  })
}

function makeEpeeFixture(vector: TimingBoundaryVector, table: TimingTable): GoldenVectorFixture {
  const firstSide = oppositeSide(vector.side)
  const firstHitAtUs = table.epee.contactMinimumUs
  const opposingStartUs = firstHitAtUs + vector.elapsedUs - table.epee.contactMinimumUs
  const samples =
    vector.boundary === "contact-minimum"
      ? [epeeSample(0, vector.side, EPEE_HIT), epeeSample(vector.elapsedUs, vector.side, EPEE_HIT)]
      : [
          epeeSample(0, firstSide, EPEE_HIT),
          epeeSample(firstHitAtUs, firstSide, EPEE_HIT),
          epeeSample(opposingStartUs, vector.side, EPEE_HIT),
          epeeSample(opposingStartUs + table.epee.contactMinimumUs, vector.side, EPEE_HIT)
        ]
  const state = replayEpee(samples, table)
  const hits = state.hits.map((hit) => ({
    classification: null,
    qualifiedAtUs: hit.qualifiedAtUs,
    side: hit.side,
    startedAtUs: hit.startedAtUs
  }))

  return Object.freeze({
    boundary: vector.boundary,
    boundaryUs: vector.boundaryUs,
    elapsedUs: vector.elapsedUs,
    expected: makeExpected(hits),
    id: vector.id,
    position: vector.position,
    side: vector.side,
    stimulus: Object.freeze({ format: "epee-resistance-v1", samples: Object.freeze(samples) }),
    weapon: vector.weapon
  })
}

function makeFoilFixture(vector: TimingBoundaryVector, table: TimingTable): GoldenVectorFixture {
  const firstSide = oppositeSide(vector.side)
  const firstHitAtUs = table.foil.contactBreakMinimumUs
  const opposingStartUs = firstHitAtUs + vector.elapsedUs - table.foil.contactBreakMinimumUs
  const samples =
    vector.boundary === "contact-break-minimum"
      ? [foilSample(0, vector.side, FOIL_ON_TARGET), foilSample(vector.elapsedUs, vector.side, FOIL_ON_TARGET)]
      : [
          foilSample(0, firstSide, FOIL_ON_TARGET),
          foilSample(firstHitAtUs, firstSide, FOIL_ON_TARGET),
          foilSample(opposingStartUs, vector.side, FOIL_ON_TARGET),
          foilSample(opposingStartUs + table.foil.contactBreakMinimumUs, vector.side, FOIL_ON_TARGET)
        ]
  const state = replayFoil(samples, table)
  const hits = state.hits.map((hit) => ({
    classification: hit.classification,
    qualifiedAtUs: hit.qualifiedAtUs,
    side: hit.side,
    startedAtUs: hit.startedAtUs
  }))

  return Object.freeze({
    boundary: vector.boundary,
    boundaryUs: vector.boundaryUs,
    elapsedUs: vector.elapsedUs,
    expected: makeExpected(hits),
    id: vector.id,
    position: vector.position,
    side: vector.side,
    stimulus: Object.freeze({ format: "foil-v1", samples: Object.freeze(samples) }),
    weapon: vector.weapon
  })
}

function makeSabreFixture(vector: TimingBoundaryVector, table: TimingTable): GoldenVectorFixture {
  let samples: readonly SabreSample[]

  if (vector.boundary === "minimum-contact") {
    samples = [sabreSample(0, vector.side, SABRE_READY), sabreSample(vector.elapsedUs, vector.side, SABRE_READY)]
  } else if (vector.boundary === "blade-registration-latest") {
    const candidateStartUs = vector.elapsedUs - table.sabre.minimumContactUs
    const interruptionAtUs = sabreInterruptionAtUs(table)
    samples = [
      sabreSample(0, vector.side, SABRE_BLADE_TARGET),
      sabreSample(interruptionAtUs, vector.side, SABRE_BLADE_NON_CONDUCTIVE),
      sabreSample(candidateStartUs, vector.side, SABRE_BLADE_TARGET),
      sabreSample(vector.elapsedUs, vector.side, SABRE_BLADE_TARGET)
    ]
  } else if (vector.boundary === "blade-recovery") {
    const interruptionAtUs = sabreInterruptionAtUs(table)
    samples = [
      sabreSample(0, vector.side, SABRE_BLADE_TARGET),
      sabreSample(interruptionAtUs, vector.side, SABRE_BLADE_NON_CONDUCTIVE),
      sabreSample(vector.elapsedUs, vector.side, SABRE_READY),
      sabreSample(vector.elapsedUs + table.sabre.minimumContactUs, vector.side, SABRE_READY)
    ]
  } else if (vector.boundary === "control-break") {
    const controlBreak = Object.freeze({ ...SABRE_NON_CONDUCTIVE, circuitBCFault: "controlBreak" as const })
    samples = [sabreSample(0, vector.side, controlBreak), sabreSample(vector.elapsedUs, vector.side, controlBreak)]
  } else {
    const firstSide = oppositeSide(vector.side)
    const firstHitAtUs = table.sabre.minimumContactUs
    const opposingStartUs = firstHitAtUs + vector.elapsedUs - table.sabre.minimumContactUs
    samples = [
      sabreSample(0, firstSide, SABRE_READY),
      sabreSample(firstHitAtUs, firstSide, SABRE_READY),
      sabreSample(opposingStartUs, vector.side, SABRE_READY),
      sabreSample(opposingStartUs + table.sabre.minimumContactUs, vector.side, SABRE_READY)
    ]
  }

  const state = replaySabre(samples, table)
  const hits = state.hits.map((hit) => ({
    classification: null,
    qualifiedAtUs: hit.qualifiedAtUs,
    side: hit.side,
    startedAtUs: hit.startedAtUs
  }))
  const diagnostics = (["left", "right"] as const).flatMap((side) => {
    const sideState = state[side]
    return [{ code: "sabre-white" as const, side, value: sideState.whiteDiagnostic }]
  })

  return Object.freeze({
    boundary: vector.boundary,
    boundaryUs: vector.boundaryUs,
    elapsedUs: vector.elapsedUs,
    expected: makeExpected(hits, diagnostics),
    id: vector.id,
    position: vector.position,
    side: vector.side,
    stimulus: Object.freeze({ format: "sabre-v1", samples: Object.freeze(samples) }),
    weapon: vector.weapon
  })
}

function makeFixture(vector: TimingBoundaryVector, table: TimingTable): GoldenVectorFixture {
  if (vector.weapon === "epee") {
    return makeEpeeFixture(vector, table)
  }

  if (vector.weapon === "foil") {
    return makeFoilFixture(vector, table)
  }

  return makeSabreFixture(vector, table)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function canonicalize(value: unknown): unknown {
  if (value === undefined || typeof value === "function" || typeof value === "symbol" || typeof value === "bigint") {
    throw new TypeError("Golden-vector export contains a non-JSON value")
  }

  if (Array.isArray(value)) {
    return value.map(canonicalize)
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)])
    )
  }

  return value
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value))!
}

function digestFor(value: unknown): string {
  return `sha256:${createHash("sha256").update(canonicalJson(value), "utf8").digest("hex")}`
}

function withoutDigest(value: GoldenVectorExport): Omit<GoldenVectorExport, "digest"> {
  const { digest: _digest, ...unsigned } = value
  return unsigned
}

function freezeDeep<const Value>(value: Value): Value {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) {
      freezeDeep(nested)
    }

    Object.freeze(value)
  }

  return value
}

function validateOptions(options: unknown): asserts options is GoldenVectorExportOptions {
  if (!isRecord(options)) {
    throw new TypeError("Golden-vector export options must be an object")
  }

  const optionKeys = Reflect.ownKeys(options)
  const supportedKeys = ["scenarioStatus", "source", "timingTableRevision"]

  if (
    optionKeys.some((key) => typeof key !== "string" || !supportedKeys.includes(key)) ||
    optionKeys.length !== new Set(optionKeys).size
  ) {
    throw new TypeError("Golden-vector export options contain an unsupported field")
  }

  const source = options.source ?? GOLDEN_VECTOR_EXPORT_SOURCE

  if (source !== GOLDEN_VECTOR_EXPORT_SOURCE) {
    throw new RangeError("Unsupported golden-vector export source")
  }

  if (options.scenarioStatus === "planned") {
    throw new RangeError("Planned M0-07 scenarios cannot be exported as firmware vectors")
  }

  if (options.scenarioStatus !== undefined && options.scenarioStatus !== "active") {
    throw new RangeError("Unsupported M0-07 scenario status")
  }

  if (options.timingTableRevision !== undefined && options.timingTableRevision !== "timing-1") {
    throw new RangeError("Unsupported timing-table revision")
  }
}

/**
 * Builds the released M1-08 runtime fixtures from the timing table and rule
 * modules. Reference vectors and M0-07 scenario files remain separate: they
 * are evidence of an envelope or scenario contract, not firmware stimuli.
 */
export function createGoldenVectorExport(options: unknown = DEFAULT_OPTIONS): GoldenVectorExport {
  validateOptions(options)
  const table = loadTimingTable("timing-1")
  const vectors = generateTimingBoundaryVectors(table)
    .filter((vector) => vector.kind === "runtime")
    .map((vector) => makeFixture(vector, table))
  const unsigned = {
    format: GOLDEN_VECTOR_EXPORT_FORMAT,
    ordering: "m1-08-generation-order" as const,
    resistanceUnit: "milliOhm" as const,
    ruleSetRevision: GOLDEN_VECTOR_EXPORT_RULE_SET_REVISION,
    schemaVersion: GOLDEN_VECTOR_EXPORT_SCHEMA_VERSION,
    source: GOLDEN_VECTOR_EXPORT_SOURCE,
    timeUnit: "us" as const,
    timingTableRevision: table.revision,
    vectors: Object.freeze(vectors)
  }
  const exported = { ...unsigned, digest: digestFor(unsigned) }

  return freezeDeep(exported)
}

/** Serializes a valid export as canonical UTF-8 JSON with a final newline. */
export function serializeGoldenVectorExport(exported: GoldenVectorExport): string {
  if (exported.digest !== digestFor(withoutDigest(exported))) {
    throw new RangeError("Golden-vector export digest mismatch")
  }

  return `${canonicalJson(exported)}\n`
}

/**
 * Fails closed when a checked-in or generated fixture is stale. This is
 * intentionally a byte comparison so field order, vector order, and digest
 * changes cannot be hidden by a semantic JSON comparison.
 */
export function assertCurrentGoldenVectorExport(exported: GoldenVectorExport): void {
  if (serializeGoldenVectorExport(exported) !== serializeGoldenVectorExport(createGoldenVectorExport())) {
    throw new RangeError("Stale golden-vector export")
  }
}
