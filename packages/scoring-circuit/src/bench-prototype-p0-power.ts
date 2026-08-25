const definition = {
  artifactKind: "bench-prototype-p0-power-contract",
  workUnit: "BP-050",
  normalInput: {
    interface: "USB-C PD",
    voltageV: 20,
    currentA: 3,
    powerW: 60,
    sinkOnly: true,
    populatedInputCount: 1,
    alternateInput: "DNP",
    sourceSelector: "DNP"
  },
  chain: [
    { reference: "J_USB_C", mpn: "10177070-00011LF", function: "USB-C receptacle" },
    { reference: "U_USB_PORT_PROTECT", mpn: "TPD4S201TRGRRQ1", function: "CC/SBU short-to-VBUS protection" },
    { reference: "U_USB_DATA_PROTECT", mpn: "TPD2EUSB30DRTR", function: "USB2 low-capacitance ESD protection" },
    { reference: "D_USB_PD_VBUS_TVS", mpn: "TVS2200DRVR", function: "provisional VBUS transient clamp" },
    { reference: "D_USB_PD_VBUS_DISCONNECT", mpn: "B340A-13-F", function: "disconnect/surge path diode" },
    { reference: "U_USB_PD", mpn: "TPS25730ADREFR", function: "20 V/3 A PD sink controller" },
    { reference: "U_EFUSE", mpn: "TPS259474ARPWR", function: "upstream current, surge, and fault protection" },
    { reference: "U_V5_BUCK", mpn: "TPS56A37RPAR", function: "20 V to 5 V conversion" }
  ],
  upstreamSupport: {
    efuseCurrentLimitResistorOhms: 1240,
    efuseCurrentLimitResistorTolerance: 0.01,
    efuseCurrentLimitA: { minimum: 2.395, nominal: 2.69, maximum: 2.99 },
    pdPphvCapacitorMpn: "T523H107M035APE070",
    pdLdoCapacitorMpn: "T55A106M010C0200",
    pdStraps: "exact values remain BP-050 selection work",
    usbSeriesPair: "two matched 22 ohm resistors; exact MPN remains BP-050 selection work"
  },
  v5Stage: {
    regulatorMpn: "TPS56A37RPAR",
    switchingFrequencyHz: 500_000,
    inductor: { mpn: "744325330", inductanceUh: 3.3 },
    inputCapacitors: { mpn: "GRM32ER7YA106KA12L", quantity: 2, nominalUfEach: 10 },
    inputBypass: { mpn: "885012206095", nominalNf: 100 },
    outputCapacitors: { mpn: "GRM32ER71E226KE15L", quantity: 2, nominalUfEach: 22 },
    outputVoltageV: 5,
    continuousRatingA: 10,
    exactLayoutAndThermalProof: false
  },
  branches: {
    application: {
      source: "V5",
      output: "APP_3V3",
      regulatorSelection: "open",
      fuseMpn: "0451002.MRL",
      fuseRatingA: 2
    },
    display: {
      source: "V5",
      output: "V5_DISPLAY_LIMITED",
      limiterMpn: "TPS259474ARPWR",
      limitResistorMpn: "RC0402FR-07698RL",
      limitResistorOhms: 698,
      fuseMpn: "045106.3MRL",
      disconnect: "J_DISPLAY_DISCONNECT",
      connectPermit: "deny-until-panel-inrush-and-thermal-evidence"
    },
    scoringAnalog: {
      source: "APP_3V3 plus REF5025-derived excitation/reference rails",
      exactPeakAndContinuousLoad: "open"
    }
  },
  currentEvidence: {
    knownPostShuntContinuousWExcludingAfe: 23.86,
    knownPostShuntPeakWExcludingAfe: 24.96,
    peakDurationMs: 100,
    knownTwentyVoltContinuousA: 1.46,
    knownTwentyVoltPeakA: 1.52,
    minimumEfuseHeadroomAAtKnownPeak: 0.87,
    result: "provisional-pass-excluding-afe",
    openRule: "Add worst-case AFE/reference/ADC, ESP32 radio, primary-output, and conversion loss before release."
  },
  diagnosticAccess: {
    populatedAlternateConnector: false,
    populatedSelector: false,
    testPads: ["TP_USB_VBUS_PORT", "TP_PD_EFUSE_OUT", "TP_V5", "TP_APP_3V3", "TP_SCORING_REFERENCE"],
    removableLinks: ["J_LINK_INPUT", "J_LINK_DISPLAY", "J_LINK_APPLICATION"],
    procedure:
      "Disconnect USB-C, verify every rail is discharged, install the meter or current shunt, then reconnect USB-C. Never inject power at a test pad or measurement link."
  },
  openSafetyGates: {
    vbusClamp:
      "TVS2200 worst-case clamp evidence must prove TPS25730A stays below its absolute maximum or the TVS must be replaced.",
    powerBudget: "AFE/reference/ADC and revised ESP32 peak/continuous loads are not yet included.",
    physical:
      "PD negotiation, inrush, cable drop, load step, branch trip, buck/eFuse temperature, and shutdown are not measured.",
    fie: "USB-C 20 V and external five-minute backup require separate FIE acceptance; no dormant battery is added to P0."
  },
  authority: {
    paperChainFrozen: true,
    completeRailBudgetPassed: false,
    clampQualified: false,
    physicalPowerEvidencePassed: false,
    fabricationAuthorized: false,
    releaseState: "deny"
  }
} as const

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) throw new RangeError("BP-050 cannot contain cycles or aliases")
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) throw new RangeError("BP-050 allows data only")
    deepFreeze(descriptor.value, seen)
  }
  return Object.freeze(value)
}

function isPlainRecord(value: unknown): value is Record<PropertyKey, unknown> {
  return value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype
}

function sameDataGraph(
  actual: unknown,
  expected: unknown,
  actualSeen = new WeakSet<object>(),
  expectedSeen = new WeakSet<object>()
): boolean {
  if (actual === null || expected === null || typeof actual !== "object" || typeof expected !== "object") {
    return Object.is(actual, expected)
  }
  if (actualSeen.has(actual) || expectedSeen.has(expected)) return false
  actualSeen.add(actual)
  expectedSeen.add(expected)
  const actualArray = Array.isArray(actual)
  const expectedArray = Array.isArray(expected)
  if (actualArray !== expectedArray) return false
  if (actualArray) {
    if (Object.getPrototypeOf(actual) !== Array.prototype || Object.getPrototypeOf(expected) !== Array.prototype) {
      return false
    }
  } else if (!(isPlainRecord(actual) && isPlainRecord(expected))) return false
  const actualKeys = Reflect.ownKeys(actual)
  const expectedKeys = Reflect.ownKeys(expected)
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key) => typeof key === "symbol") ||
    expectedKeys.some((key) => typeof key === "symbol")
  ) {
    return false
  }
  return expectedKeys.every((key) => {
    if (!actualKeys.includes(key)) return false
    const actualDescriptor = Object.getOwnPropertyDescriptor(actual, key)
    const expectedDescriptor = Object.getOwnPropertyDescriptor(expected, key)
    return (
      actualDescriptor !== undefined &&
      expectedDescriptor !== undefined &&
      "value" in actualDescriptor &&
      "value" in expectedDescriptor &&
      actualDescriptor.enumerable === expectedDescriptor.enumerable &&
      sameDataGraph(actualDescriptor.value, expectedDescriptor.value, actualSeen, expectedSeen)
    )
  })
}

export const benchPrototypeP0Power = deepFreeze(definition)

export function validateBenchPrototypeP0Power(value: unknown): true {
  if (!sameDataGraph(value, benchPrototypeP0Power)) {
    throw new RangeError("BP-050 must exactly match the reviewed simplified power contract")
  }
  if (
    benchPrototypeP0Power.normalInput.populatedInputCount !== 1 ||
    benchPrototypeP0Power.normalInput.powerW !== 60 ||
    benchPrototypeP0Power.normalInput.alternateInput !== "DNP" ||
    benchPrototypeP0Power.normalInput.sourceSelector !== "DNP" ||
    benchPrototypeP0Power.chain.length !== 8 ||
    benchPrototypeP0Power.v5Stage.regulatorMpn !== "TPS56A37RPAR" ||
    benchPrototypeP0Power.diagnosticAccess.populatedAlternateConnector ||
    benchPrototypeP0Power.diagnosticAccess.populatedSelector ||
    benchPrototypeP0Power.authority.completeRailBudgetPassed ||
    benchPrototypeP0Power.authority.clampQualified ||
    benchPrototypeP0Power.authority.fabricationAuthorized ||
    benchPrototypeP0Power.authority.releaseState !== "deny"
  ) {
    throw new RangeError("BP-050 must retain USB-C-only power and all open safety gates")
  }
  return true
}
