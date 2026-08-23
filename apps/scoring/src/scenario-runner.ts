/**
 * M2-12 deterministic golden-scenario runner.
 *
 * The runner is deliberately a thin adapter around the weapon rule modules.
 * It reads the M0-07 JSON contracts, validates the contract before execution,
 * feeds listed snapshots to the selected scorer, and compares only the
 * declared expectations. It does not model hardware, transport, or replay of
 * stored decision records.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { basename, dirname, extname, relative, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"
import { Ajv2020 } from "ajv/dist/2020.js"
import {
  advanceEpeeResistanceScoring,
  createEpeeResistanceScoringState,
  type EpeeResistanceContact,
  type EpeeResistanceSample
} from "./epee-resistance.js"
import { advanceEpeeScoring, createEpeeScoringState, type EpeeSample } from "./epee.js"
import { classifyFoilScenarioInputs, type FoilScenarioClassification } from "./foil-scenario-evidence.js"
import { advanceFoilScoring, createFoilScoringState, type FoilContact, type FoilSample } from "./foil.js"
import {
  projectSabreScenarioInput,
  runSabreScenarioEvidence,
  SabreScenarioEvidenceError,
  type SabreScenarioDiagnosticEvidence
} from "./sabre-scenario-evidence.js"
import { createSabreScoringState } from "./sabre.js"
import { loadTimingTableForRuleRevision } from "./timing-boundary.js"
import type { TimingTable } from "./timing-table.js"

export { projectSabreScenarioInput }

export const SCENARIO_RUN_REPORT_FORMAT = "scoring-golden-run-report"
export const SCENARIO_RUN_REPORT_VERSION = "1.1.0"
export const MAX_INPUT_FILE_BYTES = 4 * 1024 * 1024
export const MAX_MANIFEST_ENTRIES = 256
export const MAX_MANIFEST_COVERAGE_ENTRIES = 512
export const MAX_SOURCE_RECORDS = 128
export const MAX_SOURCE_IDS_PER_ENTRY = 128
export const MAX_LINE_NAMES = 64
export const MAX_SCENARIO_INPUTS = 4096
export const MAX_LINES_PER_INPUT = 32
export const MAX_EXPECTED_DECISIONS = 4096
export const MAX_EXPECTED_NON_EVENTS = 4096
export const MAX_EXPECTED_UNCERTAINTIES = 4096
export const MAX_EXPECTED_CLASSIFICATIONS = 4096
export const MAX_EXPECTED_DIAGNOSTICS = 4096
export const MAX_DIAGNOSTIC_SOURCE_INPUT_IDS = 2
export const MAX_COVERAGE_SCENARIO_IDS = 4096

type JsonObject = Record<string, unknown>
type Weapon = "epee" | "foil" | "sabre"
type Side = "left" | "right"

type Scenario = JsonObject & {
  schemaVersion: "1.0.0" | "1.1.0" | "1.2.0"
  scenarioId: string
  weapon: Weapon
  ruleRevision: string
  lineModel: { names: string[] }
  inputs: ScenarioInput[]
  expect: ScenarioExpectation
}

type ScenarioInput = JsonObject & {
  id: string
  atUs: number
  lines: ScenarioLine[]
}

type ScenarioLine = JsonObject & {
  line: string
  state: string
  resistanceMilliOhms: number | null
  resistanceUncertaintyMilliOhms: number | null
}

type ScenarioExpectation = JsonObject & {
  status: "accepted" | "rejected"
  decisions: ScenarioDecision[]
  nonEvents: ScenarioNonEvent[]
  uncertainty: ScenarioUncertainty[]
  classifications?: ScenarioClassification[]
  diagnostics?: ScenarioDiagnostic[]
  finalState?: { hitCount?: number; isLocked?: boolean }
  error?: { code: string; atInputId?: string }
}

type ScenarioDecision = JsonObject & {
  id: string
  decisionAtUs: number
  disposition: string
  sourceInputIds: string[]
}

type ScenarioNonEvent = JsonObject & {
  id: string
  window: { fromUs: number; throughUs: number }
  side?: "left" | "right" | "both" | "none"
}

type ScenarioUncertainty = JsonObject & {
  id: string
  atUs: number
  scope: string
  outcome: string
  rangeMilliOhms?: { min: number; max: number }
}

type ScenarioClassification = JsonObject & FoilScenarioClassification & { id: string }
type ScenarioDiagnostic = JsonObject & SabreScenarioDiagnosticEvidence & { id: string }

type ActualDecision = {
  decisionAtUs: number
  disposition: "qualified-hit" | "off-target"
  weapon: Weapon
  side: Side
  hitStartedAtUs?: number
  qualifiedAtUs: number
  sourceInputIds: string[]
  signal: {
    visual: "diagnostic" | "none" | "off-target" | "valid-hit"
    audible: "none" | "requested"
    latched: boolean
  }
}

type ActualUncertainty = {
  atUs: number
  scope: string
  outcome: "indeterminate"
  rangeMilliOhms: { min: number; max: number } | null
}

type ScenarioMismatch = {
  kind: "status" | "decision" | "non-event" | "uncertainty" | "classification" | "diagnostic" | "final-state" | "error"
  message: string
}

export type ScenarioRunResult = {
  scenarioId: string
  path: string
  weapon: Weapon
  status: "passed" | "failed"
  expectedStatus: "accepted" | "rejected"
  actualStatus: "accepted" | "rejected"
  decisions: readonly ActualDecision[]
  uncertainty: readonly ActualUncertainty[]
  classifications?: readonly FoilScenarioClassification[]
  diagnostics?: readonly SabreScenarioDiagnosticEvidence[]
  nonEvents: readonly { id: string; satisfied: boolean }[]
  finalState: { hitCount: number; isLocked: boolean } | null
  error: { code: string; atInputId?: string } | null
  mismatches: readonly ScenarioMismatch[]
}

export type ScenarioRunReport = {
  format: typeof SCENARIO_RUN_REPORT_FORMAT
  schemaVersion: typeof SCENARIO_RUN_REPORT_VERSION
  runner: "golden-scenario-runner"
  input: { kind: "scenario" | "manifest"; path: string }
  status: "passed" | "failed" | "invalid-input"
  scenarios: readonly ScenarioRunResult[]
  summary: { scenarioCount: number; passed: number; failed: number }
  error: { code: string; path?: string } | null
}

export type ScenarioRun = Readonly<{
  report: ScenarioRunReport
  exitCode: 0 | 1 | 2
}>

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

function sameJson(left: unknown, right: unknown): boolean {
  const canonical = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonical)
    if (isObject(value))
      return Object.fromEntries(
        Object.entries(value)
          .sort(([a], [b]) => compareText(a, b))
          .map(([key, child]) => [key, canonical(child)])
      )
    return value
  }
  return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right))
}

class RunnerInputError extends Error {
  readonly code:
    | "invalid-json"
    | "invalid-schema"
    | "path-not-found"
    | "manifest-path"
    | "manifest-order"
    | "manifest-duplicate"
    | "input-too-large"
    | "execution-error"
  readonly filePath: string

  constructor(code: RunnerInputError["code"], filePath: string) {
    super(code)
    this.code = code
    this.filePath = filePath
  }
}

function fail(path: string): never {
  throw new TypeError(`${path} is invalid`)
}

const schemaDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "../docs")
const scenarioValidator = new Ajv2020({ allErrors: true, strict: false }).compile(
  JSON.parse(readFileSync(resolve(schemaDirectory, "golden-scenario.schema.json"), "utf8"))
)
const manifestValidator = new Ajv2020({ allErrors: true, strict: false }).compile(
  JSON.parse(readFileSync(resolve(schemaDirectory, "golden-scenario-manifest.schema.json"), "utf8"))
)

function validateScenarioDocument(value: unknown): Scenario {
  if (!scenarioValidator(value)) fail("scenario")
  const scenario = value as Scenario
  const sources = scenario.sources as unknown[]
  if (sources.length > MAX_SOURCE_RECORDS || scenario.lineModel.names.length > MAX_LINE_NAMES) fail("scenario.bounds")
  if (scenario.inputs.length > MAX_SCENARIO_INPUTS) fail("scenario.inputs")
  for (const input of scenario.inputs) if (input.lines.length > MAX_LINES_PER_INPUT) fail("scenario.lines")
  if (
    scenario.expect.decisions.length > MAX_EXPECTED_DECISIONS ||
    scenario.expect.nonEvents.length > MAX_EXPECTED_NON_EVENTS ||
    scenario.expect.uncertainty.length > MAX_EXPECTED_UNCERTAINTIES ||
    (scenario.expect.classifications?.length ?? 0) > MAX_EXPECTED_CLASSIFICATIONS ||
    (scenario.expect.diagnostics?.length ?? 0) > MAX_EXPECTED_DIAGNOSTICS
  )
    fail("scenario.expect.bounds")
  const classifications = scenario.expect.classifications
  if (classifications !== undefined) {
    const ids = classifications.map(({ id }) => id)
    const sourceInputIds = classifications.map(({ sourceInputId }) => sourceInputId)
    if (
      new Set(ids).size !== ids.length ||
      new Set(sourceInputIds).size !== sourceInputIds.length ||
      classifications.length !== scenario.inputs.length ||
      classifications.some(
        (classification, index) =>
          classification.sourceInputId !== scenario.inputs[index]?.id ||
          classification.atUs !== scenario.inputs[index]?.atUs ||
          (classification.rangeMilliOhms !== undefined &&
            classification.rangeMilliOhms !== null &&
            classification.rangeMilliOhms.min > classification.rangeMilliOhms.max)
      )
    )
      fail("scenario.expect.classifications")
  }
  const diagnostics = scenario.expect.diagnostics
  if (diagnostics !== undefined) {
    const ids = diagnostics.map(({ id }) => id)
    const inputIds = new Set(scenario.inputs.map(({ id }) => id))
    if (
      new Set(ids).size !== ids.length ||
      diagnostics.some(
        (diagnostic) =>
          diagnostic.sourceInputIds.length > MAX_DIAGNOSTIC_SOURCE_INPUT_IDS ||
          new Set(diagnostic.sourceInputIds).size !== diagnostic.sourceInputIds.length ||
          diagnostic.sourceInputIds.some((sourceInputId) => !inputIds.has(sourceInputId))
      )
    )
      fail("scenario.expect.diagnostics")
  }
  for (const nonEvent of scenario.expect.nonEvents)
    if (nonEvent.window.fromUs > nonEvent.window.throughUs) fail("scenario.expect.nonEvents")
  for (const decision of scenario.expect.decisions) {
    const record = decision as JsonObject
    const timestamp = record.decisionAtUs
    for (const key of ["qualifiedAtUs", "detectedAtUs", "resetAtUs", "observedAtUs", "performedAtUs"])
      if (
        Object.hasOwn(record, key) &&
        record[key] !== timestamp &&
        ["line-fault", "reset", "uncertainty", "calibration"].includes(decision.disposition)
      )
        fail("scenario.expect.decisions.timestamp")
  }
  return scenario
}

function validateManifestDocument(value: unknown): JsonObject {
  if (!manifestValidator(value)) fail("manifest")
  const manifest = value as JsonObject
  const scenarios = manifest.scenarios as unknown[]
  const coverage = manifest.coverage as unknown[]
  if (scenarios.length > MAX_MANIFEST_ENTRIES || coverage.length > MAX_MANIFEST_COVERAGE_ENTRIES)
    fail("manifest.bounds")
  for (const entry of scenarios) {
    const sourceIds = (entry as JsonObject).sourceIds as unknown[]
    if (sourceIds.length > MAX_SOURCE_IDS_PER_ENTRY) fail("manifest.sourceIds")
  }
  for (const entry of coverage)
    if (((entry as JsonObject).scenarioIds as unknown[]).length > MAX_COVERAGE_SCENARIO_IDS) fail("manifest.coverage")
  return manifest
}
function parseJsonFile(filePath: string, kind: "scenario" | "manifest"): JsonObject {
  if (!existsSync(filePath)) throw new RunnerInputError("path-not-found", filePath)
  if (statSync(filePath).size > MAX_INPUT_FILE_BYTES) throw new RunnerInputError("input-too-large", filePath)
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(filePath, "utf8"))
  } catch {
    throw new RunnerInputError("invalid-json", filePath)
  }

  try {
    if (kind === "scenario") validateScenarioDocument(parsed)
    else validateManifestDocument(parsed)
  } catch {
    throw new RunnerInputError("invalid-schema", filePath)
  }

  return parsed as JsonObject
}

function pathForReport(filePath: string): string {
  const cwdRelative = relative(process.cwd(), filePath)
  // A public runner input is a file, so it cannot equal the process directory.
  /* v8 ignore next */
  return (cwdRelative.length === 0 ? basename(filePath) : cwdRelative).split(sep).join("/")
}

function lineForSide(input: ScenarioInput, side: Side, preferred: readonly string[]): ScenarioLine[] {
  return input.lines.filter(
    (line) => line.line.startsWith(`${side}.`) && preferred.some((name) => line.line.includes(name))
  )
}

function firstLine(input: ScenarioInput, side: Side, preferred: readonly string[]): ScenarioLine | undefined {
  return lineForSide(input, side, preferred)[0]
}

function mapSimpleEpee(input: ScenarioInput): EpeeSample {
  const contact = (side: Side) => {
    const weapon = firstLine(input, side, ["weapon-circuit", "tip-loop"])
    const ground = firstLine(input, side, ["guard-or-piste", "ground-reference"])
    return {
      isGrounded: ground?.state === "grounded" || weapon?.state === "grounded",
      isTipClosed: weapon?.state === "closed"
    }
  }
  return { atUs: input.atUs, left: contact("left"), right: contact("right") }
}

function mapEpeeResistance(input: ScenarioInput): EpeeResistanceSample {
  const contact = (side: Side) => {
    const tip = firstLine(input, side, ["tip-loop"])
    const ground = firstLine(input, side, ["ground-reference"])
    const lineIntegrity = (
      line: ScenarioLine | undefined
    ): "cross-line" | "indeterminate" | "intact" | "out-of-range" | "unavailable" => {
      if (line === undefined || line.state === "disconnected") return "unavailable"
      if (line.state === "indeterminate") return "indeterminate"
      if (line.state === "shorted") return line.faultCode === "out-of-range" ? "out-of-range" : "cross-line"
      return "intact"
    }
    const measurement = (line: ScenarioLine | undefined) => ({
      resistanceMilliOhms: line?.resistanceMilliOhms ?? null,
      resistanceUncertaintyMilliOhms: line?.resistanceUncertaintyMilliOhms ?? null
    })
    const circuitComplete: EpeeResistanceContact["circuitComplete"] =
      tip?.state === "open"
        ? "open"
        : tip?.state === "indeterminate"
          ? "indeterminate"
          : tip?.state === "disconnected"
            ? "unavailable"
            : "closed"
    const groundedMaterial: EpeeResistanceContact["groundedMaterial"] =
      ground?.state === "grounded"
        ? "grounded"
        : ground?.state === "indeterminate"
          ? "indeterminate"
          : ground?.state === "disconnected"
            ? "unavailable"
            : "not-grounded"
    return {
      circuitComplete,
      contactResistance: measurement(tip),
      groundPathResistance: measurement(ground),
      groundedMaterial,
      lineIntegrity: lineIntegrity(tip)
    }
  }
  return { atUs: input.atUs, left: contact("left"), right: contact("right") }
}

export function projectFoilScenarioInput(input: ScenarioInput): FoilSample {
  const contact = (side: Side): FoilContact => {
    const circuit = firstLine(input, side, ["weapon-circuit", "circuit", "tip-loop"])
    const target = firstLine(input, side, ["target", "lame"])
    const insulation = firstLine(input, side, ["insulation"])
    const integrity =
      target?.state === "shorted"
        ? "lameFault"
        : circuit?.state === "shorted"
          ? "weaponFault"
          : circuit?.state === "disconnected"
            ? "unavailable"
            : circuit?.state === "indeterminate"
              ? "indeterminate"
              : "intact"
    const circuitBreak =
      circuit?.state === "open"
        ? "open"
        : circuit?.state === "disconnected"
          ? "unavailable"
          : circuit?.state === "indeterminate"
            ? "indeterminate"
            : "closed"
    const targetContext =
      target?.state === "grounded"
        ? "grounded"
        : target?.state === "indeterminate"
          ? "indeterminate"
          : target?.state === "disconnected"
            ? "unavailable"
            : target === undefined || target.state === "closed"
              ? "target"
              : "nonTarget"
    const insulationDiagnostic =
      insulation?.state === "closed"
        ? "withinRange"
        : insulation?.state === "indeterminate"
          ? "indeterminate"
          : insulation?.state === "disconnected"
            ? "unavailable"
            : "outsideRange"
    return { circuitBreak, insulationDiagnostic, integrity, targetContext }
  }
  return { atUs: input.atUs, left: contact("left"), right: contact("right") }
}

function isResistanceScenario(scenario: Scenario): boolean {
  return scenario.lineModel.names.some((name) => name.endsWith("tip-loop"))
}

function inputIdsAt(inputs: readonly ScenarioInput[], atUs: number, side: Side): string[] {
  const matching = inputs.filter(
    (input) =>
      input.atUs === atUs &&
      input.lines.some(
        (line) =>
          line.line === `${side}.weapon-circuit` || line.line === `${side}.tip-loop` || line.line === `${side}.target`
      )
  )
  return matching.map((input) => input.id)
}

function expectedDecisionShape(decision: ScenarioDecision): Record<string, unknown> {
  const ignored = new Set(["id"])
  return Object.fromEntries(
    Object.entries(decision)
      .filter(([key]) => !ignored.has(key))
      .sort(([left], [right]) => compareText(left, right))
  )
}

function actualDecisionShape(decision: ActualDecision): Record<string, unknown> {
  return Object.fromEntries(Object.entries(decision).sort(([left], [right]) => compareText(left, right)))
}

function diagnosticShape(diagnostic: SabreScenarioDiagnosticEvidence): Record<string, unknown> {
  return {
    atUs: diagnostic.atUs,
    audible: diagnostic.audible,
    indication: diagnostic.indication,
    latched: diagnostic.latched,
    reason: diagnostic.reason,
    side: diagnostic.side,
    sourceInputIds: [...diagnostic.sourceInputIds]
  }
}

function compareDiagnosticShape(left: Record<string, unknown>, right: Record<string, unknown>): number {
  return (left.atUs as number) - (right.atUs as number) || compareText(left.side as string, right.side as string)
}

function compareScenario(
  scenario: Scenario,
  path: string,
  execution: {
    actualStatus: "accepted" | "rejected"
    classifications: FoilScenarioClassification[]
    diagnostics: SabreScenarioDiagnosticEvidence[]
    decisions: ActualDecision[]
    uncertainty: ActualUncertainty[]
    finalState: { hitCount: number; isLocked: boolean } | null
    error: { code: string; atInputId?: string } | null
  }
): ScenarioRunResult {
  const expected = scenario.expect
  const mismatches: ScenarioMismatch[] = []
  if (execution.actualStatus !== expected.status)
    mismatches.push({ kind: "status", message: `expected ${expected.status}, got ${execution.actualStatus}` })

  const expectedDecisions = expected.decisions
    .map(expectedDecisionShape)
    .sort((left, right) => compareText(JSON.stringify(left), JSON.stringify(right)))
  const actualDecisions = execution.decisions
    .map(actualDecisionShape)
    .sort((left, right) => compareText(JSON.stringify(left), JSON.stringify(right)))
  if (!sameJson(expectedDecisions, actualDecisions))
    mismatches.push({ kind: "decision", message: "decision output differs" })

  const nonEvents = expected.nonEvents.map((nonEvent) => {
    const satisfied = !execution.decisions.some((decision) => {
      const sameSide =
        nonEvent.side === undefined ||
        nonEvent.side === "both" ||
        nonEvent.side === "none" ||
        decision.side === nonEvent.side
      return (
        sameSide &&
        decision.decisionAtUs >= nonEvent.window.fromUs &&
        decision.decisionAtUs <= nonEvent.window.throughUs
      )
    })
    if (!satisfied) mismatches.push({ kind: "non-event", message: `non-event ${nonEvent.id} was violated` })
    return { id: nonEvent.id, satisfied }
  })

  const expectedUncertainty = expected.uncertainty
    .map(({ id: _id, assertionReasonCode: _reason, ...value }) => value)
    .sort((left, right) => compareText(JSON.stringify(left), JSON.stringify(right)))
  const actualUncertainty = execution.uncertainty
    .map(({ atUs, scope, outcome, rangeMilliOhms }) => ({
      atUs,
      scope,
      outcome,
      ...(rangeMilliOhms === null ? {} : { rangeMilliOhms })
    }))
    .sort((left, right) => compareText(JSON.stringify(left), JSON.stringify(right)))
  if (!sameJson(expectedUncertainty, actualUncertainty))
    mismatches.push({ kind: "uncertainty", message: "uncertainty output differs" })

  const expectedClassifications = (expected.classifications ?? []).map(({ id: _id, ...value }) => value)
  if (!sameJson(expectedClassifications, execution.classifications))
    mismatches.push({ kind: "classification", message: "classification output differs" })

  if (scenario.schemaVersion === "1.1.0") {
    const expectedDiagnostics = expected
      .diagnostics!.map(({ id: _id, ...diagnostic }) => diagnosticShape(diagnostic))
      .sort(compareDiagnosticShape)
    const actualDiagnostics = execution.diagnostics.map(diagnosticShape).sort(compareDiagnosticShape)
    if (!sameJson(expectedDiagnostics, actualDiagnostics))
      mismatches.push({ kind: "diagnostic", message: "diagnostic output differs" })
  }

  const expectedFinal = expected.finalState
  if (
    expectedFinal !== undefined &&
    (execution.finalState === null ||
      (expectedFinal.hitCount !== undefined && expectedFinal.hitCount !== execution.finalState.hitCount) ||
      (expectedFinal.isLocked !== undefined && expectedFinal.isLocked !== execution.finalState.isLocked))
  ) {
    mismatches.push({ kind: "final-state", message: "final state differs" })
  }

  if (expected.status === "rejected") {
    if (
      execution.error === null ||
      expected.error === undefined ||
      execution.error.code !== expected.error.code ||
      execution.error.atInputId !== expected.error.atInputId
    ) {
      mismatches.push({ kind: "error", message: "rejection error differs" })
    }
  }

  return {
    actualStatus: execution.actualStatus,
    ...(scenario.schemaVersion === "1.2.0" ? { classifications: execution.classifications } : {}),
    ...(scenario.schemaVersion === "1.1.0" ? { diagnostics: execution.diagnostics } : {}),
    decisions: execution.decisions,
    error: execution.error,
    expectedStatus: expected.status,
    finalState: execution.finalState,
    mismatches,
    nonEvents,
    path,
    scenarioId: scenario.scenarioId,
    status: mismatches.length === 0 ? "passed" : "failed",
    uncertainty: execution.uncertainty,
    weapon: scenario.weapon
  }
}

function executeScenario(scenario: Scenario, path: string): ScenarioRunResult {
  const duplicateInput = scenario.inputs.find(
    (input, index) => scenario.inputs.findIndex((candidate) => candidate.id === input.id) !== index
  )
  if (duplicateInput !== undefined) throw new RunnerInputError("manifest-duplicate", path)

  const duplicateLine = scenario.inputs.find(
    (input) => new Set(input.lines.map((line) => line.line)).size !== input.lines.length
  )
  if (duplicateLine !== undefined) {
    return compareScenario(scenario, path, {
      actualStatus: "rejected",
      classifications: [],
      diagnostics: [],
      decisions: [],
      error: { code: "duplicate-line-reading", atInputId: duplicateLine.id },
      finalState: null,
      uncertainty: []
    })
  }

  const lineNames = new Set(scenario.lineModel.names)
  const unknownLine = scenario.inputs.flatMap((input) => input.lines).find((line) => !lineNames.has(line.line))
  if (unknownLine !== undefined) throw new RunnerInputError("invalid-schema", path)

  let timingTable: TimingTable
  try {
    timingTable = loadTimingTableForRuleRevision(scenario.ruleRevision)
  } catch {
    return compareScenario(scenario, path, {
      actualStatus: "rejected",
      classifications: [],
      diagnostics: [],
      decisions: [],
      error: { code: "unknown-rule-revision" },
      finalState: null,
      uncertainty: []
    })
  }

  const useResistance = scenario.weapon === "epee" && isResistanceScenario(scenario)
  const classifications =
    scenario.schemaVersion === "1.2.0"
      ? classifyFoilScenarioInputs(scenario.inputs, scenario.lineModel.names, timingTable)
      : []
  const diagnostics: SabreScenarioDiagnosticEvidence[] = []
  let scorer:
    | ReturnType<typeof createEpeeScoringState>
    | ReturnType<typeof createEpeeResistanceScoringState>
    | ReturnType<typeof createFoilScoringState>
    | ReturnType<typeof createSabreScoringState>
  if (useResistance) scorer = createEpeeResistanceScoringState()
  else if (scenario.weapon === "epee") scorer = createEpeeScoringState()
  else if (scenario.weapon === "foil") scorer = createFoilScoringState()
  else scorer = createSabreScoringState()

  const hits: {
    side: Side
    startedAtUs: number
    qualifiedAtUs: number
    classification?: "on-target" | "off-target"
  }[] = []
  const uncertainties: ActualUncertainty[] = []
  let error: { code: string; atInputId?: string } | null = null
  let lastInput: ScenarioInput | undefined
  try {
    if (scenario.weapon === "sabre") {
      const evidence = runSabreScenarioEvidence(scenario.inputs, timingTable)
      scorer = evidence.state
      diagnostics.push(...evidence.diagnostics)
      hits.push(...evidence.state.hits.map((hit) => ({ ...hit })))
    } else {
      for (const input of scenario.inputs) {
        lastInput = input
        if (scenario.weapon === "epee" && useResistance) {
          const previousDecisionCount = (scorer as ReturnType<typeof createEpeeResistanceScoringState>).decisions.length
          scorer = advanceEpeeResistanceScoring(
            scorer as ReturnType<typeof createEpeeResistanceScoringState>,
            mapEpeeResistance(input),
            timingTable
          )
          const resistanceState = scorer as ReturnType<typeof createEpeeResistanceScoringState>
          for (const decision of resistanceState.decisions.slice(previousDecisionCount)) {
            if (decision.disposition === "uncertainty")
              uncertainties.push({
                atUs: decision.atUs,
                outcome: "indeterminate",
                rangeMilliOhms: decision.rangeMilliOhms,
                scope: `${decision.side}.${decision.subject === "ground-reference" ? "ground-reference" : "tip-loop"}`
              })
          }
          hits.push(...resistanceState.hits.slice(hits.length).map((hit) => ({ ...hit })))
        } else if (scenario.weapon === "epee") {
          scorer = advanceEpeeScoring(
            scorer as ReturnType<typeof createEpeeScoringState>,
            mapSimpleEpee(input),
            timingTable
          )
          const nextHits = (scorer as ReturnType<typeof createEpeeScoringState>).hits
          hits.push(...nextHits.slice(hits.length).map((hit) => ({ ...hit })))
        } else {
          scorer = advanceFoilScoring(
            scorer as ReturnType<typeof createFoilScoringState>,
            projectFoilScenarioInput(input),
            timingTable
          )
          const nextHits = (scorer as ReturnType<typeof createFoilScoringState>).hits
          hits.push(...nextHits.slice(hits.length).map((hit) => ({ ...hit })))
        }
      }
    }
  } catch (caught) {
    // The owned scorer implementations throw Error instances; retain a stable
    // fallback for defensive callers without fabricating a test-only throw.
    /* v8 ignore next */
    const message = caught instanceof Error ? caught.message : "scorer rejected input"
    error = {
      code: message.includes("monotonic") ? "non-monotonic-time" : "invalid-line-state",
      atInputId: caught instanceof SabreScenarioEvidenceError ? caught.inputId : lastInput?.id
    }
  }

  const actualStatus = error === null ? "accepted" : "rejected"
  const actualDecisions: ActualDecision[] = hits.map((hit) => ({
    decisionAtUs: hit.qualifiedAtUs,
    disposition: hit.classification === "off-target" ? "off-target" : "qualified-hit",
    ...(hit.classification === "off-target" ? {} : { hitStartedAtUs: hit.startedAtUs }),
    qualifiedAtUs: hit.qualifiedAtUs,
    side: hit.side,
    sourceInputIds: [
      ...new Set([
        ...inputIdsAt(scenario.inputs, hit.startedAtUs, hit.side),
        ...inputIdsAt(scenario.inputs, hit.qualifiedAtUs, hit.side)
      ])
    ],
    weapon: scenario.weapon,
    signal: {
      audible: "requested",
      latched: true,
      visual: hit.classification === "off-target" ? "off-target" : "valid-hit"
    }
  }))

  const finalState =
    error !== null
      ? null
      : scenario.weapon === "epee" && useResistance
        ? {
            hitCount: (scorer as ReturnType<typeof createEpeeResistanceScoringState>).hits.length,
            isLocked: (scorer as ReturnType<typeof createEpeeResistanceScoringState>).isLocked
          }
        : scenario.weapon === "epee"
          ? {
              hitCount: (scorer as ReturnType<typeof createEpeeScoringState>).hits.length,
              isLocked: (scorer as ReturnType<typeof createEpeeScoringState>).isLocked
            }
          : scenario.weapon === "foil"
            ? {
                hitCount: (scorer as ReturnType<typeof createFoilScoringState>).hits.length,
                isLocked: (scorer as ReturnType<typeof createFoilScoringState>).isLocked
              }
            : {
                hitCount: (scorer as ReturnType<typeof createSabreScoringState>).hits.length,
                isLocked: (scorer as ReturnType<typeof createSabreScoringState>).isLocked
              }

  return compareScenario(scenario, path, {
    actualStatus,
    classifications,
    diagnostics,
    decisions: actualDecisions,
    error,
    finalState,
    uncertainty: uncertainties
  })
}

function runScenarioFile(filePath: string): ScenarioRunResult {
  const parsed = parseJsonFile(filePath, "scenario") as Scenario
  return executeScenario(parsed, pathForReport(filePath))
}

function manifestScenarioPaths(manifest: JsonObject, manifestPath: string): string[] {
  const scenarioEntries = manifest.scenarios as JsonObject[]
  const ids = scenarioEntries.map((entry) => entry.scenarioId as string)
  if (ids.some((id, index) => ids.indexOf(id) !== index)) throw new RunnerInputError("manifest-duplicate", manifestPath)
  if (ids.some((id, index) => id !== [...ids].sort()[index])) throw new RunnerInputError("manifest-order", manifestPath)

  const manifestDirectory = dirname(manifestPath)
  const paths: string[] = []
  const listedPaths = new Set<string>()
  for (const entry of scenarioEntries) {
    const scenarioPath = resolve(manifestDirectory, entry.path as string)
    if (listedPaths.has(scenarioPath)) throw new RunnerInputError("manifest-duplicate", manifestPath)
    listedPaths.add(scenarioPath)
    if (entry.status !== "active") continue
    const scenario = parseJsonFile(scenarioPath, "scenario") as Scenario
    const scenarioSourceIds = (scenario.sources as unknown[]).map((source) => (source as JsonObject).id).sort()
    const manifestSourceIds = (entry.sourceIds as unknown[]).slice().sort()
    if (
      !sameJson(scenarioSourceIds, manifestSourceIds) ||
      scenario.scenarioId !== entry.scenarioId ||
      scenario.weapon !== entry.weapon
    )
      throw new RunnerInputError("manifest-path", manifestPath)
    paths.push(scenarioPath)
  }

  const goldenDirectory = resolve(manifestDirectory, "golden-scenarios")
  try {
    for (const file of readdirSync(goldenDirectory)) {
      if (extname(file) === ".json" && !listedPaths.has(resolve(goldenDirectory, file)))
        throw new RunnerInputError("manifest-path", manifestPath)
    }
  } catch (error) {
    if (error instanceof RunnerInputError) throw error
    throw new RunnerInputError("execution-error", goldenDirectory)
  }
  return paths
}

function invalidReport(kind: "scenario" | "manifest", inputPath: string, error: RunnerInputError): ScenarioRunReport {
  return {
    error: { code: error.code, path: pathForReport(error.filePath) },
    format: SCENARIO_RUN_REPORT_FORMAT,
    input: { kind, path: pathForReport(inputPath) },
    runner: "golden-scenario-runner",
    schemaVersion: SCENARIO_RUN_REPORT_VERSION,
    scenarios: [],
    status: "invalid-input",
    summary: { failed: 0, passed: 0, scenarioCount: 0 }
  }
}

export function runScenario(inputPath: string): ScenarioRun {
  const resolvedPath = resolve(inputPath)
  let kind: "scenario" | "manifest" = "scenario"
  try {
    if (!existsSync(resolvedPath)) throw new RunnerInputError("path-not-found", resolvedPath)
    try {
      const candidate = JSON.parse(readFileSync(resolvedPath, "utf8")) as unknown
      if (isObject(candidate) && candidate.format === "scoring-golden-corpus") kind = "manifest"
    } catch {
      // parseJsonFile below emits the stable invalid-json report.
    }
    const raw = parseJsonFile(resolvedPath, kind)
    const scenarioPaths = kind === "manifest" ? manifestScenarioPaths(raw, resolvedPath) : [resolvedPath]
    const scenarios = scenarioPaths
      .map(runScenarioFile)
      .sort((left, right) => compareText(left.scenarioId, right.scenarioId))
    const passed = scenarios.filter((scenario) => scenario.status === "passed").length
    const report: ScenarioRunReport = {
      error: null,
      format: SCENARIO_RUN_REPORT_FORMAT,
      input: { kind, path: pathForReport(resolvedPath) },
      runner: "golden-scenario-runner",
      schemaVersion: SCENARIO_RUN_REPORT_VERSION,
      scenarios,
      status: passed === scenarios.length ? "passed" : "failed",
      summary: { failed: scenarios.length - passed, passed, scenarioCount: scenarios.length }
    }
    return { exitCode: report.status === "passed" ? 0 : 1, report }
  } catch (error) {
    // Expected validation and filesystem failures are normalized above. This
    // final guard intentionally remains for unforeseen platform exceptions.
    /* v8 ignore next */
    const inputError = error instanceof RunnerInputError ? error : new RunnerInputError("execution-error", resolvedPath)
    return { exitCode: 2, report: invalidReport(kind, resolvedPath, inputError) }
  }
}

export function serializeScenarioRunReport(report: ScenarioRunReport): string {
  return `${JSON.stringify(report, null, 2)}\n`
}
