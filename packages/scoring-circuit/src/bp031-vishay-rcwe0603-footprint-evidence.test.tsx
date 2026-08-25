import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  Bp031VishayRcwe0603R220FkeaFootprint,
  bp031VishayRcwe0603FootprintEvidence,
  bp031VishayRcwe0603References,
  validateBp031VishayRcwe0603FootprintEvidence
} from "./bp031-vishay-rcwe0603-footprint-evidence.js"
import { renderTestCircuit } from "./test-helper.js"

type CircuitElement = ReturnType<typeof renderTestCircuit>[number]

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

function renderedGeometryHash(json: readonly CircuitElement[]) {
  const geometry: Array<Record<string, unknown>> = []
  for (const element of json) {
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

function isFrozenDataGraph(value: unknown, seen = new Set<object>()): boolean {
  if (value === null || typeof value !== "object") return true
  if (seen.has(value)) return true
  if (!Object.isFrozen(value)) return false
  seen.add(value)
  return Object.values(value).every((child) => isFrozenDataGraph(child, seen))
}

describe("BP-031 exact Vishay Dale RCWE0603 R220 candidate footprint", () => {
  it("binds the exact MPN and seven replicated references separately from series evidence", () => {
    expect(validateBp031VishayRcwe0603FootprintEvidence()).toEqual([])
    expect(isFrozenDataGraph(bp031VishayRcwe0603FootprintEvidence)).toBe(true)
    expect(Object.isFrozen(bp031VishayRcwe0603References)).toBe(true)
    expect(bp031VishayRcwe0603FootprintEvidence).toMatchObject({
      artifactKind: "bp031-vishay-rcwe0603-r220-footprint-evidence",
      workUnit: "BP-031",
      manufacturer: "Vishay Dale",
      manufacturerPartNumber: "RCWE0603R220FKEA",
      sourceControl: { basisCommit: "d29c549b9da078b7c2e6f23487eb4c613eb4798f" },
      releaseState: "deny",
      fabricationAuthority: "deny",
      accepted: false
    })
    expect(bp031VishayRcwe0603FootprintEvidence.sourceBinding.replicatedReferences).toEqual(
      bp031VishayRcwe0603References
    )
    expect(bp031VishayRcwe0603FootprintEvidence.sourceBinding.replicatedReferences).not.toBe(
      bp031VishayRcwe0603References
    )
    expect(bp031VishayRcwe0603FootprintEvidence.exactSelectedPart).toMatchObject({
      canonicalReference: "R_REF_SAR",
      manufacturerPartNumber: "RCWE0603R220FKEA",
      resistanceOhms: 0.22,
      tolerancePercent: 1,
      tcrPpmPerC: 100,
      package: "0603",
      exactMpnNamedInManufacturerSource: false,
      replicatedReferences: bp031VishayRcwe0603References
    })
    expect(bp031VishayRcwe0603FootprintEvidence.exactSelectedPart.replicatedReferences).not.toBe(
      bp031VishayRcwe0603References
    )
    expect(bp031VishayRcwe0603FootprintEvidence.sourceBinding.replicatedReferences).not.toBe(
      bp031VishayRcwe0603FootprintEvidence.exactSelectedPart.replicatedReferences
    )
    const seriesSource = bp031VishayRcwe0603FootprintEvidence.sources.find(
      (source) => source.id === "vishay-rcwe-series-rev-2023-10-24"
    )
    expect(seriesSource).toMatchObject({
      authority: "manufacturer-primary",
      documentNumber: "20019",
      revision: "24-Oct-2023",
      reviewedPages: "1-2",
      artifactPath: "packages/scoring-circuit/docs/evidence/m4-04/vishay-rcwe-precision-resistor-datasheet.pdf",
      sha256: "5977F6B0414A669571207B18831446698C7C64F15B672F893BDDA1E428D4D374",
      scope: expect.stringContaining("does not name the exact RCWE0603R220FKEA orderable")
    })
    const identitySource = bp031VishayRcwe0603FootprintEvidence.sources.find(
      (source) => source.id === "bp031-rcwe0603-selected-mpn-record"
    )
    expect(identitySource).toMatchObject({
      authority: "project-canonical-source",
      artifactPath: "packages/scoring-circuit/src/one-channel-analog-readiness.ts",
      sha256: "496d8727b33209c03b31f2b1f203397c7cab364f40d00edf2ec8b1bdf227e55d",
      url: null,
      reviewedPages: null
    })
    if (seriesSource === undefined || identitySource === undefined) throw new Error("source fixtures are missing")
    const seriesBytes = readFileSync(
      new URL(`../${seriesSource.artifactPath.replace("packages/scoring-circuit/", "")}`, import.meta.url)
    )
    const identityBytes = readFileSync(
      new URL(`../${identitySource.artifactPath.replace("packages/scoring-circuit/", "")}`, import.meta.url)
    )
    expect(createHash("sha256").update(seriesBytes).digest("hex").toUpperCase()).toBe(seriesSource.sha256)
    expect(createHash("sha256").update(identityBytes).digest("hex")).toBe(identitySource.sha256)
  })

  it("derives 0603 copper, project mask, paste, courtyard, and non-polar orientation", () => {
    const evidence = bp031VishayRcwe0603FootprintEvidence
    expect(evidence.package).toMatchObject({
      designation: "RCWE0603",
      imperialSize: "0603",
      bodyLengthMm: { minimum: 1.5, maximum: 1.7 },
      bodyWidthMm: { minimum: 0.75, maximum: 0.95 },
      bodyHeightMm: { minimum: 0.4, maximum: 0.6 }
    })
    expect(evidence.manufacturerLandPattern).toMatchObject({
      method: "reflow",
      padLengthAlongTerminalAxisMm: 0.7,
      padWidthAcrossTerminalAxisMm: 1,
      innerGapMm: 0.8,
      overallCopperSpanMm: 2.2,
      sourceParameterMapping: { aPadLengthMm: 0.7, bPadWidthMm: 1, lInnerGapMm: 0.8 }
    })
    expect(evidence.projectFootprint).toMatchObject({
      state: "review-only",
      padLengthMm: 0.7,
      padWidthMm: 1,
      padCenterSpanMm: 1.5,
      padGapMm: 0.8,
      solderMask: { marginPerEdgeMm: 0.05, sourceStatus: "not-published" },
      paste: { openingLengthMm: 0.6, openingWidthMm: 0.9, reductionPerEdgeMm: 0.05, sourceStatus: "not-published" },
      courtyard: { heightMm: 1.3, minimumClearanceMm: 0.15, sourceStatus: "not-published" },
      orientation: { polarity: "non-polar", pinOne: "not-applicable" },
      accepted: false,
      fabricationAuthority: "deny"
    })
    expect(evidence.projectFootprint.solderMask.openingLengthMm).toBeCloseTo(0.8, 10)
    expect(evidence.projectFootprint.solderMask.openingWidthMm).toBeCloseTo(1.1, 10)
    expect(evidence.projectFootprint.courtyard.widthMm).toBeCloseTo(2.5, 10)
    expect(evidence.manufacturerCad).toEqual({
      state: "not-acquired",
      artifactPath: null,
      authority: "deny",
      note: expect.any(String)
    })
  })

  for (const reference of bp031VishayRcwe0603References) {
    it(`renders ${reference} with two pads, ports, and no tscircuit errors`, () => {
      const json = renderTestCircuit(<Bp031VishayRcwe0603R220FkeaFootprint reference={reference} />)
      expect(json.filter(isRectSmtPad)).toHaveLength(2)
      expect(json.filter(isRectPaste)).toHaveLength(2)
      expect(json.filter((element) => element.type === "pcb_courtyard_rect")).toHaveLength(1)
      expect(json.filter((element) => element.type === "source_port")).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ pin_number: 1, name: "A", port_hints: expect.arrayContaining(["A"]) }),
          expect.objectContaining({ pin_number: 2, name: "B", port_hints: expect.arrayContaining(["B"]) })
        ])
      )
      expect(json.filter((element) => element.type.endsWith("_error"))).toEqual([])
      expect(renderedGeometryHash(json)).toBe(bp031VishayRcwe0603FootprintEvidence.artwork.sha256)
    })
  }

  it("accepts only a plain-data clone of its private frozen graph", () => {
    const clone = structuredClone(bp031VishayRcwe0603FootprintEvidence)
    expect(validateBp031VishayRcwe0603FootprintEvidence(clone)).toEqual([])

    Reflect.set(clone.exactSelectedPart, "manufacturerPartNumber", "FORGED")
    expect(validateBp031VishayRcwe0603FootprintEvidence(clone)).not.toEqual([])

    const changedSourceScope = structuredClone(bp031VishayRcwe0603FootprintEvidence)
    Reflect.set(changedSourceScope.sources[0], "scope", "exact-orderable CAD approved")
    expect(validateBp031VishayRcwe0603FootprintEvidence(changedSourceScope)).not.toEqual([])

    const changedGeometry = structuredClone(bp031VishayRcwe0603FootprintEvidence)
    Reflect.set(changedGeometry.manufacturerLandPattern, "overallCopperSpanMm", 9)
    expect(validateBp031VishayRcwe0603FootprintEvidence(changedGeometry)).not.toEqual([])

    const fabricatedAuthority = structuredClone(bp031VishayRcwe0603FootprintEvidence)
    Reflect.set(fabricatedAuthority.manufacturerCad, "authority", "allow")
    expect(validateBp031VishayRcwe0603FootprintEvidence(fabricatedAuthority)).not.toEqual([])

    const accessor = structuredClone(bp031VishayRcwe0603FootprintEvidence)
    Object.defineProperty(accessor, "manufacturer", { get: () => "Vishay Dale" })
    expect(validateBp031VishayRcwe0603FootprintEvidence(accessor)).not.toEqual([])

    const withExtraProperty = structuredClone(bp031VishayRcwe0603FootprintEvidence)
    Reflect.set(withExtraProperty, "fabricationOverride", true)
    expect(validateBp031VishayRcwe0603FootprintEvidence(withExtraProperty)).not.toEqual([])

    expect(validateBp031VishayRcwe0603FootprintEvidence(null)).not.toEqual([])
    expect(validateBp031VishayRcwe0603FootprintEvidence([])).not.toEqual([])
    expect(
      validateBp031VishayRcwe0603FootprintEvidence(
        new Proxy(
          {},
          {
            ownKeys: () => {
              throw new Error("forged graph")
            }
          }
        )
      )
    ).not.toEqual([])
  })

  it("fails closed on alias and cycle graph attacks", () => {
    const aliased = structuredClone(bp031VishayRcwe0603FootprintEvidence)
    Reflect.set(aliased.sourceBinding, "replicatedReferences", aliased.exactSelectedPart.replicatedReferences)
    expect(validateBp031VishayRcwe0603FootprintEvidence(aliased)).not.toEqual([])

    const cyclic = structuredClone(bp031VishayRcwe0603FootprintEvidence)
    Reflect.set(cyclic.sourceBinding, "replicatedReferences", cyclic.sourceBinding)
    expect(validateBp031VishayRcwe0603FootprintEvidence(cyclic)).not.toEqual([])
  })
})
