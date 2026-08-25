/** BP-120 reconciliation: support, reset, recovery, and pad policy for the P0 ESP32 module. */

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
  if (seen.has(value)) throw new RangeError("Canonical BP-120 support contract cannot contain cycles or aliases")
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError("Canonical BP-120 support contract may contain only data properties")
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

const supportDefinition = {
  artifactKind: "p0-esp32-support-reconciliation",
  workUnit: "BP-120",
  target: "sole-ESP32-S3 P0 bench prototype",
  releaseState: "evidence-gated",
  module: {
    exactMpn: "ESP32-S3-WROOM-1-N16R2",
    supplyRange: "3.0 V to 3.6 V",
    antenna: "integrated on-module PCB antenna",
    radioPolicy:
      "P0 firmware leaves Wi-Fi and Bluetooth uninitialized. Any later radio enablement uses this module antenna only and requires the WROOM-1 placement, enclosure-clearance, throughput, and range evidence."
  },
  bypass: {
    moduleSupplyPad: "pad 2 3V3",
    groundReturnPads: ["pad 1 GND", "pad 40 GND", "pad 41 GND_EP"],
    parts: [
      {
        reference: "C_ESP_3V3_HF",
        mpn: "GCM188R71H104KA57D",
        value: "100 nF X7R",
        connection: "APP_3V3 to APP_GND",
        placement: "at pad 2 with the shortest direct APP_GND return"
      },
      {
        reference: "C_ESP_3V3_BULK",
        mpn: "GCM32EC71A476KE02L",
        value: "47 uF X7S nominal",
        connection: "APP_3V3 to APP_GND",
        placement: "on the local supply island, outside the integrated-antenna clearance"
      }
    ],
    rule: "Neither bypass part is in series with APP_3V3. Effective capacitance, rail transient margin, and placement must be measured on the assembled board."
  },
  bootAndReset: {
    boot: {
      signal: "BOOT_N on pad 27 GPIO0",
      normalState: "10 kOhm pull-up through R_ESP_BOOT_PULLUP RC0603FR-0710KL",
      recoveryState:
        "A fixture may sink BOOT_N only while EN_RESET is asserted and through EN_RESET release, then releases BOOT_N for ROM joint-download boot.",
      prohibition: "Do not fit a high-value capacitor or an active high driver on BOOT_N."
    },
    enable: {
      signal: "EN_RESET on pad 3 EN",
      normalState:
        "10 kOhm pull-up through R_ESP_EN_PULLUP RC0603FR-0710KL and 1 uF X5R C_ESP_EN_DELAY C1608X5R1A105K080AC to APP_GND",
      resetSources:
        "TPS389033DSER supervisor, TPS3431SDRBR watchdog WDO plus ENOUT, manual reset, and a recovery fixture may only sink the common reset path open-drain.",
      prohibition:
        "No reset source may drive EN_RESET or APP_RESET_N high, and no reset consumer may source either net."
    },
    straps: [
      "GPIO0 is BOOT_N with its external pull-up.",
      "GPIO3 is left electrically unconnected and quiet.",
      "GPIO45 HUB75_D and GPIO46 HUB75_CLK retain their reviewed reset bias and must satisfy their strapping state before EN_RESET release."
    ]
  },
  watchdog: {
    signal: "APP_WD_KICK on pad 20 GPIO12",
    hardware: "TPS3431SDRBR with a 10 kOhm CWD resistor and a 100 kOhm APP_WD_KICK pull-up",
    kick: "GPIO12 is open-drain and emits one falling edge only after the aggregate acquisition, frame-queue, reference, primary-output, rail, and watchdog-health epoch passes.",
    cadence: "maximum 100 ms between valid falling-edge kicks",
    timeoutAndResetPulse: "170 ms to 230 ms",
    faultResult:
      "A stale, incomplete, high-Z, stuck-high, or stuck-low source creates no repeated falling edge. The watchdog asserts common reset, which holds EN_RESET, W5500 reset, primary-output disable, and HUB75 safing inactive.",
    prohibited:
      "No second processor, isolation channel, cross-domain reset, or independent heartbeat reset path is part of P0."
  },
  nativeUsb: {
    signals: ["pad 13 GPIO19 USB_DN", "pad 14 GPIO20 USB_DP"],
    function: "native USB Serial/JTAG is the normal programming and recovery path",
    route:
      "protected USB-C service path with TPD2EUSB30DRTR and one 22 ohm series resistor in each matched 90 ohm differential line",
    prohibition: "No external JTAG header is allocated."
  },
  uartRecovery: {
    signals: ["pad 36 GPIO44 UART0_RX", "pad 37 GPIO43 UART0_TX"],
    testPads: ["UART0_RX", "UART0_TX", "BOOT_N", "EN_RESET", "APP_3V3", "APP_GND"],
    fixture:
      "Use only a keyed 3.3 V logic pogo or clip fixture. APP_3V3 is sense-only and APP_GND is the fixture reference.",
    procedure:
      "With USB-C disconnected and APP_3V3 discharged, attach the fixture, apply normal target power, hold BOOT_N low, sink then release EN_RESET, release BOOT_N, program over UART0 or native USB, verify the image hash, then remove target power before removing the fixture.",
    prohibition:
      "The fixture must not power APP_3V3, use 5 V TTL or RS-232 levels, drive BOOT_N or EN_RESET high, or become a permanent header."
  },
  modulePadPolicy: benchPrototypeEsp32Allocation.pads,
  unavailableResources: {
    inPackageFlashPsram: [26, 27, 28, 29, 30, 31, 32],
    moduleUnexposed: [33, 34],
    reservedSparePads: [30],
    reservedSpareGpios: [37],
    rule: "Reserved spare pads have no circuit, pull, test pad, or firmware claim in P0. All other module pads have the exact assigned, power, ground, reset, or reserved-nc disposition in modulePadPolicy."
  },
  authority: {
    schematicIntegrated: false,
    supplyAndResetMeasured: false,
    usbAndUartRecoveryDemonstrated: false,
    antennaAndRadioVerified: false,
    fabricationAuthorized: false
  }
} as const

export const p0Esp32Support = deepFreeze(supportDefinition)

/** Rejects stale module, recovery, pad, reset, or release assumptions. */
export function validateP0Esp32Support(value: unknown): true {
  validateBenchPrototypeEsp32Allocation(benchPrototypeEsp32Allocation)
  if (!sameDataGraph(value, p0Esp32Support)) {
    throw new RangeError("BP-120 P0 ESP32 support must exactly match the reviewed data graph")
  }
  const contract = p0Esp32Support
  const pads = contract.modulePadPolicy
  const assignedGpios = pads.filter((pad) => "gpio" in pad).map((pad) => pad.gpio)
  if (
    contract.module.exactMpn !== benchPrototypeEsp32Allocation.moduleMpn ||
    contract.module.antenna !== "integrated on-module PCB antenna" ||
    contract.bypass.parts.map((part) => part.reference).join(",") !== "C_ESP_3V3_HF,C_ESP_3V3_BULK" ||
    contract.bypass.parts.map((part) => part.mpn).join(",") !== "GCM188R71H104KA57D,GCM32EC71A476KE02L" ||
    contract.bootAndReset.boot.signal !== "BOOT_N on pad 27 GPIO0" ||
    !contract.bootAndReset.enable.resetSources.includes("open-drain") ||
    contract.watchdog.signal !== "APP_WD_KICK on pad 20 GPIO12" ||
    contract.watchdog.timeoutAndResetPulse !== "170 ms to 230 ms" ||
    contract.nativeUsb.signals.join(",") !== "pad 13 GPIO19 USB_DN,pad 14 GPIO20 USB_DP" ||
    contract.uartRecovery.signals.join(",") !== "pad 36 GPIO44 UART0_RX,pad 37 GPIO43 UART0_TX" ||
    contract.uartRecovery.testPads.join(",") !== "UART0_RX,UART0_TX,BOOT_N,EN_RESET,APP_3V3,APP_GND" ||
    !sameDataGraph(contract.modulePadPolicy, benchPrototypeEsp32Allocation.pads) ||
    pads.length !== 41 ||
    new Set(assignedGpios).size !== assignedGpios.length ||
    contract.unavailableResources.reservedSpareGpios.join(",") !== "37" ||
    contract.authority.schematicIntegrated ||
    contract.authority.supplyAndResetMeasured ||
    contract.authority.usbAndUartRecoveryDemonstrated ||
    contract.authority.antennaAndRadioVerified ||
    contract.authority.fabricationAuthorized ||
    contract.releaseState !== "evidence-gated"
  ) {
    throw new RangeError("BP-120 must retain the WROOM-1 P0 support and physical evidence gates")
  }
  return true
}
