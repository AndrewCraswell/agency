import { benchPrototypeContract, validateBenchPrototypeContract } from "./bench-prototype-contract.js"
import { benchPrototypeEthernetMdi, validateBenchPrototypeEthernetMdi } from "./bench-prototype-ethernet-mdi.js"
import { calculateBenchPrototypePowerContract, defaultBenchPrototypePowerInputs } from "./bench-prototype-power.js"

/** Net classes frozen for the one-board bench prototype. */
export type BenchPrototypeNetClassId =
  | "APP_GND"
  | "SCORING_SGND"
  | "ESD_RETURN"
  | "CHASSIS"
  | "ANALOG_QUIET"
  | "HIGH_CURRENT"
  | "USB2_DIFF"
  | "ETHERNET_DIFF"

export type BenchPrototypeNetClass = {
  readonly category: "analog" | "differential" | "ground" | "power" | "shield"
  readonly domain: "application" | "external" | "scoring" | "shared"
  readonly forbiddenConnections: readonly string[]
  readonly id: BenchPrototypeNetClassId
  readonly name: BenchPrototypeNetClassId
  readonly referenceNet: string
  readonly routingRule: string
  readonly allowedEndpoints: readonly string[]
}

const definition = {
  artifactKind: "bench-prototype-net-class-contract",
  board: {
    boardCount: 1,
    identity: "one-board bench prototype",
    releaseState: "deny",
    fabricationRelease: false,
    rule: "These are schematic and layout constraints for the accessible bench PCB, not fabrication permission."
  },
  sourceEvidence: {
    architecture: {
      artifact: "benchPrototypeContract",
      source: "src/bench-prototype-contract.ts",
      boardCount: benchPrototypeContract.architecture.boardCount,
      releaseState: benchPrototypeContract.architecture.releaseState,
      applicationGround: benchPrototypeContract.domains.application.ground,
      scoringGround: benchPrototypeContract.domains.scoring.ground,
      crossingParts: benchPrototypeContract.isolationBoundary.crossingParts
    },
    power: {
      artifact: "calculateBenchPrototypePowerContract(defaultBenchPrototypePowerInputs)",
      source: "src/bench-prototype-power.ts",
      normalVoltageV: defaultBenchPrototypePowerInputs.normalInput.contractVoltageV,
      normalCurrentA: defaultBenchPrototypePowerInputs.normalInput.contractCurrentA,
      labVoltageV: defaultBenchPrototypePowerInputs.labInjection.voltageV,
      labMaximumCurrentA: defaultBenchPrototypePowerInputs.labInjection.maximumCurrentA,
      labInjectionNode: defaultBenchPrototypePowerInputs.labInjection.injectionNode,
      sourceSelector: defaultBenchPrototypePowerInputs.sourceSelector.mpn,
      sourceSelection: calculateBenchPrototypePowerContract().sourceSelection,
      releaseState: calculateBenchPrototypePowerContract().releaseState
    },
    ethernetMdi: {
      artifact: "benchPrototypeEthernetMdi",
      source: "src/bench-prototype-ethernet-mdi.ts",
      chassisChildIsland: benchPrototypeEthernetMdi.shieldAndEsdReturn.chassisNet,
      appGroundConnection: benchPrototypeEthernetMdi.shieldAndEsdReturn.appGroundConnection,
      onBoardOnly: benchPrototypeEthernetMdi.noMdiHarnessCrossing.externalMdiHarness === false
    }
  },
  netNames: {
    applicationGround: "APP_GND",
    scoringGround: "SCORING_SGND",
    esdReturn: "ESD_RETURN",
    chassis: "CHASSIS",
    analogQuiet: "ANALOG_QUIET",
    highCurrent: "HIGH_CURRENT",
    usb2Differential: "USB2_DIFF",
    ethernetDifferential: "ETHERNET_DIFF"
  },
  netClasses: [
    {
      category: "ground",
      domain: "application",
      forbiddenConnections: [
        "SCORING_SGND direct copper or zero-ohm tie",
        "CHASSIS through a trace, zero-ohm link, cable shield, connector latch, or mounting hardware",
        "ESD_RETURN as a body-cord clamp return"
      ],
      id: "APP_GND",
      name: "APP_GND",
      referenceNet: "APP_GND",
      routingRule:
        "Continuous application reference for ESP32, W5500/Ethernet, USB service, V5, and HUB75 logic; do not neck it through the scoring domain.",
      allowedEndpoints: ["ESP32-S3-WROOM-1U-N16R2", "W5500", "USB service", "V5 converters", "HUB75 logic"]
    },
    {
      category: "ground",
      domain: "scoring",
      forbiddenConnections: [
        "APP_GND direct copper or zero-ohm tie",
        "CHASSIS direct bond",
        "ESD_RETURN direct bond",
        "ANALOG_QUIET return through a high-current neck"
      ],
      id: "SCORING_SGND",
      name: "SCORING_SGND",
      referenceNet: "SCORING_SGND",
      routingRule:
        "Continuous scoring reference beneath the STM32, acquisition, reference, watchdog, lamps, and buzzer; it stays isolated from APP_GND on every layer.",
      allowedEndpoints: ["STM32G474RET3TR", "REF5025AQDRQ1", "scoring analog acquisition", "scoring outputs"]
    },
    {
      category: "ground",
      domain: "external",
      forbiddenConnections: [
        "SCORING_SGND direct bond",
        "APP_GND direct bond",
        "REF5025AQDRQ1 return",
        "STM32 ADC or comparator return"
      ],
      id: "ESD_RETURN",
      name: "ESD_RETURN",
      referenceNet: "connector-side ESD return island",
      routingRule:
        "Short, wide connector-to-protection return for reviewed body-cord and fixture ESD paths; it is not a signal return or a substitute for either ground plane.",
      allowedEndpoints: ["D_ESD connector-side TVS", "PISTE_RETURN", "FIXTURE_RETURN_REVIEW_REQUIRED"]
    },
    {
      category: "shield",
      domain: "external",
      forbiddenConnections: [
        "APP_GND DC bond",
        "SCORING_SGND DC bond",
        "USB_DN or USB_DP signal return",
        "Ethernet MDI signal return"
      ],
      id: "CHASSIS",
      name: "CHASSIS",
      referenceNet: "CHASSIS",
      routingRule:
        "Controlled connector-entry shield and metalwork network for USB-C shell, RJ45 shield, and approved chassis contacts; it never serves as signal return.",
      allowedEndpoints: [
        "USB-C shell",
        "CHASSIS_ETHERNET governed child island",
        "connector metalwork",
        "approved chassis contact"
      ]
    },
    {
      category: "analog",
      domain: "scoring",
      forbiddenConnections: [
        "HIGH_CURRENT copper or return neck",
        "USB2_DIFF or ETHERNET_DIFF pair",
        "HUB75_CLK or HUB75_OE_N",
        "RF or switch-node copper",
        "isolation barrier crossing"
      ],
      id: "ANALOG_QUIET",
      name: "ANALOG_QUIET",
      referenceNet: "SCORING_SGND",
      routingRule:
        "Low-noise, guarded acquisition and reference class referenced locally to SCORING_SGND; keep it inside the scoring analog zone and away from high di/dt or fast-pair fields.",
      allowedEndpoints: ["seven fixture-line sense nodes", "REF5025AQDRQ1", "STM32 ADC/comparator inputs"]
    },
    {
      category: "power",
      domain: "shared",
      forbiddenConnections: [
        "ANALOG_QUIET quiet island",
        "USB2_DIFF or ETHERNET_DIFF pair corridor",
        "isolation barrier",
        "ESP32 RF connector or coax feed region"
      ],
      id: "HIGH_CURRENT",
      name: "HIGH_CURRENT",
      referenceNet: "dedicated local return conductor",
      routingRule:
        "Use short, wide, package-local loops and a keyed, locking, separately strain-relieved supply/return pair; keep V20, V5, display, and isolated-scoring current paths out of quiet analog copper.",
      allowedEndpoints: [
        "PD_EFUSE_OUT_20V",
        "LAB_POST_EFUSE_20V",
        "V20_TO_V5_BUCK",
        "V5_DISPLAY_IN",
        "V5_DISPLAY_LIMITED",
        "V5",
        "isolated scoring supply"
      ]
    },
    {
      category: "differential",
      domain: "application",
      forbiddenConnections: [
        "plane split",
        "isolation slot",
        "switch-node keepout",
        "CHASSIS shield return",
        "HUB75 high-current return path"
      ],
      id: "USB2_DIFF",
      name: "USB2_DIFF",
      referenceNet: "APP_GND",
      routingRule:
        "Route USB_DN and USB_DP as one same-layer, matched 90 ohm pair over an uninterrupted APP_GND reference with no stubs; shield is CHASSIS and there is no separate signal-ground conductor.",
      allowedEndpoints: [
        "Amphenol 10177070-00011LF USB-C receptacle",
        "TPD2EUSB30DRTR",
        "one matched 22 ohm series resistor per line",
        "ESP32-S3-WROOM-1U-N16R2 GPIO19/GPIO20"
      ]
    },
    {
      category: "differential",
      domain: "application",
      forbiddenConnections: [
        "plane split",
        "isolation corridor",
        "HUB75 high-current return path",
        "RF connector or coax feed region",
        "SCORING_SGND"
      ],
      id: "ETHERNET_DIFF",
      name: "ETHERNET_DIFF",
      referenceNet: "APP_GND",
      routingRule:
        "Route W5500 TX/RX MDI pairs as matched 100 ohm pairs entirely on this PCB to the integrated-magnetics jack; keep their reference and return path in the application domain.",
      allowedEndpoints: ["W5500 MDI", "Würth 7499011121A integrated-magnetics RJ45"]
    }
  ] satisfies readonly BenchPrototypeNetClass[],
  differentialPairs: [
    {
      id: "USB2_DIFF",
      positive: "USB_DP",
      negative: "USB_DN",
      targetImpedanceOhms: 90,
      tolerancePercent: 10,
      referenceNet: "APP_GND",
      pairRule: "same-layer matched pair over uninterrupted reference plane; no stubs or plane splits",
      endpoints: {
        source: "Amphenol 10177070-00011LF USB-C receptacle",
        destination: "ESP32-S3-WROOM-1U-N16R2 GPIO19/GPIO20"
      },
      protectionMpn: "TPD2EUSB30DRTR",
      seriesResistanceOhms: 22,
      seriesResistorCount: 2,
      shieldNet: "CHASSIS",
      separateSignalReturn: false
    },
    {
      id: "ETHERNET_DIFF",
      positive: "W5500 MDI positive pair conductors",
      negative: "W5500 MDI negative pair conductors",
      targetImpedanceOhms: 100,
      tolerancePercent: 10,
      referenceNet: "APP_GND",
      pairRule: "matched W5500-to-MagJack pair geometry; no plane split or HUB75 return crossing",
      endpoints: {
        positive: { source: "U_W5500.TXP/RXP", destination: "J_ETH.TD+/RD+" },
        negative: { source: "U_W5500.TXN/RXN", destination: "J_ETH.TD-/RD-" }
      },
      protectionMpn: "W5500 support and Würth 7499011121A integrated magnetics",
      seriesResistanceOhms: 0,
      seriesResistorCount: 0,
      shieldNet: "CHASSIS_ETHERNET",
      separateSignalReturn: false
    }
  ],
  highCurrentRules: {
    sourceSelector: {
      mpn: "7101SYZQE",
      normalNode: "PD_EFUSE_OUT_20V",
      diagnosticNode: "LAB_POST_EFUSE_20V",
      commonNode: "V20_TO_V5_BUCK",
      changeOnlyDeenergized: true,
      simultaneousSourcesProhibited: true
    },
    normalContract: { voltageV: 20, currentA: 3, sinkOnly: true },
    diagnosticInjection: {
      voltageV: 20,
      maximumCurrentA: 2.3,
      node: "LAB_POST_EFUSE_20V",
      normalProductInterface: false,
      equalLengthPairsRequired: true,
      wireGaugeAwg: 20
    },
    branchReturns: {
      input: {
        normalSupply: "PD_EFUSE_OUT_20V",
        diagnosticSupply: "LAB_POST_EFUSE_20V",
        returnNet: "APP_GND",
        measurementLink: "J_LINK_INPUT"
      },
      applicationAndHousekeeping: {
        supplyNet: "V5",
        returnNet: "APP_GND",
        measurementLink: "J_LINK_APPLICATION"
      },
      display: {
        supplyNet: "V5_DISPLAY_LIMITED",
        returnNet: "APP_GND",
        measurementLink: "J_LINK_DISPLAY",
        disconnect: "J_DISPLAY_DISCONNECT"
      },
      isolatedScoring: {
        supplyNet: "SCORING_3V3_ISOLATED",
        returnNet: "SCORING_SGND",
        measurementLink: "J_LINK_SCORING"
      }
    },
    returnRule:
      "Every high-current branch has a defined local return; the display V5 branch has a physical disconnect and a removable measurement link.",
    returnReferences: ["APP_GND", "SCORING_SGND"],
    noAnalogSharing: true
  },
  esdChassisPolicy: {
    esdReturn: "ESD_RETURN",
    chassisParent: "CHASSIS",
    ethernetChassisChild: "CHASSIS_ETHERNET",
    reviewedSinglePointBondOnly: true,
    directEsdReturnToChassisPermitted: false,
    rule: "ESD_RETURN must not connect directly to CHASSIS or CHASSIS_ETHERNET. Any future bond requires one reviewed single point with documented impedance, current, and surge evidence."
  },
  isolationRules: {
    applicationGround: "APP_GND",
    scoringGround: "SCORING_SGND",
    groundsSeparateOnEveryLayer: true,
    directGroundTiePermitted: false,
    crossingParts: ["ISO7762FDWR", "ISO7721FDR", "NXE1S0505MC"],
    corridor: {
      fullHeightReservation: true,
      noCopperUnderBarrier: true,
      noPlaneViaTestPadOrRoutingAcrossBarrier: true,
      onlyNamedPartsCross: true
    },
    signalCrossings: [
      {
        part: "ISO7762FDWR",
        scoringToApplication: ["SCK", "MOSI", "CS", "RESET_REQUEST"],
        applicationToScoring: ["MISO", "ESP32_HEARTBEAT"]
      },
      {
        part: "ISO7721FDR",
        scoringToApplication: ["STM32_HEARTBEAT"],
        applicationToScoring: ["SERVICE_ONLY_REVERSE_CHANNEL"]
      }
    ],
    powerCrossing: {
      part: "NXE1S0505MC",
      direction: "application-to-scoring",
      sourceDomain: "application",
      sourceNet: "V5",
      destinationDomain: "scoring",
      destinationNet: "SCORING_5V_ISOLATED",
      rule: "Only isolated power crosses; no application ground or signal return crosses with it."
    },
    prohibitedCrossings: [
      "APP_GND to SCORING_SGND direct copper or zero-ohm link",
      "ESD_RETURN or CHASSIS through the isolation corridor",
      "USB2_DIFF or ETHERNET_DIFF through the isolation corridor",
      "HIGH_CURRENT power copper through the isolation barrier"
    ]
  },
  fabricationRelease: false,
  releaseState: "deny"
} as const

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (typeof value !== "object" || value === null) return value
  if (seen.has(value)) throw new RangeError("BP-040 canonical contract cannot contain cycles or aliases")
  seen.add(value)

  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError("BP-040 canonical contract may contain only data properties")
    }
    deepFreeze(descriptor.value, seen)
  }

  return Object.freeze(value)
}

function sameDataGraph(
  actual: unknown,
  expected: unknown,
  actualSeen: WeakSet<object>,
  expectedSeen: WeakSet<object>
): boolean {
  const actualObject = typeof actual === "object" && actual !== null
  const expectedObject = typeof expected === "object" && expected !== null
  if (!actualObject || !expectedObject) return Object.is(actual, expected)

  if (actualSeen.has(actual) || expectedSeen.has(expected)) return false
  actualSeen.add(actual)
  expectedSeen.add(expected)

  const actualArray = Array.isArray(actual)
  const expectedArray = Array.isArray(expected)
  if (actualArray !== expectedArray) return false
  const expectedPrototype = expectedArray ? Array.prototype : Object.prototype
  if (Object.getPrototypeOf(actual) !== expectedPrototype || Object.getPrototypeOf(expected) !== expectedPrototype) {
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

  for (const key of expectedKeys) {
    if (!actualKeys.includes(key)) return false
    const actualDescriptor = Object.getOwnPropertyDescriptor(actual, key)
    const expectedDescriptor = Object.getOwnPropertyDescriptor(expected, key)
    if (
      actualDescriptor === undefined ||
      expectedDescriptor === undefined ||
      !("value" in actualDescriptor) ||
      !("value" in expectedDescriptor) ||
      actualDescriptor.enumerable !== expectedDescriptor.enumerable ||
      !sameDataGraph(actualDescriptor.value, expectedDescriptor.value, actualSeen, expectedSeen)
    ) {
      return false
    }
  }

  return true
}

function isExactDataGraph(actual: unknown, expected: unknown): boolean {
  return sameDataGraph(actual, expected, new WeakSet<object>(), new WeakSet<object>())
}

export const benchPrototypeNetClasses = deepFreeze(definition)

function validateCommittedEvidence(): void {
  validateBenchPrototypeContract(benchPrototypeContract)
  validateBenchPrototypeEthernetMdi(benchPrototypeEthernetMdi)
  const powerResult = calculateBenchPrototypePowerContract(defaultBenchPrototypePowerInputs)
  if (
    benchPrototypeNetClasses.sourceEvidence.architecture.boardCount !== 1 ||
    benchPrototypeNetClasses.sourceEvidence.architecture.releaseState !== "deny" ||
    benchPrototypeNetClasses.sourceEvidence.architecture.applicationGround !== "APP_GND" ||
    benchPrototypeNetClasses.sourceEvidence.architecture.scoringGround !== "SCORING_SGND" ||
    benchPrototypeNetClasses.sourceEvidence.ethernetMdi.chassisChildIsland !== "CHASSIS_ETHERNET" ||
    benchPrototypeNetClasses.sourceEvidence.ethernetMdi.appGroundConnection !== "no direct APP_GND connection" ||
    benchPrototypeNetClasses.sourceEvidence.ethernetMdi.onBoardOnly !== true ||
    powerResult.releaseState !== "deny" ||
    powerResult.sourceSelection !== "physical-spdt-mutual-exclusion" ||
    powerResult.normalPdContractW !== 60 ||
    powerResult.labInjectionMaximumPowerW !== 46
  ) {
    throw new RangeError("BP-040 upstream bench-prototype contract or power evidence no longer matches")
  }
}

/** Rejects altered, incomplete, or release-relaxing BP-040 data. */
export function validateBenchPrototypeNetClasses(input: unknown): true {
  if (!isExactDataGraph(input, benchPrototypeNetClasses)) {
    throw new RangeError("BP-040 net-class contract must exactly match the reviewed fail-closed graph")
  }

  validateCommittedEvidence()

  const contract = benchPrototypeNetClasses
  if (
    contract.board.boardCount !== 1 ||
    contract.board.releaseState !== "deny" ||
    contract.board.fabricationRelease !== false ||
    contract.releaseState !== "deny" ||
    contract.fabricationRelease !== false ||
    contract.netNames.applicationGround !== "APP_GND" ||
    contract.netNames.scoringGround !== "SCORING_SGND" ||
    contract.netNames.esdReturn !== "ESD_RETURN" ||
    contract.netNames.chassis !== "CHASSIS" ||
    contract.netNames.analogQuiet !== "ANALOG_QUIET" ||
    contract.netNames.highCurrent !== "HIGH_CURRENT" ||
    contract.netNames.usb2Differential !== "USB2_DIFF" ||
    contract.netNames.ethernetDifferential !== "ETHERNET_DIFF"
  ) {
    throw new RangeError("BP-040 net names or fabrication deny changed")
  }

  const netClassIds = contract.netClasses.map((netClass) => netClass.id)
  const expectedNetClassIds: readonly BenchPrototypeNetClassId[] = [
    "APP_GND",
    "SCORING_SGND",
    "ESD_RETURN",
    "CHASSIS",
    "ANALOG_QUIET",
    "HIGH_CURRENT",
    "USB2_DIFF",
    "ETHERNET_DIFF"
  ]
  if (
    netClassIds.length !== expectedNetClassIds.length ||
    !expectedNetClassIds.every((id, index) => netClassIds[index] === id) ||
    contract.differentialPairs.length !== 2 ||
    contract.differentialPairs[0]?.id !== "USB2_DIFF" ||
    contract.differentialPairs[1]?.id !== "ETHERNET_DIFF"
  ) {
    throw new RangeError("BP-040 net-class and differential-pair set changed")
  }

  const isolation = contract.isolationRules
  const expectedCrossingParts = ["ISO7762FDWR", "ISO7721FDR", "NXE1S0505MC"] as const
  if (
    isolation.applicationGround !== "APP_GND" ||
    isolation.scoringGround !== "SCORING_SGND" ||
    !isolation.groundsSeparateOnEveryLayer ||
    isolation.directGroundTiePermitted ||
    !isolation.corridor.noCopperUnderBarrier ||
    !isolation.corridor.noPlaneViaTestPadOrRoutingAcrossBarrier ||
    !isolation.corridor.onlyNamedPartsCross ||
    isolation.crossingParts.length !== 3 ||
    !expectedCrossingParts.every((part) => isolation.crossingParts.includes(part)) ||
    isolation.signalCrossings.length !== 2 ||
    isolation.powerCrossing.part !== "NXE1S0505MC" ||
    isolation.powerCrossing.direction !== "application-to-scoring" ||
    isolation.powerCrossing.sourceNet !== "V5" ||
    isolation.powerCrossing.destinationNet !== "SCORING_5V_ISOLATED"
  ) {
    throw new RangeError("BP-040 isolation corridor or ground-separation rule was weakened")
  }

  const usb = contract.differentialPairs[0]
  const ethernet = contract.differentialPairs[1]
  if (
    usb?.targetImpedanceOhms !== 90 ||
    usb.tolerancePercent !== 10 ||
    usb.referenceNet !== "APP_GND" ||
    usb.seriesResistanceOhms !== 22 ||
    usb.seriesResistorCount !== 2 ||
    usb.protectionMpn !== "TPD2EUSB30DRTR" ||
    usb.shieldNet !== "CHASSIS" ||
    usb.endpoints.source !== "Amphenol 10177070-00011LF USB-C receptacle" ||
    usb.endpoints.destination !== "ESP32-S3-WROOM-1U-N16R2 GPIO19/GPIO20" ||
    usb.separateSignalReturn ||
    ethernet?.targetImpedanceOhms !== 100 ||
    ethernet.tolerancePercent !== 10 ||
    ethernet.referenceNet !== "APP_GND" ||
    ethernet.shieldNet !== "CHASSIS_ETHERNET" ||
    ethernet.endpoints.positive.source !== "U_W5500.TXP/RXP" ||
    ethernet.endpoints.positive.destination !== "J_ETH.TD+/RD+" ||
    ethernet.endpoints.negative.source !== "U_W5500.TXN/RXN" ||
    ethernet.endpoints.negative.destination !== "J_ETH.TD-/RD-" ||
    ethernet.separateSignalReturn ||
    contract.highCurrentRules.sourceSelector.changeOnlyDeenergized !== true ||
    contract.highCurrentRules.sourceSelector.simultaneousSourcesProhibited !== true ||
    contract.highCurrentRules.sourceSelector.mpn !== "7101SYZQE" ||
    contract.highCurrentRules.sourceSelector.normalNode !== "PD_EFUSE_OUT_20V" ||
    contract.highCurrentRules.sourceSelector.diagnosticNode !== "LAB_POST_EFUSE_20V" ||
    contract.highCurrentRules.sourceSelector.commonNode !== "V20_TO_V5_BUCK" ||
    contract.highCurrentRules.diagnosticInjection.normalProductInterface !== false ||
    contract.highCurrentRules.diagnosticInjection.node !== "LAB_POST_EFUSE_20V" ||
    contract.highCurrentRules.diagnosticInjection.equalLengthPairsRequired !== true ||
    contract.highCurrentRules.diagnosticInjection.wireGaugeAwg !== 20 ||
    contract.highCurrentRules.returnReferences.length !== 2 ||
    contract.highCurrentRules.returnReferences[0] !== "APP_GND" ||
    contract.highCurrentRules.returnReferences[1] !== "SCORING_SGND" ||
    contract.highCurrentRules.noAnalogSharing !== true ||
    contract.highCurrentRules.normalContract.voltageV !== 20 ||
    contract.highCurrentRules.normalContract.currentA !== 3 ||
    contract.highCurrentRules.normalContract.sinkOnly !== true ||
    contract.highCurrentRules.diagnosticInjection.voltageV !== 20 ||
    contract.highCurrentRules.diagnosticInjection.maximumCurrentA !== 2.3 ||
    contract.highCurrentRules.branchReturns.input.returnNet !== "APP_GND" ||
    contract.highCurrentRules.branchReturns.input.normalSupply !== "PD_EFUSE_OUT_20V" ||
    contract.highCurrentRules.branchReturns.input.diagnosticSupply !== "LAB_POST_EFUSE_20V" ||
    contract.highCurrentRules.branchReturns.input.measurementLink !== "J_LINK_INPUT" ||
    contract.highCurrentRules.branchReturns.applicationAndHousekeeping.returnNet !== "APP_GND" ||
    contract.highCurrentRules.branchReturns.applicationAndHousekeeping.supplyNet !== "V5" ||
    contract.highCurrentRules.branchReturns.applicationAndHousekeeping.measurementLink !== "J_LINK_APPLICATION" ||
    contract.highCurrentRules.branchReturns.display.returnNet !== "APP_GND" ||
    contract.highCurrentRules.branchReturns.display.supplyNet !== "V5_DISPLAY_LIMITED" ||
    contract.highCurrentRules.branchReturns.display.measurementLink !== "J_LINK_DISPLAY" ||
    contract.highCurrentRules.branchReturns.isolatedScoring.returnNet !== "SCORING_SGND" ||
    contract.highCurrentRules.branchReturns.isolatedScoring.supplyNet !== "SCORING_3V3_ISOLATED" ||
    contract.highCurrentRules.branchReturns.isolatedScoring.measurementLink !== "J_LINK_SCORING" ||
    contract.highCurrentRules.branchReturns.display.disconnect !== "J_DISPLAY_DISCONNECT" ||
    contract.esdChassisPolicy.esdReturn !== "ESD_RETURN" ||
    contract.esdChassisPolicy.chassisParent !== "CHASSIS" ||
    contract.esdChassisPolicy.ethernetChassisChild !== "CHASSIS_ETHERNET" ||
    contract.esdChassisPolicy.reviewedSinglePointBondOnly !== true ||
    contract.esdChassisPolicy.directEsdReturnToChassisPermitted !== false
  ) {
    throw new RangeError("BP-040 differential, high-current, or shield return rule was weakened")
  }

  return true
}
