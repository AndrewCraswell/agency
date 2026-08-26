import { Circuit } from "tscircuit"
import { describe, expect, it } from "vitest"
import { minimalPrototypeBoard } from "./clean-sheet-board-architecture.js"
import MinimalScoringPrototype, {
  controllerLeftPins,
  controllerRightPins,
  controllerSocket,
  prototypeInterfaces
} from "./index.circuit.js"
import { prototypeIndicators } from "./prototype-indicators.circuit.js"
import { prototypeSounder } from "./prototype-peripherals.circuit.js"
import { scoringConductorChannels } from "./scoring-conductor-interface.circuit.js"
import { usbCPowerAssembly } from "./usb-c-power.circuit.js"

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
        "U_USB_C_PD",
        "U_V5_REGULATOR",
        "U_CONTROLLER_MODULE",
        "U_IR_RECEIVER",
        "BZ_SCORING",
        "J_DISPLAY",
        "LED_LEFT_RED",
        "LED_RIGHT_GREEN",
        "U_ETHERNET"
      ])
    )
    expect(references).toHaveLength(38)
    expect(references.length).toBeLessThan(minimalPrototypeBoard.maximumPopulatedParts)
    const cadComponents = circuit.filter(({ type }) => type === "cad_component")
    expect(cadComponents).toHaveLength(references.length)
    expect(cadComponents.every(({ model_step_url: stepUrl }) => typeof stepUrl === "string")).toBe(true)
    expect(cadComponents.some(({ model_jscad: jscad }) => jscad !== undefined)).toBe(false)
    expect(prototypeInterfaces.powerInput).toEqual(["USB-C PD 20V", "V5", "APP_GND"])
    expect(references.some((reference) => /HUB75|MUX|ADC|REF|STM32|ISOLAT/iu.test(reference))).toBe(false)
  })

  it("drives one red and one green bench indicator from unused ESP32 GPIOs", () => {
    expect(prototypeIndicators).toEqual([
      expect.objectContaining({ color: "red", gpio: "GPIO42", manufacturerPartNumber: "WP7113ID" }),
      expect.objectContaining({ color: "green", gpio: "GPIO41", manufacturerPartNumber: "WP7113GD" })
    ])
    const circuit = renderPrototype()
    const components = circuit.filter(({ type }) => type === "source_component")
    expect(components.find(({ name }) => name === "LED_LEFT_RED")).toMatchObject({
      manufacturer_part_number: "WP7113ID"
    })
    expect(components.find(({ name }) => name === "LED_RIGHT_GREEN")).toMatchObject({
      manufacturer_part_number: "WP7113GD"
    })
  })

  it("drives one real 3 V piezo sounder through the existing low-side switch", () => {
    expect(prototypeSounder).toEqual({
      driveFrequencyHz: 4000,
      driveGpio: "GPIO39",
      manufacturerPartNumber: "PS1240P02BT",
      ratedDrive: "3V(0-p) square wave",
      supply: "APP_3V3"
    })
    const circuit = renderPrototype()
    const components = circuit.filter(({ type }) => type === "source_component")
    expect(components.find(({ name }) => name === "BZ_SCORING")).toMatchObject({
      manufacturer_part_number: "PS1240P02BT"
    })
    expect(components.some(({ name }) => name === "J_BUZZER")).toBe(false)
  })

  it("uses a module-level USB-C power chain with real assembly geometry", () => {
    const circuit = renderPrototype()
    expect(usbCPowerAssembly).toMatchObject({
      pdSetting: "20V",
      regulatorModule: "Pololu D36V50F5 5V step-down regulator"
    })

    const sourceComponents = circuit.filter(({ type }) => type === "source_component")
    expect(sourceComponents.find(({ name }) => name === "U_USB_C_PD")).toMatchObject({
      manufacturer_part_number: "5991"
    })
    expect(sourceComponents.find(({ name }) => name === "U_V5_REGULATOR")).toMatchObject({
      manufacturer_part_number: "D36V50F5"
    })
    const pdMountingHoles = circuit.filter(
      ({ type, pcb_component_id: pcbComponentId }) =>
        type === "pcb_hole" &&
        circuit.some(
          ({ type: candidateType, source_component_id: sourceComponentId, pcb_component_id: candidatePcbId }) =>
            candidateType === "pcb_component" &&
            candidatePcbId === pcbComponentId &&
            sourceComponents.some(
              ({ source_component_id: candidateSourceId, name }) =>
                candidateSourceId === sourceComponentId && name === "U_USB_C_PD"
            )
        )
    )
    expect(pdMountingHoles).toHaveLength(4)
  })

  it("applies the vendor STEP coordinate transforms used by the assembled board", () => {
    const circuit = renderPrototype()
    const sourceNames = new Map(
      circuit
        .filter(({ type }) => type === "source_component")
        .map(({ source_component_id: sourceComponentId, name }) => [sourceComponentId, name])
    )
    const cadByReference = new Map(
      circuit
        .filter(({ type }) => type === "cad_component")
        .map((component) => [sourceNames.get(component.source_component_id), component])
    )

    expect(cadByReference.get("J_CONTROLLER_LEFT")).toMatchObject({
      position: { x: 18, y: 0, z: 0.7 },
      rotation: { x: 0, y: 0, z: 0 }
    })
    expect(cadByReference.get("U_CONTROLLER_MODULE")).toMatchObject({
      position: { x: 29.43, y: 18.62, z: 8.7 },
      model_origin_position: { x: 9, y: 12.75, z: 0 }
    })
    expect(cadByReference.get("U_ETHERNET")).toMatchObject({
      position: { x: -20, y: -32, z: 0.7 },
      model_board_normal_direction: "y+"
    })
    expect(cadByReference.get("U_USB_C_PD")).toMatchObject({
      position: { x: expect.closeTo(-62, 6), y: 34.5, z: 6.7 },
      model_origin_position: { x: 10.16, y: 13.9065, z: 0 }
    })
    expect(cadByReference.get("U_V5_REGULATOR")).toMatchObject({
      position: { x: expect.closeTo(-34, 6), y: expect.closeTo(34, 6), z: 6.7 },
      model_origin_position: { x: 12.7, y: 12.7, z: 0 }
    })
    expect(cadByReference.get("U_IR_RECEIVER")).toMatchObject({
      position: { x: 67, y: 34.55, z: 0.7 },
      rotation: { x: 0, y: 0, z: 180 },
      model_board_normal_direction: "y+"
    })
    expect(cadByReference.get("LED_LEFT_RED")).toMatchObject({
      model_board_normal_direction: "x-",
      model_origin_position: { x: 446.187838274769, y: 127.91233816873, z: -0.25 }
    })
    expect(cadByReference.get("J_WEAPON_LEFT")).toMatchObject({
      position: { x: -68, y: -15, z: 0.7 },
      rotation: { x: 0, y: 0, z: 270 }
    })
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
