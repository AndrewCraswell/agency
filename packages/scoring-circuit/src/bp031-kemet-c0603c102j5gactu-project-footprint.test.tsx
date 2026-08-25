import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { benchPrototypeAnalogFootprintClosure } from "./bench-prototype-analog-footprint-closure.js"
import {
  Bp031KemetC0603C102J5GactuProjectFootprint,
  bp031KemetC0603C102J5GactuProjectFootprint,
  validateBp031KemetC0603C102J5GactuProjectFootprint
} from "./bp031-kemet-c0603c102j5gactu-project-footprint.js"
import { oneChannelAnalogExperimentBom } from "./one-channel-analog-readiness.js"
import { renderTestCircuit } from "./test-helper.js"

type CircuitElement = ReturnType<typeof renderTestCircuit>[number]

function renderProjectFootprint() {
  return renderTestCircuit(<Bp031KemetC0603C102J5GactuProjectFootprint />)
}

function isRectSmtPad(
  element: CircuitElement
): element is Extract<CircuitElement, { shape: "rect"; type: "pcb_smtpad" }> {
  return element.type === "pcb_smtpad" && element.shape === "rect"
}

function isRectPaste(
  element: CircuitElement
): element is Extract<CircuitElement, { shape: "rect"; type: "pcb_solder_paste" }> {
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
    if (element.type === "pcb_courtyard_rect") {
      geometry.push({ center: element.center, height: element.height, type: element.type, width: element.width })
    }
    if (isRectPaste(element)) {
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

describe("BP-031 exact KEMET C0603C102J5GACTU 0603 project footprint", () => {
  it("binds exact C_SAR identity, seven references, KEMET primary evidence, and source hashes", () => {
    expect(validateBp031KemetC0603C102J5GactuProjectFootprint()).toEqual([])
    expect(bp031KemetC0603C102J5GactuProjectFootprint).toMatchObject({
      artifactKind: "bp031-kemet-c0603c102j5gactu-project-footprint",
      workUnit: "BP-031",
      manufacturer: "KEMET",
      manufacturerPartNumber: "C0603C102J5GACTU",
      sourceContract: "BP-102",
      role: "SAR filter capacitor",
      affectedReferences: ["C_SAR_1", "C_SAR_2", "C_SAR_3", "C_SAR_4", "C_SAR_5", "C_SAR_6", "C_SAR_7"],
      sourceBinding: {
        canonicalSourceReference: "C_SAR",
        replicatedReferencePrefix: "C_SAR_",
        manufacturer: "KEMET",
        manufacturerPartNumber: "C0603C102J5GACTU",
        package: "0603",
        primarySourceId: "kemet-cer-eng-kit-29",
        landPatternApplicability: expect.stringContaining("not exact-orderable CAD")
      },
      manufacturerCad: { state: "not-acquired", artifactPath: null, authority: "deny" },
      releaseState: "deny",
      fabricationAuthority: "deny",
      accepted: false
    })
    expect(oneChannelAnalogExperimentBom.find((part) => part.reference === "C_SAR")).toMatchObject({
      manufacturer: "KEMET",
      mpn: "C0603C102J5GACTU",
      package: "0603"
    })
    expect(bp031KemetC0603C102J5GactuProjectFootprint.sourceControl).toEqual({
      basisCommit: "0f9e3f5a3a0aa8183b5bc71ca2b553445a462dbc",
      upstreamSources: [
        {
          path: "packages/scoring-circuit/src/one-channel-analog-readiness.ts",
          sha256: "496d8727b33209c03b31f2b1f203397c7cab364f40d00edf2ec8b1bdf227e55d"
        },
        {
          path: "packages/scoring-circuit/src/one-channel-analog-experiment.ts",
          sha256: "f55de5588c479405a55d23954f266a71220013967e1db06fcc04c60dbfef552b"
        },
        {
          path: "packages/scoring-circuit/src/bench-prototype-analog-topology.ts",
          sha256: "1f888dd5aa328fad823738f09a48502ef50189775d5e1920a09413a32c14360d"
        }
      ]
    })
    expect(bp031KemetC0603C102J5GactuProjectFootprint.sources).toEqual([
      expect.objectContaining({
        id: "kemet-cer-eng-kit-29",
        applicability: "exact-orderable-identity-and-package",
        artifactPath: "packages/scoring-circuit/docs/evidence/bp-031/bp031-kemet-c0603c102j5gactu-cer-eng-kit-29.pdf",
        sha256: "73A53686BECC6EE192B0D265C22752E17B9F1E3DE2E979E6964470E005EE7596"
      }),
      expect.objectContaining({
        id: "kemet-c1091-c0g-esd-land-pattern",
        applicability: "applicable-family-guidance-not-exact-orderable-cad",
        artifactPath:
          "packages/scoring-circuit/docs/evidence/bp-031/bp031-kemet-c0603c102j5gactu-c0g-esd-land-pattern.pdf",
        sha256: "E7A71BB470BBC82E77E3ECBFCE7749D3F5C963985E62D4494AD52DE285945189"
      })
    ])
    for (const source of bp031KemetC0603C102J5GactuProjectFootprint.sources) {
      const bytes = readFileSync(
        new URL(`../${source.artifactPath.replace("packages/scoring-circuit/", "")}`, import.meta.url)
      )
      expect(createHash("sha256").update(bytes).digest("hex").toUpperCase()).toBe(source.sha256)
    }
    for (const upstream of bp031KemetC0603C102J5GactuProjectFootprint.sourceControl.upstreamSources) {
      const bytes = readFileSync(
        new URL(`../${upstream.path.replace("packages/scoring-circuit/", "")}`, import.meta.url)
      )
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(upstream.sha256)
    }
  })

  it("derives KEMET density-B copper and explicit project mask, paste, and courtyard", () => {
    const {
      manufacturerLandPattern,
      package: packageSpec,
      projectSelection
    } = bp031KemetC0603C102J5GactuProjectFootprint
    expect(packageSpec).toMatchObject({
      designation: "0603 (1608 metric) ceramic chip capacitor",
      caseSize: "EIA 0603 / IEC 1608",
      dielectric: "C0G",
      capacitancePf: 1000,
      tolerancePercent: 5,
      ratedVoltageVdc: 50,
      lengthMm: { nominal: 1.6, minimum: 1.45, maximum: 1.75 },
      widthMm: { nominal: 0.8, minimum: 0.65, maximum: 0.95 },
      thicknessMm: { nominal: 0.8, minimum: 0.73, maximum: 0.87 },
      terminalBandwidthMm: { minimum: 0.2, maximum: 0.5 },
      terminalSeparationMinimumMm: 0.7,
      terminals: 2
    })
    expect(manufacturerLandPattern).toMatchObject({
      sourceScope: "manufacturer IPC-7351 guidance, not exact-orderable CAD",
      applicability: expect.stringContaining("not an exact-orderable CAD"),
      termination: "standard",
      densityLevel: "B",
      copper: {
        padGapMm: 0.8,
        padLengthMm: 0.95,
        padWidthMm: 1.0,
        padCenterSpanMm: 1.75
      },
      solderMask: { status: "not-published" },
      paste: { status: "not-published" },
      courtyard: { status: "ipc-grid-placement-published", lengthMm: 3.1, widthMm: 1.5 }
    })
    expect(projectSelection).toMatchObject({
      solderingMethod: "reflow",
      manufacturerParameterSelectionMm: {
        densityLevel: "B",
        padGap: 0.8,
        padLength: 0.95,
        padWidth: 1.0,
        gridCourtyardLength: 3.1,
        gridCourtyardWidth: 1.5
      },
      copperPad: { lengthMm: 0.95, widthMm: 1.0, gapMm: 0.8, centerSpanMm: 1.75 },
      solderMask: {
        openingLengthMm: 1.05,
        openingWidthMm: 1.1,
        marginPerEdgeMm: 0.05,
        status: "project-input-not-manufacturer-specification"
      },
      paste: {
        openingLengthMm: 0.85,
        openingWidthMm: 0.9,
        reductionPerEdgeMm: 0.05,
        status: "project-input-not-manufacturer-specification"
      },
      courtyard: {
        lengthMm: 3.1,
        widthMm: 1.5,
        clearanceFromPadAndPackageMm: { length: 0.2, width: 0.25 },
        status: "project-review-input-from-manufacturer-grid-guidance"
      }
    })
    expect(bp031KemetC0603C102J5GactuProjectFootprint.terminals).toEqual([
      { pad: "1", terminal: "A", polarity: "non-polar", xMm: -0.875, yMm: 0 },
      { pad: "2", terminal: "B", polarity: "non-polar", xMm: 0.875, yMm: 0 }
    ])
  })

  it("cross-checks every replicated C_SAR reference against the canonical closure", () => {
    const expectedReferences = ["C_SAR_1", "C_SAR_2", "C_SAR_3", "C_SAR_4", "C_SAR_5", "C_SAR_6", "C_SAR_7"]
    const canonicalRecords = benchPrototypeAnalogFootprintClosure.records.filter((record) =>
      expectedReferences.includes(record.reference)
    )
    expect(canonicalRecords.map((record) => record.reference)).toEqual(expectedReferences)
    expect(canonicalRecords).toHaveLength(7)
    for (const record of canonicalRecords) {
      expect(record).toMatchObject({
        sourceBaseReference: "C_SAR",
        sourceContract: "BP-103",
        exactMpn: "C0603C102J5GACTU",
        exactPackage: "0603",
        disposition: "DNP-unresolved"
      })
    }
    expect(bp031KemetC0603C102J5GactuProjectFootprint.affectedReferences).toEqual(expectedReferences)
  })

  it("keeps the exact capacitor non-polar with no pin-one claim", () => {
    expect(bp031KemetC0603C102J5GactuProjectFootprint.orientation).toMatchObject({
      state: "pending-review",
      polarity: "non-polar",
      polarityBasis: expect.stringContaining("design inference from retained KEMET"),
      pinOne: "not-applicable",
      assemblyRotationDeg: null,
      rotationEquivalence: "180-degree rotationally equivalent"
    })
  })

  it("renders both copper pads, project mask and paste, source ports, courtyard, and no tscircuit errors", () => {
    const json = renderProjectFootprint()
    const pads = json.filter(isRectSmtPad)
    expect(json.find((element) => element.type === "source_component")).toMatchObject({
      name: "C_BP031_KEMET_C0603C102J5GACTU",
      manufacturer_part_number: "C0603C102J5GACTU"
    })
    expect(pads).toHaveLength(2)
    expect(pads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ x: -0.875, y: 0, width: 0.95, height: 1, soldermask_margin: 0.05 }),
        expect.objectContaining({ x: 0.875, y: 0, width: 0.95, height: 1, soldermask_margin: 0.05 })
      ])
    )
    const paste = json.filter(isRectPaste)
    expect(paste).toHaveLength(2)
    expect(paste).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ x: -0.875, y: 0, width: 0.85, height: 0.9 }),
        expect.objectContaining({ x: 0.875, y: 0, width: 0.85, height: 0.9 })
      ])
    )
    expect(json.filter((element) => element.type === "pcb_courtyard_rect")).toEqual(
      expect.arrayContaining([expect.objectContaining({ center: { x: 0, y: 0 }, width: 3.1, height: 1.5 })])
    )
    const sourcePorts = json.filter((element) => element.type === "source_port")
    expect(sourcePorts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ pin_number: 1, name: "A", port_hints: expect.arrayContaining(["A"]) }),
        expect.objectContaining({ pin_number: 2, name: "B", port_hints: expect.arrayContaining(["B"]) })
      ])
    )
    expect(json.filter((element) => element.type.endsWith("_error"))).toEqual([])
  })

  it("binds the canonical rendered geometry hash", () => {
    expect(renderedGeometryHash()).toBe(bp031KemetC0603C102J5GactuProjectFootprint.artwork.sha256)
  })

  it.each([
    [
      "MPN",
      (copy: typeof bp031KemetC0603C102J5GactuProjectFootprint) =>
        Reflect.set(copy, "manufacturerPartNumber", "C0603C104K3RACTU")
    ],
    [
      "replicated reference scope",
      (copy: typeof bp031KemetC0603C102J5GactuProjectFootprint) => Reflect.set(copy, "affectedReferences", ["C_SAR_1"])
    ],
    [
      "primary source hash",
      (copy: typeof bp031KemetC0603C102J5GactuProjectFootprint) =>
        Reflect.set(copy.sources[0], "sha256", "0".repeat(64))
    ],
    [
      "manufacturer land pattern",
      (copy: typeof bp031KemetC0603C102J5GactuProjectFootprint) =>
        Reflect.set(copy.manufacturerLandPattern.copper, "padGapMm", 0.4)
    ],
    [
      "project mask disposition",
      (copy: typeof bp031KemetC0603C102J5GactuProjectFootprint) =>
        Reflect.set(copy.projectSelection.solderMask, "status", "manufacturer-primary")
    ],
    [
      "non-polar orientation",
      (copy: typeof bp031KemetC0603C102J5GactuProjectFootprint) => Reflect.set(copy.orientation, "polarity", "polar")
    ],
    [
      "manufacturer CAD",
      (copy: typeof bp031KemetC0603C102J5GactuProjectFootprint) =>
        Reflect.set(copy.manufacturerCad, "authority", "allow")
    ],
    [
      "fabrication acceptance",
      (copy: typeof bp031KemetC0603C102J5GactuProjectFootprint) => Reflect.set(copy, "accepted", true)
    ],
    [
      "courtyard",
      (copy: typeof bp031KemetC0603C102J5GactuProjectFootprint) =>
        Reflect.set(copy.projectFootprint.courtyard, "lengthMm", 1)
    ]
  ])("fails closed on %s drift", (_name, mutate) => {
    const copy = structuredClone(bp031KemetC0603C102J5GactuProjectFootprint)
    mutate(copy)
    expect(validateBp031KemetC0603C102J5GactuProjectFootprint(copy)).not.toEqual([])
  })

  it("keeps expected evidence independent and rejects malformed candidates", () => {
    expect(Object.isFrozen(bp031KemetC0603C102J5GactuProjectFootprint)).toBe(true)
    expect(Object.isFrozen(bp031KemetC0603C102J5GactuProjectFootprint.sources)).toBe(true)
    expect(Reflect.set(bp031KemetC0603C102J5GactuProjectFootprint, "accepted", true)).toBe(false)
    expect(validateBp031KemetC0603C102J5GactuProjectFootprint()).toEqual([])

    const cyclicCandidate: { self?: unknown } = {}
    cyclicCandidate.self = cyclicCandidate
    expect(validateBp031KemetC0603C102J5GactuProjectFootprint(cyclicCandidate)).not.toEqual([])
    expect(validateBp031KemetC0603C102J5GactuProjectFootprint({})).not.toEqual([])
  })
})
