import { describe, expect, it } from "vitest"
import {
  benchPrototypeReferenceDrive,
  calculateReferenceTransientScreen,
  validateBenchPrototypeReferenceDrive
} from "./bench-prototype-reference-drive.js"
import { oneChannelAnalogExperiment } from "./one-channel-analog-experiment.js"
import {
  ads8881ReferenceNetworkRequirement,
  oneChannelAnalogExperimentBom,
  ref5025OutputCapacitorRequirement
} from "./one-channel-analog-readiness.js"

function clone<T>(value: T): T {
  return structuredClone(value)
}

describe("BP-101 bench prototype reference drive", () => {
  it("pins the REF5025A-Q1 network and leaves all physical release gates denied", () => {
    expect(validateBenchPrototypeReferenceDrive(benchPrototypeReferenceDrive)).toBe(true)
    expect(benchPrototypeReferenceDrive.selectedParts).toEqual(
      expect.arrayContaining([
        ["U_REF", "REF5025AQDRQ1"],
        ["C_REF_IN", "GRM188R71A105KA12D"],
        ["C_REF_REG", "T521B106M025ATE100"],
        ["C_REF_REG_HF", "C0603C104K3RACTU"],
        ["R_REF_SAR", "RCWE0603R220FKEA"],
        ["C_REF", "GRM21BR71A106KE51L"],
        ["U_SAR", "ADS8881IDGS"]
      ])
    )
    expect(benchPrototypeReferenceDrive.topology).toEqual({
      input:
        "V5_ANALOG -> C_REF_IN 1 uF X7R directly to SCORING_SGND at REF5025A-Q1 IN/GND; no shared return through ADS8881 or digital decoupling",
      regulatorOutput:
        "REF5025A-Q1 OUT -> C_REF_REG 10 uF polymer tantalum in parallel with C_REF_REG_HF 100 nF X7R -> SCORING_SGND, entirely inside the regulator-local loop",
      adc: "REF5025A-Q1 OUT -> R_REF_SAR 0.22 ohm -> ADS_REF2V5; C_REF 10 uF X7R 0805 is the only capacitor directly across ADS8881 REF/GND; AINN remains SCORING_SGND"
    })
    expect(benchPrototypeReferenceDrive.ref5025LocalStabilization).toMatchObject({
      outputMaximumCapacitanceUf: 50,
      outputMaximumEsrOhms: 1.5,
      outputMinimumCapacitanceUf: 1,
      selectedManufacturerMaximumEsrOhms: 0.1
    })
    expect(benchPrototypeReferenceDrive.authority).toEqual({
      fabricationAuthorized: false,
      footprintsApproved: false,
      layoutApproved: false,
      measuredTransientApproved: false,
      releaseState: "deny"
    })
  })

  it("does illustrative passive-only arithmetic without confusing it for dynamic-load proof", () => {
    expect(benchPrototypeReferenceDrive.illustrativeTransientScreen.result).toEqual({
      capacitorDroopMv: 12.5,
      chargePulseNc: 100,
      esrStepMv: 10,
      illustrativePulseCurrentMa: 100,
      modelIsPassiveOnly: true,
      pulseWidthUs: 1,
      totalUnregulatedStepMv: 22.5,
      validatesDynamicLoad: false
    })
    expect(() =>
      calculateReferenceTransientScreen({
        capacitorMinimumUf: 0,
        capacitorMaximumEsrOhms: 0.1,
        chargePulseNc: 1,
        pulseWidthUs: 1
      })
    ).toThrow(RangeError)
    expect(() =>
      calculateReferenceTransientScreen({
        capacitorMinimumUf: 1,
        capacitorMaximumEsrOhms: -0.1,
        chargePulseNc: 1,
        pulseWidthUs: 1
      })
    ).toThrow(RangeError)
    expect(() =>
      calculateReferenceTransientScreen({
        capacitorMinimumUf: 1,
        capacitorMaximumEsrOhms: 0.1,
        chargePulseNc: Number.NaN,
        pulseWidthUs: 1
      })
    ).toThrow(RangeError)
    expect(() =>
      calculateReferenceTransientScreen({
        capacitorMinimumUf: 1,
        capacitorMaximumEsrOhms: 0.1,
        chargePulseNc: 1,
        pulseWidthUs: 0
      })
    ).toThrow(RangeError)
  })

  it("defines reproducible simulation and measurement evidence without granting performance credit", () => {
    expect(benchPrototypeReferenceDrive.simulationAndEvidence).toMatchObject({
      artifactKind: "bench-prototype-reference-transient-evidence",
      simulation: {
        model: "bounded-behavioral-REF5025-to-ADS8881-reference-network-screen",
        performanceCredit: false,
        status: "passed-bounded-behavioral-screen",
        execution: {
          boundedSimulationPassed: true,
          caseCount: 12,
          rawWaveformPointCount: 126279,
          reproduced: true
        }
      },
      measurement: {
        physicalEvidenceAccepted: false,
        status: "not-acquired"
      },
      correlation: { required: true, status: "not-assessed" },
      authority: {
        boundedSimulationPassed: true,
        correlationAccepted: false,
        measurementAccepted: false,
        performanceClaimAccepted: false,
        releaseState: "deny"
      }
    })
    expect(benchPrototypeReferenceDrive.simulationAndEvidence.simulation.declaredModelInputs).toEqual(
      expect.arrayContaining([
        "2.5 V behavioral regulator target with 1 V declared input headroom",
        "100 mA, 1 us behavioral ADC reference-load pulse representing the illustrative 100 nC stimulus",
        "0.22 ohm R_REF_SAR and 0.05 ohm to 0.1 ohm declared regulator output resistance"
      ])
    )
    expect(benchPrototypeReferenceDrive.simulationAndEvidence.simulation.execution).toMatchObject({
      observedEnvelope: {
        maximumDynamicDroopMv: 13.69,
        maximumDynamicFinalErrorMv: 2.11,
        maximumPowerTransitionRecoveryUs: 16.21,
        maximumStartupTimeTo99PercentUs: 94.71
      },
      artifactDigests: {
        netlistTemplateSha256: "87be1beb2285c6adc1ab4b620f7139445cf06b451f57264a94508658f66894c2",
        normalizedResultsSha256: "f3a2997911b1b700babc4822093731aa54c3286de8e941748f8e9a5764b5d975",
        parameterManifestSha256: "5ca2d17e0664ace5c44ff4ed96113b1280b389591a2c1c03ba4ab17adce34f46",
        waveformManifestSha256: "1c708bcb507b3cbed63ddd416524c478dafef2409949362dba9f528a4e98f62f",
        evidenceDigest: "79d700c8eddaf11a4a47ea1cd6e38ef29d8407effb30a1cef5cf6b2089b5599c"
      }
    })
    expect(benchPrototypeReferenceDrive.simulationAndEvidence.measurement.requiredArchiveFields).toEqual(
      expect.arrayContaining(["raw waveform artifact with sample rate, time base, trigger position, and SHA-256"])
    )
  })

  it("keeps the regulator and ADC loops separate and validates canonical net names", () => {
    expect(benchPrototypeReferenceDrive.ads8881LocalReservoir).toMatchObject({
      capacitorMpn: "GRM21BR71A106KE51L",
      feedResistanceOhms: 0.22,
      lowerValueParallelCapacitorPermitted: false,
      package: "0805"
    })
    expect(benchPrototypeReferenceDrive.layoutLoops.ref5025Output.separateFromAds8881LocalLoop).toBe(true)
    expect(benchPrototypeReferenceDrive.layoutLoops.ads8881Reference.lowerValueParallelCapacitorPermitted).toBe(false)
    expect(benchPrototypeReferenceDrive.layoutLoops.ref5025Output).toMatchObject({
      maximumConductorLengthInches: 0.1,
      maximumEstimatedLoopInductanceNh: 2,
      maximumViasPerConductor: 0
    })
    expect(benchPrototypeReferenceDrive.layoutLoops.ads8881Reference).toMatchObject({
      maximumConductorLengthInches: 0.1,
      maximumEstimatedLoopInductanceNh: 2,
      maximumViasPerConductor: 0
    })
    expect(benchPrototypeReferenceDrive.layoutLoops.evidenceAccepted).toBe(false)
    expect(benchPrototypeReferenceDrive.netRename).toEqual({
      analogPositive: { canonical: "V5_ANALOG", legacy: "S5V_ISO" },
      scoringReturn: { canonical: "SCORING_SGND", legacy: "SGND" },
      validatedForBp101Contract: true
    })
  })

  it("rejects substitutions, extras, sparse arrays, accessors, aliases, and array subclasses", () => {
    const substitution = clone(benchPrototypeReferenceDrive) as unknown as { selectedParts: Array<[string, string]> }
    substitution.selectedParts[0]![1] = "FAKE"
    expect(() => validateBenchPrototypeReferenceDrive(substitution)).toThrow(RangeError)

    const extra = clone(benchPrototypeReferenceDrive) as Record<string, unknown>
    extra.extra = true
    expect(() => validateBenchPrototypeReferenceDrive(extra)).toThrow(RangeError)

    const sparse = clone(benchPrototypeReferenceDrive) as unknown as { capturePlan: { requiredNodes: string[] } }
    delete sparse.capturePlan.requiredNodes[1]
    expect(() => validateBenchPrototypeReferenceDrive(sparse)).toThrow(RangeError)

    const accessor = clone(benchPrototypeReferenceDrive)
    Object.defineProperty(accessor, "decision", { get: () => benchPrototypeReferenceDrive.decision })
    expect(() => validateBenchPrototypeReferenceDrive(accessor)).toThrow(RangeError)

    const alias = clone(benchPrototypeReferenceDrive)
    ;(alias as unknown as { authority: unknown; primaryEvidence: unknown }).authority = alias.primaryEvidence
    expect(() => validateBenchPrototypeReferenceDrive(alias)).toThrow(RangeError)

    class ForgedArray<T> extends Array<T> {}
    const subclass = clone(benchPrototypeReferenceDrive) as unknown as { selectedParts: Array<[string, string]> }
    subclass.selectedParts = new ForgedArray(...subclass.selectedParts)
    expect(() => validateBenchPrototypeReferenceDrive(subclass)).toThrow(RangeError)

    const simulationStatus = clone(benchPrototypeReferenceDrive) as unknown as {
      simulationAndEvidence: { simulation: { status: string } }
    }
    simulationStatus.simulationAndEvidence.simulation.status = "accepted"
    expect(() => validateBenchPrototypeReferenceDrive(simulationStatus)).toThrow(RangeError)
  })

  it("rejects mutable source provenance drift and restores it", () => {
    const cRef = ref5025OutputCapacitorRequirement as { selectedMpn: string }
    const acquisition = oneChannelAnalogExperiment.acquisition as { adcReferenceVolts: number }
    const adcFeed = ads8881ReferenceNetworkRequirement.feedResistor as { selectedOhms: number }
    const highFrequencyBypass = oneChannelAnalogExperimentBom.find((part) => part.reference === "C_REF_REG_HF") as {
      mpn: string
    }
    const cRefOriginal = cRef.selectedMpn
    const referenceOriginal = acquisition.adcReferenceVolts
    const adcFeedOriginal = adcFeed.selectedOhms
    const highFrequencyBypassOriginal = highFrequencyBypass.mpn
    try {
      Reflect.set(cRef, "selectedMpn", "FAKE")
      expect(() => validateBenchPrototypeReferenceDrive(benchPrototypeReferenceDrive)).toThrow(
        "source provenance drifted"
      )
      Reflect.set(cRef, "selectedMpn", cRefOriginal)

      Reflect.set(acquisition, "adcReferenceVolts", 3.3)
      expect(() => validateBenchPrototypeReferenceDrive(benchPrototypeReferenceDrive)).toThrow(
        "source provenance drifted"
      )
      Reflect.set(acquisition, "adcReferenceVolts", referenceOriginal)

      Reflect.set(adcFeed, "selectedOhms", 0.47)
      expect(() => validateBenchPrototypeReferenceDrive(benchPrototypeReferenceDrive)).toThrow(
        "source provenance drifted"
      )
      Reflect.set(adcFeed, "selectedOhms", adcFeedOriginal)

      Reflect.set(highFrequencyBypass, "mpn", "FAKE")
      expect(() => validateBenchPrototypeReferenceDrive(benchPrototypeReferenceDrive)).toThrow(
        "source provenance drifted"
      )
    } finally {
      Reflect.set(cRef, "selectedMpn", cRefOriginal)
      Reflect.set(acquisition, "adcReferenceVolts", referenceOriginal)
      Reflect.set(adcFeed, "selectedOhms", adcFeedOriginal)
      Reflect.set(highFrequencyBypass, "mpn", highFrequencyBypassOriginal)
    }
    expect(validateBenchPrototypeReferenceDrive(benchPrototypeReferenceDrive)).toBe(true)
  })
})
