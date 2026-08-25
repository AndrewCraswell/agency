import { describe, expect, it } from "vitest"
import {
  benchPrototypeOptionalPeripherals,
  validateBenchPrototypeOptionalPeripherals
} from "./bench-prototype-optional-peripherals.js"

describe("BP-145 minimal optional peripherals", () => {
  it("populates no optional peripheral", () => {
    expect(validateBenchPrototypeOptionalPeripherals(benchPrototypeOptionalPeripherals)).toBe(true)
    expect(benchPrototypeOptionalPeripherals.population.map((item) => [item.reference, item.disposition])).toEqual([
      ["U_FRAM", "DNP"],
      ["U_RTC", "DNP"],
      ["U_SECURE_ELEMENT", "DNP"],
      ["U_AUDIO", "DNP"],
      ["J_SPEAKER", "DNP"],
      ["ANT_EXTERNAL", "DNP"]
    ])
  })

  it("uses eFuses and encrypted NVS without flash writes during scoring", () => {
    expect(benchPrototypeOptionalPeripherals.persistencePolicy).toMatchObject({
      identity: "ESP32 eFuses",
      storage: "ESP-IDF encrypted NVS"
    })
    expect(benchPrototypeOptionalPeripherals.persistencePolicy.activeScoringRule).toContain("No flash erase or write")
  })

  it("keeps radio disabled without an antenna", () => {
    expect(benchPrototypeOptionalPeripherals.antennaPolicy).toMatchObject({
      module: "ESP32-S3-WROOM-1U-N16R2",
      hostRfRoute: "prohibited; the WROOM-1U contains its RF route and antenna connector"
    })
    expect(benchPrototypeOptionalPeripherals.antennaPolicy.dnpBehavior).toContain("radios must remain disabled")
  })

  it("fails closed on population, persistence, release, aliases, and accessors", () => {
    for (const mutate of [
      (candidate: any) => (candidate.population[0].disposition = "populate"),
      (candidate: any) => (candidate.persistencePolicy.activeScoringRule = "write whenever needed"),
      (candidate: any) => (candidate.antennaPolicy.dnpBehavior = "radio enabled"),
      (candidate: any) => (candidate.evidence.fabricationAuthorized = true)
    ]) {
      const candidate = structuredClone(benchPrototypeOptionalPeripherals)
      mutate(candidate)
      expect(() => validateBenchPrototypeOptionalPeripherals(candidate)).toThrow(RangeError)
    }

    const alias = structuredClone(benchPrototypeOptionalPeripherals) as any
    alias.reservedResourceRules = alias.population
    expect(() => validateBenchPrototypeOptionalPeripherals(alias)).toThrow(RangeError)

    const accessor = structuredClone(benchPrototypeOptionalPeripherals) as any
    let read = false
    Object.defineProperty(accessor, "workUnit", {
      enumerable: true,
      get: () => {
        read = true
        return "BP-145"
      }
    })
    expect(() => validateBenchPrototypeOptionalPeripherals(accessor)).toThrow(RangeError)
    expect(read).toBe(false)
  })
})
