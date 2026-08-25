import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { benchPrototypeApplicationFootprints } from "./bench-prototype-application-footprints.js"
import { defaultBenchPrototypePowerInputs } from "./bench-prototype-power.js"
import {
  bp033Littelfuse0451FuseFor,
  bp033Littelfuse0451FuseFootprintEvidence,
  Bp033Littelfuse0451Fuse,
  validateBp033Littelfuse0451FuseFootprintEvidence
} from "./bp033-littelfuse-0451-fuses.js"
import { renderTestCircuit } from "./test-helper.js"

type CircuitElement = ReturnType<typeof renderTestCircuit>[number]
type FuseReference = (typeof bp033Littelfuse0451FuseFootprintEvidence.exactFuses)[number]["reference"]

const fuseCases = [
  {
    reference: "F_APPLICATION",
    manufacturerPartNumber: "0451002.MRL",
    nominalCurrentA: 2,
    ampCode: "002.",
    maxVoltageV: 125,
    interruptingRating: "50A @125VAC/VDC; 10,000A @75VDC; 300A @32VDC; PSE: 100A @100VAC",
    nominalColdResistanceOhms: 0.0367,
    nominalMeltingI2tA2sec: 0.53
  },
  {
    reference: "F_DISPLAY",
    manufacturerPartNumber: "045106.3MRL",
    nominalCurrentA: 6.3,
    ampCode: "06.3",
    maxVoltageV: 125,
    interruptingRating: "50A @125VAC/VDC; 400A @32VDC; PSE: 100A @100VAC",
    nominalColdResistanceOhms: 0.0096,
    nominalMeltingI2tA2sec: 9.17
  },
  {
    reference: "F_SCORING",
    manufacturerPartNumber: "0451.500MRL",
    nominalCurrentA: 0.5,
    ampCode: ".500",
    maxVoltageV: 125,
    interruptingRating: "50A @125VAC/VDC; 300A @32VDC; PSE: 100A @100VAC",
    nominalColdResistanceOhms: 0.3046,
    nominalMeltingI2tA2sec: 0.0824
  }
] as const

function isRectSmtPad(
  element: CircuitElement
): element is Extract<CircuitElement, { readonly shape: "rect"; readonly type: "pcb_smtpad" }> {
  return element.type === "pcb_smtpad" && element.shape === "rect"
}

function retainedEvidenceHash(artifactPath: string) {
  const packageRelativePath = artifactPath.replace("docs/", "../docs/")
  return createHash("sha256")
    .update(readFileSync(new URL(packageRelativePath, import.meta.url)))
    .digest("hex")
    .toUpperCase()
}

function renderFuse(reference: FuseReference) {
  return renderTestCircuit(<Bp033Littelfuse0451Fuse reference={reference} />)
}

function renderedArtworkDigest(reference: FuseReference) {
  const geometry = renderFuse(reference)
    .filter(isRectSmtPad)
    .map(({ height, shape, type, width, x, y }) => ({ height, shape, type, width, x, y }))
  return createHash("sha256").update(JSON.stringify(geometry)).digest("hex").toUpperCase()
}

describe("BP-033 Littelfuse 0451 common fuse footprint evidence", () => {
  it("proves the three exact orderables, rating-dependent electrical rows, and common package decision", () => {
    expect(validateBp033Littelfuse0451FuseFootprintEvidence()).toEqual([])
    expect(bp033Littelfuse0451FuseFootprintEvidence).toMatchObject({
      artifactKind: "bp033-littelfuse-0451-fuses-footprint-evidence",
      workUnit: "BP-033",
      manufacturer: "Littelfuse",
      series: "451",
      commonPackageCoverage: {
        disposition: "single-exact-451-package-and-land-pattern-covers-all-three",
        exactOrderableCount: 3,
        differences:
          "Published electrical characteristics vary by ampere rating; no package or copper-land difference is published for these three exact 451 MRL orderables"
      },
      package: {
        designation: "Littelfuse NANO2 451 series, ceramic square surface-mount fuse with two end caps",
        terminals: 2,
        thermalPad: { exists: false }
      },
      terminalAndPolarity: {
        terminalCount: 2,
        polarity: "non-polar",
        polarityBasis: expect.stringContaining("design inference"),
        pinOne: "not-applicable"
      },
      manufacturerLandPattern: {
        status: "manufacturer-recommended-copper-layout",
        reviewedPage: 4,
        copper: {
          padLengthMm: 1.96,
          padWidthMm: 3.15,
          padGapMm: 2.95,
          padCenterSpacingMm: 4.91,
          publishedSourceOuterSpanMm: 6.86,
          outerCopperSpanMm: 6.87
        },
        solderMask: { status: "not-published", accepted: false },
        paste: { status: "not-published", accepted: false },
        courtyard: { status: "not-published", accepted: false }
      },
      projectFootprint: {
        state: "review-only",
        geometryAuthority: "manufacturer-recommended-pad-layout-transcription",
        accepted: false,
        fabricationAuthority: "deny"
      },
      artwork: {
        state: "generated-project-review-only",
        authority: "deny",
        sha256: /^[0-9A-F]{64}$/u
      },
      review: {
        status: "pending-root-review",
        reviewer: null,
        reviewedAt: null,
        projectGeometryAccepted: false
      },
      acceptance: {
        currentRatingReviewAccepted: false,
        thermalReviewAccepted: false,
        boardFitAccepted: false,
        releaseAccepted: false,
        fabricationAuthorized: false,
        releaseState: "deny"
      },
      releaseState: "deny",
      fabricationAuthority: "deny",
      accepted: false
    })
    expect(bp033Littelfuse0451FuseFootprintEvidence.exactFuses).toEqual(
      fuseCases.map((fuse) => expect.objectContaining(fuse))
    )
    expect(Object.isFrozen(bp033Littelfuse0451FuseFootprintEvidence)).toBe(true)
    expect(Object.isFrozen(bp033Littelfuse0451FuseFootprintEvidence.exactFuses)).toBe(true)
    expect(Object.isFrozen(bp033Littelfuse0451FuseFootprintEvidence.acceptance)).toBe(true)
  })

  it("hash-binds the retained official Littelfuse PDF and its reviewed pages", () => {
    const source = bp033Littelfuse0451FuseFootprintEvidence.sources[0]
    if (source === undefined) throw new Error("Littelfuse source fixture is missing")
    expect(source).toMatchObject({
      authority: "manufacturer-primary-retained-bytes",
      url: "https://www.littelfuse.com/assetdocs/fuse-451-and-453-datasheet?assetguid=533cd5cc-956c-4243-867f-6ab5a62f6ba1",
      artifactPath: "docs/evidence/bp-033/littelfuse-451-453-datasheet.pdf",
      sha256: "399D3CC9DA991AA3192638F807FB568F137407D10A4B0D35D106A82B5C2BACE2",
      revised: "GD. 12/01/25",
      retainedPdfPageCount: 4,
      reviewedPages: [2, 4],
      pageBindings: {
        orderables: "page 2 electrical specifications by item",
        packageAndLandPattern: "page 4 product characteristics, dimensions, and recommended pad layout"
      }
    })
    expect(retainedEvidenceHash(source.artifactPath)).toBe(source.sha256)
  })

  it.each(fuseCases)(
    "renders exact $reference with its MPN, two lands, source ports, and no unaccepted geometry",
    (fuse) => {
      const rendered = renderFuse(fuse.reference)
      const pads = rendered.filter(isRectSmtPad)
      const source = rendered.find((element) => element.type === "source_component")
      expect(source).toMatchObject({
        name: `BP033_${fuse.reference}`,
        manufacturer_part_number: fuse.manufacturerPartNumber
      })
      expect(pads).toHaveLength(2)
      expect(pads).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ x: -2.455, y: 0, width: 1.96, height: 3.15 }),
          expect.objectContaining({ x: 2.455, y: 0, width: 1.96, height: 3.15 })
        ])
      )
      expect(rendered.filter((element) => element.type === "source_port")).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ pin_number: 1, port_hints: expect.arrayContaining(["end-cap-A"]) }),
          expect.objectContaining({ pin_number: 2, port_hints: expect.arrayContaining(["end-cap-B"]) })
        ])
      )
      expect(rendered.filter((element) => element.type === "pcb_solder_paste")).toEqual([])
      expect(rendered.filter((element) => element.type === "pcb_courtyard_rect")).toEqual([])
      expect(pads.filter((pad) => pad.x === 0)).toEqual([])
      expect(rendered.filter((element) => element.type.endsWith("_error"))).toEqual([])
      expect(renderedArtworkDigest(fuse.reference)).toBe(bp033Littelfuse0451FuseFootprintEvidence.artwork.sha256)
    }
  )

  it("cross-checks every canonical reference against the application ledger and power contract", () => {
    const canonicalPowerFuses = {
      F_APPLICATION: defaultBenchPrototypePowerInputs.branches.applicationAndHousekeeping.fuse,
      F_DISPLAY: defaultBenchPrototypePowerInputs.branches.display.fuse,
      F_SCORING: defaultBenchPrototypePowerInputs.branches.isolatedScoring.fuse
    } as const

    for (const fuse of bp033Littelfuse0451FuseFootprintEvidence.exactFuses) {
      const ledgerRecord = benchPrototypeApplicationFootprints.records.find(
        (record) => record.reference === fuse.reference
      )
      expect(ledgerRecord).toMatchObject({
        reference: fuse.reference,
        manufacturer: "Littelfuse",
        mpn: fuse.manufacturerPartNumber,
        population: "DNP-unresolved",
        manufacturerDrawing: { state: "not-acquired" },
        manufacturerCad: { state: "not-acquired" },
        artwork: { state: "not-generated" },
        orientation: { state: "unreviewed" }
      })
      expect(canonicalPowerFuses[fuse.reference]).toMatchObject({
        mpn: fuse.manufacturerPartNumber,
        nominalCurrentA: fuse.nominalCurrentA
      })
      expect(bp033Littelfuse0451FuseFor(fuse.reference)).toMatchObject({
        reference: fuse.reference,
        manufacturerPartNumber: fuse.manufacturerPartNumber,
        nominalCurrentA: fuse.nominalCurrentA,
        polarity: "non-polar",
        polarityBasis: expect.stringContaining("design inference"),
        releaseState: "deny",
        fabricationAuthority: "deny",
        accepted: false
      })
    }
  })

  it("rejects identity, geometry, source, review, and deny-state drift against independent expectations", () => {
    const driftCases = [
      ["package", (copy: any) => (copy.commonPackageCoverage.exactOrderableCount = 2)],
      ["release", (copy: any) => (copy.acceptance.releaseState = "approve")],
      ["artwork authority", (copy: any) => (copy.artwork.authority = "allow")],
      ["source URL", (copy: any) => (copy.sources[0].url = "https://evil.example")],
      ["project state", (copy: any) => (copy.projectFootprint.state = "accepted")],
      ["review geometry", (copy: any) => (copy.review.projectGeometryAccepted = true)],
      ["pad geometry", (copy: any) => (copy.projectFootprint.pads[0].xMm = 0)],
      ["exact MPN", (copy: any) => (copy.exactFuses[0].manufacturerPartNumber = "FORGED")]
    ] as const

    for (const [name, mutate] of driftCases) {
      const copy = structuredClone(bp033Littelfuse0451FuseFootprintEvidence)
      mutate(copy)
      expect(validateBp033Littelfuse0451FuseFootprintEvidence(copy), name).toContain(
        "BP-033 Littelfuse 0451 identity, common-footprint proof, or deny state drifted"
      )
    }
    expect(validateBp033Littelfuse0451FuseFootprintEvidence({})).not.toEqual([])
    const cyclicCandidate: { self?: unknown } = {}
    cyclicCandidate.self = cyclicCandidate
    expect(validateBp033Littelfuse0451FuseFootprintEvidence(cyclicCandidate)).not.toEqual([])

    const hiddenProperty = structuredClone(bp033Littelfuse0451FuseFootprintEvidence)
    Object.defineProperty(hiddenProperty, "hiddenApproval", { value: true, enumerable: false })
    expect(validateBp033Littelfuse0451FuseFootprintEvidence(hiddenProperty)).not.toEqual([])

    const symbolProperty = structuredClone(bp033Littelfuse0451FuseFootprintEvidence)
    Reflect.set(symbolProperty, Symbol("approval"), true)
    expect(validateBp033Littelfuse0451FuseFootprintEvidence(symbolProperty)).not.toEqual([])

    const getterProperty = structuredClone(bp033Littelfuse0451FuseFootprintEvidence)
    Object.defineProperty(getterProperty, "forgedApproval", { enumerable: true, get: () => true })
    expect(validateBp033Littelfuse0451FuseFootprintEvidence(getterProperty)).not.toEqual([])
    expect(
      Reflect.set(bp033Littelfuse0451FuseFootprintEvidence.exactFuses[0]!, "manufacturerPartNumber", "FORGED")
    ).toBe(false)
    expect(() => bp033Littelfuse0451FuseFor("F_OTHER" as never)).toThrow("Unsupported BP-033 fuse reference")
  })
})
