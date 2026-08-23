import {
  createScenarioDisplayTimeline,
  isScenarioDisplayDiagnostic,
  type DisplayDiagnosticChannel,
  type DisplayLamp,
  type ScenarioDisplayCase
} from "./scenario-display-projection.js"

export const MAX_DISPLAY_FIXTURE_CASES = 128
export const MAX_DISPLAY_FIXTURE_EVENTS = 4_096
export const MAX_DISPLAY_FIXTURE_LINES_PER_INPUT = 64
export const MAX_DISPLAY_FIXTURE_ID_LENGTH = 128
export const MAX_DISPLAY_FIXTURE_TEXT_LENGTH = 512

export type DisplayFixture = {
  case: ScenarioDisplayCase
  description: string
  eventIndex: number
  expectedProjection: {
    accessibleLabel: string
    audibleRequested: boolean
    authoritativeResult: "available" | "unavailable"
    eventKind: string
    eventLabel: string
    leftLamp: DisplayLamp
    leftWhiteDiagnostic: DisplayDiagnosticChannel
    leftYellowDiagnostic: DisplayDiagnosticChannel
    rightLamp: DisplayLamp
    rightWhiteDiagnostic: DisplayDiagnosticChannel
    rightYellowDiagnostic: DisplayDiagnosticChannel
  }
  id: string
}

export type DisplayFixtureDocument = {
  cases: readonly DisplayFixture[]
  format: "scoring-display-state-fixtures"
  schemaVersion: "1.0.0"
}

export class DisplayFixtureValidationError extends Error {
  readonly code: "fixture-document"

  constructor() {
    super("Invalid scenario display fixture document")
    this.code = "fixture-document"
    this.name = "DisplayFixtureValidationError"
  }
}

function fail(): never {
  throw new DisplayFixtureValidationError()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isString(value: unknown, maximum = MAX_DISPLAY_FIXTURE_TEXT_LENGTH): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maximum
}

function isInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
}

function isOneOf<T extends string>(value: unknown, choices: readonly T[]): value is T {
  return typeof value === "string" && choices.some((choice) => choice === value)
}

function boundedArray(value: unknown): value is unknown[] {
  return Array.isArray(value) && value.length <= MAX_DISPLAY_FIXTURE_EVENTS
}

function validateSignal(value: unknown): void {
  if (
    !isRecord(value) ||
    !isOneOf(value.audible, ["none", "requested"]) ||
    typeof value.latched !== "boolean" ||
    !isOneOf(value.visual, ["diagnostic", "none", "off-target", "valid-hit"])
  )
    fail()
}

function validateDecision(value: unknown, expected: boolean): void {
  if (!isRecord(value) || !isInteger(value.decisionAtUs) || !isString(value.disposition)) fail()
  if (expected && !isString(value.id, MAX_DISPLAY_FIXTURE_ID_LENGTH)) fail()
  if (value.side !== undefined && !isOneOf(value.side, ["left", "right"])) fail()
  validateSignal(value.signal)
}

function validateUncertainty(value: unknown): void {
  if (!isRecord(value) || !isInteger(value.atUs)) fail()
  if (value.id !== undefined && !isString(value.id, MAX_DISPLAY_FIXTURE_ID_LENGTH)) fail()
}

function validateCase(value: unknown): asserts value is ScenarioDisplayCase {
  if (!isRecord(value) || !isRecord(value.expected) || !isRecord(value.result) || !isRecord(value.scenario)) fail()
  const { expected, result, scenario } = value
  if (!isOneOf(scenario.weapon, ["epee", "foil", "sabre"]) || !boundedArray(scenario.inputs)) fail()
  const inputIds: string[] = []
  for (const input of scenario.inputs) {
    if (!isRecord(input) || !isString(input.id, MAX_DISPLAY_FIXTURE_ID_LENGTH) || !isInteger(input.atUs)) fail()
    if (!Array.isArray(input.lines) || input.lines.length > MAX_DISPLAY_FIXTURE_LINES_PER_INPUT) fail()
    inputIds.push(input.id)
    const lineNames: string[] = []
    for (const line of input.lines) {
      if (!isRecord(line) || !isString(line.line, MAX_DISPLAY_FIXTURE_ID_LENGTH) || !isString(line.state)) fail()
      lineNames.push(line.line)
    }
    if (new Set(lineNames).size !== lineNames.length) fail()
  }
  if (new Set(inputIds).size !== inputIds.length) fail()

  if (!boundedArray(expected.decisions) || !boundedArray(expected.nonEvents) || !boundedArray(expected.uncertainty))
    fail()
  expected.decisions.forEach((decision) => validateDecision(decision, true))
  expected.uncertainty.forEach(validateUncertainty)
  for (const nonEvent of expected.nonEvents) {
    if (
      !isRecord(nonEvent) ||
      !isString(nonEvent.id, MAX_DISPLAY_FIXTURE_ID_LENGTH) ||
      !isString(nonEvent.assertion) ||
      !isString(nonEvent.assertionReasonCode) ||
      !isRecord(nonEvent.window) ||
      !isInteger(nonEvent.window.throughUs)
    )
      fail()
  }
  if (expected.status !== undefined && !isOneOf(expected.status, ["accepted", "rejected"])) fail()

  if (!boundedArray(result.decisions) || !boundedArray(result.uncertainty)) fail()
  result.decisions.forEach((decision) => validateDecision(decision, false))
  result.uncertainty.forEach(validateUncertainty)
  if (result.actualStatus !== undefined && !isOneOf(result.actualStatus, ["accepted", "rejected"])) fail()
  if (result.error !== undefined && result.error !== null) {
    if (!isRecord(result.error)) fail()
    if (result.error.atInputId !== undefined && !isString(result.error.atInputId, MAX_DISPLAY_FIXTURE_ID_LENGTH)) fail()
    if (result.error.code !== undefined && !isString(result.error.code)) fail()
  }
  if (result.diagnostics !== undefined) {
    const diagnostics = result.diagnostics
    if (scenario.weapon !== "sabre" || !boundedArray(diagnostics) || !diagnostics.every(isScenarioDisplayDiagnostic))
      fail()
    const inputIdSet = new Set(inputIds)
    if (
      diagnostics.some((diagnostic) =>
        diagnostic.sourceInputIds.some((sourceInputId) => !inputIdSet.has(sourceInputId))
      )
    )
      fail()
    const sorted = diagnostics.toSorted((left, right) => left.atUs - right.atUs || left.side.localeCompare(right.side))
    if (sorted.some((diagnostic, index) => diagnostic !== diagnostics[index])) fail()
  }
}

function validateExpectedProjection(value: unknown): void {
  if (
    !isRecord(value) ||
    !isString(value.accessibleLabel) ||
    typeof value.audibleRequested !== "boolean" ||
    !isOneOf(value.authoritativeResult, ["available", "unavailable"]) ||
    !isOneOf(value.eventKind, ["diagnostic", "expected", "input", "output", "rejection", "uncertainty"]) ||
    !isString(value.eventLabel) ||
    !isOneOf(value.leftLamp, ["off", "off-target", "valid-hit"]) ||
    !isOneOf(value.leftWhiteDiagnostic, ["off", "on"]) ||
    !isOneOf(value.leftYellowDiagnostic, ["off", "on"]) ||
    !isOneOf(value.rightLamp, ["off", "off-target", "valid-hit"]) ||
    !isOneOf(value.rightWhiteDiagnostic, ["off", "on"]) ||
    !isOneOf(value.rightYellowDiagnostic, ["off", "on"])
  )
    fail()
}

export function parseDisplayFixtureDocument(value: unknown): DisplayFixtureDocument {
  if (
    !isRecord(value) ||
    value.format !== "scoring-display-state-fixtures" ||
    value.schemaVersion !== "1.0.0" ||
    !Array.isArray(value.cases) ||
    value.cases.length === 0 ||
    value.cases.length > MAX_DISPLAY_FIXTURE_CASES
  )
    fail()

  const ids: string[] = []
  for (const fixture of value.cases) {
    if (
      !isRecord(fixture) ||
      !isString(fixture.id, MAX_DISPLAY_FIXTURE_ID_LENGTH) ||
      !isString(fixture.description) ||
      !isInteger(fixture.eventIndex)
    )
      fail()
    validateCase(fixture.case)
    validateExpectedProjection(fixture.expectedProjection)
    const timeline = createScenarioDisplayTimeline(fixture.case)
    if (fixture.eventIndex >= timeline.length) fail()
    ids.push(fixture.id)
  }
  if (new Set(ids).size !== ids.length) fail()
  return value as DisplayFixtureDocument
}
