import { describe, expect, it } from "vitest"
import {
  benchPrototypeProcessorSupport,
  validateBenchPrototypeProcessorSupport
} from "./bench-prototype-processor-support.js"

describe("BP-125 sole-ESP32 processor support", () => {
  it("binds the exact module and its five selected support rows", () => {
    expect(validateBenchPrototypeProcessorSupport(benchPrototypeProcessorSupport)).toBe(true)
    expect(benchPrototypeProcessorSupport.processor).toMatchObject({
      mpn: "ESP32-S3-WROOM-1-N16R2",
      radio: "disabled without a populated, reviewed external antenna"
    })
    expect(benchPrototypeProcessorSupport.selectedSupportRows).toEqual([
      expect.objectContaining({ reference: "R_ESP_BOOT_PULLUP", mpn: "RC0603FR-0710KL" }),
      expect.objectContaining({ reference: "R_ESP_EN_PULLUP", mpn: "RC0603FR-0710KL" }),
      expect.objectContaining({ reference: "C_ESP_EN_DELAY", mpn: "C1608X5R1A105K080AC" }),
      expect.objectContaining({ reference: "C_ESP_3V3_HF", mpn: "GCM188R71H104KA57D" }),
      expect.objectContaining({ reference: "C_ESP_3V3_BULK", mpn: "GCM32EC71A476KE02L" })
    ])
  })

  it("keeps P0 recovery, acquisition, IR, Ethernet, and HUB75 interfaces explicit", () => {
    expect(benchPrototypeProcessorSupport.recovery).toEqual({
      populatedHeader: false,
      testPads: ["UART0_RX", "UART0_TX", "BOOT_N", "EN_RESET", "APP_3V3", "APP_GND"],
      rule: expect.stringContaining("native USB")
    })
    expect(benchPrototypeProcessorSupport.nativeUsb.pins).toEqual(["GPIO19 USB_DN", "GPIO20 USB_DP"])
    expect(benchPrototypeProcessorSupport.fixedInterfaces).toMatchObject({
      acquisition: expect.stringContaining("SPI3_HOST plus GDMA"),
      ir: expect.stringContaining("GPIO35 IR_RX"),
      ethernet: expect.stringContaining("W5500"),
      primaryOutputs: expect.stringContaining("GPIO7, GPIO10, GPIO11, GPIO15, and GPIO17"),
      hub75: expect.stringContaining("blank")
    })
    expect(benchPrototypeProcessorSupport.restrictions.flash).toContain("No flash")
    expect(benchPrototypeProcessorSupport.restrictions.unusedPins).toContain("GPIO36")
  })

  it("rejects former dual-processor parts, substitutions, omissions, and release escalation", () => {
    const mutations: Array<(candidate: any) => void> = [
      (candidate) => (candidate.processor.mpn = "STM32G474RET3TR"),
      (candidate) => candidate.selectedSupportRows.pop(),
      (candidate) => (candidate.selectedSupportRows[2].mpn = "TBD"),
      (candidate) => (candidate.rejectedFromP0[0] = "STM32 permitted"),
      (candidate) => (candidate.fixedInterfaces.primaryOutputs = "serialized latch permitted"),
      (candidate) => (candidate.restrictions.flash = "Writes allowed while scoring"),
      (candidate) => (candidate.authority.fabricationAuthorized = true)
    ]
    for (const mutate of mutations) {
      const candidate = structuredClone(benchPrototypeProcessorSupport)
      mutate(candidate)
      expect(() => validateBenchPrototypeProcessorSupport(candidate)).toThrow(RangeError)
    }
  })

  it("is deeply frozen and rejects aliases and accessors before reading them", () => {
    expect(Object.isFrozen(benchPrototypeProcessorSupport)).toBe(true)
    expect(Object.isFrozen(benchPrototypeProcessorSupport.selectedSupportRows)).toBe(true)
    expect(Object.isFrozen(benchPrototypeProcessorSupport.selectedSupportRows[0])).toBe(true)
    const alias = structuredClone(benchPrototypeProcessorSupport) as any
    alias.bootAndReset = alias.restrictions
    expect(() => validateBenchPrototypeProcessorSupport(alias)).toThrow(RangeError)
    const accessor = structuredClone(benchPrototypeProcessorSupport) as any
    let read = false
    Object.defineProperty(accessor, "workUnit", {
      enumerable: true,
      get: () => {
        read = true
        return "BP-125"
      }
    })
    expect(() => validateBenchPrototypeProcessorSupport(accessor)).toThrow(RangeError)
    expect(read).toBe(false)
  })
})
