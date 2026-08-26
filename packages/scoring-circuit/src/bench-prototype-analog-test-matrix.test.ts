import { describe, expect, it } from "vitest"
import {
  benchPrototypeAnalogTestExpectedPointIds,
  benchPrototypeAnalogTestMatrix,
  benchPrototypeAnalogTestUpstreamSnapshots,
  digestCanonicalArtifact,
  evaluateBenchPrototypeAnalogTestRun
} from "./bench-prototype-analog-test-matrix.js"
import type { BenchPrototypeAnalogTestRun } from "./bench-prototype-analog-test-matrix.js"
import type { OneChannelExperimentArchiveRecord } from "./one-channel-analog-experiment.js"

const digest = "a".repeat(64)
const categories = [
  "resistance-standard",
  "capacitance-standard",
  "temperature-reference",
  "digital-multimeter",
  "oscilloscope",
  "programmable-force-source",
  "force-current-monitor"
] as const

function allowedCapacitance(value: number): 500 | 2_000 | 5_000 | 10_000 {
  if (value === 500 || value === 2_000 || value === 5_000 || value === 10_000) return value
  throw new Error("test fixture parsed an unsupported capacitance")
}

function allowedTemperature(value: number): -40 | 25 | 85 | 125 {
  if (value === -40 || value === 25 || value === 85 || value === 125) return value
  throw new Error("test fixture parsed an unsupported temperature")
}

function evidence(index: number, pointId: string): OneChannelExperimentArchiveRecord {
  const guarded = pointId.startsWith("guarded")
  const match = guarded
    ? /^guarded-v(-?[\d.]+)-c(\d+)-t(-?\d+)$/u.exec(pointId)!
    : /^normal-r([\d.]+)-c(\d+)-t(-?\d+)$/u.exec(pointId)!
  const value = Number(match[1])
  const capacitance = allowedCapacitance(Number(match[2]))
  const temperature = allowedTemperature(Number(match[3]))
  return {
    authorization: false,
    boardId: "coupon-1",
    capacitancePf: capacitance,
    firmwareDigest: digest,
    forceAppliedVolts: guarded ? value : 0,
    forcePulseDurationMs: guarded ? 100 : 0,
    mode: guarded ? "guarded-force" : "normal-resistance",
    sequence: { eventIndex: index + 1, runId: "run-1" },
    temperatureC: temperature,
    testPoints: {
      adcAinnV: 0,
      adcAinpV: 0.2,
      analogNegativeRailV: -2.5,
      analogPositiveRailV: 5,
      bufferInputV: 0.2,
      bufferOutputV: 0.2,
      lineV: 0.2,
      referenceV: 2.5
    },
    timestampUtc: new Date(Date.UTC(2026, 0, 1, 0, 0, index * 11)).toISOString(),
    traces: [
      {
        nodes: [
          "line",
          "post-tpd",
          "quiet",
          "buffer-input",
          "buffer-output",
          "adc-ainp",
          "adc-ainn",
          "reference",
          "analog-plus-rail",
          "analog-negative-rail",
          ...(guarded ? (["force-voltage", "force-current"] as const) : [])
        ],
        sampleRateHz: 1_000_000,
        sha256: digest,
        traceId: `trace-${index}`
      }
    ],
    control: {
      adcCodeObservedExpected: true,
      currentTripObservedArmed: true,
      dwellTimerObservedSatisfied: true,
      dwellTimerWitnessId: "timer-1",
      fixtureInterlockCertificateId: "fixture-1",
      fixturePermitObserved: true,
      fixturePowerObservedGood: true,
      forceRelayCommandedClosed: guarded,
      forceRelayObservedClosed: guarded,
      negativeRailObservedHealthy: true,
      overloadObservedClear: true,
      positiveRailObservedHealthy: true,
      referenceObservedHealthy: true,
      sinkCommandedEnabled: false,
      sinkObservedEnabled: false,
      sourceCommandedEnabled: !guarded,
      sourceObservedEnabled: !guarded,
      sourceSinkMutualExclusionObserved: true,
      watchdogObservedHealthy: true
    },
    outcome: "measured",
    measurement: {
      adcCodes: [10, 10, 10],
      calibrationId: "cal-1",
      measuredResistanceOhms: guarded ? [0, 0, 0] : [value, value, value],
      standardResistanceOhms: guarded ? 0 : value
    }
  }
}

function refreshArtifactDigest(runArtifact: BenchPrototypeAnalogTestRun): void {
  const { artifactDigest: _artifactDigest, ...content } = runArtifact
  runArtifact.artifactDigest = digestCanonicalArtifact(content)
}

function sealDigests(runArtifact: BenchPrototypeAnalogTestRun): void {
  runArtifact.calibrationManifestDigest = digestCanonicalArtifact(runArtifact.calibrationManifest)
  runArtifact.fixtureConfigurationDigest = digestCanonicalArtifact(runArtifact.fixtureConfigurationIdentity)
  runArtifact.fixtureHarnessEvidenceDigest = digestCanonicalArtifact(runArtifact.fixtureHarnessEvidenceIdentity)
  runArtifact.upstreamEvidence.BP101 = digestCanonicalArtifact(runArtifact.upstreamSnapshots.BP101)
  runArtifact.upstreamEvidence.BP102 = digestCanonicalArtifact(runArtifact.upstreamSnapshots.BP102)
  runArtifact.upstreamEvidence.BP104 = digestCanonicalArtifact(runArtifact.upstreamSnapshots.BP104)
  for (const record of runArtifact.records) {
    record.rawEvidenceDigest = digestCanonicalArtifact(record.rawEvidenceIdentity)
  }
  refreshArtifactDigest(runArtifact)
}

function run(unavailablePointId?: string): BenchPrototypeAnalogTestRun {
  const instruments = categories.map((category, index) => ({
    calibrationCertificateDigest: digest,
    calibrationCertificateId: `certificate-${index}`,
    calibrationCertificateImmutableUri: `https://evidence.invalid/calibration/certificate-${index}/${digest}`,
    calibrationDateUtc: "2025-01-01T00:00:00.000Z",
    calibrationDueUtc: "2030-01-01T00:00:00.000Z",
    category,
    instrumentId: `instrument-${index}`,
    manufacturer: "bench laboratory",
    model: `model-${index}`,
    serialNumber: `serial-${index}`,
    applicableRange: { maximum: 1_000_000, minimum: -1_000_000, unit: "category-specific SI unit" },
    expandedUncertainty: { coverageFactor: 2, unit: "category-specific SI unit", value: 0.1 }
  }))
  const artifact: BenchPrototypeAnalogTestRun = {
    artifactDigest: digest,
    authorization: false,
    automation: "manual",
    boardId: "coupon-1",
    calibrationManifest: { calibrationId: "cal-1", instruments },
    calibrationManifestDigest: digest,
    channelCount: 1,
    contractVersion: "BP-106.1",
    energizedAuthorization: false,
    firmwareArtifactIdentity: {
      contentDigest: digest,
      immutableUri: `https://evidence.invalid/firmware/${digest}`
    },
    fixtureConfigurationIdentity: {
      artifactId: "fixture-configuration-1",
      immutableUri: `https://evidence.invalid/fixture/configuration/${digest}`
    },
    fixtureConfigurationDigest: digest,
    fixtureHarnessEvidenceIdentity: {
      artifactId: "fixture-harness-evidence-1",
      immutableUri: `https://evidence.invalid/fixture/harness/${digest}`
    },
    fixtureHarnessEvidenceDigest: digest,
    records: benchPrototypeAnalogTestExpectedPointIds.map((pointId, index) => {
      const measured = evidence(index, pointId)
      if (pointId !== unavailablePointId) {
        return {
          evidence: measured,
          instrumentIds: instruments.map((instrument) => instrument.instrumentId),
          pointId,
          rawEvidenceIdentity: {
            artifactId: `raw-${index}`,
            immutableUri: `https://evidence.invalid/raw/${index}/${digest}`
          },
          rawEvidenceDigest: digest
        }
      }
      if (measured.outcome !== "measured") throw new Error("test fixture expected measured evidence")
      const { measurement: _measurement, ...base } = measured
      return {
        evidence: {
          ...base,
          control: { ...base.control, referenceObservedHealthy: false },
          faultCode: "REFERENCE_UNHEALTHY",
          outcome: "unavailable" as const
        },
        instrumentIds: instruments.map((instrument) => instrument.instrumentId),
        pointId,
        rawEvidenceIdentity: {
          artifactId: `raw-${index}`,
          immutableUri: `https://evidence.invalid/raw/${index}/${digest}`
        },
        rawEvidenceDigest: digest
      }
    }),
    upstreamEvidence: { BP101: digest, BP102: digest, BP104: digest },
    upstreamSnapshots: structuredClone(benchPrototypeAnalogTestUpstreamSnapshots)
  }
  sealDigests(artifact)
  return artifact
}

describe("BP-106 analog test matrix", () => {
  it("freezes the exact paper matrix without authorizing energy or requiring automation", () => {
    expect(benchPrototypeAnalogTestMatrix.normal.resistanceOhms).toHaveLength(20)
    expect(benchPrototypeAnalogTestMatrix.guarded.forceVolts).toContain(-24)
    expect(benchPrototypeAnalogTestMatrix.guarded.forceVolts).toContain(24)
    expect(benchPrototypeAnalogTestMatrix.guarded.forceVolts).not.toContain(0)
    expect(benchPrototypeAnalogTestExpectedPointIds).toHaveLength(544)
    expect(benchPrototypeAnalogTestMatrix.automationRequired).toBe(false)
    expect(benchPrototypeAnalogTestMatrix.energizedAuthorization).toBe(false)
    expect(benchPrototypeAnalogTestUpstreamSnapshots.BP102.connectorSafety.physicallyMutuallyIncompatible).toBe(true)
    expect(benchPrototypeAnalogTestUpstreamSnapshots.BP102.guardedSourceEnvelope.maximumAppliedVolts).toBe(24)
    expect(benchPrototypeAnalogTestUpstreamSnapshots.BP104.connector.header.mpn).toBe("43045-1200")
  })

  it("accepts a complete ordered one-channel archive but still grants no energized authority", () => {
    const result = evaluateBenchPrototypeAnalogTestRun(run())
    expect(result.acceptedOneChannel).toBe(true)
    expect(result.sevenChannelEligible).toBe(true)
    expect(result.energizedAuthorized).toBe(false)
  })

  it("fails closed on missing, reordered, duplicate, forged, or stale evidence", () => {
    const missing = run()
    missing.records.pop()
    refreshArtifactDigest(missing)
    expect(evaluateBenchPrototypeAnalogTestRun(missing).acceptedOneChannel).toBe(false)

    const reordered = run()
    ;[reordered.records[0], reordered.records[1]] = [reordered.records[1]!, reordered.records[0]!]
    refreshArtifactDigest(reordered)
    expect(() => evaluateBenchPrototypeAnalogTestRun(reordered)).toThrow("eventIndex must be contiguous")

    const forged = run()
    if (forged.records[0]!.evidence.outcome !== "measured") throw new Error("test fixture expected measured evidence")
    forged.records[0]!.evidence.measurement.standardResistanceOhms = 1
    refreshArtifactDigest(forged)
    expect(() => evaluateBenchPrototypeAnalogTestRun(forged)).toThrow("identity does not match")

    const stale = run()
    stale.calibrationManifest.instruments[0]!.calibrationDueUtc = "2025-06-01T00:00:00.000Z"
    sealDigests(stale)
    expect(() => evaluateBenchPrototypeAnalogTestRun(stale)).toThrow("calibration is not valid")

    const invalidCalibration = run()
    invalidCalibration.calibrationManifest.instruments[0]!.applicableRange.maximum =
      invalidCalibration.calibrationManifest.instruments[0]!.applicableRange.minimum
    sealDigests(invalidCalibration)
    expect(() => evaluateBenchPrototypeAnalogTestRun(invalidCalibration)).toThrow("range maximum must exceed")
  })

  it("archives unavailable points without treating them as progression evidence", () => {
    const archive = run(benchPrototypeAnalogTestExpectedPointIds[0])
    const record = archive.records[0]!
    const result = evaluateBenchPrototypeAnalogTestRun(archive)
    expect(result.acceptedOneChannel).toBe(false)
    expect(result.sevenChannelEligible).toBe(false)
    expect(result.unavailablePointIds).toEqual([record.pointId])
  })

  it("rejects measured unsafe control states through the reused BP-101 schema", () => {
    const unsafe = run()
    unsafe.records[0]!.evidence.control.referenceObservedHealthy = false
    refreshArtifactDigest(unsafe)
    expect(() => evaluateBenchPrototypeAnalogTestRun(unsafe)).toThrow()
  })

  it("binds embedded evidence, calibration identifiers, and canonical upstream contracts", () => {
    const artifactDrift = run()
    artifactDrift.boardId = "substituted-board"
    expect(() => evaluateBenchPrototypeAnalogTestRun(artifactDrift)).toThrow("artifact digest does not bind")

    const rawDrift = run()
    rawDrift.records[0]!.rawEvidenceIdentity.artifactId = "substituted-raw-artifact"
    refreshArtifactDigest(rawDrift)
    expect(() => evaluateBenchPrototypeAnalogTestRun(rawDrift)).toThrow("raw evidence digest does not bind")

    const calibrationDrift = run()
    calibrationDrift.calibrationManifest.instruments[0]!.serialNumber = "substituted-serial"
    refreshArtifactDigest(calibrationDrift)
    expect(() => evaluateBenchPrototypeAnalogTestRun(calibrationDrift)).toThrow("calibration manifest digest")

    const calibrationLinkDrift = run()
    if (calibrationLinkDrift.records[0]!.evidence.outcome !== "measured")
      throw new Error("test fixture expected measured evidence")
    calibrationLinkDrift.records[0]!.evidence.measurement.calibrationId = "unknown-calibration"
    refreshArtifactDigest(calibrationLinkDrift)
    expect(() => evaluateBenchPrototypeAnalogTestRun(calibrationLinkDrift)).toThrow("does not resolve")

    const certificateIdentityDrift = run()
    certificateIdentityDrift.calibrationManifest.instruments[0]!.calibrationCertificateImmutableUri =
      "https://evidence.invalid/calibration/substituted"
    sealDigests(certificateIdentityDrift)
    expect(() => evaluateBenchPrototypeAnalogTestRun(certificateIdentityDrift)).toThrow(
      "certificate URI does not resolve"
    )

    const firmwareIdentityDrift = run()
    firmwareIdentityDrift.firmwareArtifactIdentity.immutableUri = "https://evidence.invalid/firmware/substituted"
    refreshArtifactDigest(firmwareIdentityDrift)
    expect(() => evaluateBenchPrototypeAnalogTestRun(firmwareIdentityDrift)).toThrow(
      "firmware artifact URI does not resolve"
    )

    const BP102Drift = run()
    BP102Drift.upstreamSnapshots.BP102.connectorSafety = { physicallyMutuallyIncompatible: false }
    BP102Drift.upstreamEvidence.BP102 = digestCanonicalArtifact(BP102Drift.upstreamSnapshots.BP102)
    refreshArtifactDigest(BP102Drift)
    expect(() => evaluateBenchPrototypeAnalogTestRun(BP102Drift)).toThrow("upstream snapshot drifted")

    const BP102EnvelopeDrift = run()
    BP102EnvelopeDrift.upstreamSnapshots.BP102.guardedSourceEnvelope = { maximumAppliedVolts: 25 }
    BP102EnvelopeDrift.upstreamEvidence.BP102 = digestCanonicalArtifact(BP102EnvelopeDrift.upstreamSnapshots.BP102)
    refreshArtifactDigest(BP102EnvelopeDrift)
    expect(() => evaluateBenchPrototypeAnalogTestRun(BP102EnvelopeDrift)).toThrow("upstream snapshot drifted")

    const BP104Drift = run()
    BP104Drift.upstreamSnapshots.BP104.connector = { header: { mpn: "substituted" } }
    BP104Drift.upstreamEvidence.BP104 = digestCanonicalArtifact(BP104Drift.upstreamSnapshots.BP104)
    refreshArtifactDigest(BP104Drift)
    expect(() => evaluateBenchPrototypeAnalogTestRun(BP104Drift)).toThrow("upstream snapshot drifted")
  })

  it("requires canonical UTC milliseconds and retains calibration validity boundaries", () => {
    for (const timestampUtc of ["2025-01-01T00:00:00.000-07:00", "2025-02-30T00:00:00.000Z", "2025-01-01T00:00:00Z"]) {
      const artifact = run()
      artifact.calibrationManifest.instruments[0]!.calibrationDateUtc = timestampUtc
      expect(() => evaluateBenchPrototypeAnalogTestRun(artifact)).toThrow(
        "timestamps must use canonical UTC milliseconds"
      )
    }

    const boundary = run()
    boundary.calibrationManifest.instruments[0]!.calibrationDueUtc = boundary.records[0]!.evidence.timestampUtc
    sealDigests(boundary)
    expect(() => evaluateBenchPrototypeAnalogTestRun(boundary)).toThrow("calibration is not valid")
  })
})
