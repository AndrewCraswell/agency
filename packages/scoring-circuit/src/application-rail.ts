/**
 * Conservative closure screen for the application V3_3 regulator.
 *
 * The rail load values come from the preliminary USB-PD budget. This is a
 * calculation aid for the selected regulator, not a measured power or
 * thermal release. Board layout, capacitor DC-bias, load-transient, and
 * blocked-vent measurements remain required.
 */

import { assertFinitePositive } from "./power-validation.js"

export type ApplicationRailInputs = {
  ambientMaxC: number
  continuousLoadW: number
  ctBiasAndAgingReserveFraction: number
  ctNominalUf: number
  ctTemperatureFraction: number
  ctToleranceFraction: number
  efficiencyFloor: number
  esp32DcDropMaxV: number
  esp32OperatingMinV: number
  esp32PowerStableBeforeEnableMinMs: number
  esp32TransientAllowanceV: number
  inputMaxV: number
  inputMinV: number
  inductorIsatAt20PercentDropA: number
  inductorIrmsAt40CRiseA: number
  inductorLuh: number
  outputCapEffectiveMinUf: number
  outputMaxV: number
  outputMinV: number
  peakLoadW: number
  railSettlingRequirementMs: number
  regulatorCurrentLimitMinA: number
  regulatorRthetaJaMaxCPerW: number
  regulatorSoftStartMaxMs: number
  supervisorCtChargeCurrentMaxUa: number
  supervisorCtChargeCurrentTypicalUa: number
  supervisorCtComparatorThresholdMinV: number
  supervisorCtComparatorThresholdTypicalV: number
  supervisorDcDropMaxV: number
  supervisorDelayBaselineMinMs: number
  supervisorDelayBaselineNominalMs: number
  supervisorFallingNominalV: number
  supervisorReleaseAccuracyFraction: number
  supervisorRisingNominalV: number
  supervisorToEsp32MismatchMaxV: number
  supervisorTransientAllowanceV: number
  switchFrequencyHz: number
  thermalJunctionTargetC: number
  outputDischargeResistanceOhm: number
  outputDischargeCapEffectiveUf: number
}

export const defaultApplicationRailInputs = {
  ambientMaxC: 50,
  // The existing power budget assigns 2.60 W continuous and 3.20 W peak to
  // the local 3.3 V loads (ESP32, Ethernet, security, support, and I/O).
  continuousLoadW: 2.6,
  // KEMET C0603C104K3RACTU: +/-10% initial tolerance and +/-15% X7R
  // temperature coefficient. A separate 20% reserve covers DC bias and
  // lifetime aging until the exact lot is characterized.
  ctBiasAndAgingReserveFraction: 0.2,
  ctNominalUf: 0.1,
  ctTemperatureFraction: 0.15,
  ctToleranceFraction: 0.1,
  efficiencyFloor: 0.85,
  esp32DcDropMaxV: 0.02,
  esp32OperatingMinV: 3,
  esp32PowerStableBeforeEnableMinMs: 0.05,
  esp32TransientAllowanceV: 0.05,
  inputMaxV: 5.25,
  inputMinV: 4.75,
  inductorIsatAt20PercentDropA: 5,
  inductorIrmsAt40CRiseA: 8.7,
  inductorLuh: 2.2,
  outputCapEffectiveMinUf: 40,
  outputMaxV: 3.33,
  outputMinV: 3.27,
  peakLoadW: 3.2,
  // This is an engineering allowance in addition to Espressif's 50 us
  // minimum power-stable-before-CHIP_PU requirement.
  railSettlingRequirementMs: 10,
  regulatorCurrentLimitMinA: 2.8,
  regulatorRthetaJaMaxCPerW: 84.4,
  regulatorSoftStartMaxMs: 4.6,
  supervisorCtChargeCurrentMaxUa: 1.35,
  supervisorCtChargeCurrentTypicalUa: 1.15,
  supervisorCtComparatorThresholdMinV: 1.17,
  supervisorCtComparatorThresholdTypicalV: 1.23,
  // TI specifies only a nominal 25 us CT-open delay, so the guaranteed
  // minimum calculation receives no baseline-delay credit.
  supervisorDelayBaselineMinMs: 0,
  supervisorDelayBaselineNominalMs: 0.025,
  supervisorDcDropMaxV: 0.005,
  supervisorFallingNominalV: 3.17,
  supervisorReleaseAccuracyFraction: 0.01,
  supervisorRisingNominalV: 3.189,
  supervisorToEsp32MismatchMaxV: 0.01,
  supervisorTransientAllowanceV: 0.015,
  switchFrequencyHz: 2_200_000,
  thermalJunctionTargetC: 125,
  outputDischargeResistanceOhm: 1000,
  outputDischargeCapEffectiveUf: 40
} as const satisfies ApplicationRailInputs

export type ApplicationRailResult = {
  continuousInputCurrentA: number
  continuousLossW: number
  continuousOutputCurrentA: number
  continuousJunctionC: number
  ctEffectiveMinimumUf: number
  dischargeTo10PercentMs: number
  esp32AssertionMarginV: number
  esp32PinAtLatestSupervisorAssertionV: number
  esp32PinMinimumRegulatedV: number
  esp32RegulatedMarginV: number
  fallingAssertThresholdWorstV: number
  inductorPeakCurrentWithMarginA: number
  inductorRippleAtInputMinA: number
  peakInputCurrentA: number
  peakLossW: number
  peakOutputCurrentA: number
  peakJunctionC: number
  peakRegulatorCurrentMarginA: number
  releaseMarginV: number
  startupInputMarginV: number
  supervisorDelayGuaranteedMinMs: number
  supervisorDelayMarginMs: number
  supervisorDelayNominalMs: number
  supervisorDelayRequirementMs: number
  supervisorPinMinimumV: number
}

function assertFiniteNonNegative(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${name} must be finite and non-negative`)
}

function assertFraction(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError(`${name} must be finite and in the range [0, 1)`)
  }
}

function validateInputs(inputs: ApplicationRailInputs): void {
  assertFinitePositive("ambientMaxC", inputs.ambientMaxC)
  assertFinitePositive("continuousLoadW", inputs.continuousLoadW)
  assertFraction("ctBiasAndAgingReserveFraction", inputs.ctBiasAndAgingReserveFraction)
  assertFinitePositive("ctNominalUf", inputs.ctNominalUf)
  assertFraction("ctTemperatureFraction", inputs.ctTemperatureFraction)
  assertFraction("ctToleranceFraction", inputs.ctToleranceFraction)
  assertFinitePositive("efficiencyFloor", inputs.efficiencyFloor)
  if (inputs.efficiencyFloor > 1) throw new RangeError("efficiencyFloor must not exceed one")
  assertFiniteNonNegative("esp32DcDropMaxV", inputs.esp32DcDropMaxV)
  assertFinitePositive("esp32OperatingMinV", inputs.esp32OperatingMinV)
  assertFinitePositive("esp32PowerStableBeforeEnableMinMs", inputs.esp32PowerStableBeforeEnableMinMs)
  assertFiniteNonNegative("esp32TransientAllowanceV", inputs.esp32TransientAllowanceV)
  assertFinitePositive("inputMinV", inputs.inputMinV)
  assertFinitePositive("inputMaxV", inputs.inputMaxV)
  if (inputs.inputMaxV < inputs.inputMinV) throw new RangeError("inputMaxV must be >= inputMinV")
  assertFinitePositive("inductorIsatAt20PercentDropA", inputs.inductorIsatAt20PercentDropA)
  assertFinitePositive("inductorIrmsAt40CRiseA", inputs.inductorIrmsAt40CRiseA)
  assertFinitePositive("inductorLuh", inputs.inductorLuh)
  assertFinitePositive("outputCapEffectiveMinUf", inputs.outputCapEffectiveMinUf)
  assertFinitePositive("outputMinV", inputs.outputMinV)
  assertFinitePositive("outputMaxV", inputs.outputMaxV)
  if (inputs.outputMaxV < inputs.outputMinV) throw new RangeError("outputMaxV must be >= outputMinV")
  assertFinitePositive("peakLoadW", inputs.peakLoadW)
  if (inputs.peakLoadW < inputs.continuousLoadW) throw new RangeError("peakLoadW must be >= continuousLoadW")
  assertFinitePositive("railSettlingRequirementMs", inputs.railSettlingRequirementMs)
  assertFinitePositive("regulatorCurrentLimitMinA", inputs.regulatorCurrentLimitMinA)
  assertFinitePositive("regulatorRthetaJaMaxCPerW", inputs.regulatorRthetaJaMaxCPerW)
  assertFinitePositive("regulatorSoftStartMaxMs", inputs.regulatorSoftStartMaxMs)
  assertFinitePositive("supervisorCtChargeCurrentMaxUa", inputs.supervisorCtChargeCurrentMaxUa)
  assertFinitePositive("supervisorCtChargeCurrentTypicalUa", inputs.supervisorCtChargeCurrentTypicalUa)
  assertFinitePositive("supervisorCtComparatorThresholdMinV", inputs.supervisorCtComparatorThresholdMinV)
  assertFinitePositive("supervisorCtComparatorThresholdTypicalV", inputs.supervisorCtComparatorThresholdTypicalV)
  assertFiniteNonNegative("supervisorDelayBaselineMinMs", inputs.supervisorDelayBaselineMinMs)
  assertFiniteNonNegative("supervisorDelayBaselineNominalMs", inputs.supervisorDelayBaselineNominalMs)
  assertFiniteNonNegative("supervisorDcDropMaxV", inputs.supervisorDcDropMaxV)
  assertFinitePositive("supervisorFallingNominalV", inputs.supervisorFallingNominalV)
  assertFinitePositive("supervisorReleaseAccuracyFraction", inputs.supervisorReleaseAccuracyFraction)
  if (inputs.supervisorReleaseAccuracyFraction >= 1) {
    throw new RangeError("supervisorReleaseAccuracyFraction must be less than one")
  }
  assertFinitePositive("supervisorRisingNominalV", inputs.supervisorRisingNominalV)
  assertFiniteNonNegative("supervisorToEsp32MismatchMaxV", inputs.supervisorToEsp32MismatchMaxV)
  assertFiniteNonNegative("supervisorTransientAllowanceV", inputs.supervisorTransientAllowanceV)
  assertFinitePositive("switchFrequencyHz", inputs.switchFrequencyHz)
  assertFinitePositive("thermalJunctionTargetC", inputs.thermalJunctionTargetC)
  assertFinitePositive("outputDischargeResistanceOhm", inputs.outputDischargeResistanceOhm)
  assertFinitePositive("outputDischargeCapEffectiveUf", inputs.outputDischargeCapEffectiveUf)
  if (inputs.outputCapEffectiveMinUf < 40) throw new RangeError("outputCapEffectiveMinUf must meet the 40 uF minimum")
}

export function calculateApplicationRail(
  inputs: ApplicationRailInputs = defaultApplicationRailInputs
): ApplicationRailResult {
  validateInputs(inputs)

  const continuousOutputCurrentA = inputs.continuousLoadW / inputs.outputMinV
  const peakOutputCurrentA = inputs.peakLoadW / inputs.outputMinV
  const continuousInputCurrentA = inputs.continuousLoadW / (inputs.inputMinV * inputs.efficiencyFloor)
  const peakInputCurrentA = inputs.peakLoadW / (inputs.inputMinV * inputs.efficiencyFloor)
  const continuousLossW = inputs.continuousLoadW * (1 / inputs.efficiencyFloor - 1)
  const peakLossW = inputs.peakLoadW * (1 / inputs.efficiencyFloor - 1)
  const continuousJunctionC = inputs.ambientMaxC + continuousLossW * inputs.regulatorRthetaJaMaxCPerW
  const peakJunctionC = inputs.ambientMaxC + peakLossW * inputs.regulatorRthetaJaMaxCPerW
  const inductorRippleAtInputMinA =
    (inputs.outputMaxV * (1 - inputs.outputMaxV / inputs.inputMinV)) /
    (inputs.switchFrequencyHz * (inputs.inductorLuh * 1e-6))
  const inductorPeakCurrentWithMarginA = (peakOutputCurrentA + inductorRippleAtInputMinA / 2) * 1.2
  const peakRegulatorCurrentMarginA =
    inputs.regulatorCurrentLimitMinA - (peakOutputCurrentA + inductorRippleAtInputMinA / 2)
  const supervisorRisingWorstV = inputs.supervisorRisingNominalV * (1 + inputs.supervisorReleaseAccuracyFraction)
  const fallingAssertThresholdWorstV = inputs.supervisorFallingNominalV * (1 - inputs.supervisorReleaseAccuracyFraction)
  const supervisorPinMinimumV = inputs.outputMinV - inputs.supervisorDcDropMaxV - inputs.supervisorTransientAllowanceV
  const releaseMarginV = supervisorPinMinimumV - supervisorRisingWorstV
  const esp32PinMinimumRegulatedV = inputs.outputMinV - inputs.esp32DcDropMaxV - inputs.esp32TransientAllowanceV
  const esp32RegulatedMarginV = esp32PinMinimumRegulatedV - inputs.esp32OperatingMinV
  const esp32PinAtLatestSupervisorAssertionV =
    fallingAssertThresholdWorstV - inputs.supervisorToEsp32MismatchMaxV - inputs.esp32TransientAllowanceV
  const esp32AssertionMarginV = esp32PinAtLatestSupervisorAssertionV - inputs.esp32OperatingMinV
  const startupInputMarginV = inputs.inputMinV - 3.6
  const ctEffectiveMinimumUf =
    inputs.ctNominalUf *
    (1 - inputs.ctToleranceFraction) *
    (1 - inputs.ctTemperatureFraction) *
    (1 - inputs.ctBiasAndAgingReserveFraction)
  const supervisorDelayGuaranteedMinMs =
    ((ctEffectiveMinimumUf * inputs.supervisorCtComparatorThresholdMinV) / inputs.supervisorCtChargeCurrentMaxUa) *
      1000 +
    inputs.supervisorDelayBaselineMinMs
  const supervisorDelayNominalMs =
    ((inputs.ctNominalUf * inputs.supervisorCtComparatorThresholdTypicalV) /
      inputs.supervisorCtChargeCurrentTypicalUa) *
      1000 +
    inputs.supervisorDelayBaselineNominalMs
  const supervisorDelayRequirementMs =
    inputs.regulatorSoftStartMaxMs + inputs.railSettlingRequirementMs + inputs.esp32PowerStableBeforeEnableMinMs
  const supervisorDelayMarginMs = supervisorDelayGuaranteedMinMs - supervisorDelayRequirementMs
  const dischargeTo10PercentMs =
    inputs.outputDischargeResistanceOhm * (inputs.outputDischargeCapEffectiveUf * 1e-6) * Math.log(10) * 1000

  if (inputs.inputMinV < 3.6) throw new RangeError("inputMinV must remain above the regulator 3.6 V startup minimum")
  if (releaseMarginV <= 0) {
    throw new RangeError("supervisor SENSE/VDD pin budget must exceed the worst-case rising threshold")
  }
  if (esp32RegulatedMarginV <= 0) {
    throw new RangeError("ESP32 pin budget must exceed its minimum operating voltage during regulation")
  }
  if (esp32AssertionMarginV <= 0) {
    throw new RangeError("latest supervisor assertion must precede the ESP32 minimum operating voltage")
  }
  if (continuousJunctionC >= inputs.thermalJunctionTargetC || peakJunctionC >= inputs.thermalJunctionTargetC) {
    throw new RangeError("application regulator thermal screen exceeds the junction target")
  }
  if (peakRegulatorCurrentMarginA <= 0)
    throw new RangeError("application regulator current margin must remain positive")
  if (inductorPeakCurrentWithMarginA >= inputs.inductorIsatAt20PercentDropA) {
    throw new RangeError("inductor peak current with margin exceeds the 20 percent saturation current")
  }
  if (peakOutputCurrentA >= inputs.inductorIrmsAt40CRiseA) {
    throw new RangeError("inductor RMS current exceeds the 40 C-rise current rating")
  }
  if (supervisorDelayMarginMs <= 0) {
    throw new RangeError("guaranteed supervisor delay must exceed soft start and settling requirements")
  }

  return {
    continuousInputCurrentA,
    continuousLossW,
    continuousOutputCurrentA,
    continuousJunctionC,
    ctEffectiveMinimumUf,
    dischargeTo10PercentMs,
    esp32AssertionMarginV,
    esp32PinAtLatestSupervisorAssertionV,
    esp32PinMinimumRegulatedV,
    esp32RegulatedMarginV,
    fallingAssertThresholdWorstV,
    inductorPeakCurrentWithMarginA,
    inductorRippleAtInputMinA,
    peakInputCurrentA,
    peakLossW,
    peakOutputCurrentA,
    peakJunctionC,
    peakRegulatorCurrentMarginA,
    releaseMarginV,
    startupInputMarginV,
    supervisorDelayGuaranteedMinMs,
    supervisorDelayMarginMs,
    supervisorDelayNominalMs,
    supervisorDelayRequirementMs,
    supervisorPinMinimumV
  }
}
