import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  benchPrototypeKemetT521bProjectFootprintGeometry,
  BenchPrototypeKemetT521bProjectFootprint
} from "./bp031-kemet-t521b-project-footprint.js"
import { oneChannelAnalogExperimentBom } from "./one-channel-analog-readiness.js"
import { renderTestCircuit } from "./test-helper.js"

function renderProjectFootprint() {
  return renderTestCircuit(<BenchPrototypeKemetT521bProjectFootprint />)
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

function isSolderPaste(
  element: CircuitElement
): element is Extract<CircuitElement, { shape: "rect"; type: "pcb_solder_paste" }> {
  return element.type === "pcb_solder_paste" && element.shape === "rect"
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
    if (isSolderPaste(element)) {
      geometry.push({
        height: element.height,
        shape: element.shape,
        type: element.type,
        width: element.width,
        x: element.x,
        y: element.y
      })
    }
  }
  return createHash("sha256").update(JSON.stringify(geometry)).digest("hex").toUpperCase()
}

describe("BP-031 KEMET T521B106M025ATE100 project footprint", () => {
  it("binds only the exact affected references and retains denied release state", () => {
    expect(benchPrototypeKemetT521bProjectFootprintGeometry).toMatchObject({
      artifactKind: "bp031-kemet-t521b106m025ate100-project-footprint",
      workUnit: "BP-031",
      manufacturerPartNumber: "T521B106M025ATE100",
      sourceContract: "BP-101",
      role: "REF5025A-Q1 local output stabilization",
      geometryAuthority: "project-review-input-not-manufacturer-specification",
      sourceBinding: {
        canonicalSourcePath: "packages/scoring-circuit/src/one-channel-analog-readiness.ts",
        canonicalSourceReference: "C_REF_REG",
        replicatedReferencePrefix: "C_REF_REG_",
        manufacturer: "KEMET",
        manufacturerPartNumber: "T521B106M025ATE100",
        package: "1411 / 3528 B case"
      },
      affectedReferences: [
        "C_REF_REG_1",
        "C_REF_REG_2",
        "C_REF_REG_3",
        "C_REF_REG_4",
        "C_REF_REG_5",
        "C_REF_REG_6",
        "C_REF_REG_7"
      ],
      manufacturerCad: { state: "not-acquired", artifactPath: null, authority: "deny" },
      artwork: {
        state: "generated-project-review-only",
        representation: "canonical-rendered-footprint-soup-geometry",
        generator: "tscircuit",
        generatorVersion: "0.0.2271",
        sha256: expect.any(String),
        authority: "deny"
      },
      releaseState: "deny",
      fabricationAuthority: "deny",
      accepted: false
    })
    expect(benchPrototypeKemetT521bProjectFootprintGeometry.sourceControl).toEqual({
      basisCommit: "7a3566bfcdffb1db64310e4731038f08cac40305",
      upstreamSources: [
        {
          path: "packages/scoring-circuit/src/one-channel-analog-readiness.ts",
          sha256: "496d8727b33209c03b31f2b1f203397c7cab364f40d00edf2ec8b1bdf227e55d"
        },
        {
          path: "packages/scoring-circuit/src/bench-prototype-analog-footprint-closure.ts",
          sha256: "ac7a72f68b8d9113b6ad1d161645cc8f8b7062207abf4fe5411042962e22314c"
        }
      ]
    })
    expect(benchPrototypeKemetT521bProjectFootprintGeometry.sources).toEqual([
      expect.objectContaining({
        artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/kemet-t521b106m025ate100-datasheet.pdf",
        sha256: "8DBB07C110359B8BC1BE5AE0044E08B8BADCC88A60F4DA36404BB27803F85EBD"
      })
    ])
    for (const source of benchPrototypeKemetT521bProjectFootprintGeometry.sources) {
      expect(source.sha256).toMatch(/^[0-9A-F]{64}$/u)
      const packageRelativePath = source.artifactPath.replace("packages/scoring-circuit/", "")
      const bytes = readFileSync(new URL(`../${packageRelativePath}`, import.meta.url))
      expect(createHash("sha256").update(bytes).digest("hex").toUpperCase()).toBe(source.sha256)
    }
    for (const source of benchPrototypeKemetT521bProjectFootprintGeometry.sourceControl.upstreamSources) {
      const bytes = readFileSync(new URL(`../${source.path.replace("packages/scoring-circuit/", "")}`, import.meta.url))
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(source.sha256)
    }
    const canonicalPart = oneChannelAnalogExperimentBom.find((part) => part.reference === "C_REF_REG")
    expect(canonicalPart).toMatchObject({
      manufacturer: "KEMET",
      mpn: "T521B106M025ATE100",
      package: "1411 / 3528 B case"
    })
  })

  it("derives project copper, mask, paste, and courtyard geometry from the retained drawing", () => {
    const {
      manufacturerLandPattern,
      package: packageSpec,
      projectSelection
    } = benchPrototypeKemetT521bProjectFootprintGeometry
    expect(packageSpec).toMatchObject({
      designation: "1411 / 3528 B case",
      lengthMm: { nominal: 3.5, plus: 0.2, minus: 0.2 },
      widthMm: { nominal: 2.8, plus: 0.2, minus: 0.2 },
      heightMm: { nominal: 1.9, plus: 0.1, minus: 0.1 },
      terminalLengthMm: { nominal: 0.8, plus: 0.3, minus: 0.3 },
      terminalWidthMm: { nominal: 2.2, plus: 0.1, minus: 0.1 },
      terminalGapMm: { minimum: 1.9 }
    })
    expect(manufacturerLandPattern).toEqual({
      state: "not-published",
      sourceScope: "exact-part package drawing only",
      note: "The retained KEMET drawing describes the component terminals but does not provide a PCB land-pattern recommendation or CAD."
    })
    expect(projectSelection.drawingInputsMm).toEqual({
      packageLengthNominal: 3.5,
      packageWidthNominal: 2.8,
      terminalLengthNominal: 0.8,
      terminalLengthTolerance: 0.3,
      terminalWidthNominal: 2.2,
      terminalWidthTolerance: 0.1,
      terminalGapMinimum: 1.9
    })
    expect(projectSelection).toMatchObject({
      projectCopperPad: { lengthMm: 1, widthMm: 2.2 },
      overallLandSpanMm: 3.9,
      derivedCopperPadGapMm: 1.9,
      derivedCopperPadCenterXMm: 1.45,
      solderMask: { openingLengthMm: 1.1, openingWidthMm: 2.3, marginPerEdgeMm: 0.05 },
      paste: { openingLengthMm: 0.9, openingWidthMm: 2.1, reductionPerEdgeMm: 0.05 },
      courtyard: { lengthMm: 4.2, widthMm: 3.3, minimumClearanceMm: 0.15 }
    })
    expect(projectSelection.projectCopperPad.lengthMm).toBeGreaterThanOrEqual(
      projectSelection.drawingInputsMm.terminalLengthNominal
    )
    expect(projectSelection.projectCopperPad.lengthMm).toBeLessThanOrEqual(
      projectSelection.drawingInputsMm.terminalLengthNominal + projectSelection.drawingInputsMm.terminalLengthTolerance
    )
    expect(projectSelection.projectCopperPad.widthMm).toBe(projectSelection.drawingInputsMm.terminalWidthNominal)
    expect(projectSelection.overallLandSpanMm).toBeCloseTo(
      projectSelection.derivedCopperPadGapMm + 2 * projectSelection.projectCopperPad.lengthMm,
      10
    )
    expect(projectSelection.derivedCopperPadCenterXMm).toBeCloseTo(
      (projectSelection.derivedCopperPadGapMm + projectSelection.projectCopperPad.lengthMm) / 2,
      10
    )
    expect(projectSelection.solderMask.openingLengthMm).toBeCloseTo(
      projectSelection.projectCopperPad.lengthMm + 2 * projectSelection.solderMask.marginPerEdgeMm,
      10
    )
    expect(projectSelection.solderMask.openingWidthMm).toBeCloseTo(
      projectSelection.projectCopperPad.widthMm + 2 * projectSelection.solderMask.marginPerEdgeMm,
      10
    )
    expect(projectSelection.paste.openingLengthMm).toBeCloseTo(
      projectSelection.projectCopperPad.lengthMm - 2 * projectSelection.paste.reductionPerEdgeMm,
      10
    )
    expect(projectSelection.paste.openingWidthMm).toBeCloseTo(
      projectSelection.projectCopperPad.widthMm - 2 * projectSelection.paste.reductionPerEdgeMm,
      10
    )
    expect(projectSelection.courtyard.lengthMm).toBeGreaterThan(projectSelection.overallLandSpanMm)
    expect(projectSelection.courtyard.widthMm).toBeGreaterThan(projectSelection.projectCopperPad.widthMm)
  })

  it("keeps the exact capacitor polarized while leaving stress and orientation review open", () => {
    expect(benchPrototypeKemetT521bProjectFootprintGeometry.terminals).toEqual([
      {
        pad: "1",
        terminal: "K",
        polarity: "cathode-negative",
        xMm: -1.45,
        yMm: 0,
        localDatum: "left pad in top view"
      },
      {
        pad: "2",
        terminal: "A",
        polarity: "anode-positive",
        xMm: 1.45,
        yMm: 0,
        localDatum: "right pad in top view"
      }
    ])
    expect(benchPrototypeKemetT521bProjectFootprintGeometry.stressOrientationReview).toMatchObject({
      state: "pending-review",
      polarity: "polarized",
      ratedVoltageVdc: 25,
      nominalApplicationRailVdc: 2.5,
      operatingTemperatureC: { minimum: -55, maximum: 125 },
      dcBiasEvidence: "not-retained"
    })
    expect(benchPrototypeKemetT521bProjectFootprintGeometry.orientation).toMatchObject({
      state: "pending-review",
      assemblyRotationDeg: null
    })
  })

  it("renders actual polarity-labelled copper, paste, and review courtyard without errors", () => {
    const json = renderProjectFootprint()
    const pads = json.filter((element) => element.type === "pcb_smtpad")
    expect(pads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ x: -1.45, y: 0, width: 1, height: 2.2, soldermask_margin: 0.05 }),
        expect.objectContaining({ x: 1.45, y: 0, width: 1, height: 2.2, soldermask_margin: 0.05 })
      ])
    )
    expect(json.filter((element) => element.type === "pcb_solder_paste")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ x: -1.45, y: 0, width: 0.9, height: 2.1 }),
        expect.objectContaining({ x: 1.45, y: 0, width: 0.9, height: 2.1 })
      ])
    )
    expect(json.filter((element) => element.type === "source_port")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ pin_number: 1, name: "K", port_hints: expect.arrayContaining(["pin1", "cathode"]) }),
        expect.objectContaining({ pin_number: 2, name: "A", port_hints: expect.arrayContaining(["pin2", "anode"]) })
      ])
    )
    expect(json.filter((element) => element.type === "pcb_courtyard_rect")).toEqual(
      expect.arrayContaining([expect.objectContaining({ center: { x: 0, y: 0 }, width: 4.2, height: 3.3 })])
    )
    expect(json.filter((element) => element.type.endsWith("_error"))).toEqual([])
  })

  it("hashes the canonical rendered geometry", () => {
    expect(renderedGeometryHash()).toBe(benchPrototypeKemetT521bProjectFootprintGeometry.artwork.sha256)
  })
})
