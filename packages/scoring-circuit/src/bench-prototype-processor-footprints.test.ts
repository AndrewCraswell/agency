import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  benchPrototypeProcessorFootprints,
  benchPrototypeProcessorFootprintsUpstreamProvenance,
  benchPrototypeProcessorFootprintsRetainedManufacturerSources,
  validateBenchPrototypeProcessorFootprints,
  validateBenchPrototypeProcessorFootprintsRetainedManufacturerSources,
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
        expect.objectContaining({
          reference: "U_ISO_POWER",
          mpn: "NXE1S0505MC",
          package:
            "Surface-mount 14-position package, 5 solder lands at positions 1, 3, 7, 8, 14; 4 functional connections, position 14 NA/no-connect"
        }),
        expect.objectContaining({ reference: "U_STM_SUPERVISOR", mpn: "TPS389033DSER" }),
        expect.objectContaining({ reference: "U_ESP_WATCHDOG", mpn: "TPS3431SDRBR" }),
        expect.objectContaining({ reference: "U_APP_RESET_FANOUT", mpn: "SN74LVC2G07DCKR" }),
        expect.objectContaining({ reference: "Q_ESP_DEBUG_RESET", mpn: "BSS138AKA" })
      ])
    )
    for (const record of benchPrototypeProcessorFootprints.populatedReferences) {
      expect(record.evidence).toMatchObject({
        manufacturerPrimarySourceMapping: expect.stringMatching(
          /^(?:source-unverified-primary-url-only|verified-by-retained-manufacturer-primary-bytes)$/u
        ),
        manufacturerPrimarySource: expect.objectContaining({
          manufacturer: expect.any(String),
          url: expect.stringMatching(/^https:\/\//u)
        })
      })
    }
    expect(benchPrototypeProcessorFootprints.clockReferences).toEqual([
      expect.objectContaining({ reference: "X_STM_HSE", population: "DNP", mpn: null }),
      expect.objectContaining({ reference: "X_STM_LSE", population: "DNP", mpn: null }),
      expect.objectContaining({ reference: "X_ESP32_MODULE", population: "module-integrated" })
    ])
  })

  it("reconciles every BP-125 support reference to its exact selection while retaining footprint DENY", () => {
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
    ).toHaveLength(0)
    expect(benchPrototypeProcessorFootprints.processorSupportReferences).toEqual(
      expect.arrayContaining([
        ...["C_STM_VDD16", "C_STM_VDD32", "C_STM_VDD48", "C_STM_VDD64"].map((reference) =>
          expect.objectContaining({
            reference,
            mpn: "GCM188R71H104KA57D",
            selectedMpn: "GCM188R71H104KA57D",
            package: "0603 (1608M)",
            reconciliation: "selected-by-BP-125"
          })
        ),
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
          mpn: "RC0603FR-0710KL",
          selectedMpn: "RC0603FR-0710KL",
          package: "0603",
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
          value: "22 uF minimum effective ceramic",
          mpn: "GCM32EC71A476KE02L",
          selectedMpn: "GCM32EC71A476KE02L",
          package: "1210 (3225M)",
          reconciliation: "selected-by-BP-125"
        }),
        expect.objectContaining({
          reference: "C_STM_3V3_BULK",
          mpn: "GCM32ER71E106KA57L",
          selectedMpn: "GCM32ER71E106KA57L",
          package: "1210 (3225M)"
        }),
        expect.objectContaining({
          reference: "C_STM_VDDA_HF",
          mpn: "GCM188R71H103KA37D",
          selectedMpn: "GCM188R71H103KA37D",
          package: "0603 (1608M)"
        }),
        ...["C_STM_VDDA_BULK", "C_STM_VREF_BULK"].map((reference) =>
          expect.objectContaining({
            reference,
            mpn: "GCM21BR71E225KA73L",
            selectedMpn: "GCM21BR71E225KA73L",
            package: "0805 (2012M)"
          })
        )
      ])
    )
    expect(
      benchPrototypeProcessorFootprints.processorSupportReferences.filter((entry) => entry.mpn === "GCM188R71H104KA57D")
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          evidence: expect.objectContaining({
            manufacturerPrimarySourceMapping: "source-unverified-primary-url-only",
            manufacturerPrimarySource: expect.objectContaining({ manufacturer: "Murata" }),
            retainedManufacturerPrimarySource: null
          })
        })
      ])
    )
    expect(
      benchPrototypeProcessorFootprints.processorSupportReferences.filter(
        (entry) => entry.reconciliation === "selected-by-BP-125"
      )
    ).toHaveLength(14)
    expect(
      benchPrototypeProcessorFootprints.processorSupportReferences.filter(
        (entry) => entry.reconciliation === "selected-by-BP-123"
      )
    ).toHaveLength(2)
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

  it("retains and hashes the exact bounded TI reset and Yageo resistor source batch", () => {
    const sources = benchPrototypeProcessorFootprintsRetainedManufacturerSources
    expect(sources).toHaveLength(4)
    expect(sources.map((source) => source.mpn)).toEqual([
      "TPS3431SDRBR",
      "TPS389033DSER",
      "RC0603FR-0710KL",
      "RC0603FR-07100KL"
    ])
    for (const source of sources) {
      const bytes = readFileSync(new URL(`../${source.artifactPath}`, import.meta.url))
      expect(createHash("sha256").update(bytes).digest("hex").toUpperCase()).toBe(source.sha256)
      expect(source.sourceUrl).toMatch(
        source.mpn.startsWith("RC0603FR-07", 0) ? /^https:\/\/www\.yageogroup\.com\//u : /^https:\/\/www\.ti\.com\//u
      )
      const row = [
        ...benchPrototypeProcessorFootprints.populatedReferences,
        ...benchPrototypeProcessorFootprints.processorSupportReferences
      ].find((candidate) => candidate.mpn === source.mpn)
      expect(row).toMatchObject({
        package: source.package,
        evidence: {
          manufacturerPrimarySourceMapping: "verified-by-retained-manufacturer-primary-bytes",
          retainedManufacturerPrimarySource: source
        }
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

  it("rejects retained-source omission, extra records, duplicate identities, and hash drift", () => {
    for (const mutate of [
      (candidate: any) => candidate.pop(),
      (candidate: any) => candidate.push(structuredClone(candidate[0])),
      (candidate: any) => (candidate[1].requestIdentity = candidate[0].requestIdentity),
      (candidate: any) => (candidate[0].mpn = "TPS389033DSER"),
      (candidate: any) => (candidate[0].sha256 = "0".repeat(64))
    ]) {
      const candidate = structuredClone(benchPrototypeProcessorFootprintsRetainedManufacturerSources)
      mutate(candidate)
      expect(() => validateBenchPrototypeProcessorFootprintsRetainedManufacturerSources(candidate)).toThrow(RangeError)
    }
  })
})
