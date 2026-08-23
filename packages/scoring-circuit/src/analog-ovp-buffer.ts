import {
  analogBudget,
  resistanceErrorForVoltageErrorOhms,
  sourceResistorTemperatureErrorOhms,
  switchChargeErrorOhms
} from "./analog-model.js"

/**
 * Coupon-only screen for the protected-buffer acquisition alternative.
 *
 * This deliberately has no connection to the apparatus circuit, component
 * register, or readiness gates. It demonstrates why a fault-protected input
 * stage is worth a physical experiment, while preserving every unresolved
 * fault, power, timing, and calibration limitation as a DENY.
 */
export const ovpBufferCandidate = {
  adc: {
    acquisitionMinimumUs: 0.46,
    analogInputPins: 8,
    conversionMaximumUs: 0.527,
    directDifferentialPairs: 4,
    differentialFullScaleVolts: 4.096,
    driverAndFilterSelected: false,
    inputCommonModeCenterVolts: 2.048,
    inputCommonModeToleranceVolts: 0.1,
    integralLinearityMaximumLsb: 1,
    muxParasiticCapacitancePf: 20,
    muxSwitchResistanceOhms: 40,
    powerTypicalW: 0.04,
    referenceTemperatureCoefficientPpmPerC: 20,
    samplingCapacitancePf: 50,
    samplingSwitchResistanceOhms: 40
  },
  couponCaptureTargetOhms: 4.5,
  fault: {
    maximumMagnitudeVolts: 24,
    protectedInputBeyondRailVolts: 40,
    seriesResistanceOhms: 56_000
  },
  pga855: {
    channels: 7,
    gain: 1,
    inputBiasCurrentMaximumNa: 1.8,
    inputCommonModeHeadroomVolts: 2.5,
    inputOffsetMaximumAt25cUv: 350,
    inputOffsetTemperatureCoefficientMaximumUvPerC: 1,
    inputSupplyMagnitudeVolts: 4.5,
    outputSupplyHighVolts: 5,
    outputSupplyLowVolts: 0,
    outputCommonModeVolts: 2.5,
    outputCommonModeMinimumVolts: 1.5,
    outputCommonModeMaximumVolts: 3.5,
    outputNoLoadMinimumVoltsAtPlusMinus2Point25V: 0.1,
    outputNoLoadMaximumVoltsAtPlusMinus2Point25V: 4.4,
    output10kLoadMinimumVoltsAtPlusMinus2Point25V: 0.2,
    output10kLoadMaximumVoltsAtPlusMinus2Point25V: 4.3,
    inputStageQuiescentCurrentMaximumA: 0.0045,
    outputStageQuiescentCurrentMaximumA: 0.0035,
    settlingTo15PpmUs: 0.95,
    sourceGainDriftMaximumPpmPerC: 1
  },
  reference: {
    sourceTemperatureCoefficientPpmPerC: 8
  },
  isolatedDomain: {
    maximumPowerW: 1
  },
  screen: {
    externalResistanceOhms: 450,
    lineCapacitancePf: 500,
    sabreResistanceOhms: 100,
    sabreLineCapacitancePf: 10_000
  }
} as const

function requireFiniteNonNegative(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${name} must be finite and non-negative`)
}

function sourceTheveninResistanceOhms(externalResistanceOhms: number): number {
  return (
    (analogBudget.sourceResistanceMaximumOhms * externalResistanceOhms) /
    (analogBudget.sourceResistanceMaximumOhms + externalResistanceOhms)
  )
}

function sourceSenseVoltage(externalResistanceOhms: number): number {
  if (!Number.isFinite(externalResistanceOhms)) return 2.5
  return (2.5 * externalResistanceOhms) / (analogBudget.sourceResistanceMaximumOhms + externalResistanceOhms)
}

function adcLsbVolts(): number {
  return (ovpBufferCandidate.adc.differentialFullScaleVolts * 2) / (2 ** 16 - 1)
}

/**
 * The input stage remains within its published common-mode range for the
 * source-on normal voltage. This checks device range only, not transient or
 * output-stage behavior.
 */
export function ovpBufferNormalRangeScreen(externalResistanceOhms: number) {
  if (Number.isNaN(externalResistanceOhms) || externalResistanceOhms < 0) {
    throw new RangeError("externalResistanceOhms must be non-negative or positive infinity")
  }

  const normalInputVoltage = sourceSenseVoltage(externalResistanceOhms)
  const { pga855 } = ovpBufferCandidate
  const inputCommonModeVoltage = normalInputVoltage / 2
  const commonModeMinimum = -pga855.inputSupplyMagnitudeVolts + pga855.inputCommonModeHeadroomVolts
  const commonModeMaximum = pga855.inputSupplyMagnitudeVolts - pga855.inputCommonModeHeadroomVolts
  const outputPositiveVoltage = pga855.outputCommonModeVolts + normalInputVoltage / 2
  const outputNegativeVoltage = pga855.outputCommonModeVolts - normalInputVoltage / 2
  const adcCommonModeMinimum =
    ovpBufferCandidate.adc.inputCommonModeCenterVolts - ovpBufferCandidate.adc.inputCommonModeToleranceVolts
  const adcCommonModeMaximum =
    ovpBufferCandidate.adc.inputCommonModeCenterVolts + ovpBufferCandidate.adc.inputCommonModeToleranceVolts

  return {
    adcCommonModeMaximum,
    adcCommonModeMinimum,
    adcCommonModeRangeCovered:
      pga855.outputCommonModeVolts >= adcCommonModeMinimum && pga855.outputCommonModeVolts <= adcCommonModeMaximum,
    commonModeMaximum,
    commonModeMinimum,
    inputCommonModeVoltage,
    normalInputVoltage,
    outputNegativeVoltage,
    outputPositiveVoltage,
    outputCommonModeWithinPgaVocmRange:
      pga855.outputCommonModeVolts >= pga855.outputCommonModeMinimumVolts &&
      pga855.outputCommonModeVolts <= pga855.outputCommonModeMaximumVolts,
    outputWithinPublished10kLoadRange:
      outputNegativeVoltage >= pga855.output10kLoadMinimumVoltsAtPlusMinus2Point25V &&
      outputPositiveVoltage <= pga855.output10kLoadMaximumVoltsAtPlusMinus2Point25V,
    pgaInputRangeCovered: inputCommonModeVoltage >= commonModeMinimum && inputCommonModeVoltage <= commonModeMaximum
  }
}

/**
 * Resistor-limited source current into the protected amplifier input. This is
 * a source-current ceiling, not a claim of internal fault dissipation, clamp
 * temperature, output validity, or a safe apparatus fault response.
 */
export function ovpBufferFaultScreen(faultVoltageVolts: number) {
  if (!Number.isFinite(faultVoltageVolts)) throw new RangeError("faultVoltageVolts must be finite")

  const { fault, pga855 } = ovpBufferCandidate
  const maximumInputRailSeparationVolts = Math.abs(faultVoltageVolts) + pga855.inputSupplyMagnitudeVolts
  const seriesLimitedCurrentA = maximumInputRailSeparationVolts / fault.seriesResistanceOhms
  const allChannelsSeriesLimitedCurrentA = seriesLimitedCurrentA * pga855.channels

  return {
    allChannelsSeriesLimitedCurrentA,
    faultVoltageVolts,
    maximumInputRailSeparationVolts,
    protectedInputRangeCovered: maximumInputRailSeparationVolts <= fault.protectedInputBeyondRailVolts,
    seriesLimitedCurrentA,
    seriesResistorPowerW: seriesLimitedCurrentA ** 2 * fault.seriesResistanceOhms
  }
}

/**
 * Absolute-sum, coupon-only static screen. The PGA offset expression uses its
 * 25 C maximum plus its specified maximum drift. The external ADC conversion
 * uses its full-scale 16-bit code width. It does not invent package, board,
 * reference-buffer, crosstalk, mux-memory, or fault-recovery bounds.
 */
export function ovpBufferStaticErrorScreen(externalResistanceOhms: number, temperatureC: number) {
  requireFiniteNonNegative("externalResistanceOhms", externalResistanceOhms)
  if (!Number.isFinite(temperatureC)) throw new RangeError("temperatureC must be finite")

  const temperatureDeltaC = Math.abs(temperatureC - analogBudget.calibrationTemperatureC)
  const pgaOffsetVolts =
    (ovpBufferCandidate.pga855.inputOffsetMaximumAt25cUv +
      ovpBufferCandidate.pga855.inputOffsetTemperatureCoefficientMaximumUvPerC * temperatureDeltaC) *
    1e-6
  // Both temperature coefficients are bounded in magnitude, not correlated in
  // sign. A worst-case ratiometric mismatch is therefore their sum, not their
  // arithmetic difference.
  const referenceTemperatureMismatchFraction =
    (ovpBufferCandidate.adc.referenceTemperatureCoefficientPpmPerC +
      ovpBufferCandidate.reference.sourceTemperatureCoefficientPpmPerC) *
    temperatureDeltaC *
    1e-6
  const lsbVolts = adcLsbVolts()
  const breakdown = {
    adcIntegralLinearity: resistanceErrorForVoltageErrorOhms(
      externalResistanceOhms,
      lsbVolts * ovpBufferCandidate.adc.integralLinearityMaximumLsb
    ),
    adcQuantization: resistanceErrorForVoltageErrorOhms(externalResistanceOhms, lsbVolts / 2),
    fixture: analogBudget.fixtureInterpolationAndStandardUncertaintyOhms,
    pgaInputBias: resistanceErrorForVoltageErrorOhms(
      externalResistanceOhms,
      sourceTheveninResistanceOhms(externalResistanceOhms) *
        ovpBufferCandidate.pga855.inputBiasCurrentMaximumNa *
        1e-9 +
        ovpBufferCandidate.fault.seriesResistanceOhms * ovpBufferCandidate.pga855.inputBiasCurrentMaximumNa * 1e-9
    ),
    pgaInputOffset: resistanceErrorForVoltageErrorOhms(externalResistanceOhms, pgaOffsetVolts),
    pgaGainDrift:
      externalResistanceOhms * ovpBufferCandidate.pga855.sourceGainDriftMaximumPpmPerC * temperatureDeltaC * 1e-6,
    referenceTemperatureMismatch: resistanceErrorForVoltageErrorOhms(
      externalResistanceOhms,
      sourceSenseVoltage(externalResistanceOhms) * referenceTemperatureMismatchFraction
    ),
    sourceResistorTemperature: sourceResistorTemperatureErrorOhms(externalResistanceOhms, temperatureC),
    tmuxChargeAfterFiveTimeConstants: switchChargeErrorOhms(externalResistanceOhms, 500) * Math.exp(-5)
  }
  const totalOhms = Object.values(breakdown).reduce((total, errorOhms) => total + errorOhms, 0)

  return {
    arithmeticWithinCouponCaptureTarget: totalOhms <= ovpBufferCandidate.couponCaptureTargetOhms,
    breakdown,
    lsbVolts,
    totalOhms,
    validatingPreCaptureScreen: false
  }
}

/**
 * Arithmetic allocation only. Published acquisition and conversion intervals
 * do not prove driver settling, mux memory, scheduling, or end-to-end sabre
 * qualification.
 */
export function ovpBufferSabreTimingScreen() {
  const { pga855, screen } = ovpBufferCandidate
  const sourcePoleUs = sourceTheveninResistanceOhms(screen.sabreResistanceOhms) * screen.sabreLineCapacitancePf * 1e-6
  const sourceFiveTimeConstantsUs = sourcePoleUs * 5
  const adcAcquisitionAndConversionUs =
    ovpBufferCandidate.adc.acquisitionMinimumUs + ovpBufferCandidate.adc.conversionMaximumUs
  const totalArithmeticUs = sourceFiveTimeConstantsUs + pga855.settlingTo15PpmUs + adcAcquisitionAndConversionUs

  return {
    adcAcquisitionAndConversionUs,
    excludesDriverFilterMuxMemorySchedulerAndFaultRecovery: true,
    pgaSettlingUs: pga855.settlingTo15PpmUs,
    sourceFiveTimeConstantsUs,
    totalArithmeticUs,
    arithmeticWithinTenUsAllocation: totalArithmeticUs <= 10,
    validatingTimingScreen: false
  }
}

export function ovpBufferChannelTopologyScreen() {
  const requestedDifferentialPairs = ovpBufferCandidate.pga855.channels
  const availableDirectDifferentialPairs = ovpBufferCandidate.adc.directDifferentialPairs

  return {
    availableDirectDifferentialPairs,
    directChannelCoverage: availableDirectDifferentialPairs >= requestedDifferentialPairs,
    requestedDifferentialPairs,
    requiresUnselectedExternalMuxOrAdditionalAdcs: availableDirectDifferentialPairs < requestedDifferentialPairs
  }
}

export function ovpBufferPowerScreen() {
  const { adc, isolatedDomain, pga855 } = ovpBufferCandidate
  const pgaInputStageMaximumW =
    pga855.channels * pga855.inputStageQuiescentCurrentMaximumA * pga855.inputSupplyMagnitudeVolts * 2
  const pgaOutputStageMaximumW =
    pga855.channels *
    pga855.outputStageQuiescentCurrentMaximumA *
    (pga855.outputSupplyHighVolts - pga855.outputSupplyLowVolts)
  const pgaMaximumW = pgaInputStageMaximumW + pgaOutputStageMaximumW
  const knownMaximumPlusTypicalW = pgaMaximumW + adc.powerTypicalW

  return {
    adcPowerIsTypicalOnly: true,
    adcTypicalW: adc.powerTypicalW,
    isolatedDomainMaximumW: isolatedDomain.maximumPowerW,
    knownMaximumPlusTypicalW,
    pgaInputStageMaximumW,
    pgaMaximumW,
    pgaOutputStageMaximumW,
    referenceAndRailLossesBounded: false,
    remainingBeforeUnboundedLoadsW: isolatedDomain.maximumPowerW - knownMaximumPlusTypicalW,
    worstCasePowerClosed: false
  }
}

export function assessOvpBufferCandidate() {
  const staticScreen = ovpBufferStaticErrorScreen(ovpBufferCandidate.screen.externalResistanceOhms, 125)
  const faultPositive = ovpBufferFaultScreen(ovpBufferCandidate.fault.maximumMagnitudeVolts)
  const faultNegative = ovpBufferFaultScreen(-ovpBufferCandidate.fault.maximumMagnitudeVolts)

  return {
    faults: { faultNegative, faultPositive },
    normalRanges: {
      open: ovpBufferNormalRangeScreen(Number.POSITIVE_INFINITY),
      zero: ovpBufferNormalRangeScreen(0)
    },
    screens: {
      channelTopology: ovpBufferChannelTopologyScreen(),
      power: ovpBufferPowerScreen(),
      sabre: ovpBufferSabreTimingScreen(),
      static: staticScreen
    },
    status: "deny" as const,
    unresolvedGates: [
      "PGA855 overvoltage current enters the input-stage supply rails; rail clamps, their thermal limits, and the 1 W isolated-domain margin are not designed or verified.",
      "PGA855 output behavior during powered, ramping, brownout, and unpowered input faults is not a functional guarantee. It must be measured before an ADC or scoring controller is connected.",
      "PGA855 VOCM at 2.5 V is outside the LTC2373-16 1.948 V to 2.148 V differential-input common-mode window. An explicit compatible reference and common-mode design is absent.",
      "One LTC2373-16 has eight analog input pins and therefore only four direct differential pairs, not the seven required. An external mux, shared conversion stage, or additional ADCs is unselected.",
      "The ADC presents a 50 pF and 40 ohm sampling input behind a mux adding about 20 pF and 40 ohm. Its driver and filter, channel memory, crosstalk, reference behavior, and SPI recovery are unselected and unbounded.",
      "The 1 W isolated-domain worst-case load is not closed: PGA maxima consume 0.406 W, ADC power is only typical, and reference and rail-conversion losses are unbounded.",
      "Seven channels need a complete cross-channel, leakage, cable-capacitance, startup, recovery, and 50 C blocked-vent coupon result.",
      "No external ADC, negative-rail generator, shunt clamp, fault flag, schematic, production BOM, or fabrication approval is selected by this study."
    ]
  }
}
