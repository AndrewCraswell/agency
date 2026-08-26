import { describe, expect, it } from "vitest"
import { P0DigitalPeripherals } from "./p0-digital-peripherals.circuit.js"
import { renderTestCircuit } from "./test-helper.js"

type CircuitJson = ReturnType<typeof renderTestCircuit>

let schematicCircuitJson: CircuitJson | undefined
let pcbCircuitJson: CircuitJson | undefined

function renderCircuit(): CircuitJson {
  if (schematicCircuitJson !== undefined) return schematicCircuitJson
  schematicCircuitJson = renderTestCircuit(
    <board width="120mm" height="80mm">
      <chip
        name="U_ESP32"
        doNotPlace
        footprint={[]}
        pinLabels={{
          pin1: "APP_SPI_SCK",
          pin2: "APP_SPI_MOSI",
          pin3: "APP_SPI_MISO",
          pin4: "ETH_CS_N",
          pin5: "HUB75_R1",
          pin6: "HUB75_G1",
          pin7: "HUB75_B1",
          pin8: "HUB75_R2",
          pin9: "HUB75_G2",
          pin10: "HUB75_B2",
          pin11: "HUB75_A",
          pin12: "HUB75_B",
          pin13: "HUB75_C",
          pin14: "HUB75_D",
          pin15: "HUB75_CLK",
          pin16: "HUB75_LAT",
          pin17: "HUB75_OE_N"
        }}
      />
      <chip name="U_APP_RESET_FANOUT" doNotPlace footprint={[]} pinLabels={{ pin1: "Y2" }} />
      <P0DigitalPeripherals pcbX={0} pcbY={0} />
    </board>,
    { pcbEnabled: false }
  )
  return schematicCircuitJson
}

function renderPcbCircuit(): CircuitJson {
  if (pcbCircuitJson !== undefined) return pcbCircuitJson
  pcbCircuitJson = renderTestCircuit(
    <board width="120mm" height="80mm">
      <chip
        name="U_ESP32"
        doNotPlace
        footprint={[]}
        pinLabels={{
          pin1: "APP_SPI_SCK",
          pin2: "APP_SPI_MOSI",
          pin3: "APP_SPI_MISO",
          pin4: "ETH_CS_N",
          pin5: "HUB75_R1",
          pin6: "HUB75_G1",
          pin7: "HUB75_B1",
          pin8: "HUB75_R2",
          pin9: "HUB75_G2",
          pin10: "HUB75_B2",
          pin11: "HUB75_A",
          pin12: "HUB75_B",
          pin13: "HUB75_C",
          pin14: "HUB75_D",
          pin15: "HUB75_CLK",
          pin16: "HUB75_LAT",
          pin17: "HUB75_OE_N"
        }}
      />
      <chip name="U_APP_RESET_FANOUT" doNotPlace footprint={[]} pinLabels={{ pin1: "Y2" }} />
      <P0DigitalPeripherals pcbX={0} pcbY={0} />
    </board>
  )
  return pcbCircuitJson
}

function traces(circuitJson: CircuitJson) {
  return circuitJson.flatMap((element) =>
    element.type === "source_trace" && typeof element.display_name === "string" ? [element.display_name] : []
  )
}

function pcbArtifacts(circuitJson: CircuitJson, reference: string) {
  const source = circuitJson.find((element) => element.type === "source_component" && element.name === reference)
  if (source?.type !== "source_component") throw new RangeError(`missing ${reference}`)
  const pcbComponent = circuitJson.find(
    (element) => element.type === "pcb_component" && element.source_component_id === source.source_component_id
  )
  if (pcbComponent?.type !== "pcb_component") throw new RangeError(`missing ${reference} PCB component`)
  return circuitJson.filter(
    (element) => "pcb_component_id" in element && element.pcb_component_id === pcbComponent.pcb_component_id
  )
}

type CircuitElement = CircuitJson[number]
type PortedPlatedHole = Extract<CircuitElement, { readonly type: "pcb_plated_hole" }> & {
  readonly port_hints: readonly string[]
}

function isPortedPlatedHole(element: CircuitElement): element is PortedPlatedHole {
  return element.type === "pcb_plated_hole" && Array.isArray(element.port_hints)
}

function isRectSmtPad(
  element: CircuitElement
): element is Extract<CircuitElement, { readonly shape: "rect"; readonly type: "pcb_smtpad" }> {
  return element.type === "pcb_smtpad" && element.shape === "rect"
}

function artifactWithPortHint(artifacts: ReturnType<typeof pcbArtifacts>, hint: string): PortedPlatedHole {
  const artifact = artifacts.find((element): element is PortedPlatedHole =>
    isPortedPlatedHole(element) ? element.port_hints.includes(hint) : false
  )
  if (artifact === undefined) throw new RangeError(`missing PCB port ${hint}`)
  return artifact
}

describe("P0 digital peripherals", () => {
  it("renders the selected W5500, MagJack, two AHCT buffers, and keyed HUB75 connector without errors", () => {
    const circuitJson = renderCircuit()
    const sourceComponents = circuitJson.filter((element) => element.type === "source_component")
    const names = sourceComponents.map((component) => component.name)

    expect(circuitJson.filter((element) => element.type.includes("error"))).toEqual([])
    expect(names).toEqual(
      expect.arrayContaining(["U_W5500", "J_ETH", "U_DISPLAY_BUFFER_A", "U_DISPLAY_BUFFER_B", "J_HUB75"])
    )
    expect(JSON.stringify(sourceComponents)).toContain("W5500")
    expect(JSON.stringify(sourceComponents)).toContain("7499011121A")
    expect(JSON.stringify(sourceComponents)).toContain("SN74AHCT245PWR")
    expect(JSON.stringify(sourceComponents)).toContain("TST-108-04-G-D-RA")
  })

  it("uses only the allocated SPI host signals, fanout reset, polling-only interrupt, and on-board MDI", () => {
    const renderedTraces = traces(renderCircuit())

    expect(renderedTraces).toEqual(
      expect.arrayContaining([
        "U_W5500.33 to net.APP_SPI_SCK",
        "U_W5500.35 to net.APP_SPI_MOSI",
        "U_W5500.34 to net.APP_SPI_MISO",
        "U_W5500.32 to net.ETH_CS_N",
        "U_W5500.37 to net.APP_RESET_N",
        "U_W5500.36 to TP_W5500_INT_N.APP_W5500_INT_N",
        "U_W5500.2 to J_ETH.TD_P",
        "U_W5500.1 to J_ETH.TD_N",
        "C_ETH_RX_P.pin2 to J_ETH.RD_P",
        "C_ETH_RX_N.pin2 to J_ETH.RD_N"
      ])
    )
    expect(renderedTraces.some((trace) => trace.includes("U_ESP32") && trace.includes("INT_N"))).toBe(false)
    expect(renderedTraces.some((trace) => trace.includes("U_ESP32") && trace.includes("RST"))).toBe(false)
  })

  it("keeps the RJ45 shield boundary separate from application ground", () => {
    const renderedTraces = traces(renderCircuit())

    expect(renderedTraces).toEqual(
      expect.arrayContaining([
        "J_ETH.CHASSIS_TERMINATION to net.CHASSIS_ETHERNET",
        "J_ETH.SHIELD_A to net.CHASSIS_ETHERNET",
        "J_ETH.SHIELD_B to net.CHASSIS_ETHERNET"
      ])
    )
    expect(renderedTraces.some((trace) => trace.startsWith("J_ETH.SHIELD") && trace.endsWith("net.APP_GND"))).toBe(
      false
    )
  })

  it("renders the retained MagJack holes and ECS suggested land pattern into PCB artifacts", () => {
    const circuitJson = renderPcbCircuit()
    const magJackArtifacts = pcbArtifacts(circuitJson, "J_ETH")
    const crystalArtifacts = pcbArtifacts(circuitJson, "Y_W5500")

    expect(circuitJson.filter((element) => element.type.includes("error"))).toEqual([])
    expect(magJackArtifacts.filter((element) => element.type === "pcb_plated_hole")).toHaveLength(14)
    expect(magJackArtifacts.filter((element) => element.type === "pcb_hole")).toHaveLength(2)
    const txPositive = artifactWithPortHint(magJackArtifacts, "TD_P")
    const txCenterTap = artifactWithPortHint(magJackArtifacts, "CTD")
    const shield = artifactWithPortHint(magJackArtifacts, "SHIELD_A")
    expect(txPositive).toMatchObject({ hole_diameter: 0.9, rect_pad_width: 1.408, rect_pad_height: 1.408 })
    expect(shield).toMatchObject({ hole_diameter: 1.6, rect_pad_width: 2.4, rect_pad_height: 2.4 })
    expect(txCenterTap.x - txPositive.x).toBeCloseTo(1.27)
    expect(txCenterTap.y - txPositive.y).toBeCloseTo(-2.54)
    const nonPlatedHole = magJackArtifacts.find((element) => element.type === "pcb_hole")
    expect(nonPlatedHole).toMatchObject({ hole_diameter: 3.25, hole_shape: "circle" })
    const crystalPads = crystalArtifacts.filter(isRectSmtPad)
    expect(crystalPads).toHaveLength(4)
    expect(crystalPads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ width: 1.3, height: 1.1 }),
        expect.objectContaining({ width: 1.3, height: 1.1 })
      ])
    )
    const crystalPinOne = crystalPads.find((element) => element.port_hints?.includes("XI"))
    const crystalPinThree = crystalPads.find((element) => element.port_hints?.includes("XO"))
    if (crystalPinOne === undefined || crystalPinThree === undefined) {
      throw new RangeError("missing ECS crystal pads")
    }
    expect(crystalPinThree.x - crystalPinOne.x).toBeCloseTo(2.3)
    expect(crystalPinThree.y - crystalPinOne.y).toBeCloseTo(-1.9)
  })

  it("blanks the panel through one reset-only enable gate while every other HUB75 input defaults safe", () => {
    const renderedTraces = traces(renderCircuit())

    for (const signal of [
      "HUB75_R1",
      "HUB75_G1",
      "HUB75_B1",
      "HUB75_R2",
      "HUB75_G2",
      "HUB75_B2",
      "HUB75_A",
      "HUB75_B",
      "HUB75_C",
      "HUB75_D",
      "HUB75_CLK",
      "HUB75_LAT"
    ]) {
      expect(
        renderedTraces.some((trace) => trace.startsWith("U_DISPLAY_BUFFER_") && trace.endsWith(`net.${signal}`))
      ).toBe(true)
      expect(renderedTraces).toContain(`R_${signal}_PD.pin2 to net.APP_GND`)
    }
    expect(renderedTraces).toEqual(
      expect.arrayContaining([
        "R_HUB75_OE_PULLUP.pin2 to net.APP_3V3",
        "U_DISPLAY_BUFFER_A.OE_N to net.DISPLAY_ENABLE_N",
        "U_DISPLAY_BUFFER_B.OE_N to net.DISPLAY_ENABLE_N",
        "Q_DISPLAY_ENABLE.DRAIN to net.DISPLAY_ENABLE_N",
        "R_DISPLAY_ENABLE_GATE.pin1 to net.APP_RESET_N",
        "R_HUB75_PANEL_OE_PULLUP.pin2 to net.V5_DISPLAY_LIMITED"
      ])
    )
    expect(renderedTraces.some((trace) => trace.includes("DISPLAY_ENABLE") && trace.includes("U_ESP32"))).toBe(false)
  })
})
