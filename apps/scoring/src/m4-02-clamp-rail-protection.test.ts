import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import {
  calculateM402CandidateScreen,
  M402_CLAMP_RAIL_PROTECTION_CANDIDATE,
  M402_CLAMP_RAIL_SOURCE_CONTRACTS,
  validateM402ClampRailProtectionCandidate
} from "./m4-02-clamp-rail-protection.js"

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..")

type MutableCandidate = {
  authority: { fabricationAuthorized: boolean }
  screens: { capacitance: { publishedValueIsTypicalOnly: boolean } }
}

function canonicalSourceDigest(source: Buffer | string): string {
  return createHash("sha256").update(source.toString().replace(/\r\n/gu, "\n")).digest("hex")
}

describe("M4-02 clamp and rail-protection candidate", () => {
  it("calculates the selected clamp leakage, capacitance, and charge-injection screens", () => {
    const candidate = M402_CLAMP_RAIL_PROTECTION_CANDIDATE
    const boundary = candidate.screens.leakage.screen
    expect(boundary.lineTheveninResistanceOhms).toBeCloseTo(381.1224489796, 10)
    expect(boundary.leakageResistanceErrorOhms).toBeCloseTo(0.005292, 10)
    expect(boundary.fiveTauAdditionNs).toBeCloseTo(0.9528061224, 10)
    expect(boundary.tpdCapacitanceFraction).toBe(0.00005)
    expect(candidate.screens.chargeInjection.lowCapacitance500Pf.chargeInjectionStepVolts).toBe(0.003)
    expect(candidate.screens.chargeInjection.lowCapacitance500Pf.chargeInjectionResistanceErrorOhms).toBeCloseTo(
      4.1655903614,
      10
    )
  })

  it("limits the guarded calculation to the existing source envelope and preserves the direct surge return", () => {
    const candidate = M402_CLAMP_RAIL_PROTECTION_CANDIDATE
    expect(candidate.screens.guardedSource.maximum24V100MsCurrentA).toBeCloseTo(0.0004329004329, 12)
    expect(candidate.screens.guardedSource.maximum24V100MsPowerW).toBeCloseTo(0.0103896103896, 12)
    expect(candidate.screens.guardedSource.maximum24V100MsEnergyJ).toBeCloseTo(0.001038961039, 12)
    expect(candidate.screens.surgePath.path).toContain("TPD4E05U06 -> direct SCORING_SGND")
    expect(candidate.screens.surgePath.status).toContain("no-2.5-a-clamp-voltage")
  })

  it("makes no direct STM32 injection claim and keeps the normal USB-C PD architecture", () => {
    const candidate = M402_CLAMP_RAIL_PROTECTION_CANDIDATE
    expect(candidate.mcuInjectionLimits).toMatchObject({
      candidatePredictedInjectionA: 0,
      negativePerPinMaximumA: 0.005,
      positivePerPinMaximumA: 0,
      totalAbsoluteInjectedCurrentA: 0.025
    })
    expect(candidate.candidate.protectedRailBoundary.power).toContain("USB-C PD remains the normal apparatus input")
    expect(candidate.candidate.protectedRailBoundary.power).toContain("adds no VBUS, CC")
  })

  it("pins the candidate to current committed contract identities", () => {
    for (const contract of M402_CLAMP_RAIL_SOURCE_CONTRACTS) {
      const current = readFileSync(resolve(repositoryRoot, contract.sourcePath))
      const committed = execFileSync("git", ["show", `${contract.commit}:${contract.sourcePath}`], {
        cwd: repositoryRoot
      })
      expect(canonicalSourceDigest(current)).toBe(contract.sha256)
      expect(canonicalSourceDigest(committed)).toBe(contract.sha256)
    }
  }, 30_000)

  it("fails closed for altered source assumptions, invented maximum capacitance, and authority escalation", () => {
    expect(validateM402ClampRailProtectionCandidate(M402_CLAMP_RAIL_PROTECTION_CANDIDATE)).toBe(true)

    const altered = structuredClone(M402_CLAMP_RAIL_PROTECTION_CANDIDATE) as unknown as MutableCandidate
    altered.screens.capacitance.publishedValueIsTypicalOnly = false
    expect(() => validateM402ClampRailProtectionCandidate(altered)).toThrow("exactly match")

    const authorityEscalation = structuredClone(M402_CLAMP_RAIL_PROTECTION_CANDIDATE) as unknown as MutableCandidate
    authorityEscalation.authority.fabricationAuthorized = true
    expect(() => validateM402ClampRailProtectionCandidate(authorityEscalation)).toThrow("exactly match")

    expect(() => calculateM402CandidateScreen({ lineCapacitancePf: 0, resistanceOhms: 450 })).toThrow("positive")
    expect(() => calculateM402CandidateScreen({ lineCapacitancePf: 500, resistanceOhms: Number.NaN })).toThrow(
      "non-negative"
    )
  })
})
