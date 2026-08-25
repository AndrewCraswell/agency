import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  bp033Tvs2200Pins,
  bp033Tvs2200ProjectFootprintGeometry,
  Bp033Tvs2200ProjectFootprint,
  validateBp033Tvs2200ProjectFootprint
} from "./bp033-tvs2200-project-footprint.js"
import { renderTestCircuit } from "./test-helper.js"

type CircuitElement = ReturnType<typeof renderTestCircuit>[number]

function renderProjectFootprint() {
  return renderTestCircuit(<Bp033Tvs2200ProjectFootprint />)
}

function isRectSmtPad(
  element: CircuitElement
): element is Extract<CircuitElement, { readonly shape: "rect"; readonly type: "pcb_smtpad" }> {
  return element.type === "pcb_smtpad" && element.shape === "rect"
}

function isCourtyardRect(
  element: CircuitElement
): element is Extract<CircuitElement, { readonly type: "pcb_courtyard_rect" }> {
  return element.type === "pcb_courtyard_rect"
}

function isRectSolderPaste(
  element: CircuitElement
): element is Extract<CircuitElement, { readonly shape: "rect"; readonly type: "pcb_solder_paste" }> {
  return element.type === "pcb_solder_paste" && element.shape === "rect"
}

function retainedEvidenceHash(artifactPath: string) {
  const packageRelativePath = artifactPath.replace("docs/", "../docs/")
  return createHash("sha256")
    .update(readFileSync(new URL(packageRelativePath, import.meta.url)))
    .digest("hex")
    .toUpperCase()
}

function renderedGeometryHash() {
  const geometry: Array<Record<string, unknown>> = []
  for (const element of renderProjectFootprint()) {
    if (isRectSmtPad(element)) {
      geometry.push({
        height: element.height,
        shape: element.shape,
        soldermask_margin: element.soldermask_margin,
        solderpaste_margin: element.solderpaste_margin,
        type: element.type,
        width: element.width,
        x: element.x,
        y: element.y
      })
    }
    if (isCourtyardRect(element)) {
      geometry.push({ center: element.center, height: element.height, type: element.type, width: element.width })
    }
  }
  return createHash("sha256").update(JSON.stringify(geometry)).digest("hex")
}

function area(element: { readonly height: number; readonly width: number }) {
  return element.width * element.height
}

describe("BP-033 TVS2200DRVR project footprint", () => {
  it("binds D_VBUS_TVS to the exact orderable, DRV drawing, retained source, and denied authority", () => {
    expect(validateBp033Tvs2200ProjectFootprint()).toBe(true)
    expect(bp033Tvs2200ProjectFootprintGeometry).toMatchObject({
      workUnit: "BP-033",
      reference: "D_VBUS_TVS",
      boardReferenceAlias: "D_USB_PD_VBUS_TVS",
      manufacturerPartNumber: "TVS2200DRVR",
      package: {
        designation: "DRV WSON-6 2x2 mm",
        family: "WSON-6",
        packageDrawing: "DRV0006A",
        pinCount: 6,
        exposedThermalPad: { id: "7", net: "GND", widthMm: 1, heightMm: 1.6 }
      },
      manufacturerCad: { state: "not-acquired", officialCadArtifact: null, authority: "deny" },
      copper: {
        cornerRadiusTypMm: 0.05,
        renderDisposition:
          "TI R0.05 TYP is retained as source guidance; the review renderer uses rectangular pads as an explicit bounded approximation."
      },
      acceptance: {
        cadImportAccepted: false,
        electricalPlacementAccepted: false,
        independentOrientationAccepted: false,
        projectGeometryAccepted: false,
        thermalLayoutAccepted: false,
        solderMaskAccepted: false,
        solderPasteAccepted: false,
        boardFitAccepted: false,
        fabricationAuthorized: false,
        releaseState: "deny"
      }
    })
    expect(bp033Tvs2200ProjectFootprintGeometry.sources).toEqual([
      expect.objectContaining({
        artifactPath: "docs/evidence/bp-033/ti-tvs2200-datasheet.pdf",
        authority: "manufacturer-primary",
        pageCount: 21,
        sha256: "E79BF6F7D5B69FB71EC3DCE566B4B4D63C27BCCAD8561195E5F2F7122B44C801"
      })
    ])
    for (const source of bp033Tvs2200ProjectFootprintGeometry.sources) {
      expect(retainedEvidenceHash(source.artifactPath)).toBe(source.sha256)
    }
  })

  it("hashes the retained TI PDF bytes against the independent literal", () => {
    expect(
      createHash("sha256")
        .update(readFileSync(new URL("../docs/evidence/bp-033/ti-tvs2200-datasheet.pdf", import.meta.url)))
        .digest("hex")
        .toUpperCase()
    ).toBe("E79BF6F7D5B69FB71EC3DCE566B4B4D63C27BCCAD8561195E5F2F7122B44C801")
  })

  it("retains the TI pin and exposed-pad mapping, including the bottom-view/top-view orientation distinction", () => {
    expect(bp033Tvs2200Pins).toEqual([
      { heightMm: 0.3, id: "1", number: 1, role: "GND", widthMm: 0.45, xMm: -0.975, yMm: 0.65 },
      { heightMm: 0.3, id: "2", number: 2, role: "GND", widthMm: 0.45, xMm: -0.975, yMm: 0 },
      { heightMm: 0.3, id: "3", number: 3, role: "GND", widthMm: 0.45, xMm: -0.975, yMm: -0.65 },
      { heightMm: 0.3, id: "4", number: 4, role: "IN", widthMm: 0.45, xMm: 0.975, yMm: -0.65 },
      { heightMm: 0.3, id: "5", number: 5, role: "IN", widthMm: 0.45, xMm: 0.975, yMm: 0 },
      { heightMm: 0.3, id: "6", number: 6, role: "IN", widthMm: 0.45, xMm: 0.975, yMm: 0.65 }
    ])
    expect(bp033Tvs2200ProjectFootprintGeometry.pinMap).toEqual([
      { function: "ground", name: "GND", number: 1 },
      { function: "ground", name: "GND", number: 2 },
      { function: "ground", name: "GND", number: 3 },
      { function: "ESD and surge protected channel", name: "IN", number: 4 },
      { function: "ESD and surge protected channel", name: "IN", number: 5 },
      { function: "ESD and surge protected channel", name: "IN", number: 6 },
      { function: "ground", name: "GND", number: 7 }
    ])
    expect(bp033Tvs2200ProjectFootprintGeometry.orientation).toMatchObject({
      boardView: "top-land-pattern",
      boardRotationDegrees: 0,
      pinOne: { id: "1", xMm: -0.975, yMm: 0.65 },
      packagePinConfiguration: { view: "bottom" }
    })
  })

  it("renders seven copper pads, exact paste margin, no vias, and a review-only courtyard", () => {
    const json = renderProjectFootprint()
    const pads = json.filter(isRectSmtPad)
    expect(pads).toHaveLength(7)
    expect(pads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          port_hints: expect.arrayContaining(["1"]),
          x: -0.975,
          y: 0.65,
          width: 0.45,
          height: 0.3,
          soldermask_margin: 0.07
        }),
        expect.objectContaining({
          port_hints: expect.arrayContaining(["3"]),
          x: -0.975,
          y: -0.65,
          width: 0.45,
          height: 0.3,
          soldermask_margin: 0.07
        }),
        expect.objectContaining({
          port_hints: expect.arrayContaining(["4"]),
          x: 0.975,
          y: -0.65,
          width: 0.45,
          height: 0.3,
          soldermask_margin: 0.07
        }),
        expect.objectContaining({
          port_hints: expect.arrayContaining(["6"]),
          x: 0.975,
          y: 0.65,
          width: 0.45,
          height: 0.3,
          soldermask_margin: 0.07
        }),
        expect.objectContaining({
          port_hints: expect.arrayContaining(["7", "thermal-pad"]),
          x: 0,
          y: 0,
          width: 1,
          height: 1.6,
          soldermask_margin: 0.07
        })
      ])
    )
    const paste = json.filter(isRectSolderPaste)
    const thermalPad = pads.find((pad) => pad.port_hints?.includes("thermal-pad") === true)
    const thermalPaste = paste.find((aperture) => aperture.x === 0 && aperture.y === 0)
    if (thermalPad === undefined || thermalPaste === undefined)
      throw new Error("TVS2200 exposed-pad render is incomplete")
    expect(thermalPaste).toMatchObject({
      height: Number("1.5239281024635393"),
      width: 0.9239281024635393,
      x: 0,
      y: 0
    })
    expect(area(thermalPaste) / area(thermalPad)).toBeCloseTo(0.88, 15)
    expect(json.filter((element) => element.type === "pcb_plated_hole" || element.type === "pcb_hole")).toEqual([])
    expect(json.filter(isCourtyardRect)).toEqual(
      expect.arrayContaining([expect.objectContaining({ center: { x: 0, y: 0 }, width: 2.6, height: 2.6 })])
    )
    expect(json.filter((element) => element.type.endsWith("_error"))).toEqual([])
  })

  it("keeps manufacturer mask, stencil, thermal, placement, board-fit, release, and fabrication gates explicit", () => {
    expect(bp033Tvs2200ProjectFootprintGeometry.manufacturerLandPattern.solderMask).toMatchObject({
      preferredNsmd: { definition: "NSMD", maximumOpeningExpansionPerEdgeMm: 0.07 },
      alternativeSmd: { definition: "SMD", minimumOpeningOverlapPerEdgeMm: 0.07 }
    })
    expect(bp033Tvs2200ProjectFootprintGeometry.paste.manufacturerExample).toMatchObject({
      apertureCount: 2,
      exposedPadId: "7",
      printedCoveragePercent: 88,
      geometricalCoveragePercent: 87.5,
      stencilThicknessMm: 0.125
    })
    expect(bp033Tvs2200ProjectFootprintGeometry.paste.renderedAreaEquivalentAperture).toEqual({
      coveragePercent: 88,
      heightMm: Number("1.5239281024635393"),
      marginPerEdgeMm: Number("0.038035948768230354"),
      widthMm: 0.9239281024635393,
      xMm: 0,
      yMm: 0
    })
    expect(bp033Tvs2200ProjectFootprintGeometry.manufacturerLandPattern.thermalVias).toMatchObject({
      drillDiameterMm: 0.2,
      locations: [
        { xMm: 0, yMm: -0.55 },
        { xMm: 0, yMm: 0.55 }
      ],
      policy: "optional-depending-on-application"
    })
    expect(bp033Tvs2200ProjectFootprintGeometry.paste.manufacturerExample.apertures).toEqual([
      { heightMm: 0.7, id: "7A", widthMm: 1, xMm: 0, yMm: 0.45 },
      { heightMm: 0.7, id: "7B", widthMm: 1, xMm: 0, yMm: -0.45 }
    ])
    expect(bp033Tvs2200ProjectFootprintGeometry.copper).toMatchObject({
      cornerRadiusTypMm: 0.05,
      renderDisposition:
        "TI R0.05 TYP is retained as source guidance; the review renderer uses rectangular pads as an explicit bounded approximation."
    })
    expect(bp033Tvs2200ProjectFootprintGeometry.acceptance).toMatchObject({
      cadImportAccepted: false,
      electricalPlacementAccepted: false,
      independentOrientationAccepted: false,
      projectArtworkRendered: true,
      projectGeometryAccepted: false,
      solderMaskAccepted: false,
      solderPasteAccepted: false,
      thermalLayoutAccepted: false,
      boardFitAccepted: false,
      fabricationAuthorized: false,
      releaseState: "deny"
    })
    expect(bp033Tvs2200ProjectFootprintGeometry.manufacturerCad.authority).toBe("deny")
  })

  it("hashes the actual rendered review geometry", () => {
    expect(renderedGeometryHash()).toBe("949e1e7985bcc8011cd08791432306987193015e3792a836b4f454100ba95476")
  })

  it("rejects source, terminal, and deny-state mutations", () => {
    const sourceDrift = structuredClone(bp033Tvs2200ProjectFootprintGeometry)
    Reflect.set(sourceDrift.sources[0], "url", "https://example.invalid/drift.pdf")
    expect(() => validateBp033Tvs2200ProjectFootprint(sourceDrift)).toThrow()

    const terminalDrift = structuredClone(bp033Tvs2200ProjectFootprintGeometry)
    Reflect.set(terminalDrift.copper.pads[0], "xMm", -0.8)
    expect(() => validateBp033Tvs2200ProjectFootprint(terminalDrift)).toThrow()

    const denyDrift = structuredClone(bp033Tvs2200ProjectFootprintGeometry)
    Reflect.set(denyDrift.thermal, "layoutState", "accepted")
    Reflect.set(denyDrift.orientation, "independentlyReviewed", true)
    expect(() => validateBp033Tvs2200ProjectFootprint(denyDrift)).toThrow()

    const viaMetadataDrift = structuredClone(bp033Tvs2200ProjectFootprintGeometry)
    Reflect.set(viaMetadataDrift.thermal.viaLocations[0], "yMm", -0.5)
    expect(() => validateBp033Tvs2200ProjectFootprint(viaMetadataDrift)).toThrow()
  })
})
