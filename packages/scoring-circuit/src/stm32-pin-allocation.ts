import { benchPrototypeAnalogTopology } from "./bench-prototype-analog-topology.js"

type PlainRecord = Record<PropertyKey, unknown>

function isPlainRecord(value: unknown): value is PlainRecord {
  if (value === null || typeof value !== "object") return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object" || seen.has(value)) return value
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) deepFreeze((value as PlainRecord)[key], seen)
  return Object.freeze(value)
}

function hasExactDataGraph(actual: unknown, expected: unknown, seen = new WeakMap<object, object>()): boolean {
  if (Object.is(actual, expected)) return true
  if (actual === null || expected === null || typeof actual !== "object" || typeof expected !== "object") return false
  if (seen.has(actual)) return seen.get(actual) === expected
  seen.set(actual, expected)

  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length !== expected.length) return false
    return expected.every((entry, index) => hasExactDataGraph(actual[index], entry, seen))
  }
  if (!isPlainRecord(actual) || !isPlainRecord(expected)) return false
  const actualKeys = Reflect.ownKeys(actual)
  const expectedKeys = Reflect.ownKeys(expected)
  if (actualKeys.length !== expectedKeys.length || actualKeys.some((key) => !expectedKeys.includes(key))) return false
  return expectedKeys.every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(actual, key)
    return Boolean(descriptor && "value" in descriptor && hasExactDataGraph(descriptor.value, expected[key], seen))
  })
}

const pads = [
  [1, "VBAT", "SCORING_3V3_NO_BACKUP_TIE"],
  [2, "PC13", "UNCONNECTED_RESERVED"],
  [3, "PC14-OSC32_IN", "UNCONNECTED_NO_LSE"],
  [4, "PC15-OSC32_OUT", "UNCONNECTED_NO_LSE"],
  [5, "PF0-OSC_IN", "HSE_IN_RESERVED"],
  [6, "PF1-OSC_OUT", "HSE_OUT_RESERVED"],
  [7, "NRST", "SCORING_NRST_N"],
  [8, "PC0", "LEFT_A_SOURCE_EN"],
  [9, "PC1", "LEFT_A_SINK_EN"],
  [10, "PC2", "LEFT_B_SOURCE_EN"],
  [11, "PC3", "LEFT_B_SINK_EN"],
  [12, "PA0", "UNCONNECTED_ANALOG_RESERVED"],
  [13, "PA1", "UNCONNECTED_ANALOG_RESERVED"],
  [14, "PA2", "UNCONNECTED_ANALOG_RESERVED"],
  [15, "VSS", "SCORING_DGND"],
  [16, "VDD", "SCORING_3V3"],
  [17, "PA3", "UNCONNECTED_ANALOG_RESERVED"],
  [18, "PA4", "SAR0_CONVST_TIM3_CH2"],
  [19, "PA5", "SAR0_SCLK_SPI1_SCK"],
  [20, "PA6", "SAR0_DOUT_SPI1_MISO"],
  [21, "PA7", "UNCONNECTED_ANALOG_RESERVED"],
  [22, "PC4", "UNCONNECTED_RESERVED"],
  [23, "PC5", "UNCONNECTED_RESERVED"],
  [24, "PB0", "LEFT_C_SOURCE_EN"],
  [25, "PB1", "LEFT_C_SINK_EN"],
  [26, "PB2", "RIGHT_A_SOURCE_EN"],
  [27, "VSSA", "SCORING_AGND"],
  [28, "VREF+", "SCORING_VREF_2V5"],
  [29, "VDDA", "SCORING_3V3_ANALOG"],
  [30, "PB10", "RIGHT_A_SINK_EN"],
  [31, "VSS", "SCORING_DGND"],
  [32, "VDD", "SCORING_3V3"],
  [33, "PB11", "RIGHT_B_SOURCE_EN"],
  [34, "PB12", "RIGHT_B_SINK_EN"],
  [35, "PB13", "RIGHT_C_SOURCE_EN"],
  [36, "PB14", "RIGHT_C_SINK_EN"],
  [37, "PB15", "PISTE_SOURCE_EN"],
  [38, "PC6", "PISTE_SINK_EN"],
  [39, "PC7", "UNCONNECTED_RESERVED"],
  [40, "PC8", "UNCONNECTED_RESERVED"],
  [41, "PC9", "SCORING_WATCHDOG_WDI"],
  [42, "PA8", "PRIMARY_LAMP_RED_TIM1_CH1"],
  [43, "PA9", "PRIMARY_LAMP_GREEN_TIM1_CH2"],
  [44, "PA10", "PRIMARY_LAMP_LEFT_WHITE_TIM1_CH3"],
  [45, "PA11", "PRIMARY_LAMP_RIGHT_WHITE_TIM1_CH4"],
  [46, "PA12", "PRIMARY_BUZZER_TIM16_CH1"],
  [47, "VSS", "SCORING_DGND"],
  [48, "VDD", "SCORING_3V3"],
  [49, "PA13", "SWDIO"],
  [50, "PA14", "SWCLK"],
  [51, "PA15", "SCORE_CS_N_SPI3_NSS"],
  [52, "PC10", "SCORE_SCK_SPI3_SCK"],
  [53, "PC11", "SCORE_MISO_SPI3_MISO"],
  [54, "PC12", "SCORE_MOSI_SPI3_MOSI"],
  [55, "PD2", "UNCONNECTED_RESERVED"],
  [56, "PB3", "STM32_HEARTBEAT_ISOLATED"],
  [57, "PB4", "ESP32_HEARTBEAT_ISOLATED"],
  [58, "PB5", "ESP32_RESET_ASSERT_ISOLATED"],
  [59, "PB6", "UNCONNECTED_RESERVED"],
  [60, "PB7", "UNCONNECTED_RESERVED"],
  [61, "PB8-BOOT0", "BOOT0_PERMANENT_PULLDOWN"],
  [62, "PB9", "UNCONNECTED_RESERVED"],
  [63, "VSS", "SCORING_DGND"],
  [64, "VDD", "SCORING_3V3"]
] as const

const expectedLqfp64PadMap = [
  [1, "VBAT"],
  [2, "PC13"],
  [3, "PC14-OSC32_IN"],
  [4, "PC15-OSC32_OUT"],
  [5, "PF0-OSC_IN"],
  [6, "PF1-OSC_OUT"],
  [7, "NRST"],
  [8, "PC0"],
  [9, "PC1"],
  [10, "PC2"],
  [11, "PC3"],
  [12, "PA0"],
  [13, "PA1"],
  [14, "PA2"],
  [15, "VSS"],
  [16, "VDD"],
  [17, "PA3"],
  [18, "PA4"],
  [19, "PA5"],
  [20, "PA6"],
  [21, "PA7"],
  [22, "PC4"],
  [23, "PC5"],
  [24, "PB0"],
  [25, "PB1"],
  [26, "PB2"],
  [27, "VSSA"],
  [28, "VREF+"],
  [29, "VDDA"],
  [30, "PB10"],
  [31, "VSS"],
  [32, "VDD"],
  [33, "PB11"],
  [34, "PB12"],
  [35, "PB13"],
  [36, "PB14"],
  [37, "PB15"],
  [38, "PC6"],
  [39, "PC7"],
  [40, "PC8"],
  [41, "PC9"],
  [42, "PA8"],
  [43, "PA9"],
  [44, "PA10"],
  [45, "PA11"],
  [46, "PA12"],
  [47, "VSS"],
  [48, "VDD"],
  [49, "PA13"],
  [50, "PA14"],
  [51, "PA15"],
  [52, "PC10"],
  [53, "PC11"],
  [54, "PC12"],
  [55, "PD2"],
  [56, "PB3"],
  [57, "PB4"],
  [58, "PB5"],
  [59, "PB6"],
  [60, "PB7"],
  [61, "PB8-BOOT0"],
  [62, "PB9"],
  [63, "VSS"],
  [64, "VDD"]
] as const

export const stm32PinAllocation = deepFreeze({
  workUnit: "BP-120",
  part: "STM32G474RET3TR",
  package: "LQFP64",
  pads,
  packageMap: expectedLqfp64PadMap,
  selectedAcquisition: {
    scope: "one-channel-only",
    converter: "ADS8881IDGS",
    sclk: { pad: "PA5", pin: 19, peripheral: "SPI1_SCK" },
    dout: { pad: "PA6", pin: 20, peripheral: "SPI1_MISO" },
    convst: { pad: "PA4", pin: 18, peripheral: "TIM3_CH2" },
    din: "hard strap only; no STM32 pad is allocated",
    sampling: "TIM3 conversion strobe and SPI1 receive require measured end-to-end timing proof"
  },
  plannedSevenChannelReplication: {
    owner: "BP-103",
    state: "blocked",
    unallocatedNets: ["SAR1_DOUT through SAR7_DOUT", "SAR1_CONVST through SAR7_CONVST"],
    reason:
      "BP-100 approved one ADS8881 channel only. Seven dedicated DOUT/CONVST paths, a daisy-chain framing and throughput proof, or another reviewed serialization architecture has not been selected.",
    releaseEffect: "No seven-channel schematic, CubeMX configuration, or scoring-ready claim is authorized."
  },
  mcuAnalogAndTiming: {
    internalAdc: "not the primary BP-100 acquisition path; PA0, PA1, PA2, PA3, and PA7 stay unconnected and reserved",
    comparators: "no comparator INP/INM net is allocated to a BP-100 channel; COMP1 through COMP7 remain unconfigured",
    timer:
      "TIM3_CH2 owns one SAR0 CONVST candidate. HRTIM1 may remain an internal scheduler/timebase only after routing and jitter proof.",
    dma: "SPI1 RX DMA and timer/DMA synchronization are implementation candidates, not allocated DMA-channel claims"
  },
  isolatedSpi: {
    controller: "SPI3",
    master: "STM32",
    nets: [
      ["SCORE_CS_N", "PA15", 51, "STM32-to-ESP32"],
      ["SCORE_SCK", "PC10", 52, "STM32-to-ESP32"],
      ["SCORE_MISO", "PC11", 53, "ESP32-to-STM32"],
      ["SCORE_MOSI", "PC12", 54, "STM32-to-ESP32"]
    ],
    control: [
      ["STM32_HEARTBEAT", "PB3", 56, "STM32-to-ESP32"],
      ["ESP32_HEARTBEAT", "PB4", 57, "ESP32-to-STM32"],
      ["ESP32_RESET_ASSERT", "PB5", 58, "STM32-to-ESP32 only"]
    ],
    authority:
      "The isolated link transports bounded records and health only. It cannot create, alter, clear, or directly drive a scoring decision, primary lamp, buzzer, acquisition, or STM32 reset."
  },
  safeStates: {
    switchEnables:
      "all fourteen source/sink enable nets require external pulldowns and remain off until STM32 self-test passes",
    lampsAndBuzzer:
      "all five driver inputs require external inactive pulls; MCU reset alone is not a safe-output control",
    bootAndService:
      "PB8-BOOT0 has a permanent pull-down. PA13, PA14, and NRST are service-only. Production SWD does not require JTAG or SWO.",
    unused:
      "No unused pad has an external functional net. Firmware must configure unused GPIOs to the documented low-leakage safe state after reset."
  },
  clocks: {
    hse: "PF0/PF1 reserved; populate and validate or explicitly prove internal-clock tolerance before release",
    lse: "PC14/PC15 are intentionally unconnected. Any STM32 LSE or backup-time requirement is a new allocation conflict."
  },
  backupDomain: "VBAT is tied explicitly to SCORING_3V3 because this allocation has no backup supply.",
  authority: {
    scoringOwner: "STM32G474RET3TR",
    sevenChannelIntegrationAuthorized: false,
    cubeMxProofComplete: false,
    hardwareApproval: false,
    releaseState: "deny"
  }
} as const)

export function validateStm32PinAllocation(value: unknown): true {
  if (!hasExactDataGraph(value, stm32PinAllocation)) {
    throw new RangeError("BP-120 STM32 allocation must exactly match the reviewed fail-closed contract")
  }
  if (
    benchPrototypeAnalogTopology.workUnit !== "BP-100" ||
    benchPrototypeAnalogTopology.scope !== "one channel only; BP-103 owns any seven-channel replication" ||
    !benchPrototypeAnalogTopology.selectedReferences.some(
      ([reference, mpn]) => reference === "U_SAR" && mpn === "ADS8881IDGS"
    )
  ) {
    throw new RangeError("BP-120 must not outpace the committed BP-100 one-channel ADS8881 decision")
  }
  const pinNumbers = stm32PinAllocation.pads.map(([pin]) => pin)
  if (
    pinNumbers.length !== 64 ||
    new Set(pinNumbers).size !== 64 ||
    !pinNumbers.every((pin) => pin >= 1 && pin <= 64)
  ) {
    throw new RangeError("BP-120 must account for every LQFP64 pad exactly once")
  }
  if (
    !hasExactDataGraph(
      stm32PinAllocation.pads.map(([pin, pad]) => [pin, pad]),
      expectedLqfp64PadMap
    )
  ) {
    throw new RangeError("BP-120 pad names must exactly match the independent DS12288 LQFP64 package map")
  }
  if (stm32PinAllocation.pads[0]![2] !== "SCORING_3V3_NO_BACKUP_TIE") {
    throw new RangeError("BP-120 must tie VBAT to SCORING_3V3 when no backup supply is allocated")
  }
  if (
    stm32PinAllocation.plannedSevenChannelReplication.state !== "blocked" ||
    stm32PinAllocation.authority.releaseState !== "deny"
  ) {
    throw new RangeError("BP-120 must fail closed until BP-103 resolves the seven-channel SAR interface")
  }
  return true
}
