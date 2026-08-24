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
    expect(references).toHaveLength(98)
    expect(new Set(references).size).toBe(98)
    for (const [index, channel] of benchPrototypeSevenChannelAnalog.channels.entries()) {
      expect(channel.chainIndex).toBe(index + 1)
      expect(channel.exactPath).toHaveLength(8)
      expect(channel.references.adc).toBe(`U_SAR_${index + 1}`)
      expect(channel.references.guard).toBe(`R_FAULT_GUARD_${index + 1}`)
      expect(channel.exactPath.join(" ")).toContain(`C_SAR_${index + 1} C0603C102J5GACTU 1 nF`)
      expect(channel.exactPath.join(" ")).toContain(`C_REF_IN_${index + 1} 1 uF`)
      expect(channel.exactPath.join(" ")).toContain(`C_REF_REG_${index + 1} 10 uF`)
    }
  })

  it("defines the exact seven-device daisy chain and reverse host word order", () => {
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
  })

  it("keeps power, crosstalk, layout, firmware, and fabrication authority denied", () => {
    expect(Object.values(benchPrototypeSevenChannelAnalog.requiredEvidence)).toEqual(Array(8).fill(false))
    expect(benchPrototypeSevenChannelAnalog.authority).toEqual({
      selectedArchitecture: true,
      schematicIntegrationAuthorized: false,
      fabricationAuthorized: false,
      scoringReady: false,
      releaseState: "deny"
    })
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
})
