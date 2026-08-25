import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { benchPrototypeApplicationFootprints } from "./bench-prototype-application-footprints.js"
import {
  bp033B340aProjectFootprintGeometry,
  Bp033B340aProjectFootprint,
  validateBp033B340aProjectFootprintGeometry
} from "./bp033-b340a-project-footprint.js"
import { renderTestCircuit } from "./test-helper.js"

const geometry = bp033B340aProjectFootprintGeometry

function renderProjectFootprint() {
  return renderTestCircuit(<Bp033B340aProjectFootprint />)
}

type CircuitElement = ReturnType<typeof renderTestCircuit>[number]

function isSmtPad(
  element: CircuitElement
): element is Extract<CircuitElement, { readonly type: "pcb_smtpad"; readonly shape: "rect" }> {
  return element.type === "pcb_smtpad" && element.shape === "rect"
}

function retainedEvidenceHash(artifactPath: string): string {
  const packageRelativePath = artifactPath.replace("docs/", "../docs/")
  return createHash("sha256")
    .update(readFileSync(new URL(packageRelativePath, import.meta.url)))
    .digest("hex")
    .toUpperCase()
}

function renderedGeometryHash(): string {
  const geometryElements: Array<Record<string, unknown>> = []
  for (const element of renderProjectFootprint()) {
    if (isSmtPad(element)) {
      geometryElements.push({
        height: element.height,
        shape: element.shape,
        soldermask_margin: element.soldermask_margin,
        type: element.type,
        width: element.width,
        x: element.x,
        y: element.y
      })
    }
  }
  return createHash("sha256").update(JSON.stringify(geometryElements)).digest("hex")
}

describe("BP-033 B340A-13-F project footprint", () => {
  it("binds D_SOURCE_SELECTOR to the exact orderable, SMA package, and retained source hash", () => {
    expect(validateBp033B340aProjectFootprintGeometry()).toEqual([])
    expect(geometry).toMatchObject({
      workUnit: "BP-033",
      reference: "D_SOURCE_SELECTOR",
      manufacturer: "Diodes Incorporated",
      manufacturerPartNumber: "B340A-13-F",
      package: { designation: "SMA (DO-214AC)", terminalCount: 2 },
      polarity: { anodePad: "A", cathodePad: "K", sourcePage: 1 },
      landPattern: {
        copper: {
          sourcePage: 6,
          padCount: 2,
          padLengthMm: 2.5,
          padWidthMm: 1.7,
          padCenterSpacingMm: 4,
          padGapMm: 1.5,
          overallSpanMm: 6.5
        }
      }
    })
    expect(geometry.sources).toEqual([
      expect.objectContaining({
        artifactPath: "docs/evidence/bp-033/diodes-b340a-datasheet.pdf",
        sha256: "453CBD34D996482ABD07AC694C4E2D812D26B1D679D05EE325ACC5C3EEB79917"
      })
    ])
    for (const source of geometry.sources) expect(retainedEvidenceHash(source.artifactPath)).toBe(source.sha256)
  })

  it("reconciles the isolated candidate to the canonical BP-033 row", () => {
    expect(
      benchPrototypeApplicationFootprints.records.find((record) => record.reference === geometry.reference)
    ).toMatchObject({
      reference: "D_SOURCE_SELECTOR",
      manufacturer: geometry.manufacturer,
      mpn: geometry.manufacturerPartNumber,
      package: geometry.package.designation,
      manufacturerDrawing: {
        state: "acquired",
        artifactPath: "docs/evidence/bp-033/diodes-b340a-datasheet.pdf",
        sha256: geometry.sources[0]?.sha256
      },
      population: "DNP-unresolved"
    })
  })

  it("records cathode-band orientation and keeps CAD, board, electrical, release, and fabrication denied", () => {
    expect(geometry.orientation).toMatchObject({
      boardRotationDegrees: 0,
      sourceView: "Diodes package top view and suggested pad layout",
      orientationReviewState: "pending-independent-overlay",
      orientationAccepted: false
    })
    expect(geometry.manufacturerCad).toMatchObject({
      state: "not-retained-official-cad",
      officialCadArtifact: null,
      authority: "deny"
    })
    expect(geometry.landPattern).toMatchObject({
      solderMask: { status: "not-published" },
      paste: { status: "not-published" },
      courtyard: { status: "not-published", geometry: null }
    })
    expect(geometry.validation).toMatchObject({
      boardFit: { state: "not-performed", accepted: false },
      electrical: { state: "not-performed", accepted: false }
    })
    expect(geometry.acceptance).toMatchObject({
      exactOrderableBound: true,
      polarityBound: true,
      manufacturerLandPatternTranscribed: true,
      projectGeometryAccepted: false,
      orientationAccepted: false,
      cadImportAccepted: false,
      boardImported: false,
      boardFitAccepted: false,
      electricalValidationAccepted: false,
      releaseState: "deny",
      fabricationAuthorized: false
    })
  })

  it("renders only the two source copper lands and no inferred paste or courtyard", () => {
    const json = renderProjectFootprint()
    const pads = json.filter(isSmtPad)
    expect(pads).toHaveLength(2)
    expect(pads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          port_hints: expect.arrayContaining(["A", "anode"]),
          x: -2,
          y: 0,
          width: 2.5,
          height: 1.7,
          soldermask_margin: 0
        }),
        expect.objectContaining({
          port_hints: expect.arrayContaining(["K", "cathode"]),
          x: 2,
          y: 0,
          width: 2.5,
          height: 1.7,
          soldermask_margin: 0
        })
      ])
    )
    expect(json.filter((element) => element.type === "pcb_solder_paste")).toHaveLength(0)
    expect(json.filter((element) => element.type === "pcb_courtyard_rect")).toHaveLength(0)
    expect(json.filter((element) => element.type.endsWith("_error"))).toEqual([])
  })

  it("hashes the rendered source-controlled copper geometry", () => {
    expect(renderedGeometryHash()).toBe("87a6f500c01f3c0cdc8e00948aec189c899a3a6a63b8026f8098dd073dab8d0b")
  })

  it.each([
    ["source hash", (copy: typeof geometry) => Reflect.set(copy.sources[0] ?? {}, "sha256", "0".repeat(64))],
    ["copper span", (copy: typeof geometry) => Reflect.set(copy.landPattern.copper, "overallSpanMm", 6.4)],
    ["fabrication authority", (copy: typeof geometry) => Reflect.set(copy.acceptance, "fabricationAuthorized", true)]
  ])("rejects forged %s", (_name, mutate) => {
    const copy = structuredClone(geometry)
    mutate(copy)
    expect(validateBp033B340aProjectFootprintGeometry(copy)).not.toEqual([])
  })
})
