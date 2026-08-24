import { describe, expect, it } from "vitest"
import {
  benchPrototypeProcessorFootprints,
  benchPrototypeProcessorFootprintsUpstreamProvenance,
  validateBenchPrototypeProcessorFootprints,
  validateBenchPrototypeProcessorFootprintsUpstreamProvenance
} from "./bench-prototype-processor-footprints.js"

describe("BP-032 processor and isolation footprint closure ledger", () => {
  it("covers each selected processor, isolator, reset-support reference, and DNP clock decision", () => {
    expect(validateBenchPrototypeProcessorFootprints(benchPrototypeProcessorFootprints)).toBe(true)
    expect(benchPrototypeProcessorFootprints.populatedReferences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reference: "U_SCORING", mpn: "STM32G474RET3TR", package: "LQFP-64" }),
        expect.objectContaining({ reference: "U_APP", mpn: "ESP32-S3-WROOM-1U-N16R2" }),
        expect.objectContaining({ reference: "U_ISO_MAIN", mpn: "ISO7762FDWR" }),
        expect.objectContaining({ reference: "U_ISO_AUX", mpn: "ISO7721FDR" }),
        expect.objectContaining({ reference: "U_ISO_POWER", mpn: "NXE1S0505MC" }),
        expect.objectContaining({ reference: "U_STM_SUPERVISOR", mpn: "TPS389033DSER" }),
        expect.objectContaining({ reference: "U_ESP_WATCHDOG", mpn: "TPS3431SDRBR" }),
        expect.objectContaining({ reference: "U_APP_RESET_FANOUT", mpn: "SN74LVC2G07DCKR" }),
        expect.objectContaining({ reference: "Q_ESP_DEBUG_RESET", mpn: "BSS138AKA" })
      ])
    )
    expect(benchPrototypeProcessorFootprints.clockReferences).toEqual([
      expect.objectContaining({ reference: "X_STM_HSE", population: "DNP", mpn: null }),
      expect.objectContaining({ reference: "X_STM_LSE", population: "DNP", mpn: null }),
      expect.objectContaining({ reference: "X_ESP32_MODULE", population: "module-integrated" })
    ])
  })

  it("reconciles the complete BP-125 support-reference contract and keeps unresolved parts DNP", () => {
    expect(benchPrototypeProcessorFootprints.debugReferences).toEqual([
      expect.objectContaining({
        reference: "J_STM_SWD",
        mpn: "FTSH-105-01-L-DV-007-K",
        population: "DNP-until-footprint-and-mating-evidence"
      }),
      expect.objectContaining({
        reference: "J_ESP_SERVICE",
        mpn: "TSW-106-07-G-S",
        population: "DNP-until-footprint-and-mating-evidence"
      })
    ])
    expect(benchPrototypeProcessorFootprints.processorSupportReferences).toHaveLength(16)
    expect(
      benchPrototypeProcessorFootprints.processorSupportReferences.filter(
        (entry) => entry.reconciliation === "DNP-until-exact-selection"
      )
    ).toHaveLength(12)
    expect(benchPrototypeProcessorFootprints.processorSupportReferences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reference: "R_STM_BOOT0",
          mpn: "RC0603FR-0710KL",
          selectedMpn: "RC0603FR-0710KL",
          package: "0603",
          reconciliation: "selected-by-BP-125"
        }),
        expect.objectContaining({
          reference: "R_ESP_BOOT_PULLUP",
          mpn: "RC0603FR-0710KL",
          selectedMpn: "RC0603FR-0710KL",
          package: "0603",
          reconciliation: "selected-by-BP-125"
        }),
        expect.objectContaining({
          reference: "R_ESP_EN_PULLUP",
          mpn: "TBD",
          selectedMpn: "RC0603FR-0710KL",
          reconciliation: "selected-by-BP-123"
        }),
        expect.objectContaining({
          reference: "C_ESP_EN_DELAY",
          mpn: "TBD",
          selectedMpn: "C1608X5R1A105K080AC",
          reconciliation: "selected-by-BP-123"
        }),
        expect.objectContaining({
          reference: "C_ESP_3V3_BULK",
          value: "22 uF minimum ceramic",
          selectedMpn: null,
          reconciliation: "DNP-until-exact-selection"
        })
      ])
    )
    for (const record of [
      ...benchPrototypeProcessorFootprints.populatedReferences,
      ...benchPrototypeProcessorFootprints.debugReferences
    ]) {
      expect(record.evidence).toMatchObject({
        manufacturerDrawing: "required-not-acquired",
        manufacturerCad: "required-not-acquired",
        copper: "not-claimed",
        solderMask: "not-claimed",
        paste: "not-claimed",
        courtyard: "not-claimed",
        artwork: "not-generated",
        orientation: "unreviewed"
      })
    }
  })

  it("rejects substitutions, premature artwork, clock population, and release escalation", () => {
    for (const mutate of [
      (candidate: any) => (candidate.populatedReferences[0].mpn = "STM32G474RBT3TR"),
      (candidate: any) => (candidate.populatedReferences[2].evidence.copper = "claimed"),
      (candidate: any) => (candidate.clockReferences[0].population = "selected"),
      (candidate: any) => (candidate.processorSupportReferences[0].selectedMpn = "FORGED"),
      (candidate: any) => (candidate.evidence.fabricationAuthorized = true)
    ]) {
      const candidate = structuredClone(benchPrototypeProcessorFootprints)
      mutate(candidate)
      expect(() => validateBenchPrototypeProcessorFootprints(candidate)).toThrow(RangeError)
    }
  })

  it("rejects BP-030 release changes and BP-125 reference additions or changes", () => {
    for (const mutate of [
      (candidate: any) => (candidate.footprintMethod.releaseState = "allow"),
      (candidate: any) => (candidate.footprintMethod.fabricationRelease = true),
      (candidate: any) => (candidate.processorSupportReferences[0].value = "FORGED"),
      (candidate: any) =>
        candidate.processorSupportReferences.push({
          reference: "C_FORGED",
          mpn: "TBD",
          value: "100 nF",
          population: "required",
          section: "forged"
        })
    ]) {
      const candidate = structuredClone(benchPrototypeProcessorFootprintsUpstreamProvenance)
      mutate(candidate)
      expect(() => validateBenchPrototypeProcessorFootprintsUpstreamProvenance(candidate)).toThrow(RangeError)
    }
  })
})
