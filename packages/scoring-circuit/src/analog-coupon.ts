import { z } from "zod"
import { analogBudget, m403ScreenedStaticErrorOhms } from "./analog-model.js"

/**
 * Bounded single-channel M4 characterization coupon. This is intentionally
 * separate from the seven-channel scoring architecture: it defines a safe
 * learning article and its evidence format, not a production circuit or an
 * FIE claim.
 */
export const analogCouponDesign = {
  captureGate: {
    padInjectionAllocationA: 0,
    maximumFixtureExpandedUncertaintyOhms: 0.5,
    maximumModelHalfWidthOhms: 4.5,
    maximumMeasuredTotalHalfWidthOhms: 5,
    requiredSafetyBounded: true
  },
  clamp: {
    negative: "BAT54T1G",
    positive: "BAV199-7-F",
    shunt: "LM4040C20QDBZR"
  },
  faultGuard: {
    maximumAppliedVoltageV: 24,
    maximumPulseDurationMs: 100,
    minimumPulseIntervalMs: 10_000,
    nominalResistanceOhms: 56_000,
    resistanceToleranceFraction: 0.01,
    minimumResistanceOhms: 56_000 * (1 - 0.01),
    // These bounds assume the entire force voltage appears across the
    // minimum-tolerance guard resistor. Downstream resistance receives no
    // credit because the line can be shunted by the TPD or a clamp.
    maximumCurrentA: 24 / (56_000 * (1 - 0.01)),
    maximumResistorEnergyJ: (24 ** 2 / (56_000 * (1 - 0.01))) * 0.1,
    maximumResistorPowerW: 24 ** 2 / (56_000 * (1 - 0.01)),
    maximumSourceEnergyJ: 24 * (24 / (56_000 * (1 - 0.01))) * 0.1
  },
  inputCases: {
    capacitancePf: [500, 2_000, 5_000, 10_000],
    resistanceOhms: [0, 10, 95, 100, 105, 195, 200, 205, 245, 250, 255, 445, 450, 455, 470, 475, 480, 495, 500, 505],
    safeFaultForceV: [-24, -7, -3, -1, -0.5, -0.3, -0.1, 0, 0.1, 0.3, 0.5, 1, 3, 7, 24],
    s3vSupplyV: [3.135, 3.465],
    temperatureC: [-40, 25, 85, 125]
  },
  source: {
    reference: "REF5025AQDRQ1",
    resistanceOhms: 2_490,
    switch: "TMUX1112PWR"
  },
  // The sink path is represented physically but deliberately not used for a
  // resistance capture until SIG-02 chooses its return topology.
  sinkPathStatus: "not-qualified",
  state: "deny"
} as const

export type CouponCaptureReadiness = {
  benignCharacterizationAllowed: boolean
  captureAuthorized: boolean
  fullEnergyFaultAuthorized: boolean
  reasons: readonly string[]
  state: "deny"
}

export type CouponCaptureReadinessInput = {
  externalClampPriorityBounded: boolean
  fixtureInterlockVerified: boolean
  fixtureExpandedUncertaintyOhms: number
  modelHalfWidthOhms: number
  safetyScreenBounded: boolean
}

function assertFiniteNonNegative(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${name} must be finite and non-negative`)
}

/**
 * Reports the prerequisite state. A guarded low-energy sweep can characterize
 * the baseline, but it cannot authorize threshold capture or a full-energy
 * fault while the existing negative-clamp priority remains unbounded.
 */
export function assessCouponCaptureReadiness(
  input: CouponCaptureReadinessInput = {
    externalClampPriorityBounded: false,
    fixtureInterlockVerified: false,
    fixtureExpandedUncertaintyOhms: analogBudget.fixtureInterpolationAndStandardUncertaintyOhms,
    modelHalfWidthOhms: m403ScreenedStaticErrorOhms(450, 125),
    safetyScreenBounded: false
  }
): CouponCaptureReadiness {
  assertFiniteNonNegative("fixtureExpandedUncertaintyOhms", input.fixtureExpandedUncertaintyOhms)
  assertFiniteNonNegative("modelHalfWidthOhms", input.modelHalfWidthOhms)

  const reasons: string[] = []
  if (input.modelHalfWidthOhms > analogCouponDesign.captureGate.maximumModelHalfWidthOhms) {
    reasons.push("model half-width exceeds the 4.50-ohm coupon-capture gate")
  }
  if (input.fixtureExpandedUncertaintyOhms > analogCouponDesign.captureGate.maximumFixtureExpandedUncertaintyOhms) {
    reasons.push("fixture expanded uncertainty exceeds the 0.50-ohm allocation")
  }
  if (!input.safetyScreenBounded) reasons.push("coupon safety screen is not bounded")
  if (!input.externalClampPriorityBounded) reasons.push("external negative-clamp priority is not bounded")
  if (!input.fixtureInterlockVerified) reasons.push("fixture source/sink and force/power interlock is not verified")

  return {
    // This immutable denied candidate reports prerequisites only. No caller
    // predicate can authorize benign or force characterization.
    benignCharacterizationAllowed: false,
    // The immutable candidate state is DENY. Satisfying caller-reported
    // predicates can make the reasons list empty for review, but cannot
    // authorize capture without a future reviewed evidence validator.
    captureAuthorized: false,
    fullEnergyFaultAuthorized: false,
    reasons,
    state: "deny"
  }
}

const couponCornerSchema = z
  .object({
    lineCapacitancePf: z.union([z.literal(500), z.literal(2_000), z.literal(5_000), z.literal(10_000)]),
    s3vSupplyV: z.union([z.literal(3.135), z.literal(3.465)]),
    temperatureC: z.union([z.literal(-40), z.literal(25), z.literal(85), z.literal(125)])
  })
  .strict()

const couponEquipmentSchema = z
  .object({
    currentProbeCalibrationId: z.string().min(1),
    fixtureId: z.string().min(1),
    fixtureUncertaintyExpandedOhms: z
      .number()
      .finite()
      .min(0)
      .max(analogCouponDesign.captureGate.maximumFixtureExpandedUncertaintyOhms),
    oscilloscopeCalibrationId: z.string().min(1),
    standardCalibrationId: z.string().min(1)
  })
  .strict()

const couponMeasurementControlSchema = z
  .object({
    currentTripObservedArmed: z.literal(true),
    dwellTimerObservedSatisfied: z.literal(true),
    fixtureInterlockCertificateId: z.string().min(1),
    fixturePermitObserved: z.literal(true),
    fixturePowerObservedGood: z.literal(true),
    forceRelayCommandedClosed: z.boolean(),
    forceRelayObservedClosed: z.boolean(),
    sinkCommandedEnabled: z.boolean(),
    sinkObservedEnabled: z.boolean(),
    sourceCommandedEnabled: z.boolean(),
    sourceObservedEnabled: z.boolean(),
    watchdogObservedHealthy: z.literal(true)
  })
  .strict()

const couponIncidentControlSchema = z
  .object({
    currentTripObservedArmed: z.boolean(),
    dwellTimerObservedSatisfied: z.boolean(),
    fixtureInterlockCertificateId: z.string().min(1),
    fixturePermitObserved: z.boolean(),
    fixturePowerObservedGood: z.boolean(),
    forceRelayCommandedClosed: z.boolean(),
    forceRelayObservedClosed: z.boolean(),
    sinkCommandedEnabled: z.boolean(),
    sinkObservedEnabled: z.boolean(),
    sourceCommandedEnabled: z.boolean(),
    sourceObservedEnabled: z.boolean(),
    watchdogObservedHealthy: z.boolean()
  })
  .strict()

const couponSequenceSchema = z
  .object({
    dwellTimerWitnessId: z.string().min(1),
    eventIndex: z.number().int().positive(),
    observedInterPulseIntervalMs: z.number().finite().min(0).nullable(),
    previousForcePulseEndedUtc: z.string().datetime().nullable(),
    runId: z.string().min(1)
  })
  .strict()

const couponTestPointSchema = z
  .object({
    adcPadV: z.number().finite(),
    clampV: z.number().finite(),
    lineV: z.number().finite(),
    postTpdV: z.number().finite(),
    quietV: z.number().finite(),
    referenceV: z.number().finite(),
    s3vV: z.number().finite(),
    vddaV: z.number().finite()
  })
  .strict()

const couponTraceSchema = z
  .object({
    durationMs: z.number().finite().positive(),
    nodes: z
      .array(
        z.enum([
          "line",
          "post-tpd",
          "quiet",
          "adc-pad",
          "clamp",
          "reference",
          "s3v",
          "vdda",
          "force-voltage",
          "force-current",
          "tpd-voltage",
          "tpd-current",
          "bat54-voltage",
          "bat54-current",
          "bav199-voltage",
          "bav199-current",
          "lm4040-voltage",
          "lm4040-current",
          "mcu-pad-voltage",
          "mcu-pad-current"
        ])
      )
      .min(1),
    sampleRateHz: z.number().finite().positive(),
    sha256: z.string().regex(/^[0-9a-f]{64}$/u),
    traceId: z.string().min(1)
  })
  .strict()

const couponDeviceStressSchema = z
  .object({
    energyJ: z.number().finite().min(0),
    peakAbsCurrentA: z.number().finite().min(0),
    peakAbsVoltageV: z.number().finite().min(0),
    peakPowerW: z.number().finite().min(0),
    ratingMarginReviewed: z.literal(true)
  })
  .strict()

const couponStressSchema = z
  .object({
    bav199: couponDeviceStressSchema,
    bat54: couponDeviceStressSchema,
    guardResistor: couponDeviceStressSchema,
    lm4040: couponDeviceStressSchema,
    mcuPad: couponDeviceStressSchema,
    sourceEnergyJ: z.number().finite().min(0),
    sourcePeakCurrentA: z.number().finite().min(0),
    tpd: couponDeviceStressSchema
  })
  .strict()

const couponCommonSchema = z.object({
  appliedForceV: z.number().finite().min(-24).max(24),
  boardId: z.string().min(1),
  calibrationId: z.string().min(1),
  corner: couponCornerSchema,
  equipment: couponEquipmentSchema,
  firmwareDigest: z.string().regex(/^[0-9a-f]{64}$/u),
  pulseDurationMs: z.number().finite().min(0).max(analogCouponDesign.faultGuard.maximumPulseDurationMs),
  sequence: couponSequenceSchema,
  stress: couponStressSchema,
  testPoints: couponTestPointSchema,
  timestampUtc: z.string().datetime(),
  traces: z.array(couponTraceSchema).min(1)
})

export const analogCouponPointSchema = couponCommonSchema
  .extend({
    adcCodes: z.array(z.number().int().min(0).max(4_095)).min(3),
    control: couponMeasurementControlSchema,
    health: z
      .object({
        adcCalibrationComplete: z.literal(true),
        comparatorMaskedDuringBlanking: z.literal(true),
        referenceAtConversionV: z.number().finite().min(1.62).max(2.7),
        referenceHealthy: z.literal(true)
      })
      .strict(),
    measuredResistanceOhms: z.array(z.number().finite().min(0)).min(3),
    negativePath: z
      .object({
        currentExpandedUncertaintyA: z.number().finite().min(0),
        currentUncertaintyEvidenceId: z.string().min(1),
        meanMcuPadCurrentA: z.number().finite(),
        postTpdResidualV: z.number().finite(),
        testMode: z.enum(["guarded-low-energy", "nominal-resistance"])
      })
      .strict(),
    standardResistanceOhms: z.number().finite().min(0),
    outcome: z.literal("measured")
  })
  .strict()
  .superRefine((point, context) => {
    if (point.adcCodes.length !== point.measuredResistanceOhms.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "adcCodes and measuredResistanceOhms must have equal lengths",
        path: ["measuredResistanceOhms"]
      })
    }
    const guardedForce = point.negativePath.testMode === "guarded-low-energy"
    const observedMatchesCommands =
      point.control.forceRelayCommandedClosed === point.control.forceRelayObservedClosed &&
      point.control.sourceCommandedEnabled === point.control.sourceObservedEnabled &&
      point.control.sinkCommandedEnabled === point.control.sinkObservedEnabled
    const controlMatchesMode = guardedForce
      ? point.control.forceRelayObservedClosed &&
        !point.control.sourceObservedEnabled &&
        !point.control.sinkObservedEnabled &&
        point.appliedForceV !== 0 &&
        point.pulseDurationMs > 0 &&
        point.stress.sourcePeakCurrentA > 0 &&
        point.stress.sourceEnergyJ > 0 &&
        point.stress.guardResistor.peakAbsCurrentA > 0 &&
        point.stress.guardResistor.peakPowerW > 0 &&
        point.stress.guardResistor.energyJ > 0
      : !point.control.forceRelayObservedClosed &&
        point.control.sourceObservedEnabled &&
        !point.control.sinkObservedEnabled &&
        point.appliedForceV === 0 &&
        point.pulseDurationMs === 0 &&
        point.stress.sourcePeakCurrentA === 0 &&
        point.stress.sourceEnergyJ === 0 &&
        point.stress.guardResistor.energyJ === 0 &&
        point.stress.guardResistor.peakPowerW === 0
    if (!controlMatchesMode || !observedMatchesCommands) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "control state does not match the declared test mode",
        path: ["control"]
      })
    }
    if (guardedForce) {
      const appliedMagnitudeV = Math.abs(point.appliedForceV)
      const maximumCurrentAtAppliedVoltageA = appliedMagnitudeV / analogCouponDesign.faultGuard.minimumResistanceOhms
      const maximumEnergyAtAppliedVoltageJ =
        appliedMagnitudeV * maximumCurrentAtAppliedVoltageA * (point.pulseDurationMs / 1_000)
      const maximumGuardPowerAtAppliedVoltageW =
        appliedMagnitudeV ** 2 / analogCouponDesign.faultGuard.minimumResistanceOhms
      if (
        point.stress.sourcePeakCurrentA > maximumCurrentAtAppliedVoltageA ||
        point.stress.sourceEnergyJ > maximumEnergyAtAppliedVoltageJ ||
        point.stress.guardResistor.peakPowerW > maximumGuardPowerAtAppliedVoltageW ||
        point.stress.guardResistor.energyJ > maximumEnergyAtAppliedVoltageJ
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "guarded force telemetry exceeds its applied-voltage and pulse-duration envelope",
          path: ["stress"]
        })
      }
      const requiredTraceNodes = [
        "line",
        "post-tpd",
        "quiet",
        "adc-pad",
        "clamp",
        "s3v",
        "vdda",
        "force-voltage",
        "force-current",
        "tpd-voltage",
        "tpd-current",
        "bat54-voltage",
        "bat54-current",
        "bav199-voltage",
        "bav199-current",
        "lm4040-voltage",
        "lm4040-current",
        "mcu-pad-voltage",
        "mcu-pad-current"
      ] as const
      const observedTraceNodes = new Set(point.traces.flatMap((trace) => trace.nodes))
      if (requiredTraceNodes.some((node) => !observedTraceNodes.has(node))) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "guarded force record is missing required voltage or current trace coverage",
          path: ["traces"]
        })
      }
    }
    if (point.stress.sourcePeakCurrentA > analogCouponDesign.faultGuard.maximumCurrentA) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "guarded source current exceeds the minimum-tolerance resistor envelope",
        path: ["stress", "sourcePeakCurrentA"]
      })
    }
    if (point.stress.sourceEnergyJ > analogCouponDesign.faultGuard.maximumSourceEnergyJ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "guarded source energy exceeds the 100-ms envelope",
        path: ["stress", "sourceEnergyJ"]
      })
    }
    if (point.stress.guardResistor.peakPowerW > analogCouponDesign.faultGuard.maximumResistorPowerW) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "guard resistor power exceeds the minimum-tolerance envelope",
        path: ["stress", "guardResistor", "peakPowerW"]
      })
    }
    if (point.stress.guardResistor.energyJ > analogCouponDesign.faultGuard.maximumResistorEnergyJ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "guard resistor energy exceeds the 100-ms envelope",
        path: ["stress", "guardResistor", "energyJ"]
      })
    }
  })

const unavailableCouponRecordSchema = couponCommonSchema
  .extend({
    control: couponIncidentControlSchema,
    faultCode: z.string().min(1),
    outcome: z.literal("unavailable")
  })
  .strict()

const lineFaultCouponRecordSchema = couponCommonSchema
  .extend({
    control: couponIncidentControlSchema,
    faultCode: z.string().min(1),
    outcome: z.literal("line-fault")
  })
  .strict()

export const analogCouponRecordSchema = z.union([
  analogCouponPointSchema,
  unavailableCouponRecordSchema,
  lineFaultCouponRecordSchema
])

export type AnalogCouponPoint = z.infer<typeof analogCouponPointSchema>
export type AnalogCouponRecord = z.infer<typeof analogCouponRecordSchema>

/**
 * Validates the evidence order and the required 10-second interval between
 * guarded force pulses. The fixture timer witness remains mandatory per event;
 * this cross-record validator independently checks archived UTC timing.
 */
export function validateCouponRun(records: readonly unknown[]): readonly AnalogCouponRecord[] {
  const parsed = records.map((record) => analogCouponRecordSchema.parse(record))
  let priorForceEndMs: number | undefined
  let priorRunId: string | undefined

  for (const [index, record] of parsed.entries()) {
    if (record.sequence.eventIndex !== index + 1)
      throw new RangeError("coupon eventIndex must be contiguous and ordered")
    if (priorRunId !== undefined && record.sequence.runId !== priorRunId) {
      throw new RangeError("all coupon records must share one runId")
    }
    priorRunId = record.sequence.runId

    const forceRelayClosed = record.control.forceRelayObservedClosed
    if (!forceRelayClosed) continue

    const startMs = Date.parse(record.timestampUtc)
    if (priorForceEndMs === undefined) {
      if (
        record.sequence.previousForcePulseEndedUtc !== null ||
        record.sequence.observedInterPulseIntervalMs !== null
      ) {
        throw new RangeError("first guarded pulse must not claim a prior force pulse")
      }
    } else {
      const actualIntervalMs = startMs - priorForceEndMs
      if (
        record.sequence.previousForcePulseEndedUtc === null ||
        record.sequence.observedInterPulseIntervalMs === null ||
        actualIntervalMs < analogCouponDesign.faultGuard.minimumPulseIntervalMs ||
        record.sequence.observedInterPulseIntervalMs < analogCouponDesign.faultGuard.minimumPulseIntervalMs ||
        Date.parse(record.sequence.previousForcePulseEndedUtc) !== priorForceEndMs
      ) {
        throw new RangeError("guarded force pulses must retain a verified interval of at least 10 seconds")
      }
    }
    priorForceEndMs = startMs + record.pulseDurationMs
  }

  return parsed
}

export type CouponPointAssessment = {
  measuredDutHalfWidthOhms: number
  padCurrentUpperBoundA: number
  passesMeasuredCondition: boolean
  passesZeroCurrentCriterion: boolean
  signedBiasOhms: number
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

/**
 * Assesses a single archived condition. The repeatability allowance is the
 * observed half-range, not an invented confidence interval; the archive must
 * retain the raw readings so M4 can apply its reviewed uncertainty method.
 */
export function assessCouponPoint(point: AnalogCouponPoint): CouponPointAssessment {
  const parsed = analogCouponPointSchema.parse(point)
  const averageResistance = mean(parsed.measuredResistanceOhms)
  const signedBiasOhms = averageResistance - parsed.standardResistanceOhms
  const repeatabilityAllowanceOhms = Math.max(
    ...parsed.measuredResistanceOhms.map((value) => Math.abs(value - averageResistance))
  )
  const measuredDutHalfWidthOhms = Math.abs(signedBiasOhms) + repeatabilityAllowanceOhms
  const padCurrentUpperBoundA =
    Math.abs(parsed.negativePath.meanMcuPadCurrentA) + parsed.negativePath.currentExpandedUncertaintyA
  const meanCurrentConsistentWithZero =
    parsed.negativePath.meanMcuPadCurrentA === 0 && parsed.negativePath.currentExpandedUncertaintyA === 0

  return {
    measuredDutHalfWidthOhms,
    padCurrentUpperBoundA,
    passesMeasuredCondition:
      measuredDutHalfWidthOhms + parsed.equipment.fixtureUncertaintyExpandedOhms <=
      analogCouponDesign.captureGate.maximumMeasuredTotalHalfWidthOhms,
    passesZeroCurrentCriterion:
      meanCurrentConsistentWithZero && padCurrentUpperBoundA <= analogCouponDesign.captureGate.padInjectionAllocationA,
    signedBiasOhms
  }
}
