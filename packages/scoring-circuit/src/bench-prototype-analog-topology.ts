import {
  assessOneChannelAnalogExperiment,
  oneChannelAnalogExperiment,
  oneChannelGuardedFaultScreen,
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
  ["U_OVP_BUFFER", "ADA4177-1ARZ"],
  ["U_SAR", "ADS8881IDGS"],
  ["R_SAR", "CRCW060320R0FKEAHP"],
  ["C_SAR", "C0603C102J5GACTU"],
  ["C_REF_REG", "T521B106M025ATE100"],
  ["R_REF_SAR", "RCWE0603R220FKEA"],
  ["C_REF", "GRM21BR71A106KE51L"],
  ["R_FAULT_GUARD", "CRCW120656K0FKEAHP"]
] as const

/**
 * These are the exact normal-path protection identities.  BP-102 owns their
 * connector and fault qualification; BP-100 owns only their selection and
 * makes that selection fail closed if the standalone experiment BOM drifts.
 */
const normalProtectionParts = [
  {
    primaryEvidenceUrl: "https://www.ti.com/lit/ds/symlink/tpd4e05u06.pdf",
    package: "DQA USON-10",
    reference: "U_ESD",
    mpn: "TPD4E05U06DQAR",
    role: "connector-side shunt"
  },
  {
    primaryEvidenceUrl: "https://www.vishay.com/docs/20035/dcrcwe3.pdf",
    package: "0603",
    reference: "R_ESD",
    mpn: "CRCW060322R0FKEAHP",
    role: "22 ohm normal-path series protection"
  },
  {
    primaryEvidenceUrl: "https://www.ti.com/lit/ds/symlink/tmux1112.pdf",
    package: "PW TSSOP-16",
    reference: "U_SOURCE_SWITCH",
    mpn: "TMUX1112PWR",
    role: "normal source and quiet-path switch"
  },
  {
    primaryEvidenceUrl:
      "https://www.analog.com/media/en/technical-documentation/data-sheets/ADA4177-1_4177-2_4177-4.pdf",
    package: "R SOIC-8",
    reference: "U_OVP_BUFFER",
    mpn: "ADA4177-1ARZ",
    role: "overvoltage-tolerant unity buffer"
  },
  {
    primaryEvidenceUrl: "https://www.vishay.com/docs/20035/dcrcwe3.pdf",
    package: "0603",
    reference: "R_SAR",
    mpn: "CRCW060320R0FKEAHP",
    role: "20 ohm SAR input isolation"
  },
  {
    primaryEvidenceUrl: "https://www.ti.com/lit/ds/symlink/ads8881.pdf",
    package: "DGS VSSOP-10",
    reference: "U_SAR",
    mpn: "ADS8881IDGS",
    role: "dedicated SAR converter"
  }
] as const

const staticScreen = oneChannelStaticScreen(450, 125)
const timingScreen = oneChannelSabreTimingScreen()

function resistanceErrorOhms(externalResistanceOhms: number, voltageErrorVolts: number): number {
  const source = oneChannelAnalogExperiment.source
  const sensitivity =
    (source.excitationVolts * source.resistanceOhms) / (source.resistanceOhms + externalResistanceOhms) ** 2
  return Math.abs(voltageErrorVolts / sensitivity)
}

const staticQuantizationOhms = resistanceErrorOhms(450, staticScreen.lsbVolts / 2)
const staticAdcLeakageOhms = resistanceErrorOhms(
  450,
  ((oneChannelAnalogExperiment.source.resistanceOhms * 450) /
    (oneChannelAnalogExperiment.source.resistanceOhms + 450)) *
    oneChannelAnalogExperiment.acquisition.adcInputLeakageMaximumNa *
    1e-9
)

/**
 * A complete review inventory is deliberately different from a closed error
 * bound.  Every known numerical term is shown, and every term without an
 * applicable assembled-board bound remains explicit with zero credit.
 */
const errorBudgetTerms = [
  {
    credit: "included",
    errorOhms: staticScreen.breakdown.fixtureAllocation,
    term: "fixture standard and interpolation allocation"
  },
  {
    credit: "included",
    errorOhms: staticScreen.breakdown.sourceResistorTemperature,
    term: "ERA3AEB2491V source-resistor temperature after corner calibration"
  },
  { credit: "included", errorOhms: staticScreen.breakdown.bufferInputBias, term: "ADA4177-1 input bias current" },
  {
    credit: "included",
    errorOhms: staticScreen.breakdown.bufferOffset,
    term: "ADA4177-1 full-temperature input offset"
  },
  { credit: "included", errorOhms: staticScreen.breakdown.adcIntegralLinearity, term: "ADS8881 integral nonlinearity" },
  {
    credit: "included",
    errorOhms: staticScreen.breakdown.adcOffsetDriftAfter25cCalibration,
    term: "ADS8881 offset drift after 25 C calibration"
  },
  { credit: "included", errorOhms: staticQuantizationOhms, term: "ADS8881 quantization half-LSB" },
  {
    credit: "none",
    errorOhms: null,
    term: "REF5025A-Q1 absolute accuracy, temperature drift, load regulation, and dynamic response"
  },
  {
    credit: "none",
    errorOhms: null,
    term: "source-resistor initial tolerance, voltage coefficient, aging, and calibration residual"
  },
  {
    credit: "none",
    errorOhms: null,
    term: "CRCW060322R0FKEAHP normal-series resistance, temperature, leakage interaction, and fault-state behavior"
  },
  {
    credit: "none",
    errorOhms: null,
    term: "TMUX1112 on-resistance, temperature behavior, leakage, charge injection, and memory"
  },
  { credit: "none", errorOhms: null, term: "TPD4E05U06 leakage, capacitance, clamping, and temperature behavior" },
  {
    credit: "none",
    errorOhms: null,
    term: "ADA4177-1 offset drift, gain, linearity, noise, output swing, and recovery residual"
  },
  {
    credit: "none",
    errorOhms: null,
    term: "ADS8881 absolute offset, input leakage, kickback, aperture behavior, and reference disturbance"
  },
  {
    credit: "none",
    errorOhms: null,
    term: "R_SAR and C_SAR initial tolerance, bias, temperature, voltage, aging, and dielectric behavior"
  },
  {
    credit: "none",
    errorOhms: null,
    term: "REF5025 and ADS8881 reference-loop capacitor tolerance, ESR, ESL, placement, and return impedance"
  },
  {
    credit: "none",
    errorOhms: null,
    term: "PCB, connector, cable, fixture, contamination, humidity, and probe leakage or parasitics"
  },
  {
    credit: "none",
    errorOhms: null,
    term: "calibration standard traceability, transfer, fit residual, repeatability, and long-term drift"
  }
] as const

const errorBudgetArithmeticOhms = errorBudgetTerms.reduce((total, term) => total + (term.errorOhms ?? 0), 0)

const settlingBudgetTerms = [
  {
    credit: "screen-only",
    timeUs: timingScreen.sourceFiveTimeConstantsUs,
    term: "100 ohm and 10 nF source five-time-constant screen"
  },
  {
    credit: "screen-only",
    timeUs: timingScreen.idealBuffer18BitSettlingUs,
    term: "ADA4177-1 ideal 18-bit result from typical unity-gain bandwidth"
  },
  {
    credit: "screen-only",
    timeUs: timingScreen.sarFilter18BitSettlingUs,
    term: "20 ohm and nominal 1 nF plus 59 pF SAR input RC screen"
  },
  {
    credit: "screen-only",
    timeUs: timingScreen.adcCycleUs,
    term: "ADS8881 acquisition plus maximum conversion interval"
  },
  {
    credit: "none",
    timeUs: null,
    term: "source, CRCW060322R0FKEAHP normal series resistor, and TMUX1112 enable delay, charge injection, channel memory, and recovery"
  },
  {
    credit: "none",
    timeUs: null,
    term: "guaranteed ADA4177-1 large-signal and small-signal settling at the selected load and temperature"
  },
  {
    credit: "none",
    timeUs: null,
    term: "ADS8881 driver kickback, acquisition settling, conversion phasing, and reference recovery"
  },
  {
    credit: "none",
    timeUs: null,
    term: "R_SAR, C_SAR, TPD4E05U06, PCB, connector, cable, fixture, and probe parasitics"
  },
  {
    credit: "none",
    timeUs: null,
    term: "firmware scheduling, CONVST timing, SPI transfer, threshold qualification, and timestamping"
  },
  {
    credit: "none",
    timeUs: null,
    term: "overload clearing and post-fault recovery before a normal sample may be trusted"
  }
] as const

const leakageBudgetTerms = [
  {
    credit: "included",
    maximumNa: oneChannelAnalogExperiment.acquisition.bufferInputBiasMaximumNa,
    errorOhms: staticScreen.breakdown.bufferInputBias,
    term: "ADA4177-1 maximum input bias current"
  },
  {
    credit: "screen-only",
    maximumNa: oneChannelAnalogExperiment.acquisition.adcInputLeakageMaximumNa,
    errorOhms: staticAdcLeakageOhms,
    term: "ADS8881 maximum input leakage arithmetic; direction and assembled temperature behavior are not closed"
  },
  {
    credit: "none",
    maximumNa: null,
    errorOhms: null,
    term: "TMUX1112 off and on leakage across voltage, temperature, and channel state"
  },
  {
    credit: "none",
    maximumNa: null,
    errorOhms: null,
    term: "TPD4E05U06 leakage across voltage, temperature, and clamp state"
  },
  {
    credit: "none",
    maximumNa: null,
    errorOhms: null,
    term: "REF5025A-Q1, ADC reference network, and supply-return leakage or injection"
  },
  {
    credit: "none",
    maximumNa: null,
    errorOhms: null,
    term: "PCB, connector, cable, fixture, contamination, humidity, and probe leakage"
  }
] as const

const overloadAndFaultBudgetTerms = [
  { credit: "source-envelope-only", value: 24, unit: "V", term: "guarded-force maximum applied voltage magnitude" },
  { credit: "source-envelope-only", value: 100, unit: "ms", term: "guarded-force maximum pulse duration" },
  { credit: "source-envelope-only", value: 10_000, unit: "ms", term: "guarded-force minimum inter-pulse interval" },
  {
    credit: "source-envelope-only",
    value: oneChannelAnalogExperiment.faultGuard.minimumResistanceOhms,
    unit: "ohm",
    term: "minimum 56 kohm guard resistance"
  },
  {
    credit: "source-envelope-only",
    value: oneChannelGuardedFaultScreen(24).currentA,
    unit: "A",
    term: "maximum guarded source current"
  },
  {
    credit: "source-envelope-only",
    value: oneChannelGuardedFaultScreen(24).maximumSourcePowerW,
    unit: "W",
    term: "maximum guarded source power"
  },
  {
    credit: "source-envelope-only",
    value: oneChannelGuardedFaultScreen(24).maximumSourceEnergyJ,
    unit: "J",
    term: "maximum guarded source energy"
  },
  {
    credit: "none",
    value: null,
    unit: null,
    term: "normal-port sustained fault, surge, ESD, EFT, brownout, and reversed or miswired connection"
  },
  {
    credit: "none",
    value: null,
    unit: null,
    term: "TPD4E05U06 clamp current, voltage, thermal, and survival behavior"
  },
  {
    credit: "none",
    value: null,
    unit: null,
    term: "ADA4177-1 input current, output behavior, rail injection, thermal behavior, and survival"
  },
  {
    credit: "none",
    value: null,
    unit: null,
    term: "ADS8881 AINP, AINN, REF, AVDD, DVDD, and digital-interface fault behavior"
  },
  {
    credit: "none",
    value: null,
    unit: null,
    term: "isolated converter, negative generator, reference, return path, and upstream-supply fault behavior"
  }
] as const

const faultRecoveryBudgetTerms = [
  { credit: "none", measured: false, term: "powered plus and minus guarded-pulse recovery at cold, ambient, and hot" },
  { credit: "none", measured: false, term: "unpowered plus and minus guarded-pulse behavior and recovery" },
  {
    credit: "none",
    measured: false,
    term: "LINE, post-TPD, buffer input, buffer output, ADS8881 AINP, rails, reference, force voltage, and force current traces"
  },
  {
    credit: "none",
    measured: false,
    term: "post-pulse continuity, leakage, rail startup, reference recovery, buffer-overload clear, and ADC-code validity"
  },
  {
    credit: "none",
    measured: false,
    term: "fixture interlock, current-trip, watchdog, mutual exclusion, dwell, and trace-completeness evidence"
  }
] as const

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
  normalProtectionParts,
  normalRange: {
    requiredResistanceOhms: [0, 450, 475, 500],
    allInsidePublishedBufferAndAdcRanges: [0, 450, 475, 500].every((resistanceOhms) => {
      const screen = oneChannelNormalRangeScreen(resistanceOhms)
      return screen.adcInputPinsWithinZeroToReference && screen.bufferInputWithinPublishedRange
    }),
    zeroOhmCovered: oneChannelNormalRangeScreen(0).normativeZeroOhmCovered
  },
  accuracyBudget: {
    condition: "450 ohm at 125 C after the stated per-corner two-point calibration",
    completeTermInventory: errorBudgetTerms,
    arithmeticAt450Ohms125c: errorBudgetArithmeticOhms,
    arithmeticAllocationOhms: 4.5,
    arithmeticInsideAllocation: errorBudgetArithmeticOhms <= 4.5,
    requiresPerCornerTwoPointCalibration: true,
    physicalMeasurementStatus: "DENY",
    validated: false
  },
  sabreTimingBudget: {
    condition: "100 ohm with 10 nF line capacitance",
    completeTermInventory: settlingBudgetTerms,
    arithmeticAt100Ohms10nfUs: timingScreen.totalArithmeticUs,
    allocationUs: 10,
    arithmeticInsideAllocation: timingScreen.arithmeticWithinTenUs,
    physicalMeasurementStatus: "DENY",
    screenOnly: true,
    validated: false
  },
  leakageBudget: {
    condition: "450 ohm at 125 C after the stated per-corner two-point calibration",
    completeTermInventory: leakageBudgetTerms,
    physicalMeasurementStatus: "DENY",
    validated: false
  },
  overloadAndFault: {
    completeTermInventory: overloadAndFaultBudgetTerms,
    guardedSourceEnvelopeOnly: true,
    physicalMeasurementStatus: "DENY",
    positiveAndNegative24VInsideBufferPublishedOvpRange:
      assessOneChannelAnalogExperiment().fault.positive24V.ovpRangeCovered &&
      assessOneChannelAnalogExperiment().fault.negative24V.ovpRangeCovered,
    sustainedFaultApproved: false,
    unpoweredFaultApproved: false,
    recoveryValidated: false
  },
  faultRecoveryBudget: {
    completeTermInventory: faultRecoveryBudgetTerms,
    physicalMeasurementStatus: "DENY",
    validated: false
  },
  dependencies: {
    BP101: "close REF5025 input/output network and ADS8881 dynamic reference load",
    BP102: "close connector protection, guarded energy, unpowered behavior, and recovery",
    BP103: "select a feasible seven-channel conversion/serialization architecture and prove crosstalk and power"
  },
  authority: {
    reviewedBudgetComplete: true,
    topologySelectionAccepted: true,
    performanceClaimAccepted: false,
    physicalMeasurementsAccepted: false,
    schematicIntegrationAuthorized: false,
    footprintClosureAuthorized: false,
    fabricationAuthorized: false,
    releaseState: "deny"
  }
} as const)

const expectedUpstream = deepFreeze({
  numericalProvenance: {
    acquisition: {
      adcAcquisitionUs: 0.29,
      adcConversionMaximumUs: 0.71,
      adcInputCapacitancePf: 59,
      adcInputLeakageMaximumNa: 5,
      adcIntegralLinearityMaximumLsb: 3,
      adcOffsetDriftMaximumUvPerC: 1.5,
      adcReferenceVolts: 2.5,
      bufferGainBandwidthTypicalMhz: 3.5,
      bufferInputBiasMaximumNa: 1,
      bufferOffsetMaximumUvAtFullTemperature: 120,
      bufferOvervoltageBeyondRailVolts: 32,
      bufferNegativeRailVolts: -5,
      bufferPositiveRailVolts: 5,
      sarFilterCapacitancePf: 1_000,
      sarFilterResistanceOhms: 20
    },
    faultGuard: {
      maximumAppliedVolts: 24,
      maximumPulseDurationMs: 100,
      minimumPulseIntervalMs: 10_000,
      minimumResistanceOhms: 55_440
    },
    source: {
      excitationVolts: 2.5,
      resistanceOhms: 2_490,
      switchChargeInjectionPcTypical: 1.5,
      switchResistanceMaximumOhms: 9.8,
      tcrPpmPerC: 25
    }
  },
  acquisition: {
    adc: "ADS8881IDGS",
    buffer: "ADA4177-1ARZ",
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
  normalProtectionParts: normalProtectionParts.map((part) => ({ ...part })),
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

function hasUniqueNamedTerms(terms: readonly { readonly term: string }[]): boolean {
  return (
    terms.length > 0 &&
    terms.every((entry) => entry.term.length > 0) &&
    new Set(terms.map(({ term }) => term)).size === terms.length
  )
}

function assertCompleteBudgetInventory(): void {
  if (
    !hasUniqueNamedTerms(errorBudgetTerms) ||
    !hasUniqueNamedTerms(settlingBudgetTerms) ||
    !hasUniqueNamedTerms(leakageBudgetTerms) ||
    !hasUniqueNamedTerms(overloadAndFaultBudgetTerms) ||
    !hasUniqueNamedTerms(faultRecoveryBudgetTerms) ||
    errorBudgetTerms.some((entry) => (entry.credit === "included") !== (entry.errorOhms !== null)) ||
    errorBudgetTerms.some((entry) => entry.credit === "none" && entry.errorOhms !== null) ||
    settlingBudgetTerms.some((entry) => entry.credit === "none" && entry.timeUs !== null) ||
    leakageBudgetTerms.some(
      (entry) => entry.credit === "none" && (entry.maximumNa !== null || entry.errorOhms !== null)
    ) ||
    leakageBudgetTerms.some(
      (entry) => entry.credit !== "none" && (entry.maximumNa === null || entry.errorOhms === null)
    ) ||
    overloadAndFaultBudgetTerms.some((entry) => entry.credit === "none" && entry.value !== null) ||
    overloadAndFaultBudgetTerms.some((entry) => entry.credit === "source-envelope-only" && entry.value === null) ||
    faultRecoveryBudgetTerms.some((entry) => entry.credit !== "none" || entry.measured) ||
    new Set(normalProtectionParts.map(({ reference }) => reference)).size !== normalProtectionParts.length ||
    !["U_ESD", "R_ESD", "U_SOURCE_SWITCH", "U_OVP_BUFFER", "R_SAR", "U_SAR"].every((reference) =>
      normalProtectionParts.some((part) => part.reference === reference)
    )
  ) {
    throw new RangeError("BP-100 must retain a complete, explicit, zero-credit review budget")
  }
}

function currentUpstreamSnapshot() {
  return {
    numericalProvenance: {
      acquisition: {
        adcAcquisitionUs: oneChannelAnalogExperiment.acquisition.adcAcquisitionUs,
        adcConversionMaximumUs: oneChannelAnalogExperiment.acquisition.adcConversionMaximumUs,
        adcInputCapacitancePf: oneChannelAnalogExperiment.acquisition.adcInputCapacitancePf,
        adcInputLeakageMaximumNa: oneChannelAnalogExperiment.acquisition.adcInputLeakageMaximumNa,
        adcIntegralLinearityMaximumLsb: oneChannelAnalogExperiment.acquisition.adcIntegralLinearityMaximumLsb,
        adcOffsetDriftMaximumUvPerC: oneChannelAnalogExperiment.acquisition.adcOffsetDriftMaximumUvPerC,
        adcReferenceVolts: oneChannelAnalogExperiment.acquisition.adcReferenceVolts,
        bufferGainBandwidthTypicalMhz: oneChannelAnalogExperiment.acquisition.bufferGainBandwidthTypicalMhz,
        bufferInputBiasMaximumNa: oneChannelAnalogExperiment.acquisition.bufferInputBiasMaximumNa,
        bufferOffsetMaximumUvAtFullTemperature:
          oneChannelAnalogExperiment.acquisition.bufferOffsetMaximumUvAtFullTemperature,
        bufferOvervoltageBeyondRailVolts: oneChannelAnalogExperiment.acquisition.bufferOvervoltageBeyondRailVolts,
        bufferNegativeRailVolts: oneChannelAnalogExperiment.acquisition.bufferNegativeRailVolts,
        bufferPositiveRailVolts: oneChannelAnalogExperiment.acquisition.bufferPositiveRailVolts,
        sarFilterCapacitancePf: oneChannelAnalogExperiment.acquisition.sarFilterCapacitancePf,
        sarFilterResistanceOhms: oneChannelAnalogExperiment.acquisition.sarFilterResistanceOhms
      },
      faultGuard: {
        maximumAppliedVolts: oneChannelAnalogExperiment.faultGuard.maximumAppliedVolts,
        maximumPulseDurationMs: oneChannelAnalogExperiment.faultGuard.maximumPulseDurationMs,
        minimumPulseIntervalMs: oneChannelAnalogExperiment.faultGuard.minimumPulseIntervalMs,
        minimumResistanceOhms: oneChannelAnalogExperiment.faultGuard.minimumResistanceOhms
      },
      source: {
        excitationVolts: oneChannelAnalogExperiment.source.excitationVolts,
        resistanceOhms: oneChannelAnalogExperiment.source.resistanceOhms,
        switchChargeInjectionPcTypical: oneChannelAnalogExperiment.source.switchChargeInjectionPcTypical,
        switchResistanceMaximumOhms: oneChannelAnalogExperiment.source.switchResistanceMaximumOhms,
        tcrPpmPerC: oneChannelAnalogExperiment.source.tcrPpmPerC
      }
    },
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
    normalProtectionParts: normalProtectionParts.map(({ reference, role }) => {
      const matches = oneChannelAnalogExperimentBom.filter((row) => row.reference === reference)
      const row = matches.length === 1 ? matches[0] : undefined
      return row === undefined
        ? {
            mpn: "__MISSING_OR_DUPLICATE__",
            package: "__MISSING_OR_DUPLICATE__",
            primaryEvidenceUrl: "__MISSING_OR_DUPLICATE__",
            reference,
            role
          }
        : { mpn: row.mpn, package: row.package, primaryEvidenceUrl: row.primaryEvidenceUrl, reference, role }
    }),
    cRef: ref5025OutputCapacitorRequirement,
    adcReferenceNetwork: ads8881ReferenceNetworkRequirement,
    bomReferences: selectedReferences.map(([reference]) => {
      const matches = oneChannelAnalogExperimentBom.filter((row) => row.reference === reference)
      return { reference, mpn: matches.length === 1 ? matches[0]!.mpn : "__MISSING_OR_DUPLICATE__" }
    })
  }
}

export function validateBenchPrototypeAnalogTopology(value: unknown): true {
  assertCompleteBudgetInventory()
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
  if (
    !benchPrototypeAnalogTopology.authority.reviewedBudgetComplete ||
    !benchPrototypeAnalogTopology.authority.topologySelectionAccepted ||
    benchPrototypeAnalogTopology.authority.performanceClaimAccepted ||
    benchPrototypeAnalogTopology.authority.physicalMeasurementsAccepted
  ) {
    throw new RangeError("BP-100 selection acceptance must not be confused with performance or physical acceptance")
  }
  return true
}
