import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  bp033W5500CrystalSupportEvidence,
  validateBp033W5500CrystalSupportEvidence
} from "./bp033-w5500-crystal-support-evidence.js"

function retainedBytes(artifactPath: string): Buffer {
  return readFileSync(new URL(`../${artifactPath.replace("packages/scoring-circuit/", "")}`, import.meta.url))
}

describe("BP-033 W5500 crystal and support exact-MPN evidence", () => {
  it("keeps only eight table rows covering the ten unresolved references", () => {
    expect(validateBp033W5500CrystalSupportEvidence()).toBe(true)
    expect(bp033W5500CrystalSupportEvidence.rows).toHaveLength(8)
    expect(bp033W5500CrystalSupportEvidence.rows.flatMap((row) => row.references)).toEqual([
      "Y_W5500",
      "C_W5500_XI",
      "C_W5500_XO",
      "R_W5500_XTAL",
      "R_W5500_XO",
      "R_W5500_EXRES",
      "C_W5500_TOCAP",
      "C_W5500_1V2O",
      "FB_W5500_AVDD"
    ])
    expect(bp033W5500CrystalSupportEvidence.rows[0]).toMatchObject({
      mpn: "ECS-250-18-33B-JGN-TR",
      package: "ECS-33B, 3.20 mm x 2.50 mm x 0.80 mm, 4-pad SMD, 1K reel"
    })
    expect(bp033W5500CrystalSupportEvidence.rows[1]).toMatchObject({
      references: ["C_W5500_XI", "C_W5500_XO"],
      mpn: "CGA3E2C0G1H180J080AA"
    })
  })

  it("binds every source file to its SHA-256 and reviewed fields", () => {
    for (const source of bp033W5500CrystalSupportEvidence.sources) {
      expect(createHash("sha256").update(retainedBytes(source.artifactPath)).digest("hex").toUpperCase()).toBe(
        source.sha256
      )
      expect(source.reviewedPagesOrFields.length).toBeGreaterThan(0)
    }
  })

  it("keeps CAD, placement, fabrication, and release denied", () => {
    expect(bp033W5500CrystalSupportEvidence.denyGates).toEqual({
      manufacturerCad: "deny",
      boardPlacement: "deny",
      fabrication: "deny",
      release: "deny",
      accepted: false
    })
  })

  it.each([
    ["reference", (copy: any) => (copy.rows[0].references[0] = "FORGED")],
    ["MPN", (copy: any) => (copy.rows[0].mpn = "FORGED")],
    ["package", (copy: any) => (copy.rows[0].package = "FORGED")],
    ["source digest", (copy: any) => (copy.sources[0].sha256 = "0".repeat(64))],
    ["deny gate", (copy: any) => (copy.denyGates.fabrication = "allow")]
  ])("fails closed for %s drift", (_name, mutate) => {
    const copy = structuredClone(bp033W5500CrystalSupportEvidence) as any
    mutate(copy)
    expect(() => validateBp033W5500CrystalSupportEvidence(copy)).toThrow(/drifted/u)
  })

  it("rejects aliases, cycles, accessors, and prototype drift", () => {
    const alias = structuredClone(bp033W5500CrystalSupportEvidence) as any
    alias.rows[1].boundFields[1] = alias.rows[1].boundFields[0]
    expect(() => validateBp033W5500CrystalSupportEvidence(alias)).toThrow(/drifted/u)

    const cycle = structuredClone(bp033W5500CrystalSupportEvidence) as any
    cycle.rows[0].boundFields[0] = cycle
    expect(() => validateBp033W5500CrystalSupportEvidence(cycle)).toThrow(/drifted/u)

    const accessor = structuredClone(bp033W5500CrystalSupportEvidence) as any
    Object.defineProperty(accessor, "scope", { configurable: true, enumerable: true, get: () => "forged" })
    expect(() => validateBp033W5500CrystalSupportEvidence(accessor)).toThrow(/drifted/u)

    const nullPrototype = Object.assign(Object.create(null), structuredClone(bp033W5500CrystalSupportEvidence))
    expect(() => validateBp033W5500CrystalSupportEvidence(nullPrototype)).toThrow(/drifted/u)
  })
})
