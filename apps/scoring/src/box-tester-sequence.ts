/**
 * BT-04 canonical-scenario compiler for the independent box tester.
 *
 * This module is intentionally an authoring-to-plan boundary. It does not
 * decide a touch, choose a resistance, or drive hardware. BT-03 and later
 * milestones own the electrical implementation of these logical steps.
 */

export const BOX_TESTER_SEQUENCE_FORMAT = "scoring-box-tester-sequence"
export const BOX_TESTER_SEQUENCE_VERSION = "1.0.0"
export const MAX_BOX_TESTER_SEQUENCE_INPUTS = 4096
export const MAX_BOX_TESTER_SEQUENCE_LINES_PER_INPUT = 32
export const MAX_BOX_TESTER_SEQUENCE_EXPECTATIONS = 4096

type JsonPrimitive = boolean | null | number | string
interface JsonArray extends ReadonlyArray<JsonValue> {}
interface JsonObjectValue {
  readonly [key: string]: JsonValue
}
type JsonValue = JsonPrimitive | JsonArray | JsonObjectValue
type JsonRecord = Record<string, unknown>

export type BoxTesterLineState =
  | "closed"
  | "disconnected"
  | "grounded"
  | "indeterminate"
  | "not-applicable"
  | "open"
  | "shorted"

export type BoxTesterLineStep = Readonly<{
  faultCode?: string
  line: string
  resistanceMilliOhms: number | null
  resistanceUncertaintyMilliOhms: number | null
  state: BoxTesterLineState
}>

export type BoxTesterStimulusStep = Readonly<{
  atUncertaintyUs: number
  atUs: number
  inputId: string
  kind: "stimulus"
  lines: readonly BoxTesterLineStep[]
}>

export type BoxTesterExpectationStep = Readonly<{
  atUs: number
  expectation: JsonValue
  expectationId: string
  kind: "expect-classification" | "expect-decision" | "expect-diagnostic" | "expect-uncertainty"
}>

export type BoxTesterNoDecisionExpectationStep = Readonly<{
  assertionReasonCode: string
  expectation: JsonValue
  expectationId: string
  kind: "expect-no-decision"
  window: Readonly<{ fromUs: number; throughUs: number }>
}>

export type BoxTesterSequence = Readonly<{
  format: typeof BOX_TESTER_SEQUENCE_FORMAT
  scenarioId: string
  sequenceVersion: typeof BOX_TESTER_SEQUENCE_VERSION
  stimulus: readonly BoxTesterStimulusStep[]
  expectations: readonly (BoxTesterExpectationStep | BoxTesterNoDecisionExpectationStep)[]
  weapon: "epee" | "foil" | "sabre"
}>

const lineStates = new Set<BoxTesterLineState>([
  "closed",
  "disconnected",
  "grounded",
  "indeterminate",
  "not-applicable",
  "open",
  "shorted"
])

const rootKeys = new Set([
  "$schema",
  "format",
  "schemaVersion",
  "scenarioId",
  "title",
  "weapon",
  "ruleRevision",
  "sources",
  "lineModel",
  "determinism",
  "replay",
  "inputs",
  "expect"
])
const inputKeys = new Set(["id", "atUs", "atUncertaintyUs", "mode", "lines"])
const lineKeys = new Set(["line", "state", "resistanceMilliOhms", "resistanceUncertaintyMilliOhms", "faultCode"])
const expectationKeys = new Set([
  "status",
  "decisions",
  "diagnostics",
  "classifications",
  "nonEvents",
  "uncertainty",
  "finalState",
  "error"
])
const decisionKeys = new Set([
  "id",
  "decisionAtUs",
  "disposition",
  "weapon",
  "side",
  "attemptedSide",
  "hitStartedAtUs",
  "qualifiedAtUs",
  "attemptedAtUs",
  "reason",
  "lineId",
  "diagnostic",
  "detectedAtUs",
  "persistence",
  "cause",
  "resetAtUs",
  "scope",
  "effect",
  "lowerBound",
  "observedAtUs",
  "subject",
  "unit",
  "upperBound",
  "calibrationId",
  "performedAtUs",
  "status",
  "signal",
  "sourceInputIds"
])
const nonEventKeys = new Set(["id", "window", "assertion", "side", "assertionReasonCode"])
const uncertaintyKeys = new Set(["id", "atUs", "scope", "outcome", "assertionReasonCode", "rangeMilliOhms"])
const diagnosticKeys = new Set(["id", "atUs", "side", "indication", "reason", "audible", "latched", "sourceInputIds"])
const classificationKeys = new Set([
  "id",
  "atUs",
  "sourceInputId",
  "kind",
  "disposition",
  "permittedIndications",
  "rangeMilliOhms"
])

function fail(reason: string): never {
  throw new RangeError(`BT-04 sequence cannot compile: ${reason}`)
}

function isPlainRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype
}

function assertDataRecord(value: unknown, path: string): asserts value is JsonRecord {
  if (!isPlainRecord(value)) fail(`${path} must be a plain data record`)
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string") fail(`${path} cannot contain symbol keys`)
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
      fail(`${path}.${key} must be an enumerable data property`)
    }
  }
}

function assertOnlyKeys(value: JsonRecord, allowed: ReadonlySet<string>, path: string): void {
  for (const key of Object.keys(value)) if (!allowed.has(key)) fail(`${path}.${key} is unsupported`)
}

function assertRequiredKeys(value: JsonRecord, keys: readonly string[], path: string): void {
  for (const key of keys) if (!Object.hasOwn(value, key)) fail(`${path}.${key} is required`)
}

function assertSafeNonNegativeInteger(value: unknown, path: string): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) fail(`${path} must be a non-negative safe integer`)
}

function assertIdentifier(value: unknown, path: string): asserts value is string {
  if (typeof value !== "string" || !/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/u.test(value)) fail(`${path} is invalid`)
}

function assertString(value: unknown, path: string): asserts value is string {
  if (typeof value !== "string" || value.length === 0) fail(`${path} must be a non-empty string`)
}

function assertArray(value: unknown, path: string): asserts value is unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) fail(`${path} must be a plain array`)
  for (const key of Reflect.ownKeys(value)) {
    if (key === "length") continue
    if (typeof key !== "string" || !/^(?:0|[1-9][0-9]*)$/u.test(key)) fail(`${path} contains an unsupported property`)
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
      fail(`${path}[${key}] must be an enumerable data property`)
    }
  }
}

function assertCanonicalJson(value: unknown, path: string, seen = new WeakSet<object>()): asserts value is JsonValue {
  if (value === null || typeof value === "boolean" || typeof value === "string") return
  if (typeof value === "number") {
    assertSafeNonNegativeInteger(value, path)
    return
  }
  if (typeof value !== "object") fail(`${path} is not JSON data`)
  if (seen.has(value)) fail(`${path} cannot contain aliases or cycles`)
  seen.add(value)
  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype) fail(`${path} must be a plain array`)
    value.forEach((entry, index) => assertCanonicalJson(entry, `${path}[${index}]`, seen))
    return
  }
  assertDataRecord(value, path)
  for (const [key, child] of Object.entries(value)) assertCanonicalJson(child, `${path}.${key}`, seen)
}

function cloneJson(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(cloneJson)
  if (value !== null && typeof value === "object")
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, cloneJson(child)]))
  return value
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) fail("compiler output cannot contain aliases or cycles")
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) fail("compiler output must contain only data properties")
    deepFreeze(descriptor.value, seen)
  }
  return Object.freeze(value)
}

function requireInputIds(value: unknown, knownInputIds: ReadonlySet<string>, path: string): string[] {
  assertArray(value, path)
  if (value.length === 0) fail(`${path} must name an input`)
  const ids: string[] = []
  for (const [index, sourceInputId] of value.entries()) {
    assertIdentifier(sourceInputId, `${path}[${index}]`)
    if (!knownInputIds.has(sourceInputId) || ids.includes(sourceInputId))
      fail(`${path}[${index}] is unknown or duplicated`)
    ids.push(sourceInputId)
  }
  return ids
}

function assertAtOrAfterSourceInputs(
  atUs: number,
  sourceInputIds: readonly string[],
  inputAtUsById: ReadonlyMap<string, number>,
  path: string
): void {
  for (const sourceInputId of sourceInputIds) {
    const sourceAtUs = inputAtUsById.get(sourceInputId)
    if (sourceAtUs === undefined) fail(`${path} references an input without a stimulus timestamp`)
    if (atUs < sourceAtUs) fail(`${path} precedes source input ${sourceInputId} at ${sourceAtUs}us`)
  }
}

function compileExpectation(
  item: unknown,
  kind: BoxTesterExpectationStep["kind"],
  knownInputIds: ReadonlySet<string>,
  inputAtUsById: ReadonlyMap<string, number>,
  path: string
): BoxTesterExpectationStep {
  assertDataRecord(item, path)
  const allowedKeys =
    kind === "expect-decision"
      ? decisionKeys
      : kind === "expect-uncertainty"
        ? uncertaintyKeys
        : kind === "expect-diagnostic"
          ? diagnosticKeys
          : classificationKeys
  const requiredKeys =
    kind === "expect-decision"
      ? ["id", "decisionAtUs", "disposition", "sourceInputIds"]
      : kind === "expect-uncertainty"
        ? ["id", "atUs", "scope", "outcome", "assertionReasonCode"]
        : kind === "expect-diagnostic"
          ? ["id", "atUs", "side", "indication", "reason", "audible", "latched", "sourceInputIds"]
          : ["id", "atUs", "sourceInputId", "kind", "disposition"]
  assertOnlyKeys(item, allowedKeys, path)
  assertRequiredKeys(item, requiredKeys, path)
  assertIdentifier(item.id, `${path}.id`)
  const atKey = kind === "expect-decision" ? "decisionAtUs" : "atUs"
  assertSafeNonNegativeInteger(item[atKey], `${path}.${atKey}`)
  const sourceInputIds =
    kind === "expect-classification"
      ? requireInputIds([item.sourceInputId], knownInputIds, `${path}.sourceInputIds`)
      : kind === "expect-diagnostic" || kind === "expect-decision"
        ? requireInputIds(item.sourceInputIds, knownInputIds, `${path}.sourceInputIds`)
        : undefined
  if (sourceInputIds !== undefined)
    assertAtOrAfterSourceInputs(item[atKey], sourceInputIds, inputAtUsById, `${path}.${atKey}`)
  return {
    atUs: item[atKey] as number,
    expectation: cloneJson(item as JsonValue),
    expectationId: item.id,
    kind
  }
}

function compileNoDecisionExpectation(item: unknown, path: string): BoxTesterNoDecisionExpectationStep {
  assertDataRecord(item, path)
  assertOnlyKeys(item, nonEventKeys, path)
  assertRequiredKeys(item, ["id", "window", "assertion", "assertionReasonCode"], path)
  assertIdentifier(item.id, `${path}.id`)
  assertString(item.assertionReasonCode, `${path}.assertionReasonCode`)
  if (item.assertion !== "no-decision") fail(`${path}.assertion is unsupported`)
  assertDataRecord(item.window, `${path}.window`)
  assertOnlyKeys(item.window, new Set(["fromUs", "throughUs"]), `${path}.window`)
  assertRequiredKeys(item.window, ["fromUs", "throughUs"], `${path}.window`)
  assertSafeNonNegativeInteger(item.window.fromUs, `${path}.window.fromUs`)
  assertSafeNonNegativeInteger(item.window.throughUs, `${path}.window.throughUs`)
  if (item.window.fromUs > item.window.throughUs) fail(`${path}.window has an invalid range`)
  return {
    assertionReasonCode: item.assertionReasonCode,
    expectation: cloneJson(item as JsonValue),
    expectationId: item.id,
    kind: "expect-no-decision",
    window: { fromUs: item.window.fromUs, throughUs: item.window.throughUs }
  }
}

/**
 * Compiles an accepted M0-07 scenario into a non-actuating BT-04 sequence.
 * Source order is retained: stimuli follow `inputs`; expectations follow each
 * authored expectation array without timestamp sorting.
 */
export function compileBoxTesterSequence(scenario: unknown): BoxTesterSequence {
  assertDataRecord(scenario, "scenario")
  assertOnlyKeys(scenario, rootKeys, "scenario")
  assertRequiredKeys(scenario, [...rootKeys], "scenario")
  assertCanonicalJson(scenario, "scenario")
  if (scenario.format !== "scoring-golden-scenario") fail("scenario.format is unsupported")
  if (scenario.schemaVersion !== "1.0.0" && scenario.schemaVersion !== "1.1.0" && scenario.schemaVersion !== "1.2.0") {
    fail("scenario.schemaVersion is unsupported")
  }
  assertIdentifier(scenario.scenarioId, "scenario.scenarioId")
  if (scenario.weapon !== "epee" && scenario.weapon !== "foil" && scenario.weapon !== "sabre") {
    fail("scenario.weapon is unsupported")
  }
  assertArray(scenario.sources, "scenario.sources")
  if (scenario.sources.length === 0) fail("scenario.sources must not be empty")
  assertDataRecord(scenario.lineModel, "scenario.lineModel")
  assertRequiredKeys(scenario.lineModel, ["revision", "names"], "scenario.lineModel")
  assertIdentifier(scenario.lineModel.revision, "scenario.lineModel.revision")
  assertArray(scenario.lineModel.names, "scenario.lineModel.names")
  if (scenario.lineModel.names.length === 0) fail("scenario.lineModel.names must not be empty")
  const declaredLines = new Set<string>()
  for (const [index, line] of scenario.lineModel.names.entries()) {
    assertString(line, `scenario.lineModel.names[${index}]`)
    if (declaredLines.has(line)) fail(`scenario.lineModel.names[${index}] is duplicated`)
    declaredLines.add(line)
  }
  assertDataRecord(scenario.determinism, "scenario.determinism")
  if (scenario.determinism.inputOrder !== "listed" || scenario.determinism.resultOrder !== "decision-atUs-then-id") {
    fail("scenario.determinism is unsupported")
  }
  assertSafeNonNegativeInteger(scenario.determinism.seed, "scenario.determinism.seed")
  assertDataRecord(scenario.replay, "scenario.replay")
  if (scenario.replay.clock !== "virtual" || scenario.replay.timeUnit !== "us") fail("scenario.replay is unsupported")
  assertArray(scenario.inputs, "scenario.inputs")
  if (scenario.inputs.length === 0 || scenario.inputs.length > MAX_BOX_TESTER_SEQUENCE_INPUTS) {
    fail("scenario.inputs exceeds compiler capacity")
  }

  const inputIds = new Set<string>()
  const inputAtUsById = new Map<string, number>()
  const stimulus: BoxTesterStimulusStep[] = []
  let previousAtUs = -1
  for (const [inputIndex, input] of scenario.inputs.entries()) {
    const path = `scenario.inputs[${inputIndex}]`
    assertDataRecord(input, path)
    assertOnlyKeys(input, inputKeys, path)
    assertRequiredKeys(input, ["id", "atUs", "atUncertaintyUs", "mode", "lines"], path)
    assertIdentifier(input.id, `${path}.id`)
    if (inputIds.has(input.id)) fail(`${path}.id is duplicated`)
    inputIds.add(input.id)
    assertSafeNonNegativeInteger(input.atUs, `${path}.atUs`)
    assertSafeNonNegativeInteger(input.atUncertaintyUs, `${path}.atUncertaintyUs`)
    if (input.atUs < previousAtUs) fail(`${path}.atUs is non-monotonic`)
    previousAtUs = input.atUs
    inputAtUsById.set(input.id, input.atUs)
    if (input.mode !== "snapshot") fail(`${path}.mode is unsupported`)
    assertArray(input.lines, `${path}.lines`)
    if (input.lines.length === 0 || input.lines.length > MAX_BOX_TESTER_SEQUENCE_LINES_PER_INPUT) {
      fail(`${path}.lines exceeds compiler capacity`)
    }
    const lines: BoxTesterLineStep[] = []
    const inputLineNames = new Set<string>()
    for (const [lineIndex, line] of input.lines.entries()) {
      const linePath = `${path}.lines[${lineIndex}]`
      assertDataRecord(line, linePath)
      assertOnlyKeys(line, lineKeys, linePath)
      assertRequiredKeys(line, ["line", "state", "resistanceMilliOhms", "resistanceUncertaintyMilliOhms"], linePath)
      assertString(line.line, `${linePath}.line`)
      if (!declaredLines.has(line.line) || inputLineNames.has(line.line))
        fail(`${linePath}.line is undeclared or duplicated`)
      inputLineNames.add(line.line)
      if (typeof line.state !== "string" || !lineStates.has(line.state as BoxTesterLineState)) {
        fail(`${linePath}.state is unsupported`)
      }
      const hasResistance = line.resistanceMilliOhms !== null
      const hasUncertainty = line.resistanceUncertaintyMilliOhms !== null
      if (hasResistance !== hasUncertainty) fail(`${linePath} must provide both resistance values or neither`)
      if (hasResistance) {
        assertSafeNonNegativeInteger(line.resistanceMilliOhms, `${linePath}.resistanceMilliOhms`)
        assertSafeNonNegativeInteger(line.resistanceUncertaintyMilliOhms, `${linePath}.resistanceUncertaintyMilliOhms`)
      }
      if (Object.hasOwn(line, "faultCode")) assertIdentifier(line.faultCode, `${linePath}.faultCode`)
      lines.push({
        ...(Object.hasOwn(line, "faultCode") ? { faultCode: line.faultCode as string } : {}),
        line: line.line,
        resistanceMilliOhms: line.resistanceMilliOhms as number | null,
        resistanceUncertaintyMilliOhms: line.resistanceUncertaintyMilliOhms as number | null,
        state: line.state as BoxTesterLineState
      })
    }
    stimulus.push({
      atUncertaintyUs: input.atUncertaintyUs,
      atUs: input.atUs,
      inputId: input.id,
      kind: "stimulus",
      lines
    })
  }

  const expected = scenario.expect
  assertDataRecord(expected, "scenario.expect")
  assertOnlyKeys(expected, expectationKeys, "scenario.expect")
  assertRequiredKeys(expected, ["status", "decisions", "nonEvents", "uncertainty"], "scenario.expect")
  if (expected.status !== "accepted" || Object.hasOwn(expected, "error")) {
    fail("rejected scenarios are unsafe to compile into tester commands")
  }
  const expectations: (BoxTesterExpectationStep | BoxTesterNoDecisionExpectationStep)[] = []
  const expectedIds = new Set<string>()
  const expectationGroups: readonly [string, BoxTesterExpectationStep["kind"] | "expect-no-decision"][] = [
    ["decisions", "expect-decision"],
    ["nonEvents", "expect-no-decision"],
    ["uncertainty", "expect-uncertainty"],
    ["diagnostics", "expect-diagnostic"],
    ["classifications", "expect-classification"]
  ]
  const expectationCount = expectationGroups.reduce((count, [group]) => {
    const entries = expected[group]
    if (entries === undefined) return count
    assertArray(entries, `scenario.expect.${group}`)
    return count + entries.length
  }, 0)
  if (expectationCount > MAX_BOX_TESTER_SEQUENCE_EXPECTATIONS) fail("scenario.expect exceeds compiler capacity")
  for (const [group, kind] of expectationGroups) {
    const entries = expected[group]
    if (entries === undefined) continue
    assertArray(entries, `scenario.expect.${group}`)
    for (const [index, entry] of entries.entries()) {
      const path = `scenario.expect.${group}[${index}]`
      assertDataRecord(entry, path)
      assertIdentifier(entry.id, `${path}.id`)
      if (expectedIds.has(entry.id)) fail(`${path}.id is duplicated`)
      expectedIds.add(entry.id)
      if (kind === "expect-no-decision") expectations.push(compileNoDecisionExpectation(entry, path))
      else expectations.push(compileExpectation(entry, kind, inputIds, inputAtUsById, path))
    }
  }
  return deepFreeze({
    expectations,
    format: BOX_TESTER_SEQUENCE_FORMAT,
    scenarioId: scenario.scenarioId,
    sequenceVersion: BOX_TESTER_SEQUENCE_VERSION,
    stimulus,
    weapon: scenario.weapon
  })
}
