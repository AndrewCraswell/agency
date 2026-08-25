import {
  benchPrototypeHub75Connector,
  validateBenchPrototypeHub75Connector
} from "./bench-prototype-hub75-connector.js"
import { calculateBenchPrototypePowerContract, defaultBenchPrototypePowerInputs } from "./bench-prototype-power.js"
import { displayPanelReadiness, validateDisplayPanelReadiness } from "./display-panel-readiness.js"
import { calculateSelectedPanelPowerBudget } from "./selected-panel-power-budget.js"

/**
 * BP-055 is the one bounded contract for the protected HUB75 panel-power
 * branch. It freezes the branch identities and the selected-panel arithmetic
 * screen without claiming that the panel, cable, or branch has been measured.
 */

const canonicalPanelPowerConnector = {
  reference: "J_DISPLAY_POWER_PIGTAIL",
  assembly: "Adafruit 4767 replacement 5 V power cable",
  manufacturer: "Adafruit Industries",
  productId: "4767",
  branchCount: 2,
  contactsPerBranch: 4,
  panelSide: {
    manufacturer: "JST",
    housingMpn: "SMR-04V-N",
    contactMpn: "SYM-001T-P0.6",
    contactCount: 4
  },
  cableSide: {
    manufacturer: "JST",
    housingMpn: "SMP-04V-NC",
    contactMpn: "SHF-001T-0.8BS",
    contactCount: 4
  },
  pinMap: [
    { pin: 1, conductorColor: "red", net: "V5_DISPLAY_LIMITED" },
    { pin: 2, conductorColor: "red", net: "V5_DISPLAY_LIMITED" },
    { pin: 3, conductorColor: "black", net: "APP_GND" },
    { pin: 4, conductorColor: "black", net: "APP_GND" }
  ],
  parallelV5ContactsPerBranch: 2,
  parallelReturnContactsPerBranch: 2,
  contactRatingA: 3,
  wireGaugeAwg: null,
  wireGaugeDisposition: "not credited until the received cable is inspected",
  sourceUrls: [
    "https://www.adafruit.com/product/4767",
    "https://www.jst.com/products/wire-to-wire-connectors/sm-connector/",
    "https://www.jst.com/wp-content/uploads/2025/06/eSM.pdf"
  ]
} as const

const canonicalDisconnect = {
  reference: "J_DISPLAY_DISCONNECT",
  manufacturer: "Molex",
  mpn: "43650-0200",
  mateMpn: "43645-0200",
  terminalMpn: "43030-0007",
  family: "Micro-Fit 3.0",
  positions: 2,
  pitchMm: 3,
  orientation: "right-angle through-hole",
  contactRatingA: 7,
  pinMap: [
    { pin: 1, net: "V5_SOURCE" },
    { pin: 2, net: "V5_DISPLAY_IN" }
  ],
  operation: "open means the positive panel branch is physically disconnected; mating is allowed only de-energized",
  sourceUrl: "https://www.molex.com/en-us/products/part-detail/436500200"
} as const

const canonicalMeasurementLink = {
  reference: "J_LINK_DISPLAY",
  manufacturer: "Molex",
  boardHeaderMpn: "39-28-1023",
  matingHousingMpn: "39-01-2020",
  terminalMpn: "39-00-0039",
  pin1Net: "V5_DISPLAY_LIMITED",
  pin2Net: "V5_DISPLAY_LOAD",
  contactProjectScreenA: 6,
  loopbackRequired: true,
  removable: true,
  removalOnlyWhileDeenergized: true,
  diagnosticUse:
    "insert a calibrated external current meter or shunt in the branch loop only after USB-C removal and rail discharge",
  sourceUrls: [
    "https://www.molex.com/pdm_docs/sd/039281023_sd.pdf",
    "https://www.molex.com/pdm_docs/sd/39012020_sd.pdf"
  ]
} as const

const canonicalLimiter = {
  reference: "U_DISPLAY_LIMITER",
  manufacturer: "Texas Instruments",
  mpn: "TPS259474ARPWR",
  inputNet: "V5",
  outputNet: "V5_DISPLAY_LIMITED",
  groundNet: "APP_GND",
  mode: "circuit-breaker-auto-retry",
  autoRetryDelayMs: 110,
  currentLimitFormula: "I_LIMIT = 3334 / R_ILM",
  currentLimitResistor: {
    reference: "R_DISPLAY_ILM",
    manufacturer: "Yageo",
    mpn: "RC0402FR-07698RL",
    resistanceOhms: 698,
    resistanceToleranceFraction: 0.01,
    currentLimitToleranceFraction: 0.1,
    connection: "ILM_TO_APP_GND"
  },
  nominalCurrentLimitA: 3334 / 698,
  minimumCurrentLimitA: (3334 / 698 / 1.01) * 0.9,
  maximumCurrentLimitA: (3334 / 698 / 0.99) * 1.1,
  inputBypass: {
    reference: "C_DISPLAY_BYPASS",
    mpn: "C0402C104K3RACTU",
    capacitanceUf: 0.1,
    connection: "V5_DISPLAY_IN_TO_APP_GND"
  },
  inputCapacitor: {
    reference: "C_DISPLAY_IN",
    mpn: "C2012X7S1A226M125AC",
    capacitanceUf: 22,
    connection: "V5_DISPLAY_IN_TO_APP_GND"
  },
  outputCapacitor: {
    reference: "C_DISPLAY_OUT",
    mpn: "C2012X7S1A226M125AC",
    capacitanceUf: 22,
    connection: "V5_DISPLAY_LIMITED_TO_APP_GND"
  },
  inrushAndRetry: {
    dvdTReference: "C_DISPLAY_DVDT",
    dvdTMpn: "C0402C222K3RACTU",
    dvdTCapacitanceNf: 2.2,
    iTimerReference: "C_DISPLAY_ITIMER",
    iTimerMpn: "C0402C222K3RACTU",
    iTimerCapacitanceNf: 2.2,
    faultBehavior: "circuit breaker trips on sustained overcurrent and retries after the 110 ms delay"
  },
  sourceUrl: "https://www.ti.com/lit/ds/symlink/tps25947.pdf"
} as const

const canonicalFuse = {
  reference: "F_DISPLAY",
  manufacturer: "Littelfuse",
  mpn: "045106.3MRL",
  series: "451 MRL NANO2",
  nominalCurrentA: 6.3,
  continuousDeratingFraction: 0.25,
  deratedContinuousCurrentA: 6.3 * 0.75,
  interruptingAndThermalQualification: "not accepted by this paper contract",
  position: "in series with the protected display branch after the limiter output",
  sourceUrl:
    "https://www.littelfuse.com/assetdocs/fuse-451-and-453-datasheet?assetguid=533cd5cc-956c-4243-867f-6ab5a62f6ba1"
} as const

const canonicalPanelEnvelope = {
  manufacturer: "Adafruit Industries",
  productId: "2277",
  model: "64x32 RGB LED Matrix - 5mm pitch",
  supplyVoltageV: 5,
  continuousCurrentA: 4,
  peakCurrentA: 4,
  continuousPowerW: 20,
  peakPowerW: 20,
  peakDurationMs: 100,
  envelopeBasis: "published approximately 5 V, 4 A full-white condition; not a measured inrush or thermal limit",
  panelCurrentScreenPass: true,
  limiterMinimumHeadroomA: (3334 / 698 / 1.01) * 0.9 - 4,
  connectorContactScreenPass: false,
  connectorContactScreenReason:
    "each JST contact is listed at 3 A; two parallel contacts per polarity are required and cable sharing remains unmeasured",
  sourceUrl: "https://www.adafruit.com/product/2277"
} as const

const canonicalPowerScreen = {
  usbPdContract: { voltageV: 20, currentA: 3, powerW: 60 },
  continuous: {
    panelCurrentA: 4,
    panelPowerW: 20,
    totalV5LoadW: 26.958823529411767,
    sourceDemandW: 32.71626297577855,
    sourceDemandA: 1.6358131487889274,
    worstLowEfuseCurrentA: 2.3958799105717024,
    worstLowEfuseHeadroomA: 0.760066761782775,
    guaranteedV5CeilingW: 40.72995847971894,
    outputHeadroomW: 13.771134950307172,
    arithmeticFit: true
  },
  peak: {
    panelCurrentA: 4,
    panelPowerW: 20,
    totalV5LoadW: 30.46470588235294,
    sourceDemandW: 36.84083044982699,
    sourceDemandA: 1.8420415224913493,
    worstLowEfuseCurrentA: 2.3958799105717024,
    worstLowEfuseHeadroomA: 0.553838388080353,
    guaranteedV5CeilingW: 40.72995847971894,
    outputHeadroomW: 10.265252597365997,
    arithmeticFit: true
  },
  startupInrush: {
    measured: false,
    releasePass: false,
    status: "unmeasured-gate"
  }
} as const

const canonicalSafeOff = {
  state: "safe-off",
  status: "unvalidated-deny",
  branchOutputState: "no panel-side power is permitted",
  limiterState: "not credited as a service disconnect; upstream power must be removed before service",
  disconnectState: "J_DISPLAY_DISCONNECT open",
  measurementLinkState: "J_LINK_DISPLAY removed or open; never a power-injection point",
  panelPowerConnectorState: "J_DISPLAY_POWER_PIGTAIL disconnected from the panel",
  signalState: "HUB75 buffers disabled, outputs high impedance, and panel OE inactive/high",
  requiredConditions: [
    "disconnect USB-C before installing or removing the disconnect, link, or panel-power mate",
    "remove the source and verify V5, V5_DISPLAY_LIMITED, and panel-side capacitance are discharged",
    "keep the display branch disconnected until startup, inrush, cable drop, current sharing, and thermal evidence pass",
    "a limiter trip, reset, brownout, missing cable contact, or missing measurement record leaves the branch denied"
  ],
  prohibitedBackfeed: [
    "V5_DISPLAY_LIMITED must not back-power V3_3, ESP32 GPIOs, or the HUB75 buffers",
    "HUB75 signal pins must not energize an unpowered panel or the panel-power connector",
    "a removable link must not bypass the limiter, fuse, or de-energized service boundary"
  ]
} as const

const upstreamProvenanceDefinition = {
  bp050: {
    displayBranch: {
      limiterMpn: "TPS259474ARPWR",
      limitResistorMpn: "RC0402FR-07698RL",
      limitResistorOhms: 698,
      fuseMpn: "045106.3MRL",
      fuseRatingA: 6.3,
      expectedContinuousA: 4,
      expectedPeakA: 4,
      disconnectReference: "J_DISPLAY_DISCONNECT"
    },
    measurementLink: {
      label: "J_LINK_DISPLAY",
      boardHeaderMpn: "39-28-1023",
      matingHousingMpn: "39-01-2020",
      terminalMpn: "39-00-0039",
      pin1Net: "V5_DISPLAY_LIMITED",
      pin2Net: "V5_DISPLAY_LOAD",
      contactProjectScreenA: 6,
      deenergizedRemovalOnly: true,
      loopbackRequired: true
    }
  },
  bp143: {
    boardConnectorMpn: "TST-108-04-G-D-RA",
    panelProductId: "2277",
    powerCableProductId: "4767",
    powerCablePanelSideHousingMpn: "SMR-04V-N",
    powerCablePanelSideContactMpn: "SYM-001T-P0.6",
    powerCableCableSideHousingMpn: "SMP-04V-NC",
    powerCableCableSideContactMpn: "SHF-001T-0.8BS",
    powerCableBranchCount: 2,
    powerCableParallelContactsPerPolarity: 2,
    powerPathSupplyNet: "V5_DISPLAY_LIMITED",
    powerPathReturnNet: "APP_GND"
  },
  selectedPanel: {
    manufacturer: "Adafruit Industries",
    sku: "2277",
    supplyVoltageV: 5,
    supplyCurrentA: 4,
    declaredContinuousW: 20,
    declaredPeakW: 20,
    productionApproved: false
  }
} as const

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) throw new RangeError("BP-055 cannot contain cycles or aliases")
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError("BP-055 allows data properties only")
    }
    deepFreeze(descriptor.value, seen)
  }
  return Object.freeze(value)
}

function assertCanonical(actual: unknown, expected: unknown, path: string, seen: WeakSet<object>): void {
  if (typeof expected !== "object" || expected === null) {
    if (!Object.is(actual, expected)) throw new RangeError(`${path} does not match the BP-055 contract`)
    return
  }
  if (typeof actual !== "object" || actual === null || seen.has(actual)) {
    throw new RangeError(`${path} must match the canonical object topology without aliases or cycles`)
  }
  seen.add(actual)
  const expectedArray = Array.isArray(expected)
  if (
    Array.isArray(actual) !== expectedArray ||
    Object.getPrototypeOf(actual) !== (expectedArray ? Array.prototype : Object.prototype)
  ) {
    throw new RangeError(`${path} has the wrong container type`)
  }
  const expectedKeys = Reflect.ownKeys(expected)
  const actualKeys = Reflect.ownKeys(actual)
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key, index) => key !== expectedKeys[index] || typeof key === "symbol")
  ) {
    throw new RangeError(`${path} must contain exactly the canonical keys`)
  }
  for (const key of expectedKeys) {
    const actualDescriptor = Object.getOwnPropertyDescriptor(actual, key)
    const expectedDescriptor = Object.getOwnPropertyDescriptor(expected, key)
    if (
      actualDescriptor === undefined ||
      expectedDescriptor === undefined ||
      !("value" in actualDescriptor) ||
      !("value" in expectedDescriptor) ||
      actualDescriptor.enumerable !== expectedDescriptor.enumerable
    ) {
      throw new RangeError(`${path}.${String(key)} must be an enumerable data property`)
    }
    assertCanonical(actualDescriptor.value, expectedDescriptor.value, `${path}.${String(key)}`, seen)
  }
}

function currentUpstreamProvenance() {
  const display = defaultBenchPrototypePowerInputs.branches.display
  const measurementLink = defaultBenchPrototypePowerInputs.measurementLinks.display
  const connector = benchPrototypeHub75Connector
  const panel = displayPanelReadiness
  return {
    bp050: {
      displayBranch: {
        limiterMpn: display.limiter.mpn,
        limitResistorMpn: display.limiter.currentLimitResistorMpn,
        limitResistorOhms: display.limiter.currentLimitResistorOhms,
        fuseMpn: display.fuse.mpn,
        fuseRatingA: display.fuse.nominalCurrentA,
        expectedContinuousA: display.expectedContinuousA,
        expectedPeakA: display.expectedPeakA,
        disconnectReference: defaultBenchPrototypePowerInputs.displayDisconnectReference
      },
      measurementLink: {
        label: measurementLink.label,
        boardHeaderMpn: measurementLink.boardHeaderMpn,
        matingHousingMpn: measurementLink.matingHousingMpn,
        terminalMpn: measurementLink.terminalMpn,
        pin1Net: measurementLink.pin1Net,
        pin2Net: measurementLink.pin2Net,
        contactProjectScreenA: measurementLink.contactProjectScreenA,
        deenergizedRemovalOnly: measurementLink.deenergizedRemovalOnly,
        loopbackRequired: measurementLink.loopbackRequired
      }
    },
    bp143: {
      boardConnectorMpn: connector.boardConnector.mpn,
      panelProductId: connector.panel.productId,
      powerCableProductId: connector.powerCable.productId,
      powerCablePanelSideHousingMpn: connector.powerCable.panelSideHousingMpn,
      powerCablePanelSideContactMpn: connector.powerCable.panelSideContactMpn,
      powerCableCableSideHousingMpn: connector.powerCable.cableSideHousingMpn,
      powerCableCableSideContactMpn: connector.powerCable.cableSideContactMpn,
      powerCableBranchCount: connector.powerCable.minimumConnectedPowerBranches,
      powerCableParallelContactsPerPolarity: connector.powerCable.parallelPowerContactsPerConnector,
      powerPathSupplyNet: connector.powerPath.supplyNet,
      powerPathReturnNet: connector.powerPath.returnNet
    },
    selectedPanel: {
      manufacturer: panel.manufacturer,
      sku: panel.sku,
      supplyVoltageV: panel.supplyVoltageV,
      supplyCurrentA: panel.supplyCurrentA,
      declaredContinuousW: panel.declaredLoad.continuousW,
      declaredPeakW: panel.declaredLoad.peakW,
      productionApproved: panel.productionApproved
    }
  }
}

const definition = {
  artifactKind: "bench-prototype-display-power-branch-contract",
  workUnit: "BP-055",
  targetAssembly: "one-board bench prototype",
  prototypeOnly: true,
  schematicInputOnly: true,
  integrationRelease: false,
  fabricationRelease: false,
  fabricationDisposition: "DENY",
  releaseState: "deny",
  upstream: { power: "BP-050", panel: "BP-143" },
  source: {
    inputNet: "V5_DISPLAY_IN",
    groundNet: "APP_GND",
    limitedOutputNet: "V5_DISPLAY_LIMITED",
    panelPowerReturnNet: "APP_GND",
    signalGroundsCarryPanelCurrent: false
  },
  topology: {
    path: [
      "V5",
      "J_DISPLAY_DISCONNECT",
      "U_DISPLAY_LIMITER",
      "F_DISPLAY",
      "J_LINK_DISPLAY",
      "J_DISPLAY_POWER_PIGTAIL",
      "Adafruit_4767_branch_1_and_branch_2",
      "DISPLAY_PANEL_2277"
    ],
    connections: [
      "J_DISPLAY_DISCONNECT separates V5_SOURCE from V5_DISPLAY_IN before the limiter; it is not a ground-return disconnect.",
      "U_DISPLAY_LIMITER.IN is supplied from V5_DISPLAY_IN and its GND returns to APP_GND.",
      "U_DISPLAY_LIMITER.OUT drives V5_DISPLAY_LIMITED; no raw V5 route may bypass the limiter.",
      "F_DISPLAY is the only series fuse for the panel-power branch and is downstream of the limiter output.",
      "J_LINK_DISPLAY is a two-pin removable loopback/current-measurement boundary, not a power-injection input.",
      "J_DISPLAY_POWER_PIGTAIL carries two parallel V5 contacts and two parallel APP_GND contacts on each panel-power branch.",
      "The HUB75 signal cable's three logic grounds are APP_GND references only and do not carry panel current."
    ]
  },
  limiter: canonicalLimiter,
  fuse: canonicalFuse,
  connector: canonicalPanelPowerConnector,
  disconnect: canonicalDisconnect,
  measurementLink: canonicalMeasurementLink,
  selectedPanelCurrentEnvelope: canonicalPanelEnvelope,
  powerScreen: canonicalPowerScreen,
  safeOff: canonicalSafeOff,
  evidence: {
    selectedPartsSourceReviewed: true,
    panelReceiptVerified: false,
    panelRevisionVerified: false,
    connectorReceiptAndMatingVerified: false,
    branchContinuityVerified: false,
    currentSharingVerified: false,
    startupInrushMeasured: false,
    cableDropMeasured: false,
    connectorTemperatureMeasured: false,
    blockedVentThermalMeasured: false,
    backfeedAndPowerOffMeasured: false,
    schematicIntegrated: false,
    footprintApproved: false,
    layoutApproved: false,
    fabricationAuthorized: false
  },
  authority: {
    exactLimiterFrozen: true,
    exactFuseFrozen: true,
    exactConnectorFrozen: true,
    exactDisconnectFrozen: true,
    exactMeasurementLinkFrozen: true,
    selectedPanelEnvelopeFrozen: true,
    safeOffStateFrozen: true,
    panelPowerConnectedPermit: "deny-until-inrush-current-sharing-cable-drop-and-thermal-evidence",
    fabricationAuthorized: false,
    releaseState: "deny"
  },
  openGates: [
    "Acquire the exact 2277 panel and record its PCB revision, power housing, included cable, and serial or lot identity.",
    "Verify the Molex 43650-0200 disconnect footprint, mate retention, polarity, wire exit, and current-temperature margin on the actual board.",
    "Continuity-test both four-contact Adafruit 4767 branches and reject any missing, swapped, or unequal-length conductor.",
    "Measure panel startup and inrush with the exact panel, limiter, fuse, V5 output capacitance, USB-C source, and harness.",
    "Measure branch current sharing, panel-end voltage, cable drop, limiter trips, retry behavior, fuse temperature, connector temperature, and blocked-vent thermal behavior.",
    "Measure V3_3 absent/V5 present and V5 absent/V3_3 present states for backfeed, injected current, HUB75 thresholds, and panel OE behavior.",
    "Keep J_DISPLAY_DISCONNECT open and J_LINK_DISPLAY removable until every required electrical and thermal gate passes; fabrication remains denied."
  ]
} as const

export const benchPrototypeDisplayPowerBranch = deepFreeze(definition)
export const benchPrototypeDisplayPowerBranchUpstreamProvenance = deepFreeze(upstreamProvenanceDefinition)

function assertUpstreamProvenance(): void {
  calculateBenchPrototypePowerContract()
  validateBenchPrototypeHub75Connector(benchPrototypeHub75Connector)
  const panelErrors = validateDisplayPanelReadiness(displayPanelReadiness)
  if (panelErrors.length > 0) throw new RangeError(panelErrors.join("; "))

  const budget = calculateSelectedPanelPowerBudget()
  if (
    budget.continuous.panel.currentA !== 4 ||
    budget.peak.panel.currentA !== 4 ||
    budget.continuous.panel.continuousW !== 20 ||
    budget.peak.panel.peakW !== 20 ||
    !budget.powerFitPass ||
    budget.startupInrush.measured ||
    budget.startupInrush.releasePass ||
    budget.startupInrush.status !== "unmeasured-gate"
  ) {
    throw new RangeError("BP-055 selected-panel power screen drifted or incorrectly granted startup approval")
  }

  assertCanonical(
    currentUpstreamProvenance(),
    benchPrototypeDisplayPowerBranchUpstreamProvenance,
    "BP-055 upstream provenance",
    new WeakSet<object>()
  )
}

export function validateBenchPrototypeDisplayPowerBranch(value: unknown): true {
  assertUpstreamProvenance()
  assertCanonical(value, benchPrototypeDisplayPowerBranch, "benchPrototypeDisplayPowerBranch", new WeakSet<object>())

  const branch = benchPrototypeDisplayPowerBranch
  if (
    branch.limiter.mpn !== "TPS259474ARPWR" ||
    branch.limiter.currentLimitResistor.mpn !== "RC0402FR-07698RL" ||
    branch.limiter.currentLimitResistor.resistanceOhms !== 698 ||
    branch.fuse.mpn !== "045106.3MRL" ||
    branch.fuse.nominalCurrentA !== 6.3 ||
    branch.connector.productId !== "4767" ||
    branch.connector.panelSide.housingMpn !== "SMR-04V-N" ||
    branch.connector.cableSide.housingMpn !== "SMP-04V-NC" ||
    branch.disconnect.reference !== "J_DISPLAY_DISCONNECT" ||
    branch.disconnect.mpn !== "43650-0200" ||
    branch.measurementLink.reference !== "J_LINK_DISPLAY" ||
    branch.measurementLink.boardHeaderMpn !== "39-28-1023" ||
    branch.selectedPanelCurrentEnvelope.productId !== "2277" ||
    branch.selectedPanelCurrentEnvelope.continuousCurrentA !== 4 ||
    branch.selectedPanelCurrentEnvelope.peakCurrentA !== 4 ||
    branch.safeOff.state !== "safe-off" ||
    branch.safeOff.disconnectState !== "J_DISPLAY_DISCONNECT open" ||
    branch.authority.releaseState !== "deny" ||
    branch.fabricationDisposition !== "DENY"
  ) {
    throw new RangeError("BP-055 display-power branch must retain every exact identity and deny state")
  }
  if (branch.limiter.minimumCurrentLimitA < branch.selectedPanelCurrentEnvelope.peakCurrentA) {
    throw new RangeError("BP-055 limiter worst-low current must cover the selected panel envelope")
  }
  if (branch.fuse.deratedContinuousCurrentA < branch.selectedPanelCurrentEnvelope.continuousCurrentA) {
    throw new RangeError("BP-055 display fuse derated current must cover the selected panel envelope")
  }
  if (
    branch.connector.parallelV5ContactsPerBranch !== 2 ||
    branch.connector.parallelReturnContactsPerBranch !== 2 ||
    branch.connector.contactRatingA !== 3
  ) {
    throw new RangeError("BP-055 panel-power connector must retain both parallel contacts per polarity")
  }
  if (
    !branch.measurementLink.removable ||
    !branch.measurementLink.removalOnlyWhileDeenergized ||
    !branch.measurementLink.loopbackRequired ||
    branch.measurementLink.contactProjectScreenA !== 6
  ) {
    throw new RangeError("BP-055 display measurement link must remain a de-energized removable 6 A loopback")
  }
  if (
    branch.safeOff.status !== "unvalidated-deny" ||
    branch.safeOff.signalState !== "HUB75 buffers disabled, outputs high impedance, and panel OE inactive/high" ||
    branch.evidence.startupInrushMeasured ||
    branch.evidence.connectorTemperatureMeasured ||
    branch.evidence.fabricationAuthorized
  ) {
    throw new RangeError("BP-055 safe-off and physical evidence must fail closed")
  }
  return true
}
