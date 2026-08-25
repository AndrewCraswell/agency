/** BP-125: sole-ESP32-S3 P0 processor support and schematic-capture contract. */

import {
  benchPrototypeEsp32Allocation,
  validateBenchPrototypeEsp32Allocation
} from "./bench-prototype-esp32-allocation.js"

type PlainRecord = Record<PropertyKey, unknown>

function isPlainRecord(value: unknown): value is PlainRecord {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  )
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) throw new RangeError("Canonical BP-125 contract cannot contain cycles or aliases")
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError("Canonical BP-125 contract may contain only data properties")
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
  const actualArray = Array.isArray(actual)
  const expectedArray = Array.isArray(expected)
  if (actualArray !== expectedArray) return false
  if (actualArray) {
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

const processorSupportDefinition = {
  artifactKind: "bench-prototype-processor-support-contract",
  workUnit: "BP-125",
  targetAssembly: "sole-ESP32-S3 P0 bench prototype",
  releaseState: "deny",
  processor: {
    mpn: "ESP32-S3-WROOM-1-N16R2",
    role: "sole controller for the ESP-IDF adapter and portable C17 scoring core",
    supply: "APP_3V3, 3.0 V to 3.6 V",
    radio:
      "Wi-Fi and Bluetooth remain disabled in P0; any later enablement uses the selected WROOM-1 integrated PCB antenna and requires its placement and final-product RF evidence."
  },
  selectedSupportRows: [
    { reference: "R_ESP_BOOT_PULLUP", mpn: "RC0603FR-0710KL", value: "10 kOhm, 1%", role: "GPIO0 BOOT_N pull-up" },
    { reference: "R_ESP_EN_PULLUP", mpn: "RC0603FR-0710KL", value: "10 kOhm, 1%", role: "EN_RESET open-drain pull-up" },
    { reference: "C_ESP_EN_DELAY", mpn: "C1608X5R1A105K080AC", value: "1 uF X5R", role: "EN_RESET delay capacitor" },
    {
      reference: "C_ESP_3V3_HF",
      mpn: "GCM188R71H104KA57D",
      value: "100 nF X7R",
      role: "local high-frequency APP_3V3 bypass"
    },
    {
      reference: "C_ESP_3V3_BULK",
      mpn: "GCM32EC71A476KE02L",
      value: "47 uF X7S nominal",
      role: "local APP_3V3 bulk reservoir"
    }
  ],
  bootAndReset: {
    bootN: "GPIO0 is pulled high; a recovery fixture holds it low across EN_RESET release only.",
    enReset:
      "EN_RESET has the selected 10 kOhm pull-up and 1 uF delay capacitor; supervisor, watchdog, manual reset, and fixtures may only sink it open-drain.",
    straps: [
      "GPIO3 remains electrically quiet and unconnected.",
      "GPIO45 and GPIO46 retain their reviewed HUB75 reset bias.",
      "No external circuit drives a boot strap or EN_RESET high."
    ]
  },
  nativeUsb: {
    pins: ["GPIO19 USB_DN", "GPIO20 USB_DP"],
    rule: "Use native USB Serial/JTAG through the protected USB-C service path; retain the matched 22 ohm series pair."
  },
  recovery: {
    populatedHeader: false,
    testPads: ["UART0_RX", "UART0_TX", "BOOT_N", "EN_RESET", "APP_3V3", "APP_GND"],
    rule: "UART0 and native USB are the only P0 recovery paths; a fixture must not power APP_3V3 through a test pad."
  },
  fixedInterfaces: {
    acquisition:
      "GPIO4 SAR_SCLK, GPIO5 SAR_DOUT, and GPIO6 SAR_CONVST use SPI3_HOST plus GDMA for the seven ADS8881 chain.",
    ir: "GPIO35 IR_RX is an input-only RMT RX path for TSOP38438.",
    ethernet: "W5500 uses SPI2_HOST and is polled; its interrupt is not connected.",
    primaryOutputs:
      "GPIO7, GPIO10, GPIO11, GPIO15, and GPIO17 directly feed one protected primary lamp and buzzer driver; its hardware enable/default-off circuitry remains authoritative before firmware and during faults.",
    hub75:
      "External reset/output-enable circuitry keeps the HUB75 panel blank until a complete safe frame is latched; the display is never a reset source."
  },
  restrictions: {
    radio:
      "Wi-Fi and Bluetooth remain disabled in P0; ANT_EXTERNAL is not a P0 net because the selected WROOM-1 antenna is integrated.",
    flash: "No flash, NVS, OTA, filesystem, or log erase/write may occur while scoring acquisition is active.",
    unusedPins: "GPIO36, GPIO37, and GPIO47 remain reserved; GPIO33/GPIO34 and module flash/PSRAM pads are unavailable."
  },
  rejectedFromP0: [
    "a second processor and its clocks, debug, backup domain, and support network",
    "processor isolators, isolated link power, and cross-domain reset paths",
    "serialized primary-output latch or SPI2 shift-register",
    "F-RAM, RTC, secure element, audio amplifier, speaker connector, and an external antenna chain"
  ],
  authority: {
    schematicApproved: false,
    railTransientVerified: false,
    resetTimingVerified: false,
    rfApproved: false,
    fabricationAuthorized: false
  }
} as const

export const benchPrototypeProcessorSupport = deepFreeze(processorSupportDefinition)

/** Rejects substitutions, stale allocation, graph manipulation, or release escalation. */
export function validateBenchPrototypeProcessorSupport(value: unknown): true {
  validateBenchPrototypeEsp32Allocation(benchPrototypeEsp32Allocation)
  if (!sameDataGraph(value, benchPrototypeProcessorSupport)) {
    throw new RangeError("BP-125 processor-support contract must exactly match the reviewed P0 graph")
  }
  const contract = benchPrototypeProcessorSupport
  if (
    contract.processor.mpn !== benchPrototypeEsp32Allocation.moduleMpn ||
    contract.selectedSupportRows.map((row) => row.reference).join(",") !==
      "R_ESP_BOOT_PULLUP,R_ESP_EN_PULLUP,C_ESP_EN_DELAY,C_ESP_3V3_HF,C_ESP_3V3_BULK" ||
    contract.selectedSupportRows.map((row) => row.mpn).join(",") !==
      "RC0603FR-0710KL,RC0603FR-0710KL,C1608X5R1A105K080AC,GCM188R71H104KA57D,GCM32EC71A476KE02L" ||
    contract.recovery.populatedHeader ||
    contract.recovery.testPads.join(",") !== "UART0_RX,UART0_TX,BOOT_N,EN_RESET,APP_3V3,APP_GND" ||
    !contract.fixedInterfaces.acquisition.includes("GPIO4") ||
    !contract.fixedInterfaces.acquisition.includes("GPIO5") ||
    !contract.fixedInterfaces.acquisition.includes("GPIO6") ||
    !contract.fixedInterfaces.ir.includes("GPIO35") ||
    !contract.fixedInterfaces.ir.includes("TSOP38438") ||
    !contract.fixedInterfaces.ethernet.includes("W5500") ||
    !contract.fixedInterfaces.primaryOutputs.includes("GPIO7") ||
    !contract.fixedInterfaces.primaryOutputs.includes("GPIO17") ||
    !contract.fixedInterfaces.primaryOutputs.includes("default-off") ||
    !contract.fixedInterfaces.hub75.includes("blank") ||
    !contract.restrictions.radio.includes("disabled") ||
    !contract.restrictions.flash.startsWith("No flash") ||
    !contract.restrictions.unusedPins.includes("GPIO36") ||
    contract.rejectedFromP0.some(
      (rejection) =>
        !rejection.includes("second processor") &&
        !rejection.includes("isolators") &&
        !rejection.includes("serialized") &&
        !rejection.includes("F-RAM")
    ) ||
    contract.authority.schematicApproved ||
    contract.authority.railTransientVerified ||
    contract.authority.resetTimingVerified ||
    contract.authority.rfApproved ||
    contract.authority.fabricationAuthorized ||
    contract.releaseState !== "deny"
  ) {
    throw new RangeError("BP-125 must retain the sole-ESP32 P0 support and denied release gates")
  }
  return true
}
