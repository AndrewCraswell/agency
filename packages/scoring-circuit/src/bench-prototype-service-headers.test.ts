import { describe, expect, it } from "vitest"
import {
  benchPrototypeServiceHeaders,
  validateBenchPrototypeServiceHeaders
} from "./bench-prototype-service-headers.js"

describe("BP-124 ESP32-only service access", () => {
  it("uses native USB and six labeled recovery pads without a populated header", () => {
    expect(validateBenchPrototypeServiceHeaders(benchPrototypeServiceHeaders)).toBe(true)
    expect(benchPrototypeServiceHeaders.populatedHeader).toBe(false)
    expect(benchPrototypeServiceHeaders.recoveryPads.map((pad) => pad.net)).toEqual([
      "UART0_TX",
      "UART0_RX",
      "BOOT_N",
      "EN_RESET",
      "APP_3V3",
      "APP_GND"
    ])
    expect(benchPrototypeServiceHeaders.removedFromP0).toMatchObject({
      stm32Header: { disposition: "DNP" },
      esp32Header: { disposition: "DNP" }
    })
  })

  it.each([
    ["header", (copy: typeof benchPrototypeServiceHeaders) => Reflect.set(copy, "populatedHeader", true)],
    ["boot pad", (copy: typeof benchPrototypeServiceHeaders) => Reflect.set(copy.recoveryPads[2], "net", "WRONG")],
    [
      "back-power",
      (copy: typeof benchPrototypeServiceHeaders) => Reflect.set(copy.electricalRules, "adapterMayPowerTarget", true)
    ],
    [
      "release",
      (copy: typeof benchPrototypeServiceHeaders) => Reflect.set(copy.authority, "fabricationAuthorized", true)
    ]
  ])("rejects changed %s", (_name, mutate) => {
    const copy = structuredClone(benchPrototypeServiceHeaders)
    mutate(copy)
    expect(() => validateBenchPrototypeServiceHeaders(copy)).toThrow(RangeError)
  })

  it("rejects malformed and aliased graphs", () => {
    expect(() => validateBenchPrototypeServiceHeaders(null)).toThrow(RangeError)
    const alias = structuredClone(benchPrototypeServiceHeaders)
    Reflect.set(alias.recoveryPads, "1", alias.recoveryPads[0])
    expect(() => validateBenchPrototypeServiceHeaders(alias)).toThrow(RangeError)
  })
})
