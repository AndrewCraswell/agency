import { describe, expect, it } from "vitest"
import { stm32PinAllocation, validateStm32PinAllocation } from "./stm32-pin-allocation.js"

const expectedDs12288Lqfp64Map = [
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

describe("BP-120 STM32G474RET3TR allocation", () => {
  it("accounts for each LQFP64 pad once and pins the one-channel SAR interface", () => {
    expect(stm32PinAllocation.pads).toHaveLength(64)
    expect(stm32PinAllocation.pads.map(([pin, pad]) => [pin, pad])).toEqual(expectedDs12288Lqfp64Map)
    expect(stm32PinAllocation.pads.slice(21, 32).map(([pin, pad]) => [pin, pad])).toEqual([
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
      [32, "VDD"]
    ])
    expect(stm32PinAllocation.pads.find(([pin]) => pin === 18)).toEqual([18, "PA4", "SAR0_CONVST_TIM3_CH2"])
    expect(stm32PinAllocation.pads.find(([pin]) => pin === 19)).toEqual([19, "PA5", "SAR0_SCLK_SPI1_SCK"])
    expect(stm32PinAllocation.pads.find(([pin]) => pin === 20)).toEqual([20, "PA6", "SAR0_DOUT_SPI1_MISO"])
    expect(validateStm32PinAllocation(stm32PinAllocation)).toBe(true)
  })

  it("ties VBAT to scoring 3V3 when no backup supply is allocated", () => {
    expect(stm32PinAllocation.pads[0]).toEqual([1, "VBAT", "SCORING_3V3_NO_BACKUP_TIE"])
    expect(stm32PinAllocation.backupDomain).toContain("no backup supply")
  })

  it("uses the BP-121 isolated SPI net names", () => {
    expect(stm32PinAllocation.isolatedSpi.nets.map(([net]) => net)).toEqual([
      "SCORE_CS_N",
      "SCORE_SCK",
      "SCORE_MISO",
      "SCORE_MOSI"
    ])
  })

  it("binds BP-103 to one shared-strobe ADS8881 daisy chain without granting release", () => {
    expect(stm32PinAllocation.plannedSevenChannelReplication).toMatchObject({
      owner: "BP-103",
      state: "architecture-selected-integration-denied",
      targetSclkHz: 20_000_000,
      sharedConvst: { pad: "PA4", pin: 18, peripheral: "TIM3_CH2" },
      sharedSclk: { pad: "PA5", pin: 19, peripheral: "SPI1_SCK" },
      serialData: { pad: "PA6", pin: 20, peripheral: "SPI1_MISO", source: "U_SAR_7.DOUT" }
    })
    expect(stm32PinAllocation.plannedSevenChannelReplication.chainRule).toContain("each DOUT feeds the next DIN")
    expect(stm32PinAllocation.authority.releaseState).toBe("deny")
  })

  it("rejects mutation or an incomplete package map", () => {
    expect(() => validateStm32PinAllocation({ ...stm32PinAllocation, package: "LQFP48" })).toThrow(RangeError)
    expect(() => validateStm32PinAllocation({ ...stm32PinAllocation, pads: stm32PinAllocation.pads.slice(1) })).toThrow(
      RangeError
    )
  })
})
