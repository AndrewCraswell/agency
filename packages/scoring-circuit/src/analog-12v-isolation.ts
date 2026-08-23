import { analogBudget } from "./analog-model.js"

/**
 * Deferred, coupon-only 12 V fault-isolation screen for the ADG5412F.
 *
 * This deliberately has no connection to component-decisions, part-readiness,
 * or the apparatus circuit. It records why a seemingly viable protected-switch
 * alternative remains denied before it can be mistaken for a BOM selection.
 */
export const deferred12vIsolation = {
  adg5412f: {
    channelsPerPackage: 4,
    normalSupplyMinimumV: 8,
    normalSupplyMaximumV: 44,
    normalSignalMinimumV: 0,
    protectedSourceFaultMagnitudeV: 55,
    sourceToSupplyMaximumV: 80,
    sourceOnResistanceMaximumOhms: 37,
    channelLeakageMaximumNa: 4.5,
    faultDrainLeakageMaximumNa: 65,
    sourceFaultLeakageTypicalUa: 78,
    chargeInjectionTypical12vPc: 340,
    chargeInjectionConservativeCrossConditionPc: 640,
    faultResponseMaximumNs: 720,
    faultRecoveryMaximumNs: 960
  },
  sourceEsd: {
    leakageMaximumNa: 10,
    workingStandoffV: 24,
    surgeClampAt3AV: 37,
    surgeClampHasMaximumGuarantee: false
  },
  boost: {
    inputRailV: 5,
    enablePullupOhms: 10_000,
    enablePulldownOhms: 100_000,
    outputCapacitorMpn: "C2012X7R1H475K125AC",
    outputCapacitorRatedV: 50,
    outputCapacitanceUf: 4.7,
    adgDecouplingPerPackageNf: 100,
    feedbackReferenceMinimumV: 1.208,
    feedbackReferenceMaximumV: 1.258,
    feedbackTopResistanceOhms: 89_300,
    feedbackBottomResistanceOhms: 10_000,
    feedbackResistanceTolerance: 0.001,
    converterSwitchCurrentLimitMinimumMa: 215,
    isolatedSupplyMaximumW: 1
  },
  supervisor: {
    thresholdMinimumV: 0.396,
    thresholdMaximumV: 0.404,
    hysteresisMaximumV: 0.012,
    dividerTolerance: 0.001,
    undervoltageTopResistanceOhms: 277_000,
    overvoltageTopResistanceOhms: 314_000,
    dividerBottomResistanceOhms: 10_000,
    inputCurrentMaximumNa: 25,
    outputStartupMaximumUs: 450
  },
  screen: {
    externalResistanceOhms: 450,
    lineCapacitancePf: 500,
    adcPathCapacitancePf: 504.5,
    sourceSeriesResistanceMaximumOhms: 2_525.978445 + 37,
    sourceResistorTemperatureErrorOhms: 0.44359070224386826,
    fixtureUncertaintyOhms: 0.5,
    adcIntegralLinearityTypicalLsb: 3.1,
    adcLsbVolts: 2.5 / (2 ** 12 - 1),
    bav199PairLeakageNa: 160,
    tmuxChargeInjectionPc: 3,
    couponCaptureTargetOhms: 4.5,
    maximumRelevantSabreScanUs: 10,
    adcTriggerLatencyUs: 2.5 / 52,
    adcTwoRankConversionUs: ((47.5 + 12.5) / 52) * 2
  }
} as const

function dividerVoltageBounds(
  topResistanceOhms: number,
  bottomResistanceOhms: number,
  referenceMinimumV: number,
  referenceMaximumV: number,
  tolerance: number,
  inputCurrentMaximumNa = 0
) {
  const inputCurrentMaximumA = inputCurrentMaximumNa * 1e-9
  return {
    minimumV:
      referenceMinimumV * (1 + (topResistanceOhms * (1 - tolerance)) / (bottomResistanceOhms * (1 + tolerance))) -
      inputCurrentMaximumA * topResistanceOhms * (1 + tolerance),
    maximumV:
      referenceMaximumV * (1 + (topResistanceOhms * (1 + tolerance)) / (bottomResistanceOhms * (1 - tolerance))) +
      inputCurrentMaximumA * topResistanceOhms * (1 + tolerance)
  }
}

export function deferred12vBoostBounds() {
  const { boost } = deferred12vIsolation
  return {
    ...dividerVoltageBounds(
      boost.feedbackTopResistanceOhms,
      boost.feedbackBottomResistanceOhms,
      boost.feedbackReferenceMinimumV,
      boost.feedbackReferenceMaximumV,
      boost.feedbackResistanceTolerance
    ),
    includesOnlyReferenceDividerAndTolerance: true
  }
}

export function deferred12vSupervisorWindowBounds() {
  const { supervisor } = deferred12vIsolation
  const risingUndervoltage = dividerVoltageBounds(
    supervisor.undervoltageTopResistanceOhms,
    supervisor.dividerBottomResistanceOhms,
    supervisor.thresholdMinimumV,
    supervisor.thresholdMaximumV,
    supervisor.dividerTolerance,
    supervisor.inputCurrentMaximumNa
  )
  const risingOvervoltage = dividerVoltageBounds(
    supervisor.overvoltageTopResistanceOhms,
    supervisor.dividerBottomResistanceOhms,
    supervisor.thresholdMinimumV,
    supervisor.thresholdMaximumV,
    supervisor.dividerTolerance,
    supervisor.inputCurrentMaximumNa
  )
  const fallingUndervoltageMinimumV =
    (supervisor.thresholdMinimumV - supervisor.hysteresisMaximumV) *
      (1 +
        (supervisor.undervoltageTopResistanceOhms * (1 - supervisor.dividerTolerance)) /
          (supervisor.dividerBottomResistanceOhms * (1 + supervisor.dividerTolerance))) -
    supervisor.inputCurrentMaximumNa *
      1e-9 *
      supervisor.undervoltageTopResistanceOhms *
      (1 + supervisor.dividerTolerance)

  return {
    fallingUndervoltageMinimumV,
    risingUndervoltage,
    risingOvervoltage
  }
}

export function deferred12vFaultScreen(faultVoltageV: number) {
  const { adg5412f } = deferred12vIsolation
  const boostBounds = deferred12vBoostBounds()
  const sourceToVssStressV = Math.abs(faultVoltageV)
  const sourceToVddStressV = Math.max(
    Math.abs(faultVoltageV - boostBounds.minimumV),
    Math.abs(faultVoltageV - boostBounds.maximumV)
  )
  const sourceToSupplyStressV = Math.max(sourceToVssStressV, sourceToVddStressV)

  return {
    faultMagnitudeV: Math.abs(faultVoltageV),
    sourceToSupplyStressV,
    sourceToVddStressV,
    sourceToVssStressV,
    withinProtectedSourceMagnitude: Math.abs(faultVoltageV) <= adg5412f.protectedSourceFaultMagnitudeV,
    withinSourceToSupplyStress: sourceToSupplyStressV <= adg5412f.sourceToSupplyMaximumV,
    drainLeakageMaximumNa: adg5412f.faultDrainLeakageMaximumNa,
    // The source-fault current is typical only. It is intentionally surfaced
    // without an invented maximum power or thermal result.
    sourceFaultLeakageTypicalUa: adg5412f.sourceFaultLeakageTypicalUa,
    responseMaximumNs: adg5412f.faultResponseMaximumNs,
    recoveryMaximumNs: adg5412f.faultRecoveryMaximumNs,
    outputIsolatorTarget: "unavailable"
  }
}

function sourceTheveninResistanceOhms(): number {
  const { externalResistanceOhms, sourceSeriesResistanceMaximumOhms } = deferred12vIsolation.screen
  return (
    (sourceSeriesResistanceMaximumOhms * externalResistanceOhms) /
    (sourceSeriesResistanceMaximumOhms + externalResistanceOhms)
  )
}

function resistanceSensitivityOhmsPerVolt(): number {
  const { externalResistanceOhms, sourceSeriesResistanceMaximumOhms } = deferred12vIsolation.screen
  const senseVoltage = (2.5 * externalResistanceOhms) / (sourceSeriesResistanceMaximumOhms + externalResistanceOhms)
  return (sourceSeriesResistanceMaximumOhms * 2.5) / (2.5 - senseVoltage) ** 2
}

function leakageErrorOhms(leakageNa: number): number {
  const adcInputResistanceOhms = sourceTheveninResistanceOhms() + analogBudget.adcInputSeriesResistanceMaximumOhms
  return resistanceSensitivityOhmsPerVolt() * adcInputResistanceOhms * leakageNa * 1e-9
}

export function deferred12vAcquisitionScreen(externalResistanceOhms: number, settlingTimeConstants: number) {
  if (!Number.isFinite(externalResistanceOhms) || externalResistanceOhms < 0) {
    throw new RangeError("externalResistanceOhms must be a finite nonnegative number")
  }
  if (!Number.isFinite(settlingTimeConstants) || settlingTimeConstants < 0) {
    throw new RangeError("settlingTimeConstants must be a finite nonnegative number")
  }

  const { screen } = deferred12vIsolation
  const sourceTheveninOhms =
    (screen.sourceSeriesResistanceMaximumOhms * externalResistanceOhms) /
    (screen.sourceSeriesResistanceMaximumOhms + externalResistanceOhms)
  const sourcePoleUs = sourceTheveninOhms * screen.lineCapacitancePf * 1e-6
  const adcPoleUs =
    (sourceTheveninOhms + analogBudget.adcInputSeriesResistanceMaximumOhms) * screen.adcPathCapacitancePf * 1e-6
  const blankingUs = settlingTimeConstants * (sourcePoleUs + adcPoleUs)

  return {
    blankingUs,
    externalResistanceOhms,
    fullAdcPathUs: blankingUs + screen.adcTriggerLatencyUs + screen.adcTwoRankConversionUs,
    excludesUnboundedAndImplementationDelays: true
  }
}

export function deferred12vIsolationErrorScreen(settlingTimeConstants: number) {
  if (!Number.isFinite(settlingTimeConstants) || settlingTimeConstants < 0) {
    throw new RangeError("settlingTimeConstants must be a finite nonnegative number")
  }

  const { adg5412f, screen } = deferred12vIsolation
  const sensitivityOhmsPerVolt = resistanceSensitivityOhmsPerVolt()
  const totalCapacitancePf = screen.lineCapacitancePf + screen.adcPathCapacitancePf
  const attenuation = Math.exp(-settlingTimeConstants)
  const acquisition = deferred12vAcquisitionScreen(screen.externalResistanceOhms, settlingTimeConstants)
  const staticWithoutSwitchChargeOhms =
    leakageErrorOhms(deferred12vIsolation.sourceEsd.leakageMaximumNa) +
    leakageErrorOhms(screen.bav199PairLeakageNa) +
    leakageErrorOhms(adg5412f.channelLeakageMaximumNa) +
    sensitivityOhmsPerVolt * (screen.adcLsbVolts / 2) +
    sensitivityOhmsPerVolt * (screen.adcIntegralLinearityTypicalLsb * screen.adcLsbVolts) +
    screen.sourceResistorTemperatureErrorOhms +
    screen.fixtureUncertaintyOhms
  const tmuxChargeAfterBlankingOhms =
    (screen.tmuxChargeInjectionPc / totalCapacitancePf) * sensitivityOhmsPerVolt * attenuation
  const adgChargeAfterBlankingTypical12vOutputOnlyOhms =
    (adg5412f.chargeInjectionTypical12vPc / screen.adcPathCapacitancePf) * sensitivityOhmsPerVolt * attenuation
  const adgChargeAfterBlankingConservativeCombinedCapacitanceOhms =
    (adg5412f.chargeInjectionConservativeCrossConditionPc / totalCapacitancePf) * sensitivityOhmsPerVolt * attenuation
  const adgChargeAfterBlankingConservativeOutputOnlyOhms =
    (adg5412f.chargeInjectionConservativeCrossConditionPc / screen.adcPathCapacitancePf) *
    sensitivityOhmsPerVolt *
    attenuation
  const totalOhms =
    staticWithoutSwitchChargeOhms + tmuxChargeAfterBlankingOhms + adgChargeAfterBlankingConservativeOutputOnlyOhms

  return {
    adgChargeAfterBlankingConservativeCombinedCapacitanceOhms,
    adgChargeAfterBlankingConservativeOutputOnlyOhms,
    adgChargeAfterBlankingTypical12vOutputOnlyOhms,
    blankingUs: acquisition.blankingUs,
    fullAdcPathUs: acquisition.fullAdcPathUs,
    sourceTheveninResistanceOhms: sourceTheveninResistanceOhms(),
    staticWithoutSwitchChargeOhms,
    tmuxChargeAfterBlankingOhms,
    totalOhms,
    usesConservativeCrossConditionChargeInjection: true,
    usesTypicalOnlyChargeInjection: true,
    withinCouponCaptureTarget: totalOhms <= screen.couponCaptureTargetOhms
  }
}

export function assessDeferred12vIsolation() {
  const boost = deferred12vBoostBounds()
  const window = deferred12vSupervisorWindowBounds()
  const fiveTau = deferred12vIsolationErrorScreen(5)
  const tenTau = deferred12vIsolationErrorScreen(10)
  const positiveFault = deferred12vFaultScreen(24)
  const negativeFault = deferred12vFaultScreen(-24)
  const sabre100OhmTenTau = deferred12vAcquisitionScreen(100, 10)

  return {
    boost,
    faults: { negativeFault, positiveFault },
    normalRangeCovered:
      boost.minimumV >= deferred12vIsolation.adg5412f.normalSupplyMinimumV &&
      boost.maximumV <= deferred12vIsolation.adg5412f.normalSupplyMaximumV,
    status: "deny" as const,
    supervisorWindow: window,
    unresolvedGates: [
      "ADG5412F specifies 340 pC typical at its 12 V condition and no maximum; the 640 pC screen is a conservative typical from a different supply and signal condition.",
      "At five time constants the output-capacitance-only conservative charge screen fails the 4.50 ohm coupon pre-capture target.",
      "The 100 ohm sabre arithmetic is 8.47 us at ten time constants before unbounded charge, switch-on, logic, clock, and implementation delays, so it is not a timing release.",
      "ADG5412F source-fault leakage is typical only, so sustained plus/minus 24 V power and thermal stress are not bounded.",
      "The 1 W isolated S5 supply has no released aggregate load or thermal margin for this additional rail.",
      "Powered, ramping, brownout, and unpowered source-fault behavior still needs a sacrificial coupon with zero MCU injection evidence."
    ],
    screens: { fiveTau, sabre100OhmTenTau, tenTau },
    zeroOhmNormalSignalCovered:
      deferred12vIsolation.adg5412f.normalSignalMinimumV === 0 &&
      deferred12vIsolation.adg5412f.normalSignalMinimumV <= boost.minimumV
  }
}
