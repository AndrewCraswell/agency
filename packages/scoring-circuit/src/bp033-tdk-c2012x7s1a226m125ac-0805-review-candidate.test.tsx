import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  bp033TdkC2012x7s1a226m125ac0805ReviewCandidate,
  Bp033TdkC2012x7s1a226m125ac0805ReviewCandidate,
  isBp033TdkC2012x7s1a226m125ac0805ReviewCandidate,
  validateBp033TdkC2012x7s1a226m125ac0805ReviewCandidate
} from "./bp033-tdk-c2012x7s1a226m125ac-0805-review-candidate.js"
import { renderTestCircuit } from "./test-helper.js"

function sha256(relativePath: string) {
  return createHash("sha256")
    .update(readFileSync(new URL(relativePath, import.meta.url)))
    .digest("hex")
    .toUpperCase()
}

describe("BP-033 TDK C2012X7S1A226M125AC 0805 review candidate", () => {
  it("hands off exactly five canonical rows while hashing only stable upstream selection contracts", () => {
    const candidate = bp033TdkC2012x7s1a226m125ac0805ReviewCandidate
    expect(validateBp033TdkC2012x7s1a226m125ac0805ReviewCandidate()).toEqual([])
    expect(isBp033TdkC2012x7s1a226m125ac0805ReviewCandidate(candidate)).toBe(true)
    expect(candidate.rootIntegrationHandoff).toMatchObject({
      canonicalLedgerPath: "packages/scoring-circuit/src/bench-prototype-application-footprints.ts",
      canonicalWorkUnit: "BP-033",
      integrationStatus: "root-integration-handoff",
      requiredRows: [
        {
          reference: "C_DISPLAY_IN",
          manufacturer: "TDK",
          manufacturerPartNumber: "C2012X7S1A226M125AC",
          package: "0805"
        },
        {
          reference: "C_DISPLAY_OUT",
          manufacturer: "TDK",
          manufacturerPartNumber: "C2012X7S1A226M125AC",
          package: "0805"
        },
        {
          reference: "C_APP_REG_OUT_A",
          manufacturer: "TDK",
          manufacturerPartNumber: "C2012X7S1A226M125AC",
          package: "0805"
        },
        {
          reference: "C_APP_REG_OUT_B",
          manufacturer: "TDK",
          manufacturerPartNumber: "C2012X7S1A226M125AC",
          package: "0805"
        },
        {
          reference: "C_APP_REG_OUT_C",
          manufacturer: "TDK",
          manufacturerPartNumber: "C2012X7S1A226M125AC",
          package: "0805"
        }
      ]
    })
    expect(candidate.rootIntegrationHandoff).not.toHaveProperty("canonicalSourceSha256")
    expect(candidate.stableUpstreamSelectionContracts).toEqual([
      expect.objectContaining({
        workUnit: "BP-050",
        requiredRows: ["C_DISPLAY_IN", "C_DISPLAY_OUT"],
        sha256: sha256("./bench-prototype-power.ts")
      }),
      expect.objectContaining({
        workUnit: "BP-142",
        requiredRows: ["C_APP_REG_OUT_A", "C_APP_REG_OUT_B", "C_APP_REG_OUT_C"],
        sha256: sha256("./bench-prototype-application-rail.ts")
      })
    ])
    expect(sha256("../docs/evidence/bp-033/tdk-c2012x7s1a226m125ac-product-page-capture.md")).toBe(
      candidate.source.sha256
    )
  })

  it("separates exact orderable characteristics from TDK family land guidance and project inputs", () => {
    const candidate = bp033TdkC2012x7s1a226m125ac0805ReviewCandidate
    expect(candidate.exactOrderableCharacteristics).toMatchObject({
      series: "C2012 [EIA 0805]",
      capacitanceUf: 22,
      tolerancePercent: 20,
      ratedVoltageVdc: 10,
      dielectric: "X7S (+/-22%)",
      operatingTemperatureC: { minimum: -55, maximum: 125 }
    })
    expect(candidate.familyLandGuidance).toMatchObject({
      scope: "TDK recommended land pattern shown on the exact-MPN page; not manufacturer CAD",
      process: "reflow",
      parametersMm: {
        pa: { minimum: 0.9, maximum: 1.2 },
        pb: { minimum: 0.7, maximum: 0.9 },
        pc: { minimum: 0.9, maximum: 1.2 }
      }
    })
    expect(candidate.projectReviewInputs).toMatchObject({
      manufacturerParameterSelectionMm: { pa: 1.05, pb: 0.8, pc: 1.05 },
      copperPads: { padLengthMm: 1.05, padWidthMm: 1.05, innerGapMm: 0.8, centerXMm: 0.925 },
      solderMask: { openingLengthMm: 1.15, openingWidthMm: 1.15, state: "project-review-input" },
      paste: { openingLengthMm: 0.95, openingWidthMm: 0.95, state: "project-review-input" },
      courtyard: { lengthMm: 3.4, widthMm: 1.75, state: "project-review-input-not-published-by-tdk" }
    })
  })

  it("renders isolated project-review artwork with two non-polar pads", () => {
    const rendered = renderTestCircuit(<Bp033TdkC2012x7s1a226m125ac0805ReviewCandidate />)
    expect(rendered.filter((element) => element.type === "pcb_smtpad")).toEqual([
      expect.objectContaining({ x: -0.925, y: 0, width: 1.05, height: 1.05 }),
      expect.objectContaining({ x: 0.925, y: 0, width: 1.05, height: 1.05 })
    ])
    expect(rendered.filter((element) => element.type === "pcb_solder_paste")).toHaveLength(2)
    expect(rendered.filter((element) => element.type === "pcb_courtyard_rect")).toEqual([
      expect.objectContaining({ center: { x: 0, y: 0 }, width: 3.4, height: 1.75 })
    ])
  })

  it("keeps CAD, placement, acceptance, fabrication, and release denied", () => {
    const candidate = bp033TdkC2012x7s1a226m125ac0805ReviewCandidate
    expect(candidate.orientation).toMatchObject({
      state: "non-polar-review-input-only",
      pinOne: "not-applicable",
      assemblyRotationDeg: null,
      placementAuthority: "deny"
    })
    expect(candidate.artwork).toMatchObject({
      state: "isolated-generated-project-review-only",
      authority: "deny",
      placement: "not-assigned"
    })
    expect(candidate.gates).toEqual({
      manufacturerCad: "deny-not-acquired",
      projectCadImport: "deny",
      boardPlacement: "deny",
      projectGeometryAcceptance: "deny",
      orientationAcceptance: "deny",
      fabrication: "deny",
      release: "deny"
    })
    expect(candidate.accepted).toBe(false)
  })

  it("rejects adversarial data, descriptors, symbols, hidden fields, and prototype drift without invoking getters", () => {
    const handoffDrift = structuredClone(bp033TdkC2012x7s1a226m125ac0805ReviewCandidate)
    Reflect.set(handoffDrift.rootIntegrationHandoff.requiredRows[0], "package", "0603")
    expect(validateBp033TdkC2012x7s1a226m125ac0805ReviewCandidate(handoffDrift)).not.toEqual([])

    const landDrift = structuredClone(bp033TdkC2012x7s1a226m125ac0805ReviewCandidate)
    Reflect.set(landDrift.projectReviewInputs.copperPads, "padLengthMm", 1.1)
    expect(validateBp033TdkC2012x7s1a226m125ac0805ReviewCandidate(landDrift)).not.toEqual([])

    const releaseDrift = structuredClone(bp033TdkC2012x7s1a226m125ac0805ReviewCandidate)
    Reflect.set(releaseDrift.gates, "release", "approved")
    expect(validateBp033TdkC2012x7s1a226m125ac0805ReviewCandidate(releaseDrift)).not.toEqual([])

    const hiddenField = structuredClone(bp033TdkC2012x7s1a226m125ac0805ReviewCandidate)
    Object.defineProperty(hiddenField.source, "unreviewed", { value: true })
    expect(validateBp033TdkC2012x7s1a226m125ac0805ReviewCandidate(hiddenField)).not.toEqual([])

    const symbolField = structuredClone(bp033TdkC2012x7s1a226m125ac0805ReviewCandidate)
    Reflect.set(symbolField.source, Symbol("unreviewed"), true)
    expect(validateBp033TdkC2012x7s1a226m125ac0805ReviewCandidate(symbolField)).not.toEqual([])

    const prototypeDrift = structuredClone(bp033TdkC2012x7s1a226m125ac0805ReviewCandidate)
    Object.setPrototypeOf(prototypeDrift.source, null)
    expect(validateBp033TdkC2012x7s1a226m125ac0805ReviewCandidate(prototypeDrift)).not.toEqual([])

    const accessorDrift = structuredClone(bp033TdkC2012x7s1a226m125ac0805ReviewCandidate)
    let getterRead = false
    Object.defineProperty(accessorDrift.source, "url", {
      enumerable: true,
      get: () => {
        getterRead = true
        return "https://product.tdk.com/"
      }
    })
    expect(validateBp033TdkC2012x7s1a226m125ac0805ReviewCandidate(accessorDrift)).not.toEqual([])
    expect(getterRead).toBe(false)
  })
})
