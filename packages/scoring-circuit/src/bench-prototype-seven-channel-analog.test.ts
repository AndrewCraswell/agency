import { describe, expect, it } from "vitest"
import {
  benchPrototypeSevenChannelAnalog,
  calculateSevenChannelReadout,
  validateBenchPrototypeSevenChannelAnalog
} from "./bench-prototype-seven-channel-analog.js"

describe("BP-103 seven-channel analog replication", () => {
  it("names every conductor and every physical cell explicitly", () => {
    expect(benchPrototypeSevenChannelAnalog.channels.map(({ conductor }) => conductor)).toEqual([
      "LEFT_WEAPON_A",
      "LEFT_WEAPON_B",
      "LEFT_WEAPON_C",
      "RIGHT_WEAPON_A",
      "RIGHT_WEAPON_B",
      "RIGHT_WEAPON_C",
      "PISTE"
    ])
    const references = benchPrototypeSevenChannelAnalog.channels.flatMap(({ references: row }) => Object.values(row))
    expect(references).toHaveLength(112)
    expect(new Set(references).size).toBe(112)
    for (const [index, channel] of benchPrototypeSevenChannelAnalog.channels.entries()) {
      expect(channel.chainIndex).toBe(index + 1)
      expect(channel.exactPath).toHaveLength(8)
      expect(channel.references.adc).toBe(`U_SAR_${index + 1}`)
      expect(channel.references.guard).toBe(`R_FAULT_GUARD_${index + 1}`)
      expect(channel.references.source).toBe(`R_SOURCE_${index + 1}`)
      expect(channel.references.sourcePullDown).toBe(`R_SOURCE_PD_${index + 1}`)
      expect(channel.exactPath.join(" ")).toContain(`C_SAR_${index + 1} C0603C102J5GACTU 1 nF`)
      expect(channel.exactPath.join(" ")).toContain(`C_REF_IN_${index + 1} 1 uF`)
      expect(channel.exactPath.join(" ")).toContain(`C_REF_REG_${index + 1} 10 uF`)
      expect(channel.excitationPath).toEqual([
        `U_REF_${index + 1}.OUT REF5025AQDRQ1 -> R_SOURCE_${index + 1} ERA3AEB2491V 2.49 kohm -> U_SOURCE_SWITCH_${index + 1}.SOURCE_PATH -> ${channel.conductor}`,
        `${channel.controls.source.pad} pin ${channel.controls.source.pin} ${channel.controls.source.net} -> U_SOURCE_SWITCH_${index + 1}.SOURCE_EN`,
        `U_SOURCE_SWITCH_${index + 1}.SOURCE_EN -> R_SOURCE_PD_${index + 1} CRCW0603100KFKEAHP 100 kilohm -> SCORING_SGND`
      ])
      expect(channel.guardedForcePath).toBe(
        `externally interlocked normally-open guarded relay -> R_FAULT_GUARD_${index + 1} CRCW120656K0FKEAHP 56 kilohm 1 percent -> ${channel.conductor}; normal source and guarded force never enable together`
      )
      expect(channel.sinkEnableDisposition).toContain(`${channel.controls.sink.net} is allocated by BP-120`)
    }
  })

  it("defines every daisy-chain endpoint and the exact reverse host word mapping", () => {
    expect(benchPrototypeSevenChannelAnalog.serialization.connections).toEqual([
      { net: "SAR1_DIN_GROUND", from: "SCORING_SGND", to: "U_SAR_1.DIN" },
      { net: "SAR_CHAIN_1_TO_2", from: "U_SAR_1.DOUT", to: "U_SAR_2.DIN" },
      { net: "SAR_CHAIN_2_TO_3", from: "U_SAR_2.DOUT", to: "U_SAR_3.DIN" },
      { net: "SAR_CHAIN_3_TO_4", from: "U_SAR_3.DOUT", to: "U_SAR_4.DIN" },
      { net: "SAR_CHAIN_4_TO_5", from: "U_SAR_4.DOUT", to: "U_SAR_5.DIN" },
      { net: "SAR_CHAIN_5_TO_6", from: "U_SAR_5.DOUT", to: "U_SAR_6.DIN" },
      { net: "SAR_CHAIN_6_TO_7", from: "U_SAR_6.DOUT", to: "U_SAR_7.DIN" },
      { net: "SAR_DOUT_TO_STM", from: "U_SAR_7.DOUT", to: "STM32 PA6 pin 20 SPI1_MISO" }
    ])
    expect(benchPrototypeSevenChannelAnalog.serialization.hostWordOrder).toEqual([
      "PISTE",
      "RIGHT_WEAPON_C",
      "RIGHT_WEAPON_B",
      "RIGHT_WEAPON_A",
      "LEFT_WEAPON_C",
      "LEFT_WEAPON_B",
      "LEFT_WEAPON_A"
    ])
    expect(benchPrototypeSevenChannelAnalog.serialization.hostWords).toEqual([
      { bitRange: "17:0", channel: "PISTE", hostWordIndex: 0, source: "U_SAR_7" },
      { bitRange: "35:18", channel: "RIGHT_WEAPON_C", hostWordIndex: 1, source: "U_SAR_6" },
      { bitRange: "53:36", channel: "RIGHT_WEAPON_B", hostWordIndex: 2, source: "U_SAR_5" },
      { bitRange: "71:54", channel: "RIGHT_WEAPON_A", hostWordIndex: 3, source: "U_SAR_4" },
      { bitRange: "89:72", channel: "LEFT_WEAPON_C", hostWordIndex: 4, source: "U_SAR_3" },
      { bitRange: "107:90", channel: "LEFT_WEAPON_B", hostWordIndex: 5, source: "U_SAR_2" },
      { bitRange: "125:108", channel: "LEFT_WEAPON_A", hostWordIndex: 6, source: "U_SAR_1" }
    ])
    expect(benchPrototypeSevenChannelAnalog.serialization.stm32Pins).toEqual({
      convst: { pad: "PA4", pin: 18, peripheral: "TIM3_CH2" },
      sclk: { pad: "PA5", pin: 19, peripheral: "SPI1_SCK" },
      dout: { pad: "PA6", pin: 20, peripheral: "SPI1_MISO" }
    })
  })

  it("binds every source and sink enable to the exact BP-120 pad", () => {
    expect(benchPrototypeSevenChannelAnalog.stm32EnablePadMap).toEqual([
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
    ])
  })

  it("fits one simultaneous seven-channel read below ten microseconds at 20 MHz", () => {
    expect(calculateSevenChannelReadout({ sclkHz: 20_000_000 })).toEqual({
      bitsPerChannel: 18,
      channelCount: 7,
      clockEdges: 126,
      completeSetSeconds: 0.000_007_01,
      completeSetMicroseconds: 7.01,
      maximumConversionSeconds: 7.1e-7,
      sclkHz: 20_000_000,
      shiftSeconds: 0.000_006_3,
      underTenMicroseconds: true
    })
    expect(() => calculateSevenChannelReadout({ sclkHz: 36_000_001 })).toThrow(RangeError)
    expect(() => calculateSevenChannelReadout({ sclkHz: 0 })).toThrow(RangeError)
    expect(() => calculateSevenChannelReadout({ sclkHz: Number.NaN })).toThrow(RangeError)
    expect(() => calculateSevenChannelReadout({ sclkHz: 20_000_000, extra: 1 } as never)).toThrow(RangeError)
    let sclkAccessorRead = false
    const accessorInput = {} as { sclkHz: number }
    Object.defineProperty(accessorInput, "sclkHz", {
      configurable: true,
      enumerable: true,
      get() {
        sclkAccessorRead = true
        throw new Error("untrusted accessor executed")
      }
    })
    expect(() => calculateSevenChannelReadout(accessorInput)).toThrow(RangeError)
    expect(sclkAccessorRead).toBe(false)
  })

  it("keeps every physical integration gate machine-readable, unavailable, and denied", () => {
    expect(benchPrototypeSevenChannelAnalog.integrationGates).toEqual({
      sevenChannelRailPower: { decision: "DENY", measurement: "not-measured", state: "unavailable" },
      simultaneousCrosstalk: { decision: "DENY", measurement: "not-measured", state: "unavailable" },
      signalIntegrityAndTiming: { decision: "DENY", measurement: "not-measured", state: "unavailable" },
      parserAndWordOrder: { decision: "DENY", measurement: "not-measured", state: "unavailable" },
      allConductorSourceSinkInterlocks: { decision: "DENY", measurement: "not-measured", state: "unavailable" },
      schematic: { decision: "DENY", measurement: "not-measured", state: "unavailable" },
      footprintAndArtwork: { decision: "DENY", measurement: "not-measured", state: "unavailable" }
    })
    expect(benchPrototypeSevenChannelAnalog.authority).toEqual({
      architectureAcceptanceOnly: true,
      schematicIntegrationAuthorized: false,
      fabricationAuthorized: false,
      scoringReady: false,
      releaseState: "deny"
    })
  })

  it("keeps reviewed per-cell references separate from the shared timing and rail resources", () => {
    expect(benchPrototypeSevenChannelAnalog.sharedResources).toEqual({
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
          "S5V_ISOLATED",
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
    })
    expect(benchPrototypeSevenChannelAnalog.cellMpnBindings).toEqual([
      ["U_ESD", "TPD4E05U06DQAR"],
      ["R_ESD", "CRCW060322R0FKEAHP"],
      ["U_SOURCE_SWITCH", "TMUX1112PWR"],
      ["R_SOURCE", "ERA3AEB2491V"],
      ["R_SOURCE_PD", "CRCW0603100KFKEAHP"],
      ["U_OVP_BUFFER", "ADA4177-1ARZ"],
      ["R_SAR", "CRCW060320R0FKEAHP"],
      ["C_SAR", "C0603C102J5GACTU"],
      ["U_SAR", "ADS8881IDGS"],
      ["U_REF", "REF5025AQDRQ1"],
      ["C_REF_IN", "CGA3E3X7R1H105K080AB"],
      ["C_REF_REG", "T521B106M025ATE100"],
      ["C_REF_REG_HF", "C0603C104K3RACTU"],
      ["R_REF_SAR", "RCWE0603R220FKEA"],
      ["C_REF", "GRM21BR71A106KE51L"],
      ["R_FAULT_GUARD", "CRCW120656K0FKEAHP"]
    ])
  })

  it("rejects substitutions, missing channels, aliases, and hidden data", () => {
    expect(validateBenchPrototypeSevenChannelAnalog(benchPrototypeSevenChannelAnalog)).toBe(true)
    const forged = structuredClone(benchPrototypeSevenChannelAnalog)
    forged.channels[2]!.conductor = "RIGHT_WEAPON_A"
    expect(() => validateBenchPrototypeSevenChannelAnalog(forged)).toThrow(RangeError)

    const missing = structuredClone(benchPrototypeSevenChannelAnalog)
    missing.channels.pop()
    expect(() => validateBenchPrototypeSevenChannelAnalog(missing)).toThrow(RangeError)

    const aliased = structuredClone(benchPrototypeSevenChannelAnalog)
    aliased.channels[1] = aliased.channels[0]!
    expect(() => validateBenchPrototypeSevenChannelAnalog(aliased)).toThrow(RangeError)

    const hidden = structuredClone(benchPrototypeSevenChannelAnalog)
    Object.defineProperty(hidden.channels[0]!, "forged", { value: true })
    expect(() => validateBenchPrototypeSevenChannelAnalog(hidden)).toThrow(RangeError)
  })

  it("rejects accessors, non-enumerable data, exotic arrays, sparse arrays, symbols, aliases, and cycles", () => {
    let accessorRead = false
    const getter = structuredClone(benchPrototypeSevenChannelAnalog)
    Object.defineProperty(getter.channels[0]!, "conductor", {
      configurable: true,
      enumerable: true,
      get() {
        accessorRead = true
        throw new Error("untrusted accessor executed")
      }
    })
    expect(() => validateBenchPrototypeSevenChannelAnalog(getter)).toThrow(RangeError)
    expect(accessorRead).toBe(false)

    let arrayAccessorRead = false
    const arrayGetter = structuredClone(benchPrototypeSevenChannelAnalog)
    Object.defineProperty(arrayGetter.channels, "0", {
      configurable: true,
      enumerable: true,
      get() {
        arrayAccessorRead = true
        throw new Error("untrusted array accessor executed")
      }
    })
    expect(() => validateBenchPrototypeSevenChannelAnalog(arrayGetter)).toThrow(RangeError)
    expect(arrayAccessorRead).toBe(false)

    const nonEnumerable = structuredClone(benchPrototypeSevenChannelAnalog)
    Object.defineProperty(nonEnumerable.channels[0]!, "conductor", {
      configurable: true,
      enumerable: false,
      value: "LEFT_WEAPON_A",
      writable: true
    })
    expect(() => validateBenchPrototypeSevenChannelAnalog(nonEnumerable)).toThrow(RangeError)

    const arraySubclass = structuredClone(benchPrototypeSevenChannelAnalog)
    class ChannelArray extends Array {}
    Object.setPrototypeOf(arraySubclass.channels, ChannelArray.prototype)
    expect(() => validateBenchPrototypeSevenChannelAnalog(arraySubclass)).toThrow(RangeError)

    const sparse = structuredClone(benchPrototypeSevenChannelAnalog)
    delete sparse.channels[1]
    expect(() => validateBenchPrototypeSevenChannelAnalog(sparse)).toThrow(RangeError)

    const symbolic = structuredClone(benchPrototypeSevenChannelAnalog)
    Object.defineProperty(symbolic, Symbol("forged"), { enumerable: true, value: true })
    expect(() => validateBenchPrototypeSevenChannelAnalog(symbolic)).toThrow(RangeError)

    const cyclic = structuredClone(benchPrototypeSevenChannelAnalog)
    Object.defineProperty(cyclic.channels[0]!.controls, "source", {
      configurable: true,
      enumerable: true,
      value: cyclic.channels[0]!.controls,
      writable: true
    })
    expect(() => validateBenchPrototypeSevenChannelAnalog(cyclic)).toThrow(RangeError)
  })
})
