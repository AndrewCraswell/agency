import { createHash } from "node:crypto"
import { describe, expect, it } from "vitest"
import {
  benchPrototypeEra3aProjectFootprintGeometry,
  BenchPrototypeEra3aProjectFootprint
} from "./bench-prototype-era3a-project-footprint.js"
import { renderTestCircuit } from "./test-helper.js"

function renderProjectFootprint() {
  return renderTestCircuit(<BenchPrototypeEra3aProjectFootprint />)
}

type CircuitElement = ReturnType<typeof renderTestCircuit>[number]

function isRectSmtPad(
  element: CircuitElement
): element is Extract<CircuitElement, { shape: "rect"; type: "pcb_smtpad" }> {
  return element.type === "pcb_smtpad" && element.shape === "rect"
}

function isCourtyardRect(element: CircuitElement): element is Extract<CircuitElement, { type: "pcb_courtyard_rect" }> {
  return element.type === "pcb_courtyard_rect"
}

function renderedGeometryHash() {
  const json = renderProjectFootprint()
  const geometry: Array<Record<string, unknown>> = []
  for (const element of json) {
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

describe("BP-031 Panasonic ERA3AEB2491V project footprint", () => {
  it("bounds the exact source-resistor footprint and keeps release denied", () => {
    expect(benchPrototypeEra3aProjectFootprintGeometry).toMatchObject({
      artifactKind: "bp031-era3aeb2491v-project-footprint",
      workUnit: "BP-031",
      manufacturerPartNumber: "ERA3AEB2491V",
      appliesToReferences: [
        "R_SOURCE_1",
        "R_SOURCE_2",
        "R_SOURCE_3",
        "R_SOURCE_4",
        "R_SOURCE_5",
        "R_SOURCE_6",
        "R_SOURCE_7"
      ],
      manufacturerCad: { state: "unavailable", authority: "deny" },
      package: {
        designation: "1608 (0603)",
        lengthMm: { nominal: 1.6, tolerance: 0.2 },
        widthMm: { nominal: 0.8, tolerance: 0.2 }
      },
      manufacturerLandPattern: {
        aPadLengthMm: { minimum: 0.7, maximum: 0.9 },
        bOverallLandSpanMm: { minimum: 2, maximum: 2.2 },
        cPadWidthMm: { minimum: 0.8, maximum: 1 }
      },
      projectSelection: {
        copperPad: { lengthMm: 0.8, widthMm: 0.9 },
        overallLandSpanMm: 2.1,
        derivedCopperPadGapMm: 0.5,
        derivedCopperPadCenterXMm: 0.65,
        solderMask: { openingLengthMm: 0.9, openingWidthMm: 1, marginMm: 0.05 },
        paste: { openingLengthMm: 0.7, openingWidthMm: 0.8, reductionPerEdgeMm: 0.05 },
        courtyard: { lengthMm: 2.4, widthMm: 1.3, minimumClearanceMm: 0.15 }
      },
      orientation: { state: "pending-review" },
      fabricationAuthority: "deny",
      accepted: false
    })
    expect(benchPrototypeEra3aProjectFootprintGeometry.sources).toEqual([
      expect.objectContaining({
        documentNumber: "AOA0000C309",
        artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/panasonic-era3aeb2491v-datasheet.pdf",
        url: "https://industrial.panasonic.cn/cdbs/www-data/pdf/RDM0000/AOA0000C309.pdf",
        sha256: "FFCBFA23E13542434BCE2003BE0B563C099792976D6F153ECD0227F2C0AF0C79"
      }),
      expect.objectContaining({
        documentNumber: "DMM0000COL20",
        artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/panasonic-resistor-land-pattern.pdf",
        url: "https://industrial.panasonic.cn/cdbs/www-data/pdf/RDM0000/DMM0000COL20.pdf",
        sha256: "65A9872D2618A23D77BD1B54B3DFDD6534A3F9E82A6BA6C136266399B9CFFA1D"
      })
    ])
    for (const source of benchPrototypeEra3aProjectFootprintGeometry.sources) {
      expect(source.sha256).toMatch(/^[0-9A-F]{64}$/u)
    }
  })

  it("maps two non-polar terminals and renders their exact project copper geometry", () => {
    expect(benchPrototypeEra3aProjectFootprintGeometry.terminals).toEqual([
      { pad: "1", terminal: "A", polarity: "non-polar", xMm: -0.65, yMm: 0 },
      { pad: "2", terminal: "B", polarity: "non-polar", xMm: 0.65, yMm: 0 }
    ])
    const { manufacturerLandPattern, projectSelection } = benchPrototypeEra3aProjectFootprintGeometry
    expect(projectSelection.copperPad.lengthMm).toBeGreaterThanOrEqual(manufacturerLandPattern.aPadLengthMm.minimum)
    expect(projectSelection.copperPad.lengthMm).toBeLessThanOrEqual(manufacturerLandPattern.aPadLengthMm.maximum)
    expect(projectSelection.copperPad.widthMm).toBeGreaterThanOrEqual(manufacturerLandPattern.cPadWidthMm.minimum)
    expect(projectSelection.copperPad.widthMm).toBeLessThanOrEqual(manufacturerLandPattern.cPadWidthMm.maximum)
    expect(projectSelection.overallLandSpanMm).toBeGreaterThanOrEqual(
      manufacturerLandPattern.bOverallLandSpanMm.minimum
    )
    expect(projectSelection.overallLandSpanMm).toBeLessThanOrEqual(manufacturerLandPattern.bOverallLandSpanMm.maximum)
    expect(projectSelection.derivedCopperPadGapMm).toBeCloseTo(
      projectSelection.overallLandSpanMm - 2 * projectSelection.copperPad.lengthMm,
      10
    )
    expect(projectSelection.derivedCopperPadCenterXMm).toBeCloseTo(
      (projectSelection.derivedCopperPadGapMm + projectSelection.copperPad.lengthMm) / 2,
      10
    )

    const json = renderProjectFootprint()
    const pads = json.filter((element) => element.type === "pcb_smtpad")
    expect(pads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          x: -0.65,
          y: 0,
          width: 0.8,
          height: 0.9,
          soldermask_margin: 0.05
        }),
        expect.objectContaining({
          x: 0.65,
          y: 0,
          width: 0.8,
          height: 0.9,
          soldermask_margin: 0.05
        })
      ])
    )
    expect(json.filter((element) => element.type === "source_port")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ pin_number: 1, name: "A", port_hints: expect.arrayContaining(["pin1"]) }),
        expect.objectContaining({ pin_number: 2, name: "B", port_hints: expect.arrayContaining(["pin2"]) })
      ])
    )
    expect(json.filter((element) => element.type === "pcb_courtyard_rect")).toEqual(
      expect.arrayContaining([expect.objectContaining({ center: { x: 0, y: 0 }, width: 2.4, height: 1.3 })])
    )
    expect(json.filter((element) => element.type.endsWith("_error"))).toEqual([])
  })

  it("hashes the canonical rendered soup geometry", () => {
    expect(renderedGeometryHash()).toBe("29d0ec547cff8af36108f452a654bdb76493a55a35abdfb0a4024108719d22ac")
  })
})
