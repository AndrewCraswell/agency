import { describe, expect, it } from "vitest"
import {
  benchPrototypeIrReceiverInterface,
  benchPrototypeIrReceiverUpstreamAllocation,
  validateBenchPrototypeIrReceiverInterface
} from "./bench-prototype-ir-receiver-interface.js"

describe("BP-126 encrypted-IR receiver interface", () => {
  it("selects the GPIO35 RMT interface while denying receiver hardware", () => {
    expect(validateBenchPrototypeIrReceiverInterface(benchPrototypeIrReceiverInterface)).toBe(true)
    expect(benchPrototypeIrReceiverInterface.releaseState).toBe("deny")
    expect(benchPrototypeIrReceiverInterface.decision).toBe("INTERFACE_SELECTED_HARDWARE_DENY")
    expect(benchPrototypeIrReceiverInterface.interfaceStatus).toBe("selected")
    expect(benchPrototypeIrReceiverInterface.receiverHardwareStatus).toBe("deny")
    expect(benchPrototypeIrReceiverInterface.candidateReview).toHaveLength(8)
    expect(benchPrototypeIrReceiverInterface.candidateReview).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          gpio: 35,
          currentSignal: "IR_RX",
          priorOwner: expect.stringContaining("I2S_BCLK"),
          disposition: "selected",
          proposedPeripheral: "RMT RX"
        }),
        expect.objectContaining({ gpio: "33,34", disposition: "deny" })
      ])
    )
    expect(benchPrototypeIrReceiverInterface.interface.requiredPeripheral).toContain("RMT RX")
    expect(benchPrototypeIrReceiverInterface.interface.genericI2cGpioExpander).toContain("denied")
  })

  it("protects every required BP-121 interface and records the exact tradeoffs", () => {
    expect(benchPrototypeIrReceiverInterface.protectedInterfaces).toEqual(
      expect.arrayContaining([
        expect.stringContaining("GPIO19/GPIO20"),
        expect.stringContaining("W5500"),
        expect.stringContaining("CY15B104Q"),
        expect.stringContaining("13 reset-safe HUB75"),
        expect.stringContaining("UART0_RX/UART0_TX/BOOT_N"),
        expect.stringContaining("APP_WD_KICK"),
        expect.stringContaining("ISO7762FDWR/ISO7721FDR")
      ])
    )
    expect(benchPrototypeIrReceiverInterface.requiredTradeoff.alternatives).toHaveLength(1)
    expect(benchPrototypeIrReceiverInterface.requiredTradeoff.cumulativeBp146Evidence).toHaveLength(5)
    expect(benchPrototypeIrReceiverInterface.requiredTradeoff.options).toHaveLength(1)
    expect(benchPrototypeIrReceiverInterface.requiredTradeoff.options[0]).toContain("cumulative evidence")
    expect(benchPrototypeIrReceiverInterface.requiredTradeoff.prohibitedShortcuts).toHaveLength(4)
  })

  it("keeps IR application-only and all completion evidence closed", () => {
    expect(benchPrototypeIrReceiverInterface.interface.applicationDomain).toBe("APP_GND")
    expect(benchPrototypeIrReceiverInterface.interface.authorityRule).toContain("never directly reaches STM32")
    expect(benchPrototypeIrReceiverInterface.evidence).toEqual({
      exactReceiverSelected: false,
      resetSafeElectricalInterfaceMeasured: false,
      pulseTimingMeasured: false,
      queueBoundsReviewed: false,
      faultIsolationReviewed: false,
      directScoringPath: false,
      fabricationAuthorized: false
    })
  })

  it("binds the selected interface to the exact BP-121 N16R2 allocation", () => {
    expect(benchPrototypeIrReceiverUpstreamAllocation).toMatchObject({
      task: "BP-121",
      moduleMpn: "ESP32-S3-WROOM-1-N16R2",
      pads: expect.arrayContaining([
        expect.objectContaining({ pad: 15, gpio: 3, signal: "NC_STRAP_QUIET" }),
        expect.objectContaining({ pad: 28, gpio: 35, signal: "IR_RX" }),
        expect.objectContaining({ pad: 29, gpio: 36, signal: "P0_SPARE_GPIO36", disposition: "reserved" }),
        expect.objectContaining({ pad: 30, gpio: 37, signal: "P0_SPARE_GPIO37", disposition: "reserved" }),
        expect.objectContaining({ pad: 13, gpio: 19, signal: "USB_DN" }),
        expect.objectContaining({ pad: 14, gpio: 20, signal: "USB_DP" })
      ])
    })
    expect(benchPrototypeIrReceiverInterface.upstream).toMatchObject({
      allocationTask: "BP-121",
      optionalPeripheralTask: "BP-145",
      audioDnpPolicy: {
        reference: "U_AUDIO",
        disposition: "DNP",
        interface: "DNP; no audio host routing; GPIO35 is reserved for BP-126 IR_RX/RMT_RX"
      }
    })
  })

  it("rejects substitutions, omissions, aliases, accessors, and evidence relaxation", () => {
    for (const mutate of [
      (candidate: any) => (candidate.decision = "SELECT"),
      (candidate: any) => (candidate.candidateReview[0].disposition = "candidate"),
      (candidate: any) => candidate.candidateReview.splice(1, 1),
      (candidate: any) => (candidate.requiredTradeoff.options[0] = "use GPIO3 directly"),
      (candidate: any) => (candidate.upstream.audioDnpPolicy.interface = "I2S_BCLK/I2S_WS/I2S_DOUT"),
      (candidate: any) => (candidate.evidence.pulseTimingMeasured = true),
      (candidate: any) => (candidate.protectedInterfaces[0] = "USB omitted")
    ]) {
      const candidate = structuredClone(benchPrototypeIrReceiverInterface)
      mutate(candidate)
      expect(() => validateBenchPrototypeIrReceiverInterface(candidate)).toThrow(RangeError)
    }

    expect(() => validateBenchPrototypeIrReceiverInterface(null)).toThrow(RangeError)
    expect(() =>
      validateBenchPrototypeIrReceiverInterface({ ...benchPrototypeIrReceiverInterface, extra: true })
    ).toThrow(RangeError)

    const alias = structuredClone(benchPrototypeIrReceiverInterface) as any
    alias.requiredTradeoff.prohibitedShortcuts = alias.requiredTradeoff.options
    expect(() => validateBenchPrototypeIrReceiverInterface(alias)).toThrow(RangeError)

    const accessor = structuredClone(benchPrototypeIrReceiverInterface) as any
    let read = false
    Object.defineProperty(accessor, "decision", {
      enumerable: true,
      get: () => {
        read = true
        return "DENY"
      }
    })
    expect(() => validateBenchPrototypeIrReceiverInterface(accessor)).toThrow(RangeError)
    expect(read).toBe(false)
  })

  it("deep-freezes the canonical interface decision and upstream snapshot", () => {
    expect(Object.isFrozen(benchPrototypeIrReceiverInterface)).toBe(true)
    expect(Object.isFrozen(benchPrototypeIrReceiverInterface.candidateReview)).toBe(true)
    expect(Object.isFrozen(benchPrototypeIrReceiverInterface.candidateReview[0])).toBe(true)
    expect(Object.isFrozen(benchPrototypeIrReceiverUpstreamAllocation)).toBe(true)
  })
})
