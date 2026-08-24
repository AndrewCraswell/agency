/** M0-04 immutable processor fault-containment contract. */
type DataRecord = Record<PropertyKey, unknown>

const RUNTIME_SAFE_INACTIVE = "safe-inactive" as const

function isPlainRecord(value: unknown): value is DataRecord {
  return value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) throw new RangeError("M0-04 data cannot contain aliases or cycles")
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError("M0-04 data can contain only data properties")
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
    if (Object.getPrototypeOf(actual) !== Array.prototype || Object.getPrototypeOf(expected) !== Array.prototype)
      return false
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

const definition = {
  workUnit: "M0-04",
  releaseState: "deny",
  authority: {
    scoringAuthority: "STM32",
    applicationController: "ESP32",
    stm32Owns: [
      "acquisition",
      "monotonic scoring time",
      "qualification and rejection",
      "fault classification and lockout",
      "source decision records",
      "primary lamps buzzer and excitation"
    ],
    esp32MayOnly: [
      "present accepted records",
      "store copies",
      "replay",
      "network and local controls",
      "request approved operations"
    ],
    esp32Never: [
      "score or reclassify",
      "drive primary outputs or excitation",
      "clear a primary indication",
      "change STM32 time",
      "automatically reset STM32"
    ]
  },
  vocabulary: {
    glossaryRevision: "m0-02",
    safeInactive: "safeInactive",
    runtimeSafeInactive: RUNTIME_SAFE_INACTIVE,
    safeStateMapping: "safeInactive -> safe-inactive",
    availabilityStates: ["available", "degraded", "unavailable"],
    scoringLogicOwner: "weapon-specific STM32 scorer"
  },
  nets: {
    stm32Reset: "SCORING_NRST_N",
    esp32Reset: "EN_RESET",
    stm32ResetAssert: "ESP32_RESET_ASSERT",
    resetRequest: "RESET_REQUEST",
    stm32Heartbeat: "STM32_HEARTBEAT",
    esp32Heartbeat: "ESP32_HEARTBEAT"
  },
  resetPolicy: {
    localResetSources: ["independent STM32 supervisor and watchdog", "independent ESP32 supervisor and watchdog"],
    permittedPeerReset: "STM32 to ESP32 only through RESET_REQUEST to an EN_RESET low-side sink",
    forbiddenPeerReset: "No automatic ESP32 to STM32 SCORING_NRST_N reset path",
    heartbeatPolicy: "Neither heartbeat is a reset command",
    boutResetPolicy: "Only a designated supervisor path may authorize a reviewed boutReset"
  },
  faultOutcomes: {
    stm32Fault: "unavailable and safe-inactive with no scoring qualification or registration",
    esp32Fault: "degraded only when STM32 remains available",
    applicationServiceFault: "degraded only when STM32 remains available",
    malformedOrReplayedRequest: "reject without changing scoring state configuration outputs or reset ownership",
    wholeDevicePowerLoss: "unavailable until a new boot lifecycle completes; never infer the lost interval",
    stm32Update: "signed locally authorized recoverable activation is unavailable until recovery gates pass"
  },
  evidence: {
    contractEvidenceOnly: ["BP-120", "BP-121", "BP-122", "BP-123"],
    provenance: {
      bp122: "ISO7762FDWR channel 4: ESP32_RESET_ASSERT -> RESET_REQUEST; both heartbeat directions are isolated",
      bp123: "SCORING_NRST_N is scoring-local; EN_RESET has independent application-local supervision"
    },
    physicalResetIsolationBackpowerAndTimingProven: false,
    normalInput: "USB-C PD",
    labInput: "LAB_POST_EFUSE_20V test-only 20 V input",
    inputSourcesMutuallyExclusive: true
  }
} as const

export const processorFaultContainment = deepFreeze(definition)

/** Rejects authority, net, availability, source-selection, and evidence relaxation. */
export function validateProcessorFaultContainment(value: unknown): true {
  if (!sameDataGraph(value, processorFaultContainment)) {
    throw new RangeError("M0-04 must exactly match the reviewed processor fault-containment contract")
  }
  const contract = processorFaultContainment
  if (
    contract.workUnit !== "M0-04" ||
    contract.releaseState !== "deny" ||
    contract.authority.scoringAuthority !== "STM32" ||
    contract.authority.applicationController !== "ESP32" ||
    contract.vocabulary.glossaryRevision !== "m0-02" ||
    contract.vocabulary.safeInactive !== "safeInactive" ||
    contract.vocabulary.runtimeSafeInactive !== "safe-inactive" ||
    contract.vocabulary.safeStateMapping !== "safeInactive -> safe-inactive" ||
    contract.vocabulary.availabilityStates.join(",") !== "available,degraded,unavailable" ||
    contract.vocabulary.scoringLogicOwner !== "weapon-specific STM32 scorer" ||
    contract.nets.stm32Reset !== "SCORING_NRST_N" ||
    contract.nets.esp32Reset !== "EN_RESET" ||
    contract.nets.stm32ResetAssert !== "ESP32_RESET_ASSERT" ||
    contract.nets.resetRequest !== "RESET_REQUEST" ||
    contract.nets.stm32Heartbeat !== "STM32_HEARTBEAT" ||
    contract.nets.esp32Heartbeat !== "ESP32_HEARTBEAT" ||
    contract.resetPolicy.permittedPeerReset !==
      "STM32 to ESP32 only through RESET_REQUEST to an EN_RESET low-side sink" ||
    contract.resetPolicy.forbiddenPeerReset !== "No automatic ESP32 to STM32 SCORING_NRST_N reset path" ||
    contract.resetPolicy.heartbeatPolicy !== "Neither heartbeat is a reset command" ||
    contract.faultOutcomes.stm32Fault !==
      "unavailable and safe-inactive with no scoring qualification or registration" ||
    contract.faultOutcomes.esp32Fault !== "degraded only when STM32 remains available" ||
    contract.faultOutcomes.applicationServiceFault !== "degraded only when STM32 remains available" ||
    contract.faultOutcomes.malformedOrReplayedRequest !==
      "reject without changing scoring state configuration outputs or reset ownership" ||
    contract.faultOutcomes.wholeDevicePowerLoss !==
      "unavailable until a new boot lifecycle completes; never infer the lost interval" ||
    contract.faultOutcomes.stm32Update !==
      "signed locally authorized recoverable activation is unavailable until recovery gates pass" ||
    contract.evidence.contractEvidenceOnly.join(",") !== "BP-120,BP-121,BP-122,BP-123" ||
    contract.evidence.provenance.bp122 !==
      "ISO7762FDWR channel 4: ESP32_RESET_ASSERT -> RESET_REQUEST; both heartbeat directions are isolated" ||
    contract.evidence.provenance.bp123 !==
      "SCORING_NRST_N is scoring-local; EN_RESET has independent application-local supervision" ||
    contract.evidence.physicalResetIsolationBackpowerAndTimingProven ||
    contract.evidence.normalInput !== "USB-C PD" ||
    contract.evidence.labInput !== "LAB_POST_EFUSE_20V test-only 20 V input" ||
    !contract.evidence.inputSourcesMutuallyExclusive
  ) {
    throw new RangeError("M0-04 must retain its exact safe authority and denied physical-evidence gates")
  }
  return true
}
