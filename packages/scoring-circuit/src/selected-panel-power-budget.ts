import { calculateApplicationRail, defaultApplicationRailInputs } from "./application-rail.js"
import {
  assertDisplayPanelReadiness,
  displayPanelReadiness,
  type DisplayPanelReadiness
} from "./display-panel-readiness.js"
import { calculateRailBudget, defaultRailBudgetInputs, type PowerPair } from "./power-budget.js"
import { assessV5PowerStage, v5PowerStage } from "./v5-power-stage.js"

/**
 * Executable power screen for the selected Adafruit 2277 EVT panel.
 *
 * This intentionally remains separate from the generic allocation model. The
 * generic model answers how much an unselected display could consume; this
 * model answers whether the currently selected panel's published load fits
 * the USB-PD, eFuse, V5 shunt, V5 buck, and application-rail assumptions.
 */

export type SelectedPanelPowerPoint = {
  applicationRail: {
    inputEquivalentW: number
    inputCurrentAtMinimumV5A: number
    localLoadW: number
    lossW: number
    outputCurrentA: number
  }
  buckConversionLossW: number
  buckInputPowerW: number
  directV5FixedLoadW: number
  eFuseCurrentHeadroomA: number
  eFuseCurrentLimitA: number
  eFuseCurrentPass: boolean
  panel: PowerPair & { currentA: number }
  pdAndEfusePathLossW: number
  postShuntCeilingHeadroomW: number
  postShuntCeilingW: number
  postShuntLoadW: number
  postShuntLoadPass: boolean
  postShuntOutputCurrentA: number
  sourceDemandA: number
  sourceDemandW: number
  sourceEnvelopeHeadroomW: number
  sourceEnvelopePass: boolean
  sourceEnvelopeW: number
  shuntPowerW: number
  totalLossW: number
  v5OutputCurrentHeadroomA: number
  v5OutputCurrentPass: boolean
  v5PreShuntLoadW: number
}

export type SelectedPanelPowerBudget = {
  contractCurrentA: number
  contractVoltageV: number
  contractW: number
  genericMaximumAllocation: {
    peakDisplayAllocationW: number
    peakDisplayEFuseAllocationW: number
    peakDisplayEFusePass: boolean
  }
  peakDurationMs: number
  peak: SelectedPanelPowerPoint
  powerFitPass: boolean
  releaseState: "deny"
  startupInrush: {
    measured: false
    releasePass: false
    status: "unmeasured-gate"
  }
  continuous: SelectedPanelPowerPoint
}

function sumPowerPairs(pairs: readonly PowerPair[], mode: "continuous" | "peak"): number {
  return pairs.reduce((sum, pair) => sum + pair[`${mode}W`], 0)
}

function selectedApplicationLoad(mode: "continuous" | "peak"): number {
  return mode === "continuous" ? defaultApplicationRailInputs.continuousLoadW : defaultApplicationRailInputs.peakLoadW
}

function selectedDirectV5Load(mode: "continuous" | "peak"): number {
  return sumPowerPairs(Object.values(defaultRailBudgetInputs.localLoads.v5), mode)
}

function pointFor(
  panel: DisplayPanelReadiness,
  eFuseCurrentLimitA: number,
  postShuntCeilingW: number,
  mode: "continuous" | "peak"
): SelectedPanelPowerPoint {
  const applicationRail = calculateApplicationRail()
  const applicationLocalLoadW = selectedApplicationLoad(mode)
  const applicationInputEquivalentW = applicationLocalLoadW / defaultApplicationRailInputs.efficiencyFloor
  const applicationOutputCurrentA =
    mode === "continuous" ? applicationRail.continuousOutputCurrentA : applicationRail.peakOutputCurrentA
  const applicationInputCurrentAtMinimumV5A =
    mode === "continuous" ? applicationRail.continuousInputCurrentA : applicationRail.peakInputCurrentA
  const applicationLossW = mode === "continuous" ? applicationRail.continuousLossW : applicationRail.peakLossW
  const directV5FixedLoadW = selectedDirectV5Load(mode)
  const panelLoad: PowerPair = panel.declaredLoad
  const panelLoadW = panelLoad[`${mode}W`]
  const panelCurrentA = panelLoadW / panel.supplyVoltageV
  const postShuntLoadW = applicationInputEquivalentW + directV5FixedLoadW + panelLoadW
  const postShuntOutputCurrentA = postShuntLoadW / v5PowerStage.output.voltageV
  const shuntPowerW = postShuntOutputCurrentA ** 2 * v5PowerStage.sense.resistanceOhms
  const v5PreShuntLoadW = postShuntLoadW + shuntPowerW
  const buckInputPowerW = v5PreShuntLoadW / defaultRailBudgetInputs.buckBoostEfficiency
  const buckConversionLossW = buckInputPowerW - v5PreShuntLoadW
  const pdAndEfusePathLossW = defaultRailBudgetInputs.pdAndEfusePathLossW
  const sourceDemandW = buckInputPowerW + pdAndEfusePathLossW
  const sourceDemandA = sourceDemandW / defaultRailBudgetInputs.sourceVoltageV
  const sourceEnvelopeW =
    defaultRailBudgetInputs.sourceVoltageV *
    defaultRailBudgetInputs.sourceCurrentA *
    (mode === "continuous"
      ? defaultRailBudgetInputs.continuousSourceUtilization
      : defaultRailBudgetInputs.peakSourceUtilization)
  const v5OutputCurrentHeadroomA = v5PowerStage.controller.continuousOutputCurrentA - postShuntOutputCurrentA

  return {
    applicationRail: {
      inputEquivalentW: applicationInputEquivalentW,
      inputCurrentAtMinimumV5A: applicationInputCurrentAtMinimumV5A,
      localLoadW: applicationLocalLoadW,
      lossW: applicationLossW,
      outputCurrentA: applicationOutputCurrentA
    },
    buckConversionLossW,
    buckInputPowerW,
    directV5FixedLoadW,
    eFuseCurrentHeadroomA: eFuseCurrentLimitA - sourceDemandA,
    eFuseCurrentLimitA,
    eFuseCurrentPass: sourceDemandA <= eFuseCurrentLimitA,
    panel: { ...panelLoad, currentA: panelCurrentA },
    pdAndEfusePathLossW,
    postShuntCeilingHeadroomW: postShuntCeilingW - postShuntLoadW,
    postShuntCeilingW,
    postShuntLoadW,
    postShuntLoadPass: postShuntLoadW <= postShuntCeilingW,
    postShuntOutputCurrentA,
    sourceDemandA,
    sourceDemandW,
    sourceEnvelopeHeadroomW: sourceEnvelopeW - sourceDemandW,
    sourceEnvelopePass: sourceDemandW <= sourceEnvelopeW,
    sourceEnvelopeW,
    shuntPowerW,
    totalLossW: sourceDemandW - postShuntLoadW,
    v5OutputCurrentHeadroomA,
    v5OutputCurrentPass: postShuntOutputCurrentA <= v5PowerStage.controller.continuousOutputCurrentA,
    v5PreShuntLoadW
  }
}

export function calculateSelectedPanelPowerBudget(panel: unknown = displayPanelReadiness): SelectedPanelPowerBudget {
  assertDisplayPanelReadiness(panel)

  const genericBudget = calculateRailBudget()
  const genericV5Assessment = assessV5PowerStage(genericBudget)
  const continuous = pointFor(
    panel,
    genericV5Assessment.eFuseBound.minimumCurrentLimitA,
    genericV5Assessment.eFuseBound.maximumPostShuntLoadW,
    "continuous"
  )
  const peak = pointFor(
    panel,
    genericV5Assessment.eFuseBound.minimumCurrentLimitA,
    genericV5Assessment.eFuseBound.maximumPostShuntLoadW,
    "peak"
  )
  const powerFitPass = [continuous, peak].every(
    (point) =>
      point.sourceEnvelopePass && point.eFuseCurrentPass && point.postShuntLoadPass && point.v5OutputCurrentPass
  )

  return {
    contractCurrentA: defaultRailBudgetInputs.sourceCurrentA,
    contractVoltageV: defaultRailBudgetInputs.sourceVoltageV,
    contractW: genericBudget.contractW,
    genericMaximumAllocation: {
      peakDisplayAllocationW: genericBudget.peak.displayAllocationW,
      peakDisplayEFuseAllocationW: genericV5Assessment.eFuseBound.maximumPeakDisplayAllocationW,
      peakDisplayEFusePass:
        genericBudget.peak.displayAllocationW <= genericV5Assessment.eFuseBound.maximumPeakDisplayAllocationW
    },
    peakDurationMs: genericBudget.peakDurationMs,
    peak,
    powerFitPass,
    releaseState: "deny",
    startupInrush: {
      measured: false,
      releasePass: false,
      status: "unmeasured-gate"
    },
    continuous
  }
}
