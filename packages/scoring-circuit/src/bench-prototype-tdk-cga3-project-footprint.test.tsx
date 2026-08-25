import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  benchPrototypeTdkCga3ProjectFootprintGeometry,
  BenchPrototypeTdkCga3ProjectFootprint
} from "./bench-prototype-tdk-cga3-project-footprint.js"
import { oneChannelAnalogExperimentBom } from "./one-channel-analog-readiness.js"
import { renderTestCircuit } from "./test-helper.js"

function renderProjectFootprint() {
  return renderTestCircuit(<BenchPrototypeTdkCga3ProjectFootprint />)
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

describe("BP-031 TDK CGA3E3X7R1H105K080AB project footprint", () => {
  it("binds only the exact affected references and retains denied release state", () => {
    expect(benchPrototypeTdkCga3ProjectFootprintGeometry).toMatchObject({
      artifactKind: "bp031-tdk-cga3e3x7r1h105k080ab-project-footprint",
      workUnit: "BP-031",
      manufacturerPartNumber: "CGA3E3X7R1H105K080AB",
      sourceContract: "BP-101",
      role: "reference input bypass",
      geometryAuthority: "project-review-input-not-manufacturer-specification",
      sourceBinding: {
        canonicalSourcePath: "packages/scoring-circuit/src/one-channel-analog-readiness.ts",
        canonicalSourceReference: "C_REF_IN",
        replicatedReferencePrefix: "C_REF_IN_",
        manufacturer: "TDK",
        manufacturerPartNumber: "CGA3E3X7R1H105K080AB",
        package: "0603"
      },
      affectedReferences: [
        "C_REF_IN_1",
        "C_REF_IN_2",
        "C_REF_IN_3",
        "C_REF_IN_4",
        "C_REF_IN_5",
        "C_REF_IN_6",
        "C_REF_IN_7"
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
    expect(benchPrototypeTdkCga3ProjectFootprintGeometry.sourceControl).toEqual({
      basisCommit: "f85f5c35937bc36ee52fc8b5799890150a3adf59",
      upstreamSources: [
        {
          path: "packages/scoring-circuit/src/one-channel-analog-readiness.ts",
          sha256: "496d8727b33209c03b31f2b1f203397c7cab364f40d00edf2ec8b1bdf227e55d"
        },
        {
          path: "packages/scoring-circuit/src/bench-prototype-analog-footprint-closure.ts",
          sha256: "3d565a3e71bc53b6182a7dbf80f775d5657a70ab54850cc6f8bcfa8efde69edd"
        }
      ]
    })
    expect(benchPrototypeTdkCga3ProjectFootprintGeometry.sources).toEqual([
      expect.objectContaining({
        artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/tdk-cga3e3x7r1h105k080ab-detail.pdf",
        sha256: "8692A2973DD875110C6F3FE3EB0A688454C0A155DCC8FCFAF3130F6862EC316F"
      }),
      expect.objectContaining({
        artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/tdk-mlcc-automotive-general-zh.pdf",
        sha256: "E6F5803E89514DC61813BF2C96414D784005274730A8AF43A5EF54EBD546DBFF"
      }),
      expect.objectContaining({
        artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/tdk-mlcc-virtual-component-library-parts-list.pdf",
        sha256: "B71416318033D9E0E50E4386A758FE58E133805F289B0200DFDE983B4FDA6DA4"
      })
    ])
    for (const source of benchPrototypeTdkCga3ProjectFootprintGeometry.sources) {
      expect(source.sha256).toMatch(/^[0-9A-F]{64}$/u)
      const packageRelativePath = source.artifactPath.replace("packages/scoring-circuit/", "")
      const bytes = readFileSync(new URL(`../${packageRelativePath}`, import.meta.url))
      expect(createHash("sha256").update(bytes).digest("hex").toUpperCase()).toBe(source.sha256)
    }
    for (const source of benchPrototypeTdkCga3ProjectFootprintGeometry.sourceControl.upstreamSources) {
      const bytes = readFileSync(new URL(`../${source.path.replace("packages/scoring-circuit/", "")}`, import.meta.url))
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(source.sha256)
    }
    const canonicalPart = oneChannelAnalogExperimentBom.find((part) => part.reference === "C_REF_IN")
    expect(canonicalPart).toMatchObject({
      manufacturer: "TDK",
      mpn: "CGA3E3X7R1H105K080AB",
      package: "0603"
    })
  })

  it("derives project copper, mask, paste, and courtyard geometry from reflow guidance", () => {
    const {
      manufacturerLandPattern,
      package: packageSpec,
      projectSelection
    } = benchPrototypeTdkCga3ProjectFootprintGeometry
    expect(packageSpec).toMatchObject({
      designation: "CGA3 (1608 / EIA 0603)",
      lengthMm: { nominal: 1.6, plus: 0.2, minus: 0.1 },
      widthMm: { nominal: 0.8, plus: 0.2, minus: 0.1 },
      thicknessMm: { nominal: 0.8, plus: 0.2, minus: 0.1 },
      terminalWidthMm: { minimum: 0.2 },
      terminalSpacingMm: { minimum: 0.3 }
    })
    expect(manufacturerLandPattern.reflow).toEqual({
      paGapMm: { minimum: 0.6, maximum: 0.8 },
      pbPadLengthMm: { minimum: 0.6, maximum: 0.8 },
      pcPadWidthMm: { minimum: 0.6, maximum: 0.8 }
    })
    expect(projectSelection.manufacturerParameterSelectionMm).toEqual({ paGap: 0.7, pbPadLength: 0.7, pcPadWidth: 0.7 })
    expect(projectSelection).toMatchObject({
      copperPad: { lengthMm: 0.7, widthMm: 0.7 },
      overallLandSpanMm: 2.1,
      derivedCopperPadGapMm: 0.7,
      derivedCopperPadCenterXMm: 0.7,
      solderMask: { openingLengthMm: 0.8, openingWidthMm: 0.8, marginPerEdgeMm: 0.05 },
      paste: { openingLengthMm: 0.6, openingWidthMm: 0.6, reductionPerEdgeMm: 0.05 },
      courtyard: { lengthMm: 2.4, widthMm: 1.3, minimumClearanceMm: 0.15 }
    })
    expect(projectSelection.copperPad.lengthMm).toBeGreaterThanOrEqual(
      manufacturerLandPattern.reflow.pbPadLengthMm.minimum
    )
    expect(projectSelection.copperPad.lengthMm).toBeLessThanOrEqual(
      manufacturerLandPattern.reflow.pbPadLengthMm.maximum
    )
    expect(projectSelection.copperPad.widthMm).toBeGreaterThanOrEqual(
      manufacturerLandPattern.reflow.pcPadWidthMm.minimum
    )
    expect(projectSelection.copperPad.widthMm).toBeLessThanOrEqual(manufacturerLandPattern.reflow.pcPadWidthMm.maximum)
    expect(projectSelection.derivedCopperPadGapMm).toBeGreaterThanOrEqual(
      manufacturerLandPattern.reflow.paGapMm.minimum
    )
    expect(projectSelection.derivedCopperPadGapMm).toBeLessThanOrEqual(manufacturerLandPattern.reflow.paGapMm.maximum)
    expect(projectSelection.overallLandSpanMm).toBeCloseTo(
      projectSelection.derivedCopperPadGapMm + 2 * projectSelection.copperPad.lengthMm,
      10
    )
    expect(projectSelection.derivedCopperPadCenterXMm).toBeCloseTo(
      (projectSelection.derivedCopperPadGapMm + projectSelection.copperPad.lengthMm) / 2,
      10
    )
    expect(projectSelection.solderMask.openingLengthMm).toBeCloseTo(
      projectSelection.copperPad.lengthMm + 2 * projectSelection.solderMask.marginPerEdgeMm,
      10
    )
    expect(projectSelection.solderMask.openingWidthMm).toBeCloseTo(
      projectSelection.copperPad.widthMm + 2 * projectSelection.solderMask.marginPerEdgeMm,
      10
    )
    expect(projectSelection.paste.openingLengthMm).toBeCloseTo(
      projectSelection.copperPad.lengthMm - 2 * projectSelection.paste.reductionPerEdgeMm,
      10
    )
    expect(projectSelection.paste.openingWidthMm).toBeCloseTo(
      projectSelection.copperPad.widthMm - 2 * projectSelection.paste.reductionPerEdgeMm,
      10
    )
  })

  it("keeps the exact capacitor non-polar while leaving stress and orientation review open", () => {
    expect(benchPrototypeTdkCga3ProjectFootprintGeometry.terminals).toEqual([
      { pad: "1", terminal: "A", polarity: "non-polar", xMm: -0.7, yMm: 0 },
      { pad: "2", terminal: "B", polarity: "non-polar", xMm: 0.7, yMm: 0 }
    ])
    expect(benchPrototypeTdkCga3ProjectFootprintGeometry.stressOrientationReview).toMatchObject({
      state: "pending-review",
      polarity: "non-polar",
      pinOne: "not-applicable",
      ratedVoltageVdc: 50,
      nominalApplicationRailVdc: 5,
      dcBiasEvidence: "not-retained"
    })
    expect(benchPrototypeTdkCga3ProjectFootprintGeometry.orientation).toMatchObject({
      state: "pending-review",
      assemblyRotationDeg: null
    })
  })

  it("renders the project copper and review courtyard without tscircuit errors", () => {
    const json = renderProjectFootprint()
    const pads = json.filter((element) => element.type === "pcb_smtpad")
    expect(pads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          x: -0.7,
          y: 0,
          width: 0.7,
          height: 0.7,
          soldermask_margin: 0.05
        }),
        expect.objectContaining({
          x: 0.7,
          y: 0,
          width: 0.7,
          height: 0.7,
          soldermask_margin: 0.05
        })
      ])
    )
    expect(json.filter((element) => element.type === "pcb_solder_paste")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ x: -0.7, y: 0, width: 0.6, height: 0.6 }),
        expect.objectContaining({ x: 0.7, y: 0, width: 0.6, height: 0.6 })
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

  it("hashes the canonical rendered geometry", () => {
    expect(renderedGeometryHash()).toBe(benchPrototypeTdkCga3ProjectFootprintGeometry.artwork.sha256)
  })
})
