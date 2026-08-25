import {
  benchPrototypeAnalogTopology,
  validateBenchPrototypeAnalogTopology
} from "./bench-prototype-analog-topology.js"
import {
  benchPrototypeFaultProtection,
  validateBenchPrototypeFaultProtection
} from "./bench-prototype-fault-protection.js"
import {
  benchPrototypeReferenceDrive,
  validateBenchPrototypeReferenceDrive
} from "./bench-prototype-reference-drive.js"
import { oneChannelAnalogExperimentBom } from "./one-channel-analog-readiness.js"
import { stm32PinAllocation, validateStm32PinAllocation } from "./stm32-pin-allocation.js"

type PlainRecord = Record<PropertyKey, unknown>

function isPlainRecord(value: unknown): value is PlainRecord {
  if (value === null || typeof value !== "object") return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) throw new TypeError("BP-103 canonical data cannot contain an alias or cycle")
  seen.add(value)
  const keys = Reflect.ownKeys(value)
  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype) {
      throw new TypeError("BP-103 canonical arrays must use Array.prototype")
    }
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length")
    if (!lengthDescriptor || !("value" in lengthDescriptor) || lengthDescriptor.enumerable) {
      throw new TypeError("BP-103 canonical arrays must have a standard data length")
    }
    if (
      keys.length !== lengthDescriptor.value + 1 ||
      keys.some((key) => typeof key === "symbol" || (key !== "length" && !/^(0|[1-9]\d*)$/u.test(key)))
    ) {
      throw new TypeError("BP-103 canonical arrays must be dense and contain no hidden keys")
    }
    for (let index = 0; index < lengthDescriptor.value; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index))
      if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
        throw new TypeError("BP-103 canonical arrays must contain enumerable data entries")
      }
      deepFreeze(descriptor.value, seen)
    }
  } else {
    if (!isPlainRecord(value)) throw new TypeError("BP-103 canonical records must be plain objects")
    for (const key of keys) {
      if (typeof key === "symbol") throw new TypeError("BP-103 canonical records cannot contain symbol keys")
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
        throw new TypeError("BP-103 canonical records must contain enumerable data properties")
      }
      deepFreeze(descriptor.value, seen)
    }
  }
  return Object.freeze(value)
}

function hasExactDataGraph(
  actual: unknown,
  expected: unknown,
  seenActual = new WeakSet<object>(),
  seenExpected = new WeakSet<object>()
): boolean {
  if (actual === null || expected === null || typeof actual !== "object" || typeof expected !== "object") {
    return Object.is(actual, expected)
  }
  if (seenActual.has(actual) || seenExpected.has(expected)) return false
  seenActual.add(actual)
  seenExpected.add(expected)

  if (Array.isArray(expected)) {
    if (
      !Array.isArray(actual) ||
      Object.getPrototypeOf(actual) !== Array.prototype ||
      Object.getPrototypeOf(expected) !== Array.prototype
    )
      return false
    const actualLength = Object.getOwnPropertyDescriptor(actual, "length")
    const expectedLength = Object.getOwnPropertyDescriptor(expected, "length")
    if (
      !actualLength ||
      !expectedLength ||
      !("value" in actualLength) ||
      !("value" in expectedLength) ||
      actualLength.enumerable ||
      expectedLength.enumerable ||
      actualLength.value !== expectedLength.value
    ) {
      return false
    }
    const actualKeys = Reflect.ownKeys(actual)
    const expectedKeys = Reflect.ownKeys(expected)
    if (
      actualKeys.length !== actualLength.value + 1 ||
      expectedKeys.length !== expectedLength.value + 1 ||
      actualKeys.some((key) => typeof key === "symbol" || (key !== "length" && !/^(0|[1-9]\d*)$/u.test(key))) ||
      expectedKeys.some((key) => typeof key === "symbol" || (key !== "length" && !/^(0|[1-9]\d*)$/u.test(key)))
    ) {
      return false
    }
    for (let index = 0; index < expectedLength.value; index += 1) {
      const actualDescriptor = Object.getOwnPropertyDescriptor(actual, String(index))
      const expectedDescriptor = Object.getOwnPropertyDescriptor(expected, String(index))
      if (
        !actualDescriptor ||
        !expectedDescriptor ||
        !("value" in actualDescriptor) ||
        !("value" in expectedDescriptor) ||
        !actualDescriptor.enumerable ||
        !expectedDescriptor.enumerable ||
        !hasExactDataGraph(actualDescriptor.value, expectedDescriptor.value, seenActual, seenExpected)
      ) {
        return false
      }
    }
    return true
  }

  if (!isPlainRecord(actual) || !isPlainRecord(expected)) return false
  const actualKeys = Reflect.ownKeys(actual)
  const expectedKeys = Reflect.ownKeys(expected)
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key) => typeof key === "symbol" || !expectedKeys.includes(key))
  )
    return false
  return expectedKeys.every((key) => {
    if (typeof key === "symbol") return false
    const actualDescriptor = Object.getOwnPropertyDescriptor(actual, key)
    const expectedDescriptor = Object.getOwnPropertyDescriptor(expected, key)
    return Boolean(
      actualDescriptor &&
      expectedDescriptor &&
      "value" in actualDescriptor &&
      "value" in expectedDescriptor &&
      actualDescriptor.enumerable &&
      expectedDescriptor.enumerable &&
      hasExactDataGraph(actualDescriptor.value, expectedDescriptor.value, seenActual, seenExpected)
    )
  })
}

const conductorNames = [
  "LEFT_WEAPON_A",
  "LEFT_WEAPON_B",
  "LEFT_WEAPON_C",
  "RIGHT_WEAPON_A",
  "RIGHT_WEAPON_B",
  "RIGHT_WEAPON_C",
  "PISTE"
] as const

const enablePadMap = [
  {
    conductor: "LEFT_WEAPON_A",
    source: { net: "LEFT_A_SOURCE_EN", pad: "PC0", pin: 8 },
    sink: { net: "LEFT_A_SINK_EN", pad: "PC1", pin: 9 }
  },
  {
    conductor: "LEFT_WEAPON_B",
    source: { net: "LEFT_B_SOURCE_EN", pad: "PC2", pin: 10 },
    sink: { net: "LEFT_B_SINK_EN", pad: "PC3", pin: 11 }
  },
  {
    conductor: "LEFT_WEAPON_C",
    source: { net: "LEFT_C_SOURCE_EN", pad: "PB0", pin: 24 },
    sink: { net: "LEFT_C_SINK_EN", pad: "PB1", pin: 25 }
  },
  {
    conductor: "RIGHT_WEAPON_A",
    source: { net: "RIGHT_A_SOURCE_EN", pad: "PB2", pin: 26 },
    sink: { net: "RIGHT_A_SINK_EN", pad: "PB10", pin: 30 }
  },
  {
    conductor: "RIGHT_WEAPON_B",
    source: { net: "RIGHT_B_SOURCE_EN", pad: "PB11", pin: 33 },
    sink: { net: "RIGHT_B_SINK_EN", pad: "PB12", pin: 34 }
  },
  {
    conductor: "RIGHT_WEAPON_C",
    source: { net: "RIGHT_C_SOURCE_EN", pad: "PB13", pin: 35 },
    sink: { net: "RIGHT_C_SINK_EN", pad: "PB14", pin: 36 }
  },
  {
    conductor: "PISTE",
    source: { net: "PISTE_SOURCE_EN", pad: "PB15", pin: 37 },
    sink: { net: "PISTE_SINK_EN", pad: "PC6", pin: 38 }
  }
] as const

/**
 * Every populated per-cell MPN is bound to the BP-100 through BP-102
 * selections, apart from R_SOURCE_PD. That enable pulldown is retained from
 * the reviewed one-channel experiment BOM because BP-100 records the source
 * resistor but not its mandatory safe-state support part.
 */
const cellIdentity = {
  adc: "ADS8881IDGS",
  buffer: "ADA4177-1BRZ",
  esd: "TPD4E05U06DQAR",
  normalSeries: "CRCW060322R0FKEAHP",
  sarSeries: "CRCW060320R0FKEAHP",
  sarCapacitor: "C0603C102J5GACTU",
  switch: "TMUX1112PWR",
  sourceResistor: "ERA3AEB2491V",
  sourceEnablePullDown: "CRCW0603100KFKEAHP",
  guard: "CRCW120656K0FKEAHP",
  localReferenceReservoir: "GRM21BR71A106KE51L",
  localReferenceFeed: "RCWE0603R220FKEA",
  reference: "REF5025AQDRQ1",
  referenceInputBypass: "GRM188R71A105KA12D",
  referenceRegulatorOutput: "T521B106M025ATE100",
  referenceRegulatorHighFrequency: "C0603C104K3RACTU"
} as const

const expectedCellMpnBindings = [
  ["U_ESD", cellIdentity.esd],
  ["R_ESD", cellIdentity.normalSeries],
  ["U_SOURCE_SWITCH", cellIdentity.switch],
  ["R_SOURCE", cellIdentity.sourceResistor],
  ["R_SOURCE_PD", cellIdentity.sourceEnablePullDown],
  ["U_OVP_BUFFER", cellIdentity.buffer],
  ["R_SAR", cellIdentity.sarSeries],
  ["C_SAR", cellIdentity.sarCapacitor],
  ["U_SAR", cellIdentity.adc],
  ["U_REF", cellIdentity.reference],
  ["C_REF_IN", cellIdentity.referenceInputBypass],
  ["C_REF_REG", cellIdentity.referenceRegulatorOutput],
  ["C_REF_REG_HF", cellIdentity.referenceRegulatorHighFrequency],
  ["R_REF_SAR", cellIdentity.localReferenceFeed],
  ["C_REF", cellIdentity.localReferenceReservoir],
  ["R_FAULT_GUARD", cellIdentity.guard]
] as const

function selectedMpn(reference: string): string {
  const matches = oneChannelAnalogExperimentBom.filter((row) => row.reference === reference)
  return matches.length === 1 ? matches[0]!.mpn : "__MISSING_OR_DUPLICATE__"
}

function liveCellMpnBindings() {
  return expectedCellMpnBindings.map(([reference]) => [reference, selectedMpn(reference)])
}

const channels = conductorNames.map((conductor, index) => {
  const number = index + 1
  const prefix = `CH${number}_${conductor}`
  return {
    chainIndex: number,
    conductor,
    connectorNet: conductor,
    references: {
      esd: `U_ESD_${number}`,
      series: `R_ESD_${number}`,
      switch: `U_SOURCE_SWITCH_${number}`,
      source: `R_SOURCE_${number}`,
      sourcePullDown: `R_SOURCE_PD_${number}`,
      buffer: `U_OVP_BUFFER_${number}`,
      sarSeries: `R_SAR_${number}`,
      sarCap: `C_SAR_${number}`,
      adc: `U_SAR_${number}`,
      reference: `U_REF_${number}`,
      referenceInputBypass: `C_REF_IN_${number}`,
      referenceRegulatorOutput: `C_REF_REG_${number}`,
      referenceRegulatorHighFrequency: `C_REF_REG_HF_${number}`,
      referenceFeed: `R_REF_SAR_${number}`,
      referenceReservoir: `C_REF_${number}`,
      guard: `R_FAULT_GUARD_${number}`
    },
    nets: {
      line: `${prefix}_LINE`,
      protected: `${prefix}_PROTECTED`,
      buffered: `${prefix}_BUFFERED`,
      adcInput: `${prefix}_AINP`,
      reference: `${prefix}_REF_2V5`,
      sourceEnable: `${conductor.replace("_WEAPON", "")}_SOURCE_EN`,
      sinkEnable: `${conductor.replace("_WEAPON", "")}_SINK_EN`
    },
    controls: structuredClone(enablePadMap[index]!),
    exactPath: [
      `${conductor} -> U_ESD_${number} shunt on SCORING_SGND`,
      `${conductor} -> R_ESD_${number} 22 ohm -> U_SOURCE_SWITCH_${number}.QUIET`,
      `U_SOURCE_SWITCH_${number}.QUIET -> U_OVP_BUFFER_${number} unity input`,
      `U_OVP_BUFFER_${number}.OUT -> R_SAR_${number} 20 ohm -> U_SAR_${number}.AINP with C_SAR_${number} C0603C102J5GACTU 1 nF from AINP to SCORING_SGND`,
      `U_SAR_${number}.AINN -> SCORING_SGND`,
      `V5_ANALOG -> U_REF_${number}.IN with C_REF_IN_${number} 1 uF to SCORING_SGND`,
      `U_REF_${number}.OUT -> C_REF_REG_${number} 10 uF and C_REF_REG_HF_${number} 100 nF regulator-local loop to SCORING_SGND`,
      `U_REF_${number}.OUT -> R_REF_SAR_${number} 0.22 ohm -> U_SAR_${number}.REF with C_REF_${number} 10 uF to SCORING_SGND`
    ],
    excitationPath: [
      `U_REF_${number}.OUT REF5025AQDRQ1 -> R_SOURCE_${number} ERA3AEB2491V 2.49 kohm -> U_SOURCE_SWITCH_${number}.SOURCE_PATH -> ${conductor}`,
      `${enablePadMap[index]!.source.pad} pin ${enablePadMap[index]!.source.pin} ${enablePadMap[index]!.source.net} -> U_SOURCE_SWITCH_${number}.SOURCE_EN`,
      `U_SOURCE_SWITCH_${number}.SOURCE_EN -> R_SOURCE_PD_${number} CRCW0603100KFKEAHP 100 kilohm -> SCORING_SGND`
    ],
    guardedForcePath: `externally interlocked normally-open guarded relay -> R_FAULT_GUARD_${number} CRCW120656K0FKEAHP 56 kilohm 1 percent -> ${conductor}; normal source and guarded force never enable together`,
    sinkEnableDisposition: `${enablePadMap[index]!.sink.pad} pin ${enablePadMap[index]!.sink.pin} ${enablePadMap[index]!.sink.net} is allocated by BP-120; BP-100 through BP-102 select no sink-switch topology, so it remains integration-unresolved and DENY until schematic and all-conductor interlock evidence exist`
  }
})

export function calculateSevenChannelReadout(input: { sclkHz: number }) {
  if (!isPlainRecord(input)) {
    throw new RangeError("BP-103 readout input must contain only one finite sclkHz value")
  }
  const keys = Reflect.ownKeys(input)
  const descriptor = Object.getOwnPropertyDescriptor(input, "sclkHz")
  if (
    keys.length !== 1 ||
    keys[0] !== "sclkHz" ||
    !descriptor ||
    !("value" in descriptor) ||
    !descriptor.enumerable ||
    !Number.isFinite(descriptor.value)
  ) {
    throw new RangeError("BP-103 readout input must contain only one finite sclkHz value")
  }
  const { value: sclkHz } = descriptor
  if (sclkHz <= 0 || sclkHz > 36_000_000) {
    throw new RangeError("BP-103 uses the ADS8881 <=36 MHz slow-read edge allowance")
  }
  const channelCount = 7
  const bitsPerChannel = 18
  const clockEdges = channelCount * bitsPerChannel
  const maximumConversionSeconds = 710e-9
  const shiftSeconds = clockEdges / sclkHz
  const completeSetSeconds = maximumConversionSeconds + shiftSeconds
  return {
    bitsPerChannel,
    channelCount,
    clockEdges,
    completeSetSeconds,
    completeSetMicroseconds: completeSetSeconds * 1e6,
    maximumConversionSeconds,
    sclkHz,
    shiftSeconds,
    underTenMicroseconds: completeSetSeconds <= 10e-6
  }
}

const readoutAt20Mhz = calculateSevenChannelReadout({ sclkHz: 20_000_000 })

const upstreamSnapshot = deepFreeze({
  analog: structuredClone(benchPrototypeAnalogTopology),
  fault: structuredClone(benchPrototypeFaultProtection),
  reference: structuredClone(benchPrototypeReferenceDrive),
  experimentMpnBindings: liveCellMpnBindings(),
  stm32: {
    part: stm32PinAllocation.part,
    package: stm32PinAllocation.package,
    selectedAcquisition: structuredClone(stm32PinAllocation.selectedAcquisition),
    plannedSevenChannelReplication: structuredClone(stm32PinAllocation.plannedSevenChannelReplication)
  }
})

export const benchPrototypeSevenChannelAnalog = deepFreeze({
  workUnit: "BP-103",
  decision: "replicate-seven-explicit-protected-cells-with-one-ads8881-daisy-chain",
  channels,
  channelOrder: conductorNames,
  cellIdentity,
  cellMpnBindings: expectedCellMpnBindings,
  serialization: {
    mode: "ADS8881 daisy-chain without busy indicator",
    source: "TI ADS8881 SBAS547D Rev D sections 10.4.2 and 10.4.2.1",
    primaryUrl: "https://www.ti.com/lit/ds/symlink/ads8881.pdf",
    stm32Pins: {
      convst: { pad: "PA4", pin: 18, peripheral: "TIM3_CH2" },
      sclk: { pad: "PA5", pin: 19, peripheral: "SPI1_SCK" },
      dout: { pad: "PA6", pin: 20, peripheral: "SPI1_MISO" }
    },
    sharedConvst: "STM32 PA4 pin 18 TIM3_CH2 -> every U_SAR_n.CONVST",
    sharedSclk: "STM32 PA5 pin 19 SPI1_SCK -> every U_SAR_n.SCLK",
    nets: {
      convst: "SAR_CONVST_ALL",
      sclk: "SAR_SCLK_ALL",
      dinGround: "SAR1_DIN_GROUND",
      adc1To2: "SAR_CHAIN_1_TO_2",
      adc2To3: "SAR_CHAIN_2_TO_3",
      adc3To4: "SAR_CHAIN_3_TO_4",
      adc4To5: "SAR_CHAIN_4_TO_5",
      adc5To6: "SAR_CHAIN_5_TO_6",
      adc6To7: "SAR_CHAIN_6_TO_7",
      adc7ToStm32: "SAR_DOUT_TO_STM"
    },
    connections: [
      { net: "SAR1_DIN_GROUND", from: "SCORING_SGND", to: "U_SAR_1.DIN" },
      { net: "SAR_CHAIN_1_TO_2", from: "U_SAR_1.DOUT", to: "U_SAR_2.DIN" },
      { net: "SAR_CHAIN_2_TO_3", from: "U_SAR_2.DOUT", to: "U_SAR_3.DIN" },
      { net: "SAR_CHAIN_3_TO_4", from: "U_SAR_3.DOUT", to: "U_SAR_4.DIN" },
      { net: "SAR_CHAIN_4_TO_5", from: "U_SAR_4.DOUT", to: "U_SAR_5.DIN" },
      { net: "SAR_CHAIN_5_TO_6", from: "U_SAR_5.DOUT", to: "U_SAR_6.DIN" },
      { net: "SAR_CHAIN_6_TO_7", from: "U_SAR_6.DOUT", to: "U_SAR_7.DIN" },
      { net: "SAR_DOUT_TO_STM", from: "U_SAR_7.DOUT", to: "STM32 PA6 pin 20 SPI1_MISO" }
    ],
    hostWordOrder: [
      "PISTE",
      "RIGHT_WEAPON_C",
      "RIGHT_WEAPON_B",
      "RIGHT_WEAPON_A",
      "LEFT_WEAPON_C",
      "LEFT_WEAPON_B",
      "LEFT_WEAPON_A"
    ],
    hostWords: [
      { bitRange: "17:0", channel: "PISTE", hostWordIndex: 0, source: "U_SAR_7" },
      { bitRange: "35:18", channel: "RIGHT_WEAPON_C", hostWordIndex: 1, source: "U_SAR_6" },
      { bitRange: "53:36", channel: "RIGHT_WEAPON_B", hostWordIndex: 2, source: "U_SAR_5" },
      { bitRange: "71:54", channel: "RIGHT_WEAPON_A", hostWordIndex: 3, source: "U_SAR_4" },
      { bitRange: "89:72", channel: "LEFT_WEAPON_C", hostWordIndex: 4, source: "U_SAR_3" },
      { bitRange: "107:90", channel: "LEFT_WEAPON_B", hostWordIndex: 5, source: "U_SAR_2" },
      { bitRange: "125:108", channel: "LEFT_WEAPON_A", hostWordIndex: 6, source: "U_SAR_1" }
    ],
    dataFormat: "seven consecutive 18-bit MSB-first words; no busy indicator bit",
    convstRule: "SCLK low at CONVST rising edge; CONVST remains high until all 126 data bits are read",
    targetSclkHz: 20_000_000,
    maximumAllowedSclkHzForSelectedEdgePolicy: 36_000_000,
    readoutAt20Mhz
  },
  sharedResources: {
    reviewedReplicationDecision:
      "reviewed: repeat each electrically independent analog cell seven times; share only rails, timing, and serial bus nets",
    perCell: {
      decision: "replicated-seven-times",
      identities: [
        "U_ESD, R_ESD, U_SOURCE_SWITCH, R_SOURCE, R_SOURCE_PD, U_OVP_BUFFER, R_SAR, C_SAR, U_SAR, U_REF, C_REF_IN, C_REF_REG, C_REF_REG_HF, R_REF_SAR, C_REF, R_FAULT_GUARD"
      ],
      referenceDecision:
        "one REF5025 and one ADS8881-local reservoir per cell; no shared reference regulator or ADC-local reservoir"
    },
    shared: {
      decision: "shared-with-review-required",
      resources: [
        "V5_ANALOG",
        "S5V_NEG",
        "SCORING_3V3",
        "SCORING_SGND",
        "SAR_CONVST_ALL",
        "SAR_SCLK_ALL",
        "SAR_DOUT_TO_STM"
      ]
    },
    sourceAndSinkEnableCount: 14,
    unusedTmuxChannels: "all unused TMUX1112 channels hard-disabled with selected inputs not left floating"
  },
  stm32EnablePadMap: enablePadMap,
  integrationGates: {
    sevenChannelRailPower: { decision: "DENY", measurement: "not-measured", state: "unavailable" },
    simultaneousCrosstalk: { decision: "DENY", measurement: "not-measured", state: "unavailable" },
    signalIntegrityAndTiming: { decision: "DENY", measurement: "not-measured", state: "unavailable" },
    parserAndWordOrder: { decision: "DENY", measurement: "not-measured", state: "unavailable" },
    allConductorSourceSinkInterlocks: { decision: "DENY", measurement: "not-measured", state: "unavailable" },
    schematic: { decision: "DENY", measurement: "not-measured", state: "unavailable" },
    footprintAndArtwork: { decision: "DENY", measurement: "not-measured", state: "unavailable" }
  },
  authority: {
    architectureAcceptanceOnly: true,
    schematicIntegrationAuthorized: false,
    fabricationAuthorized: false,
    scoringReady: false,
    releaseState: "deny"
  }
})

export function validateBenchPrototypeSevenChannelAnalog(value: unknown): true {
  validateBenchPrototypeAnalogTopology(benchPrototypeAnalogTopology)
  validateBenchPrototypeReferenceDrive(benchPrototypeReferenceDrive)
  validateBenchPrototypeFaultProtection(benchPrototypeFaultProtection)
  validateStm32PinAllocation(stm32PinAllocation)
  const liveUpstream = {
    analog: benchPrototypeAnalogTopology,
    fault: benchPrototypeFaultProtection,
    reference: benchPrototypeReferenceDrive,
    experimentMpnBindings: liveCellMpnBindings(),
    stm32: {
      part: stm32PinAllocation.part,
      package: stm32PinAllocation.package,
      selectedAcquisition: stm32PinAllocation.selectedAcquisition,
      plannedSevenChannelReplication: stm32PinAllocation.plannedSevenChannelReplication
    }
  }
  if (!hasExactDataGraph(liveUpstream, upstreamSnapshot)) {
    throw new RangeError("BP-103 upstream analog or STM32 evidence drifted")
  }
  if (!hasExactDataGraph(value, benchPrototypeSevenChannelAnalog)) {
    throw new RangeError("BP-103 contract does not exactly match the reviewed seven-channel architecture")
  }
  const conductors = benchPrototypeSevenChannelAnalog.channels.map((channel) => channel.conductor)
  const references = benchPrototypeSevenChannelAnalog.channels.flatMap((channel) => Object.values(channel.references))
  const liveEnablePads = benchPrototypeSevenChannelAnalog.stm32EnablePadMap.flatMap(({ source, sink }) => [
    stm32PinAllocation.pads.find(([pin]) => pin === source.pin),
    stm32PinAllocation.pads.find(([pin]) => pin === sink.pin)
  ])
  const expectedEnablePads = benchPrototypeSevenChannelAnalog.stm32EnablePadMap.flatMap(({ source, sink }) => [
    [source.pin, source.pad, source.net],
    [sink.pin, sink.pad, sink.net]
  ])
  if (
    new Set(conductors).size !== 7 ||
    new Set(references).size !== references.length ||
    !hasExactDataGraph(conductors, conductorNames) ||
    !hasExactDataGraph(benchPrototypeSevenChannelAnalog.cellMpnBindings, expectedCellMpnBindings) ||
    !hasExactDataGraph(liveCellMpnBindings(), expectedCellMpnBindings) ||
    !readoutAt20Mhz.underTenMicroseconds ||
    readoutAt20Mhz.clockEdges !== 126 ||
    benchPrototypeSevenChannelAnalog.serialization.hostWordOrder[0] !== "PISTE" ||
    benchPrototypeSevenChannelAnalog.serialization.hostWordOrder[6] !== "LEFT_WEAPON_A" ||
    !hasExactDataGraph(
      benchPrototypeSevenChannelAnalog.serialization.hostWords.map(({ channel }) => channel),
      benchPrototypeSevenChannelAnalog.serialization.hostWordOrder
    ) ||
    !hasExactDataGraph(
      benchPrototypeSevenChannelAnalog.serialization.hostWords.map(({ source }) => source),
      ["U_SAR_7", "U_SAR_6", "U_SAR_5", "U_SAR_4", "U_SAR_3", "U_SAR_2", "U_SAR_1"]
    ) ||
    !hasExactDataGraph(
      benchPrototypeSevenChannelAnalog.serialization.stm32Pins.convst,
      stm32PinAllocation.plannedSevenChannelReplication.sharedConvst
    ) ||
    !hasExactDataGraph(
      benchPrototypeSevenChannelAnalog.serialization.stm32Pins.sclk,
      stm32PinAllocation.plannedSevenChannelReplication.sharedSclk
    ) ||
    !hasExactDataGraph(
      benchPrototypeSevenChannelAnalog.serialization.stm32Pins.dout,
      (({ source: _source, ...endpoint }) => endpoint)(stm32PinAllocation.plannedSevenChannelReplication.serialData)
    ) ||
    !hasExactDataGraph(liveEnablePads, expectedEnablePads) ||
    benchPrototypeSevenChannelAnalog.serialization.connections.length !== 8 ||
    new Set(benchPrototypeSevenChannelAnalog.serialization.connections.map(({ net }) => net)).size !== 8
  ) {
    throw new RangeError("BP-103 channel identity, references, or serialization order is invalid")
  }
  if (
    Object.values(benchPrototypeSevenChannelAnalog.integrationGates).some(
      (gate) => gate.state !== "unavailable" || gate.measurement !== "not-measured" || gate.decision !== "DENY"
    ) ||
    benchPrototypeSevenChannelAnalog.authority.schematicIntegrationAuthorized ||
    benchPrototypeSevenChannelAnalog.authority.fabricationAuthorized ||
    benchPrototypeSevenChannelAnalog.authority.scoringReady ||
    benchPrototypeSevenChannelAnalog.authority.releaseState !== "deny"
  ) {
    throw new RangeError("BP-103 cannot grant integration, fabrication, or scoring authority")
  }
  return true
}

validateBenchPrototypeSevenChannelAnalog(benchPrototypeSevenChannelAnalog)
