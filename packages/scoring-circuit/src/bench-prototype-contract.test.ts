import { describe, expect, it } from "vitest"
import { benchPrototypeContract, validateBenchPrototypeContract } from "./bench-prototype-contract.js"

describe("BP-010 one-board bench prototype contract", () => {
  it("keeps the exact processors, isolated scoring authority, and Ethernet path on one accessible board", () => {
    expect(validateBenchPrototypeContract(benchPrototypeContract)).toBe(true)
    expect(benchPrototypeContract.architecture).toMatchObject({
      boardCount: 1,
      releaseState: "deny",
      status: "prototype-only"
    })
    expect(benchPrototypeContract.domains.scoring).toMatchObject({
      ground: "SCORING_SGND",
      owner: "STM32G474RET3TR"
    })
    expect(benchPrototypeContract.domains.application).toMatchObject({
      ground: "APP_GND",
      owner: "ESP32-S3-WROOM-1U-N16R2"
    })
    expect(benchPrototypeContract.isolationBoundary.crossingParts).toEqual(["ISO7762FDWR", "ISO7721FDR", "NXE1S0505MC"])
    expect(benchPrototypeContract.coLocatedEthernet).toMatchObject({
      controller: "W5500",
      jack: "Würth 7499011121A"
    })
  })

  it("freezes the left-to-right zones, connector edges, and probe access required for bench work", () => {
    expect(benchPrototypeContract.zones.map((zone) => zone.id)).toEqual([
      "fixture-entry",
      "analog-acquisition",
      "scoring-control",
      "isolation-corridor",
      "application-control",
      "power-ethernet-edge",
      "display-edge"
    ])
    expect(benchPrototypeContract.connectorEdges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ edge: "top", id: "J_LAB_INJECTION" }),
        expect.objectContaining({ edge: "right", id: "J_USB_C" }),
        expect.objectContaining({ edge: "left", id: "J_WEAPON_FIXTURE" }),
        expect.objectContaining({ edge: "top", id: "J_STM_SWD" }),
        expect.objectContaining({ edge: "top", id: "J_ESP_SERVICE" }),
        expect.objectContaining({ edge: "right", id: "J_ETHERNET_MAGJACK" }),
        expect.objectContaining({ edge: "right", id: "J_HUB75" })
      ])
    )
    expect(benchPrototypeContract.probeZones.rule).toContain("without removing")
    expect(benchPrototypeContract.planningDrawing).toMatchObject({
      artifactStatus: "provisional zoning coordinates; not a fabrication outline",
      envelope: { width: 300, height: 160 }
    })
    expect(benchPrototypeContract.planningDrawing.zones[3]).toMatchObject({
      id: "isolation-corridor",
      xMin: 145,
      xMax: 165
    })
    expect(benchPrototypeContract.planningDrawing.zones[5]).toMatchObject({
      id: "power-ethernet-edge",
      xMin: 215,
      xMax: 300,
      yMin: 60,
      yMax: 160
    })
    expect(benchPrototypeContract.planningDrawing.zones[6]).toMatchObject({
      id: "display-edge",
      xMin: 215,
      xMax: 300,
      yMin: 0,
      yMax: 60
    })
  })

  it("fixes the panel, USB-C PD, bench injection, fixture, and service interfaces", () => {
    expect(benchPrototypeContract.fixedInterfaces.display).toMatchObject({ productId: "2277", scan: "1/16" })
    expect(benchPrototypeContract.fixedInterfaces.usbCPdPower).toMatchObject({
      receptacleMpn: "Amphenol 10177070-00011LF",
      controllerMpn: "Texas Instruments TPS25730ADREFR",
      ccSbuProtectionMpn: "Texas Instruments TPD4S201TRGRRQ1",
      usb2DataProtectionMpn: "Texas Instruments TPD2EUSB30DRTR",
      vbusTvsMpn: "Texas Instruments TVS2200DRVR",
      reverseProtectionMpn: "Diodes Incorporated B340A-13-F",
      efuseMpn: "Texas Instruments TPS259474ARPWR"
    })
    expect(benchPrototypeContract.fixedInterfaces.usbCPdPower.usb2ServiceData).toContain("ESP32-S3-WROOM-1U-N16R2")
    expect(benchPrototypeContract.fixedInterfaces.usbCPdPower.usb2ServiceData).toContain(
      "one matched 22 ohm series resistor per line"
    )
    expect(benchPrototypeContract.fixedInterfaces.diagnosticInjection).toMatchObject({
      boardHeaderMpn: "Molex 43045-0400",
      mateHousingMpn: "Molex 43025-0400",
      terminalMpn: "Molex 43030-0007",
      voltageV: 20,
      maximumCurrentA: 2.3,
      injectionNode: "LAB_POST_EFUSE_20V",
      normalProductInterface: false
    })
    expect(benchPrototypeContract.fixedInterfaces.usbCPdPower.sourceSelector).toEqual({
      manufacturer: "C&K/Littelfuse",
      mpn: "7101SYZQE",
      topology: "physical SPDT",
      commonNode: "V20_TO_V5_BUCK",
      normalPdNode: "PD_EFUSE_OUT_20V",
      diagnosticNode: "LAB_POST_EFUSE_20V",
      changeOnlyDeenergized: true,
      simultaneousSourcesProhibited: true
    })
    expect(benchPrototypeContract.fixedInterfaces.weaponFixture.scoredConductors).toHaveLength(7)
    expect(benchPrototypeContract.fixedInterfaces.weaponFixture.pins).toHaveLength(12)
    expect(benchPrototypeContract.fixedInterfaces.weaponFixture.pins.slice(-2)).toEqual(["NC", "NC"])
    expect(benchPrototypeContract.fixedInterfaces.stm32Debug.candidateMpn).toBe("Samtec FTSH-105-01-L-DV-K")
    expect(benchPrototypeContract.fixedInterfaces.esp32Service.candidateMpn).toBe("Samtec TSW-106-07-G-S")
  })

  it("fails closed if Ethernet, the isolation boundary, production noninterference, or denied status changes", () => {
    for (const forge of [
      (candidate: typeof benchPrototypeContract) => {
        Reflect.set(candidate.coLocatedEthernet, "controller", "ESP32 internal Ethernet")
      },
      (candidate: typeof benchPrototypeContract) => {
        Reflect.set(candidate.isolationBoundary, "rule", "grounds may join")
      },
      (candidate: typeof benchPrototypeContract) => {
        Reflect.set(candidate.architecture, "releaseState", "allow")
      },
      (candidate: typeof benchPrototypeContract) => {
        Reflect.set(candidate, "productionContractRule", "this replaces the production design")
      }
    ]) {
      const candidate = structuredClone(benchPrototypeContract)
      forge(candidate)
      expect(() => validateBenchPrototypeContract(candidate)).toThrow(RangeError)
    }
  })

  it("rejects malformed, extended, symbolic, and accessor-bearing contracts without reading accessors", () => {
    for (const candidate of [null, [], {}, { ...benchPrototypeContract, unexpected: true }]) {
      expect(() => validateBenchPrototypeContract(candidate)).toThrow(RangeError)
    }

    const symbolic = structuredClone(benchPrototypeContract)
    Reflect.set(symbolic, Symbol("forged"), true)
    expect(() => validateBenchPrototypeContract(symbolic)).toThrow(RangeError)

    const accessor = structuredClone(benchPrototypeContract)
    let getterRead = false
    Object.defineProperty(accessor.architecture, "boardCount", {
      enumerable: true,
      get: () => {
        getterRead = true
        return 1
      }
    })
    expect(() => validateBenchPrototypeContract(accessor)).toThrow(RangeError)
    expect(getterRead).toBe(false)
  })

  it("deep-freezes the canonical graph and rejects array holes, extras, cycles, and aliases", () => {
    expect(Object.isFrozen(benchPrototypeContract)).toBe(true)
    expect(Object.isFrozen(benchPrototypeContract.planningDrawing.zones)).toBe(true)
    expect(Object.isFrozen(benchPrototypeContract.fixedInterfaces.weaponFixture.pins)).toBe(true)

    const hole = structuredClone(benchPrototypeContract)
    Reflect.deleteProperty(hole.planningDrawing.zones, "2")
    expect(() => validateBenchPrototypeContract(hole)).toThrow(RangeError)

    const arrayExtra = structuredClone(benchPrototypeContract)
    Reflect.set(arrayExtra.planningDrawing.zones, "unexpected", true)
    expect(() => validateBenchPrototypeContract(arrayExtra)).toThrow(RangeError)

    class ForgedArray<T> extends Array<T> {}
    const arraySubclass = structuredClone(benchPrototypeContract)
    Object.setPrototypeOf(arraySubclass.domains.application.responsibilities, ForgedArray.prototype)
    expect(() => validateBenchPrototypeContract(arraySubclass)).toThrow(RangeError)

    const hiddenExtra = structuredClone(benchPrototypeContract)
    Object.defineProperty(hiddenExtra.domains, "hidden", { enumerable: false, value: true })
    expect(() => validateBenchPrototypeContract(hiddenExtra)).toThrow(RangeError)

    const cycle = structuredClone(benchPrototypeContract)
    Reflect.set(cycle, "architecture", cycle)
    expect(() => validateBenchPrototypeContract(cycle)).toThrow(RangeError)

    const alias = structuredClone(benchPrototypeContract)
    Reflect.set(alias.planningDrawing.zones, "1", alias.planningDrawing.zones[0])
    expect(() => validateBenchPrototypeContract(alias)).toThrow(RangeError)
  })
})
