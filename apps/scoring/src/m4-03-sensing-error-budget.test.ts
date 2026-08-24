import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import {
  calculateM403ThresholdError,
  M403_SENSING_ERROR_BUDGET,
  M403_REQUIRED_TERM_IDS,
  M403_SENSING_ERROR_SOURCE_CONTRACTS,
  validateM403SensingErrorBudget
} from "./m4-03-sensing-error-budget.js"

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..")

type MutableBudget = {
  authority: { fixtureTargetValidated: boolean }
  thresholdScreens: Array<{
    terms: Array<{ allocationOhms: number; id: string }>
    totalWorstCaseOhms: number
  }>
}

function canonicalSourceDigest(source: Buffer | string): string {
  return createHash("sha256").update(source.toString().replace(/\r\n/gu, "\n")).digest("hex")
}

describe("M4-03 sensing error budget", () => {
  it("contains a complete, numeric, evidence-gated ledger inside the plus or minus five-ohm fixture target", () => {
    const budget = M403_SENSING_ERROR_BUDGET
    expect(budget.thresholdScreens).toHaveLength(4)
    expect(budget.thresholdScreens.every((screen) => screen.withinFixtureTarget)).toBe(true)
    expect(Math.max(...budget.thresholdScreens.map((screen) => screen.totalWorstCaseOhms))).toBeLessThan(5)
    for (const screen of budget.thresholdScreens) {
      expect(screen.terms.map((term) => term.id)).toEqual(M403_REQUIRED_TERM_IDS)
      expect(screen.terms.every((term) => Number.isFinite(term.allocationOhms) && term.allocationOhms >= 0)).toBe(true)
      expect(screen.terms.every((term) => term.evidenceRequired.length > 0 && term.invalidatedBy.length > 0)).toBe(true)
      expect(screen.terms.reduce((total, term) => total + term.allocationOhms, 0)).toBeCloseTo(
        screen.totalWorstCaseOhms,
        12
      )
    }
    expect(budget.calibration.rawSourcePathShiftAt125COhms).toBeCloseTo(18.515, 12)
    expect(budget.calibration.residualsAreUnmeasuredAcceptanceGates).toBe(true)
    expect(budget.fixtureTarget.status).toContain("only-if")
  })

  it("uses the published source/sink switch, selected resistor, ratiometric reference, and ADC terms", () => {
    const screen = calculateM403ThresholdError({ resistanceOhms: 475, temperatureC: 125 })
    expect(screen.sensitivityVoltsPerOhm).toBeCloseTo(0.0007080924445, 10)
    expect(screen.adcIntegralLinearityOhms).toBeCloseTo(0.0404, 3)
    expect(screen.adcOffsetDriftOhms).toBeCloseTo(0.21188, 3)
    expect(screen.adcInputLeakageOhms).toBeCloseTo(0.0028, 3)
    expect(screen.bufferOffsetOhms).toBeCloseTo(0.1695, 3)
    expect(screen.totalSourceBoundOhms).toBeLessThan(0.5)
    expect(M403_SENSING_ERROR_BUDGET.candidatePath.switch).toContain("9.8")
    expect(M403_SENSING_ERROR_BUDGET.candidatePath.reference).toContain("ratiometric")
  })

  it("pins the input evidence to committed source identities", () => {
    for (const contract of M403_SENSING_ERROR_SOURCE_CONTRACTS) {
      const current = readFileSync(resolve(repositoryRoot, contract.sourcePath))
      const committed = execFileSync("git", ["show", `${contract.commit}:${contract.sourcePath}`], {
        cwd: repositoryRoot
      })
      expect(canonicalSourceDigest(current)).toBe(contract.sha256)
      expect(canonicalSourceDigest(committed)).toBe(contract.sha256)
    }
  }, 30_000)

  it("fails closed for changed or removed ledger terms, non-finite inputs, and authority escalation", () => {
    expect(validateM403SensingErrorBudget(M403_SENSING_ERROR_BUDGET)).toBe(true)
    const altered = structuredClone(M403_SENSING_ERROR_BUDGET) as unknown as MutableBudget
    altered.thresholdScreens[0]!.terms[0]!.allocationOhms = 0
    expect(() => validateM403SensingErrorBudget(altered)).toThrow("exactly match")
    const removed = structuredClone(M403_SENSING_ERROR_BUDGET) as unknown as MutableBudget
    removed.thresholdScreens[0]!.terms.pop()
    expect(() => validateM403SensingErrorBudget(removed)).toThrow("exactly match")
    const escalation = structuredClone(M403_SENSING_ERROR_BUDGET) as unknown as MutableBudget
    escalation.authority.fixtureTargetValidated = true
    expect(() => validateM403SensingErrorBudget(escalation)).toThrow("exactly match")
    expect(() => calculateM403ThresholdError({ resistanceOhms: -1, temperatureC: 25 })).toThrow("non-negative")
    expect(() => calculateM403ThresholdError({ resistanceOhms: 450, temperatureC: Number.NaN })).toThrow("finite")
  })
})
