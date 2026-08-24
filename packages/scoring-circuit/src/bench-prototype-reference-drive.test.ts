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
      isolatedPositive: { canonical: "S5V_ISOLATED", legacy: "S5V_ISO" },
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
