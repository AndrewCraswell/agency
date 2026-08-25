import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  bp031Tpd4e05u06DqaProjectFootprintGeometry,
  Bp031Tpd4e05u06DqaProjectFootprint,
  validateBp031Tpd4e05u06DqaProjectFootprint
} from "./bp031-tpd4e05u06-dqa-project-footprint.js"
import { oneChannelAnalogExperimentBom } from "./one-channel-analog-readiness.js"
import { renderTestCircuit } from "./test-helper.js"

type CircuitElement = ReturnType<typeof renderTestCircuit>[number]

function isRectSmtPad(
  element: CircuitElement
): element is Extract<CircuitElement, { type: "pcb_smtpad"; shape: "rect" }> {
  return element.type === "pcb_smtpad" && element.shape === "rect"
}

function isRectSolderPaste(
  element: CircuitElement
): element is Extract<CircuitElement, { type: "pcb_solder_paste"; shape: "rect" }> {
  return element.type === "pcb_solder_paste" && element.shape === "rect"
}

function isCourtyardRect(element: CircuitElement): element is Extract<CircuitElement, { type: "pcb_courtyard_rect" }> {
  return element.type === "pcb_courtyard_rect"
}

function renderProjectFootprint() {
  return renderTestCircuit(<Bp031Tpd4e05u06DqaProjectFootprint />)
}

function retainedEvidenceHash(artifactPath: string) {
  const packageRelativePath = artifactPath.replace("packages/scoring-circuit/", "../")
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
        type: element.type,
        width: element.width,
        x: element.x,
        y: element.y
      })
    }
    if (isRectSolderPaste(element)) {
      geometry.push({
        height: element.height,
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
  return createHash("sha256").update(JSON.stringify(geometry)).digest("hex").toUpperCase()
}

describe("BP-031 TPD4E05U06DQAR DQA project footprint", () => {
  it("binds exact TI identity, pin functions, source bytes, and denied CAD state", () => {
    expect(validateBp031Tpd4e05u06DqaProjectFootprint()).toEqual([])
    expect(bp031Tpd4e05u06DqaProjectFootprintGeometry).toMatchObject({
      workUnit: "BP-031",
      reference: "U_ESD",
      affectedReferences: ["U_ESD_1", "U_ESD_2", "U_ESD_3", "U_ESD_4", "U_ESD_5", "U_ESD_6", "U_ESD_7"],
      manufacturer: "Texas Instruments",
      manufacturerPartNumber: "TPD4E05U06DQAR",
      package: {
        designation: "DQA0010A USON-10",
        packageType: "USON",
        pinCount: 10,
        pitchMm: 0.5,
        rowCenterSpanMm: 0.835,
        exposedGroundPads: [3, 8]
      },
      manufacturerCad: { state: "not-acquired", artifactPath: null, sha256: null, authority: "deny" },
      acceptance: {
        packageIdentityReviewed: true,
        packageDrawingReviewed: true,
        pinFunctionsReviewed: true,
        projectGeometryAccepted: false,
        pinOneOrientationAccepted: false,
        cadImportAccepted: false,
        boardFitAccepted: false,
        fabricationAuthorized: false,
        releaseState: "deny"
      }
    })
    expect(bp031Tpd4e05u06DqaProjectFootprintGeometry.pinFunctions.map(({ pin, name }) => [pin, name])).toEqual([
      [1, "D1+"],
      [2, "D1-"],
      [3, "GND"],
      [4, "D2+"],
      [5, "D2-"],
      [6, "NC"],
      [7, "NC"],
      [8, "GND"],
      [9, "NC"],
      [10, "NC"]
    ])
    for (const source of bp031Tpd4e05u06DqaProjectFootprintGeometry.sources) {
      expect(retainedEvidenceHash(source.artifactPath)).toBe(source.sha256)
      expect(source).toMatchObject({
        reviewedPages: "4, 20, 28-30, 37",
        pagePurposes: {
          pinMapAndFunctions: "4",
          exactOrderableAndPackage: "20, 37",
          dqaOutlineLandPatternAndStencil: "28-30"
        }
      })
    }
    const canonicalPart = oneChannelAnalogExperimentBom.find((part) => part.reference === "U_ESD")
    expect(canonicalPart).toMatchObject({
      manufacturer: "Texas Instruments",
      mpn: "TPD4E05U06DQAR",
      package: "DQA USON-10"
    })
  })

  it("derives all ten pad coordinates and TI copper, mask, paste, and courtyard inputs", () => {
    const evidence = bp031Tpd4e05u06DqaProjectFootprintGeometry
    expect(evidence.terminals).toEqual([
      {
        pin: 1,
        name: "D1+",
        xMm: -0.4175,
        yMm: -1,
        copperWidthMm: 0.565,
        copperHeightMm: 0.2,
        solderPasteReductionPerEdgeMm: 0
      },
      {
        pin: 2,
        name: "D1-",
        xMm: -0.4175,
        yMm: -0.5,
        copperWidthMm: 0.565,
        copperHeightMm: 0.2,
        solderPasteReductionPerEdgeMm: 0
      },
      {
        pin: 3,
        name: "GND",
        xMm: -0.4175,
        yMm: 0,
        copperWidthMm: 0.565,
        copperHeightMm: 0.4,
        solderPasteReductionPerEdgeMm: 0.02
      },
      {
        pin: 4,
        name: "D2+",
        xMm: -0.4175,
        yMm: 0.5,
        copperWidthMm: 0.565,
        copperHeightMm: 0.2,
        solderPasteReductionPerEdgeMm: 0
      },
      {
        pin: 5,
        name: "D2-",
        xMm: -0.4175,
        yMm: 1,
        copperWidthMm: 0.565,
        copperHeightMm: 0.2,
        solderPasteReductionPerEdgeMm: 0
      },
      {
        pin: 6,
        name: "NC",
        xMm: 0.4175,
        yMm: -1,
        copperWidthMm: 0.565,
        copperHeightMm: 0.2,
        solderPasteReductionPerEdgeMm: 0
      },
      {
        pin: 7,
        name: "NC",
        xMm: 0.4175,
        yMm: -0.5,
        copperWidthMm: 0.565,
        copperHeightMm: 0.2,
        solderPasteReductionPerEdgeMm: 0
      },
      {
        pin: 8,
        name: "GND",
        xMm: 0.4175,
        yMm: 0,
        copperWidthMm: 0.565,
        copperHeightMm: 0.4,
        solderPasteReductionPerEdgeMm: 0.02
      },
      {
        pin: 9,
        name: "NC",
        xMm: 0.4175,
        yMm: 0.5,
        copperWidthMm: 0.565,
        copperHeightMm: 0.2,
        solderPasteReductionPerEdgeMm: 0
      },
      {
        pin: 10,
        name: "NC",
        xMm: 0.4175,
        yMm: 1,
        copperWidthMm: 0.565,
        copperHeightMm: 0.2,
        solderPasteReductionPerEdgeMm: 0
      }
    ])
    expect(evidence.projectSelection.solderMask).toMatchObject({
      marginMm: 0.07,
      regularOpeningMm: { width: 0.705, height: 0.34 },
      groundOpeningMm: { width: 0.705, height: 0.54 }
    })
    expect(evidence.projectSelection.solderPaste.regularOpeningMm).toEqual({ width: 0.565, height: 0.2 })
    expect(evidence.projectSelection.solderPaste.groundOpeningMm.width).toBeCloseTo(0.525, 10)
    expect(evidence.projectSelection.solderPaste.groundOpeningMm.height).toBeCloseTo(0.36, 10)
    expect(evidence.projectSelection.courtyard).toMatchObject({
      minimumXMm: -0.95,
      maximumXMm: 0.95,
      minimumYMm: -1.55,
      maximumYMm: 1.55,
      minimumClearanceMm: 0.25
    })
    expect(evidence.pinOne).toMatchObject({
      pin: 1,
      boardCoordinatesMm: { x: -0.4175, y: -1 },
      boardRotationDegrees: 0,
      orientationVerified: false,
      topViewOrdering: {
        pin1: "top-left",
        pin5: "bottom-left",
        pin6: "bottom-right",
        pin10: "top-right"
      }
    })
  })

  it("renders ten pads, pin-one hints, ground-pad paste reductions, and no errors", () => {
    const json = renderProjectFootprint()
    const pads = json.filter(isRectSmtPad)
    expect(pads).toHaveLength(10)
    expect(pads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ x: -0.4175, y: -1, width: 0.565, height: 0.2, soldermask_margin: 0.07 }),
        expect.objectContaining({
          x: -0.4175,
          y: 0,
          width: 0.565,
          height: 0.4,
          soldermask_margin: 0.07,
          port_hints: expect.arrayContaining(["GND"])
        }),
        expect.objectContaining({ x: 0.4175, y: 0, width: 0.565, height: 0.4, soldermask_margin: 0.07 }),
        expect.objectContaining({ x: 0.4175, y: 1, width: 0.565, height: 0.2, soldermask_margin: 0.07 })
      ])
    )
    const paste = json.filter(isRectSolderPaste)
    expect(paste).toHaveLength(10)
    expect(paste).toEqual(
      expect.arrayContaining([expect.objectContaining({ x: -0.4175, y: -1, width: 0.565, height: 0.2 })])
    )
    for (const groundPaste of paste.filter(({ x, y }) => y === 0 && Math.abs(x) === 0.4175)) {
      expect(groundPaste.width).toBeCloseTo(0.525, 10)
      expect(groundPaste.height).toBeCloseTo(0.36, 10)
    }
    expect(paste.filter(({ y }) => y === 0)).toHaveLength(2)
    expect(json.filter(isCourtyardRect)).toEqual(
      expect.arrayContaining([expect.objectContaining({ center: { x: 0, y: 0 }, width: 1.9, height: 3.1 })])
    )
    expect(json.filter((element) => element.type.endsWith("_error"))).toEqual([])
  })

  it("hashes the canonical rendered project geometry", () => {
    expect(renderedGeometryHash()).toBe(bp031Tpd4e05u06DqaProjectFootprintGeometry.artwork.sha256)
  })

  it("fails closed when pad identity or CAD authority is tampered", () => {
    const tampered = structuredClone(
      bp031Tpd4e05u06DqaProjectFootprintGeometry
    ) as unknown as typeof bp031Tpd4e05u06DqaProjectFootprintGeometry
    Reflect.set(tampered.projectSelection.copper.pads[0], "xMm", 0)
    Reflect.set(tampered.manufacturerCad, "authority", "allow")
    const errors = validateBp031Tpd4e05u06DqaProjectFootprint(tampered)
    expect(errors).toEqual(
      expect.arrayContaining([
        "pad 1 identity or geometry drifted",
        "DQA manufacturer CAD must remain explicitly unacquired and denied"
      ])
    )
  })
})
