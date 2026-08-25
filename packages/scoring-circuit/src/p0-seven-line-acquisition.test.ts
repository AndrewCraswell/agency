import { describe, expect, it } from "vitest"
import {
  calculateP0SevenLineReadout,
  p0SevenLineAcquisition,
  validateP0SevenLineAcquisition
} from "./p0-seven-line-acquisition.js"

describe("P0 ESP32-only seven-line acquisition", () => {
  it("conserves every retained and support-part quantity without an extra line", () => {
    expect(p0SevenLineAcquisition.channels.map(({ line }) => line)).toEqual([
      "LEFT_WEAPON_A",
      "LEFT_WEAPON_B",
      "LEFT_WEAPON_C",
      "RIGHT_WEAPON_A",
      "RIGHT_WEAPON_B",
      "RIGHT_WEAPON_C",
      "PISTE"
    ])
    expect(p0SevenLineAcquisition.candidateQuantities).toEqual([
      expect.objectContaining({ designatorPrefix: "U_REF", quantity: 7 }),
      expect.objectContaining({ designatorPrefix: "U_SOURCE_SWITCH", quantity: 2 }),
      expect.objectContaining({ designatorPrefix: "U_SOURCE_CONTROL", mpn: "SN74HCS595PWR", quantity: 1 }),
      expect.objectContaining({ designatorPrefix: "U_ESD", quantity: 2 }),
      expect.objectContaining({ designatorPrefix: "U_OVP_BUFFER", quantity: 7 }),
      expect.objectContaining({ designatorPrefix: "U_SAR", quantity: 7 }),
      expect.objectContaining({ designatorPrefix: "U_NEGATIVE_RAIL", quantity: 1 }),
      expect.objectContaining({ designatorPrefix: "R_ESD", quantity: 7 }),
      expect.objectContaining({ designatorPrefix: "R_SOURCE", quantity: 7 }),
      expect.objectContaining({ designatorPrefix: "R_SOURCE_PD", quantity: 7 }),
      expect.objectContaining({ designatorPrefix: "R_SAR", quantity: 7 }),
      expect.objectContaining({ designatorPrefix: "C_SAR", quantity: 7 }),
      expect.objectContaining({ designatorPrefix: "C_REF_IN", mpn: "CGA3E3X7R1H105K080AB", quantity: 7 }),
      expect.objectContaining({ designatorPrefix: "C_REF_REG", quantity: 7 }),
      expect.objectContaining({ designatorPrefix: "C_REF_REG_HF", quantity: 7 }),
      expect.objectContaining({ designatorPrefix: "R_REF_SAR", quantity: 7 }),
      expect.objectContaining({ designatorPrefix: "C_REF", quantity: 7 }),
      expect.objectContaining({ designatorPrefix: "C_BUFFER_POS", quantity: 7 }),
      expect.objectContaining({ designatorPrefix: "C_BUFFER_NEG", quantity: 7 }),
      expect.objectContaining({ designatorPrefix: "C_SAR_AVDD", quantity: 7 }),
      expect.objectContaining({ designatorPrefix: "C_SAR_DVDD", quantity: 7 }),
      expect.objectContaining({ designatorPrefix: "C_MUX", quantity: 2 }),
      expect.objectContaining({ designatorPrefix: "C_SOURCE_CONTROL", quantity: 1 }),
      expect.objectContaining({ designatorPrefix: "R_SOURCE_OE_PULLUP", quantity: 1 }),
      expect.objectContaining({ designatorPrefix: "C_NEG_IN", quantity: 1 }),
      expect.objectContaining({ designatorPrefix: "C_NEG_FLY", quantity: 1 }),
      expect.objectContaining({ designatorPrefix: "C_NEG_OUT", quantity: 1 })
    ])
    expect(p0SevenLineAcquisition.esdLaneAssignment.assigned.map(({ line }) => line)).toEqual(
      p0SevenLineAcquisition.channels.map(({ line }) => line)
    )
    expect(p0SevenLineAcquisition.esdLaneAssignment.unused).toEqual({
      lane: 4,
      protector: "U_ESD_2",
      disposition: "unused-no-connect",
      prohibition: "this lane may not become an unlisted input, connector path, test input, or acquisition channel"
    })
    expect(p0SevenLineAcquisition.channels).toHaveLength(7)
  })

  it("has no STM32 or isolation dependency and names the ESP32 timing interface", () => {
    expect(p0SevenLineAcquisition.controller).toMatchObject({
      host: "ESP32-S3",
      activeDependencies: { isolationHardware: false, stm32: false },
      requiredGpioRoles: { inputs: 1, outputs: 4 }
    })
    expect(p0SevenLineAcquisition.adcTiming.esp32Signals).toEqual([
      { direction: "output", gpio: 6, hostRole: "SAR_CONVST", net: "SAR_CONVST_ALL", requiredIdleLevel: "low" },
      { direction: "output", gpio: 4, hostRole: "SAR_SCLK", net: "SAR_SCLK_ALL", requiredIdleLevel: "low" },
      { direction: "input", gpio: 5, hostRole: "SAR_DOUT", net: "SAR_DOUT_TO_ESP32", source: "U_SAR_7.DOUT" }
    ])
    expect(p0SevenLineAcquisition.adcTiming.hostWordOrder).toEqual([
      "PISTE",
      "RIGHT_WEAPON_C",
      "RIGHT_WEAPON_B",
      "RIGHT_WEAPON_A",
      "LEFT_WEAPON_C",
      "LEFT_WEAPON_B",
      "LEFT_WEAPON_A"
    ])
    expect(p0SevenLineAcquisition.channels[0]!.sourcePath).toBe(
      "U_REF_1.VREF_2V5 -> R_SOURCE_1 2.49 kohm -> U_SOURCE_SWITCH_1.CH1 -> LEFT_WEAPON_A; U_SOURCE_CONTROL.Q0 drives the active-high switch select"
    )
    expect(p0SevenLineAcquisition.sourceControl).toMatchObject({
      register: "SN74HCS595PWR",
      sharedBus: { clock: "APP_SPI_SCK", data: "APP_SPI_MOSI" },
      latch: { gpio: 47, net: "SOURCE_LATCH" },
      reset: "APP_RESET_N drives active-low SRCLR",
      outputEnable: "SOURCE_OE_N on GPIO36 with a 100 kilohm pull-up; high disables every register output"
    })
    expect(p0SevenLineAcquisition.rails).toEqual({
      V5_ANALOG:
        "positive analog supply for U_REF_1 through U_REF_7, U_OVP_BUFFER_1 through U_OVP_BUFFER_7, and C_NEG_IN",
      VNEG_ANALOG:
        "TPS60400 output for U_OVP_BUFFER_1 through U_OVP_BUFFER_7 and C_BUFFER_NEG_1 through C_BUFFER_NEG_7",
      APP_3V3:
        "supply for U_SOURCE_SWITCH_1 through U_SOURCE_SWITCH_2, U_SOURCE_CONTROL, U_SAR_1 through U_SAR_7 AVDD/DVDD, and ESP32-S3 timing I/O",
      VREF_2V5:
        "seven separate REF5025 outputs; each U_REF_n drives only R_SOURCE_n, C_REF_REG_n, C_REF_REG_HF_n, and R_REF_SAR_n",
      SCORING_SGND:
        "return for every analog support capacitor, ADS8881 AINN, REF5025, TPS60400, and TPD4E05U06 ground pin"
    })
  })

  it("defines a complete 126-clock acquisition with fail-closed outcomes", () => {
    expect(calculateP0SevenLineReadout({ sclkHz: 20_000_000 })).toEqual({
      bitsPerChannel: 18,
      channelCount: 7,
      clockEdges: 126,
      completeSetMicroseconds: 7.01,
      completeSetSeconds: 0.000_007_01,
      maximumConversionSeconds: 7.1e-7,
      sclkHz: 20_000_000,
      shiftSeconds: 0.000_006_3,
      underTenMicroseconds: true
    })
    expect(() => calculateP0SevenLineReadout({ sclkHz: 36_000_001 })).toThrow(RangeError)
    expect(() => calculateP0SevenLineReadout({ sclkHz: 0 })).toThrow(RangeError)
    expect(() => calculateP0SevenLineReadout({ sclkHz: 20_000_000, extra: true } as never)).toThrow(RangeError)
    expect(p0SevenLineAcquisition.failureStates.map(({ state }) => state)).toEqual([
      "boot-safe",
      "analog-health-fault",
      "serial-transaction-fault",
      "interlock-fault",
      "fault-or-unpowered-exposure",
      "characterization-incomplete"
    ])
    expect(p0SevenLineAcquisition.authority).toEqual({
      architectureOnly: true,
      fabricationAuthorized: false,
      fieConformanceProven: false,
      scoringReady: false
    })
  })

  it("rejects a changed channel, dependency, or hidden data without accepting the change", () => {
    expect(validateP0SevenLineAcquisition(p0SevenLineAcquisition)).toBe(true)
    const changedLine = structuredClone(p0SevenLineAcquisition)
    changedLine.channels[0]!.line = "PISTE"
    expect(() => validateP0SevenLineAcquisition(changedLine)).toThrow(RangeError)

    const changedDependency = structuredClone(p0SevenLineAcquisition)
    Object.defineProperty(changedDependency.controller.activeDependencies, "stm32", {
      configurable: true,
      enumerable: true,
      value: true,
      writable: true
    })
    expect(() => validateP0SevenLineAcquisition(changedDependency)).toThrow(RangeError)

    const hidden = structuredClone(p0SevenLineAcquisition)
    Object.defineProperty(hidden, "forged", { value: true })
    expect(() => validateP0SevenLineAcquisition(hidden)).toThrow(RangeError)
  })
})
