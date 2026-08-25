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
    pdStraps: [
      {
        reference: "R_USB_PD_ADCIN1_UP",
        mpn: "RC0402FR-0724K9L",
        manufacturer: "Yageo",
        valueOhms: 24_900,
        tolerancePct: 1,
        package: "0402 (1005 metric)",
        quantity: 1,
        sourceUrl: "https://www.yageogroup.com/component-documentation/download/specsheet/RC0402FR-0724K9L"
      },
      {
        reference: "R_USB_PD_ADCIN1_DOWN",
        mpn: "RC0402FR-0710KL",
        manufacturer: "Yageo",
        valueOhms: 10_000,
        tolerancePct: 1,
        package: "0402 (1005 metric)",
        quantity: 1,
        sourceUrl: "https://www.yageogroup.com/component-documentation/download/specsheet/RC0402FR-0710KL"
      },
      {
        reference: "R_USB_PD_ADCIN2_UP",
        mpn: "RC0402FR-0710KL",
        manufacturer: "Yageo",
        valueOhms: 10_000,
        tolerancePct: 1,
        package: "0402 (1005 metric)",
        quantity: 1,
        sourceUrl: "https://www.yageogroup.com/component-documentation/download/specsheet/RC0402FR-0710KL"
      },
      {
        reference: "R_USB_PD_ADCIN2_DOWN",
        mpn: "RC0402FR-0768K1L",
        manufacturer: "Yageo",
        valueOhms: 68_100,
        tolerancePct: 1,
        package: "0402 (1005 metric)",
        quantity: 1,
        sourceUrl: "https://www.yageogroup.com/component-documentation/download/specsheet/RC0402FR-0768K1L"
      },
      {
        reference: "R_USB_PD_ADCIN3_UP",
        mpn: "RC0402FR-07162KL",
        manufacturer: "Yageo",
        valueOhms: 162_000,
        tolerancePct: 1,
        package: "0402 (1005 metric)",
        quantity: 1,
        sourceUrl: "https://www.yageogroup.com/component-documentation/download/specsheet/RC0402FR-07162KL"
      },
      {
        reference: "R_USB_PD_ADCIN3_DOWN",
        mpn: "RC0402FR-0738K3L",
        manufacturer: "Yageo",
        valueOhms: 38_300,
        tolerancePct: 1,
        package: "0402 (1005 metric)",
        quantity: 1,
        sourceUrl: "https://www.yageogroup.com/component-documentation/download/specsheet/RC0402FR-0738K3L"
      },
      {
        reference: "R_USB_PD_ADCIN4_UP",
        mpn: "RC0402FR-07191KL",
        manufacturer: "Yageo",
        valueOhms: 191_000,
        tolerancePct: 1,
        package: "0402 (1005 metric)",
        quantity: 1,
        sourceUrl: "https://www.yageogroup.com/component-documentation/download/specsheet/RC0402FR-07191KL"
      },
      {
        reference: "R_USB_PD_ADCIN4_DOWN",
        mpn: "RC0402FR-079K53L",
        manufacturer: "Yageo",
        valueOhms: 9_530,
        tolerancePct: 1,
        package: "0402 (1005 metric)",
        quantity: 1,
        sourceUrl: "https://www.yageogroup.com/component-documentation/download/specsheet/RC0402FR-079K53L"
      },
      {
        reference: "R_USB_PD_PD5VMAX",
        mpn: "RC0402FR-0710KL",
        manufacturer: "Yageo",
        valueOhms: 10_000,
        tolerancePct: 1,
        package: "0402 (1005 metric)",
        quantity: 1,
        sourceUrl: "https://www.yageogroup.com/component-documentation/download/specsheet/RC0402FR-0710KL"
      },
      {
        reference: "R_USB_PD_RESERVED_26",
        mpn: "RC0402FR-0710KL",
        manufacturer: "Yageo",
        valueOhms: 10_000,
        tolerancePct: 1,
        package: "0402 (1005 metric)",
        quantity: 1,
        sourceUrl: "https://www.yageogroup.com/component-documentation/download/specsheet/RC0402FR-0710KL"
      },
      {
        reference: "R_USB_PD_RESERVED_36",
        mpn: "RC0402FR-0710KL",
        manufacturer: "Yageo",
        valueOhms: 10_000,
        tolerancePct: 1,
        package: "0402 (1005 metric)",
        quantity: 1,
        sourceUrl: "https://www.yageogroup.com/component-documentation/download/specsheet/RC0402FR-0710KL"
      }
    ],
    pdSupportCapacitors: [
      {
        reference: "C_USB_PORT_PROTECT_BIAS",
        mpn: "GCM188R71H104KA57D",
        manufacturer: "Murata",
        value: "100 nF",
        rating: "50 V, X7R, 10%",
        package: "0603 (1608 metric)",
        quantity: 1,
        sourceUrl: "https://www.murata.com/en-us/products/productdetail?partno=GCM188R71H104KA57D"
      },
      {
        reference: "C_USB_PORT_PROTECT_VPWR",
        mpn: "GCM188R71H105KA64D",
        manufacturer: "Murata",
        value: "1 uF",
        rating: "50 V, X7R, 10%",
        package: "0603 (1608 metric)",
        quantity: 1,
        sourceUrl: "https://www.murata.com/en-us/products/productdetail?partno=GCM188R71H105KA64D"
      },
      {
        reference: "C_USB_PD_LDO_1V5",
        mpn: "GRM21BR71A106KA73K",
        manufacturer: "Murata",
        value: "10 uF",
        rating: "10 V, X7R, 10%",
        package: "0805 (2012 metric)",
        quantity: 1,
        sourceUrl: "https://www.murata.com/en-us/products/productdetail?partno=GRM21BR71A106KA73K"
      },
      {
        reference: "C_USB_PD_VIN_3V3",
        mpn: "GRM21BR71A106KA73K",
        manufacturer: "Murata",
        value: "10 uF",
        rating: "10 V, X7R, 10%",
        package: "0805 (2012 metric)",
        quantity: 1,
        sourceUrl: "https://www.murata.com/en-us/products/productdetail?partno=GRM21BR71A106KA73K"
      },
      {
        reference: "C_USB_PD_VBUS",
        mpn: "GRM21BR71H475KA73L",
        manufacturer: "Murata",
        value: "4.7 uF",
        rating: "50 V, X7R, 10%",
        package: "0805 (2012 metric)",
        quantity: 1,
        sourceUrl: "https://www.murata.com/en-us/products/productdetail?partno=GRM21BR71H475KA73L"
      },
      {
        reference: "C_USB_PD_CC1",
        mpn: "GCM1555C1H331JA16D",
        manufacturer: "Murata",
        value: "330 pF",
        rating: "50 V, C0G, 5%",
        package: "0402 (1005 metric)",
        quantity: 1,
        sourceUrl: "https://www.murata.com/en-us/products/productdetail?partno=GCM1555C1H331JA16D"
      },
      {
        reference: "C_USB_PD_CC2",
        mpn: "GCM1555C1H331JA16D",
        manufacturer: "Murata",
        value: "330 pF",
        rating: "50 V, C0G, 5%",
        package: "0402 (1005 metric)",
        quantity: 1,
        sourceUrl: "https://www.murata.com/en-us/products/productdetail?partno=GCM1555C1H331JA16D"
      }
    ],
    usbSeriesPair: [
      {
        reference: "R_USB_DN_SERIES",
        mpn: "RC0402FR-0722RL",
        manufacturer: "Yageo",
        valueOhms: 22,
        tolerancePct: 1,
        package: "0402 (1005 metric)",
        quantity: 1,
        sourceUrl: "https://www.yageogroup.com/component-documentation/download/specsheet/RC0402FR-0722RL"
      },
      {
        reference: "R_USB_DP_SERIES",
        mpn: "RC0402FR-0722RL",
        manufacturer: "Yageo",
        valueOhms: 22,
        tolerancePct: 1,
        package: "0402 (1005 metric)",
        quantity: 1,
        sourceUrl: "https://www.yageogroup.com/component-documentation/download/specsheet/RC0402FR-0722RL"
      }
    ],
    efuseSupport: [
      {
        reference: "C_EFUSE_IN",
        mpn: "GCM188R71H104KA57D",
        manufacturer: "Murata",
        value: "100 nF, 50 V, X7R, 10%",
        package: "0603 (1608 metric)",
        function: "TPS259474A local input bypass",
        sourceUrl: "https://www.murata.com/en-us/products/productdetail?partno=GCM188R71H104KA57D"
      },
      {
        reference: "R_EFUSE_UVLO_UP",
        mpn: "RC0603FR-07475KL",
        manufacturer: "Yageo",
        value: "475 kOhm, 1%",
        package: "0603 (1608 metric)",
        function: "TPS259474A adjustable undervoltage-lockout upper divider",
        sourceUrl: "https://www.yageogroup.com/component-documentation/download/specsheet/RC0603FR-07475KL"
      },
      {
        reference: "R_EFUSE_UVLO_DOWN",
        mpn: "RC0603FR-0738K3L",
        manufacturer: "Yageo",
        value: "38.3 kOhm, 1%",
        package: "0603 (1608 metric)",
        function: "TPS259474A adjustable undervoltage-lockout lower divider",
        sourceUrl: "https://www.yageogroup.com/component-documentation/download/specsheet/RC0603FR-0738K3L"
      },
      {
        reference: "R_EFUSE_OVLO_UP",
        mpn: "RC0603FR-07499KL",
        manufacturer: "Yageo",
        value: "499 kOhm, 1%",
        package: "0603 (1608 metric)",
        function: "TPS259474A adjustable overvoltage-lockout upper divider",
        sourceUrl: "https://www.yageogroup.com/component-documentation/download/specsheet/RC0603FR-07499KL"
      },
      {
        reference: "R_EFUSE_OVLO_DOWN",
        mpn: "RC0603FR-0728K7L",
        manufacturer: "Yageo",
        value: "28.7 kOhm, 1%",
        package: "0603 (1608 metric)",
        function: "TPS259474A adjustable overvoltage-lockout lower divider",
        sourceUrl: "https://www.yageogroup.com/component-documentation/download/specsheet/RC0603FR-0728K7L"
      },
      {
        reference: "R_EFUSE_ILM",
        mpn: "RC0603FR-071K24L",
        manufacturer: "Yageo",
        value: "1.24 kOhm, 1%",
        package: "0603 (1608 metric)",
        function: "TPS259474A 2.69 A nominal current-limit programming",
        sourceUrl: "https://www.yageogroup.com/component-documentation/download/specsheet/RC0603FR-071K24L"
      },
      {
        reference: "C_EFUSE_ITIMER",
        mpn: "C0603C222K5RACTU",
        manufacturer: "KEMET",
        value: "2.2 nF, 50 V, X7R, 10%",
        package: "0603 (1608 metric)",
        function: "TPS259474A transient-overcurrent blanking timer",
        sourceUrl: "https://search.kemet.com/component-documentation/download/specsheet/C0603C222K5RACTU"
      },
      {
        reference: "C_EFUSE_DVDT",
        mpn: "C0603C222K5RACTU",
        manufacturer: "KEMET",
        value: "2.2 nF, 50 V, X7R, 10%",
        package: "0603 (1608 metric)",
        function: "TPS259474A controlled output slew rate and inrush",
        sourceUrl: "https://search.kemet.com/component-documentation/download/specsheet/C0603C222K5RACTU"
      }
    ]
  },
  v5Stage: {
    regulatorMpn: "TPS56A37RPAR",
    switchingFrequencyHz: 500_000,
    inductor: { mpn: "744325330", inductanceUh: 3.3 },
    inputCapacitors: { mpn: "GRM32ER7YA106KA12L", quantity: 2, nominalUfEach: 10 },
    inputBypass: { mpn: "885012206095", nominalNf: 100 },
    outputCapacitors: { mpn: "GRM32ER71E226KE15L", quantity: 2, nominalUfEach: 22 },
    supportParts: [
      {
        reference: "L_V5_BUCK",
        mpn: "744325330",
        manufacturer: "Wurth Elektronik",
        value: "3.3 uH, 12 A",
        package: "WE-HCI 13.2 mm x 12.8 mm",
        function: "TPS56A37 power inductor",
        sourceUrl: "https://www.we-online.com/components/products/datasheet/744325330.pdf"
      },
      ...["C_V5_BUCK_IN_A", "C_V5_BUCK_IN_B"].map((reference) => ({
        reference,
        mpn: "GRM32ER7YA106KA12L",
        manufacturer: "Murata",
        value: "10 uF, 35 V, X7R, 10%",
        package: "1210 (3225 metric)",
        function: "TPS56A37 input bulk decoupling",
        sourceUrl: "https://www.murata.com/en-us/products/productdetail?partno=GRM32ER7YA106KA12L"
      })),
      {
        reference: "C_V5_BUCK_IN_HF",
        mpn: "885012206095",
        manufacturer: "Wurth Elektronik",
        value: "100 nF, 50 V, X7R, 10%",
        package: "0603 (1608 metric)",
        function: "TPS56A37 high-frequency input bypass",
        sourceUrl: "https://www.we-online.com/components/products/datasheet/885012206095.pdf"
      },
      {
        reference: "C_V5_BUCK_BOOT",
        mpn: "885012206095",
        manufacturer: "Wurth Elektronik",
        value: "100 nF, 50 V, X7R, 10%",
        package: "0603 (1608 metric)",
        function: "TPS56A37 BOOT-to-SW capacitor",
        sourceUrl: "https://www.we-online.com/components/products/datasheet/885012206095.pdf"
      },
      ...["C_V5_BUCK_OUT_A", "C_V5_BUCK_OUT_B"].map((reference) => ({
        reference,
        mpn: "GRM32ER71E226KE15L",
        manufacturer: "Murata",
        value: "22 uF, 25 V, X7R, 10%",
        package: "1210 (3225 metric)",
        function: "TPS56A37 output capacitance",
        sourceUrl: "https://www.murata.com/en-us/products/productdetail?partno=GRM32ER71E226KE15L"
      })),
      {
        reference: "R_V5_BUCK_MODE",
        mpn: "RT0603DRE0752K3L",
        manufacturer: "Yageo",
        value: "52.3 kOhm, 0.5%",
        package: "0603 (1608 metric)",
        function: "TPS56A37 500 kHz MODE programming",
        sourceUrl: "https://www.yageogroup.com/component-documentation/download/specsheet/RT0603DRE0752K3L"
      },
      {
        reference: "R_V5_BUCK_FB_TOP",
        mpn: "RT0603DRE0773K2L",
        manufacturer: "Yageo",
        value: "73.2 kOhm, 0.5%",
        package: "0603 (1608 metric)",
        function: "TPS56A37 5 V feedback upper divider",
        sourceUrl: "https://www.yageogroup.com/component-documentation/download/specsheet/RT0603DRE0773K2L"
      },
      {
        reference: "R_V5_BUCK_FB_BOTTOM",
        mpn: "RT0603DRE0710KL",
        manufacturer: "Yageo",
        value: "10 kOhm, 0.5%",
        package: "0603 (1608 metric)",
        function: "TPS56A37 5 V feedback lower divider",
        sourceUrl: "https://www.yageogroup.com/component-documentation/download/specsheet/RT0603DRE0710KL"
      },
      {
        reference: "R_V5_BUCK_FF",
        mpn: "RT0603DRE0749R9L",
        manufacturer: "Yageo",
        value: "49.9 Ohm, 0.5%",
        package: "0603 (1608 metric)",
        function: "TPS56A37 feed-forward damping resistor",
        sourceUrl: "https://www.yageogroup.com/component-documentation/download/specsheet/RT0603DRE0749R9L"
      },
      {
        reference: "C_V5_BUCK_FF",
        mpn: "GRM1885C1H151JA01D",
        manufacturer: "Murata",
        value: "150 pF, 50 V, C0G, 5%",
        package: "0603 (1608 metric)",
        function: "TPS56A37 feed-forward capacitor",
        sourceUrl: "https://www.murata.com/en-us/products/productdetail?partno=GRM1885C1H151JA01D"
      }
    ],
    intentionallyUnpopulated: [
      "R_V5_BUCK_EN_UP",
      "R_V5_BUCK_EN_DOWN",
      "C_V5_BUCK_SS",
      "R_V5_BUCK_PG_PULLUP",
      "TP_V5_BUCK_PG"
    ],
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
