import { describe, expect, it } from "vitest"
import { prototypeCarrierArchitecture } from "./clean-sheet-board-architecture.js"

describe("prototype carrier architecture", () => {
  it("defines a roomy four-layer firmware carrier", () => {
    expect(prototypeCarrierArchitecture.board).toEqual({ widthMm: 250, heightMm: 180, layerCount: 4 })
    expect(prototypeCarrierArchitecture.entryPoint).toBe("packages/scoring-circuit/src/index.circuit.tsx")
  })

  it("uses modules for commodity power and Ethernet", () => {
    expect(prototypeCarrierArchitecture.purchasedModules).toEqual([
      "WIZ850io Ethernet",
      "DEV-15801 USB-C PD sink",
      "D36V50F5 5 V regulator"
    ])
  })

  it("keeps scoring and firmware interfaces while excluding production-only circuitry", () => {
    expect(prototypeCarrierArchitecture.customSections).toEqual(
      expect.arrayContaining([
        "seven-conductor scoring acquisition",
        "HUB75 buffers and connector",
        "IR receiver",
        "lamp and buzzer outputs"
      ])
    )
    expect(prototypeCarrierArchitecture.excludedFromPrototype).toEqual(
      expect.arrayContaining([
        "STM32 scoring processor",
        "external ESP32 supervisor or watchdog",
        "production certification and cost optimization"
      ])
    )
  })
})
