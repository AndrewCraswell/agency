import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  bp033Keystone5001TestPointEvidenceCandidate,
  isBp033Keystone5001TestPointEvidenceCandidate,
  validateBp033Keystone5001TestPointEvidenceCandidate
} from "./bp033-keystone-5001-test-point-evidence-candidate.js"

function sha256(relativePath: string) {
  return createHash("sha256")
    .update(readFileSync(new URL(relativePath, import.meta.url)))
    .digest("hex")
    .toUpperCase()
}

describe("BP-033 Keystone 5001 test-point evidence candidate", () => {
  it("binds the three exact canonical references to the retained official Keystone catalog", () => {
    const candidate = bp033Keystone5001TestPointEvidenceCandidate
    expect(validateBp033Keystone5001TestPointEvidenceCandidate()).toEqual([])
    expect(isBp033Keystone5001TestPointEvidenceCandidate(candidate)).toBe(true)
    expect(candidate.sourceBinding.exactReferences).toEqual(["TP_W5500_RESET_N", "TP_W5500_INT_N", "TP_IR_RX"])
    expect(candidate.sourceBinding).toMatchObject({
      integrationStatus: "root-integration-handoff",
      enforcement: "The canonical BP-033 ledger must retain exactly these three references at Keystone 5001."
    })
    expect(sha256("../docs/evidence/bp-033/keystone-terminal-test-points.pdf")).toBe(candidate.source.sha256)
  })

  it("records the exact orderable identity without converting the catalog illustration into project geometry", () => {
    expect(bp033Keystone5001TestPointEvidenceCandidate.selection).toEqual({
      manufacturer: "Keystone Electronics",
      manufacturerPartNumber: "5001",
      family: "THM thru-hole mount test points, color keyed, miniature",
      color: "black",
      referencePackageDescriptions: [
        "miniature through-hole black test point, 0.040 inch (catalog 1.0 mm) mounting hole",
        "miniature through-hole test point, 1.02 mm hole"
      ]
    })
    expect(bp033Keystone5001TestPointEvidenceCandidate.exactManufacturerEvidence).toMatchObject({
      mountingHole: "0.040 inch (1.0 mm) diameter",
      illustratedBody: { nominalHeightMm: 7.6, baseDiameterMm: 3, loopOuterDiameterMm: 2.5, loopInnerDiameterMm: 1.25 }
    })
    expect(bp033Keystone5001TestPointEvidenceCandidate.evidenceBoundary).toEqual({
      catalogDrawing: "exact product identity and manufacturer illustration only",
      projectDrill: "not-derived",
      projectLand: "not-derived",
      projectArtwork: "not-generated",
      boardCoordinates: "not-assigned",
      assemblyOrientation: "not-assigned"
    })
  })

  it("keeps geometry, placement, fit, fabrication, acceptance, and release denied", () => {
    expect(bp033Keystone5001TestPointEvidenceCandidate.deniedGates).toEqual({
      projectGeometry: "deny",
      placement: "deny",
      mechanicalSampleFit: "deny",
      probeClearance: "deny",
      manufacturerCad: "deny-not-acquired",
      fabrication: "deny",
      acceptance: "deny",
      release: "deny"
    })
    expect(bp033Keystone5001TestPointEvidenceCandidate.accepted).toBe(false)
  })

  it("rejects adversarial values, hidden fields, symbols, prototypes, and accessors without invoking getters", () => {
    const referenceDrift = structuredClone(bp033Keystone5001TestPointEvidenceCandidate)
    Reflect.set(referenceDrift.sourceBinding, "exactReferences", ["TP_W5500_RESET_N"])
    expect(validateBp033Keystone5001TestPointEvidenceCandidate(referenceDrift)).not.toEqual([])

    const gateDrift = structuredClone(bp033Keystone5001TestPointEvidenceCandidate)
    Reflect.set(gateDrift.deniedGates, "release", "approved")
    expect(validateBp033Keystone5001TestPointEvidenceCandidate(gateDrift)).not.toEqual([])

    const hiddenField = structuredClone(bp033Keystone5001TestPointEvidenceCandidate)
    Object.defineProperty(hiddenField.source, "unreviewed", { value: true })
    expect(validateBp033Keystone5001TestPointEvidenceCandidate(hiddenField)).not.toEqual([])

    const symbolField = structuredClone(bp033Keystone5001TestPointEvidenceCandidate)
    Reflect.set(symbolField.source, Symbol("unreviewed"), true)
    expect(validateBp033Keystone5001TestPointEvidenceCandidate(symbolField)).not.toEqual([])

    const prototypeDrift = structuredClone(bp033Keystone5001TestPointEvidenceCandidate)
    Object.setPrototypeOf(prototypeDrift.source, null)
    expect(validateBp033Keystone5001TestPointEvidenceCandidate(prototypeDrift)).not.toEqual([])

    const accessorDrift = structuredClone(bp033Keystone5001TestPointEvidenceCandidate)
    let getterRead = false
    Object.defineProperty(accessorDrift.source, "url", {
      enumerable: true,
      get: () => {
        getterRead = true
        return "https://example.invalid/"
      }
    })
    expect(validateBp033Keystone5001TestPointEvidenceCandidate(accessorDrift)).not.toEqual([])
    expect(getterRead).toBe(false)
  })
})
