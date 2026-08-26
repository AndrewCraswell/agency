import { componentDecisions } from "./component-decisions.js"
import { ethernetSupportNetwork, validateEthernetSupportNetwork } from "./ethernet-support-network.js"

type ImportedEthernetPart = {
  readonly reference: string
  readonly manufacturer: string
  readonly mpn: string
  readonly value: string
  readonly connection: string
}

const upstreamProvenanceDefinition = {
  componentDecision: {
    category: "ethernet",
    lifecycle: "active",
    manufacturer: "WIZnet",
    mpn: "W5500"
  },
  supportParts: [
    [
      "Y_W5500",
      "ECS Inc.",
      "ECS-250-18-33B-JGN-TR",
      "25.000MHz, 18pF load, 2pF shunt, 40Ohm maximum ESR, ±2ppm first-year aging"
    ],
    ["C_W5500_XI", "TDK", "CGA3E2C0G1H180J080AA", "18pF"],
    ["R_W5500_XTAL", "Panasonic Industry", "ERJ3EKF1004V", "1MOhm"],
    ["R_W5500_XO", "Panasonic Industry", "ERJ3GEY0R00V", "0Ohm jumper"],
    ["C_W5500_XO", "TDK", "CGA3E2C0G1H180J080AA", "18pF"],
    ["R_W5500_EXRES", "Panasonic Industry", "ERJ3EKF1242V", "12.4kOhm"],
    ["C_W5500_TOCAP", "Murata", "GRM21BR71C475KA73L", "4.7uF"],
    ["C_W5500_1V2O", "Murata", "GRM188R71H103KA01D", "10nF"],
    ["C_ETH_AVDD_FERRITE_INPUT", "Murata", "GRM188R71C104KA01D", "100nF"],
    ["C_W5500_VDD", "Murata", "GRM188R71C104KA01D", "100nF"],
    ["C_W5500_AVDD_1", "Murata", "GRM188R71C104KA01D", "100nF"],
    ["C_W5500_AVDD_2", "Murata", "GRM188R71C104KA01D", "100nF"],
    ["C_W5500_AVDD_3", "Murata", "GRM188R71C104KA01D", "100nF"],
    ["C_W5500_AVDD_4", "Murata", "GRM188R71C104KA01D", "100nF"],
    ["C_W5500_AVDD_5", "Murata", "GRM188R71C104KA01D", "100nF"],
    ["C_W5500_AVDD_6", "Murata", "GRM188R71C104KA01D", "100nF"],
    ["FB_W5500_AVDD", "Murata", "BLM21PG221SN1D", "220Ohm impedance at 100MHz, 0.045Ohm maximum DCR"]
  ]
} as const

const supportConnections = {
  Y_W5500: "U_W5500.XI to crystal XI; crystal XO through R_W5500_XO to U_W5500.XO; grounded shield pads",
  C_W5500_XI: "crystal XI to APP_GND",
  R_W5500_XTAL: "crystal XI to crystal XO",
  R_W5500_XO: "crystal XO to U_W5500.XO",
  C_W5500_XO: "crystal XO to APP_GND",
  R_W5500_EXRES: "U_W5500.EXRES1 to APP_GND",
  C_W5500_TOCAP: "U_W5500.TOCAP to APP_GND with the shortest practical connection",
  C_W5500_1V2O: "U_W5500.1V2O to APP_GND with the shortest practical connection",
  C_ETH_AVDD_FERRITE_INPUT: "V3_3 to APP_GND at the FB_W5500_AVDD input",
  C_W5500_VDD: "U_W5500.VDD to APP_GND at pin 28",
  C_W5500_AVDD_1: "U_W5500.AVDD1 to APP_GND at pin 4",
  C_W5500_AVDD_2: "U_W5500.AVDD2 to APP_GND at pin 8",
  C_W5500_AVDD_3: "U_W5500.AVDD3 to APP_GND at pin 11",
  C_W5500_AVDD_4: "U_W5500.AVDD4 to APP_GND at pin 15",
  C_W5500_AVDD_5: "U_W5500.AVDD5 to APP_GND at pin 17",
  C_W5500_AVDD_6: "U_W5500.AVDD6 to APP_GND at pin 21",
  FB_W5500_AVDD: "V3_3 to ETH_AVDD; ETH_AVDD feeds all six W5500 AVDD pins"
} as const

function importSupportPart(reference: keyof typeof supportConnections): ImportedEthernetPart {
  const source = ethernetSupportNetwork.supportNetworkComponents.find((part) => part.reference === reference)
  if (source === undefined) {
    throw new Error(`Committed Ethernet support network is missing ${reference}`)
  }
  return {
    reference,
    manufacturer: source.manufacturer,
    mpn: source.mpn,
    value: source.value,
    connection: supportConnections[reference]
  }
}

function importW5500Decision(): ImportedEthernetPart {
  const source = componentDecisions.find((decision) => decision.mpn === "W5500")
  if (source === undefined) {
    throw new Error("Component decision register is missing W5500")
  }
  return {
    reference: "U_W5500",
    manufacturer: source.manufacturer,
    mpn: source.mpn,
    value: "10/100 Ethernet controller, LQFP-48, 7mm x 7mm body, 0.5mm pitch",
    connection: "V3_3 digital supply, ferrite-isolated ETH_AVDD, APP_GND, ESP32 SPI host, and on-board MDI path"
  }
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (typeof value !== "object" || value === null || seen.has(value)) return value
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor !== undefined && "value" in descriptor) deepFreeze(descriptor.value, seen)
  }
  return Object.freeze(value)
}

export const benchPrototypeEthernetUpstreamProvenance = deepFreeze(upstreamProvenanceDefinition)

const importedReferences = Object.keys(supportConnections) as (keyof typeof supportConnections)[]

const definition = {
  artifactKind: "bench-prototype-w5500-support-import",
  sourceRecord: "ethernetSupportNetwork and componentDecisions",
  targetAssembly: "one-board bench prototype",
  prototypeOnly: true,
  integrationRelease: false,
  fabricationRelease: false,
  releaseState: "deny",
  controller: importW5500Decision(),
  supportParts: importedReferences.map(importSupportPart),
  counts: {
    supportParts: 17,
    crystalLoadCapacitors: 2,
    avddPins: 6,
    localSupplyBypasses: 7,
    ferriteInputBypasses: 1
  },
  nets: {
    digitalSupply: {
      name: "V3_3",
      endpoints: ["U_W5500.VDD", "C_W5500_VDD.1", "C_ETH_AVDD_FERRITE_INPUT.1", "FB_W5500_AVDD.1"]
    },
    analogSupply: {
      name: "ETH_AVDD",
      endpoints: [
        "FB_W5500_AVDD.2",
        "U_W5500.AVDD1",
        "U_W5500.AVDD2",
        "U_W5500.AVDD3",
        "U_W5500.AVDD4",
        "U_W5500.AVDD5",
        "U_W5500.AVDD6"
      ]
    },
    ground: {
      name: "APP_GND",
      rule: "all W5500 AGND, GND, crystal shield, and support returns use the application ground; no scoring-ground tie"
    },
    reset: {
      name: "APP_W5500_RESET_N",
      polarity: "active-low",
      inputType: "W5500 active-low reset input",
      endpoints: ["U_APP_RESET_FANOUT.Y2", "R_W5500_RESET_PULLUP.2", "U_W5500.RST_N", "TP_W5500_RESET_N"],
      firmwareControl: "none",
      observationEndpoint: "TP_W5500_RESET_N",
      pullup: {
        reference: "R_W5500_RESET_PULLUP",
        value: "10 kOhm, 1%",
        mpn: "RC0603FR-0710KL",
        rail: "V3_3",
        ownershipStatus: "selected by BP-123; footprint, placement, and measured sink/timing margins remain open"
      },
      driver: {
        reference: "U_APP_RESET_FANOUT",
        endpoint: "Y2",
        mpn: "SN74LVC2G07DCKR",
        outputRequirement: "non-inverting open-drain fanout output driven only by APP_SUPERVISOR_RESET_N",
        ownershipStatus: "selected by BP-123; footprint and measured reset timing remain open"
      },
      rule: "BP-123 fanout Y2 must hold W5500 reset through supervisor brownout and release delay; EN_RESET sinks and ESP32 GPIO cannot override it"
    },
    interrupt: {
      name: "APP_W5500_INT_N",
      electricalType: "active-low push-pull W5500 output",
      endpoints: ["U_W5500.INT_N", "R_W5500_INT_BIAS.2", "TP_W5500_INT_N"],
      hostConnection: "none",
      observationEndpoint: "TP_W5500_INT_N",
      bias: {
        reference: "R_W5500_INT_BIAS",
        value: "TBD",
        rail: "V3_3",
        ownershipStatus: "open; BP-123 must select or explicitly DNP the local bias after power-sequence review"
      },
      firmwarePolicy: "poll W5500 over SPI; do not allocate an ESP32 GPIO",
      rule: "the unconsumed push-pull output remains observable; exact local bias or explicit DNP is required before integration"
    }
  },
  openGates: [
    "exact controller and support footprints",
    "released placement and return paths",
    "oscillator startup, drive, frequency, and 200 ohm negative-resistance measurement",
    "AVDD/VDD impedance, ripple, ferrite heating, EMC, ESD, and thermal measurement",
    "BP-141 MDI, MagJack, termination, shield, and surge closure",
    "application 3.3 V regulator closure",
    "BP-123 exact application supervisor, W5500 reset pullup, timing, and INT bias-or-DNP closure"
  ]
} as const

export const benchPrototypeEthernet = deepFreeze(definition)

function assertCanonical(actual: unknown, expected: unknown, path: string, seen: WeakSet<object>): void {
  if (typeof expected !== "object" || expected === null) {
    if (!Object.is(actual, expected)) throw new RangeError(`${path} does not match the BP-140 contract`)
    return
  }
  if (typeof actual !== "object" || actual === null || seen.has(actual)) {
    throw new RangeError(`${path} must match the canonical object topology without aliases or cycles`)
  }
  seen.add(actual)
  const expectedArray = Array.isArray(expected)
  if (Array.isArray(actual) !== expectedArray) throw new RangeError(`${path} has the wrong container type`)
  if (Object.getPrototypeOf(actual) !== (expectedArray ? Array.prototype : Object.prototype)) {
    throw new RangeError(`${path} must use the canonical prototype`)
  }
  const expectedKeys = Reflect.ownKeys(expected)
  const actualKeys = Reflect.ownKeys(actual)
  if (actualKeys.length !== expectedKeys.length || actualKeys.some((key, index) => key !== expectedKeys[index])) {
    throw new RangeError(`${path} must contain exactly the canonical keys`)
  }
  for (const key of expectedKeys) {
    const descriptor = Object.getOwnPropertyDescriptor(actual, key)
    if (descriptor === undefined || !("value" in descriptor))
      throw new RangeError(`${path}.${String(key)} must be data`)
    assertCanonical(descriptor.value, Reflect.get(expected, key), `${path}.${String(key)}`, seen)
  }
}

function assertUpstreamProvenance(): void {
  const decision = componentDecisions.find((candidate) => candidate.mpn === "W5500")
  if (decision === undefined) throw new RangeError("componentDecisions no longer contains W5500")
  const currentDecision = {
    category: decision.category,
    lifecycle: decision.lifecycle,
    manufacturer: decision.manufacturer,
    mpn: decision.mpn
  }
  const currentSupportParts = ethernetSupportNetwork.supportNetworkComponents.map((part) => [
    part.reference,
    part.manufacturer,
    part.mpn,
    part.value
  ])
  assertCanonical(
    currentDecision,
    benchPrototypeEthernetUpstreamProvenance.componentDecision,
    "componentDecisions.W5500 provenance",
    new WeakSet<object>()
  )
  assertCanonical(
    currentSupportParts,
    benchPrototypeEthernetUpstreamProvenance.supportParts,
    "ethernetSupportNetwork provenance",
    new WeakSet<object>()
  )
}

export function validateBenchPrototypeEthernet(value: unknown): true {
  validateEthernetSupportNetwork(ethernetSupportNetwork)
  assertUpstreamProvenance()
  assertCanonical(value, benchPrototypeEthernet, "benchPrototypeEthernet", new WeakSet<object>())
  return true
}
