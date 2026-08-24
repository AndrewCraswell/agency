/**
 * BP-123: reset, brownout-supervision, and watchdog schematic contract.
 *
 * This is deliberately an electrical-input contract for the one-board bench
 * prototype. It does not grant footprint, placement, bench, or fabrication
 * approval.
 */

import { calculateApplicationRail, defaultApplicationRailInputs } from "./application-rail.js"
import {
  benchPrototypeApplicationRail,
  validateBenchPrototypeApplicationRail
} from "./bench-prototype-application-rail.js"
import {
  benchPrototypeEsp32Allocation,
  validateBenchPrototypeEsp32Allocation
} from "./bench-prototype-esp32-allocation.js"
import { parseCanonicalUtcTimestamp, parseRealUtcDate } from "./bench-prototype-evidence-time.js"
import { stm32PinAllocation, validateStm32PinAllocation } from "./stm32-pin-allocation.js"

type PlainRecord = Record<PropertyKey, unknown>

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) throw new RangeError("Canonical BP-123 contract cannot contain cycles or aliases")
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError("Canonical BP-123 contract may contain only data properties")
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
  actualSeen: WeakSet<object>,
  expectedSeen: WeakSet<object>
): boolean {
  if (actual === null || expected === null || typeof actual !== "object" || typeof expected !== "object") {
    return Object.is(actual, expected)
  }
  if (actualSeen.has(actual) || expectedSeen.has(expected)) return false
  actualSeen.add(actual)
  expectedSeen.add(expected)
  const actualArray = Array.isArray(actual)
  const expectedArray = Array.isArray(expected)
  if (actualArray !== expectedArray) return false
  if (actualArray) {
    if (Object.getPrototypeOf(actual) !== Array.prototype || Object.getPrototypeOf(expected) !== Array.prototype)
      return false
  } else if (!(isPlainRecord(actual) && isPlainRecord(expected))) return false

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

function hasExactKeys(value: unknown, expected: readonly string[]): value is PlainRecord {
  if (!isPlainRecord(value)) return false
  const actual = Object.keys(value)
  return actual.length === expected.length && expected.every((key) => actual.includes(key))
}

function inspectPlainDataGraph(value: unknown, path: string, seen: WeakSet<object>, reasons: string[]): void {
  if (value === null || typeof value !== "object") return
  if (seen.has(value)) {
    reasons.push(`${path} contains a cycle or object alias`)
    return
  }
  seen.add(value)
  const keys = Reflect.ownKeys(value)
  if (Array.isArray(value)) {
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length")
    if (
      Object.getPrototypeOf(value) !== Array.prototype ||
      lengthDescriptor === undefined ||
      !("value" in lengthDescriptor) ||
      !Number.isSafeInteger(lengthDescriptor.value) ||
      lengthDescriptor.value < 0
    ) {
      reasons.push(`${path} must be a plain array with a valid length`)
      return
    }
    const expectedKeys: PropertyKey[] = Array.from({ length: lengthDescriptor.value }, (_, index) => String(index))
    expectedKeys.push("length")
    if (keys.length !== expectedKeys.length || keys.some((key, index) => key !== expectedKeys[index])) {
      reasons.push(`${path} must be dense and contain no extra or symbol keys`)
      return
    }
    for (let index = 0; index < lengthDescriptor.value; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index))
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        reasons.push(`${path}[${index}] must be an enumerable data property`)
        return
      }
      inspectPlainDataGraph(descriptor.value, `${path}[${index}]`, seen, reasons)
    }
    return
  }
  if (!isPlainRecord(value)) {
    reasons.push(`${path} must be a plain data record`)
    return
  }
  for (const key of keys) {
    if (typeof key === "symbol") {
      reasons.push(`${path} must not contain symbol keys`)
      return
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
      reasons.push(`${path}.${key} must be an enumerable data property`)
      return
    }
    inspectPlainDataGraph(descriptor.value, `${path}.${key}`, seen, reasons)
  }
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value)
}

const resetWatchdogPhysicalCaptureRequirements = [
  {
    captureId: "BP123-COLD-START",
    requiredObservedSignals: ["SCORING_3V3", "V3_3", "SCORING_NRST_N", "EN_RESET", "APP_W5500_RESET_N"],
    requiredMetrics: [
      { id: "SCORING_RESET_RELEASE_DELAY_MS", unit: "ms", minimum: 53.04, maximum: 500 },
      { id: "APPLICATION_RESET_RELEASE_DELAY_MS", unit: "ms", minimum: 53.04, maximum: 500 }
    ]
  },
  {
    captureId: "BP123-BROWNOUT",
    requiredObservedSignals: [
      "SCORING_3V3",
      "V3_3",
      "SCORING_NRST_N",
      "EN_RESET",
      "APP_SUPERVISOR_RESET_N",
      "APP_W5500_RESET_N"
    ],
    requiredMetrics: [
      { id: "SCORING_FALLING_THRESHOLD_V", unit: "V", minimum: 3.1383, maximum: 3.2017 },
      { id: "SCORING_RISING_THRESHOLD_V", unit: "V", minimum: 3.15711, maximum: 3.22089 },
      { id: "SCORING_HYSTERESIS_V", unit: "V", minimum: 0.001, maximum: 0.1 },
      { id: "APPLICATION_FALLING_THRESHOLD_V", unit: "V", minimum: 3.1383, maximum: 3.2017 },
      { id: "APPLICATION_RISING_THRESHOLD_V", unit: "V", minimum: 3.15711, maximum: 3.22089 },
      { id: "APPLICATION_HYSTERESIS_V", unit: "V", minimum: 0.001, maximum: 0.1 }
    ]
  },
  {
    captureId: "BP123-WATCHDOG",
    requiredObservedSignals: [
      "SCORING_WATCHDOG_WDI",
      "APP_WD_KICK",
      "SCORING_NRST_N",
      "EN_RESET",
      "U_STM_WATCHDOG.WDO+ENOUT",
      "U_ESP_WATCHDOG.WDO+ENOUT"
    ],
    requiredMetrics: [
      { id: "SCORING_WATCHDOG_TIMEOUT_MS", unit: "ms", minimum: 170, maximum: 230 },
      { id: "SCORING_WATCHDOG_RESET_PULSE_MS", unit: "ms", minimum: 170, maximum: 230 },
      { id: "APPLICATION_WATCHDOG_TIMEOUT_MS", unit: "ms", minimum: 170, maximum: 230 },
      { id: "APPLICATION_WATCHDOG_RESET_PULSE_MS", unit: "ms", minimum: 170, maximum: 230 }
    ]
  },
  {
    captureId: "BP123-MANUAL-RESET",
    requiredObservedSignals: ["MANUAL_RESET_ASSERT", "EN_RESET", "SCORING_NRST_N", "APP_W5500_RESET_N"],
    requiredMetrics: [
      { id: "MANUAL_RESET_ASSERTION_DELAY_MS", unit: "ms", minimum: 0, maximum: 10 },
      { id: "MANUAL_RESET_RELEASE_DELAY_MS", unit: "ms", minimum: 53.04, maximum: 500 }
    ]
  },
  {
    captureId: "BP123-CROSS-DOMAIN",
    requiredObservedSignals: ["ESP32_RESET_ASSERT", "RESET_REQUEST", "EN_RESET", "SCORING_NRST_N"],
    requiredMetrics: [
      { id: "RESET_REQUEST_PROPAGATION_MS", unit: "ms", minimum: 0, maximum: 10 },
      { id: "EN_RESET_ASSERTION_DELAY_MS", unit: "ms", minimum: 0, maximum: 10 }
    ]
  },
  {
    captureId: "BP123-POWER-OFF",
    requiredObservedSignals: [
      "SCORING_3V3",
      "V3_3",
      "ESP32_RESET_ASSERT",
      "RESET_REQUEST",
      "EN_RESET",
      "INJECTED_CURRENT"
    ],
    requiredMetrics: [
      { id: "V3_3_BACKFEED_CURRENT_MA", unit: "mA", minimum: 0, maximum: 0.1 },
      { id: "SCORING_3V3_BACKFEED_CURRENT_MA", unit: "mA", minimum: 0, maximum: 0.1 },
      { id: "EN_RESET_RELEASE_V", unit: "V", minimum: 0, maximum: 0.3 }
    ]
  }
] as const

type ResetWatchdogPhysicalCaptureId = (typeof resetWatchdogPhysicalCaptureRequirements)[number]["captureId"]

/**
 * Submission schema only. The canonical BP-123 contract intentionally retains
 * no physical capture, instrument identity, or content digest until a real
 * prototype run can supply them.
 */
export type BenchPrototypeResetWatchdogPhysicalCapture = {
  readonly captureId: ResetWatchdogPhysicalCaptureId
  readonly status: "measured"
  readonly recordedAtUtc: string
  readonly operator: string
  readonly prototype: {
    readonly assemblyId: string
    readonly boardRevision: string
    readonly serialNumber: string
  }
  readonly instrument: {
    readonly manufacturer: string
    readonly model: string
    readonly serialNumber: string
    readonly calibrationArtifact: { readonly artifactId: string; readonly contentSha256: string }
    readonly calibrationDueDate: string
  }
  readonly captureArtifact: {
    readonly artifactId: string
    readonly contentSha256: string
  }
  readonly setupArtifact: {
    readonly artifactId: string
    readonly contentSha256: string
  }
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

type RawPhysicalArtifact = { readonly artifactId: unknown; readonly contentSha256: unknown }
type RawPhysicalPrototype = {
  readonly assemblyId: unknown
  readonly boardRevision: unknown
  readonly serialNumber: unknown
}
type RawPhysicalInstrument = {
  readonly manufacturer: unknown
  readonly model: unknown
  readonly serialNumber: unknown
  readonly calibrationArtifact: RawPhysicalArtifact
  readonly calibrationDueDate: unknown
}
type RawPhysicalCapture = {
  readonly captureId: unknown
  readonly status: unknown
  readonly recordedAtUtc: unknown
  readonly operator: unknown
  readonly prototype: RawPhysicalPrototype
  readonly instrument: RawPhysicalInstrument
  readonly captureArtifact: RawPhysicalArtifact
  readonly setupArtifact: RawPhysicalArtifact
  readonly procedure: { readonly revision: unknown; readonly artifactId: unknown; readonly contentSha256: unknown }
  readonly injectedInputProfile: RawPhysicalArtifact
  readonly observedSignals: unknown[]
  readonly measurements: { readonly id: unknown; readonly unit: unknown; readonly value: unknown }[]
}

function hasPhysicalCaptureShape(value: unknown): value is RawPhysicalCapture {
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
    hasExactKeys(value.captureArtifact, ["artifactId", "contentSha256"]) &&
    hasExactKeys(value.setupArtifact, ["artifactId", "contentSha256"]) &&
    hasExactKeys(value.instrument.calibrationArtifact, ["artifactId", "contentSha256"]) &&
    hasExactKeys(value.procedure, ["revision", "artifactId", "contentSha256"]) &&
    hasExactKeys(value.injectedInputProfile, ["artifactId", "contentSha256"]) &&
    Array.isArray(value.observedSignals) &&
    Array.isArray(value.measurements) &&
    value.measurements.every((measurement) => hasExactKeys(measurement, ["id", "unit", "value"]))
  )
}

/** Rejects incomplete, uncalibrated, unhashed, duplicate, or under-scoped physical-capture submissions. */
export function evaluateBenchPrototypeResetWatchdogPhysicalEvidence(
  value: unknown
): BenchPrototypeResetWatchdogPhysicalEvidenceEvaluation {
  const reasons: string[] = []
  inspectPlainDataGraph(value, "physicalEvidence", new WeakSet<object>(), reasons)
  if (reasons.length > 0) return deepFreeze({ accepted: false, reasons })
  if (!hasExactKeys(value, ["artifactKind", "evidenceId", "captures"]) || !Array.isArray(value.captures)) {
    return deepFreeze({ accepted: false, reasons: ["physical evidence must contain only the exact BP-123 data keys"] })
  }
  if (value.artifactKind !== "bench-prototype-reset-watchdog-physical-evidence")
    reasons.push("artifact kind is invalid")
  if (!nonEmptyString(value.evidenceId)) reasons.push("evidenceId is required")
  if (value.captures.length !== resetWatchdogPhysicalCaptureRequirements.length) {
    reasons.push("all six required BP-123 capture classes are required")
  }

  const artifactIds = new Set<string>()
  const digests = new Set<string>()
  let prototypeIdentity: string | null = null
  for (const [index, requirement] of resetWatchdogPhysicalCaptureRequirements.entries()) {
    const capture = value.captures[index]
    if (!hasPhysicalCaptureShape(capture)) {
      reasons.push(`${requirement.captureId} must contain the exact capture schema`)
      continue
    }
    if (capture.captureId !== requirement.captureId || capture.status !== "measured") {
      reasons.push(`${requirement.captureId} must be measured in canonical order`)
    }
    const recordedAt = parseCanonicalUtcTimestamp(capture.recordedAtUtc)
    const calibrationDueDate = parseRealUtcDate(capture.instrument.calibrationDueDate)
    if (recordedAt === null || !nonEmptyString(capture.operator)) {
      reasons.push(`${requirement.captureId} requires a real UTC timestamp and operator`)
    }
    if (
      !nonEmptyString(capture.prototype.assemblyId) ||
      !nonEmptyString(capture.prototype.boardRevision) ||
      !nonEmptyString(capture.prototype.serialNumber)
    ) {
      reasons.push(`${requirement.captureId} requires prototype assembly, revision, and serial identity`)
    } else {
      const identity = `${capture.prototype.assemblyId}\u0000${capture.prototype.boardRevision}\u0000${capture.prototype.serialNumber}`
      if (prototypeIdentity === null) prototypeIdentity = identity
      else if (prototypeIdentity !== identity) reasons.push("all six BP-123 captures must identify the same prototype")
    }
    if (
      !nonEmptyString(capture.instrument.manufacturer) ||
      !nonEmptyString(capture.instrument.model) ||
      !nonEmptyString(capture.instrument.serialNumber) ||
      calibrationDueDate === null
    ) {
      reasons.push(`${requirement.captureId} requires calibrated instrument provenance`)
    } else if (recordedAt !== null && recordedAt.getTime() > calibrationDueDate.getTime() + 86_399_999) {
      reasons.push(`${requirement.captureId} instrument calibration must remain valid on the capture date`)
    }
    for (const [kind, artifact] of [
      ["capture", capture.captureArtifact],
      ["setup", capture.setupArtifact],
      ["calibration", capture.instrument.calibrationArtifact],
      ["procedure", capture.procedure],
      ["injected input profile", capture.injectedInputProfile]
    ] as const) {
      if (!nonEmptyString(artifact.artifactId) || !isSha256(artifact.contentSha256)) {
        reasons.push(`${requirement.captureId} ${kind} artifact requires an ID and lowercase SHA-256`)
      } else if (
        (kind === "capture" || kind === "setup" || kind === "injected input profile") &&
        (artifactIds.has(artifact.artifactId) || digests.has(artifact.contentSha256))
      ) {
        reasons.push(`${requirement.captureId} ${kind} artifact ID and SHA-256 must be immutable and unique`)
      } else if (kind === "capture" || kind === "setup" || kind === "injected input profile") {
        artifactIds.add(artifact.artifactId)
        digests.add(artifact.contentSha256)
      }
    }
    if (!nonEmptyString(capture.procedure.revision)) {
      reasons.push(`${requirement.captureId} requires an exact procedure revision`)
    }
    if (
      capture.observedSignals.length !== new Set(capture.observedSignals).size ||
      requirement.requiredObservedSignals.some((signal) => !capture.observedSignals.includes(signal))
    ) {
      reasons.push(`${requirement.captureId} omits a required observed signal or repeats one`)
    }
    if (capture.measurements.length !== requirement.requiredMetrics.length) {
      reasons.push(`${requirement.captureId} requires exactly its frozen metrics`)
    } else {
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
        ) {
          reasons.push(`${requirement.captureId} metric ${limit.id} is missing, duplicated, extra, or out of limit`)
        }
      })
    }
  }
  return deepFreeze({ accepted: reasons.length === 0, reasons })
}

const resetWatchdogPhysicalEvidenceIntake = {
  artifactKind: "bench-prototype-reset-watchdog-physical-evidence-intake",
  state: "absent",
  requiredCaptures: resetWatchdogPhysicalCaptureRequirements,
  captures: [],
  authority: {
    physicalEvidenceAccepted: false,
    benchTruthTableVerified: false,
    schematicIntegrationAuthorized: false,
    fabricationAuthorized: false,
    releaseState: "deny"
  }
} as const

const resistor10k = "RC0603FR-0710KL"
const resistor100k = "RC0603FR-07100KL"
const ceramic100n = "C0603C104K3RACTU"

const resetWatchdogDefinition = {
  artifactKind: "bench-prototype-reset-watchdog-contract",
  workUnit: "BP-123",
  targetAssembly: "one-board bench prototype",
  prototypeOnly: true,
  releaseState: "deny",
  prerequisites: {
    application3v3: {
      workUnit: "BP-142",
      contract: "benchPrototypeApplicationRail",
      rule: "The V3_3 supervisor and reset combiner may be captured only when BP-142 validates; its calculation is not physical rail approval."
    },
    stm32Allocation: { workUnit: "BP-120", part: "STM32G474RET3TR", nrst: "SCORING_NRST_N", watchdogWdi: "PC9" },
    esp32Allocation: { workUnit: "BP-121", part: "ESP32-S3-WROOM-1U-N16R2", en: "EN_RESET", watchdogWdi: "GPIO12" },
    scoring3v3: {
      upstreamWorkUnits: ["BP-050", "BP-122"],
      sourcePath:
        "BP-050 isolated-scoring V5 branch -> NXE1S0505MC -> SCORING_5V_ISOLATED -> local regulator -> SCORING_3V3",
      evidenceState: "deny",
      minimumSupervisorPinVoltageV: 3.22089,
      rule: "BP-122 names the isolated-power path but does not select the local SCORING_3V3 regulator. BP-300 must freeze that exact regulator/support network and prove the TPS389033 SENSE/VDD pins remain above 3.22089 V before reset release."
    },
    hub75Consumer: {
      workUnit: "BP-144",
      dependency:
        "BP-144 must consume EN_RESET only as the reset-safe display-enable prerequisite; it must not add a reset source or release a processor."
    }
  },
  parts: [
    {
      reference: "U_STM_SUPERVISOR",
      mpn: "TPS389033DSER",
      value: "3.3 V precision supervisor, open-drain reset",
      connections:
        "VDD and SENSE to SCORING_3V3; GND to SCORING_SGND; MR to SCORING_3V3; RESET to SCORING_NRST_N; CT to C_STM_SUPERVISOR_CT"
    },
    {
      reference: "U_STM_WATCHDOG",
      mpn: "TPS3431SDRBR",
      value: "200 ms window watchdog, open-drain WDO",
      connections:
        "VDD, EN, and SET1 to SCORING_3V3; GND to SCORING_SGND; WDI from SCORING_WATCHDOG_WDI; CWD to R_STM_WD_CWD; open-drain ENOUT tied to open-drain WDO at SCORING_NRST_N"
    },
    {
      reference: "U_ESP_SUPERVISOR",
      mpn: "TPS389033DSER",
      value: "3.3 V precision supervisor, open-drain reset",
      connections:
        "VDD and SENSE to V3_3; GND to APP_GND; MR to V3_3; RESET only to APP_SUPERVISOR_RESET_N; CT to C_ESP_SUPERVISOR_CT"
    },
    {
      reference: "U_ESP_WATCHDOG",
      mpn: "TPS3431SDRBR",
      value: "200 ms window watchdog, open-drain WDO",
      connections:
        "VDD, EN, and SET1 to V3_3; GND to APP_GND; WDI from APP_WD_KICK; CWD to R_ESP_WD_CWD; open-drain ENOUT tied to open-drain WDO at EN_RESET only"
    },
    {
      reference: "U_APP_RESET_FANOUT",
      mpn: "SN74LVC2G07DCKR",
      value: "dual non-inverting open-drain buffer with partial-power-down Ioff",
      connections:
        "VCC to V3_3; GND to APP_GND; A1 and A2 to APP_SUPERVISOR_RESET_N; Y1 to EN_RESET; Y2 to APP_W5500_RESET_N"
    },
    {
      reference: "C_STM_SUPERVISOR_CT",
      mpn: ceramic100n,
      value: "100 nF X7R CT",
      connections: "TPS3890 CT to SCORING_SGND"
    },
    {
      reference: "C_STM_SUPERVISOR_BYPASS",
      mpn: ceramic100n,
      value: "100 nF X7R bypass",
      connections: "SCORING_3V3 to SCORING_SGND at TPS3890"
    },
    {
      reference: "C_ESP_SUPERVISOR_CT",
      mpn: ceramic100n,
      value: "100 nF X7R CT",
      connections: "TPS3890 CT to APP_GND"
    },
    {
      reference: "C_ESP_SUPERVISOR_BYPASS",
      mpn: ceramic100n,
      value: "100 nF X7R bypass",
      connections: "V3_3 to APP_GND at TPS3890"
    },
    {
      reference: "C_STM_WD_BYPASS",
      mpn: ceramic100n,
      value: "100 nF X7R bypass",
      connections: "SCORING_3V3 to SCORING_SGND at TPS3431"
    },
    {
      reference: "C_ESP_WD_BYPASS",
      mpn: ceramic100n,
      value: "100 nF X7R bypass",
      connections: "V3_3 to APP_GND at TPS3431"
    },
    {
      reference: "C_APP_RESET_FANOUT_BYPASS",
      mpn: ceramic100n,
      value: "100 nF X7R bypass",
      connections: "V3_3 to APP_GND at U_APP_RESET_FANOUT"
    },
    {
      reference: "R_STM_WD_CWD",
      mpn: resistor10k,
      value: "10 kOhm, 1%",
      connections: "TPS3431 CWD to SCORING_3V3 selects 200 ms"
    },
    {
      reference: "R_STM_WDI_PULLUP",
      mpn: resistor100k,
      value: "100 kOhm, 1%",
      connections: "SCORING_3V3 to SCORING_WATCHDOG_WDI at U_STM_WATCHDOG.WDI"
    },
    {
      reference: "R_ESP_WD_CWD",
      mpn: resistor10k,
      value: "10 kOhm, 1%",
      connections: "TPS3431 CWD to V3_3 selects 200 ms"
    },
    {
      reference: "R_ESP_WDI_PULLUP",
      mpn: resistor100k,
      value: "100 kOhm, 1%",
      connections: "V3_3 to APP_WD_KICK at U_ESP_WATCHDOG.WDI"
    },
    {
      reference: "R_STM_NRST_PULLUP",
      mpn: resistor10k,
      value: "10 kOhm, 1%",
      connections: "SCORING_3V3 to SCORING_NRST_N"
    },
    {
      reference: "C_STM_NRST_FILTER",
      mpn: ceramic100n,
      value: "100 nF X7R",
      connections: "SCORING_NRST_N to SCORING_SGND"
    },
    { reference: "R_ESP_EN_PULLUP", mpn: resistor10k, value: "10 kOhm, 1%", connections: "V3_3 to EN_RESET" },
    { reference: "C_ESP_EN_DELAY", mpn: "C1608X5R1A105K080AC", value: "1 uF X5R", connections: "EN_RESET to APP_GND" },
    {
      reference: "R_APP_SUPERVISOR_RESET_PULLUP",
      mpn: resistor10k,
      value: "10 kOhm, 1%",
      connections: "V3_3 to APP_SUPERVISOR_RESET_N"
    },
    {
      reference: "R_W5500_RESET_PULLUP",
      mpn: resistor10k,
      value: "10 kOhm, 1%",
      connections: "V3_3 to APP_W5500_RESET_N"
    },
    {
      reference: "R_STM_RESET_ISO_SERIES",
      mpn: resistor10k,
      value: "10 kOhm, 1%",
      connections: "STM32 PB5 ESP32_RESET_ASSERT to ISO7762FDWR channel 4 scoring input"
    },
    {
      reference: "R_STM_RESET_ISO_PD",
      mpn: resistor100k,
      value: "100 kOhm, 1%",
      connections: "ESP32_RESET_ASSERT at ISO7762FDWR channel 4 scoring input to SCORING_SGND"
    },
    {
      reference: "Q_ESP_RESET_STM",
      mpn: "BSS138AKA",
      value: "N-channel reset sink",
      connections: "source to APP_GND; drain to EN_RESET; gate from RESET_REQUEST through R_STM_RESET_GATE"
    },
    {
      reference: "R_STM_RESET_GATE",
      mpn: resistor10k,
      value: "10 kOhm, 1%",
      connections: "RESET_REQUEST to Q_ESP_RESET_STM gate"
    },
    {
      reference: "R_STM_RESET_GATE_PD",
      mpn: resistor100k,
      value: "100 kOhm, 1%",
      connections: "Q_ESP_RESET_STM gate to APP_GND"
    },
    {
      reference: "Q_ESP_DEBUG_RESET",
      mpn: "BSS138AKA",
      value: "N-channel manual-reset sink",
      connections: "source to APP_GND; drain to EN_RESET; gate from MANUAL_RESET_ASSERT through R_DEBUG_RESET_GATE"
    },
    {
      reference: "R_DEBUG_RESET_GATE",
      mpn: resistor10k,
      value: "10 kOhm, 1%",
      connections: "MANUAL_RESET_ASSERT to Q_ESP_DEBUG_RESET gate"
    },
    {
      reference: "R_DEBUG_RESET_GATE_PD",
      mpn: resistor100k,
      value: "100 kOhm, 1%",
      connections: "Q_ESP_DEBUG_RESET gate to APP_GND"
    }
  ],
  timingEvidence: {
    supervisor: {
      part: "TPS389033DSER",
      domains: ["scoring", "application"],
      fallingThresholdNominalV: 3.17,
      risingThresholdNominalV: 3.189,
      thresholdAccuracyFraction: 0.01,
      risingThresholdWorstHighV: 3.22089,
      ctCapacitorMpn: ceramic100n,
      ctNominalUf: 0.1,
      ctEffectiveMinimumUf: 0.0612,
      releaseDelayGuaranteedMinimumMs: 53.04,
      releaseDelayNominalMs: 106.98,
      rule: "Both domains use the same exact CT part and conservative effective-capacitance screen; the 53.04 ms minimum is calculation evidence only and must be measured."
    },
    watchdog: {
      part: "TPS3431SDRBR",
      domains: ["scoring", "application"],
      cwdConnection: "10 kOhm to local VDD with SET1 high",
      watchdogTimeoutMs: { minimum: 170, nominal: 200, maximum: 230 },
      resetPulseMs: { minimum: 170, nominal: 200, maximum: 230 },
      startupVddMinimumV: 1.8,
      startupVddMinimumDurationUs: 300,
      wdiResponseSetupUs: 150,
      rule: "WDO and ENOUT are open-drain and tied at each local reset node. The combined output holds reset during the 170 to 230 ms startup delay and WDO asserts for the 170 to 230 ms reset pulse after a missed 170 to 230 ms watchdog interval."
    },
    sources: {
      tps3890: "https://www.ti.com/lit/ds/symlink/tps3890.pdf",
      tps3431: "https://www.ti.com/lit/ds/symlink/tps3431.pdf",
      sn74lvc2g07: "https://www.ti.com/lit/ds/symlink/sn74lvc2g07.pdf",
      applicationCalculation: "src/application-rail.ts"
    }
  },
  watchdogKick: {
    scoring: {
      source: "STM32G474RET3TR PC9 SCORING_WATCHDOG_WDI",
      pullup: "R_STM_WDI_PULLUP RC0603FR-07100KL to SCORING_3V3",
      input: "U_STM_WATCHDOG.WDI"
    },
    application: {
      source: "ESP32-S3-WROOM-1U-N16R2 GPIO12 APP_WD_KICK",
      pullup: "R_ESP_WDI_PULLUP RC0603FR-07100KL to V3_3",
      input: "U_ESP_WATCHDOG.WDI"
    },
    activeEdge: "falling",
    idleState: "high from the exact local 100 kOhm pull-up",
    gpioMode: "open-drain; briefly sink low, then release",
    maximumFirmwareKickIntervalMs: 100,
    failureSemantics:
      "High-Z, stuck-high, and stuck-low firmware each stop producing falling edges and deterministically time out; a static logic level is never accepted as a kick."
  },
  resetTopology: {
    scoring: {
      resetNet: "SCORING_NRST_N",
      sinks: ["U_STM_SUPERVISOR.RESET", "U_STM_WATCHDOG.WDO+ENOUT", "J_STM_SWD.NRST open-drain only"],
      pullup: "R_STM_NRST_PULLUP to SCORING_3V3",
      manualRule: "The SWD probe may only sink SCORING_NRST_N. No external source may drive it high.",
      independentFromApplication: true
    },
    application: {
      resetNet: "EN_RESET",
      sinks: ["U_APP_RESET_FANOUT.Y1", "U_ESP_WATCHDOG.WDO+ENOUT", "Q_ESP_RESET_STM", "Q_ESP_DEBUG_RESET"],
      pullup: "R_ESP_EN_PULLUP to V3_3",
      supervisorFanout: {
        input: "APP_SUPERVISOR_RESET_N from U_ESP_SUPERVISOR.RESET with R_APP_SUPERVISOR_RESET_PULLUP",
        part: "SN74LVC2G07DCKR",
        processorOutput: "Y1 open-drain to EN_RESET",
        ethernetOutput: "Y2 open-drain to APP_W5500_RESET_N",
        isolationRule:
          "EN_RESET sinks cannot pull APP_SUPERVISOR_RESET_N or APP_W5500_RESET_N low; APP_W5500_RESET_N is supervisor-only."
      },
      w5500ResetNet: "APP_W5500_RESET_N is only U_APP_RESET_FANOUT.Y2 plus R_W5500_RESET_PULLUP",
      manualRule:
        "MANUAL_RESET_ASSERT is active high only at Q_ESP_DEBUG_RESET gate; the service header must not directly drive EN_RESET."
    },
    crossDomain: {
      permittedPath:
        "STM32 PB5 ESP32_RESET_ASSERT, R_STM_RESET_ISO_SERIES, ISO7762FDWR channel 4 default-low output RESET_REQUEST, R_STM_RESET_GATE, Q_ESP_RESET_STM, EN_RESET",
      sourceDefault:
        "R_STM_RESET_ISO_PD holds the scoring-side isolator input low when STM32 is reset, absent, or unpowered.",
      prohibited: [
        "No ESP32 GPIO, watchdog, supervisor, service header, ISO7721 channel, or HUB75 signal connects to SCORING_NRST_N.",
        "The STM32 watchdog and supervisor do not automatically request an ESP32 reset; firmware may request it only through PB5 after its own qualified recovery policy."
      ]
    }
  },
  truthTable: [
    {
      condition: "cold start",
      scoringNrst: "asserted until SCORING_3V3 supervisor releases",
      espEn: "asserted until V3_3 supervisor releases",
      w5500: "held reset",
      crossDomain: "request default low"
    },
    {
      condition: "application brownout",
      scoringNrst: "unaffected",
      espEn: "asserted by U_ESP_SUPERVISOR",
      w5500: "held reset",
      crossDomain: "STM32 may remain scoring"
    },
    {
      condition: "scoring brownout",
      scoringNrst: "asserted by U_STM_SUPERVISOR",
      espEn: "unaffected",
      w5500: "unaffected",
      crossDomain: "PB5 path defaults low"
    },
    {
      condition: "processor watchdog timeout",
      scoringNrst: "STM timeout asserts SCORING_NRST_N",
      espEn: "ESP timeout asserts EN_RESET",
      w5500: "not reset by ESP watchdog",
      crossDomain: "no automatic peer reset; high-Z, stuck-high, or stuck-low WDI produces no repeated falling edge"
    },
    {
      condition: "manual reset",
      scoringNrst: "SWD probe open-drain may assert",
      espEn: "active-high MANUAL_RESET_ASSERT sinks through Q_ESP_DEBUG_RESET",
      w5500: "not reset by ESP manual reset",
      crossDomain: "manual reset remains local"
    },
    {
      condition: "STM32 requested ESP32 reset",
      scoringNrst: "unaffected",
      espEn: "Q_ESP_RESET_STM sinks EN_RESET",
      w5500: "not reset by request",
      crossDomain: "one-way STM32 to ESP32 only"
    },
    {
      condition: "application power off while scoring remains powered",
      scoringNrst: "unaffected",
      espEn: "low or floating, never released",
      w5500: "unpowered",
      crossDomain: "powered STM32 request through RESET_REQUEST must not back-power V3_3 or EN_RESET"
    },
    {
      condition: "scoring power off while application remains powered",
      scoringNrst: "unpowered",
      espEn: "unaffected",
      w5500: "supervisor-controlled normally",
      crossDomain: "ESP32_RESET_ASSERT and RESET_REQUEST default-low behavior prevents a false reset request"
    }
  ],
  requiredBenchEvidence: [
    "Scope both rails, both TPS389033 SENSE/RESET/CT nodes, SCORING_NRST_N, EN_RESET, APP_SUPERVISOR_RESET_N, both SN74LVC2G07 outputs, APP_W5500_RESET_N, watchdog WDI/WDO/ENOUT, and both heartbeat nets for cold start, brownout, watchdog, and manual reset.",
    "With V3_3 absent, drive ESP32_RESET_ASSERT through its permitted states and measure RESET_REQUEST, EN_RESET, V3_3, and injected current. Reject any back-power or reset release.",
    "With SCORING_3V3 absent, prove ESP32_RESET_ASSERT and RESET_REQUEST default low and Q_ESP_RESET_STM cannot assert.",
    "Measure the 3.170 V falling and 3.189 V rising nominal supervisor thresholds, at least 53.04 ms calculated-minimum release interval, 170 to 230 ms watchdog timeout, and 170 to 230 ms watchdog reset pulse across declared voltage, temperature, rail-slew, and capacitor-lot corners.",
    "For each WDI, inject normal falling-edge kicks and high-Z, stuck-high, and stuck-low faults; prove normal service at 100 ms or faster and deterministic timeout for every static fault.",
    "BP-144 must scope its buffer-enable and panel-OE defaults against EN_RESET before HUB75 enable is permitted."
  ],
  physicalEvidenceIntake: resetWatchdogPhysicalEvidenceIntake,
  deniedEvidence: {
    exactFootprintsApproved: false,
    scoringRailImplementationApproved: false,
    supervisorAndWatchdogTimingMeasured: false,
    layoutApproved: false,
    benchTruthTableVerified: false,
    powerOffBackfeedMeasured: false,
    schematicIntegrationApproved: false,
    fabricationApproved: false
  },
  openGates: [
    "BP-122 must freeze the exact ISO7762FDWR channel 4 ESP32_RESET_ASSERT-to-RESET_REQUEST direction, output default, and power-off behavior.",
    "BP-144 must implement and measure reset-safe HUB75 blanking from EN_RESET without becoming a reset source.",
    "BP-300 must integrate these exact nets and perform ERC; any reset-pin, pull-up reference, or ground-domain deviation invalidates this contract.",
    "BP-033 footprint evidence, placement/return-path review, and the required bench captures remain mandatory before fabrication."
  ]
} as const

export const benchPrototypeResetWatchdog = deepFreeze(resetWatchdogDefinition)

/** Rejects substitutions, graph manipulation, stale pin maps, or relaxed safety gates. */
export function validateBenchPrototypeResetWatchdog(value: unknown): true {
  validateStm32PinAllocation(stm32PinAllocation)
  validateBenchPrototypeEsp32Allocation(benchPrototypeEsp32Allocation)
  validateBenchPrototypeApplicationRail(benchPrototypeApplicationRail)
  const applicationRailScreen = calculateApplicationRail()

  if (!sameDataGraph(value, benchPrototypeResetWatchdog, new WeakSet<object>(), new WeakSet<object>())) {
    throw new RangeError("BP-123 reset/watchdog contract must exactly match the reviewed fail-closed graph")
  }
  const contract = benchPrototypeResetWatchdog
  if (
    contract.parts.filter((part) => part.mpn === "TPS389033DSER").length !== 2 ||
    contract.parts.filter((part) => part.mpn === "TPS3431SDRBR").length !== 2 ||
    contract.parts.filter((part) => part.mpn === "SN74LVC2G07DCKR").length !== 1 ||
    contract.timingEvidence.supervisor.fallingThresholdNominalV !==
      defaultApplicationRailInputs.supervisorFallingNominalV ||
    contract.timingEvidence.supervisor.risingThresholdNominalV !==
      defaultApplicationRailInputs.supervisorRisingNominalV ||
    contract.timingEvidence.supervisor.releaseDelayGuaranteedMinimumMs !==
      Number(applicationRailScreen.supervisorDelayGuaranteedMinMs.toFixed(2)) ||
    contract.timingEvidence.supervisor.releaseDelayNominalMs !==
      Number(applicationRailScreen.supervisorDelayNominalMs.toFixed(2)) ||
    contract.timingEvidence.watchdog.watchdogTimeoutMs.minimum !== 170 ||
    contract.timingEvidence.watchdog.watchdogTimeoutMs.nominal !== 200 ||
    contract.timingEvidence.watchdog.watchdogTimeoutMs.maximum !== 230 ||
    contract.timingEvidence.watchdog.resetPulseMs.minimum !== 170 ||
    contract.timingEvidence.watchdog.resetPulseMs.nominal !== 200 ||
    contract.timingEvidence.watchdog.resetPulseMs.maximum !== 230 ||
    contract.watchdogKick.activeEdge !== "falling" ||
    contract.watchdogKick.maximumFirmwareKickIntervalMs >= contract.timingEvidence.watchdog.watchdogTimeoutMs.minimum ||
    !contract.watchdogKick.scoring.pullup.includes("RC0603FR-07100KL") ||
    !contract.watchdogKick.application.pullup.includes("RC0603FR-07100KL") ||
    !contract.watchdogKick.failureSemantics.includes("High-Z, stuck-high, and stuck-low") ||
    contract.prerequisites.scoring3v3.evidenceState !== "deny" ||
    !contract.resetTopology.application.supervisorFanout.isolationRule.includes("supervisor-only") ||
    !contract.resetTopology.crossDomain.permittedPath.includes("ISO7762FDWR") ||
    contract.resetTopology.crossDomain.prohibited.some(
      (rule) => !rule.includes("No ESP32") && !rule.includes("do not automatically")
    ) ||
    contract.truthTable.length !== 8 ||
    contract.physicalEvidenceIntake.state !== "absent" ||
    contract.physicalEvidenceIntake.captures.length !== 0 ||
    contract.physicalEvidenceIntake.requiredCaptures.map((capture) => capture.captureId).join(",") !==
      "BP123-COLD-START,BP123-BROWNOUT,BP123-WATCHDOG,BP123-MANUAL-RESET,BP123-CROSS-DOMAIN,BP123-POWER-OFF" ||
    contract.physicalEvidenceIntake.authority.physicalEvidenceAccepted ||
    contract.physicalEvidenceIntake.authority.benchTruthTableVerified ||
    contract.physicalEvidenceIntake.authority.schematicIntegrationAuthorized ||
    contract.physicalEvidenceIntake.authority.fabricationAuthorized ||
    contract.physicalEvidenceIntake.authority.releaseState !== "deny" ||
    contract.deniedEvidence.fabricationApproved ||
    contract.releaseState !== "deny"
  ) {
    throw new RangeError("BP-123 must preserve both local supervisors/watchdogs and one-way fail-safe reset authority")
  }
  return true
}
