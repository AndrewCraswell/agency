/**
 * CW-03 language-neutral scoring semantics.
 *
 * This is deliberately a bounded logical schema, not a C layout or a
 * WebAssembly byte ABI. CW-04 owns bytes, endianness, and version negotiation.
 */

export const NORMALIZED_SCORING_SCHEMA_VERSION = 1
export const MAX_NORMALIZED_DIAGNOSTICS = 8
export const MAX_NORMALIZED_FAULTS = 8
export const MAX_NORMALIZED_DECISIONS = 2

const MAX_UINT8 = 0xff
const MAX_UINT16 = 0xffff
const MAX_UINT32 = 0xffff_ffff
const MAX_UINT64_DECIMAL = "18446744073709551615"

export type CanonicalUint64 = string
export type ScoringWeapon = "epee" | "foil" | "sabre"
export type ScoringSide = "left" | "right"
export type SignalStatus = "active" | "inactive" | "indeterminate" | "not-applicable" | "unavailable"
export type DiagnosticCode =
  | "control-break"
  | "external-path"
  | "grounded"
  | "input-indeterminate"
  | "insulation"
  | "reset-required"
  | "white"
  | "yellow"
export type FaultCode =
  | "acquisition-unavailable"
  | "capacity-exhausted"
  | "clock-fault"
  | "configuration-fault"
  | "line-fault"
  | "state-fault"
  | "timestamp-overflow"

export type NormalizedSignals = Readonly<{
  control: SignalStatus
  point: SignalStatus
  target: SignalStatus
  weapon: SignalStatus
}>

export type NormalizedSideInput = Readonly<{
  signals: NormalizedSignals
}>

export type NormalizedDiagnostic = Readonly<{
  code: DiagnosticCode
  side: ScoringSide | "none"
}>

export type NormalizedFault = Readonly<{
  code: FaultCode
  side: ScoringSide | "none"
}>

export type NormalizedSampleInput = Readonly<{
  atUs: CanonicalUint64
  diagnostics: readonly NormalizedDiagnostic[]
  faults: readonly NormalizedFault[]
  inputId: number
  kind: "sample"
  left: NormalizedSideInput
  right: NormalizedSideInput
  schemaVersion: typeof NORMALIZED_SCORING_SCHEMA_VERSION
  weapon: ScoringWeapon
}>

export type NormalizedResetInput = Readonly<{
  atUs: CanonicalUint64
  inputId: number
  kind: "reset"
  resetReason: "bout" | "recovery" | "weapon-change"
  schemaVersion: typeof NORMALIZED_SCORING_SCHEMA_VERSION
  weapon: ScoringWeapon
}>

export type NormalizedScoringInput = NormalizedResetInput | NormalizedSampleInput

export type NormalizedSideState = Readonly<{
  candidate: "none" | "pending" | "qualified"
  candidateSinceUs: CanonicalUint64
  registered: "no" | "yes"
}>

export type NormalizedScoringState = Readonly<{
  availability: "available" | "indeterminate" | "unavailable"
  diagnostics: readonly NormalizedDiagnostic[]
  faults: readonly NormalizedFault[]
  lastInputAtUs: CanonicalUint64
  lastInputId: number
  left: NormalizedSideState
  lockoutEndsAtUs: CanonicalUint64
  outputCapacity: number
  right: NormalizedSideState
  schemaVersion: typeof NORMALIZED_SCORING_SCHEMA_VERSION
  weapon: ScoringWeapon
}>

export type NormalizedDecision = Readonly<{
  atUs: CanonicalUint64
  audible: "no" | "yes"
  disposition: "indeterminate" | "none" | "off-target" | "qualified-hit" | "unavailable"
  latched: "no" | "yes"
  side: ScoringSide
  startedAtUs: CanonicalUint64
  visual: "none" | "off-target" | "valid-hit"
}>

export type NormalizedResult = Readonly<{
  diagnostics: readonly NormalizedDiagnostic[]
  errorCode: "capacity" | "exhausted" | "fault" | "none" | "overflow" | "unavailable"
  inputId: number
  left: NormalizedDecision
  right: NormalizedDecision
  schemaVersion: typeof NORMALIZED_SCORING_SCHEMA_VERSION
  state: "accepted" | "capacity" | "exhausted" | "fault" | "indeterminate" | "overflow" | "reset" | "unavailable"
}>

export class NormalizedScoringSchemaError extends Error {
  readonly code: "bounds" | "fields" | "integer" | "kind" | "schema-version" | "value"

  constructor(code: NormalizedScoringSchemaError["code"]) {
    super(`Invalid normalized scoring schema: ${code}`)
    this.code = code
    this.name = "NormalizedScoringSchemaError"
  }
}

function assertPlainDataTree(value: unknown, seen = new WeakSet<object>()): void {
  if (typeof value === "string" || typeof value === "number") {
    return
  }
  if (typeof value !== "object" || value === null || seen.has(value)) {
    throw new NormalizedScoringSchemaError("value")
  }
  seen.add(value)

  const keys = Reflect.ownKeys(value)
  const descriptors = Object.getOwnPropertyDescriptors(value)
  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype || keys.length !== value.length + 1) {
      throw new NormalizedScoringSchemaError("value")
    }
    const length = descriptors.length
    if (length === undefined || !("value" in length) || length.value !== value.length) {
      throw new NormalizedScoringSchemaError("value")
    }
    for (let index = 0; index < value.length; index += 1) {
      const key = String(index)
      const descriptor = descriptors[key]
      if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
        throw new NormalizedScoringSchemaError("value")
      }
      assertPlainDataTree(descriptor.value, seen)
    }
    return
  }

  if (Object.getPrototypeOf(value) !== Object.prototype) {
    throw new NormalizedScoringSchemaError("value")
  }
  for (const key of keys) {
    if (typeof key !== "string") {
      throw new NormalizedScoringSchemaError("value")
    }
    const descriptor = descriptors[key]
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
      throw new NormalizedScoringSchemaError("value")
    }
    assertPlainDataTree(descriptor.value, seen)
  }
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(value))) {
      if ("value" in descriptor) {
        deepFreeze(descriptor.value)
      }
    }
    Object.freeze(value)
  }
  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function record(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new NormalizedScoringSchemaError("value")
  }
  return value
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): void {
  const actual = Reflect.ownKeys(value)
  if (actual.length !== keys.length || actual.some((key) => typeof key !== "string" || !keys.includes(key))) {
    throw new NormalizedScoringSchemaError("fields")
  }
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T {
  for (const candidate of allowed) {
    if (value === candidate) {
      return candidate
    }
  }
  throw new NormalizedScoringSchemaError("value")
}

function unsigned(value: unknown, maximum: number): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value > maximum) {
    throw new NormalizedScoringSchemaError("integer")
  }
  return value
}

function uint64(value: unknown): CanonicalUint64 {
  if (typeof value !== "string" || !/^(0|[1-9][0-9]{0,19})$/u.test(value)) {
    throw new NormalizedScoringSchemaError("integer")
  }
  if (value.length === MAX_UINT64_DECIMAL.length && value > MAX_UINT64_DECIMAL) {
    throw new NormalizedScoringSchemaError("integer")
  }
  return value
}

function schemaVersion(value: unknown): typeof NORMALIZED_SCORING_SCHEMA_VERSION {
  if (value !== NORMALIZED_SCORING_SCHEMA_VERSION) {
    throw new NormalizedScoringSchemaError("schema-version")
  }
  return NORMALIZED_SCORING_SCHEMA_VERSION
}

function signals(value: unknown): NormalizedSignals {
  const source = record(value)
  exactKeys(source, ["control", "point", "target", "weapon"])
  const signalStatus = ["active", "inactive", "indeterminate", "not-applicable", "unavailable"] as const
  return {
    control: oneOf(source.control, signalStatus),
    point: oneOf(source.point, signalStatus),
    target: oneOf(source.target, signalStatus),
    weapon: oneOf(source.weapon, signalStatus)
  }
}

function sideInput(value: unknown): NormalizedSideInput {
  const source = record(value)
  exactKeys(source, ["signals"])
  return { signals: signals(source.signals) }
}

function diagnostic(value: unknown): NormalizedDiagnostic {
  const source = record(value)
  exactKeys(source, ["code", "side"])
  return {
    code: oneOf(source.code, [
      "control-break",
      "external-path",
      "grounded",
      "input-indeterminate",
      "insulation",
      "reset-required",
      "white",
      "yellow"
    ]),
    side: oneOf(source.side, ["left", "right", "none"])
  }
}

function fault(value: unknown): NormalizedFault {
  const source = record(value)
  exactKeys(source, ["code", "side"])
  return {
    code: oneOf(source.code, [
      "acquisition-unavailable",
      "capacity-exhausted",
      "clock-fault",
      "configuration-fault",
      "line-fault",
      "state-fault",
      "timestamp-overflow"
    ]),
    side: oneOf(source.side, ["left", "right", "none"])
  }
}

function boundedList<T>(value: unknown, maximum: number, parser: (item: unknown) => T): readonly T[] {
  if (!Array.isArray(value) || value.length > maximum) {
    throw new NormalizedScoringSchemaError("bounds")
  }
  return value.map(parser)
}

function weapon(value: unknown): ScoringWeapon {
  return oneOf(value, ["epee", "foil", "sabre"])
}

function sideState(value: unknown): NormalizedSideState {
  const source = record(value)
  exactKeys(source, ["candidate", "candidateSinceUs", "registered"])
  return {
    candidate: oneOf(source.candidate, ["none", "pending", "qualified"]),
    candidateSinceUs: uint64(source.candidateSinceUs),
    registered: oneOf(source.registered, ["no", "yes"])
  }
}

function decision(value: unknown, side: ScoringSide): NormalizedDecision {
  const source = record(value)
  exactKeys(source, ["atUs", "audible", "disposition", "latched", "side", "startedAtUs", "visual"])
  if (source.side !== side) {
    throw new NormalizedScoringSchemaError("value")
  }
  const parsed = {
    atUs: uint64(source.atUs),
    audible: oneOf(source.audible, ["no", "yes"]),
    disposition: oneOf(source.disposition, ["indeterminate", "none", "off-target", "qualified-hit", "unavailable"]),
    latched: oneOf(source.latched, ["no", "yes"]),
    side,
    startedAtUs: uint64(source.startedAtUs),
    visual: oneOf(source.visual, ["none", "off-target", "valid-hit"])
  }
  const silent = parsed.audible === "no" && parsed.latched === "no" && parsed.visual === "none"
  if (parsed.disposition === "none") {
    if (!silent || parsed.atUs !== "0" || parsed.startedAtUs !== "0") {
      throw new NormalizedScoringSchemaError("value")
    }
  } else if (parsed.disposition === "qualified-hit") {
    if (parsed.audible !== "yes" || parsed.latched !== "yes" || parsed.visual !== "valid-hit") {
      throw new NormalizedScoringSchemaError("value")
    }
  } else if (parsed.disposition === "off-target") {
    if (parsed.audible !== "no" || parsed.latched !== "yes" || parsed.visual !== "off-target") {
      throw new NormalizedScoringSchemaError("value")
    }
  } else if (!silent) {
    throw new NormalizedScoringSchemaError("value")
  }
  if (
    parsed.atUs.length < parsed.startedAtUs.length ||
    (parsed.atUs.length === parsed.startedAtUs.length && parsed.atUs < parsed.startedAtUs)
  ) {
    throw new NormalizedScoringSchemaError("value")
  }
  return parsed
}

function assertResultCoherence(result: NormalizedResult): void {
  const expectedError: Readonly<Record<NormalizedResult["state"], NormalizedResult["errorCode"]>> = {
    accepted: "none",
    capacity: "capacity",
    exhausted: "exhausted",
    fault: "fault",
    indeterminate: "none",
    overflow: "overflow",
    reset: "none",
    unavailable: "unavailable"
  }
  if (result.errorCode !== expectedError[result.state]) {
    throw new NormalizedScoringSchemaError("value")
  }
  const allowed: Readonly<Record<NormalizedResult["state"], readonly NormalizedDecision["disposition"][]>> = {
    accepted: ["none", "off-target", "qualified-hit"],
    capacity: ["none"],
    exhausted: ["none"],
    fault: ["none"],
    indeterminate: ["indeterminate", "none"],
    overflow: ["none"],
    reset: ["none"],
    unavailable: ["none", "unavailable"]
  }
  const permits = (disposition: NormalizedDecision["disposition"]): boolean =>
    allowed[result.state].some((allowedDisposition) => allowedDisposition === disposition)
  if (!permits(result.left.disposition) || !permits(result.right.disposition)) {
    throw new NormalizedScoringSchemaError("value")
  }
}

/** Parses a complete sample or reset command with no omitted or extra fields. */
export function parseNormalizedScoringInput(value: unknown): NormalizedScoringInput {
  assertPlainDataTree(value)
  const source = record(value)
  if (source.kind === "sample") {
    exactKeys(source, ["atUs", "diagnostics", "faults", "inputId", "kind", "left", "right", "schemaVersion", "weapon"])
    return deepFreeze({
      atUs: uint64(source.atUs),
      diagnostics: boundedList(source.diagnostics, MAX_NORMALIZED_DIAGNOSTICS, diagnostic),
      faults: boundedList(source.faults, MAX_NORMALIZED_FAULTS, fault),
      inputId: unsigned(source.inputId, MAX_UINT32),
      kind: "sample",
      left: sideInput(source.left),
      right: sideInput(source.right),
      schemaVersion: schemaVersion(source.schemaVersion),
      weapon: weapon(source.weapon)
    })
  }
  if (source.kind === "reset") {
    exactKeys(source, ["atUs", "inputId", "kind", "resetReason", "schemaVersion", "weapon"])
    return deepFreeze({
      atUs: uint64(source.atUs),
      inputId: unsigned(source.inputId, MAX_UINT32),
      kind: "reset",
      resetReason: oneOf(source.resetReason, ["bout", "recovery", "weapon-change"]),
      schemaVersion: schemaVersion(source.schemaVersion),
      weapon: weapon(source.weapon)
    })
  }
  throw new NormalizedScoringSchemaError("kind")
}

/** Parses opaque bounded state. It does not apply scoring rules or transitions. */
export function parseNormalizedScoringState(value: unknown): NormalizedScoringState {
  assertPlainDataTree(value)
  const source = record(value)
  exactKeys(source, [
    "availability",
    "diagnostics",
    "faults",
    "lastInputAtUs",
    "lastInputId",
    "left",
    "lockoutEndsAtUs",
    "outputCapacity",
    "right",
    "schemaVersion",
    "weapon"
  ])
  return deepFreeze({
    availability: oneOf(source.availability, ["available", "indeterminate", "unavailable"]),
    diagnostics: boundedList(source.diagnostics, MAX_NORMALIZED_DIAGNOSTICS, diagnostic),
    faults: boundedList(source.faults, MAX_NORMALIZED_FAULTS, fault),
    lastInputAtUs: uint64(source.lastInputAtUs),
    lastInputId: unsigned(source.lastInputId, MAX_UINT32),
    left: sideState(source.left),
    lockoutEndsAtUs: uint64(source.lockoutEndsAtUs),
    outputCapacity: unsigned(source.outputCapacity, MAX_UINT8),
    right: sideState(source.right),
    schemaVersion: schemaVersion(source.schemaVersion),
    weapon: weapon(source.weapon)
  })
}

/** Parses a bounded result receipt. `left` and `right` preserve simultaneous decisions without ordering by side. */
export function parseNormalizedScoringResult(value: unknown): NormalizedResult {
  assertPlainDataTree(value)
  const source = record(value)
  exactKeys(source, ["diagnostics", "errorCode", "inputId", "left", "right", "schemaVersion", "state"])
  const parsed = {
    diagnostics: boundedList(source.diagnostics, MAX_NORMALIZED_DIAGNOSTICS, diagnostic),
    errorCode: oneOf(source.errorCode, ["capacity", "exhausted", "fault", "none", "overflow", "unavailable"]),
    inputId: unsigned(source.inputId, MAX_UINT32),
    left: decision(source.left, "left"),
    right: decision(source.right, "right"),
    schemaVersion: schemaVersion(source.schemaVersion),
    state: oneOf(source.state, [
      "accepted",
      "capacity",
      "exhausted",
      "fault",
      "indeterminate",
      "overflow",
      "reset",
      "unavailable"
    ])
  }
  assertResultCoherence(parsed)
  return deepFreeze(parsed)
}

export const NORMALIZED_UINT_WIDTHS = Object.freeze({
  u16: MAX_UINT16,
  u32: MAX_UINT32,
  u64: MAX_UINT64_DECIMAL,
  u8: MAX_UINT8
})
