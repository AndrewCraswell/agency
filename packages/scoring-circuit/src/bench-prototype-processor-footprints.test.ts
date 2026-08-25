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

  it("retains and hashes the exact bounded TI reset, TDK capacitor, and Yageo resistor source batch", () => {
    const sources = benchPrototypeProcessorFootprintsRetainedManufacturerSources
    expect(sources).toHaveLength(5)
    expect(sources.map((source) => source.mpn)).toEqual([
      "TPS3431SDRBR",
      "TPS389033DSER",
      "C1608X5R1A105K080AC",
      "RC0603FR-0710KL",
      "RC0603FR-07100KL"
    ])
    for (const source of sources) {
      const bytes = readFileSync(new URL(`../${source.artifactPath}`, import.meta.url))
      expect(createHash("sha256").update(bytes).digest("hex").toUpperCase()).toBe(source.sha256)
      expect(source.sourceUrl).toMatch(
        source.mpn.startsWith("RC0603FR-07", 0)
          ? /^https:\/\/www\.yageogroup\.com\//u
          : source.mpn === "C1608X5R1A105K080AC"
            ? /^https:\/\/product\.tdk\.cn\//u
            : /^https:\/\/www\.ti\.com\//u
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
    const tdkRow = benchPrototypeProcessorFootprints.processorSupportReferences.find(
      (candidate) => candidate.reference === "C_ESP_EN_DELAY"
    )
    expect(tdkRow).toMatchObject({
      selectedMpn: "C1608X5R1A105K080AC",
      package: "0603",
      evidence: {
        footprintEvidence: expect.objectContaining({
          exactMpn: "C1608X5R1A105K080AC",
          reference: "C_ESP_EN_DELAY",
          projectFootprintId: "tdk-c1608-c1608x5r1a105k080ac-project-review",
          releaseState: "deny",
          fabricationAuthority: "deny",
          accepted: false
        })
      }
    })
  })

  it("binds the eight BP-123 KEMET 100 nF rows to review-only footprint evidence", () => {
    const references = [
      "C_STM_SUPERVISOR_CT",
      "C_STM_SUPERVISOR_BYPASS",
      "C_STM_WD_BYPASS",
      "C_STM_NRST_FILTER",
      "C_ESP_SUPERVISOR_CT",
      "C_ESP_SUPERVISOR_BYPASS",
      "C_ESP_WD_BYPASS",
      "C_APP_RESET_FANOUT_BYPASS"
    ]
    const rows = benchPrototypeProcessorFootprints.populatedReferences.filter((entry) =>
      references.includes(entry.reference)
    )

    expect(rows.map((entry) => entry.reference).sort()).toEqual([...references].sort())
    for (const row of rows) {
      expect(row).toMatchObject({ mpn: "C0603C104K3RACTU", package: "0603" })
      expect(row.evidence.footprintEvidence).toMatchObject({
        artifactKind: "bp031-032-c0603c104k3ractu-footprint-evidence",
        exactMpn: "C0603C104K3RACTU",
        reference: row.reference,
        sourceId: "yageo-kemet-c0603c104k3ractu-datasheet",
        upstreamContract: "BP-123",
        sourceArtifactPath: "packages/scoring-circuit/docs/evidence/m4-04/yageo-c0603c104k3ractu-datasheet.pdf",
        projectFootprintId: "c0603c104k3ractu-project-review",
        manufacturerCad: "not-acquired",
        manufacturerLandPattern: "not-published",
        artwork: "generated-project-review-only",
        orientation: "pending-independent-review",
        releaseState: "deny",
        fabricationAuthority: "deny",
        accepted: false
      })
    }
  })

  it("binds all 12 BP-125 Murata processor-support rows to review-only footprint evidence", () => {
    const rows = benchPrototypeProcessorFootprints.processorSupportReferences.filter((entry) =>
      entry.mpn.startsWith("GCM")
    )
    expect(rows).toHaveLength(12)
    for (const row of rows) {
      expect(row.evidence.footprintEvidence).toMatchObject({
        artifactKind: "bp125-murata-mlcc-candidate-footprint",
        exactMpn: row.mpn,
        reference: row.reference,
        upstreamContract: "BP-125",
        manufacturerCad: "not-acquired",
        manufacturerLandPattern: "common-gc-family-package-code",
        orientation: "pending-layout-review",
        releaseState: "deny",
        fabricationAuthority: "deny",
        accepted: false
      })
    }
  })

  it("binds both BP-122 isolators to review-only exact-package footprint evidence", () => {
    for (const reference of ["U_ISO_MAIN", "U_ISO_AUX"]) {
      const row = benchPrototypeProcessorFootprints.populatedReferences.find((entry) => entry.reference === reference)
      expect(row?.evidence.footprintEvidence).toMatchObject({
        artifactKind: "bp032-ti-isolator-footprint-evidence",
        exactMpn: row?.mpn,
        reference,
        upstreamContract: "BP-122",
        manufacturerCad: "not-acquired",
        manufacturerLandPattern: "manufacturer-example-not-cad",
        orientation: "pending-layout-review",
        releaseState: "deny",
        fabricationAuthority: "deny",
        accepted: false
      })
    }
  })

  it("binds U_SCORING to the exact STM32 LQFP64 review candidate", () => {
    const row = benchPrototypeProcessorFootprints.populatedReferences.find((entry) => entry.reference === "U_SCORING")
    expect(row?.evidence.footprintEvidence).toMatchObject({
      artifactKind: "bp032-stm32g474ret3tr-lqfp64-project-footprint-evidence",
      exactMpn: "STM32G474RET3TR",
      reference: "U_SCORING",
      upstreamContract: "BP-120/BP-125",
      manufacturerCad: "not-acquired",
      orientation: "pending-independent-review",
      releaseState: "deny",
      fabricationAuthority: "deny",
      accepted: false
    })
  })

  it("binds U_APP to the exact ESP32-S3-WROOM-1U-N16R2 review candidate", () => {
    const row = benchPrototypeProcessorFootprints.populatedReferences.find((entry) => entry.reference === "U_APP")
    expect(row?.evidence.footprintEvidence).toMatchObject({
      artifactKind: "bp032-esp32-s3-wroom-1u-exact-project-footprint-candidate",
      exactMpn: "ESP32-S3-WROOM-1U-N16R2",
      reference: "U_APP",
      upstreamContract: "BP-121/BP-125",
      manufacturerCad: "deny",
      orientation: "pending",
      releaseState: "deny",
      fabricationAuthority: "deny",
      accepted: false
    })
  })

  it("binds the reset-support and keyed SWD rows to review-only evidence", () => {
    for (const reference of ["U_APP_RESET_FANOUT", "Q_ESP_RESET_STM", "Q_ESP_DEBUG_RESET"]) {
      const row = benchPrototypeProcessorFootprints.populatedReferences.find((entry) => entry.reference === reference)
      expect(row?.evidence.footprintEvidence).toMatchObject({
        exactMpn: row?.mpn,
        reference,
        upstreamContract: "BP-123",
        releaseState: "deny",
        fabricationAuthority: "deny",
        accepted: false
      })
    }

    for (const reference of ["U_STM_SUPERVISOR", "U_ESP_SUPERVISOR", "U_STM_WATCHDOG", "U_ESP_WATCHDOG"]) {
      const row = benchPrototypeProcessorFootprints.populatedReferences.find((entry) => entry.reference === reference)
      expect(row?.evidence.footprintEvidence).toMatchObject({
        exactMpn: row?.mpn,
        reference,
        upstreamContract: "BP-123",
        releaseState: "deny",
        fabricationAuthority: "deny",
        accepted: false
      })
    }

    const swd = benchPrototypeProcessorFootprints.debugReferences.find((entry) => entry.reference === "J_STM_SWD")
    expect(swd?.evidence.footprintEvidence).toMatchObject({
      exactMpn: "FTSH-105-01-L-DV-007-K",
      reference: "J_STM_SWD",
      upstreamContract: "BP-124",
      releaseState: "deny",
      fabricationAuthority: "deny",
      accepted: false
    })

    const espService = benchPrototypeProcessorFootprints.debugReferences.find(
      (entry) => entry.reference === "J_ESP_SERVICE"
    )
    expect(espService?.evidence.footprintEvidence).toMatchObject({
      artifactKind: "bp032-esp32-service-header-tsw-106-07-g-s-footprint-evidence",
      exactMpn: "TSW-106-07-G-S",
      reference: "J_ESP_SERVICE",
      upstreamContract: "BP-124",
      manufacturerCad: "deny",
      orientation: "orientation-candidate-pending-independent-overlay",
      releaseState: "deny",
      fabricationAuthority: "deny",
      accepted: false
    })
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
