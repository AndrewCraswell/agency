/**
 * Declaration validator and arithmetic screen for the prototype USB-C PD
 * input and its mutually exclusive laboratory bring-up injection.
 *
 * A declaration pass does not prove that parts are populated or correctly
 * connected and never grants fabrication or permission to apply power.
 */

export type FuseDeclaration = {
  continuousDeratingFraction: number
  maximumOpenAt200PercentSeconds: number
  minimumHoldAt100PercentHours: number
  mpn: string
  nominalCurrentA: number
  required: boolean
}

export type PowerBranchDeclaration = {
  expectedContinuousA: number
  expectedPeakA: number
  fuse: FuseDeclaration
}

export type DisplayBranchDeclaration = PowerBranchDeclaration & {
  limiter: {
    autoRetryDelayMs: number
    bypassCapacitorConnection: "V5_DISPLAY_IN_TO_APP_GND"
    bypassCapacitorMpn: string
    bypassCapacitanceUf: number
    currentLimitResistorConnection: "ILM_TO_APP_GND"
    currentLimitResistorMpn: string
    currentLimitResistorOhms: number
    currentLimitToleranceFraction: number
    dvdTCapacitorConnection: "DVDT_TO_APP_GND"
    dvdTCapacitorMpn: string
    dvdTCapacitanceNf: number
    enUvloConnection: "V5_DISPLAY_IN"
    inputCapacitorConnection: "V5_DISPLAY_IN_TO_APP_GND"
    inputCapacitorMpn: string
    inputCapacitanceUf: number
    iTimerCapacitorConnection: "ITIMER_TO_APP_GND"
    iTimerCapacitorMpn: string
    iTimerCapacitanceNf: number
    mpn: string
    outputCapacitorConnection: "V5_DISPLAY_LIMITED_TO_APP_GND"
    outputCapacitorMpn: string
    outputCapacitanceUf: number
    ovloConnection: "APP_GND"
    pgPullupConnection: "V3_3_TO_PG"
    pgPullupMpn: string
    pgPullupOhms: number
    pgThresholdLowerMpn: string
    pgThresholdLowerOhms: number
    pgThresholdUpperMpn: string
    pgThresholdUpperOhms: number
    pgThresholdDividerConnection: "V5_DISPLAY_LIMITED_TO_PGTH_TO_APP_GND"
    resistorToleranceFraction: number
    retryMode: "circuit-breaker-auto-retry"
  }
}

export type MeasurementLinkDeclaration = {
  boardHeaderMpn: string
  contactProjectScreenA: number
  deenergizedRemovalOnly: boolean
  label: string
  loopbackRequired: boolean
  matingHousingMpn: string
  required: boolean
  terminalMpn: string
}

export type BenchPrototypePowerInputs = {
  branches: {
    applicationAndHousekeeping: PowerBranchDeclaration
    display: DisplayBranchDeclaration
    isolatedScoring: PowerBranchDeclaration
  }
  displayDisconnectReference: string
  labInjection: {
    connectorMpn: string
    contactProjectScreenA: number
    equalLengthPairsRequired: boolean
    injectionNode: "LAB_POST_EFUSE_20V"
    maximumCurrentA: number
    matingHousingMpn: string
    normalProductInterface: false
    pin1Net: "LAB_20V"
    pin2Net: "LAB_20V"
    pin3Net: "LAB_RETURN"
    pin4Net: "LAB_RETURN"
    terminalMpn: string
    voltageV: number
    wireGaugeAwg: number
  }
  measurementLinks: {
    application: MeasurementLinkDeclaration
    display: MeasurementLinkDeclaration
    input: MeasurementLinkDeclaration
    isolatedScoring: MeasurementLinkDeclaration
  }
  normalInput: {
    ccAndSbuProtectionTopology: "series-cc1-cc2-sbu1-sbu2"
    contractCurrentA: number
    contractVoltageV: number
    efuseCurrentLimit: {
      maximumA: number
      minimumA: number
      nominalA: number
    }
    parts: {
      ccAndSbuProtectorMpn: string
      disconnectSurgeDiodeMpn: string
      efuseMpn: string
      pdControllerMpn: string
      receptacleMpn: string
      usbDataShuntProtectorMpn: string
      vbusTvsMpn: string
    }
    requestedMaximumVoltageV: number
    requestedMinimumVoltageV: number
    sinkOnly: boolean
    usbDataProtectionTopology: "shunt-dminus-dplus-to-app-ground"
  }
  selectedSystemInputDemand: {
    continuousA: number
    peakA: number
    peakDurationMs: number
  }
  sourceSelector: {
    changeOnlyDeenergized: boolean
    commonNode: "V20_TO_V5_BUCK"
    labNode: "LAB_POST_EFUSE_20V"
    mpn: string
    pdNode: "PD_EFUSE_OUT_20V"
    simultaneousSourcesProhibited: boolean
  }
}

export type BenchPrototypePowerResult = {
  declarationsValid: true
  displayConnectedPermit: "deny-until-inrush-measured"
  displayLimiter: {
    maximumCurrentLimitA: number
    minimumCurrentLimitA: number
    nominalCurrentLimitA: number
  }
  labInjectionMaximumPowerW: number
  normalEfuseMinimumPowerW: number
  normalPdContractW: number
  physicalPresenceVerified: false
  releaseState: "deny"
  sourceSelection: "physical-spdt-mutual-exclusion"
  v5ContinuousCurrentA: number
  v5PeakCurrentA: number
}

const fuseSemantics = {
  continuousDeratingFraction: 0.25,
  maximumOpenAt200PercentSeconds: 5,
  minimumHoldAt100PercentHours: 4,
  required: true
} as const

function measurementLink(label: string): MeasurementLinkDeclaration {
  return {
    boardHeaderMpn: "39-28-1023",
    contactProjectScreenA: 6,
    deenergizedRemovalOnly: true,
    label,
    loopbackRequired: true,
    matingHousingMpn: "39-01-2020",
    required: true,
    terminalMpn: "39-00-0039"
  }
}

const applicationContinuousA = (2.6 / 0.85 + 1.5 + 0.4 + 0.4) / 5
const applicationPeakA = (3.2 / 0.85 + 3.5 + 0.6 + 0.6) / 5

export const defaultBenchPrototypePowerInputs = {
  branches: {
    applicationAndHousekeeping: {
      expectedContinuousA: applicationContinuousA,
      expectedPeakA: applicationPeakA,
      fuse: { ...fuseSemantics, mpn: "0451002.MRL", nominalCurrentA: 2 }
    },
    display: {
      expectedContinuousA: 4,
      expectedPeakA: 4,
      fuse: { ...fuseSemantics, mpn: "045106.3MRL", nominalCurrentA: 6.3 },
      limiter: {
        autoRetryDelayMs: 110,
        bypassCapacitorConnection: "V5_DISPLAY_IN_TO_APP_GND",
        bypassCapacitorMpn: "C0402C104K3RACTU",
        bypassCapacitanceUf: 0.1,
        currentLimitResistorConnection: "ILM_TO_APP_GND",
        currentLimitResistorMpn: "RC0402FR-07698RL",
        currentLimitResistorOhms: 698,
        currentLimitToleranceFraction: 0.1,
        dvdTCapacitorConnection: "DVDT_TO_APP_GND",
        dvdTCapacitorMpn: "C0402C222K3RACTU",
        dvdTCapacitanceNf: 2.2,
        enUvloConnection: "V5_DISPLAY_IN",
        inputCapacitorConnection: "V5_DISPLAY_IN_TO_APP_GND",
        inputCapacitorMpn: "C2012X7S1A226M125AC",
        inputCapacitanceUf: 22,
        iTimerCapacitorConnection: "ITIMER_TO_APP_GND",
        iTimerCapacitorMpn: "C0402C222K3RACTU",
        iTimerCapacitanceNf: 2.2,
        mpn: "TPS259474ARPWR",
        outputCapacitorConnection: "V5_DISPLAY_LIMITED_TO_APP_GND",
        outputCapacitorMpn: "C2012X7S1A226M125AC",
        outputCapacitanceUf: 22,
        ovloConnection: "APP_GND",
        pgPullupConnection: "V3_3_TO_PG",
        pgPullupMpn: "RC0402FR-0710KL",
        pgPullupOhms: 10000,
        pgThresholdLowerMpn: "RC0402FR-0749K9L",
        pgThresholdLowerOhms: 49900,
        pgThresholdUpperMpn: "RC0402FR-07137KL",
        pgThresholdUpperOhms: 137000,
        pgThresholdDividerConnection: "V5_DISPLAY_LIMITED_TO_PGTH_TO_APP_GND",
        resistorToleranceFraction: 0.01,
        retryMode: "circuit-breaker-auto-retry"
      }
    },
    isolatedScoring: {
      expectedContinuousA: 1.6 / 5,
      expectedPeakA: 2 / 5,
      fuse: { ...fuseSemantics, mpn: "0451.500MRL", nominalCurrentA: 0.5 }
    }
  },
  displayDisconnectReference: "J_DISPLAY_DISCONNECT",
  labInjection: {
    connectorMpn: "43045-0400",
    contactProjectScreenA: 3,
    equalLengthPairsRequired: true,
    injectionNode: "LAB_POST_EFUSE_20V",
    maximumCurrentA: 2.3,
    matingHousingMpn: "43025-0400",
    normalProductInterface: false,
    pin1Net: "LAB_20V",
    pin2Net: "LAB_20V",
    pin3Net: "LAB_RETURN",
    pin4Net: "LAB_RETURN",
    terminalMpn: "43030-0007",
    voltageV: 20,
    wireGaugeAwg: 20
  },
  measurementLinks: {
    application: measurementLink("J_LINK_APPLICATION"),
    display: measurementLink("J_LINK_DISPLAY"),
    input: measurementLink("J_LINK_INPUT"),
    isolatedScoring: measurementLink("J_LINK_SCORING")
  },
  normalInput: {
    ccAndSbuProtectionTopology: "series-cc1-cc2-sbu1-sbu2",
    contractCurrentA: 3,
    contractVoltageV: 20,
    efuseCurrentLimit: { maximumA: 2.99, minimumA: 2.395, nominalA: 2.69 },
    parts: {
      ccAndSbuProtectorMpn: "TPD4S201TRGRRQ1",
      disconnectSurgeDiodeMpn: "B340A-13-F",
      efuseMpn: "TPS259474ARPWR",
      pdControllerMpn: "TPS25730ADREFR",
      receptacleMpn: "10177070-00011LF",
      usbDataShuntProtectorMpn: "TPD2EUSB30DRTR",
      vbusTvsMpn: "TVS2200DRVR"
    },
    requestedMaximumVoltageV: 20,
    requestedMinimumVoltageV: 20,
    sinkOnly: true,
    usbDataProtectionTopology: "shunt-dminus-dplus-to-app-ground"
  },
  selectedSystemInputDemand: {
    continuousA: 32.7847 / 20,
    peakA: 36.9282 / 20,
    peakDurationMs: 100
  },
  sourceSelector: {
    changeOnlyDeenergized: true,
    commonNode: "V20_TO_V5_BUCK",
    labNode: "LAB_POST_EFUSE_20V",
    mpn: "7101SYZQE",
    pdNode: "PD_EFUSE_OUT_20V",
    simultaneousSourcesProhibited: true
  }
} as const satisfies BenchPrototypePowerInputs

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function isFuse(value: unknown): value is FuseDeclaration {
  return (
    isRecord(value) &&
    finite(value.continuousDeratingFraction) &&
    finite(value.maximumOpenAt200PercentSeconds) &&
    finite(value.minimumHoldAt100PercentHours) &&
    typeof value.mpn === "string" &&
    finite(value.nominalCurrentA) &&
    typeof value.required === "boolean"
  )
}

function isBranch(value: unknown): value is PowerBranchDeclaration {
  return isRecord(value) && finite(value.expectedContinuousA) && finite(value.expectedPeakA) && isFuse(value.fuse)
}

function isDisplayBranch(value: unknown): value is DisplayBranchDeclaration {
  if (!isRecord(value) || !isRecord(value.limiter)) return false
  const { limiter } = value
  return (
    isBranch(value) &&
    finite(limiter.autoRetryDelayMs) &&
    limiter.bypassCapacitorConnection === "V5_DISPLAY_IN_TO_APP_GND" &&
    typeof limiter.bypassCapacitorMpn === "string" &&
    finite(limiter.bypassCapacitanceUf) &&
    limiter.currentLimitResistorConnection === "ILM_TO_APP_GND" &&
    typeof limiter.currentLimitResistorMpn === "string" &&
    finite(limiter.currentLimitResistorOhms) &&
    finite(limiter.currentLimitToleranceFraction) &&
    limiter.dvdTCapacitorConnection === "DVDT_TO_APP_GND" &&
    typeof limiter.dvdTCapacitorMpn === "string" &&
    finite(limiter.dvdTCapacitanceNf) &&
    limiter.enUvloConnection === "V5_DISPLAY_IN" &&
    limiter.inputCapacitorConnection === "V5_DISPLAY_IN_TO_APP_GND" &&
    typeof limiter.inputCapacitorMpn === "string" &&
    finite(limiter.inputCapacitanceUf) &&
    limiter.iTimerCapacitorConnection === "ITIMER_TO_APP_GND" &&
    typeof limiter.iTimerCapacitorMpn === "string" &&
    finite(limiter.iTimerCapacitanceNf) &&
    typeof limiter.mpn === "string" &&
    limiter.outputCapacitorConnection === "V5_DISPLAY_LIMITED_TO_APP_GND" &&
    typeof limiter.outputCapacitorMpn === "string" &&
    finite(limiter.outputCapacitanceUf) &&
    limiter.ovloConnection === "APP_GND" &&
    limiter.pgPullupConnection === "V3_3_TO_PG" &&
    typeof limiter.pgPullupMpn === "string" &&
    finite(limiter.pgPullupOhms) &&
    typeof limiter.pgThresholdLowerMpn === "string" &&
    finite(limiter.pgThresholdLowerOhms) &&
    typeof limiter.pgThresholdUpperMpn === "string" &&
    finite(limiter.pgThresholdUpperOhms) &&
    limiter.pgThresholdDividerConnection === "V5_DISPLAY_LIMITED_TO_PGTH_TO_APP_GND" &&
    finite(limiter.resistorToleranceFraction) &&
    limiter.retryMode === "circuit-breaker-auto-retry"
  )
}

function isLink(value: unknown): value is MeasurementLinkDeclaration {
  return (
    isRecord(value) &&
    typeof value.boardHeaderMpn === "string" &&
    finite(value.contactProjectScreenA) &&
    typeof value.deenergizedRemovalOnly === "boolean" &&
    typeof value.label === "string" &&
    typeof value.loopbackRequired === "boolean" &&
    typeof value.matingHousingMpn === "string" &&
    typeof value.required === "boolean" &&
    typeof value.terminalMpn === "string"
  )
}

function isInputs(value: unknown): value is BenchPrototypePowerInputs {
  if (
    !isRecord(value) ||
    !isRecord(value.branches) ||
    !isRecord(value.labInjection) ||
    !isRecord(value.measurementLinks) ||
    !isRecord(value.normalInput) ||
    !isRecord(value.normalInput.efuseCurrentLimit) ||
    !isRecord(value.normalInput.parts) ||
    !isRecord(value.selectedSystemInputDemand) ||
    !isRecord(value.sourceSelector)
  ) {
    return false
  }
  const { branches, labInjection, measurementLinks, normalInput, selectedSystemInputDemand, sourceSelector } = value
  const efuseCurrentLimit = normalInput.efuseCurrentLimit
  const parts = normalInput.parts
  if (!isRecord(efuseCurrentLimit) || !isRecord(parts)) return false
  return (
    isBranch(branches.applicationAndHousekeeping) &&
    isDisplayBranch(branches.display) &&
    isBranch(branches.isolatedScoring) &&
    typeof value.displayDisconnectReference === "string" &&
    typeof labInjection.connectorMpn === "string" &&
    finite(labInjection.contactProjectScreenA) &&
    typeof labInjection.equalLengthPairsRequired === "boolean" &&
    labInjection.injectionNode === "LAB_POST_EFUSE_20V" &&
    finite(labInjection.maximumCurrentA) &&
    typeof labInjection.matingHousingMpn === "string" &&
    labInjection.normalProductInterface === false &&
    labInjection.pin1Net === "LAB_20V" &&
    labInjection.pin2Net === "LAB_20V" &&
    labInjection.pin3Net === "LAB_RETURN" &&
    labInjection.pin4Net === "LAB_RETURN" &&
    typeof labInjection.terminalMpn === "string" &&
    finite(labInjection.voltageV) &&
    finite(labInjection.wireGaugeAwg) &&
    isLink(measurementLinks.application) &&
    isLink(measurementLinks.display) &&
    isLink(measurementLinks.input) &&
    isLink(measurementLinks.isolatedScoring) &&
    normalInput.ccAndSbuProtectionTopology === "series-cc1-cc2-sbu1-sbu2" &&
    finite(normalInput.contractCurrentA) &&
    finite(normalInput.contractVoltageV) &&
    finite(efuseCurrentLimit.maximumA) &&
    finite(efuseCurrentLimit.minimumA) &&
    finite(efuseCurrentLimit.nominalA) &&
    Object.values(parts).every((part) => typeof part === "string") &&
    finite(normalInput.requestedMaximumVoltageV) &&
    finite(normalInput.requestedMinimumVoltageV) &&
    typeof normalInput.sinkOnly === "boolean" &&
    normalInput.usbDataProtectionTopology === "shunt-dminus-dplus-to-app-ground" &&
    finite(selectedSystemInputDemand.continuousA) &&
    finite(selectedSystemInputDemand.peakA) &&
    finite(selectedSystemInputDemand.peakDurationMs) &&
    typeof sourceSelector.changeOnlyDeenergized === "boolean" &&
    sourceSelector.commonNode === "V20_TO_V5_BUCK" &&
    sourceSelector.labNode === "LAB_POST_EFUSE_20V" &&
    typeof sourceSelector.mpn === "string" &&
    sourceSelector.pdNode === "PD_EFUSE_OUT_20V" &&
    typeof sourceSelector.simultaneousSourcesProhibited === "boolean"
  )
}

function exact(name: string, actual: string | number, expected: string | number): void {
  if (actual !== expected) throw new RangeError(`${name} must be ${expected}`)
}

function atLeast(name: string, actual: number, minimum: number): void {
  if (actual < minimum) throw new RangeError(`${name} must be at least the canonical ${minimum}`)
}

function validateFuse(name: string, branch: PowerBranchDeclaration, mpn: string, ratingA: number): void {
  if (!branch.fuse.required) throw new RangeError(`${name} fuse must be required`)
  exact(`${name}.fuse.mpn`, branch.fuse.mpn, mpn)
  exact(`${name}.fuse.nominalCurrentA`, branch.fuse.nominalCurrentA, ratingA)
  exact(`${name}.fuse.continuousDeratingFraction`, branch.fuse.continuousDeratingFraction, 0.25)
  exact(`${name}.fuse.minimumHoldAt100PercentHours`, branch.fuse.minimumHoldAt100PercentHours, 4)
  exact(`${name}.fuse.maximumOpenAt200PercentSeconds`, branch.fuse.maximumOpenAt200PercentSeconds, 5)
  const deratedContinuousA = ratingA * (1 - branch.fuse.continuousDeratingFraction)
  if (branch.expectedContinuousA > deratedContinuousA) {
    throw new RangeError(`${name} continuous load exceeds the 25 percent derated fuse rating`)
  }
  if (branch.expectedPeakA > ratingA) throw new RangeError(`${name} peak load exceeds the fuse rating`)
}

function validateLink(name: string, link: MeasurementLinkDeclaration, label: string): void {
  if (!link.required || !link.loopbackRequired || !link.deenergizedRemovalOnly) {
    throw new RangeError(`${name} must require a de-energized removable loopback`)
  }
  exact(`${name}.label`, link.label, label)
  exact(`${name}.boardHeaderMpn`, link.boardHeaderMpn, "39-28-1023")
  exact(`${name}.matingHousingMpn`, link.matingHousingMpn, "39-01-2020")
  exact(`${name}.terminalMpn`, link.terminalMpn, "39-00-0039")
  exact(`${name}.contactProjectScreenA`, link.contactProjectScreenA, 6)
}

function validateInputs(inputs: unknown): asserts inputs is BenchPrototypePowerInputs {
  if (!isInputs(inputs)) throw new RangeError("inputs must include every USB-C PD power declaration")

  const { applicationAndHousekeeping, display, isolatedScoring } = inputs.branches
  for (const [name, branch] of Object.entries(inputs.branches)) {
    if (branch.expectedPeakA < branch.expectedContinuousA) {
      throw new RangeError(`branches.${name}.expectedPeakA must be at least expectedContinuousA`)
    }
  }
  if (inputs.selectedSystemInputDemand.peakA < inputs.selectedSystemInputDemand.continuousA) {
    throw new RangeError("selectedSystemInputDemand.peakA must be at least continuousA")
  }
  atLeast(
    "branches.applicationAndHousekeeping.expectedContinuousA",
    applicationAndHousekeeping.expectedContinuousA,
    applicationContinuousA
  )
  atLeast(
    "branches.applicationAndHousekeeping.expectedPeakA",
    applicationAndHousekeeping.expectedPeakA,
    applicationPeakA
  )
  atLeast("branches.display.expectedContinuousA", display.expectedContinuousA, 4)
  atLeast("branches.display.expectedPeakA", display.expectedPeakA, 4)
  atLeast("branches.isolatedScoring.expectedContinuousA", isolatedScoring.expectedContinuousA, 0.32)
  atLeast("branches.isolatedScoring.expectedPeakA", isolatedScoring.expectedPeakA, 0.4)
  validateFuse("branches.applicationAndHousekeeping", applicationAndHousekeeping, "0451002.MRL", 2)
  validateFuse("branches.display", display, "045106.3MRL", 6.3)
  validateFuse("branches.isolatedScoring", isolatedScoring, "0451.500MRL", 0.5)

  exact("branches.display.limiter.mpn", display.limiter.mpn, "TPS259474ARPWR")
  exact("branches.display.limiter.retryMode", display.limiter.retryMode, "circuit-breaker-auto-retry")
  exact("branches.display.limiter.autoRetryDelayMs", display.limiter.autoRetryDelayMs, 110)
  exact(
    "branches.display.limiter.currentLimitResistorConnection",
    display.limiter.currentLimitResistorConnection,
    "ILM_TO_APP_GND"
  )
  exact("branches.display.limiter.currentLimitResistorMpn", display.limiter.currentLimitResistorMpn, "RC0402FR-07698RL")
  exact("branches.display.limiter.currentLimitResistorOhms", display.limiter.currentLimitResistorOhms, 698)
  exact("branches.display.limiter.resistorToleranceFraction", display.limiter.resistorToleranceFraction, 0.01)
  exact("branches.display.limiter.currentLimitToleranceFraction", display.limiter.currentLimitToleranceFraction, 0.1)
  exact("branches.display.limiter.iTimerCapacitorMpn", display.limiter.iTimerCapacitorMpn, "C0402C222K3RACTU")
  exact("branches.display.limiter.iTimerCapacitanceNf", display.limiter.iTimerCapacitanceNf, 2.2)
  exact(
    "branches.display.limiter.iTimerCapacitorConnection",
    display.limiter.iTimerCapacitorConnection,
    "ITIMER_TO_APP_GND"
  )
  exact("branches.display.limiter.dvdTCapacitorMpn", display.limiter.dvdTCapacitorMpn, "C0402C222K3RACTU")
  exact("branches.display.limiter.dvdTCapacitanceNf", display.limiter.dvdTCapacitanceNf, 2.2)
  exact("branches.display.limiter.dvdTCapacitorConnection", display.limiter.dvdTCapacitorConnection, "DVDT_TO_APP_GND")
  exact("branches.display.limiter.enUvloConnection", display.limiter.enUvloConnection, "V5_DISPLAY_IN")
  exact("branches.display.limiter.ovloConnection", display.limiter.ovloConnection, "APP_GND")
  exact("branches.display.limiter.pgThresholdUpperMpn", display.limiter.pgThresholdUpperMpn, "RC0402FR-07137KL")
  exact("branches.display.limiter.pgThresholdUpperOhms", display.limiter.pgThresholdUpperOhms, 137000)
  exact("branches.display.limiter.pgThresholdLowerMpn", display.limiter.pgThresholdLowerMpn, "RC0402FR-0749K9L")
  exact("branches.display.limiter.pgThresholdLowerOhms", display.limiter.pgThresholdLowerOhms, 49900)
  exact("branches.display.limiter.pgPullupMpn", display.limiter.pgPullupMpn, "RC0402FR-0710KL")
  exact("branches.display.limiter.pgPullupOhms", display.limiter.pgPullupOhms, 10000)
  exact("branches.display.limiter.pgPullupConnection", display.limiter.pgPullupConnection, "V3_3_TO_PG")
  exact(
    "branches.display.limiter.pgThresholdDividerConnection",
    display.limiter.pgThresholdDividerConnection,
    "V5_DISPLAY_LIMITED_TO_PGTH_TO_APP_GND"
  )
  exact("branches.display.limiter.bypassCapacitorMpn", display.limiter.bypassCapacitorMpn, "C0402C104K3RACTU")
  exact("branches.display.limiter.bypassCapacitanceUf", display.limiter.bypassCapacitanceUf, 0.1)
  exact(
    "branches.display.limiter.bypassCapacitorConnection",
    display.limiter.bypassCapacitorConnection,
    "V5_DISPLAY_IN_TO_APP_GND"
  )
  exact("branches.display.limiter.inputCapacitorMpn", display.limiter.inputCapacitorMpn, "C2012X7S1A226M125AC")
  exact("branches.display.limiter.inputCapacitanceUf", display.limiter.inputCapacitanceUf, 22)
  exact(
    "branches.display.limiter.inputCapacitorConnection",
    display.limiter.inputCapacitorConnection,
    "V5_DISPLAY_IN_TO_APP_GND"
  )
  exact("branches.display.limiter.outputCapacitorMpn", display.limiter.outputCapacitorMpn, "C2012X7S1A226M125AC")
  exact("branches.display.limiter.outputCapacitanceUf", display.limiter.outputCapacitanceUf, 22)
  exact(
    "branches.display.limiter.outputCapacitorConnection",
    display.limiter.outputCapacitorConnection,
    "V5_DISPLAY_LIMITED_TO_APP_GND"
  )

  validateLink("measurementLinks.input", inputs.measurementLinks.input, "J_LINK_INPUT")
  validateLink("measurementLinks.display", inputs.measurementLinks.display, "J_LINK_DISPLAY")
  validateLink("measurementLinks.application", inputs.measurementLinks.application, "J_LINK_APPLICATION")
  validateLink("measurementLinks.isolatedScoring", inputs.measurementLinks.isolatedScoring, "J_LINK_SCORING")

  const parts = inputs.normalInput.parts
  exact("normalInput.parts.receptacleMpn", parts.receptacleMpn, "10177070-00011LF")
  exact("normalInput.parts.pdControllerMpn", parts.pdControllerMpn, "TPS25730ADREFR")
  exact("normalInput.parts.ccAndSbuProtectorMpn", parts.ccAndSbuProtectorMpn, "TPD4S201TRGRRQ1")
  exact("normalInput.parts.usbDataShuntProtectorMpn", parts.usbDataShuntProtectorMpn, "TPD2EUSB30DRTR")
  exact("normalInput.parts.vbusTvsMpn", parts.vbusTvsMpn, "TVS2200DRVR")
  exact("normalInput.parts.disconnectSurgeDiodeMpn", parts.disconnectSurgeDiodeMpn, "B340A-13-F")
  exact("normalInput.parts.efuseMpn", parts.efuseMpn, "TPS259474ARPWR")
  exact(
    "normalInput.ccAndSbuProtectionTopology",
    inputs.normalInput.ccAndSbuProtectionTopology,
    "series-cc1-cc2-sbu1-sbu2"
  )
  exact(
    "normalInput.usbDataProtectionTopology",
    inputs.normalInput.usbDataProtectionTopology,
    "shunt-dminus-dplus-to-app-ground"
  )
  exact("normalInput.contractVoltageV", inputs.normalInput.contractVoltageV, 20)
  exact("normalInput.contractCurrentA", inputs.normalInput.contractCurrentA, 3)
  exact("normalInput.requestedMinimumVoltageV", inputs.normalInput.requestedMinimumVoltageV, 20)
  exact("normalInput.requestedMaximumVoltageV", inputs.normalInput.requestedMaximumVoltageV, 20)
  if (!inputs.normalInput.sinkOnly) throw new RangeError("normal input must remain sink-only")
  exact("normalInput.efuseCurrentLimit.nominalA", inputs.normalInput.efuseCurrentLimit.nominalA, 2.69)
  exact("normalInput.efuseCurrentLimit.minimumA", inputs.normalInput.efuseCurrentLimit.minimumA, 2.395)
  exact("normalInput.efuseCurrentLimit.maximumA", inputs.normalInput.efuseCurrentLimit.maximumA, 2.99)

  atLeast("selectedSystemInputDemand.continuousA", inputs.selectedSystemInputDemand.continuousA, 32.7847 / 20)
  atLeast("selectedSystemInputDemand.peakA", inputs.selectedSystemInputDemand.peakA, 36.9282 / 20)
  exact("selectedSystemInputDemand.peakDurationMs", inputs.selectedSystemInputDemand.peakDurationMs, 100)

  exact("labInjection.connectorMpn", inputs.labInjection.connectorMpn, "43045-0400")
  exact("labInjection.contactProjectScreenA", inputs.labInjection.contactProjectScreenA, 3)
  exact("labInjection.matingHousingMpn", inputs.labInjection.matingHousingMpn, "43025-0400")
  exact("labInjection.terminalMpn", inputs.labInjection.terminalMpn, "43030-0007")
  exact("labInjection.voltageV", inputs.labInjection.voltageV, 20)
  exact("labInjection.wireGaugeAwg", inputs.labInjection.wireGaugeAwg, 20)
  if (!inputs.labInjection.equalLengthPairsRequired) {
    throw new RangeError("lab injection requires equal-length 20 AWG pairs")
  }
  if (inputs.labInjection.maximumCurrentA <= 0 || inputs.labInjection.maximumCurrentA > 2.3) {
    throw new RangeError("lab injection must be greater than 0 A and remain at or below 2.3 A")
  }
  exact("sourceSelector.mpn", inputs.sourceSelector.mpn, "7101SYZQE")
  if (!inputs.sourceSelector.changeOnlyDeenergized || !inputs.sourceSelector.simultaneousSourcesProhibited) {
    throw new RangeError("source selector must prohibit simultaneous sources and change only while de-energized")
  }
  if (inputs.displayDisconnectReference !== "J_DISPLAY_DISCONNECT") {
    throw new RangeError("physical display disconnect declaration is required")
  }
}

export function calculateBenchPrototypePowerContract(
  inputs: unknown = defaultBenchPrototypePowerInputs
): BenchPrototypePowerResult {
  validateInputs(inputs)

  const displayLimiterNominalA = 3334 / inputs.branches.display.limiter.currentLimitResistorOhms
  const displayLimiterMinimumA =
    (displayLimiterNominalA / (1 + inputs.branches.display.limiter.resistorToleranceFraction)) *
    (1 - inputs.branches.display.limiter.currentLimitToleranceFraction)
  const displayLimiterMaximumA =
    (displayLimiterNominalA / (1 - inputs.branches.display.limiter.resistorToleranceFraction)) *
    (1 + inputs.branches.display.limiter.currentLimitToleranceFraction)
  if (displayLimiterMinimumA < inputs.branches.display.expectedPeakA) {
    throw new RangeError("display limiter worst-low current must cover the selected panel")
  }
  if (displayLimiterMaximumA > inputs.measurementLinks.display.contactProjectScreenA) {
    throw new RangeError("display limiter worst-high current must remain inside the measurement-link screen")
  }
  if (inputs.selectedSystemInputDemand.peakA > inputs.normalInput.efuseCurrentLimit.minimumA) {
    throw new RangeError("selected peak source demand exceeds the eFuse worst-low current")
  }
  if (inputs.labInjection.maximumCurrentA > inputs.normalInput.efuseCurrentLimit.minimumA) {
    throw new RangeError("lab injection cap must not exceed the normal eFuse worst-low envelope")
  }

  const v5ContinuousCurrentA = Object.values(inputs.branches).reduce(
    (sum, branch) => sum + branch.expectedContinuousA,
    0
  )
  const v5PeakCurrentA = Object.values(inputs.branches).reduce((sum, branch) => sum + branch.expectedPeakA, 0)

  return {
    declarationsValid: true,
    displayConnectedPermit: "deny-until-inrush-measured",
    displayLimiter: {
      maximumCurrentLimitA: displayLimiterMaximumA,
      minimumCurrentLimitA: displayLimiterMinimumA,
      nominalCurrentLimitA: displayLimiterNominalA
    },
    labInjectionMaximumPowerW: inputs.labInjection.voltageV * inputs.labInjection.maximumCurrentA,
    normalEfuseMinimumPowerW: inputs.normalInput.contractVoltageV * inputs.normalInput.efuseCurrentLimit.minimumA,
    normalPdContractW: inputs.normalInput.contractVoltageV * inputs.normalInput.contractCurrentA,
    physicalPresenceVerified: false,
    releaseState: "deny",
    sourceSelection: "physical-spdt-mutual-exclusion",
    v5ContinuousCurrentA,
    v5PeakCurrentA
  }
}
