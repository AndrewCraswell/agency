import { describe, expect, it } from "vitest"
import { benchPrototypeP0Power, validateBenchPrototypeP0Power } from "./bench-prototype-p0-power.js"

describe("BP-050 simplified P0 power", () => {
  it("uses one protected USB-C PD input and no selector", () => {
    expect(validateBenchPrototypeP0Power(benchPrototypeP0Power)).toBe(true)
    expect(benchPrototypeP0Power.normalInput).toMatchObject({
      interface: "USB-C PD",
      voltageV: 20,
      currentA: 3,
      powerW: 60,
      populatedInputCount: 1,
      alternateInput: "DNP",
      sourceSelector: "DNP"
    })
    expect(benchPrototypeP0Power.chain.map((part) => part.mpn)).toEqual([
      "10177070-00011LF",
      "TPD4S201TRGRRQ1",
      "TPD2EUSB30DRTR",
      "TVS2200DRVR",
      "B340A-13-F",
      "TPS25730ADREFR",
      "TPS259474ARPWR",
      "TPS56A37RPAR"
    ])
  })

  it("retains the exact 5 V stage and protected display branch", () => {
    expect(benchPrototypeP0Power.v5Stage).toMatchObject({
      regulatorMpn: "TPS56A37RPAR",
      inductor: { mpn: "744325330", inductanceUh: 3.3 },
      outputVoltageV: 5,
      continuousRatingA: 10
    })
    expect(benchPrototypeP0Power.branches.display).toMatchObject({
      limiterMpn: "TPS259474ARPWR",
      limitResistorOhms: 698,
      fuseMpn: "045106.3MRL",
      disconnect: "J_DISPLAY_DISCONNECT"
    })
    expect(benchPrototypeP0Power.v5Stage.supportParts.map((part) => part.reference)).toEqual([
      "L_V5_BUCK",
      "C_V5_BUCK_IN_A",
      "C_V5_BUCK_IN_B",
      "C_V5_BUCK_IN_HF",
      "C_V5_BUCK_BOOT",
      "C_V5_BUCK_OUT_A",
      "C_V5_BUCK_OUT_B",
      "R_V5_BUCK_MODE",
      "R_V5_BUCK_FB_TOP",
      "R_V5_BUCK_FB_BOTTOM",
      "R_V5_BUCK_FF",
      "C_V5_BUCK_FF"
    ])
    expect(benchPrototypeP0Power.v5Stage.intentionallyUnpopulated).toEqual([
      "R_V5_BUCK_EN_UP",
      "R_V5_BUCK_EN_DOWN",
      "C_V5_BUCK_SS",
      "R_V5_BUCK_PG_PULLUP",
      "TP_V5_BUCK_PG"
    ])
  })

  it("freezes the USB-PD support values and matched native-USB pair", () => {
    expect(benchPrototypeP0Power.upstreamSupport.pdStraps).toEqual([
      expect.objectContaining({ reference: "R_USB_PD_ADCIN1_UP", mpn: "RC0402FR-0724K9L", valueOhms: 24_900 }),
      expect.objectContaining({ reference: "R_USB_PD_ADCIN1_DOWN", mpn: "RC0402FR-0710KL", valueOhms: 10_000 }),
      expect.objectContaining({ reference: "R_USB_PD_ADCIN2_UP", mpn: "RC0402FR-0710KL", valueOhms: 10_000 }),
      expect.objectContaining({ reference: "R_USB_PD_ADCIN2_DOWN", mpn: "RC0402FR-0768K1L", valueOhms: 68_100 }),
      expect.objectContaining({ reference: "R_USB_PD_ADCIN3_UP", mpn: "RC0402FR-07162KL", valueOhms: 162_000 }),
      expect.objectContaining({ reference: "R_USB_PD_ADCIN3_DOWN", mpn: "RC0402FR-0738K3L", valueOhms: 38_300 }),
      expect.objectContaining({ reference: "R_USB_PD_ADCIN4_UP", mpn: "RC0402FR-07191KL", valueOhms: 191_000 }),
      expect.objectContaining({ reference: "R_USB_PD_ADCIN4_DOWN", mpn: "RC0402FR-079K53L", valueOhms: 9_530 }),
      expect.objectContaining({ reference: "R_USB_PD_PD5VMAX", mpn: "RC0402FR-0710KL", valueOhms: 10_000 }),
      expect.objectContaining({ reference: "R_USB_PD_RESERVED_26", mpn: "RC0402FR-0710KL", valueOhms: 10_000 }),
      expect.objectContaining({ reference: "R_USB_PD_RESERVED_36", mpn: "RC0402FR-0710KL", valueOhms: 10_000 })
    ])
    expect(benchPrototypeP0Power.upstreamSupport.pdSupportCapacitors).toEqual([
      expect.objectContaining({ reference: "C_USB_PORT_PROTECT_BIAS", mpn: "GCM188R71H104KA57D", value: "100 nF" }),
      expect.objectContaining({ reference: "C_USB_PORT_PROTECT_VPWR", mpn: "GCM188R71H105KA64D", value: "1 uF" }),
      expect.objectContaining({ reference: "C_USB_PD_LDO_1V5", mpn: "GRM21BR71A106KA73K", value: "10 uF" }),
      expect.objectContaining({ reference: "C_USB_PD_VIN_3V3", mpn: "GRM21BR71A106KA73K", value: "10 uF" }),
      expect.objectContaining({ reference: "C_USB_PD_VBUS", mpn: "GRM21BR71H475KA73L", value: "4.7 uF" }),
      expect.objectContaining({ reference: "C_USB_PD_CC1", mpn: "GCM1555C1H331JA16D", value: "330 pF" }),
      expect.objectContaining({ reference: "C_USB_PD_CC2", mpn: "GCM1555C1H331JA16D", value: "330 pF" })
    ])
    expect(benchPrototypeP0Power.upstreamSupport.usbSeriesPair).toEqual([
      expect.objectContaining({ reference: "R_USB_DN_SERIES", mpn: "RC0402FR-0722RL", valueOhms: 22 }),
      expect.objectContaining({ reference: "R_USB_DP_SERIES", mpn: "RC0402FR-0722RL", valueOhms: 22 })
    ])
    expect(benchPrototypeP0Power.upstreamSupport.efuseSupport).toEqual([
      expect.objectContaining({ reference: "C_EFUSE_IN", mpn: "GCM188R71H104KA57D" }),
      expect.objectContaining({ reference: "R_EFUSE_UVLO_UP", mpn: "RC0603FR-07475KL" }),
      expect.objectContaining({ reference: "R_EFUSE_UVLO_DOWN", mpn: "RC0603FR-0738K3L" }),
      expect.objectContaining({ reference: "R_EFUSE_OVLO_UP", mpn: "RC0603FR-07499KL" }),
      expect.objectContaining({ reference: "R_EFUSE_OVLO_DOWN", mpn: "RC0603FR-0728K7L" }),
      expect.objectContaining({ reference: "R_EFUSE_ILM", mpn: "RC0603FR-071K24L" }),
      expect.objectContaining({ reference: "C_EFUSE_ITIMER", mpn: "C0603C222K5RACTU" }),
      expect.objectContaining({ reference: "C_EFUSE_DVDT", mpn: "C0603C222K5RACTU" })
    ])
  })

  it("keeps the AFE load, VBUS clamp, physical power, and FIE gates open", () => {
    expect(benchPrototypeP0Power.currentEvidence).toMatchObject({
      result: "provisional-pass-excluding-afe",
      knownTwentyVoltPeakA: 1.52,
      minimumEfuseHeadroomAAtKnownPeak: 0.87
    })
    expect(benchPrototypeP0Power.authority).toMatchObject({
      completeRailBudgetPassed: false,
      clampQualified: false,
      physicalPowerEvidencePassed: false,
      fabricationAuthorized: false
    })
  })

  it.each([
    ["second input", (copy: typeof benchPrototypeP0Power) => Reflect.set(copy.normalInput, "populatedInputCount", 2)],
    ["selector", (copy: typeof benchPrototypeP0Power) => Reflect.set(copy.diagnosticAccess, "populatedSelector", true)],
    ["clamp pass", (copy: typeof benchPrototypeP0Power) => Reflect.set(copy.authority, "clampQualified", true)],
    ["release", (copy: typeof benchPrototypeP0Power) => Reflect.set(copy.authority, "fabricationAuthorized", true)]
  ])("rejects changed %s", (_name, mutate) => {
    const copy = structuredClone(benchPrototypeP0Power)
    mutate(copy)
    expect(() => validateBenchPrototypeP0Power(copy)).toThrow(RangeError)
  })
})
