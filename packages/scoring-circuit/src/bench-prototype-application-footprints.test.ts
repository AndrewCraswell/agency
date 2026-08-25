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
      "U_USB_CC_SBU_PROTECT",
      "U_USB_DATA_PROTECT",
      "U_USB_PD",
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

  it("maps only U_USB_PD to the rendered REF0038A review candidate without board or release credit", () => {
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
})
