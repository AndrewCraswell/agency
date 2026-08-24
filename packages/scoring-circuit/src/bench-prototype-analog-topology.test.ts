import { describe, expect, it } from "vitest"
import {
  benchPrototypeAnalogTopology,
  validateBenchPrototypeAnalogTopology
} from "./bench-prototype-analog-topology.js"
import { oneChannelAnalogExperiment } from "./one-channel-analog-experiment.js"
import { oneChannelAnalogExperimentBom } from "./one-channel-analog-readiness.js"

function clone<T>(value: T): T {
  return structuredClone(value)
}

describe("BP-100 bench prototype analog topology", () => {
  it("accepts the reviewed topology-selection budget without granting performance, physical, or release authority", () => {
    expect(validateBenchPrototypeAnalogTopology(benchPrototypeAnalogTopology)).toBe(true)
    expect(benchPrototypeAnalogTopology.normalRange).toMatchObject({
      allInsidePublishedBufferAndAdcRanges: true,
      zeroOhmCovered: true
    })
    expect(benchPrototypeAnalogTopology.accuracyBudget.arithmeticInsideAllocation).toBe(true)
    expect(benchPrototypeAnalogTopology.accuracyBudget.validated).toBe(false)
    expect(benchPrototypeAnalogTopology.sabreTimingBudget.arithmeticInsideAllocation).toBe(true)
    expect(benchPrototypeAnalogTopology.sabreTimingBudget.validated).toBe(false)
    expect(benchPrototypeAnalogTopology.authority).toMatchObject({
      performanceClaimAccepted: false,
      physicalMeasurementsAccepted: false,
      reviewedBudgetComplete: true,
      topologySelectionAccepted: true
    })
    expect(benchPrototypeAnalogTopology.authority).toEqual({
      fabricationAuthorized: false,
      footprintClosureAuthorized: false,
      performanceClaimAccepted: false,
      physicalMeasurementsAccepted: false,
      releaseState: "deny",
      reviewedBudgetComplete: true,
      schematicIntegrationAuthorized: false,
      topologySelectionAccepted: true
    })
  })

  it("makes every error, settling, leakage, overload, and recovery term explicit and grants no unbounded term credit", () => {
    const { accuracyBudget, faultRecoveryBudget, leakageBudget, overloadAndFault, sabreTimingBudget } =
      benchPrototypeAnalogTopology
    expect(accuracyBudget.completeTermInventory.length).toBeGreaterThan(10)
    expect(sabreTimingBudget.completeTermInventory.length).toBeGreaterThan(5)
    expect(leakageBudget.completeTermInventory.length).toBeGreaterThan(5)
    expect(overloadAndFault.completeTermInventory.length).toBeGreaterThan(10)
    expect(faultRecoveryBudget.completeTermInventory.length).toBeGreaterThan(3)
    expect(
      accuracyBudget.completeTermInventory
        .filter((entry) => entry.credit === "none")
        .every((entry) => entry.errorOhms === null)
    ).toBe(true)
    expect(
      sabreTimingBudget.completeTermInventory
        .filter((entry) => entry.credit === "none")
        .every((entry) => entry.timeUs === null)
    ).toBe(true)
    expect(
      leakageBudget.completeTermInventory
        .filter((entry) => entry.credit === "none")
        .every((entry) => entry.errorOhms === null && entry.maximumNa === null)
    ).toBe(true)
    expect(
      overloadAndFault.completeTermInventory
        .filter((entry) => entry.credit === "none")
        .every((entry) => entry.value === null)
    ).toBe(true)
    expect(
      faultRecoveryBudget.completeTermInventory.every((entry) => entry.credit === "none" && entry.measured === false)
    ).toBe(true)
    expect(accuracyBudget.physicalMeasurementStatus).toBe("DENY")
    expect(sabreTimingBudget.physicalMeasurementStatus).toBe("DENY")
    expect(leakageBudget.physicalMeasurementStatus).toBe("DENY")
    expect(overloadAndFault.physicalMeasurementStatus).toBe("DENY")
    expect(faultRecoveryBudget.physicalMeasurementStatus).toBe("DENY")
  })

  it("pins the corrected reference capacitor and exact acquisition parts", () => {
    expect(benchPrototypeAnalogTopology.selectedReferences).toContainEqual(["C_REF_REG", "T521B106M025ATE100"])
    expect(benchPrototypeAnalogTopology.selectedReferences).toContainEqual(["R_REF_SAR", "RCWE0603R220FKEA"])
    expect(benchPrototypeAnalogTopology.selectedReferences).toContainEqual(["C_REF", "GRM21BR71A106KE51L"])
    expect(benchPrototypeAnalogTopology.selectedReferences).toContainEqual(["U_ESD", "TPD4E05U06DQAR"])
    expect(benchPrototypeAnalogTopology.selectedReferences).toContainEqual(["R_ESD", "CRCW060322R0FKEAHP"])
    expect(benchPrototypeAnalogTopology.selectedReferences).toContainEqual(["U_OVP_BUFFER", "ADA4177-1ARZ"])
    expect(benchPrototypeAnalogTopology.selectedReferences).toContainEqual(["U_SAR", "ADS8881IDGS"])
    expect(benchPrototypeAnalogTopology.normalProtectionParts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ mpn: "TPD4E05U06DQAR", reference: "U_ESD" }),
        expect.objectContaining({ mpn: "CRCW060322R0FKEAHP", reference: "R_ESD" }),
        expect.objectContaining({ mpn: "TMUX1112PWR", reference: "U_SOURCE_SWITCH" }),
        expect.objectContaining({ mpn: "ADA4177-1ARZ", reference: "U_OVP_BUFFER" })
      ])
    )
  })

  it("rejects substitutions, extras, sparse arrays, accessors, aliases, and array subclasses", () => {
    const substitution = clone(benchPrototypeAnalogTopology) as unknown as {
      selectedReferences: Array<[string, string]>
    }
    substitution.selectedReferences[0]![1] = "FAKE"
    expect(() => validateBenchPrototypeAnalogTopology(substitution)).toThrow(RangeError)

    const extra = clone(benchPrototypeAnalogTopology) as Record<string, unknown>
    extra.extra = true
    expect(() => validateBenchPrototypeAnalogTopology(extra)).toThrow(RangeError)

    const sparse = clone(benchPrototypeAnalogTopology) as unknown as {
      normalRange: { requiredResistanceOhms: number[] }
    }
    delete sparse.normalRange.requiredResistanceOhms[1]
    expect(() => validateBenchPrototypeAnalogTopology(sparse)).toThrow(RangeError)

    const accessor = clone(benchPrototypeAnalogTopology)
    Object.defineProperty(accessor, "decision", { get: () => benchPrototypeAnalogTopology.decision })
    expect(() => validateBenchPrototypeAnalogTopology(accessor)).toThrow(RangeError)

    const alias = clone(benchPrototypeAnalogTopology)
    ;(alias as unknown as { dependencies: unknown; authority: unknown }).dependencies = alias.authority
    expect(() => validateBenchPrototypeAnalogTopology(alias)).toThrow(RangeError)

    class ForgedArray<T> extends Array<T> {}
    const subclass = clone(benchPrototypeAnalogTopology) as unknown as {
      normalRange: { requiredResistanceOhms: number[] }
    }
    subclass.normalRange.requiredResistanceOhms = new ForgedArray(0, 450, 475, 500)
    expect(() => validateBenchPrototypeAnalogTopology(subclass)).toThrow(RangeError)
  })

  it("rejects mutable upstream registry drift and restores it", () => {
    const source = oneChannelAnalogExperiment.source as unknown as { switch: string }
    const original = source.switch
    try {
      Reflect.set(source, "switch", "FAKE")
      expect(() => validateBenchPrototypeAnalogTopology(benchPrototypeAnalogTopology)).toThrow(
        "upstream analog evidence drifted"
      )
    } finally {
      Reflect.set(source, "switch", original)
    }
    expect(validateBenchPrototypeAnalogTopology(benchPrototypeAnalogTopology)).toBe(true)
  })

  it("rejects normal-protection BOM and numerical-provenance drift", () => {
    const esd = oneChannelAnalogExperimentBom.find((part) => part.reference === "U_ESD") as unknown as { mpn: string }
    const acquisition = oneChannelAnalogExperiment.acquisition as unknown as { adcInputLeakageMaximumNa: number }
    const esdOriginal = esd.mpn
    const leakageOriginal = acquisition.adcInputLeakageMaximumNa
    try {
      Reflect.set(esd, "mpn", "FAKE")
      expect(() => validateBenchPrototypeAnalogTopology(benchPrototypeAnalogTopology)).toThrow(
        "upstream analog evidence drifted"
      )
      Reflect.set(esd, "mpn", esdOriginal)

      Reflect.set(acquisition, "adcInputLeakageMaximumNa", 6)
      expect(() => validateBenchPrototypeAnalogTopology(benchPrototypeAnalogTopology)).toThrow(
        "upstream analog evidence drifted"
      )
    } finally {
      Reflect.set(esd, "mpn", esdOriginal)
      Reflect.set(acquisition, "adcInputLeakageMaximumNa", leakageOriginal)
    }
    expect(validateBenchPrototypeAnalogTopology(benchPrototypeAnalogTopology)).toBe(true)
  })

  it("rejects numerical drift behind static, range, timing, and fault screens", () => {
    const source = oneChannelAnalogExperiment.source as unknown as {
      excitationVolts: number
    }
    const acquisition = oneChannelAnalogExperiment.acquisition as unknown as {
      bufferGainBandwidthTypicalMhz: number
    }
    const faultGuard = oneChannelAnalogExperiment.faultGuard as unknown as {
      maximumPulseDurationMs: number
    }
    const sourceOriginal = source.excitationVolts
    const bandwidthOriginal = acquisition.bufferGainBandwidthTypicalMhz
    const pulseOriginal = faultGuard.maximumPulseDurationMs
    try {
      Reflect.set(source, "excitationVolts", 2.4)
      expect(() => validateBenchPrototypeAnalogTopology(benchPrototypeAnalogTopology)).toThrow(
        "upstream analog evidence drifted"
      )
      Reflect.set(source, "excitationVolts", sourceOriginal)

      Reflect.set(acquisition, "bufferGainBandwidthTypicalMhz", 4)
      expect(() => validateBenchPrototypeAnalogTopology(benchPrototypeAnalogTopology)).toThrow(
        "upstream analog evidence drifted"
      )
      Reflect.set(acquisition, "bufferGainBandwidthTypicalMhz", bandwidthOriginal)

      Reflect.set(faultGuard, "maximumPulseDurationMs", 101)
      expect(() => validateBenchPrototypeAnalogTopology(benchPrototypeAnalogTopology)).toThrow(
        "upstream analog evidence drifted"
      )
    } finally {
      Reflect.set(source, "excitationVolts", sourceOriginal)
      Reflect.set(acquisition, "bufferGainBandwidthTypicalMhz", bandwidthOriginal)
      Reflect.set(faultGuard, "maximumPulseDurationMs", pulseOriginal)
    }
    expect(validateBenchPrototypeAnalogTopology(benchPrototypeAnalogTopology)).toBe(true)
  })
})
