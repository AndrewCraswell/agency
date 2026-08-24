import { describe, expect, it } from "vitest"
import {
  benchPrototypeFramSupportExpectedIdentities,
  benchPrototypeOptionalPeripheralExpectedIdentities,
  benchPrototypeOptionalPeripherals,
  validateBenchPrototypeOptionalPeripherals
} from "./bench-prototype-optional-peripherals.js"

describe("BP-145 optional application peripherals", () => {
  it("populates only the exact shared-SPI F-RAM", () => {
    expect(validateBenchPrototypeOptionalPeripherals(benchPrototypeOptionalPeripherals)).toBe(true)
    expect(benchPrototypeOptionalPeripherals.population.filter((item) => item.disposition === "populate")).toEqual([
      expect.objectContaining({ reference: "U_FRAM", mpn: "CY15B104Q-LHXIT", supply: "V3_3" })
    ])
    const fram = benchPrototypeOptionalPeripherals.population[0]
    expect(fram).toMatchObject({
      reference: "U_FRAM",
      package: "8-pin TDFN/DFN, 5 mm x 6 mm x 0.75 mm, PG-USON-8, drawing 001-85579"
    })
    expect("pinMap" in fram ? fram.pinMap : []).toEqual([
      { pin: 1, name: "CS_N", destination: "FRAM_CS_N", esp32ModulePad: 24, esp32Gpio: 47 },
      { pin: 2, name: "SO", destination: "APP_SPI_MISO", esp32ModulePad: 17, esp32Gpio: 9 },
      { pin: 3, name: "WP_N", destination: "R_FRAM_WP_PULLUP.pin1", esp32ModulePad: null, esp32Gpio: null },
      { pin: 4, name: "VSS", destination: "APP_GND", esp32ModulePad: null, esp32Gpio: null },
      { pin: 5, name: "SI", destination: "APP_SPI_MOSI", esp32ModulePad: 12, esp32Gpio: 8 },
      { pin: 6, name: "SCK", destination: "APP_SPI_SCK", esp32ModulePad: 11, esp32Gpio: 18 },
      { pin: 7, name: "HOLD_N", destination: "R_FRAM_HOLD_PULLUP.pin1", esp32ModulePad: null, esp32Gpio: null },
      { pin: 8, name: "VDD", destination: "V3_3", esp32ModulePad: null, esp32Gpio: null }
    ])
    expect("support" in fram ? fram.support : []).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reference: "R_FRAM_WP_PULLUP", mpn: "RC0603FR-0710KL", value: "10 kOhm, 1%" }),
        expect.objectContaining({
          reference: "R_FRAM_HOLD_PULLUP",
          mpn: "RC0603FR-0710KL",
          value: "10 kOhm, 1%"
        }),
        expect.objectContaining({
          reference: "C_FRAM_BYPASS",
          mpn: "C0603C104K3RACTU",
          value: "100 nF, 25 V, X7R, 10%",
          evidenceUrl: "https://search.kemet.com/component-documentation/download/specsheet/C0603C104K3RACTU"
        })
      ])
    )
  })

  it("keeps the five nonessential peripherals DNP", () => {
    expect(
      benchPrototypeOptionalPeripherals.population
        .filter((item) => item.disposition === "DNP")
        .map((item) => item.reference)
    ).toEqual(["U_RTC", "U_SECURE_ELEMENT", "U_AUDIO", "J_SPEAKER", "ANT_EXTERNAL"])
    expect(benchPrototypeOptionalPeripherals.evidence).toMatchObject({
      dnpLandPatternsApproved: false,
      antennaAssemblyApproved: false,
      audioLoadVerified: false,
      fabricationAuthorized: false
    })
    expect(
      benchPrototypeOptionalPeripherals.population.find((item) => item.reference === "U_SECURE_ELEMENT")
    ).toMatchObject({
      disposition: "DNP",
      retainedCandidateMpn: "STSAFE-A110",
      candidateLevel: "family-level only; exact orderable personalization and package variant TBD"
    })
    expect(benchPrototypeOptionalPeripherals.population.find((item) => item.reference === "U_AUDIO")).toMatchObject({
      disposition: "DNP",
      interface: "DNP; no audio host routing; GPIO35 is reserved for BP-126 IR_RX/RMT_RX"
    })
  })

  it("uses the WROOM-1U connector policy and disables radio without an antenna", () => {
    expect(benchPrototypeOptionalPeripherals.antennaPolicy).toMatchObject({
      module: "ESP32-S3-WROOM-1U-N16R2",
      hostRfRoute: "prohibited; the WROOM-1U contains its RF route and antenna connector"
    })
    expect(benchPrototypeOptionalPeripherals.antennaPolicy.dnpBehavior).toContain("radios must remain disabled")
  })

  it("freezes independent selected-part identities and rejects contract drift", () => {
    expect(Object.isFrozen(benchPrototypeOptionalPeripheralExpectedIdentities)).toBe(true)
    expect(benchPrototypeOptionalPeripheralExpectedIdentities.map((identity) => identity.mpn)).toEqual([
      "CY15B104Q-LHXIT",
      "RV-3028-C7",
      "STSAFE-A110",
      "TAS2505TRGERQ1"
    ])
    expect(Object.isFrozen(benchPrototypeFramSupportExpectedIdentities)).toBe(true)
    expect(benchPrototypeFramSupportExpectedIdentities.map((identity) => identity.reference)).toEqual([
      "R_FRAM_WP_PULLUP",
      "R_FRAM_HOLD_PULLUP",
      "C_FRAM_BYPASS"
    ])
    for (const mutate of [
      (candidate: any) => (candidate.population[0].disposition = "DNP"),
      (candidate: any) => (candidate.population[1].disposition = "populate"),
      (candidate: any) => (candidate.population[0].pinMap[0].destination = "ETH_CS_N"),
      (candidate: any) => (candidate.population[0].pinMap[5].esp32Gpio = 8),
      (candidate: any) => (candidate.population[0].package = "SOIC-8"),
      (candidate: any) => (candidate.population[0].support[0].mpn = "generic"),
      (candidate: any) => (candidate.population[0].support[2].evidenceUrl = "https://example.invalid/spec.pdf"),
      (candidate: any) => (candidate.population[0].support[2].topology = "remote capacitor"),
      (candidate: any) => (candidate.antennaPolicy.hostRfRoute = "route host U.FL"),
      (candidate: any) => (candidate.evidence.fabricationAuthorized = true)
    ]) {
      const candidate = structuredClone(benchPrototypeOptionalPeripherals)
      mutate(candidate)
      expect(() => validateBenchPrototypeOptionalPeripherals(candidate)).toThrow(RangeError)
    }
  })

  it("rejects aliases and accessors before reading them", () => {
    const alias = structuredClone(benchPrototypeOptionalPeripherals) as any
    alias.recoveryRules = alias.sharedBusRules
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
