type PlainRecord = Record<PropertyKey, unknown>

function isPlainRecord(value: unknown): value is PlainRecord {
  if (value === null || typeof value !== "object") return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) throw new TypeError("P0 acquisition data cannot contain an alias or cycle")
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (!descriptor || !("value" in descriptor)) throw new TypeError("P0 acquisition data must not use accessors")
    deepFreeze(descriptor.value, seen)
  }
  return Object.freeze(value)
}

function hasExactDataGraph(actual: unknown, expected: unknown, seen = new WeakMap<object, object>()): boolean {
  if (Object.is(actual, expected)) return true
  if (actual === null || expected === null || typeof actual !== "object" || typeof expected !== "object") return false
  if (seen.has(actual)) return seen.get(actual) === expected
  seen.set(actual, expected)

  if (Array.isArray(expected)) {
    if (
      !Array.isArray(actual) ||
      Object.getPrototypeOf(actual) !== Array.prototype ||
      actual.length !== expected.length
    ) {
      return false
    }
    const keys = Reflect.ownKeys(actual)
    if (keys.some((key) => typeof key === "symbol" || (key !== "length" && !/^(0|[1-9]\d*)$/u.test(key)))) {
      return false
    }
    return expected.every((entry, index) => hasExactDataGraph(actual[index], entry, seen))
  }

  if (!isPlainRecord(actual) || !isPlainRecord(expected)) return false
  const actualKeys = Reflect.ownKeys(actual)
  const expectedKeys = Reflect.ownKeys(expected)
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key) => typeof key === "symbol" || !expectedKeys.includes(key))
  ) {
    return false
  }
  return expectedKeys.every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(actual, key)
    const expectedDescriptor = Object.getOwnPropertyDescriptor(expected, key)
    return Boolean(
      descriptor &&
      expectedDescriptor &&
      "value" in descriptor &&
      "value" in expectedDescriptor &&
      descriptor.enumerable &&
      expectedDescriptor.enumerable &&
      hasExactDataGraph(descriptor.value, expectedDescriptor.value, seen)
    )
  })
}

const channelOrder = [
  "LEFT_WEAPON_A",
  "LEFT_WEAPON_B",
  "LEFT_WEAPON_C",
  "RIGHT_WEAPON_A",
  "RIGHT_WEAPON_B",
  "RIGHT_WEAPON_C",
  "PISTE"
] as const

const candidateQuantities = [
  { designatorPrefix: "U_REF", mpn: "REF5025AQDRQ1", quantity: 7, role: "one 2.5 V reference per acquisition cell" },
  {
    designatorPrefix: "U_SOURCE_SWITCH",
    mpn: "TMUX1112PWR",
    quantity: 7,
    role: "one source and quiet-path switch per cell"
  },
  {
    designatorPrefix: "U_ESD",
    mpn: "TPD4E05U06DQAR",
    quantity: 2,
    role: "seven protected lines across eight shunt lanes"
  },
  { designatorPrefix: "U_OVP_BUFFER", mpn: "ADA4177-1ARZ", quantity: 7, role: "one unity buffer per cell" },
  { designatorPrefix: "U_SAR", mpn: "ADS8881IDGS", quantity: 7, role: "one simultaneous 18-bit SAR per cell" },
  {
    designatorPrefix: "U_NEGATIVE_RAIL",
    mpn: "TPS60400DBVR",
    quantity: 1,
    role: "candidate shared negative-rail generator"
  },
  { designatorPrefix: "R_ESD", mpn: "CRCW060322R0FKEAHP", quantity: 7, role: "22 ohm series protection" },
  { designatorPrefix: "R_SOURCE", mpn: "ERA3AEB2491V", quantity: 7, role: "2.49 kohm excitation resistor" },
  {
    designatorPrefix: "R_SOURCE_PD",
    mpn: "CRCW0603100KFKEAHP",
    quantity: 7,
    role: "100 kilohm source-switch safe-state pulldown"
  },
  { designatorPrefix: "R_SAR", mpn: "CRCW060320R0FKEAHP", quantity: 7, role: "20 ohm ADC input isolation" },
  { designatorPrefix: "C_SAR", mpn: "C0603C102J5GACTU", quantity: 7, role: "1 nF ADC input capacitor" },
  {
    designatorPrefix: "C_REF_IN",
    mpn: "CGA3E3X7R1H105K080AB",
    quantity: 7,
    role: "1 uF REF5025 input bypass"
  },
  { designatorPrefix: "C_REF_REG", mpn: "T521B106M025ATE100", quantity: 7, role: "10 uF reference output capacitor" },
  {
    designatorPrefix: "C_REF_REG_HF",
    mpn: "C0603C104K3RACTU",
    quantity: 7,
    role: "100 nF reference high-frequency support"
  },
  { designatorPrefix: "R_REF_SAR", mpn: "RCWE0603R220FKEA", quantity: 7, role: "0.22 ohm ADC reference feed" },
  { designatorPrefix: "C_REF", mpn: "GRM21BR71A106KE51L", quantity: 7, role: "10 uF ADC-local reference reservoir" },
  {
    designatorPrefix: "C_BUFFER_POS",
    mpn: "C0603C104K3RACTU",
    quantity: 7,
    role: "100 nF ADA4177 positive-rail bypass"
  },
  {
    designatorPrefix: "C_BUFFER_NEG",
    mpn: "C0603C104K3RACTU",
    quantity: 7,
    role: "100 nF ADA4177 negative-rail bypass"
  },
  {
    designatorPrefix: "C_SAR_AVDD",
    mpn: "CGA3E3X7R1H105K080AB",
    quantity: 7,
    role: "1 uF ADS8881 AVDD bypass"
  },
  {
    designatorPrefix: "C_SAR_DVDD",
    mpn: "CGA3E3X7R1H105K080AB",
    quantity: 7,
    role: "1 uF ADS8881 DVDD bypass"
  },
  { designatorPrefix: "C_MUX", mpn: "C0603C104K3RACTU", quantity: 7, role: "100 nF TMUX1112 bypass" },
  {
    designatorPrefix: "C_NEG_IN",
    mpn: "CGA3E3X7R1H105K080AB",
    quantity: 1,
    role: "shared TPS60400 1 uF input bypass"
  },
  {
    designatorPrefix: "C_NEG_FLY",
    mpn: "CGA3E3X7R1H105K080AB",
    quantity: 1,
    role: "shared TPS60400 1 uF flying capacitor"
  },
  {
    designatorPrefix: "C_NEG_OUT",
    mpn: "CGA3E3X7R1H105K080AB",
    quantity: 1,
    role: "shared TPS60400 1 uF output bypass"
  }
] as const

export function calculateP0SevenLineReadout(input: { sclkHz: number }) {
  if (!isPlainRecord(input) || Reflect.ownKeys(input).length !== 1) {
    throw new RangeError("P0 readout input must contain only a finite sclkHz value")
  }
  const descriptor = Object.getOwnPropertyDescriptor(input, "sclkHz")
  if (!descriptor || !("value" in descriptor) || !descriptor.enumerable || typeof descriptor.value !== "number") {
    throw new RangeError("P0 readout input must provide sclkHz as an own enumerable data property")
  }
  const sclkHz = descriptor.value
  if (!Number.isFinite(sclkHz) || sclkHz <= 0 || sclkHz > 36_000_000) {
    throw new RangeError("P0 SCLK must be finite, positive, and no more than 36 MHz")
  }
  const clockEdges = 18 * channelOrder.length
  const shiftSeconds = clockEdges / sclkHz
  const maximumConversionSeconds = 710e-9
  const completeSetSeconds = maximumConversionSeconds + shiftSeconds
  return deepFreeze({
    bitsPerChannel: 18,
    channelCount: channelOrder.length,
    clockEdges,
    completeSetMicroseconds: completeSetSeconds * 1e6,
    completeSetSeconds,
    maximumConversionSeconds,
    sclkHz,
    shiftSeconds,
    underTenMicroseconds: completeSetSeconds <= 10e-6
  })
}

const readoutAt20Mhz = calculateP0SevenLineReadout({ sclkHz: 20_000_000 })

export const p0SevenLineAcquisition = deepFreeze({
  workUnit: "P0-BP-100",
  scope: "ESP32-only seven-line acquisition definition",
  controller: {
    host: "ESP32-S3",
    activeDependencies: { isolationHardware: false, stm32: false },
    requiredGpioRoles: { inputs: 1, outputs: 2 },
    pinBinding: "SAR_SCLK is GPIO4, SAR_DOUT is GPIO5, and SAR_CONVST is GPIO6"
  },
  channels: channelOrder.map((line, index) => ({
    chainIndex: index + 1,
    line,
    adc: `U_SAR_${index + 1}`,
    sourcePath: `U_REF_${index + 1}.VREF_2V5 -> R_SOURCE_${index + 1} 2.49 kohm -> U_SOURCE_SWITCH_${index + 1}.SOURCE_PATH -> ${line}; U_SOURCE_SWITCH_${index + 1}.SOURCE_EN -> R_SOURCE_PD_${index + 1} 100 kilohm -> SCORING_SGND`,
    acquisitionPath: `${line} -> TPD4E05U06 protected lane -> R_ESD_${index + 1} 22 ohm -> TMUX1112 quiet path -> ADA4177-1 unity buffer -> R_SAR_${index + 1} 20 ohm and C_SAR_${index + 1} 1 nF -> ADS8881 AINP; AINN -> SCORING_SGND`
  })),
  candidateQuantities,
  esdLaneAssignment: {
    assigned: [
      { lane: 1, line: "LEFT_WEAPON_A", protector: "U_ESD_1" },
      { lane: 2, line: "LEFT_WEAPON_B", protector: "U_ESD_1" },
      { lane: 3, line: "LEFT_WEAPON_C", protector: "U_ESD_1" },
      { lane: 4, line: "RIGHT_WEAPON_A", protector: "U_ESD_1" },
      { lane: 1, line: "RIGHT_WEAPON_B", protector: "U_ESD_2" },
      { lane: 2, line: "RIGHT_WEAPON_C", protector: "U_ESD_2" },
      { lane: 3, line: "PISTE", protector: "U_ESD_2" }
    ],
    unused: {
      lane: 4,
      protector: "U_ESD_2",
      disposition: "unused-no-connect",
      prohibition: "this lane may not become an unlisted input, connector path, test input, or acquisition channel"
    }
  },
  rails: {
    V5_ANALOG:
      "positive analog supply for U_REF_1 through U_REF_7, U_OVP_BUFFER_1 through U_OVP_BUFFER_7, and C_NEG_IN",
    VNEG_ANALOG: "TPS60400 output for U_OVP_BUFFER_1 through U_OVP_BUFFER_7 and C_BUFFER_NEG_1 through C_BUFFER_NEG_7",
    APP_3V3:
      "supply for U_SOURCE_SWITCH_1 through U_SOURCE_SWITCH_7, U_SAR_1 through U_SAR_7 AVDD/DVDD, and ESP32-S3 timing I/O",
    VREF_2V5:
      "seven separate REF5025 outputs; each U_REF_n drives only R_SOURCE_n, C_REF_REG_n, C_REF_REG_HF_n, and R_REF_SAR_n",
    SCORING_SGND:
      "return for every analog support capacitor, ADS8881 AINN, REF5025, TPS60400, and TPD4E05U06 ground pin"
  },
  adcTiming: {
    converter: "ADS8881IDGS",
    mode: "seven-ADC daisy chain, simultaneous conversion, no BUSY signal",
    physicalChain: channelOrder,
    hostWordOrder: [...channelOrder].reverse(),
    esp32Signals: [
      { direction: "output", gpio: 6, hostRole: "SAR_CONVST", net: "SAR_CONVST_ALL", requiredIdleLevel: "low" },
      { direction: "output", gpio: 4, hostRole: "SAR_SCLK", net: "SAR_SCLK_ALL", requiredIdleLevel: "low" },
      { direction: "input", gpio: 5, hostRole: "SAR_DOUT", net: "SAR_DOUT_TO_ESP32", source: "U_SAR_7.DOUT" }
    ],
    daisyEndpoints: [
      { from: "SCORING_SGND", net: "SAR1_DIN_GROUND", to: "U_SAR_1.DIN" },
      { from: "U_SAR_1.DOUT", net: "SAR_CHAIN_1_TO_2", to: "U_SAR_2.DIN" },
      { from: "U_SAR_2.DOUT", net: "SAR_CHAIN_2_TO_3", to: "U_SAR_3.DIN" },
      { from: "U_SAR_3.DOUT", net: "SAR_CHAIN_3_TO_4", to: "U_SAR_4.DIN" },
      { from: "U_SAR_4.DOUT", net: "SAR_CHAIN_4_TO_5", to: "U_SAR_5.DIN" },
      { from: "U_SAR_5.DOUT", net: "SAR_CHAIN_5_TO_6", to: "U_SAR_6.DIN" },
      { from: "U_SAR_6.DOUT", net: "SAR_CHAIN_6_TO_7", to: "U_SAR_7.DIN" },
      { from: "U_SAR_7.DOUT", net: "SAR_DOUT_TO_ESP32", to: "ESP32-S3 ADC_MISO" }
    ],
    transaction: {
      conversionStartRule: "ADC_SCLK is low at ADC_CONVST rising edge",
      readRule: "hold ADC_CONVST high while exactly 126 SCLK rising edges shift seven 18-bit MSB-first words",
      targetSclkHz: 20_000_000,
      maximumSclkHz: 36_000_000,
      maximumConversionSeconds: 710e-9,
      readoutAt20Mhz
    }
  },
  failureStates: [
    {
      state: "boot-safe",
      trigger: "ESP32 reset, brownout, watchdog reset, or firmware start",
      requiredAction: "hold ADC_CONVST and ADC_SCLK low, reject ADC data, and keep every TMUX source control low"
    },
    {
      state: "analog-health-fault",
      trigger:
        "reference, positive analog rail, or TPS60400 negative rail is outside its characterized operating range",
      requiredAction: "reject the complete sample set and disable all excitation"
    },
    {
      state: "serial-transaction-fault",
      trigger: "not exactly 126 clocks, unexpected ADC_CONVST/SCLK sequence, or a missing word",
      requiredAction: "discard all seven words; do not reuse a partial set"
    },
    {
      state: "interlock-fault",
      trigger: "source control is not observed low before quiet-path acquisition",
      requiredAction: "disable excitation and reject the set"
    },
    {
      state: "fault-or-unpowered-exposure",
      trigger: "external fault, loss of analog power, or unpowered connector exposure",
      requiredAction: "DENY normal acquisition pending the guarded-fault and recovery characterization matrix"
    },
    {
      state: "characterization-incomplete",
      trigger: "any required P0 physical evidence is absent",
      requiredAction: "retain architecture-only status; no fabrication, scoring, or FIE claim"
    }
  ],
  characterizationPlan: [
    "Verify ESP32-S3 GPIO electrical levels, timing jitter, and boot/reset idle levels at ADC_CONVST, ADC_SCLK, and SAR_DOUT_TO_ESP32.",
    "Capture simultaneous seven-line conversion timing and prove every 18-bit host word maps to the stated reverse chain order.",
    "Measure reference, TPS60400 negative-rail load, crosstalk, ADC input settling, and serial signal integrity on the assembled seven-line board.",
    "Run powered and unpowered plus/minus guarded-fault and overload-recovery matrices with source disabled, trace nodes, and post-pulse normal-acquisition checks.",
    "Characterize 0 ohm and the 450/475/500 ohm region across intended temperature, fixture, cable, and calibration conditions."
  ],
  authority: {
    architectureOnly: true,
    fabricationAuthorized: false,
    fieConformanceProven: false,
    scoringReady: false
  }
} as const)

export function validateP0SevenLineAcquisition(value: unknown): true {
  if (!hasExactDataGraph(value, p0SevenLineAcquisition)) {
    throw new RangeError("P0 acquisition definition must exactly match the reviewed ESP32-only decision")
  }
  if (
    p0SevenLineAcquisition.channels.length !== 7 ||
    new Set(p0SevenLineAcquisition.channels.map(({ line }) => line)).size !== 7 ||
    !hasExactDataGraph(
      p0SevenLineAcquisition.channels.map(({ line }) => line),
      channelOrder
    ) ||
    p0SevenLineAcquisition.esdLaneAssignment.assigned.length !== 7 ||
    !hasExactDataGraph(
      p0SevenLineAcquisition.esdLaneAssignment.assigned.map(({ line }) => line),
      channelOrder
    ) ||
    p0SevenLineAcquisition.esdLaneAssignment.unused.disposition !== "unused-no-connect" ||
    p0SevenLineAcquisition.candidateQuantities.length !== 24 ||
    p0SevenLineAcquisition.controller.activeDependencies.stm32 ||
    p0SevenLineAcquisition.controller.activeDependencies.isolationHardware ||
    p0SevenLineAcquisition.adcTiming.transaction.readoutAt20Mhz.clockEdges !== 126 ||
    !p0SevenLineAcquisition.adcTiming.transaction.readoutAt20Mhz.underTenMicroseconds ||
    p0SevenLineAcquisition.authority.fieConformanceProven ||
    p0SevenLineAcquisition.authority.scoringReady
  ) {
    throw new RangeError("P0 channel identity, controller boundary, timing, or authority is invalid")
  }
  return true
}

validateP0SevenLineAcquisition(p0SevenLineAcquisition)
