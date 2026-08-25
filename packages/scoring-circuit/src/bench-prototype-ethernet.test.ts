import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
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

  it("uses one-board rails and the independent BP-123 supervisor fanout", () => {
    expect(benchPrototypeEthernet.nets.digitalSupply.name).toBe("V3_3")
    expect(benchPrototypeEthernet.nets.analogSupply.endpoints).toHaveLength(7)
    expect(benchPrototypeEthernet.nets.ground.name).toBe("APP_GND")
    expect(benchPrototypeEthernet.nets.reset).toMatchObject({
      name: "APP_W5500_RESET_N",
      polarity: "active-low",
      inputType: "W5500 active-low reset input",
      endpoints: ["U_APP_RESET_FANOUT.Y2", "R_W5500_RESET_PULLUP.2", "U_W5500.RST_N", "TP_W5500_RESET_N"],
      firmwareControl: "none",
      observationEndpoint: "TP_W5500_RESET_N",
      testPoint: {
        reference: "TP_W5500_RESET_N",
        manufacturer: "Keystone Electronics",
        mpn: "5001",
        package: "miniature through-hole black test point, 0.040 inch (catalog 1.0 mm) mounting hole",
        disposition: "populate-for-bench-observation",
        sourceEvidence: {
          document: "Keystone terminals and test points catalog",
          artifactPath: "docs/evidence/bp-033/keystone-terminal-test-points.pdf",
          sha256: "00919BF8DA5DA41C978FE22717F8B39D443D03BB69BDD0A853CED85479FB237C",
          claims: expect.arrayContaining(["The catalog mounting-hole callout is not a finished PCB drill instruction."])
        }
      },
      pullup: {
        reference: "R_W5500_RESET_PULLUP",
        value: "10 kOhm, 1%",
        mpn: "RC0603FR-0710KL",
        rail: "V3_3",
        ownershipStatus: expect.stringContaining("selected by BP-123")
      },
      driver: {
        reference: "U_APP_RESET_FANOUT",
        endpoint: "Y2",
        mpn: "SN74LVC2G07DCKR",
        outputRequirement: expect.stringContaining("APP_SUPERVISOR_RESET_N"),
        ownershipStatus: expect.stringContaining("selected by BP-123")
      }
    })
    expect(benchPrototypeEthernet.nets.interrupt).toMatchObject({
      electricalType: "active-low digital W5500 output",
      outputStage: "not specified by the cited W5500 pin and DC-characteristics tables",
      endpoints: expect.arrayContaining(["R_W5500_INT_BIAS.2", "TP_W5500_INT_N"]),
      hostConnection: "none",
      observationEndpoint: "TP_W5500_INT_N",
      testPoint: {
        reference: "TP_W5500_INT_N",
        manufacturer: "Keystone Electronics",
        mpn: "5001",
        package: "miniature through-hole black test point, 0.040 inch (catalog 1.0 mm) mounting hole",
        disposition: "populate-for-bench-observation",
        sourceEvidence: {
          document: "Keystone terminals and test points catalog",
          artifactPath: "docs/evidence/bp-033/keystone-terminal-test-points.pdf",
          sha256: "00919BF8DA5DA41C978FE22717F8B39D443D03BB69BDD0A853CED85479FB237C",
          claims: expect.arrayContaining(["The catalog mounting-hole callout is not a finished PCB drill instruction."])
        }
      },
      bias: {
        reference: "R_W5500_INT_BIAS",
        disposition: "populate",
        value: "100 kOhm, 1%",
        manufacturer: "Yageo",
        mpn: "RC0603FR-07100KL",
        package: "0603",
        rail: "V3_3",
        population: "selected; footprint evidence open",
        ownershipStatus: expect.stringContaining("selected by the canonical ESP32 allocation"),
        sourceEvidence: {
          document: "W5500 Datasheet v1.1.0",
          artifactPath: "docs/evidence/bp-033/wiznet-w5500-datasheet.pdf",
          sha256: "7B826B808084CCD986BCC22904C00A07A508EF42FB93D079FE7150A4C4F1A63D"
        },
        biasEvidence: {
          manufacturer: "Yageo",
          document: "RC0603FR-07100KL product specification",
          artifactPath: "docs/evidence/bp-033/yageo-rc0603fr-07100kl-datasheet.pdf",
          sha256: "E6BA74C3F9ABAC1D8865473C885FF9CD6D2F7A1181846B32A8D1FF7FB5684054"
        },
        policyEvidence: {
          document: "docs/esp32-pin-allocation.md"
        }
      },
      firmwarePolicy: "poll W5500 over SPI; do not allocate an ESP32 GPIO"
    })
  })

  it("retains exact source evidence for the selected test points and interrupt bias", () => {
    const root = new URL("../", import.meta.url)
    const evidence = [
      [
        "docs/evidence/bp-033/keystone-terminal-test-points.pdf",
        "00919BF8DA5DA41C978FE22717F8B39D443D03BB69BDD0A853CED85479FB237C"
      ],
      [
        "docs/evidence/bp-033/wiznet-w5500-datasheet.pdf",
        "7B826B808084CCD986BCC22904C00A07A508EF42FB93D079FE7150A4C4F1A63D"
      ],
      [
        "docs/evidence/bp-033/yageo-rc0603fr-07100kl-datasheet.pdf",
        "E6BA74C3F9ABAC1D8865473C885FF9CD6D2F7A1181846B32A8D1FF7FB5684054"
      ]
    ] as const
    for (const [path, sha256] of evidence) {
      expect(
        createHash("sha256")
          .update(readFileSync(new URL(path, root)))
          .digest("hex")
          .toUpperCase()
      ).toBe(sha256)
    }
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
      "BP-123 exact application supervisor, W5500 reset pullup, and reset timing closure"
    )
  })

  it("is deeply immutable and rejects forged or drifting imports", () => {
    expect(Object.isFrozen(benchPrototypeEthernet)).toBe(true)
    expect(Object.isFrozen(benchPrototypeEthernet.supportParts)).toBe(true)
    expect(Object.isFrozen(benchPrototypeEthernet.supportParts[0])).toBe(true)
    expect(Object.isFrozen(benchPrototypeEthernetUpstreamProvenance)).toBe(true)
    expect(Object.isFrozen(benchPrototypeEthernetUpstreamProvenance.supportParts)).toBe(true)
    expect(Object.isFrozen(benchPrototypeEthernetUpstreamProvenance.interruptPolicy)).toBe(true)

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

  it("detects live interrupt-policy drift and always restores the support decision", () => {
    const source = ethernetSupportNetwork.w5500.interruptPolicy.bias
    const originalDisposition = source.disposition
    try {
      Reflect.set(source, "disposition", "DNP")
      expect(() => validateBenchPrototypeEthernet(benchPrototypeEthernet)).toThrow(RangeError)
    } finally {
      Reflect.set(source, "disposition", originalDisposition)
    }
    expect(validateBenchPrototypeEthernet(benchPrototypeEthernet)).toBe(true)
  })
})
