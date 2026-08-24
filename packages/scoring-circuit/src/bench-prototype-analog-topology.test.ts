import { describe, expect, it } from "vitest"
import {
  benchPrototypeAnalogTopology,
  validateBenchPrototypeAnalogTopology
} from "./bench-prototype-analog-topology.js"
import { oneChannelAnalogExperiment } from "./one-channel-analog-experiment.js"

function clone<T>(value: T): T {
  return structuredClone(value)
}

describe("BP-100 bench prototype analog topology", () => {
  it("selects the one-channel protected buffer and SAR chain without granting release", () => {
    expect(validateBenchPrototypeAnalogTopology(benchPrototypeAnalogTopology)).toBe(true)
    expect(benchPrototypeAnalogTopology.normalRange).toMatchObject({
      allInsidePublishedBufferAndAdcRanges: true,
      zeroOhmCovered: true
    })
    expect(benchPrototypeAnalogTopology.accuracyBudget.arithmeticInsideAllocation).toBe(true)
    expect(benchPrototypeAnalogTopology.accuracyBudget.validated).toBe(false)
    expect(benchPrototypeAnalogTopology.sabreTimingBudget.arithmeticInsideAllocation).toBe(true)
    expect(benchPrototypeAnalogTopology.sabreTimingBudget.validated).toBe(false)
    expect(benchPrototypeAnalogTopology.authority).toEqual({
      fabricationAuthorized: false,
      footprintClosureAuthorized: false,
      releaseState: "deny",
      schematicIntegrationAuthorized: false
    })
  })

  it("gives no credit to any omitted accuracy or timing term", () => {
    expect(benchPrototypeAnalogTopology.accuracyBudget.omittedTerms.length).toBeGreaterThan(0)
    expect(benchPrototypeAnalogTopology.sabreTimingBudget.omittedTerms.length).toBeGreaterThan(0)
    expect(
      [
        ...benchPrototypeAnalogTopology.accuracyBudget.omittedTerms,
        ...benchPrototypeAnalogTopology.sabreTimingBudget.omittedTerms
      ].every((entry) => entry.credited === false)
    ).toBe(true)
  })

  it("pins the corrected reference capacitor and exact acquisition parts", () => {
    expect(benchPrototypeAnalogTopology.selectedReferences).toContainEqual(["C_REF", "T521B106M025ATE100"])
    expect(benchPrototypeAnalogTopology.selectedReferences).toContainEqual(["U_ESD", "TPD4E05U06DQAR"])
    expect(benchPrototypeAnalogTopology.selectedReferences).toContainEqual(["R_ESD", "CRCW060322R0FKEAHP"])
    expect(benchPrototypeAnalogTopology.selectedReferences).toContainEqual(["U_OVP_BUFFER", "ADA4177-1BRZ"])
    expect(benchPrototypeAnalogTopology.selectedReferences).toContainEqual(["U_SAR", "ADS8881IDGS"])
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
        "numerical experiment evidence drifted"
      )
      Reflect.set(source, "excitationVolts", sourceOriginal)

      Reflect.set(acquisition, "bufferGainBandwidthTypicalMhz", 4)
      expect(() => validateBenchPrototypeAnalogTopology(benchPrototypeAnalogTopology)).toThrow(
        "numerical experiment evidence drifted"
      )
      Reflect.set(acquisition, "bufferGainBandwidthTypicalMhz", bandwidthOriginal)

      Reflect.set(faultGuard, "maximumPulseDurationMs", 101)
      expect(() => validateBenchPrototypeAnalogTopology(benchPrototypeAnalogTopology)).toThrow(
        "numerical experiment evidence drifted"
      )
    } finally {
      Reflect.set(source, "excitationVolts", sourceOriginal)
      Reflect.set(acquisition, "bufferGainBandwidthTypicalMhz", bandwidthOriginal)
      Reflect.set(faultGuard, "maximumPulseDurationMs", pulseOriginal)
    }
    expect(validateBenchPrototypeAnalogTopology(benchPrototypeAnalogTopology)).toBe(true)
  })
})
