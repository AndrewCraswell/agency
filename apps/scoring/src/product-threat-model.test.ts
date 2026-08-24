import { describe, expect, it } from "vitest"
import { powerResetState } from "./power-reset-state.js"
import { processorFaultContainment } from "./processor-fault-containment.js"
import { productThreatModel, validateProductThreatModel } from "./product-threat-model.js"

function replaceDataProperty(target: object, key: string, value: unknown): void {
  Object.defineProperty(target, key, { configurable: true, enumerable: true, value, writable: true })
}

describe("M0-11 product threat model and firmware trust boundaries", () => {
  it("makes STM32 the only scoring authority and confines an application compromise", () => {
    expect(validateProductThreatModel(productThreatModel)).toBe(true)
    expect(productThreatModel.authority).toMatchObject({
      scoringAuthority: "STM32",
      applicationController: "ESP32",
      compromisedApplicationOutcome: "degraded only when STM32 remains available"
    })
    expect(productThreatModel.authority.scoringAuthority).toBe(processorFaultContainment.authority.scoringAuthority)
    expect(productThreatModel.authority.esp32Never).toEqual(processorFaultContainment.authority.esp32Never)
    expect(productThreatModel.trustZones.networkAndOptical).toBe("venue network and optical input are fully untrusted")
  })

  it("requires target-bound signed activation, atomic rollback, identity, and separate secret roles", () => {
    expect(productThreatModel.updateAndRollback).toMatchObject({
      authorization: "Each processor requires an approved target-bound digital signature before activation",
      stm32Activation: "signed locally authorized recoverable activation only",
      atomicity: "stage and verify before activation while retaining an approved prior image",
      rollback: "select only a target-compatible authenticated known-good image at or above the accepted security floor"
    })
    expect(productThreatModel.updateAndRollback.requiredBinding).toContain("image-digest")
    expect(productThreatModel.identityAndSecrets).toMatchObject({
      apparatusIdentity: "unique non-secret apparatus identity with traceable serial and lot identity",
      missingIdentityOutcome: "identity uncertainty or reset record and never a fabricated identity"
    })
    expect(productThreatModel.identityAndSecrets.secretHandling).toContain(
      "controlled provisioning read-back does not export private keys"
    )
  })

  it("denies network debug, validates hostile frames, and forbids remote plaintext fallback", () => {
    expect(productThreatModel.debugAndService.production).toBe(
      "no network-triggered SWD JTAG bootloader or memory-debug path"
    )
    expect(productThreatModel.networkAndFrameBoundary).toMatchObject({
      networkIsolation:
        "network parsers remain in the ESP32 application domain and never run in the STM32 scoring trusted-computing base",
      malformedOrReplayed: "reject without changing scoring state configuration outputs or reset ownership",
      frameLimit: "CRC-32C detects accidental corruption only and is not authentication or freshness",
      remoteRule:
        "optical commands are hostile until authenticated fresh authorized and bounded; no plaintext fallback or universal production key"
    })
    expect(productThreatModel.networkAndFrameBoundary.malformedOrReplayed).toBe(
      processorFaultContainment.faultOutcomes.malformedOrReplayedRequest
    )
  })

  it("retains USB-C PD, safe-inactive recovery, and denied production evidence", () => {
    expect(productThreatModel.recoveryAndPower).toMatchObject({
      normalPowerInput: "USB-C PD",
      laboratoryPowerInput: "LAB_POST_EFUSE_20V test-only 20 V input",
      interruptedBout:
        "never automatically resume an interrupted bout; require supervisor-authorized recovery disposition"
    })
    expect(productThreatModel.recoveryAndPower.normalPowerInput).toBe(powerResetState.powerInputs.normal)
    expect(productThreatModel.evidence).toMatchObject({
      productionSecurityApproved: false,
      contractBoundary:
        "documentation and host-validator evidence only; not firmware cryptography schematic provisioning or production security acceptance"
    })
    expect(Object.isFrozen(productThreatModel)).toBe(true)
    expect(Object.isFrozen(productThreatModel.updateAndRollback)).toBe(true)
  })

  it("rejects authority or security relaxation, evidence claims, aliases, and accessors", () => {
    const reverseAuthority = structuredClone(productThreatModel)
    replaceDataProperty(reverseAuthority.authority, "scoringAuthority", "ESP32")
    expect(() => validateProductThreatModel(reverseAuthority)).toThrow(RangeError)

    const plaintextFallback = structuredClone(productThreatModel)
    replaceDataProperty(plaintextFallback.networkAndFrameBoundary, "remoteRule", "plaintext fallback permitted")
    expect(() => validateProductThreatModel(plaintextFallback)).toThrow(RangeError)

    const nonSignatureActivation = structuredClone(productThreatModel)
    replaceDataProperty(
      nonSignatureActivation.updateAndRollback,
      "authorization",
      "equivalent authenticated authorization is sufficient"
    )
    expect(() => validateProductThreatModel(nonSignatureActivation)).toThrow(RangeError)

    const releaseClaim = structuredClone(productThreatModel)
    replaceDataProperty(releaseClaim.evidence, "productionSecurityApproved", true)
    expect(() => validateProductThreatModel(releaseClaim)).toThrow(RangeError)

    const alias = structuredClone(productThreatModel)
    replaceDataProperty(alias, "debugAndService", alias.updateAndRollback)
    expect(() => validateProductThreatModel(alias)).toThrow(RangeError)

    const accessor = structuredClone(productThreatModel)
    Object.defineProperty(accessor, "releaseState", { enumerable: true, get: () => "deny" })
    expect(() => validateProductThreatModel(accessor)).toThrow(RangeError)
  })
})
