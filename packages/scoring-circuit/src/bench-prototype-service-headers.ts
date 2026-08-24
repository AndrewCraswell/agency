import { benchPrototypeBom, validateBenchPrototypeBom } from "./bench-prototype-bom.js"
import { benchPrototypeContract, validateBenchPrototypeContract } from "./bench-prototype-contract.js"
import {
  benchPrototypeEsp32Allocation,
  validateBenchPrototypeEsp32Allocation
} from "./bench-prototype-esp32-allocation.js"
import { benchPrototypeResetWatchdog, validateBenchPrototypeResetWatchdog } from "./bench-prototype-reset-watchdog.js"
import { stm32PinAllocation, validateStm32PinAllocation } from "./stm32-pin-allocation.js"

type DataRecord = Record<PropertyKey, unknown>

function isPlainRecord(value: unknown): value is DataRecord {
  return value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object" || seen.has(value)) return value
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

function sameDataGraph(actual: unknown, expected: unknown, seen = new WeakMap<object, object>()): boolean {
  if (Object.is(actual, expected)) return true
  if (actual === null || expected === null || typeof actual !== "object" || typeof expected !== "object") return false
  if (seen.has(actual)) return seen.get(actual) === expected
  seen.set(actual, expected)

  const expectedArray = Array.isArray(expected)
  if (Array.isArray(actual) !== expectedArray) return false
  if (expectedArray) {
    if (!Array.isArray(actual) || !Array.isArray(expected)) return false
    if (Object.getPrototypeOf(actual) !== Array.prototype || Object.getPrototypeOf(expected) !== Array.prototype) {
      return false
    }
    if (actual.length !== expected.length) return false
    const actualKeys = Reflect.ownKeys(actual)
    const expectedKeys = Reflect.ownKeys(expected)
    if (
      actualKeys.length !== expectedKeys.length ||
      actualKeys.some((key, index) => key !== expectedKeys[index] || typeof key === "symbol")
    ) {
      return false
    }
    return expected.every((entry, index) => sameDataGraph(actual[index], entry, seen))
  }

  if (!isPlainRecord(actual) || !isPlainRecord(expected)) return false
  const actualKeys = Reflect.ownKeys(actual)
  const expectedKeys = Reflect.ownKeys(expected)
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key, index) => key !== expectedKeys[index] || typeof key === "symbol")
  ) {
    return false
  }
  return expectedKeys.every((key) => {
    const actualDescriptor = Object.getOwnPropertyDescriptor(actual, key)
    const expectedDescriptor = Object.getOwnPropertyDescriptor(expected, key)
    return Boolean(
      actualDescriptor &&
      expectedDescriptor &&
      "value" in actualDescriptor &&
      "value" in expectedDescriptor &&
      actualDescriptor.enumerable === expectedDescriptor.enumerable &&
      sameDataGraph(actualDescriptor.value, expectedDescriptor.value, seen)
    )
  })
}

const stm32SwD = [
  { pin: 1, net: "SCORING_3V3_SENSE", direction: "adapter-sense", electrical: "sense-only" },
  { pin: 2, net: "SWDIO", direction: "bidirectional", electrical: "3V3_CMOS" },
  { pin: 3, net: "SCORING_SGND", direction: "reference", electrical: "ground" },
  { pin: 4, net: "SWCLK", direction: "adapter-to-target", electrical: "3V3_CMOS" },
  { pin: 5, net: "SCORING_SGND", direction: "reference", electrical: "ground" },
  { pin: 6, net: "NC_SWD_SWO_RESERVED", direction: "not-connected", electrical: "unconnected" },
  { pin: 8, net: "NC_SWD_RESERVED", direction: "not-connected", electrical: "unconnected" },
  { pin: 9, net: "SCORING_SGND", direction: "reference", electrical: "ground" },
  { pin: 10, net: "SCORING_NRST_N", direction: "adapter-open-drain-sink", electrical: "3V3_RESET" }
] as const

const esp32Service = [
  { pin: 1, net: "APP_GND", direction: "reference", electrical: "ground" },
  { pin: 2, net: "APP_3V3_SENSE", direction: "adapter-sense", electrical: "sense-only" },
  { pin: 3, net: "UART0_TX", direction: "board-to-adapter", electrical: "3V3_CMOS" },
  { pin: 4, net: "UART0_RX", direction: "adapter-to-board", electrical: "3V3_CMOS" },
  { pin: 5, net: "BOOT_N", direction: "adapter-open-drain-sink", electrical: "3V3_STRAP" },
  { pin: 6, net: "MANUAL_RESET_ASSERT", direction: "adapter-3V3-assert", electrical: "3V3_CONTROL" }
] as const

const definition = {
  artifactKind: "bench-prototype-service-header-contract",
  workUnit: "BP-124",
  targetAssembly: "one-board bench prototype",
  prototypeOnly: true,
  schematicInputOnly: true,
  layoutRelease: false,
  fabricationDisposition: "DENY",
  releaseState: "deny",
  prerequisites: {
    boardBoundary: { workUnit: "BP-010", contract: "benchPrototypeContract", rule: "headers are service access only" },
    bomBaseline: {
      workUnit: "BP-020",
      contract: "benchPrototypeBom",
      rule: "BOM rows remain TBD until footprint and sample evidence"
    },
    stm32: { workUnit: "BP-120", contract: "stm32PinAllocation", part: "STM32G474RET3TR", domain: "SCORING" },
    esp32: {
      workUnit: "BP-121",
      contract: "benchPrototypeEsp32Allocation",
      part: "ESP32-S3-WROOM-1U-N16R2",
      domain: "APP"
    }
  },
  stm32: {
    reference: "J_STM_SWD",
    bomReference: "J_STM32_SWD",
    header: {
      manufacturer: "Samtec",
      mpn: "FTSH-105-01-L-DV-007-K",
      family: "FTSH .050 inch keyed micro header with pin 7 omitted",
      positions: 10,
      rows: 2,
      pitchMm: 1.27,
      termination: "surface-mount",
      matingKey: "FTSH -K key mates with FFSD; pin 7 is omitted"
    },
    matingCable: {
      manufacturer: "Samtec",
      mpn: "FFSD-05-D-06.00-01-N",
      family: ".050 inch Tiger Eye IDC cable assembly",
      lengthIn: 6,
      selectionStatus: "candidate-orderable",
      sourceUrl: "https://www.samtec.com/products/ffsd-05-d-06.00-01-n"
    },
    omittedPins: [7],
    pinout: stm32SwD,
    voltage: {
      targetDomain: "SCORING_3V3",
      targetRangeV: { minimum: 3.0, maximum: 3.6 },
      senseRule: "SCORING_3V3_SENSE is a high-impedance target-voltage reference and never powers the board",
      signalRule: "SWDIO, SWCLK, and NRST are 3.3 V-domain signals; no 5 V probe is permitted",
      resetRule: "SWD probe may sink SCORING_NRST_N but must not drive it high"
    },
    recoveryProcedure: [
      "Power off the board, remove USB-C and all diagnostic sources, discharge V20_TO_V5_BUCK, and verify no rail remains energized before mating.",
      "Mate the keyed FFSD cable while the board is off; use no external probe power and connect target sense only.",
      "Reapply normal USB-C power only, verify SCORING_3V3_SENSE is within 3.0 V to 3.6 V and measure zero back-power from the probe before recovery.",
      "Use the 3.3 V-aware SWD probe to program and verify the STM32G474RET3TR image, inspect reset and scoring-safe outputs, and record the capture.",
      "Power off again, remove USB-C, discharge V20_TO_V5_BUCK, and verify no rail remains energized before unmating the cable.",
      "Unmate the cable while the board is off and power up normally with no external probe or service source connected."
    ],
    powerSequenceRule:
      "Mating and unmating are de-energized only; normal USB-C is the sole power source during recovery; the external probe must never power the target."
  },
  esp32: {
    reference: "J_ESP_SERVICE",
    bomReference: "J_ESP32_SERVICE",
    header: {
      manufacturer: "Samtec",
      mpn: "TSW-106-07-G-S",
      family: "TSW .100 inch single-row through-hole header",
      positions: 6,
      rows: 1,
      pitchMm: 2.54,
      termination: "through-hole",
      matingSocket: { manufacturer: "Samtec", mpn: "SSW-106-01-G-S", selectionStatus: "candidate-orderable" },
      socketSourceUrl: "https://www.samtec.com/products/ssw-106-01-g-s",
      orientation: {
        keying: "none",
        reversible: true,
        fixtureEnforced: false,
        blockingGate:
          "A fixture-enforced pin-1 key, label, and reversal-prevention feature must be installed and physically verified before this header may be populated or energized."
      }
    },
    pinout: esp32Service,
    voltage: {
      targetDomain: "APP_3V3",
      targetRangeV: { minimum: 3.0, maximum: 3.6 },
      senseRule: "APP_3V3_SENSE is sense-only and must not source APP_3V3",
      signalRule:
        "UART0_RX, UART0_TX, BOOT_N, and MANUAL_RESET_ASSERT require a 3.3 V-compatible adapter referenced to APP_GND",
      prohibited: "5 V TTL, RS-232 voltage, and any adapter that sources the sense pins"
    },
    recoveryProcedure: [
      "Power off the board, remove USB-C and all diagnostic sources, discharge V3_3, and verify no rail remains energized before mating.",
      "Mate the six-conductor service harness only after the board is off; the unkeyed TSW/SSW pair requires the verified fixture-enforced orientation.",
      "Reapply normal USB-C power only, connect APP_GND as the reference, verify APP_3V3_SENSE is within 3.0 V to 3.6 V, and measure zero back-power from the adapter before recovery.",
      "Drive BOOT_N low before and throughout MANUAL_RESET_ASSERT/EN_RESET assertion, release the reset sink while retaining BOOT_N low for the 10 ms post-release sample interval, then release BOOT_N and recover over 3.3 V UART0.",
      "Power off again, remove USB-C, discharge V3_3, and verify no rail remains energized before unmating the harness.",
      "Unmate the harness while the board is off and power up normally with no external adapter or service source connected."
    ],
    powerSequenceRule:
      "Mating and unmating are de-energized only; normal USB-C is the sole power source during recovery; the external adapter must never power the target or either sense pin."
  },
  manualResetSink: {
    transistor: {
      reference: "Q_ESP_DEBUG_RESET",
      mpn: "BSS138AKA",
      source: "APP_GND",
      drain: "EN_RESET",
      gate: "R_DEBUG_RESET_GATE.pin2",
      directHeaderToEnReset: false
    },
    gateSeries: {
      reference: "R_DEBUG_RESET_GATE",
      mpn: "RC0603FR-0710KL",
      from: "MANUAL_RESET_ASSERT",
      to: "Q_ESP_DEBUG_RESET.G"
    },
    gatePulldown: {
      reference: "R_DEBUG_RESET_GATE_PD",
      mpn: "RC0603FR-07100KL",
      from: "Q_ESP_DEBUG_RESET.G",
      to: "APP_GND"
    },
    rule: "The service header drives only the BSS138 gate network; EN_RESET is sunk locally and is never directly driven by the header."
  },
  recoveryDemonstration: {
    requiredState: "not-demonstrated",
    scoringRecovery: [
      "With the STM32 held in reset, prove all source/sink enables and primary outputs remain in their external inactive states.",
      "Read back the STM32 identity, program a known test image, verify SWD memory access, and record reset release timing and target-sense voltage.",
      "Power-cycle with the probe removed and verify the scoring processor alone remains the authority; no service signal may create a hit or reset the STM32."
    ],
    esp32Recovery: [
      "With the ESP32 held in reset, prove HUB75, Ethernet, and application SPI outputs remain inactive and STM32 scoring continues.",
      "Capture BOOT_N, MANUAL_RESET_ASSERT, EN_RESET, UART0_RX, and UART0_TX while entering ROM download mode and record the adapter voltage.",
      "Program a known image, verify a normal boot after releasing BOOT_N and removing the adapter, and archive the capture and image hash."
    ],
    evidenceRecord:
      "scope captures, de-energized continuity map, adapter model/voltage, image hashes, and signed bench log"
  },
  authority: {
    exactSelectionFrozen: true,
    schematicIntegrationApproved: false,
    footprintEvidenceApproved: false,
    matingEvidenceApproved: false,
    continuityVerified: false,
    recoveryDemonstrated: false,
    fabricationAuthorized: false,
    disposition: "DNP-until-footprint-and-bench-evidence",
    releaseState: "deny"
  },
  openGates: [
    "Import the exact Samtec FTSH-105-01-L-DV-007-K and TSW footprints and compare pin 1, omitted pin 7, key, courtyard, solder land, and mating access against manufacturer drawings.",
    "Acquire the FTSH-105-01-L-DV-007-K with FFSD-05-D-06.00-01-N and the TSW-106-07-G-S with SSW-106-01-G-S; photograph keying, insertion, and pin-one orientation.",
    "Continuity-test every populated header pin while de-energized and reject swapped UART, reset, boot, ground, or target-sense conductors.",
    "Measure target voltage at both sense pins, verify no sense-pin back-power, and demonstrate the complete power-off/mate/USB-C-reapply/recover/power-off/unmate sequence with the named adapter voltage.",
    "Add and physically verify the fixture-enforced pin-1 orientation and reversal-prevention feature for the unkeyed TSW/SSW service pair; until then, keep the service header blocked from population and power.",
    "Keep J_STM_SWD and J_ESP_SERVICE DNP and deny fabrication until footprint, mating, continuity, and recovery evidence is archived."
  ],
  sources: [
    { title: "Samtec FTSH-105-01-L-DV-007-K", url: "https://www.samtec.com/products/ftsh-105-01-l-dv-007-k" },
    { title: "Samtec FFSD-05-D-06.00-01-N", url: "https://www.samtec.com/products/ffsd-05-d-06.00-01-n" },
    { title: "Samtec JTAG connector standard", url: "https://www.samtec.com/standards/jtag" },
    { title: "Samtec TSW-106-07-G-S", url: "https://www.samtec.com/products/tsw-106-07-g-s" },
    { title: "Samtec SSW-106-01-G-S", url: "https://www.samtec.com/products/ssw-106-01-g-s" },
    {
      title: "Espressif ESP32-S3 boot mode selection",
      url: "https://docs.espressif.com/projects/esptool/en/latest/esp32/advanced-topics/boot-mode-selection.html"
    },
    { title: "BP-120 STM32 allocation", url: "src/stm32-pin-allocation.ts" },
    { title: "BP-121 ESP32 allocation", url: "src/bench-prototype-esp32-allocation.ts" }
  ]
} as const

export const benchPrototypeServiceHeaders = deepFreeze(definition)

function assertUpstreamContracts(): void {
  validateBenchPrototypeContract(benchPrototypeContract)
  validateBenchPrototypeBom(benchPrototypeBom)
  validateStm32PinAllocation(stm32PinAllocation)
  validateBenchPrototypeEsp32Allocation(benchPrototypeEsp32Allocation)
  validateBenchPrototypeResetWatchdog(benchPrototypeResetWatchdog)

  const stmRow = benchPrototypeBom.rows.find((row) => row.reference === "J_STM32_SWD")
  const espRow = benchPrototypeBom.rows.find((row) => row.reference === "J_ESP32_SERVICE")
  if (
    stmRow?.disposition !== "TBD" ||
    stmRow.mpn !== undefined ||
    espRow?.disposition !== "TBD" ||
    espRow.mpn !== undefined
  ) {
    throw new RangeError("BP-020 service-header BOM rows must remain TBD until footprint and bench evidence")
  }
  if (
    benchPrototypeContract.fixedInterfaces.stm32Debug.candidateMpn !== "Samtec FTSH-105-01-L-DV-007-K" ||
    benchPrototypeContract.fixedInterfaces.esp32Service.candidateMpn !== "Samtec TSW-106-07-G-S" ||
    !benchPrototypeContract.fixedInterfaces.esp32Service.voltageConstraint.includes("no 5 V TTL")
  ) {
    throw new RangeError("BP-010 header candidates or voltage boundary changed")
  }
  const stmSignals = new Set(stm32PinAllocation.pads.map(([, , signal]) => signal))
  const espSignals = new Set(
    benchPrototypeEsp32Allocation.pads
      .filter(
        (pad): pad is Extract<(typeof benchPrototypeEsp32Allocation.pads)[number], { signal: string }> =>
          "signal" in pad
      )
      .map((pad) => pad.signal)
  )
  if (
    stm32SwD.some((pin) => pin.net === "SWDIO" && !stmSignals.has("SWDIO")) ||
    stm32SwD.some((pin) => pin.net === "SWCLK" && !stmSignals.has("SWCLK")) ||
    stm32SwD.some((pin) => pin.net === "SCORING_NRST_N" && !stmSignals.has("SCORING_NRST_N")) ||
    esp32Service.some((pin) => pin.net === "UART0_RX" && !espSignals.has("UART0_RX")) ||
    esp32Service.some((pin) => pin.net === "UART0_TX" && !espSignals.has("UART0_TX")) ||
    esp32Service.some((pin) => pin.net === "BOOT_N" && !espSignals.has("BOOT_N"))
  ) {
    throw new RangeError("BP-124 header pinout drifted from BP-120 or BP-121")
  }

  const manualTransistor = benchPrototypeResetWatchdog.parts.find((part) => part.reference === "Q_ESP_DEBUG_RESET")
  const manualGateSeries = benchPrototypeResetWatchdog.parts.find((part) => part.reference === "R_DEBUG_RESET_GATE")
  const manualGatePulldown = benchPrototypeResetWatchdog.parts.find(
    (part) => part.reference === "R_DEBUG_RESET_GATE_PD"
  )
  if (
    manualTransistor?.mpn !== "BSS138AKA" ||
    manualTransistor.connections !==
      "source to APP_GND; drain to EN_RESET; gate from MANUAL_RESET_ASSERT through R_DEBUG_RESET_GATE" ||
    manualGateSeries?.mpn !== "RC0603FR-0710KL" ||
    manualGateSeries.connections !== "MANUAL_RESET_ASSERT to Q_ESP_DEBUG_RESET gate" ||
    manualGatePulldown?.mpn !== "RC0603FR-07100KL" ||
    manualGatePulldown.connections !== "Q_ESP_DEBUG_RESET gate to APP_GND" ||
    benchPrototypeResetWatchdog.resetTopology.application.manualRule !==
      "MANUAL_RESET_ASSERT is active high only at Q_ESP_DEBUG_RESET gate; the service header must not directly drive EN_RESET."
  ) {
    throw new RangeError("BP-123 manual reset sink topology must remain exact before service recovery is allowed")
  }
}

export function validateBenchPrototypeServiceHeaders(value: unknown): true {
  assertUpstreamContracts()
  if (!sameDataGraph(value, benchPrototypeServiceHeaders)) {
    throw new RangeError("BP-124 service headers must exactly match the reviewed fail-closed contract")
  }
  const contract = benchPrototypeServiceHeaders
  if (
    contract.stm32.header.mpn !== "FTSH-105-01-L-DV-007-K" ||
    contract.stm32.matingCable.mpn !== "FFSD-05-D-06.00-01-N" ||
    contract.stm32.omittedPins.length !== 1 ||
    contract.stm32.omittedPins[0] !== 7 ||
    contract.stm32.pinout.length !== 9 ||
    contract.stm32.pinout[0]?.net !== "SCORING_3V3_SENSE" ||
    contract.stm32.pinout[8]?.net !== "SCORING_NRST_N" ||
    contract.esp32.header.mpn !== "TSW-106-07-G-S" ||
    contract.esp32.header.matingSocket.mpn !== "SSW-106-01-G-S" ||
    contract.esp32.header.orientation.keying !== "none" ||
    !contract.esp32.header.orientation.reversible ||
    contract.esp32.header.orientation.fixtureEnforced ||
    !contract.esp32.header.orientation.blockingGate.includes("fixture-enforced") ||
    contract.esp32.pinout.length !== 6 ||
    contract.esp32.pinout[2]?.net !== "UART0_TX" ||
    contract.esp32.pinout[3]?.net !== "UART0_RX" ||
    contract.esp32.pinout[4]?.net !== "BOOT_N" ||
    contract.esp32.pinout[5]?.net !== "MANUAL_RESET_ASSERT" ||
    contract.esp32.recoveryProcedure[3] !==
      "Drive BOOT_N low before and throughout MANUAL_RESET_ASSERT/EN_RESET assertion, release the reset sink while retaining BOOT_N low for the 10 ms post-release sample interval, then release BOOT_N and recover over 3.3 V UART0." ||
    contract.manualResetSink.transistor.drain !== "EN_RESET" ||
    contract.manualResetSink.transistor.source !== "APP_GND" ||
    contract.manualResetSink.transistor.mpn !== "BSS138AKA" ||
    contract.manualResetSink.transistor.gate !== "R_DEBUG_RESET_GATE.pin2" ||
    contract.manualResetSink.transistor.directHeaderToEnReset ||
    contract.manualResetSink.gateSeries.reference !== "R_DEBUG_RESET_GATE" ||
    contract.manualResetSink.gateSeries.mpn !== "RC0603FR-0710KL" ||
    contract.manualResetSink.gateSeries.from !== "MANUAL_RESET_ASSERT" ||
    contract.manualResetSink.gateSeries.to !== "Q_ESP_DEBUG_RESET.G" ||
    contract.manualResetSink.gatePulldown.reference !== "R_DEBUG_RESET_GATE_PD" ||
    contract.manualResetSink.gatePulldown.mpn !== "RC0603FR-07100KL" ||
    contract.manualResetSink.gatePulldown.from !== "Q_ESP_DEBUG_RESET.G" ||
    contract.manualResetSink.gatePulldown.to !== "APP_GND" ||
    contract.authority.fabricationAuthorized ||
    contract.authority.releaseState !== "deny" ||
    contract.recoveryDemonstration.requiredState !== "not-demonstrated"
  ) {
    throw new RangeError("BP-124 must retain exact service pinouts and deny release before evidence")
  }
  return true
}
