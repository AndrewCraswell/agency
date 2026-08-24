/** BP-145: minimum-bench optional application-peripheral population contract. */

import {
  benchPrototypeApplicationRail,
  validateBenchPrototypeApplicationRail
} from "./bench-prototype-application-rail.js"
import {
  benchPrototypeEsp32Allocation,
  validateBenchPrototypeEsp32Allocation
} from "./bench-prototype-esp32-allocation.js"
import { componentDecisions } from "./component-decisions.js"

type DataRecord = Record<PropertyKey, unknown>

function isPlainRecord(value: unknown): value is DataRecord {
  return value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) throw new RangeError("Canonical BP-145 data cannot contain cycles or aliases")
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError("Canonical BP-145 data may contain only data properties")
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

const expectedIdentityDefinition = [
  {
    category: "event-journal",
    manufacturer: "Infineon",
    mpn: "CY15B104Q-LHXIT",
    package: "8-pin TDFN/DFN, 5 mm x 6 mm x 0.75 mm, PG-USON-8, drawing 001-85579",
    lifecycle: "active-preferred",
    evidenceUrl: "https://www.infineon.com/part/CY15B104Q-LHXIT"
  },
  {
    category: "real-time-clock",
    manufacturer: "Micro Crystal",
    mpn: "RV-3028-C7",
    package: "C7 ceramic module, 3.2 mm x 1.5 mm x 0.8 mm",
    lifecycle: "active",
    evidenceUrl: "https://www.microcrystal.com/fileadmin/Media/Products/RTC/Datasheet/RV-3028-C7.pdf"
  },
  {
    category: "secure-element",
    manufacturer: "STMicroelectronics",
    mpn: "STSAFE-A110",
    package: "orderable personalization and SO8N/UFDFPN variant TBD",
    lifecycle: "active",
    evidenceUrl: "https://www.st.com/en/secure-mcus/stsafe-a110.html"
  },
  {
    category: "audio-amplifier",
    manufacturer: "Texas Instruments",
    mpn: "TAS2505TRGERQ1",
    package: "VQFN-24 RGE, 4 mm x 4 mm",
    lifecycle: "active",
    evidenceUrl: "https://www.ti.com/product/TAS2505-Q1"
  }
] as const

export const benchPrototypeOptionalPeripheralExpectedIdentities = deepFreeze(expectedIdentityDefinition)

const framSupportIdentityDefinition = [
  {
    reference: "R_FRAM_WP_PULLUP",
    manufacturer: "Yageo",
    mpn: "RC0603FR-0710KL",
    value: "10 kOhm, 1%",
    package: "0603 (1608 metric)",
    evidenceUrl: "https://www.yageogroup.com/component-documentation/download/specsheet/RC0603FR-0710KL"
  },
  {
    reference: "R_FRAM_HOLD_PULLUP",
    manufacturer: "Yageo",
    mpn: "RC0603FR-0710KL",
    value: "10 kOhm, 1%",
    package: "0603 (1608 metric)",
    evidenceUrl: "https://www.yageogroup.com/component-documentation/download/specsheet/RC0603FR-0710KL"
  },
  {
    reference: "C_FRAM_BYPASS",
    manufacturer: "KEMET",
    mpn: "C0603C104K3RACTU",
    value: "100 nF, 25 V, X7R, 10%",
    package: "0603 (1608 metric)",
    evidenceUrl: "https://search.kemet.com/component-documentation/download/specsheet/C0603C104K3RACTU"
  }
] as const

export const benchPrototypeFramSupportExpectedIdentities = deepFreeze(framSupportIdentityDefinition)

const relevantSignals = [
  "APP_SPI_SCK",
  "APP_SPI_MOSI",
  "APP_SPI_MISO",
  "FRAM_CS_N",
  "I2C_SDA",
  "I2C_SCL",
  "IR_RX"
] as const
const relevantSignalSet = new Set<string>(relevantSignals)

const upstreamProvenance = deepFreeze({
  esp32: {
    moduleMpn: benchPrototypeEsp32Allocation.moduleMpn,
    pads: structuredClone(benchPrototypeEsp32Allocation.pads.filter((pad) => relevantSignalSet.has(pad.signal)))
  },
  applicationRail: {
    workUnit: benchPrototypeApplicationRail.workUnit,
    outputNet: benchPrototypeApplicationRail.topology.outputNet,
    releaseState: benchPrototypeApplicationRail.releaseState,
    deniedEvidence: structuredClone(benchPrototypeApplicationRail.deniedEvidence)
  }
})

function currentUpstreamProvenance() {
  return {
    esp32: {
      moduleMpn: benchPrototypeEsp32Allocation.moduleMpn,
      pads: structuredClone(benchPrototypeEsp32Allocation.pads.filter((pad) => relevantSignalSet.has(pad.signal)))
    },
    applicationRail: {
      workUnit: benchPrototypeApplicationRail.workUnit,
      outputNet: benchPrototypeApplicationRail.topology.outputNet,
      releaseState: benchPrototypeApplicationRail.releaseState,
      deniedEvidence: structuredClone(benchPrototypeApplicationRail.deniedEvidence)
    }
  }
}

const definition = {
  artifactKind: "bench-prototype-optional-application-peripherals",
  workUnit: "BP-145",
  targetAssembly: "one-board bench prototype",
  minimumBenchGoal: "weapon, connector, scoring-code, Ethernet, and display physical validation",
  releaseState: "deny",
  upstream: { processorAllocation: "BP-121", applicationRail: "BP-142" },
  population: [
    {
      item: "F-RAM",
      reference: "U_FRAM",
      disposition: "populate",
      manufacturer: "Infineon",
      mpn: "CY15B104Q-LHXIT",
      package: "8-pin TDFN/DFN, 5 mm x 6 mm x 0.75 mm, PG-USON-8, drawing 001-85579",
      supply: "V3_3",
      ground: "APP_GND",
      pinMap: [
        { pin: 1, name: "CS_N", destination: "FRAM_CS_N", esp32ModulePad: 24, esp32Gpio: 47 },
        { pin: 2, name: "SO", destination: "APP_SPI_MISO", esp32ModulePad: 17, esp32Gpio: 9 },
        { pin: 3, name: "WP_N", destination: "R_FRAM_WP_PULLUP.pin1", esp32ModulePad: null, esp32Gpio: null },
        { pin: 4, name: "VSS", destination: "APP_GND", esp32ModulePad: null, esp32Gpio: null },
        { pin: 5, name: "SI", destination: "APP_SPI_MOSI", esp32ModulePad: 12, esp32Gpio: 8 },
        { pin: 6, name: "SCK", destination: "APP_SPI_SCK", esp32ModulePad: 11, esp32Gpio: 18 },
        { pin: 7, name: "HOLD_N", destination: "R_FRAM_HOLD_PULLUP.pin1", esp32ModulePad: null, esp32Gpio: null },
        { pin: 8, name: "VDD", destination: "V3_3", esp32ModulePad: null, esp32Gpio: null }
      ],
      support: [
        {
          ...benchPrototypeFramSupportExpectedIdentities[0],
          topology: "U_FRAM.WP_N pin 3 to resistor pin 1; resistor pin 2 to V3_3"
        },
        {
          ...benchPrototypeFramSupportExpectedIdentities[1],
          topology: "U_FRAM.HOLD_N pin 7 to resistor pin 1; resistor pin 2 to V3_3"
        },
        {
          ...benchPrototypeFramSupportExpectedIdentities[2],
          topology: "U_FRAM.VDD pin 8 to capacitor pin 1; capacitor pin 2 to APP_GND, placed at pins 8/4"
        }
      ],
      reason:
        "Populate to validate the exact long-term event-journal device and shared APP SPI arbitration while adding no processor pin beyond BP-121."
    },
    {
      item: "RTC",
      reference: "U_RTC",
      disposition: "DNP",
      retainedCandidateMpn: "RV-3028-C7",
      interface: "I2C_SDA/I2C_SCL shared application bus",
      reason:
        "Network or test-host time is sufficient for the first physical validation; backup source and footprint remain open."
    },
    {
      item: "secure element",
      reference: "U_SECURE_ELEMENT",
      disposition: "DNP",
      retainedCandidateMpn: "STSAFE-A110",
      candidateLevel: "family-level only; exact orderable personalization and package variant TBD",
      interface: "I2C_SDA/I2C_SCL shared application bus",
      reason:
        "Factory personalization and credential provisioning are outside the first physical-validation goal; no generic family name is treated as an orderable provisioned part."
    },
    {
      item: "audio amplifier",
      reference: "U_AUDIO",
      disposition: "DNP",
      retainedCandidateMpn: "TAS2505TRGERQ1",
      interface: "DNP; no audio host routing; GPIO35 is reserved for BP-126 IR_RX/RMT_RX",
      reason:
        "Weapon sensing, Ethernet, and display validation do not require audio; speaker load and thermal evidence are absent."
    },
    {
      item: "speaker",
      reference: "J_SPEAKER",
      disposition: "DNP",
      retainedCandidateMpn: null,
      interface: "none while U_AUDIO is DNP",
      reason: "No speaker, connector, impedance, power, SPL, or factory enclosure selection exists."
    },
    {
      item: "external antenna",
      reference: "ANT_EXTERNAL",
      disposition: "DNP",
      retainedCandidateMpn: null,
      interface: "ESP32-S3-WROOM-1U module-integrated external-antenna connector",
      reason: "Ethernet is the required bench network path and no exact antenna/cable assembly has been approved."
    }
  ],
  sharedBusRules: [
    "U_FRAM is the only populated BP-145 APP SPI peripheral; W5500 retains ETH_CS_N and U_FRAM retains FRAM_CS_N.",
    "FRAM_CS_N has its BP-121 inactive pull-up and must remain high through reset, bootloader entry, and ESP32 absence.",
    "RTC and secure-element pads create no I2C stubs or pull-ups while DNP; BP-300 must not infer populated bus capacitance.",
    "Audio DNP leaves GPIO36/GPIO37 reserved NC and GPIO35 allocated to BP-126 IR_RX/RMT_RX; audio may not be repopulated without revising BP-121."
  ],
  antennaPolicy: {
    module: "ESP32-S3-WROOM-1U-N16R2",
    hostRfRoute: "prohibited; the WROOM-1U contains its RF route and antenna connector",
    dnpBehavior: "Wi-Fi and Bluetooth radios must remain disabled in firmware while ANT_EXTERNAL is DNP.",
    futurePopulation:
      "Select an exact Espressif-compatible external antenna and cable, connect it before enabling either radio, and independently review connector retention, cable routing, clearance, antenna placement, and regulatory scope."
  },
  recoveryRules: [
    "No optional peripheral may load BOOT_N, EN_RESET, UART0_RX, UART0_TX, USB_DN, or USB_DP.",
    "F-RAM failure or absence must not block USB or UART recovery; firmware must fail closed to a volatile/no-journal diagnostic mode.",
    "DNP peripherals must not be probed or bodge-wired onto unapproved processor pins during recovery."
  ],
  evidence: {
    exactFramSupportPartsApproved: false,
    framFootprintApproved: false,
    framSharedBusBenchVerified: false,
    dnpLandPatternsApproved: false,
    antennaAssemblyApproved: false,
    rfBenchVerified: false,
    audioLoadVerified: false,
    layoutApproved: false,
    fabricationAuthorized: false
  },
  openGates: [
    "BP-033 must derive and approve the exact CY15B104Q-LHXIT 8-pin TDFN/DFN land pattern and exposed-pad treatment from Infineon package drawing 001-85579, then verify orientation, two pull-ups, bypass part, and placement.",
    "BP-300 must integrate U_FRAM, prove separate ETH_CS_N/FRAM_CS_N selection, and close ERC without populating DNP devices.",
    "Bench-test F-RAM identity, destructive scratch read/write, retained journal records, shared-SPI arbitration, reset inactivity, and recovery with U_FRAM absent.",
    "Keep RTC, secure element, audio amplifier, speaker, and antenna DNP unless a later scoped contract supplies exact orderable parts and physical evidence.",
    "Keep every optional footprint, layout, and fabrication authority denied until its independent evidence is archived."
  ],
  sources: [
    "Infineon CY15B104Q 4-Mbit SPI F-RAM datasheet",
    "Micro Crystal RV-3028-C7 datasheet",
    "ST STSAFE-A110 datasheet and personalization guidance",
    "TI TAS2505-Q1 datasheet",
    "Espressif ESP32-S3-WROOM-1/WROOM-1U datasheet v1.8"
  ]
} as const

export const benchPrototypeOptionalPeripherals = deepFreeze(definition)
export const benchPrototypeOptionalPeripheralUpstreamProvenance = upstreamProvenance

function validateSelectedIdentityProvenance(): void {
  for (const expected of benchPrototypeOptionalPeripheralExpectedIdentities) {
    const matches = componentDecisions.filter((decision) => decision.category === expected.category)
    if (matches.length !== 1) throw new RangeError(`BP-145 ${expected.category} identity must be unique`)
    const actual = matches[0]
    if (
      actual === undefined ||
      actual.manufacturer !== expected.manufacturer ||
      actual.mpn !== expected.mpn ||
      actual.lifecycle !== expected.lifecycle ||
      actual.manufacturerUrl !== expected.evidenceUrl ||
      /\b(?:TBD|DNP|unknown|generic)\b/i.test(actual.mpn)
    ) {
      throw new RangeError(`BP-145 ${expected.category} selected-component provenance drifted`)
    }
  }
}

function validateFramSupportIdentity(): void {
  const fram = benchPrototypeOptionalPeripherals.population[0]
  if (!("support" in fram) || fram.support.length !== benchPrototypeFramSupportExpectedIdentities.length) {
    throw new RangeError("BP-145 F-RAM support identity set is incomplete")
  }
  for (const expected of benchPrototypeFramSupportExpectedIdentities) {
    const matches = fram.support.filter((part) => part.reference === expected.reference)
    if (matches.length !== 1) throw new RangeError(`BP-145 ${expected.reference} must be unique`)
    const actual = matches[0]
    if (
      actual === undefined ||
      actual.manufacturer !== expected.manufacturer ||
      actual.mpn !== expected.mpn ||
      actual.value !== expected.value ||
      actual.package !== expected.package ||
      actual.evidenceUrl !== expected.evidenceUrl ||
      /\b(?:TBD|DNP|unknown|generic)\b/i.test(actual.mpn)
    ) {
      throw new RangeError(`BP-145 ${expected.reference} provenance drifted`)
    }
  }
}

export function validateBenchPrototypeOptionalPeripherals(value: unknown): true {
  validateBenchPrototypeEsp32Allocation(benchPrototypeEsp32Allocation)
  validateBenchPrototypeApplicationRail(benchPrototypeApplicationRail)
  validateSelectedIdentityProvenance()
  validateFramSupportIdentity()
  if (!sameDataGraph(currentUpstreamProvenance(), benchPrototypeOptionalPeripheralUpstreamProvenance)) {
    throw new RangeError("BP-145 BP-121 or BP-142 provenance drifted")
  }
  if (!sameDataGraph(value, benchPrototypeOptionalPeripherals)) {
    throw new RangeError("BP-145 contract must exactly match the reviewed canonical decision")
  }
  const contract = benchPrototypeOptionalPeripherals
  const populated = contract.population.filter((item) => item.disposition === "populate")
  const dnp = contract.population.filter((item) => item.disposition === "DNP")
  if (
    populated.length !== 1 ||
    populated[0]?.reference !== "U_FRAM" ||
    populated[0].mpn !== "CY15B104Q-LHXIT" ||
    populated[0].package !== "8-pin TDFN/DFN, 5 mm x 6 mm x 0.75 mm, PG-USON-8, drawing 001-85579" ||
    populated[0].pinMap.length !== 8 ||
    populated[0].pinMap.some((pin, index) => pin.pin !== index + 1) ||
    ![
      [1, "CS_N", "FRAM_CS_N", 24, 47],
      [2, "SO", "APP_SPI_MISO", 17, 9],
      [3, "WP_N", "R_FRAM_WP_PULLUP.pin1", null, null],
      [4, "VSS", "APP_GND", null, null],
      [5, "SI", "APP_SPI_MOSI", 12, 8],
      [6, "SCK", "APP_SPI_SCK", 11, 18],
      [7, "HOLD_N", "R_FRAM_HOLD_PULLUP.pin1", null, null],
      [8, "VDD", "V3_3", null, null]
    ].every(([pin, name, destination, modulePad, gpio]) =>
      populated[0].pinMap.some(
        (entry) =>
          entry.pin === pin &&
          entry.name === name &&
          entry.destination === destination &&
          entry.esp32ModulePad === modulePad &&
          entry.esp32Gpio === gpio
      )
    ) ||
    dnp.length !== 5 ||
    !["U_RTC", "U_SECURE_ELEMENT", "U_AUDIO", "J_SPEAKER", "ANT_EXTERNAL"].every((reference) =>
      dnp.some((item) => item.reference === reference)
    ) ||
    contract.antennaPolicy.hostRfRoute !== "prohibited; the WROOM-1U contains its RF route and antenna connector" ||
    !contract.antennaPolicy.dnpBehavior.includes("radios must remain disabled") ||
    contract.evidence.fabricationAuthorized ||
    contract.releaseState !== "deny"
  ) {
    throw new RangeError("BP-145 must retain one populated F-RAM, five DNP peripherals, and denied release")
  }
  return true
}
