/**
 * BP-146: exact encrypted-IR receiver hardware selection for the bench board.
 *
 * This is a hardware/interface contract only. Authentication, anti-replay,
 * pairing, and command authority remain application firmware responsibilities.
 * The selection deliberately stays fabrication-denied until board CAD,
 * optical layout, timing, and fault tests below have evidence.
 */

import {
  benchPrototypeIrReceiverFootprintEvidence,
  validateBenchPrototypeIrReceiverFootprintEvidence
} from "./bench-prototype-ir-receiver-footprint-evidence.js"

type DataRecord = Record<PropertyKey, unknown>

function isPlainRecord(value: unknown): value is DataRecord {
  return value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) throw new RangeError("Canonical BP-146 data cannot contain cycles or aliases")
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError("Canonical BP-146 data may contain only data properties")
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

const definition = {
  artifactKind: "bench-prototype-encrypted-ir-receiver-selection",
  workUnit: "BP-146",
  targetAssembly: "one-board bench prototype",
  upstream: {
    interfaceTask: "BP-126",
    esp32ModuleMpn: "ESP32-S3-WROOM-1U-N16R2",
    inputSignal: "IR_RX",
    inputGpio: 35,
    inputModulePad: 28,
    peripheral: "RMT RX"
  },
  releaseState: "deny",
  decision: "EXACT_RECEIVER_SELECTED_OPTICAL_AND_FOOTPRINT_GATES_OPEN",
  securityBoundary: "hardware does not authenticate or authorize commands; firmware must do so",
  receiver: {
    manufacturer: "Vishay Semiconductors",
    mpn: "TSOP38438",
    family: "TSOP382.., TSOP384..",
    package: "Minicast, 3-pin leaded, 5.0 mm W x 6.95 mm H x 4.8 mm D",
    carrierFrequencyKHz: 38,
    agcVariant: "AGC4, recommended for long-burst codes",
    pinout: [
      { pin: 1, name: "OUT", electrical: "active-low demodulated output" },
      { pin: 2, name: "GND", net: "APP_GND" },
      { pin: 3, name: "VS", net: "IR_3V3_FILTERED" }
    ],
    supply: { minimumV: 2, nominalV: 3.3, maximumV: 5.5 },
    output: {
      idleLevel: "high",
      lowMaximumV: 0.1,
      testCondition: "IOSL = 0.5 mA, Ee = 0.7 mW/m2",
      receiverToGpio: "OUT through R_IR_OUT; no direct scoring-domain connection"
    },
    publishedOpticalLimits: {
      nominalTransmissionDistanceM: 30,
      halfTransmissionAngleDegrees: 45,
      minimumIrradianceNecCodeMwPerM2Maximum: 0.25,
      maximumIrradianceWPerM2Minimum: 30
    },
    publishedTimingLimits: {
      carrierPeriodUs: 26.315,
      outputDelayMinimumUs: 184,
      outputDelayMaximumUs: 342,
      outputPulseWidthErrorPlusMinusUs: 132
    }
  },
  supportNetwork: [
    {
      reference: "R_IR_VS",
      manufacturer: "YAGEO",
      mpn: "RC0603FR-07100RL",
      value: "100 ohm, 1%",
      package: "0603 / 1608",
      topology: "APP_3V3 -> R_IR_VS -> IR_3V3_FILTERED -> receiver VS pin 3",
      purpose: "supply ripple and spike isolation"
    },
    {
      reference: "C_IR_VS",
      manufacturer: "KEMET",
      mpn: "C0603C104K3RACTU",
      value: "100 nF, 10%, 25 V, X7R",
      package: "0603 / 1608",
      topology: "IR_3V3_FILTERED to APP_GND at receiver pins",
      purpose: "local receiver bypass"
    },
    {
      reference: "R_IR_OUT",
      manufacturer: "YAGEO",
      mpn: "RC0603FR-07100RL",
      value: "100 ohm, 1%",
      package: "0603 / 1608",
      topology: "receiver OUT pin 1 -> R_IR_OUT -> IR_RX_GPIO35",
      purpose: "limits fault/backfeed current and damps the short GPIO trace"
    },
    {
      reference: "R_IR_PULLUP",
      manufacturer: "YAGEO",
      mpn: "RC0603FR-0710KL",
      value: "10 kohm, 1%",
      package: "0603 / 1608",
      topology: "IR_RX_GPIO35 to APP_3V3",
      purpose: "defined inactive-high input while receiver or RMT is reset/off"
    }
  ],
  supportNetworkBasis: {
    manufacturerGuidance:
      "Vishay recommends an R1/C1 supply filter only when strong ripple or spikes are present; it does not prescribe the selected 100 ohm/100 nF values.",
    designChoice:
      "R_IR_VS = 100 ohm and C_IR_VS = 100 nF are bench-prototype engineering choices and must pass supply-ripple, receiver-delay, range, and flood tests before schematic release."
  },
  observation: {
    testPoint: {
      reference: "TP_IR_RX",
      manufacturer: "Keystone Electronics",
      mpn: "5001",
      package: "miniature through-hole black test point, 1.02 mm hole",
      net: "IR_RX_GPIO35",
      placement: "ESP32-side of R_IR_OUT; probe access without entering the optical keepout"
    },
    forbiddenTestPointConnections: ["EN_RESET", "BOOT_N", "STM32 domain", "isolated SPI", "HUB75"]
  },
  resetPowerOffAndFaultBehavior: {
    reset: [
      "Receiver is powered from APP_3V3 only; it has no path to EN_RESET or BOOT_N.",
      "GPIO35 is input-only for this function and is not a boot strap.",
      "Firmware keeps RMT disabled and ignores the input until APP_3V3 is settled and the authenticated session is ready."
    ],
    powerOff: [
      "APP_3V3 removal removes receiver supply; R_IR_OUT limits any residual receiver-output injection into GPIO35.",
      "The board must show no GPIO35 rise above APP_3V3 plus 0.3 V and no reset assertion during rail-off/rail-on tests."
    ],
    stuckOrFlooded: [
      "Continuous low, continuous carrier, malformed pulse trains, and queue overflow are discarded as diagnostics only.",
      "No IR condition may change bout state, drive scoring hardware, hold reset, or defeat either watchdog.",
      "The bounded RMT capture and authenticated command queue must shed excess input and recover after a quiet interval."
    ]
  },
  opticalPlacement: {
    orientation: "receiver optical axis normal to the intended front panel",
    keepout: [
      "no copper, traces, vias, LEDs, display light pipes, or switching-node copper in the front optical aperture",
      "keep 3 mm radial copper and component keepout around the lens as a conservative board rule; Vishay publishes window sizing but no fixed radial PCB keepout",
      "place receiver and TP on the application side of the scoring isolation boundary",
      "do not place the receiver behind tinted material or the HUB75 panel"
    ],
    prototypeMechanicalGate:
      "use the reviewed TSOP38438 drawing, accepted board CAD, and a physical front-panel coupon before PCB release"
  },
  footprintEvidence: benchPrototypeIrReceiverFootprintEvidence,
  benchGates: {
    range: {
      setup:
        "actual representative handheld emitter, production-candidate frame format, 38 kHz carrier, nominal APP_3V3, and recorded ambient light",
      pass: "1000/1000 valid authenticated frames at 20 m and 0 degrees; 100/100 at 20 m and +/-15 degrees",
      fail: "any false accepted command, reset, watchdog fault, or unbounded capture"
    },
    angle: {
      pass: "100/100 valid frames at 5 m at 0, +/-30, and +/-45 degrees; record the first failing angle",
      fail: "any angle causes a reset, direct scoring effect, or accepted malformed frame"
    },
    latency: {
      componentGate:
        "scope emitter trigger and TP_IR_RX; first output edge must be 184-342 us after a qualifying burst edge",
      systemGate: "timestamped IR edge to authenticated command event must be <= 50 ms for every valid test frame",
      fail: "out-of-range receiver delay, queue starvation, or a command emitted from an unauthenticated frame"
    },
    flood: {
      setup: "30 minutes of 38 kHz carrier/burst noise at the maximum safe optical level plus 40 klx ambient light",
      pass: "zero accepted commands, zero reset/watchdog faults, bounded queue occupancy, and automatic recovery within 1 s",
      fail: "any command, queue growth without bound, or receiver path affecting scoring"
    },
    resetPowerOff: {
      pass: "100 power cycles and 100 reset cycles; TP_IR_RX is inactive-high or high-impedance within 10 ms of rail validity and no reset is caused by IR",
      fail: "backfeed above APP_3V3 + 0.3 V, strap disturbance, or a reset/watchdog fault"
    }
  },
  evidence: {
    exactMpnAndDatasheetReviewed: true,
    supportMpnRecordsReviewed: true,
    manufacturerPackageDrawingReviewed: true,
    pinOrientationReviewed: true,
    throughHoleGeometryReviewed: true,
    manufacturerCadReviewed: false,
    range20mEvidence: false,
    footprintReleased: false,
    opticalKeepoutReviewed: true,
    opticalKeepoutAccepted: false,
    rangeEvidence: false,
    angleEvidence: false,
    latencyEvidence: false,
    floodEvidence: false,
    resetPowerOffEvidence: false,
    fabricationAuthorized: false
  },
  sources: [
    "https://www.vishay.com/docs/82491/tsop382.pdf",
    "https://www.vishay.com/docs/82756/windowsizeminicast.pdf",
    "https://www.vishay.com/docs/80068/assembly.pdf",
    "https://www.vishay.com/en/product/82491/",
    "https://www.vishay.com/en/ir-receiver-modules/mitsubishi/",
    "https://yageogroup.com/component-documentation/download/specsheet/RC0603FR-07100RL",
    "https://www.yageogroup.com/component-documentation/download/specsheet/RC0603FR-0710KL",
    "https://search.kemet.com/component-documentation/download/specsheet/C0603C104K3RACTU",
    "https://www.keystone-europe.com/wp-content/uploads/2025/08/terminal-test-points.pdf",
    "https://www.espressif.com/sites/default/files/documentation/esp32-s3-wroom-1_wroom-1u_datasheet_en.pdf"
  ]
} as const

export const benchPrototypeIrReceiverSelection = deepFreeze(definition)

/** Reject substitutions, evidence relaxation, and accidental fabrication credit. */
export function validateBenchPrototypeIrReceiverSelection(value: unknown): true {
  if (!sameDataGraph(value, benchPrototypeIrReceiverSelection)) {
    throw new RangeError("BP-146 must exactly match the reviewed TSOP38438 selection contract")
  }
  const contract = benchPrototypeIrReceiverSelection
  validateBenchPrototypeIrReceiverFootprintEvidence(contract.footprintEvidence)
  if (
    contract.workUnit !== "BP-146" ||
    contract.releaseState !== "deny" ||
    contract.receiver.mpn !== "TSOP38438" ||
    contract.receiver.carrierFrequencyKHz !== 38 ||
    contract.receiver.pinout[0].name !== "OUT" ||
    contract.receiver.pinout[0].electrical !== "active-low demodulated output" ||
    contract.upstream.inputGpio !== 35 ||
    contract.upstream.inputModulePad !== 28 ||
    contract.supportNetwork.length !== 4 ||
    contract.supportNetworkBasis.designChoice.includes("bench-prototype engineering choices") === false ||
    contract.observation.testPoint.mpn !== "5001" ||
    !contract.evidence.manufacturerPackageDrawingReviewed ||
    !contract.evidence.pinOrientationReviewed ||
    !contract.evidence.throughHoleGeometryReviewed ||
    contract.evidence.manufacturerCadReviewed ||
    contract.benchGates.range.pass.includes("20 m and 0 degrees") === false ||
    contract.benchGates.flood.pass.includes("zero accepted commands") === false ||
    contract.evidence.fabricationAuthorized ||
    contract.evidence.range20mEvidence ||
    contract.evidence.footprintReleased ||
    !contract.evidence.opticalKeepoutReviewed ||
    contract.evidence.opticalKeepoutAccepted ||
    contract.evidence.rangeEvidence ||
    contract.evidence.angleEvidence ||
    contract.evidence.latencyEvidence ||
    contract.evidence.floodEvidence ||
    contract.evidence.resetPowerOffEvidence
  ) {
    throw new RangeError("BP-146 must retain exact hardware selection and denied release gates")
  }
  return true
}
