import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  bp033Tps25730aRefProjectFootprintGeometry,
  Bp033Tps25730aRefProjectFootprint
} from "./bp033-tps25730a-ref-project-footprint.js"
import { renderTestCircuit } from "./test-helper.js"

function renderProjectFootprint() {
  return renderTestCircuit(<Bp033Tps25730aRefProjectFootprint />)
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

function area(element: { readonly height: number; readonly width: number }) {
  return element.width * element.height
}

function roundedMillimetres(value: number) {
  return Number(value.toFixed(3))
}

describe("BP-033 TPS25730ADREFR REF0038A project footprint", () => {
  it("binds the exact TI orderable, REF package, retained source, and denied authority", () => {
    expect(bp033Tps25730aRefProjectFootprintGeometry).toMatchObject({
      reference: "U_USB_PD",
      manufacturer: "Texas Instruments",
      orderablePartNumber: "TPS25730ADREFR",
      devicePartNumber: "TPS25730AD",
      package: { packageDrawing: "REF0038A", pitchMm: 0.4 },
      manufacturerCad: { state: "not-acquired", authority: "deny" },
      orientation: { boardRotationDegrees: 0, pinOne: { id: "1", xMm: -2.925, yMm: 1 }, independentlyReviewed: false },
      acceptance: { boardImportAccepted: false, fabricationAuthorized: false, releaseState: "deny" }
    })
    for (const source of bp033Tps25730aRefProjectFootprintGeometry.sources) {
      expect(retainedEvidenceHash(source.artifactPath)).toBe(source.sha256)
    }
  })

  it("renders 38 TI perimeter pads, both exposed pads, DRC-only courtyard, and source-area stencil apertures", () => {
    const json = renderProjectFootprint()
    const pads = json.filter(isRectSmtPad)
    expect(pads).toHaveLength(40)
    expect(pads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ x: -2.925, y: 1, width: 0.55, height: 0.2, soldermask_margin: 0.05 }),
        expect.objectContaining({ x: -2.4, y: -1.925, width: 0.2, height: 0.55, soldermask_margin: 0.05 }),
        expect.objectContaining({ x: 2.925, y: -1, width: 0.55, height: 0.2, soldermask_margin: 0.05 }),
        expect.objectContaining({ x: 2.4, y: 1.925, width: 0.2, height: 0.55, soldermask_margin: 0.05 }),
        expect.objectContaining({ x: -0.5625, y: 0, width: 2.075, height: 2.65 }),
        expect.objectContaining({ x: 1.4, y: 0, width: 1.56, height: 2.65 })
      ])
    )
    expect(json.filter(isCourtyardRect)).toEqual(
      expect.arrayContaining([expect.objectContaining({ center: { x: 0, y: 0 }, width: 7, height: 5 })])
    )
    const paste = json.filter(isRectSolderPaste)
    const pad39 = pads.find((pad) => pad.x === -0.5625 && pad.y === 0)
    const pad40 = pads.find((pad) => pad.x === 1.4 && pad.y === 0)
    const paste39 = paste.find((aperture) => aperture.x === -0.5625 && aperture.y === 0)
    const paste40 = paste.find((aperture) => aperture.x === 1.4 && aperture.y === 0)
    if (pad39 === undefined || pad40 === undefined || paste39 === undefined || paste40 === undefined)
      throw new Error("TPS25730ADREFR exposed-pad render is incomplete")
    expect(area(paste39) / area(pad39)).toBeCloseTo(0.78, 6)
    expect(area(paste40) / area(pad40)).toBeCloseTo(0.8, 6)
    expect(json.filter((element) => element.type.endsWith("_error"))).toEqual([])
  })

  it("preserves the TI top-view counter-clockwise pin sequence and hashes the rendered project geometry", () => {
    expect(bp033Tps25730aRefProjectFootprintGeometry.copper.peripheralPads).toHaveLength(38)
    expect(
      bp033Tps25730aRefProjectFootprintGeometry.copper.peripheralPads.slice(0, 7).map((pad) => ({
        ...pad,
        xMm: roundedMillimetres(pad.xMm),
        yMm: roundedMillimetres(pad.yMm)
      }))
    ).toEqual([
      { id: "1", role: "LDO_3V3", xMm: -2.925, yMm: 1, widthMm: 0.55, heightMm: 0.2 },
      { id: "2", role: "ADCIN1", xMm: -2.925, yMm: 0.6, widthMm: 0.55, heightMm: 0.2 },
      { id: "3", role: "ADCIN2", xMm: -2.925, yMm: 0.2, widthMm: 0.55, heightMm: 0.2 },
      { id: "4", role: "LDO_1V5", xMm: -2.925, yMm: -0.2, widthMm: 0.55, heightMm: 0.2 },
      { id: "5", role: "ADCIN3", xMm: -2.925, yMm: -0.6, widthMm: 0.55, heightMm: 0.2 },
      { id: "6", role: "CAP_MIS", xMm: -2.925, yMm: -1, widthMm: 0.55, heightMm: 0.2 },
      { id: "7", role: "I2Ct_SDA", xMm: -2.4, yMm: -1.925, widthMm: 0.2, heightMm: 0.55 }
    ])
    const lastPeripheralPad = bp033Tps25730aRefProjectFootprintGeometry.copper.peripheralPads.at(-1)
    if (lastPeripheralPad === undefined) throw new Error("TPS25730ADREFR pin 38 is missing")
    expect({
      ...lastPeripheralPad,
      xMm: roundedMillimetres(lastPeripheralPad.xMm),
      yMm: roundedMillimetres(lastPeripheralPad.yMm)
    }).toEqual({
      id: "38",
      role: "VIN_3V3",
      xMm: -2.4,
      yMm: 1.925,
      widthMm: 0.2,
      heightMm: 0.55
    })
    expect(renderedGeometryHash()).toBe("b35cde8711ffe20c9c1f38804c2e885bc7caa610db4f9bb5243f760a00e3e7e0")
  })
})
