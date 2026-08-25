import { describe, expect, it } from "vitest"
import {
  benchPrototypeEsp32Allocation,
  validateBenchPrototypeEsp32Allocation
} from "./bench-prototype-esp32-allocation.js"

describe("BP-121 sole-ESP32 P0 allocation", () => {
  it("covers all module pads with no GPIO reuse", () => {
    expect(validateBenchPrototypeEsp32Allocation(benchPrototypeEsp32Allocation)).toBe(true)
    expect(benchPrototypeEsp32Allocation.pads.map(({ pad }) => pad)).toEqual(
      Array.from({ length: 41 }, (_, index) => index + 1)
    )
    const gpios = benchPrototypeEsp32Allocation.pads.flatMap((pad) => ("gpio" in pad ? [pad.gpio] : []))
    expect(new Set(gpios).size).toBe(gpios.length)
  })

  it("allocates dedicated ADC timing and direct primary outputs", () => {
    expect(benchPrototypeEsp32Allocation.scoringAdc).toMatchObject({
      converter: "seven ADS8881 devices in daisy-chain mode",
      gpio: [4, 5, 6],
      comparatorInputs: 0
    })
    expect(benchPrototypeEsp32Allocation.primaryOutputs).toMatchObject({
      signals: ["LAMP_RED", "LAMP_GREEN", "LAMP_WHITE_LEFT", "LAMP_WHITE_RIGHT", "BUZZER"],
      gpio: [7, 15, 17, 10, 11]
    })
    expect(benchPrototypeEsp32Allocation.peripheralInstances).toMatchObject({
      scoringAdc: "SPI3_HOST plus GDMA",
      applicationBus: "SPI2_HOST shared by W5500 and the write-only source-control register",
      ir: "RMT RX on GPIO35"
    })
  })

  it("preserves Ethernet, HUB75, USB, IR, recovery, watchdog, and one spare GPIO", () => {
    expect(benchPrototypeEsp32Allocation.pads.filter((pad) => pad.group === "hub75")).toHaveLength(13)
    expect(benchPrototypeEsp32Allocation.pads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ gpio: 2, signal: "ETH_CS_N" }),
        expect.objectContaining({ gpio: 19, signal: "USB_DN" }),
        expect.objectContaining({ gpio: 20, signal: "USB_DP" }),
        expect.objectContaining({ gpio: 35, signal: "IR_RX" }),
        expect.objectContaining({ gpio: 12, signal: "APP_WD_KICK" }),
        expect.objectContaining({ gpio: 47, signal: "SOURCE_LATCH" }),
        expect.objectContaining({ gpio: 36, signal: "SOURCE_OE_N" })
      ])
    )
    expect(benchPrototypeEsp32Allocation.unavailableResources.rawExpansionGpios).toEqual([37])
    expect(benchPrototypeEsp32Allocation.recovery.populatedHeader).toBe(false)
  })

  it.each([
    ["ADC GPIO", (copy: typeof benchPrototypeEsp32Allocation) => Reflect.set(copy.scoringAdc.gpio, "0", 7)],
    ["IR", (copy: typeof benchPrototypeEsp32Allocation) => Reflect.set(copy.irReceiver, "gpio", 36)],
    ["header", (copy: typeof benchPrototypeEsp32Allocation) => Reflect.set(copy.recovery, "populatedHeader", true)],
    ["reused GPIO", (copy: typeof benchPrototypeEsp32Allocation) => Reflect.set(copy.pads[4], "gpio", 4)]
  ])("rejects changed %s", (_name, mutate) => {
    const copy = structuredClone(benchPrototypeEsp32Allocation)
    mutate(copy)
    expect(() => validateBenchPrototypeEsp32Allocation(copy)).toThrow(RangeError)
  })

  it("rejects malformed and aliased graphs", () => {
    expect(() => validateBenchPrototypeEsp32Allocation(null)).toThrow(RangeError)
    const alias = structuredClone(benchPrototypeEsp32Allocation)
    Reflect.set(alias.pads, "1", alias.pads[0])
    expect(() => validateBenchPrototypeEsp32Allocation(alias)).toThrow(RangeError)
  })
})
