import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  bp032Stm32G474Ret3TrLqfp64FootprintEvidence,
  Bp032Stm32G474Ret3TrLqfp64CandidateFootprint,
  validateBp032Stm32G474Ret3TrLqfp64FootprintEvidence
} from "./bp032-stm32g474ret3tr-lqfp64-footprint.js"
import { renderTestCircuit } from "./test-helper.js"

type CircuitElement = ReturnType<typeof renderTestCircuit>[number]
type RectSmtPad = Extract<CircuitElement, { readonly type: "pcb_smtpad" }> & {
  readonly shape: "rect"
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly soldermask_margin: number
  readonly port_hints: readonly string[]
}
type RectPaste = Extract<CircuitElement, { readonly type: "pcb_solder_paste" }> & {
  readonly shape: "rect"
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

function isRectSmtPad(element: CircuitElement): element is RectSmtPad {
  return (
    element.type === "pcb_smtpad" &&
    element.shape === "rect" &&
    typeof element.x === "number" &&
    typeof element.y === "number" &&
    typeof element.width === "number" &&
    typeof element.height === "number" &&
    typeof element.soldermask_margin === "number" &&
    Array.isArray(element.port_hints) &&
    typeof element.port_hints[0] === "string"
  )
}

function isRectPaste(element: CircuitElement): element is RectPaste {
  return (
    element.type === "pcb_solder_paste" &&
    element.shape === "rect" &&
    typeof element.x === "number" &&
    typeof element.y === "number" &&
    typeof element.width === "number" &&
    typeof element.height === "number"
  )
}

function rendered() {
  return renderTestCircuit(<Bp032Stm32G474Ret3TrLqfp64CandidateFootprint />)
}

function retainedSourceHash() {
  const bytes = readFileSync(
    new URL("../docs/evidence/bp-125/st-stm32g474re-ds12288-rev6-datasheet.pdf", import.meta.url)
  )
  return createHash("sha256").update(bytes).digest("hex").toUpperCase()
}

describe("BP-032 STM32G474RET3TR LQFP64 candidate footprint", () => {
  it("binds the exact MPN, retained DS12288 Rev 6 bytes, and honest CAD disposition", () => {
    expect(validateBp032Stm32G474Ret3TrLqfp64FootprintEvidence()).toEqual([])
    expect(retainedSourceHash()).toBe(bp032Stm32G474Ret3TrLqfp64FootprintEvidence.source.sha256)
    expect(bp032Stm32G474Ret3TrLqfp64FootprintEvidence).toMatchObject({
      artifactKind: "bp032-stm32g474ret3tr-lqfp64-footprint-evidence",
      workUnit: "BP-032",
      source: {
        manufacturerPartNumber: "STM32G474RET3TR",
        documentNumber: "DS12288",
        revision: "6",
        packageDrawingEvidence: {
          recommendedFootprintFigure: "Figure 63 LQFP64 - Recommended footprint"
        },
        cad: {
          state: "not-acquired",
          authority: "deny",
          listedSuppliers: ["Ultra Librarian", "SamacSys"],
          retainedArtifactPath: null
        }
      },
      package: {
        package: "LQFP64",
        pinCount: 64,
        body: {
          nominalLengthMm: 10,
          nominalWidthMm: 10,
          heightMm: { minimum: 1.35, nominal: 1.4, maximum: 1.45 }
        },
        leadPitchMm: 0.5,
        recommendedCopper: {
          tangentialWidthMm: 0.3,
          radialLengthMm: 1.2,
          innerPadEdgeSpanMm: 10.3,
          outerPadEdgeSpanMm: 12.7,
          tangentialOuterEdgeSpanMm: 7.8
        }
      },
      pinOne: { pin: 1, coordinatesMm: { x: -3.75, y: -5.75 }, boardRotationDegrees: 0 },
      fabricationAuthority: "deny",
      accepted: false
    })
  })

  it("derives 64 pads, four 16-pad rows, pitch, spans, and pin-one numbering from Figure 63", () => {
    const pads = bp032Stm32G474Ret3TrLqfp64FootprintEvidence.pads
    expect(pads).toHaveLength(64)
    expect(pads.map((pad) => pad.pin)).toEqual(Array.from({ length: 64 }, (_, index) => index + 1))
    expect(pads.filter((pad) => pad.side === "bottom")).toHaveLength(16)
    expect(pads.filter((pad) => pad.side === "right")).toHaveLength(16)
    expect(pads.filter((pad) => pad.side === "top")).toHaveLength(16)
    expect(pads.filter((pad) => pad.side === "left")).toHaveLength(16)
    expect(pads.slice(0, 16).map((pad) => pad.xMm)).toEqual(
      Array.from({ length: 16 }, (_, index) => -3.75 + index * 0.5)
    )
    expect(pads.slice(16, 32).map((pad) => pad.yMm)).toEqual(
      Array.from({ length: 16 }, (_, index) => -3.75 + index * 0.5)
    )
    expect(pads.slice(32, 48).map((pad) => pad.xMm)).toEqual(
      Array.from({ length: 16 }, (_, index) => 3.75 - index * 0.5)
    )
    expect(pads.slice(48, 64).map((pad) => pad.yMm)).toEqual(
      Array.from({ length: 16 }, (_, index) => 3.75 - index * 0.5)
    )
    const copperMinimumX = Math.min(...pads.map((pad) => pad.xMm - pad.widthMm / 2))
    const copperMaximumX = Math.max(...pads.map((pad) => pad.xMm + pad.widthMm / 2))
    const copperMinimumY = Math.min(...pads.map((pad) => pad.yMm - pad.heightMm / 2))
    const copperMaximumY = Math.max(...pads.map((pad) => pad.yMm + pad.heightMm / 2))
    expect(copperMaximumX - copperMinimumX).toBeCloseTo(12.7, 10)
    expect(copperMaximumY - copperMinimumY).toBeCloseTo(12.7, 10)
    expect(bp032Stm32G474Ret3TrLqfp64FootprintEvidence.pinOne).toMatchObject({
      pin: 1,
      coordinatesMm: { x: pads[0].xMm, y: pads[0].yMm }
    })
  })

  it("renders actual copper, solder-mask, paste, courtyard, and pin-one marker geometry", () => {
    const json = rendered()
    const pads = json
      .filter(isRectSmtPad)
      .toSorted((left, right) => Number(left.port_hints[0]) - Number(right.port_hints[0]))
    const paste = json.filter(isRectPaste).toSorted((left, right) => left.x - right.x || left.y - right.y)
    const courtyard = json.find((element) => element.type === "pcb_courtyard_rect")
    const marker = json.find((element) => element.type === "pcb_silkscreen_circle")
    expect(pads).toHaveLength(64)
    expect(paste).toHaveLength(64)
    expect(courtyard).toMatchObject({ center: { x: 0, y: 0 }, width: 13.2, height: 13.2 })
    expect(marker).toMatchObject({ center: { x: -5.35, y: -5.35 }, radius: 0.25 })

    for (const pad of pads) {
      const radial = pad.width < pad.height
      const expectedWidth = radial ? 0.3 : 1.2
      const expectedHeight = radial ? 1.2 : 0.3
      expect(pad.width).toBeCloseTo(expectedWidth, 10)
      expect(pad.height).toBeCloseTo(expectedHeight, 10)
      expect(pad.soldermask_margin).toBeCloseTo(0.05, 10)
      expect(pad.width + 2 * pad.soldermask_margin).toBeCloseTo(radial ? 0.4 : 1.3, 10)
      expect(pad.height + 2 * pad.soldermask_margin).toBeCloseTo(radial ? 1.3 : 0.4, 10)
    }
    const pasteByLocation = new Map(paste.map((aperture) => [`${aperture.x},${aperture.y}`, aperture]))
    for (const pad of pads) {
      const aperture = pasteByLocation.get(`${pad.x},${pad.y}`)
      expect(aperture).toBeDefined()
      if (aperture === undefined) continue
      expect(aperture.width).toBeCloseTo(pad.width - 0.1, 10)
      expect(aperture.height).toBeCloseTo(pad.height - 0.1, 10)
    }
  })

  it("rejects geometry drift and keeps the candidate denied", () => {
    const drifted = {
      ...bp032Stm32G474Ret3TrLqfp64FootprintEvidence,
      projectGeometry: {
        ...bp032Stm32G474Ret3TrLqfp64FootprintEvidence.projectGeometry,
        courtyard: {
          ...bp032Stm32G474Ret3TrLqfp64FootprintEvidence.projectGeometry.courtyard,
          widthMm: 13.19
        }
      }
    }
    expect(
      validateBp032Stm32G474Ret3TrLqfp64FootprintEvidence(drifted as typeof bp032Stm32G474Ret3TrLqfp64FootprintEvidence)
    ).toContain("courtyard must enclose body and outer copper span with its stated clearance")
    expect(bp032Stm32G474Ret3TrLqfp64FootprintEvidence.fabricationAuthority).toBe("deny")
    expect(bp032Stm32G474Ret3TrLqfp64FootprintEvidence.accepted).toBe(false)
  })
})
