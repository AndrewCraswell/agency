import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  bp033InfineonCy15b104qFootprintEvidence,
  validateBp033InfineonCy15b104qFootprintEvidence
} from "./bp033-infineon-cy15b104q-footprint-evidence.js"

const expectedSha256 = "B392F55463F1089F3E3123A47B961588120605E9D7B5A3C70F98A3B5E267FAC0"

function retainedBytes(path: string): Buffer {
  return readFileSync(new URL(`../${path.replace("packages/scoring-circuit/", "")}`, import.meta.url))
}

describe("BP-033 Infineon CY15B104Q-LHXIT footprint evidence", () => {
  it("binds the exact MPN, manufacturer, and retained source", () => {
    expect(validateBp033InfineonCy15b104qFootprintEvidence()).toBe(true)

    const evidence = bp033InfineonCy15b104qFootprintEvidence
    expect(evidence).toMatchObject({
      reference: "U_FRAM",
      manufacturer: "Infineon",
      manufacturerPartNumber: "CY15B104Q-LHXIT",
      package: "8-pin TDFN/DFN, 5 mm x 6 mm x 0.75 mm, PG-USON-8, drawing 001-85579"
    })
    expect("canonicalReconciliation" in evidence).toBe(false)
  })

  it("binds the retained manufacturer pages, pin map, and package geometry", () => {
    const evidence = bp033InfineonCy15b104qFootprintEvidence
    const sourceBytes = retainedBytes(evidence.source.artifactPath)
    expect(createHash("sha256").update(sourceBytes).digest("hex").toUpperCase()).toBe(expectedSha256)
    expect(evidence.source.sha256).toBe(expectedSha256)
    expect(evidence.source.reviewedPdfPages).toEqual([3, 17, 19])
    expect(evidence.source.reviewedFields).toEqual(
      expect.arrayContaining([
        { pdfPage: 3, field: "Figure 2", value: "8-pin TDFN Pinout; top view; not to scale" },
        { pdfPage: 17, field: "Ordering Information.CY15B104Q-LHXIT", value: "001-85579; 8-pin TDFN; Industrial" },
        { pdfPage: 19, field: "Figure 21.DAP", value: "DAP SIZE 4.4 x 4.4 mm" },
        { pdfPage: 19, field: "Figure 21.terminal pitch", value: "1.27 mm Ref." }
      ])
    )
    expect(evidence.pinMap).toEqual([
      { pin: 1, name: "CS", electricalType: "input", projectSignal: "CS" },
      { pin: 2, name: "SO", electricalType: "output", projectSignal: "MISO" },
      { pin: 3, name: "WP", electricalType: "input", projectSignal: "WP" },
      { pin: 4, name: "VSS", electricalType: "power-ground", projectSignal: "GND" },
      { pin: 5, name: "SI", electricalType: "input", projectSignal: "MOSI" },
      { pin: 6, name: "SCK", electricalType: "input", projectSignal: "SCK" },
      { pin: 7, name: "HOLD", electricalType: "input", projectSignal: "HOLD" },
      { pin: 8, name: "VDD", electricalType: "power-input", projectSignal: "V3_3" }
    ])
    expect(evidence.packageFacts).toMatchObject({
      packageName: "PG-USON-8 / 8-pin DFN (001-85579)",
      bodyMm: {
        length: { nominal: 6, plusMinus: 0.1 },
        width: { nominal: 5, plusMinus: 0.1 },
        height: { nominal: 0.75, plusMinus: 0.05 }
      },
      terminals: 8,
      terminalPitchMm: 1.27,
      terminalAlongEdgeMm: { nominal: 0.6, plusMinus: 0.1 },
      terminalRadialWidthMm: { nominal: 0.4, plusMinus: 0.05 },
      terminalThicknessMm: { nominal: 0.203, plus: 0.058, minus: 0.008 },
      coplanarityMaximumMm: 0.08,
      exposedPad: {
        state: "published",
        sizeMm: { length: 4.4, width: 4.4 },
        electricalDisposition: "no-connect",
        boardDisposition: "leave floating"
      }
    })
  })

  it("keeps CAD, artwork, orientation, board, and release authority denied", () => {
    const evidence = bp033InfineonCy15b104qFootprintEvidence
    expect(evidence.orientation).toMatchObject({
      pinoutSource: { pdfPage: 3, figure: "Figure 2", pinOne: "upper-left" },
      packageDrawingSource: {
        pdfPage: 19,
        figure: "Figure 21",
        pinOne: expect.stringContaining("lower-left")
      },
      independentBoardOrientationAccepted: false
    })
    expect(evidence.orientation.packageDrawingSource.pinOne).toContain("lower-right")
    expect(evidence.projectGeometry).toEqual({
      state: "source-facts-only-not-emitted",
      landPattern: "not-transformed-to-project-pads",
      cad: "not-acquired",
      artwork: "not-generated",
      accepted: false
    })
    expect(evidence.artwork).toEqual({
      state: "not-generated",
      artifactPath: null,
      generator: null,
      renderedGeometrySha256: null,
      authority: "deny"
    })
    expect(evidence.reviewGates).toMatchObject({
      manufacturerCad: "deny",
      projectCadImport: "deny",
      projectArtwork: "deny",
      independentOrientation: "deny",
      boardPlacement: "deny",
      boardFitAndClearance: "deny",
      drc: "deny",
      fabrication: "deny",
      release: "deny",
      accepted: false
    })
    expect(Object.isFrozen(evidence)).toBe(true)
    expect(Object.isFrozen(evidence.packageFacts)).toBe(true)
    expect(Object.isFrozen(evidence.source.reviewedFields)).toBe(true)
  })
})
