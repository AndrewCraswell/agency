import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  Bp031Ads8881IdgsDgsFootprintCandidate,
  bp031Ads8881IdgsDgsFootprintCandidate,
  validateBp031Ads8881IdgsDgsFootprintCandidate,
  validateBp031Ads8881IdgsDgsSourceControl
} from "./bp031-ads8881idgs-dgs-footprint-candidate.js"
import { renderTestCircuit } from "./test-helper.js"

type CircuitElement = ReturnType<typeof renderTestCircuit>[number]

function isRectSmtPad(
  element: CircuitElement
): element is Extract<CircuitElement, { shape: "rect"; type: "pcb_smtpad" }> {
  return element.type === "pcb_smtpad" && element.shape === "rect"
}

function isRectSolderPaste(
  element: CircuitElement
): element is Extract<CircuitElement, { shape: "rect"; type: "pcb_solder_paste" }> {
  return element.type === "pcb_solder_paste" && element.shape === "rect"
}

function isCourtyardRect(element: CircuitElement): element is Extract<CircuitElement, { type: "pcb_courtyard_rect" }> {
  return element.type === "pcb_courtyard_rect"
}

function renderCandidate() {
  return renderTestCircuit(<Bp031Ads8881IdgsDgsFootprintCandidate />)
}

function sha256(path: string): string {
  return createHash("sha256")
    .update(readFileSync(new URL(`../${path.replace("packages/scoring-circuit/", "")}`, import.meta.url)))
    .digest("hex")
    .toUpperCase()
}

function renderedGeometryHash(): string {
  const geometry: Array<Record<string, unknown>> = []
  for (const element of renderCandidate()) {
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
        shape: element.shape,
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

describe("BP-031 ADS8881IDGS DGS VSSOP-10 footprint candidate", () => {
  it("binds the exact MPN/package and retained TI source with deny-by-default CAD state", () => {
    expect(validateBp031Ads8881IdgsDgsFootprintCandidate()).toEqual([])
    expect(bp031Ads8881IdgsDgsFootprintCandidate).toMatchObject({
      artifactKind: "bp031-ads8881idgs-dgs-footprint-candidate",
      workUnit: "BP-031",
      manufacturer: "Texas Instruments",
      manufacturerPartNumber: "ADS8881IDGS",
      package: {
        option: "DGS",
        designation: "VSSOP-10",
        bodyLengthMm: { minimum: 4.75, maximum: 5.05 },
        bodyWidthMm: { minimum: 2.9, maximum: 3.1 },
        packageHeightMaximumMm: 1.1,
        leadPitchMm: 0.5,
        manufacturerRowCenterSpanMm: 4.4,
        manufacturerPadLengthMm: 1.45,
        manufacturerPadWidthMm: 0.3,
        manufacturerPadCornerRadiusMm: 0.05,
        drawingIdentifier: "DGS0010A",
        drawingRevision: "4221984/A 05/2015"
      },
      sourceBinding: {
        sourceContract: "BP-101",
        canonicalSourceReference: "U_SAR",
        manufacturerPartNumber: "ADS8881IDGS",
        package: "DGS VSSOP-10"
      },
      manufacturerCad: { state: "not-acquired", authority: "deny" },
      partnerCad: {
        provider: "Ultra Librarian",
        availability: "listed-by-ti-not-retrieved",
        retainedArtifactPath: null,
        sha256: null,
        authority: "deny"
      },
      projectFootprint: {
        state: "review-only",
        orientationStatus: "manufacturer-drawing-derived-awaiting-independent-review",
        fabricationAuthority: "deny",
        accepted: false
      },
      releaseState: "deny",
      fabricationAuthority: "deny",
      accepted: false
    })
    expect(bp031Ads8881IdgsDgsFootprintCandidate.sources).toEqual([
      expect.objectContaining({
        reviewedPages: "6-7, 50, 55-57",
        artifactPath: "packages/scoring-circuit/docs/evidence/bp-031/texas-instruments-ads8881-dgs-datasheet-rev-d.pdf",
        sha256: "EA5896CA4C8053A1AE183BE8354DD551A5D947CE670AC1F1170C59176148F1A8"
      })
    ])
    for (const source of bp031Ads8881IdgsDgsFootprintCandidate.sources) {
      expect(sha256(source.artifactPath)).toBe(source.sha256)
    }
    for (const source of bp031Ads8881IdgsDgsFootprintCandidate.sourceControl.upstreamSources) {
      expect(sha256(source.path)).toBe(source.sha256)
    }
  })

  it("binds source-code hashes and fails closed when the source control graph drifts", () => {
    expect(bp031Ads8881IdgsDgsFootprintCandidate.sourceControl.upstreamSources).toEqual([
      {
        path: "packages/scoring-circuit/src/bench-prototype-analog-topology.ts",
        sha256: "1F888DD5AA328FAD823738F09A48502EF50189775D5E1920A09413A32C14360D"
      },
      {
        path: "packages/scoring-circuit/src/bench-prototype-analog-footprint-closure.ts",
        sha256: "09446FCDD1D8543C5F97A87DDDF20AADF99054BAB204424FFDF069E8A8C40144"
      }
    ])
    const sourceControl = {
      basisRef: bp031Ads8881IdgsDgsFootprintCandidate.sourceControl.basisRef,
      upstreamSources: bp031Ads8881IdgsDgsFootprintCandidate.sourceControl.upstreamSources.map((source, index) =>
        index === 0 ? { ...source, sha256: "DRIFT" } : source
      )
    }
    expect(validateBp031Ads8881IdgsDgsSourceControl(sourceControl)).toEqual([
      "source control hash drifted for packages/scoring-circuit/src/bench-prototype-analog-topology.ts"
    ])
    expect(validateBp031Ads8881IdgsDgsFootprintCandidate()).toEqual([])
  })

  it("binds page 50 to the exact ADS8881IDGS VSSOP DGS orderable and fails closed on page-scope drift", () => {
    const source = bp031Ads8881IdgsDgsFootprintCandidate.sources[0]
    expect(source).toMatchObject({
      id: "ti-ads8881-sbas547d-rev-d-dgs0010a",
      reviewedPages: "6-7, 50, 55-57"
    })
    const copy = structuredClone(bp031Ads8881IdgsDgsFootprintCandidate)
    const copySource = copy.sources[0]
    if (copySource === undefined) throw new Error("TI ADS8881 source fixture is missing")
    Reflect.set(copySource, "reviewedPages", "6-7, 55-57")
    expect(validateBp031Ads8881IdgsDgsFootprintCandidate(copy)).toEqual(
      expect.arrayContaining(["exact TI ADS8881 reviewed page scope drifted"])
    )
  })

  it("derives the manufacturer copper, mask, paste, and courtyard coordinates", () => {
    const pads = renderCandidate().filter(isRectSmtPad)
    expect(pads).toHaveLength(10)
    expect(pads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ x: -2.2, y: -1, width: 1.45, height: 0.3, soldermask_margin: 0.05 }),
        expect.objectContaining({ x: -2.2, y: 1, width: 1.45, height: 0.3, soldermask_margin: 0.05 }),
        expect.objectContaining({ x: 2.2, y: 1, width: 1.45, height: 0.3, soldermask_margin: 0.05 }),
        expect.objectContaining({ x: 2.2, y: -1, width: 1.45, height: 0.3, soldermask_margin: 0.05 })
      ])
    )
    expect(renderCandidate().filter(isRectSolderPaste)).toHaveLength(10)
    expect(renderCandidate().filter(isRectSolderPaste)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ x: -2.2, y: -1, width: 1.45, height: 0.3 }),
        expect.objectContaining({ x: 2.2, y: 1, width: 1.45, height: 0.3 })
      ])
    )
    expect(renderCandidate().filter(isCourtyardRect)).toEqual([
      expect.objectContaining({ center: { x: 0, y: 0 }, width: 6.35, height: 3.6 })
    ])
    expect(renderCandidate().filter((element) => element.type.endsWith("_error"))).toEqual([])
  })

  it("hashes the canonical rendered geometry and keeps the release gate closed", () => {
    expect(renderedGeometryHash()).toBe(bp031Ads8881IdgsDgsFootprintCandidate.artwork.sha256)
    expect(bp031Ads8881IdgsDgsFootprintCandidate.projectFootprint).toMatchObject({
      pads: expect.arrayContaining([
        { pin: 1, xMm: -2.2, yMm: -1 },
        { pin: 10, xMm: 2.2, yMm: -1 }
      ]),
      courtyard: {
        minimumXMm: -3.175,
        maximumXMm: 3.175,
        minimumYMm: -1.8,
        maximumYMm: 1.8,
        widthMm: 6.35,
        heightMm: 3.6,
        sourceStatus: "not-published"
      },
      fabricationAuthority: "deny",
      accepted: false
    })
  })
})
