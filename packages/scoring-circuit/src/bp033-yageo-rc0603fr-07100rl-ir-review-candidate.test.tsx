import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  benchPrototypeIrReceiverSelection,
  validateBenchPrototypeIrReceiverSelection
} from "./bench-prototype-ir-receiver-selection.js"
import {
  bp033YageoRc0603fr07100rlIrReviewCandidate,
  Bp033YageoRc0603fr07100rlIrReviewCandidate,
  isBp033YageoRc0603fr07100rlIrReviewCandidate,
  validateBp033YageoRc0603fr07100rlIrReviewCandidate
} from "./bp033-yageo-rc0603fr-07100rl-ir-review-candidate.js"
import { renderTestCircuit } from "./test-helper.js"

function sha256(relativePath: string) {
  return createHash("sha256")
    .update(readFileSync(new URL(relativePath, import.meta.url)))
    .digest("hex")
    .toUpperCase()
}

describe("BP-033 Yageo RC0603FR-07100RL encrypted-IR resistor review candidate", () => {
  it("binds the exact two-row root handoff and the stable BP-146 selection contract", () => {
    const candidate = bp033YageoRc0603fr07100rlIrReviewCandidate
    expect(validateBp033YageoRc0603fr07100rlIrReviewCandidate()).toEqual([])
    expect(isBp033YageoRc0603fr07100rlIrReviewCandidate(candidate)).toBe(true)
    expect(candidate.rootIntegrationHandoff).toMatchObject({
      canonicalLedgerPath: "packages/scoring-circuit/src/bench-prototype-application-footprints.ts",
      integrationStatus: "root-integration-handoff",
      requiredRows: [
        { reference: "R_IR_VS", manufacturer: "YAGEO", manufacturerPartNumber: "RC0603FR-07100RL", package: "0603" },
        { reference: "R_IR_OUT", manufacturer: "YAGEO", manufacturerPartNumber: "RC0603FR-07100RL", package: "0603" }
      ]
    })
    expect(candidate.rootIntegrationHandoff).not.toHaveProperty("canonicalSourceSha256")
    expect(candidate.stableUpstreamSelectionContract.sha256).toBe(sha256("./bench-prototype-ir-receiver-selection.ts"))

    expect(validateBenchPrototypeIrReceiverSelection(benchPrototypeIrReceiverSelection)).toBe(true)
    expect(
      benchPrototypeIrReceiverSelection.supportNetwork.filter(
        (part) => part.reference === "R_IR_VS" || part.reference === "R_IR_OUT"
      )
    ).toEqual([
      expect.objectContaining({
        reference: "R_IR_VS",
        manufacturer: "YAGEO",
        mpn: "RC0603FR-07100RL",
        package: "0603 / 1608"
      }),
      expect.objectContaining({
        reference: "R_IR_OUT",
        manufacturer: "YAGEO",
        mpn: "RC0603FR-07100RL",
        package: "0603 / 1608"
      })
    ])
  })

  it("hash-binds the exact Yageo primary source while separating it from project geometry", () => {
    const candidate = bp033YageoRc0603fr07100rlIrReviewCandidate
    expect(sha256("../docs/evidence/bp-033/yageo-rc0603fr-07100rl-datasheet.pdf")).toBe(candidate.source.sha256)
    expect(candidate.source).toMatchObject({
      authority: "manufacturer-primary-retained-bytes",
      manufacturer: "YAGEO",
      manufacturerPartNumber: "RC0603FR-07100RL",
      reviewedPages: [1]
    })
    expect(candidate.exactOrderableCharacteristics).toMatchObject({
      resistanceOhms: 100,
      tolerancePercent: 1,
      powerW: 0.1,
      operatingTemperatureC: { minimum: -55, maximum: 155 }
    })
    expect(candidate.manufacturerLandPattern).toEqual({
      sourceScope: "retained exact-part product specification; land-pattern guidance not published",
      copper: { status: "not-published", padGapMm: null, padLengthMm: null, padWidthMm: null },
      solderMask: { status: "not-published" },
      paste: { status: "not-published" },
      courtyard: { status: "not-published" }
    })
    expect(candidate.projectReviewInputs).toMatchObject({
      authority: "project-review-input-not-manufacturer-land-pattern",
      copperPads: { padLengthMm: 0.9, padWidthMm: 0.9, innerGapMm: 0.5, centerXMm: 0.7 },
      solderMask: { openingLengthMm: 1, openingWidthMm: 1, state: "project-review-input" },
      paste: { openingLengthMm: 0.8, openingWidthMm: 0.8, state: "project-review-input" },
      courtyard: { lengthMm: 2.4, widthMm: 1.4, state: "project-review-input" }
    })
  })

  it("renders isolated non-polar project-review artwork", () => {
    const rendered = renderTestCircuit(<Bp033YageoRc0603fr07100rlIrReviewCandidate />)
    expect(rendered.filter((element) => element.type === "pcb_smtpad")).toEqual([
      expect.objectContaining({ x: -0.7, y: 0, width: 0.9, height: 0.9 }),
      expect.objectContaining({ x: 0.7, y: 0, width: 0.9, height: 0.9 })
    ])
    expect(rendered.filter((element) => element.type === "pcb_solder_paste")).toHaveLength(2)
    expect(rendered.filter((element) => element.type === "pcb_courtyard_rect")).toEqual([
      expect.objectContaining({ center: { x: 0, y: 0 }, width: 2.4, height: 1.4 })
    ])
    expect(bp033YageoRc0603fr07100rlIrReviewCandidate.artwork.sha256).toBe(
      "C7F7B09F6AA395F0828ED993D2801D6AEB08D8533C3D8933DD64187423B4B1A8"
    )
  })

  it("keeps CAD, placement, acceptance, fabrication, and release denied", () => {
    const candidate = bp033YageoRc0603fr07100rlIrReviewCandidate
    expect(candidate.manufacturerCad).toEqual({ state: "not-acquired", artifactPath: null, authority: "deny" })
    expect(candidate.orientation).toMatchObject({
      state: "pending-independent-review",
      polarity: "non-polar",
      pinOne: "not-applicable",
      assemblyRotationDeg: null,
      placementAuthority: "deny"
    })
    expect(candidate.gates).toEqual({
      projectCadImport: "deny",
      boardPlacement: "deny",
      geometryAcceptance: "deny",
      orientationAcceptance: "deny",
      fabrication: "deny",
      release: "deny",
      accepted: false
    })
  })

  it("rejects adversarial values, descriptors, symbols, hidden fields, aliases, cycles, and prototypes without getters", () => {
    const handoffDrift = structuredClone(bp033YageoRc0603fr07100rlIrReviewCandidate)
    Reflect.set(handoffDrift.rootIntegrationHandoff.requiredRows[0], "package", "0805")
    expect(validateBp033YageoRc0603fr07100rlIrReviewCandidate(handoffDrift)).not.toEqual([])

    const hiddenField = structuredClone(bp033YageoRc0603fr07100rlIrReviewCandidate)
    Object.defineProperty(hiddenField.source, "unreviewed", { value: true })
    expect(validateBp033YageoRc0603fr07100rlIrReviewCandidate(hiddenField)).not.toEqual([])

    const symbolField = structuredClone(bp033YageoRc0603fr07100rlIrReviewCandidate)
    Reflect.set(symbolField.source, Symbol("unreviewed"), true)
    expect(validateBp033YageoRc0603fr07100rlIrReviewCandidate(symbolField)).not.toEqual([])

    const aliasDrift = structuredClone(bp033YageoRc0603fr07100rlIrReviewCandidate)
    Object.defineProperty(aliasDrift.rootIntegrationHandoff.requiredRows, "1", {
      configurable: true,
      enumerable: true,
      writable: true,
      value: aliasDrift.rootIntegrationHandoff.requiredRows[0]
    })
    expect(validateBp033YageoRc0603fr07100rlIrReviewCandidate(aliasDrift)).not.toEqual([])

    const cycleDrift = structuredClone(bp033YageoRc0603fr07100rlIrReviewCandidate)
    Object.defineProperty(cycleDrift, "source", {
      configurable: true,
      enumerable: true,
      writable: true,
      value: cycleDrift
    })
    expect(validateBp033YageoRc0603fr07100rlIrReviewCandidate(cycleDrift)).not.toEqual([])

    const prototypeDrift = structuredClone(bp033YageoRc0603fr07100rlIrReviewCandidate)
    Object.setPrototypeOf(prototypeDrift.source, null)
    expect(validateBp033YageoRc0603fr07100rlIrReviewCandidate(prototypeDrift)).not.toEqual([])

    const accessorDrift = structuredClone(bp033YageoRc0603fr07100rlIrReviewCandidate)
    let getterRead = false
    Object.defineProperty(accessorDrift.source, "url", {
      enumerable: true,
      get: () => {
        getterRead = true
        return "https://yageogroup.com/"
      }
    })
    expect(validateBp033YageoRc0603fr07100rlIrReviewCandidate(accessorDrift)).not.toEqual([])
    expect(getterRead).toBe(false)
  })
})
