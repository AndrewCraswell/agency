import { Circuit } from "tscircuit"
import { describe, expect, it } from "vitest"
import { minimalPrototypeBoard } from "./clean-sheet-board-architecture.js"
import { faveroDataLine } from "./favero-data-line.circuit.js"
import MinimalScoringPrototype, {
  controllerLeftPins,
  controllerRightPins,
  controllerSocket,
  prototypeInterfaces
} from "./index.circuit.js"
import { prototypeIndicators } from "./prototype-indicators.circuit.js"
import { hub75Display, prototypeSounder } from "./prototype-peripherals.circuit.js"
import { scoringConductorChannels } from "./scoring-conductor-interface.circuit.js"
import { usbCPowerAssembly } from "./usb-c-power.circuit.js"

let renderedPrototype: readonly Record<string, unknown>[] | undefined

function renderPrototype() {
  if (renderedPrototype) return renderedPrototype
  const circuit = new Circuit()
  circuit.add(<MinimalScoringPrototype />)
  circuit.render()
  renderedPrototype = circuit.getCircuitJson() as readonly Record<string, unknown>[]
  return renderedPrototype
}

describe("minimal scoring prototype baseline", () => {
  it("uses the fixed small two-layer board boundary", () => {
    expect(minimalPrototypeBoard).toMatchObject({
      widthMm: 160,
      heightMm: 100,
      layerCount: 2,
      maximumPopulatedParts: 60,
      controller: "ESP32-S3-DevKitC-1-N8R2",
      ethernet: "WIZ850io"
    })
  })

  it("uses the N8R2 DevKitC so GPIO35 through GPIO37 remain available", () => {
    expect(controllerLeftPins).toHaveLength(22)
    expect(controllerRightPins).toHaveLength(22)
    expect(controllerRightPins.slice(10, 13)).toEqual(["GPIO37", "GPIO36", "GPIO35"])
    expect(controllerSocket).toMatchObject({ rowSpacingMm: 22.86, outlineWidthMm: 25.4, outlineHeightMm: 69 })
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
        "J_HUB75_DATA",
        "J_HUB75_POWER",
        "LED_LEFT_RED",
        "LED_LEFT_WHITE",
        "LED_RIGHT_GREEN",
        "LED_RIGHT_WHITE",
        "J_FAVERO_DATA_1",
        "J_FAVERO_DATA_2",
        "U_ETHERNET"
      ])
    )
    expect(references).toHaveLength(51)
    expect(references.length).toBeLessThan(minimalPrototypeBoard.maximumPopulatedParts)
    const cadComponents = circuit.filter(({ type }) => type === "cad_component")
    expect(cadComponents).toHaveLength(references.length)
    expect(cadComponents.every(({ model_step_url: stepUrl }) => typeof stepUrl === "string")).toBe(true)
    expect(cadComponents.some(({ model_jscad: jscad }) => jscad !== undefined)).toBe(false)
    expect(prototypeInterfaces.powerInput).toEqual(["USB-C PD 20V", "V5", "APP_GND"])
    expect(prototypeInterfaces.repeaterOutputs).toEqual(["FA-05 DATA-LINE 1", "FA-05 DATA-LINE 2"])
    expect(references.some((reference) => /MUX|ADC|REF|STM32|ISOLAT/iu.test(reference))).toBe(false)
    expect(references).not.toEqual(expect.arrayContaining(["R_ETH_CS_PULLUP", "R_IR_PULLUP"]))
  }, 15_000)

  it("leaves unconnected only pins that are inseparable from purchased modules or packages", () => {
    const circuit = renderPrototype()
    const sourceNames = new Map(
      circuit
        .filter(({ type }) => type === "source_component")
        .map(({ source_component_id: sourceComponentId, name }) => [sourceComponentId, name])
    )
    const connectedPortIds = new Set(
      circuit
        .filter(({ type }) => type === "source_trace")
        .flatMap(({ connected_source_port_ids: portIds }) => (Array.isArray(portIds) ? portIds : []))
    )
    const unconnectedPorts = circuit
      .filter(
        ({ type, source_port_id: sourcePortId }) =>
          type === "source_port" && typeof sourcePortId === "string" && !connectedPortIds.has(sourcePortId)
      )
      .map(
        ({ source_component_id: sourceComponentId, pin_number: pinNumber, name }) =>
          `${String(sourceNames.get(sourceComponentId))}.${String(pinNumber)}:${String(name)}`
      )
      .sort()

    expect(unconnectedPorts).toEqual(
      [
        "J_CONTROLLER_LEFT.14:GPIO46",
        "J_CONTROLLER_RIGHT.14:GPIO0_BOOT",
        "J_CONTROLLER_RIGHT.15:GPIO45",
        "J_CONTROLLER_RIGHT.3:GPIO44_UART_RX",
        "U_ETHERNET.10:NC",
        "U_FAVERO_DATA_1.3:NC",
        "U_FAVERO_DATA_2.3:NC"
      ].sort()
    )
  })

  it("drives left red/white and right green/white scoring lamps from dedicated ESP32 GPIOs", () => {
    expect(prototypeIndicators).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ color: "red", gpio: "GPIO39", role: "left on-target" }),
        expect.objectContaining({ color: "white", gpio: "GPIO47", role: "left off-target" }),
        expect.objectContaining({ color: "green", gpio: "GPIO19", role: "right on-target" }),
        expect.objectContaining({ color: "white", gpio: "GPIO20", role: "right off-target" })
      ])
    )
    const circuit = renderPrototype()
    const components = circuit.filter(({ type }) => type === "source_component")
    expect(components.find(({ name }) => name === "LED_LEFT_RED")).toMatchObject({
      manufacturer_part_number: "WP7113ID"
    })
    expect(components.find(({ name }) => name === "LED_RIGHT_GREEN")).toMatchObject({
      manufacturer_part_number: "WP7113GD"
    })
    expect(components.filter(({ manufacturer_part_number: part }) => part === "WP7113QWC/D")).toHaveLength(2)
    expect(
      components.filter(({ name }) => typeof name === "string" && name.includes("WHITE_LED_PULLDOWN"))
    ).toHaveLength(2)
  })

  it("drives one real 3 V piezo sounder through the existing low-side switch", () => {
    expect(prototypeSounder).toEqual({
      driveFrequencyHz: 4000,
      driveGpio: "GPIO48",
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

  it("drives two isolated FA-05 DATA-LINE current loops from one ESP32 UART", () => {
    expect(faveroDataLine).toEqual({
      connectors: ["J_FAVERO_DATA_1", "J_FAVERO_DATA_2"],
      electricalInterface: "isolated 20 mA current loop",
      gpio: "GPIO43_UART_TX",
      optocoupler: "4N32M",
      pinout: {
        2: "outer loop conductor",
        3: "center data conductor",
        4: "center data conductor",
        5: "outer loop conductor"
      },
      protocol: "Favero FULL-ARM-05 DATA-LINE, 2400 baud, 8N1"
    })
    const components = renderPrototype().filter(({ type }) => type === "source_component")
    expect(components.filter(({ manufacturer_part_number: part }) => part === "4N32M")).toHaveLength(2)
    expect(components.filter(({ manufacturer_part_number: part }) => part === "5520250-2")).toHaveLength(2)
    expect(components.some(({ manufacturer_part_number: part }) => part === "AM26LV31EIPWR")).toBe(false)

    const circuit = renderPrototype()
    const connector = circuit.find(({ type, name }) => type === "source_component" && name === "J_FAVERO_DATA_1")
    const connectorPorts = circuit
      .filter(
        ({ type, source_component_id: sourceComponentId }) =>
          type === "source_port" && sourceComponentId === connector?.source_component_id
      )
      .map(({ name, pin_number: pinNumber }) => ({ name, pinNumber }))
    expect(connectorPorts).toEqual([
      { name: "OUTER_A", pinNumber: 2 },
      { name: "DATA_A", pinNumber: 3 },
      { name: "DATA_B", pinNumber: 4 },
      { name: "OUTER_B", pinNumber: 5 }
    ])
  })

  it("uses a module-level USB-C power chain with real assembly geometry", () => {
    const circuit = renderPrototype()
    expect(usbCPowerAssembly).toMatchObject({
      pdSetting: "20V",
      regulatorModule: "Pololu D36V50F5 5V step-down regulator"
    })

    const sourceComponents = circuit.filter(({ type }) => type === "source_component")
    expect(sourceComponents.find(({ name }) => name === "U_USB_C_PD")).toMatchObject({
      manufacturer_part_number: "5807"
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
    expect(pdMountingHoles).toHaveLength(2)

    const pdSource = sourceComponents.find(({ name }) => name === "U_USB_C_PD")
    const regulatorSource = sourceComponents.find(({ name }) => name === "U_V5_REGULATOR")
    const sourcePorts = circuit.filter(({ type }) => type === "source_port")
    const portId = (sourceComponentId: unknown, name: string) =>
      sourcePorts.find(
        ({ source_component_id: candidateSourceId, name: candidateName }) =>
          candidateSourceId === sourceComponentId && candidateName === name
      )?.source_port_id
    const pdVoutPortId = portId(pdSource?.source_component_id, "PD_VOUT")
    const pdGroundPortId = portId(pdSource?.source_component_id, "APP_GND")
    const regulatorVinPortId = portId(regulatorSource?.source_component_id, "VIN_1")
    const regulatorVin2PortId = portId(regulatorSource?.source_component_id, "VIN_2")
    const regulatorGroundPortId = portId(regulatorSource?.source_component_id, "GND_IN_1")
    const regulatorGround2PortId = portId(regulatorSource?.source_component_id, "GND_IN_2")
    const sourceTraces = circuit.filter(({ type }) => type === "source_trace")

    expect(
      sourcePorts
        .filter(
          ({ source_component_id: sourceComponentId }) => sourceComponentId === regulatorSource?.source_component_id
        )
        .map(({ name }) => name)
    ).toEqual(["VOUT_1", "VOUT_2", "GND_OUT_1", "GND_OUT_2", "GND_IN_1", "GND_IN_2", "VIN_1", "VIN_2"])

    expect(sourceTraces).toContainEqual(
      expect.objectContaining({ connected_source_port_ids: [pdVoutPortId, regulatorVinPortId] })
    )
    expect(sourceTraces).toContainEqual(
      expect.objectContaining({ connected_source_port_ids: [pdVoutPortId, regulatorVin2PortId] })
    )
    expect(sourceTraces).toContainEqual(
      expect.objectContaining({ connected_source_port_ids: [pdGroundPortId, regulatorGroundPortId] })
    )
    expect(sourceTraces).toContainEqual(
      expect.objectContaining({ connected_source_port_ids: [pdGroundPortId, regulatorGround2PortId] })
    )
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
      position: { x: 29.43, y: 0, z: 3.7 },
      model_board_normal_direction: "y+"
    })
    expect(cadByReference.get("U_ETHERNET")).toMatchObject({
      position: { x: -20, y: -32, z: 0.7 },
      model_board_normal_direction: "y+"
    })
    expect(cadByReference.get("U_USB_C_PD")).toMatchObject({
      position: { x: expect.closeTo(-62, 6), y: 34.5, z: 0.7 },
      model_origin_position: { x: 10.16, y: 11.7475, z: 0 }
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
    expect(cadByReference.get("J_FAVERO_DATA_1")).toMatchObject({
      position: { x: 40, y: -43.955, z: 9.337 },
      rotation: { x: 0, y: 0, z: 180 },
      model_board_normal_direction: "y+"
    })
    expect(cadByReference.get("J_FAVERO_DATA_2")).toMatchObject({
      position: { x: 60, y: -43.955, z: 9.337 },
      rotation: { x: 0, y: 0, z: 180 },
      model_board_normal_direction: "y+"
    })
  })

  it("matches the OpenPiste seven-conductor single-resistor topology", () => {
    expect(scoringConductorChannels).toHaveLength(7)
    expect(scoringConductorChannels.map(({ gpio }) => gpio)).toEqual([
      "SCORING_LEFT_A",
      "SCORING_LEFT_B",
      "SCORING_LEFT_C",
      "SCORING_RIGHT_A",
      "SCORING_RIGHT_B",
      "SCORING_RIGHT_C",
      "SCORING_PISTE"
    ])
    expect(scoringConductorChannels.map(({ resistanceOhms }) => resistanceOhms)).toEqual([
      33, 470, 470, 33, 470, 470, 470
    ])
    const references = renderPrototype()
      .filter(({ type }) => type === "source_component")
      .map(({ name }) => name)
    expect(references.filter((reference) => typeof reference === "string" && reference.includes("_SENSE"))).toEqual([])
  })

  it("provides one powered 64x32 HUB75 interface using the ESP32-S3 DMA signal set", () => {
    expect(hub75Display).toEqual({
      connector: "TST-108-02-G-D",
      geometry: "64x32",
      powerConnector: "645004114822",
      scan: "1/16",
      signals: ["R1", "G1", "B1", "R2", "G2", "B2", "A", "B", "C", "D", "CLK", "LAT", "OE"]
    })
    const components = renderPrototype().filter(({ type }) => type === "source_component")
    expect(components.find(({ name }) => name === "J_HUB75_DATA")).toMatchObject({
      manufacturer_part_number: "TST-108-02-G-D"
    })
    expect(components.find(({ name }) => name === "J_HUB75_POWER")).toMatchObject({
      manufacturer_part_number: "645004114822"
    })
  })
})
