import { describe, expect, it } from "vitest"
import {
  benchPrototypeProcessorFootprints,
  benchPrototypeProcessorFootprintsRetainedManufacturerSources,
  validateBenchPrototypeProcessorFootprints,
  validateBenchPrototypeProcessorFootprintsRetainedManufacturerSources,
  validateBenchPrototypeProcessorFootprintsUpstreamProvenance
} from "./bench-prototype-processor-footprints.js"

describe("BP-032 sole-ESP32 processor footprint ledger", () => {
  it("retains the exact ESP32 module and the five selected support rows", () => {
    expect(validateBenchPrototypeProcessorFootprints(benchPrototypeProcessorFootprints)).toBe(true)
    expect(benchPrototypeProcessorFootprints.populatedReferences).toEqual([
      expect.objectContaining({ reference: "U_APP", mpn: "ESP32-S3-WROOM-1U-N16R2" })
    ])
    expect(benchPrototypeProcessorFootprints.processorSupportReferences).toEqual([
      expect.objectContaining({ reference: "R_ESP_BOOT_PULLUP", mpn: "RC0603FR-0710KL", package: "0603" }),
      expect.objectContaining({ reference: "R_ESP_EN_PULLUP", mpn: "RC0603FR-0710KL", package: "0603" }),
      expect.objectContaining({ reference: "C_ESP_EN_DELAY", mpn: "C1608X5R1A105K080AC", package: "0603" }),
      expect.objectContaining({ reference: "C_ESP_3V3_HF", mpn: "GCM188R71H104KA57D", package: "0603" }),
      expect.objectContaining({ reference: "C_ESP_3V3_BULK", mpn: "GCM32EC71A476KE02L", package: "1210" })
    ])
  })

  it("keeps exact Espressif source and CAD records as candidate evidence only", () => {
    expect(
      validateBenchPrototypeProcessorFootprintsRetainedManufacturerSources(
        benchPrototypeProcessorFootprintsRetainedManufacturerSources
      )
    ).toBe(true)
    expect(benchPrototypeProcessorFootprintsRetainedManufacturerSources.map((source) => source.authority)).toEqual([
      "manufacturer-primary",
      "manufacturer-primary",
      "manufacturer-primary"
    ])
    expect(benchPrototypeProcessorFootprints.populatedReferences[0]?.evidence).toMatchObject({
      candidateGeometry: { perimeterPads: 40, exposedGroundPad: 41, exposedGroundVias: 9, state: "candidate-only" },
      fabricationAuthority: "deny",
      accepted: false
    })
  })

  it("rejects stale processor additions and release escalation", () => {
    const stale = structuredClone(benchPrototypeProcessorFootprints)
    stale.populatedReferences.push({
      reference: "U_STM32",
      mpn: "STM32G474RET3TR",
      package: "LQFP64",
      population: "selected-awaiting-independent-layout-review",
      evidence: stale.populatedReferences[0]!.evidence
    })
    expect(() => validateBenchPrototypeProcessorFootprints(stale)).toThrow(RangeError)

    const released = structuredClone(benchPrototypeProcessorFootprints)
    released.evidence.fabricationAuthorized = true
    expect(() => validateBenchPrototypeProcessorFootprints(released)).toThrow(RangeError)
  })

  it("rejects support-provenance drift", () => {
    expect(() =>
      validateBenchPrototypeProcessorFootprintsUpstreamProvenance({
        esp32ModuleMpn: "FORGED",
        supportReferences: []
      })
    ).toThrow(RangeError)
  })
})
