import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { defaultBenchPrototypePowerInputs } from "./bench-prototype-power.js"
import {
  Bp033MolexLinksProjectFootprint,
  bp033MolexLinksProjectFootprintGeometry,
  validateBp033MolexLinksProjectFootprint
} from "./bp033-molex-links-project-footprint.js"
import { renderTestCircuit } from "./test-helper.js"

type CircuitElement = ReturnType<typeof renderTestCircuit>[number]
const expectedHeaderDrawingSha256 = "BFEB1A0BEC2417BE7C8E09E0D17800CC7AED1C403F6D93D0747223829F331691"
const expectedHousingDrawingSha256 = "BE541BD8F81F3E5FBE001F04EA344E6FC373B98154CE94561590D0F17821DCE1"
const expectedTerminalProductPageSha256 = "C6BD24AC80092892161422F2953C76AD26BB0A429B3AD2FA71BBEF29896E081A"
const expectedRenderedArtworkSha256 = "CEC9ABB31F10EA6703138506E62B8AE51D708A6B63D66B68ED88E2554AAE29FD"

function isPlatedHole(
  element: CircuitElement
): element is Extract<CircuitElement, { readonly type: "pcb_plated_hole" }> {
  return element.type === "pcb_plated_hole"
}

function retainedEvidenceHash(artifactPath: string) {
  const packageRelativePath = artifactPath.replace("docs/", "../docs/")
  return createHash("sha256")
    .update(readFileSync(new URL(packageRelativePath, import.meta.url)))
    .digest("hex")
    .toUpperCase()
}

function retainedEvidenceText(artifactPath: string) {
  return readFileSync(new URL(artifactPath.replace("docs/", "../docs/"), import.meta.url), "utf8").trim()
}

describe("BP-033 Molex 39-28-1023 measurement-link candidate", () => {
  it("binds the exact Molex header, mating housing, terminal, and four source/load pairs", () => {
    expect(validateBp033MolexLinksProjectFootprint()).toBe(true)
    expect(bp033MolexLinksProjectFootprintGeometry).toMatchObject({
      workUnit: "BP-033",
      references: ["J_LINK_INPUT", "J_LINK_APPLICATION", "J_LINK_DISPLAY", "J_LINK_SCORING"],
      canonicalIdentity: {
        headerMpn: "39-28-1023",
        housingMpn: "39-01-2020",
        terminalMpn: "39-00-0039"
      },
      header: {
        engineeringNumber: "5566-02A",
        pitchMm: 4.2,
        pinOne: { number: 1, xMm: 0, yMm: 2.1 }
      },
      candidateGeometry: {
        drill: { diameterMm: 1.4, sourceToleranceMm: 0.05 },
        candidatePad: { outerDiameterMm: 2.4, sourceAccurate: false }
      },
      netPairs: {
        pairs: [
          { reference: "J_LINK_INPUT", pin1Net: "V20_TO_V5_BUCK", pin2Net: "V20_BUCK_INPUT" },
          { reference: "J_LINK_APPLICATION", pin1Net: "V5", pin2Net: "V5_APPLICATION" },
          { reference: "J_LINK_DISPLAY", pin1Net: "V5_DISPLAY_LIMITED", pin2Net: "V5_DISPLAY_LOAD" },
          { reference: "J_LINK_SCORING", pin1Net: "V5", pin2Net: "V5_SCORING_ISOLATOR_INPUT" }
        ]
      }
    })
    const canonicalLinks = defaultBenchPrototypePowerInputs.measurementLinks
    expect(bp033MolexLinksProjectFootprintGeometry.netPairs.pairs).toEqual(
      [canonicalLinks.input, canonicalLinks.application, canonicalLinks.display, canonicalLinks.isolatedScoring].map(
        ({ label, pin1Net, pin2Net }) => ({ reference: label, pin1Net, pin2Net, pin1Role: "source", pin2Role: "load" })
      )
    )

    expect(bp033MolexLinksProjectFootprintGeometry.sources[1].reviewedPages).toBe(
      "retained PDF page 6; Molex SD-5557-003 drawing sheet 2 of 2; 39-01-2020 / 5557-02R chart row"
    )

    const expectedHashes = new Map([
      ["docs/evidence/bp-033/molex-39281023-product-page.pdf", expectedHeaderDrawingSha256],
      ["docs/evidence/bp-033/molex-5557-39-01-2020-housing-drawing.pdf", expectedHousingDrawingSha256],
      ["docs/evidence/bp-033/molex-5556-39-00-0039-product-page.pdf", expectedTerminalProductPageSha256]
    ])
    for (const source of bp033MolexLinksProjectFootprintGeometry.sources) {
      expect(expectedHashes.get(source.artifactPath)).toBe(source.sha256)
      expect(retainedEvidenceHash(source.artifactPath)).toBe(source.sha256)
    }
  })

  it("renders the 1.40 mm source drill and explicitly candidate-only 2.40 mm pads with pin one orientation", () => {
    const renderedArtwork = renderTestCircuit(<Bp033MolexLinksProjectFootprint />)
    const holes = renderedArtwork.filter(isPlatedHole)
    expect(holes).toHaveLength(2)
    expect(holes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          shape: "circular_hole_with_rect_pad",
          x: 0,
          y: 2.1,
          hole_diameter: 1.4,
          rect_pad_width: 2.4,
          rect_pad_height: 2.4,
          rect_border_radius: 1.2,
          port_hints: expect.arrayContaining(["pin1", "circuit1"])
        }),
        expect.objectContaining({
          shape: "circular_hole_with_rect_pad",
          x: 0,
          y: -2.1,
          hole_diameter: 1.4,
          rect_pad_width: 2.4,
          rect_pad_height: 2.4,
          rect_border_radius: 1.2,
          port_hints: expect.arrayContaining(["pin2", "circuit2"])
        })
      ])
    )
    expect(bp033MolexLinksProjectFootprintGeometry.candidateGeometry).toMatchObject({
      state: "review-only-candidate-not-manufacturer-land-pattern",
      candidatePad: { shape: "circular_hole_with_rect_pad", sourceAccurate: false, status: "project candidate only" },
      artworkApproximation: {
        localPcbXMm: 0,
        sourceAccurateRelativePattern: true,
        placementAuthority: "deny"
      }
    })
    expect(renderedArtwork.filter((element) => element.type.endsWith("_error"))).toEqual([])
    expect(createHash("sha256").update(JSON.stringify(renderedArtwork)).digest("hex").toUpperCase()).toBe(
      expectedRenderedArtworkSha256
    )
    expect(retainedEvidenceText("docs/evidence/bp-033/molex-links-rendered-artwork.sha256")).toBe(
      expectedRenderedArtworkSha256
    )
    expect(bp033MolexLinksProjectFootprintGeometry.renderedArtwork).toEqual({
      artifactPath: "docs/evidence/bp-033/molex-links-rendered-artwork.sha256",
      serialization: "JSON.stringify(renderTestCircuit(<Bp033MolexLinksProjectFootprint />))",
      sha256: expectedRenderedArtworkSha256
    })
  })

  it("keeps CAD, integration, fit, clearance, load, assembly, release, and fabrication denied", () => {
    expect(bp033MolexLinksProjectFootprintGeometry.manufacturerCad).toEqual({
      officialCadLinksPublished: true,
      state: "available-not-retained",
      officialCadArtifact: null,
      authority: "deny",
      disposition:
        "Molex product pages list CAD, STEP, and PRO/E links for the header and housing, but no official CAD artifact is retained or imported in this candidate. The terminal drawing link is recorded without a CAD claim."
    })
    expect(bp033MolexLinksProjectFootprintGeometry.denyGates).toMatchObject({
      boardPlacement: { state: "not-integrated", authority: "deny" },
      panelHole: { state: "not-applicable-to-through-hole-board-header", authority: "deny" },
      fitClearance: { state: "not-reviewed", authority: "deny" },
      mechanicalLoad: { state: "not-reviewed", authority: "deny" },
      courtyard: { state: "not-selected", authority: "deny" },
      terminalLandings: { state: "candidate-only", authority: "deny" },
      acceptance: {
        drillCandidateAccepted: false,
        padGeometryAccepted: false,
        housingCadImportAccepted: false,
        terminalCadImportAccepted: false,
        electricalIntegrationAccepted: false,
        boardImportAccepted: false,
        fitClearanceAccepted: false,
        mechanicalLoadAccepted: false,
        assemblyProcessAccepted: false,
        releaseState: "deny",
        fabricationAuthorized: false
      }
    })
  })

  it("runtime-freezes the exported evidence and rejects direct deny or provenance mutation", () => {
    const evidence = bp033MolexLinksProjectFootprintGeometry
    const expectDirectMutationDenied = (target: object, key: PropertyKey, value: unknown) => {
      expect(Reflect.set(target, key, value)).toBe(false)
      expect(validateBp033MolexLinksProjectFootprint()).toBe(true)
    }

    expect(Object.isFrozen(evidence)).toBe(true)
    expect(Object.isFrozen(evidence.denyGates)).toBe(true)
    expect(Object.isFrozen(evidence.denyGates.acceptance)).toBe(true)
    expect(Object.isFrozen(evidence.denyGates.boardPlacement)).toBe(true)
    expect(Object.isFrozen(evidence.sources)).toBe(true)
    expect(Object.isFrozen(evidence.sources[0])).toBe(true)
    expect(Object.isFrozen(evidence.renderedArtwork)).toBe(true)

    expectDirectMutationDenied(evidence.denyGates.acceptance, "releaseState", "allow")
    expectDirectMutationDenied(evidence.denyGates.boardPlacement, "authority", "allow")
    expectDirectMutationDenied(evidence.sources[0], "sha256", "0".repeat(64))
    expectDirectMutationDenied(evidence.renderedArtwork, "sha256", "0".repeat(64))
  })

  it("fails closed on provenance, exact geometry, source/load mapping, CAD disposition, and every deny gate", () => {
    const rejectPath = (path: readonly string[], replacement: unknown) => {
      const drift = structuredClone(bp033MolexLinksProjectFootprintGeometry) as unknown as Record<string, unknown>
      let cursor = drift
      for (const key of path.slice(0, -1)) cursor = cursor[key] as Record<string, unknown>
      cursor[path.at(-1)!] = replacement
      expect(() => validateBp033MolexLinksProjectFootprint(drift)).toThrow(RangeError)
    }

    rejectPath(["sources", "0", "sha256"], "0".repeat(64))
    rejectPath(["sources", "1", "reviewedPages"], "1")
    rejectPath(["sources", "2", "drawingUrl"], "https://example.invalid")
    rejectPath(["header", "pinOne", "yMm"], -2.1)
    rejectPath(["header", "pitchMm"], 5.08)
    rejectPath(["housing", "matingPartNumber"], "39-01-2040")
    rejectPath(["terminal", "wireRangeAwg"], "26-30")
    rejectPath(["candidateGeometry", "drill", "diameterMm"], 1.0)
    rejectPath(["candidateGeometry", "candidatePad", "sourceAccurate"], true)
    rejectPath(["candidateGeometry", "artworkApproximation", "placementAuthority"], "allow")
    rejectPath(["netPairs", "pairs", "0", "pin2Net"], "APP_GND")
    rejectPath(["renderedArtwork", "sha256"], "0".repeat(64))
    rejectPath(["manufacturerCad", "authority"], "allow")
    rejectPath(["denyGates", "boardPlacement", "authority"], "allow")
    rejectPath(["denyGates", "panelHole", "authority"], "allow")
    rejectPath(["denyGates", "courtyard", "authority"], "allow")

    const acceptance = bp033MolexLinksProjectFootprintGeometry.denyGates.acceptance
    for (const field of Object.keys(acceptance)) {
      const expected = (acceptance as unknown as Record<string, unknown>)[field]
      rejectPath(["denyGates", "acceptance", field], field === "releaseState" ? "allow" : !expected)
    }
  })

  it("rejects hidden, symbol, getter, prototype, cycle, and alias graph drift without invoking getters", () => {
    const rejectMutation = (mutate: (drift: Record<string, unknown>) => void) => {
      const drift = structuredClone(bp033MolexLinksProjectFootprintGeometry) as unknown as Record<string, unknown>
      mutate(drift)
      expect(() => validateBp033MolexLinksProjectFootprint(drift)).toThrow(RangeError)
    }

    rejectMutation((drift) => {
      const source = (drift.sources as Array<Record<string, unknown>>)[0]
      Object.defineProperty(source, "hidden", { configurable: true, enumerable: false, value: "drift" })
    })
    rejectMutation((drift) => {
      const source = (drift.sources as Array<Record<string, unknown>>)[0]
      Object.defineProperty(source, Symbol("drift"), { configurable: true, enumerable: false, value: "drift" })
    })
    let getterInvoked = false
    const getterDrift = structuredClone(bp033MolexLinksProjectFootprintGeometry) as unknown as Record<string, unknown>
    Object.defineProperty((getterDrift.sources as Array<Record<string, unknown>>)[0], "sha256", {
      configurable: true,
      enumerable: true,
      get: () => {
        getterInvoked = true
        return expectedHeaderDrawingSha256
      }
    })
    expect(() => validateBp033MolexLinksProjectFootprint(getterDrift)).toThrow(RangeError)
    expect(getterInvoked).toBe(false)
    rejectMutation((drift) => Object.setPrototypeOf((drift.sources as Array<Record<string, unknown>>)[0], null))
    rejectMutation((drift) => {
      drift.canonicalIdentity = drift
    })
    rejectMutation((drift) => {
      const sources = drift.sources as Array<Record<string, unknown>>
      sources[1] = sources[0]
    })
  })
})
