import { describe, expect, it } from "vitest"
import {
  bp032ResetSupportFootprintEvidence,
  validateBp032ResetSupportFootprintEvidence
} from "./bp032-reset-support-footprints.js"

type Mutable<T> = T extends readonly (infer Item)[]
  ? Mutable<Item>[]
  : T extends object
    ? { -readonly [Key in keyof T]: Mutable<T[Key]> }
    : T

function mutableClone(): Mutable<typeof bp032ResetSupportFootprintEvidence> {
  return structuredClone(bp032ResetSupportFootprintEvidence) as Mutable<typeof bp032ResetSupportFootprintEvidence>
}

describe("BP-032 reset-support footprint evidence", () => {
  it("retains exactly the two selected reset-support orderables", () => {
    expect(
      bp032ResetSupportFootprintEvidence.parts.map(({ manufacturerPartNumber }) => manufacturerPartNumber)
    ).toEqual(["SN74LVC2G07DCKR", "BSS138AKA"])
    expect(validateBp032ResetSupportFootprintEvidence()).toEqual([])
  })

  it("retains the TI SC70-6 pin map and land-pattern dimensions", () => {
    const part = bp032ResetSupportFootprintEvidence.parts[0]
    expect(part?.package).toMatchObject({
      designation: "SC70-6",
      packageCode: "DCK",
      leadPitchMm: 0.65,
      padRowCenterSpanMm: 2.2
    })
    expect(part?.pinMap).toEqual([
      { pin: 1, name: "1A", function: "input 1" },
      { pin: 2, name: "GND", function: "ground" },
      { pin: 3, name: "2A", function: "input 2" },
      { pin: 4, name: "2Y", function: "open-drain output 2" },
      { pin: 5, name: "VCC", function: "supply" },
      { pin: 6, name: "1Y", function: "open-drain output 1" }
    ])
    expect(part?.manufacturerLandPattern.copper).toEqual({
      padLengthMm: 0.9,
      padWidthMm: 0.4,
      pitchMm: 0.65,
      rowCenterSpanMm: 2.2
    })
    expect(part?.projectFootprint.orientation.datum).toContain("upper-left")
  })

  it("binds the exact TI orderable to PDF page 12 Addendum-Page 1", () => {
    const source = bp032ResetSupportFootprintEvidence.parts[0]?.source
    expect(source?.reviewedPrintedPages).toEqual([3, 11])
    expect(source?.pageNumbering).toMatchObject({
      retainedPdfPageCount: 34,
      reviewedPdfPages: [3, 11, 12],
      printedPageLabels: [3, 11, "Addendum-Page 1"]
    })
    expect(source?.exactOrderableBinding).toEqual({
      pdfPage: 12,
      printedPageLabel: "Addendum-Page 1",
      manufacturerPartNumber: "SN74LVC2G07DCKR",
      status: "Active",
      package: "SC70 (DCK)",
      pinCount: 6,
      purpose: "Bind the selected exact orderable to the DCK package used by this review record."
    })
    expect(validateBp032ResetSupportFootprintEvidence()).toEqual([])
  })

  it("retains the Nexperia SOT23 pin map and reflow guidance", () => {
    const part = bp032ResetSupportFootprintEvidence.parts[1]
    expect(part?.package).toMatchObject({
      designation: "SOT23",
      packageCode: "SOT23",
      bodyLengthMm: 2.9,
      bodyWidthMm: 1.3,
      leadPitchMm: 1.9
    })
    expect(part?.pinMap).toEqual([
      { pin: 1, name: "G", function: "gate" },
      { pin: 2, name: "S", function: "source" },
      { pin: 3, name: "D", function: "drain" }
    ])
    expect(part?.manufacturerLandPattern.solderLands).toEqual({
      padLengthMm: 0.7,
      padWidthMm: 0.6,
      upperRowPitchMm: 1.9,
      centerSpanMm: 1.4
    })
    expect(part?.projectFootprint.orientation.datum).toContain("lower-left")
  })

  it("fails closed if either exact source or CAD disposition drifts", () => {
    const sourceDrift = mutableClone()
    sourceDrift.parts[0].source.sha256 = "0".repeat(64)
    expect(validateBp032ResetSupportFootprintEvidence(sourceDrift)).toContain(
      "retained TI source identity or SHA-256 drifted"
    )

    const cadDrift = mutableClone()
    cadDrift.parts[1].manufacturerCad.authority = "allow"
    expect(validateBp032ResetSupportFootprintEvidence(cadDrift)).toContain("BSS CAD must remain denied and unacquired")
  })

  it("fails closed on pad identity, duplicate, and orientation drift", () => {
    const padDrift = mutableClone()
    padDrift.parts[0].projectFootprint.pads[0].name = "WRONG"
    padDrift.parts[0].projectFootprint.pads[1].pin = 1
    padDrift.parts[0].projectFootprint.orientation.boardRotationDegrees = 90
    const errors = validateBp032ResetSupportFootprintEvidence(padDrift)
    expect(errors).toEqual(
      expect.arrayContaining([
        "TI project footprint pin 1 name drifted",
        "TI project footprint contains duplicate pin 1",
        "TI orientation datum drifted"
      ])
    )
  })

  it("rejects substitution of the TI exact-orderable PDF page", () => {
    const pageDrift = mutableClone()
    const source = pageDrift.parts[0]?.source
    if (source === undefined || !("exactOrderableBinding" in source)) {
      throw new Error("test fixture is missing the TI exact-orderable binding")
    }
    const binding = source.exactOrderableBinding
    if (binding === undefined) {
      throw new Error("test fixture has an empty TI exact-orderable binding")
    }
    binding.pdfPage = 11
    expect(validateBp032ResetSupportFootprintEvidence(pageDrift)).toContain(
      "TI exact-orderable PDF-page-12 binding drifted"
    )
  })
})
