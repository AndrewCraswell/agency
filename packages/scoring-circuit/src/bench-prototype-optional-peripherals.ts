/** BP-145: deliberately empty optional-peripheral population for the P0 prototype. */

import {
  benchPrototypeEsp32Allocation,
  validateBenchPrototypeEsp32Allocation
} from "./bench-prototype-esp32-allocation.js"

type DataRecord = Record<PropertyKey, unknown>

function isPlainRecord(value: unknown): value is DataRecord {
  return value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) throw new RangeError("Canonical BP-145 data cannot contain cycles or aliases")
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError("Canonical BP-145 data may contain only data properties")
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

const dnpPopulation = [
  {
    item: "F-RAM",
    reference: "U_FRAM",
    disposition: "DNP",
    retainedCandidateMpn: "CY15B104Q-LHXIT",
    interface: "none; encrypted NVS supplies bounded persistence outside active scoring",
    reason:
      "The ESP32 already provides encrypted NVS; a second journal device adds routing, arbitration, support parts, and test scope without enabling P0 validation."
  },
  {
    item: "real-time clock",
    reference: "U_RTC",
    disposition: "DNP",
    retainedCandidateMpn: "RV-3028-C7",
    interface: "none; network or test-host time is metadata only",
    reason: "Canonical scoring uses monotonic time and does not require a battery-backed wall clock."
  },
  {
    item: "secure element",
    reference: "U_SECURE_ELEMENT",
    disposition: "DNP",
    retainedCandidateMpn: "STSAFE-A110",
    interface: "none; ESP32 eFuses and encrypted NVS own remote identity and counters",
    reason: "P0 does not need factory personalization or another credential bus."
  },
  {
    item: "audio amplifier",
    reference: "U_AUDIO",
    disposition: "DNP",
    retainedCandidateMpn: "TAS2505TRGERQ1",
    interface: "DNP; no audio host routing; GPIO35 is reserved for BP-126 IR_RX/RMT_RX",
    reason: "The retained primary buzzer output supplies audible indication without an onboard audio subsystem."
  },
  {
    item: "speaker connector",
    reference: "J_SPEAKER",
    disposition: "DNP",
    retainedCandidateMpn: null,
    interface: "none while U_AUDIO is DNP",
    reason: "No onboard audio amplifier or P0 speaker load exists."
  },
  {
    item: "external antenna",
    reference: "ANT_EXTERNAL",
    disposition: "DNP",
    retainedCandidateMpn: null,
    interface: "WROOM-1U module connector left unpopulated",
    reason:
      "Ethernet is mandatory for P0; Wi-Fi and Bluetooth remain disabled unless a temporary reviewed lab antenna is attached."
  }
] as const

const definition = {
  artifactKind: "bench-prototype-optional-application-peripherals",
  workUnit: "BP-145",
  targetAssembly: "ESP32-S3-only P0 prototype",
  minimumBenchGoal: "weapon sensing, FIE scoring, Ethernet, display, encrypted IR, power, and recovery validation",
  releaseState: "deny",
  upstream: { processorAllocation: "BP-121", applicationRail: "BP-142" },
  population: dnpPopulation,
  persistencePolicy: {
    identity: "ESP32 eFuses",
    storage: "ESP-IDF encrypted NVS",
    activeScoringRule: "No flash erase or write may occur while scoring acquisition is active.",
    bufferingRule: "Queue bounded journal and remote-counter updates in internal RAM; flush only after scoring stops.",
    recoveryRule:
      "Corrupt or unavailable NVS fails unavailable for authenticated remote commands but must not alter electrical hit classification."
  },
  antennaPolicy: {
    module: "ESP32-S3-WROOM-1U-N16R2",
    hostRfRoute: "prohibited; the WROOM-1U contains its RF route and antenna connector",
    dnpBehavior: "Wi-Fi and Bluetooth radios must remain disabled in firmware while ANT_EXTERNAL is DNP.",
    futurePopulation: "Attach and review an exact compatible antenna before enabling either radio."
  },
  reservedResourceRules: [
    "No DNP option may load BOOT_N, EN_RESET, native USB, UART0 recovery, GPIO35 IR_RX, either acquisition SPI host, the W5500 bus, or HUB75 signals.",
    "Do not place speculative land patterns, pull-ups, bypass capacitors, connectors, or stubs for removed options on P0.",
    "A future option requires a new reviewed BOM decision; these DNP rows do not grant placement or routing authority."
  ],
  evidence: {
    allOptionalPartsRemovedFromActiveBom: true,
    nvsWearAndRecoveryVerified: false,
    layoutApproved: false,
    fabricationAuthorized: false
  }
} as const

export const benchPrototypeOptionalPeripherals = deepFreeze(definition)

export function validateBenchPrototypeOptionalPeripherals(value: unknown): true {
  validateBenchPrototypeEsp32Allocation(benchPrototypeEsp32Allocation)
  if (!sameDataGraph(value, benchPrototypeOptionalPeripherals)) {
    throw new RangeError("BP-145 contract must exactly match the canonical minimal-peripheral decision")
  }
  const contract = benchPrototypeOptionalPeripherals
  if (
    contract.population.length !== 6 ||
    contract.population.some((item) => item.disposition !== "DNP") ||
    !["U_FRAM", "U_RTC", "U_SECURE_ELEMENT", "U_AUDIO", "J_SPEAKER", "ANT_EXTERNAL"].every(
      (reference) => contract.population.filter((item) => item.reference === reference).length === 1
    ) ||
    !contract.persistencePolicy.activeScoringRule.startsWith("No flash erase or write") ||
    !contract.antennaPolicy.dnpBehavior.includes("radios must remain disabled") ||
    !contract.evidence.allOptionalPartsRemovedFromActiveBom ||
    contract.evidence.fabricationAuthorized ||
    contract.releaseState !== "deny"
  ) {
    throw new RangeError("BP-145 must retain zero populated optional peripherals and denied fabrication release")
  }
  return true
}

validateBenchPrototypeOptionalPeripherals(benchPrototypeOptionalPeripherals)
