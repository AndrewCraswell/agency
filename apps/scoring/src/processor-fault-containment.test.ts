import { describe, expect, it } from "vitest"
import {
  benchPrototypeIsolationChannel,
  validateBenchPrototypeIsolationChannel
} from "../../../packages/scoring-circuit/src/bench-prototype-isolation-channel.js"
import {
  benchPrototypeResetWatchdog,
  validateBenchPrototypeResetWatchdog
} from "../../../packages/scoring-circuit/src/bench-prototype-reset-watchdog.js"
import { processorFaultContainment, validateProcessorFaultContainment } from "./processor-fault-containment.js"

function replaceDataProperty(target: object, key: string, value: unknown): void {
  Object.defineProperty(target, key, { configurable: true, enumerable: true, value, writable: true })
}

describe("M0-04 processor fault containment", () => {
  it("freezes the current two-heartbeat and one-way reset boundary", () => {
    expect(validateProcessorFaultContainment(processorFaultContainment)).toBe(true)
    expect(processorFaultContainment.nets).toEqual({
      stm32Reset: "SCORING_NRST_N",
      esp32Reset: "EN_RESET",
      stm32ResetAssert: "ESP32_RESET_ASSERT",
      resetRequest: "RESET_REQUEST",
      stm32Heartbeat: "STM32_HEARTBEAT",
      esp32Heartbeat: "ESP32_HEARTBEAT"
    })
    expect(processorFaultContainment.resetPolicy).toMatchObject({
      permittedPeerReset: "STM32 to ESP32 only through RESET_REQUEST to an EN_RESET low-side sink",
      forbiddenPeerReset: "No automatic ESP32 to STM32 SCORING_NRST_N reset path",
      heartbeatPolicy: "Neither heartbeat is a reset command"
    })
    expect(processorFaultContainment.nets.stm32ResetAssert).toBe(benchPrototypeIsolationChannel.reset.request.signal)
    expect(processorFaultContainment.nets.resetRequest).toBe(
      benchPrototypeIsolationChannel.reset.request.isolatedSignal
    )
    expect(processorFaultContainment.nets.stm32Reset).toBe(benchPrototypeResetWatchdog.resetTopology.scoring.resetNet)
    expect(processorFaultContainment.nets.esp32Reset).toBe(
      benchPrototypeResetWatchdog.resetTopology.application.resetNet
    )
    expect(Object.isFrozen(processorFaultContainment)).toBe(true)
    expect(Object.isFrozen(processorFaultContainment.nets)).toBe(true)
  })

  it("reconciles the frozen provenance tuple with BP-122 and BP-123 test evidence", () => {
    expect(validateBenchPrototypeIsolationChannel(benchPrototypeIsolationChannel)).toBe(true)
    expect(validateBenchPrototypeResetWatchdog(benchPrototypeResetWatchdog)).toBe(true)
    const resetChannel = benchPrototypeIsolationChannel.isolators.main.channels.find((channel) => channel.channel === 4)
    expect(resetChannel).toMatchObject({
      direction: "scoring-to-application",
      signal: "RESET_REQUEST",
      scoring: { net: "ESP32_RESET_ASSERT" },
      application: { net: "RESET_REQUEST" }
    })
    expect(benchPrototypeIsolationChannel.heartbeat).toMatchObject({
      stm32ToEsp32: { signal: "STM32_HEARTBEAT" },
      esp32ToStm32: { signal: "ESP32_HEARTBEAT" }
    })
    expect(benchPrototypeIsolationChannel.reset).toMatchObject({
      request: { signal: "ESP32_RESET_ASSERT", isolatedSignal: "RESET_REQUEST", activeLevel: "high" },
      esp32HardwareReset: { signal: "EN_RESET", sourceDomain: "application" },
      stm32HardwareReset: { signal: "SCORING_NRST_N", sourceDomain: "scoring" }
    })
    expect(benchPrototypeResetWatchdog.resetTopology).toMatchObject({
      scoring: { resetNet: "SCORING_NRST_N", independentFromApplication: true },
      application: { resetNet: "EN_RESET" }
    })
    expect(benchPrototypeResetWatchdog.resetTopology.crossDomain).toMatchObject({
      permittedPath: expect.stringContaining("ESP32_RESET_ASSERT"),
      prohibited: expect.arrayContaining([expect.stringContaining("SCORING_NRST_N")])
    })
    expect(processorFaultContainment.evidence.provenance).toEqual({
      bp122: "ISO7762FDWR channel 4: ESP32_RESET_ASSERT -> RESET_REQUEST; both heartbeat directions are isolated",
      bp123: "SCORING_NRST_N is scoring-local; EN_RESET has independent application-local supervision"
    })
  })

  it("keeps fail-closed outcomes distinct from scoring logic", () => {
    expect(processorFaultContainment.vocabulary).toMatchObject({
      glossaryRevision: "m0-02",
      safeInactive: "safeInactive",
      runtimeSafeInactive: "safe-inactive",
      safeStateMapping: "safeInactive -> safe-inactive",
      availabilityStates: ["available", "degraded", "unavailable"],
      scoringLogicOwner: "weapon-specific STM32 scorer"
    })
    expect(processorFaultContainment.faultOutcomes).toMatchObject({
      stm32Fault: "unavailable and safe-inactive with no scoring qualification or registration",
      esp32Fault: "degraded only when STM32 remains available",
      applicationServiceFault: "degraded only when STM32 remains available",
      malformedOrReplayedRequest: "reject without changing scoring state configuration outputs or reset ownership"
    })
    expect(processorFaultContainment.evidence).toMatchObject({
      contractEvidenceOnly: ["BP-120", "BP-121", "BP-122", "BP-123"],
      physicalResetIsolationBackpowerAndTimingProven: false,
      normalInput: "USB-C PD",
      labInput: "LAB_POST_EFUSE_20V test-only 20 V input",
      inputSourcesMutuallyExclusive: true
    })
  })

  it("rejects stale nets, reverse reset, relaxed availability, and evidence claims", () => {
    const staleNet = structuredClone(processorFaultContainment)
    replaceDataProperty(staleNet.nets, "stm32ResetAssert", "ESP32_RESET_ASSERT_ISOLATED")
    expect(() => validateProcessorFaultContainment(staleNet)).toThrow(RangeError)

    const reverseReset = structuredClone(processorFaultContainment)
    replaceDataProperty(reverseReset.resetPolicy, "forbiddenPeerReset", "ESP32 may reset STM32")
    expect(() => validateProcessorFaultContainment(reverseReset)).toThrow(RangeError)

    const relaxedFault = structuredClone(processorFaultContainment)
    replaceDataProperty(relaxedFault.faultOutcomes, "stm32Fault", "degraded")
    expect(() => validateProcessorFaultContainment(relaxedFault)).toThrow(RangeError)

    const releasedEvidence = structuredClone(processorFaultContainment)
    replaceDataProperty(releasedEvidence.evidence, "physicalResetIsolationBackpowerAndTimingProven", true)
    expect(() => validateProcessorFaultContainment(releasedEvidence)).toThrow(RangeError)
  })

  it("rejects aliases, accessors, and unreviewed source combinations", () => {
    const alias = structuredClone(processorFaultContainment)
    replaceDataProperty(alias.nets, "esp32Heartbeat", alias.nets.stm32Heartbeat)
    expect(() => validateProcessorFaultContainment(alias)).toThrow(RangeError)

    const accessor = structuredClone(processorFaultContainment)
    Object.defineProperty(accessor, "releaseState", { enumerable: true, get: () => "deny" })
    expect(() => validateProcessorFaultContainment(accessor)).toThrow(RangeError)

    const dualInput = structuredClone(processorFaultContainment)
    replaceDataProperty(dualInput.evidence, "inputSourcesMutuallyExclusive", false)
    expect(() => validateProcessorFaultContainment(dualInput)).toThrow(RangeError)
  })

  it("makes upstream BP-122 and BP-123 drift fail their own validators", () => {
    const isolationDrift = structuredClone(benchPrototypeIsolationChannel)
    const resetChannel = isolationDrift.isolators.main.channels.find((channel) => channel.channel === 4)
    if (resetChannel === undefined) throw new Error("BP-122 channel 4 is required for this test")
    replaceDataProperty(resetChannel.scoring, "net", "GPIO16")
    expect(() => validateBenchPrototypeIsolationChannel(isolationDrift)).toThrow(RangeError)

    const watchdogDrift = structuredClone(benchPrototypeResetWatchdog)
    replaceDataProperty(watchdogDrift.resetTopology.scoring, "resetNet", "EN_RESET")
    expect(() => validateBenchPrototypeResetWatchdog(watchdogDrift)).toThrow(RangeError)
  })
})
