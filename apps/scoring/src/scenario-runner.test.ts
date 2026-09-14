import { createHash } from "node:crypto"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { afterEach, describe, expect, it, vi } from "vitest"
import * as sabreEvidence from "./sabre-scenario-evidence.js"
import {
  MAX_COVERAGE_SCENARIO_IDS,
  MAX_EXPECTED_DECISIONS,
  MAX_EXPECTED_CLASSIFICATIONS,
  MAX_EXPECTED_NON_EVENTS,
  MAX_EXPECTED_UNCERTAINTIES,
  MAX_EXPECTED_DIAGNOSTICS,
  MAX_DIAGNOSTIC_SOURCE_INPUT_IDS,
  MAX_INPUT_FILE_BYTES,
  MAX_LINE_NAMES,
  MAX_LINES_PER_INPUT,
  MAX_MANIFEST_COVERAGE_ENTRIES,
  MAX_MANIFEST_ENTRIES,
  MAX_SCENARIO_INPUTS,
  MAX_SOURCE_IDS_PER_ENTRY,
  MAX_SOURCE_RECORDS,
  projectFoilScenarioInput,
  projectSabreScenarioInput,
  runScenario,
  serializeScenarioRunReport,
  type ScenarioRunReport
} from "./scenario-runner.js"

const fixtureDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "../docs/golden-scenarios")
const temporaryDirectories: string[] = []

function readFixture(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(fixtureDirectory, name), "utf8")) as Record<string, unknown>
}

function temporaryDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), "scoring-scenario-runner-"))
  temporaryDirectories.push(directory)
  return directory
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8")
}

function contentDigest(value: unknown): string {
  return `sha256:${createHash("sha256")
    .update(`${JSON.stringify(value, null, 2)}\n`)
    .digest("hex")}`
}

function reportBytes(report: ScenarioRunReport): string {
  return serializeScenarioRunReport(report)
}

function invalidMutations(value: unknown): unknown[] {
  const mutations: unknown[] = []
  if (Array.isArray(value)) {
    mutations.push({})
    value.forEach((child, index) => {
      for (const mutation of invalidMutations(child)) {
        const copy = structuredClone(value)
        copy[index] = mutation
        mutations.push(copy)
      }
    })
  } else if (value !== null && typeof value === "object") {
    mutations.push(null)
    for (const [key, child] of Object.entries(value)) {
      for (const mutation of invalidMutations(child)) {
        const copy = structuredClone(value) as Record<string, unknown>
        copy[key] = mutation
        mutations.push(copy)
      }
    }
  } else if (typeof value === "string") {
    mutations.push({})
  } else if (typeof value === "number") {
    mutations.push("not a number")
  } else if (typeof value === "boolean") {
    mutations.push("not a boolean")
  } else {
    mutations.push([])
  }
  return mutations
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { force: true, recursive: true })
})

describe("golden scenario runner", () => {
  it("projects a shorted foil weapon circuit as a weapon fault", () => {
    const projection = projectFoilScenarioInput({
      atUs: 7,
      id: "shorted-weapon-circuit",
      lines: [
        {
          line: "left.weapon-circuit",
          resistanceMilliOhms: null,
          resistanceUncertaintyMilliOhms: null,
          state: "shorted"
        },
        {
          line: "left.target",
          resistanceMilliOhms: null,
          resistanceUncertaintyMilliOhms: null,
          state: "closed"
        }
      ]
    })

    expect(projection.left).toMatchObject({ circuitBreak: "closed", integrity: "weaponFault" })
  })

  it.each([
    ["open", "absent"],
    ["closed", "present"],
    ["disconnected", "unavailable"],
    ["indeterminate", "indeterminate"]
  ] as const)("projects a %s sabre blade independently as %s", (state, expected) => {
    const projection = projectSabreScenarioInput({
      atUs: 7,
      id: `sabre-blade-${state}`,
      lines: [
        {
          line: "left.blade",
          resistanceMilliOhms: null,
          resistanceUncertaintyMilliOhms: null,
          state
        },
        {
          line: "left.target",
          resistanceMilliOhms: null,
          resistanceUncertaintyMilliOhms: null,
          state: "closed"
        }
      ]
    })

    expect(projection.left).toMatchObject({ bladeContact: expected, targetContact: "target" })
  })

  it("executes a valid scenario with the selected scorer", () => {
    const directory = temporaryDirectory()
    const path = join(directory, "contact.json")
    writeJson(path, readFixture("epee-contact-boundaries.json"))

    const run = runScenario(path)

    expect(run.exitCode).toBe(0)
    expect(run.report.status).toBe("passed")
    expect(run.report.scenarios[0]).toMatchObject({ scenarioId: "epee.contact-boundaries", status: "passed" })
  })

  it.each([
    "foil-break-boundaries.json",
    "foil-grounded-contact.json",
    "foil-insulation-handoff.json",
    "foil-integrity-and-uncertainty.json",
    "foil-lockout-cutoff.json",
    "foil-nominal-break.json",
    "foil-same-side-and-lockout.json",
    "foil-target-context.json"
  ])("executes the foil scenario %s with its declared rule revision", (fixtureName) => {
    const directory = temporaryDirectory()
    const path = join(directory, fixtureName)
    const scenario = readFixture(fixtureName)
    writeJson(path, scenario)

    const run = runScenario(path)

    expect(run.exitCode).toBe(0)
    expect(run.report.scenarios[0]).toMatchObject({ scenarioId: scenario.scenarioId, status: "passed" })
  })

  it.each(["foil-host-logical-contexts.json", "foil-host-resistance-classifications.json"])(
    "derives every foil host classification from the listed inputs in %s",
    (fixtureName) => {
      const directory = temporaryDirectory()
      const path = join(directory, fixtureName)
      const scenario = readFixture(fixtureName)
      writeJson(path, scenario)

      const run = runScenario(path)
      const inputs = scenario.inputs as { atUs: number; id: string }[]
      const actual = run.report.scenarios[0]?.classifications

      expect(run.exitCode).toBe(0)
      expect(actual).toHaveLength(((scenario.expect as Record<string, unknown>).classifications as unknown[]).length)
      expect(actual?.map(({ atUs, sourceInputId }) => ({ atUs, sourceInputId }))).toEqual(
        inputs.map(({ atUs, id }) => ({ atUs, sourceInputId: id }))
      )
    }
  )

  it("reports one stable mismatch when a foil classification expectation differs from input-derived output", () => {
    const directory = temporaryDirectory()
    const path = join(directory, "foil-classification-mismatch.json")
    const scenario = readFixture("foil-host-resistance-classifications.json")
    const expectation = scenario.expect as Record<string, unknown>
    const classifications = expectation.classifications as Record<string, unknown>[]
    writeJson(path, {
      ...scenario,
      expect: {
        ...expectation,
        classifications: classifications.map((classification, index) =>
          index === 0
            ? {
                ...classification,
                disposition: "outside-published-range",
                permittedIndications: []
              }
            : classification
        )
      }
    })

    expect(runScenario(path)).toMatchObject({
      exitCode: 1,
      report: { scenarios: [{ mismatches: [{ kind: "classification", message: "classification output differs" }] }] }
    })
  })

  it.each([
    "sabre-control-break-diagnostic-boundaries.json",
    "sabre-white-abnormal-change-latch.json",
    "sabre-yellow-onset-clear.json"
  ])("derives and emits the declared Sabre diagnostics for %s", (fixtureName) => {
    const directory = temporaryDirectory()
    const path = join(directory, fixtureName)
    const scenario = readFixture(fixtureName)
    writeJson(path, scenario)

    const run = runScenario(path)
    const expected = ((scenario.expect as Record<string, unknown>).diagnostics as Record<string, unknown>[]).map(
      ({ id: _id, ...diagnostic }) => diagnostic
    )

    expect(run.exitCode).toBe(0)
    expect(run.report.scenarios[0]?.diagnostics).toEqual(expected)
    expect(run.report.scenarios[0]?.classifications).toBeUndefined()
  })

  it("keeps Sabre evidence absent from version 1.0 reports", () => {
    const run = runScenario(join(fixtureDirectory, "sabre-external-100-ohm-host-boundary.json"))

    expect(run.exitCode).toBe(0)
    expect(run.report.scenarios[0]?.diagnostics).toBeUndefined()
  })

  it.each([
    ["rule revision", { ruleRevision: "fie-2026-epee" }],
    ["line model revision", { lineModel: { revision: "m0-07", names: ["left.fault", "right.fault"] } }]
  ])("rejects a Sabre 1.1 scenario with the wrong %s", (_field, replacement) => {
    const directory = temporaryDirectory()
    const path = join(directory, "invalid-sabre-evidence-contract.json")
    writeJson(path, { ...readFixture("sabre-yellow-onset-clear.json"), ...replacement })

    expect(runScenario(path)).toMatchObject({
      exitCode: 2,
      report: { error: { code: "invalid-schema" }, status: "invalid-input" }
    })
  })

  it("rejects invalid foil classification provenance, ranges, bounds, and state pairings", () => {
    const directory = temporaryDirectory()
    const scenario = readFixture("foil-host-resistance-classifications.json")
    const expectation = scenario.expect as Record<string, unknown>
    const classifications = expectation.classifications as Record<string, unknown>[]
    const inputs = scenario.inputs as Record<string, unknown>[]
    const secondKindInput = inputs[5]
    if (secondKindInput === undefined) throw new Error("foil resistance fixture is incomplete")
    const cases = [
      {
        ...scenario,
        expect: {
          ...expectation,
          classifications: classifications.map((value, index) =>
            index === 0 ? { ...value, sourceInputId: "exterior-two-hundred" } : value
          )
        }
      },
      {
        ...scenario,
        expect: {
          ...expectation,
          classifications: classifications.map((value, index) =>
            index === 0 ? { ...value, rangeMilliOhms: { min: 1, max: 0 } } : value
          )
        }
      },
      {
        ...scenario,
        expect: {
          ...expectation,
          classifications: Array.from({ length: MAX_EXPECTED_CLASSIFICATIONS + 1 }, () => classifications[0])
        }
      },
      { ...scenario, inputs: inputs.map((value, index) => (index === 0 ? { ...value, atUs: 12_999 } : value)) },
      {
        ...scenario,
        inputs: inputs.map((value, index) =>
          index === 0
            ? { ...value, lines: [{ ...(value.lines as Record<string, unknown>[])[0], state: "closed" }] }
            : value
        )
      },
      {
        ...scenario,
        inputs: inputs.map((value, index) =>
          index === 0
            ? {
                ...value,
                lines: [
                  ...(value.lines as Record<string, unknown>[]),
                  { ...((secondKindInput.lines as Record<string, unknown>[])[0] as Record<string, unknown>) }
                ]
              }
            : value
        )
      },
      {
        ...scenario,
        inputs: inputs.map((value, index) =>
          index === 0
            ? { ...value, lines: [{ ...(value.lines as Record<string, unknown>[])[0], line: "left.undeclared" }] }
            : value
        )
      },
      {
        ...scenario,
        inputs: inputs.map((value, index) =>
          index === 5
            ? { ...value, lines: [{ ...(value.lines as Record<string, unknown>[])[0], state: "open" }] }
            : value
        )
      },
      {
        ...scenario,
        inputs: inputs.map((value, index) =>
          index === 7
            ? { ...value, lines: [{ ...(value.lines as Record<string, unknown>[])[0], state: "closed" }] }
            : value
        )
      },
      { ...scenario, ruleRevision: "fie-2026-sabre" },
      {
        ...scenario,
        lineModel: { ...(scenario.lineModel as Record<string, unknown>), revision: "foil-logical-lines-1" }
      }
    ]

    for (const [index, value] of cases.entries()) {
      const path = join(directory, `invalid-classification-${index}.json`)
      writeJson(path, value)
      expect(runScenario(path).exitCode).toBe(2)
    }

    const logicalScenario = readFixture("foil-host-logical-contexts.json")
    const logicalInputs = logicalScenario.inputs as Record<string, unknown>[]
    const logicalCases = [
      {
        ...logicalScenario,
        inputs: logicalInputs.map((value, index) =>
          index === 0
            ? { ...value, lines: [{ ...(value.lines as Record<string, unknown>[])[0], state: "closed" }] }
            : value
        )
      },
      {
        ...logicalScenario,
        inputs: logicalInputs.map((value, index) =>
          index === 0
            ? {
                ...value,
                lines: [
                  {
                    ...(value.lines as Record<string, unknown>[])[0],
                    resistanceMilliOhms: 0,
                    resistanceUncertaintyMilliOhms: 0
                  }
                ]
              }
            : value
        )
      }
    ]
    for (const [index, value] of logicalCases.entries()) {
      const path = join(directory, `invalid-logical-classification-${index}.json`)
      writeJson(path, value)
      expect(runScenario(path).exitCode).toBe(2)
    }
  })

  it.each([
    "sabre-contact-floor-boundaries.json",
    "sabre-external-path-containment.json",
    "sabre-lockout-boundary.json",
    "sabre-lockout-cutoff.json",
    "sabre-own-equipment-hit-continuity.json",
    "sabre-whipover-boundaries-and-recovery.json"
  ])("executes the sabre scenario %s with its declared rule revision", (fixtureName) => {
    const directory = temporaryDirectory()
    const path = join(directory, fixtureName)
    const scenario = readFixture(fixtureName)
    writeJson(path, scenario)

    const run = runScenario(path)

    expect(run.exitCode).toBe(0)
    expect(run.report.scenarios[0]).toMatchObject({ scenarioId: scenario.scenarioId, status: "passed" })
  })

  it("returns exit code one and a stable mismatch when output differs", () => {
    const directory = temporaryDirectory()
    const path = join(directory, "mismatch.json")
    const scenario = readFixture("epee-contact-boundaries.json")
    const expectation = scenario.expect as Record<string, unknown>
    writeJson(path, { ...scenario, expect: { ...expectation, decisions: [] } })

    const run = runScenario(path)

    expect(run.exitCode).toBe(1)
    expect(run.report.status).toBe("failed")
    expect(run.report.scenarios[0]?.mismatches).toEqual([{ kind: "decision", message: "decision output differs" }])
  })

  it.each([
    ["signal", { visual: "none", audible: "requested", latched: true }],
    ["sourceInputIds", ["left-short-start"]]
  ])("fails when declared %s evidence differs", (field, value) => {
    const directory = temporaryDirectory()
    const path = join(directory, `wrong-${field}.json`)
    const scenario = readFixture("epee-contact-boundaries.json")
    const expectation = scenario.expect as Record<string, unknown>
    const decisions = [...(expectation.decisions as Record<string, unknown>[])]
    decisions[0] = { ...decisions[0], [field]: value }
    writeJson(path, { ...scenario, expect: { ...expectation, decisions } })

    const run = runScenario(path)

    expect(run.exitCode).toBe(1)
    expect(run.report.scenarios[0]?.mismatches).toEqual([{ kind: "decision", message: "decision output differs" }])
  })

  it.each([
    [
      "qualified-hit",
      {
        decisionAtUs: 2000,
        disposition: "qualified-hit",
        weapon: "epee",
        side: "right",
        hitStartedAtUs: 0,
        qualifiedAtUs: 2000,
        signal: { visual: "valid-hit", audible: "requested", latched: true }
      }
    ],
    [
      "off-target",
      {
        decisionAtUs: 2000,
        disposition: "off-target",
        weapon: "foil",
        side: "right",
        qualifiedAtUs: 2000,
        signal: { visual: "off-target", audible: "requested", latched: true }
      }
    ],
    [
      "rejected-contact",
      {
        decisionAtUs: 1,
        disposition: "rejected-contact",
        weapon: "epee",
        attemptedSide: "right",
        attemptedAtUs: 1,
        reason: "contact-below-minimum-duration",
        signal: { visual: "none", audible: "none", latched: false }
      }
    ],
    [
      "line-fault",
      {
        decisionAtUs: 1,
        disposition: "line-fault",
        lineId: "right.weapon-circuit",
        diagnostic: "open-circuit",
        detectedAtUs: 1,
        persistence: "transient",
        side: null,
        signal: { visual: "diagnostic", audible: "none", latched: false }
      }
    ],
    [
      "reset",
      {
        decisionAtUs: 1,
        disposition: "reset",
        cause: "watchdog",
        resetAtUs: 1,
        scope: "stm32",
        signal: { visual: "diagnostic", audible: "none", latched: false }
      }
    ],
    [
      "uncertainty",
      {
        decisionAtUs: 1,
        disposition: "uncertainty",
        effect: "diagnostic-only",
        lowerBound: 0,
        observedAtUs: 1,
        subject: "timing",
        unit: "us",
        upperBound: 2,
        signal: { visual: "diagnostic", audible: "none", latched: false }
      }
    ],
    [
      "calibration",
      {
        decisionAtUs: 1,
        disposition: "calibration",
        calibrationId: "cal-1",
        performedAtUs: 1,
        status: "passed",
        signal: { visual: "diagnostic", audible: "none", latched: false }
      }
    ]
  ])("strictly parses supported %s decisions", (_name, decision) => {
    const directory = temporaryDirectory()
    const path = join(directory, "decision.json")
    const fixture = readFixture("epee-contact-boundaries.json")
    const expectation = fixture.expect as Record<string, unknown>
    writeJson(path, {
      ...fixture,
      expect: { ...expectation, decisions: [{ id: "declared", sourceInputIds: ["right-start"], ...decision }] }
    })

    expect(runScenario(path).exitCode).toBe(1)
  })

  it.each([
    ["line-fault", { disposition: "line-fault", decisionAtUs: 1, sourceInputIds: ["right-start"] }],
    ["reset", { disposition: "reset", decisionAtUs: 1, sourceInputIds: ["right-start"] }],
    ["uncertainty", { disposition: "uncertainty", decisionAtUs: 1, sourceInputIds: ["right-start"] }],
    ["calibration", { disposition: "calibration", decisionAtUs: 1, sourceInputIds: ["right-start"] }]
  ])("rejects incomplete %s decisions", (_name, decision) => {
    const directory = temporaryDirectory()
    const path = join(directory, "invalid-decision.json")
    const fixture = readFixture("epee-contact-boundaries.json")
    const expectation = fixture.expect as Record<string, unknown>
    writeJson(path, { ...fixture, expect: { ...expectation, decisions: [{ id: "invalid", ...decision }] } })

    expect(runScenario(path)).toMatchObject({ exitCode: 2, report: { error: { code: "invalid-schema" } } })
  })

  it("returns exit code two for invalid schema and invalid paths", () => {
    const directory = temporaryDirectory()
    const invalidPath = join(directory, "invalid.json")
    const fixture = readFixture("epee-contact-boundaries.json")
    writeJson(invalidPath, { ...fixture, unexpected: true })

    const invalidSchema = runScenario(invalidPath)
    const missing = runScenario(join(directory, "missing.json"))

    expect(invalidSchema.exitCode).toBe(2)
    expect(invalidSchema.report).toMatchObject({ status: "invalid-input", error: { code: "invalid-schema" } })
    expect(missing.exitCode).toBe(2)
    expect(missing.report).toMatchObject({ status: "invalid-input", error: { code: "path-not-found" } })
  })

  it("rejects an unsafe microsecond timestamp with a stable input error", () => {
    const directory = temporaryDirectory()
    const path = join(directory, "unsafe-timestamp.json")
    const fixture = readFixture("epee-contact-boundaries.json")
    const inputs = fixture.inputs as Record<string, unknown>[]
    writeJson(path, {
      ...fixture,
      inputs: [{ ...inputs[0], atUs: Number.MAX_SAFE_INTEGER + 1 }, ...inputs.slice(1)]
    })

    expect(runScenario(path)).toMatchObject({
      exitCode: 2,
      report: { error: { code: "timestamp-out-of-range" }, status: "invalid-input" }
    })
  })

  it.each([
    ["top-level array", () => []],
    ["bad scenario id", (x: Record<string, unknown>) => ({ ...x, scenarioId: "" })],
    ["bad weapon", (x: Record<string, unknown>) => ({ ...x, weapon: "axe" })],
    ["bad rule revision", (x: Record<string, unknown>) => ({ ...x, ruleRevision: "" })],
    ["bad line names", (x: Record<string, unknown>) => ({ ...x, lineModel: { names: [1] } })],
    ["bad source", (x: Record<string, unknown>) => ({ ...x, sources: [{ authority: "other" }] })],
    [
      "bad input id",
      (x: Record<string, unknown>) => ({ ...x, inputs: [{ ...(x.inputs as Record<string, unknown>[])[0], id: "" }] })
    ],
    [
      "bad input time",
      (x: Record<string, unknown>) => ({ ...x, inputs: [{ ...(x.inputs as Record<string, unknown>[])[0], atUs: -1 }] })
    ],
    [
      "bad line state",
      (x: Record<string, unknown>) => ({
        ...x,
        inputs: [
          {
            ...(x.inputs as Record<string, unknown>[])[0],
            lines: [
              {
                line: "left.weapon-circuit",
                state: "bad",
                resistanceMilliOhms: null,
                resistanceUncertaintyMilliOhms: null
              }
            ]
          }
        ]
      })
    ],
    [
      "bad expectation status",
      (x: Record<string, unknown>) => ({ ...x, expect: { ...(x.expect as Record<string, unknown>), status: "maybe" } })
    ],
    [
      "bad decision disposition",
      (x: Record<string, unknown>) => ({
        ...x,
        expect: {
          ...(x.expect as Record<string, unknown>),
          decisions: [{ id: "x", decisionAtUs: 1, disposition: "other", sourceInputIds: [] }]
        }
      })
    ],
    [
      "bad non-event window",
      (x: Record<string, unknown>) => ({
        ...x,
        expect: {
          ...(x.expect as Record<string, unknown>),
          nonEvents: [
            {
              ...((x.expect as Record<string, unknown>).nonEvents as Record<string, unknown>[])[0],
              window: { fromUs: 9, throughUs: 1 }
            }
          ]
        }
      })
    ],
    [
      "bad uncertainty range",
      (x: Record<string, unknown>) => ({
        ...x,
        expect: {
          ...(x.expect as Record<string, unknown>),
          uncertainty: [
            {
              ...((x.expect as Record<string, unknown>).uncertainty as Record<string, unknown>[])[0],
              rangeMilliOhms: { min: 9, max: 1 }
            }
          ]
        }
      })
    ]
  ])("returns invalid-schema for %s", (_name, mutate) => {
    const directory = temporaryDirectory()
    const path = join(directory, "invalid-field.json")
    const fixture = readFixture("epee-contact-boundaries.json")
    writeJson(path, mutate(fixture))
    expect(runScenario(path)).toMatchObject({ exitCode: 2, report: { error: { code: "invalid-schema" } } })
  })

  // Each replacement has an incompatible JSON type, unlike empty containers or
  // arbitrary strings which can still be valid contract values.
  it.each(
    invalidMutations(readFixture("epee-contact-boundaries.json")).map((mutation, index) => ({ mutation, index }))
  )("rejects incompatible JSON type mutation $index", ({ mutation }) => {
    const path = join(temporaryDirectory(), "mutation.json")
    writeJson(path, mutation)
    expect(runScenario(path)).toMatchObject({
      exitCode: 2,
      report: { status: "invalid-input", error: { code: "invalid-schema" } }
    })
  })

  it("reports unexpected manifest execution failures separately from missing input paths", () => {
    const directory = temporaryDirectory()
    const manifestPath = join(directory, "manifest.json")
    writeJson(manifestPath, {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      format: "scoring-golden-corpus",
      schemaVersion: "1.1.0",
      corpusId: "scoring-golden-corpus",
      scenarioSchema: "golden-scenario.schema.json",
      ordering: "scenarioId-ascending",
      scenarios: [],
      coverage: []
    })

    const run = runScenario(manifestPath)

    expect(run.exitCode).toBe(2)
    expect(run.report).toMatchObject({ status: "invalid-input", error: { code: "execution-error" } })
  })

  it("rejects incomplete later decision dispositions and over-limit documents", () => {
    const directory = temporaryDirectory()
    const invalidDecisionPath = join(directory, "invalid-decision.json")
    const fixture = readFixture("epee-contact-boundaries.json")
    const expectation = fixture.expect as Record<string, unknown>
    writeJson(invalidDecisionPath, {
      ...fixture,
      expect: {
        ...expectation,
        decisions: [
          {
            id: "line-fault",
            decisionAtUs: 1,
            disposition: "line-fault",
            sourceInputIds: ["right-start"]
          }
        ]
      }
    })
    const overLimitPath = join(directory, "over-limit.json")
    const baseDecision = (expectation.decisions as Record<string, unknown>[])[0]
    writeJson(overLimitPath, {
      ...fixture,
      expect: {
        ...expectation,
        decisions: Array.from({ length: MAX_EXPECTED_DECISIONS + 1 }, (_, index) => ({
          ...baseDecision,
          id: `decision-${index}`
        }))
      }
    })
    const tooLargePath = join(directory, "too-large.json")
    writeFileSync(tooLargePath, "x".repeat(MAX_INPUT_FILE_BYTES + 1), "utf8")

    expect(runScenario(invalidDecisionPath)).toMatchObject({
      exitCode: 2,
      report: { error: { code: "invalid-schema" } }
    })
    expect(runScenario(overLimitPath)).toMatchObject({ exitCode: 2, report: { error: { code: "invalid-schema" } } })
    expect(runScenario(tooLargePath)).toMatchObject({ exitCode: 2, report: { error: { code: "input-too-large" } } })
  })

  it("rejects malformed JSON and manifest path escapes", () => {
    const directory = temporaryDirectory()
    const malformed = join(directory, "malformed.json")
    writeFileSync(malformed, "{", "utf8")
    const escaping = join(directory, "escape-manifest.json")
    writeJson(escaping, {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      format: "scoring-golden-corpus",
      schemaVersion: "1.1.0",
      corpusId: "scoring-golden-corpus",
      scenarioSchema: "golden-scenario.schema.json",
      ordering: "scenarioId-ascending",
      scenarios: [
        {
          scenarioId: "escape",
          path: "golden-scenarios/../outside.json",
          weapon: "epee",
          status: "active",
          sourceIds: [],
          contentDigest: "sha256:0000000000000000000000000000000000000000000000000000000000000000"
        }
      ],
      coverage: []
    })
    expect(runScenario(malformed)).toMatchObject({ exitCode: 2, report: { error: { code: "invalid-json" } } })
    expect(runScenario(escaping)).toMatchObject({ exitCode: 2, report: { error: { code: "invalid-schema" } } })
  })

  it("skips planned manifest entries and checks manifest metadata", () => {
    const directory = temporaryDirectory()
    const golden = join(directory, "golden-scenarios")
    mkdirSync(golden)
    const manifest = join(directory, "planned.json")
    const base = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      format: "scoring-golden-corpus",
      schemaVersion: "1.1.0",
      corpusId: "scoring-golden-corpus",
      scenarioSchema: "golden-scenario.schema.json",
      ordering: "scenarioId-ascending",
      coverage: []
    }
    writeJson(manifest, {
      ...base,
      scenarios: [
        {
          scenarioId: "planned",
          path: "golden-scenarios/planned.json",
          weapon: "epee",
          status: "planned",
          sourceIds: [],
          contentDigest: null
        }
      ]
    })
    expect(runScenario(manifest)).toMatchObject({ exitCode: 0, report: { summary: { scenarioCount: 0 } } })
    const mismatch = join(directory, "mismatch-manifest.json")
    const scenario = readFixture("epee-contact-boundaries.json")
    writeJson(join(golden, "contact.json"), scenario)
    writeJson(mismatch, {
      ...base,
      scenarios: [
        {
          scenarioId: "epee.contact-boundaries",
          path: "golden-scenarios/contact.json",
          weapon: "foil",
          status: "active",
          sourceIds: [],
          contentDigest: contentDigest(scenario)
        }
      ]
    })
    expect(runScenario(mismatch)).toMatchObject({ exitCode: 2, report: { error: { code: "manifest-path" } } })
  })

  it.each([
    [
      "sources",
      MAX_SOURCE_RECORDS,
      (fixture: Record<string, unknown>, n: number) => ({
        ...fixture,
        sources: Array.from({ length: n }, (_, i) => ({
          authority: "fixture",
          id: `SRC-${i}`,
          document: "doc",
          page: null,
          locator: "loc"
        }))
      })
    ],
    [
      "line names",
      MAX_LINE_NAMES,
      (fixture: Record<string, unknown>, n: number) => ({
        ...fixture,
        lineModel: { names: Array.from({ length: n }, (_, i) => `line-${i}`) }
      })
    ],
    [
      "inputs",
      MAX_SCENARIO_INPUTS,
      (fixture: Record<string, unknown>, n: number) => ({
        ...fixture,
        inputs: Array.from({ length: n }, (_, i) => ({
          ...(fixture.inputs as Record<string, unknown>[])[0],
          id: `input-${i}`
        }))
      })
    ],
    [
      "lines",
      MAX_LINES_PER_INPUT,
      (fixture: Record<string, unknown>, n: number) => ({
        ...fixture,
        inputs: [
          {
            ...(fixture.inputs as Record<string, unknown>[])[0],
            lines: Array.from({ length: n }, (_, i) => ({
              line: `line-${i}`,
              state: "open",
              resistanceMilliOhms: null,
              resistanceUncertaintyMilliOhms: null
            }))
          }
        ]
      })
    ],
    [
      "decisions",
      MAX_EXPECTED_DECISIONS,
      (fixture: Record<string, unknown>, n: number) => ({
        ...fixture,
        expect: {
          ...(fixture.expect as Record<string, unknown>),
          decisions: Array.from({ length: n }, (_, i) => ({
            id: `decision-${i}`,
            decisionAtUs: i,
            disposition: "qualified-hit",
            weapon: "epee",
            side: "left",
            hitStartedAtUs: i,
            qualifiedAtUs: i,
            signal: { visual: "valid-hit", audible: "requested", latched: true },
            sourceInputIds: []
          }))
        }
      })
    ],
    [
      "non-events",
      MAX_EXPECTED_NON_EVENTS,
      (fixture: Record<string, unknown>, n: number) => ({
        ...fixture,
        expect: {
          ...(fixture.expect as Record<string, unknown>),
          nonEvents: Array.from({ length: n }, (_, i) => ({
            id: `event-${i}`,
            window: { fromUs: 0, throughUs: 1 },
            assertion: "no-decision",
            side: "left",
            assertionReasonCode: "bounded-test"
          }))
        }
      })
    ],
    [
      "uncertainties",
      MAX_EXPECTED_UNCERTAINTIES,
      (fixture: Record<string, unknown>, n: number) => ({
        ...fixture,
        expect: {
          ...(fixture.expect as Record<string, unknown>),
          uncertainty: Array.from({ length: n }, (_, i) => ({
            id: `uncertainty-${i}`,
            atUs: 1,
            scope: "left.tip-loop",
            outcome: "indeterminate",
            assertionReasonCode: "bounded-test"
          }))
        }
      })
    ]
  ])("enforces the %s bound", (_name, limit, mutate) => {
    const directory = temporaryDirectory()
    const path = join(directory, "bound.json")
    writeJson(path, mutate(readFixture("epee-contact-boundaries.json"), limit + 1))
    expect(runScenario(path)).toMatchObject({ exitCode: 2, report: { error: { code: "invalid-schema" } } })
  })

  it.each([
    ["manifest entries", MAX_MANIFEST_ENTRIES, "scenarios"],
    ["manifest coverage", MAX_MANIFEST_COVERAGE_ENTRIES, "coverage"],
    ["coverage scenario ids", MAX_COVERAGE_SCENARIO_IDS, "coverageIds"],
    ["manifest source ids", MAX_SOURCE_IDS_PER_ENTRY, "sourceIds"]
  ])("enforces the %s bound", (_name, limit, kind) => {
    const directory = temporaryDirectory()
    const path = join(directory, "manifest.json")
    const base = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      format: "scoring-golden-corpus",
      schemaVersion: "1.1.0",
      corpusId: "scoring-golden-corpus",
      scenarioSchema: "golden-scenario.schema.json",
      ordering: "scenarioId-ascending",
      scenarios: [],
      coverage: []
    } as Record<string, unknown>
    if (kind === "scenarios")
      base.scenarios = Array.from({ length: limit + 1 }, (_, i) => ({
        scenarioId: `s-${i}`,
        path: `golden-scenarios/s-${i}.json`,
        weapon: "epee",
        status: "planned",
        sourceIds: [],
        contentDigest: null
      }))
    if (kind === "coverage")
      base.coverage = Array.from({ length: limit + 1 }, (_, i) => ({
        traceabilityId: `TRACE-${i}`,
        status: "planned",
        scenarioIds: []
      }))
    if (kind === "coverageIds")
      base.coverage = [
        {
          traceabilityId: "TRACE-1",
          status: "planned",
          scenarioIds: Array.from({ length: limit + 1 }, (_, i) => `s-${i}`)
        }
      ]
    if (kind === "sourceIds")
      base.scenarios = [
        {
          scenarioId: "s",
          path: "golden-scenarios/s.json",
          weapon: "epee",
          status: "planned",
          sourceIds: Array.from({ length: limit + 1 }, (_, i) => `SRC-${i}`),
          contentDigest: null
        }
      ]
    writeJson(path, base)
    expect(runScenario(path)).toMatchObject({ exitCode: 2, report: { error: { code: "invalid-schema" } } })
  })

  it("executes a rejected scenario without sorting its invalid input", () => {
    const directory = temporaryDirectory()
    const path = join(directory, "rejected.json")
    writeJson(path, readFixture("epee-non-monotonic-time.json"))

    const run = runScenario(path)

    expect(run.exitCode).toBe(0)
    expect(run.report.scenarios[0]).toMatchObject({
      actualStatus: "rejected",
      error: { atInputId: "backward-sample", code: "non-monotonic-time" },
      status: "passed"
    })
  })

  it("rejects a missing path, duplicate input ids, and inconsistent decision timestamps", () => {
    const directory = temporaryDirectory()
    expect(runScenario(join(directory, "missing.json"))).toMatchObject({
      exitCode: 2,
      report: { error: { code: "path-not-found" } }
    })

    const fixture = readFixture("epee-contact-boundaries.json")
    const duplicatePath = join(directory, "duplicate-input.json")
    const inputs = fixture.inputs as Record<string, unknown>[]
    writeJson(duplicatePath, { ...fixture, inputs: [inputs[0], { ...inputs[1], id: inputs[0].id }] })
    expect(runScenario(duplicatePath)).toMatchObject({
      exitCode: 2,
      report: { error: { code: "invalid-schema" } }
    })

    const timestampPath = join(directory, "timestamp.json")
    const expectation = fixture.expect as Record<string, unknown>
    writeJson(timestampPath, {
      ...fixture,
      expect: {
        ...expectation,
        decisions: [
          {
            id: "fault",
            decisionAtUs: 1,
            disposition: "line-fault",
            lineId: "left.tip-loop",
            diagnostic: "open-circuit",
            detectedAtUs: 2,
            persistence: "transient",
            side: "left",
            signal: { visual: "diagnostic", audible: "none", latched: false },
            sourceInputIds: ["right-start"]
          }
        ]
      }
    })
    expect(runScenario(timestampPath)).toMatchObject({
      exitCode: 2,
      report: { error: { code: "invalid-schema" } }
    })
  })

  it.each(["foil", "sabre"])("dispatches the %s scorer", (weapon) => {
    const directory = temporaryDirectory()
    const path = join(directory, `${weapon}.json`)
    const fixture = readFixture("epee-grounded-rejection.json")
    writeJson(path, { ...fixture, weapon })
    expect(runScenario(path)).toMatchObject({ exitCode: 0, report: { status: "passed" } })
  })

  it("reports unknown rules and non-event or uncertainty mismatches", () => {
    const directory = temporaryDirectory()
    const unknown = join(directory, "unknown.json")
    const fixture = readFixture("epee-contact-boundaries.json")
    writeJson(unknown, {
      ...fixture,
      ruleRevision: "unknown-revision",
      expect: {
        ...(fixture.expect as Record<string, unknown>),
        status: "rejected",
        decisions: [],
        error: { code: "unknown-rule-revision" }
      }
    })
    expect(runScenario(unknown)).toMatchObject({ exitCode: 1, report: { status: "failed" } })
    const nonEvent = join(directory, "non-event.json")
    writeJson(nonEvent, {
      ...fixture,
      expect: {
        ...(fixture.expect as Record<string, unknown>),
        nonEvents: [
          {
            ...((fixture.expect as Record<string, unknown>).nonEvents as Record<string, unknown>[])[0],
            id: "wrong",
            window: { fromUs: 0, throughUs: 2000 },
            side: "right"
          }
        ]
      }
    })
    expect(runScenario(nonEvent)).toMatchObject({
      exitCode: 1,
      report: { scenarios: [{ mismatches: [{ kind: "non-event" }] }] }
    })
    const uncertaintyFixture = readFixture("epee-resistance-uncertainty-near-lockout.json")
    const uncertainty = join(directory, "uncertainty.json")
    const uncertaintyExpect = uncertaintyFixture.expect as Record<string, unknown>
    const ranges = [...(uncertaintyExpect.uncertainty as Record<string, unknown>[])]
    ranges[0] = { ...ranges[0], rangeMilliOhms: { min: 0, max: 99999 } }
    writeJson(uncertainty, { ...uncertaintyFixture, expect: { ...uncertaintyExpect, uncertainty: ranges } })
    expect(runScenario(uncertainty)).toMatchObject({
      exitCode: 1,
      report: { scenarios: [{ mismatches: [{ kind: "uncertainty" }] }] }
    })
  })

  it("compares duplicate expected decision shapes deterministically", () => {
    const directory = temporaryDirectory()
    const path = join(directory, "duplicate-expected-shape.json")
    const fixture = readFixture("epee-contact-boundaries.json")
    const expectation = fixture.expect as Record<string, unknown>
    const decisions = expectation.decisions as Record<string, unknown>[]
    writeJson(path, {
      ...fixture,
      expect: {
        ...expectation,
        decisions: [decisions[0], { ...decisions[0], id: "duplicate-shape" }, ...decisions.slice(1)]
      }
    })
    expect(runScenario(path)).toMatchObject({
      exitCode: 1,
      report: { scenarios: [{ mismatches: [{ kind: "decision" }] }] }
    })
  })

  it("reports one stable mismatch when Sabre diagnostics differ", () => {
    const directory = temporaryDirectory()
    const path = join(directory, "diagnostic-mismatch.json")
    const scenario = readFixture("sabre-yellow-onset-clear.json")
    const expectation = scenario.expect as Record<string, unknown>
    const diagnostics = expectation.diagnostics as Record<string, unknown>[]
    writeJson(path, {
      ...scenario,
      expect: {
        ...expectation,
        diagnostics: diagnostics.map((diagnostic, index) => (index === 0 ? { ...diagnostic, atUs: 2 } : diagnostic))
      }
    })

    expect(runScenario(path)).toMatchObject({
      exitCode: 1,
      report: { scenarios: [{ mismatches: [{ kind: "diagnostic", message: "diagnostic output differs" }] }] }
    })
  })

  it("orders simultaneous Sabre diagnostics deterministically by side", () => {
    const directory = temporaryDirectory()
    const path = join(directory, "simultaneous-sabre-diagnostics.json")
    const scenario = readFixture("sabre-yellow-onset-clear.json")
    const expectation = scenario.expect as Record<string, unknown>
    const inputs = scenario.inputs as Record<string, unknown>[]
    const withRightFault = inputs.map((input, index) => {
      if (index < 1) return input
      const lines = (input.lines as Record<string, unknown>[]).map((line) =>
        line.line === "right.fault" ? { ...line, state: index === inputs.length - 1 ? "open" : "closed" } : line
      )
      return { ...input, lines }
    })
    writeJson(path, {
      ...scenario,
      inputs: withRightFault,
      expect: {
        ...expectation,
        diagnostics: [
          {
            id: "left-yellow-on",
            atUs: 1,
            side: "left",
            indication: "yellow-on",
            reason: "own-equipment-fault",
            audible: "none",
            latched: false,
            sourceInputIds: ["fault-onset"]
          },
          {
            id: "right-yellow-on",
            atUs: 1,
            side: "right",
            indication: "yellow-on",
            reason: "own-equipment-fault",
            audible: "none",
            latched: false,
            sourceInputIds: ["fault-onset"]
          },
          {
            id: "left-yellow-off",
            atUs: 3,
            side: "left",
            indication: "yellow-off",
            reason: "own-equipment-clear",
            audible: "none",
            latched: false,
            sourceInputIds: ["fault-onset", "fault-cleared"]
          },
          {
            id: "right-yellow-off",
            atUs: 3,
            side: "right",
            indication: "yellow-off",
            reason: "own-equipment-clear",
            audible: "none",
            latched: false,
            sourceInputIds: ["fault-onset", "fault-cleared"]
          }
        ]
      }
    })

    expect(runScenario(path)).toMatchObject({
      exitCode: 0,
      report: {
        scenarios: [
          {
            diagnostics: [
              { atUs: 1, side: "left" },
              { atUs: 1, side: "right" },
              { atUs: 3, side: "left" },
              { atUs: 3, side: "right" }
            ]
          }
        ]
      }
    })
  })

  it("attributes a wrapped Sabre evidence rejection to the failing input", () => {
    const directory = temporaryDirectory()
    const path = join(directory, "sabre-non-monotonic.json")
    const scenario = readFixture("sabre-yellow-onset-clear.json")
    const expectation = scenario.expect as Record<string, unknown>
    const rejectedExpectation = { ...expectation }
    delete rejectedExpectation.finalState
    const inputs = scenario.inputs as Record<string, unknown>[]
    writeJson(path, {
      ...scenario,
      inputs: inputs.map((input, index) => (index === 2 ? { ...input, atUs: 0 } : input)),
      expect: {
        ...rejectedExpectation,
        status: "rejected",
        diagnostics: [],
        error: { code: "non-monotonic-time", atInputId: "fault-retained" }
      }
    })

    expect(runScenario(path)).toMatchObject({
      exitCode: 0,
      report: {
        scenarios: [
          {
            actualStatus: "rejected",
            error: { code: "non-monotonic-time", atInputId: "fault-retained" },
            status: "passed"
          }
        ]
      }
    })
  })

  it("rejects Sabre diagnostic and provenance bounds", () => {
    const directory = temporaryDirectory()
    const scenario = readFixture("sabre-yellow-onset-clear.json")
    const expectation = scenario.expect as Record<string, unknown>
    const diagnostics = expectation.diagnostics as Record<string, unknown>[]
    const overDiagnostics = join(directory, "diagnostic-bound.json")
    writeJson(overDiagnostics, {
      ...scenario,
      expect: {
        ...expectation,
        diagnostics: Array.from({ length: MAX_EXPECTED_DIAGNOSTICS + 1 }, (_, index) => ({
          ...diagnostics[0],
          id: `diagnostic-${index}`
        }))
      }
    })
    const overSources = join(directory, "diagnostic-source-bound.json")
    writeJson(overSources, {
      ...scenario,
      expect: {
        ...expectation,
        diagnostics: [
          {
            ...diagnostics[0],
            sourceInputIds: Array.from({ length: MAX_DIAGNOSTIC_SOURCE_INPUT_IDS + 1 }, (_, index) => `input-${index}`)
          }
        ]
      }
    })
    const unknownSource = join(directory, "diagnostic-unknown-source.json")
    writeJson(unknownSource, {
      ...scenario,
      expect: {
        ...expectation,
        diagnostics: [{ ...diagnostics[0], sourceInputIds: ["not-a-declared-input"] }]
      }
    })

    expect(runScenario(overDiagnostics)).toMatchObject({ exitCode: 2, report: { status: "invalid-input" } })
    expect(runScenario(overSources)).toMatchObject({ exitCode: 2, report: { status: "invalid-input" } })
    expect(runScenario(unknownSource)).toMatchObject({ exitCode: 2, report: { status: "invalid-input" } })
  })

  it("runs active manifest entries in scenario-id order and serializes deterministically for the same seed", () => {
    const directory = temporaryDirectory()
    const goldenDirectory = join(directory, "golden-scenarios")
    mkdirSync(goldenDirectory)
    const first = readFixture("epee-contact-boundaries.json")
    const second = readFixture("epee-grounded-rejection.json")
    first.determinism = { ...(first.determinism as Record<string, unknown>), seed: 20_260_824 }
    second.determinism = { ...(second.determinism as Record<string, unknown>), seed: 20_260_824 }
    writeJson(join(goldenDirectory, "epee-contact-boundaries.json"), first)
    writeJson(join(goldenDirectory, "epee-grounded-rejection.json"), second)
    const manifestPath = join(directory, "corpus.json")
    const firstSourceIds = (first.sources as unknown[]).map((source) => (source as Record<string, unknown>).id)
    const secondSourceIds = (second.sources as unknown[]).map((source) => (source as Record<string, unknown>).id)
    writeJson(manifestPath, {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      format: "scoring-golden-corpus",
      schemaVersion: "1.1.0",
      corpusId: "scoring-golden-corpus",
      scenarioSchema: "golden-scenario.schema.json",
      ordering: "scenarioId-ascending",
      scenarios: [
        {
          scenarioId: "epee.contact-boundaries",
          path: "golden-scenarios/epee-contact-boundaries.json",
          weapon: "epee",
          status: "active",
          sourceIds: firstSourceIds,
          contentDigest: contentDigest(first)
        },
        {
          scenarioId: "epee.grounded-rejection",
          path: "golden-scenarios/epee-grounded-rejection.json",
          weapon: "epee",
          status: "active",
          sourceIds: secondSourceIds,
          contentDigest: contentDigest(second)
        }
      ],
      coverage: []
    })

    const firstRun = runScenario(manifestPath)
    const secondRun = runScenario(manifestPath)

    expect(firstRun.exitCode).toBe(0)
    expect(firstRun.report.scenarios.map((scenario) => scenario.scenarioId)).toEqual([
      "epee.contact-boundaries",
      "epee.grounded-rejection"
    ])
    expect(reportBytes(firstRun.report)).toBe(reportBytes(secondRun.report))
  })

  it("rejects duplicate, unordered, unsafe, unlisted, and unreadable manifest paths", () => {
    const directory = temporaryDirectory()
    const base = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      format: "scoring-golden-corpus",
      schemaVersion: "1.1.0",
      corpusId: "scoring-golden-corpus",
      scenarioSchema: "golden-scenario.schema.json",
      ordering: "scenarioId-ascending",
      scenarios: [],
      coverage: []
    }
    const planned = (scenarioId: string, path: string) => ({
      scenarioId,
      path,
      weapon: "epee",
      status: "planned",
      sourceIds: [],
      contentDigest: null
    })
    const cases = [
      [
        "duplicate-id",
        [planned("same", "golden-scenarios/a.json"), planned("same", "golden-scenarios/b.json")],
        "manifest-duplicate"
      ],
      [
        "unordered",
        [planned("z", "golden-scenarios/z.json"), planned("a", "golden-scenarios/a.json")],
        "manifest-order"
      ],
      ["unsafe", [planned("unsafe", "../unsafe.json")], "invalid-schema"],
      [
        "duplicate-path",
        [planned("a", "golden-scenarios/a.json"), planned("b", "golden-scenarios/a.json")],
        "manifest-duplicate"
      ]
    ] as const
    for (const [name, scenarios, code] of cases) {
      const path = join(directory, `${name}.json`)
      writeJson(path, { ...base, scenarios })
      const run = runScenario(path)
      expect({ name, exitCode: run.exitCode, code: run.report.error?.code }).toEqual({ name, exitCode: 2, code })
    }

    const missingDirectory = join(directory, "missing-directory.json")
    writeJson(missingDirectory, base)
    expect(runScenario(missingDirectory)).toMatchObject({
      exitCode: 2,
      report: { error: { code: "execution-error" } }
    })

    const missingScenario = join(directory, "missing-scenario.json")
    writeJson(missingScenario, {
      ...base,
      scenarios: [
        {
          ...planned("missing", "golden-scenarios/missing.json"),
          status: "active",
          contentDigest: "sha256:0000000000000000000000000000000000000000000000000000000000000000"
        }
      ]
    })
    expect(runScenario(missingScenario)).toMatchObject({
      exitCode: 2,
      report: { error: { code: "path-not-found" } }
    })

    const orphanDirectory = join(directory, "orphan")
    const goldenDirectory = join(orphanDirectory, "golden-scenarios")
    mkdirSync(goldenDirectory, { recursive: true })
    writeJson(join(goldenDirectory, "orphan.json"), readFixture("epee-contact-boundaries.json"))
    const orphanManifest = join(orphanDirectory, "manifest.json")
    writeJson(orphanManifest, base)
    expect(runScenario(orphanManifest)).toMatchObject({
      exitCode: 2,
      report: { error: { code: "manifest-path" } }
    })
  })

  it("fails closed for missing, extra, duplicate, unknown, stale, and digest-corrupt corpus mappings", () => {
    const directory = temporaryDirectory()
    const goldenDirectory = join(directory, "golden-scenarios")
    mkdirSync(goldenDirectory)
    const scenario = readFixture("epee-contact-boundaries.json")
    const scenarioPath = join(goldenDirectory, "contact.json")
    writeJson(scenarioPath, scenario)
    const base = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      format: "scoring-golden-corpus",
      schemaVersion: "1.1.0",
      corpusId: "scoring-golden-corpus",
      scenarioSchema: "golden-scenario.schema.json",
      ordering: "scenarioId-ascending",
      coverage: []
    }
    const entry = (overrides: Record<string, unknown> = {}) => ({
      scenarioId: scenario.scenarioId,
      path: "golden-scenarios/contact.json",
      weapon: scenario.weapon,
      status: "active",
      sourceIds: (scenario.sources as Record<string, unknown>[]).map(({ id }) => id),
      contentDigest: contentDigest(scenario),
      ...overrides
    })
    const writeManifest = (name: string, value: Record<string, unknown>) => {
      const path = join(directory, `${name}.json`)
      writeJson(path, value)
      return runScenario(path)
    }

    expect(
      writeManifest("missing", { ...base, scenarios: [{ ...entry(), path: "golden-scenarios/missing.json" }] })
    ).toMatchObject({ exitCode: 2, report: { error: { code: "path-not-found" } } })
    expect(writeManifest("extra", { ...base, scenarios: [] })).toMatchObject({
      exitCode: 2,
      report: { error: { code: "manifest-path" } }
    })
    expect(
      writeManifest("duplicate", { ...base, scenarios: [entry({ sourceIds: ["EPEE-03", "EPEE-03"] })] })
    ).toMatchObject({ exitCode: 2, report: { error: { code: "invalid-schema" } } })
    expect(
      writeManifest("unknown", {
        ...base,
        scenarios: [entry()],
        coverage: [{ traceabilityId: "UNKNOWN", status: "planned", scenarioIds: ["not-in-corpus"] }]
      })
    ).toMatchObject({ exitCode: 2, report: { error: { code: "manifest-path" } } })
    expect(
      writeManifest("duplicate-coverage", {
        ...base,
        scenarios: [entry()],
        coverage: [
          { traceabilityId: "EPEE-03", status: "planned", scenarioIds: [] },
          { traceabilityId: "EPEE-03", status: "planned", scenarioIds: [scenario.scenarioId] }
        ]
      })
    ).toMatchObject({ exitCode: 2, report: { error: { code: "manifest-duplicate" } } })
    expect(writeManifest("stale", { ...base, scenarios: [entry({ weapon: "foil" })] })).toMatchObject({
      exitCode: 2,
      report: { error: { code: "manifest-path" } }
    })
    expect(
      writeManifest("digest", {
        ...base,
        scenarios: [entry({ contentDigest: "sha256:0000000000000000000000000000000000000000000000000000000000000000" })]
      })
    ).toMatchObject({ exitCode: 2, report: { error: { code: "manifest-path" } } })
  })

  it("rejects duplicated or unknown expectation identities", () => {
    const directory = temporaryDirectory()
    const fixture = readFixture("epee-contact-boundaries.json")
    const expectation = fixture.expect as Record<string, unknown>
    const decision = (expectation.decisions as Record<string, unknown>[])[0]
    const cases = [
      {
        name: "duplicate-expectation",
        scenario: {
          ...fixture,
          expect: {
            ...expectation,
            nonEvents: [{ ...(expectation.nonEvents as Record<string, unknown>[])[0], id: decision.id }]
          }
        }
      },
      {
        name: "unknown-source",
        scenario: {
          ...fixture,
          expect: { ...expectation, decisions: [{ ...decision, sourceInputIds: ["not-an-input"] }] }
        }
      }
    ]
    for (const { name, scenario } of cases) {
      const path = join(directory, `${name}.json`)
      writeJson(path, scenario)
      expect(runScenario(path)).toMatchObject({ exitCode: 2, report: { error: { code: "invalid-schema" } } })
    }
  })

  it("passes the committed canonical corpus in stable order", { timeout: 30_000 }, () => {
    const manifestPath = resolve(fixtureDirectory, "../golden-scenario-manifest.json")

    const firstRun = runScenario(manifestPath)
    const secondRun = runScenario(manifestPath)

    expect(firstRun.exitCode).toBe(0)
    expect(firstRun.report.summary).toEqual({ failed: 0, passed: 29, scenarioCount: 29 })
    expect(firstRun.report.scenarios.every((scenario) => scenario.status === "passed")).toBe(true)
    expect(firstRun.report.scenarios.map((scenario) => scenario.scenarioId)).toEqual([
      "epee.audio-visual-correlation",
      "epee.contact-boundaries",
      "epee.double-lockout-boundary",
      "epee.exceptional-resistance-duration",
      "epee.grounded-material-100-ohm",
      "epee.grounded-rejection",
      "epee.non-monotonic-time",
      "epee.resistance-near-lockout-both-sides",
      "epee.resistance-uncertainty-near-lockout",
      "foil.break-boundaries",
      "foil.grounded-contact",
      "foil.host-logical-contexts",
      "foil.host-resistance-classifications",
      "foil.insulation-handoff",
      "foil.integrity-and-uncertainty",
      "foil.lockout-cutoff",
      "foil.nominal-break",
      "foil.same-side-and-lockout",
      "foil.target-context",
      "sabre.contact-floor-boundaries",
      "sabre.control-break-diagnostic-boundaries",
      "sabre.external-100-ohm-host-boundary",
      "sabre.external-path-containment",
      "sabre.lockout-boundary",
      "sabre.lockout-cutoff",
      "sabre.own-equipment-hit-continuity",
      "sabre.whipover-boundaries-and-recovery",
      "sabre.white-abnormal-change-latch",
      "sabre.yellow-onset-clear"
    ])
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      coverage: { scenarioIds: string[]; status: string; traceabilityId: string }[]
    }
    const coverage = (traceabilityId: string) =>
      manifest.coverage.find((entry) => entry.traceabilityId === traceabilityId)
    expect(coverage("SABRE-02")).toMatchObject({
      status: "planned",
      scenarioIds: ["sabre.white-abnormal-change-latch", "sabre.yellow-onset-clear"]
    })
    expect(coverage("SABRE-03")).toMatchObject({
      status: "planned",
      scenarioIds: [
        "sabre.contact-floor-boundaries",
        "sabre.external-100-ohm-host-boundary",
        "sabre.external-path-containment",
        "sabre.whipover-boundaries-and-recovery"
      ]
    })
    expect(coverage("SABRE-07")).toMatchObject({
      status: "planned",
      scenarioIds: ["sabre.control-break-diagnostic-boundaries"]
    })
    expect(reportBytes(firstRun.report)).toBe(reportBytes(secondRun.report))
  })

  it("covers rejection, final-state, uncertainty, and manifest filesystem branches", () => {
    const directory = temporaryDirectory()
    const fixture = readFixture("epee-contact-boundaries.json")
    const input = (fixture.inputs as Record<string, unknown>[])[0]
    const duplicate = join(directory, "duplicate.json")
    writeJson(duplicate, {
      ...fixture,
      inputs: [{ ...input, lines: [...(input.lines as unknown[]), (input.lines as unknown[])[0]] }]
    })
    expect(runScenario(duplicate).exitCode).toBeGreaterThan(0)

    const unknown = join(directory, "unknown-line.json")
    writeJson(unknown, {
      ...fixture,
      inputs: [
        {
          ...input,
          lines: [
            ...(input.lines as unknown[]),
            { ...(input.lines as Record<string, unknown>[])[0], line: "right.unknown" }
          ]
        }
      ]
    })
    expect(runScenario(unknown)).toMatchObject({ exitCode: 2, report: { error: { code: "invalid-schema" } } })

    const finalState = join(directory, "final-state.json")
    writeJson(finalState, {
      ...fixture,
      expect: { ...(fixture.expect as Record<string, unknown>), finalState: { hitCount: 99, isLocked: true } }
    })
    expect(runScenario(finalState)).toMatchObject({
      exitCode: 1,
      report: { scenarios: [{ mismatches: [{ kind: "final-state" }] }] }
    })

    const error = join(directory, "error.json")
    const rejected = readFixture("epee-non-monotonic-time.json")
    writeJson(error, {
      ...rejected,
      expect: { ...(rejected.expect as Record<string, unknown>), error: { code: "invalid-line-state" } }
    })
    expect(runScenario(error)).toMatchObject({
      exitCode: 1,
      report: { scenarios: [{ mismatches: [{ kind: "error" }] }] }
    })
  })

  it.each([
    ["epee", ["left.tip-loop", "left.ground-reference", "right.tip-loop", "right.ground-reference"]],
    [
      "foil",
      [
        "left.weapon-circuit",
        "left.target",
        "left.insulation",
        "right.weapon-circuit",
        "right.target",
        "right.insulation"
      ]
    ],
    [
      "sabre",
      [
        "left.target",
        "left.control",
        "left.external",
        "left.fault",
        "right.target",
        "right.control",
        "right.external",
        "right.fault"
      ]
    ]
  ])("exercises %s projection states", (weapon, names) => {
    const directory = temporaryDirectory()
    const path = join(directory, `${weapon}-projection.json`)
    const fixture = readFixture("epee-grounded-rejection.json")
    const states = ["open", "closed", "disconnected", "indeterminate", "grounded", "shorted"]
    const input = fixture.inputs as Record<string, unknown>[]
    writeJson(path, {
      ...fixture,
      weapon,
      lineModel: { revision: "m0-07", names },
      inputs: states.map((_state, index) => ({
        ...input[0],
        id: `projection-${index}`,
        atUs: index * 20_000,
        lines: names.map((line, lineIndex) => ({
          line,
          state: states[(index + lineIndex) % states.length],
          ...(states[(index + lineIndex) % states.length] === "shorted" && line.startsWith("right.")
            ? { faultCode: "out-of-range" }
            : {}),
          resistanceMilliOhms: null,
          resistanceUncertaintyMilliOhms: null
        }))
      }))
    })
    expect(runScenario(path).report.status).not.toBe("invalid-input")
  })

  it.each([
    [
      "foil",
      [
        "left.weapon-circuit",
        "left.target",
        "left.insulation",
        "right.weapon-circuit",
        "right.target",
        "right.insulation"
      ],
      [
        ["open", "closed", "closed", "closed", "closed", "closed"],
        ["open", "closed", "closed", "closed", "closed", "closed"]
      ],
      [0, 13_000]
    ],
    [
      "sabre",
      [
        "left.target",
        "left.control",
        "left.external",
        "left.fault",
        "right.target",
        "right.control",
        "right.external",
        "right.fault"
      ],
      [
        ["closed", "open", "open", "open", "grounded", "open", "open", "open"],
        ["closed", "open", "open", "open", "grounded", "open", "open", "open"]
      ],
      [0, 100]
    ]
  ])("maps a scorer-valid %s hit", (weapon, names, stateRows, times) => {
    const directory = temporaryDirectory()
    const path = join(directory, `${weapon}-hit.json`)
    const fixture = readFixture("epee-grounded-rejection.json")
    const baseInput = (fixture.inputs as Record<string, unknown>[])[0]
    writeJson(path, {
      ...fixture,
      weapon,
      lineModel: { revision: "m0-07", names },
      inputs: times.map((atUs, index) => ({
        ...baseInput,
        id: `${weapon}-hit-${index}`,
        atUs,
        lines: names.map((line, lineIndex) => ({
          line,
          state: stateRows[index][lineIndex],
          resistanceMilliOhms: null,
          resistanceUncertaintyMilliOhms: null
        }))
      })),
      expect: {
        status: "accepted",
        decisions: [
          {
            id: `${weapon}-left-hit`,
            decisionAtUs: times[1],
            disposition: "qualified-hit",
            weapon,
            side: "left",
            hitStartedAtUs: times[0],
            qualifiedAtUs: times[1],
            signal: { visual: "valid-hit", audible: "requested", latched: true },
            sourceInputIds: [`${weapon}-hit-0`, `${weapon}-hit-1`]
          }
        ],
        nonEvents: [],
        uncertainty: [],
        finalState: { hitCount: 1, isLocked: false }
      }
    })
    const run = runScenario(path)
    expect(run).toMatchObject({
      exitCode: 0,
      report: {
        status: "passed",
        scenarios: [
          {
            status: "passed",
            decisions: [
              {
                decisionAtUs: times[1],
                disposition: "qualified-hit",
                hitStartedAtUs: times[0],
                qualifiedAtUs: times[1],
                side: "left",
                sourceInputIds: [`${weapon}-hit-0`, `${weapon}-hit-1`],
                weapon
              }
            ]
          }
        ]
      }
    })
  })

  it("maps an exact foil off-target decision", () => {
    const directory = temporaryDirectory()
    const path = join(directory, "foil-off-target.json")
    const fixture = readFixture("epee-grounded-rejection.json")
    const names = [
      "left.weapon-circuit",
      "left.target",
      "left.insulation",
      "right.weapon-circuit",
      "right.target",
      "right.insulation"
    ]
    const baseInput = (fixture.inputs as Record<string, unknown>[])[0]
    const inputs = [0, 13_000].map((atUs, index) => ({
      ...baseInput,
      id: `foil-off-target-${index}`,
      atUs,
      lines: names.map((line) => ({
        line,
        state: line === "left.weapon-circuit" || line === "left.target" ? "open" : "closed",
        resistanceMilliOhms: null,
        resistanceUncertaintyMilliOhms: null
      }))
    }))
    writeJson(path, {
      ...fixture,
      weapon: "foil",
      lineModel: { revision: "m0-07", names },
      inputs,
      expect: {
        status: "accepted",
        decisions: [
          {
            id: "foil-left-off-target",
            decisionAtUs: 13_000,
            disposition: "off-target",
            weapon: "foil",
            side: "left",
            qualifiedAtUs: 13_000,
            signal: { visual: "off-target", audible: "requested", latched: true },
            sourceInputIds: ["foil-off-target-0", "foil-off-target-1"]
          }
        ],
        nonEvents: [],
        uncertainty: [],
        finalState: { hitCount: 1, isLocked: false }
      }
    })
    expect(runScenario(path)).toMatchObject({
      exitCode: 0,
      report: {
        status: "passed",
        scenarios: [{ decisions: [{ disposition: "off-target", signal: { visual: "off-target" } }] }]
      }
    })
  })

  it("sorts multiple declared and observed uncertainty records", () => {
    const directory = temporaryDirectory()
    const path = join(directory, "uncertainty-sort.json")
    const fixture = readFixture("epee-resistance-uncertainty-near-lockout.json")
    const expectation = fixture.expect as Record<string, unknown>
    const uncertainty = expectation.uncertainty as Record<string, unknown>[]
    const input = structuredClone((fixture.inputs as Record<string, unknown>[])[0])
    const lines = input.lines as Record<string, unknown>[]
    const leftGround = lines.find((line) => line.line === "left.ground-reference")
    const rightTip = lines.find((line) => line.line === "right.tip-loop")
    if (leftGround === undefined || rightTip === undefined) throw new Error("uncertainty fixture lines are incomplete")
    Object.assign(leftGround, {
      state: "indeterminate",
      resistanceMilliOhms: null,
      resistanceUncertaintyMilliOhms: null
    })
    Object.assign(rightTip, {
      state: "closed",
      resistanceMilliOhms: 10_000,
      resistanceUncertaintyMilliOhms: 1
    })
    writeJson(path, {
      ...fixture,
      inputs: [input],
      expect: {
        ...expectation,
        decisions: [],
        nonEvents: [],
        finalState: { hitCount: 0, isLocked: false },
        uncertainty: [
          {
            ...uncertainty[0],
            id: "left-ground-range",
            atUs: 0,
            scope: "left.ground-reference",
            rangeMilliOhms: undefined
          },
          {
            ...uncertainty[0],
            id: "right-tip-range",
            atUs: 0,
            scope: "right.tip-loop"
          }
        ]
      }
    })
    const run = runScenario(path)
    expect(run).toMatchObject({ exitCode: 0, report: { status: "passed" } })
  })
})

it("reports acceptance mismatches and identifies failed Sabre adapter input", () => {
  const directory = temporaryDirectory()
  const path = join(directory, "status.json")
  writeJson(path, { ...readFixture("epee-contact-boundaries.json"), ruleRevision: "unknown" })
  expect(runScenario(path)).toMatchObject({
    exitCode: 1,
    report: {
      scenarios: [
        { mismatches: expect.arrayContaining([{ kind: "status", message: "expected accepted, got rejected" }]) }
      ]
    }
  })
  writeJson(path, { ...readFixture("epee-grounded-rejection.json"), weapon: "sabre" })
  const spy = vi.spyOn(sabreEvidence, "projectSabreScenarioInput").mockImplementationOnce(() => {
    throw new Error("invalid sample")
  })
  try {
    expect(runScenario(path)).toMatchObject({ exitCode: 1, report: { scenarios: [{ actualStatus: "rejected" }] } })
  } finally {
    spy.mockRestore()
  }
})
