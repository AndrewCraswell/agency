/**
 * M0-02 canonical scoring vocabulary and machine units.
 *
 * This module is deliberately independent of a weapon scorer. It gives the
 * electrical boundary one vocabulary, and fails closed when a record uses an
 * unapproved unit or an ambiguous name.
 */

export const SCORING_GLOSSARY_REVISION = "m0-02" as const

export type GlossaryUnitCode =
  | "milliAmp"
  | "milliOhm"
  | "milliVolt"
  | "microAmp"
  | "us"
  | "milliWatt"
  | "milliHertz"
  | "nanoFarad"

export type GlossaryUnitDimension =
  | "capacitance"
  | "current"
  | "frequency"
  | "power"
  | "resistance"
  | "time"
  | "voltage"

export type GlossaryUnit = Readonly<{
  code: GlossaryUnitCode
  dimension: GlossaryUnitDimension
  fieldSuffix: string | null
  integerOnly: boolean
  nonNegative: boolean
  symbol: string
  toSiFactor: number | null
}>

export type GlossaryTermKind =
  | "classification"
  | "field"
  | "identity"
  | "line"
  | "outcome"
  | "quantity"
  | "reset"
  | "side"
  | "state"
  | "weapon"

export type GlossaryTerm = Readonly<{
  aliases: readonly string[]
  canonical: string
  definition: string
  kind: GlossaryTermKind
  unit: GlossaryUnitCode | null
}>

export type ScoringGlossary = Readonly<{
  revision: typeof SCORING_GLOSSARY_REVISION
  terms: readonly GlossaryTerm[]
  units: readonly GlossaryUnit[]
}>

export type GlossaryMeasurement = Readonly<{
  unit: GlossaryUnitCode
  value: number
}>

const UNIT_CODES: readonly GlossaryUnitCode[] = [
  "us",
  "milliOhm",
  "milliVolt",
  "microAmp",
  "nanoFarad",
  "milliWatt",
  "milliHertz",
  "milliAmp"
]

const TERM_KINDS: readonly GlossaryTermKind[] = [
  "classification",
  "field",
  "identity",
  "line",
  "outcome",
  "quantity",
  "reset",
  "side",
  "state",
  "weapon"
]

const UNIT_DIMENSIONS: readonly GlossaryUnitDimension[] = [
  "capacitance",
  "current",
  "frequency",
  "power",
  "resistance",
  "time",
  "voltage"
]

const PROHIBITED_LABELS = new Set([
  "a",
  "b",
  "c",
  "line",
  "wire",
  "pin",
  "earth",
  "ground",
  "gnd",
  "contact",
  "touch",
  "strike",
  "point",
  "impact",
  "hit",
  "valid",
  "invalid",
  "time",
  "timestamp",
  "date",
  "timeout",
  "delay",
  "reset",
  "reboot",
  "clear",
  "new bout",
  "unknown",
  "uncertain",
  "saber"
])

const UNIT_DEFINITIONS: readonly GlossaryUnit[] = [
  {
    code: "us",
    dimension: "time",
    fieldSuffix: "Us",
    integerOnly: true,
    nonNegative: true,
    symbol: "µs",
    toSiFactor: 0.000001
  },
  {
    code: "milliOhm",
    dimension: "resistance",
    fieldSuffix: "MilliOhms",
    integerOnly: true,
    nonNegative: true,
    symbol: "mΩ",
    toSiFactor: 0.001
  },
  {
    code: "milliVolt",
    dimension: "voltage",
    fieldSuffix: "Millivolts",
    integerOnly: true,
    nonNegative: true,
    symbol: "mV",
    toSiFactor: 0.001
  },
  {
    code: "microAmp",
    dimension: "current",
    fieldSuffix: "Microamps",
    integerOnly: true,
    nonNegative: true,
    symbol: "µA",
    toSiFactor: 0.000001
  },
  {
    code: "nanoFarad",
    dimension: "capacitance",
    fieldSuffix: "Nanofarads",
    integerOnly: true,
    nonNegative: true,
    symbol: "nF",
    toSiFactor: 0.000000001
  },
  {
    code: "milliWatt",
    dimension: "power",
    fieldSuffix: "Milliwatts",
    integerOnly: true,
    nonNegative: true,
    symbol: "mW",
    toSiFactor: 0.001
  },
  {
    code: "milliHertz",
    dimension: "frequency",
    fieldSuffix: "MilliHertz",
    integerOnly: true,
    nonNegative: true,
    symbol: "mHz",
    toSiFactor: 0.001
  },
  {
    code: "milliAmp",
    dimension: "current",
    fieldSuffix: "Milliamps",
    integerOnly: true,
    nonNegative: true,
    symbol: "mA",
    toSiFactor: 0.001
  }
]

function makeTerm(
  canonical: string,
  kind: GlossaryTermKind,
  definition: string,
  unit: GlossaryUnitCode | null = null,
  aliases: readonly string[] = []
): GlossaryTerm {
  return { aliases, canonical, definition, kind, unit }
}

const TERMS: readonly GlossaryTerm[] = [
  makeTerm("epee", "weapon", "The weapon whose tip circuit and grounded-material rules are selected."),
  makeTerm("foil", "weapon", "The weapon whose circuit-break and target-context rules are selected."),
  makeTerm("sabre", "weapon", "The weapon whose target, blade-contact, and diagnostic rules are selected."),
  makeTerm("left", "side", "One apparatus position, independent of lamp color or referee priority."),
  makeTerm("right", "side", "The other apparatus position, independent of lamp color or referee priority."),
  makeTerm("side", "field", "Field whose value is exactly left or right."),
  makeTerm("lineId", "field", "Field containing one of the seven logical conductor identifiers."),
  makeTerm("left.A", "line", "Logical conductor A associated with the left apparatus position."),
  makeTerm("left.B", "line", "Logical conductor B associated with the left apparatus position."),
  makeTerm("left.C", "line", "Logical conductor C associated with the left apparatus position."),
  makeTerm("right.A", "line", "Logical conductor A associated with the right apparatus position."),
  makeTerm("right.B", "line", "Logical conductor B associated with the right apparatus position."),
  makeTerm("right.C", "line", "Logical conductor C associated with the right apparatus position."),
  makeTerm("piste", "line", "The shared conductive piste and its declared ground reference."),
  makeTerm("open", "state", "The declared circuit path is not electrically closed in its test conditions."),
  makeTerm("closed", "state", "The declared circuit path is electrically closed in its test conditions."),
  makeTerm("grounded", "state", "The observed path is connected to the declared piste or earthed-material reference."),
  makeTerm("crossLine", "state", "A conductor is connected to another logical conductor outside the declared phase."),
  makeTerm("outOfRange", "state", "A measured quantity is outside its declared fixture, ADC, or rule range."),
  makeTerm("indeterminate", "state", "Measurement or evidence cannot distinguish the states needed by the rule."),
  makeTerm(
    "unavailable",
    "state",
    "No trusted observation is available because the authority is not ready or cannot acquire it."
  ),
  makeTerm("safeInactive", "state", "An output driver cannot assert a hit, diagnostic lamp, or audible signal."),
  makeTerm("not-grounded", "state", "The observed material is not connected to the declared ground reference."),
  makeTerm("target", "state", "The trusted weapon-specific observation identifies a declared target context."),
  makeTerm("nonTarget", "state", "The trusted weapon-specific observation identifies a non-target context."),
  makeTerm("intact", "state", "The declared foil integrity path is not reporting a weapon or lame fault."),
  makeTerm("lameFault", "state", "The foil conductive target return has a declared integrity fault."),
  makeTerm("weaponFault", "state", "The foil weapon loop has a declared integrity fault."),
  makeTerm("withinRange", "state", "The complete uncertainty interval is inside the accepted region."),
  makeTerm("outsideRange", "state", "The complete uncertainty interval is outside the accepted region."),
  makeTerm("ready", "state", "The selected observation is trusted and eligible for its rule evaluation."),
  makeTerm("eligible", "state", "The sabre external path satisfies its declared eligibility rule."),
  makeTerm("ineligible", "state", "The sabre external path fails its declared eligibility rule."),
  makeTerm("present", "state", "The named contact or fault is observed."),
  makeTerm("absent", "state", "The named contact or fault is not observed."),
  makeTerm("normal", "state", "The sabre B/C circuit has no declared abnormal-change or control-break state."),
  makeTerm("controlBreak", "state", "The sabre control-circuit break has met its declared duration rule."),
  makeTerm("abnormalChange", "state", "The sabre B/C circuit has an abnormal electrical change."),
  makeTerm("nonConductiveSurface", "state", "The sabre contact is with a declared non-conductive surface."),
  makeTerm(
    "candidate",
    "outcome",
    "A rule-shaped interval that has started but has not met all qualification conditions."
  ),
  makeTerm("qualified-hit", "outcome", "A candidate that satisfies the released weapon rule table."),
  makeTerm("registered-hit", "outcome", "A qualified hit that the apparatus records as a signal event."),
  makeTerm(
    "rejected-contact",
    "outcome",
    "A contact intentionally not registered because a stated rule condition failed."
  ),
  makeTerm("line-fault", "outcome", "A condition that prevents trusting a required electrical line or its state."),
  makeTerm("noSignal", "outcome", "No apparatus signal was produced for the observed interval."),
  makeTerm("uncertainty", "outcome", "Evidence is retained but its interval overlaps a decision boundary."),
  makeTerm("on-target", "classification", "Product classification for a qualified hit in the declared target context."),
  makeTerm(
    "off-target",
    "classification",
    "Product classification for a qualified foil contact outside the target context."
  ),
  makeTerm(
    "valid-hit",
    "classification",
    "FIE output wording retained only when the applicable rule has qualified it."
  ),
  makeTerm("non-valid", "classification", "FIE output wording for a foil contact outside the target context."),
  makeTerm("atUs", "quantity", "Monotonic scoring-clock instant scoped by scoringBootId.", "us"),
  makeTerm("startedAtUs", "quantity", "Monotonic instant at which a candidate interval began.", "us"),
  makeTerm("qualifiedAtUs", "quantity", "Monotonic instant at which the candidate met the active rule table.", "us"),
  makeTerm("candidateSinceUs", "quantity", "Monotonic instant at which the current candidate began.", "us"),
  makeTerm("lastSampleAtUs", "quantity", "Monotonic instant of the latest accepted sample.", "us"),
  makeTerm("firstHitAtUs", "quantity", "Monotonic instant anchoring the first epee hit window.", "us"),
  makeTerm("firstHitSignalledAtUs", "quantity", "Monotonic instant at which the first signal event was emitted.", "us"),
  makeTerm("lockoutEndsAtUs", "quantity", "Monotonic instant at which the weapon lockout ends.", "us"),
  makeTerm("capturedFromUs", "quantity", "Inclusive monotonic start of retained replay evidence.", "us"),
  makeTerm("capturedThroughUs", "quantity", "Inclusive monotonic end of retained replay evidence.", "us"),
  makeTerm("durationUs", "quantity", "Non-negative elapsed duration on the monotonic scoring clock.", "us"),
  makeTerm(
    "wallAtUs",
    "quantity",
    "Signed application wall-clock instant in integer microseconds since the Unix epoch; it never drives a scoring decision.",
    "us"
  ),
  makeTerm("resistanceMilliOhms", "quantity", "Resistance represented as an integer number of milli-ohms.", "milliOhm"),
  makeTerm(
    "resistanceUncertaintyMilliOhms",
    "quantity",
    "Non-negative resistance uncertainty represented as integer milli-ohms.",
    "milliOhm"
  ),
  makeTerm("voltageMillivolts", "quantity", "Voltage represented as integer millivolts.", "milliVolt"),
  makeTerm("currentMicroamps", "quantity", "Current represented as integer microamps.", "microAmp"),
  makeTerm("currentMilliamps", "quantity", "Current represented as integer milliamps.", "milliAmp"),
  makeTerm("capacitanceNanofarads", "quantity", "Capacitance represented as integer nanofarads.", "nanoFarad"),
  makeTerm("powerMilliwatts", "quantity", "Power represented as integer milliwatts.", "milliWatt"),
  makeTerm("frequencyMilliHertz", "quantity", "Frequency represented as integer millihertz.", "milliHertz"),
  makeTerm(
    "pisteResistanceMilliOhms",
    "quantity",
    "End-to-end piste resistance represented as integer milli-ohms.",
    "milliOhm"
  ),
  makeTerm("scoringBootId", "identity", "Identity of one scoring-authority boot interval."),
  makeTerm("sequence", "identity", "Protocol order within one scoring boot; it is not elapsed time."),
  makeTerm("sequenceRange", "identity", "Inclusive first and last sequence numbers covered by an evidence record."),
  makeTerm("firmwareIdentity", "identity", "Stable human and build identity of the decision firmware."),
  makeTerm("firmwareDigest", "identity", "Digest of the exact firmware image or immutable image manifest."),
  makeTerm("ruleRevision", "identity", "Identity of the weapon rule, endpoint, uncertainty, and FIE source policy."),
  makeTerm(
    "timingRevision",
    "identity",
    "Identity of the selected timing table, separate from rule and firmware identity."
  ),
  makeTerm("protocolVersion", "identity", "Compatibility identity of an encoded message contract."),
  makeTerm("boutReset", "reset", "Explicit supervisor action that begins a new bout or weapon state."),
  makeTerm("supervisorReset", "reset", "Reset authority reserved for the designated supervisor."),
  makeTerm("processorReset", "reset", "Reset of the STM32 or ESP32 processor; it is not a bout reset."),
  makeTerm("watchdogReset", "reset", "Processor reset caused by watchdog expiry."),
  makeTerm("brownoutReset", "reset", "Reset or shutdown caused by supply voltage below the declared range."),
  makeTerm("powerCycle", "reset", "Loss and restoration of apparatus supply, creating a new boot interval."),
  makeTerm("updateReset", "reset", "Reset associated with an approved firmware update or rollback."),
  makeTerm("factoryReset", "reset", "Destructive configuration reset, not a bout reset or evidence deletion authority.")
]

const DEFAULT_GLOSSARY: ScoringGlossary = {
  revision: SCORING_GLOSSARY_REVISION,
  terms: TERMS,
  units: UNIT_DEFINITIONS
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function requirePlainObject(value: unknown, path: string): Record<string, unknown> {
  if (!isRecord(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new TypeError(`${path} must be a plain object`)
  }
  return value
}

function requireExactKeys(value: Record<string, unknown>, keys: readonly string[], path: string): void {
  const actualKeys = Reflect.ownKeys(value)
  if (
    actualKeys.length !== keys.length ||
    actualKeys.some((key) => typeof key !== "string" || !keys.includes(key)) ||
    keys.some((key) => !Object.hasOwn(value, key))
  ) {
    throw new TypeError(`${path} has an unknown or missing property`)
  }
  for (const key of actualKeys) {
    if (typeof key !== "string") {
      throw new TypeError(`${path} properties must have string keys`)
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
      throw new TypeError(`${path} properties must be enumerable data values`)
    }
  }
}

function isUnitCode(value: unknown): value is GlossaryUnitCode {
  return typeof value === "string" && UNIT_CODES.some((code) => code === value)
}

function isTermKind(value: unknown): value is GlossaryTermKind {
  return typeof value === "string" && TERM_KINDS.some((kind) => kind === value)
}

function isUnitDimension(value: unknown): value is GlossaryUnitDimension {
  return typeof value === "string" && UNIT_DIMENSIONS.some((dimension) => dimension === value)
}

function parseNonemptyLabel(value: unknown, path: string): string {
  if (typeof value !== "string" || value.length === 0 || value !== value.trim()) {
    throw new TypeError(`${path} must be a non-empty trimmed string`)
  }
  return value
}

function parseDescription(value: unknown, path: string): string {
  if (typeof value !== "string" || value.length === 0 || value !== value.trim()) {
    throw new TypeError(`${path} must be a non-empty trimmed description`)
  }
  return value
}

function parseAliases(value: unknown, path: string): readonly string[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`${path} must be an array`)
  }
  return value.map((alias, index) => parseNonemptyLabel(alias, `${path}[${index}]`))
}

function normalizeLabel(value: string): string {
  return value.trim().replace(/\s+/gu, " ").toLocaleLowerCase("en-US")
}

function parseUnit(value: unknown, index: number): GlossaryUnit {
  const unit = requirePlainObject(value, `glossary.units[${index}]`)
  requireExactKeys(
    unit,
    ["code", "dimension", "fieldSuffix", "integerOnly", "nonNegative", "symbol", "toSiFactor"],
    `glossary.units[${index}]`
  )

  if (!isUnitCode(unit.code)) {
    throw new RangeError(`Unknown glossary unit code at glossary.units[${index}]`)
  }
  if (!isUnitDimension(unit.dimension)) {
    throw new RangeError(`Unknown glossary unit dimension at glossary.units[${index}]`)
  }
  if (unit.fieldSuffix !== null && (typeof unit.fieldSuffix !== "string" || unit.fieldSuffix.length === 0)) {
    throw new TypeError(`glossary.units[${index}].fieldSuffix must be a string or null`)
  }
  if (typeof unit.integerOnly !== "boolean" || typeof unit.nonNegative !== "boolean") {
    throw new TypeError(`glossary.units[${index}] integer constraints must be boolean`)
  }
  if (typeof unit.symbol !== "string" || unit.symbol.length === 0) {
    throw new TypeError(`glossary.units[${index}].symbol must be a non-empty string`)
  }
  if (
    unit.toSiFactor !== null &&
    (typeof unit.toSiFactor !== "number" || !Number.isFinite(unit.toSiFactor) || unit.toSiFactor <= 0)
  ) {
    throw new RangeError(`glossary.units[${index}].toSiFactor must be positive or null`)
  }

  return {
    code: unit.code,
    dimension: unit.dimension,
    fieldSuffix: unit.fieldSuffix,
    integerOnly: unit.integerOnly,
    nonNegative: unit.nonNegative,
    symbol: unit.symbol,
    toSiFactor: unit.toSiFactor
  }
}

function parseTerm(value: unknown, index: number): GlossaryTerm {
  const term = requirePlainObject(value, `glossary.terms[${index}]`)
  requireExactKeys(term, ["aliases", "canonical", "definition", "kind", "unit"], `glossary.terms[${index}]`)
  const canonical = parseNonemptyLabel(term.canonical, `glossary.terms[${index}].canonical`)
  const definition = parseDescription(term.definition, `glossary.terms[${index}].definition`)
  if (PROHIBITED_LABELS.has(normalizeLabel(canonical))) {
    throw new RangeError(`Overloaded glossary name is prohibited: ${canonical}`)
  }
  if (!isTermKind(term.kind)) {
    throw new RangeError(`Unknown glossary term kind at glossary.terms[${index}]`)
  }
  if (term.unit !== null && !isUnitCode(term.unit)) {
    throw new RangeError(`Unknown glossary unit reference at glossary.terms[${index}]`)
  }
  if (term.kind === "quantity" && term.unit === null) {
    throw new TypeError(`Quantity term ${canonical} must declare a unit`)
  }
  if (term.kind !== "quantity" && term.unit !== null) {
    throw new TypeError(`Non-quantity term ${canonical} must not declare a unit`)
  }

  const aliases = parseAliases(term.aliases, `glossary.terms[${index}].aliases`)
  for (const alias of aliases) {
    if (PROHIBITED_LABELS.has(normalizeLabel(alias))) {
      throw new RangeError(`Overloaded glossary alias is prohibited: ${alias}`)
    }
  }

  return {
    aliases,
    canonical,
    definition,
    kind: term.kind,
    unit: term.unit
  }
}

function deepFreeze<const Value>(value: Value): Value {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    for (const nestedValue of Object.values(value)) {
      deepFreeze(nestedValue)
    }
    Object.freeze(value)
  }
  return value
}

/**
 * Validates and returns a deeply immutable glossary. Canonical names and
 * aliases share one namespace, so a duplicate or ambiguous alias fails closed.
 */
export function validateScoringGlossary(value: unknown): ScoringGlossary {
  const glossary = requirePlainObject(value, "glossary")
  requireExactKeys(glossary, ["revision", "terms", "units"], "glossary")
  if (glossary.revision !== SCORING_GLOSSARY_REVISION) {
    throw new RangeError(`Unsupported scoring glossary revision: ${String(glossary.revision)}`)
  }
  if (!Array.isArray(glossary.units) || glossary.units.length === 0) {
    throw new TypeError("glossary.units must be a non-empty array")
  }
  if (!Array.isArray(glossary.terms) || glossary.terms.length === 0) {
    throw new TypeError("glossary.terms must be a non-empty array")
  }

  const units = glossary.units.map(parseUnit)
  const unitCodes = new Set<GlossaryUnitCode>()
  for (const unit of units) {
    if (unitCodes.has(unit.code)) {
      throw new RangeError(`Duplicate glossary unit: ${unit.code}`)
    }
    unitCodes.add(unit.code)
  }

  const terms = glossary.terms.map(parseTerm)
  const labels = new Map<string, string>()
  for (const term of terms) {
    const canonicalKey = normalizeLabel(term.canonical)
    const previousCanonical = labels.get(canonicalKey)
    if (previousCanonical !== undefined) {
      throw new RangeError(`Duplicate glossary canonical name: ${term.canonical}`)
    }
    labels.set(canonicalKey, term.canonical)
  }

  for (const term of terms) {
    for (const alias of term.aliases) {
      const aliasKey = normalizeLabel(alias)
      const previous = labels.get(aliasKey)
      if (previous !== undefined) {
        throw new RangeError(`Ambiguous glossary alias ${alias}: already names ${previous}`)
      }
      labels.set(aliasKey, term.canonical)
    }
  }

  for (const term of terms) {
    if (term.unit !== null && !unitCodes.has(term.unit)) {
      throw new RangeError(`Unknown glossary unit reference: ${term.unit}`)
    }
  }

  return deepFreeze({ revision: SCORING_GLOSSARY_REVISION, terms, units })
}

/** The canonical M0-02 glossary used by scoring code and evidence tooling. */
export const SCORING_GLOSSARY = validateScoringGlossary(DEFAULT_GLOSSARY)

export const SCORING_GLOSSARY_UNITS = SCORING_GLOSSARY.units
export const SCORING_GLOSSARY_TERMS = SCORING_GLOSSARY.terms

/** Resolves a canonical name or an explicitly declared, unambiguous alias. */
export function resolveScoringGlossaryTerm(label: unknown, glossary: ScoringGlossary = SCORING_GLOSSARY): GlossaryTerm {
  if (typeof label !== "string" || label.trim().length === 0) {
    throw new TypeError("Glossary term lookup requires a non-empty string")
  }
  const checkedGlossary = validateScoringGlossary(glossary)
  const normalized = normalizeLabel(label)
  const term = checkedGlossary.terms.find(
    (candidate) =>
      normalizeLabel(candidate.canonical) === normalized ||
      candidate.aliases.some((alias) => normalizeLabel(alias) === normalized)
  )
  if (term === undefined) {
    throw new RangeError(`Unknown scoring glossary term: ${label}`)
  }
  return term
}

/** Returns a declared unit and rejects display symbols or unapproved units. */
export function resolveScoringGlossaryUnit(code: unknown, glossary: ScoringGlossary = SCORING_GLOSSARY): GlossaryUnit {
  if (!isUnitCode(code)) {
    throw new RangeError(`Unknown scoring glossary unit: ${String(code)}`)
  }
  const checkedGlossary = validateScoringGlossary(glossary)
  const unit = checkedGlossary.units.find((candidate) => candidate.code === code)
  if (unit === undefined) {
    throw new RangeError(`Unknown scoring glossary unit: ${code}`)
  }
  return unit
}

export function isIntegerMicroseconds(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
}

/** Validates an internal instant or duration. Fractions and milliseconds fail closed. */
export function assertIntegerMicroseconds(value: unknown, fieldName = "time"): asserts value is number {
  if (!isIntegerMicroseconds(value)) {
    throw new RangeError(`${fieldName} must be a non-negative safe integer microsecond value`)
  }
}

/** Validates a machine quantity whose unit is explicitly present in the record. */
export function validateGlossaryMeasurement(value: unknown): GlossaryMeasurement {
  const measurement = requirePlainObject(value, "measurement")
  requireExactKeys(measurement, ["unit", "value"], "measurement")
  const unit = resolveScoringGlossaryUnit(measurement.unit)
  if (typeof measurement.value !== "number" || !Number.isSafeInteger(measurement.value)) {
    throw new RangeError(`Measurement in ${unit.code} must be an integer safe number`)
  }
  if (unit.nonNegative && measurement.value < 0) {
    throw new RangeError(`Measurement in ${unit.code} must be non-negative`)
  }
  return deepFreeze({ unit: unit.code, value: measurement.value })
}

/** Validates a named quantity field against its glossary unit and integer policy. */
export function validateScoringQuantity(fieldName: unknown, value: unknown): number {
  const term = resolveScoringGlossaryTerm(fieldName)
  if (term.kind !== "quantity" || term.unit === null) {
    throw new TypeError(`${String(fieldName)} is not a measurable glossary field`)
  }
  if (term.unit === "us") {
    if (term.canonical === "wallAtUs") {
      if (typeof value !== "number" || !Number.isSafeInteger(value)) {
        throw new RangeError(`${term.canonical} must be a safe integer Unix-epoch microsecond value`)
      }
      return value
    }
    assertIntegerMicroseconds(value, term.canonical)
    return value
  }
  return validateGlossaryMeasurement({ unit: term.unit, value }).value
}
