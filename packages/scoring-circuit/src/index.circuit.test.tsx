import { Circuit } from "tscircuit"
import { describe, expect, it } from "vitest"
import { minimalPrototypeBoard } from "./clean-sheet-board-architecture.js"
import MinimalScoringPrototype, {
  controllerLeftPins,
  controllerRightPins,
  prototypeInterfaces
} from "./index.circuit.js"

function renderPrototype() {
  const circuit = new Circuit()
  circuit.add(<MinimalScoringPrototype />)
  circuit.render()
  return circuit.getCircuitJson() as readonly Record<string, unknown>[]
}

describe("minimal scoring prototype baseline", () => {
  it("uses the fixed small two-layer board boundary", () => {
    expect(minimalPrototypeBoard).toMatchObject({
      widthMm: 160,
      heightMm: 100,
      layerCount: 2,
      maximumPopulatedParts: 60,
      controller: "ESP32-S3-DevKitC-1-N8R8",
      ethernet: "WIZ850io"
    })
  })

  it("exposes both official 22-pin DevKitC socket rows without using reserved PSRAM pins", () => {
    expect(controllerLeftPins).toHaveLength(22)
    expect(controllerRightPins).toHaveLength(22)
    expect(controllerRightPins.slice(10, 13)).toEqual(["RESERVED_GPIO37", "RESERVED_GPIO36", "RESERVED_GPIO35"])
  })

  it("contains only the required module sockets and external interfaces", () => {
    const circuit = renderPrototype()
    const references = circuit
      .filter(({ type }) => type === "source_component")
      .map(({ name }) => name)
      .filter((name): name is string => typeof name === "string")

    expect(references).toEqual(
      expect.arrayContaining([
        "J_CONTROLLER_LEFT",
        "J_CONTROLLER_RIGHT",
        "J_WEAPON_LEFT",
        "J_WEAPON_RIGHT",
        "J_PISTE",
        "J_POWER_INPUT",
        "J_DISPLAY_POWER",
        "J_IR",
        "J_BUZZER",
        "J_HUB75",
        "U_ETHERNET"
      ])
    )
    expect(references).toHaveLength(11)
    expect(references.length).toBeLessThan(minimalPrototypeBoard.maximumPopulatedParts)
    expect(prototypeInterfaces.hub75).toHaveLength(16)
  })
})
