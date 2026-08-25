import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  benchPrototypeKemetT521bProjectFootprintGeometry,
  BenchPrototypeKemetT521bProjectFootprint,
  validateBenchPrototypeKemetT521bProjectFootprint
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

function hashRepositoryFile(path: string) {
  const packageRelativePath = path.replace("packages/scoring-circuit/", "")
  const bytes = readFileSync(new URL(`../${packageRelativePath}`, import.meta.url))
  return createHash("sha256").update(bytes).digest("hex").toUpperCase()
}

function cloneCandidate() {
  return structuredClone(benchPrototypeKemetT521bProjectFootprintGeometry) as unknown as Record<string, unknown>
}

describe("BP-031 KEMET T521B106M025ATE100 project footprint", () => {
  it("binds exactly C_REF_REG_1 through C_REF_REG_7 to the exact M4-04 source", () => {
    expect(validateBenchPrototypeKemetT521bProjectFootprint()).toEqual([])
    expect(benchPrototypeKemetT521bProjectFootprintGeometry).toMatchObject({
      artifactKind: "bp031-kemet-t521b106m025ate100-project-footprint",
      workUnit: "BP-031",
      manufacturer: "KEMET",
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
        package: "1411 / 3528 B case",
        requirementExport: "ref5025OutputCapacitorRequirement",
        sourceContract: "BP-101",
        sourceRegistryPath: "packages/scoring-circuit/src/m4-04-single-channel-coupon.ts",
        sourceRegistryKey: "T521B106M025ATE100"
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
      authority: {
        identityReconciled: true,
        manufacturerDrawingReviewed: false,
        manufacturerCadApproved: false,
        projectArtworkApproved: false,
        orientationApproved: false,
        footprintClosureAuthorized: false,
        schematicIntegrationAuthorized: false,
        procurementApproved: false,
        fabricationAuthorized: false,
        acceptanceState: "deny",
        releaseState: "deny"
      },
      releaseState: "deny",
      fabricationAuthority: "deny",
      accepted: false
    })
    expect(benchPrototypeKemetT521bProjectFootprintGeometry.affectedReferences).toEqual([
      "C_REF_REG_1",
      "C_REF_REG_2",
      "C_REF_REG_3",
      "C_REF_REG_4",
      "C_REF_REG_5",
      "C_REF_REG_6",
      "C_REF_REG_7"
    ])
    expect(benchPrototypeKemetT521bProjectFootprintGeometry.affectedReferences).not.toContain("C_REF_REG")
    expect(benchPrototypeKemetT521bProjectFootprintGeometry.sourceControl).toEqual({
      basisCommit: "c6a0723a719551c1632ff2eff5b528409b4cac57",
      upstreamSources: [
        {
          path: "packages/scoring-circuit/src/one-channel-analog-readiness.ts",
          sha256: "496D8727B33209C03B31F2B1F203397C7CAB364F40D00EDF2EC8B1BDF227E55D"
        },
        {
          path: "packages/scoring-circuit/src/m4-04-single-channel-coupon.ts",
          sha256: "298F04737136BA41B9F909ECF838342DF5D2DA1173778BD42A64AC0048D9E9CE"
        }
      ]
    })
    expect(benchPrototypeKemetT521bProjectFootprintGeometry.sources).toEqual([
      expect.objectContaining({
        id: "M4-04:T521B106M025ATE100",
        acquisition: "exact-drawing-hash-bound",
        artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/kemet-t521b106m025ate100-datasheet.pdf",
        drawingIdentifier: "KEMET T521, 1411/3528 manufacturer dimensions",
        reviewedPages: "1",
        sha256: "8DBB07C110359B8BC1BE5AE0044E08B8BADCC88A60F4DA36404BB27803F85EBD",
        pageEvidence: [expect.objectContaining({ page: 1 })]
      })
    ])
    for (const source of benchPrototypeKemetT521bProjectFootprintGeometry.sources) {
      expect(source.sha256).toMatch(/^[0-9A-F]{64}$/u)
      expect(hashRepositoryFile(source.artifactPath)).toBe(source.sha256)
    }
    for (const source of benchPrototypeKemetT521bProjectFootprintGeometry.sourceControl.upstreamSources) {
      expect(hashRepositoryFile(source.path)).toBe(source.sha256.toUpperCase())
    }
    const canonicalPart = oneChannelAnalogExperimentBom.find((part) => part.reference === "C_REF_REG")
    expect(canonicalPart).toMatchObject({
      manufacturer: "KEMET",
      mpn: "T521B106M025ATE100",
      package: "1411 / 3528 B case"
    })
  })

  it("freezes and records the full package and project geometry provenance", () => {
    const geometry = benchPrototypeKemetT521bProjectFootprintGeometry
    expect(Object.isFrozen(geometry)).toBe(true)
    expect(Object.isFrozen(geometry.sourceBinding)).toBe(true)
    expect(Object.isFrozen(geometry.projectFootprint)).toBe(true)
    expect(Object.isFrozen(geometry.affectedReferences)).toBe(true)
    expect(geometry.package).toMatchObject({
      designation: "1411 / 3528 B case",
      bodyLengthMm: { nominal: 3.5, plus: 0.2, minus: 0.2 },
      bodyWidthMm: { nominal: 2.8, plus: 0.2, minus: 0.2 },
      bodyHeightMm: { nominal: 1.9, plus: 0.1, minus: 0.1 },
      terminalLengthMm: { nominal: 0.8, plus: 0.3, minus: 0.3 },
      terminalWidthMm: { nominal: 2.2, plus: 0.1, minus: 0.1 },
      terminalGapMm: { minimum: 1.9 },
      capacitanceUf: 10,
      tolerancePercent: 20,
      dielectric: "polymer tantalum",
      ratedVoltageVdc: 25,
      ratedVoltageAt125CVdc: 16.75,
      esrMaximumOhms: 0.1,
      esrTestCondition: "100 kHz, 25 C",
      operatingTemperatureC: { minimum: -55, maximum: 125 },
      terminals: 2
    })
    expect(geometry.manufacturerLandPattern).toEqual({
      state: "not-published",
      sourceId: "M4-04:T521B106M025ATE100",
      reviewedPages: "1",
      sourceScope: "exact-part package drawing only",
      note: "The retained KEMET drawing describes component terminals but does not provide a PCB land-pattern recommendation or CAD."
    })
    expect(geometry.projectSelection.drawingInputsMm).toEqual({
      packageLengthNominal: 3.5,
      packageLengthMaximum: 3.7,
      packageWidthNominal: 2.8,
      packageWidthMaximum: 3,
      terminalLengthNominal: 0.8,
      terminalLengthTolerance: 0.3,
      terminalWidthNominal: 2.2,
      terminalWidthTolerance: 0.1,
      terminalGapMinimum: 1.9
    })
    expect(geometry.projectSelection).toMatchObject({
      projectCopperPad: { lengthMm: 1, widthMm: 2.2 },
      overallLandSpanMm: 3.9,
      derivedCopperPadGapMm: 1.9,
      derivedCopperPadCenterXMm: 1.45,
      solderMask: { openingLengthMm: 1.1, openingWidthMm: 2.3, marginPerEdgeMm: 0.05 },
      paste: { openingLengthMm: 0.9, openingWidthMm: 2.1, reductionPerEdgeMm: 0.05 },
      courtyard: { lengthMm: 4.2, widthMm: 3.3, minimumClearanceMm: 0.15 }
    })
    expect(geometry.projectFootprint).toMatchObject({
      state: "review-only",
      geometryAuthority: "project-review-input-not-manufacturer-specification",
      padShape: "rectangular-smt",
      pads: [
        { pad: "1", terminal: "K", xMm: -1.45, yMm: 0 },
        { pad: "2", terminal: "A", xMm: 1.45, yMm: 0 }
      ],
      solderMask: { openingLengthMm: 1.1, openingWidthMm: 2.3, marginPerEdgeMm: 0.05 },
      paste: { openingLengthMm: 0.9, openingWidthMm: 2.1, reductionPerEdgeMm: 0.05 },
      courtyard: { centerMm: { x: 0, y: 0 }, lengthMm: 4.2, widthMm: 3.3, minimumClearanceMm: 0.15 },
      orientationStatus: "pending-independent-review",
      fabricationAuthority: "deny",
      accepted: false
    })
  })

  it("preserves polarity evidence while leaving orientation and stress review open", () => {
    expect(benchPrototypeKemetT521bProjectFootprintGeometry.terminals).toEqual([
      {
        pad: "1",
        terminal: "K",
        polarity: "cathode-negative",
        xMm: -1.45,
        yMm: 0,
        localDatum: "left pad in project top view",
        sourceDatum: "KEMET page 1 cathode (-) end view",
        numberingStatus: "project-local-datum-not-manufacturer-pin-number"
      },
      {
        pad: "2",
        terminal: "A",
        polarity: "anode-positive",
        xMm: 1.45,
        yMm: 0,
        localDatum: "right pad in project top view",
        sourceDatum: "KEMET page 1 anode (+) end view",
        numberingStatus: "project-local-datum-not-manufacturer-pin-number"
      }
    ])
    expect(benchPrototypeKemetT521bProjectFootprintGeometry.stressOrientationReview).toMatchObject({
      state: "pending-review",
      polarity: "polarized",
      ratedVoltageVdc: 25,
      ratedVoltageAt125CVdc: 16.75,
      nominalApplicationRailVdc: 2.5,
      operatingTemperatureC: { minimum: -55, maximum: 125 },
      dcBiasEvidence: "not-retained",
      sourcePolarityPage: 1
    })
    expect(benchPrototypeKemetT521bProjectFootprintGeometry.orientation).toMatchObject({
      state: "pending-review",
      sourceId: "M4-04:T521B106M025ATE100",
      sourcePage: 1,
      assemblyRotationDeg: null,
      boardOriginNumbering: "not-established-by-manufacturer-source",
      independentReview: "pending"
    })
  })

  it("renders polarity-labelled copper, paste, and review courtyard without errors", () => {
    const json = renderProjectFootprint()
    expect(json.filter((element) => element.type === "pcb_smtpad")).toEqual(
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

  it("binds the canonical rendered geometry digest while keeping artwork denied", () => {
    expect(renderedGeometryHash()).toBe(benchPrototypeKemetT521bProjectFootprintGeometry.artwork.sha256)
    expect(benchPrototypeKemetT521bProjectFootprintGeometry.artwork).toMatchObject({
      state: "generated-project-review-only",
      representation: "canonical-rendered-footprint-soup-geometry",
      generator: "tscircuit",
      generatorVersion: "0.0.2271",
      renderedElements: [
        "pcb_smtpad:1",
        "pcb_smtpad:2",
        "pcb_solder_paste:1",
        "pcb_solder_paste:2",
        "pcb_courtyard_rect"
      ],
      authority: "deny"
    })
  })

  it.each([
    ["reference scope", (copy: Record<string, unknown>) => Reflect.set(copy, "affectedReferences", ["C_REF_REG_1"])],
    [
      "source hash",
      (copy: Record<string, unknown>) =>
        Reflect.set((copy.sources as Record<string, unknown>[])[0], "sha256", "0".repeat(64))
    ],
    [
      "polarity",
      (copy: Record<string, unknown>) =>
        Reflect.set((copy.terminals as Record<string, unknown>[])[0], "polarity", "anode-positive")
    ],
    [
      "artwork authority",
      (copy: Record<string, unknown>) => Reflect.set(copy.artwork as Record<string, unknown>, "authority", "allow")
    ],
    ["fabrication authority", (copy: Record<string, unknown>) => Reflect.set(copy, "fabricationAuthority", "allow")]
  ])("rejects forged %s", (_name, mutate) => {
    const copy = cloneCandidate()
    mutate(copy)
    expect(validateBenchPrototypeKemetT521bProjectFootprint(copy)).not.toEqual([])
  })

  it("fails closed for unknown values and hostile descriptors without reading getters", () => {
    for (const [label, value] of [
      ["null", null],
      ["undefined", undefined],
      ["array", []],
      ["string", "candidate"],
      ["partial", { affectedReferences: [] }]
    ] as const) {
      expect(validateBenchPrototypeKemetT521bProjectFootprint(value), label).not.toEqual([])
    }

    const symbolCandidate = cloneCandidate()
    Object.defineProperty(symbolCandidate, Symbol("hidden"), { enumerable: true, value: true })
    expect(validateBenchPrototypeKemetT521bProjectFootprint(symbolCandidate)).not.toEqual([])

    const prototypeCandidate = cloneCandidate()
    Object.setPrototypeOf(prototypeCandidate, { injected: true })
    expect(validateBenchPrototypeKemetT521bProjectFootprint(prototypeCandidate)).not.toEqual([])

    const accessorCandidate = cloneCandidate()
    let read = false
    Object.defineProperty(accessorCandidate, "workUnit", {
      enumerable: true,
      get: () => {
        read = true
        throw new Error("accessor must never execute")
      }
    })
    expect(() => validateBenchPrototypeKemetT521bProjectFootprint(accessorCandidate)).not.toThrow()
    expect(read).toBe(false)
    expect(validateBenchPrototypeKemetT521bProjectFootprint(accessorCandidate)).not.toEqual([])

    const proxyCandidate = new Proxy(cloneCandidate(), {
      ownKeys: () => {
        throw new Error("proxy trap must not escape validator")
      }
    })
    expect(() => validateBenchPrototypeKemetT521bProjectFootprint(proxyCandidate)).not.toThrow()
    expect(validateBenchPrototypeKemetT521bProjectFootprint(proxyCandidate)).not.toEqual([])

    const aliasCandidate = cloneCandidate()
    const projectFootprint = aliasCandidate.projectFootprint as Record<string, unknown>
    const pads = projectFootprint.pads as unknown[]
    pads[1] = pads[0]
    expect(validateBenchPrototypeKemetT521bProjectFootprint(aliasCandidate)).not.toEqual([])

    const cycleCandidate = cloneCandidate()
    Reflect.set(cycleCandidate, "cycle", cycleCandidate)
    expect(validateBenchPrototypeKemetT521bProjectFootprint(cycleCandidate)).not.toEqual([])
  })
})
