import { describe, expect, it } from "vitest"
import { powerResetState, validatePowerResetState } from "./power-reset-state.js"

function replaceDataProperty(target: object, key: string, value: unknown): void {
  Object.defineProperty(target, key, { configurable: true, enumerable: true, value, writable: true })
}

describe("M0-10 power and reset state", () => {
  it("freezes cold boot, brownout, independent reset, watchdog, update, and whole-power loss", () => {
    expect(validatePowerResetState(powerResetState)).toBe(true)
    expect(powerResetState.lifecycle).toMatchObject({
      coldBoot: {
        bootIdentity: "new affected-controller boot ID",
        outcome: "unavailable until local recovery gates pass"
      },
      brownout: { outcome: "affected controller unavailable and safe-inactive" },
      watchdogReset: { classification: "processorReset and never boutReset" },
      updateReset: { classification: "never boutReset" },
      wholePowerLoss: { restoration: "new whole-apparatus cold-boot lifecycle with new boot IDs" }
    })
    expect(Object.isFrozen(powerResetState)).toBe(true)
    expect(Object.isFrozen(powerResetState.lifecycle)).toBe(true)
  })

  it("keeps reset authority one-way and an application reset degraded only when STM32 stays healthy", () => {
    expect(powerResetState.authority).toMatchObject({
      scoringAuthority: "STM32",
      applicationController: "ESP32",
      resetDirection: "STM32 to ESP32 only through RESET_REQUEST to an EN_RESET low-side sink",
      forbiddenResetDirection: "No automatic ESP32 to STM32 SCORING_NRST_N reset path",
      boutReset: "Only a designated supervisor path may authorize a reviewed boutReset"
    })
    expect(powerResetState.lifecycle.independentProcessorReset).toEqual({
      scoringController: "unavailable and safe-inactive until technical recovery and supervisor disposition",
      applicationController: "degraded only while the STM32 remains available",
      peerEffect: "No peer reset, watchdog service, scoring change, or primary-output change"
    })
  })

  it("fails closed for safe outputs, boot identities, availability, and persistence", () => {
    expect(powerResetState.safeState).toMatchObject({
      glossaryName: "safeInactive",
      runtimeName: "safe-inactive",
      unavailableInterval: "No candidate promotion qualification registration or inferred no-signal result"
    })
    expect(powerResetState.availability).toMatchObject({
      states: ["available", "degraded", "unavailable"],
      interruptedStm32Bout:
        "Remain unavailable until a supervisor-authorized new scoring or bout state; no continuity restoration is selected"
    })
    expect(powerResetState.persistence).toMatchObject({
      powerFailOutcome:
        "Recover only the prior valid state or the next valid state; never accept a partial record as evidence",
      primaryOutput: "A latched primary indication is not assumed durable or preserved through a warm STM32 reset"
    })
  })

  it("retains USB-C PD as normal input and makes the laboratory input mutually exclusive", () => {
    expect(powerResetState.powerInputs).toEqual({
      normal: "USB-C PD",
      laboratory: "LAB_POST_EFUSE_20V test-only 20 V input",
      mutuallyExclusive: true,
      selectionRule: "Select sources only while de-energized; never drive both sources simultaneously"
    })
  })

  it("rejects reset reversal, relaxed inputs, false hardware evidence, and aliases", () => {
    const reversedReset = structuredClone(powerResetState)
    replaceDataProperty(reversedReset.authority, "forbiddenResetDirection", "ESP32 may reset STM32")
    expect(() => validatePowerResetState(reversedReset)).toThrow(RangeError)

    const dualInput = structuredClone(powerResetState)
    replaceDataProperty(dualInput.powerInputs, "mutuallyExclusive", false)
    expect(() => validatePowerResetState(dualInput)).toThrow(RangeError)

    const releasedEvidence = structuredClone(powerResetState)
    replaceDataProperty(releasedEvidence.evidence, "hardwareEvidenceClaimed", true)
    expect(() => validatePowerResetState(releasedEvidence)).toThrow(RangeError)

    const alias = structuredClone(powerResetState)
    replaceDataProperty(alias.lifecycle, "updateReset", alias.lifecycle.watchdogReset)
    expect(() => validatePowerResetState(alias)).toThrow(RangeError)
  })

  it("rejects accessor properties and any unreviewed contract drift", () => {
    const accessor = structuredClone(powerResetState)
    Object.defineProperty(accessor, "releaseState", { enumerable: true, get: () => "deny" })
    expect(() => validatePowerResetState(accessor)).toThrow(RangeError)

    const alteredPersistence = structuredClone(powerResetState)
    replaceDataProperty(alteredPersistence.persistence, "powerFailOutcome", "recover a partial record")
    expect(() => validatePowerResetState(alteredPersistence)).toThrow(RangeError)
  })
})
