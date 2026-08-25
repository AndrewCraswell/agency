import {
  benchPrototypeEsp32Allocation,
  validateBenchPrototypeEsp32Allocation
} from "./bench-prototype-esp32-allocation.js"

const devices = 7
const bitsPerDevice = 20
const sclkHz = 20_000_000
const wireTimeUs = (devices * bitsPerDevice * 1_000_000) / sclkHz
const guardUs = 1
const scanPeriodUs = wireTimeUs + guardUs

const definition = {
  artifactKind: "bench-prototype-esp32-scoring-feasibility-contract",
  workUnit: "BP-127",
  architecture: "one ESP32-S3 runs the target adapter and portable C17 core",
  preliminaryPinResult: {
    exactAllocation: "BP-121",
    adcGpios: [4, 5, 6],
    primaryOutputLatchGpio: 7,
    uncommittedGpios: [10, 11, 15, 17, 36, 37, 47],
    result: "paper-pin-screen-passes"
  },
  acquisition: {
    converter: "seven ADS8881 devices in daisy-chain mode",
    peripheral: "SPI3_HOST plus GDMA",
    schedule: "GPTimer0 hardware schedule with one complete ordered seven-channel frame per tick",
    devices,
    bitsPerDevice,
    frameBits: devices * bitsPerDevice,
    sclkHz,
    wireTimeUs,
    guardUs,
    scanPeriodUs,
    comparatorGpios: 0,
    maximumPreliminaryTimestampUncertaintyUs: scanPeriodUs,
    minimumSabreSignalUs: 100,
    minimumCompletedScansDuringSabreSignal: Math.floor(100 / scanPeriodUs),
    result: "paper-cadence-screen-passes-bench-proof-required"
  },
  queueAndFaultModel: {
    frameQueueCapacity: 32,
    maximumConsumerLagFrames: 4,
    storage: "internal DRAM only while scoring",
    prohibited: ["drop-oldest", "partial frame", "guessed sample", "reordered channel", "flash allocation"],
    unavailableFaults: [
      "GDMA overflow or descriptor error",
      "SPI timeout or short frame",
      "wrong channel order or stale frame",
      "non-monotonic timestamp or missed schedule tick",
      "consumer lag above four frames",
      "reference, rail, watchdog, or output-health invalid"
    ],
    recovery:
      "Disable excitation and loads, discard all frames, create a new scoring boot identity, verify rails/reference, and acquire a fresh baseline before READY."
  },
  concurrencyPolicy: {
    scoringPriority: "ADC schedule, GDMA completion, canonical frame queue, and C17 evaluation outrank all services",
    applicationBus: "SPI2_HOST for W5500 and the write-only primary-output shift register",
    ir: "RMT RX cannot enter the normalized electrical-sample interface",
    display: "HUB75 refresh must not share SPI3, its GDMA channel, or the scoring frame queue",
    flash: "erase, write, NVS commit, and OTA are prohibited while scoring is READY or ACTIVE",
    radio: "Wi-Fi/BLE may run only after the loaded timing and analog-noise test passes"
  },
  primaryOutputs: {
    transport: "APP_SPI_SCK and APP_SPI_MOSI plus GPIO7 PRIMARY_OUTPUT_LATCH",
    safeState:
      "External reset/output-enable holds every lamp and buzzer load inactive before boot, during reset, and after any scoring-unavailable fault.",
    feedbackRequired: true,
    exactLatchAndDriverSelection: "open"
  },
  watchdog: {
    kickSignal: "APP_WD_KICK on GPIO12",
    owner: "health aggregator only",
    requiredFreshTokens: ["ADC", "frame queue", "C17 core", "reference/rails", "primary outputs"],
    prohibitedFeeders: ["Ethernet", "HUB75", "IR", "USB", "OTA"]
  },
  railBudget: {
    state: "measurement-required",
    required:
      "Measure ESP32, AFE/reference/ADC, Ethernet, HUB75, IR, and primary-output peak/continuous current on the simplified USB-C PD rails.",
    passRule: "Every rail and protection branch retains reviewed startup, transient, continuous, and thermal margin."
  },
  oneCellExperiment: {
    hardware:
      "one exact protected AFE cell, REF5025, one ADS8881, target ESP32-S3 module, and final candidate output-safe circuit",
    resistanceOhms: [0, 100, 200, 250, 445, 450, 455, 470, 475, 480, 495, 500, 505],
    capacitanceNf: [0.5, 2, 5, 10],
    pulseUs: [50, 100, 1_000, 2_000, 10_000, 13_000, 14_000, 15_000],
    concurrentLoads: [
      "idle",
      "full W5500 traffic",
      "full HUB75 refresh",
      "continuous IR traffic",
      "native USB traffic",
      "Wi-Fi/BLE active",
      "attempted flash/cache stress, which must be rejected while scoring"
    ],
    passCriteria: [
      "no missed, duplicate, reordered, stale, or partial frames",
      "scan period and timestamp uncertainty remain within the reviewed budget",
      "all resistance and pulse boundary vectors classify identically to the native C17 oracle",
      "every injected overflow, timeout, rail, reference, watchdog, and output fault latches scoring unavailable",
      "no frame, event, or candidate survives reset"
    ],
    state: "not-run"
  },
  authority: {
    paperPinScreenPassed: true,
    paperCadenceScreenPassed: true,
    oneCellBenchPassed: false,
    sevenChannelStressPassed: false,
    schematicAuthorized: false,
    fabricationAuthorized: false,
    releaseState: "deny"
  }
} as const

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) throw new RangeError("BP-127 cannot contain cycles or aliases")
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) throw new RangeError("BP-127 allows data only")
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

export const benchPrototypeEsp32ScoringFeasibility = deepFreeze(definition)

export function validateBenchPrototypeEsp32ScoringFeasibility(value: unknown): true {
  validateBenchPrototypeEsp32Allocation(benchPrototypeEsp32Allocation)
  if (!sameDataGraph(value, benchPrototypeEsp32ScoringFeasibility)) {
    throw new RangeError("BP-127 must exactly match the reviewed fail-closed feasibility contract")
  }
  if (
    benchPrototypeEsp32ScoringFeasibility.acquisition.frameBits !== 140 ||
    benchPrototypeEsp32ScoringFeasibility.acquisition.wireTimeUs !== 7 ||
    benchPrototypeEsp32ScoringFeasibility.acquisition.scanPeriodUs !== 8 ||
    benchPrototypeEsp32ScoringFeasibility.acquisition.minimumCompletedScansDuringSabreSignal !== 12 ||
    benchPrototypeEsp32ScoringFeasibility.preliminaryPinResult.uncommittedGpios.length !== 7 ||
    benchPrototypeEsp32ScoringFeasibility.queueAndFaultModel.maximumConsumerLagFrames !== 4 ||
    benchPrototypeEsp32ScoringFeasibility.oneCellExperiment.state !== "not-run" ||
    benchPrototypeEsp32ScoringFeasibility.authority.oneCellBenchPassed ||
    benchPrototypeEsp32ScoringFeasibility.authority.fabricationAuthorized ||
    benchPrototypeEsp32ScoringFeasibility.authority.releaseState !== "deny"
  ) {
    throw new RangeError("BP-127 must retain its conservative paper screen and open physical gates")
  }
  return true
}
