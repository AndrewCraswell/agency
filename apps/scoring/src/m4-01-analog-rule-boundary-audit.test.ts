import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { calculateGuardedFaultEnvelope } from "../../../packages/scoring-circuit/src/bench-prototype-fault-protection.js"
import { calculateReferenceTransientScreen } from "../../../packages/scoring-circuit/src/bench-prototype-reference-drive.js"
import {
  expectedExperimentSenseVoltage,
  oneChannelGuardedFaultScreen,
  oneChannelStaticScreen
} from "../../../packages/scoring-circuit/src/one-channel-analog-experiment.js"
import {
  M401_ANALOG_AUDIT_SOURCE_CONTRACTS,
  M401_ANALOG_MODEL_AUDIT,
  M401_ANALOG_MODEL_CASES,
  loadM401AnalogRuleBoundaryAudit,
  validateM401AnalogModelAudit
} from "./m4-01-analog-rule-boundary-audit.js"

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..")

type MutableAudit = {
  authority: {
    circuitRelease: boolean
    energizedTestAuthorization: boolean
    fabricationRelease: boolean
    scoringAuthority: boolean
  }
  cases: Array<{
    id: string
    outputs: Record<string, boolean | number>
    sourceContractDigests: string[]
  }>
  sourceContracts: Array<{ sha256: string }>
}

function editableAudit(): MutableAudit {
  return structuredClone(M401_ANALOG_MODEL_AUDIT) as unknown as MutableAudit
}

function canonicalSourceDigest(source: Buffer | string): string {
  return createHash("sha256").update(source.toString().replace(/\r\n/gu, "\n")).digest("hex")
}

function normalCase(resistance: number, capacitance: number, temperature: number) {
  const id = `normal-r${resistance}-c${capacitance}-t${temperature}-tolerance-unclosed`
  const found = M401_ANALOG_MODEL_CASES.find((modelCase) => modelCase.id === id)
  if (!found) throw new Error(`missing ${id}`)
  return found
}

describe("M4-01 analogue rule-boundary model audit", () => {
  it("materializes every BP-106 resistance, capacitance, temperature, guarded-fault, unpowered, tolerance, and rule-pulse case", () => {
    expect(M401_ANALOG_MODEL_CASES).toHaveLength(786)
    expect(M401_ANALOG_MODEL_CASES.filter(({ id }) => id.startsWith("normal-"))).toHaveLength(320)
    expect(M401_ANALOG_MODEL_CASES.filter(({ id }) => id.startsWith("guarded-"))).toHaveLength(224)
    expect(M401_ANALOG_MODEL_CASES.filter(({ id }) => id.startsWith("unpowered-"))).toHaveLength(224)
    expect(M401_ANALOG_MODEL_CASES.filter(({ id }) => id.startsWith("pulse-"))).toHaveLength(17)
    expect(M401_ANALOG_MODEL_CASES.map(({ id }) => id)).toContain("reference-passive-c8uf-esr0.1-q100nc-w1us")
    expect(normalCase(0, 500, -40).outputs.unboundedToleranceTerms).toBe(10)
    expect(normalCase(505, 10_000, 125).inputs.tolerancePolicy).toContain("no-credit")
    expect(M401_ANALOG_MODEL_CASES.find(({ id }) => id.endsWith("w99"))?.disposition).toBe("screen-fail-no-credit")
    expect(M401_ANALOG_MODEL_CASES.find(({ id }) => id.endsWith("w100"))?.disposition).toBe("screen-pass-no-credit")
    expect(M401_ANALOG_MODEL_CASES.every(({ sourceContractDigests }) => sourceContractDigests.length === 5)).toBe(true)
  })

  it("independently agrees with the committed BP-100, BP-101, and BP-102 arithmetic without a production runtime dependency", () => {
    for (const modelCase of M401_ANALOG_MODEL_CASES.filter(({ id }) => id.startsWith("normal-"))) {
      const resistance = modelCase.inputs.externalResistanceOhms
      const temperature = modelCase.inputs.temperatureC
      if (typeof resistance !== "number" || typeof temperature !== "number") throw new Error("normal case malformed")
      expect(modelCase.outputs.normalInputVolts).toBeCloseTo(expectedExperimentSenseVoltage(resistance), 12)
      expect(modelCase.outputs.staticErrorOhms).toBeCloseTo(
        oneChannelStaticScreen(resistance, temperature).totalOhms,
        12
      )
    }

    for (const modelCase of M401_ANALOG_MODEL_CASES.filter(({ id }) => id.startsWith("guarded-"))) {
      const volts = modelCase.inputs.appliedVolts
      if (typeof volts !== "number") throw new Error("guarded case malformed")
      const expected = oneChannelGuardedFaultScreen(volts)
      const bp102 = calculateGuardedFaultEnvelope({ appliedVolts: volts, pulseDurationMs: 100 })
      expect(modelCase.outputs.sourceCurrentA).toBeCloseTo(expected.currentA, 16)
      expect(modelCase.outputs.sourcePowerW).toBeCloseTo(expected.maximumSourcePowerW, 16)
      expect(modelCase.outputs.sourceEnergyJ).toBeCloseTo(bp102.maximumSourceEnergyJ, 16)
    }

    const reference = M401_ANALOG_MODEL_CASES.find(({ id }) => id === "reference-passive-c8uf-esr0.1-q100nc-w1us")
    if (!reference) throw new Error("reference case missing")
    const expectedReference = calculateReferenceTransientScreen({
      capacitorMaximumEsrOhms: 0.1,
      capacitorMinimumUf: 8,
      chargePulseNc: 100,
      pulseWidthUs: 1
    })
    expect(reference.outputs).toMatchObject(expectedReference)
  })

  it("pins every source contract to the current committed artifact digest", () => {
    for (const contract of M401_ANALOG_AUDIT_SOURCE_CONTRACTS) {
      const currentSource = readFileSync(resolve(repositoryRoot, contract.sourcePath))
      const committedSource = execFileSync("git", ["show", `${contract.commit}:${contract.sourcePath}`], {
        cwd: repositoryRoot
      })
      const currentDigest = canonicalSourceDigest(currentSource)
      const committedDigest = canonicalSourceDigest(committedSource)

      expect(currentDigest).toBe(contract.sha256)
      expect(committedDigest).toBe(contract.sha256)
      expect(contract.commit).toMatch(/^[0-9a-f]{40}$/u)
    }
  }, 30_000)

  it("fails closed for missing, duplicate, stale, non-finite, altered, or source-drifted cases", () => {
    expect(validateM401AnalogModelAudit(M401_ANALOG_MODEL_AUDIT)).toBe(true)

    const missing = editableAudit()
    missing.cases.pop()
    expect(() => validateM401AnalogModelAudit(missing)).toThrow("missing or stale")

    const duplicate = editableAudit()
    duplicate.cases[1] = structuredClone(duplicate.cases[0]!)
    expect(() => validateM401AnalogModelAudit(duplicate)).toThrow("duplicate")

    const stale = editableAudit()
    stale.cases[0]!.id = "normal-r999-c500-t-40-tolerance-unclosed"
    expect(() => validateM401AnalogModelAudit(stale)).toThrow("stale case")

    const staleEvidence = editableAudit()
    staleEvidence.cases[0]!.sourceContractDigests[0] = "M0-03:substituted"
    expect(() => validateM401AnalogModelAudit(staleEvidence)).toThrow("stale source-contract")

    const altered = editableAudit()
    altered.cases[0]!.outputs.normalInputVolts = 1
    expect(() => validateM401AnalogModelAudit(altered)).toThrow("drifted")

    const nonFinite = editableAudit()
    nonFinite.cases[0]!.outputs.normalInputVolts = Number.NaN
    expect(() => validateM401AnalogModelAudit(nonFinite)).toThrow("non-finite")

    const sourceDrift = editableAudit()
    sourceDrift.sourceContracts[0]!.sha256 = "0".repeat(64)
    expect(() => validateM401AnalogModelAudit(sourceDrift)).toThrow("source-contract identity or digest drifted")

    const authorityDrift = editableAudit()
    authorityDrift.authority = { ...authorityDrift.authority }
    expect(() => validateM401AnalogModelAudit(authorityDrift)).toThrow("immutable denied authority")

    const malformed = editableAudit()
    malformed.cases[0] = Object.create(null) as (typeof malformed.cases)[number]
    expect(() => validateM401AnalogModelAudit(malformed)).toThrow("plain record with an id")

    expect(() => validateM401AnalogModelAudit({ cases: [], sourceContracts: [] })).toThrow("missing or stale")
    expect(() => validateM401AnalogModelAudit(null)).toThrow("must contain")
  })

  it("returns only immutable evidence planning, never a circuit, fabrication, energized-test, or scoring grant", () => {
    const audit = loadM401AnalogRuleBoundaryAudit()

    expect(audit).toMatchObject({
      authority: {
        circuitRelease: false,
        energizedTestAuthorization: false,
        fabricationRelease: false,
        scoringAuthority: false
      },
      disposition: "evidence-plan-only"
    })
    expect(Object.isFrozen(audit)).toBe(true)
    expect(Object.isFrozen(audit.cases)).toBe(true)
    expect(audit.cases.every(({ disposition }) => disposition.endsWith("no-credit"))).toBe(true)
  })
})
