import { createHash } from "node:crypto"
import { z } from "zod"
import {
  benchPrototypeFaultProtection,
  validateBenchPrototypeFaultProtection
} from "./bench-prototype-fault-protection.js"
import {
  benchPrototypeFixtureHarness,
  validateBenchPrototypeFixtureHarness
} from "./bench-prototype-fixture-harness.js"
import {
  oneChannelAnalogExperiment,
  oneChannelExperimentArchiveSchema,
  validateOneChannelExperimentRun,
  type OneChannelExperimentArchiveRecord
} from "./one-channel-analog-experiment.js"

const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/u)
const resistanceOhms = [
  0, 10, 95, 100, 105, 195, 200, 205, 245, 250, 255, 445, 450, 455, 470, 475, 480, 495, 500, 505
] as const
const capacitancePf = [500, 2_000, 5_000, 10_000] as const
const temperatureC = [-40, 25, 85, 125] as const
const guardedForceVolts = [-24, -7, -3, -1, -0.5, -0.3, -0.1, 0.1, 0.3, 0.5, 1, 3, 7, 24] as const
const instrumentCategories = [
  "resistance-standard",
  "capacitance-standard",
  "temperature-reference",
  "digital-multimeter",
  "oscilloscope",
  "programmable-force-source",
  "force-current-monitor"
] as const

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value)) deepFreeze(child)
  }
  return value
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)])
    )
  }
  return value
}

export function digestCanonicalArtifact(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex")
}

export const benchPrototypeAnalogTestUpstreamSnapshots = deepFreeze({
  BP101: structuredClone(oneChannelAnalogExperiment),
  BP102: {
    connectorSafety: structuredClone(benchPrototypeFaultProtection.connectorSafety),
    guardedSourceEnvelope: structuredClone(benchPrototypeFaultProtection.guardedSourceEnvelope),
    fixtureInterlock: structuredClone(benchPrototypeFaultProtection.fixtureInterlock),
    unpoweredBehavior: structuredClone(benchPrototypeFaultProtection.unpoweredBehavior)
  },
  BP104: {
    workUnit: benchPrototypeFixtureHarness.workUnit,
    connector: {
      boardReference: benchPrototypeFixtureHarness.connector.boardReference,
      bomReference: benchPrototypeFixtureHarness.connector.bomReference,
      header: structuredClone(benchPrototypeFixtureHarness.connector.header),
      mate: structuredClone(benchPrototypeFixtureHarness.connector.mate),
      pinMap: structuredClone(benchPrototypeFixtureHarness.connector.pinMap),
      matingOrientation: structuredClone(benchPrototypeFixtureHarness.connector.matingOrientation),
      returnPolicy: structuredClone(benchPrototypeFixtureHarness.connector.returnPolicy)
    }
  }
})

export const benchPrototypeAnalogTestMatrix = deepFreeze({
  workUnit: "BP-106",
  version: "BP-106.1",
  authorization: false,
  fabricationState: "deny",
  energizedAuthorization: false,
  automationRequired: false,
  channelProgression: "one-channel-before-seven",
  normal: { resistanceOhms, capacitancePf, temperatureC, forceAppliedVolts: 0 },
  guarded: {
    zeroVoltDisposition: "deenergized-baseline-only",
    forceVolts: guardedForceVolts,
    pulseDurationMs: benchPrototypeFaultProtection.guardedSourceEnvelope.maximumPulseDurationMs,
    minimumPulseIntervalMs: benchPrototypeFaultProtection.guardedSourceEnvelope.minimumPulseIntervalMs
  },
  weaponAnnotations: {
    epeeContact: { resistanceOhms: 10 },
    epeeExceptionalAndSabreExterior: { sweepOhms: [95, 100, 105] },
    foilClosedCircuit: { sweepOhms: [195, 200, 205] },
    sabreControlBreak: { sweepOhms: [245, 250, 255] },
    foilInsulationAlwaysOn: { sweepOhms: [445, 450, 455] },
    foilInsulationAlwaysOff: { sweepOhms: [470, 475, 480] },
    foilExterior: { sweepOhms: [495, 500, 505] }
  },
  requiredInstrumentCategories: instrumentCategories,
  unavailableDisposition: "archive-only-no-qualification",
  sevenChannelGate: "all one-channel points measured and accepted; unavailable or incident evidence blocks progression"
} as const)

const calibrationSchema = z
  .object({
    calibrationCertificateDigest: sha256Schema,
    calibrationCertificateId: z.string().min(1),
    calibrationCertificateImmutableUri: z.string().url(),
    calibrationDateUtc: z.string().datetime(),
    calibrationDueUtc: z.string().datetime(),
    category: z.enum(instrumentCategories),
    instrumentId: z.string().min(1),
    manufacturer: z.string().min(1),
    model: z.string().min(1),
    serialNumber: z.string().min(1),
    applicableRange: z
      .object({ maximum: z.number().finite(), minimum: z.number().finite(), unit: z.string().min(1) })
      .strict(),
    expandedUncertainty: z
      .object({
        coverageFactor: z.number().finite().positive(),
        unit: z.string().min(1),
        value: z.number().finite().nonnegative()
      })
      .strict()
  })
  .strict()
  .superRefine((item, context) => {
    if (Date.parse(item.calibrationDueUtc) <= Date.parse(item.calibrationDateUtc)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "calibration due date must follow calibration date" })
    }
    if (item.applicableRange.maximum <= item.applicableRange.minimum) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "calibration range maximum must exceed minimum" })
    }
  })

const matrixRecordSchema = z
  .object({
    evidence: oneChannelExperimentArchiveSchema,
    instrumentIds: z.array(z.string().min(1)).min(1),
    pointId: z.string().min(1),
    rawEvidenceIdentity: z.object({ artifactId: z.string().min(1), immutableUri: z.string().url() }).strict(),
    rawEvidenceDigest: sha256Schema
  })
  .strict()

export const benchPrototypeAnalogTestRunSchema = z
  .object({
    artifactDigest: sha256Schema,
    authorization: z.literal(false),
    automation: z.enum(["manual", "automated"]),
    boardId: z.string().min(1),
    calibrationManifest: z
      .object({
        calibrationId: z.string().min(1),
        instruments: z.array(calibrationSchema).min(instrumentCategories.length)
      })
      .strict(),
    calibrationManifestDigest: sha256Schema,
    channelCount: z.literal(1),
    contractVersion: z.literal("BP-106.1"),
    energizedAuthorization: z.literal(false),
    firmwareArtifactIdentity: z.object({ contentDigest: sha256Schema, immutableUri: z.string().url() }).strict(),
    fixtureConfigurationIdentity: z.object({ artifactId: z.string().min(1), immutableUri: z.string().url() }).strict(),
    fixtureConfigurationDigest: sha256Schema,
    fixtureHarnessEvidenceIdentity: z
      .object({ artifactId: z.string().min(1), immutableUri: z.string().url() })
      .strict(),
    fixtureHarnessEvidenceDigest: sha256Schema,
    records: z.array(matrixRecordSchema).min(1),
    upstreamEvidence: z.object({ BP101: sha256Schema, BP102: sha256Schema, BP104: sha256Schema }).strict(),
    upstreamSnapshots: z
      .object({ BP101: z.record(z.unknown()), BP102: z.record(z.unknown()), BP104: z.record(z.unknown()) })
      .strict()
  })
  .strict()

export type BenchPrototypeAnalogTestRun = z.infer<typeof benchPrototypeAnalogTestRunSchema>

export type BenchPrototypeAnalogTestEvaluation = {
  acceptedOneChannel: boolean
  energizedAuthorized: false
  sevenChannelEligible: boolean
  unavailablePointIds: readonly string[]
  reasons: readonly string[]
}

function normalPointId(resistance: number, capacitance: number, temperature: number): string {
  return `normal-r${resistance}-c${capacitance}-t${temperature}`
}

function guardedPointId(force: number, capacitance: number, temperature: number): string {
  return `guarded-v${force}-c${capacitance}-t${temperature}`
}

function expectedPointIds(): readonly string[] {
  const ids: string[] = []
  for (const temperature of temperatureC)
    for (const capacitance of capacitancePf)
      for (const resistance of resistanceOhms) ids.push(normalPointId(resistance, capacitance, temperature))
  for (const temperature of temperatureC)
    for (const capacitance of capacitancePf)
      for (const force of guardedForceVolts) ids.push(guardedPointId(force, capacitance, temperature))
  return ids
}

const requiredNormalCategories = new Set<(typeof instrumentCategories)[number]>([
  "resistance-standard",
  "capacitance-standard",
  "temperature-reference",
  "digital-multimeter",
  "oscilloscope"
])
const requiredGuardedCategories = new Set<(typeof instrumentCategories)[number]>([
  "capacitance-standard",
  "temperature-reference",
  "digital-multimeter",
  "oscilloscope",
  "programmable-force-source",
  "force-current-monitor"
])

/**
 * Validates an archive and reports progression readiness. It never authorizes
 * applying power; the separately reviewed procedure and operator own that act.
 */
export function evaluateBenchPrototypeAnalogTestRun(input: unknown): BenchPrototypeAnalogTestEvaluation {
  const run = benchPrototypeAnalogTestRunSchema.parse(input)
  const reasons: string[] = []
  validateBenchPrototypeFaultProtection(benchPrototypeFaultProtection)
  validateBenchPrototypeFixtureHarness(benchPrototypeFixtureHarness)
  if (
    digestCanonicalArtifact(run.upstreamSnapshots.BP101) !==
      digestCanonicalArtifact(benchPrototypeAnalogTestUpstreamSnapshots.BP101) ||
    digestCanonicalArtifact(run.upstreamSnapshots.BP102) !==
      digestCanonicalArtifact(benchPrototypeAnalogTestUpstreamSnapshots.BP102) ||
    digestCanonicalArtifact(run.upstreamSnapshots.BP104) !==
      digestCanonicalArtifact(benchPrototypeAnalogTestUpstreamSnapshots.BP104)
  ) {
    throw new RangeError("BP-101, BP-102, or BP-104 upstream snapshot drifted from the validated canonical contract")
  }
  if (!benchPrototypeAnalogTestUpstreamSnapshots.BP102.connectorSafety.physicallyMutuallyIncompatible) {
    throw new RangeError("BP-102 normal and guarded connectors are not proven physically incompatible")
  }
  if (
    run.upstreamEvidence.BP101 !== digestCanonicalArtifact(run.upstreamSnapshots.BP101) ||
    run.upstreamEvidence.BP102 !== digestCanonicalArtifact(run.upstreamSnapshots.BP102) ||
    run.upstreamEvidence.BP104 !== digestCanonicalArtifact(run.upstreamSnapshots.BP104)
  ) {
    throw new RangeError("upstream evidence digest does not bind its embedded snapshot")
  }
  if (run.calibrationManifestDigest !== digestCanonicalArtifact(run.calibrationManifest)) {
    throw new RangeError("calibration manifest digest does not bind its embedded manifest")
  }
  if (
    run.fixtureConfigurationDigest !== digestCanonicalArtifact(run.fixtureConfigurationIdentity) ||
    run.fixtureHarnessEvidenceDigest !== digestCanonicalArtifact(run.fixtureHarnessEvidenceIdentity)
  ) {
    throw new RangeError("fixture digest does not bind its immutable artifact identity")
  }
  const { artifactDigest: _artifactDigest, ...artifactContent } = run
  if (run.artifactDigest !== digestCanonicalArtifact(artifactContent)) {
    throw new RangeError("artifact digest does not bind the canonical run content")
  }
  const instrumentById = new Map(
    run.calibrationManifest.instruments.map((instrument) => [instrument.instrumentId, instrument])
  )
  if (instrumentById.size !== run.calibrationManifest.instruments.length)
    throw new RangeError("instrumentId values must be unique")
  const certificateIds = new Set(
    run.calibrationManifest.instruments.map((instrument) => instrument.calibrationCertificateId)
  )
  if (certificateIds.size !== run.calibrationManifest.instruments.length)
    throw new RangeError("calibration certificate identities must be unique")
  for (const instrument of run.calibrationManifest.instruments) {
    if (
      !new URL(instrument.calibrationCertificateImmutableUri).pathname.includes(instrument.calibrationCertificateDigest)
    )
      throw new RangeError("calibration certificate URI does not resolve its content digest")
  }
  if (!new URL(run.firmwareArtifactIdentity.immutableUri).pathname.includes(run.firmwareArtifactIdentity.contentDigest))
    throw new RangeError("firmware artifact URI does not resolve its content digest")
  const presentCategories = new Set(run.calibrationManifest.instruments.map((instrument) => instrument.category))
  for (const category of instrumentCategories) {
    if (!presentCategories.has(category)) throw new RangeError(`missing required instrument category ${category}`)
  }

  const parsedEvidence = validateOneChannelExperimentRun(run.records.map((record) => record.evidence))
  const expected = expectedPointIds()
  const expectedSet = new Set(expected)
  const seen = new Set<string>()
  const unavailablePointIds: string[] = []
  for (const [index, record] of run.records.entries()) {
    if (!expectedSet.has(record.pointId)) throw new RangeError(`unexpected matrix point ${record.pointId}`)
    if (seen.has(record.pointId)) throw new RangeError(`duplicate matrix point ${record.pointId}`)
    if (record.pointId !== expected[index])
      throw new RangeError("matrix records must follow the frozen normal-then-guarded order")
    seen.add(record.pointId)
    const evidence: OneChannelExperimentArchiveRecord = parsedEvidence[index]
    if (evidence.boardId !== run.boardId) throw new RangeError("record boardId does not match run boardId")
    if (evidence.firmwareDigest !== run.firmwareArtifactIdentity.contentDigest)
      throw new RangeError("measurement firmware digest does not match the immutable firmware artifact")
    if (record.rawEvidenceDigest !== digestCanonicalArtifact(record.rawEvidenceIdentity))
      throw new RangeError("raw evidence digest does not bind its immutable artifact identity")
    if (evidence.outcome === "measured" && evidence.measurement.calibrationId !== run.calibrationManifest.calibrationId)
      throw new RangeError("measurement calibrationId does not resolve to the embedded calibration manifest")
    if (evidence.mode === "normal-resistance") {
      const normalMatch = /^normal-r([\d.]+)-c(\d+)-t(-?\d+)$/u.exec(record.pointId)
      const identityMatches =
        normalMatch !== null &&
        Number(normalMatch[2]) === evidence.capacitancePf &&
        Number(normalMatch[3]) === evidence.temperatureC &&
        evidence.forceAppliedVolts === 0 &&
        (evidence.outcome === "unavailable" || Number(normalMatch[1]) === evidence.measurement.standardResistanceOhms)
      if (!identityMatches) throw new RangeError("matrix point identity does not match embedded one-channel evidence")
    } else if (
      record.pointId !== guardedPointId(evidence.forceAppliedVolts, evidence.capacitancePf, evidence.temperatureC)
    ) {
      throw new RangeError("matrix point identity does not match embedded one-channel evidence")
    }

    const used = record.instrumentIds.map((id) => {
      const instrument = instrumentById.get(id)
      if (!instrument) throw new RangeError(`unknown instrumentId ${id}`)
      const measuredAt = Date.parse(evidence.timestampUtc)
      if (
        measuredAt < Date.parse(instrument.calibrationDateUtc) ||
        measuredAt > Date.parse(instrument.calibrationDueUtc)
      ) {
        throw new RangeError(`instrument ${id} calibration is not valid at measurement time`)
      }
      return instrument.category
    })
    const required = evidence.mode === "normal-resistance" ? requiredNormalCategories : requiredGuardedCategories
    for (const category of required) {
      if (!used.includes(category)) {
        throw new RangeError(`matrix point ${record.pointId} lacks ${category} evidence`)
      }
    }
    if (evidence.outcome === "unavailable") unavailablePointIds.push(record.pointId)
  }
  if (seen.size !== expected.length)
    reasons.push(`matrix is incomplete: ${expected.length - seen.size} required points absent`)
  if (unavailablePointIds.length > 0)
    reasons.push("unavailable or incident points cannot qualify the one-channel matrix")
  const acceptedOneChannel = reasons.length === 0
  return {
    acceptedOneChannel,
    energizedAuthorized: false,
    sevenChannelEligible: acceptedOneChannel,
    unavailablePointIds,
    reasons
  }
}

export const benchPrototypeAnalogTestExpectedPointIds = deepFreeze(expectedPointIds())
