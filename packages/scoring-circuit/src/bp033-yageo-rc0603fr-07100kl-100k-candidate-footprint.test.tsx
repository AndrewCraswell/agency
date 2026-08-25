import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import type { ReactElement } from "react"
import { describe, expect, it } from "vitest"
import { applicationDisplayHub75SupportParts } from "./application-display-carrier-support.js"
import {
  benchPrototypeApplicationFootprints,
  validateBenchPrototypeApplicationFootprints
} from "./bench-prototype-application-footprints.js"
import {
  Bp033YageoRc0603Fr07100Kl100kCandidateFootprint,
  bp033YageoRc0603Fr07100Kl100kCandidateFootprint,
  validateBp033YageoRc0603Fr07100Kl100kCandidateFootprint
} from "./bp033-yageo-rc0603fr-07100kl-100k-candidate-footprint.js"
import { renderTestCircuit } from "./test-helper.js"

const sourceSha256 = "E6BA74C3F9ABAC1D8865473C885FF9CD6D2F7A1181846B32A8D1FF7FB5684054"
const artworkSha256 = "C7F7B09F6AA395F0828ED993D2801D6AEB08D8533C3D8933DD64187423B4B1A8"
const expectedReferences = ["R_W5500_INT_BIAS", "R_BUFFER_A_GATE_PD", "R_BUFFER_B_GATE_PD"] as const
const boundaryReferences = ["R_BUFFER_A_GATE_PD", "R_BUFFER_B_GATE_PD"] as const

type Mutable<T> = T extends string
  ? string
  : T extends number
    ? number
    : T extends boolean
      ? boolean
      : T extends readonly (infer Item)[]
        ? Mutable<Item>[]
        : T extends object
          ? { -readonly [Key in keyof T]: Mutable<T[Key]> }
          : T

function retainedBytes(path: string) {
  return readFileSync(new URL(`../${path.replace("packages/scoring-circuit/", "")}`, import.meta.url))
}

function freezeGraph<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) return value
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined) throw new RangeError("test graph descriptor disappeared")
    if ("value" in descriptor) freezeGraph(descriptor.value, seen)
  }
  return Object.freeze(value)
}

function mutableClone(): Mutable<typeof bp033YageoRc0603Fr07100Kl100kCandidateFootprint> {
  return structuredClone(bp033YageoRc0603Fr07100Kl100kCandidateFootprint) as unknown as Mutable<
    typeof bp033YageoRc0603Fr07100Kl100kCandidateFootprint
  >
}

function renderedGeometryHash(component: ReactElement) {
  const geometry: Array<Record<string, unknown>> = []
  for (const element of renderTestCircuit(component)) {
    if (element.type === "pcb_smtpad" && element.shape === "rect") {
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
    if (element.type === "pcb_solder_paste" && element.shape === "rect") {
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

describe("BP-033 exact Yageo RC0603FR-07100KL 100 kOhm candidate", () => {
  it("binds all three canonical rows and retains BP-144 selection provenance", () => {
    expect(validateBenchPrototypeApplicationFootprints(benchPrototypeApplicationFootprints)).toBe(true)
    expect(validateBp033YageoRc0603Fr07100Kl100kCandidateFootprint()).toBe(true)
    expect(bp033YageoRc0603Fr07100Kl100kCandidateFootprint.affectedReferences).toEqual(expectedReferences)
    expect(
      benchPrototypeApplicationFootprints.records
        .filter((record) => record.mpn === "RC0603FR-07100KL")
        .map((record) => record.reference)
        .sort()
    ).toEqual([...expectedReferences].sort())
    expect(
      benchPrototypeApplicationFootprints.records.filter(
        (record) => record.reference === "R_W5500_INT_BIAS" && record.mpn === "RC0603FR-07100KL"
      )
    ).toHaveLength(1)
    expect(applicationDisplayHub75SupportParts.filter((part) => part.mpn === "RC0603FR-07100KL")).toEqual([
      expect.objectContaining({ reference: "R_BUFFER_A_GATE_PD", package: "0603", footprint: "0603" }),
      expect.objectContaining({ reference: "R_BUFFER_B_GATE_PD", package: "0603", footprint: "0603" })
    ])
    expect(bp033YageoRc0603Fr07100Kl100kCandidateFootprint.provenanceReconciliation).toMatchObject({
      status: "bp-033-evidence-owner-bp-144-selection-provenance",
      includedExactMpnRows: [
        expect.objectContaining({ reference: "R_BUFFER_A_GATE_PD", ownerWorkUnit: "BP-144", sourceContract: "BP-144" }),
        expect.objectContaining({ reference: "R_BUFFER_B_GATE_PD", ownerWorkUnit: "BP-144", sourceContract: "BP-144" })
      ]
    })
    expect(bp033YageoRc0603Fr07100Kl100kCandidateFootprint.rootIntegrationHandoff).toMatchObject({
      requiredReferences: expectedReferences,
      handoffStatus: "root-integration-required"
    })
  })

  it("hash-binds the retained one-page official source and exact page markers", () => {
    const source = bp033YageoRc0603Fr07100Kl100kCandidateFootprint.sourceBinding
    expect(source).toMatchObject({
      sourceOwner: "BP-033",
      exactOrderableSourceId: "bp033-yageo-rc0603fr-07100kl-datasheet",
      artifactPath: "packages/scoring-circuit/docs/evidence/bp-033/yageo-rc0603fr-07100kl-datasheet.pdf",
      url: "https://www.yageogroup.com/component-documentation/download/specsheet/RC0603FR-07100KL",
      sha256: sourceSha256,
      reviewedPages: [1],
      pageBinding: {
        retainedPdfPageCount: 1,
        exactOrderablePdfPage: 1,
        printedPageLabel: "1",
        package: "0603 / 1608"
      },
      genericFamilySubstitution: "denied",
      duplicateEvidenceAdded: false
    })
    expect(createHash("sha256").update(retainedBytes(source.artifactPath)).digest("hex").toUpperCase()).toBe(
      sourceSha256
    )
    const bytesAsLatin1 = retainedBytes(source.artifactPath).toString("latin1")
    expect(bytesAsLatin1).toContain("RC0603FR-07100KL")
    expect(source.pageBinding.markers).toEqual(
      expect.arrayContaining(["RC0603FR-07100KL", "100 kOhms", "1.6mm +/-0.1mm", "0.8mm +/-0.1mm"])
    )
    const handoff = bp033YageoRc0603Fr07100Kl100kCandidateFootprint.rootIntegrationHandoff
    expect(handoff).toMatchObject({
      canonicalApplicationInventoryPath: "packages/scoring-circuit/src/bench-prototype-application-footprints.ts",
      canonicalDisplayInventoryPath: "packages/scoring-circuit/src/application-display-carrier-support.ts",
      requiredReferences: expectedReferences,
      exactOrderable: { manufacturer: "Yageo", manufacturerPartNumber: "RC0603FR-07100KL", package: "0603" },
      handoffStatus: "root-integration-required"
    })
    expect(handoff).not.toHaveProperty("canonicalApplicationInventorySha256")
    expect(bp033YageoRc0603Fr07100Kl100kCandidateFootprint).not.toHaveProperty("canonicalBinding")
    expect(bp033YageoRc0603Fr07100Kl100kCandidateFootprint.upstreamContracts).toMatchObject({
      ethernet: {
        contract: "BP-140/BP-033",
        ownerWorkUnit: "BP-033",
        reference: "R_W5500_INT_BIAS",
        sourceEvidence: {
          artifactPath: "docs/evidence/bp-033/yageo-rc0603fr-07100kl-datasheet.pdf",
          sha256: sourceSha256
        }
      },
      carrier: {
        contract: "BP-144",
        ownerWorkUnit: "BP-144",
        references: boundaryReferences,
        manufacturer: "Yageo",
        mpn: "RC0603FR-07100KL",
        package: "0603",
        value: "100 kOhm, 1%"
      }
    })
  })

  it("separates manufacturer facts from project geometry and keeps the full gate set denied", () => {
    expect(bp033YageoRc0603Fr07100Kl100kCandidateFootprint.exactOrderable).toEqual({
      manufacturerPartNumber: "RC0603FR-07100KL",
      resistanceOhms: 100000,
      tolerancePercent: 1,
      package: "0603",
      packageDesignation: "0603 (1608 metric)"
    })
    expect(bp033YageoRc0603Fr07100Kl100kCandidateFootprint.manufacturerFacts.landPattern).toEqual({
      sourceScope: "retained exact-part product specification; exact land-pattern guidance is not published",
      copper: { status: "not-published", padGapMm: null, padLengthMm: null, padWidthMm: null },
      solderMask: { status: "not-published" },
      paste: { status: "not-published" },
      courtyard: { status: "not-published", lengthMm: null, widthMm: null }
    })
    expect(bp033YageoRc0603Fr07100Kl100kCandidateFootprint.projectGeometry).toMatchObject({
      state: "generated-review-only",
      sourceAccurate: false,
      geometryAuthority: "project-review-input-not-manufacturer-land-pattern",
      footprint: {
        pads: [
          { pad: "1", terminal: "A", xMm: -0.7, yMm: 0, widthMm: 0.9, heightMm: 0.9 },
          { pad: "2", terminal: "B", xMm: 0.7, yMm: 0, widthMm: 0.9, heightMm: 0.9 }
        ],
        solderMask: { openingLengthMm: 1, openingWidthMm: 1, marginPerEdgeMm: 0.05 },
        paste: { openingLengthMm: 0.8, openingWidthMm: 0.8, reductionPerEdgeMm: 0.05 },
        courtyard: { lengthMm: 2.4, widthMm: 1.4 },
        accepted: false,
        fabricationAuthority: "deny"
      }
    })
    expect(bp033YageoRc0603Fr07100Kl100kCandidateFootprint.orientation).toMatchObject({
      state: "pending-independent-review",
      polarity: "non-polar",
      pinOne: "not-applicable",
      assemblyRotationDeg: null
    })
    expect(bp033YageoRc0603Fr07100Kl100kCandidateFootprint.denyGates).toEqual({
      manufacturerLandPattern: { state: "not-published", authority: "deny" },
      manufacturerCad: { state: "not-acquired", authority: "deny", artifactPath: null },
      boardPlacement: { state: "not-integrated", authority: "deny" },
      fitClearance: { state: "not-reviewed", authority: "deny" },
      thermal: { state: "not-reviewed", authority: "deny" },
      schematic: { state: "not-integrated", authority: "deny" },
      mechanicalLoad: { state: "not-reviewed", authority: "deny" },
      assemblyProcess: { state: "not-reviewed", authority: "deny" },
      release: { state: "deny", authority: "deny" },
      fabrication: { state: "deny", authority: "deny" },
      acceptance: { state: "deny", authority: "deny" },
      accepted: false
    })
  })

  it("renders the project review artwork and binds its digest", () => {
    const json = renderTestCircuit(<Bp033YageoRc0603Fr07100Kl100kCandidateFootprint />)
    expect(json.filter((element) => element.type === "pcb_smtpad" && element.shape === "rect")).toHaveLength(2)
    expect(json.filter((element) => element.type === "pcb_solder_paste" && element.shape === "rect")).toHaveLength(2)
    expect(json.filter((element) => element.type === "pcb_courtyard_rect")).toEqual(
      expect.arrayContaining([expect.objectContaining({ center: { x: 0, y: 0 }, width: 2.4, height: 1.4 })])
    )
    expect(json.filter((element) => element.type.endsWith("_error"))).toEqual([])
    expect(renderedGeometryHash(<Bp033YageoRc0603Fr07100Kl100kCandidateFootprint />)).toBe(artworkSha256)
    expect(bp033YageoRc0603Fr07100Kl100kCandidateFootprint.artwork.sha256).toBe(artworkSha256)
  })

  it("fails closed on exact MPN, source, package, reference, descriptor, and graph attacks", () => {
    const rejectMutation = (
      mutate: (copy: Mutable<typeof bp033YageoRc0603Fr07100Kl100kCandidateFootprint>) => void
    ) => {
      const copy = mutableClone()
      mutate(copy)
      expect(() => validateBp033YageoRc0603Fr07100Kl100kCandidateFootprint(freezeGraph(copy))).toThrow(RangeError)
    }
    rejectMutation((copy) => {
      copy.affectedReferences = []
    })
    rejectMutation((copy) => {
      copy.exactOrderable.manufacturerPartNumber = "RC0603FR-0710KL"
    })
    rejectMutation((copy) => {
      copy.sourceBinding.sha256 = "0".repeat(64)
    })
    rejectMutation((copy) => {
      copy.exactOrderable.package = "0805"
    })
    rejectMutation((copy) => {
      Object.defineProperty(copy.rootIntegrationHandoff, "hidden", {
        configurable: true,
        enumerable: false,
        value: "drift"
      })
    })
    rejectMutation((copy) => {
      Object.defineProperty(copy.rootIntegrationHandoff, Symbol("drift"), {
        configurable: true,
        enumerable: false,
        value: "drift"
      })
    })
    const accessorCopy = mutableClone()
    let getterInvoked = false
    Object.defineProperty(accessorCopy.sourceBinding, "sha256", {
      configurable: true,
      enumerable: true,
      get: () => {
        getterInvoked = true
        return sourceSha256
      }
    })
    expect(() => validateBp033YageoRc0603Fr07100Kl100kCandidateFootprint(freezeGraph(accessorCopy))).toThrow(RangeError)
    expect(getterInvoked).toBe(false)
    rejectMutation((copy) => Object.setPrototypeOf(copy.rootIntegrationHandoff, null))
    rejectMutation((copy) => {
      copy.affectedReferences.length = 2
      delete copy.affectedReferences[0]
    })
    const cycleCopy = mutableClone()
    Object.defineProperty(cycleCopy.projectGeometry, "footprint", {
      configurable: true,
      enumerable: true,
      writable: true,
      value: cycleCopy
    })
    expect(() => validateBp033YageoRc0603Fr07100Kl100kCandidateFootprint(freezeGraph(cycleCopy))).toThrow(RangeError)
    const aliasCopy = mutableClone()
    aliasCopy.provenanceReconciliation.includedExactMpnRows[1] =
      aliasCopy.provenanceReconciliation.includedExactMpnRows[0]!
    expect(() => validateBp033YageoRc0603Fr07100Kl100kCandidateFootprint(freezeGraph(aliasCopy))).toThrow(RangeError)
    const proxy = new Proxy(bp033YageoRc0603Fr07100Kl100kCandidateFootprint, {
      ownKeys: () => {
        throw new Error("trap")
      }
    })
    expect(() => validateBp033YageoRc0603Fr07100Kl100kCandidateFootprint(proxy)).toThrow(RangeError)
  })
})
