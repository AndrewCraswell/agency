import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  Bp033UsbCProjectFootprint,
  bp033UsbCProjectFootprintGeometry,
  validateBp033UsbCProjectFootprintGeometry
} from "./bp033-usb-c-project-footprint.js"
import { renderTestCircuit } from "./test-helper.js"

function renderProjectFootprint() {
  return renderTestCircuit(<Bp033UsbCProjectFootprint />)
}

type CircuitElement = ReturnType<typeof renderTestCircuit>[number]
type RectSmtPad = Extract<CircuitElement, { readonly shape: "rect"; readonly type: "pcb_smtpad" }>
type RenderedHole = Extract<CircuitElement, { readonly type: "pcb_hole" }> & {
  readonly hole_diameter?: number
  readonly hole_height?: number
  readonly hole_shape: string
  readonly hole_width?: number
}

function isSmtPad(element: CircuitElement): element is RectSmtPad {
  return element.type === "pcb_smtpad" && element.shape === "rect"
}

function isHole(element: CircuitElement): element is RenderedHole {
  return element.type === "pcb_hole"
}

function renderedGeometryHash() {
  const geometry: Array<Record<string, unknown>> = []
  for (const element of renderProjectFootprint()) {
    if (isSmtPad(element)) {
      geometry.push({
        height: element.height,
        port_hints: element.port_hints ?? [],
        shape: element.shape,
        type: element.type,
        width: element.width,
        x: element.x,
        y: element.y
      })
    }
    if (isHole(element)) {
      geometry.push({
        diameter: element.hole_diameter,
        height: element.hole_height,
        shape: element.hole_shape,
        type: element.type,
        width: element.hole_width,
        x: element.x,
        y: element.y
      })
    }
  }
  return createHash("sha256").update(JSON.stringify(geometry)).digest("hex")
}

function retainedEvidenceHash(artifactPath: string) {
  const packageRelativePath = artifactPath.replace("docs/", "../docs/")
  return createHash("sha256")
    .update(readFileSync(new URL(packageRelativePath, import.meta.url)))
    .digest("hex")
    .toUpperCase()
}

describe("BP-033 J_USB_C manufacturer PCB layout", () => {
  it("binds the exact drawing page and keeps CAD/import/fabrication denied", () => {
    expect(bp033UsbCProjectFootprintGeometry).toMatchObject({
      workUnit: "BP-033",
      reference: "J_USB_C",
      manufacturer: "Amphenol ICC",
      manufacturerAliases: ["Amphenol FCI", "Amphenol Communications Solutions"],
      manufacturerPartNumber: "10177070-00011LF",
      manufacturerCad: { state: "not-acquired-access-gated", authority: "deny" },
      package: {
        designation: "USB Type-C 16-position right-angle SMT receptacle",
        drawingNumber: "10177070",
        pcbThicknessMm: 0.8,
        defaultToleranceMm: 0.05,
        electricalPinCount: 16,
        manufacturerLandCount: 12
      },
      manufacturerRecommendedLayout: {
        view: "top",
        boardThicknessMm: 0.8,
        defaultToleranceMm: 0.05,
        productEdge: {
          datum: "horizontal product-edge line shown on page 2",
          sourceDimension: "line shown; no offset from the shell-slot centerline is published"
        },
        coordinateDatum: "bottom shell mounting-slot centerline",
        landEdgeSourceDimensions: {
          lowerMm: 4.17,
          upperMm: 5.32,
          count: 12,
          derivedCenterMm: 4.745,
          derivedHeightMm: 1.15
        },
        slotSourceDimensions: {
          top: { count: 2, widthMm: 1.17, heightMm: 2.1 },
          bottom: { count: 2, widthMm: 1.4, heightMm: 1.8 },
          centerSpacingMm: 4.18,
          slotCenterSpacingMm: 8.64
        },
        datumHoleSourceDimensions: { count: 2, diameterMm: 0.65, centerSpacingMm: 5.78, offsetFromShellDatumMm: 3.68 }
      },
      orientation: {
        productEdgeDatum: "horizontal product-edge line shown; offset not dimensioned",
        coordinateDatum: "bottom shell mounting-slot centerline",
        landRowYFromShellDatumMm: 4.745,
        boardRotationDegrees: 0,
        independentlyReviewed: true
      },
      review: {
        state: "root-reviewed-review-input",
        reviewer: "root-final-reviewer",
        reviewedAt: "2026-08-25"
      },
      acceptance: {
        packageDrawingReviewed: true,
        manufacturerLandPatternCaptured: true,
        manufacturerCadImportAccepted: false,
        independentLandOverlayAccepted: true,
        pinOneOrientationAccepted: true,
        boardEdgeDatumAccepted: true,
        maskAndPasteAccepted: false,
        courtyardAccepted: false,
        chassisSupportAccepted: false,
        boardFitAccepted: false,
        fabricationAuthorized: false,
        releaseState: "deny"
      }
    })
    expect(bp033UsbCProjectFootprintGeometry.sources).toEqual([
      expect.objectContaining({
        authority: "manufacturer-primary",
        reviewedPages: "1-2",
        revision: "A",
        artifactPath: "docs/evidence/bp-033/amphenol-10177070-product-drawing.pdf",
        sha256: "A1F523048D0BE675C6E3554BB93592DD8B8CFFF88319E4DBE19B5A84AA8C66CF"
      })
    ])
    for (const source of bp033UsbCProjectFootprintGeometry.sources) {
      expect(retainedEvidenceHash(source.artifactPath)).toBe(source.sha256)
    }
  })

  it("renders one 12-land electrical row and four slots plus two drawing holes", () => {
    const json = renderProjectFootprint()
    const pads = json.filter(isSmtPad)
    const holes = json.filter(isHole)
    expect(pads).toHaveLength(12)
    expect(holes).toHaveLength(6)
    expect(pads.filter((pad) => pad.width === 0.6)).toHaveLength(4)
    expect(pads.filter((pad) => pad.width === 0.3)).toHaveLength(8)
    expect(pads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ port_hints: ["pin1", "A1", "B12"], x: -3.2, y: 4.745, width: 0.6, height: 1.15 }),
        expect.objectContaining({ port_hints: ["pin2", "A4", "B9"], x: -2.4, y: 4.745, width: 0.6, height: 1.15 }),
        expect.objectContaining({ port_hints: ["pin11", "B4", "A9"], x: 2.4, y: 4.745, width: 0.6, height: 1.15 }),
        expect.objectContaining({ port_hints: ["pin12", "B1", "A12"], x: 3.2, y: 4.745, width: 0.6, height: 1.15 }),
        expect.objectContaining({ port_hints: ["pin3", "B8"], x: -1.75, y: 4.745, width: 0.3, height: 1.15 }),
        expect.objectContaining({ port_hints: ["pin10", "A8"], x: 1.75, y: 4.745, width: 0.3, height: 1.15 })
      ])
    )
    expect(holes.filter((hole) => hole.hole_shape === "pill")).toHaveLength(4)
    expect(holes.filter((hole) => hole.hole_shape === "circle")).toHaveLength(2)
    expect(holes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ hole_shape: "pill", hole_width: 1.17, hole_height: 2.1, x: -4.32, y: 4.18 }),
        expect.objectContaining({ hole_shape: "pill", hole_width: 1.4, hole_height: 1.8, x: 4.32, y: 0 }),
        expect.objectContaining({ hole_shape: "circle", hole_diameter: 0.65, x: -2.89, y: 3.68 }),
        expect.objectContaining({ hole_shape: "circle", hole_diameter: 0.65, x: 2.89, y: 3.68 })
      ])
    )
    expect(json.filter((element) => element.type === "pcb_courtyard_rect" || element.type === "pcb_keepout")).toEqual(
      []
    )
    expect(json.filter((element) => element.type.endsWith("_error"))).toEqual([])
  })

  it("preserves the merged-net topology published by the drawing", () => {
    expect(
      bp033UsbCProjectFootprintGeometry.manufacturerRecommendedLayout.electricalLands.map((land) => ({
        sourcePins: land.sourcePins,
        widthMm: land.widthMm,
        netClass: land.netClass,
        signalName: land.signalName
      }))
    ).toEqual([
      { sourcePins: ["A1", "B12"], widthMm: 0.6, netClass: "combined-power-ground", signalName: "GND" },
      { sourcePins: ["A4", "B9"], widthMm: 0.6, netClass: "combined-power-ground", signalName: "VBUS" },
      { sourcePins: ["B8"], widthMm: 0.3, netClass: "signal", signalName: "SBU2" },
      { sourcePins: ["A5"], widthMm: 0.3, netClass: "signal", signalName: "CC1" },
      { sourcePins: ["B7"], widthMm: 0.3, netClass: "signal", signalName: "Dn2" },
      { sourcePins: ["A6"], widthMm: 0.3, netClass: "signal", signalName: "Dp1" },
      { sourcePins: ["A7"], widthMm: 0.3, netClass: "signal", signalName: "Dn1" },
      { sourcePins: ["B6"], widthMm: 0.3, netClass: "signal", signalName: "Dp2" },
      { sourcePins: ["B5"], widthMm: 0.3, netClass: "signal", signalName: "CC2" },
      { sourcePins: ["A8"], widthMm: 0.3, netClass: "signal", signalName: "SBU1" },
      { sourcePins: ["B4", "A9"], widthMm: 0.6, netClass: "combined-power-ground", signalName: "VBUS" },
      { sourcePins: ["B1", "A12"], widthMm: 0.6, netClass: "combined-power-ground", signalName: "GND" }
    ])
  })

  it("rejects a mirrored land row or a substituted source row", () => {
    const mirrored = structuredClone(bp033UsbCProjectFootprintGeometry) as unknown as {
      manufacturerRecommendedLayout: { electricalLands: Array<{ xMm: number }> }
    }
    mirrored.manufacturerRecommendedLayout.electricalLands[0]!.xMm = 3.2
    expect(() => validateBp033UsbCProjectFootprintGeometry(mirrored)).toThrow(RangeError)

    const substituted = structuredClone(bp033UsbCProjectFootprintGeometry) as unknown as {
      manufacturerRecommendedLayout: { electricalLands: Array<{ sourcePins: string[] }> }
    }
    substituted.manufacturerRecommendedLayout.electricalLands[2]!.sourcePins = ["A5"]
    expect(() => validateBp033UsbCProjectFootprintGeometry(substituted)).toThrow(RangeError)
  })

  it("rejects changed manufacturer slots or product-edge datum wording", () => {
    const slotChanged = structuredClone(bp033UsbCProjectFootprintGeometry) as unknown as {
      manufacturerRecommendedLayout: { mountingSlots: Array<{ heightMm: number }> }
    }
    slotChanged.manufacturerRecommendedLayout.mountingSlots[0]!.heightMm = 2.2
    expect(() => validateBp033UsbCProjectFootprintGeometry(slotChanged)).toThrow(RangeError)

    const edgeChanged = structuredClone(bp033UsbCProjectFootprintGeometry) as unknown as {
      manufacturerRecommendedLayout: { productEdge: { sourceDimension: string } }
    }
    edgeChanged.manufacturerRecommendedLayout.productEdge.sourceDimension = "invented offset"
    expect(() => validateBp033UsbCProjectFootprintGeometry(edgeChanged)).toThrow(RangeError)
  })

  it("hashes the actual manufacturer-layout artwork", () => {
    expect(renderedGeometryHash()).toBe("b6d264d31dc2d45a2f62e45e814cf6c82680fa905e1607fadad8cb7443e8b8db")
  })
})
