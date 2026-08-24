import { describe, expect, it } from "vitest"
import { benchPrototypeAnalogTopology } from "./bench-prototype-analog-topology.js"
import {
  benchPrototypeFaultProtection,
  calculateGuardedFaultEnvelope,
  evaluateGuardedFaultCaptureWitness,
  validateBenchPrototypeFaultProtection
} from "./bench-prototype-fault-protection.js"
import { oneChannelAnalogExperiment } from "./one-channel-analog-experiment.js"
import { oneChannelAnalogExperimentBom, oneChannelAnalogExperimentReadiness } from "./one-channel-analog-readiness.js"

function clone<T>(value: T): T {
  return structuredClone(value)
}

describe("BP-102 bench prototype fault protection", () => {
  it("pins the connector-side network and leaves every fault and fabrication authority denied", () => {
    expect(validateBenchPrototypeFaultProtection(benchPrototypeFaultProtection)).toBe(true)
    expect(benchPrototypeFaultProtection.exactNetwork.normalSignal).toContain("TPD4E05U06DQAR")
    expect(benchPrototypeFaultProtection.exactNetwork.normalSignal).toContain("22 ohm")
    expect(benchPrototypeFaultProtection.exactNetwork.guardedInjection).toContain("56 kohm")
    expect(benchPrototypeFaultProtection.exactNetwork.protectedAcquisition).toContain("ADA4177-1ARZ")
    expect(benchPrototypeFaultProtection.circuitPinAndNetMap).toMatchObject({
      J_FIXTURE: { 1: "LINE", 2: "SGND", 3: "ESD_RETURN_RESERVED_NC" },
      J_GUARDED_FORCE: { 1: "FORCE", 2: "SGND" },
      U_ESD: { 1: "LINE_SHUNT", 3: "SGND_3 -> SGND", 8: "SGND_8 -> SGND" }
    })
    expect(benchPrototypeFaultProtection.fixtureInterlock.requiredForFavorableMeasurement).toEqual([
      "reference observed healthy",
      "positive analog rail observed healthy",
      "negative analog rail observed healthy",
      "overload observed clear",
      "ADC code observed expected"
    ])
    expect(benchPrototypeFaultProtection.authority).toEqual({
      fabricationAuthorized: false,
      recoveryValidated: false,
      releaseState: "deny",
      schematicIntegrationAuthorized: false,
      sustainedPlusMinus24VApproved: false,
      unpoweredFaultApproved: false
    })
  })

  it("makes the normal and guarded harnesses physically incompatible where the exact connector evidence exists", () => {
    expect(benchPrototypeFaultProtection.connectorSafety).toMatchObject({
      boardConnectorsAreMale: true,
      guarded: { mateMpn: "PHR-2", pinMap: { 1: "FORCE", 2: "SGND" }, pitchMm: 2, positions: 2 },
      normal: {
        mateMpn: "43645-0300",
        pinMap: { 1: "LINE", 2: "SGND", 3: "ESD_RETURN_RESERVED_NC" },
        pitchMm: 3,
        positions: 3
      },
      physicallyMutuallyIncompatible: true
    })
  })

  it("binds every selected part to one readiness row and a primary manufacturer link", () => {
    expect(benchPrototypeFaultProtection.selectedParts).toHaveLength(9)
    expect(Object.isFrozen(benchPrototypeFaultProtection.selectedParts)).toBe(true)
    for (const selected of benchPrototypeFaultProtection.selectedParts) {
      expect(Object.isFrozen(selected)).toBe(true)
      expect(oneChannelAnalogExperimentBom.filter((row) => row.reference === selected.reference)).toHaveLength(1)
      expect(selected.primaryEvidenceUrl).toMatch(/^https:\/\//u)
      expect(selected.mpn).not.toBe("__MISSING_OR_DUPLICATE__")
    }
  })

  it("bounds only the guarded source current, power, and energy", () => {
    const maximum = calculateGuardedFaultEnvelope({ appliedVolts: 24, pulseDurationMs: 100 })
    expect(maximum.sourceCurrentA).toBeCloseTo(0.0004329004329, 12)
    expect(maximum.maximumSourcePowerW).toBeCloseTo(0.0103896103896, 12)
    expect(maximum.maximumSourceEnergyJ).toBeCloseTo(0.00103896103896, 12)
    expect(maximum.sourceEnvelopeOnly).toBe(true)
    const negativeMaximum = calculateGuardedFaultEnvelope({ appliedVolts: -24, pulseDurationMs: 100 })
    expect(negativeMaximum).toEqual({ ...maximum, appliedVolts: -24 })
    expect(() => calculateGuardedFaultEnvelope({ appliedVolts: 24.01, pulseDurationMs: 100 })).toThrow(RangeError)
    expect(() => calculateGuardedFaultEnvelope({ appliedVolts: 24, pulseDurationMs: 100.01 })).toThrow(RangeError)
    expect(() => calculateGuardedFaultEnvelope({ appliedVolts: Number.NaN, pulseDurationMs: 1 })).toThrow(RangeError)
  })

  it("fails closed unless every powered capture witness, trace, and stop gate is observed", () => {
    const witness = {
      appliedVolts: 24,
      beforePulse: {
        currentTripArmed: true,
        dwellTimerArmed: true,
        fixturePermitObserved: true,
        interPulseTimerSatisfied: true,
        normalSourceDisabled: true,
        sinkDisabled: true,
        sourceSinkForceMutualExclusionObserved: true,
        watchdogHealthy: true
      },
      health: {
        adcCodeExpected: true,
        negativeAnalogRailHealthy: true,
        overloadClear: true,
        positiveAnalogRailHealthy: true,
        referenceHealthy: true
      },
      powered: true,
      pulseDurationMs: 100,
      stopConditionObserved: false,
      traceObserved: {
        ads8881Ainp: true,
        bufferInput: true,
        bufferOutput: true,
        guardedForceCurrent: true,
        guardedForceVoltage: true,
        line: true,
        postTpd: true,
        ref5025Output: true,
        s5vIsolated: true,
        s5vNeg: true
      }
    }

    expect(evaluateGuardedFaultCaptureWitness(witness)).toMatchObject({
      approval: false,
      evidenceState: "capture-eligible-no-approval",
      polarity: "plus",
      reasons: []
    })
    expect(evaluateGuardedFaultCaptureWitness({ ...witness, appliedVolts: -24 })).toMatchObject({
      approval: false,
      evidenceState: "capture-eligible-no-approval",
      polarity: "minus",
      reasons: []
    })
    expect(
      evaluateGuardedFaultCaptureWitness({
        ...witness,
        powered: false,
        stopConditionObserved: true
      })
    ).toMatchObject({
      approval: false,
      evidenceState: "unavailable",
      reasons: ["fixture stop condition observed", "unpowered behavior remains unvalidated and denied"]
    })

    expect(
      evaluateGuardedFaultCaptureWitness({
        ...witness,
        health: { ...witness.health, referenceHealthy: false }
      })
    ).toMatchObject({
      evidenceState: "unavailable",
      reasons: ["health witness absent: referenceHealthy"]
    })
    expect(
      evaluateGuardedFaultCaptureWitness({
        ...witness,
        traceObserved: { ...witness.traceObserved, bufferOutput: false }
      })
    ).toMatchObject({
      evidenceState: "unavailable",
      reasons: ["required trace absent: bufferOutput"]
    })
    expect(() => evaluateGuardedFaultCaptureWitness({ ...witness, ignored: true })).toThrow(RangeError)
    expect(() => evaluateGuardedFaultCaptureWitness({ ...witness, appliedVolts: 0 })).toThrow(RangeError)
    const accessor = { ...witness }
    Object.defineProperty(accessor, "powered", { get: () => true })
    expect(() => evaluateGuardedFaultCaptureWitness(accessor)).toThrow(RangeError)
  })

  it("rejects substitutions, extras, sparse arrays, accessors, aliases, and array subclasses", () => {
    const substitution = clone(benchPrototypeFaultProtection) as unknown as {
      selectedParts: Array<{ mpn: string }>
    }
    substitution.selectedParts[0]!.mpn = "FAKE"
    expect(() => validateBenchPrototypeFaultProtection(substitution)).toThrow(RangeError)

    const extra = clone(benchPrototypeFaultProtection) as Record<string, unknown>
    extra.extra = true
    expect(() => validateBenchPrototypeFaultProtection(extra)).toThrow(RangeError)

    const sparse = clone(benchPrototypeFaultProtection) as unknown as { fixtureInterlock: { stopConditions: string[] } }
    delete sparse.fixtureInterlock.stopConditions[1]
    expect(() => validateBenchPrototypeFaultProtection(sparse)).toThrow(RangeError)

    const accessor = clone(benchPrototypeFaultProtection)
    Object.defineProperty(accessor, "decision", { get: () => benchPrototypeFaultProtection.decision })
    expect(() => validateBenchPrototypeFaultProtection(accessor)).toThrow(RangeError)

    const alias = clone(benchPrototypeFaultProtection)
    ;(alias as unknown as { authority: unknown; overloadRecovery: unknown }).authority = alias.overloadRecovery
    expect(() => validateBenchPrototypeFaultProtection(alias)).toThrow(RangeError)

    class ForgedArray<T> extends Array<T> {}
    const subclass = clone(benchPrototypeFaultProtection) as unknown as {
      selectedParts: Array<(typeof benchPrototypeFaultProtection.selectedParts)[number]>
    }
    subclass.selectedParts = new ForgedArray(...subclass.selectedParts)
    expect(() => validateBenchPrototypeFaultProtection(subclass)).toThrow(RangeError)
  })

  it("rejects mutable connector and guarded-fault provenance drift and restores it", () => {
    const guardedConnector = oneChannelAnalogExperimentReadiness.connectorSafety.guarded as { pitchMm: number }
    const faultGuard = oneChannelAnalogExperiment.faultGuard as { maximumPulseDurationMs: number }
    const originalPitch = guardedConnector.pitchMm
    const originalDuration = faultGuard.maximumPulseDurationMs
    try {
      Reflect.set(guardedConnector, "pitchMm", 2.54)
      expect(() => validateBenchPrototypeFaultProtection(benchPrototypeFaultProtection)).toThrow("provenance drifted")
      Reflect.set(guardedConnector, "pitchMm", originalPitch)

      Reflect.set(faultGuard, "maximumPulseDurationMs", 101)
      expect(() => validateBenchPrototypeFaultProtection(benchPrototypeFaultProtection)).toThrow("provenance drifted")
    } finally {
      Reflect.set(guardedConnector, "pitchMm", originalPitch)
      Reflect.set(faultGuard, "maximumPulseDurationMs", originalDuration)
    }
    expect(validateBenchPrototypeFaultProtection(benchPrototypeFaultProtection)).toBe(true)
  })

  it("rejects readiness BOM drift while BP-100 provenance remains immutable", () => {
    const esdRow = oneChannelAnalogExperimentBom.find((row) => row.reference === "U_ESD")
    if (esdRow === undefined) throw new Error("missing U_ESD readiness row")
    const originalMpn = esdRow.mpn
    try {
      Reflect.set(esdRow, "mpn", "__MISSING_OR_DUPLICATE__")
      expect(() => validateBenchPrototypeFaultProtection(benchPrototypeFaultProtection)).toThrow("provenance drifted")
      Reflect.set(esdRow, "mpn", originalMpn)

      Reflect.set(esdRow, "mpn", "FAKE")
      expect(() => validateBenchPrototypeFaultProtection(benchPrototypeFaultProtection)).toThrow("provenance drifted")
    } finally {
      Reflect.set(esdRow, "mpn", originalMpn)
    }
    const bp100Reference = benchPrototypeAnalogTopology.selectedReferences[0]
    expect(Object.isFrozen(bp100Reference)).toBe(true)
    expect(Reflect.set(bp100Reference, "1", "FAKE")).toBe(false)
    expect(validateBenchPrototypeFaultProtection(benchPrototypeFaultProtection)).toBe(true)
  })

  it("rejects duplicate readiness BOM references and restores the registry", () => {
    const esdRow = oneChannelAnalogExperimentBom.find((row) => row.reference === "U_ESD")
    if (esdRow === undefined) throw new Error("missing U_ESD readiness row")
    const originalLength = oneChannelAnalogExperimentBom.length
    try {
      oneChannelAnalogExperimentBom.push({ ...esdRow })
      expect(() => validateBenchPrototypeFaultProtection(benchPrototypeFaultProtection)).toThrow("provenance drifted")
    } finally {
      oneChannelAnalogExperimentBom.splice(originalLength)
    }
    expect(validateBenchPrototypeFaultProtection(benchPrototypeFaultProtection)).toBe(true)
  })

  it("rejects a missing readiness BOM reference and restores the registry", () => {
    const index = oneChannelAnalogExperimentBom.findIndex((row) => row.reference === "U_ESD")
    if (index < 0) throw new Error("missing U_ESD readiness row")
    const [removed] = oneChannelAnalogExperimentBom.splice(index, 1)
    if (removed === undefined) throw new Error("failed to remove U_ESD readiness row")
    try {
      expect(() => validateBenchPrototypeFaultProtection(benchPrototypeFaultProtection)).toThrow("provenance drifted")
    } finally {
      oneChannelAnalogExperimentBom.splice(index, 0, removed)
    }
    expect(validateBenchPrototypeFaultProtection(benchPrototypeFaultProtection)).toBe(true)
  })
})
