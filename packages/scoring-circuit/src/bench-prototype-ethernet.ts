import { componentDecisions } from "./component-decisions.js"
import { ethernetSupportNetwork, validateEthernetSupportNetwork } from "./ethernet-support-network.js"

type ImportedEthernetPart = {
  readonly reference: string
  readonly manufacturer: string
  readonly mpn: string
  readonly value: string
  readonly connection: string
}

type TestPointSelection = {
  readonly reference: "TP_W5500_RESET_N" | "TP_W5500_INT_N"
  readonly manufacturer: "Keystone Electronics"
  readonly mpn: "5001"
  readonly package: "miniature through-hole black test point, 0.040 inch (catalog 1.0 mm) mounting hole"
  readonly disposition: "populate-for-bench-observation"
  readonly rationale: string
  readonly sourceEvidence: {
    readonly document: "Keystone terminals and test points catalog"
    readonly url: "https://www.keystone-europe.com/wp-content/uploads/2025/08/terminal-test-points.pdf"
    readonly artifactPath: "docs/evidence/bp-033/keystone-terminal-test-points.pdf"
    readonly sha256: "00919BF8DA5DA41C978FE22717F8B39D443D03BB69BDD0A853CED85479FB237C"
    readonly claims: readonly string[]
  }
}

const resetTestPointSelection: TestPointSelection = {
  reference: "TP_W5500_RESET_N",
  manufacturer: "Keystone Electronics",
  mpn: "5001",
  package: "miniature through-hole black test point, 0.040 inch (catalog 1.0 mm) mounting hole",
  disposition: "populate-for-bench-observation",
  rationale:
    "Reset release, supervisor brownout hold, and the W5500 minimum 500 us reset interval require a directly probeable bench node.",
  sourceEvidence: {
    document: "Keystone terminals and test points catalog",
    url: "https://www.keystone-europe.com/wp-content/uploads/2025/08/terminal-test-points.pdf",
    artifactPath: "docs/evidence/bp-033/keystone-terminal-test-points.pdf",
    sha256: "00919BF8DA5DA41C978FE22717F8B39D443D03BB69BDD0A853CED85479FB237C",
    claims: [
      "Keystone 5001 is the black miniature through-hole test point with a 0.040 inch (catalog 1.0 mm) mounting hole.",
      "The catalog identifies the test point as suitable for standard probes, clips, and hooks.",
      "The catalog mounting-hole callout is not a finished PCB drill instruction."
    ]
  }
}

const interruptTestPointSelection: TestPointSelection = {
  reference: "TP_W5500_INT_N",
  manufacturer: "Keystone Electronics",
  mpn: "5001",
  package: "miniature through-hole black test point, 0.040 inch (catalog 1.0 mm) mounting hole",
  disposition: "populate-for-bench-observation",
  rationale:
    "Although firmware polls over SPI, a local probe is required for interrupt assertion/clear and fault-injection captures without allocating an ESP32 GPIO.",
  sourceEvidence: {
    document: "Keystone terminals and test points catalog",
    url: "https://www.keystone-europe.com/wp-content/uploads/2025/08/terminal-test-points.pdf",
    artifactPath: "docs/evidence/bp-033/keystone-terminal-test-points.pdf",
    sha256: "00919BF8DA5DA41C978FE22717F8B39D443D03BB69BDD0A853CED85479FB237C",
    claims: [
      "Keystone 5001 is the black miniature through-hole test point with a 0.040 inch (catalog 1.0 mm) mounting hole.",
      "The catalog identifies the test point as suitable for standard probes, clips, and hooks.",
      "The catalog mounting-hole callout is not a finished PCB drill instruction."
    ]
  }
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
  ],
  interruptPolicy: {
    signal: "INTn",
    electricalType: "active-low digital output",
    outputStage: "not specified by the cited W5500 pin and DC-characteristics tables",
    lowState: "interrupt asserted from W5500",
    highState: "no interrupt",
    hostConnection: "none",
    firmwarePolicy: "poll W5500 over SPI; do not allocate an ESP32 GPIO",
    bias: {
      reference: "R_W5500_INT_BIAS",
      disposition: "populate",
      value: "100 kOhm, 1%",
      manufacturer: "Yageo",
      mpn: "RC0603FR-07100KL",
      package: "0603",
      rail: "V3_3",
      reason:
        "The canonical ESP32 allocation requires INTn to be pulled inactive locally for a defined high state while firmware polls over SPI; the 100 kOhm pull-up is a weak status bias and does not allocate an ESP32 GPIO."
    },
    sourceEvidence: {
      manufacturer: "WIZnet",
      document: "W5500 Datasheet v1.1.0",
      url: "https://docs.wiznet.io/img/products/w5500/W5500_ds_v110e.pdf",
      artifactPath: "docs/evidence/bp-033/wiznet-w5500-datasheet.pdf",
      sha256: "7B826B808084CCD986BCC22904C00A07A508EF42FB93D079FE7150A4C4F1A63D",
      claims: [
        "W5500 pin 36 INTn is an output: Low means interrupt asserted from W5500 and High means no interrupt.",
        "The W5500 DC-characteristics pull-up list names SCSn, RSTn, and PMODE[2:0], not INTn.",
        "The cited W5500 pin and DC-characteristics tables do not specify whether the INTn output stage is push-pull, open-drain, or another topology."
      ]
    },
    biasEvidence: {
      manufacturer: "Yageo",
      document: "RC0603FR-07100KL product specification",
      url: "https://www.yageogroup.com/component-documentation/download/specsheet/RC0603FR-07100KL",
      artifactPath: "docs/evidence/bp-033/yageo-rc0603fr-07100kl-datasheet.pdf",
      sha256: "E6BA74C3F9ABAC1D8865473C885FF9CD6D2F7A1181846B32A8D1FF7FB5684054",
      claims: ["RC0603FR-07100KL is a 100 kOhm, 1%, 0603 / 1608 thick-film resistor."]
    },
    policyEvidence: {
      document: "docs/esp32-pin-allocation.md",
      claims: [
        "INTn is intentionally not connected to an ESP32 GPIO; the application polls W5500 status and socket state over SPI while a local pull-up defines the inactive high state."
      ]
    }
  }
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
      testPoint: resetTestPointSelection,
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
      electricalType: "active-low digital W5500 output",
      outputStage: "not specified by the cited W5500 pin and DC-characteristics tables",
      endpoints: ["U_W5500.INT_N", "R_W5500_INT_BIAS.2", "TP_W5500_INT_N"],
      hostConnection: "none",
      observationEndpoint: "TP_W5500_INT_N",
      testPoint: interruptTestPointSelection,
      bias: {
        reference: "R_W5500_INT_BIAS",
        disposition: "populate",
        value: "100 kOhm, 1%",
        manufacturer: "Yageo",
        mpn: "RC0603FR-07100KL",
        package: "0603",
        rail: "V3_3",
        population: "selected; footprint evidence open",
        ownershipStatus:
          "selected by the canonical ESP32 allocation; no ESP32 input is allocated, and SPI polling remains the host policy",
        reason:
          "The 100 kOhm local pull-up defines the inactive high state required by the canonical polling/test-point policy without allocating an ESP32 GPIO.",
        sourceEvidence: {
          document: "W5500 Datasheet v1.1.0",
          artifactPath: "docs/evidence/bp-033/wiznet-w5500-datasheet.pdf",
          sha256: "7B826B808084CCD986BCC22904C00A07A508EF42FB93D079FE7150A4C4F1A63D"
        },
        biasEvidence: {
          manufacturer: "Yageo",
          document: "RC0603FR-07100KL product specification",
          url: "https://www.yageogroup.com/component-documentation/download/specsheet/RC0603FR-07100KL",
          artifactPath: "docs/evidence/bp-033/yageo-rc0603fr-07100kl-datasheet.pdf",
          sha256: "E6BA74C3F9ABAC1D8865473C885FF9CD6D2F7A1181846B32A8D1FF7FB5684054"
        },
        policyEvidence: {
          document: "docs/esp32-pin-allocation.md",
          claim:
            "INTn is intentionally not connected to an ESP32 GPIO; the application polls W5500 status and socket state over SPI while a local pull-up defines the inactive high state."
        }
      },
      firmwarePolicy: "poll W5500 over SPI; do not allocate an ESP32 GPIO",
      rule: "the unconsumed digital output remains observable at the selected test point and uses the exact weak local pull-up; the output remains outside the ESP32 GPIO allocation"
    }
  },
  openGates: [
    "exact controller and support footprints",
    "released placement and return paths",
    "oscillator startup, drive, frequency, and 200 ohm negative-resistance measurement",
    "AVDD/VDD impedance, ripple, ferrite heating, EMC, ESD, and thermal measurement",
    "BP-141 MDI, MagJack, termination, shield, and surge closure",
    "application 3.3 V regulator closure",
    "BP-123 exact application supervisor, W5500 reset pullup, and reset timing closure"
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
  const currentInterruptPolicy = structuredClone(ethernetSupportNetwork.w5500.interruptPolicy)
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
  assertCanonical(
    currentInterruptPolicy,
    benchPrototypeEthernetUpstreamProvenance.interruptPolicy,
    "ethernetSupportNetwork.w5500.interruptPolicy provenance",
    new WeakSet<object>()
  )
}

export function validateBenchPrototypeEthernet(value: unknown): true {
  validateEthernetSupportNetwork(ethernetSupportNetwork)
  assertUpstreamProvenance()
  assertCanonical(value, benchPrototypeEthernet, "benchPrototypeEthernet", new WeakSet<object>())
  return true
}
