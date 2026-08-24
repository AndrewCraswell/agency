import { describe, expect, it } from "vitest"
import {
  ads8881ReferenceNetworkRequirement,
  assessOneChannelExperimentPhysicalEvidence,
  mandatoryExperimentSupportParts,
  oneChannelAnalogExperimentBom,
  oneChannelAnalogExperimentReadiness,
  ref5025OutputCapacitorRequirement,
  supportCircuitReconciled
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
  supportCircuitReconciled
}

describe("one-channel analog experiment readiness", () => {
  it("tracks all 45 physical references individually and keeps every release state false", () => {
    expect(oneChannelAnalogExperimentBom).toHaveLength(45)
    expect(new Set(oneChannelAnalogExperimentBom.map((part) => part.reference)).size).toBe(45)
    expect(oneChannelAnalogExperimentBom.every((part) => part.dnp)).toBe(true)
    expect(oneChannelAnalogExperimentReadiness.authorization).toBe(false)
    expect(oneChannelAnalogExperimentReadiness.fabrication.couponBomReleased).toBe(false)
    expect(oneChannelAnalogExperimentReadiness.fabrication.copperReleased).toBe(false)
    expect(oneChannelAnalogExperimentReadiness.fabrication.fabricationAuthorized).toBe(false)
    expect(oneChannelAnalogExperimentReadiness.poweredTestingAuthorized).toBe(false)
  })

  it("records the NXE1 source package positions without opening the footprint gate", () => {
    expect(oneChannelAnalogExperimentBom.find((part) => part.reference === "U_ISO")).toMatchObject({
      mpn: "NXE1S0505MC",
      package:
        "Surface-mount 14-position package, 5 solder lands at positions 1, 3, 7, 8, 14; 4 functional connections, position 14 NA/no-connect"
    })
    expect(oneChannelAnalogExperimentReadiness.fabrication.footprintState).toBe("all-unreleased-dnp")
    expect(oneChannelAnalogExperimentReadiness.authorization).toBe(false)
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

  it("reconciles exact source-circuit support networks without opening any release gate", () => {
    expect(mandatoryExperimentSupportParts.map((part) => part.reference)).toEqual([
      "C_REF_IN",
      "C_REF_REG_HF",
      "R_REF_SAR",
      "C_BUFFER_POS",
      "C_BUFFER_NEG",
      "C_NEG_IN",
      "C_ISO_IN",
      "C_ISO_OUT"
    ])
    expect(mandatoryExperimentSupportParts.every((part) => part.dnp && part.circuitPresent)).toBe(true)
    expect(
      mandatoryExperimentSupportParts.every((part) => part.sourceCircuit === "one-channel-analog-experiment")
    ).toBe(true)
    expect(oneChannelAnalogExperimentReadiness.supportReconciliation.circuitReconciled).toBe(true)
    expect(Object.fromEntries(mandatoryExperimentSupportParts.map((part) => [part.reference, part.mpn]))).toEqual({
      C_BUFFER_NEG: "C0603C104K3RACTU",
      C_BUFFER_POS: "C0603C104K3RACTU",
      C_ISO_IN: "GRM188R71A225KE15D",
      C_ISO_OUT: "GRM188R71A225KE15D",
      C_NEG_IN: "GRM188R71A105KA12D",
      C_REF_IN: "GRM188R71A105KA12D",
      C_REF_REG_HF: "C0603C104K3RACTU",
      R_REF_SAR: "RCWE0603R220FKEA"
    })
    expect(oneChannelAnalogExperimentReadiness.supportReconciliation.nxeOptionalEmiFilter.population).toBe(
      "dnp-not-selected"
    )
  })

  it("selects separate REF5025 stabilization and ADS8881-local reference parts", () => {
    const selectedPart = oneChannelAnalogExperimentBom.find(
      (part) => part.reference === ref5025OutputCapacitorRequirement.reference
    )

    expect(selectedPart).toMatchObject({
      mpn: "T521B106M025ATE100",
      package: "1411 / 3528 B case"
    })
    expect(ref5025OutputCapacitorRequirement).toMatchObject({
      requiredMaximumCapacitanceUf: 50,
      requiredMaximumEsrOhms: 1.5,
      requiredMinimumCapacitanceUf: 1,
      selectedCapacitanceUf: 10,
      selectedManufacturerMaximumEsrOhms: 0.1,
      selectedMpn: "T521B106M025ATE100"
    })
    expect(ref5025OutputCapacitorRequirement.selectedCapacitanceUf).toBeGreaterThanOrEqual(
      ref5025OutputCapacitorRequirement.requiredMinimumCapacitanceUf
    )
    expect(ref5025OutputCapacitorRequirement.selectedCapacitanceUf).toBeLessThanOrEqual(
      ref5025OutputCapacitorRequirement.requiredMaximumCapacitanceUf
    )
    expect(ref5025OutputCapacitorRequirement.selectedManufacturerMaximumEsrOhms).toBeLessThanOrEqual(
      ref5025OutputCapacitorRequirement.requiredMaximumEsrOhms
    )
    expect(ads8881ReferenceNetworkRequirement).toEqual({
      capacitor: {
        dielectric: "X7R",
        nominalCapacitanceUf: 10,
        package: "0805",
        reference: "C_REF",
        selectedMpn: "GRM21BR71A106KE51L",
        tolerancePercent: 10
      },
      feedResistor: {
        allowedMaximumOhms: 0.47,
        allowedMinimumOhms: 0.1,
        reference: "R_REF_SAR",
        selectedMpn: "RCWE0603R220FKEA",
        selectedOhms: 0.22
      },
      lowerValueParallelCapacitorPermittedAtAdcRef: false
    })
  })

  it("accepts only unpowered evidence as incomplete while physical release evidence is absent", () => {
    const assessment = assessOneChannelExperimentPhysicalEvidence(physicalEvidence)

    expect(assessment.evidenceCompleteForReview).toBe(false)
    expect(assessment.authorization).toBe(false)
    expect(assessment.fabricationAuthorized).toBe(false)
    expect(assessment.supportCircuitReconciled).toBe(true)
    expect(assessment.poweredTestingAuthorized).toBe(false)
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

  it("rejects powered evidence until footprint and fixture evidence is released, even with a source-reconciled circuit", () => {
    expect(() =>
      assessOneChannelExperimentPhysicalEvidence({ ...physicalEvidence, bringUpResults: bringUpResults.slice(0, 3) })
    ).toThrow("unreleased footprint and fixture evidence")
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

  it("requires canonical UTC milliseconds before capture, calibration, or permit ordering", () => {
    for (const timestampUtc of ["2026-08-23T06:00:00.000-07:00", "2026-02-30T13:00:00.000Z", "2026-08-23T13:00:00Z"]) {
      expect(() =>
        assessOneChannelExperimentPhysicalEvidence({ ...physicalEvidence, capturedAtUtc: timestampUtc })
      ).toThrow("timestamps must use canonical UTC milliseconds")
      expect(() =>
        assessOneChannelExperimentPhysicalEvidence({
          ...physicalEvidence,
          bringUpResults: bringUpResults
            .slice(0, 3)
            .map((result, index) =>
              index === 2
                ? { ...result, externalPermit: { ...result.externalPermit!, issuedAtUtc: timestampUtc } }
                : result
            )
        })
      ).toThrow("timestamps must use canonical UTC milliseconds")
    }
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
