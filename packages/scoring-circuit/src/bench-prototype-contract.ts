/** BP-010: denied, single-board ESP32-S3 P0 architecture boundary. */

const definition = {
  workUnit: "BP-010",
  architecture: {
    boardCount: 1,
    processor: "ESP32-S3-WROOM-1-N16R2",
    formFactor: "accessible bench PCB on standoffs",
    layerEnvelope: "four layers preferred; final stack selected during layout review",
    releaseState: "deny",
    status: "architecture-input-only",
    dimensionedDrawingComplete: false
  },
  softwareBoundary: {
    scoringAuthority: "portable C17 scoring core",
    targetAdapter: "ESP-IDF acquisition, timestamp, safe-output, persistence, and service adapters",
    futureSplitRule:
      "The core consumes and produces canonical byte contracts so a separate scoring MCU can be added without rewriting rules behavior.",
    prohibitedCoreDependencies: ["wall clock", "random", "network", "display", "storage", "ESP-IDF"]
  },
  requiredHardware: {
    processor: "ESP32-S3-WROOM-1-N16R2",
    analog: "protected seven-channel AFE, REF5025AQDRQ1, and ADS8881 daisy chain",
    ethernet: "W5500 and Würth 7499011121A",
    ir: "TSOP38438 at 38 kHz on GPIO35 RMT_RX",
    display: "two SN74AHCT245PWR buffers and Adafruit 2277 HUB75 panel",
    power: "USB-C PD 20 V/3 A, protected eFuse path, 5 V conversion, and measured 3.3 V branches",
    outputs: "shared-SPI hardware-safe serialized primary lamp and buzzer latch plus protected load driver",
    recovery: "native USB plus ESP32 UART, BOOT_N, EN reset, watchdog, and supervisor",
    weapon: "six direct-wire A/B/C landings, test points, and strain relief for the owner-approved cable"
  },
  removedFromP0: [
    "STM32G474RET3TR",
    "ISO7762FDWR",
    "ISO7721FDR",
    "NXE1S0505MC",
    "STM32 SWD",
    "isolated SPI and peer heartbeats",
    "alternate power connector and selector",
    "F-RAM",
    "RTC",
    "secure element",
    "audio and speaker"
  ],
  pinBudget: {
    obsoleteAllocationFreedGpios: [4, 5, 6, 7, 10, 11, 15, 17, 36, 37, 47],
    requiredNewAllocation: [
      { gpio: 4, signal: "SAR_SCLK" },
      { gpio: 5, signal: "SAR_DOUT" },
      { gpio: 6, signal: "SAR_CONVST" },
      { gpio: 7, signal: "PRIMARY_OUTPUT_LATCH" }
    ],
    remainingCandidateGpios: [10, 11, 15, 17, 36, 37, 47],
    outputSerialization:
      "The primary latch shares APP_SPI_SCK and APP_SPI_MOSI; hardware reset or output-enable holds all loads inactive.",
    comparatorRule:
      "P0 uses no per-channel comparator GPIOs unless BP-127 proves the ADS8881 scan cadence cannot meet the reviewed timing budget."
  },
  preservedInterfaces: {
    ethernet: ["APP_SPI_SCK", "APP_SPI_MOSI", "APP_SPI_MISO", "ETH_CS_N"],
    hub75: 13,
    usb: ["GPIO19 USB_DN", "GPIO20 USB_DP"],
    ir: "GPIO35 RMT_RX",
    recovery: ["UART0_RX", "UART0_TX", "BOOT_N", "EN_RESET"],
    watchdog: "one external health-gated watchdog/supervisor path"
  },
  rfPlacement: {
    antenna: "ESP32-S3-WROOM-1 integrated PCB antenna",
    preferredPlacement: "Place the antenna outside the base-board edge with its feed point close to that edge.",
    fallbackClearanceMm: 15,
    fallbackClearance: "Keep copper, routing, and components out of the antenna area in all directions.",
    verification:
      "Keep metal housing away from the antenna and verify finished-product throughput and communication range."
  },
  powerBoundary: {
    populatedInputs: ["USB-C PD"],
    removedInputs: ["J_LAB_INJECTION", "7101SYZQE"],
    diagnosticRule:
      "Use labeled rail test pads and removable current links only while USB-C is disconnected and the board is de-energized."
  },
  logicalZones: [
    "weapon connection and protection",
    "analog AFE, reference, and ADC",
    "ESP32, recovery, IR, and primary outputs",
    "USB-C PD, conversion, W5500, and MagJack",
    "HUB75 buffering and protected display power"
  ],
  failureBoundary: {
    rule: "Acquisition, timestamp, frame-order, queue, rail, watchdog, or output-health faults latch scoring unavailable.",
    prohibitedRecovery: "Never drop evidence, guess a sample, or retain a candidate hit across reset.",
    reentry: "Require empty queues, stable rails/reference, a fresh baseline, and a new scoring boot identity."
  },
  explicitDeferrals: [
    "dimensioned board outline and placement",
    "production body-cord socket",
    "enclosure and miniaturization",
    "battery or UPS implementation",
    "regulatory and FIE homologation",
    "factory panelization and production release"
  ]
} as const

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) throw new RangeError("Canonical BP-010 contract cannot contain cycles or aliases")
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError("Canonical BP-010 contract may contain only data properties")
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

export const benchPrototypeContract = deepFreeze(definition)

/** Rejects drift back to the dual-MCU board or premature release claims. */
export function validateBenchPrototypeContract(input: unknown): true {
  if (!sameDataGraph(input, benchPrototypeContract)) {
    throw new RangeError("Bench prototype contract must exactly match the reviewed ESP32-only boundary")
  }
  const contract = benchPrototypeContract
  if (
    contract.architecture.boardCount !== 1 ||
    contract.architecture.processor !== "ESP32-S3-WROOM-1-N16R2" ||
    contract.requiredHardware.processor !== "ESP32-S3-WROOM-1-N16R2" ||
    contract.architecture.releaseState !== "deny" ||
    contract.architecture.dimensionedDrawingComplete ||
    contract.softwareBoundary.scoringAuthority !== "portable C17 scoring core" ||
    contract.pinBudget.obsoleteAllocationFreedGpios.length !== 11 ||
    contract.pinBudget.requiredNewAllocation.length !== 4 ||
    contract.pinBudget.remainingCandidateGpios.length !== 7 ||
    contract.preservedInterfaces.hub75 !== 13 ||
    contract.preservedInterfaces.ir !== "GPIO35 RMT_RX" ||
    contract.rfPlacement.antenna !== "ESP32-S3-WROOM-1 integrated PCB antenna" ||
    contract.rfPlacement.fallbackClearanceMm !== 15 ||
    !contract.rfPlacement.fallbackClearance.includes("copper, routing, and components") ||
    contract.powerBoundary.populatedInputs.join(",") !== "USB-C PD" ||
    !contract.removedFromP0.includes("STM32G474RET3TR") ||
    !contract.removedFromP0.includes("F-RAM") ||
    !contract.failureBoundary.rule.includes("scoring unavailable")
  ) {
    throw new RangeError("BP-010 must retain the denied minimal ESP32-only P0 architecture")
  }
  return true
}
