/** BT-01 independent tester requirements, independence, and coverage contract. */

import { requirementsToEvidenceLedger } from "./requirements-to-evidence-ledger.js"

export type TesterCoverageState = "planned" | "unsupported"
export type TesterRunScope = "virtual" | "dut"
export type TesterOutcome = "pass" | "fail" | "unavailable" | "notRun"
export type TesterEvaluation = "pass" | "fail" | "skipped" | "indeterminate" | "infrastructureError"
export type TesterObservationSource = "virtual" | "dutSelfReport" | "physicalObserver" | "infrastructure"

export type TesterCoverageRow = {
  readonly requirementFamily: string
  readonly state: TesterCoverageState
  readonly stimulus: string
  readonly independentObservation: string
  readonly uncertainty: string
  readonly evidence: string
}

export type TesterRunObservations = Readonly<Record<TesterObservationSource, TesterOutcome>>

export type TesterRunResult = {
  readonly evaluation: TesterEvaluation
  readonly physicalClaim: false
  readonly reason: string
}

type DataRecord = Record<PropertyKey, unknown>

function isPlainRecord(value: unknown): value is DataRecord {
  return value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) throw new RangeError("BT-01 contract cannot contain aliases or cycles")
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError("BT-01 contract can contain only data properties")
    }
    deepFreeze(descriptor.value, seen)
  }
  return Object.freeze(value)
}

function sameDataGraph(
  actual: unknown,
  expected: unknown,
  actualSeen = new WeakSet<object>(),
  expectedSeen = new WeakSet<object>()
): boolean {
  if (actual === null || expected === null || typeof actual !== "object" || typeof expected !== "object") {
    return Object.is(actual, expected)
  }
  if (actualSeen.has(actual) || expectedSeen.has(expected)) return false
  actualSeen.add(actual)
  expectedSeen.add(expected)
  if (Array.isArray(actual) !== Array.isArray(expected)) return false
  if (Array.isArray(actual)) {
    if (Object.getPrototypeOf(actual) !== Array.prototype || Object.getPrototypeOf(expected) !== Array.prototype) {
      return false
    }
  } else if (!(isPlainRecord(actual) && isPlainRecord(expected))) {
    return false
  }
  const actualKeys = Reflect.ownKeys(actual)
  const expectedKeys = Reflect.ownKeys(expected)
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key) => typeof key === "symbol") ||
    expectedKeys.some((key) => typeof key === "symbol")
  ) {
    return false
  }
  return expectedKeys.every((key) => {
    if (!actualKeys.includes(key)) return false
    const actualDescriptor = Object.getOwnPropertyDescriptor(actual, key)
    const expectedDescriptor = Object.getOwnPropertyDescriptor(expected, key)
    return (
      actualDescriptor !== undefined &&
      expectedDescriptor !== undefined &&
      "value" in actualDescriptor &&
      "value" in expectedDescriptor &&
      actualDescriptor.enumerable === expectedDescriptor.enumerable &&
      sameDataGraph(actualDescriptor.value, expectedDescriptor.value, actualSeen, expectedSeen)
    )
  })
}

const observationSources = ["virtual", "dutSelfReport", "physicalObserver", "infrastructure"] as const
const testerOutcomes = ["pass", "fail", "unavailable", "notRun"] as const

function isTesterOutcome(value: unknown): value is TesterOutcome {
  return testerOutcomes.some((outcome) => outcome === value)
}

function validateTesterRunObservations(observations: unknown): asserts observations is TesterRunObservations {
  if (!isPlainRecord(observations)) {
    throw new RangeError("BT-01 observations must be a plain record")
  }
  const keys = Reflect.ownKeys(observations)
  if (
    keys.length !== observationSources.length ||
    keys.some((key) => typeof key !== "string" || !observationSources.some((source) => source === key))
  ) {
    throw new RangeError("BT-01 observations must contain exactly the four declared sources")
  }
  for (const source of observationSources) {
    const descriptor = Object.getOwnPropertyDescriptor(observations, source)
    if (
      descriptor === undefined ||
      !descriptor.enumerable ||
      !("value" in descriptor) ||
      !isTesterOutcome(descriptor.value)
    ) {
      throw new RangeError("BT-01 observations must use declared data outcomes")
    }
  }
}

const coverageRows = [
  [
    "REQ-NORM-GENERAL",
    "seven-conductor continuity, open, closed, grounded, and cable paths",
    "measured conductor and piste state",
    "switch timing, resistance, leakage, and cable error",
    "immutable command and measurement timeline"
  ],
  [
    "REQ-NORM-THREE-WEAPON",
    "approved foil, epee, and sabre scenario transitions",
    "physical lamps and buzzer, correlated to measured lines",
    "timing, impedance, capacitance, and observer uncertainty",
    "scenario, calibration, and complete-apparatus capture"
  ],
  [
    "REQ-NORM-OUTPUTS",
    "qualified, rejected, latched, reset, and extension-output conditions",
    "electrical, optical, or acoustic output observer",
    "sensor threshold, placement, ambient, and clock error",
    "raw observer capture with expected non-events"
  ],
  [
    "REQ-NORM-POWER",
    "declared power, reset, brownout, and recovery coordination",
    "independent power and physical-output capture",
    "supply, trigger, and observer timestamp uncertainty",
    "power/reset capture and DUT boot identity"
  ],
  [
    "REQ-HW-SCORING-AUTHORITY",
    "ESP32 fault, link loss, and approved-request conditions",
    "STM32-owned output and unavailable-state observer",
    "fault injection and output-observer uncertainty",
    "authority fault timeline and secondary records"
  ],
  [
    "REQ-HW-SIGNAL-ALLOCATION",
    "declared input and output line-state sequences",
    "measured line response and physical output",
    "line-state measurement and switch-skew uncertainty",
    "line map, capture, and revision identity"
  ],
  [
    "REQ-PRODUCT-DECISION-RECORDS",
    "canonical event, reset, and replay triggers",
    "immutable record compared with independent physical observation",
    "record timestamp alignment and capture-loss uncertainty",
    "record digest and raw physical capture"
  ],
  [
    "REQ-PRODUCT-TRANSPORT",
    "valid, malformed, duplicated, and link-loss frames",
    "independent physical safe-state observation",
    "transport injection timing and capture uncertainty",
    "frame corpus, line capture, and DUT record"
  ],
  [
    "REQ-SECURITY-TRUST",
    "authorized, rejected, update, recovery, and debug-boundary requests",
    "independent safe-output and unavailable-state observation",
    "request provenance and observer uncertainty",
    "request identity, output capture, and audit record"
  ],
  [
    "REQ-HW-ANALOG-PROTECTION",
    "threshold, fault, source, sink, and protection-boundary paths",
    "calibrated line measurement and physical safe result",
    "instrument, resistance, capacitance, and temperature uncertainty",
    "calibration identity and raw line capture"
  ],
  [
    "REQ-HW-FIXTURE-CALIBRATION",
    "open, short, grounded, cross-line, impedance, capacitance, and fault paths",
    "tester self-measurement before DUT result",
    "calibration interval, drift, resistance, leakage, delay, and skew",
    "self-test and calibration record"
  ],
  [
    "REQ-HW-INTERFACES",
    "keyed reel, piste, connector, and misuse paths",
    "measured no-back-power and physical safe state",
    "connector contact, cable, and supply-envelope uncertainty",
    "interface configuration and measured capture"
  ],
  [
    "REQ-HW-SCHEMATIC-RELEASE",
    "declared safe-state and output-control conditions",
    "physical safe-output observer when hardware exists",
    "component tolerance and measurement uncertainty",
    "reviewed schematic reference and observer capture"
  ],
  [
    "REQ-HW-LAYOUT-RELEASE",
    "declared interference, load, and signal-integrity conditions",
    "physical output and line-state observer when hardware exists",
    "instrument bandwidth, thermal, and environmental uncertainty",
    "layout revision and raw capture"
  ],
  [
    "REQ-PRODUCT-MANUFACTURING",
    "production escape-detection subset",
    "independent tester self-test and apparatus output observer",
    "golden-unit, fixture drift, and sampling uncertainty",
    "unit identity, calibration, and retained result"
  ],
  [
    "REQ-PRODUCT-VALIDATION",
    "approved EVT operational and three-weapon cases",
    "complete-apparatus output observer",
    "declared tester and DUT uncertainty",
    "immutable HIL timeline and review record"
  ],
  [
    "REQ-PRODUCT-QUALIFICATION",
    "approved DVT environmental, power, and behavior matrix",
    "traceable physical-output observer",
    "traceable instrument and environmental uncertainty",
    "qualification run archive"
  ],
  [
    "REQ-PRODUCT-PRODUCTION",
    "controlled service, provisioning, and production cases",
    "independent production-test observer",
    "fixture correlation and sampling uncertainty",
    "release, service, and correlation evidence"
  ],
  [
    "REQ-PRODUCT-ENCRYPTED-IR",
    "authenticated command, replay, range, and recovery cases",
    "physical output, safe-idle, and secondary DUT-record correlation",
    "IR timing, range, angle, venue-light, and observer uncertainty",
    "command provenance and physical capture"
  ]
] as const

const definition = {
  workUnit: "BT-01",
  releaseState: "deny",
  architecture: {
    usbCPd: "BT-01 does not alter the USB-C PD boundary; interface selection remains blocked for BT-02.",
    c17Wasm:
      "Virtual evidence remains a C17-native and browser-WASM parity gate. TypeScript orchestrates evidence and has no scoring fallback after the approved migration."
  },
  independence: {
    tester: "The tester has independent power, timebase, calibration, firmware identity, and immutable result storage.",
    dut: "DUT decision and replay records are secondary correlation evidence and cannot be the physical-output oracle.",
    observer:
      "A physical pass requires an independent electrical, optical, or acoustic observer of the complete apparatus.",
    infrastructure:
      "Calibration, self-test, capture, setup, and communication failures stop a pass before DUT evaluation."
  },
  unsupported: [
    "FIE approval or homologation",
    "physical qualification before BT-06 through BT-10 evidence",
    "USB-C PD interface qualification before BT-02"
  ],
  rows: coverageRows.map(([requirementFamily, stimulus, independentObservation, uncertainty, evidence]) => ({
    requirementFamily,
    state: "planned" as const,
    stimulus,
    independentObservation,
    uncertainty,
    evidence
  }))
}

export const boxTesterRequirementsContract = deepFreeze(definition)

export function validateBoxTesterRequirementsContract(
  contract: unknown
): contract is typeof boxTesterRequirementsContract {
  if (!isPlainRecord(contract) || contract.workUnit !== "BT-01" || contract.releaseState !== "deny") {
    throw new RangeError("BT-01 must retain its denied planning state")
  }
  if (
    !isPlainRecord(contract.architecture) ||
    !isPlainRecord(contract.independence) ||
    !Array.isArray(contract.unsupported)
  ) {
    throw new RangeError("BT-01 must declare architecture, independence, and unsupported scope")
  }
  if (
    contract.architecture.usbCPd !== definition.architecture.usbCPd ||
    contract.architecture.c17Wasm !== definition.architecture.c17Wasm ||
    contract.unsupported.length === 0 ||
    !contract.unsupported.includes("FIE approval or homologation")
  ) {
    throw new RangeError("BT-01 must preserve USB-C PD, C17/WASM, and approval boundaries")
  }
  const expectedFamilies = requirementsToEvidenceLedger.rows.map((row) => row.stableId)
  if (!Array.isArray(contract.rows) || contract.rows.length !== expectedFamilies.length) {
    throw new RangeError("BT-01 must map every canonical requirement family exactly once")
  }
  const mappedFamilies = new Set<string>()
  for (const [index, row] of contract.rows.entries()) {
    if (
      !isPlainRecord(row) ||
      typeof row.requirementFamily !== "string" ||
      row.requirementFamily !== expectedFamilies[index] ||
      mappedFamilies.has(row.requirementFamily)
    ) {
      throw new RangeError("BT-01 rejects unmapped, reordered, or duplicate requirement rows")
    }
    mappedFamilies.add(row.requirementFamily)
    if (
      (row.state !== "planned" && row.state !== "unsupported") ||
      typeof row.stimulus !== "string" ||
      typeof row.independentObservation !== "string" ||
      typeof row.uncertainty !== "string" ||
      typeof row.evidence !== "string" ||
      row.stimulus.length === 0 ||
      row.independentObservation.length === 0 ||
      row.uncertainty.length === 0 ||
      row.evidence.length === 0
    ) {
      throw new RangeError("BT-01 rows require explicit stimulus, observation, uncertainty, and evidence")
    }
  }
  return true
}

export function evaluateBoxTesterRun(
  row: TesterCoverageRow,
  scope: TesterRunScope,
  observations: unknown
): TesterRunResult {
  validateBoxTesterRequirementsContract(boxTesterRequirementsContract)
  if (scope !== "virtual" && scope !== "dut") {
    throw new RangeError("BT-01 run scope must be virtual or DUT")
  }
  const canonicalRow = boxTesterRequirementsContract.rows.find(
    (candidate) => candidate.requirementFamily === row.requirementFamily
  )
  if (canonicalRow === undefined || !sameDataGraph(row, canonicalRow)) {
    return {
      evaluation: "skipped",
      physicalClaim: false,
      reason: "Requirement family is not the exact canonical BT-01 coverage row."
    }
  }
  if (row.state === "unsupported") {
    return { evaluation: "skipped", physicalClaim: false, reason: "Behavior is explicitly unsupported by BT-01." }
  }
  validateTesterRunObservations(observations)
  if (observations.infrastructure !== "pass") {
    return {
      evaluation: "infrastructureError",
      physicalClaim: false,
      reason: "Instrument, setup, calibration, or capture infrastructure did not establish a valid run."
    }
  }
  if (scope === "virtual") {
    if (observations.virtual === "fail") {
      return { evaluation: "fail", physicalClaim: false, reason: "Virtual corpus did not match its expectation." }
    }
    if (observations.virtual !== "pass") {
      return { evaluation: "indeterminate", physicalClaim: false, reason: "Virtual corpus result is unavailable." }
    }
    return { evaluation: "pass", physicalClaim: false, reason: "Virtual corpus result only." }
  }
  if (observations.dutSelfReport === "fail" || observations.physicalObserver === "fail") {
    return {
      evaluation: "fail",
      physicalClaim: false,
      reason: "A required DUT correlation or independent physical observation did not match the expectation."
    }
  }
  if (observations.dutSelfReport !== "pass" || observations.physicalObserver !== "pass") {
    return {
      evaluation: "indeterminate",
      physicalClaim: false,
      reason: "Required DUT correlation or independent physical observation is unavailable."
    }
  }
  return {
    evaluation: "pass",
    physicalClaim: false,
    reason: "DUT correlation and independent physical observer matched the expectation."
  }
}
