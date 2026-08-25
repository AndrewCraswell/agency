import { describe, expect, it } from "vitest"
import {
  benchPrototypePrimaryOutputs,
  validateBenchPrototypePrimaryOutputs
} from "./bench-prototype-primary-outputs.js"

describe("P0 primary-output selection", () => {
  it("assigns the allocated ESP32-S3 signals to five separately switched loads", () => {
    expect(validateBenchPrototypePrimaryOutputs(benchPrototypePrimaryOutputs)).toBe(true)
    expect(benchPrototypePrimaryOutputs.authority.scoringOwner).toBe("ESP32-S3-WROOM-1-N16R2")
    expect(benchPrototypePrimaryOutputs.channels).toEqual([
      { channel: "LAMP_RED", connectorCircuit: 1, controllerNet: "ESP32_GPIO7_PRIMARY_LAMP_RED", gpio: 7 },
      { channel: "LAMP_GREEN", connectorCircuit: 2, controllerNet: "ESP32_GPIO15_PRIMARY_LAMP_GREEN", gpio: 15 },
      {
        channel: "LAMP_WHITE_LEFT",
        connectorCircuit: 3,
        controllerNet: "ESP32_GPIO17_PRIMARY_LAMP_WHITE_LEFT",
        gpio: 17
      },
      {
        channel: "LAMP_WHITE_RIGHT",
        connectorCircuit: 4,
        controllerNet: "ESP32_GPIO10_PRIMARY_LAMP_WHITE_RIGHT",
        gpio: 10
      },
      { channel: "BUZZER", connectorCircuit: 5, controllerNet: "ESP32_GPIO11_PRIMARY_BUZZER", gpio: 11 }
    ])
    expect(benchPrototypePrimaryOutputs.outputDriver.array).toMatchObject({
      count: 1,
      mpn: "TBD62783AFWG",
      usedChannels: 5,
      unusedChannels: 3
    })
  })

  it("selects bounded 5 V bench loads and leaves FIE physical qualification for bring-up", () => {
    expect(benchPrototypePrimaryOutputs.loadEnvelope).toMatchObject({
      supplyMinimumV: 4.75,
      supplyMaximumV: 5.25,
      normalAggregateCurrentMaximumA: 0.11,
      protectedAggregateCurrentMaximumA: 0.15,
      measuredAggregateInrushAcceptanceA: 0.15
    })
    expect(benchPrototypePrimaryOutputs.loads).toMatchObject({
      red: { mpn: "WP7113ID", seriesResistanceOhm: 180 },
      green: { mpn: "WP7113SGD", seriesResistanceOhm: 180 },
      white: { count: 2, mpn: "WP7113QWC/D", seriesResistanceOhm: 180 },
      buzzer: { mpn: "CMI-9605-0580T", operatingVoltageRangeV: [3, 7] }
    })
    expect(benchPrototypePrimaryOutputs.fieDisposition.physicalQualification).toBe("required during bring-up")
  })

  it("uses a keyed six-conductor cable with a dedicated shared return", () => {
    expect(benchPrototypePrimaryOutputs.connectorAndCable).toMatchObject({
      connector: { headerMpn: "39-29-1067", matingHousingMpn: "39-01-2060", terminalMpn: "39-00-0039" },
      cable: { mpn: "1176C SL005", maximumLengthM: 3 }
    })
    expect(benchPrototypePrimaryOutputs.connectorAndCable.cable.conductors).toEqual([
      { circuit: 1, color: "red", function: "red lamp anode feed" },
      { circuit: 2, color: "green", function: "green lamp anode feed" },
      { circuit: 3, color: "white", function: "left white lamp anode feed" },
      { circuit: 4, color: "orange", function: "right white lamp anode feed" },
      { circuit: 5, color: "blue", function: "buzzer positive feed" },
      { circuit: 6, color: "black", function: "shared APP_GND return" }
    ])
  })

  it("fails safe during reset and records the open short reverse and thermal limits", () => {
    expect(benchPrototypePrimaryOutputs.outputDriver.resetDefault).toContain("100 kilohm pull-down")
    expect(benchPrototypePrimaryOutputs.resetAndFaultBehavior.resetDefault).toContain("de-energized")
    expect(benchPrototypePrimaryOutputs.resetAndFaultBehavior.openLoad).toContain("No load-monitoring claim")
    expect(benchPrototypePrimaryOutputs.resetAndFaultBehavior.shortCircuit).toContain("0.2 A PPTC")
    expect(benchPrototypePrimaryOutputs.resetAndFaultBehavior.reverseConnection).toContain("not claimed")
    expect(benchPrototypePrimaryOutputs.resetAndFaultBehavior.thermal).toContain("remove power")
  })

  it("rejects clones and remains immutable", () => {
    expect(() => validateBenchPrototypePrimaryOutputs(structuredClone(benchPrototypePrimaryOutputs))).toThrow(
      RangeError
    )
    expect(() => Object.defineProperty(benchPrototypePrimaryOutputs.loads.red, "mpn", { value: "forged" })).toThrow(
      TypeError
    )
  })
})
