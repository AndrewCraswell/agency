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
