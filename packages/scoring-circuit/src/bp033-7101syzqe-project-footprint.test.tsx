import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  Bp0337101SyzqeProjectFootprint,
  bp0337101SyzqeProjectFootprintGeometry,
  validateBp0337101SyzqeProjectFootprintGeometry
} from "./bp033-7101syzqe-project-footprint.js"
import { renderTestCircuit } from "./test-helper.js"

type CircuitElement = ReturnType<typeof renderTestCircuit>[number]
type RenderedCircleHole = Extract<CircuitElement, { readonly type: "pcb_hole"; readonly hole_shape: "circle" }>
const expectedRetainedDatasheetSha256 = "81C507AE655CBF893635F3E0ED421734A28AF08C975A8279E02070FFDCD353CB"

function isHole(element: CircuitElement): element is RenderedCircleHole {
  return element.type === "pcb_hole" && element.hole_shape === "circle"
}

function isSilkscreenRect(
  element: CircuitElement
): element is Extract<CircuitElement, { readonly type: "pcb_silkscreen_rect" }> {
  return element.type === "pcb_silkscreen_rect"
}

function isSilkscreenCircle(
  element: CircuitElement
): element is Extract<CircuitElement, { readonly type: "pcb_silkscreen_circle" }> {
  return element.type === "pcb_silkscreen_circle"
}

function retainedEvidenceHash(artifactPath: string) {
  const packageRelativePath = artifactPath.replace("docs/", "../docs/")
  return createHash("sha256")
    .update(readFileSync(new URL(packageRelativePath, import.meta.url)))
    .digest("hex")
    .toUpperCase()
}

function renderedReviewGeometryHash() {
  const geometry: Array<Record<string, unknown>> = []
  for (const element of renderTestCircuit(<Bp0337101SyzqeProjectFootprint />)) {
    if (isHole(element)) {
      geometry.push({
        diameter: element.hole_diameter,
        shape: element.hole_shape,
        x: element.x,
        y: element.y
      })
    }
    if (isSilkscreenRect(element)) {
      geometry.push({
        height: element.height,
        dashed: element.is_stroke_dashed ?? false,
        type: element.type,
        width: element.width,
        center: element.center
      })
    }
    if (isSilkscreenCircle(element)) {
      geometry.push({ center: element.center, radius: element.radius, type: element.type })
    }
  }
  return createHash("sha256").update(JSON.stringify(geometry)).digest("hex")
}

describe("BP-033 exact C&K 7101SYZQE review-only source selector", () => {
  it("binds S_SOURCE_SELECTOR to the exact switch configuration and retained source", () => {
    expect(validateBp0337101SyzqeProjectFootprintGeometry()).toBe(true)
    expect(bp0337101SyzqeProjectFootprintGeometry).toMatchObject({
      workUnit: "BP-033",
      reference: "S_SOURCE_SELECTOR",
      canonicalIdentity: {
        manufacturer: "C&K",
        manufacturerPartNumber: "7101SYZQE",
        termination: "Z solder lug"
      },
      configuration: {
        poles: 1,
        throws: 2,
        circuit: "SPDT",
        switchFunction: "On-None-On",
        connectedTerminalsByPosition: [
          { position: "POS. 1", function: "ON", connected: [2, 3] },
          { position: "POS. 2", function: "NONE", connected: [] },
          { position: "POS. 3", function: "ON", connected: [2, 1] }
        ]
      },
      manufacturerCad: { state: "not-modeled-conditional", authority: "deny" },
      sources: [
        expect.objectContaining({
          retention: "unretained-live-page-conditional",
          conditionalClaims: { circuit: "On-On", seal: "Unsealed", termination: "Z solder lug", terminalSeal: "epoxy" },
          conflictDisposition:
            "The current official product page lists On-On and Unsealed, while its terminal specification separately lists epoxy. Those page fields conflict with the retained CM.10/15/24 datasheet for this exact orderable; the retained datasheet remains authoritative and the page fields stay conditional."
        }),
        expect.objectContaining({
          reviewedPages: "1-4",
          sha256: expectedRetainedDatasheetSha256,
          revision: "CM.10/15/24",
          currentUrlRevision: "CM.05/30/25",
          revisionDisposition:
            "Retained-byte revision is authoritative: the retained PDF bytes are CM.10/15/24. The mutable URL currently resolves to CM.05/30/25 and is recorded as revision drift, not substituted evidence."
        })
      ]
    })
    const datasheet = bp0337101SyzqeProjectFootprintGeometry.sources.find((source) => "artifactPath" in source)
    if (datasheet === undefined || !("artifactPath" in datasheet)) throw new Error("retained C&K datasheet missing")
    expect(datasheet.sha256).toBe(expectedRetainedDatasheetSha256)
    expect(retainedEvidenceHash(datasheet.artifactPath)).toBe(expectedRetainedDatasheetSha256)
    expect(bp0337101SyzqeProjectFootprintGeometry.orderableConstruction).toEqual({
      exactCode: "7101SYZQE",
      fields: {
        switchFunction: "7101",
        actuator: "S",
        bushing: "Y",
        termination: "Z",
        contactMaterial: "Q",
        seal: "E"
      },
      construction: "7101|S|Y|Z|Q|E",
      defaultFinishOmissions: {
        bushingFinish: "omitted: nickel on all bushings",
        actuatorFinish: "omitted: bright chrome"
      }
    })
  })

  it("preserves source terminal numbering, mounting drill, and actuator orientation", () => {
    expect(bp0337101SyzqeProjectFootprintGeometry.terminalNumbering.terminals).toEqual([
      { terminal: 1, yMm: -4.7, sourcePosition: "POS. 1", role: "throw" },
      { terminal: 2, yMm: 0, sourcePosition: "POS. 2", role: "common" },
      { terminal: 3, yMm: 4.7, sourcePosition: "POS. 3", role: "throw" }
    ])
    expect(bp0337101SyzqeProjectFootprintGeometry.mounting).toMatchObject({
      mountingType: "panel mount, rear, threaded",
      bushingThread: "1/4-40 UNS-2A",
      panelCutout: {
        shape: "circular",
        diameterMm: 6.35,
        projectArtwork:
          "conditional-unretained-product-page review input; fabricator drill and panel stack-up not selected"
      },
      keyway: { includedBySource: true, angleDegrees: 25, widthMm: null, depthMm: null }
    })
    expect(bp0337101SyzqeProjectFootprintGeometry.actuator).toMatchObject({
      heightMm: 10.67,
      artworkRotationDegrees: 0,
      boardPlacementRotationDegrees: null,
      orientationAccepted: false,
      sourcePositions: {
        "POS. 1": "lever toward negative Y, ON, terminals 2-3 connected",
        "POS. 2": "lever centered, NONE, no terminals connected",
        "POS. 3": "lever toward positive Y, ON, terminals 2-1 connected"
      }
    })
    expect(bp0337101SyzqeProjectFootprintGeometry.sourceRefdesConventionWarning).toMatchObject({
      state: "explicit-warning",
      resolution: "retain the S_ project reference and deny primitive/board integration until root review",
      primitiveDisposition:
        "The generic chip wrapper is retained for isolated artwork; the switch primitive is not introduced because its schematic/simulation behavior is outside this footprint slice."
    })
  })

  it("renders only the review panel hole and source silkscreen datums", () => {
    const rendered = renderTestCircuit(<Bp0337101SyzqeProjectFootprint />)
    expect(bp0337101SyzqeProjectFootprintGeometry.projectReviewArtwork.artworkApproximation).toEqual({
      bodyAndTerminalPcbXMm: 0,
      disposition:
        "intentional Y-datum-only visual approximation; pcbX=0 centers body and terminal rectangles because the source does not provide source-accurate X placement for these review datums",
      sourceAccurateXPlacement: false,
      placementAuthority: "deny"
    })
    expect(rendered.filter(isHole)).toEqual([
      expect.objectContaining({ hole_diameter: 6.35, hole_shape: "circle", x: 0, y: 0 })
    ])
    expect(rendered.filter(isSilkscreenCircle)).toEqual(
      expect.arrayContaining([expect.objectContaining({ radius: 3.175, center: { x: 0, y: 0 } })])
    )
    expect(rendered.filter(isSilkscreenRect)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ width: 6.86, height: 12.7, center: { x: 0, y: 0 } }),
        expect.objectContaining({ width: 2.03, height: 0.76, center: { x: 0, y: -4.7 } }),
        expect.objectContaining({ width: 2.03, height: 0.76, center: { x: 0, y: 0 } }),
        expect.objectContaining({ width: 2.03, height: 0.76, center: { x: 0, y: 4.7 } })
      ])
    )
    expect(rendered.filter(isSilkscreenRect).every((rect) => rect.is_stroke_dashed !== true)).toBe(true)
    expect(
      rendered.filter((element) => ["pcb_smtpad", "pcb_plated_hole", "pcb_solder_paste"].includes(element.type))
    ).toEqual([])
    expect(
      rendered.filter((element) => element.type === "pcb_courtyard_rect" || element.type === "pcb_keepout")
    ).toEqual([])
    expect(rendered.filter((element) => element.type.endsWith("_error"))).toEqual([])
    expect(renderedReviewGeometryHash()).toBe("2e9024f1dd286cacb4228c53edbe6ffd8677bc140a111645918268a2773dd779")
  })

  it("keeps board fit, clearances, mechanical load, CAD import, release, and fabrication denied", () => {
    expect(bp0337101SyzqeProjectFootprintGeometry.projectReviewArtwork).toMatchObject({
      panelCutout: { authority: "conditional-unretained-product-page-review-input" },
      terminalLandings: { state: "not-selected", authority: "deny" },
      courtyard: { state: "not-selected", authority: "deny" },
      boardPlacement: { state: "not-integrated", authority: "deny" }
    })
    expect(bp0337101SyzqeProjectFootprintGeometry.fitClearance).toMatchObject({
      state: "not-reviewed",
      authority: "deny"
    })
    expect(bp0337101SyzqeProjectFootprintGeometry.mechanicalLoad).toMatchObject({
      state: "not-reviewed",
      authority: "deny"
    })
    expect(bp0337101SyzqeProjectFootprintGeometry.acceptance).toMatchObject({
      manufacturerCadImportAccepted: false,
      mountingCutoutReviewed: false,
      terminalLandingsAccepted: false,
      panelPlacementAccepted: false,
      fitClearanceAccepted: false,
      mechanicalLoadAccepted: false,
      boardImportAccepted: false,
      releaseState: "deny",
      fabricationAuthorized: false
    })
  })

  it("fails closed on source evidence, exact geometry, truth data, and refdes-warning drift", () => {
    const rejectPath = (path: readonly string[], replacement: unknown) => {
      const drift = structuredClone(bp0337101SyzqeProjectFootprintGeometry) as unknown as Record<string, unknown>
      let cursor = drift
      for (const key of path.slice(0, -1)) cursor = cursor[key] as Record<string, unknown>
      cursor[path.at(-1)!] = replacement
      expect(() => validateBp0337101SyzqeProjectFootprintGeometry(drift)).toThrow(RangeError)
    }

    rejectPath(["sources", "1", "sha256"], "0".repeat(64))
    rejectPath(["sources", "1", "reviewedPages"], "1-3")
    rejectPath(["sources", "0", "conditionalClaims", "circuit"], "On-None-On")
    rejectPath(["sources", "1", "currentUrlRevision"], "CM.10/15/24")
    rejectPath(["sources", "1", "revisionDisposition"], "current URL wins")
    rejectPath(["canonicalIdentity", "manufacturerPartNumber"], "7101SYCQE")
    rejectPath(["orderableConstruction", "fields", "termination"], "C")
    rejectPath(["configuration", "poles"], 2)
    rejectPath(["configuration", "connectedTerminalsByPosition", "0", "connected"], [1, 3])
    rejectPath(["terminalNumbering", "terminals", "0", "yMm"], -5.08)
    rejectPath(["terminalNumbering", "terminalWidthMm"], 2.54)
    rejectPath(["mounting", "panelCutout", "diameterMm"], 5)
    rejectPath(["mounting", "panelCutout", "projectArtwork"], "approved")
    rejectPath(["mounting", "keyway", "angleDegrees"], 0)
    rejectPath(["actuator", "heightMm"], 12)
    rejectPath(["actuator", "sourcePositions", "POS. 3"], "wrong")
    rejectPath(["manufacturerBody", "topViewWidthMm"], 7)
    rejectPath(["sourceRefdesConventionWarning", "state"], "resolved")
    rejectPath(["projectReviewArtwork", "artworkApproximation", "bodyAndTerminalPcbXMm"], 1)
    rejectPath(["projectReviewArtwork", "artworkApproximation", "sourceAccurateXPlacement"], true)
    rejectPath(["projectReviewArtwork", "artworkApproximation", "placementAuthority"], "allow")
  })

  it("fails closed on every review disposition and acceptance gate", () => {
    const rejectPath = (path: readonly string[], replacement: unknown) => {
      const drift = structuredClone(bp0337101SyzqeProjectFootprintGeometry) as unknown as Record<string, unknown>
      let cursor = drift
      for (const key of path.slice(0, -1)) cursor = cursor[key] as Record<string, unknown>
      cursor[path.at(-1)!] = replacement
      expect(() => validateBp0337101SyzqeProjectFootprintGeometry(drift)).toThrow(RangeError)
    }

    rejectPath(["projectReviewArtwork", "panelCutout", "authority"], "allow")
    rejectPath(["projectReviewArtwork", "terminalLandings", "state"], "selected")
    rejectPath(["projectReviewArtwork", "courtyard", "authority"], "allow")
    rejectPath(["projectReviewArtwork", "boardPlacement", "state"], "integrated")
    rejectPath(["fitClearance", "authority"], "allow")
    rejectPath(["mechanicalLoad", "state"], "reviewed")
    rejectPath(["manufacturerCad", "authority"], "allow")

    const acceptanceFields = Object.keys(bp0337101SyzqeProjectFootprintGeometry.acceptance)
    for (const field of acceptanceFields) {
      const expected = (bp0337101SyzqeProjectFootprintGeometry.acceptance as unknown as Record<string, unknown>)[field]
      rejectPath(["acceptance", field], field === "releaseState" ? "allow" : !expected)
    }
  })
})
