/** CW-03 logical semantics, deliberately separate from the CW-04 byte ABI. */

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
export type DiagnosticCode =
  | "abnormal-change"
  | "control-break"
  | "external-path"
  | "grounded"
  | "input-indeterminate"
  | "insulation"
  | "non-conductive-surface"
  | "own-equipment"
  | "reset-required"
  | "resistance-uncertain"
  | "white"
  | "whipover"
  | "yellow"
export type FaultCode =
  | "acquisition-unavailable"
  | "capacity-exhausted"
  | "clock-fault"
  | "configuration-fault"
  | "line-fault"
  | "state-fault"
  | "timestamp-overflow"
export type NormalizedDiagnostic = Readonly<{ code: DiagnosticCode; side: ScoringSide | "none" }>
export type NormalizedFault = Readonly<{ code: FaultCode; side: ScoringSide | "none" }>

/** Exact C17-facing representation of Rules-1 EpeeResistanceContact. */
export type NormalizedResistanceMeasurement = Readonly<{
  resistanceMilliOhms: CanonicalUint64 | null
  resistanceUncertaintyMilliOhms: CanonicalUint64 | null
}>
export type NormalizedEpeeSideInput = Readonly<{
  circuitComplete: "closed" | "indeterminate" | "open" | "unavailable"
  contactResistance: NormalizedResistanceMeasurement
  groundPathResistance: NormalizedResistanceMeasurement
  groundedMaterial: "grounded" | "indeterminate" | "not-grounded" | "unavailable"
  lineIntegrity: "cross-line" | "indeterminate" | "intact" | "out-of-range" | "unavailable"
}>
export type NormalizedFoilSideInput = Readonly<{
  circuitBreak: "closed" | "indeterminate" | "open" | "unavailable"
  insulation: "indeterminate" | "outside-range" | "unavailable" | "within-range"
  integrity: "indeterminate" | "intact" | "lame-fault" | "unavailable" | "weapon-fault"
  target: "grounded" | "indeterminate" | "non-target" | "target" | "unavailable"
}>
export type NormalizedSabreSideInput = Readonly<{
  bcFault: "abnormal-change" | "control-break" | "indeterminate" | "normal" | "unavailable"
  blade: "absent" | "indeterminate" | "present" | "unavailable"
  externalPath: "eligible" | "ineligible" | "indeterminate" | "unavailable"
  ownEquipment: "absent" | "indeterminate" | "present" | "unavailable"
  target: "indeterminate" | "non-conductive-surface" | "target" | "unavailable"
}>

type InputBase = Readonly<{
  atUs: CanonicalUint64
  diagnostics: readonly NormalizedDiagnostic[]
  faults: readonly NormalizedFault[]
  inputId: number
  kind: "sample"
  schemaVersion: typeof NORMALIZED_SCORING_SCHEMA_VERSION
}>
export type NormalizedEpeeSampleInput = InputBase &
  Readonly<{ left: NormalizedEpeeSideInput; right: NormalizedEpeeSideInput; weapon: "epee" }>
export type NormalizedFoilSampleInput = InputBase &
  Readonly<{ left: NormalizedFoilSideInput; right: NormalizedFoilSideInput; weapon: "foil" }>
export type NormalizedSabreSampleInput = InputBase &
  Readonly<{ left: NormalizedSabreSideInput; right: NormalizedSabreSideInput; weapon: "sabre" }>
export type NormalizedSampleInput = NormalizedEpeeSampleInput | NormalizedFoilSampleInput | NormalizedSabreSampleInput
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
  candidate: "none" | "pending"
  candidateSinceUs: CanonicalUint64
  registered: "no" | "yes"
}>
export type NormalizedBladeHistory =
  | Readonly<{ state: "none" }>
  | Readonly<{
      interruptionCount: number
      lastBlade: "absent" | "present"
      startedAtUs: CanonicalUint64
      state: "active"
    }>
export type NormalizedControlBreakState =
  | Readonly<{ state: "inactive" }>
  | Readonly<{ sinceUs: CanonicalUint64; state: "active" }>
type StateBase = Readonly<{
  availability: "available" | "indeterminate" | "unavailable"
  diagnostics: readonly NormalizedDiagnostic[]
  faults: readonly NormalizedFault[]
  firstHitAtUs: CanonicalUint64
  hasFirstHit: "no" | "yes"
  hasLastInput: "no" | "yes"
  lastInputAtUs: CanonicalUint64
  lastInputId: number
  locked: "no" | "yes"
  lockoutActive: "no" | "yes"
  lockoutEndsAtUs: CanonicalUint64
  outputCapacity: number
  schemaVersion: typeof NORMALIZED_SCORING_SCHEMA_VERSION
}>
export type NormalizedEpeeScoringState = StateBase &
  Readonly<{ left: NormalizedSideState; right: NormalizedSideState; weapon: "epee" }>
export type NormalizedFoilSideState = NormalizedSideState &
  Readonly<{
    candidateClassification: "none" | "off-target" | "on-target"
    insulation: "indeterminate" | "outside-range" | "unavailable" | "within-range"
    observation: "grounded-contact" | "indeterminate" | "lame-fault" | "ready" | "unavailable" | "weapon-fault"
  }>
export type NormalizedFoilScoringState = StateBase &
  Readonly<{ left: NormalizedFoilSideState; right: NormalizedFoilSideState; weapon: "foil" }>
export type NormalizedSabreSideState = NormalizedSideState &
  Readonly<{
    bladeHistory: NormalizedBladeHistory
    controlBreak: NormalizedControlBreakState
    observation:
      | "external-path-ineligible"
      | "indeterminate"
      | "non-conductive-surface"
      | "ready"
      | "unavailable"
      | "whipover-rejection"
    white: "indeterminate" | "unavailable" | "white-off" | "white-on"
    yellow: "indeterminate" | "unavailable" | "yellow-off" | "yellow-on"
  }>
export type NormalizedSabreScoringState = StateBase &
  Readonly<{ left: NormalizedSabreSideState; right: NormalizedSabreSideState; weapon: "sabre" }>
export type NormalizedScoringState =
  | NormalizedEpeeScoringState
  | NormalizedFoilScoringState
  | NormalizedSabreScoringState

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
  faults: readonly NormalizedFault[]
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
  if (value === null || typeof value === "string" || typeof value === "number") return
  if (typeof value !== "object" || value === null || seen.has(value)) throw new NormalizedScoringSchemaError("value")
  seen.add(value)
  const keys = Reflect.ownKeys(value)
  const descriptors = Object.getOwnPropertyDescriptors(value)
  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype || keys.length !== value.length + 1)
      throw new NormalizedScoringSchemaError("value")
    const length = descriptors.length
    if (length === undefined || !("value" in length) || length.value !== value.length)
      throw new NormalizedScoringSchemaError("value")
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = descriptors[String(index)]
      if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor))
        throw new NormalizedScoringSchemaError("value")
      assertPlainDataTree(descriptor.value, seen)
    }
    return
  }
  if (Object.getPrototypeOf(value) !== Object.prototype) throw new NormalizedScoringSchemaError("value")
  for (const key of keys) {
    const descriptor = descriptors[key as string]
    if (typeof key !== "string" || descriptor === undefined || !descriptor.enumerable || !("value" in descriptor))
      throw new NormalizedScoringSchemaError("value")
    assertPlainDataTree(descriptor.value, seen)
  }
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child)
    Object.freeze(value)
  }
  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
function record(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new NormalizedScoringSchemaError("value")
  return value
}
function exactKeys(value: Record<string, unknown>, keys: readonly string[]): void {
  const actual = Reflect.ownKeys(value)
  if (actual.length !== keys.length || actual.some((key) => typeof key !== "string" || !keys.includes(key)))
    throw new NormalizedScoringSchemaError("fields")
}
function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T {
  for (const candidate of allowed) if (value === candidate) return candidate
  throw new NormalizedScoringSchemaError("value")
}
function unsigned(value: unknown, maximum: number): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value > maximum)
    throw new NormalizedScoringSchemaError("integer")
  return value
}
function uint64(value: unknown): CanonicalUint64 {
  if (typeof value !== "string" || !/^(0|[1-9][0-9]{0,19})$/u.test(value))
    throw new NormalizedScoringSchemaError("integer")
  if (value.length === MAX_UINT64_DECIMAL.length && value > MAX_UINT64_DECIMAL)
    throw new NormalizedScoringSchemaError("integer")
  return value
}
function schemaVersion(value: unknown): typeof NORMALIZED_SCORING_SCHEMA_VERSION {
  if (value !== NORMALIZED_SCORING_SCHEMA_VERSION) throw new NormalizedScoringSchemaError("schema-version")
  return NORMALIZED_SCORING_SCHEMA_VERSION
}
function diagnostic(value: unknown): NormalizedDiagnostic {
  const source = record(value)
  exactKeys(source, ["code", "side"])
  return {
    code: oneOf(source.code, [
      "abnormal-change",
      "control-break",
      "external-path",
      "grounded",
      "input-indeterminate",
      "insulation",
      "non-conductive-surface",
      "own-equipment",
      "reset-required",
      "resistance-uncertain",
      "white",
      "whipover",
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
function orderedUniqueList<T>(
  value: unknown,
  maximum: number,
  parser: (item: unknown) => T,
  key: (item: T) => string
): readonly T[] {
  if (!Array.isArray(value) || value.length > maximum) throw new NormalizedScoringSchemaError("bounds")
  const parsed = value.map(parser)
  let previous: string | undefined
  for (const item of parsed) {
    const current = key(item)
    if (previous !== undefined && current <= previous) throw new NormalizedScoringSchemaError("value")
    previous = current
  }
  return parsed
}
function diagnostics(value: unknown): readonly NormalizedDiagnostic[] {
  return orderedUniqueList(value, MAX_NORMALIZED_DIAGNOSTICS, diagnostic, (item) => `${item.code}\u0000${item.side}`)
}
function faults(value: unknown): readonly NormalizedFault[] {
  return orderedUniqueList(value, MAX_NORMALIZED_FAULTS, fault, (item) => `${item.code}\u0000${item.side}`)
}
function resistanceMeasurement(value: unknown): NormalizedResistanceMeasurement {
  const source = record(value)
  exactKeys(source, ["resistanceMilliOhms", "resistanceUncertaintyMilliOhms"])
  const resistanceMilliOhms = source.resistanceMilliOhms
  const resistanceUncertaintyMilliOhms = source.resistanceUncertaintyMilliOhms
  if (resistanceMilliOhms === null || resistanceUncertaintyMilliOhms === null) {
    if (resistanceMilliOhms !== null || resistanceUncertaintyMilliOhms !== null)
      throw new NormalizedScoringSchemaError("value")
    return { resistanceMilliOhms: null, resistanceUncertaintyMilliOhms: null }
  }
  return {
    resistanceMilliOhms: uint64(resistanceMilliOhms),
    resistanceUncertaintyMilliOhms: uint64(resistanceUncertaintyMilliOhms)
  }
}
function epeeSide(value: unknown): NormalizedEpeeSideInput {
  const source = record(value)
  exactKeys(source, [
    "circuitComplete",
    "contactResistance",
    "groundPathResistance",
    "groundedMaterial",
    "lineIntegrity"
  ])
  return {
    circuitComplete: oneOf(source.circuitComplete, ["closed", "indeterminate", "open", "unavailable"]),
    contactResistance: resistanceMeasurement(source.contactResistance),
    groundPathResistance: resistanceMeasurement(source.groundPathResistance),
    groundedMaterial: oneOf(source.groundedMaterial, ["grounded", "indeterminate", "not-grounded", "unavailable"]),
    lineIntegrity: oneOf(source.lineIntegrity, ["cross-line", "indeterminate", "intact", "out-of-range", "unavailable"])
  }
}
function foilSide(value: unknown): NormalizedFoilSideInput {
  const source = record(value)
  exactKeys(source, ["circuitBreak", "insulation", "integrity", "target"])
  return {
    circuitBreak: oneOf(source.circuitBreak, ["closed", "indeterminate", "open", "unavailable"]),
    insulation: oneOf(source.insulation, ["indeterminate", "outside-range", "unavailable", "within-range"]),
    integrity: oneOf(source.integrity, ["indeterminate", "intact", "lame-fault", "unavailable", "weapon-fault"]),
    target: oneOf(source.target, ["grounded", "indeterminate", "non-target", "target", "unavailable"])
  }
}
function sabreSide(value: unknown): NormalizedSabreSideInput {
  const source = record(value)
  exactKeys(source, ["bcFault", "blade", "externalPath", "ownEquipment", "target"])
  return {
    bcFault: oneOf(source.bcFault, ["abnormal-change", "control-break", "indeterminate", "normal", "unavailable"]),
    blade: oneOf(source.blade, ["absent", "indeterminate", "present", "unavailable"]),
    externalPath: oneOf(source.externalPath, ["eligible", "ineligible", "indeterminate", "unavailable"]),
    ownEquipment: oneOf(source.ownEquipment, ["absent", "indeterminate", "present", "unavailable"]),
    target: oneOf(source.target, ["indeterminate", "non-conductive-surface", "target", "unavailable"])
  }
}
function sideState(value: unknown): NormalizedSideState {
  const source = record(value)
  exactKeys(source, ["candidate", "candidateSinceUs", "registered"])
  return {
    candidate: oneOf(source.candidate, ["none", "pending"]),
    candidateSinceUs: uint64(source.candidateSinceUs),
    registered: oneOf(source.registered, ["no", "yes"])
  }
}
function foilSideState(value: unknown): NormalizedFoilSideState {
  const source = record(value)
  exactKeys(source, [
    "candidate",
    "candidateClassification",
    "candidateSinceUs",
    "insulation",
    "observation",
    "registered"
  ])
  return {
    ...sideState({
      candidate: source.candidate,
      candidateSinceUs: source.candidateSinceUs,
      registered: source.registered
    }),
    candidateClassification: oneOf(source.candidateClassification, ["none", "off-target", "on-target"]),
    insulation: oneOf(source.insulation, ["indeterminate", "outside-range", "unavailable", "within-range"]),
    observation: oneOf(source.observation, [
      "grounded-contact",
      "indeterminate",
      "lame-fault",
      "ready",
      "unavailable",
      "weapon-fault"
    ])
  }
}
function bladeHistory(value: unknown): NormalizedBladeHistory {
  const source = record(value)
  if (source.state === "none") {
    exactKeys(source, ["state"])
    return { state: "none" }
  }
  exactKeys(source, ["interruptionCount", "lastBlade", "startedAtUs", "state"])
  return {
    interruptionCount: unsigned(source.interruptionCount, MAX_UINT16),
    lastBlade: oneOf(source.lastBlade, ["absent", "present"]),
    startedAtUs: uint64(source.startedAtUs),
    state: oneOf(source.state, ["active"])
  }
}
function controlBreak(value: unknown): NormalizedControlBreakState {
  const source = record(value)
  if (source.state === "inactive") {
    exactKeys(source, ["state"])
    return { state: "inactive" }
  }
  exactKeys(source, ["sinceUs", "state"])
  return { sinceUs: uint64(source.sinceUs), state: oneOf(source.state, ["active"]) }
}
function sabreSideState(value: unknown): NormalizedSabreSideState {
  const source = record(value)
  exactKeys(source, [
    "bladeHistory",
    "candidate",
    "candidateSinceUs",
    "controlBreak",
    "observation",
    "registered",
    "white",
    "yellow"
  ])
  return {
    ...sideState({
      candidate: source.candidate,
      candidateSinceUs: source.candidateSinceUs,
      registered: source.registered
    }),
    bladeHistory: bladeHistory(source.bladeHistory),
    controlBreak: controlBreak(source.controlBreak),
    observation: oneOf(source.observation, [
      "external-path-ineligible",
      "indeterminate",
      "non-conductive-surface",
      "ready",
      "unavailable",
      "whipover-rejection"
    ]),
    white: oneOf(source.white, ["indeterminate", "unavailable", "white-off", "white-on"]),
    yellow: oneOf(source.yellow, ["indeterminate", "unavailable", "yellow-off", "yellow-on"])
  }
}
function decision(value: unknown, side: ScoringSide): NormalizedDecision {
  const source = record(value)
  exactKeys(source, ["atUs", "audible", "disposition", "latched", "side", "startedAtUs", "visual"])
  if (source.side !== side) throw new NormalizedScoringSchemaError("value")
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
    if (!silent || parsed.atUs !== "0" || parsed.startedAtUs !== "0") throw new NormalizedScoringSchemaError("value")
  } else if (parsed.disposition === "qualified-hit") {
    if (parsed.audible !== "yes" || parsed.latched !== "yes" || parsed.visual !== "valid-hit")
      throw new NormalizedScoringSchemaError("value")
  } else if (parsed.disposition === "off-target") {
    if (parsed.audible !== "no" || parsed.latched !== "yes" || parsed.visual !== "off-target")
      throw new NormalizedScoringSchemaError("value")
  } else if (!silent) throw new NormalizedScoringSchemaError("value")
  if (
    parsed.atUs.length < parsed.startedAtUs.length ||
    (parsed.atUs.length === parsed.startedAtUs.length && parsed.atUs < parsed.startedAtUs)
  )
    throw new NormalizedScoringSchemaError("value")
  return parsed
}
function assertResultCoherence(result: NormalizedResult): void {
  const expected: Readonly<Record<NormalizedResult["state"], NormalizedResult["errorCode"]>> = {
    accepted: "none",
    capacity: "capacity",
    exhausted: "exhausted",
    fault: "fault",
    indeterminate: "none",
    overflow: "overflow",
    reset: "none",
    unavailable: "unavailable"
  }
  if (result.errorCode !== expected[result.state]) throw new NormalizedScoringSchemaError("value")
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
  if (
    !allowed[result.state].includes(result.left.disposition) ||
    !allowed[result.state].includes(result.right.disposition)
  )
    throw new NormalizedScoringSchemaError("value")
  if (result.state === "fault" && result.faults.length === 0) throw new NormalizedScoringSchemaError("value")
  if (result.state === "unavailable" && !result.faults.some((item) => item.code === "acquisition-unavailable"))
    throw new NormalizedScoringSchemaError("value")
  if (
    (result.state === "accepted" ||
      result.state === "capacity" ||
      result.state === "exhausted" ||
      result.state === "overflow" ||
      result.state === "reset") &&
    result.faults.length !== 0
  )
    throw new NormalizedScoringSchemaError("value")
}

function lessThanOrEqualUint64(left: CanonicalUint64, right: CanonicalUint64): boolean {
  return left.length < right.length || (left.length === right.length && left <= right)
}
function assertSideStateCoherence(
  side: NormalizedSideState,
  lastInputAtUs: CanonicalUint64,
  hasLastInput: boolean
): void {
  if (side.candidate === "none") {
    if (side.candidateSinceUs !== "0") throw new NormalizedScoringSchemaError("value")
  } else {
    if (side.registered !== "no") throw new NormalizedScoringSchemaError("value")
    if (!hasLastInput || !lessThanOrEqualUint64(side.candidateSinceUs, lastInputAtUs))
      throw new NormalizedScoringSchemaError("value")
  }
}
function assertStateCoherence(state: NormalizedScoringState): void {
  const hasFirstHit = state.hasFirstHit === "yes"
  const hasLastInput = state.hasLastInput === "yes"
  const lockoutActive = state.lockoutActive === "yes"
  if (!hasLastInput && (state.lastInputAtUs !== "0" || state.lastInputId !== 0))
    throw new NormalizedScoringSchemaError("value")
  if (!hasFirstHit) {
    if (state.firstHitAtUs !== "0" || state.lockoutEndsAtUs !== "0" || state.locked !== "no" || lockoutActive)
      throw new NormalizedScoringSchemaError("value")
  } else if (!hasLastInput || !lessThanOrEqualUint64(state.firstHitAtUs, state.lastInputAtUs)) {
    throw new NormalizedScoringSchemaError("value")
  }
  if (!lockoutActive && state.lockoutEndsAtUs !== "0") throw new NormalizedScoringSchemaError("value")
  if (lockoutActive && (!hasFirstHit || !lessThanOrEqualUint64(state.firstHitAtUs, state.lockoutEndsAtUs)))
    throw new NormalizedScoringSchemaError("value")
  if (state.locked === "yes" && !lockoutActive) throw new NormalizedScoringSchemaError("value")

  assertSideStateCoherence(state.left, state.lastInputAtUs, hasLastInput)
  assertSideStateCoherence(state.right, state.lastInputAtUs, hasLastInput)
  if (state.weapon === "foil") {
    for (const side of [state.left, state.right]) {
      if ((side.candidate === "none") !== (side.candidateClassification === "none"))
        throw new NormalizedScoringSchemaError("value")
    }
  }
  if (state.weapon === "sabre") {
    for (const side of [state.left, state.right]) {
      if (
        (side.controlBreak.state === "active" &&
          (!hasLastInput || !lessThanOrEqualUint64(side.controlBreak.sinceUs, state.lastInputAtUs))) ||
        (side.bladeHistory.state === "active" &&
          (!hasLastInput || !lessThanOrEqualUint64(side.bladeHistory.startedAtUs, state.lastInputAtUs)))
      )
        throw new NormalizedScoringSchemaError("value")
    }
  }
}

/** Parses a complete, lossless normalized sample or an explicit reset command. */
export function parseNormalizedScoringInput(value: unknown): NormalizedScoringInput {
  assertPlainDataTree(value)
  const source = record(value)
  if (source.kind === "reset") {
    exactKeys(source, ["atUs", "inputId", "kind", "resetReason", "schemaVersion", "weapon"])
    return deepFreeze({
      atUs: uint64(source.atUs),
      inputId: unsigned(source.inputId, MAX_UINT32),
      kind: "reset",
      resetReason: oneOf(source.resetReason, ["bout", "recovery", "weapon-change"]),
      schemaVersion: schemaVersion(source.schemaVersion),
      weapon: oneOf(source.weapon, ["epee", "foil", "sabre"])
    })
  }
  if (source.kind !== "sample") throw new NormalizedScoringSchemaError("kind")
  exactKeys(source, ["atUs", "diagnostics", "faults", "inputId", "kind", "left", "right", "schemaVersion", "weapon"])
  const base = {
    atUs: uint64(source.atUs),
    diagnostics: diagnostics(source.diagnostics),
    faults: faults(source.faults),
    inputId: unsigned(source.inputId, MAX_UINT32),
    kind: "sample" as const,
    schemaVersion: schemaVersion(source.schemaVersion)
  }
  if (source.weapon === "epee")
    return deepFreeze({ ...base, left: epeeSide(source.left), right: epeeSide(source.right), weapon: "epee" })
  if (source.weapon === "foil")
    return deepFreeze({ ...base, left: foilSide(source.left), right: foilSide(source.right), weapon: "foil" })
  if (source.weapon === "sabre")
    return deepFreeze({ ...base, left: sabreSide(source.left), right: sabreSide(source.right), weapon: "sabre" })
  throw new NormalizedScoringSchemaError("value")
}

/** Parses opaque bounded state. It does not apply scoring rules or transitions. */
export function parseNormalizedScoringState(value: unknown): NormalizedScoringState {
  assertPlainDataTree(value)
  const source = record(value)
  const keys = [
    "availability",
    "diagnostics",
    "faults",
    "firstHitAtUs",
    "hasFirstHit",
    "hasLastInput",
    "lastInputAtUs",
    "lastInputId",
    "left",
    "locked",
    "lockoutActive",
    "lockoutEndsAtUs",
    "outputCapacity",
    "right",
    "schemaVersion",
    "weapon"
  ] as const
  exactKeys(source, keys)
  const base = {
    availability: oneOf(source.availability, ["available", "indeterminate", "unavailable"]),
    diagnostics: diagnostics(source.diagnostics),
    faults: faults(source.faults),
    firstHitAtUs: uint64(source.firstHitAtUs),
    hasFirstHit: oneOf(source.hasFirstHit, ["no", "yes"]),
    hasLastInput: oneOf(source.hasLastInput, ["no", "yes"]),
    lastInputAtUs: uint64(source.lastInputAtUs),
    lastInputId: unsigned(source.lastInputId, MAX_UINT32),
    locked: oneOf(source.locked, ["no", "yes"]),
    lockoutActive: oneOf(source.lockoutActive, ["no", "yes"]),
    lockoutEndsAtUs: uint64(source.lockoutEndsAtUs),
    outputCapacity: unsigned(source.outputCapacity, MAX_UINT8),
    schemaVersion: schemaVersion(source.schemaVersion)
  }
  if (source.weapon === "epee") {
    const parsed: NormalizedEpeeScoringState = {
      ...base,
      left: sideState(source.left),
      right: sideState(source.right),
      weapon: "epee"
    }
    assertStateCoherence(parsed)
    return deepFreeze(parsed)
  }
  if (source.weapon === "foil") {
    const parsed: NormalizedFoilScoringState = {
      ...base,
      left: foilSideState(source.left),
      right: foilSideState(source.right),
      weapon: "foil"
    }
    assertStateCoherence(parsed)
    return deepFreeze(parsed)
  }
  if (source.weapon === "sabre") {
    const parsed: NormalizedSabreScoringState = {
      ...base,
      left: sabreSideState(source.left),
      right: sabreSideState(source.right),
      weapon: "sabre"
    }
    assertStateCoherence(parsed)
    return deepFreeze(parsed)
  }
  throw new NormalizedScoringSchemaError("value")
}

/** Parses a bounded receipt; fixed left/right slots preserve simultaneous decisions. */
export function parseNormalizedScoringResult(value: unknown): NormalizedResult {
  assertPlainDataTree(value)
  const source = record(value)
  exactKeys(source, ["diagnostics", "errorCode", "faults", "inputId", "left", "right", "schemaVersion", "state"])
  const parsed = {
    diagnostics: diagnostics(source.diagnostics),
    errorCode: oneOf(source.errorCode, ["capacity", "exhausted", "fault", "none", "overflow", "unavailable"]),
    faults: faults(source.faults),
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
