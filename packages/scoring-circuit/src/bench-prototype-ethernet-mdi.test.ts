import { describe, expect, it } from "vitest"
import {
  benchPrototypeEthernetMdi,
  benchPrototypeEthernetMdiUpstreamProvenance,
  validateBenchPrototypeEthernetMdi
} from "./bench-prototype-ethernet-mdi.js"
import { communicationsFootprintEvidence } from "./communications-footprint-evidence.js"

describe("BP-141 W5500 to MagJack MDI contract", () => {
  it("maps every W5500 PHY polarity to the selected MagJack without a harness", () => {
    expect(validateBenchPrototypeEthernetMdi(benchPrototypeEthernetMdi)).toBe(true)
    expect(benchPrototypeEthernetMdi.mdiPairs).toEqual([
      expect.objectContaining({
        controllerEndpoint: "U_W5500.TXP",
        controllerPad: 2,
        jackEndpoint: "J_ETH.TD+",
        jackPin: 1,
        polarity: "+",
        seriesComponent: null
      }),
      expect.objectContaining({
        controllerEndpoint: "U_W5500.TXN",
        controllerPad: 1,
        jackEndpoint: "J_ETH.TD-",
        jackPin: 3,
        polarity: "-",
        seriesComponent: null
      }),
      expect.objectContaining({
        controllerEndpoint: "U_W5500.RXP",
        controllerPad: 6,
        jackEndpoint: "J_ETH.RD+",
        jackPin: 4,
        polarity: "+",
        seriesComponent: "C_ETH_RX_P, 6.8 nF"
      }),
      expect.objectContaining({
        controllerEndpoint: "U_W5500.RXN",
        controllerPad: 5,
        jackEndpoint: "J_ETH.RD-",
        jackPin: 6,
        polarity: "-",
        seriesComponent: "C_ETH_RX_N, 6.8 nF"
      })
    ])
    expect(benchPrototypeEthernetMdi.mdiPairs.every((pair) => pair.medium === "on-board-copper")).toBe(true)
    expect(benchPrototypeEthernetMdi.noMdiHarnessCrossing.externalMdiHarness).toBe(false)
  })

  it("keeps center taps, built-in termination, LEDs, and shield return explicit", () => {
    expect(benchPrototypeEthernetMdi.centerTapsAndTermination.transmit).toMatchObject({
      jackEndpoint: "J_ETH.CTD",
      jackPin: 2,
      supply: "ETH_AVDD"
    })
    expect(benchPrototypeEthernetMdi.centerTapsAndTermination.receive).toMatchObject({
      jackEndpoint: "J_ETH.CRD",
      jackPin: 5
    })
    expect(benchPrototypeEthernetMdi.centerTapsAndTermination.receive.topology).toContain("ETH_RX_BIAS")
    expect(benchPrototypeEthernetMdi.centerTapsAndTermination.magJackInternal).toEqual({
      topology:
        "7499011121A contains four cable-side 75 Ohm resistors and one 0.001 uF / 2 kV common-mode termination capacitor",
      resistorCount: 4,
      resistorValueOhm: 75,
      capacitor: "0.001 uF / 2 kV",
      externalDuplication: "prohibited"
    })
    expect(benchPrototypeEthernetMdi.leds.yellow.driver).toContain("ACTLED pin 27")
    expect(benchPrototypeEthernetMdi.leds.green.driver).toContain("LINKLED pin 25")
    expect(benchPrototypeEthernetMdi.shieldAndEsdReturn).toMatchObject({
      chassisNet: "CHASSIS_ETHERNET",
      endpoints: ["J_ETH.8", "J_ETH.S1", "J_ETH.S2"],
      appGroundConnection: "no direct APP_GND connection"
    })
  })

  it("requires a 100 Ohm on-board route and preserves all release gates", () => {
    expect(benchPrototypeEthernetMdi.routePlan.differentialImpedanceOhm).toBe(100)
    expect(benchPrototypeEthernetMdi.routePlan.pairs).toEqual(["ETH_TX_P/ETH_TX_N", "ETH_RX_P/ETH_RX_N"])
    expect(benchPrototypeEthernetMdi).toMatchObject({
      integrationRelease: false,
      fabricationRelease: false,
      layoutRelease: false,
      benchValidationRelease: false,
      releaseState: "deny"
    })
    expect(benchPrototypeEthernetMdi.openGates.join(" ")).toContain("selected-MagJack receive center-tap")
  })

  it("is immutable and rejects forged contracts, aliases, and upstream MagJack drift", () => {
    expect(Object.isFrozen(benchPrototypeEthernetMdi)).toBe(true)
    expect(Object.isFrozen(benchPrototypeEthernetMdi.mdiPairs)).toBe(true)
    expect(Object.isFrozen(benchPrototypeEthernetMdi.mdiPairs[0])).toBe(true)
    expect(Object.isFrozen(benchPrototypeEthernetMdiUpstreamProvenance)).toBe(true)

    const forged = structuredClone(benchPrototypeEthernetMdi)
    Reflect.set(forged.routePlan, "differentialImpedanceOhm", 90)
    expect(() => validateBenchPrototypeEthernetMdi(forged)).toThrow(RangeError)

    const aliased = structuredClone(benchPrototypeEthernetMdi)
    Reflect.set(aliased.mdiPairs, "1", aliased.mdiPairs[0]!)
    expect(() => validateBenchPrototypeEthernetMdi(aliased)).toThrow(RangeError)

    const source = communicationsFootprintEvidence.find((record) => record.mpn === "7499011121A")
    expect(source).toBeDefined()
    const originalManufacturer = source!.manufacturer
    try {
      Reflect.set(source!, "manufacturer", "FORGED")
      expect(() => validateBenchPrototypeEthernetMdi(benchPrototypeEthernetMdi)).toThrow(RangeError)
    } finally {
      Reflect.set(source!, "manufacturer", originalManufacturer)
    }
    expect(validateBenchPrototypeEthernetMdi(benchPrototypeEthernetMdi)).toBe(true)
  })
})
