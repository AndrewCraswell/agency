import { Circuit } from "tscircuit"
import { describe, expect, it } from "vitest"
import { minimalPrototypeBoard } from "./clean-sheet-board-architecture.js"
import MinimalScoringPrototype, {
  controllerLeftPins,
  controllerRightPins,
  controllerSocket,
  prototypeInterfaces
} from "./index.circuit.js"
import { scoringConductorChannels } from "./scoring-conductor-interface.circuit.js"

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
    expect(controllerSocket).toMatchObject({ rowSpacingMm: 22.86, outlineWidthMm: 25.4, outlineHeightMm: 62.74 })
  })

  it("contains only the required modules, interfaces, and simple support parts", () => {
    const circuit = renderPrototype()
    expect(circuit.filter(({ type }) => typeof type === "string" && type.includes("error"))).toEqual([])
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
        "U_CONTROLLER_MODULE",
        "U_IR_RECEIVER",
        "J_BUZZER",
        "J_DISPLAY",
        "U_ETHERNET"
      ])
    )
    expect(references).toHaveLength(33)
    expect(references.length).toBeLessThan(minimalPrototypeBoard.maximumPopulatedParts)
    expect(prototypeInterfaces.powerInput).toEqual(["V5", "APP_GND"])
    expect(references.some((reference) => /HUB75|MUX|ADC|REF|STM32|ISOLAT/iu.test(reference))).toBe(false)
  })

  it("uses seven current-limited drivers and only five direct ADC sense paths", () => {
    expect(scoringConductorChannels).toHaveLength(7)
    expect(scoringConductorChannels.filter((channel) => "sense" in channel).map(({ conductor }) => conductor)).toEqual([
      "LEFT_B",
      "LEFT_C",
      "RIGHT_B",
      "RIGHT_C",
      "PISTE"
    ])
    expect(scoringConductorChannels.map(({ resistanceOhms }) => resistanceOhms)).toEqual([
      33, 470, 470, 33, 470, 470, 470
    ])
  })
})
