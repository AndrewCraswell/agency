import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { benchPrototypeAnalogFootprintClosure } from "./bench-prototype-analog-footprint-closure.js"
import {
  bp031MurataGrm21br71a106ke51l0805CandidateFootprint,
  Bp031MurataGrm21br71a106ke51l0805CandidateFootprint,
  validateBp031MurataGrm21br71a106ke51l0805CandidateFootprint
} from "./bp031-murata-grm21br71a106ke51l-0805-candidate-footprint.js"
import { renderTestCircuit } from "./test-helper.js"

type CircuitElement = ReturnType<typeof renderTestCircuit>[number]

function isRectSmtPad(
  element: CircuitElement
): element is Extract<CircuitElement, { readonly shape: "rect"; readonly type: "pcb_smtpad" }> {
  return element.type === "pcb_smtpad" && element.shape === "rect"
}

function isRectSolderPaste(
  element: CircuitElement
): element is Extract<CircuitElement, { readonly shape: "rect"; readonly type: "pcb_solder_paste" }> {
  return element.type === "pcb_solder_paste" && element.shape === "rect"
}

function hashArtifact(artifactPath: string) {
  const packageRelativePath = artifactPath.replace("packages/scoring-circuit/", "")
  return createHash("sha256")
    .update(readFileSync(new URL(`../${packageRelativePath}`, import.meta.url)))
    .digest("hex")
    .toUpperCase()
}

function hashSource(sourcePath: string) {
  const packageRelativePath = sourcePath.replace("packages/scoring-circuit/", "")
  return createHash("sha256")
    .update(readFileSync(new URL(`../${packageRelativePath}`, import.meta.url)))
    .digest("hex")
    .toUpperCase()
}

function renderedGeometryHash() {
  const geometry: Array<Record<string, unknown>> = []
  for (const element of renderTestCircuit(<Bp031MurataGrm21br71a106ke51l0805CandidateFootprint />)) {
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
  }
  return createHash("sha256").update(JSON.stringify(geometry)).digest("hex").toUpperCase()
}

describe("BP-031 Murata GRM21BR71A106KE51L 0805 candidate footprint", () => {
  it("binds the exact MPN, seven C_REF references, retained Murata source, and denied CAD", () => {
    expect(validateBp031MurataGrm21br71a106ke51l0805CandidateFootprint()).toEqual([])
    expect(bp031MurataGrm21br71a106ke51l0805CandidateFootprint).toMatchObject({
      artifactKind: "bp031-murata-grm21br71a106ke51l-0805-candidate-footprint",
      workUnit: "BP-031",
      manufacturer: "Murata",
      manufacturerPartNumber: "GRM21BR71A106KE51L",
      sourceContract: "BP-101",
      role: "SAR reference reservoir",
      primaryProductPageUrl: "https://www.murata.com/en-us/products/productdetail?partno=GRM21BR71A106KE51L",
      sourceBinding: {
        canonicalSourceReference: "C_REF",
        replicatedReferencePrefix: "C_REF_",
        manufacturerPartNumber: "GRM21BR71A106KE51L",
        package: "0805 (2012M)",
        exactOrderableSourceId: "murata-grm21br71a106ke51-reference-sheet",
        landPatternSourceId: "murata-grm21br71a106ke51-reference-sheet",
        landPatternApplicability: expect.stringContaining("not exact-orderable CAD"),
        sourceSha256: "AC47072BAD3F60AA4E193192AB01C02507A3F61944F8B45F23B1F2793F207EFB"
      },
      sourceControl: {
        basisCommit: "c6a0723a719551c1632ff2eff5b528409b4cac57",
        upstreamSources: [
          {
            path: "packages/scoring-circuit/src/bench-prototype-seven-channel-analog.ts",
            sha256: "AC47072BAD3F60AA4E193192AB01C02507A3F61944F8B45F23B1F2793F207EFB"
          }
        ]
      },
      affectedReferences: ["C_REF_1", "C_REF_2", "C_REF_3", "C_REF_4", "C_REF_5", "C_REF_6", "C_REF_7"],
      manufacturerCad: {
        state: "not-acquired",
        authority: "deny",
        availability: "not-confirmed",
        retainedArtifactPath: null,
        sha256: null,
        disposition: "not-acquired-no-substitute"
      },
      orientation: { state: "non-polar", assemblyRotationDeg: null, pinOne: "not-applicable" },
      artwork: {
        state: "generated-project-review-only",
        representation: "canonical-rendered-footprint-soup-geometry",
        generator: "tscircuit",
        generatorVersion: "0.0.2271",
        sha256: expect.any(String),
        authority: "deny"
      },
      releaseState: "deny",
      fabricationAuthority: "deny",
      accepted: false
    })
    expect(bp031MurataGrm21br71a106ke51l0805CandidateFootprint.sources).toEqual([
      expect.objectContaining({
        id: "murata-grm21br71a106ke51-reference-sheet",
        applicability: "exact-orderable-identity-package-and-electrical",
        pagePurposes: {
          exactOrderableIdentityPackageAndElectrical: "1",
          familyReflowLandGuidance: "25",
          stressAndPlacementWarnings: "24-25"
        },
        artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/murata-grm21br71a106ke51l-datasheet.pdf",
        sha256: "E8432C7ACFA982B24EB06DD145682F78051DC4649ABBEB35BBCA8646B1408E4F"
      })
    ])
    expect(bp031MurataGrm21br71a106ke51l0805CandidateFootprint.placementReview).toMatchObject({
      state: "pending-independent-review",
      boardPlacementStatus: "not-reviewed",
      boardIntegrationAuthority: "deny",
      boardFitAccepted: false,
      assemblyClearanceAccepted: false
    })
    expect(bp031MurataGrm21br71a106ke51l0805CandidateFootprint.acceptance).toMatchObject({
      packageIdentityReviewed: true,
      projectGeometryAccepted: false,
      pinOneOrientationAccepted: false,
      placementAccepted: false,
      cadImportAccepted: false,
      boardFitAccepted: false,
      fabricationAuthorized: false,
      releaseState: "deny"
    })
    for (const source of bp031MurataGrm21br71a106ke51l0805CandidateFootprint.sources) {
      expect(hashArtifact(source.artifactPath)).toBe(source.sha256)
    }
    expect(hashSource(bp031MurataGrm21br71a106ke51l0805CandidateFootprint.sourceBinding.canonicalSourcePath)).toBe(
      bp031MurataGrm21br71a106ke51l0805CandidateFootprint.sourceBinding.sourceSha256
    )
  })

  it("retains Murata package limits and separates reflow guidance from project geometry", () => {
    const {
      manufacturerLandPattern,
      package: packageSpec,
      projectSelection
    } = bp031MurataGrm21br71a106ke51l0805CandidateFootprint
    expect(packageSpec).toMatchObject({
      designation: "GRM21 (2012M / 0805)",
      packageCode: "21",
      lengthMm: { nominal: 2, plus: 0.15, minus: 0.15 },
      widthMm: { nominal: 1.25, plus: 0.15, minus: 0.15 },
      thicknessMm: { nominal: 1.25, plus: 0.15, minus: 0.15 },
      terminalLengthMm: { minimum: 0.2, maximum: 0.7 },
      terminalGapMm: { minimum: 0.7 }
    })
    expect(manufacturerLandPattern).toMatchObject({
      sourceScope: expect.stringContaining("GRM21-family"),
      applicability: expect.stringContaining("GRM21-family"),
      reviewedPage: 25,
      sourceTable: "Table 2 Reflow Soldering Method",
      chipDimensionRow: "2.0 x 1.25 mm (±0.15)",
      chipDimensionTolerance: "±0.15",
      innerGapMm: { minimum: 1.2, maximum: 1.2 },
      padLengthMm: { minimum: 0.6, maximum: 0.8 },
      padWidthMm: { minimum: 1.2, maximum: 1.4 }
    })
    expect(projectSelection).toMatchObject({
      solderingMethod: "reflow",
      manufacturerParameterSelectionMm: { aInnerGap: 1.2, bPadLength: 0.7, cPadWidth: 1.3 },
      copperPad: { lengthMm: 0.7, widthMm: 1.3 },
      overallLandSpanMm: 2.6,
      derivedCopperPadGapMm: 1.2,
      derivedCopperPadCenterXMm: 0.95,
      solderMask: { openingLengthMm: 0.8, openingWidthMm: 1.4, marginPerEdgeMm: 0.05, status: "project-input" },
      paste: { openingLengthMm: 0.6, openingWidthMm: 1.2, reductionPerEdgeMm: 0.05, status: "project-input" },
      courtyard: {
        lengthMm: 3.1,
        widthMm: 1.9,
        minimumClearanceMm: 0.25,
        sourceStatus: "not-published",
        status: "project-review-input"
      }
    })
    expect(projectSelection.copperPad.lengthMm).toBeGreaterThanOrEqual(manufacturerLandPattern.padLengthMm.minimum)
    expect(projectSelection.copperPad.lengthMm).toBeLessThanOrEqual(manufacturerLandPattern.padLengthMm.maximum)
    expect(projectSelection.copperPad.widthMm).toBeGreaterThanOrEqual(manufacturerLandPattern.padWidthMm.minimum)
    expect(projectSelection.copperPad.widthMm).toBeLessThanOrEqual(manufacturerLandPattern.padWidthMm.maximum)
  })

  it("matches the existing closure's seven C_REF records without changing closure authority", () => {
    const expectedReferences = ["C_REF_1", "C_REF_2", "C_REF_3", "C_REF_4", "C_REF_5", "C_REF_6", "C_REF_7"]
    const records = benchPrototypeAnalogFootprintClosure.records.filter((record) =>
      expectedReferences.includes(record.reference)
    )
    expect(records.map((record) => record.reference)).toEqual(expectedReferences)
    expect(records).toHaveLength(7)
    for (const record of records) {
      expect(record).toMatchObject({
        sourceContract: "BP-103",
        sourceBaseReference: "C_REF",
        exactMpn: "GRM21BR71A106KE51L",
        exactPackage: "0805",
        sharedManufacturerSourceId: "M4-04:GRM21BR71A106KE51L",
        reviewEvidenceMappingId: "bp031-murata-grm21br71a106ke51l-0805-candidate-footprint",
        disposition: "DNP-unresolved"
      })
    }
    expect(bp031MurataGrm21br71a106ke51l0805CandidateFootprint.affectedReferences).toEqual(expectedReferences)
  })

  it("keeps the capacitor non-polar with no pin-one or assembly rotation claim", () => {
    expect(bp031MurataGrm21br71a106ke51l0805CandidateFootprint.terminals).toEqual([
      { pad: "1", terminal: "A", polarity: "non-polar", xMm: -0.95, yMm: 0 },
      { pad: "2", terminal: "B", polarity: "non-polar", xMm: 0.95, yMm: 0 }
    ])
    expect(bp031MurataGrm21br71a106ke51l0805CandidateFootprint.orientation).toMatchObject({
      state: "non-polar",
      assemblyRotationDeg: null,
      pinOne: "not-applicable"
    })
    expect(bp031MurataGrm21br71a106ke51l0805CandidateFootprint.stressOrientationReview).toMatchObject({
      state: "pending-review",
      polarity: "non-polar",
      ratedVoltageVdc: 10,
      nominalApplicationRailVdc: 2.5,
      dcBiasEvidence: "not-retained"
    })
  })

  it("renders exact project copper, mask, paste, and courtyard without errors", () => {
    const json = renderTestCircuit(<Bp031MurataGrm21br71a106ke51l0805CandidateFootprint />)
    const pads = json.filter(isRectSmtPad)
    const paste = json.filter(isRectSolderPaste)
    const courtyard = json.find((element) => element.type === "pcb_courtyard_rect")

    expect(pads).toHaveLength(2)
    expect(
      pads.map(({ x, y, width, height, soldermask_margin }) => ({ x, y, width, height, soldermask_margin }))
    ).toEqual([
      { x: -0.95, y: 0, width: 0.7, height: 1.3, soldermask_margin: 0.05 },
      { x: 0.95, y: 0, width: 0.7, height: 1.3, soldermask_margin: 0.05 }
    ])
    expect(paste).toHaveLength(2)
    expect(paste.map(({ x, y, width, height }) => ({ x, y, width, height }))).toEqual([
      { x: -0.95, y: 0, width: 0.6, height: 1.2 },
      { x: 0.95, y: 0, width: 0.6, height: 1.2 }
    ])
    expect(json.filter((element) => element.type === "source_port")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ pin_number: 1, name: "A", port_hints: expect.arrayContaining(["non-polar"]) }),
        expect.objectContaining({ pin_number: 2, name: "B", port_hints: expect.arrayContaining(["non-polar"]) })
      ])
    )
    expect(courtyard).toMatchObject({ center: { x: 0, y: 0 }, width: 3.1, height: 1.9 })
    expect(json.filter((element) => element.type.endsWith("_error"))).toEqual([])
  })

  it("binds the canonical rendered geometry hash while keeping release denied", () => {
    expect(renderedGeometryHash()).toBe(bp031MurataGrm21br71a106ke51l0805CandidateFootprint.artwork.sha256)
    expect(bp031MurataGrm21br71a106ke51l0805CandidateFootprint.artwork.authority).toBe("deny")
  })

  it("fails closed if identity, replication, CAD, courtyard, or release state drifts", () => {
    const identityDrift = structuredClone(bp031MurataGrm21br71a106ke51l0805CandidateFootprint)
    Reflect.set(identityDrift, "manufacturerPartNumber", "GRM21BR71A106KE51L.A")
    expect(validateBp031MurataGrm21br71a106ke51l0805CandidateFootprint(identityDrift)).toContain(
      "exact BP-031 Murata GRM21BR71A106KE51L identity drifted"
    )

    const replicationDrift = structuredClone(bp031MurataGrm21br71a106ke51l0805CandidateFootprint)
    Reflect.set(replicationDrift, "affectedReferences", ["C_REF_1"])
    expect(validateBp031MurataGrm21br71a106ke51l0805CandidateFootprint(replicationDrift)).toContain(
      "C_REF seven-reference source binding drifted"
    )

    const cadDrift = structuredClone(bp031MurataGrm21br71a106ke51l0805CandidateFootprint)
    Reflect.set(cadDrift.manufacturerCad, "state", "acquired")
    expect(validateBp031MurataGrm21br71a106ke51l0805CandidateFootprint(cadDrift)).toContain(
      "Murata CAD uncertainty and fabrication denial must remain fail-closed"
    )

    const courtyardDrift = structuredClone(bp031MurataGrm21br71a106ke51l0805CandidateFootprint)
    Reflect.set(courtyardDrift.projectSelection.courtyard, "lengthMm", 3.09)
    expect(validateBp031MurataGrm21br71a106ke51l0805CandidateFootprint(courtyardDrift)).toContain(
      "Murata-derived project copper, mask, paste, or courtyard drifted"
    )

    const releaseDrift = structuredClone(bp031MurataGrm21br71a106ke51l0805CandidateFootprint)
    Reflect.set(releaseDrift, "accepted", true)
    expect(validateBp031MurataGrm21br71a106ke51l0805CandidateFootprint(releaseDrift)).toContain(
      "Murata CAD uncertainty and fabrication denial must remain fail-closed"
    )

    const sourceDrift = structuredClone(bp031MurataGrm21br71a106ke51l0805CandidateFootprint)
    Reflect.set(sourceDrift.sourceControl, "basisCommit", "0f9e3f5")
    expect(validateBp031MurataGrm21br71a106ke51l0805CandidateFootprint(sourceDrift)).toContain(
      "BP-031 canonical source control binding drifted"
    )

    const artworkDrift = structuredClone(bp031MurataGrm21br71a106ke51l0805CandidateFootprint)
    Reflect.set(artworkDrift.artwork, "sha256", "0".repeat(64))
    expect(validateBp031MurataGrm21br71a106ke51l0805CandidateFootprint(artworkDrift)).toContain(
      "Murata CAD uncertainty and fabrication denial must remain fail-closed"
    )
  })

  it("keeps an independent frozen baseline and rejects descriptor or graph attacks", () => {
    expect(Object.isFrozen(bp031MurataGrm21br71a106ke51l0805CandidateFootprint)).toBe(true)
    expect(Object.isFrozen(bp031MurataGrm21br71a106ke51l0805CandidateFootprint.sources)).toBe(true)
    expect(Reflect.set(bp031MurataGrm21br71a106ke51l0805CandidateFootprint, "accepted", true)).toBe(false)
    expect(validateBp031MurataGrm21br71a106ke51l0805CandidateFootprint()).toEqual([])

    const hiddenProperty = structuredClone(bp031MurataGrm21br71a106ke51l0805CandidateFootprint)
    Object.defineProperty(hiddenProperty, "hiddenApproval", { value: true, enumerable: false })
    expect(validateBp031MurataGrm21br71a106ke51l0805CandidateFootprint(hiddenProperty)).toEqual([
      "Murata GRM21 exact graph, descriptor, or deny-state drifted"
    ])

    const symbolProperty = structuredClone(bp031MurataGrm21br71a106ke51l0805CandidateFootprint)
    Reflect.set(symbolProperty, Symbol("approval"), true)
    expect(validateBp031MurataGrm21br71a106ke51l0805CandidateFootprint(symbolProperty)).toEqual([
      "Murata GRM21 exact graph, descriptor, or deny-state drifted"
    ])

    const getterProperty = structuredClone(bp031MurataGrm21br71a106ke51l0805CandidateFootprint)
    Object.defineProperty(getterProperty, "releaseState", { enumerable: true, get: () => "allow" })
    expect(validateBp031MurataGrm21br71a106ke51l0805CandidateFootprint(getterProperty)).toEqual([
      "Murata GRM21 exact graph, descriptor, or deny-state drifted"
    ])

    const cyclicCandidate: { self?: unknown } = {}
    cyclicCandidate.self = cyclicCandidate
    expect(validateBp031MurataGrm21br71a106ke51l0805CandidateFootprint(cyclicCandidate)).toEqual([
      "Murata GRM21 exact graph, descriptor, or deny-state drifted"
    ])
    expect(validateBp031MurataGrm21br71a106ke51l0805CandidateFootprint({})).toEqual([
      "Murata GRM21 exact graph, descriptor, or deny-state drifted"
    ])
  })
})
