import { benchPrototypeEthernet, validateBenchPrototypeEthernet } from "./bench-prototype-ethernet.js"
import {
  communicationsFootprintEvidence,
  findCommunicationsFootprintEvidence,
  validateCommunicationsFootprintEvidence
} from "./communications-footprint-evidence.js"

type MdiMedium = "on-board-copper"

type MdiPair = {
  readonly controllerEndpoint: string
  readonly controllerPad: number
  readonly jackEndpoint: string
  readonly jackPin: number
  readonly medium: MdiMedium
  readonly net: string
  readonly polarity: "+" | "-"
  readonly seriesComponent: string | null
}

const WURTH_DATASHEET = "https://www.we-online.com/components/products/datasheet/7499011121A.pdf"
const WIZNET_DATASHEET = "https://docs.wiznet.io/img/products/w5500/W5500_ds_v110e.pdf"
const WIZNET_EVB = "https://docs.wiznet.io/img/products/w5500/w5500_evb/w5500_evb_v1.0_140527.pdf"

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (typeof value !== "object" || value === null || seen.has(value)) return value
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor !== undefined && "value" in descriptor) deepFreeze(descriptor.value, seen)
  }
  return Object.freeze(value)
}

type EndpointIdentity = {
  readonly reference: string
  readonly manufacturer: string
  readonly mpn: string
}

function importControllerIdentity() {
  const source = benchPrototypeEthernet.controller
  return {
    reference: source.reference,
    manufacturer: source.manufacturer,
    mpn: source.mpn
  } as const satisfies EndpointIdentity
}

function importMagJackSource() {
  const source = findCommunicationsFootprintEvidence("7499011121A")
  if (source === undefined) throw new Error("communications footprint evidence no longer contains 7499011121A")
  return source
}

const controllerIdentity = importControllerIdentity()
const magJackSource = importMagJackSource()
const magJackIdentity = {
  reference: "J_ETH",
  manufacturer: magJackSource.manufacturer,
  mpn: magJackSource.mpn
} as const satisfies EndpointIdentity

const upstreamProvenanceDefinition = {
  controller: {
    manufacturer: controllerIdentity.manufacturer,
    mpn: controllerIdentity.mpn,
    reference: controllerIdentity.reference
  },
  magJack: {
    manufacturer: magJackSource.manufacturer,
    mpn: magJackSource.mpn,
    releaseState: magJackSource.releaseState
  }
} as const

export const benchPrototypeEthernetMdiUpstreamProvenance = deepFreeze(upstreamProvenanceDefinition)

const definition = {
  artifactKind: "bench-prototype-w5500-mdi-contract",
  targetAssembly: "one-board bench prototype",
  prototypeOnly: true,
  integrationRelease: false,
  fabricationRelease: false,
  layoutRelease: false,
  benchValidationRelease: false,
  releaseState: "deny",
  controller: controllerIdentity,
  magJack: magJackIdentity,
  mdiPairs: [
    {
      controllerEndpoint: "U_W5500.TXP",
      controllerPad: 2,
      jackEndpoint: "J_ETH.TD+",
      jackPin: 1,
      medium: "on-board-copper",
      net: "ETH_TX_P",
      polarity: "+",
      seriesComponent: null
    },
    {
      controllerEndpoint: "U_W5500.TXN",
      controllerPad: 1,
      jackEndpoint: "J_ETH.TD-",
      jackPin: 3,
      medium: "on-board-copper",
      net: "ETH_TX_N",
      polarity: "-",
      seriesComponent: null
    },
    {
      controllerEndpoint: "U_W5500.RXP",
      controllerPad: 6,
      jackEndpoint: "J_ETH.RD+",
      jackPin: 4,
      medium: "on-board-copper",
      net: "ETH_RX_P",
      polarity: "+",
      seriesComponent: "C_ETH_RX_P, 6.8 nF"
    },
    {
      controllerEndpoint: "U_W5500.RXN",
      controllerPad: 5,
      jackEndpoint: "J_ETH.RD-",
      jackPin: 6,
      medium: "on-board-copper",
      net: "ETH_RX_N",
      polarity: "-",
      seriesComponent: "C_ETH_RX_N, 6.8 nF"
    }
  ] satisfies readonly MdiPair[],
  centerTapsAndTermination: {
    transmit: {
      jackEndpoint: "J_ETH.CTD",
      jackPin: 2,
      supply: "ETH_AVDD",
      topology: "10 Ohm series feed from ETH_AVDD, 22 nF local capacitor to APP_GND",
      referenceValues: ["49.9 Ohm from ETH_TX_P to ETH_AVDD", "49.9 Ohm from ETH_TX_N to ETH_AVDD"]
    },
    receive: {
      jackEndpoint: "J_ETH.CRD",
      jackPin: 5,
      topology:
        "J_ETH.CRD joins ETH_RX_BIAS and 10 nF to APP_GND; 49.9 Ohm from U_W5500.RXP and U_W5500.RXN to ETH_RX_BIAS; 6.8 nF series capacitor in each RXP/RXN path before J_ETH.RD+/RD-"
    },
    magJackInternal: {
      topology:
        "7499011121A contains four cable-side 75 Ohm resistors and one 0.001 uF / 2 kV common-mode termination capacitor",
      resistorCount: 4,
      resistorValueOhm: 75,
      capacitor: "0.001 uF / 2 kV",
      externalDuplication: "prohibited"
    }
  },
  leds: {
    yellow: {
      anode: "J_ETH.9",
      cathode: "J_ETH.10",
      driver: "U_W5500.ACTLED pin 27, active-low",
      currentLimit: "330 Ohm from V3_3 to J_ETH.9"
    },
    green: {
      anode: "J_ETH.11",
      cathode: "J_ETH.12",
      driver: "U_W5500.LINKLED pin 25, active-low",
      currentLimit: "330 Ohm from V3_3 to J_ETH.11"
    },
    unusedControllerOutputs: ["U_W5500.SPDLED pin 24", "U_W5500.DUPLED pin 26"]
  },
  shieldAndEsdReturn: {
    chassisNet: "CHASSIS_ETHERNET",
    endpoints: ["J_ETH.8", "J_ETH.S1", "J_ETH.S2"],
    appGroundConnection: "no direct APP_GND connection",
    rule: "J_ETH.8 is the external end of the MagJack internal 0.001 uF / 2 kV termination capacitor. The two shield tabs and every Ethernet cable-side ESD return use CHASSIS_ETHERNET, not APP_GND or SCORING_SGND.",
    status: "bench decision only; surge, ESD, chassis-bond impedance, and safety evidence remain open"
  },
  routePlan: {
    differentialImpedanceOhm: 100,
    pairs: ["ETH_TX_P/ETH_TX_N", "ETH_RX_P/ETH_RX_N"],
    rules: [
      "Route each MDI path from U_W5500 to J_ETH on this PCB only, with the mandated receive coupling capacitors as the only intentional series interruption.",
      "Keep each pair on one layer where possible; any layer transition is identical in count and topology for both conductors of that pair.",
      "Keep pair geometry continuous, minimize stubs, and record intra-pair skew after placement.",
      "Derive trace width, spacing, reference plane, and fabrication tolerance from the selected BP-400 stackup before routing approval."
    ]
  },
  noMdiHarnessCrossing: {
    externalMdiHarness: false,
    proof:
      "Every MDI endpoint is U_W5500 or J_ETH and every MDI medium is on-board-copper. No MDI net reaches a board connector other than J_ETH."
  },
  sources: [
    { title: "W5500 datasheet v1.1.0", url: WIZNET_DATASHEET },
    { title: "W5500 EVB v1.0 schematic", url: WIZNET_EVB },
    { title: "Würth 7499011121A drawing LuWe 003.000", url: WURTH_DATASHEET }
  ],
  openGates: [
    "BP-300 must independently review the selected-MagJack receive center-tap bias/coupling network and create every reference designator.",
    "BP-032 and BP-033 must release every added termination, LED, controller, and MagJack footprint.",
    "BP-400 must derive the 100 Ohm geometry from the selected stackup and review return paths, stubs, and pair skew.",
    "Bench validation must capture reset, link, traffic, cable fault, ESD, EMI, and shield-current behavior before any release."
  ]
} as const

export const benchPrototypeEthernetMdi = deepFreeze(definition)

function assertCanonical(actual: unknown, expected: unknown, path: string, seen: WeakSet<object>): void {
  if (typeof expected !== "object" || expected === null) {
    if (!Object.is(actual, expected)) throw new RangeError(`${path} does not match the BP-141 contract`)
    return
  }
  if (typeof actual !== "object" || actual === null || seen.has(actual)) {
    throw new RangeError(`${path} must match the canonical object topology without aliases or cycles`)
  }
  seen.add(actual)
  const isArray = Array.isArray(expected)
  if (
    Array.isArray(actual) !== isArray ||
    Object.getPrototypeOf(actual) !== (isArray ? Array.prototype : Object.prototype)
  ) {
    throw new RangeError(`${path} has the wrong container type`)
  }
  if (isArray) {
    if (!Array.isArray(actual)) throw new RangeError(`${path} must be an array`)
    if (actual.length !== expected.length) throw new RangeError(`${path}.length does not match the canonical value`)
    const expectedKeys = [...expected.keys()].map(String).concat("length").sort()
    const actualKeys = Reflect.ownKeys(actual)
    if (actualKeys.some((key) => typeof key === "symbol")) throw new RangeError(`${path} must not contain symbol keys`)
    const actualStringKeys = actualKeys.filter((key): key is string => typeof key === "string").sort()
    if (
      actualStringKeys.length !== expectedKeys.length ||
      actualStringKeys.some((key, index) => key !== expectedKeys[index])
    ) {
      throw new RangeError(`${path} must contain exactly the canonical array keys`)
    }
    for (const [index, expectedEntry] of expected.entries()) {
      const descriptor = Object.getOwnPropertyDescriptor(actual, String(index))
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        throw new RangeError(`${path}[${index}] must be an enumerable data property`)
      }
      assertCanonical(descriptor.value, expectedEntry, `${path}[${index}]`, seen)
    }
    return
  }
  const expectedKeys = Reflect.ownKeys(expected)
  const actualKeys = Reflect.ownKeys(actual)
  if (actualKeys.length !== expectedKeys.length || actualKeys.some((key, index) => key !== expectedKeys[index])) {
    throw new RangeError(`${path} must contain exactly the canonical keys`)
  }
  for (const key of expectedKeys) {
    const descriptor = Object.getOwnPropertyDescriptor(actual, key)
    if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
      throw new RangeError(`${path}.${String(key)} must be an enumerable data property`)
    }
    const expectedDescriptor = Object.getOwnPropertyDescriptor(expected, key)
    if (expectedDescriptor === undefined || !("value" in expectedDescriptor)) {
      throw new RangeError(`${path}.${String(key)} has an invalid canonical descriptor`)
    }
    assertCanonical(descriptor.value, expectedDescriptor.value, `${path}.${String(key)}`, seen)
  }
}

function assertUpstreamProvenance(): void {
  validateBenchPrototypeEthernet(benchPrototypeEthernet)
  const evidenceErrors = validateCommunicationsFootprintEvidence(communicationsFootprintEvidence)
  if (evidenceErrors.length > 0)
    throw new RangeError(`communications footprint evidence is invalid: ${evidenceErrors.join("; ")}`)
  const magJack = findCommunicationsFootprintEvidence("7499011121A")
  if (magJack === undefined) throw new RangeError("communications footprint evidence no longer contains 7499011121A")
  assertCanonical(
    {
      manufacturer: benchPrototypeEthernet.controller.manufacturer,
      mpn: benchPrototypeEthernet.controller.mpn,
      reference: benchPrototypeEthernet.controller.reference
    },
    benchPrototypeEthernetMdiUpstreamProvenance.controller,
    "BP-140 W5500 provenance",
    new WeakSet<object>()
  )
  assertCanonical(
    { manufacturer: magJack.manufacturer, mpn: magJack.mpn, releaseState: magJack.releaseState },
    benchPrototypeEthernetMdiUpstreamProvenance.magJack,
    "communications MagJack provenance",
    new WeakSet<object>()
  )
}

export function validateBenchPrototypeEthernetMdi(value: unknown): true {
  assertUpstreamProvenance()
  assertCanonical(value, benchPrototypeEthernetMdi, "benchPrototypeEthernetMdi", new WeakSet<object>())
  const pairs = benchPrototypeEthernetMdi.mdiPairs
  if (
    benchPrototypeEthernetMdi.noMdiHarnessCrossing.externalMdiHarness ||
    pairs.some(
      (pair) =>
        pair.medium !== "on-board-copper" ||
        !pair.controllerEndpoint.startsWith("U_W5500.") ||
        !pair.jackEndpoint.startsWith("J_ETH.")
    )
  ) {
    throw new RangeError("MDI harness crossing is prohibited")
  }
  return true
}
