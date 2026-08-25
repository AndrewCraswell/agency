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
