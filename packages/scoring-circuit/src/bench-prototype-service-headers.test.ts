import { describe, expect, it } from "vitest"
import {
  benchPrototypeServiceHeaders,
  validateBenchPrototypeServiceHeaders
} from "./bench-prototype-service-headers.js"

describe("BP-124 STM32 SWD and ESP32 service headers", () => {
  it("validates the canonical fail-closed service contract", () => {
    expect(validateBenchPrototypeServiceHeaders(benchPrototypeServiceHeaders)).toBe(true)
  })

  it("freezes the exact headers, mating parts, and reconciled net order", () => {
    expect(benchPrototypeServiceHeaders.stm32).toMatchObject({
      reference: "J_STM_SWD",
      bomReference: "J_STM32_SWD"
    })
    expect(benchPrototypeServiceHeaders.stm32.header).toMatchObject({
      mpn: "FTSH-105-01-L-DV-007-K",
      positions: 10,
      pitchMm: 1.27
    })
    expect(benchPrototypeServiceHeaders.stm32.matingCable.mpn).toBe("FFSD-05-D-06.00-01-N")
    expect(benchPrototypeServiceHeaders.stm32.omittedPins).toEqual([7])
    expect(benchPrototypeServiceHeaders.stm32.pinout.map((pin) => pin.net)).toEqual([
      "SCORING_3V3_SENSE",
      "SWDIO",
      "SCORING_SGND",
      "SWCLK",
      "SCORING_SGND",
      "NC_SWD_SWO_RESERVED",
      "NC_SWD_RESERVED",
      "SCORING_SGND",
      "SCORING_NRST_N"
    ])
    expect(benchPrototypeServiceHeaders.esp32.header).toMatchObject({
      mpn: "TSW-106-07-G-S",
      positions: 6,
      pitchMm: 2.54
    })
    expect(benchPrototypeServiceHeaders.esp32).toMatchObject({
      reference: "J_ESP_SERVICE",
      bomReference: "J_ESP32_SERVICE"
    })
    expect(benchPrototypeServiceHeaders.esp32.header.matingSocket.mpn).toBe("SSW-106-01-G-S")
    expect(benchPrototypeServiceHeaders.esp32.pinout.map((pin) => pin.net)).toEqual([
      "APP_GND",
      "APP_3V3_SENSE",
      "UART0_TX",
      "UART0_RX",
      "BOOT_N",
      "MANUAL_RESET_ASSERT"
    ])
  })

  it.each([
    [
      "stm32 header",
      (copy: typeof benchPrototypeServiceHeaders) => ((copy.stm32.header as { mpn: string }).mpn = "other")
    ],
    [
      "stm32 cable",
      (copy: typeof benchPrototypeServiceHeaders) => ((copy.stm32.matingCable as { mpn: string }).mpn = "other")
    ],
    [
      "stm32 reset pin",
      (copy: typeof benchPrototypeServiceHeaders) => ((copy.stm32.pinout[8] as { net: string }).net = "EN_RESET")
    ],
    [
      "esp32 header",
      (copy: typeof benchPrototypeServiceHeaders) => ((copy.esp32.header as { mpn: string }).mpn = "other")
    ],
    [
      "esp32 socket",
      (copy: typeof benchPrototypeServiceHeaders) =>
        ((copy.esp32.header as { matingSocket: { mpn: string } }).matingSocket.mpn = "other")
    ],
    [
      "esp32 UART order",
      (copy: typeof benchPrototypeServiceHeaders) => ((copy.esp32.pinout[2] as { net: string }).net = "UART0_RX")
    ],
    [
      "manual reset sink drain",
      (copy: typeof benchPrototypeServiceHeaders) =>
        ((copy.manualResetSink.transistor as { drain: string }).drain = "MANUAL_RESET_ASSERT")
    ],
    [
      "manual reset sink source",
      (copy: typeof benchPrototypeServiceHeaders) =>
        ((copy.manualResetSink.transistor as { source: string }).source = "V3_3")
    ],
    [
      "manual reset gate pulldown",
      (copy: typeof benchPrototypeServiceHeaders) =>
        ((copy.manualResetSink.gatePulldown as { mpn: string }).mpn = "wrong")
    ],
    [
      "service orientation gate",
      (copy: typeof benchPrototypeServiceHeaders) =>
        ((copy.esp32.header.orientation as { blockingGate: string }).blockingGate = "not required")
    ],
    [
      "release gate",
      (copy: typeof benchPrototypeServiceHeaders) =>
        ((copy.authority as { fabricationAuthorized: boolean }).fabricationAuthorized = true)
    ]
  ])("rejects a changed %s", (_name, mutate) => {
    const copy = structuredClone(benchPrototypeServiceHeaders)
    mutate(copy)
    expect(() => validateBenchPrototypeServiceHeaders(copy)).toThrow()
  })

  it("rejects incomplete, cyclic, aliased, and accessor graphs", () => {
    expect(() => validateBenchPrototypeServiceHeaders(null)).toThrow()
    expect(() => validateBenchPrototypeServiceHeaders({})).toThrow()

    const cycle = structuredClone(benchPrototypeServiceHeaders) as { self?: unknown }
    cycle.self = cycle
    expect(() => validateBenchPrototypeServiceHeaders(cycle)).toThrow()

    const alias = structuredClone(benchPrototypeServiceHeaders) as {
      stm32: { pinout: unknown }
      esp32: { pinout: unknown }
    }
    alias.esp32.pinout = alias.stm32.pinout
    expect(() => validateBenchPrototypeServiceHeaders(alias)).toThrow()

    const accessor = structuredClone(benchPrototypeServiceHeaders) as { releaseState: string }
    Object.defineProperty(accessor, "releaseState", { get: () => "deny", enumerable: true })
    expect(() => validateBenchPrototypeServiceHeaders(accessor)).toThrow()
  })

  it("keeps every release gate denied and every canonical node immutable", () => {
    expect(benchPrototypeServiceHeaders.authority).toMatchObject({
      exactSelectionFrozen: true,
      footprintEvidenceApproved: false,
      matingEvidenceApproved: false,
      recoveryDemonstrated: false,
      fabricationAuthorized: false,
      releaseState: "deny"
    })
    expect(Object.isFrozen(benchPrototypeServiceHeaders)).toBe(true)
    expect(Object.isFrozen(benchPrototypeServiceHeaders.stm32.pinout)).toBe(true)
    expect(Object.isFrozen(benchPrototypeServiceHeaders.esp32.pinout)).toBe(true)
  })

  it("requires the complete de-energized service sequence and fixture orientation gate", () => {
    expect(benchPrototypeServiceHeaders.stm32.recoveryProcedure).toHaveLength(6)
    expect(benchPrototypeServiceHeaders.stm32.recoveryProcedure.join(" ")).toContain("normal USB-C power only")
    expect(benchPrototypeServiceHeaders.stm32.recoveryProcedure.join(" ")).toContain("before unmating")
    expect(benchPrototypeServiceHeaders.stm32.powerSequenceRule).toContain("de-energized only")
    expect(benchPrototypeServiceHeaders.esp32.recoveryProcedure).toHaveLength(6)
    expect(benchPrototypeServiceHeaders.esp32.recoveryProcedure.join(" ")).toContain(
      "10 ms post-release sample interval"
    )
    expect(benchPrototypeServiceHeaders.esp32.powerSequenceRule).toContain("must never power the target")
    expect(benchPrototypeServiceHeaders.esp32.header.orientation).toMatchObject({
      keying: "none",
      reversible: true,
      fixtureEnforced: false
    })
  })
})
