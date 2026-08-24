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
      "L_APP_REGULATOR",
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
    expect(benchPrototypeApplicationFootprints.bp140SelectionBlockedReferences).toMatchObject([
      { reference: "TP_W5500_RESET_N", population: "DNP-or-selection-blocked", mpn: null, package: null },
      { reference: "TP_W5500_INT_N", population: "DNP-or-selection-blocked", mpn: null, package: null },
      { reference: "R_W5500_INT_BIAS", population: "DNP-or-selection-blocked", mpn: null, package: null }
    ])
  })

  it("rejects release-state tampering", () => {
    expect(() =>
      validateBenchPrototypeApplicationFootprints({ ...benchPrototypeApplicationFootprints, releaseState: "allow" })
    ).toThrow(RangeError)
  })
})
