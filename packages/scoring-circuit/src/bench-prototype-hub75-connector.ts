import { benchPrototypeBom, validateBenchPrototypeBom } from "./bench-prototype-bom.js"
import {
  benchPrototypeEsp32Allocation,
  validateBenchPrototypeEsp32Allocation
} from "./bench-prototype-esp32-allocation.js"
import { calculateBenchPrototypePowerContract, defaultBenchPrototypePowerInputs } from "./bench-prototype-power.js"
import { canonicalHub75HeaderPins } from "./display-panel-readiness.js"

/**
 * BP-143 freezes the panel-side connector and harness interface without
 * pretending that a panel, cable, or continuity record is physically present.
 * It is a schematic and bench-plan input only; fabrication remains denied.
 */

const expectedHub75Signals = [
  "HUB75_R1",
  "HUB75_G1",
  "HUB75_B1",
  "HUB75_R2",
  "HUB75_G2",
  "HUB75_B2",
  "HUB75_A",
  "HUB75_B",
  "HUB75_C",
  "HUB75_D",
  "HUB75_CLK",
  "HUB75_LAT",
  "HUB75_OE_N"
] as const

const signalMap = [
  { esp32Gpio: 13, esp32Signal: "HUB75_R1", panelPin: "R1", panelPinNumber: 1 },
  { esp32Gpio: 14, esp32Signal: "HUB75_G1", panelPin: "G1", panelPinNumber: 2 },
  { esp32Gpio: 21, esp32Signal: "HUB75_B1", panelPin: "B1", panelPinNumber: 3 },
  { esp32Gpio: 16, esp32Signal: "HUB75_R2", panelPin: "R2", panelPinNumber: 5 },
  { esp32Gpio: 38, esp32Signal: "HUB75_G2", panelPin: "G2", panelPinNumber: 6 },
  { esp32Gpio: 39, esp32Signal: "HUB75_B2", panelPin: "B2", panelPinNumber: 7 },
  { esp32Gpio: 40, esp32Signal: "HUB75_A", panelPin: "A", panelPinNumber: 9 },
  { esp32Gpio: 41, esp32Signal: "HUB75_B", panelPin: "B", panelPinNumber: 10 },
  { esp32Gpio: 42, esp32Signal: "HUB75_C", panelPin: "C", panelPinNumber: 11 },
  { esp32Gpio: 45, esp32Signal: "HUB75_D", panelPin: "D", panelPinNumber: 12 },
  { esp32Gpio: 46, esp32Signal: "HUB75_CLK", panelPin: "CLK", panelPinNumber: 13 },
  { esp32Gpio: 48, esp32Signal: "HUB75_LAT", panelPin: "LAT", panelPinNumber: 14 },
  { esp32Gpio: 1, esp32Signal: "HUB75_OE_N", panelPin: "OE", panelPinNumber: 15 }
] as const

const signalCablePinMap = canonicalHub75HeaderPins.map((panelPin, index) => ({
  cablePin: index + 1,
  panelInputPin: panelPin,
  panelInputPinNumber: index + 1,
  continuityRequired: true
}))

const powerCablePinMap = [
  { cablePin: 1, conductorColor: "red", net: "V5_DISPLAY_LIMITED", purpose: "panel V5" },
  { cablePin: 2, conductorColor: "red", net: "V5_DISPLAY_LIMITED", purpose: "panel V5" },
  { cablePin: 3, conductorColor: "black", net: "APP_GND", purpose: "panel power return" },
  { cablePin: 4, conductorColor: "black", net: "APP_GND", purpose: "panel power return" }
] as const

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (typeof value !== "object" || value === null || seen.has(value)) return value
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor !== undefined && "value" in descriptor) deepFreeze(descriptor.value, seen)
  }
  return Object.freeze(value)
}

const definition = {
  artifactKind: "bench-prototype-hub75-connector-contract",
  task: "BP-143",
  targetAssembly: "one-board bench prototype",
  prototypeOnly: true,
  schematicInputOnly: true,
  layoutRelease: false,
  fabricationRelease: false,
  fabricationDisposition: "DENY",
  releaseState: "deny",
  boardConnector: {
    reference: "J_HUB75",
    manufacturer: "Samtec",
    mpn: "TST-108-04-G-D-RA",
    family: "TST shrouded IDC header",
    positions: 16,
    rows: 2,
    pitchMm: 2.54,
    orientation: "right-angle",
    mounting: "through-hole",
    shrouding: "four-wall, polarized keying slot",
    contactCurrentRatingA: 3.4,
    contactCurrentRatingBasis: "distributor listing per contact; no panel-power current is assigned to this header",
    pinLabels: [...canonicalHub75HeaderPins],
    signalReturnRule:
      "GND1, GND2, and GND3 are logic-reference returns only; panel current returns on the separate power cable",
    sourceUrls: [
      "https://www.samtec.com/products/tst-108-04-g-d-ra",
      "https://www.digikey.com/en/products/detail/samtec-inc/TST-108-04-G-D-RA/2685833"
    ]
  },
  signalCable: {
    manufacturer: "Adafruit Industries",
    productId: "4170",
    productName: "GPIO Ribbon Cable 2x8 IDC Cable - 16 pins 12 inches long",
    quantity: 1,
    lengthIn: 12,
    conductorCount: 16,
    ribbonPitchIn: 0.05,
    connectorPitchIn: 0.1,
    connectorDescription: "keyed IDC socket on each end, 2x8 contacts",
    pinOneMarker: "white stripe",
    panelConnection: "panel HUB75 INPUT only; panel OUTPUT remains unconnected",
    signalCurrentRatingA: null,
    signalCurrentRatingStatus: "not published; signal-only use is required",
    pinMap: signalCablePinMap,
    sourceUrl: "https://www.adafruit.com/product/4170"
  },
  powerCable: {
    manufacturer: "Adafruit Industries",
    productId: "4767",
    productName: "Replacement 5V Power Cable for RGB LED Matrices",
    quantity: 1,
    cableLengthMm: 500,
    connectorCount: 2,
    conductorsPerConnector: 4,
    connectorFamily: "JST SM",
    pitchMm: 2.5,
    panelSideHousingMpn: "SMR-04V-N",
    panelSideContactMpn: "SYM-001T-P0.6",
    cableSideHousingMpn: "SMP-04V-NC",
    cableSideContactMpn: "SHF-001T-0.8BS",
    contactCurrentRatingA: 3,
    contactCurrentRatingBasis: "JST SM series maximum rating at the connector contact",
    wireGaugeAwg: null,
    wireGaugeStatus: "not published by Adafruit; verify the received cable before assigning a wire ampacity",
    pinMap: powerCablePinMap,
    parallelPowerContactsPerConnector: 2,
    minimumConnectedPowerBranches: 2,
    projectCurrentScreenA: 4,
    panelSupplyVoltageV: 5,
    panelPublishedMaximumCurrentA: 4,
    sourceUrls: [
      "https://www.adafruit.com/product/4767",
      "https://www.jst.com/products/wire-to-wire-connectors/sm-connector/",
      "https://www.jst.com/wp-content/uploads/2025/06/eSM.pdf"
    ]
  },
  panel: {
    manufacturer: "Adafruit Industries",
    productId: "2277",
    productName: "64x32 RGB LED Matrix - 5mm pitch",
    interface: "HUB75, 64x32, 1/16 scan",
    inputHeader: "one keyed 16-position IDC connector",
    inputSignals: expectedHub75Signals,
    separatePowerRequired: true,
    supplyVoltageV: 5,
    publishedMaximumCurrentA: 4,
    sourceUrl: "https://www.adafruit.com/product/2277"
  },
  powerPath: {
    supplyNet: "V5_DISPLAY_LIMITED",
    returnNet: "APP_GND",
    sequence: [
      "V5_DISPLAY_LIMITED",
      "J_DISPLAY_DISCONNECT",
      "J_LINK_DISPLAY",
      "J_DISPLAY_POWER_PIGTAIL",
      "Adafruit_4767_power_cable",
      "DISPLAY_PANEL_2277_V5"
    ],
    displayDisconnectReference: "J_DISPLAY_DISCONNECT",
    measurementLinkReference: "J_LINK_DISPLAY",
    measurementLinkContactProjectScreenA: 6,
    removeOnlyWhileDeenergized: true,
    signalGroundsDoNotCarryPanelCurrent: true
  },
  signalPath: {
    sourceModule: "ESP32-S3-WROOM-1U-N16R2",
    levelTranslators: ["U_DISPLAY_BUFFER_A", "U_DISPLAY_BUFFER_B"],
    destinationConnector: "J_HUB75",
    destinationPanel: "DISPLAY_PANEL_2277_HUB75_INPUT",
    map: signalMap
  },
  evidence: {
    purchasedPanel: {
      status: "open",
      physicalPresenceVerified: false,
      receiptOrSerialRecord: null,
      revisionRecord: null,
      statement: "No panel purchase, serial, PCB revision, or included-cable identity is claimed by this contract."
    },
    signalContinuity: {
      status: "open",
      measured: false,
      archiveRecord: null,
      requiredRecord:
        "De-energized point-to-point continuity for all 16 board-to-panel INPUT pins, including three signal grounds."
    },
    powerContinuity: {
      status: "open",
      measured: false,
      archiveRecord: null,
      requiredRecord:
        "De-energized point-to-point continuity and polarity for both four-conductor power branches; every red and black conductor must be present."
    },
    matingAndOrientation: {
      status: "open",
      measured: false,
      archiveRecord: null,
      requiredRecord:
        "Photograph the panel INPUT key, board header key, cable stripe, power latch, and strain relief while mated."
    },
    currentAndTemperature: {
      status: "open",
      measured: false,
      archiveRecord: null,
      requiredRecord:
        "Measure panel-end voltage, branch current sharing, cable drop, and both power-connector temperatures at the declared display load."
    }
  },
  authority: {
    exactSelectionFrozen: true,
    schematicIntegrationApproved: false,
    footprintApproved: false,
    layoutApproved: false,
    purchasedPanelVerified: false,
    continuityVerified: false,
    currentRatingVerified: false,
    fabricationAuthorized: false,
    releaseState: "deny"
  },
  openGates: [
    "Keep BP-020 J_HUB75 as TBD until BP-033 imports this exact selection with manufacturer footprint and orientation evidence.",
    "Acquire the Samtec TST-108-04-G-D-RA sample and verify the Adafruit 4170 socket key, pin-1 stripe, and mating insertion depth.",
    "Purchase an exact Adafruit 2277 sample and record the PCB revision, panel INPUT connector housing, power connector housing, and included cable identities.",
    "Continuity-test every signal pin and all three signal-reference grounds from J_HUB75 to the panel INPUT before energizing.",
    "Continuity-test both Adafruit 4767 power branches, confirm pin polarity, and reject any missing, swapped, or unequal-length conductor.",
    "Keep J_DISPLAY_DISCONNECT open and J_LINK_DISPLAY removable until panel startup/inrush, current sharing, panel-end voltage, cable drop, and connector temperature are measured.",
    "Complete BP-144 reset-safe blanking and BP-034 connector sample, fit, harness, strain-relief, and continuity review."
  ],
  sources: [
    { title: "Adafruit 2277 panel", url: "https://www.adafruit.com/product/2277" },
    { title: "Adafruit 4170 signal cable", url: "https://www.adafruit.com/product/4170" },
    { title: "Adafruit 4767 panel power cable", url: "https://www.adafruit.com/product/4767" },
    { title: "Samtec TST-108-04-G-D-RA", url: "https://www.samtec.com/products/tst-108-04-g-d-ra" },
    { title: "JST SM connector", url: "https://www.jst.com/products/wire-to-wire-connectors/sm-connector/" }
  ]
} as const

export const benchPrototypeHub75Connector = deepFreeze(definition)

function assertCanonical(actual: unknown, expected: unknown, path: string, seen: WeakSet<object>): void {
  if (typeof expected !== "object" || expected === null) {
    if (!Object.is(actual, expected)) throw new RangeError(`${path} does not match the BP-143 contract`)
    return
  }
  if (typeof actual !== "object" || actual === null || seen.has(actual)) {
    throw new RangeError(`${path} must match the canonical object topology without aliases or cycles`)
  }
  seen.add(actual)
  const expectedArray = Array.isArray(expected)
  if (
    Array.isArray(actual) !== expectedArray ||
    Object.getPrototypeOf(actual) !== (expectedArray ? Array.prototype : Object.prototype)
  ) {
    throw new RangeError(`${path} has the wrong container type`)
  }
  if (expectedArray) {
    if (!Array.isArray(actual) || !Array.isArray(expected) || actual.length !== expected.length) {
      throw new RangeError(`${path} must match the canonical dense array`)
    }
    const expectedKeys = [...expected.keys()].map(String).concat("length")
    const actualKeys = Reflect.ownKeys(actual)
    if (
      actualKeys.length !== expectedKeys.length ||
      actualKeys.some((key, index) => key !== expectedKeys[index] || typeof key === "symbol")
    ) {
      throw new RangeError(`${path} must contain exactly the canonical array keys`)
    }
    for (const [index] of expected.entries()) {
      const actualDescriptor = Object.getOwnPropertyDescriptor(actual, String(index))
      const expectedDescriptor = Object.getOwnPropertyDescriptor(expected, String(index))
      if (
        actualDescriptor === undefined ||
        expectedDescriptor === undefined ||
        !("value" in actualDescriptor) ||
        !("value" in expectedDescriptor) ||
        !actualDescriptor.enumerable
      ) {
        throw new RangeError(`${path}[${index}] must be an enumerable data property`)
      }
      assertCanonical(actualDescriptor.value, expectedDescriptor.value, `${path}[${index}]`, seen)
    }
    return
  }
  const expectedKeys = Reflect.ownKeys(expected)
  const actualKeys = Reflect.ownKeys(actual)
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key, index) => key !== expectedKeys[index] || typeof key === "symbol")
  ) {
    throw new RangeError(`${path} must contain exactly the canonical keys`)
  }
  for (const key of expectedKeys) {
    const actualDescriptor = Object.getOwnPropertyDescriptor(actual, key)
    const expectedDescriptor = Object.getOwnPropertyDescriptor(expected, key)
    if (
      actualDescriptor === undefined ||
      expectedDescriptor === undefined ||
      !("value" in actualDescriptor) ||
      !("value" in expectedDescriptor) ||
      !actualDescriptor.enumerable
    ) {
      throw new RangeError(`${path}.${String(key)} must be an enumerable data property`)
    }
    assertCanonical(actualDescriptor.value, expectedDescriptor.value, `${path}.${String(key)}`, seen)
  }
}

function assertUpstreamProvenance(): void {
  validateBenchPrototypeBom(benchPrototypeBom)
  validateBenchPrototypeEsp32Allocation(benchPrototypeEsp32Allocation)
  const powerResult = calculateBenchPrototypePowerContract(defaultBenchPrototypePowerInputs)

  const hub75BomRow = benchPrototypeBom.rows.find((row) => row.reference === "J_HUB75")
  if (
    hub75BomRow === undefined ||
    hub75BomRow.disposition !== "TBD" ||
    hub75BomRow.quantity !== 1 ||
    hub75BomRow.mpn !== undefined
  ) {
    throw new RangeError("BP-020 J_HUB75 must remain the reviewed TBD baseline until BP-033 integration")
  }

  if (
    powerResult.releaseState !== "deny" ||
    powerResult.displayConnectedPermit !== "deny-until-inrush-measured" ||
    defaultBenchPrototypePowerInputs.displayDisconnectReference !== "J_DISPLAY_DISCONNECT" ||
    defaultBenchPrototypePowerInputs.measurementLinks.display.boardHeaderMpn !== "39-28-1023" ||
    defaultBenchPrototypePowerInputs.measurementLinks.display.contactProjectScreenA !== 6 ||
    defaultBenchPrototypePowerInputs.branches.display.expectedContinuousA !== 4 ||
    defaultBenchPrototypePowerInputs.branches.display.expectedPeakA !== 4
  ) {
    throw new RangeError("BP-050 display disconnect, measurement link, or current screen drifted")
  }

  const hub75Pads = benchPrototypeEsp32Allocation.pads.filter(
    (pad): pad is Extract<(typeof benchPrototypeEsp32Allocation.pads)[number], { signal: string; gpio: number }> =>
      pad.group === "hub75" && pad.disposition === "assigned" && "gpio" in pad
  )
  if (
    benchPrototypeEsp32Allocation.moduleMpn !== "ESP32-S3-WROOM-1U-N16R2" ||
    hub75Pads.length !== expectedHub75Signals.length ||
    expectedHub75Signals.some((signal) => !hub75Pads.some((pad) => pad.signal === signal)) ||
    hub75Pads.some((pad) => String(pad.signal) === "HUB75_E" || String(pad.signal) === "E")
  ) {
    throw new RangeError("BP-121 HUB75 allocation no longer carries exactly the 13 selected signals")
  }

  if (
    signalMap.length !== hub75Pads.length ||
    signalMap.some((entry) => {
      const allocationPad = hub75Pads.find((pad) => pad.signal === entry.esp32Signal)
      return allocationPad === undefined || allocationPad.gpio !== entry.esp32Gpio
    })
  ) {
    throw new RangeError("BP-143 signal GPIO mapping no longer matches the reviewed BP-121 allocation")
  }
}

export function validateBenchPrototypeHub75Connector(value: unknown): true {
  assertUpstreamProvenance()
  assertCanonical(value, benchPrototypeHub75Connector, "benchPrototypeHub75Connector", new WeakSet<object>())

  if (
    benchPrototypeHub75Connector.boardConnector.positions !== 16 ||
    benchPrototypeHub75Connector.boardConnector.rows !== 2 ||
    benchPrototypeHub75Connector.boardConnector.pitchMm !== 2.54 ||
    benchPrototypeHub75Connector.boardConnector.mpn !== "TST-108-04-G-D-RA" ||
    benchPrototypeHub75Connector.signalCable.productId !== "4170" ||
    benchPrototypeHub75Connector.signalCable.pinMap.length !== 16 ||
    benchPrototypeHub75Connector.powerCable.productId !== "4767" ||
    benchPrototypeHub75Connector.powerCable.panelSideHousingMpn !== "SMR-04V-N" ||
    benchPrototypeHub75Connector.powerCable.cableSideHousingMpn !== "SMP-04V-NC" ||
    benchPrototypeHub75Connector.powerCable.contactCurrentRatingA !== 3 ||
    benchPrototypeHub75Connector.powerCable.pinMap.length !== 4 ||
    benchPrototypeHub75Connector.powerPath.displayDisconnectReference !== "J_DISPLAY_DISCONNECT" ||
    benchPrototypeHub75Connector.powerPath.measurementLinkReference !== "J_LINK_DISPLAY" ||
    benchPrototypeHub75Connector.powerPath.signalGroundsDoNotCarryPanelCurrent !== true ||
    benchPrototypeHub75Connector.panel.inputSignals.length !== 13 ||
    benchPrototypeHub75Connector.panel.inputSignals.includes("HUB75_E" as never) ||
    benchPrototypeHub75Connector.evidence.purchasedPanel.physicalPresenceVerified ||
    benchPrototypeHub75Connector.evidence.signalContinuity.measured ||
    benchPrototypeHub75Connector.evidence.powerContinuity.measured ||
    benchPrototypeHub75Connector.authority.fabricationAuthorized ||
    benchPrototypeHub75Connector.fabricationDisposition !== "DENY"
  ) {
    throw new RangeError("BP-143 connector contract must remain complete and fail closed")
  }
  return true
}
