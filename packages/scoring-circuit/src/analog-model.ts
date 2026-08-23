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
  // Leakage-only BAV199 experiment: one diode replaces the BAT54 negative
  // clamp. The 80 nA value is the vendor maximum at 75 V and TJ = 150 C,
  // not a guaranteed assembled-coupon value at the actual low reverse
  // voltages or a guarantee that the external diode conducts before the MCU
  // pad protection path.
  leakageExperimentClampReverseLeakageMaximumNa: 80,
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

/**
 * Convert a bounded clamp leakage current into the resistance error at the
 * ADC pin. This is a screen for a declared leakage bound, not an assembled
 * board result; diode leakage must still be measured at the actual pin
 * voltages and temperature corners.
 */
export function clampLeakageErrorOhms(externalResistanceOhms: number, leakageCurrentNa: number): number {
  const leakageVoltageError = adcInputResistanceOhms(externalResistanceOhms) * leakageCurrentNa * 1e-9
  return resistanceErrorForVoltageErrorOhms(externalResistanceOhms, leakageVoltageError)
}

/**
 * Conditional negative-injection screen through the existing 22 ohm + 1 kohm
 * path. The input is the post-TPD conductor residual, after the TPD lower
 * steering diode and upstream of both resistors. The STM32's -0.3 V input
 * boundary is used as a screening endpoint, not as an internal-clamp knee. A
 * measured post-TPD residual and the actual MCU clamp voltage are still
 * required before this can describe a guaranteed injected current.
 */
export function negativeInjectionScreenMa(postTpdResidualVolts: number): number {
  const negativePathResistanceOhms =
    analogFrontEnd.protectionSeriesResistanceOhms + analogFrontEnd.adcSeriesResistanceOhms
  const residualBeyondInputBoundaryVolts = -postTpdResidualVolts - 0.3

  return Math.max(0, (residualBeyondInputBoundaryVolts / negativePathResistanceOhms) * 1_000)
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

/**
 * Leakage-only BAV199 experiment. Both positive and negative clamp diodes are
 * screened at the BAV199 80 nA vendor maximum. This remains conditional: the
 * reverse-leakage test point, external-clamp priority, negative transient
 * behavior, and LQFP64 ADC accuracy are not closed by this arithmetic.
 */
export function m403LowLeakageClampExperimentScreenOhms(externalResistanceOhms: number, temperatureC: number): number {
  const adcQuantizationError = resistanceErrorForVoltageErrorOhms(externalResistanceOhms, analogBudget.adcLsbVolts / 2)
  const adcIntegralLinearityTypicalError = resistanceErrorForVoltageErrorOhms(
    externalResistanceOhms,
    analogBudget.adcSingleEndedIntegralLinearityTypicalLsb * analogBudget.adcLsbVolts
  )
  const settledSwitchChargeError = switchChargeErrorOhms(externalResistanceOhms, 500) * Math.exp(-5)
  const experimentClampLeakageError = clampLeakageErrorOhms(
    externalResistanceOhms,
    analogBudget.leakageExperimentClampReverseLeakageMaximumNa * 2
  )

  return (
    experimentClampLeakageError +
    adcQuantizationError +
    adcIntegralLinearityTypicalError +
    analogBudget.fixtureInterpolationAndStandardUncertaintyOhms +
    settledSwitchChargeError +
    sourceResistorTemperatureErrorOhms(externalResistanceOhms, temperatureC)
  )
}
