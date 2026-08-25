import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  Bp031Tmux1112PwrPwFootprint,
  bp031Tmux1112PwrPwFootprintEvidence,
  validateBp031Tmux1112PwrPwFootprintEvidence
} from "./bp031-ti-tmux1112pwr-pw-footprint-evidence.js"
import { renderTestCircuit } from "./test-helper.js"

type CircuitElement = ReturnType<typeof renderTestCircuit>[number]

function renderProjectFootprint() {
  return renderTestCircuit(<Bp031Tmux1112PwrPwFootprint />)
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

describe("BP-031 exact TI TMUX1112PWR PW TSSOP-16 candidate footprint", () => {
  it("binds exact MPN, package, canonical reference, and retained TI source hash", () => {
    expect(validateBp031Tmux1112PwrPwFootprintEvidence()).toEqual([])
    expect(bp031Tmux1112PwrPwFootprintEvidence).toMatchObject({
      artifactKind: "bp031-ti-tmux1112pwr-pw-tssop16-footprint-evidence",
      workUnit: "BP-031",
      manufacturer: "Texas Instruments",
      manufacturerPartNumber: "TMUX1112PWR",
      package: {
        designation: "PW (TSSOP, 16)",
        packageDrawing: "PW0016A",
        packageStandard: "JEDEC MO-153",
        terminals: 16,
        leadPitchMm: 0.65
      },
      sourceBinding: {
        canonicalSourceReference: "U_SOURCE_SWITCH",
        replicatedReferencePrefix: "U_SOURCE_SWITCH_",
        manufacturerPartNumber: "TMUX1112PWR",
        package: "PW TSSOP-16",
        sourceContract: "BP-102"
      },
      manufacturerCad: { state: "not-acquired", artifactPath: null, authority: "deny" },
      releaseState: "deny",
      fabricationAuthority: "deny",
      accepted: false
    })
    const source = bp031Tmux1112PwrPwFootprintEvidence.sources[0]
    expect(source).toMatchObject({
      authority: "manufacturer-primary",
      documentNumber: "SCDS408C",
      revision: "C",
      reviewedPages: "3, 33, 41-43",
      url: "https://www.ti.com/lit/ds/symlink/tmux1112.pdf",
      artifactPath: "packages/scoring-circuit/docs/evidence/bp-031/ti-tmux1112pwr-pw0016a-datasheet-rev-c.pdf",
      sha256: "EB7CCF89EC59635B34043D364DB6B1E21B457A0BA7363737408CEBCA30CD6C4D"
    })
    if (source === undefined) throw new Error("TI source fixture is missing")
    const bytes = readFileSync(
      new URL(`../${source.artifactPath.replace("packages/scoring-circuit/", "")}`, import.meta.url)
    )
    expect(createHash("sha256").update(bytes).digest("hex").toUpperCase()).toBe(source.sha256)
    const upstream = bp031Tmux1112PwrPwFootprintEvidence.sourceControl.upstreamSources[0]
    if (upstream === undefined) throw new Error("upstream source fixture is missing")
    const upstreamBytes = readFileSync(
      new URL(`../${upstream.path.replace("packages/scoring-circuit/", "")}`, import.meta.url)
    )
    expect(createHash("sha256").update(upstreamBytes).digest("hex")).toBe(upstream.sha256)
  })

  it("fails closed if the retained-source page mapping drifts", () => {
    const copy = structuredClone(bp031Tmux1112PwrPwFootprintEvidence)
    const source = copy.sources[0]
    if (source === undefined) throw new Error("TI source fixture is missing")
    Reflect.set(source, "reviewedPages", "3, 32-43")
    expect(validateBp031Tmux1112PwrPwFootprintEvidence(copy)).toEqual(
      expect.arrayContaining(["retained TI source identity or SHA-256 drifted"])
    )
  })

  it("derives copper, preferred NSMD mask, unchanged stencil paste, and courtyard geometry", () => {
    const { manufacturerLandPattern, package: packageSpec, projectFootprint } = bp031Tmux1112PwrPwFootprintEvidence
    expect(packageSpec).toMatchObject({
      bodyLengthMm: { minimum: 4.9, maximum: 5.1 },
      bodyWidthMm: { minimum: 4.3, maximum: 4.5 },
      leadSpanMm: { minimum: 6.2, maximum: 6.6 },
      heightMm: { maximum: 1.2 },
      leadPitchMm: 0.65,
      leadWidthMm: { minimum: 0.17, maximum: 0.3 },
      leadLengthMm: { minimum: 0.5, maximum: 0.75 }
    })
    expect(manufacturerLandPattern.copper).toMatchObject({
      padLengthMm: 1.5,
      padWidthMm: 0.45,
      rowCenterSpanMm: 5.8,
      pitchMm: 0.65
    })
    expect(manufacturerLandPattern.solderMask).toMatchObject({
      definition: "non-solder-mask-defined-preferred",
      marginPerEdgeMm: 0.05
    })
    expect(manufacturerLandPattern.paste).toMatchObject({
      apertureLengthMm: 1.5,
      apertureWidthMm: 0.45,
      stencilThicknessMm: 0.125
    })
    expect(projectFootprint).toMatchObject({
      padLengthMm: 1.5,
      padWidthMm: 0.45,
      padRowCenterSpanMm: 5.8,
      padPitchMm: 0.65,
      solderMask: {
        openingLengthMm: 1.6,
        openingWidthMm: 0.55,
        marginPerEdgeMm: 0.05,
        status: "project-input-derived-from-manufacturer-guidance"
      },
      paste: {
        openingLengthMm: 1.5,
        openingWidthMm: 0.45,
        reductionPerEdgeMm: 0,
        status: "project-input-derived-from-manufacturer-guidance"
      },
      courtyard: {
        widthMm: 7.8,
        heightMm: 5.6,
        minimumClearanceMm: 0.25,
        sourceStatus: "not-published"
      }
    })
    expect(projectFootprint.pads).toHaveLength(16)
    expect(projectFootprint.pads.map(({ pin, name }) => ({ pin, name }))).toEqual([
      { pin: 1, name: "SEL1" },
      { pin: 2, name: "D1" },
      { pin: 3, name: "S1" },
      { pin: 4, name: "N.C." },
      { pin: 5, name: "GND" },
      { pin: 6, name: "S4" },
      { pin: 7, name: "D4" },
      { pin: 8, name: "SEL4" },
      { pin: 9, name: "SEL3" },
      { pin: 10, name: "D3" },
      { pin: 11, name: "S3" },
      { pin: 12, name: "N.C." },
      { pin: 13, name: "VDD" },
      { pin: 14, name: "S2" },
      { pin: 15, name: "D2" },
      { pin: 16, name: "SEL2" }
    ])
    expect(projectFootprint.pads[0]).toMatchObject({ pin: 1, name: "SEL1", xMm: -2.9, yMm: 2.275 })
    expect(projectFootprint.pads[7]).toMatchObject({ pin: 8, name: "SEL4", xMm: -2.9, yMm: -2.275 })
    expect(projectFootprint.pads[8]).toMatchObject({ pin: 9, name: "SEL3", xMm: 2.9, yMm: -2.275 })
    expect(projectFootprint.pads[15]).toMatchObject({ pin: 16, name: "SEL2", xMm: 2.9, yMm: 2.275 })
    expect(bp031Tmux1112PwrPwFootprintEvidence.pinOneOrientation).toMatchObject({
      topViewPinOneDatum: "upper-left pin-one index area in Figure 5-1 and PW0016A package outline",
      projectBoardRotationDegrees: 0,
      projectPinOnePad: { pin: 1, xMm: -2.9, yMm: 2.275 },
      independentOrientationReview: "pending-independent-review"
    })
  })

  it("renders all 16 exact pads, source ports, paste, courtyard, and no tscircuit errors", () => {
    const json = renderProjectFootprint()
    const pads = json.filter(isRectSmtPad)
    expect(pads).toHaveLength(16)
    expect(pads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ x: -2.9, y: 2.275, width: 1.5, height: 0.45, soldermask_margin: 0.05 }),
        expect.objectContaining({ x: 2.9, y: 2.275, width: 1.5, height: 0.45, soldermask_margin: 0.05 })
      ])
    )
    const paste = json.filter(isRectPaste)
    expect(paste).toHaveLength(16)
    expect(paste).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ x: -2.9, y: 2.275, width: 1.5, height: 0.45 }),
        expect.objectContaining({ x: 2.9, y: -2.275, width: 1.5, height: 0.45 })
      ])
    )
    expect(json.filter((element) => element.type === "pcb_courtyard_rect")).toEqual(
      expect.arrayContaining([expect.objectContaining({ center: { x: 0, y: 0 }, width: 7.8, height: 5.6 })])
    )
    expect(json.filter((element) => element.type === "source_port")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ pin_number: 1, name: "SEL1", port_hints: expect.arrayContaining(["pin1"]) }),
        expect.objectContaining({ pin_number: 16, name: "SEL2", port_hints: expect.arrayContaining(["pin16"]) })
      ])
    )
    expect(json.filter((element) => element.type.endsWith("_error"))).toEqual([])
  })

  it("binds the canonical rendered geometry hash while keeping release denied", () => {
    expect(renderedGeometryHash()).toBe(bp031Tmux1112PwrPwFootprintEvidence.artwork.sha256)
    expect(bp031Tmux1112PwrPwFootprintEvidence.artwork).toMatchObject({
      state: "generated-project-review-only",
      generator: "tscircuit",
      generatorVersion: "0.0.2271",
      authority: "deny"
    })
  })

  it.each([
    [
      "MPN",
      (copy: typeof bp031Tmux1112PwrPwFootprintEvidence) => Reflect.set(copy, "manufacturerPartNumber", "TMUX1113PWR")
    ],
    [
      "package",
      (copy: typeof bp031Tmux1112PwrPwFootprintEvidence) => Reflect.set(copy.package, "designation", "RSV (UQFN, 16)")
    ],
    [
      "source hash",
      (copy: typeof bp031Tmux1112PwrPwFootprintEvidence) => Reflect.set(copy.sources[0], "sha256", "0".repeat(64))
    ],
    [
      "manufacturer CAD",
      (copy: typeof bp031Tmux1112PwrPwFootprintEvidence) => Reflect.set(copy.manufacturerCad, "authority", "allow")
    ],
    [
      "fabrication acceptance",
      (copy: typeof bp031Tmux1112PwrPwFootprintEvidence) => Reflect.set(copy, "accepted", true)
    ],
    [
      "courtyard",
      (copy: typeof bp031Tmux1112PwrPwFootprintEvidence) => Reflect.set(copy.projectFootprint.courtyard, "widthMm", 1)
    ]
  ])("fails closed on %s drift", (_name, mutate) => {
    const copy = structuredClone(bp031Tmux1112PwrPwFootprintEvidence)
    mutate(copy)
    expect(validateBp031Tmux1112PwrPwFootprintEvidence(copy)).not.toEqual([])
  })
})
