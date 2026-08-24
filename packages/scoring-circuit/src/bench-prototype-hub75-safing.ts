/** BP-144: reset-safe two-buffer HUB75 electrical contract. */

import {
  applicationDisplayHub75SupportParts,
  applicationDisplayHub75SupportPart
} from "./application-display-carrier-support.js"
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
import { applicationDisplayOwnedReferences, validatePhysicalBoardContract } from "./physical-board-contract.js"

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
  reset: {
    appResetNet: benchPrototypeResetWatchdog.resetTopology.application.resetNet,
    resetSinks: structuredClone(benchPrototypeResetWatchdog.resetTopology.application.sinks),
    deniedEvidence: structuredClone(benchPrototypeResetWatchdog.deniedEvidence)
  }
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
    reset: {
      appResetNet: benchPrototypeResetWatchdog.resetTopology.application.resetNet,
      resetSinks: structuredClone(benchPrototypeResetWatchdog.resetTopology.application.sinks),
      deniedEvidence: structuredClone(benchPrototypeResetWatchdog.deniedEvidence)
    }
  }
}

const resistor10k = "RC0603FR-0710KL"
const resistor100k = "RC0603FR-07100KL"

function uniqueBom(reference: string) {
  const matches = benchPrototypeBom.rows.filter((row) => row.reference === reference)
  return matches.length === 1
    ? { disposition: matches[0]!.disposition, mpn: matches[0]!.mpn ?? "__MISSING__", reference: matches[0]!.reference }
    : { disposition: "__MISSING_OR_DUPLICATE__", mpn: "__MISSING_OR_DUPLICATE__", reference }
}

function validateSupportIdentity(): void {
  const expectedReferences = applicationDisplayHub75SupportParts.map((part) => part.reference)
  if (new Set(expectedReferences).size !== expectedReferences.length) {
    throw new RangeError("BP-144 selected-component identity has duplicate expected references")
  }
  if (expectedReferences.length !== 29) {
    throw new RangeError("BP-144 carrier support inventory must contain exactly twenty-nine rows")
  }
  for (const actual of applicationDisplayHub75SupportParts) {
    const ownedMatches = applicationDisplayOwnedReferences.filter((reference) => reference === actual.reference)
    if (ownedMatches.length !== 1) {
      throw new RangeError("BP-144 selected-component reference is missing, duplicated, or pre-import drifted")
    }
    if (
      actual.mpn.includes("MISSING") ||
      actual.value.includes("MISSING") ||
      actual.package.includes("MISSING") ||
      actual.manufacturer.includes("MISSING") ||
      actual.source.includes("MISSING") ||
      !actual.sourceUrl.startsWith("https://") ||
      applicationDisplayHub75SupportPart(actual.reference) !== actual
    ) {
      throw new RangeError(
        "BP-144 live carrier support identity is missing, duplicated, sentinel, or pre-import drifted"
      )
    }
    const exactIdentity = actual.reference.startsWith("U_DISPLAY_BUFFER")
      ? {
          mpn: "SN74AHCT245PWR",
          value: "octal bus transceiver with 3-state outputs",
          package: "TSSOP-20",
          manufacturer: "Texas Instruments",
          sourceUrl: "https://www.ti.com/lit/ds/symlink/sn74ahct245.pdf"
        }
      : actual.reference.startsWith("C_HUB75")
        ? {
            mpn: "C0603C104K3RACTU",
            value: "100 nF X7R",
            package: "0603",
            manufacturer: "KEMET",
            sourceUrl: "https://search.kemet.com/download/specsheet/C0603C104K3RACTU"
          }
        : actual.reference.startsWith("Q_DISPLAY_BUFFER")
          ? {
              mpn: "BSS138AKA",
              value: "60 V, single N-channel Trench MOSFET",
              package: "SOT-23",
              manufacturer: "Nexperia",
              sourceUrl: "https://assets.nexperia.com/documents/data-sheet/BSS138AKA.pdf"
            }
          : actual.reference.endsWith("GATE_PD")
            ? {
                mpn: resistor100k,
                value: "100 kOhm, 1%",
                package: "0603",
                manufacturer: "Yageo",
                sourceUrl: "https://www.yageogroup.com/component-documentation/download/specsheet/RC0603FR-07100KL"
              }
            : {
                mpn: resistor10k,
                value: "10 kOhm, 1%",
                package: "0603",
                manufacturer: "Yageo",
                sourceUrl: "https://www.yageogroup.com/component-documentation/download/specsheet/RC0603FR-0710KL"
              }
    if (
      actual.mpn !== exactIdentity.mpn ||
      actual.value !== exactIdentity.value ||
      actual.package !== exactIdentity.package ||
      actual.manufacturer !== exactIdentity.manufacturer ||
      actual.sourceUrl !== exactIdentity.sourceUrl
    ) {
      throw new RangeError("BP-144 live carrier support identity differs from the reviewed exact selection")
    }
  }
  const expectedBuffers = ["U_DISPLAY_BUFFER_A", "U_DISPLAY_BUFFER_B"]
  if (
    expectedBuffers.some((reference) => {
      const carrier = applicationDisplayHub75SupportPart(reference)
      const bom = uniqueBom(reference)
      return (
        carrier.mpn !== "SN74AHCT245PWR" ||
        carrier.package !== "TSSOP-20" ||
        bom.reference !== reference ||
        bom.disposition !== "selected" ||
        bom.mpn !== carrier.mpn
      )
    })
  ) {
    throw new RangeError("BP-144 selected buffer identity drifted from the live carrier inventory or BP-020")
  }
}

const definition = {
  artifactKind: "bench-prototype-hub75-reset-safing-contract",
  workUnit: "BP-144",
  targetAssembly: "one-board bench prototype",
  releaseState: "deny",
  upstream: { esp32: "BP-121", connector: "BP-143", reset: "BP-123" },
  partIdentityEvidence: applicationDisplayHub75SupportParts,
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
    inputPull: signal === "HUB75_OE_N" ? "R_HUB75_OE_PULLUP" : `R_${signal}_PD`,
    resetDefault: signal === "HUB75_OE_N" ? "high panel blank request" : "low black-data/address/clock/latch"
  })),
  unusedBufferInputs: unusedBufferBInputs.map(([input, output, inputPin, outputPin]) => ({
    buffer: "U_DISPLAY_BUFFER_B",
    input,
    inputPin,
    output,
    outputPin,
    pull: { reference: `R_HUB75_UNUSED_B_${input}_PD`, mpn: resistor10k, value: "10 kOhm, 1%", to: "APP_GND" },
    outputDisposition: "NC; no connector, test point, or functional net"
  })),
  supportNetwork: {
    bufferBypass: ["A", "B"].map((bank) => ({
      reference: `C_HUB75_BUF_${bank}_BYPASS`,
      mpn: "C0603C104K3RACTU",
      value: "100 nF X7R",
      topology: `U_DISPLAY_BUFFER_${bank} VCC pin 20 to APP_GND at the buffer`
    })),
    inputPulls: {
      mpn: resistor10k,
      value: "10 kOhm, 1%",
      dataAddressClockLatch: "R_HUB75_R1_PD through R_HUB75_LAT_PD pull the twelve non-OE inputs to APP_GND",
      oeInput: "R_HUB75_OE_PULLUP pulls U_DISPLAY_BUFFER_B.A5 to V3_3"
    },
    panelOe: {
      reference: "R_HUB75_PANEL_OE_PULLUP",
      mpn: resistor10k,
      value: "10 kOhm, 1%",
      topology: "J_HUB75 pin 15 OE to V5_DISPLAY_LIMITED; a disabled B buffer therefore leaves the panel blanked."
    },
    enableGates: ["A", "B"].map((bank) => ({
      buffer: `U_DISPLAY_BUFFER_${bank}`,
      enablePullup: {
        reference: `R_BUFFER_${bank}_ENABLE_PULLUP`,
        mpn: resistor10k,
        value: "10 kOhm, 1%",
        to: "V5_DISPLAY_LIMITED"
      },
      gateSeries: { reference: `R_BUFFER_${bank}_GATE`, mpn: resistor10k, value: "10 kOhm, 1%", from: "EN_RESET" },
      gatePulldown: { reference: `R_BUFFER_${bank}_GATE_PD`, mpn: resistor100k, value: "100 kOhm, 1%", to: "APP_GND" },
      sink: {
        reference: `Q_DISPLAY_BUFFER_${bank}_ENABLE`,
        mpn: "BSS138AKA",
        topology: "source APP_GND, drain BUFFER_ENABLE_N, gate after R_BUFFER gate-series"
      }
    }))
  },
  exactConnections: [
    "Each ESP32 HUB75 GPIO connects only to its named AHCT A input and named 10 kOhm reset pull.",
    "Each AHCT B output connects only to the named J_HUB75 signal pin. J_HUB75 pins 4, 8, and 16 are APP_GND logic reference only.",
    "Both AHCT DIR pins are V5_DISPLAY_LIMITED. Neither direction control nor either buffer enable accepts a firmware GPIO.",
    "Each BUFFER_ENABLE_N has a V5_DISPLAY_LIMITED pullup and only its BSS138AKA low-side sink; EN_RESET reaches each sink gate through its own 10 kOhm series resistor with a 100 kOhm APP_GND pulldown.",
    "BP-144 consumes EN_RESET only. It must not sink, source, fan out, rename, or otherwise alter EN_RESET, APP_SUPERVISOR_RESET_N, or SCORING_NRST_N."
  ],
  truthTable: [
    {
      condition: "EN_RESET low, ESP32 reset/absent",
      inputs: "twelve low, OE input high",
      buffers: "both disabled high impedance",
      panelOe: "high by V5 pullup",
      result: "black/blank command and high-Z outputs"
    },
    {
      condition: "EN_RESET high, V3_3 and V5 valid",
      inputs: "ESP32 drives allocated GPIOs after firmware configuration",
      buffers: "both enabled A-to-B",
      panelOe: "ESP32 controls OE through U_DISPLAY_BUFFER_B",
      result: "normal display operation is permitted only after bench evidence"
    },
    {
      condition: "V3_3 absent, V5 present",
      inputs: "pulls and EN gate hold safe state",
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
      "V5_DISPLAY_LIMITED must not back-power V3_3 through AHCT inputs, ESP32 GPIO protection structures, EN_RESET, or the BSS138 gate path.",
      "V3_3/ESP32 GPIOs must not energize an unpowered panel V5 rail through AHCT outputs or panel input protection.",
      "A panel signal must not pull EN_RESET high or low, reset the ESP32, or create a reset source."
    ],
    requiredMeasurements: [
      "V3_3 absent/V5 present: all ESP32 pins, EN_RESET, both BUFFER_ENABLE_N nodes, panel OE, V3_3 current, and V5 current.",
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
    "BP-123 reset/watchdog contract",
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

export function validateBenchPrototypeHub75Safing(value: unknown): true {
  validateBenchPrototypeEsp32Allocation(benchPrototypeEsp32Allocation)
  validateBenchPrototypeHub75Connector(benchPrototypeHub75Connector)
  validateBenchPrototypeBom(benchPrototypeBom)
  validateBenchPrototypeResetWatchdog(benchPrototypeResetWatchdog)
  validatePhysicalBoardContract()
  if (!sameDataGraph(value, benchPrototypeHub75Safing))
    throw new RangeError("BP-144 contract must exactly match the reviewed canonical decision")
  if (!sameDataGraph(currentUpstreamProvenance(), benchPrototypeHub75SafingUpstreamProvenance))
    throw new RangeError("BP-144 ESP32, connector, or reset provenance drifted")
  validateSupportIdentity()
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
        buffer.mpn !== "SN74AHCT245PWR" || buffer.direction !== "DIR pin 1 hard-tied to V5_DISPLAY_LIMITED, A-to-B only"
    ) ||
    contract.supportNetwork.enableGates.length !== 2 ||
    contract.supportNetwork.enableGates.some(
      (gate) =>
        gate.sink.mpn !== "BSS138AKA" || gate.enablePullup.mpn !== resistor10k || gate.gatePulldown.mpn !== resistor100k
    ) ||
    contract.supportNetwork.bufferBypass.length !== 2 ||
    contract.supportNetwork.bufferBypass.some(
      (capacitor) => capacitor.mpn !== "C0603C104K3RACTU" || capacitor.value !== "100 nF X7R"
    ) ||
    contract.unusedBufferInputs.length !== 3 ||
    contract.unusedBufferInputs.some(
      (input) =>
        input.buffer !== "U_DISPLAY_BUFFER_B" ||
        !["A6", "A7", "A8"].includes(input.input) ||
        input.pull.mpn !== resistor10k ||
        input.pull.to !== "APP_GND" ||
        input.outputDisposition !== "NC; no connector, test point, or functional net"
    ) ||
    contract.signalMap.some(
      (entry) =>
        entry.inputPull !== (entry.signal === "HUB75_OE_N" ? "R_HUB75_OE_PULLUP" : `R_${entry.signal}_PD`) ||
        (entry.signal === "HUB75_OE_N" && entry.resetDefault !== "high panel blank request") ||
        (entry.signal !== "HUB75_OE_N" && entry.resetDefault !== "low black-data/address/clock/latch")
    ) ||
    contract.supportNetwork.panelOe.reference !== "R_HUB75_PANEL_OE_PULLUP" ||
    contract.partIdentityEvidence.length !== 29 ||
    contract.partIdentityEvidence.some(
      (part) =>
        !part.reference ||
        !part.mpn ||
        !part.value ||
        !part.package ||
        !part.manufacturer ||
        !part.source ||
        !part.sourceUrl.startsWith("https://")
    ) ||
    contract.evidence.fabricationAuthorized ||
    contract.releaseState !== "deny"
  ) {
    throw new RangeError("BP-144 must preserve 13 exact paths, reset-gated high-Z buffers, and denied release")
  }
  return true
}
