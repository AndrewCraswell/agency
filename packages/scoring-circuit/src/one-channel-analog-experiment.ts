import { z } from "zod"
import { parseCanonicalUtcTimestamp } from "./bench-prototype-evidence-time.js"

/**
 * One-channel, non-production experiment after the PGA855/LTC2373 rejection.
 *
 * This documentable circuit intentionally uses an OVP buffer and a grounded
 * true-differential SAR input. It is a learning article only: none of these
 * arithmetic screens permits procurement, fabrication, a seven-channel design,
 * or a scoring claim.
 */
export const oneChannelAnalogExperiment = {
  authorization: false,
  fabrication: {
    apparatusBomIncluded: false,
    copperReleased: false,
    dnp: true,
    fabricationAuthorized: false
  },
  state: "deny",
  source: {
    excitationVolts: 2.5,
    maximumResistanceOhms: 2_490 * 1.001,
    resistanceOhms: 2_490,
    resistancePart: "ERA3AEB2491V",
    switch: "TMUX1112PWR",
    switchChargeInjectionPcTypical: 1.5,
    switchResistanceMaximumOhms: 9.8,
    tcrPpmPerC: 25
  },
  acquisition: {
    adc: "ADS8881IDGS",
    adcAcquisitionUs: 0.29,
    adcConversionMaximumUs: 0.71,
    adcInputCapacitancePf: 59,
    adcInputLeakageMaximumNa: 5,
    adcIntegralLinearityMaximumLsb: 3,
    adcOffsetDriftMaximumUvPerC: 1.5,
    adcReferenceVolts: 2.5,
    buffer: "ADA4177-1BRZ",
    bufferGainBandwidthTypicalMhz: 3.5,
    bufferInputBiasMaximumNa: 1,
    bufferOffsetMaximumUvAtFullTemperature: 120,
    bufferOvervoltageBeyondRailVolts: 32,
    bufferPositiveRailVolts: 5,
    bufferNegativeRailVolts: -5,
    bufferQuiescentCurrentTypicalMa: 0.5,
    inputCommonModeMinimumVolts: -1.5,
    inputCommonModeMaximumVolts: 1.5,
    sarFilterCapacitancePf: 1_000,
    sarFilterPart: "C0603C102J5GACTU",
    sarFilterResistanceOhms: 20,
    sarFilterResistancePart: "CRCW060320R0FKEAHP"
  },
  faultGuard: {
    maximumAppliedVolts: 24,
    maximumPulseDurationMs: 100,
    minimumPulseIntervalMs: 10_000,
    minimumResistanceOhms: 56_000 * 0.99,
    resistanceOhms: 56_000,
    resistancePart: "CRCW120656K0FKEAHP"
  },
  analogPower: {
    positiveSource: "TPS56A37RPAR V5",
    positiveNominalVolts: 5,
    negativeGenerator: "TPS60400DBVR",
    negativeNominalVolts: -5,
    negativeCurrentMaximumMa: 60,
    groundSystem: "SCORING_SGND quiet region with one reviewed connection to APP_GND",
    reference: "REF5025AQDRQ1",
    regulator3v3: "LMR43620MSC3RPERQ1"
  },
  physicalPinMaps: {
    ads8881Dgs: {
      1: "REF",
      2: "AVDD",
      3: "AINP",
      4: "AINN",
      5: "GND",
      6: "CONVST",
      7: "DOUT",
      8: "SCLK",
      9: "DIN",
      10: "DVDD"
    },
    tps60400Dbv: { 1: "OUT", 2: "IN", 3: "CFLY-", 4: "GND", 5: "CFLY+" }
  },
  testCorners: {
    capacitancePf: [500, 2_000, 5_000, 10_000],
    resistanceOhms: [0, 10, 95, 100, 105, 445, 450, 455, 470, 475, 480, 495, 500, 505],
    temperatureC: [-40, 25, 85, 125]
  }
} as const

export function expectedExperimentSenseVoltage(externalResistanceOhms: number): number {
  if (Number.isNaN(externalResistanceOhms) || externalResistanceOhms < 0) {
    throw new RangeError("externalResistanceOhms must be non-negative or positive infinity")
  }
  if (!Number.isFinite(externalResistanceOhms)) return oneChannelAnalogExperiment.source.excitationVolts
  const { excitationVolts, resistanceOhms } = oneChannelAnalogExperiment.source
  return (excitationVolts * externalResistanceOhms) / (resistanceOhms + externalResistanceOhms)
}

function sourceTheveninResistanceOhms(externalResistanceOhms: number): number {
  if (!Number.isFinite(externalResistanceOhms)) return oneChannelAnalogExperiment.source.resistanceOhms
  const source = oneChannelAnalogExperiment.source.resistanceOhms
  return (source * externalResistanceOhms) / (source + externalResistanceOhms)
}

function resistanceSensitivityVoltsPerOhm(externalResistanceOhms: number): number {
  const { excitationVolts, resistanceOhms } = oneChannelAnalogExperiment.source
  return (excitationVolts * resistanceOhms) / (resistanceOhms + externalResistanceOhms) ** 2
}

function resistanceErrorForVoltage(externalResistanceOhms: number, voltageErrorVolts: number): number {
  return Math.abs(voltageErrorVolts / resistanceSensitivityVoltsPerOhm(externalResistanceOhms))
}

/**
 * Published device-range check. The buffer is powered at plus/minus 5 V and
 * the SAR's AINN is SGND, so a normal source-on signal is 0 V to 2.5 V at the
 * buffer and 0 V to 2.5 V differential at the converter. This experiment only
 * uses the 0 V to roughly 0.42 V resistance region.
 */
export function oneChannelNormalRangeScreen(externalResistanceOhms: number) {
  const inputVolts = expectedExperimentSenseVoltage(externalResistanceOhms)
  const acquisition = oneChannelAnalogExperiment.acquisition
  const adcCommonModeVolts = inputVolts / 2

  return {
    adcAinnVolts: 0,
    adcAinpVolts: inputVolts,
    adcCommonModeVolts,
    adcInputPinsWithinZeroToReference: inputVolts >= 0 && inputVolts <= acquisition.adcReferenceVolts,
    bufferInputWithinPublishedRange:
      inputVolts >= acquisition.inputCommonModeMinimumVolts && inputVolts <= acquisition.inputCommonModeMaximumVolts,
    normalInputVolts: inputVolts,
    normativeZeroOhmCovered: externalResistanceOhms === 0 && inputVolts === 0
  }
}

/**
 * The guarded lane is a source envelope only. It deliberately does not claim
 * sustained fault, unpowered behavior, clamp temperature, or production fault
 * isolation. The OVP range is evaluated with the experiment's common-ground plus/minus 5 V
 * rails, not an imagined single-supply operation.
 */
export function oneChannelGuardedFaultScreen(appliedVolts: number) {
  if (
    !Number.isFinite(appliedVolts) ||
    Math.abs(appliedVolts) > oneChannelAnalogExperiment.faultGuard.maximumAppliedVolts
  ) {
    throw new RangeError("appliedVolts must be finite and within the guarded plus/minus 24 V envelope")
  }
  const { faultGuard, acquisition } = oneChannelAnalogExperiment
  const currentA = Math.abs(appliedVolts) / faultGuard.minimumResistanceOhms
  const sourcePowerW = appliedVolts ** 2 / faultGuard.minimumResistanceOhms
  const sourceEnergyJ = sourcePowerW * (faultGuard.maximumPulseDurationMs / 1_000)
  const abovePositiveRailVolts = Math.max(0, appliedVolts - acquisition.bufferPositiveRailVolts)
  const belowNegativeRailVolts = Math.max(0, acquisition.bufferNegativeRailVolts - appliedVolts)

  return {
    appliedVolts,
    belowNegativeRailVolts,
    currentA,
    maximumSourceEnergyJ: sourceEnergyJ,
    maximumSourcePowerW: sourcePowerW,
    ovpRangeCovered:
      abovePositiveRailVolts <= acquisition.bufferOvervoltageBeyondRailVolts &&
      belowNegativeRailVolts <= acquisition.bufferOvervoltageBeyondRailVolts,
    abovePositiveRailVolts,
    sourceEnvelopeOnly: true
  }
}

/**
 * Pre-capture error arithmetic at the 450-ohm foil boundary. The source path
 * is re-calibrated at each temperature and rail point in this experiment; the
 * calculation therefore cannot be used to waive source-switch drift or to
 * approve a production calibration policy.
 */
export function oneChannelStaticScreen(externalResistanceOhms: number, temperatureC: number) {
  if (!Number.isFinite(externalResistanceOhms) || externalResistanceOhms < 0) {
    throw new RangeError("externalResistanceOhms must be finite and non-negative")
  }
  if (!Number.isFinite(temperatureC)) throw new RangeError("temperatureC must be finite")
  const { acquisition, source } = oneChannelAnalogExperiment
  const temperatureDeltaC = Math.abs(temperatureC - 25)
  const lsbVolts = acquisition.adcReferenceVolts / (2 ** 18 - 1)
  const sourceResistanceDeltaOhms = source.resistanceOhms * source.tcrPpmPerC * temperatureDeltaC * 1e-6
  const breakdown = {
    adcIntegralLinearity: resistanceErrorForVoltage(
      externalResistanceOhms,
      lsbVolts * acquisition.adcIntegralLinearityMaximumLsb
    ),
    adcOffsetDriftAfter25cCalibration: resistanceErrorForVoltage(
      externalResistanceOhms,
      acquisition.adcOffsetDriftMaximumUvPerC * temperatureDeltaC * 1e-6
    ),
    bufferInputBias: resistanceErrorForVoltage(
      externalResistanceOhms,
      sourceTheveninResistanceOhms(externalResistanceOhms) * acquisition.bufferInputBiasMaximumNa * 1e-9
    ),
    bufferOffset: resistanceErrorForVoltage(
      externalResistanceOhms,
      acquisition.bufferOffsetMaximumUvAtFullTemperature * 1e-6
    ),
    fixtureAllocation: 0.5,
    sourceResistorTemperature: (externalResistanceOhms / source.resistanceOhms) * sourceResistanceDeltaOhms
  }
  const totalOhms = Object.values(breakdown).reduce((total, value) => total + value, 0)

  return {
    arithmeticWithinFourPointFiveOhms: totalOhms <= 4.5,
    breakdown,
    lsbVolts,
    requiresPerCornerTwoPointCalibration: true,
    totalOhms,
    validatesAccuracy: false
  }
}

/**
 * Normal source-on timing arithmetic only. The buffer contribution derives
 * from its typical unity-gain bandwidth and is intentionally not a guaranteed
 * settling specification. Fault recovery, switch-memory, PCB extraction,
 * firmware scheduling, and comparator timing receive no credit.
 */
export function oneChannelSabreTimingScreen() {
  const { acquisition } = oneChannelAnalogExperiment
  const sabreResistanceOhms = 100
  const lineCapacitancePf = 10_000
  const sourceFiveTimeConstantsUs = sourceTheveninResistanceOhms(sabreResistanceOhms) * lineCapacitancePf * 5e-6
  const idealBuffer18BitSettlingUs = Math.log(2 ** 19) / (2 * Math.PI * acquisition.bufferGainBandwidthTypicalMhz)
  const sarCapacitancePf = acquisition.sarFilterCapacitancePf + acquisition.adcInputCapacitancePf
  const sarFilter18BitSettlingUs = acquisition.sarFilterResistanceOhms * sarCapacitancePf * Math.log(2 ** 19) * 1e-6
  const adcCycleUs = acquisition.adcAcquisitionUs + acquisition.adcConversionMaximumUs
  const totalArithmeticUs =
    sourceFiveTimeConstantsUs + idealBuffer18BitSettlingUs + sarFilter18BitSettlingUs + adcCycleUs

  return {
    adcCycleUs,
    arithmeticWithinTenUs: totalArithmeticUs <= 10,
    excludesFaultRecoveryFirmwareAndBoardParasitics: true,
    idealBuffer18BitSettlingUs,
    sarFilter18BitSettlingUs,
    sourceFiveTimeConstantsUs,
    totalArithmeticUs,
    validatesSabreCapture: false
  }
}

/**
 * Known typical loads are intentionally separated from a worst-case closure.
 * The common-ground charge pump has ample paper current for one buffer, while
 * ripple, startup, injected-fault, and seven-channel load evidence stays open.
 */
export function oneChannelAnalogPowerScreen() {
  const { acquisition, analogPower } = oneChannelAnalogExperiment
  const knownTypicalNegativeMa = acquisition.bufferQuiescentCurrentTypicalMa + 0.2

  return {
    negativeRailCurrentMaximumMa: analogPower.negativeCurrentMaximumMa,
    knownTypicalNegativeMa,
    remainingNegativeCurrentTypicalMa: analogPower.negativeCurrentMaximumMa - knownTypicalNegativeMa,
    typicalOnly: true,
    worstCaseLoadClosed: false
  }
}

export function assessOneChannelAnalogExperiment() {
  return {
    authorization: false as const,
    fault: {
      negative24V: oneChannelGuardedFaultScreen(-24),
      positive24V: oneChannelGuardedFaultScreen(24)
    },
    normalRanges: {
      foil450Ohms: oneChannelNormalRangeScreen(450),
      zeroOhms: oneChannelNormalRangeScreen(0)
    },
    power: oneChannelAnalogPowerScreen(),
    sabre: oneChannelSabreTimingScreen(),
    static450Ohms125C: oneChannelStaticScreen(450, 125),
    state: "deny" as const,
    unresolvedGates: [
      "The guarded plus/minus 24 V lane is low-energy characterization only and has no sustained, surge, ESD, EFT, unpowered, brownout, or apparatus-fault authority.",
      "ADA4177 overload recovery, ADS8881 input behavior, reference disturbance, and ADC code validity during or after a guarded fault require measured evidence before the converter remains connected.",
      "The timing screen uses typical buffer bandwidth and excludes switch memory, board and cable parasitics, firmware scheduling, comparator qualification, and fault recovery.",
      "The 450-ohm arithmetic omits TMUX on-resistance and leakage, TPD leakage, ADC input leakage and offset, reference load/transient behavior, all resistor/capacitor tolerances, and several temperature terms. It requires calibration at each corner and is not a production calibration policy, full uncertainty budget, or threshold authorization.",
      "The ADC reference needs its own dynamic-drive and placement evidence. The 10-uF reference capacitor value does not prove a REF5025A-Q1 transient response or a quiet reference return.",
      "The common-ground analog-power screen contains known typical loads only. V5 startup, charge-pump efficiency/ripple, reference transient current, thermal operation, and worst-case rail load remain unclosed.",
      "This one channel has no seven-channel multiplexing, crosstalk, simultaneous fault, enclosure, EMC, connector, footprint, or fabrication evidence."
    ]
  }
}

const measurementSchema = z
  .object({
    adcCodes: z
      .array(
        z
          .number()
          .int()
          .min(0)
          .max(2 ** 18 - 1)
      )
      .min(3),
    calibrationId: z.string().min(1),
    measuredResistanceOhms: z.array(z.number().finite().min(0)).min(3),
    standardResistanceOhms: z.number().finite().min(0)
  })
  .strict()
  .superRefine((measurement, context) => {
    if (measurement.adcCodes.length !== measurement.measuredResistanceOhms.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "adcCodes and measuredResistanceOhms must have equal lengths",
        path: ["measuredResistanceOhms"]
      })
    }
  })

const testPointSchema = z
  .object({
    adcAinnV: z.number().finite(),
    adcAinpV: z.number().finite(),
    analogNegativeRailV: z.number().finite(),
    analogPositiveRailV: z.number().finite(),
    bufferInputV: z.number().finite(),
    bufferOutputV: z.number().finite(),
    lineV: z.number().finite(),
    referenceV: z.number().finite()
  })
  .strict()

const traceSchema = z
  .object({
    nodes: z
      .array(
        z.enum([
          "line",
          "post-tpd",
          "quiet",
          "buffer-input",
          "buffer-output",
          "adc-ainp",
          "adc-ainn",
          "reference",
          "analog-plus-rail",
          "analog-negative-rail",
          "force-voltage",
          "force-current"
        ])
      )
      .min(1),
    sampleRateHz: z.number().finite().positive(),
    sha256: z.string().regex(/^[0-9a-f]{64}$/u),
    traceId: z.string().min(1)
  })
  .strict()

const incidentControlSchema = z
  .object({
    adcCodeObservedExpected: z.boolean(),
    currentTripObservedArmed: z.boolean(),
    dwellTimerObservedSatisfied: z.boolean(),
    dwellTimerWitnessId: z.string().min(1),
    fixtureInterlockCertificateId: z.string().min(1),
    fixturePermitObserved: z.boolean(),
    fixturePowerObservedGood: z.boolean(),
    forceRelayCommandedClosed: z.boolean(),
    forceRelayObservedClosed: z.boolean(),
    negativeRailObservedHealthy: z.boolean(),
    overloadObservedClear: z.boolean(),
    positiveRailObservedHealthy: z.boolean(),
    referenceObservedHealthy: z.boolean(),
    sinkCommandedEnabled: z.boolean(),
    sinkObservedEnabled: z.boolean(),
    sourceCommandedEnabled: z.boolean(),
    sourceObservedEnabled: z.boolean(),
    sourceSinkMutualExclusionObserved: z.boolean(),
    watchdogObservedHealthy: z.boolean()
  })
  .strict()

const measurementControlSchema = incidentControlSchema.extend({
  adcCodeObservedExpected: z.literal(true),
  currentTripObservedArmed: z.literal(true),
  dwellTimerObservedSatisfied: z.literal(true),
  fixturePermitObserved: z.literal(true),
  fixturePowerObservedGood: z.literal(true),
  negativeRailObservedHealthy: z.literal(true),
  overloadObservedClear: z.literal(true),
  positiveRailObservedHealthy: z.literal(true),
  referenceObservedHealthy: z.literal(true),
  sourceSinkMutualExclusionObserved: z.literal(true),
  watchdogObservedHealthy: z.literal(true)
})

const oneChannelRecordBaseSchema = z
  .object({
    authorization: z.literal(false),
    boardId: z.string().min(1),
    capacitancePf: z.union([z.literal(500), z.literal(2_000), z.literal(5_000), z.literal(10_000)]),
    firmwareDigest: z.string().regex(/^[0-9a-f]{64}$/u),
    forceAppliedVolts: z.number().finite().min(-24).max(24),
    forcePulseDurationMs: z.number().finite().min(0).max(100),
    mode: z.enum(["normal-resistance", "guarded-force"]),
    sequence: z
      .object({
        eventIndex: z.number().int().positive(),
        runId: z.string().min(1)
      })
      .strict(),
    temperatureC: z.union([z.literal(-40), z.literal(25), z.literal(85), z.literal(125)]),
    testPoints: testPointSchema,
    timestampUtc: z
      .string()
      .refine((value) => parseCanonicalUtcTimestamp(value) !== null, "timestamps must use canonical UTC milliseconds"),
    traces: z.array(traceSchema).min(1)
  })
  .strict()

export const oneChannelExperimentRecordSchema = oneChannelRecordBaseSchema
  .extend({ control: measurementControlSchema, measurement: measurementSchema, outcome: z.literal("measured") })
  .strict()
  .superRefine((record, context) => {
    const isGuarded = record.mode === "guarded-force"
    const observedMatchesCommands =
      record.control.forceRelayCommandedClosed === record.control.forceRelayObservedClosed &&
      record.control.sourceCommandedEnabled === record.control.sourceObservedEnabled &&
      record.control.sinkCommandedEnabled === record.control.sinkObservedEnabled
    const stateMatchesMode = isGuarded
      ? record.control.forceRelayCommandedClosed &&
        record.control.forceRelayObservedClosed &&
        !record.control.sourceCommandedEnabled &&
        !record.control.sourceObservedEnabled &&
        !record.control.sinkCommandedEnabled &&
        !record.control.sinkObservedEnabled &&
        record.forceAppliedVolts !== 0 &&
        record.forcePulseDurationMs > 0
      : !record.control.forceRelayCommandedClosed &&
        !record.control.forceRelayObservedClosed &&
        record.control.sourceCommandedEnabled &&
        record.control.sourceObservedEnabled &&
        !record.control.sinkCommandedEnabled &&
        !record.control.sinkObservedEnabled &&
        record.forceAppliedVolts === 0 &&
        record.forcePulseDurationMs === 0
    if (!stateMatchesMode || !observedMatchesCommands) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "control state does not match the declared experiment mode"
      })
    }
    const nodes = new Set(record.traces.flatMap((trace) => trace.nodes))
    const normalRequired = [
      "line",
      "post-tpd",
      "quiet",
      "buffer-input",
      "buffer-output",
      "adc-ainp",
      "adc-ainn",
      "reference",
      "analog-plus-rail",
      "analog-negative-rail"
    ] as const
    if (normalRequired.some((node) => !nodes.has(node))) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "record lacks required normal-path trace coverage" })
    }
    if (
      Math.abs(record.testPoints.adcAinnV) > 0.01 ||
      Math.abs(record.testPoints.bufferInputV - record.testPoints.lineV) > 0.05 ||
      Math.abs(record.testPoints.bufferOutputV - record.testPoints.adcAinpV) > 0.05
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "recorded test points are incoherent with the grounded SAR buffer topology"
      })
    }
    if (isGuarded) {
      const required = ["line", "buffer-input", "buffer-output", "force-voltage", "force-current"] as const
      if (required.some((node) => !nodes.has(node))) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "guarded-force record lacks required trace coverage" })
      }
    }
  })

const unavailableOneChannelRecordSchema = oneChannelRecordBaseSchema
  .extend({
    control: incidentControlSchema,
    faultCode: z.string().min(1),
    outcome: z.literal("unavailable")
  })
  .strict()

export const oneChannelExperimentArchiveSchema = z.union([
  oneChannelExperimentRecordSchema,
  unavailableOneChannelRecordSchema
])

export type OneChannelExperimentRecord = z.infer<typeof oneChannelExperimentRecordSchema>
export type OneChannelExperimentArchiveRecord = z.infer<typeof oneChannelExperimentArchiveSchema>

function canonicalUtcMilliseconds(value: string): number {
  const timestamp = parseCanonicalUtcTimestamp(value)
  if (timestamp === null) throw new RangeError("timestamps must use canonical UTC milliseconds")
  return timestamp.getTime()
}

export function validateOneChannelExperimentRun(
  records: readonly unknown[]
): readonly OneChannelExperimentArchiveRecord[] {
  const parsed = records.map((record) => oneChannelExperimentArchiveSchema.parse(record))
  let previousForceEndMs: number | undefined
  for (const [index, record] of parsed.entries()) {
    if (record.sequence.eventIndex !== index + 1)
      throw new RangeError("experiment eventIndex must be contiguous and ordered")
    if (index > 0 && record.sequence.runId !== parsed[0].sequence.runId) {
      throw new RangeError("all experiment records must share one runId")
    }
    const startMs = canonicalUtcMilliseconds(record.timestampUtc)
    if (index > 0 && startMs <= canonicalUtcMilliseconds(parsed[index - 1].timestampUtc)) {
      throw new RangeError("experiment timestamps must be strictly increasing")
    }
    const containsGuardedPulse =
      record.control.forceRelayObservedClosed || record.forceAppliedVolts !== 0 || record.forcePulseDurationMs > 0
    if (containsGuardedPulse) {
      if (
        previousForceEndMs !== undefined &&
        startMs - previousForceEndMs < oneChannelAnalogExperiment.faultGuard.minimumPulseIntervalMs
      ) {
        throw new RangeError("guarded force pulses must retain an interval of at least 10 seconds")
      }
      previousForceEndMs = startMs + record.forcePulseDurationMs
    }
  }
  return parsed
}
