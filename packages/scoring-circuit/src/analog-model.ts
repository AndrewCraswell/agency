export const analogFrontEnd = {
  adcBits: 12,
  adcFilterCapacitancePf: 470,
  adcSeriesResistanceOhms: 1_000,
  comparatorTimestampResolutionUs: 1,
  excitationVoltage: 2.5,
  maximumClassificationErrorOhms: 5,
  maximumFullScanUs: 25,
  maximumRelevantSabreScanUs: 10,
  protectionSeriesResistanceOhms: 22,
  sourceResistanceOhms: 2_490,
  switchResistanceOhms: 2
} as const

/**
 * M4-03 calculation inputs. These are deliberately separate from the nominal
 * architecture model above: they are the maximum or minimum values claimed by
 * the M4-01 topology and M4-02 clamp candidate, not released schematic values.
 */
export const analogBudget = {
  adcFilterCapacitancePf: 470,
  adcFilterCapacitanceWithClampsAndSamplePf: 504.5,
  adcInputSeriesResistanceMaximumOhms: 1_010,
  adcSingleEndedIntegralLinearityTypicalLsb: 3.1,
  adcLsbVolts: 2.5 / (2 ** 12 - 1),
  adc1DiagnosticRankCount: 6,
  // DS12288 Table 66 tLATR maximum for CKMODE = 00. The two active ADCs use 52 MHz.
  adcMaximumTriggerLatencyUs: 2.5 / 52,
  adcOneRankConversionUs: (47.5 + 12.5) / 52,
  adcSampleCycles: 47.5,
  adcSampleClockMhz: 52,
  adcSlowChannelMaximumInputResistanceOhms: 1_800,
  clampLeakageGateOhms: 3.12,
  calibrationTemperatureC: 25,
  fixtureInterpolationAndStandardUncertaintyOhms: 0.5,
  fixtureTargetOhms: 5,
  lineCapacitanceBanksPf: [500, 2_000, 5_000, 10_000],
  sourceResistanceMaximumOhms: 2_490 * 1.0005 + 9.8 + 23.1,
  sourceResistorNominalOhms: 2_490,
  sourceResistorTemperatureCoefficientPpmPerC: 10,
  switchChargeInjectionPc: 1.5,
  switchEdgesPerPhase: 2
} as const

export const fieResistanceBoundaries = {
  epeeExceptionalExternalOhms: 100,
  foilClosedCircuitToleranceOhms: 200,
  foilExteriorOhms: 500,
  foilInsulationFaultAlwaysOffOhms: 475,
  foilInsulationFaultAlwaysOnOhms: 450,
  groundedMaterialEarthPathOhms: 100,
  sabreControlCircuitBreakOhms: 250,
  sabreExteriorOhms: 100,
  sabreInsulationFaultOhms: 450
} as const

export const fieTimingBoundariesUs = {
  epeeMaximumContactUs: 10_000,
  epeeMinimumContactUs: 2_000,
  foilContactUs: 14_000,
  foilContactToleranceUs: 1_000,
  sabreMaximumContactUs: 1_000,
  sabreMinimumContactUs: 100
} as const

export function expectedSenseVoltage(externalResistanceOhms: number): number {
  if (!Number.isFinite(externalResistanceOhms)) {
    return analogFrontEnd.excitationVoltage
  }

  const knownSeriesResistance =
    analogFrontEnd.sourceResistanceOhms +
    analogFrontEnd.switchResistanceOhms +
    analogFrontEnd.protectionSeriesResistanceOhms

  return (analogFrontEnd.excitationVoltage * externalResistanceOhms) / (knownSeriesResistance + externalResistanceOhms)
}

export function estimateExternalResistance(senseVoltage: number): number {
  if (senseVoltage >= analogFrontEnd.excitationVoltage) {
    return Number.POSITIVE_INFINITY
  }

  if (senseVoltage <= 0) {
    return 0
  }

  const knownSeriesResistance =
    analogFrontEnd.sourceResistanceOhms +
    analogFrontEnd.switchResistanceOhms +
    analogFrontEnd.protectionSeriesResistanceOhms

  return (knownSeriesResistance * senseVoltage) / (analogFrontEnd.excitationVoltage - senseVoltage)
}

export function adcCodeForResistance(externalResistanceOhms: number): number {
  const maximumCode = 2 ** analogFrontEnd.adcBits - 1
  return Math.round((expectedSenseVoltage(externalResistanceOhms) / analogFrontEnd.excitationVoltage) * maximumCode)
}

export function sourceTheveninResistanceOhms(externalResistanceOhms: number): number {
  return (
    (analogBudget.sourceResistanceMaximumOhms * externalResistanceOhms) /
    (analogBudget.sourceResistanceMaximumOhms + externalResistanceOhms)
  )
}

export function adcInputResistanceOhms(externalResistanceOhms: number): number {
  return sourceTheveninResistanceOhms(externalResistanceOhms) + analogBudget.adcInputSeriesResistanceMaximumOhms
}

export function resistanceSensitivityOhmsPerVolt(externalResistanceOhms: number): number {
  const senseVoltage =
    (analogFrontEnd.excitationVoltage * externalResistanceOhms) /
    (analogBudget.sourceResistanceMaximumOhms + externalResistanceOhms)
  return (
    (analogBudget.sourceResistanceMaximumOhms * analogFrontEnd.excitationVoltage) /
    (analogFrontEnd.excitationVoltage - senseVoltage) ** 2
  )
}

export function resistanceErrorForVoltageErrorOhms(externalResistanceOhms: number, voltageErrorVolts: number): number {
  return resistanceSensitivityOhmsPerVolt(externalResistanceOhms) * voltageErrorVolts
}

export function fiveTauSourceSettlingUs(externalResistanceOhms: number, lineCapacitancePf: number): number {
  return sourceTheveninResistanceOhms(externalResistanceOhms) * lineCapacitancePf * 1e-6 * 5
}

export function fiveTauAdcSettlingUs(externalResistanceOhms: number): number {
  return (
    adcInputResistanceOhms(externalResistanceOhms) * analogBudget.adcFilterCapacitanceWithClampsAndSamplePf * 1e-6 * 5
  )
}

/**
 * Conservative cascaded allocation. The connector-side source pole and the
 * ADC-filter pole are not independent parallel delays, so both settle before
 * sampling is permitted. This is a bound, not a fitted two-pole waveform.
 */
export function conservativeBlankingUs(externalResistanceOhms: number, lineCapacitancePf: number): number {
  return (
    fiveTauSourceSettlingUs(externalResistanceOhms, lineCapacitancePf) + fiveTauAdcSettlingUs(externalResistanceOhms)
  )
}

export function acquisitionUs(
  externalResistanceOhms: number,
  lineCapacitancePf: number,
  adc1RankCount: number
): number {
  return (
    conservativeBlankingUs(externalResistanceOhms, lineCapacitancePf) +
    analogBudget.adcMaximumTriggerLatencyUs +
    analogBudget.adcOneRankConversionUs * adc1RankCount
  )
}

export function fullDiagnosticAcquisitionUs(externalResistanceOhms: number, lineCapacitancePf: number): number {
  return acquisitionUs(externalResistanceOhms, lineCapacitancePf, analogBudget.adc1DiagnosticRankCount)
}

export function switchChargeErrorOhms(externalResistanceOhms: number, lineCapacitancePf: number): number {
  const capacitancePf = lineCapacitancePf + analogBudget.adcFilterCapacitanceWithClampsAndSamplePf
  const voltageError = (analogBudget.switchChargeInjectionPc * analogBudget.switchEdgesPerPhase) / capacitancePf
  return resistanceErrorForVoltageErrorOhms(externalResistanceOhms, voltageError)
}

/**
 * The post-calibration error caused by the proposed source resistor's
 * temperature coefficient. This intentionally covers only the resistor: the
 * switch, clamps, ADC, board leakage, and reference routing remain coupon
 * measurement gates.
 */
export function sourceResistorTemperatureErrorOhms(externalResistanceOhms: number, temperatureC: number): number {
  const resistanceChangeOhms =
    analogBudget.sourceResistorNominalOhms *
    analogBudget.sourceResistorTemperatureCoefficientPpmPerC *
    Math.abs(temperatureC - analogBudget.calibrationTemperatureC) *
    1e-6

  return (
    (externalResistanceOhms * resistanceChangeOhms) / (analogBudget.sourceResistanceMaximumOhms + resistanceChangeOhms)
  )
}

/**
 * Absolute-sum M4-03 screening calculation at a fixed calibration temperature.
 * The ADC EL term is an LQFP100 typical characterization result, not an LQFP64
 * guarantee; this function is deliberately a regression screen, never a release
 * claim.
 */
export function m403ScreenedStaticErrorOhms(externalResistanceOhms: number, temperatureC: number): number {
  const adcQuantizationError = resistanceErrorForVoltageErrorOhms(externalResistanceOhms, analogBudget.adcLsbVolts / 2)
  const adcIntegralLinearityTypicalError = resistanceErrorForVoltageErrorOhms(
    externalResistanceOhms,
    analogBudget.adcSingleEndedIntegralLinearityTypicalLsb * analogBudget.adcLsbVolts
  )
  const settledSwitchChargeError = switchChargeErrorOhms(externalResistanceOhms, 500) * Math.exp(-5)

  return (
    analogBudget.clampLeakageGateOhms +
    adcQuantizationError +
    adcIntegralLinearityTypicalError +
    analogBudget.fixtureInterpolationAndStandardUncertaintyOhms +
    settledSwitchChargeError +
    sourceResistorTemperatureErrorOhms(externalResistanceOhms, temperatureC)
  )
}
