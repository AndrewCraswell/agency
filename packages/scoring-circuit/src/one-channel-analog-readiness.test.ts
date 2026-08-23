import { describe, expect, it } from "vitest"
import {
  assessOneChannelExperimentPhysicalEvidence,
  oneChannelAnalogExperimentBom,
  oneChannelAnalogExperimentReadiness,
  requiredUnmodeledSupportParts
} from "./one-channel-analog-readiness.js"

const partEvidence = oneChannelAnalogExperimentBom.map((part, index) => ({
  artworkDigest: (index % 10).toString().repeat(64),
  manufacturerCadDigest: ((index + 1) % 10).toString().repeat(64),
  manufacturerDrawingDigest: ((index + 2) % 10).toString().repeat(64),
  mpn: part.mpn,
  package: part.package,
  passed: true as const,
  reference: part.reference,
  reviewedAtUtc: "2026-08-22T10:00:00.000Z",
  reviewerId: `REVIEWER-${index + 1}`
}))

const asBuiltManifest = oneChannelAnalogExperimentBom.map((part, index) => ({
  lotCode: `LOT-${index + 1}`,
  mpn: part.mpn,
  package: part.package,
  quantity: 1 as const,
  reference: part.reference
}))

const equipment = oneChannelAnalogExperimentReadiness.equipmentCategories.map((category, index) => ({
  assetId: `ASSET-${index + 1}`,
  calibrationCertificateId: `CAL-${index + 1}`,
  calibrationDueUtc: "2027-08-23T00:00:00.000Z",
  calibrationValidFromUtc: "2026-01-01T00:00:00.000Z",
  category,
  settingsDigest: ((index + 3) % 10).toString().repeat(64)
}))

function observationsFor(step: (typeof oneChannelAnalogExperimentReadiness.bringUpSteps)[number]) {
  switch (step) {
    case "unpowered-inspection":
      return [
        {
          expected: true,
          kind: "boolean" as const,
          name: "assembly-inspection-pass" as const,
          observed: true,
          unit: "boolean" as const,
          withinLimits: true as const
        }
      ]
    case "isolation-and-continuity":
      return [
        {
          kind: "numeric" as const,
          maximum: 1_000_000_000_000,
          minimum: 10_000_000,
          name: "isolation-resistance" as const,
          unit: "ohm" as const,
          value: 20_000_000,
          withinLimits: true as const
        }
      ]
    case "isolated-rail-power":
      return [
        {
          kind: "numeric" as const,
          maximum: 5.25,
          minimum: 4.75,
          name: "positive-rail-voltage" as const,
          unit: "volt" as const,
          value: 5,
          withinLimits: true as const
        },
        {
          kind: "numeric" as const,
          maximum: -4.5,
          minimum: -5.5,
          name: "negative-rail-voltage" as const,
          unit: "volt" as const,
          value: -5,
          withinLimits: true as const
        }
      ]
    case "reference-verification":
      return [
        {
          kind: "numeric" as const,
          maximum: 2.51,
          minimum: 2.49,
          name: "reference-voltage" as const,
          unit: "volt" as const,
          value: 2.5,
          withinLimits: true as const
        }
      ]
    case "normal-fixture-permit":
      return [
        {
          expected: true,
          kind: "boolean" as const,
          name: "normal-fixture-permit" as const,
          observed: true,
          unit: "boolean" as const,
          withinLimits: true as const
        }
      ]
    case "normal-matrix":
      return [
        {
          kind: "numeric" as const,
          maximum: 4.5,
          minimum: -4.5,
          name: "resistance-error" as const,
          unit: "ohm" as const,
          value: 0.2,
          withinLimits: true as const
        }
      ]
    case "guarded-fixture-permit":
      return [
        {
          expected: true,
          kind: "boolean" as const,
          name: "guarded-fixture-permit" as const,
          observed: true,
          unit: "boolean" as const,
          withinLimits: true as const
        }
      ]
    case "guarded-matrix":
      return [
        {
          kind: "numeric" as const,
          maximum: 0.000_432_9,
          minimum: 0,
          name: "guarded-force-current" as const,
          unit: "ampere" as const,
          value: 0.000_4,
          withinLimits: true as const
        }
      ]
  }
}

const bringUpResults = oneChannelAnalogExperimentReadiness.bringUpSteps.map((step, index) => ({
  artifactDigest: ((index + 4) % 10).toString().repeat(64),
  completedAtUtc: `2026-08-23T12:${(index + 10).toString().padStart(2, "0")}:00.000Z`,
  externalPermit:
    index < 2
      ? null
      : {
          fixtureInterlockRevision: "FIXTURE-A",
          issuedAtUtc: "2026-08-23T12:00:00.000Z",
          permitId: `PERMIT-${index + 1}`
        },
  limitsDigest: ((index + 5) % 10).toString().repeat(64),
  limitsId: `LIMITS-${index + 1}`,
  observations: observationsFor(step),
  order: index + 1,
  result: "pass" as const,
  resultId: `RESULT-${index + 1}`,
  step,
  stopFailures: []
}))

const physicalEvidence = {
  asBuiltManifest,
  boardId: "M4-ONE-CHANNEL-001",
  bringUpResults: bringUpResults.slice(0, 2),
  capturedAtUtc: "2026-08-23T13:00:00.000Z",
  equipment,
  fixtureInterlock: {
    approvedAtUtc: "2026-08-22T09:00:00.000Z",
    certificateId: "INTERLOCK-CERT-001",
    designDigest: "f".repeat(64),
    revision: "FIXTURE-A"
  },
  partEvidence,
  supportCircuitReconciled: false as const
}

describe("one-channel analog experiment readiness", () => {
  it("tracks all 36 physical references individually and keeps every release state false", () => {
    expect(oneChannelAnalogExperimentBom).toHaveLength(36)
    expect(new Set(oneChannelAnalogExperimentBom.map((part) => part.reference)).size).toBe(36)
    expect(oneChannelAnalogExperimentBom.every((part) => part.dnp)).toBe(true)
    expect(oneChannelAnalogExperimentReadiness.authorization).toBe(false)
    expect(oneChannelAnalogExperimentReadiness.fabrication.couponBomReleased).toBe(false)
    expect(oneChannelAnalogExperimentReadiness.fabrication.copperReleased).toBe(false)
    expect(oneChannelAnalogExperimentReadiness.fabrication.fabricationAuthorized).toBe(false)
  })

  it("selects shrouded, polarized, locking, mutually incompatible fixture families with the correct orientation", () => {
    const safety = oneChannelAnalogExperimentReadiness.connectorSafety

    expect(safety.circuitGender).toBe("male")
    expect(safety.physicallyMutuallyIncompatible).toBe(true)
    expect(safety.normal).toMatchObject({
      boardMpn: "43650-0300",
      mateMpn: "43645-0300",
      orientation: "right-angle",
      pitchMm: 3,
      positions: 3
    })
    expect(safety.guarded).toMatchObject({ boardMpn: "B2B-PH-K-S(LF)(SN)", mateMpn: "PHR-2", pitchMm: 2, positions: 2 })
  })

  it("fails closed on exact but unmodeled support networks and the optional NXE filter", () => {
    expect(requiredUnmodeledSupportParts.map((part) => part.reference)).toEqual(
      expect.arrayContaining([
        "C_REF_IN",
        "C_REF_OUT_HF",
        "C_BUFFER_POS",
        "C_BUFFER_NEG",
        "C_NEG_IN",
        "C_ISO_IN",
        "C_ISO_OUT"
      ])
    )
    expect(requiredUnmodeledSupportParts.every((part) => part.dnp && !part.circuitPresent)).toBe(true)
    expect(oneChannelAnalogExperimentReadiness.supportReconciliation.circuitReconciled).toBe(false)
    expect(oneChannelAnalogExperimentReadiness.supportReconciliation.nxeOptionalEmiFilter.population).toBe(
      "dnp-not-selected"
    )
  })

  it("accepts only unpowered evidence as incomplete while support remains unreconciled", () => {
    const assessment = assessOneChannelExperimentPhysicalEvidence(physicalEvidence)

    expect(assessment.evidenceCompleteForReview).toBe(false)
    expect(assessment.authorization).toBe(false)
    expect(assessment.fabricationAuthorized).toBe(false)
    expect(assessment.supportCircuitReconciled).toBe(false)
    expect(assessment.state).toBe("deny")
  })

  it("rejects missing, duplicate, extra, or identity-mismatched part evidence", () => {
    expect(() =>
      assessOneChannelExperimentPhysicalEvidence({ ...physicalEvidence, partEvidence: partEvidence.slice(1) })
    ).toThrow()
    expect(() =>
      assessOneChannelExperimentPhysicalEvidence({
        ...physicalEvidence,
        partEvidence: [...partEvidence, partEvidence[0]]
      })
    ).toThrow()
    expect(() =>
      assessOneChannelExperimentPhysicalEvidence({
        ...physicalEvidence,
        partEvidence: partEvidence.map((part, index) => (index === 1 ? partEvidence[0] : part))
      })
    ).toThrow("missing or duplicate")
    expect(() =>
      assessOneChannelExperimentPhysicalEvidence({
        ...physicalEvidence,
        asBuiltManifest: asBuiltManifest.map((part, index) => (index === 0 ? { ...part, mpn: "SUBSTITUTE" } : part))
      })
    ).toThrow("exact BOM")
  })

  it("requires one current calibrated asset per equipment category", () => {
    expect(() =>
      assessOneChannelExperimentPhysicalEvidence({
        ...physicalEvidence,
        equipment: equipment.map((item, index) => (index === 1 ? { ...item, category: equipment[0].category } : item))
      })
    ).toThrow("equipment categories")
    expect(() =>
      assessOneChannelExperimentPhysicalEvidence({
        ...physicalEvidence,
        equipment: equipment.map((item, index) => (index === 1 ? { ...item, assetId: equipment[0].assetId } : item))
      })
    ).toThrow("asset IDs")
    expect(() =>
      assessOneChannelExperimentPhysicalEvidence({
        ...physicalEvidence,
        equipment: equipment.map((item, index) =>
          index === 1 ? { ...item, calibrationCertificateId: equipment[0].calibrationCertificateId } : item
        )
      })
    ).toThrow("certificate IDs")
    expect(() =>
      assessOneChannelExperimentPhysicalEvidence({
        ...physicalEvidence,
        equipment: equipment.map((item, index) =>
          index === 0 ? { ...item, calibrationDueUtc: "2026-08-23T12:09:59.000Z" } : item
        )
      })
    ).toThrow("current at every step")
  })

  it("rejects powered evidence until support is reconciled and requires a prior permit", () => {
    expect(() =>
      assessOneChannelExperimentPhysicalEvidence({ ...physicalEvidence, bringUpResults: bringUpResults.slice(0, 3) })
    ).toThrow("unreconciled support parts")
    expect(() =>
      assessOneChannelExperimentPhysicalEvidence({
        ...physicalEvidence,
        bringUpResults: bringUpResults
          .slice(0, 3)
          .map((result, index) => (index === 2 ? { ...result, externalPermit: null } : result))
      })
    ).toThrow("prior external permit")
  })

  it("enforces causal review, capture, fixture, permit, and ordered step timestamps", () => {
    expect(() =>
      assessOneChannelExperimentPhysicalEvidence({
        ...physicalEvidence,
        partEvidence: partEvidence.map((part, index) =>
          index === 0 ? { ...part, reviewedAtUtc: "2026-08-23T13:00:00.001Z" } : part
        )
      })
    ).toThrow("review must not occur after")
    expect(() =>
      assessOneChannelExperimentPhysicalEvidence({
        ...physicalEvidence,
        fixtureInterlock: { ...physicalEvidence.fixtureInterlock, approvedAtUtc: "2026-08-23T13:00:00.001Z" }
      })
    ).toThrow("fixture approval must not occur after")
    expect(() =>
      assessOneChannelExperimentPhysicalEvidence({
        ...physicalEvidence,
        bringUpResults: physicalEvidence.bringUpResults.map((result, index) =>
          index === 1 ? { ...result, completedAtUtc: "2026-08-23T13:00:00.001Z" } : result
        )
      })
    ).toThrow("step must not occur after")
    expect(() =>
      assessOneChannelExperimentPhysicalEvidence({
        ...physicalEvidence,
        bringUpResults: physicalEvidence.bringUpResults.map((result, index) =>
          index === 1 ? { ...result, completedAtUtc: physicalEvidence.bringUpResults[0].completedAtUtc } : result
        )
      })
    ).toThrow("strictly ordered")
    expect(() =>
      assessOneChannelExperimentPhysicalEvidence({
        ...physicalEvidence,
        bringUpResults: bringUpResults
          .slice(0, 3)
          .map((result, index) =>
            index === 2
              ? { ...result, externalPermit: { ...result.externalPermit!, issuedAtUtc: "2026-08-22T08:59:59.000Z" } }
              : result
          )
      })
    ).toThrow("fixture approval must precede")
    expect(() =>
      assessOneChannelExperimentPhysicalEvidence({
        ...physicalEvidence,
        bringUpResults: bringUpResults
          .slice(0, 3)
          .map((result, index) =>
            index === 2
              ? { ...result, externalPermit: { ...result.externalPermit!, issuedAtUtc: result.completedAtUtc } }
              : result
          )
      })
    ).toThrow("external permit must precede")
  })

  it("mechanically rejects pass observations outside fixed bounds or boolean requirements", () => {
    expect(() =>
      assessOneChannelExperimentPhysicalEvidence({
        ...physicalEvidence,
        bringUpResults: physicalEvidence.bringUpResults.map((result, index) =>
          index === 1 ? { ...result, observations: [{ ...result.observations[0], value: 1 }] } : result
        )
      })
    ).toThrow("outside its bounds")
    expect(() =>
      assessOneChannelExperimentPhysicalEvidence({
        ...physicalEvidence,
        bringUpResults: physicalEvidence.bringUpResults.map((result, index) =>
          index === 0 ? { ...result, observations: [{ ...result.observations[0], observed: false }] } : result
        )
      })
    ).toThrow("does not match")
    expect(() =>
      assessOneChannelExperimentPhysicalEvidence({
        ...physicalEvidence,
        bringUpResults: physicalEvidence.bringUpResults.map((result, index) =>
          index === 1 ? { ...result, observations: [{ ...result.observations[0], minimum: 0 }] } : result
        )
      })
    ).toThrow("bounds mismatch")
    expect(() =>
      assessOneChannelExperimentPhysicalEvidence({
        ...physicalEvidence,
        bringUpResults: physicalEvidence.bringUpResults.map((result, index) =>
          index === 0 ? { ...result, stopFailures: ["visual-inspection-failed"] } : result
        )
      })
    ).toThrow()
  })
})
