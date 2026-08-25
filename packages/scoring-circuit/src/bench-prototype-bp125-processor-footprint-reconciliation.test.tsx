import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { BenchPrototypeBp032Esp32Wroom1uFootprint } from "./bench-prototype-bp032-esp32-s3-wroom-1u-footprint.js"
import {
  benchPrototypeBp125ProcessorFootprintReconciliation,
  validateBenchPrototypeBp125ProcessorFootprintReconciliation
} from "./bench-prototype-bp125-processor-footprint-reconciliation.js"
import { Bp032Stm32G474Ret3TrLqfp64CandidateFootprint } from "./bp032-stm32g474ret3tr-lqfp64-footprint.js"
import { renderTestCircuit } from "./test-helper.js"

const reconciliation = benchPrototypeBp125ProcessorFootprintReconciliation

function evidenceHash(artifactPath: string): string {
  const relativeEvidencePath = artifactPath.replace("packages/scoring-circuit/", "../")
  return createHash("sha256")
    .update(readFileSync(new URL(relativeEvidencePath, import.meta.url)))
    .digest("hex")
    .toUpperCase()
}

describe("BP-125 processor footprint reconciliation", () => {
  it("binds the exact STM32 and ESP32 orderables to the retained primary-source bytes", () => {
    expect(validateBenchPrototypeBp125ProcessorFootprintReconciliation(reconciliation)).toBe(true)
    expect(reconciliation.processorBindings).toEqual([
      expect.objectContaining({ reference: "U_SCORING", exactMpn: "STM32G474RET3TR", package: "LQFP64" }),
      expect.objectContaining({
        reference: "U_APP",
        exactMpn: "ESP32-S3-WROOM-1U-N16R2",
        package: "ESP32-S3-WROOM-1U module"
      })
    ])
    for (const source of reconciliation.retainedManufacturerSources) {
      expect(evidenceHash(source.artifactPath)).toBe(source.sha256)
      expect(source.officialUrl).toMatch(/^https:\/\//u)
    }
  })

  it("reuses the isolated exact-candidate geometries without creating release authority", () => {
    const stm32 = renderTestCircuit(<Bp032Stm32G474Ret3TrLqfp64CandidateFootprint />)
    const esp32 = renderTestCircuit(<BenchPrototypeBp032Esp32Wroom1uFootprint />)
    expect(stm32.filter((element) => element.type === "pcb_smtpad")).toHaveLength(64)
    expect(esp32.filter((element) => element.type === "pcb_smtpad")).toHaveLength(40)
    expect(esp32.filter((element) => element.type === "pcb_plated_hole")).toHaveLength(9)
    expect(reconciliation.authority).toEqual({
      schematicIntegrationAuthorized: false,
      schematicSignoff: "deny",
      footprintApproval: false,
      layoutApproval: false,
      fabricationAuthorized: false
    })
  })

  it("rejects mutations and retains the review gates for every checklist item", () => {
    expect(() =>
      validateBenchPrototypeBp125ProcessorFootprintReconciliation({
        ...reconciliation,
        authority: { ...reconciliation.authority, fabricationAuthorized: true }
      })
    ).toThrow("must exactly match")
    expect(reconciliation.schematicChecklist).toHaveLength(5)
    expect(reconciliation.schematicChecklist.map((item) => item.releaseGate)).toEqual([
      "independent-overlay-orientation-mask-paste-and-courtyard-review",
      "schematic-signoff-and-timing-validation",
      "independent-module-overlay-ep-ad-via-paste-and-courtyard-review",
      "schematic-signoff-power-sequence-and-continuity-evidence",
      "rf-cable-enclosure-and-placement-review"
    ])
  })
})
