import { describe, expect, it } from "vitest"
import {
  benchPrototypeBp125ProcessorFootprintReconciliation,
  validateBenchPrototypeBp125ProcessorFootprintReconciliation
} from "./bench-prototype-bp125-processor-footprint-reconciliation.js"

describe("BP-125 sole-ESP32 processor-footprint reconciliation", () => {
  it("binds only the exact ESP32-S3-WROOM-1U-N16R2 candidate", () => {
    expect(
      validateBenchPrototypeBp125ProcessorFootprintReconciliation(benchPrototypeBp125ProcessorFootprintReconciliation)
    ).toBe(true)
    expect(benchPrototypeBp125ProcessorFootprintReconciliation.processorBindings).toEqual([
      expect.objectContaining({
        reference: "U_APP",
        exactMpn: "ESP32-S3-WROOM-1U-N16R2",
        geometry: expect.objectContaining({ perimeterPadCount: 40, exposedGroundPad: 41, exposedGroundVias: 9 })
      })
    ])
  })

  it("keeps module and release review gates explicit", () => {
    expect(benchPrototypeBp125ProcessorFootprintReconciliation.schematicChecklist).toHaveLength(3)
    expect(benchPrototypeBp125ProcessorFootprintReconciliation.authority).toEqual({
      schematicIntegrationAuthorized: false,
      schematicSignoff: "deny",
      footprintApproval: false,
      layoutApproval: false,
      fabricationAuthorized: false
    })
  })

  it("rejects stale STM32 binding and fabrication escalation", () => {
    const stale = structuredClone(benchPrototypeBp125ProcessorFootprintReconciliation)
    stale.processorBindings.push({ ...stale.processorBindings[0]!, reference: "U_STM32", exactMpn: "STM32G474RET3TR" })
    expect(() => validateBenchPrototypeBp125ProcessorFootprintReconciliation(stale)).toThrow(RangeError)

    const released = structuredClone(benchPrototypeBp125ProcessorFootprintReconciliation)
    released.authority.fabricationAuthorized = true
    expect(() => validateBenchPrototypeBp125ProcessorFootprintReconciliation(released)).toThrow(RangeError)
  })

  it("rejects accessors, aliases, and symbol-keyed graph changes", () => {
    const accessor = structuredClone(benchPrototypeBp125ProcessorFootprintReconciliation)
    Object.defineProperty(accessor.authority, "fabricationAuthorized", {
      enumerable: true,
      get: () => false
    })
    expect(() => validateBenchPrototypeBp125ProcessorFootprintReconciliation(accessor)).toThrow(RangeError)

    const alias = structuredClone(benchPrototypeBp125ProcessorFootprintReconciliation)
    Object.defineProperty(alias.upstreamContracts, "support", {
      enumerable: true,
      value: alias.upstreamContracts.esp32
    })
    expect(() => validateBenchPrototypeBp125ProcessorFootprintReconciliation(alias)).toThrow(RangeError)

    const symbol = structuredClone(benchPrototypeBp125ProcessorFootprintReconciliation)
    Object.defineProperty(symbol, Symbol("forged"), { enumerable: true, value: "forged" })
    expect(() => validateBenchPrototypeBp125ProcessorFootprintReconciliation(symbol)).toThrow(RangeError)
  })
})
