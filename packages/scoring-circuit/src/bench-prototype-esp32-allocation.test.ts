import { describe, expect, it } from "vitest"
import {
  benchPrototypeEsp32Allocation,
  validateBenchPrototypeEsp32Allocation
} from "./bench-prototype-esp32-allocation.js"

describe("BP-121 ESP32-S3 module-pad allocation", () => {
  it("covers every physical module pad exactly once and uses no GPIO twice", () => {
    expect(validateBenchPrototypeEsp32Allocation(benchPrototypeEsp32Allocation)).toBe(true)
    expect(benchPrototypeEsp32Allocation.pads).toHaveLength(41)
    expect(benchPrototypeEsp32Allocation.pads.map(({ pad }) => pad)).toEqual(
      Array.from({ length: 41 }, (_, index) => index + 1)
    )
    const gpios = benchPrototypeEsp32Allocation.pads.flatMap((pad) => ("gpio" in pad ? [pad.gpio] : []))
    expect(new Set(gpios).size).toBe(gpios.length)
  })

  it("keeps isolated SPI separate from W5500 and F-RAM SPI", () => {
    const signalsFor = (group: string) =>
      benchPrototypeEsp32Allocation.pads.filter((pad) => pad.group === group).map((pad) => pad.signal)
    expect(signalsFor("isolated-spi")).toEqual(["SCORE_SCK", "SCORE_MOSI", "SCORE_MISO", "SCORE_CS_N"])
    expect(signalsFor("app-spi")).toEqual(["APP_SPI_SCK", "APP_SPI_MOSI", "APP_SPI_MISO", "FRAM_CS_N", "ETH_CS_N"])
    expect(benchPrototypeEsp32Allocation.unavailableResources.w5500Interrupt).toContain("polled")
  })

  it("fixes the protected native USB2 pair and independent UART recovery", () => {
    expect(benchPrototypeEsp32Allocation.pads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ gpio: 19, signal: "USB_DN" }),
        expect.objectContaining({ gpio: 20, signal: "USB_DP" }),
        expect.objectContaining({ gpio: 44, signal: "UART0_RX" }),
        expect.objectContaining({ gpio: 43, signal: "UART0_TX" }),
        expect.objectContaining({ gpio: 0, signal: "BOOT_N" })
      ])
    )
    expect(benchPrototypeEsp32Allocation.usbService).toMatchObject({
      protector: "TPD2EUSB30DRTR",
      ccSbuProtectorExcludedFromDataPair: "TPD4S201TRGRRQ1",
      seriesResistanceOhmPerLine: 22,
      seriesResistorCount: 2,
      matchedPairRequired: true
    })
    expect(benchPrototypeEsp32Allocation.recovery.resetRule).toContain("must not directly drive EN_RESET")
  })

  it("allocates all 13 HUB75 signals while preserving strap and reset-safe defaults", () => {
    const displayPads = benchPrototypeEsp32Allocation.pads.filter((pad) => pad.group === "hub75")
    expect(displayPads).toHaveLength(13)
    expect(displayPads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ gpio: 45, signal: "HUB75_D" }),
        expect.objectContaining({ gpio: 46, signal: "HUB75_CLK" }),
        expect.objectContaining({ gpio: 1, signal: "HUB75_OE_N" })
      ])
    )
    expect(benchPrototypeEsp32Allocation.resetSafety.strapRules).toContain(
      "GPIO45 and GPIO46 retain weak pull-downs and see high-impedance AHCT inputs during reset"
    )
    expect(benchPrototypeEsp32Allocation.resetSafety.inactivePullUpSignals).toContain("HUB75_OE_N")
  })

  it("retains I2C, I2S, watchdog, heartbeat, NC, and unavailable-pad dispositions", () => {
    expect(benchPrototypeEsp32Allocation.pads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ gpio: 10, signal: "I2C_SDA" }),
        expect.objectContaining({ gpio: 11, signal: "I2C_SCL" }),
        expect.objectContaining({ gpio: 12, signal: "APP_WD_KICK" }),
        expect.objectContaining({ gpio: 35, signal: "I2S_BCLK" }),
        expect.objectContaining({ gpio: 36, signal: "I2S_WS" }),
        expect.objectContaining({ gpio: 37, signal: "I2S_DOUT" }),
        expect.objectContaining({ gpio: 3, disposition: "reserved-nc", signal: "NC_STRAP_QUIET" })
      ])
    )
    expect(benchPrototypeEsp32Allocation.unavailableResources.internalFlashPsramGpios).toEqual([
      26, 27, 28, 29, 30, 31, 32
    ])
    expect(benchPrototypeEsp32Allocation.unavailableResources.rawExpansionGpios).toEqual([])
  })

  it("fails closed on substitutions, omissions, extras, aliases, accessors, and reused GPIOs", () => {
    for (const mutate of [
      (candidate: any) => (candidate.moduleMpn = "ESP32-S3-WROOM-1U-N16R8"),
      (candidate: any) => candidate.pads.splice(12, 1),
      (candidate: any) => (candidate.pads[13].gpio = 19),
      (candidate: any) => (candidate.usbService.seriesResistorCount = 4),
      (candidate: any) => (candidate.unavailableResources.rawExpansionGpios = [3])
    ]) {
      const candidate = structuredClone(benchPrototypeEsp32Allocation)
      mutate(candidate)
      expect(() => validateBenchPrototypeEsp32Allocation(candidate)).toThrow(RangeError)
    }

    expect(() => validateBenchPrototypeEsp32Allocation(null)).toThrow(RangeError)
    expect(() => validateBenchPrototypeEsp32Allocation({ ...benchPrototypeEsp32Allocation, extra: true })).toThrow(
      RangeError
    )

    const alias = structuredClone(benchPrototypeEsp32Allocation)
    Reflect.set(alias.pads, "1", alias.pads[0])
    expect(() => validateBenchPrototypeEsp32Allocation(alias)).toThrow(RangeError)

    const accessor = structuredClone(benchPrototypeEsp32Allocation)
    let read = false
    Object.defineProperty(accessor, "moduleMpn", {
      enumerable: true,
      get: () => {
        read = true
        return "ESP32-S3-WROOM-1U-N16R2"
      }
    })
    expect(() => validateBenchPrototypeEsp32Allocation(accessor)).toThrow(RangeError)
    expect(read).toBe(false)
  })

  it("deep-freezes the canonical allocation", () => {
    expect(Object.isFrozen(benchPrototypeEsp32Allocation)).toBe(true)
    expect(Object.isFrozen(benchPrototypeEsp32Allocation.pads)).toBe(true)
    expect(Object.isFrozen(benchPrototypeEsp32Allocation.pads[0])).toBe(true)
  })
})
