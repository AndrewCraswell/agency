import {
  benchPrototypeSevenChannelAnalog,
  validateBenchPrototypeSevenChannelAnalog
} from "./bench-prototype-seven-channel-analog.js"
import { oneChannelAnalogExperiment } from "./one-channel-analog-experiment.js"
import { oneChannelAnalogExperimentBom } from "./one-channel-analog-readiness.js"

type PlainRecord = Record<PropertyKey, unknown>

const perCellReferences = [
  "U_REF",
  "R_ESD",
  "R_SOURCE",
  "R_SOURCE_PD",
  "U_OVP_BUFFER",
  "R_SAR",
  "C_SAR",
  "U_SAR",
  "C_REF_REG",
  "C_REF_IN",
  "C_REF_REG_HF",
  "R_REF_SAR",
  "C_REF",
  "C_BUFFER_POS",
  "C_BUFFER_NEG",
  "C_SAR_AVDD",
  "C_SAR_DVDD"
] as const

const sharedRailReferences = ["U_NEGATIVE_RAIL", "C_NEG_FLY", "C_NEG_IN", "C_NEG_OUT"] as const

const sourceVoltageV = oneChannelAnalogExperiment.source.excitationVolts
const sourceResistorOhms = oneChannelAnalogExperiment.source.resistanceOhms
const channelCount = benchPrototypeSevenChannelAnalog.channels.length
const sourceOnCurrentA = sourceVoltageV / sourceResistorOhms

const supplyVoltage = {
  v5AnalogV: oneChannelAnalogExperiment.analogPower.positiveNominalVolts,
  v5NegativeMagnitudeV: Math.abs(oneChannelAnalogExperiment.analogPower.negativeNominalVolts),
  app3v3V: 3.3,
  referenceV: oneChannelAnalogExperiment.acquisition.adcReferenceVolts
} as const

const paperBounds = {
  ada4177SupplyCurrentPerAmplifierA: 0.0006,
  ads8881AvddCurrentPerConverterA: 0.0024,
  ref5025QuiescentCurrentPerReferenceA: 0.0012,
  ref5025OutputCapacityA: 0.01,
  tmux1112SupplyCurrentPerPackageA: 0.000001,
  sn74hcs595SupplyCurrentA: 0.000002,
  tps60400QuiescentInputCurrentA: 0.00027,
  tps60400OutputCurrentCapacityA: oneChannelAnalogExperiment.analogPower.negativeCurrentMaximumMa / 1_000
} as const

function isPlainRecord(value: unknown): value is PlainRecord {
  return value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) throw new RangeError("BP-050 analog budget cannot contain aliases or cycles")
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError("BP-050 analog budget allows data properties only")
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

  if (Array.isArray(actual) !== Array.isArray(expected)) return false
  if (Array.isArray(expected)) {
    if (Object.getPrototypeOf(actual) !== Array.prototype || Object.getPrototypeOf(expected) !== Array.prototype) {
      return false
    }
  } else if (!isPlainRecord(actual) || !isPlainRecord(expected)) {
    return false
  }

  const actualKeys = Reflect.ownKeys(actual)
  const expectedKeys = Reflect.ownKeys(expected)
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key) => typeof key === "symbol" || !expectedKeys.includes(key))
  ) {
    return false
  }

  return expectedKeys.every((key) => {
    if (typeof key === "symbol") return false
    const actualDescriptor = Object.getOwnPropertyDescriptor(actual, key)
    const expectedDescriptor = Object.getOwnPropertyDescriptor(expected, key)
    return Boolean(
      actualDescriptor &&
      expectedDescriptor &&
      "value" in actualDescriptor &&
      "value" in expectedDescriptor &&
      actualDescriptor.enumerable === expectedDescriptor.enumerable &&
      sameDataGraph(actualDescriptor.value, expectedDescriptor.value, actualSeen, expectedSeen)
    )
  })
}

function selectedPart(reference: string) {
  const matches = oneChannelAnalogExperimentBom.filter((part) => part.reference === reference)
  if (matches.length !== 1) throw new RangeError(`BP-050 analog budget requires exactly one ${reference} source row`)
  const [part] = matches
  if (part === undefined || !part.circuitPresent || !part.dnp) {
    throw new RangeError(`BP-050 analog budget source row ${reference} is not the selected DNP topology row`)
  }
  return {
    reference: part.reference,
    mpn: part.mpn,
    package: part.package,
    quantity: channelCount,
    sourceBomDnp: part.dnp
  }
}

function sharedPart(reference: string) {
  const matches = oneChannelAnalogExperimentBom.filter((part) => part.reference === reference)
  if (matches.length !== 1) throw new RangeError(`BP-050 analog budget requires exactly one ${reference} source row`)
  const [part] = matches
  if (part === undefined || !part.circuitPresent || !part.dnp) {
    throw new RangeError(`BP-050 analog budget source row ${reference} is not the selected DNP topology row`)
  }
  return {
    reference: part.reference,
    mpn: part.mpn,
    package: part.package,
    quantity: 1,
    sourceBomDnp: part.dnp
  }
}

const perCellParts = perCellReferences.map((reference) => selectedPart(reference))
const sharedRailParts = [
  ...sharedRailReferences.map((reference) => sharedPart(reference)),
  { reference: "U_ESD", mpn: "TPD4E05U06DQAR", package: "USON-10", quantity: 2, sourceBomDnp: true },
  { reference: "U_SOURCE_SWITCH", mpn: "TMUX1112PWR", package: "TSSOP-16", quantity: 2, sourceBomDnp: true },
  { reference: "C_MUX", mpn: "C0603C104K3RACTU", package: "0603", quantity: 2, sourceBomDnp: true },
  { reference: "U_SOURCE_CONTROL", mpn: "SN74HCS595PWR", package: "TSSOP-16", quantity: 1, sourceBomDnp: true },
  { reference: "C_SOURCE_CONTROL", mpn: "C0603C104K3RACTU", package: "0603", quantity: 1, sourceBomDnp: true },
  {
    reference: "R_SOURCE_OE_PULLUP",
    mpn: "CRCW0603100KFKEAHP",
    package: "0603",
    quantity: 1,
    sourceBomDnp: true
  }
]

const sourceCurrentTotalA = sourceOnCurrentA * channelCount
const negativeBufferCurrentTotalA = paperBounds.ada4177SupplyCurrentPerAmplifierA * channelCount
const chargePumpInputCurrentScreenA = negativeBufferCurrentTotalA + paperBounds.tps60400QuiescentInputCurrentA
const ref5025QuiescentCurrentTotalA = paperBounds.ref5025QuiescentCurrentPerReferenceA * channelCount
const positiveBufferCurrentTotalA = negativeBufferCurrentTotalA
const v5AnalogContinuousCurrentA =
  ref5025QuiescentCurrentTotalA + sourceCurrentTotalA + positiveBufferCurrentTotalA + chargePumpInputCurrentScreenA
const tmuxSupplyCurrentTotalA = paperBounds.tmux1112SupplyCurrentPerPackageA * 2
const sourceEnablePulldownCurrentTotalA = (supplyVoltage.app3v3V / 100_000) * channelCount
const sourceOutputEnablePullupCurrentA = supplyVoltage.app3v3V / 100_000
const ads8881AvddCurrentTotalA = paperBounds.ads8881AvddCurrentPerConverterA * channelCount
const app3v3BoundedSubtotalCurrentA =
  tmuxSupplyCurrentTotalA +
  paperBounds.sn74hcs595SupplyCurrentA +
  sourceEnablePulldownCurrentTotalA +
  sourceOutputEnablePullupCurrentA +
  ads8881AvddCurrentTotalA

function round(value: number): number {
  return Number(value.toFixed(12))
}

const capacitanceUf = {
  v5Analog: round((1 + 0.1) * channelCount + 1),
  v5Negative: round(0.1 * channelCount + 1),
  app3v3: round((1 + 1) * channelCount + 0.1 * 3),
  reference: round((10 + 0.1 + 10) * channelCount)
} as const

const startupRampTimeMs = 1
const startupRampTimeS = startupRampTimeMs / 1_000
const startupCapacitorCurrentA = {
  v5Analog: (capacitanceUf.v5Analog * 1e-6 * supplyVoltage.v5AnalogV) / startupRampTimeS,
  v5Negative: (capacitanceUf.v5Negative * 1e-6 * supplyVoltage.v5NegativeMagnitudeV) / startupRampTimeS,
  app3v3: (capacitanceUf.app3v3 * 1e-6 * supplyVoltage.app3v3V) / startupRampTimeS,
  reference: (capacitanceUf.reference * 1e-6 * supplyVoltage.referenceV) / startupRampTimeS
} as const

const referenceTransientPulse = {
  chargeNcPerCell: 100,
  pulseWidthUs: 1,
  perCellCurrentA: 100e-3,
  aggregateCurrentA: round(100e-3 * channelCount),
  localReservoirMinimumUf: 8,
  localCapacitiveDroopMv: 100 / 8,
  localEsrStepMv: 100e-3 * 0.1 * 1_000,
  localUnregulatedStepMv: 100 / 8 + 100e-3 * 0.1 * 1_000,
  credit: "none",
  basis:
    "BP-101 illustrative passive-only 100 nC, 1 us stimulus; it is not an ADS8881 conversion-current claim or an upper bound"
} as const

const upstreamSnapshot = {
  channelCount,
  channelOrder: [...benchPrototypeSevenChannelAnalog.channelOrder],
  perCellMpnBindings: perCellReferences.map((reference) => {
    const selected = selectedPart(reference)
    return { reference, mpn: selected.mpn, quantity: selected.quantity }
  }),
  sharedRailMpnBindings: sharedRailReferences.map((reference) => {
    const selected = sharedPart(reference)
    return { reference, mpn: selected.mpn, quantity: selected.quantity }
  }),
  selectedRails: {
    positive: oneChannelAnalogExperiment.analogPower.positiveSource,
    negative: oneChannelAnalogExperiment.analogPower.negativeGenerator,
    application: "APP_3V3",
    reference: "REF_2V5",
    ground: "SCORING_SGND"
  }
}

const definition = {
  artifactKind: "bench-prototype-p0-analog-reference-rail-budget",
  workUnit: "BP-050",
  status: "paper-arithmetic-only",
  decision: "add-the-selected-seven-cell-analog-loads-to-the-BP-050-rail-graph",
  scope: {
    included: [
      "the selected one-channel protected acquisition topology",
      "seven explicit cells from BP-103",
      "one shared TPS60400 negative-rail generator and its charge-pump capacitors",
      "REF5025, ADA4177, ADS8881, TMUX, source-enable pull-down, and local capacitor rail loads"
    ],
    excluded: [
      "STM32G474RET3TR supply, GPIO, ADC, and processor loads",
      "NXE1S0505MC or any processor-isolation converter and isolated-link loads",
      "all one-channel BOM rows marked DNP as a populated physical load",
      "ESP32, Ethernet, HUB75, IR, primary-output, USB-PD, eFuse, display, and V5 buck loads already owned by other BP-050 slices"
    ],
    dnpDisposition:
      "DNP rows provide the selected topology identities and paper current bounds only; no DNP row is evidence of population or measured load"
  },
  quantities: {
    channelCount,
    perCellPartCount: perCellParts.length,
    perCellElectricalPartQuantity: perCellParts.reduce((sum, part) => sum + part.quantity, 0),
    perCellParts,
    sharedRailPartCount: sharedRailParts.length,
    sharedRailElectricalPartQuantity: sharedRailParts.reduce((sum, part) => sum + part.quantity, 0),
    sharedRailParts,
    totalElectricalTopologyQuantity:
      perCellParts.reduce((sum, part) => sum + part.quantity, 0) +
      sharedRailParts.reduce((sum, part) => sum + part.quantity, 0)
  },
  railGraph: {
    source: "BP-050 V5 output from U_V5_BUCK TPS56A37RPAR",
    rails: [
      {
        net: "V5_ANALOG",
        nominalVoltageV: supplyVoltage.v5AnalogV,
        returnNet: "SCORING_SGND",
        consumers: [
          "U_REF_n.IN for seven REF5025AQDRQ1 references",
          "U_OVP_BUFFER_n positive supply for seven ADA4177-1ARZ buffers",
          "U_NEGATIVE_RAIL.VIN for the shared TPS60400DBVR negative rail"
        ]
      },
      {
        net: "VNEG_ANALOG",
        nominalVoltageV: -supplyVoltage.v5NegativeMagnitudeV,
        returnNet: "SCORING_SGND",
        consumers: ["U_OVP_BUFFER_n negative supply for seven ADA4177-1ARZ buffers"]
      },
      {
        net: "APP_3V3",
        nominalVoltageV: supplyVoltage.app3v3V,
        returnNet: "SCORING_SGND",
        consumers: [
          "U_SOURCE_SWITCH_1..2 and U_SOURCE_CONTROL on APP_3V3",
          "U_SAR_n.AVDD and DVDD for seven ADS8881IDGS converters",
          "seven source-select pulldowns plus the SOURCE_OE_N hardware-disable pull-up"
        ]
      },
      {
        net: "REF_2V5_n",
        nominalVoltageV: supplyVoltage.referenceV,
        returnNet: "SCORING_SGND",
        consumers: [
          "R_SOURCE_n and U_SOURCE_SWITCH_n source path to each external conductor",
          "R_REF_SAR_n and C_REF_n to each ADS8881IDGS REF input"
        ]
      }
    ],
    edges: [
      "V5 -> V5_ANALOG -> U_REF_n.IN and U_OVP_BUFFER_n.V+ for n=1..7",
      "V5_ANALOG -> U_NEGATIVE_RAIL.VIN -> U_NEGATIVE_RAIL.VOUT -> VNEG_ANALOG -> U_OVP_BUFFER_n.V- for n=1..7",
      "APP_3V3 -> U_SOURCE_SWITCH_1..2, U_SOURCE_CONTROL, U_SAR_n.AVDD, and U_SAR_n.DVDD",
      "U_REF_n.OUT -> REF_2V5_n -> R_SOURCE_n -> one TMUX1112 channel for n=1..7",
      "U_REF_n.OUT -> R_REF_SAR_n -> C_REF_n -> U_SAR_n.REF for n=1..7",
      "all analog returns, ADC AINN, reference returns, charge-pump ground, and local bypass returns -> SCORING_SGND",
      "SCORING_3V3, STM32 supply, and any isolation-domain rail are not vertices in this clean-sheet graph"
    ]
  },
  arithmetic: {
    assumptions: {
      sourceOnState: "all seven source paths on and each external line at the 0 ohm worst-current screen",
      peakDurationMs: 100,
      sourceCurrentFormula: "I_SOURCE = 2.5 V / 2.49 kohm",
      startupRampTimeMs,
      startupRampDisposition: "declared arithmetic screen only; no rail slew or regulator startup credit",
      chargePumpInputDisposition:
        "ideal-current screen adds the seven buffer negative-rail loads and the TPS60400 no-load maximum; efficiency and ripple remain open",
      app3v3Disposition:
        "bounded AVDD, TMUX, and source-pulldown subtotal only; ADS8881 DVDD, serial I/O, and conversion-phase current remain unbounded"
    },
    continuous: {
      duration: "steady-state screen",
      v5AnalogCurrentA: v5AnalogContinuousCurrentA,
      v5AnalogPowerW: v5AnalogContinuousCurrentA * supplyVoltage.v5AnalogV,
      v5NegativeOutputCurrentA: negativeBufferCurrentTotalA,
      v5NegativeOutputPowerW: negativeBufferCurrentTotalA * supplyVoltage.v5NegativeMagnitudeV,
      app3v3BoundedSubtotalCurrentA: app3v3BoundedSubtotalCurrentA,
      app3v3BoundedSubtotalPowerW: app3v3BoundedSubtotalCurrentA * supplyVoltage.app3v3V,
      referenceOutputCurrentA: sourceCurrentTotalA,
      referenceOutputPowerW: sourceCurrentTotalA * supplyVoltage.referenceV,
      referenceOutputCapacityMarginBeforeUnknownLoadsA: paperBounds.ref5025OutputCapacityA - sourceCurrentTotalA,
      completeRailTotal: false,
      physicalEvidence: "not-measured"
    },
    peak: {
      durationMs: 100,
      v5AnalogCurrentA: v5AnalogContinuousCurrentA,
      v5NegativeOutputCurrentA: negativeBufferCurrentTotalA,
      app3v3BoundedSubtotalCurrentA: app3v3BoundedSubtotalCurrentA,
      referenceOutputCurrentA: sourceCurrentTotalA,
      completeRailTotal: false,
      physicalEvidence: "not-measured",
      openLoads: [
        "ADS8881 DVDD and serial-I/O current at the selected 20 MHz daisy-chain activity",
        "ADS8881 conversion-phase REF current and reference-loop recovery",
        "TPS60400 efficiency, output impedance, ripple, and thermal current margin",
        "simultaneous source-switch charge injection and rail disturbance"
      ]
    },
    startup: {
      declaredRampTimeMs: startupRampTimeMs,
      capacitanceUf: capacitanceUf,
      capacitorOnlyCurrentScreenA: startupCapacitorCurrentA,
      simultaneousRailChargeScreenA:
        startupCapacitorCurrentA.v5Analog +
        startupCapacitorCurrentA.v5Negative +
        startupCapacitorCurrentA.app3v3 +
        startupCapacitorCurrentA.reference,
      credit: "none",
      physicalEvidence: "not-measured",
      openEvidence: [
        "V5 buck soft-start and V5_ANALOG branch sequencing",
        "TPS60400 startup and negative-rail validity",
        "REF5025 turn-on and seven-cell reference-capacitor charging",
        "APP_3V3 regulator startup, ADC reset state, and source-enable default",
        "brownout, discharge, and back-power behavior"
      ]
    },
    transient: {
      referencePulse: referenceTransientPulse,
      sourceEnableAllOnStepA: sourceCurrentTotalA,
      negativeBufferAllOnStepA: negativeBufferCurrentTotalA,
      app3v3ConversionCurrentA: null,
      credit: "none",
      physicalEvidence: "not-measured",
      openEvidence: [
        "measured REF5025 OUT and ADS_REF2V5 traces during one conversion and seven-converter bursts",
        "measured V5_ANALOG and VNEG_ANALOG ripple, load-step response, and return-current coupling",
        "measured APP_3V3 AVDD/DVDD and serial-I/O current at the selected scan cadence",
        "effective capacitance, ESR/ESL, placement, and extracted return inductance",
        "V5 buck and APP_3V3 regulator efficiency, loss, and 20 V source-current reconciliation with the other BP-050 slices"
      ]
    }
  },
  evidence: {
    continuous: { state: "paper-screen", measured: false },
    peak: { state: "paper-screen", measured: false },
    startup: { state: "unmeasured-gate", measured: false },
    transient: { state: "unmeasured-gate", measured: false },
    openPhysicalEvidence: [
      "Exact assembled-part manifest and received-part inspection",
      "V5_ANALOG, VNEG_ANALOG, APP_3V3, REF5025 OUT, and ADS_REF2V5 voltage/current/ripple captures",
      "cold, room, and hot startup, brownout, power-off, and discharge traces",
      "single-channel and simultaneous-seven-channel conversion/load-step captures",
      "TPS60400 negative-rail efficiency, output impedance, ripple, temperature, and fault recovery",
      "REF5025 dynamic-load and ADS8881 conversion-phase reference-current correlation",
      "effective capacitor value under DC bias, ESR/ESL, layout return, and thermal evidence",
      "V5 buck and APP_3V3 conversion loss and one non-duplicated BP-050 20 V total",
      "schematic/ERC, footprint, placement, routing, DRC, and independent BP-050 power review"
    ],
    decision: "DENY: arithmetic is feed-forward input to BP-050 and is not physical power proof"
  },
  upstreamSnapshot,
  authority: {
    feedsBp050: true,
    completeRailBudgetPassed: false,
    physicalPowerEvidencePassed: false,
    fabricationAuthorized: false,
    releaseState: "deny"
  }
} as const

const expectedUpstreamSnapshot = deepFreeze(structuredClone(upstreamSnapshot))

function currentUpstreamSnapshot() {
  return {
    channelCount: benchPrototypeSevenChannelAnalog.channels.length,
    channelOrder: [...benchPrototypeSevenChannelAnalog.channelOrder],
    perCellMpnBindings: perCellReferences.map((reference) => {
      const selected = selectedPart(reference)
      return { reference, mpn: selected.mpn, quantity: selected.quantity }
    }),
    sharedRailMpnBindings: sharedRailReferences.map((reference) => {
      const selected = sharedPart(reference)
      return { reference, mpn: selected.mpn, quantity: selected.quantity }
    }),
    selectedRails: {
      positive: oneChannelAnalogExperiment.analogPower.positiveSource,
      negative: oneChannelAnalogExperiment.analogPower.negativeGenerator,
      application: "APP_3V3",
      reference: "REF_2V5",
      ground: "SCORING_SGND"
    }
  }
}

export const benchPrototypeP0AnalogRailBudget = deepFreeze(definition)

export function validateBenchPrototypeP0AnalogRailBudget(value: unknown): true {
  validateBenchPrototypeSevenChannelAnalog(benchPrototypeSevenChannelAnalog)
  if (!sameDataGraph(currentUpstreamSnapshot(), expectedUpstreamSnapshot)) {
    throw new RangeError("BP-050 analog budget upstream topology or quantity inputs drifted")
  }
  if (!sameDataGraph(value, benchPrototypeP0AnalogRailBudget)) {
    throw new RangeError("BP-050 analog budget must exactly match the reviewed rail graph and arithmetic")
  }
  if (
    benchPrototypeP0AnalogRailBudget.quantities.channelCount !== 7 ||
    benchPrototypeP0AnalogRailBudget.quantities.perCellPartCount !== 17 ||
    benchPrototypeP0AnalogRailBudget.quantities.sharedRailPartCount !== 10 ||
    benchPrototypeP0AnalogRailBudget.arithmetic.continuous.completeRailTotal ||
    benchPrototypeP0AnalogRailBudget.arithmetic.peak.completeRailTotal ||
    benchPrototypeP0AnalogRailBudget.authority.completeRailBudgetPassed ||
    benchPrototypeP0AnalogRailBudget.authority.physicalPowerEvidencePassed ||
    benchPrototypeP0AnalogRailBudget.authority.releaseState !== "deny"
  ) {
    throw new RangeError("BP-050 analog budget must retain seven-cell quantities and open evidence gates")
  }
  return true
}
