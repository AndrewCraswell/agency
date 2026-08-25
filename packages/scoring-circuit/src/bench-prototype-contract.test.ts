import { describe, expect, it } from "vitest"
import { benchPrototypeContract, validateBenchPrototypeContract } from "./bench-prototype-contract.js"

describe("BP-010 ESP32-only bench prototype contract", () => {
  it("keeps one ESP32, the portable C17 boundary, Ethernet, IR, display, and USB-C PD", () => {
    expect(validateBenchPrototypeContract(benchPrototypeContract)).toBe(true)
    expect(benchPrototypeContract.architecture).toMatchObject({
      boardCount: 1,
      processor: "ESP32-S3-WROOM-1U-N16R2",
      releaseState: "deny",
      dimensionedDrawingComplete: false
    })
    expect(benchPrototypeContract.requiredHardware).toMatchObject({
      ethernet: "W5500 and Würth 7499011121A",
      ir: "TSOP38438 at 38 kHz on GPIO35 RMT_RX"
    })
    expect(benchPrototypeContract.softwareBoundary.prohibitedCoreDependencies).toEqual([
      "wall clock",
      "random",
      "network",
      "display",
      "storage",
      "ESP-IDF"
    ])
  })

  it("removes the dual-MCU and nonessential P0 hardware", () => {
    expect(benchPrototypeContract.removedFromP0).toEqual(
      expect.arrayContaining([
        "STM32G474RET3TR",
        "ISO7762FDWR",
        "ISO7721FDR",
        "NXE1S0505MC",
        "STM32 SWD",
        "F-RAM",
        "RTC",
        "secure element",
        "audio and speaker",
        "external antenna assembly"
      ])
    )
    expect(benchPrototypeContract.powerBoundary).toMatchObject({
      populatedInputs: ["USB-C PD"],
      removedInputs: ["J_LAB_INJECTION", "7101SYZQE"]
    })
  })

  it("reallocates eleven obsolete GPIOs to four P0 signals", () => {
    expect(benchPrototypeContract.pinBudget.obsoleteAllocationFreedGpios).toHaveLength(11)
    expect(benchPrototypeContract.pinBudget.requiredNewAllocation).toEqual([
      { gpio: 4, signal: "SAR_SCLK" },
      { gpio: 5, signal: "SAR_DOUT" },
      { gpio: 6, signal: "SAR_CONVST" },
      { gpio: 7, signal: "PRIMARY_OUTPUT_LATCH" }
    ])
    expect(benchPrototypeContract.pinBudget.remainingCandidateGpios).toHaveLength(7)
    expect(benchPrototypeContract.pinBudget.comparatorRule).toContain("no per-channel comparator GPIOs")
  })

  it("fails closed on architectural drift", () => {
    for (const mutate of [
      (value: typeof benchPrototypeContract) => Reflect.set(value.architecture, "processor", "STM32G474RET3TR"),
      (value: typeof benchPrototypeContract) => Reflect.set(value.architecture, "releaseState", "allow"),
      (value: typeof benchPrototypeContract) => Reflect.set(value.pinBudget, "remainingCandidateGpios", []),
      (value: typeof benchPrototypeContract) => Reflect.set(value.powerBoundary, "populatedInputs", ["USB-C PD", "lab"])
    ]) {
      const candidate = structuredClone(benchPrototypeContract)
      mutate(candidate)
      expect(() => validateBenchPrototypeContract(candidate)).toThrow(RangeError)
    }
  })

  it("rejects malformed graphs, aliases, cycles, symbols, and accessors", () => {
    for (const candidate of [null, [], {}, { ...benchPrototypeContract, extra: true }]) {
      expect(() => validateBenchPrototypeContract(candidate)).toThrow(RangeError)
    }
    const alias = structuredClone(benchPrototypeContract)
    Reflect.set(alias.pinBudget.requiredNewAllocation, "1", alias.pinBudget.requiredNewAllocation[0])
    expect(() => validateBenchPrototypeContract(alias)).toThrow(RangeError)

    const cycle = structuredClone(benchPrototypeContract)
    Reflect.set(cycle, "architecture", cycle)
    expect(() => validateBenchPrototypeContract(cycle)).toThrow(RangeError)

    const symbol = structuredClone(benchPrototypeContract)
    Reflect.set(symbol, Symbol("hidden"), true)
    expect(() => validateBenchPrototypeContract(symbol)).toThrow(RangeError)

    const accessor = structuredClone(benchPrototypeContract)
    Object.defineProperty(accessor.architecture, "boardCount", { enumerable: true, get: () => 1 })
    expect(() => validateBenchPrototypeContract(accessor)).toThrow(RangeError)
  })

  it("deep-freezes the canonical contract", () => {
    expect(Object.isFrozen(benchPrototypeContract)).toBe(true)
    expect(Object.isFrozen(benchPrototypeContract.pinBudget.requiredNewAllocation)).toBe(true)
    expect(Object.isFrozen(benchPrototypeContract.requiredHardware)).toBe(true)
  })
})
