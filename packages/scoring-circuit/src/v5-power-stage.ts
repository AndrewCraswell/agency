import { calculateRailBudget, type RailBudgetResult } from "./power-budget.js"
import { assertFinitePositive } from "./power-validation.js"

export const v5PowerStage = {
  controller: {
    absoluteMaximumInputV: 32,
    continuousOutputCurrentA: 10,
    minimumOnTimeNs: 50,
    mpn: "TPS56A37RPAR",
    recommendedMaximumInputV: 28,
    switchingFrequencyHz: 500_000
  },
  enable: { lowerResistorOhms: 6_040, risingThresholdV: 1.18, upperResistorOhms: 88_700 },
  inductor: {
    dcResistanceOhms: 0.0059,
    heatingCurrentA: 9.7,
    inductanceH: 3.3e-6,
    inductanceScreenAt12AH: 2.4e-6,
    mpn: "744325330",
    typicalSaturationCurrentA: 15
  },
  input: {
    minimumExpectedV: 17.65,
    mlccCount: 2,
    mlccMpn: "GRM32ER7YA106KA12L",
    mlccRatedCapacitanceF: 10e-6,
    nominalEfuseOvervoltageV: 22,
    nominalPdInputV: 20
  },
  output: {
    effectiveCapacitanceF: 35e-6,
    mlccCount: 2,
    mlccMpn: "GRM32ER71E226KE15L",
    mlccRatedCapacitanceF: 22e-6,
    voltageV: 5
  },
  sense: { mpn: "CRE2512-FZ-R002E-3", powerRatingW: 3, resistanceOhms: 0.002 }
} as const

export type V5PowerStageAssessment = {
  continuous: V5LoadPoint
  eFuseBound: {
    maximumPeakDisplayAllocationW: number
    maximumPostShuntLoadW: number
    maximumPostShuntOutputCurrentA: number
    maximumPreShuntOutputW: number
    minimumCurrentLimitA: number
  }
  enable: { nominalStartV: number; nominalStopV: number }
  inductor: {
    continuousRmsCurrentA: number
    peakCurrentA: number
    peakRmsCurrentA: number
    peakToPeakRippleA: number
  }
  inputMlcc: { peakBankRmsCurrentA: number; requiredPerCapRmsCurrentA: number; rippleQualificationPass: false }
  limits: {
    absoluteInputHeadroomV: number
    currentLimitPeakHeadroomA: number
    inputWithinAbsoluteMaximum: boolean
    inputWithinRecommendedMaximum: boolean
    minimumOnTimeHeadroomAtRecommendedMaximumNs: number
    outputCurrentPass: boolean
  }
  peak: V5LoadPoint
  releaseState: "deny"
}

type V5LoadPoint = {
  converterInputA: number
  eFuseHeadroomA: number
  outputCurrentA: number
  outputHeadroomA: number
  postShuntLoadW: number
  preShuntOutputW: number
  shuntPowerW: number
}

const minimumEfuseCurrentLimitA = (3_334 / (1_240 * 1.01)) * 0.9
const minimumHighSidePeakLimitA = 12.75

function assertRailBudget(result: RailBudgetResult): void {
  if (result === null || typeof result !== "object") throw new RangeError("railBudget must be an object")
  assertFinitePositive("railBudget.contractW", result.contractW)
  assertFinitePositive("railBudget.continuous.downstreamRailBudgetW", result.continuous.downstreamRailBudgetW)
  assertFinitePositive("railBudget.peak.downstreamRailBudgetW", result.peak.downstreamRailBudgetW)
  assertFinitePositive("railBudget.peak.fixedRailLoadW", result.peak.fixedRailLoadW)
}

function outputCurrentA(outputPowerW: number): number {
  return outputPowerW / v5PowerStage.output.voltageV
}

function shuntPowerW(currentA: number): number {
  return currentA ** 2 * v5PowerStage.sense.resistanceOhms
}

function preShuntOutputW(postShuntLoadW: number): number {
  return postShuntLoadW + shuntPowerW(outputCurrentA(postShuntLoadW))
}

function converterInputA(postShuntLoadW: number, buckEfficiency: number, inputVoltageV: number): number {
  return preShuntOutputW(postShuntLoadW) / buckEfficiency / inputVoltageV
}

function maximumPostShuntLoadW(maximumPreShuntOutputW: number): number {
  const shuntCoefficient = v5PowerStage.sense.resistanceOhms / v5PowerStage.output.voltageV ** 2
  return (-1 + Math.sqrt(1 + 4 * shuntCoefficient * maximumPreShuntOutputW)) / (2 * shuntCoefficient)
}

function loadPoint(postShuntLoadW: number, buckEfficiency: number): V5LoadPoint {
  const outputCurrent = outputCurrentA(postShuntLoadW)
  const converterInput = converterInputA(postShuntLoadW, buckEfficiency, v5PowerStage.input.nominalPdInputV)
  return {
    converterInputA: converterInput,
    eFuseHeadroomA: minimumEfuseCurrentLimitA - converterInput,
    outputCurrentA: outputCurrent,
    outputHeadroomA: v5PowerStage.controller.continuousOutputCurrentA - outputCurrent,
    postShuntLoadW,
    preShuntOutputW: preShuntOutputW(postShuntLoadW),
    shuntPowerW: shuntPowerW(outputCurrent)
  }
}

/**
 * Performs only arithmetic and data-sheet-limit screening. It deliberately does
 * not convert a reference design or a thermal estimate into fabrication release.
 */
export function assessV5PowerStage(
  railBudget: RailBudgetResult = calculateRailBudget(),
  buckEfficiency = 0.85
): V5PowerStageAssessment {
  assertRailBudget(railBudget)
  if (!Number.isFinite(buckEfficiency) || buckEfficiency <= 0 || buckEfficiency > 1) {
    throw new RangeError("buckEfficiency must be finite and in the range (0, 1]")
  }

  const continuous = loadPoint(railBudget.continuous.downstreamRailBudgetW, buckEfficiency)
  const peak = loadPoint(railBudget.peak.downstreamRailBudgetW, buckEfficiency)
  const peakToPeakRippleA =
    (v5PowerStage.output.voltageV * (v5PowerStage.controller.recommendedMaximumInputV - v5PowerStage.output.voltageV)) /
    (v5PowerStage.controller.recommendedMaximumInputV *
      v5PowerStage.inductor.inductanceScreenAt12AH *
      v5PowerStage.controller.switchingFrequencyHz)
  const peakInductorCurrentA = peak.outputCurrentA + peakToPeakRippleA / 2
  const continuousInductorRmsCurrentA = Math.sqrt(continuous.outputCurrentA ** 2 + peakToPeakRippleA ** 2 / 12)
  const peakInductorRmsCurrentA = Math.sqrt(peak.outputCurrentA ** 2 + peakToPeakRippleA ** 2 / 12)
  const nominalStartV =
    (v5PowerStage.enable.risingThresholdV *
      (v5PowerStage.enable.upperResistorOhms + v5PowerStage.enable.lowerResistorOhms) -
      v5PowerStage.enable.upperResistorOhms * v5PowerStage.enable.lowerResistorOhms * 1e-6) /
    v5PowerStage.enable.lowerResistorOhms
  const nominalStopV =
    (1.07 * (v5PowerStage.enable.upperResistorOhms + v5PowerStage.enable.lowerResistorOhms) -
      v5PowerStage.enable.upperResistorOhms * v5PowerStage.enable.lowerResistorOhms * 4e-6) /
    v5PowerStage.enable.lowerResistorOhms
  const minimumOnTimeNs =
    (v5PowerStage.output.voltageV /
      v5PowerStage.controller.recommendedMaximumInputV /
      v5PowerStage.controller.switchingFrequencyHz) *
    1e9
  const eFuseBoundedPreShuntOutputW = minimumEfuseCurrentLimitA * v5PowerStage.input.nominalPdInputV * buckEfficiency
  const eFuseBoundedPostShuntLoadW = maximumPostShuntLoadW(eFuseBoundedPreShuntOutputW)
  const inputCapacitorPeakRmsCurrentA =
    peak.outputCurrentA *
    Math.sqrt(
      (v5PowerStage.output.voltageV / v5PowerStage.input.minimumExpectedV) *
        (1 - v5PowerStage.output.voltageV / v5PowerStage.input.minimumExpectedV)
    )

  return {
    continuous,
    eFuseBound: {
      maximumPeakDisplayAllocationW: eFuseBoundedPostShuntLoadW - railBudget.peak.fixedRailLoadW,
      maximumPostShuntLoadW: eFuseBoundedPostShuntLoadW,
      maximumPostShuntOutputCurrentA: outputCurrentA(eFuseBoundedPostShuntLoadW),
      maximumPreShuntOutputW: eFuseBoundedPreShuntOutputW,
      minimumCurrentLimitA: minimumEfuseCurrentLimitA
    },
    enable: { nominalStartV, nominalStopV },
    inductor: {
      continuousRmsCurrentA: continuousInductorRmsCurrentA,
      peakCurrentA: peakInductorCurrentA,
      peakRmsCurrentA: peakInductorRmsCurrentA,
      peakToPeakRippleA
    },
    inputMlcc: {
      peakBankRmsCurrentA: inputCapacitorPeakRmsCurrentA,
      requiredPerCapRmsCurrentA: inputCapacitorPeakRmsCurrentA / v5PowerStage.input.mlccCount,
      // The exact temperature, DC-bias, and ripple-current rating is not yet evidenced.
      rippleQualificationPass: false
    },
    limits: {
      absoluteInputHeadroomV:
        v5PowerStage.controller.absoluteMaximumInputV - v5PowerStage.input.nominalEfuseOvervoltageV,
      currentLimitPeakHeadroomA: minimumHighSidePeakLimitA - peakInductorCurrentA,
      inputWithinAbsoluteMaximum:
        v5PowerStage.input.nominalEfuseOvervoltageV < v5PowerStage.controller.absoluteMaximumInputV,
      inputWithinRecommendedMaximum:
        v5PowerStage.input.nominalEfuseOvervoltageV < v5PowerStage.controller.recommendedMaximumInputV,
      minimumOnTimeHeadroomAtRecommendedMaximumNs: minimumOnTimeNs - v5PowerStage.controller.minimumOnTimeNs,
      outputCurrentPass: peak.outputCurrentA <= v5PowerStage.controller.continuousOutputCurrentA
    },
    peak,
    releaseState: "deny"
  }
}
