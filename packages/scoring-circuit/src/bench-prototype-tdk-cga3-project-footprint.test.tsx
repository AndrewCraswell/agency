import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { benchPrototypeAnalogFootprintClosure } from "./bench-prototype-analog-footprint-closure.js"
import {
  benchPrototypeTdkCga3ProjectFootprintGeometry,
  BenchPrototypeTdkCga3ProjectFootprint,
  validateBenchPrototypeTdkCga3ProjectFootprint
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
    expect(validateBenchPrototypeTdkCga3ProjectFootprint()).toEqual([])
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
        package: "0603",
        exactOrderableSourceId: "tdk-exact-part-detail",
        landPatternSourceId: "tdk-exact-part-detail",
        landPatternApplicability: expect.stringContaining("reference-only")
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
        sha256: "D1DB1A503674A4E51CFB8E529C93CD02ACF6C30D025C284FD08431E239D945EC",
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
        }
      ]
    })
    expect(benchPrototypeTdkCga3ProjectFootprintGeometry.sources).toEqual([
      expect.objectContaining({
        applicability: "exact-orderable-identity-package-electrical-and-land-guidance",
        artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/tdk-cga3e3x7r1h105k080ab-detail.pdf",
        manufacturerProductPageUrl: benchPrototypeTdkCga3ProjectFootprintGeometry.primaryProductPageUrl,
        reviewedPages: [1, 2, 3],
        scope: expect.stringContaining("DC-bias reference graph"),
        sha256: "8692A2973DD875110C6F3FE3EB0A688454C0A155DCC8FCFAF3130F6862EC316F"
      }),
      expect.objectContaining({
        applicability: "manufacturer-family-package-and-electrical-context",
        artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/tdk-mlcc-automotive-general-zh.pdf",
        sha256: "E6F5803E89514DC61813BF2C96414D784005274730A8AF43A5EF54EBD546DBFF"
      }),
      expect.objectContaining({
        applicability: "manufacturer-exact-orderable-identity-only",
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
    expect(manufacturerLandPattern).toMatchObject({
      sourceId: "tdk-exact-part-detail",
      sourceScope: expect.stringContaining("page 1"),
      applicability: expect.stringContaining("not an exact-orderable CAD"),
      flow: {
        paGapMm: { minimum: 0.7, maximum: 1.0 },
        pbPadLengthMm: { minimum: 0.8, maximum: 1.0 },
        pcPadWidthMm: { minimum: 0.6, maximum: 0.8 }
      },
      reflow: {
        paGapMm: { minimum: 0.6, maximum: 0.8 },
        pbPadLengthMm: { minimum: 0.6, maximum: 0.8 },
        pcPadWidthMm: { minimum: 0.6, maximum: 0.8 }
      }
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
      dcBiasEvidence: "page-2-reference-graph-retained-not-guaranteed"
    })
    expect(benchPrototypeTdkCga3ProjectFootprintGeometry.dcBiasReview).toMatchObject({
      sourceId: "tdk-exact-part-detail",
      reviewedPage: 2,
      status: "reference-graph-retained-not-guaranteed",
      ratedVoltageVdc: 50,
      nominalApplicationRailVdc: 5,
      graphVoltageRangeVdc: { minimum: 0, maximum: 50 }
    })
    expect(benchPrototypeTdkCga3ProjectFootprintGeometry.placementReview).toMatchObject({
      sourceId: "tdk-exact-part-detail",
      reviewedPages: [1, 3],
      packageMaximumMm: { length: 1.8, width: 1, thickness: 1 },
      projectCourtyardMm: { length: 2.4, width: 1.3 },
      boardPlacementStatus: "not-reviewed"
    })
    expect(benchPrototypeTdkCga3ProjectFootprintGeometry.orientation).toMatchObject({
      state: "pending-review",
      assemblyRotationDeg: null
    })
  })

  it("cross-checks all seven C_REF_IN references against the canonical closure", () => {
    const expectedReferences = [
      "C_REF_IN_1",
      "C_REF_IN_2",
      "C_REF_IN_3",
      "C_REF_IN_4",
      "C_REF_IN_5",
      "C_REF_IN_6",
      "C_REF_IN_7"
    ]
    const canonicalRecords = benchPrototypeAnalogFootprintClosure.records.filter((record) =>
      expectedReferences.includes(record.reference)
    )
    expect(canonicalRecords.map((record) => record.reference)).toEqual(expectedReferences)
    expect(canonicalRecords).toHaveLength(7)
    for (const record of canonicalRecords) {
      expect(record).toMatchObject({
        sourceBaseReference: "C_REF_IN",
        sourceContract: "BP-103",
        exactMpn: "CGA3E3X7R1H105K080AB",
        exactPackage: "0603",
        disposition: "DNP-unresolved"
      })
    }
    expect(benchPrototypeTdkCga3ProjectFootprintGeometry.affectedReferences).toEqual(expectedReferences)
  })

  it("renders the project copper and review courtyard without tscircuit errors", () => {
    const json = renderProjectFootprint()
    const pads = json.filter((element) => element.type === "pcb_smtpad")
    expect(json.find((element) => element.type === "source_component")).toMatchObject({
      name: "C_BP031_TDK_CGA3E3X7R1H105K080AB",
      manufacturer_part_number: "CGA3E3X7R1H105K080AB"
    })
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
        expect.objectContaining({ pin_number: 1, name: "A", port_hints: expect.arrayContaining(["A"]) }),
        expect.objectContaining({ pin_number: 2, name: "B", port_hints: expect.arrayContaining(["B"]) })
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

  it.each([
    ["MPN", (copy: any) => (copy.manufacturerPartNumber = "CGA3E3X7R1H105K080AA")],
    ["reference scope", (copy: any) => (copy.affectedReferences = ["C_REF_IN_1"])],
    ["exact source hash", (copy: any) => (copy.sources[0].sha256 = "0".repeat(64))],
    ["land guidance", (copy: any) => (copy.manufacturerLandPattern.reflow.paGapMm.minimum = 0.4)],
    ["DC-bias review", (copy: any) => (copy.dcBiasReview.nominalApplicationRailVdc = 25)],
    ["placement review", (copy: any) => (copy.placementReview.boardPlacementStatus = "accepted")],
    ["orientation", (copy: any) => (copy.orientation.assemblyRotationDeg = 90)],
    ["artwork authority", (copy: any) => (copy.artwork.authority = "allow")],
    ["release state", (copy: any) => (copy.releaseState = "allow")]
  ])("fails closed on %s drift", (_name, mutate) => {
    const copy = structuredClone(benchPrototypeTdkCga3ProjectFootprintGeometry)
    mutate(copy)
    expect(validateBenchPrototypeTdkCga3ProjectFootprint(copy)).not.toEqual([])
  })

  it("keeps independent frozen evidence and rejects malformed candidates", () => {
    expect(Object.isFrozen(benchPrototypeTdkCga3ProjectFootprintGeometry)).toBe(true)
    expect(Object.isFrozen(benchPrototypeTdkCga3ProjectFootprintGeometry.sources)).toBe(true)
    expect(Reflect.set(benchPrototypeTdkCga3ProjectFootprintGeometry, "accepted", true)).toBe(false)
    expect(validateBenchPrototypeTdkCga3ProjectFootprint()).toEqual([])

    const cyclicCandidate: { self?: unknown } = {}
    cyclicCandidate.self = cyclicCandidate
    expect(validateBenchPrototypeTdkCga3ProjectFootprint(cyclicCandidate)).not.toEqual([])
    expect(validateBenchPrototypeTdkCga3ProjectFootprint({})).not.toEqual([])
  })
})
