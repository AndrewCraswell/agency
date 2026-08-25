import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  Bp031WeaponFixture430451200Footprint,
  bp031WeaponFixture430451200FootprintEvidence,
  validateBp031WeaponFixture430451200FootprintEvidence
} from "./bp031-weapon-fixture-43045-1200-footprint-evidence.js"
import { renderTestCircuit } from "./test-helper.js"

type CircuitElement = ReturnType<typeof renderTestCircuit>[number]

function sha256(path: URL) {
  return createHash("sha256").update(readFileSync(path)).digest("hex").toUpperCase()
}

function renderedArtworkDigest() {
  const rendered = renderTestCircuit(<Bp031WeaponFixture430451200Footprint />)
  const geometry: Array<Record<string, unknown>> = []
  for (const element of rendered) {
    if (isPlatedHole(element)) {
      geometry.push({
        hole_diameter: element.hole_diameter,
        rect_border_radius: element.rect_border_radius,
        rect_pad_height: element.rect_pad_height,
        rect_pad_width: element.rect_pad_width,
        soldermask_margin: element.soldermask_margin,
        type: element.type,
        x: element.x,
        y: element.y
      })
    }
    if (isCircularHole(element)) {
      geometry.push({ hole_diameter: element.hole_diameter, type: element.type, x: element.x, y: element.y })
    }
  }
  return createHash("sha256").update(JSON.stringify(geometry)).digest("hex")
}

type RenderedPlatedHole = CircuitElement & {
  readonly hole_diameter: number
  readonly rect_border_radius: number
  readonly rect_pad_height: number
  readonly rect_pad_width: number
  readonly type: "pcb_plated_hole"
}

type RenderedCircularHole = CircuitElement & { readonly hole_diameter: number; readonly type: "pcb_hole" }

function isPlatedHole(element: CircuitElement): element is RenderedPlatedHole {
  return (
    element.type === "pcb_plated_hole" &&
    "hole_diameter" in element &&
    "rect_border_radius" in element &&
    "rect_pad_height" in element &&
    "rect_pad_width" in element
  )
}

function isCircularHole(element: CircuitElement): element is RenderedCircularHole {
  return element.type === "pcb_hole" && "hole_diameter" in element
}

describe("BP-031 Molex 43045-1200 weapon-fixture footprint evidence", () => {
  it("hash-binds the exact retained Molex sources and canonical BP-031/BP-104 identity", () => {
    expect(validateBp031WeaponFixture430451200FootprintEvidence()).toBe(true)
    const { sources } = bp031WeaponFixture430451200FootprintEvidence
    expect(sha256(new URL("../docs/evidence/bp-104/assets/43045-1200-drawing.pdf", import.meta.url))).toBe(
      sources.manufacturerDrawing.sha256
    )
    expect(sha256(new URL("../docs/evidence/bp-104/assets/43045-1200-cad-preview.pdf", import.meta.url))).toBe(
      sources.manufacturerCadPreview.sha256
    )
    expect(sha256(new URL("./bench-prototype-fixture-harness.ts", import.meta.url))).toBe(sources.bp104Identity.sha256)
    expect(sha256(new URL("./bench-prototype-analog-footprint-closure.ts", import.meta.url))).toBe(
      sources.bp031Identity.sha256
    )
    expect(bp031WeaponFixture430451200FootprintEvidence.canonicalIdentity).toMatchObject({
      sourceContract: "BP-104",
      boardReference: "J_WEAPON_FIXTURE",
      manufacturerPartNumber: "43045-1200",
      positions: 12,
      rows: 2
    })
  })

  it("locks circuit 1, the 12-circuit numbering, manufacturer holes, edge rule, and orientation", () => {
    const { manufacturerGeometry, orientation } = bp031WeaponFixture430451200FootprintEvidence
    expect(manufacturerGeometry.contactLayout.circuitOneDatum).toEqual({
      pin: 1,
      xMm: 0,
      yMm: 0,
      drawingMark: "CIRCUIT 1"
    })
    expect(manufacturerGeometry.contactLayout.pins).toEqual([
      { pin: 1, xMm: 0, yMm: 0 },
      { pin: 2, xMm: -3, yMm: 0 },
      { pin: 3, xMm: -6, yMm: 0 },
      { pin: 4, xMm: -9, yMm: 0 },
      { pin: 5, xMm: -12, yMm: 0 },
      { pin: 6, xMm: -15, yMm: 0 },
      { pin: 7, xMm: 0, yMm: -3 },
      { pin: 8, xMm: -3, yMm: -3 },
      { pin: 9, xMm: -6, yMm: -3 },
      { pin: 10, xMm: -9, yMm: -3 },
      { pin: 11, xMm: -12, yMm: -3 },
      { pin: 12, xMm: -15, yMm: -3 }
    ])
    expect(manufacturerGeometry.contactLayout.contactHoleDiameterMm).toEqual({ nominal: 1.02, tolerance: 0.05 })
    expect(manufacturerGeometry.retention).toMatchObject({
      holeDiameterMm: { nominal: 3, tolerance: 0.05 },
      contactToRetentionRowMm: { nominal: 4.32, tolerance: 0.08 },
      endInsetMm: { nominal: 2.15, tolerance: 0.05 },
      retentionHoleSpanMm: { nominal: 10.7, tolerance: 0.08 },
      holes: [
        { name: "retention-a", xMm: -2.15, yMm: 4.32 },
        { name: "retention-b", xMm: -12.85, yMm: 4.32 }
      ]
    })
    expect(manufacturerGeometry.bodyAndMating.boardEdgeRule.maximumDistanceMm).toBe(10.16)
    expect(manufacturerGeometry.bodyAndMating.mate).toMatchObject({ manufacturerPartNumber: "43025-1200" })
    expect(orientation).toMatchObject({
      boardRotationDegrees: 0,
      pinOne: { pin: 1, xMm: 0, yMm: 0 },
      polarizedToMate: true,
      latchLock: true,
      independentPhysicalReview: "pending"
    })
  })

  it("renders the bounded project artwork and locks its digest", () => {
    const rendered = renderTestCircuit(<Bp031WeaponFixture430451200Footprint />)
    const contacts = rendered.filter(isPlatedHole)
    expect(contacts).toHaveLength(12)
    expect(contacts.map(({ x, y, hole_diameter }) => ({ x, y, hole_diameter }))).toEqual(
      bp031WeaponFixture430451200FootprintEvidence.manufacturerGeometry.contactLayout.pins.map(({ xMm, yMm }) => ({
        x: xMm,
        y: yMm,
        hole_diameter: 1.02
      }))
    )
    expect(rendered.filter(isCircularHole)).toEqual([
      expect.objectContaining({ x: -2.15, y: 4.32, hole_diameter: 3 }),
      expect.objectContaining({ x: -12.85, y: 4.32, hole_diameter: 3 })
    ])
    expect(rendered.filter((element) => element.type === "pcb_solder_paste")).toHaveLength(0)
    expect(rendered.filter((element) => element.type.endsWith("_error"))).toEqual([])
    expect(renderedArtworkDigest()).toBe(bp031WeaponFixture430451200FootprintEvidence.renderedArtwork.digest)
  })

  it("keeps manufacturer evidence separate from project inputs and denies release", () => {
    const { acceptance, projectReviewInputs, sources } = bp031WeaponFixture430451200FootprintEvidence
    expect(sources.manufacturerCadPreview.disposition).toBe("exact-retained-cad-preview-not-footprint-approval")
    expect(projectReviewInputs).toMatchObject({
      copperForRenderedContacts: { status: "project-input-not-published-by-molex" },
      solderMaskForRenderedContacts: { status: "project-input-not-published-by-molex" },
      courtyard: { state: "not-selected" },
      boardPlacement: { state: "not-integrated" }
    })
    expect(acceptance).toMatchObject({ accepted: false, fabricationAuthority: "deny", physicalAuthority: "deny" })
    expect(() => validateBp031WeaponFixture430451200FootprintEvidence({})).toThrow(RangeError)
  })
})
