/** BP-144: reset-safe two-buffer HUB75 electrical contract. */

import { benchPrototypeBom, validateBenchPrototypeBom } from "./bench-prototype-bom.js"
import {
  benchPrototypeEsp32Allocation,
  validateBenchPrototypeEsp32Allocation
} from "./bench-prototype-esp32-allocation.js"
import {
  benchPrototypeHub75Connector,
  validateBenchPrototypeHub75Connector
} from "./bench-prototype-hub75-connector.js"
import { benchPrototypeResetWatchdog, validateBenchPrototypeResetWatchdog } from "./bench-prototype-reset-watchdog.js"
import { validatePhysicalBoardContract } from "./physical-board-contract.js"

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
  if (seen.has(value)) throw new RangeError("Canonical BP-144 contract cannot contain cycles or aliases")
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError("Canonical BP-144 contract may contain only data properties")
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

const hub75Signals = [
  ["HUB75_R1", 13, "U_DISPLAY_BUFFER_A", "A1", "B1", "R1", 1],
  ["HUB75_G1", 14, "U_DISPLAY_BUFFER_A", "A2", "B2", "G1", 2],
  ["HUB75_B1", 21, "U_DISPLAY_BUFFER_A", "A3", "B3", "B1", 3],
  ["HUB75_R2", 16, "U_DISPLAY_BUFFER_A", "A4", "B4", "R2", 5],
  ["HUB75_G2", 38, "U_DISPLAY_BUFFER_A", "A5", "B5", "G2", 6],
  ["HUB75_B2", 39, "U_DISPLAY_BUFFER_A", "A6", "B6", "B2", 7],
  ["HUB75_A", 40, "U_DISPLAY_BUFFER_A", "A7", "B7", "A", 9],
  ["HUB75_B", 41, "U_DISPLAY_BUFFER_A", "A8", "B8", "B", 10],
  ["HUB75_C", 42, "U_DISPLAY_BUFFER_B", "A1", "B1", "C", 11],
  ["HUB75_D", 45, "U_DISPLAY_BUFFER_B", "A2", "B2", "D", 12],
  ["HUB75_CLK", 46, "U_DISPLAY_BUFFER_B", "A3", "B3", "CLK", 13],
  ["HUB75_LAT", 48, "U_DISPLAY_BUFFER_B", "A4", "B4", "LAT", 14],
  ["HUB75_OE_N", 1, "U_DISPLAY_BUFFER_B", "A5", "B5", "OE", 15]
] as const

const ahctPins = {
  A1: 2,
  A2: 3,
  A3: 4,
  A4: 5,
  A5: 6,
  A6: 7,
  A7: 8,
  A8: 9,
  B1: 18,
  B2: 17,
  B3: 16,
  B4: 15,
  B5: 14,
  B6: 13,
  B7: 12,
  B8: 11
} as const

const unusedBufferBInputs = [
  ["A6", "B6", 7, 13],
  ["A7", "B7", 8, 12],
  ["A8", "B8", 9, 11]
] as const

const resistor10k = "RC0603FR-0710KL"
const resistor100k = "RC0603FR-07100KL"

function bomPart(reference: string) {
  const matches = benchPrototypeBom.rows.filter((row) => row.reference === reference)
  if (matches.length !== 1 || matches[0]!.disposition !== "selected") {
    throw new RangeError(`BP-144 requires one selected BOM row for ${reference}`)
  }
  const row = matches[0]!
  if (
    row.mpn === undefined ||
    row.manufacturer === undefined ||
    row.package === undefined ||
    row.source === undefined ||
    !row.source.url.startsWith("https://")
  ) {
    throw new RangeError(`BP-144 BOM row ${reference} lacks exact source identity`)
  }
  return row
}

function supportIdentity(reference: string, quantity: number) {
  const row = bomPart(reference)
  return {
    reference,
    quantity,
    mpn: row.mpn!,
    value: row.function,
    package: row.package!,
    manufacturer: row.manufacturer!,
    source: `BP-020 selected BOM row: ${row.notes}`,
    sourceUrl: row.source!.url
  }
}

const supportIdentityReferences = [
  ["U_DISPLAY_BUFFER_A", 1],
  ["U_DISPLAY_BUFFER_B", 1],
  ["R_HUB75_SIGNAL_DEFAULTS", 16],
  ["R_HUB75_PANEL_OE_PULLUP", 1],
  ["C_HUB75_BUFFER_BYPASS", 2],
  ["Q_DISPLAY_ENABLE", 1],
  ["R_DISPLAY_ENABLE_PULLUP_AND_GATE", 2],
  ["R_DISPLAY_ENABLE_GATE_PD", 1]
] as const

const partIdentityEvidence = supportIdentityReferences.map(([reference, quantity]) =>
  supportIdentity(reference, quantity)
)

const upstreamProvenance = deepFreeze({
  esp32: {
    moduleMpn: benchPrototypeEsp32Allocation.moduleMpn,
    hub75Pads: structuredClone(benchPrototypeEsp32Allocation.pads.filter((pad) => pad.group === "hub75")),
    resetSafety: structuredClone(benchPrototypeEsp32Allocation.resetSafety)
  },
  connector: {
    headerMpn: benchPrototypeHub75Connector.boardConnector.mpn,
    headerPins: structuredClone(benchPrototypeHub75Connector.boardConnector.pinLabels),
    signalMap: structuredClone(benchPrototypeHub75Connector.signalPath.map),
    supply: benchPrototypeHub75Connector.powerPath.supplyNet,
    powerReturn: benchPrototypeHub75Connector.powerPath.returnNet
  },
  reset: { appResetNet: "APP_RESET_N" }
})

function currentUpstreamProvenance() {
  return {
    esp32: {
      moduleMpn: benchPrototypeEsp32Allocation.moduleMpn,
      hub75Pads: structuredClone(benchPrototypeEsp32Allocation.pads.filter((pad) => pad.group === "hub75")),
      resetSafety: structuredClone(benchPrototypeEsp32Allocation.resetSafety)
    },
    connector: {
      headerMpn: benchPrototypeHub75Connector.boardConnector.mpn,
      headerPins: structuredClone(benchPrototypeHub75Connector.boardConnector.pinLabels),
      signalMap: structuredClone(benchPrototypeHub75Connector.signalPath.map),
      supply: benchPrototypeHub75Connector.powerPath.supplyNet,
      powerReturn: benchPrototypeHub75Connector.powerPath.returnNet
    },
    reset: { appResetNet: benchPrototypeResetWatchdog.resetTopology.application.commonResetNet }
  }
}

const definition = {
  artifactKind: "bench-prototype-hub75-reset-safing-contract",
  workUnit: "BP-144",
  targetAssembly: "one-board bench prototype",
  releaseState: "deny",
  upstream: { esp32: "BP-121", connector: "BP-143", reset: "BP-123" },
  partIdentityEvidence,
  buffers: [
    {
      reference: "U_DISPLAY_BUFFER_A",
      mpn: "SN74AHCT245PWR",
      package: "TSSOP-20",
      supply: "V5_DISPLAY_LIMITED",
      ground: "APP_GND",
      direction: "DIR pin 1 hard-tied to V5_DISPLAY_LIMITED, A-to-B only",
      outputEnable: "pin 19 BUFFER_ENABLE_N; high is high impedance, low enables outputs"
    },
    {
      reference: "U_DISPLAY_BUFFER_B",
      mpn: "SN74AHCT245PWR",
      package: "TSSOP-20",
      supply: "V5_DISPLAY_LIMITED",
      ground: "APP_GND",
      direction: "DIR pin 1 hard-tied to V5_DISPLAY_LIMITED, A-to-B only",
      outputEnable: "pin 19 BUFFER_ENABLE_N; high is high impedance, low enables outputs"
    }
  ],
  signalMap: hub75Signals.map(([signal, gpio, buffer, input, output, panelPin, panelPinNumber]) => ({
    signal,
    gpio,
    buffer,
    input,
    output,
    bufferInputPin: ahctPins[input],
    bufferOutputPin: ahctPins[output],
    panelPin,
    panelPinNumber,
    inputPull: "R_HUB75_SIGNAL_DEFAULTS",
    resetDefault: signal === "HUB75_OE_N" ? "high panel blank request" : "low black-data/address/clock/latch"
  })),
  unusedBufferInputs: unusedBufferBInputs.map(([input, output, inputPin, outputPin]) => ({
    buffer: "U_DISPLAY_BUFFER_B",
    input,
    inputPin,
    output,
    outputPin,
    pull: { reference: "R_HUB75_SIGNAL_DEFAULTS", mpn: resistor10k, value: "10 kOhm, 1%", to: "APP_GND" },
    outputDisposition: "NC; no connector, test point, or functional net"
  })),
  supportNetwork: {
    signalDefaults: {
      reference: "R_HUB75_SIGNAL_DEFAULTS",
      mpn: resistor10k,
      value: "10 kOhm, 1%",
      quantity: 16,
      dataAddressClockLatch: "twelve non-OE ESP32 inputs pulled to APP_GND",
      oeInput: "HUB75_OE_N input pulled to V3_3"
    },
    panelOe: {
      reference: "R_HUB75_PANEL_OE_PULLUP",
      mpn: resistor10k,
      value: "10 kOhm, 1%",
      topology: "J_HUB75 pin 15 OE is pulled to V5_DISPLAY_LIMITED and is blank when the buffer is disabled"
    },
    bufferBypass: {
      reference: "C_HUB75_BUFFER_BYPASS",
      mpn: "C0603C104K3RACTU",
      value: "100 nF X7R",
      quantity: 2,
      topology: "one capacitor from each SN74AHCT245PWR pin 20 to APP_GND at the buffer"
    },
    displayEnableGate: {
      net: "DISPLAY_ENABLE_N",
      sink: {
        reference: "Q_DISPLAY_ENABLE",
        mpn: "BSS138AKA",
        topology: "source APP_GND, drain common DISPLAY_ENABLE_N, gate driven only by APP_RESET_N"
      },
      pullup: {
        reference: "R_DISPLAY_ENABLE_PULLUP_AND_GATE",
        role: "common DISPLAY_ENABLE_N pullup",
        mpn: resistor10k,
        value: "10 kOhm, 1%",
        to: "V5_DISPLAY_LIMITED"
      },
      gateSeries: {
        reference: "R_DISPLAY_ENABLE_PULLUP_AND_GATE",
        role: "APP_RESET_N-to-gate series resistor",
        mpn: resistor10k,
        value: "10 kOhm, 1%",
        from: "APP_RESET_N"
      },
      gatePulldown: {
        reference: "R_DISPLAY_ENABLE_GATE_PD",
        mpn: resistor100k,
        value: "100 kOhm, 1%",
        to: "APP_GND"
      }
    }
  },
  exactConnections: [
    "Each ESP32 HUB75 GPIO connects only to its named AHCT A input and the shared R_HUB75_SIGNAL_DEFAULTS pull network.",
    "Each AHCT B output connects only to its named J_HUB75 signal pin. J_HUB75 pins 4, 8, and 16 are APP_GND logic reference only.",
    "Both AHCT DIR pins are hard-wired A-to-B. Both pin 19 BUFFER_ENABLE_N inputs are tied to one DISPLAY_ENABLE_N net.",
    "DISPLAY_ENABLE_N has one V5_DISPLAY_LIMITED pullup and one BSS138AKA low-side sink. APP_RESET_N reaches its gate through one series resistor with one APP_GND pulldown.",
    "BP-144 consumes APP_RESET_N only. It must not sink, source, fan out, rename, or otherwise alter APP_SUPERVISOR_RESET_N, SCORING_NRST_N, or ESP32 firmware reset/enable state.",
    "The display enable gate has no ESP32 GPIO, firmware-controlled enable, watchdog feedback, panel feedback, or reset-source authority."
  ],
  truthTable: [
    {
      condition: "APP_RESET_N low, ESP32 reset or absent",
      inputs: "twelve low, OE input high",
      buffers: "both disabled high impedance",
      panelOe: "high by V5 pullup",
      result: "black/blank command and high-Z outputs"
    },
    {
      condition: "APP_RESET_N high, V3_3 and V5 valid",
      inputs: "ESP32 drives allocated GPIOs after firmware configuration",
      buffers: "both enabled A-to-B",
      panelOe: "ESP32 controls OE through U_DISPLAY_BUFFER_B",
      result: "normal display operation is permitted only after bench evidence"
    },
    {
      condition: "V3_3 absent, V5 present",
      inputs: "signal pulls and APP_RESET_N hold the gate safe",
      buffers: "intended disabled high impedance",
      panelOe: "intended high/blank",
      result: "DENY until no backfeed and logic thresholds are measured"
    },
    {
      condition: "V5 absent, V3_3 present",
      inputs: "ESP32 may be powered",
      buffers: "unpowered outputs not credited",
      panelOe: "unpowered panel path",
      result: "DENY until V5 injection and leakage are measured"
    },
    {
      condition: "panel cable disconnected or panel unpowered",
      inputs: "local reset pulls remain active",
      buffers: "no panel-state credit",
      panelOe: "not observable at panel",
      result: "no scoring impact; display evidence remains unavailable"
    }
  ],
  powerOffAndBackfeed: {
    status: "unvalidated-deny",
    prohibited: [
      "V5_DISPLAY_LIMITED must not back-power V3_3 through AHCT inputs, ESP32 GPIO protection structures, APP_RESET_N, or the BSS138 gate path.",
      "V3_3/ESP32 GPIOs must not energize an unpowered panel V5 rail through AHCT outputs or panel input protection.",
      "A panel signal must not pull APP_RESET_N high or low, reset the ESP32, or create a reset source."
    ],
    requiredMeasurements: [
      "V3_3 absent/V5 present: all ESP32 pins, APP_RESET_N, DISPLAY_ENABLE_N, panel OE, V3_3 current, and V5 current.",
      "V5 absent/V3_3 present: all AHCT inputs/outputs, panel pins, V5 rail, V3_3 current, and injected current.",
      "Cold start, reset, brownout, cable insertion/removal while de-energized, and display-branch disconnect tests with scope captures."
    ]
  },
  evidence: {
    schematicIntegrated: false,
    resetBlankingBenchVerified: false,
    panelPowerOffBackfeedVerified: false,
    inputThresholdsVerified: false,
    outputTimingAndSignalIntegrityVerified: false,
    footprintApproved: false,
    layoutApproved: false,
    fabricationAuthorized: false
  },
  sources: [
    "TI SN74AHCT245 data sheet",
    "BP-121 ESP32 module allocation",
    "BP-123 APP_RESET_N contract",
    "BP-143 HUB75 connector contract"
  ],
  openGates: [
    "BP-300 schematic/ERC must integrate this exact map without unexplained errors.",
    "BP-032/BP-033 must independently approve all buffer, FET, resistor, and connector footprints and orientation.",
    "Bench-test reset, brownout, V3_3-off/V5-on, V5-off/V3_3-on, panel disconnected, and cable insertion states before display enable.",
    "Measure AHCT input thresholds at V5, output edge quality, ringing, panel blanking, and display-branch current/inrush."
  ]
} as const

export const benchPrototypeHub75Safing = deepFreeze(definition)
export const benchPrototypeHub75SafingUpstreamProvenance = upstreamProvenance

function validateSupportIdentity(): void {
  if (benchPrototypeHub75Safing.partIdentityEvidence.length !== supportIdentityReferences.length) {
    throw new RangeError("BP-144 support identity must match the eight active BOM rows")
  }
  for (const [reference, quantity] of supportIdentityReferences) {
    const expected = supportIdentity(reference, quantity)
    const actual = benchPrototypeHub75Safing.partIdentityEvidence.find((part) => part.reference === reference)
    if (actual === undefined || !sameDataGraph(actual, expected)) {
      throw new RangeError(`BP-144 support identity drifted for ${reference}`)
    }
  }
}

export function validateBenchPrototypeHub75Safing(value: unknown): true {
  validateBenchPrototypeEsp32Allocation(benchPrototypeEsp32Allocation)
  validateBenchPrototypeHub75Connector(benchPrototypeHub75Connector)
  validateBenchPrototypeBom(benchPrototypeBom)
  validateBenchPrototypeResetWatchdog(benchPrototypeResetWatchdog)
  validatePhysicalBoardContract()
  if (!sameDataGraph(value, benchPrototypeHub75Safing)) {
    throw new RangeError("BP-144 contract must exactly match the reviewed canonical decision")
  }
  if (!sameDataGraph(currentUpstreamProvenance(), benchPrototypeHub75SafingUpstreamProvenance)) {
    throw new RangeError("BP-144 ESP32, connector, or APP_RESET_N provenance drifted")
  }
  const contract = benchPrototypeHub75Safing
  const upstreamMap = benchPrototypeHub75Connector.signalPath.map
  if (
    contract.signalMap.length !== 13 ||
    new Set(contract.signalMap.map((entry) => entry.gpio)).size !== 13 ||
    contract.signalMap.some((entry) => {
      const upstream = upstreamMap.find((candidate) => candidate.esp32Signal === entry.signal)
      return (
        upstream === undefined ||
        upstream.esp32Gpio !== entry.gpio ||
        upstream.panelPin !== entry.panelPin ||
        upstream.panelPinNumber !== entry.panelPinNumber ||
        entry.bufferInputPin !== ahctPins[entry.input] ||
        entry.bufferOutputPin !== ahctPins[entry.output]
      )
    }) ||
    contract.buffers.some(
      (buffer) =>
        buffer.mpn !== "SN74AHCT245PWR" ||
        buffer.direction !== "DIR pin 1 hard-tied to V5_DISPLAY_LIMITED, A-to-B only" ||
        buffer.outputEnable !== "pin 19 BUFFER_ENABLE_N; high is high impedance, low enables outputs"
    ) ||
    contract.supportNetwork.signalDefaults.quantity !== 16 ||
    contract.supportNetwork.bufferBypass.quantity !== 2 ||
    contract.supportNetwork.displayEnableGate.net !== "DISPLAY_ENABLE_N" ||
    contract.supportNetwork.displayEnableGate.sink.mpn !== "BSS138AKA" ||
    contract.supportNetwork.displayEnableGate.pullup.mpn !== resistor10k ||
    contract.supportNetwork.displayEnableGate.gateSeries.mpn !== resistor10k ||
    contract.supportNetwork.displayEnableGate.gatePulldown.mpn !== resistor100k ||
    contract.supportNetwork.displayEnableGate.pullup.reference !== "R_DISPLAY_ENABLE_PULLUP_AND_GATE" ||
    contract.supportNetwork.displayEnableGate.gateSeries.reference !== "R_DISPLAY_ENABLE_PULLUP_AND_GATE" ||
    contract.supportNetwork.displayEnableGate.gatePulldown.reference !== "R_DISPLAY_ENABLE_GATE_PD" ||
    contract.unusedBufferInputs.length !== 3 ||
    contract.unusedBufferInputs.some(
      (input) =>
        input.buffer !== "U_DISPLAY_BUFFER_B" ||
        !["A6", "A7", "A8"].includes(input.input) ||
        input.pull.mpn !== resistor10k ||
        input.pull.to !== "APP_GND" ||
        input.outputDisposition !== "NC; no connector, test point, or functional net"
    ) ||
    contract.exactConnections.some((connection) => connection.includes("EN_RESET")) ||
    !contract.exactConnections.some((connection) => connection.includes("firmware-controlled enable")) ||
    contract.partIdentityEvidence.length !== 8 ||
    contract.evidence.fabricationAuthorized ||
    contract.releaseState !== "deny"
  ) {
    throw new RangeError("BP-144 must preserve the simplified shared APP_RESET_N display gate and denied release")
  }
  validateSupportIdentity()
  return true
}
