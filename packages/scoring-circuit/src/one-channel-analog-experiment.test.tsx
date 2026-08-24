import { createElement } from "react"
import { describe, expect, it } from "vitest"
import OneChannelAnalogExperimentCircuit from "./one-channel-analog-experiment.circuit.js"
import {
  assessOneChannelAnalogExperiment,
  oneChannelAnalogExperiment,
  oneChannelExperimentArchiveSchema,
  oneChannelExperimentRecordSchema,
  oneChannelGuardedFaultScreen,
  oneChannelIsolatedLoadScreen,
  oneChannelNormalRangeScreen,
  oneChannelSabreTimingScreen,
  oneChannelStaticScreen,
  validateOneChannelExperimentRun,
  type OneChannelExperimentRecord
} from "./one-channel-analog-experiment.js"
import { oneChannelAnalogExperimentBom } from "./one-channel-analog-readiness.js"
import { renderTestCircuit } from "./test-helper.js"

function renderCircuit() {
  return renderTestCircuit(createElement(OneChannelAnalogExperimentCircuit), { pcbEnabled: false })
}

type CircuitElement = ReturnType<typeof renderCircuit>[number]

function isSourcePort(element: CircuitElement): element is Extract<CircuitElement, { type: "source_port" }> {
  return element.type === "source_port"
}

function isSourceComponent(element: CircuitElement): element is Extract<CircuitElement, { type: "source_component" }> {
  return element.type === "source_component"
}

function physicalPortMap(circuitJson: ReturnType<typeof renderCircuit>, componentName: string) {
  const component = circuitJson.filter(isSourceComponent).find((element) => element.name === componentName)
  if (component === undefined) throw new Error(`missing source component ${componentName}`)
  return Object.fromEntries(
    circuitJson
      .filter(isSourcePort)
      .filter((port) => port.source_component_id === component.source_component_id)
      .map((port) => [port.pin_number, port.name])
  )
}

const measuredRecord: OneChannelExperimentRecord = {
  authorization: false,
  boardId: "M4-ONE-CHANNEL-001",
  capacitancePf: 10_000,
  control: {
    adcCodeObservedExpected: true,
    currentTripObservedArmed: true,
    dwellTimerObservedSatisfied: true,
    dwellTimerWitnessId: "DWELL-001",
    fixtureInterlockCertificateId: "INTERLOCK-001",
    fixturePermitObserved: true,
    fixturePowerObservedGood: true,
    forceRelayCommandedClosed: false,
    forceRelayObservedClosed: false,
    negativeRailObservedHealthy: true,
    overloadObservedClear: true,
    positiveRailObservedHealthy: true,
    referenceObservedHealthy: true,
    sinkCommandedEnabled: false,
    sinkObservedEnabled: false,
    sourceCommandedEnabled: true,
    sourceObservedEnabled: true,
    sourceSinkMutualExclusionObserved: true,
    watchdogObservedHealthy: true
  },
  firmwareDigest: "a".repeat(64),
  forceAppliedVolts: 0,
  forcePulseDurationMs: 0,
  measurement: {
    adcCodes: [39_600, 39_601, 39_599],
    calibrationId: "CAL-450-25C",
    measuredResistanceOhms: [449.9, 450, 450.1],
    standardResistanceOhms: 450
  },
  mode: "normal-resistance",
  outcome: "measured",
  sequence: { eventIndex: 1, runId: "RUN-001" },
  temperatureC: 25,
  testPoints: {
    adcAinnV: 0,
    adcAinpV: 0.383,
    analogNegativeRailV: -5,
    analogPositiveRailV: 5,
    bufferInputV: 0.383,
    bufferOutputV: 0.383,
    lineV: 0.383,
    referenceV: 2.5
  },
  timestampUtc: "2026-08-23T15:00:00.000Z",
  traces: [
    {
      nodes: [
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
      ],
      sampleRateHz: 5_000_000,
      sha256: "b".repeat(64),
      traceId: "TRACE-001"
    }
  ]
}

const guardedRecord: OneChannelExperimentRecord = {
  ...measuredRecord,
  control: {
    ...measuredRecord.control,
    forceRelayCommandedClosed: true,
    forceRelayObservedClosed: true,
    sourceCommandedEnabled: false,
    sourceObservedEnabled: false
  },
  forceAppliedVolts: -24,
  forcePulseDurationMs: 100,
  mode: "guarded-force",
  traces: [
    {
      ...measuredRecord.traces[0],
      nodes: [
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
      ]
    }
  ]
}

describe("one-channel protected analog experiment", () => {
  it("renders an isolated rail, guarded force, OVP buffer, and grounded SAR input", () => {
    const circuitJson = renderCircuit()
    const serialized = JSON.stringify(circuitJson)
    const components = circuitJson.filter((element) => element.type === "source_component")
    const names = components.map((component) => component.name)
    const traceNames = circuitJson.flatMap((element) =>
      element.type === "source_trace" && "display_name" in element && typeof element.display_name === "string"
        ? [element.display_name]
        : []
    )

    expect(names).toEqual(
      expect.arrayContaining([
        "U_ISO",
        "U_NEGATIVE_RAIL",
        "U_ESD",
        "R_FAULT_GUARD",
        "U_OVP_BUFFER",
        "U_SAR",
        "R_SAR",
        "C_SAR",
        "C_REF_IN",
        "C_REF_REG",
        "C_REF_REG_HF",
        "R_REF_SAR",
        "C_REF",
        "C_BUFFER_POS",
        "C_BUFFER_NEG",
        "C_NEG_IN",
        "C_ISO_IN",
        "C_ISO_OUT"
      ])
    )
    expect(new Set(names)).toEqual(new Set(oneChannelAnalogExperimentBom.map((part) => part.reference)))
    expect(serialized).toContain("NXE1S0505MC")
    expect(serialized).toContain("ADA4177-1ARZ")
    expect(oneChannelAnalogExperiment.acquisition.bufferManufacturerEvidence).toEqual({
      dataSheetRevision: "Rev. E",
      dataSheetUrl: "https://www.analog.com/media/en/technical-documentation/data-sheets/ADA4177-1_4177-2_4177-4.pdf",
      exactOrderable: "ADA4177-1ARZ",
      manufacturerProductUrl: "https://www.analog.com/en/products/ADA4177-1.html",
      package: "R SOIC-8",
      retainedArtifactPath: null,
      sha256: null,
      state: "exact-orderable-identified-not-hash-acquired"
    })
    expect(serialized).toContain("ADS8881IDGS")
    expect(serialized).toContain("T521B106M025ATE100")
    expect(serialized).toContain("GRM21BR71A106KE51L")
    expect(serialized).toContain("RCWE0603R220FKEA")
    expect(serialized).toContain("TP_AINN")
    expect(serialized).toContain("MUTEX_OBS")
    expect(serialized).toContain("BUFFER_INVERTING")
    expect(serialized).toContain("UNUSED_SEL2")
    expect(serialized).toContain("CFLY_NEG")
    expect(serialized).toContain("AVDD_3V3")
    expect(serialized).toContain("DVDD_3V3")
    expect(oneChannelAnalogExperiment.physicalPinMaps.ads8881Dgs).toEqual({
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
    })
    expect(oneChannelAnalogExperiment.physicalPinMaps.tps60400Dbv).toEqual({
      1: "OUT",
      2: "IN",
      3: "CFLY-",
      4: "GND",
      5: "CFLY+"
    })
    expect(physicalPortMap(circuitJson, "U_NEGATIVE_RAIL")).toEqual({
      1: "S5V_NEG",
      2: "S5V_ISO",
      3: "CFLY_NEG",
      4: "SGND",
      5: "CFLY_POS"
    })
    expect(physicalPortMap(circuitJson, "J_FIXTURE")).toEqual({
      1: "LINE",
      2: "SGND",
      3: "ESD_RETURN_RESERVED_NC"
    })
    expect(physicalPortMap(circuitJson, "J_GUARDED_FORCE")).toEqual({ 1: "FORCE", 2: "SGND" })
    expect(physicalPortMap(circuitJson, "U_ESD")).toEqual({ 1: "LINE_SHUNT", 3: "SGND_3", 8: "SGND_8" })
    expect(physicalPortMap(circuitJson, "U_SAR")).toEqual({
      1: "REF_2V5",
      2: "AVDD_3V3",
      3: "AINP",
      4: "AINN",
      5: "SGND",
      6: "SPI_CONVST",
      7: "SPI_DOUT",
      8: "SPI_SCLK",
      9: "SPI_DIN",
      10: "DVDD_3V3"
    })
    expect(traceNames).toEqual(
      expect.arrayContaining([
        "J_FIXTURE.LINE to U_ESD.LINE_SHUNT",
        "J_FIXTURE.LINE to R_ESD.pin1",
        "U_OVP_BUFFER.BUFFER_OUTPUT to U_OVP_BUFFER.BUFFER_INVERTING",
        "R_SAR.pin2 to U_SAR.AINP",
        "U_SAR.AINN to net.SGND",
        "U_SAR.SPI_CONVST to J_ADC_IO.SPI_CONVST",
        "U_SAR.SPI_DOUT to J_ADC_IO.SPI_DOUT",
        "U_ESD.SGND_3 to net.SGND",
        "U_ESD.SGND_8 to net.SGND",
        "U_NEGATIVE_RAIL.CFLY_NEG to C_NEG_FLY.pin1",
        "U_NEGATIVE_RAIL.S5V_ISO to C_NEG_IN.pin1",
        "U_OVP_BUFFER.S5V_ISO to C_BUFFER_POS.pin1",
        "U_OVP_BUFFER.S5V_NEG to C_BUFFER_NEG.pin1",
        "U_REF.S5V_ISO to C_REF_IN.pin1",
        "U_REF.REF_2V5 to C_REF_REG.pin1",
        "U_REF.REF_2V5 to C_REF_REG_HF.pin1",
        "U_REF.REF_2V5 to R_REF_SAR.pin1",
        "R_REF_SAR.pin2 to U_SAR.REF_2V5",
        "R_REF_SAR.pin2 to C_REF.pin1",
        "U_ISO.SYSTEM_5V to C_ISO_IN.pin1",
        "U_ISO.S5V_ISO to C_ISO_OUT.pin1",
        "U_SOURCE_SWITCH.UNUSED_SEL2 to net.SGND"
      ])
    )
  })

  it("keeps zero ohms, the 450-ohm path, and the grounded converter input within their published normal ranges", () => {
    const zero = oneChannelNormalRangeScreen(0)
    const foil = oneChannelNormalRangeScreen(450)

    expect(zero.normativeZeroOhmCovered).toBe(true)
    expect(zero.bufferInputWithinPublishedRange).toBe(true)
    expect(zero.adcInputPinsWithinZeroToReference).toBe(true)
    expect(foil.normalInputVolts).toBeCloseTo(0.383, 3)
    expect(foil.adcAinnVolts).toBe(0)
    expect(foil.adcInputPinsWithinZeroToReference).toBe(true)
  })

  it("bounds only the low-energy guarded plus/minus 24 V source envelope", () => {
    const positive = oneChannelGuardedFaultScreen(24)
    const negative = oneChannelGuardedFaultScreen(-24)

    for (const screen of [positive, negative]) {
      expect(screen.currentA).toBeCloseTo(24 / 55_440, 12)
      expect(screen.maximumSourceEnergyJ).toBeCloseTo(0.001039, 6)
      expect(screen.ovpRangeCovered).toBe(true)
      expect(screen.sourceEnvelopeOnly).toBe(true)
    }
  })

  it("makes the 450-ohm arithmetic and 100-ohm sabre screen inspectable without authorizing either", () => {
    const staticScreen = oneChannelStaticScreen(450, 125)
    const timing = oneChannelSabreTimingScreen()

    expect(staticScreen.totalOhms).toBeLessThan(4.5)
    expect(staticScreen.arithmeticWithinFourPointFiveOhms).toBe(true)
    expect(staticScreen.validatesAccuracy).toBe(false)
    expect(timing.sourceFiveTimeConstantsUs).toBeCloseTo(4.81, 2)
    expect(timing.totalArithmeticUs).toBeLessThan(10)
    expect(timing.arithmeticWithinTenUs).toBe(true)
    expect(timing.validatesSabreCapture).toBe(false)
  })

  it("separates realistic isolated-domain loading from a worst-case closure", () => {
    const power = oneChannelIsolatedLoadScreen()

    expect(power.converterOutputPowerMaximumW).toBe(1)
    expect(power.knownTypicalW).toBeGreaterThan(0)
    expect(power.remainingAgainstOneWTypicalW).toBeGreaterThan(0)
    expect(power.typicalOnly).toBe(true)
    expect(power.worstCaseLoadClosed).toBe(false)
  })

  it("requires immutable false authorization, interlock evidence, and safe mode-specific controls", () => {
    expect(oneChannelExperimentRecordSchema.parse(measuredRecord).authorization).toBe(false)
    expect(() => oneChannelExperimentRecordSchema.parse({ ...measuredRecord, authorization: true })).toThrow()
    expect(() =>
      oneChannelExperimentRecordSchema.parse({
        ...measuredRecord,
        mode: "guarded-force",
        forceAppliedVolts: 24,
        forcePulseDurationMs: 100
      })
    ).toThrow("control state does not match the declared experiment mode")
  })

  it("rejects unsafe commanded, observed, trip, dwell, permit, and fixture-power measurement states", () => {
    const unsafeControls = [
      { sourceCommandedEnabled: false },
      { sinkCommandedEnabled: true, sinkObservedEnabled: true },
      { forceRelayObservedClosed: true },
      { currentTripObservedArmed: false },
      { dwellTimerObservedSatisfied: false },
      { dwellTimerWitnessId: "" },
      { fixturePermitObserved: false },
      { fixturePowerObservedGood: false },
      { referenceObservedHealthy: false },
      { positiveRailObservedHealthy: false },
      { negativeRailObservedHealthy: false },
      { overloadObservedClear: false },
      { adcCodeObservedExpected: false },
      { sourceSinkMutualExclusionObserved: false },
      { watchdogObservedHealthy: false }
    ] as const

    for (const unsafe of unsafeControls) {
      expect(() =>
        oneChannelExperimentRecordSchema.parse({
          ...measuredRecord,
          control: { ...measuredRecord.control, ...unsafe }
        })
      ).toThrow()
    }

    expect(() =>
      oneChannelExperimentRecordSchema.parse({
        ...guardedRecord,
        control: { ...guardedRecord.control, sourceObservedEnabled: true }
      })
    ).toThrow("control state does not match the declared experiment mode")
  })

  it("archives unavailable conditions without inventing a resistance measurement", () => {
    const { measurement: _measurement, ...common } = measuredRecord
    const unavailable = {
      ...common,
      control: {
        ...common.control,
        currentTripObservedArmed: false,
        dwellTimerObservedSatisfied: false,
        fixturePermitObserved: false,
        fixturePowerObservedGood: false,
        negativeRailObservedHealthy: false,
        overloadObservedClear: false,
        positiveRailObservedHealthy: false,
        referenceObservedHealthy: false,
        adcCodeObservedExpected: false,
        sourceCommandedEnabled: false,
        sourceObservedEnabled: false,
        sourceSinkMutualExclusionObserved: false,
        watchdogObservedHealthy: false
      },
      faultCode: "reference-missing",
      outcome: "unavailable" as const
    }

    expect(oneChannelExperimentArchiveSchema.parse(unavailable).outcome).toBe("unavailable")
    expect(() =>
      oneChannelExperimentRecordSchema.parse({
        ...measuredRecord,
        control: unavailable.control
      })
    ).toThrow()
  })

  it("requires guarded traces and contiguous records in a run", () => {
    expect(oneChannelExperimentRecordSchema.parse(guardedRecord).mode).toBe("guarded-force")
    expect(
      validateOneChannelExperimentRun([
        measuredRecord,
        {
          ...measuredRecord,
          sequence: { eventIndex: 2, runId: "RUN-001" },
          timestampUtc: "2026-08-23T15:00:01.000Z"
        }
      ])
    ).toHaveLength(2)
    expect(() =>
      validateOneChannelExperimentRun([
        measuredRecord,
        { ...measuredRecord, sequence: { eventIndex: 3, runId: "RUN-001" } }
      ])
    ).toThrow("experiment eventIndex must be contiguous and ordered")
  })

  it("enforces ordered timestamps and ten seconds between guarded pulses, including unavailable incidents", () => {
    const { measurement: _measurement, ...guardedIncidentBase } = guardedRecord
    const guardedUnavailable = {
      ...guardedIncidentBase,
      control: {
        ...guardedIncidentBase.control,
        fixturePermitObserved: false,
        sourceSinkMutualExclusionObserved: false,
        watchdogObservedHealthy: false
      },
      faultCode: "watchdog-lost",
      outcome: "unavailable" as const,
      sequence: { eventIndex: 2, runId: "RUN-001" }
    }

    expect(() =>
      validateOneChannelExperimentRun([
        guardedRecord,
        { ...guardedUnavailable, timestampUtc: "2026-08-23T15:00:10.099Z" }
      ])
    ).toThrow("guarded force pulses must retain an interval of at least 10 seconds")
    expect(
      validateOneChannelExperimentRun([
        guardedRecord,
        { ...guardedUnavailable, timestampUtc: "2026-08-23T15:00:10.100Z" }
      ])
    ).toHaveLength(2)
    expect(() =>
      validateOneChannelExperimentRun([
        measuredRecord,
        {
          ...measuredRecord,
          sequence: { eventIndex: 2, runId: "RUN-001" },
          timestampUtc: measuredRecord.timestampUtc
        }
      ])
    ).toThrow("experiment timestamps must be strictly increasing")
    expect(() =>
      validateOneChannelExperimentRun([
        measuredRecord,
        {
          ...measuredRecord,
          sequence: { eventIndex: 2, runId: "RUN-001" },
          timestampUtc: "2026-08-23T14:59:59.999Z"
        }
      ])
    ).toThrow("experiment timestamps must be strictly increasing")
  })

  it("requires canonical UTC milliseconds before ordering or dwell evaluation", () => {
    for (const timestampUtc of ["2026-08-23T08:00:00.000-07:00", "2026-02-30T15:00:00.000Z", "2026-08-23T15:00:00Z"]) {
      expect(() => oneChannelExperimentRecordSchema.parse({ ...measuredRecord, timestampUtc })).toThrow(
        "timestamps must use canonical UTC milliseconds"
      )
    }
  })

  it("stays structurally denied even though arithmetic screens are useful", () => {
    const assessment = assessOneChannelAnalogExperiment()
    expect(oneChannelAnalogExperiment.authorization).toBe(false)
    expect(oneChannelAnalogExperiment.fabrication.apparatusBomIncluded).toBe(false)
    expect(oneChannelAnalogExperiment.fabrication.copperReleased).toBe(false)
    expect(oneChannelAnalogExperiment.fabrication.dnp).toBe(true)
    expect(oneChannelAnalogExperiment.fabrication.fabricationAuthorized).toBe(false)
    expect(assessment.authorization).toBe(false)
    expect(assessment.state).toBe("deny")
    expect(assessment.unresolvedGates).not.toHaveLength(0)
  })
})
