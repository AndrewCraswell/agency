import {
  assessOneChannelAnalogExperiment,
  oneChannelAnalogExperiment,
  oneChannelNormalRangeScreen,
  oneChannelSabreTimingScreen,
  oneChannelStaticScreen
} from "./one-channel-analog-experiment.js"
import {
  ads8881ReferenceNetworkRequirement,
  oneChannelAnalogExperimentBom,
  ref5025OutputCapacitorRequirement
} from "./one-channel-analog-readiness.js"

type PlainRecord = Record<PropertyKey, unknown>

function isPlainRecord(value: unknown): value is PlainRecord {
  if (value === null || typeof value !== "object") return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object" || seen.has(value)) return value
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) deepFreeze((value as PlainRecord)[key], seen)
  return Object.freeze(value)
}

function hasExactDataGraph(actual: unknown, expected: unknown, seen = new WeakMap<object, object>()): boolean {
  if (Object.is(actual, expected)) return true
  if (actual === null || expected === null || typeof actual !== "object" || typeof expected !== "object") return false

  if (seen.has(actual)) return seen.get(actual) === expected
  seen.set(actual, expected)

  if (Array.isArray(expected)) {
    if (
      !Array.isArray(actual) ||
      Object.getPrototypeOf(actual) !== Array.prototype ||
      actual.length !== expected.length
    ) {
      return false
    }
    const keys = Reflect.ownKeys(actual)
    if (keys.some((key) => typeof key === "symbol" || (key !== "length" && !/^(0|[1-9]\d*)$/u.test(key)))) return false
    return expected.every((entry, index) => hasExactDataGraph(actual[index], entry, seen))
  }

  if (!isPlainRecord(actual) || !isPlainRecord(expected)) return false
  const actualKeys = Reflect.ownKeys(actual)
  const expectedKeys = Reflect.ownKeys(expected)
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key) => typeof key === "symbol" || !expectedKeys.includes(key))
  ) {
    return false
  }

  return expectedKeys.every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(actual, key)
    return Boolean(descriptor && "value" in descriptor && hasExactDataGraph(descriptor.value, expected[key], seen))
  })
}

const selectedReferences = [
  ["U_ISO", "NXE1S0505MC"],
  ["U_NEGATIVE_RAIL", "TPS60400DBVR"],
  ["U_3V3", "TPS7A2033PDBVR"],
  ["U_REF", "REF5025AQDRQ1"],
  ["U_ESD", "TPD4E05U06DQAR"],
  ["R_ESD", "CRCW060322R0FKEAHP"],
  ["U_SOURCE_SWITCH", "TMUX1112PWR"],
  ["R_SOURCE", "ERA3AEB2491V"],
  ["U_OVP_BUFFER", "ADA4177-1BRZ"],
  ["U_SAR", "ADS8881IDGS"],
  ["R_SAR", "CRCW060320R0FKEAHP"],
  ["C_SAR", "C0603C102J5GACTU"],
  ["C_REF_REG", "T521B106M025ATE100"],
  ["R_REF_SAR", "RCWE0603R220FKEA"],
  ["C_REF", "GRM21BR71A106KE51L"],
  ["R_FAULT_GUARD", "CRCW120656K0FKEAHP"]
] as const

const omittedAccuracyTerms = [
  "TMUX1112 maximum on-resistance, leakage, charge memory, and temperature behavior",
  "TPD4E05U06 leakage over voltage and temperature",
  "ADS8881 absolute offset, input leakage, kickback, and reference disturbance",
  "REF5025 load regulation, dynamic response, and reference-return impedance",
  "all remaining resistor and capacitor initial, temperature, voltage, and aging tolerances",
  "PCB, connector, fixture, and cable parasitics plus calibration transfer uncertainty"
] as const

const omittedTimingTerms = [
  "guaranteed ADA4177 settling rather than typical gain bandwidth",
  "TMUX1112 memory and channel recovery",
  "board, connector, fixture, and cable parasitics",
  "firmware scheduling and comparator qualification",
  "overload and fault recovery"
] as const

const staticScreen = oneChannelStaticScreen(450, 125)
const timingScreen = oneChannelSabreTimingScreen()

export const benchPrototypeAnalogTopology = deepFreeze({
  workUnit: "BP-100",
  decision: "select-one-channel-protected-buffer-and-dedicated-sar-for-prototype-development",
  scope: "one channel only; BP-103 owns any seven-channel replication",
  selectedChain: {
    normal:
      "fixture LINE -> TPD4E05U06 shunt -> 22 ohm -> TMUX1112 -> ADA4177-1 unity buffer on isolated +/-5 V -> 20 ohm/1 nF -> ADS8881 AINP; AINN -> SCORING_SGND",
    excitation: "REF5025A-Q1 -> 2.49 kohm -> TMUX1112 source path -> source node",
    guardedFault:
      "physically separate normally-open fixture relay -> 56 kohm 1 percent guard -> LINE; 100 ms maximum and 10 second minimum interval"
  },
  selectedReferences,
  normalRange: {
    requiredResistanceOhms: [0, 450, 475, 500],
    allInsidePublishedBufferAndAdcRanges: [0, 450, 475, 500].every((resistanceOhms) => {
      const screen = oneChannelNormalRangeScreen(resistanceOhms)
      return screen.adcInputPinsWithinZeroToReference && screen.bufferInputWithinPublishedRange
    }),
    zeroOhmCovered: oneChannelNormalRangeScreen(0).normativeZeroOhmCovered
  },
  accuracyBudget: {
    arithmeticAt450Ohms125c: staticScreen.totalOhms,
    arithmeticAllocationOhms: 4.5,
    arithmeticInsideAllocation: staticScreen.arithmeticWithinFourPointFiveOhms,
    omittedTerms: omittedAccuracyTerms.map((term) => ({ credited: false, term })),
    requiresPerCornerTwoPointCalibration: true,
    validated: false
  },
  sabreTimingBudget: {
    arithmeticAt100Ohms10nfUs: timingScreen.totalArithmeticUs,
    allocationUs: 10,
    arithmeticInsideAllocation: timingScreen.arithmeticWithinTenUs,
    omittedTerms: omittedTimingTerms.map((term) => ({ credited: false, term })),
    validated: false
  },
  overloadAndFault: {
    guardedSourceEnvelopeOnly: true,
    positiveAndNegative24VInsideBufferPublishedOvpRange:
      assessOneChannelAnalogExperiment().fault.positive24V.ovpRangeCovered &&
      assessOneChannelAnalogExperiment().fault.negative24V.ovpRangeCovered,
    sustainedFaultApproved: false,
    unpoweredFaultApproved: false,
    recoveryValidated: false
  },
  dependencies: {
    BP101: "close REF5025 input/output network and ADS8881 dynamic reference load",
    BP102: "close connector protection, guarded energy, unpowered behavior, and recovery",
    BP103: "select a feasible seven-channel conversion/serialization architecture and prove crosstalk and power"
  },
  authority: {
    schematicIntegrationAuthorized: false,
    footprintClosureAuthorized: false,
    fabricationAuthorized: false,
    releaseState: "deny"
  }
} as const)

const expectedUpstream = deepFreeze({
  acquisition: {
    adc: "ADS8881IDGS",
    buffer: "ADA4177-1BRZ",
    sarFilterPart: "C0603C102J5GACTU",
    sarFilterResistancePart: "CRCW060320R0FKEAHP"
  },
  isolatedRail: {
    converter: "NXE1S0505MC",
    negativeGenerator: "TPS60400DBVR",
    reference: "REF5025AQDRQ1",
    regulator3v3: "TPS7A2033PDBVR"
  },
  source: {
    resistancePart: "ERA3AEB2491V",
    switch: "TMUX1112PWR"
  },
  cRef: {
    manufacturerEsrTestCondition: "25 C, 100 kHz",
    reference: "C_REF_REG",
    requiredMaximumCapacitanceUf: 50,
    requiredMaximumEsrOhms: 1.5,
    requiredMinimumCapacitanceUf: 1,
    selectedCapacitanceUf: 10,
    selectedManufacturerMaximumEsrOhms: 0.1,
    selectedMpn: "T521B106M025ATE100"
  },
  adcReferenceNetwork: {
    capacitor: {
      reference: "C_REF",
      dielectric: "X7R",
      nominalCapacitanceUf: 10,
      package: "0805",
      tolerancePercent: 10,
      selectedMpn: "GRM21BR71A106KE51L"
    },
    feedResistor: {
      allowedMaximumOhms: 0.47,
      allowedMinimumOhms: 0.1,
      reference: "R_REF_SAR",
      selectedOhms: 0.22,
      selectedMpn: "RCWE0603R220FKEA"
    },
    lowerValueParallelCapacitorPermittedAtAdcRef: false
  },
  bomReferences: selectedReferences.map(([reference, mpn]) => ({ reference, mpn }))
} as const)

const expectedExperimentEvidence = deepFreeze(structuredClone(oneChannelAnalogExperiment))

function runtimeScreens() {
  return {
    normalRanges: [0, 450, 475, 500].map((resistanceOhms) => oneChannelNormalRangeScreen(resistanceOhms)),
    static450Ohms125C: oneChannelStaticScreen(450, 125),
    sabre100Ohms10Nf: oneChannelSabreTimingScreen(),
    fault: {
      negative24V: assessOneChannelAnalogExperiment().fault.negative24V,
      positive24V: assessOneChannelAnalogExperiment().fault.positive24V
    }
  }
}

const expectedRuntimeScreens = deepFreeze(runtimeScreens())

function currentUpstreamSnapshot() {
  return {
    acquisition: {
      adc: oneChannelAnalogExperiment.acquisition.adc,
      buffer: oneChannelAnalogExperiment.acquisition.buffer,
      sarFilterPart: oneChannelAnalogExperiment.acquisition.sarFilterPart,
      sarFilterResistancePart: oneChannelAnalogExperiment.acquisition.sarFilterResistancePart
    },
    isolatedRail: {
      converter: oneChannelAnalogExperiment.isolatedRail.converter,
      negativeGenerator: oneChannelAnalogExperiment.isolatedRail.negativeGenerator,
      reference: oneChannelAnalogExperiment.isolatedRail.reference,
      regulator3v3: oneChannelAnalogExperiment.isolatedRail.regulator3v3
    },
    source: {
      resistancePart: oneChannelAnalogExperiment.source.resistancePart,
      switch: oneChannelAnalogExperiment.source.switch
    },
    cRef: ref5025OutputCapacitorRequirement,
    adcReferenceNetwork: ads8881ReferenceNetworkRequirement,
    bomReferences: selectedReferences.map(([reference]) => {
      const matches = oneChannelAnalogExperimentBom.filter((row) => row.reference === reference)
      return { reference, mpn: matches.length === 1 ? matches[0]!.mpn : "__MISSING_OR_DUPLICATE__" }
    })
  }
}

export function validateBenchPrototypeAnalogTopology(value: unknown): true {
  if (!hasExactDataGraph(value, benchPrototypeAnalogTopology)) {
    throw new RangeError("BP-100 analog topology must exactly match the reviewed canonical decision")
  }
  if (!hasExactDataGraph(currentUpstreamSnapshot(), expectedUpstream)) {
    throw new RangeError("BP-100 upstream analog evidence drifted from the reviewed decision")
  }
  if (!hasExactDataGraph(oneChannelAnalogExperiment, expectedExperimentEvidence)) {
    throw new RangeError("BP-100 numerical experiment evidence drifted from the reviewed decision")
  }
  if (!hasExactDataGraph(runtimeScreens(), expectedRuntimeScreens)) {
    throw new RangeError("BP-100 range, accuracy, timing, or fault screens drifted from the reviewed decision")
  }
  return true
}
