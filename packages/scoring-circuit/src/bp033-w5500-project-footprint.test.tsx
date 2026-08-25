import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  bp033W5500ProjectFootprintGeometry,
  Bp033W5500ProjectFootprint,
  validateBp033W5500ProjectFootprintGeometry
} from "./bp033-w5500-project-footprint.js"
import { renderTestCircuit } from "./test-helper.js"

function renderProjectFootprint() {
  return renderTestCircuit(<Bp033W5500ProjectFootprint />)
}

type CircuitElement = ReturnType<typeof renderTestCircuit>[number]

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

function renderedGeometryHash() {
  const geometry: Array<Record<string, unknown>> = []
  for (const element of renderProjectFootprint()) {
    if (isRectSmtPad(element)) {
      geometry.push({
        height: element.height,
        shape: element.shape,
        soldermask_margin: element.soldermask_margin,
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

function retainedEvidenceHash(artifactPath: string) {
  const packageRelativePath = artifactPath.replace("docs/", "../docs/")
  return createHash("sha256")
    .update(readFileSync(new URL(packageRelativePath, import.meta.url)))
    .digest("hex")
    .toUpperCase()
}

describe("BP-033 W5500 project footprint", () => {
  it("freezes the public evidence and rejects identity, geometry, and release drift", () => {
    expect(validateBp033W5500ProjectFootprintGeometry()).toBe(true)
    expect(Object.isFrozen(bp033W5500ProjectFootprintGeometry)).toBe(true)
    expect(Object.isFrozen(bp033W5500ProjectFootprintGeometry.terminals[0])).toBe(true)

    for (const mutate of [
      (candidate: any) => (candidate.manufacturerPartNumber = "W5500L"),
      (candidate: any) => (candidate.terminals[0].xMm = -4.3),
      (candidate: any) => (candidate.pinOne.orientationVerified = true),
      (candidate: any) => (candidate.acceptance.projectGeometryAccepted = true),
      (candidate: any) => (candidate.acceptance.fabricationAuthorized = true),
      (candidate: any) => (candidate.acceptance.releaseState = "allow")
    ]) {
      const candidate = structuredClone(bp033W5500ProjectFootprintGeometry)
      mutate(candidate)
      expect(() => validateBp033W5500ProjectFootprintGeometry(candidate)).toThrow(RangeError)
    }
  })

  it("rejects hidden, symbol, getter, prototype, cycle, and alias graph attacks", () => {
    const attacks = [
      (candidate: any) => Object.defineProperty(candidate, "hidden", { value: true }),
      (candidate: any) => Object.defineProperty(candidate, Symbol("hidden"), { value: true }),
      (candidate: any) => Object.defineProperty(candidate, "reference", { get: () => "U_W5500" }),
      (candidate: any) => Object.setPrototypeOf(candidate.package, null),
      (candidate: any) => (candidate.package.loop = candidate),
      (candidate: any) => (candidate.terminals[1] = candidate.terminals[0])
    ]
    for (const attack of attacks) {
      const candidate = structuredClone(bp033W5500ProjectFootprintGeometry)
      attack(candidate)
      expect(() => validateBp033W5500ProjectFootprintGeometry(candidate)).toThrow(RangeError)
    }
  })

  it("binds the exact post-2021 LQFP-48 source and leaves every release gate denied", () => {
    expect(bp033W5500ProjectFootprintGeometry).toMatchObject({
      workUnit: "BP-033",
      reference: "U_W5500",
      manufacturer: "WIZnet",
      manufacturerPartNumber: "W5500",
      manufacturerCad: { state: "not-acquired", authority: "deny" },
      package: {
        designation: "48-pin LQFP, JEDEC MS-026 BBC",
        bodySizeMm: 7,
        leadTipSpanMm: 9,
        pitchMm: 0.5,
        thermalPad: { exists: false, copperPad: null, maskOpening: null, pasteOpening: null }
      },
      pinOne: { pin: 1, boardCoordinatesMm: { x: -4.35, y: 2.75 }, boardRotationDegrees: 0 },
      acceptance: {
        projectGeometryAccepted: false,
        pinOneOrientationAccepted: false,
        cadImportAccepted: false,
        thermalPadDispositionAccepted: false,
        boardFitAccepted: false,
        fabricationAuthorized: false,
        releaseState: "deny"
      }
    })
    expect(bp033W5500ProjectFootprintGeometry.sources).toEqual([
      expect.objectContaining({
        authority: "manufacturer-primary",
        artifactPath: "docs/evidence/bp-033/wiznet-w5500-datasheet.pdf",
        sha256: "7B826B808084CCD986BCC22904C00A07A508EF42FB93D079FE7150A4C4F1A63D"
      })
    ])
    for (const source of bp033W5500ProjectFootprintGeometry.sources) {
      expect(retainedEvidenceHash(source.artifactPath)).toBe(source.sha256)
    }
  })

  it("renders 48 peripheral pads, no central thermal pad, and the declared mask, paste, and courtyard inputs", () => {
    const json = renderProjectFootprint()
    const pads = json.filter(isRectSmtPad)
    expect(pads).toHaveLength(48)
    expect(pads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ x: -4.35, y: 2.75, width: 1.5, height: 0.3, soldermask_margin: 0.05 }),
        expect.objectContaining({ x: -2.75, y: -4.35, width: 0.3, height: 1.5, soldermask_margin: 0.05 }),
        expect.objectContaining({ x: 4.35, y: -2.75, width: 1.5, height: 0.3, soldermask_margin: 0.05 }),
        expect.objectContaining({ x: 2.75, y: 4.35, width: 0.3, height: 1.5, soldermask_margin: 0.05 })
      ])
    )
    expect(pads.filter((pad) => pad.x === 0 && pad.y === 0)).toEqual([])
    const paste = json.filter(isRectSolderPaste)
    expect(paste).toHaveLength(48)
    const pinOnePaste = paste.find((aperture) => aperture.x === -4.35 && aperture.y === 2.75)
    const pinThirteenPaste = paste.find((aperture) => aperture.x === -2.75 && aperture.y === -4.35)
    expect(pinOnePaste?.width).toBeCloseTo(1.4)
    expect(pinOnePaste?.height).toBeCloseTo(0.2)
    expect(pinThirteenPaste?.width).toBeCloseTo(0.2)
    expect(pinThirteenPaste?.height).toBeCloseTo(1.4)
    expect(json.filter(isCourtyardRect)).toEqual(
      expect.arrayContaining([expect.objectContaining({ center: { x: 0, y: 0 }, width: 10.8, height: 10.8 })])
    )
    expect(json.filter((element) => element.type.endsWith("_error"))).toEqual([])
  })

  it("preserves the Figure 26 pin-one sequence around all four sides", () => {
    expect(bp033W5500ProjectFootprintGeometry.terminals).toHaveLength(48)
    expect(bp033W5500ProjectFootprintGeometry.terminals.slice(0, 13)).toEqual([
      { pin: 1, side: "left", xMm: -4.35, yMm: 2.75, copperWidthMm: 1.5, copperHeightMm: 0.3 },
      { pin: 2, side: "left", xMm: -4.35, yMm: 2.25, copperWidthMm: 1.5, copperHeightMm: 0.3 },
      { pin: 3, side: "left", xMm: -4.35, yMm: 1.75, copperWidthMm: 1.5, copperHeightMm: 0.3 },
      { pin: 4, side: "left", xMm: -4.35, yMm: 1.25, copperWidthMm: 1.5, copperHeightMm: 0.3 },
      { pin: 5, side: "left", xMm: -4.35, yMm: 0.75, copperWidthMm: 1.5, copperHeightMm: 0.3 },
      { pin: 6, side: "left", xMm: -4.35, yMm: 0.25, copperWidthMm: 1.5, copperHeightMm: 0.3 },
      { pin: 7, side: "left", xMm: -4.35, yMm: -0.25, copperWidthMm: 1.5, copperHeightMm: 0.3 },
      { pin: 8, side: "left", xMm: -4.35, yMm: -0.75, copperWidthMm: 1.5, copperHeightMm: 0.3 },
      { pin: 9, side: "left", xMm: -4.35, yMm: -1.25, copperWidthMm: 1.5, copperHeightMm: 0.3 },
      { pin: 10, side: "left", xMm: -4.35, yMm: -1.75, copperWidthMm: 1.5, copperHeightMm: 0.3 },
      { pin: 11, side: "left", xMm: -4.35, yMm: -2.25, copperWidthMm: 1.5, copperHeightMm: 0.3 },
      { pin: 12, side: "left", xMm: -4.35, yMm: -2.75, copperWidthMm: 1.5, copperHeightMm: 0.3 },
      { pin: 13, side: "bottom", xMm: -2.75, yMm: -4.35, copperWidthMm: 0.3, copperHeightMm: 1.5 }
    ])
    expect(bp033W5500ProjectFootprintGeometry.terminals.at(-1)).toEqual({
      pin: 48,
      side: "top",
      xMm: -2.75,
      yMm: 4.35,
      copperWidthMm: 0.3,
      copperHeightMm: 1.5
    })
  })

  it("hashes the actual rendered project geometry", () => {
    expect(renderedGeometryHash()).toBe("870409b1d1c0df464a839f9d383e9a2d2b50c689e426a3e3d488a4e2529a80ef")
  })
})
