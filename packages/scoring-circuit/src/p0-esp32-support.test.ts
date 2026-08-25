import { describe, expect, it } from "vitest"
import { p0Esp32Support, validateP0Esp32Support } from "./p0-esp32-support.js"

describe("BP-120 P0 ESP32-S3-WROOM-1-N16R2 support reconciliation", () => {
  it("binds the integrated-antenna module, exact bypass, EN, and watchdog policy", () => {
    expect(validateP0Esp32Support(p0Esp32Support)).toBe(true)
    expect(p0Esp32Support.module).toMatchObject({
      exactMpn: "ESP32-S3-WROOM-1-N16R2",
      antenna: "integrated on-module PCB antenna"
    })
    expect(p0Esp32Support.bypass.parts).toEqual([
      expect.objectContaining({ reference: "C_ESP_3V3_HF", mpn: "GCM188R71H104KA57D", value: "100 nF X7R" }),
      expect.objectContaining({ reference: "C_ESP_3V3_BULK", mpn: "GCM32EC71A476KE02L", value: "47 uF X7S nominal" })
    ])
    expect(p0Esp32Support.bootAndReset.enable.resetSources).toContain("open-drain")
    expect(p0Esp32Support.watchdog).toMatchObject({
      signal: "APP_WD_KICK on pad 20 GPIO12",
      cadence: "maximum 100 ms between valid falling-edge kicks",
      timeoutAndResetPulse: "170 ms to 230 ms"
    })
  })

  it("keeps both recovery paths and every module-pad disposition explicit", () => {
    expect(p0Esp32Support.nativeUsb.signals).toEqual(["pad 13 GPIO19 USB_DN", "pad 14 GPIO20 USB_DP"])
    expect(p0Esp32Support.uartRecovery).toMatchObject({
      signals: ["pad 36 GPIO44 UART0_RX", "pad 37 GPIO43 UART0_TX"],
      testPads: ["UART0_RX", "UART0_TX", "BOOT_N", "EN_RESET", "APP_3V3", "APP_GND"]
    })
    expect(p0Esp32Support.modulePadPolicy).toHaveLength(41)
    expect(p0Esp32Support.modulePadPolicy.map((pad) => pad.pad)).toEqual(
      Array.from({ length: 41 }, (_, index) => index + 1)
    )
    expect(p0Esp32Support.unavailableResources).toMatchObject({
      reservedSparePads: [29, 30, 24],
      reservedSpareGpios: [36, 37, 47]
    })
  })

  it("rejects stale module, unsafe recovery, pad, and release changes", () => {
    const mutations: Array<(candidate: any) => void> = [
      (candidate) => (candidate.module.exactMpn = "ESP32-S3-WROOM-1U-N16R2"),
      (candidate) => (candidate.module.antenna = "external antenna connector"),
      (candidate) => (candidate.bypass.parts[0].value = "10 uF"),
      (candidate) => (candidate.bootAndReset.enable.resetSources = "active high reset permitted"),
      (candidate) => (candidate.uartRecovery.testPads[4] = "fixture power"),
      (candidate) => candidate.modulePadPolicy.pop(),
      (candidate) => (candidate.authority.fabricationAuthorized = true)
    ]
    for (const mutate of mutations) {
      const candidate = structuredClone(p0Esp32Support)
      mutate(candidate)
      expect(() => validateP0Esp32Support(candidate)).toThrow(RangeError)
    }
  })

  it("is deeply frozen and rejects aliases and accessors before reading them", () => {
    expect(Object.isFrozen(p0Esp32Support)).toBe(true)
    expect(Object.isFrozen(p0Esp32Support.modulePadPolicy)).toBe(true)
    const alias = structuredClone(p0Esp32Support) as any
    alias.nativeUsb = alias.uartRecovery
    expect(() => validateP0Esp32Support(alias)).toThrow(RangeError)
    const accessor = structuredClone(p0Esp32Support) as any
    let read = false
    Object.defineProperty(accessor, "workUnit", {
      enumerable: true,
      get: () => {
        read = true
        return "BP-120"
      }
    })
    expect(() => validateP0Esp32Support(accessor)).toThrow(RangeError)
    expect(read).toBe(false)
  })
})
