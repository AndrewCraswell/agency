import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  benchPrototypeApplicationFootprints,
  validateBenchPrototypeApplicationFootprints
} from "./bench-prototype-application-footprints.js"

describe("BP-033 application footprint closure ledger", () => {
  it("reconciles all selected identities but never creates footprint or fabrication credit", () => {
    expect(validateBenchPrototypeApplicationFootprints(benchPrototypeApplicationFootprints)).toBe(true)
    expect(benchPrototypeApplicationFootprints.releaseState).toBe("deny")
    expect(benchPrototypeApplicationFootprints.records.length).toBeGreaterThan(50)
    expect(benchPrototypeApplicationFootprints.records.every((record) => record.population === "DNP-unresolved")).toBe(
      true
    )
    expect(benchPrototypeApplicationFootprints.records.every((record) => record.manufacturer && record.mpn)).toBe(true)
    expect(
      benchPrototypeApplicationFootprints.records.some(
        (record) => record.packageStatus === "upstream-package-not-specified"
      )
    ).toBe(true)
  })

  it("records the canonical CC/SBU reference and its explicit ledger alias", () => {
    expect(benchPrototypeApplicationFootprints.referenceAliases).toEqual([
      {
        canonical: "U_USB_PORT_PROTECT",
        ledgerAlias: "U_USB_CC_SBU_PROTECT",
        manufacturerPartNumber: "TPD4S201TRGRRQ1",
        disposition: "ledger-alias-only"
      }
    ])
    expect(benchPrototypeApplicationFootprints.releaseState).toBe("deny")
    expect(benchPrototypeApplicationFootprints.fabricationAuthorized).toBe(false)
  })

  it("hash-binds every retained primary source without granting review credit", () => {
    const retainedRecords = benchPrototypeApplicationFootprints.records.filter(
      (record) => record.manufacturerDrawing.state === "acquired"
    )
    const packageRoot = new URL("../", import.meta.url)
    expect(retainedRecords.map((record) => record.reference).sort()).toEqual([
      "D_SOURCE_SELECTOR",
      "D_VBUS_TVS",
      "J_USB_C",
      "L_APP_REGULATOR",
      "R_W5500_INT_BIAS",
      "TP_W5500_INT_N",
      "TP_W5500_RESET_N",
      "U_DISPLAY_LIMITER",
      "U_USB_DATA_PROTECT",
      "U_USB_PD",
      "U_USB_PORT_PROTECT",
      "U_VBUS_EFUSE"
    ])
    expect(new Set(retainedRecords.map((record) => record.reference)).size).toBe(retainedRecords.length)
    for (const record of retainedRecords) {
      if (record.manufacturerDrawing.sha256 === null || record.manufacturerDrawing.url === null)
        throw new Error(`${record.reference} retained source is incomplete`)
      if (record.manufacturerDrawing.artifactPath === null)
        throw new Error(`${record.reference} retained source path is missing`)
      const bytes = readFileSync(new URL(record.manufacturerDrawing.artifactPath, packageRoot))
      expect(bytes.subarray(0, 4).toString("ascii")).toBe("%PDF")
      expect(createHash("sha256").update(bytes).digest("hex").toUpperCase()).toBe(record.manufacturerDrawing.sha256)
      expect(record.sourceUrl).toBe(record.manufacturerDrawing.url)
      expect(record.packageStatus).toBe("exact-package-identified")
    }
    expect(benchPrototypeApplicationFootprints.authority.manufacturerDrawingsReviewed).toBe(false)
    expect(benchPrototypeApplicationFootprints.authority.fabricationAuthorized).toBe(false)
  })

  it("maps J_USB_C to the isolated BP-033 review artifact without changing the deny state", () => {
    expect(benchPrototypeApplicationFootprints.records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reference: "J_USB_C",
          manufacturer: "Amphenol ICC",
          mpn: "10177070-00011LF",
          package: "USB Type-C 16-position right-angle SMT receptacle, 0.80 mm PCB",
          packageStatus: "exact-package-identified",
          population: "DNP-unresolved",
          manufacturerDrawing: expect.objectContaining({
            state: "acquired",
            artifactPath: "docs/evidence/bp-033/amphenol-10177070-product-drawing.pdf",
            revision: "Primary source retained at docs/evidence/bp-033/amphenol-10177070-product-drawing.pdf",
            sha256: "A1F523048D0BE675C6E3554BB93592DD8B8CFFF88319E4DBE19B5A84AA8C66CF"
          }),
          manufacturerCad: expect.objectContaining({ state: "not-acquired" }),
          artwork: expect.objectContaining({ state: "not-generated" }),
          orientation: expect.objectContaining({ state: "unreviewed" })
        })
      ])
    )
    expect(benchPrototypeApplicationFootprints.projectFootprintMappings).toEqual(
      expect.arrayContaining([
        {
          reference: "J_USB_C",
          artifactKind: "bp033-usb-c-project-footprint",
          artworkModule: "src/bp033-usb-c-project-footprint.tsx",
          reviewDocument: "docs/bp-033-usb-c-project-footprint.md",
          sourceArtifactPath: "docs/evidence/bp-033/amphenol-10177070-product-drawing.pdf",
          sourceSha256: "A1F523048D0BE675C6E3554BB93592DD8B8CFFF88319E4DBE19B5A84AA8C66CF",
          reviewState: "root-reviewed-review-input",
          reviewer: "root-final-reviewer",
          reviewedAt: "2026-08-25",
          fabricationRelease: "deny"
        }
      ])
    )
    expect(benchPrototypeApplicationFootprints.releaseState).toBe("deny")
    expect(benchPrototypeApplicationFootprints.fabricationAuthorized).toBe(false)
  })

  it("maps D_SOURCE_SELECTOR to the root-reviewed B340A evidence without opening release authority", () => {
    expect(benchPrototypeApplicationFootprints.projectFootprintMappings).toEqual(
      expect.arrayContaining([
        {
          reference: "D_SOURCE_SELECTOR",
          artifactKind: "bp033-b340a-project-footprint",
          artworkModule: "src/bp033-b340a-project-footprint.tsx",
          reviewDocument: "docs/bp-033-b340a-project-footprint.md",
          sourceArtifactPath: "docs/evidence/bp-033/diodes-b340a-datasheet.pdf",
          sourceSha256: "453CBD34D996482ABD07AC694C4E2D812D26B1D679D05EE325ACC5C3EEB79917",
          reviewState: "root-reviewed-review-input",
          reviewer: "root-final-reviewer",
          reviewedAt: "2026-08-25",
          fabricationRelease: "deny"
        }
      ])
    )
    expect(
      benchPrototypeApplicationFootprints.records.find((record) => record.reference === "D_SOURCE_SELECTOR")
    ).toMatchObject({
      manufacturer: "Diodes Incorporated",
      mpn: "B340A-13-F",
      package: "SMA (DO-214AC)",
      population: "DNP-unresolved"
    })
    expect(benchPrototypeApplicationFootprints.releaseState).toBe("deny")
    expect(benchPrototypeApplicationFootprints.fabricationAuthorized).toBe(false)
  })

  it("maps both TPS25947 logical roles to the reviewed single-instance footprint evidence", () => {
    const mappings = benchPrototypeApplicationFootprints.projectFootprintMappings.filter(
      (mapping) => mapping.artifactKind === "bp033-tps25947-project-footprint"
    )
    expect(mappings).toEqual(
      ["U_VBUS_EFUSE", "U_DISPLAY_LIMITER"].map((reference) => ({
        reference,
        artifactKind: "bp033-tps25947-project-footprint",
        artworkModule: "src/bp033-tps25947-project-footprint.tsx",
        reviewDocument: "docs/bp-033-tps25947-project-footprint.md",
        sourceArtifactPath: "docs/evidence/bp-033/ti-tps25947-datasheet.pdf",
        sourceSha256: "051ECDDFE545B8B9F4F992148D24F385F75B1116FD36BEC358F85008A7D919EC",
        reviewState: "root-reviewed-review-input",
        reviewer: "root-final-reviewer",
        reviewedAt: "2026-08-25",
        fabricationRelease: "deny"
      }))
    )
    expect(benchPrototypeApplicationFootprints.records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reference: "U_VBUS_EFUSE", mpn: "TPS259474ARPWR" }),
        expect.objectContaining({ reference: "U_DISPLAY_LIMITER", mpn: "TPS259474ARPWR" })
      ])
    )
    expect(benchPrototypeApplicationFootprints.releaseState).toBe("deny")
  })

  it("maps all eight W5500 bypass references to one reviewed Murata footprint family", () => {
    const expectedReferences = [
      "C_ETH_AVDD_FERRITE_INPUT",
      "C_W5500_VDD",
      "C_W5500_AVDD_1",
      "C_W5500_AVDD_2",
      "C_W5500_AVDD_3",
      "C_W5500_AVDD_4",
      "C_W5500_AVDD_5",
      "C_W5500_AVDD_6"
    ]
    const mappings = benchPrototypeApplicationFootprints.projectFootprintMappings.filter(
      (mapping) => mapping.artifactKind === "bp033-murata-grm188r71c104ka01d-w5500-bypass-footprint"
    )
    expect(mappings.map((mapping) => mapping.reference)).toEqual(expectedReferences)
    expect(
      mappings.every(
        (mapping) =>
          mapping.sourceSha256 === "A8D9E8E5A06AA235221C7E957837509E64A9F75E42230EE142F51F984B4CFA09" &&
          mapping.reviewState === "root-reviewed-review-input" &&
          mapping.reviewer === "root-final-reviewer" &&
          mapping.fabricationRelease === "deny"
      )
    ).toBe(true)
    expect(benchPrototypeApplicationFootprints.releaseState).toBe("deny")
  })

  it("maps all four removable measurement links to the reviewed Molex evidence", () => {
    const expectedReferences = ["J_LINK_INPUT", "J_LINK_APPLICATION", "J_LINK_DISPLAY", "J_LINK_SCORING"]
    const mappings = benchPrototypeApplicationFootprints.projectFootprintMappings.filter(
      (mapping) => mapping.artifactKind === "bp033-molex-links-project-footprint"
    )
    expect(mappings.map((mapping) => mapping.reference)).toEqual(expectedReferences)
    expect(
      mappings.every(
        (mapping) =>
          mapping.sourceSha256 === "BFEB1A0BEC2417BE7C8E09E0D17800CC7AED1C403F6D93D0747223829F331691" &&
          mapping.reviewState === "root-reviewed-review-input" &&
          mapping.reviewer === "root-final-reviewer" &&
          mapping.fabricationRelease === "deny"
      )
    ).toBe(true)
    expect(benchPrototypeApplicationFootprints.releaseState).toBe("deny")
  })

  it("maps all 26 shared 10k support resistors to the reviewed Yageo evidence", () => {
    const mappings = benchPrototypeApplicationFootprints.projectFootprintMappings.filter(
      (mapping) => mapping.artifactKind === "bp033-yageo-10k-bridge-footprint"
    )
    expect(mappings).toHaveLength(26)
    expect(new Set(mappings.map((mapping) => mapping.reference)).size).toBe(26)
    expect(mappings.map((mapping) => mapping.reference)).toEqual(
      expect.arrayContaining([
        "R_APP_REG_PGOOD",
        "R_W5500_RESET_PULLUP",
        "R_HUB75_R1_PD",
        "R_HUB75_OE_PULLUP",
        "R_IR_PULLUP",
        "R_FRAM_WP_PULLUP",
        "R_FRAM_HOLD_PULLUP"
      ])
    )
    expect(
      mappings.every(
        (mapping) =>
          mapping.sourceSha256 === "EB05C2BF91E14E082BD438F809A4CE712DBF837B993DFC8CF6BDA0C6ED77A497" &&
          mapping.reviewState === "root-reviewed-review-input" &&
          mapping.reviewer === "root-final-reviewer" &&
          mapping.fabricationRelease === "deny"
      )
    ).toBe(true)
    expect(benchPrototypeApplicationFootprints.releaseState).toBe("deny")
  })

  it("binds only the J_HUB75 pin-map overlay and preserves BP-143 physical gates", () => {
    const record = benchPrototypeApplicationFootprints.records.find((candidate) => candidate.reference === "J_HUB75")
    if (
      record === undefined ||
      !("pinMapOrientationOverlay" in record) ||
      record.pinMapOrientationOverlay === undefined
    ) {
      throw new Error("J_HUB75 pin-map overlay is missing")
    }
    const pinMapOrientationOverlay = record.pinMapOrientationOverlay

    expect(record).toMatchObject({
      manufacturer: "Samtec",
      mpn: "TST-108-04-G-D-RA",
      package: "2 x 8 right-angle through-hole header",
      population: "DNP-unresolved",
      manufacturerDrawing: { state: "not-acquired" },
      manufacturerCad: { state: "not-acquired" },
      artwork: { state: "not-generated" },
      orientation: { state: "unreviewed" },
      pinMapOrientationOverlay: {
        state: "source-controlled-pending-review",
        pinMap: { rows: 2, positions: 16, pitchMm: 2.54, pinOneAtKeyedEnd: true },
        officialSources: {
          cad: { state: "not-acquired-access-gated" },
          seriesPrint: { sha256: "56AE927287856E76D57FF3B0953D3D4F853183E397794A31EE6DC5D3E07B6059" },
          footprintPrint: { sha256: "ED9B9280C24AA99BB4714557997CA5452FE7E245961599A4C39537FEFCD366DC" }
        },
        bp143Reconciliation: {
          signalCablePinOneMarker: "white stripe",
          panelConnector: "INPUT",
          sampleFitVerified: false,
          orientationVerified: false,
          continuityVerified: false,
          currentVerified: false
        }
      }
    })

    const packageRoot = new URL("../", import.meta.url)
    for (const artifact of [
      {
        path: pinMapOrientationOverlay.artifactPath,
        sha256: pinMapOrientationOverlay.sha256
      }
    ]) {
      const bytes = readFileSync(new URL(artifact.path, packageRoot))
      expect(createHash("sha256").update(bytes).digest("hex").toUpperCase()).toBe(artifact.sha256)
    }

    expect(benchPrototypeApplicationFootprints.fabricationAuthorized).toBe(false)
    expect(benchPrototypeApplicationFootprints.authority.manufacturerCadReviewed).toBe(false)
    expect(benchPrototypeApplicationFootprints.authority.orientationsReviewed).toBe(false)
  })

  it("maps the USB review candidates without board or release credit", () => {
    const record = benchPrototypeApplicationFootprints.records.find((candidate) => candidate.reference === "U_USB_PD")
    if (
      record === undefined ||
      !("projectFootprintCandidate" in record) ||
      record.projectFootprintCandidate === undefined
    )
      throw new Error("U_USB_PD project footprint candidate is missing")
    expect(record).toMatchObject({
      mpn: "TPS25730ADREFR",
      package: "WQFN (REF), 38-pin",
      projectFootprintCandidate: {
        state: "source-controlled-review-only",
        artifactPath: "src/bp033-tps25730a-ref-project-footprint.tsx",
        testArtifactPath: "src/bp033-tps25730a-ref-project-footprint.test.tsx",
        renderedGeometrySha256: "b35cde8711ffe20c9c1f38804c2e885bc7caa610db4f9bb5243f760a00e3e7e0",
        orderableBinding: {
          orderableMpn: "TPS25730ADREFR",
          deviceMpn: "TPS25730AD",
          packageDrawing: "REF0038A",
          perimeterPins: 38,
          exposedPads: ["39 GND", "40 DRAIN"]
        },
        review: {
          state: "root-reviewed-review-input",
          reviewer: "root-final-reviewer",
          reviewedAt: "2026-08-25"
        },
        authority: {
          manufacturerCadImported: false,
          boardImported: false,
          orientationAccepted: false,
          courtyardAccepted: false,
          drcAccepted: false,
          fabricationAuthorized: false,
          releaseState: "deny"
        }
      }
    })

    const protector = benchPrototypeApplicationFootprints.records.find(
      (candidate) => candidate.reference === "U_USB_PORT_PROTECT"
    )
    if (protector === undefined || !("projectFootprintCandidate" in protector))
      throw new Error("U_USB_PORT_PROTECT project footprint candidate is missing")
    expect(protector).toMatchObject({
      manufacturer: "Texas Instruments",
      mpn: "TPD4S201TRGRRQ1",
      package: "VQFN (RGR), 20-pin",
      population: "DNP-unresolved",
      projectFootprintCandidate: {
        state: "source-controlled-review-only",
        artifactPath: "src/bp033-tpd4s201-rgr-project-footprint.tsx",
        testArtifactPath: "src/bp033-tpd4s201-rgr-project-footprint.test.tsx",
        renderedGeometrySha256: "6fa9a9c5018a1e1d9498032c2691e7aff50c0e0c9b2daa3acd4982cb21db4ac7",
        orderableBinding: {
          orderableMpn: "TPD4S201TRGRRQ1",
          deviceMpn: "TPD4S201-Q1",
          packageDrawing: "RGR0020C",
          perimeterPins: 20,
          exposedPads: ["21 GND"]
        },
        source: {
          artifactPath: "docs/evidence/bp-033/ti-tpd4s201-q1-datasheet.pdf",
          sha256: "E5A00ECD4BBAD07C21A92754DA2050950B91EBA32A960381FD5C1DE921B758D5",
          reviewedPages: "1, 3-4, 21, 26-28"
        },
        review: {
          state: "root-reviewed-review-input",
          reviewer: "root-final-reviewer",
          reviewedAt: "2026-08-25"
        },
        authority: {
          manufacturerCadImported: false,
          boardImported: false,
          orientationAccepted: false,
          courtyardAccepted: false,
          drcAccepted: false,
          fabricationAuthorized: false,
          releaseState: "deny"
        }
      }
    })
    expect(
      benchPrototypeApplicationFootprints.records.filter((record) => record.projectFootprintCandidate !== undefined)
    ).toHaveLength(3)
    expect(benchPrototypeApplicationFootprints.releaseState).toBe("deny")
    expect(benchPrototypeApplicationFootprints.fabricationAuthorized).toBe(false)
  })

  it("maps S_SOURCE_SELECTOR to the root-reviewed 7101SYZQE evidence without granting placement authority", () => {
    expect(benchPrototypeApplicationFootprints.projectFootprintMappings).toEqual(
      expect.arrayContaining([
        {
          reference: "S_SOURCE_SELECTOR",
          artifactKind: "bp033-7101syzqe-project-footprint",
          artworkModule: "src/bp033-7101syzqe-project-footprint.tsx",
          reviewDocument: "docs/bp-033-7101syzqe-project-footprint.md",
          sourceArtifactPath: "docs/evidence/bp-033/ck-7000toggle-7101syzqe-datasheet.pdf",
          sourceSha256: "81C507AE655CBF893635F3E0ED421734A28AF08C975A8279E02070FFDCD353CB",
          reviewState: "root-reviewed-review-input",
          reviewer: "root-final-reviewer",
          reviewedAt: "2026-08-25",
          fabricationRelease: "deny"
        }
      ])
    )
    expect(
      benchPrototypeApplicationFootprints.records.find((record) => record.reference === "S_SOURCE_SELECTOR")
    ).toMatchObject({
      manufacturer: "C&K",
      mpn: "7101SYZQE",
      population: "DNP-unresolved"
    })

    const drift = structuredClone(benchPrototypeApplicationFootprints) as unknown as {
      projectFootprintMappings: Array<{ sourceSha256: string }>
    }
    drift.projectFootprintMappings[2]!.sourceSha256 = "0".repeat(64)
    expect(() => validateBenchPrototypeApplicationFootprints(drift)).toThrow(RangeError)
  })

  it("maps D_VBUS_TVS to the root-reviewed TVS2200 evidence without granting thermal authority", () => {
    expect(benchPrototypeApplicationFootprints.projectFootprintMappings).toEqual(
      expect.arrayContaining([
        {
          reference: "D_VBUS_TVS",
          artifactKind: "bp033-tvs2200-project-footprint",
          artworkModule: "src/bp033-tvs2200-project-footprint.tsx",
          reviewDocument: "docs/bp-033-tvs2200-project-footprint.md",
          sourceArtifactPath: "docs/evidence/bp-033/ti-tvs2200-datasheet.pdf",
          sourceSha256: "E79BF6F7D5B69FB71EC3DCE566B4B4D63C27BCCAD8561195E5F2F7122B44C801",
          reviewState: "root-reviewed-review-input",
          reviewer: "root-final-reviewer",
          reviewedAt: "2026-08-25",
          fabricationRelease: "deny"
        }
      ])
    )
    expect(
      benchPrototypeApplicationFootprints.records.find((record) => record.reference === "D_VBUS_TVS")
    ).toMatchObject({
      manufacturer: "Texas Instruments",
      mpn: "TVS2200DRVR",
      package: "WSON (DRV), 6-pin",
      population: "DNP-unresolved"
    })

    const drift = structuredClone(benchPrototypeApplicationFootprints) as unknown as {
      projectFootprintMappings: Array<{ reviewDocument: string }>
    }
    drift.projectFootprintMappings[3]!.reviewDocument = "docs/forged.md"
    expect(() => validateBenchPrototypeApplicationFootprints(drift)).toThrow(RangeError)
  })

  it("maps all three exact 0451 fuses to one root-reviewed common-package evidence artifact", () => {
    const fuseMappings = benchPrototypeApplicationFootprints.projectFootprintMappings.filter((mapping) =>
      ["F_APPLICATION", "F_DISPLAY", "F_SCORING"].includes(mapping.reference)
    )
    expect(fuseMappings).toEqual(
      ["F_APPLICATION", "F_DISPLAY", "F_SCORING"].map((reference) => ({
        reference,
        artifactKind: "bp033-littelfuse-0451-fuses-footprint-evidence",
        artworkModule: "src/bp033-littelfuse-0451-fuses.tsx",
        reviewDocument: "docs/bp-033-littelfuse-0451-fuses.md",
        sourceArtifactPath: "docs/evidence/bp-033/littelfuse-451-453-datasheet.pdf",
        sourceSha256: "399D3CC9DA991AA3192638F807FB568F137407D10A4B0D35D106A82B5C2BACE2",
        reviewState: "root-reviewed-review-input",
        reviewer: "root-final-reviewer",
        reviewedAt: "2026-08-25",
        fabricationRelease: "deny"
      }))
    )

    const drift = structuredClone(benchPrototypeApplicationFootprints) as unknown as {
      projectFootprintMappings: Array<{ reference: string }>
    }
    drift.projectFootprintMappings[5]!.reference = "F_FORGED"
    expect(() => validateBenchPrototypeApplicationFootprints(drift)).toThrow(RangeError)
  })

  it("maps U_USB_DATA_PROTECT to the root-reviewed DRT candidate with independent identity and deny checks", () => {
    const record = benchPrototypeApplicationFootprints.records.find(
      (candidate) => candidate.reference === "U_USB_DATA_PROTECT"
    )
    if (
      record === undefined ||
      !("projectFootprintCandidate" in record) ||
      record.projectFootprintCandidate === undefined
    )
      throw new Error("U_USB_DATA_PROTECT project footprint candidate is missing")
    expect(record).toMatchObject({
      manufacturer: "Texas Instruments",
      mpn: "TPD2EUSB30DRTR",
      package: "SOT-9X3 (DRT), 3-pin",
      population: "DNP-unresolved",
      projectFootprintCandidate: {
        state: "source-controlled-review-only",
        artifactPath: "src/bp033-tpd2eusb30drtr-drt-project-footprint.tsx",
        testArtifactPath: "src/bp033-tpd2eusb30drtr-drt-project-footprint.test.tsx",
        renderedGeometrySha256: "f206c789162f96e38c781ca937d052b48b44bc66a91df41cebd7ad4cc6eff86e",
        orderableBinding: {
          orderableMpn: "TPD2EUSB30DRTR",
          deviceMpn: "TPD2EUSB30",
          packageDrawing: "DRT0003A",
          electricalPinCount: 3,
          pinMap: [
            { pad: "1", signal: "D+", function: "D1+" },
            { pad: "2", signal: "D-", function: "D1-" },
            { pad: "3", signal: "GND", function: "GND" }
          ]
        },
        source: {
          artifactPath: "docs/evidence/bp-033/ti-tpd2eusb30a-datasheet.pdf",
          sha256: "A2C0DD845043A5BBFE610F673879C29E38649544385DEA51DBE0A4C49DF39136",
          reviewedPages: "1, 3, 12, 15-17"
        },
        review: {
          state: "root-reviewed-review-input",
          reviewer: "root-final-reviewer",
          reviewedAt: "2026-08-25"
        },
        authority: {
          manufacturerCadImported: false,
          boardImported: false,
          orientationAccepted: false,
          courtyardAccepted: false,
          drcAccepted: false,
          fabricationAuthorized: false,
          releaseState: "deny"
        }
      }
    })
    expect(validateBenchPrototypeApplicationFootprints(benchPrototypeApplicationFootprints)).toBe(true)
    expect(benchPrototypeApplicationFootprints.releaseState).toBe("deny")
    expect(benchPrototypeApplicationFootprints.fabricationAuthorized).toBe(false)
  })

  it("rejects a substituted canonical-source path or forged physical evidence", () => {
    const substitutedSource = structuredClone(benchPrototypeApplicationFootprints) as {
      records: Array<Record<string, unknown>>
    }
    const substitutedHub75 = substitutedSource.records.find((record) => record.reference === "J_HUB75")
    if (substitutedHub75 === undefined) throw new Error("J_HUB75 ledger record is missing")
    const substitutedOverlay = substitutedHub75.pinMapOrientationOverlay as {
      officialSources: { seriesPrint: { artifactPath: string } }
    }
    substitutedOverlay.officialSources.seriesPrint.artifactPath = "docs/evidence/bp-033/samtec-tst-series-print.pdf"
    expect(() => validateBenchPrototypeApplicationFootprints(substitutedSource)).toThrow(RangeError)

    const forgedPhysicalEvidence = structuredClone(benchPrototypeApplicationFootprints) as {
      records: Array<Record<string, unknown>>
    }
    const forgedHub75 = forgedPhysicalEvidence.records.find((record) => record.reference === "J_HUB75")
    if (forgedHub75 === undefined) throw new Error("J_HUB75 ledger record is missing")
    const forgedOverlay = forgedHub75.pinMapOrientationOverlay as {
      bp143Reconciliation: { sampleFitVerified: boolean }
    }
    forgedOverlay.bp143Reconciliation.sampleFitVerified = true
    expect(() => validateBenchPrototypeApplicationFootprints(forgedPhysicalEvidence)).toThrow(RangeError)

    const forgedTpdCandidate = structuredClone(benchPrototypeApplicationFootprints) as {
      records: Array<Record<string, unknown>>
    }
    const forgedTpdRecord = forgedTpdCandidate.records.find((record) => record.reference === "U_USB_DATA_PROTECT")
    if (forgedTpdRecord === undefined) throw new Error("U_USB_DATA_PROTECT ledger record is missing")
    const projectFootprintCandidate = forgedTpdRecord.projectFootprintCandidate as {
      renderedGeometrySha256: string
    }
    projectFootprintCandidate.renderedGeometrySha256 = "forged-artwork-digest"
    expect(() => validateBenchPrototypeApplicationFootprints(forgedTpdCandidate)).toThrow(RangeError)
  })

  it("keeps audio and every other omitted peripheral out of the board", () => {
    expect(benchPrototypeApplicationFootprints.omittedPeripherals.map((record) => record.reference)).toEqual([
      "U_RTC",
      "U_SECURE_ELEMENT",
      "U_AUDIO",
      "J_SPEAKER",
      "ANT_EXTERNAL"
    ])
    expect(benchPrototypeApplicationFootprints.omittedPeripherals.every((record) => record.population === "DNP")).toBe(
      true
    )
  })

  it("reconciles the complete BP-140 reference set without inventing unresolved identities", () => {
    expect(benchPrototypeApplicationFootprints.bp140ReferenceReconciliation.map((record) => record.reference)).toEqual([
      "C_ETH_AVDD_FERRITE_INPUT",
      "C_W5500_1V2O",
      "C_W5500_AVDD_1",
      "C_W5500_AVDD_2",
      "C_W5500_AVDD_3",
      "C_W5500_AVDD_4",
      "C_W5500_AVDD_5",
      "C_W5500_AVDD_6",
      "C_W5500_TOCAP",
      "C_W5500_VDD",
      "C_W5500_XI",
      "C_W5500_XO",
      "FB_W5500_AVDD",
      "R_W5500_EXRES",
      "R_W5500_INT_BIAS",
      "R_W5500_RESET_PULLUP",
      "R_W5500_XO",
      "R_W5500_XTAL",
      "TP_W5500_INT_N",
      "TP_W5500_RESET_N",
      "U_APP_RESET_FANOUT",
      "U_W5500",
      "Y_W5500"
    ])
    expect(benchPrototypeApplicationFootprints.bp140SelectionBlockedReferences).toHaveLength(0)
    expect(benchPrototypeApplicationFootprints.records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reference: "TP_W5500_RESET_N",
          manufacturer: "Keystone Electronics",
          mpn: "5001",
          package: "miniature through-hole black test point, 0.040 inch (catalog 1.0 mm) mounting hole",
          packageStatus: "exact-package-identified",
          population: "DNP-unresolved"
        }),
        expect.objectContaining({
          reference: "TP_W5500_INT_N",
          manufacturer: "Keystone Electronics",
          mpn: "5001",
          package: "miniature through-hole black test point, 0.040 inch (catalog 1.0 mm) mounting hole",
          packageStatus: "exact-package-identified",
          population: "DNP-unresolved"
        })
      ])
    )
    expect(benchPrototypeApplicationFootprints.bp140DnpReferences).toHaveLength(0)
    expect(benchPrototypeApplicationFootprints.records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reference: "R_W5500_INT_BIAS",
          manufacturer: "Yageo",
          mpn: "RC0603FR-07100KL",
          package: "0603",
          packageStatus: "exact-package-identified",
          population: "DNP-unresolved"
        })
      ])
    )
    expect(benchPrototypeApplicationFootprints.authority.bp140BlockedReferenceIdentitiesReconciled).toBe(true)
  })

  it("rejects release-state tampering", () => {
    expect(() =>
      validateBenchPrototypeApplicationFootprints({ ...benchPrototypeApplicationFootprints, releaseState: "allow" })
    ).toThrow(RangeError)
  })

  it("links U_W5500 to the root-reviewed project footprint without granting release", () => {
    expect(benchPrototypeApplicationFootprints.projectFootprintMappings).toContainEqual({
      reference: "U_W5500",
      artifactKind: "bp033-w5500-project-footprint",
      artworkModule: "src/bp033-w5500-project-footprint.tsx",
      reviewDocument: "docs/bench-prototype-application-footprints.md",
      sourceArtifactPath: "docs/evidence/bp-033/wiznet-w5500-datasheet.pdf",
      sourceSha256: "7B826B808084CCD986BCC22904C00A07A508EF42FB93D079FE7150A4C4F1A63D",
      reviewState: "root-reviewed-review-input",
      reviewer: "root-final-reviewer",
      reviewedAt: "2026-08-25",
      fabricationRelease: "deny"
    })
  })

  it("links U_IR to the BP-146 preorder geometry without closing physical optical gates", () => {
    expect(benchPrototypeApplicationFootprints.projectFootprintMappings).toContainEqual({
      reference: "U_IR",
      artifactKind: "bp146-tsop38438-project-footprint",
      artworkModule: "src/bench-prototype-ir-receiver-project-footprint.tsx",
      reviewDocument: "docs/bench-prototype-plan.md#bp-146",
      sourceArtifactPath: "docs/evidence/bp-146/vishay-82491-tsop382-tsop384-datasheet.pdf",
      sourceSha256: "5F81C36AA02E9901E51C749D03AEE75A23A29B8195B30BF1CBA95F536C865074",
      reviewState: "root-reviewed-review-input",
      reviewer: "root-final-reviewer",
      reviewedAt: "2026-08-25",
      fabricationRelease: "deny"
    })
  })

  it("links the six BP-033 KEMET 100 nF rows to the shared review-only evidence", () => {
    const references = [
      "C_APP_REG_IN_HF",
      "C_APP_REG_BOOT",
      "C_HUB75_BUF_A_BYPASS",
      "C_HUB75_BUF_B_BYPASS",
      "C_IR_VS",
      "C_FRAM_BYPASS"
    ]
    for (const reference of references) {
      expect(benchPrototypeApplicationFootprints.projectFootprintMappings).toContainEqual({
        reference,
        artifactKind: "bp031-032-033-c0603c104k3ractu-footprint-evidence",
        artworkModule: "src/bp031-032-c0603c104k3ractu-footprint-evidence.tsx",
        reviewDocument: "docs/bp-031-032-c0603c104k3ractu-footprint-review.md",
        sourceArtifactPath: "docs/evidence/m4-04/yageo-c0603c104k3ractu-datasheet.pdf",
        sourceSha256: "F5A15A13E31AED37414EAA17722DD48C7488D85370679DFF4300AC5294EF2064",
        reviewState: "root-reviewed-review-input",
        reviewer: "root-final-reviewer",
        reviewedAt: "2026-08-25",
        fabricationRelease: "deny"
      })
    }
  })

  it("links the three BP-033 Keystone 5001 test points to exact retained evidence", () => {
    for (const reference of ["TP_W5500_RESET_N", "TP_W5500_INT_N", "TP_IR_RX"]) {
      expect(benchPrototypeApplicationFootprints.projectFootprintMappings).toContainEqual({
        reference,
        artifactKind: "bp033-keystone-5001-test-point-evidence-candidate",
        artworkModule: "src/bp033-keystone-5001-test-point-evidence-candidate.ts",
        reviewDocument: "docs/bp-033-keystone-5001-test-point-evidence-candidate.md",
        sourceArtifactPath: "docs/evidence/bp-033/keystone-terminal-test-points.pdf",
        sourceSha256: "00919BF8DA5DA41C978FE22717F8B39D443D03BB69BDD0A853CED85479FB237C",
        reviewState: "root-reviewed-review-input",
        reviewer: "root-final-reviewer",
        reviewedAt: "2026-08-25",
        fabricationRelease: "deny"
      })
    }
  })

  it("links the five BP-033 TDK 22 uF rows to the exact review candidate", () => {
    for (const reference of [
      "C_DISPLAY_IN",
      "C_DISPLAY_OUT",
      "C_APP_REG_OUT_A",
      "C_APP_REG_OUT_B",
      "C_APP_REG_OUT_C"
    ]) {
      expect(benchPrototypeApplicationFootprints.projectFootprintMappings).toContainEqual({
        reference,
        artifactKind: "bp033-tdk-c2012x7s1a226m125ac-0805-review-candidate",
        artworkModule: "src/bp033-tdk-c2012x7s1a226m125ac-0805-review-candidate.tsx",
        reviewDocument: "docs/bp-033-tdk-c2012x7s1a226m125ac-0805-review-candidate.md",
        sourceArtifactPath: "docs/evidence/bp-033/tdk-c2012x7s1a226m125ac-product-page-capture.md",
        sourceSha256: "60F2B7B008453D3BE7F5501C7904E54911D422BB068EC8296DA876D47D4A511E",
        reviewState: "root-reviewed-review-input",
        reviewer: "root-final-reviewer",
        reviewedAt: "2026-08-25",
        fabricationRelease: "deny"
      })
    }
  })

  it("links both BP-033 display-enable MOSFETs to the retained BSS138AKA evidence", () => {
    for (const reference of ["Q_DISPLAY_BUFFER_A_ENABLE", "Q_DISPLAY_BUFFER_B_ENABLE"]) {
      expect(benchPrototypeApplicationFootprints.projectFootprintMappings).toContainEqual({
        reference,
        artifactKind: "bp033-display-buffer-bss138aka-reference-binding",
        artworkModule: "src/bp033-display-buffer-bss138aka-reference-binding.tsx",
        reviewDocument: "docs/bp-033-display-buffer-bss138aka-reference-binding-review.md",
        sourceArtifactPath: "docs/evidence/bp-032/nexperia-bss138aka-datasheet.pdf",
        sourceSha256: "39D145F3B39A916F88B21CF8E19C865437D200752A7CD37872EF976C2BFD69F9",
        reviewState: "root-reviewed-review-input",
        reviewer: "root-final-reviewer",
        reviewedAt: "2026-08-25",
        fabricationRelease: "deny"
      })
    }
  })
})
