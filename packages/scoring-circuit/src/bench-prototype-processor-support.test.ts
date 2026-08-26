import { describe, expect, it } from "vitest"
import {
  benchPrototypeProcessorSupport,
  validateBenchPrototypeProcessorSupport
} from "./bench-prototype-processor-support.js"

describe("BP-125 processor support", () => {
  it("retains the exact processors, their mandatory bypass coverage, and a denied release", () => {
    expect(validateBenchPrototypeProcessorSupport(benchPrototypeProcessorSupport)).toBe(true)
    expect(benchPrototypeProcessorSupport.bypassAndBulk.stm32Digital.references).toEqual([
      "C_STM_VDD16",
      "C_STM_VDD32",
      "C_STM_VDD48",
      "C_STM_VDD64"
    ])
    expect(benchPrototypeProcessorSupport.bypassAndBulk.stm32Analog.vref).toMatchObject({
      values: ["100 nF X7R", "1 uF X7R"]
    })
    expect(benchPrototypeProcessorSupport.bypassAndBulk.esp32.values).toEqual(["100 nF X7R", "22 uF minimum ceramic"])
    expect(benchPrototypeProcessorSupport.authority).toMatchObject({
      schematicSignoff: "deny",
      fabricationAuthorized: false
    })
  })

  it("keeps unselected STM32 clocks DNP, module timing internal, and reset/strap loads safe", () => {
    expect(benchPrototypeProcessorSupport.oscillators.stm32Hse).toMatchObject({
      population: "DNP",
      exactOscillatorMpn: "TBD"
    })
    expect(benchPrototypeProcessorSupport.oscillators.stm32Lse).toMatchObject({
      population: "DNP",
      exactOscillatorMpn: "TBD"
    })
    expect(benchPrototypeProcessorSupport.oscillators.esp32.population).toBe("module-integrated")
    expect(benchPrototypeProcessorSupport.bootAndReset.stm32.boot0.value).toBe("10 kOhm pulldown")
    expect(benchPrototypeProcessorSupport.bootAndReset.esp32.en).toMatchObject({
      value: "10 kOhm pullup",
      capacitorValue: "1 uF"
    })
    expect(benchPrototypeProcessorSupport.bootAndReset.esp32.straps).toEqual(
      expect.arrayContaining([
        { gpio: 3, disposition: "unconnected and quiet" },
        { gpio: 45, disposition: "weak external pulldown and high-impedance AHCT input during reset" }
      ])
    )
    expect(benchPrototypeProcessorSupport.bootAndReset.esp32.irReceiver).toMatchObject({
      modulePad: 28,
      gpio: 35,
      signal: "IR_RX",
      peripheral: "RMT_RX",
      receiverHardware: "BP-146 not selected"
    })
    expect(benchPrototypeProcessorSupport.bootAndReset.esp32.unusedPads).toEqual(
      expect.arrayContaining(["GPIO33 and GPIO34 not exposed by N16R2", "GPIO36 and GPIO37 reserved NC for DNP audio"])
    )
  })

  it("fails closed for substitutions, omissions, and release escalation", () => {
    for (const mutate of [
      (candidate: any) => (candidate.processors.stm32.part = "STM32G474RBT3TR"),
      (candidate: any) => candidate.bypassAndBulk.stm32Digital.references.pop(),
      (candidate: any) => (candidate.bypassAndBulk.stm32Analog.vref.values[0] = "10 nF X7R"),
      (candidate: any) => (candidate.bypassAndBulk.esp32.values[1] = "10 uF minimum ceramic"),
      (candidate: any) => (candidate.oscillators.stm32Hse.population = "selected"),
      (candidate: any) => (candidate.authority.fabricationAuthorized = true)
    ]) {
      const candidate = structuredClone(benchPrototypeProcessorSupport)
      mutate(candidate)
      expect(() => validateBenchPrototypeProcessorSupport(candidate)).toThrow(RangeError)
    }
  })

  it("is deeply frozen and rejects aliases and accessors before reading them", () => {
    expect(Object.isFrozen(benchPrototypeProcessorSupport)).toBe(true)
    expect(Object.isFrozen(benchPrototypeProcessorSupport.bypassAndBulk.stm32Digital.references)).toBe(true)
    const alias = structuredClone(benchPrototypeProcessorSupport) as any
    alias.bootAndReset.esp32 = alias.bootAndReset.stm32
    expect(() => validateBenchPrototypeProcessorSupport(alias)).toThrow(RangeError)
    const accessor = structuredClone(benchPrototypeProcessorSupport) as any
    let read = false
    Object.defineProperty(accessor, "workUnit", {
      enumerable: true,
      get: () => {
        read = true
        return "BP-125"
      }
    })
    expect(() => validateBenchPrototypeProcessorSupport(accessor)).toThrow(RangeError)
    expect(read).toBe(false)
  })
})
