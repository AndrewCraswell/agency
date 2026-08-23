import { describe, expect, it } from "vitest"
import {
  benchPrototypeEthernet,
  benchPrototypeEthernetUpstreamProvenance,
  validateBenchPrototypeEthernet
} from "./bench-prototype-ethernet.js"
import { componentDecisions } from "./component-decisions.js"
import { ethernetSupportNetwork } from "./ethernet-support-network.js"

describe("BP-140 W5500 support-network import", () => {
  it("imports the exact controller and complete committed support set", () => {
    expect(validateBenchPrototypeEthernet(benchPrototypeEthernet)).toBe(true)
    expect(benchPrototypeEthernet.controller).toMatchObject({
      reference: "U_W5500",
      manufacturer: "WIZnet",
      mpn: "W5500",
      value: "10/100 Ethernet controller, LQFP-48, 7mm x 7mm body, 0.5mm pitch"
    })
    expect(benchPrototypeEthernet.supportParts).toHaveLength(17)
    expect(benchPrototypeEthernet.counts).toEqual({
      supportParts: 17,
      crystalLoadCapacitors: 2,
      avddPins: 6,
      localSupplyBypasses: 7,
      ferriteInputBypasses: 1
    })
  })

  it("pins every clock, analog-reference, bypass, and ferrite selection", () => {
    const byReference = new Map(benchPrototypeEthernet.supportParts.map((part) => [part.reference, part]))
    expect(byReference.get("Y_W5500")).toMatchObject({ mpn: "ECS-250-18-33B-JGN-TR" })
    expect(byReference.get("C_W5500_XI")).toMatchObject({ mpn: "CGA3E2C0G1H180J080AA", value: "18pF" })
    expect(byReference.get("C_W5500_XO")).toMatchObject({ mpn: "CGA3E2C0G1H180J080AA", value: "18pF" })
    expect(byReference.get("R_W5500_XTAL")).toMatchObject({ mpn: "ERJ3EKF1004V", value: "1MOhm" })
    expect(byReference.get("R_W5500_XO")).toMatchObject({ mpn: "ERJ3GEY0R00V", value: "0Ohm jumper" })
    expect(byReference.get("R_W5500_EXRES")).toMatchObject({ mpn: "ERJ3EKF1242V", value: "12.4kOhm" })
    expect(byReference.get("C_W5500_TOCAP")).toMatchObject({ mpn: "GRM21BR71C475KA73L", value: "4.7uF" })
    expect(byReference.get("C_W5500_1V2O")).toMatchObject({ mpn: "GRM188R71H103KA01D", value: "10nF" })
    expect(byReference.get("FB_W5500_AVDD")).toMatchObject({ mpn: "BLM21PG221SN1D" })

    const bypasses = benchPrototypeEthernet.supportParts.filter((part) => part.value === "100nF")
    expect(bypasses.map((part) => part.reference)).toEqual([
      "C_ETH_AVDD_FERRITE_INPUT",
      "C_W5500_VDD",
      "C_W5500_AVDD_1",
      "C_W5500_AVDD_2",
      "C_W5500_AVDD_3",
      "C_W5500_AVDD_4",
      "C_W5500_AVDD_5",
      "C_W5500_AVDD_6"
    ])
    expect(new Set(bypasses.map((part) => part.mpn))).toEqual(new Set(["GRM188R71C104KA01D"]))
  })

  it("uses one-board rails while leaving BP-123 reset and interrupt ownership honestly open", () => {
    expect(benchPrototypeEthernet.nets.digitalSupply.name).toBe("V3_3")
    expect(benchPrototypeEthernet.nets.analogSupply.endpoints).toHaveLength(7)
    expect(benchPrototypeEthernet.nets.ground.name).toBe("APP_GND")
    expect(benchPrototypeEthernet.nets.reset).toMatchObject({
      name: "APP_W5500_RESET_N",
      polarity: "active-low",
      inputType: "W5500 active-low reset input",
      endpoints: expect.arrayContaining(["R_W5500_RESET_PULLUP.2", "U_W5500.RST_N", "TP_W5500_RESET_N"]),
      firmwareControl: "none",
      observationEndpoint: "TP_W5500_RESET_N",
      pullup: {
        reference: "R_W5500_RESET_PULLUP",
        value: "TBD",
        rail: "V3_3",
        ownershipStatus: expect.stringContaining("BP-123")
      },
      driver: {
        reference: "U_APP_SUPERVISOR",
        mpn: "TBD",
        outputRequirement: "open-drain reset output",
        ownershipStatus: expect.stringContaining("BP-123")
      }
    })
    expect(benchPrototypeEthernet.nets.interrupt).toMatchObject({
      electricalType: "active-low push-pull W5500 output",
      endpoints: expect.arrayContaining(["R_W5500_INT_BIAS.2", "TP_W5500_INT_N"]),
      hostConnection: "none",
      observationEndpoint: "TP_W5500_INT_N",
      bias: {
        reference: "R_W5500_INT_BIAS",
        value: "TBD",
        rail: "V3_3",
        ownershipStatus: expect.stringContaining("BP-123")
      },
      firmwarePolicy: "poll W5500 over SPI; do not allocate an ESP32 GPIO"
    })
  })

  it("cannot be mistaken for schematic integration or fabrication approval", () => {
    expect(benchPrototypeEthernet).toMatchObject({
      targetAssembly: "one-board bench prototype",
      prototypeOnly: true,
      integrationRelease: false,
      fabricationRelease: false,
      releaseState: "deny"
    })
    expect(benchPrototypeEthernet.openGates).toContain("BP-141 MDI, MagJack, termination, shield, and surge closure")
    expect(benchPrototypeEthernet.openGates).toContain(
      "BP-123 exact application supervisor, W5500 reset pullup, timing, and INT bias-or-DNP closure"
    )
  })

  it("is deeply immutable and rejects forged or drifting imports", () => {
    expect(Object.isFrozen(benchPrototypeEthernet)).toBe(true)
    expect(Object.isFrozen(benchPrototypeEthernet.supportParts)).toBe(true)
    expect(Object.isFrozen(benchPrototypeEthernet.supportParts[0])).toBe(true)
    expect(Object.isFrozen(benchPrototypeEthernetUpstreamProvenance)).toBe(true)
    expect(Object.isFrozen(benchPrototypeEthernetUpstreamProvenance.supportParts)).toBe(true)

    const forged = structuredClone(benchPrototypeEthernet)
    Reflect.set(forged.supportParts[0]!, "mpn", "wrong crystal")
    expect(() => validateBenchPrototypeEthernet(forged)).toThrow(RangeError)

    const extra = { ...structuredClone(benchPrototypeEthernet), fabricationApproved: true }
    expect(() => validateBenchPrototypeEthernet(extra)).toThrow(RangeError)

    const aliased = structuredClone(benchPrototypeEthernet)
    Reflect.set(aliased.supportParts, "1", aliased.supportParts[0]!)
    expect(() => validateBenchPrototypeEthernet(aliased)).toThrow(RangeError)
  })

  it("detects live support-network drift against an independent snapshot", () => {
    const source = ethernetSupportNetwork.supportNetworkComponents.find((part) => part.reference === "Y_W5500")
    expect(source).toBeDefined()
    const originalMpn = source!.mpn
    try {
      Reflect.set(source!, "mpn", "FORGED-CRYSTAL")
      expect(() => validateBenchPrototypeEthernet(benchPrototypeEthernet)).toThrow(RangeError)
    } finally {
      Reflect.set(source!, "mpn", originalMpn)
    }
    expect(validateBenchPrototypeEthernet(benchPrototypeEthernet)).toBe(true)
  })

  it("detects live W5500 decision drift and always restores the registry", () => {
    const source = componentDecisions.find((decision) => decision.mpn === "W5500")
    expect(source).toBeDefined()
    const originalManufacturer = source!.manufacturer
    try {
      Reflect.set(source!, "manufacturer", "FORGED")
      expect(() => validateBenchPrototypeEthernet(benchPrototypeEthernet)).toThrow(RangeError)
    } finally {
      Reflect.set(source!, "manufacturer", originalManufacturer)
    }
    expect(validateBenchPrototypeEthernet(benchPrototypeEthernet)).toBe(true)
  })
})
