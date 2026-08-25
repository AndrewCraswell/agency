import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  Bp031TiTps60400DbvrDbvFootprint,
  bp031TiTps60400DbvrDbvFootprintCandidate,
  validateBp031TiTps60400DbvrDbvFootprintCandidate
} from "./bp031-ti-tps60400dbvr-dbv-footprint-candidate.js"
import { renderTestCircuit } from "./test-helper.js"

type CircuitElement = ReturnType<typeof renderTestCircuit>[number]

function renderProjectFootprint() {
  return renderTestCircuit(<Bp031TiTps60400DbvrDbvFootprint />)
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
    if (element.type === "pcb_courtyard_rect") {
      geometry.push({ center: element.center, height: element.height, type: element.type, width: element.width })
    }
  }
  return createHash("sha256").update(JSON.stringify(geometry)).digest("hex").toUpperCase()
}

describe("BP-031 exact TI TPS60400DBVR DBV0005A SOT-23-5 candidate footprint", () => {
  it("binds exact MPN, package, canonical reference, pin map, and retained TI source hash", () => {
    expect(validateBp031TiTps60400DbvrDbvFootprintCandidate()).toEqual([])
    expect(bp031TiTps60400DbvrDbvFootprintCandidate).toMatchObject({
      artifactKind: "bp031-ti-tps60400dbvr-dbv-sot23-5-footprint-candidate",
      workUnit: "BP-031",
      manufacturer: "Texas Instruments",
      manufacturerPartNumber: "TPS60400DBVR",
      package: {
        designation: "DBV0005A (SOT-23-5)",
        packageDrawing: "DBV0005A",
        packageStandard: "JEDEC MO-178",
        terminals: 5,
        leadPitchMm: 0.95
      },
      sourceBinding: {
        canonicalSourcePath: "packages/scoring-circuit/src/one-channel-analog-readiness.ts",
        canonicalSourceReference: "U_NEGATIVE_RAIL",
        pinMapSourcePath: "packages/scoring-circuit/src/one-channel-analog-experiment.ts",
        pinMapSourceReference: "physicalPinMaps.tps60400Dbv",
        manufacturerPartNumber: "TPS60400DBVR",
        package: "DBV SOT-23-5",
        pinMap: { 1: "OUT", 2: "IN", 3: "CFLY-", 4: "GND", 5: "CFLY+" },
        sourceContract: "BP-100"
      },
      manufacturerCad: { state: "not-acquired", artifactPath: null, authority: "deny" },
      releaseState: "deny",
      fabricationAuthority: "deny",
      accepted: false
    })
    expect(bp031TiTps60400DbvrDbvFootprintCandidate.sourceControl).toEqual({
      basisCommit: "a84fb13a95cb1a49c9a3dbe8628249567a9f3e1c",
      upstreamSources: [
        {
          path: "packages/scoring-circuit/src/one-channel-analog-readiness.ts",
          sha256: "496d8727b33209c03b31f2b1f203397c7cab364f40d00edf2ec8b1bdf227e55d"
        },
        {
          path: "packages/scoring-circuit/src/one-channel-analog-experiment.ts",
          sha256: "f55de5588c479405a55d23954f266a71220013967e1db06fcc04c60dbfef552b"
        }
      ]
    })
    const source = bp031TiTps60400DbvrDbvFootprintCandidate.sources[0]
    if (source === undefined) throw new Error("TI source fixture is missing")
    expect(source).toMatchObject({
      authority: "manufacturer-primary",
      documentNumber: "SLVS324C",
      revision: "C",
      reviewedPages: "3, 23, 30-32",
      url: "https://www.ti.com/lit/ds/symlink/tps60400.pdf",
      artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/ti-tps60400-dbvr-datasheet.pdf",
      sha256: "B3B26A8519549BC369E8A91F11133F1D5CBE37C31EBBDF13C4D4C980EF7B8347"
    })
    expect(source.addendum).toEqual({
      label: "Addendum-Page 1",
      pdfPage: 23,
      date: "2026-01-09",
      exactOrderable: "TPS60400DBVR",
      status: "Active",
      materialType: "Production",
      package: "SOT-23 (DBV) | 5",
      packageQuantityAndCarrier: "3000 | LARGE T&R",
      operatingTemperatureC: "-40 to 85",
      partMarking: "PFKI"
    })
    const bytes = readFileSync(
      new URL(`../${source.artifactPath.replace("packages/scoring-circuit/", "")}`, import.meta.url)
    )
    expect(createHash("sha256").update(bytes).digest("hex").toUpperCase()).toBe(source.sha256)
    for (const upstream of bp031TiTps60400DbvrDbvFootprintCandidate.sourceControl.upstreamSources) {
      const upstreamBytes = readFileSync(
        new URL(`../${upstream.path.replace("packages/scoring-circuit/", "")}`, import.meta.url)
      )
      expect(createHash("sha256").update(upstreamBytes).digest("hex")).toBe(upstream.sha256)
    }
  })

  it("derives DBV0005A copper, preferred NSMD mask, stencil paste, and review courtyard", () => {
    const { manufacturerLandPattern, package: packageSpec, projectFootprint } = bp031TiTps60400DbvrDbvFootprintCandidate
    expect(packageSpec).toMatchObject({
      bodyLengthMm: { minimum: 2.75, maximum: 3.05 },
      bodyWidthMm: { minimum: 1.45, maximum: 1.75 },
      leadSpanMm: { minimum: 2.6, maximum: 3.0 },
      heightMm: { maximum: 1.45 },
      leadPitchMm: 0.95,
      leadWidthMm: { minimum: 0.3, maximum: 0.5 },
      leadLengthMm: { minimum: 0.3, maximum: 0.6 }
    })
    expect(manufacturerLandPattern.copper).toMatchObject({
      padLengthMm: 1.1,
      padWidthMm: 0.6,
      rowCenterSpanMm: 2.6,
      pitchMm: 0.95
    })
    expect(manufacturerLandPattern.solderMask).toMatchObject({
      definition: "non-solder-mask-defined-preferred",
      marginPerEdgeMm: 0.07
    })
    expect(manufacturerLandPattern.paste).toMatchObject({
      apertureLengthMm: 1.1,
      apertureWidthMm: 0.6,
      stencilThicknessMm: 0.125
    })
    expect(projectFootprint).toMatchObject({
      padLengthMm: 1.1,
      padWidthMm: 0.6,
      padRowCenterSpanMm: 2.6,
      padPitchMm: 0.95,
      solderMask: {
        openingLengthMm: 1.24,
        openingWidthMm: 0.74,
        marginPerEdgeMm: 0.07,
        status: "project-input-derived-from-manufacturer-guidance"
      },
      paste: {
        openingLengthMm: 1.1,
        openingWidthMm: 0.6,
        reductionPerEdgeMm: 0,
        status: "project-input-derived-from-manufacturer-guidance"
      },
      courtyard: {
        widthMm: 4.2,
        heightMm: 3.55,
        minimumClearanceMm: 0.25,
        sourceStatus: "not-published"
      }
    })
    expect(projectFootprint.pads).toEqual([
      { pin: 1, name: "OUT", xMm: -1.3, yMm: 0.95 },
      { pin: 2, name: "IN", xMm: -1.3, yMm: 0 },
      { pin: 3, name: "CFLY-", xMm: -1.3, yMm: -0.95 },
      { pin: 4, name: "GND", xMm: 1.3, yMm: -0.95 },
      { pin: 5, name: "CFLY+", xMm: 1.3, yMm: 0.95 }
    ])
    expect(bp031TiTps60400DbvrDbvFootprintCandidate.pinOneOrientation).toMatchObject({
      topViewPinOneDatum: "upper-left pin-one index area in Figure 6-1 and DBV0005A package outline",
      projectBoardRotationDegrees: 0,
      projectPinOnePad: { pin: 1, xMm: -1.3, yMm: 0.95 },
      independentOrientationReview: "pending-independent-review"
    })
  })

  it("renders all five exact pads, source ports, paste, courtyard, and no tscircuit errors", () => {
    const json = renderProjectFootprint()
    const pads = json.filter(isRectSmtPad)
    expect(pads).toHaveLength(5)
    expect(pads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ x: -1.3, y: 0.95, width: 1.1, height: 0.6, soldermask_margin: 0.07 }),
        expect.objectContaining({ x: 1.3, y: -0.95, width: 1.1, height: 0.6, soldermask_margin: 0.07 })
      ])
    )
    const paste = json.filter(isRectPaste)
    expect(paste).toHaveLength(5)
    expect(paste).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ x: -1.3, y: 0.95, width: 1.1, height: 0.6 }),
        expect.objectContaining({ x: 1.3, y: 0.95, width: 1.1, height: 0.6 })
      ])
    )
    expect(json.filter((element) => element.type === "pcb_courtyard_rect")).toEqual(
      expect.arrayContaining([expect.objectContaining({ center: { x: 0, y: 0 }, width: 4.2, height: 3.55 })])
    )
    expect(json.filter((element) => element.type === "source_port")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ pin_number: 1, name: "OUT", port_hints: expect.arrayContaining(["pin1"]) }),
        expect.objectContaining({ pin_number: 5, port_hints: expect.arrayContaining(["CFLY+", "pin5"]) })
      ])
    )
    expect(json.filter((element) => element.type.endsWith("_error"))).toEqual([])
  })

  it("binds the canonical rendered geometry hash while keeping release denied", () => {
    expect(renderedGeometryHash()).toBe(bp031TiTps60400DbvrDbvFootprintCandidate.artwork.sha256)
    expect(bp031TiTps60400DbvrDbvFootprintCandidate.artwork).toMatchObject({
      state: "generated-project-review-only",
      generator: "tscircuit",
      generatorVersion: "0.0.2271",
      authority: "deny"
    })
  })

  it.each([
    [
      "MPN",
      (copy: typeof bp031TiTps60400DbvrDbvFootprintCandidate) =>
        Reflect.set(copy, "manufacturerPartNumber", "TPS60401DBVR")
    ],
    [
      "package",
      (copy: typeof bp031TiTps60400DbvrDbvFootprintCandidate) =>
        Reflect.set(copy.package, "designation", "DBV (SOT-23-5)")
    ],
    [
      "pin map",
      (copy: typeof bp031TiTps60400DbvrDbvFootprintCandidate) => Reflect.set(copy.sourceBinding.pinMap, "1", "GND")
    ],
    [
      "source hash",
      (copy: typeof bp031TiTps60400DbvrDbvFootprintCandidate) => Reflect.set(copy.sources[0], "sha256", "0".repeat(64))
    ],
    [
      "orderable addendum",
      (copy: typeof bp031TiTps60400DbvrDbvFootprintCandidate) =>
        Reflect.set(copy.sources[0].addendum, "exactOrderable", "TPS60400DBVT")
    ],
    [
      "upstream exact reference",
      (copy: typeof bp031TiTps60400DbvrDbvFootprintCandidate) =>
        Reflect.set(copy.sourceBinding, "pinMapSourceReference", "physicalPinMaps.otherPart")
    ],
    [
      "source page scope",
      (copy: typeof bp031TiTps60400DbvrDbvFootprintCandidate) =>
        Reflect.set(copy.sources[0], "reviewedPages", "3, 30-32")
    ],
    [
      "manufacturer CAD",
      (copy: typeof bp031TiTps60400DbvrDbvFootprintCandidate) => Reflect.set(copy.manufacturerCad, "authority", "allow")
    ],
    [
      "fabrication acceptance",
      (copy: typeof bp031TiTps60400DbvrDbvFootprintCandidate) => Reflect.set(copy, "accepted", true)
    ],
    [
      "fabrication authority",
      (copy: typeof bp031TiTps60400DbvrDbvFootprintCandidate) => Reflect.set(copy, "fabricationAuthority", "allow")
    ],
    [
      "project fabrication authority",
      (copy: typeof bp031TiTps60400DbvrDbvFootprintCandidate) =>
        Reflect.set(copy.projectFootprint, "fabricationAuthority", "allow")
    ],
    [
      "courtyard",
      (copy: typeof bp031TiTps60400DbvrDbvFootprintCandidate) =>
        Reflect.set(copy.projectFootprint.courtyard, "widthMm", 1)
    ],
    [
      "project-only mask",
      (copy: typeof bp031TiTps60400DbvrDbvFootprintCandidate) =>
        Reflect.set(copy.projectFootprint.solderMask, "status", "manufacturer-cad")
    ],
    [
      "manufacturer stencil guidance",
      (copy: typeof bp031TiTps60400DbvrDbvFootprintCandidate) =>
        Reflect.set(copy.manufacturerLandPattern.paste, "stencilThicknessMm", 0.1)
    ],
    [
      "pin-one orientation",
      (copy: typeof bp031TiTps60400DbvrDbvFootprintCandidate) =>
        Reflect.set(copy.pinOneOrientation.projectPinOnePad, "xMm", 1.3)
    ]
  ])("fails closed on %s drift", (_name, mutate) => {
    const copy = structuredClone(bp031TiTps60400DbvrDbvFootprintCandidate)
    mutate(copy)
    expect(validateBp031TiTps60400DbvrDbvFootprintCandidate(copy)).not.toEqual([])
  })
})
