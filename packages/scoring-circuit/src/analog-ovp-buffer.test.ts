import { describe, expect, it } from "vitest"
import {
  assessOvpBufferCandidate,
  ovpBufferChannelTopologyScreen,
  ovpBufferFaultScreen,
  ovpBufferNormalRangeScreen,
  ovpBufferPowerScreen,
  ovpBufferSabreTimingScreen,
  ovpBufferStaticErrorScreen
} from "./analog-ovp-buffer.js"

describe("protected-buffer analog topology screen", () => {
  it("keeps normative signals in the PGA range but rejects the ADC common mode", () => {
    const zero = ovpBufferNormalRangeScreen(0)
    const open = ovpBufferNormalRangeScreen(Number.POSITIVE_INFINITY)

    expect(zero.pgaInputRangeCovered).toBe(true)
    expect(zero.outputCommonModeWithinPgaVocmRange).toBe(true)
    expect(zero.outputWithinPublished10kLoadRange).toBe(true)
    expect(zero.adcCommonModeRangeCovered).toBe(false)
    expect(open.pgaInputRangeCovered).toBe(true)
    expect(open.outputCommonModeWithinPgaVocmRange).toBe(true)
    expect(open.outputWithinPublished10kLoadRange).toBe(true)
    expect(open.adcCommonModeRangeCovered).toBe(false)
  })

  it("screens both twenty-four-volt fault polarities below the protected-input range", () => {
    const positive = ovpBufferFaultScreen(24)
    const negative = ovpBufferFaultScreen(-24)

    expect(positive.protectedInputRangeCovered).toBe(true)
    expect(negative.protectedInputRangeCovered).toBe(true)
    expect(positive.seriesLimitedCurrentA).toBeCloseTo(28.5 / 56_000, 12)
    expect(negative.seriesResistorPowerW).toBeCloseTo(positive.seriesResistorPowerW, 12)
  })

  it("fits the named-term static coupon screen without converting it into a release", () => {
    const screen = ovpBufferStaticErrorScreen(450, 125)

    expect(screen.totalOhms).toBeCloseTo(3.54, 2)
    expect(screen.arithmeticWithinCouponCaptureTarget).toBe(true)
    expect(screen.validatingPreCaptureScreen).toBe(false)
  })

  it("has sub-ten-microsecond non-validating sabre arithmetic and remains denied", () => {
    const timing = ovpBufferSabreTimingScreen()
    const assessment = assessOvpBufferCandidate()

    expect(timing.sourceFiveTimeConstantsUs).toBeCloseTo(4.81, 2)
    expect(timing.adcAcquisitionAndConversionUs).toBeCloseTo(0.987, 3)
    expect(timing.totalArithmeticUs).toBeCloseTo(6.75, 2)
    expect(timing.arithmeticWithinTenUsAllocation).toBe(true)
    expect(timing.validatingTimingScreen).toBe(false)
    expect(assessment.status).toBe("deny")
    expect(assessment.unresolvedGates).not.toHaveLength(0)
  })

  it("rejects direct seven-pair coverage by one eight-pin ADC", () => {
    const topology = ovpBufferChannelTopologyScreen()

    expect(topology.requestedDifferentialPairs).toBe(7)
    expect(topology.availableDirectDifferentialPairs).toBe(4)
    expect(topology.directChannelCoverage).toBe(false)
    expect(topology.requiresUnselectedExternalMuxOrAdditionalAdcs).toBe(true)
  })

  it("fails the one-watt worst-case power gate", () => {
    const power = ovpBufferPowerScreen()

    expect(power.pgaMaximumW).toBeCloseTo(0.406, 12)
    expect(power.knownMaximumPlusTypicalW).toBeCloseTo(0.446, 12)
    expect(power.remainingBeforeUnboundedLoadsW).toBeCloseTo(0.554, 12)
    expect(power.adcPowerIsTypicalOnly).toBe(true)
    expect(power.referenceAndRailLossesBounded).toBe(false)
    expect(power.worstCasePowerClosed).toBe(false)
  })

  it("rejects malformed screen inputs", () => {
    expect(() => ovpBufferFaultScreen(Number.NaN)).toThrow(RangeError)
    expect(() => ovpBufferNormalRangeScreen(-1)).toThrow(RangeError)
    expect(() => ovpBufferStaticErrorScreen(450, Number.POSITIVE_INFINITY)).toThrow(RangeError)
  })
})
