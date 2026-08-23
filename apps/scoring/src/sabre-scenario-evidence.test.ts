import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { Ajv2020 } from "ajv/dist/2020.js"
import { describe, expect, it } from "vitest"
import {
  projectSabreScenarioInput,
  runSabreScenarioEvidence,
  SabreScenarioEvidenceError,
  type SabreScenarioDiagnosticEvidence,
  type SabreScenarioInput,
  type SabreScenarioLine
} from "./sabre-scenario-evidence.js"

type ExpectedDiagnostic = SabreScenarioDiagnosticEvidence & { id: string }
type ScenarioDocument = {
  expect: {
    decisions: readonly unknown[]
    diagnostics?: readonly ExpectedDiagnostic[]
    finalState?: { hitCount?: number; isLocked?: boolean }
  }
  inputs: readonly SabreScenarioInput[]
  schemaVersion: string
  weapon: string
}

const docsDirectory = resolve(import.meta.dirname, "../docs")
const fixtureDirectory = resolve(docsDirectory, "golden-scenarios")
const schema = JSON.parse(readFileSync(resolve(docsDirectory, "golden-scenario.schema.json"), "utf8"))
const validateScenario = new Ajv2020({ allErrors: true, strict: false }).compile<ScenarioDocument>(schema)
const diagnosticFixtures = [
  "sabre-control-break-diagnostic-boundaries.json",
  "sabre-white-abnormal-change-latch.json",
  "sabre-yellow-onset-clear.json"
] as const

function readScenario(file: string): ScenarioDocument {
  const value: unknown = JSON.parse(readFileSync(resolve(fixtureDirectory, file), "utf8"))
  if (!validateScenario(value)) throw new Error(`${file} is invalid: ${JSON.stringify(validateScenario.errors)}`)
  return value
}

function expectedDiagnostics(scenario: ScenarioDocument): SabreScenarioDiagnosticEvidence[] {
  return (scenario.expect.diagnostics ?? []).map(({ id: _id, ...diagnostic }) => diagnostic)
}

function line(
  suffix: string,
  state: string,
  resistanceMilliOhms: number | null = null,
  resistanceUncertaintyMilliOhms: number | null = null
): SabreScenarioLine {
  return { line: `left.${suffix}`, resistanceMilliOhms, resistanceUncertaintyMilliOhms, state }
}

function input(lines: readonly SabreScenarioLine[]): SabreScenarioInput {
  return { atUs: 0, id: "projection", lines }
}

describe("sabre golden-scenario evidence", () => {
  it("attributes scorer failures to the causal input and retains the cause", () => {
    const inputs: SabreScenarioInput[] = [
      { atUs: 10, id: "first", lines: [] },
      { atUs: 9, id: "backward", lines: [] }
    ]

    try {
      runSabreScenarioEvidence(inputs)
      throw new Error("Expected non-monotonic Sabre evidence to fail")
    } catch (error) {
      expect(error).toBeInstanceOf(SabreScenarioEvidenceError)
      expect(error).toMatchObject({ inputId: "backward" })
      expect((error as SabreScenarioEvidenceError).message).toContain("monotonic")
      expect((error as SabreScenarioEvidenceError).cause).toBeInstanceOf(Error)
    }
  })

  it("normalizes a non-Error defensive cause", () => {
    const error = new SabreScenarioEvidenceError("input", "unexpected rejection")

    expect(error).toMatchObject({ inputId: "input", message: "Sabre scorer rejected input" })
    expect(error.cause).toBe("unexpected rejection")
  })

  it.each(diagnosticFixtures)("validates and exactly replays %s", (file) => {
    const scenario = readScenario(file)
    const evidence = runSabreScenarioEvidence(scenario.inputs)

    expect(evidence.diagnostics).toEqual(expectedDiagnostics(scenario))
    expect(evidence.state.hits).toHaveLength(scenario.expect.finalState?.hitCount ?? 0)
    expect(evidence.state.isLocked).toBe(scenario.expect.finalState?.isLocked ?? false)
  })

  it("keeps version 1.0 scenarios valid while containing diagnostics to sabre version 1.1", () => {
    const versionOne = readScenario("sabre-external-100-ohm-host-boundary.json")
    expect(versionOne.schemaVersion).toBe("1.0.0")

    const diagnostic = readScenario("sabre-yellow-onset-clear.json")
    const oldVersionWithDiagnostics = structuredClone(diagnostic)
    oldVersionWithDiagnostics.schemaVersion = "1.0.0"
    expect(validateScenario(oldVersionWithDiagnostics)).toBe(false)

    const wrongWeapon = structuredClone(diagnostic)
    wrongWeapon.weapon = "foil"
    expect(validateScenario(wrongWeapon)).toBe(false)

    const missingDiagnostics = structuredClone(diagnostic)
    delete missingDiagnostics.expect.diagnostics
    expect(validateScenario(missingDiagnostics)).toBe(false)
  })

  it("uses the supplied 100-ohm host measurement without claiming acquisition", () => {
    const scenario = readScenario("sabre-external-100-ohm-host-boundary.json")
    const evidence = runSabreScenarioEvidence(scenario.inputs)

    expect(evidence.state.hits).toEqual([{ qualifiedAtUs: 100, side: "left", startedAtUs: 0 }])
    expect(evidence.state.right.observationStatus).toBe("external-path-ineligible")
    expect(evidence.diagnostics).toEqual([])
  })

  it("projects every sabre logical line state independently", () => {
    expect(projectSabreScenarioInput(input([])).left).toEqual({
      bladeContact: "absent",
      circuitBCFault: "normal",
      externalPathEligibility: "eligible",
      ownEquipmentFault: "absent",
      targetContact: "indeterminate"
    })

    expect(projectSabreScenarioInput(input([line("blade", "closed")])).left.bladeContact).toBe("present")
    expect(projectSabreScenarioInput(input([line("blade", "open")])).left.bladeContact).toBe("absent")
    expect(projectSabreScenarioInput(input([line("blade", "disconnected")])).left.bladeContact).toBe("unavailable")
    expect(projectSabreScenarioInput(input([line("blade", "indeterminate")])).left.bladeContact).toBe("indeterminate")

    expect(projectSabreScenarioInput(input([line("target", "closed")])).left.targetContact).toBe("target")
    expect(projectSabreScenarioInput(input([line("target", "grounded")])).left.targetContact).toBe(
      "nonConductiveSurface"
    )
    expect(projectSabreScenarioInput(input([line("target", "disconnected")])).left.targetContact).toBe("unavailable")
    expect(projectSabreScenarioInput(input([line("target", "open")])).left.targetContact).toBe("indeterminate")

    expect(projectSabreScenarioInput(input([line("external", "open")])).left.externalPathEligibility).toBe("eligible")
    expect(projectSabreScenarioInput(input([line("external", "closed")])).left.externalPathEligibility).toBe(
      "unavailable"
    )
    expect(projectSabreScenarioInput(input([line("external", "disconnected")])).left.externalPathEligibility).toBe(
      "unavailable"
    )
    expect(projectSabreScenarioInput(input([line("external", "indeterminate")])).left.externalPathEligibility).toBe(
      "indeterminate"
    )
    expect(
      projectSabreScenarioInput(input([line("external", "closed", 100_000, 0)])).left.externalPathEligibility
    ).toBe("eligible")
    expect(
      projectSabreScenarioInput(input([line("external", "disconnected", 100_000, 0)])).left.externalPathEligibility
    ).toBe("unavailable")
    expect(
      projectSabreScenarioInput(input([line("external", "indeterminate", 100_000, 0)])).left.externalPathEligibility
    ).toBe("indeterminate")
    expect(projectSabreScenarioInput(input([line("external", "open", 100_000, 0)])).left.externalPathEligibility).toBe(
      "indeterminate"
    )
    expect(
      projectSabreScenarioInput(input([line("external", "grounded", 100_000, 0)])).left.externalPathEligibility
    ).toBe("indeterminate")
    expect(() => projectSabreScenarioInput(input([line("external", "closed", 100_000, null)]))).toThrow(
      "both be present or both be null"
    )

    expect(projectSabreScenarioInput(input([line("fault", "closed")])).left.ownEquipmentFault).toBe("present")
    expect(projectSabreScenarioInput(input([line("fault", "open")])).left.ownEquipmentFault).toBe("absent")
    expect(projectSabreScenarioInput(input([line("fault", "disconnected")])).left.ownEquipmentFault).toBe("unavailable")
    expect(projectSabreScenarioInput(input([line("fault", "indeterminate")])).left.ownEquipmentFault).toBe(
      "indeterminate"
    )

    expect(projectSabreScenarioInput(input([line("control", "closed")])).left.circuitBCFault).toBe("controlBreak")
    expect(projectSabreScenarioInput(input([line("control", "shorted")])).left.circuitBCFault).toBe("abnormalChange")
    expect(projectSabreScenarioInput(input([line("control", "open")])).left.circuitBCFault).toBe("normal")
    expect(projectSabreScenarioInput(input([line("control", "disconnected")])).left.circuitBCFault).toBe("unavailable")
    expect(projectSabreScenarioInput(input([line("control", "indeterminate")])).left.circuitBCFault).toBe(
      "indeterminate"
    )
  })

  it("canonicalizes simultaneous diagnostic evidence while retaining source inputs", () => {
    const evidence = runSabreScenarioEvidence([
      {
        atUs: 0,
        id: "simultaneous",
        lines: [
          { ...line("fault", "closed"), line: "left.fault" },
          { ...line("control", "shorted"), line: "left.control" },
          { ...line("fault", "closed"), line: "right.fault" },
          { ...line("control", "shorted"), line: "right.control" }
        ]
      }
    ])

    expect(
      evidence.diagnostics.map(({ indication, side, sourceInputIds }) => ({ indication, side, sourceInputIds }))
    ).toEqual([
      { indication: "yellow-on", side: "left", sourceInputIds: ["simultaneous"] },
      { indication: "white-on", side: "left", sourceInputIds: ["simultaneous"] },
      { indication: "yellow-on", side: "right", sourceInputIds: ["simultaneous"] },
      { indication: "white-on", side: "right", sourceInputIds: ["simultaneous"] }
    ])
  })

  it("rejects diagnostic field combinations outside the four host semantic tuples", () => {
    const scenario = readScenario("sabre-yellow-onset-clear.json")
    const invalidTuple = structuredClone(scenario)
    const first = invalidTuple.expect.diagnostics?.[0]
    if (first === undefined) throw new Error("Expected a diagnostic fixture")
    first.audible = "requested"

    expect(validateScenario(invalidTuple)).toBe(false)
  })

  it("bounds diagnostics and their source provenance in schema version 1.1", () => {
    const scenario = readScenario("sabre-yellow-onset-clear.json")
    const tooManyDiagnostics = structuredClone(scenario)
    const template = tooManyDiagnostics.expect.diagnostics?.[0]
    if (template === undefined) throw new Error("Expected a diagnostic fixture")
    tooManyDiagnostics.expect.diagnostics = Array.from({ length: 4_097 }, (_, index) => ({
      ...template,
      id: `diagnostic-${index}`
    }))
    expect(validateScenario(tooManyDiagnostics)).toBe(false)

    const tooManySources = structuredClone(scenario)
    const first = tooManySources.expect.diagnostics?.[0]
    if (first === undefined) throw new Error("Expected a diagnostic fixture")
    first.sourceInputIds = ["one", "two", "three"]
    expect(validateScenario(tooManySources)).toBe(false)

    const duplicateSources = structuredClone(scenario)
    const duplicateFirst = duplicateSources.expect.diagnostics?.[0]
    if (duplicateFirst === undefined) throw new Error("Expected a diagnostic fixture")
    duplicateFirst.sourceInputIds = ["same", "same"]
    expect(validateScenario(duplicateSources)).toBe(false)
  })
})
