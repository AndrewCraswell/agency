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
import { stm32PinAllocation, validateStm32PinAllocation } from "./stm32-pin-allocation.js"

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
    if (
      !Array.isArray(actual) ||
      Object.getPrototypeOf(actual) !== Array.prototype ||
      actual.length !== expected.length
    )
      return false
    const keys = Reflect.ownKeys(actual)
    if (keys.some((key) => typeof key === "symbol" || (key !== "length" && !/^(0|[1-9]\d*)$/u.test(key)))) return false
    return expected.every((entry, index) => hasExactDataGraph(actual[index], entry, seen))
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
    const descriptor = Object.getOwnPropertyDescriptor(actual, key)
    return Boolean(descriptor && "value" in descriptor && hasExactDataGraph(descriptor.value, expected[key], seen))
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
    controls: enablePadMap[index]!,
    exactPath: [
      `${conductor} -> U_ESD_${number} shunt on SCORING_SGND`,
      `${conductor} -> R_ESD_${number} 22 ohm -> U_SOURCE_SWITCH_${number}.QUIET`,
      `U_SOURCE_SWITCH_${number}.QUIET -> U_OVP_BUFFER_${number} unity input`,
      `U_OVP_BUFFER_${number}.OUT -> R_SAR_${number} 20 ohm -> U_SAR_${number}.AINP with C_SAR_${number} C0603C102J5GACTU 1 nF from AINP to SCORING_SGND`,
      `U_SAR_${number}.AINN -> SCORING_SGND`,
      `S5V_ISOLATED -> U_REF_${number}.IN with C_REF_IN_${number} 1 uF to SCORING_SGND`,
      `U_REF_${number}.OUT -> C_REF_REG_${number} 10 uF and C_REF_REG_HF_${number} 100 nF regulator-local loop to SCORING_SGND`,
      `U_REF_${number}.OUT -> R_REF_SAR_${number} 0.22 ohm -> U_SAR_${number}.REF with C_REF_${number} 10 uF to SCORING_SGND`
    ]
  }
})

export function calculateSevenChannelReadout(input: { sclkHz: number }) {
  if (!isPlainRecord(input) || Reflect.ownKeys(input).length !== 1 || !Number.isFinite(input.sclkHz)) {
    throw new RangeError("BP-103 readout input must contain only one finite sclkHz value")
  }
  if (input.sclkHz <= 0 || input.sclkHz > 36_000_000) {
    throw new RangeError("BP-103 uses the ADS8881 <=36 MHz slow-read edge allowance")
  }
  const channelCount = 7
  const bitsPerChannel = 18
  const clockEdges = channelCount * bitsPerChannel
  const maximumConversionSeconds = 710e-9
  const shiftSeconds = clockEdges / input.sclkHz
  const completeSetSeconds = maximumConversionSeconds + shiftSeconds
  return {
    bitsPerChannel,
    channelCount,
    clockEdges,
    completeSetSeconds,
    completeSetMicroseconds: completeSetSeconds * 1e6,
    maximumConversionSeconds,
    sclkHz: input.sclkHz,
    shiftSeconds,
    underTenMicroseconds: completeSetSeconds <= 10e-6
  }
}

const readoutAt20Mhz = calculateSevenChannelReadout({ sclkHz: 20_000_000 })

const upstreamSnapshot = deepFreeze({
  analog: structuredClone(benchPrototypeAnalogTopology),
  fault: structuredClone(benchPrototypeFaultProtection),
  reference: structuredClone(benchPrototypeReferenceDrive),
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
  cellIdentity: {
    adc: "ADS8881IDGS",
    buffer: "ADA4177-1BRZ",
    esd: "TPD4E05U06DQAR",
    normalSeries: "CRCW060322R0FKEAHP",
    sarSeries: "CRCW060320R0FKEAHP",
    sarCapacitor: "C0603C102J5GACTU",
    switch: "TMUX1112PWR",
    guard: "CRCW120656K0FKEAHP",
    localReferenceReservoir: "GRM21BR71A106KE51L",
    localReferenceFeed: "RCWE0603R220FKEA",
    reference: "REF5025AQDRQ1",
    referenceInputBypass: "GRM188R71A105KA12D",
    referenceRegulatorOutput: "T521B106M025ATE100",
    referenceRegulatorHighFrequency: "C0603C104K3RACTU"
  },
  serialization: {
    mode: "ADS8881 daisy-chain without busy indicator",
    source: "TI ADS8881 SBAS547D Rev D sections 10.4.2 and 10.4.2.1",
    primaryUrl: "https://www.ti.com/lit/ds/symlink/ads8881.pdf",
    sharedConvst: "STM32 PA4/TIM3_CH2 -> every U_SAR_n.CONVST",
    sharedSclk: "STM32 PA5/SPI1_SCK -> every U_SAR_n.SCLK",
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
    dataFormat: "seven consecutive 18-bit MSB-first words; no busy indicator bit",
    convstRule: "SCLK low at CONVST rising edge; CONVST remains high until all 126 data bits are read",
    targetSclkHz: 20_000_000,
    maximumAllowedSclkHzForSelectedEdgePolicy: 36_000_000,
    readoutAt20Mhz
  },
  sharedResources: {
    supplies: ["S5V_ISOLATED", "S5V_NEG", "SCORING_3V3", "SCORING_SGND"],
    perChannelReferenceAndReservoir: true,
    perChannelProtectionSwitchBufferAndAdc: true,
    sourceAndSinkEnableCount: 14,
    unusedTmuxChannels: "all unused TMUX1112 channels hard-disabled with selected inputs not left floating"
  },
  stm32EnablePadMap: enablePadMap,
  requiredEvidence: {
    exactSchematicIntegrated: false,
    allSevenReferenceLoopsLaidOutAndReviewed: false,
    isolatedRailWorstCasePowerClosed: false,
    daisyChainSignalIntegrityAndWordOrderBenchVerified: false,
    simultaneousChannelCrosstalkMeasured: false,
    sourceSinkInterlocksVerifiedAllChannels: false,
    timingAndFirmwareParserVerified: false,
    footprintAndArtworkReviewed: false
  },
  authority: {
    selectedArchitecture: true,
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
    !readoutAt20Mhz.underTenMicroseconds ||
    readoutAt20Mhz.clockEdges !== 126 ||
    benchPrototypeSevenChannelAnalog.serialization.hostWordOrder[0] !== "PISTE" ||
    benchPrototypeSevenChannelAnalog.serialization.hostWordOrder[6] !== "LEFT_WEAPON_A" ||
    !hasExactDataGraph(liveEnablePads, expectedEnablePads) ||
    benchPrototypeSevenChannelAnalog.serialization.connections.length !== 8 ||
    new Set(benchPrototypeSevenChannelAnalog.serialization.connections.map(({ net }) => net)).size !== 8
  ) {
    throw new RangeError("BP-103 channel identity, references, or serialization order is invalid")
  }
  if (
    Object.values(benchPrototypeSevenChannelAnalog.requiredEvidence).some(Boolean) ||
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
