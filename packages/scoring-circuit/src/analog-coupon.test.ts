import { createElement } from "react"
import { describe, expect, it } from "vitest"
import AnalogCouponCircuit from "./analog-coupon.circuit.js"
import {
  analogCouponDesign,
  analogCouponPointSchema,
  analogCouponRecordSchema,
  assessCouponCaptureReadiness,
  assessCouponPoint,
  validateCouponRun,
  type AnalogCouponPoint
} from "./analog-coupon.js"
import { renderTestCircuit } from "./test-helper.js"

function renderCouponCircuit() {
  return renderTestCircuit(createElement(AnalogCouponCircuit), { pcbEnabled: false })
}

const completePoint: AnalogCouponPoint = {
  appliedForceV: 0,
  adcCodes: [555, 555, 556],
  boardId: "M4-COUPON-001",
  calibrationId: "CAL-25C-001",
  control: {
    currentTripObservedArmed: true,
    dwellTimerObservedSatisfied: true,
    fixtureInterlockCertificateId: "INTERLOCK-001",
    fixturePermitObserved: true,
    fixturePowerObservedGood: true,
    forceRelayCommandedClosed: false,
    forceRelayObservedClosed: false,
    sinkCommandedEnabled: false,
    sinkObservedEnabled: false,
    sourceCommandedEnabled: true,
    sourceObservedEnabled: true,
    watchdogObservedHealthy: true
  },
  corner: { lineCapacitancePf: 500, s3vSupplyV: 3.135, temperatureC: -40 },
  equipment: {
    currentProbeCalibrationId: "I-2026-001",
    fixtureId: "FIX-M4-01",
    fixtureUncertaintyExpandedOhms: 0.5,
    oscilloscopeCalibrationId: "SCOPE-2026-001",
    standardCalibrationId: "R-2026-001"
  },
  firmwareDigest: "a".repeat(64),
  health: {
    adcCalibrationComplete: true,
    comparatorMaskedDuringBlanking: true,
    referenceAtConversionV: 2.5,
    referenceHealthy: true
  },
  measuredResistanceOhms: [449.8, 450, 450.2],
  negativePath: {
    currentExpandedUncertaintyA: 0,
    currentUncertaintyEvidenceId: "IUNC-001",
    meanMcuPadCurrentA: 0,
    postTpdResidualV: -0.3,
    testMode: "nominal-resistance"
  },
  outcome: "measured",
  pulseDurationMs: 0,
  sequence: {
    dwellTimerWitnessId: "TIMER-001",
    eventIndex: 1,
    observedInterPulseIntervalMs: null,
    previousForcePulseEndedUtc: null,
    runId: "RUN-001"
  },
  standardResistanceOhms: 450,
  stress: {
    bav199: { energyJ: 0, peakAbsCurrentA: 0, peakAbsVoltageV: 0, peakPowerW: 0, ratingMarginReviewed: true },
    bat54: { energyJ: 0, peakAbsCurrentA: 0, peakAbsVoltageV: 0, peakPowerW: 0, ratingMarginReviewed: true },
    guardResistor: { energyJ: 0, peakAbsCurrentA: 0, peakAbsVoltageV: 0, peakPowerW: 0, ratingMarginReviewed: true },
    lm4040: { energyJ: 0, peakAbsCurrentA: 0, peakAbsVoltageV: 0, peakPowerW: 0, ratingMarginReviewed: true },
    mcuPad: { energyJ: 0, peakAbsCurrentA: 0, peakAbsVoltageV: 0, peakPowerW: 0, ratingMarginReviewed: true },
    sourceEnergyJ: 0,
    sourcePeakCurrentA: 0,
    tpd: { energyJ: 0, peakAbsCurrentA: 0, peakAbsVoltageV: 0, peakPowerW: 0, ratingMarginReviewed: true }
  },
  testPoints: {
    adcPadV: 0.378,
    clampV: 2.048,
    lineV: 0.378,
    postTpdV: 0.378,
    quietV: 0.378,
    referenceV: 2.5,
    s3vV: 3.135,
    vddaV: 3.135
  },
  timestampUtc: "2026-08-23T12:00:00.000Z",
  traces: [
    {
      durationMs: 1,
      nodes: ["line", "post-tpd", "quiet", "adc-pad", "clamp", "reference", "s3v", "vdda"],
      sampleRateHz: 1_000_000,
      sha256: "b".repeat(64),
      traceId: "TRACE-001"
    }
  ]
}

describe("bounded analog coupon", () => {
  it("renders the guarded force, sink DNP, test points, and observed fixture interface", () => {
    const circuitJson = renderCouponCircuit()
    const sourceComponents = circuitJson.filter((element) => element.type === "source_component")
    const sourceNames = sourceComponents.map((element) => element.name)
    const sourceByName = (name: string) => sourceComponents.find((element) => element.name === name)
    const traceNames = circuitJson.flatMap((element) =>
      element.type === "source_trace" && "display_name" in element && typeof element.display_name === "string"
        ? [element.display_name]
        : []
    )
    const serialized = JSON.stringify(circuitJson)

    expect(sourceNames).toEqual(
      expect.arrayContaining([
        "J_GUARDED_FORCE",
        "J_FIXTURE_STATUS",
        "R_FAULT_GUARD",
        "TP_FORCE_UPSTREAM",
        "TP_LINE",
        "TP_POST_TPD",
        "TP_QUIET",
        "TP_ADC_PAD",
        "TP_CLAMP",
        "TP_REF",
        "TP_S3_3",
        "TP_SGND",
        "TP_SINK_DNP"
      ])
    )
    expect(sourceByName("R_FAULT_GUARD")).toMatchObject({ resistance: 56_000 })
    expect(traceNames).toEqual(
      expect.arrayContaining([
        "J_GUARDED_FORCE.FORCE to R_FAULT_GUARD.pin1",
        "J_GUARDED_FORCE.FORCE to TP_FORCE_UPSTREAM.FORCE_UPSTREAM",
        "R_FAULT_GUARD.pin2 to U_ESD.LINE",
        "U_SWITCH.SINK_PATH to TP_SINK_DNP.SINK_DNP"
      ])
    )
    expect(serialized).toContain("FIXTURE_PERMIT_OBS")
    expect(serialized).toContain("FORCE_RELAY_OBS")
    expect(serialized).toContain("SOURCE_GATE_OBS")
    expect(serialized).toContain("SINK_GATE_OBS")
    expect(serialized).toContain("CURRENT_TRIP_ARMED_OBS")
    expect(serialized).toContain("WATCHDOG_OK_OBS")
    expect(serialized).toContain("DWELL_TIMER_OK_OBS")
    expect(serialized).toContain("FIXTURE_POWER_GOOD_OBS")
  })

  it("keeps the baseline coupon denied and requires the fixture interlock for characterization", () => {
    const readiness = assessCouponCaptureReadiness()

    expect(readiness.state).toBe("deny")
    expect(readiness.benignCharacterizationAllowed).toBe(false)
    expect(readiness.captureAuthorized).toBe(false)
    expect(readiness.fullEnergyFaultAuthorized).toBe(false)
    expect(readiness.reasons).toContain("model half-width exceeds the 4.50-ohm coupon-capture gate")
    expect(readiness.reasons).toContain("external negative-clamp priority is not bounded")
    expect(readiness.reasons).toContain("fixture source/sink and force/power interlock is not verified")
  })

  it("never lets caller predicates authorize the immutable denied baseline", () => {
    const readiness = assessCouponCaptureReadiness({
      externalClampPriorityBounded: true,
      fixtureInterlockVerified: true,
      fixtureExpandedUncertaintyOhms: 0.5,
      modelHalfWidthOhms: 4.5,
      safetyScreenBounded: true
    })

    expect(readiness.benignCharacterizationAllowed).toBe(false)
    expect(readiness.captureAuthorized).toBe(false)
  })

  it("bounds the guarded force lane below half a milliampere without treating it as M4-09", () => {
    expect(analogCouponDesign.faultGuard.maximumCurrentA).toBeLessThan(0.0005)
    expect(analogCouponDesign.faultGuard.minimumResistanceOhms).toBe(55_440)
    expect(analogCouponDesign.faultGuard.maximumResistorPowerW).toBeCloseTo(0.01039, 5)
    expect(analogCouponDesign.faultGuard.maximumSourceEnergyJ).toBeCloseTo(0.001039, 6)
    expect(analogCouponDesign.faultGuard.maximumPulseDurationMs).toBe(100)
    expect(analogCouponDesign.faultGuard.minimumPulseIntervalMs).toBe(10_000)
  })

  it("requires raw data, calibration identities, corner coordinates, and safe control state", () => {
    expect(analogCouponPointSchema.parse(completePoint).control.sinkObservedEnabled).toBe(false)
    expect(() =>
      analogCouponPointSchema.parse({
        ...completePoint,
        control: { ...completePoint.control, sinkCommandedEnabled: true, sinkObservedEnabled: true }
      })
    ).toThrow()
    expect(() =>
      analogCouponPointSchema.parse({
        ...completePoint,
        equipment: { ...completePoint.equipment, fixtureUncertaintyExpandedOhms: 0.500_001 }
      })
    ).toThrow()
    expect(() =>
      analogCouponPointSchema.parse({
        ...completePoint,
        stress: { ...completePoint.stress, sourceEnergyJ: analogCouponDesign.faultGuard.maximumSourceEnergyJ + 1e-9 }
      })
    ).toThrow("guarded source energy exceeds the 100-ms envelope")
  })

  it("uses signed bias plus observed repeatability and fixture uncertainty", () => {
    const assessment = assessCouponPoint(completePoint)

    expect(assessment.signedBiasOhms).toBeCloseTo(0, 6)
    expect(assessment.measuredDutHalfWidthOhms).toBeCloseTo(0.2, 6)
    expect(assessment.passesMeasuredCondition).toBe(true)
    expect(assessment.padCurrentUpperBoundA).toBe(0)
    expect(assessment.passesZeroCurrentCriterion).toBe(true)
  })

  it("rejects mismatched ADC and resistance sample arrays", () => {
    expect(() => analogCouponPointSchema.parse({ ...completePoint, adcCodes: [555, 556, 557, 558] })).toThrow(
      "adcCodes and measuredResistanceOhms must have equal lengths"
    )
  })

  it("archives unavailable and line-fault outcomes without inventing a resistance", () => {
    const {
      adcCodes: _adcCodes,
      health: _health,
      measuredResistanceOhms: _measured,
      negativePath: _path,
      standardResistanceOhms: _standard,
      ...common
    } = completePoint

    expect(
      analogCouponRecordSchema.parse({
        ...common,
        control: {
          ...completePoint.control,
          fixturePermitObserved: false,
          sourceCommandedEnabled: false,
          sourceObservedEnabled: false
        },
        faultCode: "reference-missing",
        outcome: "unavailable"
      }).outcome
    ).toBe("unavailable")
    expect(
      analogCouponRecordSchema.parse({
        ...common,
        control: { ...completePoint.control, sinkCommandedEnabled: true, sinkObservedEnabled: true },
        faultCode: "both-enables-commanded",
        outcome: "line-fault"
      }).outcome
    ).toBe("line-fault")
  })

  it("fails the zero-current criterion when the measured interval excludes zero or exceeds allocation", () => {
    expect(
      assessCouponPoint({
        ...completePoint,
        negativePath: {
          ...completePoint.negativePath,
          currentExpandedUncertaintyA: 1e-9,
          meanMcuPadCurrentA: 3e-9
        }
      }).passesZeroCurrentCriterion
    ).toBe(false)
  })

  it("rejects force telemetry in nominal mode and requires complete guarded trace evidence", () => {
    expect(() => analogCouponPointSchema.parse({ ...completePoint, appliedForceV: 24, pulseDurationMs: 100 })).toThrow(
      "control state does not match the declared test mode"
    )

    expect(() =>
      analogCouponPointSchema.parse({
        ...completePoint,
        appliedForceV: -24,
        control: {
          ...completePoint.control,
          forceRelayCommandedClosed: true,
          forceRelayObservedClosed: true,
          sourceCommandedEnabled: false,
          sourceObservedEnabled: false
        },
        negativePath: { ...completePoint.negativePath, testMode: "guarded-low-energy" },
        pulseDurationMs: 100,
        stress: {
          ...completePoint.stress,
          guardResistor: {
            ...completePoint.stress.guardResistor,
            energyJ: 0.00096,
            peakAbsCurrentA: 0.0004,
            peakAbsVoltageV: 24,
            peakPowerW: 0.0096
          },
          sourceEnergyJ: 0.001,
          sourcePeakCurrentA: 0.0004
        }
      })
    ).toThrow("guarded force record is missing required voltage or current trace coverage")
  })

  it("validates the ten-second guarded-pulse dwell across one ordered run", () => {
    const guardedTrace = {
      ...completePoint.traces[0],
      nodes: [
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
    }
    const first = {
      ...completePoint,
      appliedForceV: -24,
      control: {
        ...completePoint.control,
        forceRelayCommandedClosed: true,
        forceRelayObservedClosed: true,
        sourceCommandedEnabled: false,
        sourceObservedEnabled: false
      },
      negativePath: { ...completePoint.negativePath, testMode: "guarded-low-energy" as const },
      pulseDurationMs: 100,
      stress: {
        ...completePoint.stress,
        guardResistor: {
          ...completePoint.stress.guardResistor,
          energyJ: 0.00096,
          peakAbsCurrentA: 0.0004,
          peakAbsVoltageV: 24,
          peakPowerW: 0.0096
        },
        sourceEnergyJ: 0.001,
        sourcePeakCurrentA: 0.0004
      },
      traces: [guardedTrace]
    }
    const second = {
      ...first,
      sequence: {
        ...first.sequence,
        eventIndex: 2,
        observedInterPulseIntervalMs: 10_000,
        previousForcePulseEndedUtc: "2026-08-23T12:00:00.100Z"
      },
      timestampUtc: "2026-08-23T12:00:10.100Z"
    }

    expect(validateCouponRun([first, second])).toHaveLength(2)
    expect(() =>
      validateCouponRun([first, { ...second, sequence: { ...second.sequence, observedInterPulseIntervalMs: 9_999 } }])
    ).toThrow("guarded force pulses must retain a verified interval of at least 10 seconds")
  })

  it("requires canonical UTC milliseconds for coupon and guarded-pulse evidence", () => {
    for (const timestampUtc of ["2026-08-23T05:00:00.000-07:00", "2026-02-30T12:00:00.000Z", "2026-08-23T12:00:00Z"]) {
      expect(() => analogCouponPointSchema.parse({ ...completePoint, timestampUtc })).toThrow(
        "timestamps must use canonical UTC milliseconds"
      )
      expect(() =>
        analogCouponPointSchema.parse({
          ...completePoint,
          sequence: { ...completePoint.sequence, previousForcePulseEndedUtc: timestampUtc }
        })
      ).toThrow("timestamps must use canonical UTC milliseconds")
    }
  })
})
