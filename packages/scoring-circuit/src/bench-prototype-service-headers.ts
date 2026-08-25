import { benchPrototypeBom, validateBenchPrototypeBom } from "./bench-prototype-bom.js"
import { benchPrototypeContract, validateBenchPrototypeContract } from "./bench-prototype-contract.js"

const definition = {
  artifactKind: "bench-prototype-service-access-contract",
  workUnit: "BP-124",
  target: "ESP32-S3-WROOM-1U-N16R2",
  normalInterface: "native USB on GPIO19/GPIO20",
  populatedHeader: false,
  recoveryPads: [
    { reference: "TP_UART0_TX", net: "UART0_TX", direction: "board-to-adapter" },
    { reference: "TP_UART0_RX", net: "UART0_RX", direction: "adapter-to-board" },
    { reference: "TP_BOOT_N", net: "BOOT_N", direction: "open-drain-sink-only" },
    { reference: "TP_EN_RESET", net: "EN_RESET", direction: "open-drain-sink-only" },
    { reference: "TP_APP_3V3", net: "APP_3V3", direction: "sense-only" },
    { reference: "TP_APP_GND", net: "APP_GND", direction: "reference" }
  ],
  electricalRules: {
    adapterLogicV: 3.3,
    adapterMayPowerTarget: false,
    fiveVoltTtlPermitted: false,
    rs232VoltagePermitted: false,
    bootAndResetDrive: "open-drain sink only; board pull-ups own the high state"
  },
  recoveryProcedure: [
    "Disconnect USB-C and verify APP_3V3 is discharged before attaching a fixture.",
    "Attach a keyed pogo or clip fixture to the labeled pads; never solder a permanent P0 service connector.",
    "Apply normal USB-C power only and verify the adapter sources no current into APP_3V3.",
    "Hold BOOT_N low, pulse EN_RESET low, release EN_RESET, then release BOOT_N for ROM download mode.",
    "Program and verify the image over native USB or 3.3 V UART0 and record the image hash.",
    "Remove USB-C, verify discharge, remove the fixture, and confirm a normal boot with safe outputs."
  ],
  removedFromP0: {
    stm32Header: { reference: "J_STM32_SWD", candidateMpn: "FTSH-105-01-L-DV-007-K", disposition: "DNP" },
    esp32Header: { reference: "J_ESP32_SERVICE", candidateMpn: "TSW-106-07-G-S", disposition: "DNP" }
  },
  authority: {
    schematicIntegrationApproved: false,
    fixtureEvidenceApproved: false,
    recoveryDemonstrated: false,
    fabricationAuthorized: false,
    releaseState: "deny"
  }
} as const

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) throw new RangeError("BP-124 cannot contain cycles or aliases")
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError("BP-124 may contain only data properties")
    }
    deepFreeze(descriptor.value, seen)
  }
  return Object.freeze(value)
}

function isPlainRecord(value: unknown): value is Record<PropertyKey, unknown> {
  return value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype
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
  const actualArray = Array.isArray(actual)
  const expectedArray = Array.isArray(expected)
  if (actualArray !== expectedArray) return false
  if (actualArray) {
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

export const benchPrototypeServiceHeaders = deepFreeze(definition)

export function validateBenchPrototypeServiceHeaders(value: unknown): true {
  validateBenchPrototypeContract(benchPrototypeContract)
  validateBenchPrototypeBom(benchPrototypeBom)
  if (!sameDataGraph(value, benchPrototypeServiceHeaders)) {
    throw new RangeError("BP-124 service access must exactly match the reviewed ESP32-only contract")
  }
  const stmRow = benchPrototypeBom.rows.find((row) => row.reference === "J_STM32_SWD")
  const espRow = benchPrototypeBom.rows.find((row) => row.reference === "J_ESP32_SERVICE")
  if (
    stmRow?.disposition !== "DNP" ||
    espRow?.disposition !== "DNP" ||
    benchPrototypeServiceHeaders.populatedHeader ||
    benchPrototypeServiceHeaders.recoveryPads.length !== 6 ||
    benchPrototypeServiceHeaders.recoveryPads[2]?.net !== "BOOT_N" ||
    benchPrototypeServiceHeaders.recoveryPads[3]?.net !== "EN_RESET" ||
    benchPrototypeServiceHeaders.electricalRules.adapterMayPowerTarget ||
    benchPrototypeServiceHeaders.electricalRules.fiveVoltTtlPermitted ||
    benchPrototypeServiceHeaders.authority.fabricationAuthorized ||
    benchPrototypeServiceHeaders.authority.releaseState !== "deny"
  ) {
    throw new RangeError("BP-124 must retain DNP headers, six recovery pads, and denied release")
  }
  return true
}
