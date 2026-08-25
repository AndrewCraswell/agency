/** BP-123: one-domain P0 reset, brownout, and watchdog contract. */

import { calculateApplicationRail, defaultApplicationRailInputs } from "./application-rail.js"
import {
  benchPrototypeApplicationRail,
  validateBenchPrototypeApplicationRail
} from "./bench-prototype-application-rail.js"
import {
  benchPrototypeEsp32Allocation,
  validateBenchPrototypeEsp32Allocation
} from "./bench-prototype-esp32-allocation.js"

type PlainRecord = Record<PropertyKey, unknown>

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) throw new RangeError("BP-123 canonical data cannot contain cycles or aliases")
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError("BP-123 canonical data may contain only data properties")
    }
    deepFreeze(descriptor.value, seen)
  }
  return Object.freeze(value)
}

function isPlainRecord(value: unknown): value is PlainRecord {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  )
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
    if (Object.getPrototypeOf(actual) !== Array.prototype || Object.getPrototypeOf(expected) !== Array.prototype)
      return false
  } else if (!(isPlainRecord(actual) && isPlainRecord(expected))) return false
  const actualKeys = Reflect.ownKeys(actual)
  const expectedKeys = Reflect.ownKeys(expected)
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key) => typeof key === "symbol") ||
    expectedKeys.some((key) => typeof key === "symbol")
  )
    return false
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

function hasExactKeys(value: unknown, keys: readonly string[]): value is PlainRecord {
  return isPlainRecord(value) && Object.keys(value).length === keys.length && keys.every((key) => key in value)
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function sha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value)
}

function canonicalTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)) return false
  const date = new Date(value)
  return !Number.isNaN(date.getTime()) && date.toISOString() === value
}

const captureRequirements = [
  {
    captureId: "BP123-COLD-START",
    requiredObservedSignals: ["V3_3", "APP_RESET_N", "EN_RESET", "APP_W5500_RESET_N", "HUB75_SAFE_N"],
    requiredMetrics: [{ id: "RESET_RELEASE_DELAY_MS", unit: "ms", minimum: 53.04, maximum: 500 }]
  },
  {
    captureId: "BP123-BROWNOUT",
    requiredObservedSignals: ["V3_3", "APP_RESET_N", "EN_RESET", "APP_W5500_RESET_N", "HUB75_SAFE_N"],
    requiredMetrics: [
      { id: "FALLING_THRESHOLD_V", unit: "V", minimum: 3.1383, maximum: 3.2017 },
      { id: "RISING_THRESHOLD_V", unit: "V", minimum: 3.15711, maximum: 3.22089 },
      { id: "HYSTERESIS_V", unit: "V", minimum: 0.001, maximum: 0.1 }
    ]
  },
  {
    captureId: "BP123-WATCHDOG",
    requiredObservedSignals: ["APP_WD_KICK", "APP_RESET_N", "EN_RESET", "APP_W5500_RESET_N", "HUB75_SAFE_N"],
    requiredMetrics: [
      { id: "WATCHDOG_TIMEOUT_MS", unit: "ms", minimum: 170, maximum: 230 },
      { id: "WATCHDOG_RESET_PULSE_MS", unit: "ms", minimum: 170, maximum: 230 }
    ]
  },
  {
    captureId: "BP123-MANUAL-COMMON-RESET",
    requiredObservedSignals: ["MANUAL_RESET_N", "APP_RESET_N", "EN_RESET", "APP_W5500_RESET_N", "HUB75_SAFE_N"],
    requiredMetrics: [
      { id: "MANUAL_ASSERTION_DELAY_MS", unit: "ms", minimum: 0, maximum: 10 },
      { id: "MANUAL_RELEASE_DELAY_MS", unit: "ms", minimum: 53.04, maximum: 500 }
    ]
  },
  {
    captureId: "BP123-POWER-OFF-BACKFEED",
    requiredObservedSignals: ["V3_3", "EN_RESET", "APP_W5500_RESET_N", "INJECTED_CURRENT"],
    requiredMetrics: [
      { id: "V3_3_BACKFEED_CURRENT_MA", unit: "mA", minimum: 0, maximum: 0.1 },
      { id: "EN_RESET_RELEASE_V", unit: "V", minimum: 0, maximum: 0.3 }
    ]
  }
] as const

type CaptureRequirement = (typeof captureRequirements)[number]

export type BenchPrototypeResetWatchdogPhysicalCapture = {
  readonly captureId: CaptureRequirement["captureId"]
  readonly status: "measured"
  readonly recordedAtUtc: string
  readonly operator: string
  readonly prototype: { readonly assemblyId: string; readonly boardRevision: string; readonly serialNumber: string }
  readonly instrument: {
    readonly manufacturer: string
    readonly model: string
    readonly serialNumber: string
    readonly calibrationArtifact: { readonly artifactId: string; readonly contentSha256: string }
    readonly calibrationDueDate: string
  }
  readonly captureArtifact: { readonly artifactId: string; readonly contentSha256: string }
  readonly setupArtifact: { readonly artifactId: string; readonly contentSha256: string }
  readonly procedure: { readonly revision: string; readonly artifactId: string; readonly contentSha256: string }
  readonly injectedInputProfile: { readonly artifactId: string; readonly contentSha256: string }
  readonly observedSignals: readonly string[]
  readonly measurements: readonly { readonly id: string; readonly unit: "ms" | "V" | "mA"; readonly value: number }[]
}

export type BenchPrototypeResetWatchdogPhysicalEvidence = {
  readonly artifactKind: "bench-prototype-reset-watchdog-physical-evidence"
  readonly evidenceId: string
  readonly captures: readonly BenchPrototypeResetWatchdogPhysicalCapture[]
}

export type BenchPrototypeResetWatchdogPhysicalEvidenceEvaluation = {
  readonly accepted: boolean
  readonly reasons: readonly string[]
}

function hasCaptureShape(value: unknown): value is BenchPrototypeResetWatchdogPhysicalCapture {
  return (
    hasExactKeys(value, [
      "captureId",
      "status",
      "recordedAtUtc",
      "operator",
      "prototype",
      "instrument",
      "captureArtifact",
      "setupArtifact",
      "procedure",
      "injectedInputProfile",
      "observedSignals",
      "measurements"
    ]) &&
    hasExactKeys(value.prototype, ["assemblyId", "boardRevision", "serialNumber"]) &&
    hasExactKeys(value.instrument, [
      "manufacturer",
      "model",
      "serialNumber",
      "calibrationArtifact",
      "calibrationDueDate"
    ]) &&
    hasExactKeys(value.instrument.calibrationArtifact, ["artifactId", "contentSha256"]) &&
    hasExactKeys(value.captureArtifact, ["artifactId", "contentSha256"]) &&
    hasExactKeys(value.setupArtifact, ["artifactId", "contentSha256"]) &&
    hasExactKeys(value.procedure, ["revision", "artifactId", "contentSha256"]) &&
    hasExactKeys(value.injectedInputProfile, ["artifactId", "contentSha256"]) &&
    Array.isArray(value.observedSignals) &&
    Array.isArray(value.measurements) &&
    value.measurements.every((measurement) => hasExactKeys(measurement, ["id", "unit", "value"]))
  )
}

/** Rejects missing, uncalibrated, duplicated, out-of-limit, or non-canonical measurement submissions. */
export function evaluateBenchPrototypeResetWatchdogPhysicalEvidence(
  value: unknown
): BenchPrototypeResetWatchdogPhysicalEvidenceEvaluation {
  const reasons: string[] = []
  if (!hasExactKeys(value, ["artifactKind", "evidenceId", "captures"]) || !Array.isArray(value.captures)) {
    return deepFreeze({ accepted: false, reasons: ["physical evidence must contain the exact BP-123 envelope"] })
  }
  if (value.artifactKind !== "bench-prototype-reset-watchdog-physical-evidence")
    reasons.push("artifact kind is invalid")
  if (!nonEmptyString(value.evidenceId)) reasons.push("evidenceId is required")
  if (value.captures.length !== captureRequirements.length)
    reasons.push("all five required BP-123 capture classes are required")
  let sample: string | undefined
  const uniqueArtifacts = new Set<string>()
  for (const [index, requirement] of captureRequirements.entries()) {
    const capture = value.captures[index]
    if (!hasCaptureShape(capture)) {
      reasons.push(`${requirement.captureId} must contain the exact capture schema`)
      continue
    }
    if (capture.captureId !== requirement.captureId || capture.status !== "measured") {
      reasons.push(`${requirement.captureId} must be measured in canonical order`)
    }
    if (!canonicalTimestamp(capture.recordedAtUtc) || !nonEmptyString(capture.operator)) {
      reasons.push(`${requirement.captureId} requires an operator and canonical UTC timestamp`)
    }
    const identity = `${capture.prototype.assemblyId}\u0000${capture.prototype.boardRevision}\u0000${capture.prototype.serialNumber}`
    if (
      !nonEmptyString(capture.prototype.assemblyId) ||
      !nonEmptyString(capture.prototype.boardRevision) ||
      !nonEmptyString(capture.prototype.serialNumber)
    )
      reasons.push(`${requirement.captureId} requires prototype identity`)
    else if (sample === undefined) sample = identity
    else if (sample !== identity) reasons.push("every BP-123 capture must identify the same prototype")
    const captureDate = new Date(capture.recordedAtUtc)
    const dueDate = new Date(capture.instrument.calibrationDueDate)
    if (
      !nonEmptyString(capture.instrument.manufacturer) ||
      !nonEmptyString(capture.instrument.model) ||
      !nonEmptyString(capture.instrument.serialNumber) ||
      Number.isNaN(dueDate.getTime()) ||
      captureDate > dueDate
    )
      reasons.push(`${requirement.captureId} requires calibrated instrument provenance`)
    for (const artifact of [
      capture.captureArtifact,
      capture.setupArtifact,
      capture.instrument.calibrationArtifact,
      capture.procedure,
      capture.injectedInputProfile
    ]) {
      if (!nonEmptyString(artifact.artifactId) || !sha256(artifact.contentSha256)) {
        reasons.push(`${requirement.captureId} requires immutable artifact IDs and SHA-256 digests`)
      } else if (uniqueArtifacts.has(`${artifact.artifactId}\u0000${artifact.contentSha256}`)) {
        reasons.push(`${requirement.captureId} reuses an artifact identity`)
      } else uniqueArtifacts.add(`${artifact.artifactId}\u0000${artifact.contentSha256}`)
    }
    if (!nonEmptyString(capture.procedure.revision))
      reasons.push(`${requirement.captureId} requires a procedure revision`)
    if (
      capture.observedSignals.length !== new Set(capture.observedSignals).size ||
      requirement.requiredObservedSignals.some((signal) => !capture.observedSignals.includes(signal))
    )
      reasons.push(`${requirement.captureId} omits or repeats an observed signal`)
    if (capture.measurements.length !== requirement.requiredMetrics.length) {
      reasons.push(`${requirement.captureId} requires exactly its frozen metrics`)
    } else
      requirement.requiredMetrics.forEach((limit, metricIndex) => {
        const measurement = capture.measurements[metricIndex]
        if (
          measurement === undefined ||
          measurement.id !== limit.id ||
          measurement.unit !== limit.unit ||
          typeof measurement.value !== "number" ||
          !Number.isFinite(measurement.value) ||
          measurement.value < limit.minimum ||
          measurement.value > limit.maximum
        )
          reasons.push(`${requirement.captureId} metric ${limit.id} is missing, extra, or out of limit`)
      })
  }
  return deepFreeze({ accepted: reasons.length === 0, reasons })
}

const timing = calculateApplicationRail()
const resistor10k = "RC0603FR-0710KL"
const resistor100k = "RC0603FR-07100KL"
const ceramic100n = "C0603C104K3RACTU"
const removedResetMpn: readonly string[] = ["SN74LVC2G07DCKR", "BSS138AKA"]
const schematicNets: readonly { readonly net: string; readonly endpoints: readonly string[] }[] = [
  { net: "V3_3", endpoints: ["U_APP_SUPERVISOR.VDD", "U_APP_WATCHDOG.VDD", "R_ESP_EN_PULLUP.1"] },
  {
    net: "APP_RESET_N",
    endpoints: ["U_APP_SUPERVISOR.RESET", "U_APP_WATCHDOG.WDO", "U_APP_WATCHDOG.ENOUT", "MANUAL_RESET_N"]
  },
  { net: "EN_RESET", endpoints: ["U_ESP32.EN", "R_ESP_EN_PULLUP.2", "C_ESP_EN_DELAY.1"] },
  { net: "APP_WD_KICK", endpoints: ["U_ESP32.GPIO12", "U_APP_WATCHDOG.WDI", "R_APP_WDI_PULLUP.1"] },
  { net: "APP_W5500_RESET_N", endpoints: ["U_W5500.RST_N", "APP_RESET_N"] },
  { net: "PRIMARY_OUTPUT_DISABLE_N", endpoints: ["primary-output safe enable", "APP_RESET_N"] },
  { net: "HUB75_SAFE_N", endpoints: ["hub75 safing", "APP_RESET_N"] },
  { net: "APP_GND", endpoints: ["U_APP_SUPERVISOR.GND", "U_APP_WATCHDOG.GND", "C_ESP_EN_DELAY.2"] }
]

const definition = {
  workUnit: "BP-123",
  architecture: "single APP_3V3 reset domain for the ESP32-only P0",
  releaseState: "deny",
  prerequisites: {
    application3v3: { workUnit: "BP-142", net: "V3_3", evidenceState: "deny" },
    esp32Allocation: { workUnit: "BP-121", enable: "EN_RESET", watchdogWdi: "GPIO12" }
  },
  parts: [
    {
      reference: "U_APP_SUPERVISOR",
      mpn: "TPS389033DSER",
      value: "3.3 V precision supervisor",
      connections: "VDD/SENSE/MR to V3_3; RESET to APP_RESET_N; CT to C_APP_SUPERVISOR_CT; GND to APP_GND"
    },
    {
      reference: "U_APP_WATCHDOG",
      mpn: "TPS3431SDRBR",
      value: "external watchdog",
      connections: "VDD/EN/SET1 to V3_3; WDI from APP_WD_KICK; WDO+ENOUT to APP_RESET_N; GND to APP_GND"
    },
    {
      reference: "C_APP_SUPERVISOR_CT",
      mpn: ceramic100n,
      value: "100 nF X7R CT",
      connections: "U_APP_SUPERVISOR.CT to APP_GND"
    },
    {
      reference: "C_APP_SUPERVISOR_BYPASS",
      mpn: ceramic100n,
      value: "100 nF X7R bypass",
      connections: "V3_3 to APP_GND at U_APP_SUPERVISOR"
    },
    {
      reference: "C_APP_WD_BYPASS",
      mpn: ceramic100n,
      value: "100 nF X7R bypass",
      connections: "V3_3 to APP_GND at U_APP_WATCHDOG"
    },
    { reference: "R_APP_WD_CWD", mpn: resistor10k, value: "10 kOhm, 1%", connections: "U_APP_WATCHDOG.CWD to V3_3" },
    { reference: "R_APP_WDI_PULLUP", mpn: resistor100k, value: "100 kOhm, 1%", connections: "APP_WD_KICK to V3_3" },
    { reference: "R_ESP_EN_PULLUP", mpn: resistor10k, value: "10 kOhm, 1%", connections: "EN_RESET to V3_3" },
    {
      reference: "C_ESP_EN_DELAY",
      mpn: "C1608X5R1A105K080AC",
      value: "1 uF X5R reset delay",
      connections: "EN_RESET to APP_GND"
    },
    {
      reference: "R_MANUAL_RESET_PULLUP",
      mpn: resistor10k,
      value: "10 kOhm, 1%",
      connections: "MANUAL_RESET_N to V3_3"
    }
  ],
  timingEvidence: {
    supervisor: {
      part: "TPS389033DSER",
      fallingThresholdNominalV: defaultApplicationRailInputs.supervisorFallingNominalV,
      risingThresholdNominalV: defaultApplicationRailInputs.supervisorRisingNominalV,
      thresholdAccuracyFraction: 0.01,
      releaseDelayGuaranteedMinimumMs: Number(timing.supervisorDelayGuaranteedMinMs.toFixed(2)),
      releaseDelayNominalMs: Number(timing.supervisorDelayNominalMs.toFixed(2)),
      ctCapacitorMpn: ceramic100n
    },
    watchdog: {
      part: "TPS3431SDRBR",
      cwdConnection: "10 kOhm to V3_3 with SET1 high",
      watchdogTimeoutMs: { minimum: 170, nominal: 200, maximum: 230 },
      resetPulseMs: { minimum: 170, nominal: 200, maximum: 230 }
    }
  },
  watchdogKick: {
    source: "ESP32-S3-WROOM-1U-N16R2 GPIO12 APP_WD_KICK",
    input: "U_APP_WATCHDOG.WDI",
    activeEdge: "falling",
    gpioMode: "open-drain; briefly sink low then release",
    maximumFirmwareKickIntervalMs: 100,
    healthRule:
      "GPIO12 may kick only after the aggregate acquisition, frame-queue, reference, primary-output, rail, and watchdog-health epoch passes.",
    failureSemantics:
      "High-Z, stuck-high, stuck-low, stale, or incomplete health epochs create no repeated falling edge and reset fail closed."
  },
  resetTopology: {
    application: {
      resetNet: "EN_RESET",
      commonResetNet: "APP_RESET_N",
      sinks: ["U_APP_SUPERVISOR.RESET", "U_APP_WATCHDOG.WDO+ENOUT", "MANUAL_RESET_N open-drain only"],
      consumers: ["U_ESP32.EN", "U_W5500.RST_N", "PRIMARY_OUTPUT_DISABLE_N", "HUB75_SAFE_N"],
      pullup: "R_ESP_EN_PULLUP to V3_3",
      rule: "APP_RESET_N is open-drain asserted by supervisor, watchdog, or manual reset and drives EN_RESET plus W5500, primary-output disable, and HUB75 safing. No consumer may source a reset net."
    },
    removedPaths: [
      "No STM32",
      "No processor isolation",
      "No cross-domain reset",
      "No reset fanout IC",
      "No heartbeat reset path",
      "No second reset pull-up"
    ]
  },
  truthTable: [
    {
      condition: "cold start",
      result:
        "supervisor asserts APP_RESET_N; ESP32, W5500, primary outputs, and HUB75 remain disabled until reset release"
    },
    { condition: "brownout", result: "supervisor asserts APP_RESET_N and all consumers remain safely reset" },
    {
      condition: "watchdog or WDI fault",
      result: "TPS3431 asserts APP_RESET_N for 170 to 230 ms; no static GPIO12 level is a kick"
    },
    {
      condition: "manual common reset",
      result: "open-drain manual source asserts APP_RESET_N; every consumer resets together"
    },
    {
      condition: "power off",
      result: "all reset consumers remain unpowered or asserted; no external source may backfeed V3_3"
    }
  ],
  physicalEvidenceIntake: {
    artifactKind: "bench-prototype-reset-watchdog-physical-evidence-intake",
    state: "absent",
    requiredCaptures: captureRequirements,
    captures: [],
    authority: {
      physicalEvidenceAccepted: false,
      benchTruthTableVerified: false,
      schematicIntegrationAuthorized: false,
      fabricationAuthorized: false,
      releaseState: "deny"
    }
  },
  schematicIntegrationPreflight: {
    state: "not-submitted",
    submittedReconciliation: null,
    requiredNets: schematicNets,
    authority: {
      staticNetReconciliationAccepted: false,
      independentSchematicReviewAccepted: false,
      physicalEvidenceAccepted: false,
      schematicIntegrationAuthorized: false,
      fabricationAuthorized: false,
      releaseState: "deny"
    }
  },
  deniedEvidence: {
    exactFootprintsApproved: false,
    supervisorAndWatchdogTimingMeasured: false,
    layoutApproved: false,
    benchTruthTableVerified: false,
    powerOffBackfeedMeasured: false,
    schematicIntegrationApproved: false,
    fabricationApproved: false
  },
  openGates: [
    "Integrate the exact nets in BP-300 and clear ERC.",
    "Capture all five physical classes on one assembled prototype.",
    "Confirm reset-safe primary-output and HUB75 behavior without adding a reset source."
  ]
} as const

export const benchPrototypeResetWatchdog = deepFreeze(definition)

/** Rejects substitutions, aliases, accessors, stale allocation, or relaxed fail-closed behavior. */
export function validateBenchPrototypeResetWatchdog(value: unknown): true {
  validateBenchPrototypeEsp32Allocation(benchPrototypeEsp32Allocation)
  validateBenchPrototypeApplicationRail(benchPrototypeApplicationRail)
  if (!sameDataGraph(value, benchPrototypeResetWatchdog))
    throw new RangeError("BP-123 contract must exactly match the reviewed data graph")
  const contract = benchPrototypeResetWatchdog
  if (
    !benchPrototypeEsp32Allocation.pads.some((pad) => pad.pad === 3 && pad.pin === "EN" && pad.signal === "EN_RESET") ||
    !benchPrototypeEsp32Allocation.pads.some(
      (pad) => "gpio" in pad && pad.gpio === 12 && pad.signal === "APP_WD_KICK"
    ) ||
    contract.parts.filter((part) => part.mpn === "TPS389033DSER").length !== 1 ||
    contract.parts.filter((part) => part.mpn === "TPS3431SDRBR").length !== 1 ||
    contract.parts.some((part) => removedResetMpn.includes(part.mpn)) ||
    contract.resetTopology.application.consumers.join(",") !==
      "U_ESP32.EN,U_W5500.RST_N,PRIMARY_OUTPUT_DISABLE_N,HUB75_SAFE_N" ||
    contract.resetTopology.removedPaths.length !== 6 ||
    contract.watchdogKick.maximumFirmwareKickIntervalMs >= contract.timingEvidence.watchdog.watchdogTimeoutMs.minimum ||
    !contract.watchdogKick.healthRule.includes("acquisition, frame-queue, reference, primary-output, rail") ||
    contract.physicalEvidenceIntake.requiredCaptures.length !== 5 ||
    contract.physicalEvidenceIntake.captures.length !== 0 ||
    contract.physicalEvidenceIntake.authority.releaseState !== "deny" ||
    contract.schematicIntegrationPreflight.state !== "not-submitted" ||
    contract.schematicIntegrationPreflight.submittedReconciliation !== null ||
    contract.deniedEvidence.fabricationApproved ||
    contract.releaseState !== "deny"
  )
    throw new RangeError("BP-123 must preserve one-domain fail-closed supervision")
  return true
}
