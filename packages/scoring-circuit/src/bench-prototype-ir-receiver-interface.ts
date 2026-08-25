/**
 * BP-126: encrypted-IR receiver/decoder interface reconciliation.
 *
 * BP-121 selects GPIO35/module pad 28 as the application-only RMT_RX input.
 * The receiver hardware remains denied until BP-146 closes its exact
 * electrical, optical, timing, and fault evidence.
 */

import {
  benchPrototypeEsp32Allocation,
  validateBenchPrototypeEsp32Allocation
} from "./bench-prototype-esp32-allocation.js"
import {
  benchPrototypeOptionalPeripherals,
  validateBenchPrototypeOptionalPeripherals
} from "./bench-prototype-optional-peripherals.js"

type DataRecord = Record<PropertyKey, unknown>

function isPlainRecord(value: unknown): value is DataRecord {
  return value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) throw new RangeError("Canonical BP-126 data cannot contain cycles or aliases")
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError("Canonical BP-126 data may contain only data properties")
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

const upstreamAllocationDefinition = {
  task: benchPrototypeEsp32Allocation.task,
  moduleMpn: benchPrototypeEsp32Allocation.moduleMpn,
  pads: structuredClone(benchPrototypeEsp32Allocation.pads),
  unavailableResources: structuredClone(benchPrototypeEsp32Allocation.unavailableResources)
} as const

export const benchPrototypeIrReceiverUpstreamAllocation = deepFreeze(upstreamAllocationDefinition)

const bp145AudioDnpPolicy = deepFreeze({
  reference: "U_AUDIO",
  disposition: "DNP",
  interface: "DNP; no audio host routing; GPIO35 is reserved for BP-126 IR_RX/RMT_RX"
})

function currentBp145AudioDnpPolicy() {
  const audio = benchPrototypeOptionalPeripherals.population.find((item) => item.reference === "U_AUDIO")
  if (audio === undefined) throw new RangeError("BP-126 requires the BP-145 U_AUDIO row")
  return { reference: audio.reference, disposition: audio.disposition, interface: audio.interface }
}

const definition = {
  artifactKind: "bench-prototype-encrypted-ir-receiver-interface",
  workUnit: "BP-126",
  targetModule: "ESP32-S3-WROOM-1-N16R2",
  releaseState: "deny",
  decision: "INTERFACE_SELECTED_HARDWARE_DENY",
  interfaceStatus: "selected",
  receiverHardwareStatus: "deny",
  upstream: {
    allocationTask: "BP-121",
    optionalPeripheralTask: "BP-145",
    receiverSelectionTask: "BP-146",
    behaviorContract: "apps/scoring/docs/encrypted-ir-remote-control-contract.md",
    audioDnpPolicy: bp145AudioDnpPolicy
  },
  interface: {
    applicationDomain: "APP_GND",
    requiredPeripheral: "ESP32-S3 RMT RX input for bounded carrier/pulse capture",
    genericI2cGpioExpander: "denied; no timing credit without measured pulse capture",
    resetRule:
      "The receiver path must be electrically inactive before and throughout ESP32 reset, boot-strapping, and firmware startup; a stuck or flooded path must not hold reset or affect STM32 scoring.",
    queueRule:
      "Authenticated frames enter a bounded application-owned queue with an explicit overflow disposition; no unbounded interrupt, decode, or diagnostic work is permitted.",
    authorityRule:
      "IR input terminates in the ESP32 application domain and can request only authenticated application transitions; it never directly reaches STM32 scoring, qualification, lamps, buzzer, or reset.",
    evidenceRequired:
      "BP-146 must provide the exact receiver MPN and electrical idle/reset behavior, RMT pulse timing, frame/decode bounds, queue depth and overflow behavior, stuck/noise/flood handling, and power-off isolation before schematic release."
  },
  candidateReview: [
    {
      candidate: "GPIO35 / module pad 28",
      gpio: 35,
      currentSignal: "IR_RX",
      priorOwner: "I2S_BCLK for TAS2505TRGERQ1 U_AUDIO, now DNP under BP-145",
      proposedPeripheral: "RMT RX",
      disposition: "selected",
      reason:
        "BP-145 keeps the exact TAS2505TRGERQ1 audio amplifier DNP, so its host I2S clock is not required for this prototype. GPIO35 is the only selected timing-capable application input and remains on the exact N16R2 module.",
      requiredTradeoff:
        "Audio remains DNP. Re-enabling TAS2505TRGERQ1 requires a new BP-121 allocation review and may not borrow IR_RX."
    },
    {
      candidate: "GPIO3 / module pad 15",
      gpio: 3,
      currentSignal: "NC_STRAP_QUIET",
      proposedPeripheral: "RMT RX",
      disposition: "deny",
      reason:
        "GPIO3 is reserved electrically quiet at reset for the JTAG-source strap. A receiver output is an unreviewed boot-time load and cannot be attached to this pad.",
      requiredTradeoff:
        "Reopen BP-121 with a reset-isolated receiver front end that guarantees the strap state through sampling, plus boot/eFuse and power-off measurements; a raw receiver output is prohibited."
    },
    {
      candidate: "GPIO36 / module pad 29",
      gpio: 36,
      currentSignal: "NC_AUDIO_DNP_WS",
      proposedPeripheral: "RMT RX",
      disposition: "deny",
      reason: "GPIO36 is reserved NC for the DNP audio option and is not host-routed."
    },
    {
      candidate: "GPIO37 / module pad 30",
      gpio: 37,
      currentSignal: "NC_AUDIO_DNP_DOUT",
      proposedPeripheral: "RMT RX",
      disposition: "deny",
      reason: "GPIO37 is reserved NC for the DNP audio option and is not host-routed."
    },
    {
      candidate: "GPIO19/GPIO20 / module pads 13/14",
      gpio: "19,20",
      currentSignal: "USB_DN/USB_DP",
      proposedPeripheral: "RMT RX",
      disposition: "deny",
      reason:
        "The matched, protected native USB2 service pair is fixed to GPIO19/GPIO20 and cannot be dropped or multiplexed."
    },
    {
      candidate: "assigned buses, display, recovery, watchdog, heartbeat, or isolation pads",
      gpio: "multiple",
      currentSignal: "BP-121 assigned signals",
      proposedPeripheral: "RMT RX",
      disposition: "deny",
      reason:
        "Every remaining exposed GPIO is consumed by isolated SPI, W5500/F-RAM SPI, 13 HUB75 signals, UART recovery, BOOT_N, I2C, watchdog/heartbeats, or isolation-adjacent service. Reuse would drop a required interface or safety function."
    },
    {
      candidate: "GPIO26-GPIO32",
      gpio: "26-32",
      currentSignal: "internal flash/PSRAM",
      proposedPeripheral: "RMT RX",
      disposition: "deny",
      reason: "These GPIOs are not exposed by the N16R2 module and are occupied by internal flash/PSRAM resources."
    },
    {
      candidate: "GPIO33/GPIO34",
      gpio: "33,34",
      currentSignal: "module-unexposed",
      proposedPeripheral: "RMT RX",
      disposition: "deny",
      reason: "GPIO33 and GPIO34 are not exposed by the ESP32-S3-WROOM-1-N16R2 module."
    }
  ],
  protectedInterfaces: [
    "USB_DN/USB_DP on GPIO19/GPIO20 with TPD2EUSB30DRTR and one matched 22 Ohm resistor per line",
    "W5500 and CY15B104Q F-RAM shared APP SPI with independent ETH_CS_N and FRAM_CS_N",
    "all 13 reset-safe HUB75 signals",
    "UART0_RX/UART0_TX/BOOT_N recovery and hardware EN_RESET",
    "APP_WD_KICK plus ESP32_HEARTBEAT and STM32_HEARTBEAT",
    "ISO7762FDWR/ISO7721FDR crossings and their fail-safe reset/heartbeat behavior",
    "ESP32-S3-WROOM-1-N16R2 exact module identity"
  ],
  requiredTradeoff: {
    status: "hardware-selection-required-before-BP-126-can-pass",
    alternatives: [
      "No alternate ESP32 GPIO, GPIO expander, or decoder shortcut is accepted; BP-146 must use the selected GPIO35/IR_RX interface or return this allocation to BP-121 for review."
    ],
    cumulativeBp146Evidence: [
      "exact receiver/demodulator or decoder MPN and approved electrical interface",
      "reset/boot electrical idle and power-off isolation",
      "RMT pulse timing plus bounded frame/decode work",
      "bounded queue depth, rate, and overflow disposition",
      "stuck-active, stuck-inactive, noise, flooding, and fault-isolation behavior"
    ],
    options: [
      "BP-146 must close every cumulative evidence item above before receiver hardware receives schematic or fabrication credit."
    ],
    prohibitedShortcuts: [
      "Do not connect a raw receiver to GPIO3, GPIO45, GPIO46, BOOT_N, EN_RESET, USB_DN, or USB_DP.",
      "Do not borrow W5500/F-RAM SPI, HUB75, UART recovery, watchdog, heartbeat, or isolation signals.",
      "Do not treat an I2C GPIO expander or an unmeasured decoder as a timing solution.",
      "Do not route any IR signal across the scoring isolation boundary."
    ]
  },
  evidence: {
    exactReceiverSelected: false,
    resetSafeElectricalInterfaceMeasured: false,
    pulseTimingMeasured: false,
    queueBoundsReviewed: false,
    faultIsolationReviewed: false,
    directScoringPath: false,
    fabricationAuthorized: false
  }
} as const

export const benchPrototypeIrReceiverInterface = deepFreeze(definition)

function currentUpstreamAllocation() {
  return {
    task: benchPrototypeEsp32Allocation.task,
    moduleMpn: benchPrototypeEsp32Allocation.moduleMpn,
    pads: structuredClone(benchPrototypeEsp32Allocation.pads),
    unavailableResources: structuredClone(benchPrototypeEsp32Allocation.unavailableResources)
  }
}

/** Rejects receiver-hardware selection, hidden pad reuse, or relaxation of BP-126. */
export function validateBenchPrototypeIrReceiverInterface(value: unknown): true {
  validateBenchPrototypeEsp32Allocation(benchPrototypeEsp32Allocation)
  validateBenchPrototypeOptionalPeripherals(benchPrototypeOptionalPeripherals)
  if (!sameDataGraph(currentUpstreamAllocation(), benchPrototypeIrReceiverUpstreamAllocation)) {
    throw new RangeError("BP-126 BP-121 allocation provenance drifted")
  }
  if (!sameDataGraph(currentBp145AudioDnpPolicy(), bp145AudioDnpPolicy)) {
    throw new RangeError("BP-126 BP-145 U_AUDIO DNP/no-host-route provenance drifted")
  }
  if (!sameDataGraph(value, benchPrototypeIrReceiverInterface)) {
    throw new RangeError("BP-126 interface must exactly match the reviewed selected-interface contract")
  }

  const contract = benchPrototypeIrReceiverInterface
  if (
    contract.workUnit !== "BP-126" ||
    contract.targetModule !== "ESP32-S3-WROOM-1-N16R2" ||
    contract.releaseState !== "deny" ||
    contract.decision !== "INTERFACE_SELECTED_HARDWARE_DENY" ||
    contract.interfaceStatus !== "selected" ||
    contract.receiverHardwareStatus !== "deny" ||
    contract.interface.requiredPeripheral !== "ESP32-S3 RMT RX input for bounded carrier/pulse capture" ||
    contract.interface.genericI2cGpioExpander !== "denied; no timing credit without measured pulse capture" ||
    contract.candidateReview.length !== 8 ||
    contract.candidateReview.filter((candidate) => candidate.disposition === "selected").length !== 1 ||
    contract.candidateReview.find((candidate) => candidate.disposition === "selected")?.gpio !== 35 ||
    contract.protectedInterfaces.length !== 7 ||
    contract.requiredTradeoff.alternatives.length !== 1 ||
    contract.requiredTradeoff.cumulativeBp146Evidence.length !== 5 ||
    contract.requiredTradeoff.options.length !== 1 ||
    contract.evidence.exactReceiverSelected ||
    contract.evidence.resetSafeElectricalInterfaceMeasured ||
    contract.evidence.pulseTimingMeasured ||
    contract.evidence.queueBoundsReviewed ||
    contract.evidence.faultIsolationReviewed ||
    contract.evidence.directScoringPath ||
    contract.evidence.fabricationAuthorized
  ) {
    throw new RangeError("BP-126 must retain the selected RMT_RX interface and denied receiver hardware")
  }
  return true
}
