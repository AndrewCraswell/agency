import { describe, expect, it } from "vitest"
import {
  benchPrototypeHub75Connector,
  validateBenchPrototypeHub75Connector
} from "./bench-prototype-hub75-connector.js"

describe("BP-143 HUB75 connector and panel mating contract", () => {
  it("freezes the exact signal and power mating selections", () => {
    expect(validateBenchPrototypeHub75Connector(benchPrototypeHub75Connector)).toBe(true)
    expect(benchPrototypeHub75Connector.boardConnector).toMatchObject({
      manufacturer: "Samtec",
      mpn: "TST-108-04-G-D-RA",
      positions: 16,
      rows: 2,
      pitchMm: 2.54,
      orientation: "right-angle",
      mounting: "through-hole",
      contactCurrentRatingA: 3.4
    })
    expect(benchPrototypeHub75Connector.signalCable).toMatchObject({
      manufacturer: "Adafruit Industries",
      productId: "4170",
      conductorCount: 16,
      lengthIn: 12,
      pinOneMarker: "white stripe"
    })
    expect(benchPrototypeHub75Connector.powerCable).toMatchObject({
      manufacturer: "Adafruit Industries",
      productId: "4767",
      panelSideHousingMpn: "SMR-04V-N",
      cableSideHousingMpn: "SMP-04V-NC",
      panelSideContactMpn: "SYM-001T-P0.6",
      cableSideContactMpn: "SHF-001T-0.8BS",
      contactCurrentRatingA: 3,
      panelPublishedMaximumCurrentA: 4,
      connectorCount: 2
    })
  })

  it("maps all 13 signals and keeps V5 and grounds on the declared separate paths", () => {
    expect(benchPrototypeHub75Connector.boardConnector.pinLabels).toEqual([
      "R1",
      "G1",
      "B1",
      "GND1",
      "R2",
      "G2",
      "B2",
      "GND2",
      "A",
      "B",
      "C",
      "D",
      "CLK",
      "LAT",
      "OE",
      "GND3"
    ])
    expect(benchPrototypeHub75Connector.signalPath.map).toHaveLength(13)
    expect(benchPrototypeHub75Connector.signalPath.map).toEqual([
      { esp32Gpio: 13, esp32Signal: "HUB75_R1", panelPin: "R1", panelPinNumber: 1 },
      { esp32Gpio: 14, esp32Signal: "HUB75_G1", panelPin: "G1", panelPinNumber: 2 },
      { esp32Gpio: 21, esp32Signal: "HUB75_B1", panelPin: "B1", panelPinNumber: 3 },
      { esp32Gpio: 16, esp32Signal: "HUB75_R2", panelPin: "R2", panelPinNumber: 5 },
      { esp32Gpio: 38, esp32Signal: "HUB75_G2", panelPin: "G2", panelPinNumber: 6 },
      { esp32Gpio: 39, esp32Signal: "HUB75_B2", panelPin: "B2", panelPinNumber: 7 },
      { esp32Gpio: 40, esp32Signal: "HUB75_A", panelPin: "A", panelPinNumber: 9 },
      { esp32Gpio: 41, esp32Signal: "HUB75_B", panelPin: "B", panelPinNumber: 10 },
      { esp32Gpio: 42, esp32Signal: "HUB75_C", panelPin: "C", panelPinNumber: 11 },
      { esp32Gpio: 45, esp32Signal: "HUB75_D", panelPin: "D", panelPinNumber: 12 },
      { esp32Gpio: 46, esp32Signal: "HUB75_CLK", panelPin: "CLK", panelPinNumber: 13 },
      { esp32Gpio: 48, esp32Signal: "HUB75_LAT", panelPin: "LAT", panelPinNumber: 14 },
      { esp32Gpio: 1, esp32Signal: "HUB75_OE_N", panelPin: "OE", panelPinNumber: 15 }
    ])
    expect(benchPrototypeHub75Connector.signalCable.pinMap).toHaveLength(16)
    expect(benchPrototypeHub75Connector.powerCable.pinMap).toEqual([
      { cablePin: 1, conductorColor: "red", net: "V5_DISPLAY_LIMITED", purpose: "panel V5" },
      { cablePin: 2, conductorColor: "red", net: "V5_DISPLAY_LIMITED", purpose: "panel V5" },
      { cablePin: 3, conductorColor: "black", net: "APP_GND", purpose: "panel power return" },
      { cablePin: 4, conductorColor: "black", net: "APP_GND", purpose: "panel power return" }
    ])
    expect(benchPrototypeHub75Connector.powerPath).toMatchObject({
      supplyNet: "V5_DISPLAY_LIMITED",
      returnNet: "APP_GND",
      displayDisconnectReference: "J_DISPLAY_DISCONNECT",
      measurementLinkReference: "J_LINK_DISPLAY",
      measurementLinkContactProjectScreenA: 6,
      removeOnlyWhileDeenergized: true,
      signalGroundsDoNotCarryPanelCurrent: true
    })
  })

  it("records purchase and continuity as open instead of claiming hardware evidence", () => {
    expect(benchPrototypeHub75Connector.evidence).toMatchObject({
      purchasedPanel: { status: "open", physicalPresenceVerified: false, receiptOrSerialRecord: null },
      signalContinuity: { status: "open", measured: false, archiveRecord: null },
      powerContinuity: { status: "open", measured: false, archiveRecord: null },
      matingAndOrientation: { status: "open", measured: false, archiveRecord: null },
      currentAndTemperature: { status: "open", measured: false, archiveRecord: null }
    })
    expect(benchPrototypeHub75Connector.authority).toEqual({
      exactSelectionFrozen: true,
      schematicIntegrationApproved: false,
      footprintApproved: false,
      layoutApproved: false,
      purchasedPanelVerified: false,
      continuityVerified: false,
      currentRatingVerified: false,
      fabricationAuthorized: false,
      releaseState: "deny"
    })
    expect(benchPrototypeHub75Connector.fabricationDisposition).toBe("DENY")
  })

  it("rejects substitutions, evidence forgery, aliases, accessors, and extra keys", () => {
    const substitution = structuredClone(benchPrototypeHub75Connector) as typeof benchPrototypeHub75Connector
    Reflect.set(substitution.boardConnector, "mpn", "FAKE")
    expect(() => validateBenchPrototypeHub75Connector(substitution)).toThrow(RangeError)

    const forgedEvidence = structuredClone(benchPrototypeHub75Connector) as typeof benchPrototypeHub75Connector
    Reflect.set(forgedEvidence.evidence.purchasedPanel, "physicalPresenceVerified", true)
    expect(() => validateBenchPrototypeHub75Connector(forgedEvidence)).toThrow(RangeError)

    const alias = structuredClone(benchPrototypeHub75Connector) as {
      signalCable: typeof benchPrototypeHub75Connector.signalCable
      powerCable: typeof benchPrototypeHub75Connector.powerCable
    }
    alias.signalCable = alias.powerCable as never
    expect(() => validateBenchPrototypeHub75Connector(alias)).toThrow(RangeError)

    const extra = structuredClone(benchPrototypeHub75Connector) as Record<string, unknown>
    extra.unreviewed = true
    expect(() => validateBenchPrototypeHub75Connector(extra)).toThrow(RangeError)

    const accessor = structuredClone(benchPrototypeHub75Connector)
    Object.defineProperty(accessor, "task", { get: () => "BP-143" })
    expect(() => validateBenchPrototypeHub75Connector(accessor)).toThrow(RangeError)
  })

  it("remains immutable", () => {
    expect(Object.isFrozen(benchPrototypeHub75Connector)).toBe(true)
    expect(Object.isFrozen(benchPrototypeHub75Connector.boardConnector)).toBe(true)
    expect(Object.isFrozen(benchPrototypeHub75Connector.signalCable.pinMap)).toBe(true)
    expect(Object.isFrozen(benchPrototypeHub75Connector.powerCable.pinMap)).toBe(true)
    expect(Object.isFrozen(benchPrototypeHub75Connector.evidence)).toBe(true)
  })
})
