import { benchPrototypeContract, validateBenchPrototypeContract } from "./bench-prototype-contract.js"
import { benchPrototypeEthernetMdi, validateBenchPrototypeEthernetMdi } from "./bench-prototype-ethernet-mdi.js"

const definition = {
  artifactKind: "bench-prototype-net-class-contract",
  workUnit: "BP-040",
  board: { boardCount: 1, fabricationRelease: false, releaseState: "deny" },
  groundPlan: {
    digitalGround: "APP_GND",
    quietAnalogReturn: "SCORING_SGND",
    galvanicIsolation: false,
    connectionRule:
      "SCORING_SGND is a quiet analog return region connected to APP_GND once at the ADC/reference boundary; it is not an isolated power domain.",
    prohibited: [
      "multiple or uncontrolled SCORING_SGND to APP_GND connections",
      "HUB75, Ethernet, USB, RF, or switch-current return through SCORING_SGND",
      "ESD or chassis current through either signal-reference region"
    ]
  },
  netClasses: [
    {
      id: "APP_GND",
      reference: "APP_GND",
      rule: "Continuous ESP32, USB, Ethernet, HUB75, and power reference plane."
    },
    {
      id: "SCORING_SGND",
      reference: "SCORING_SGND",
      rule: "Quiet AFE, REF5025, and ADS8881 return region with one reviewed connection to APP_GND."
    },
    {
      id: "ANALOG_QUIET",
      reference: "SCORING_SGND",
      rule: "Guard and separate the seven weapon channels, reference, and ADC from RF, pairs, and high-current loops."
    },
    {
      id: "HIGH_CURRENT",
      reference: "APP_GND",
      rule: "Use short wide local loops for V20, V5, display power, primary outputs, and their returns."
    },
    {
      id: "USB2_DIFF",
      reference: "APP_GND",
      rule: "Route USB_DN and USB_DP as a matched 90 ohm pair over uninterrupted APP_GND."
    },
    {
      id: "ETHERNET_DIFF",
      reference: "APP_GND",
      rule: "Route W5500 MDI pairs as matched 100 ohm pairs to the integrated-magnetics RJ45."
    },
    {
      id: "ESD_RETURN",
      reference: "connector-entry protection",
      rule: "Keep connector surge current out of APP_GND and SCORING_SGND signal paths."
    },
    {
      id: "CHASSIS",
      reference: "connector shields and approved metalwork",
      rule: "Do not use USB or Ethernet shields as a signal return."
    }
  ],
  differentialPairs: [
    {
      id: "USB2_DIFF",
      targetImpedanceOhms: 90,
      tolerancePercent: 10,
      endpoints: ["10177070-00011LF", "ESP32-S3 GPIO19/GPIO20"],
      protectionMpn: "TPD2EUSB30DRTR",
      shieldNet: "CHASSIS"
    },
    {
      id: "ETHERNET_DIFF",
      targetImpedanceOhms: 100,
      tolerancePercent: 10,
      endpoints: ["W5500", "7499011121A"],
      protectionMpn: "integrated magnetics plus reviewed connector protection",
      shieldNet: "CHASSIS_ETHERNET"
    }
  ],
  powerRouting: {
    normalInput: "USB-C PD only",
    alternateInputPopulated: false,
    selectorPopulated: false,
    diagnosticAccess: "labeled test pads and removable current links used only while de-energized",
    branches: ["PD_EFUSE_OUT_20V", "V5", "V5_DISPLAY_LIMITED", "APP_3V3", "primary output loads"]
  },
  retiredIsolation: {
    enabled: false,
    parts: ["ISO7762FDWR", "ISO7721FDR", "NXE1S0505MC"],
    rule: "These parts are DNP; no isolation corridor or cross-domain routing is reserved on P0."
  },
  sourceEvidence: {
    processor: benchPrototypeContract.architecture.processor,
    ethernetChassis: benchPrototypeEthernetMdi.shieldAndEsdReturn.chassisNet
  },
  fabricationRelease: false,
  releaseState: "deny"
} as const

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) throw new RangeError("BP-040 cannot contain cycles or aliases")
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError("BP-040 may contain only data properties")
    }
    deepFreeze(descriptor.value, seen)
  }
  return Object.freeze(value)
}

function isPlainRecord(value: unknown): value is Record<PropertyKey, unknown> {
  return value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype
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

export const benchPrototypeNetClasses = deepFreeze(definition)

export function validateBenchPrototypeNetClasses(value: unknown): true {
  validateBenchPrototypeContract(benchPrototypeContract)
  validateBenchPrototypeEthernetMdi(benchPrototypeEthernetMdi)
  if (!sameDataGraph(value, benchPrototypeNetClasses)) {
    throw new RangeError("BP-040 net classes must exactly match the reviewed ESP32-only contract")
  }
  if (
    benchPrototypeNetClasses.board.boardCount !== 1 ||
    benchPrototypeNetClasses.groundPlan.galvanicIsolation ||
    benchPrototypeNetClasses.netClasses.length !== 8 ||
    benchPrototypeNetClasses.differentialPairs.length !== 2 ||
    benchPrototypeNetClasses.powerRouting.alternateInputPopulated ||
    benchPrototypeNetClasses.powerRouting.selectorPopulated ||
    benchPrototypeNetClasses.retiredIsolation.enabled ||
    benchPrototypeNetClasses.fabricationRelease ||
    benchPrototypeNetClasses.releaseState !== "deny"
  ) {
    throw new RangeError("BP-040 must retain one ground system, USB-C-only power, and denied release")
  }
  return true
}
