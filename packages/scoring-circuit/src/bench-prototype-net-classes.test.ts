import { describe, expect, it } from "vitest"
import { benchPrototypeNetClasses, validateBenchPrototypeNetClasses } from "./bench-prototype-net-classes.js"

describe("BP-040 ESP32-only net classes", () => {
  it("uses one ground system with a controlled quiet analog return", () => {
    expect(validateBenchPrototypeNetClasses(benchPrototypeNetClasses)).toBe(true)
    expect(benchPrototypeNetClasses.groundPlan).toMatchObject({
      digitalGround: "APP_GND",
      quietAnalogReturn: "SCORING_SGND",
      galvanicIsolation: false
    })
    expect(benchPrototypeNetClasses.retiredIsolation).toMatchObject({ enabled: false })
  })

  it("retains USB and Ethernet pair constraints and USB-C-only power", () => {
    expect(benchPrototypeNetClasses.differentialPairs).toEqual([
      expect.objectContaining({ id: "USB2_DIFF", targetImpedanceOhms: 90 }),
      expect.objectContaining({ id: "ETHERNET_DIFF", targetImpedanceOhms: 100 })
    ])
    expect(benchPrototypeNetClasses.powerRouting).toMatchObject({
      normalInput: "USB-C PD only",
      alternateInputPopulated: false,
      selectorPopulated: false
    })
  })

  it.each([
    ["isolation", (copy: typeof benchPrototypeNetClasses) => Reflect.set(copy.groundPlan, "galvanicIsolation", true)],
    [
      "alternate input",
      (copy: typeof benchPrototypeNetClasses) => Reflect.set(copy.powerRouting, "alternateInputPopulated", true)
    ],
    ["release", (copy: typeof benchPrototypeNetClasses) => Reflect.set(copy, "fabricationRelease", true)]
  ])("rejects changed %s", (_name, mutate) => {
    const copy = structuredClone(benchPrototypeNetClasses)
    mutate(copy)
    expect(() => validateBenchPrototypeNetClasses(copy)).toThrow(RangeError)
  })

  it("rejects malformed and aliased graphs", () => {
    expect(() => validateBenchPrototypeNetClasses(null)).toThrow(RangeError)
    const alias = structuredClone(benchPrototypeNetClasses)
    Reflect.set(alias.netClasses, "1", alias.netClasses[0])
    expect(() => validateBenchPrototypeNetClasses(alias)).toThrow(RangeError)
  })
})
