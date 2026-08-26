import { describe, expect, it } from "vitest"
import { ethernetModule, ethernetModulePins } from "./ethernet-module-footprint.js"
import { P0DigitalPeripherals } from "./p0-digital-peripherals.circuit.js"
import { renderTestCircuit } from "./test-helper.js"

type CircuitJson = ReturnType<typeof renderTestCircuit>

let schematicCircuitJson: CircuitJson | undefined
let pcbCircuitJson: CircuitJson | undefined

function renderCircuit(): CircuitJson {
  if (schematicCircuitJson !== undefined) return schematicCircuitJson
  schematicCircuitJson = renderTestCircuit(
    <board width="140mm" height="120mm">
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
      <P0DigitalPeripherals pcbX={0} pcbY={0} ethernet={{ pcbX: -5, pcbY: 0 }} hub75={{ pcbX: 42, pcbY: 0 }} />
    </board>,
    { pcbEnabled: false }
  )
  return schematicCircuitJson
}

function renderPcbCircuit(): CircuitJson {
  if (pcbCircuitJson !== undefined) return pcbCircuitJson
  pcbCircuitJson = renderTestCircuit(
    <board width="140mm" height="120mm">
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
      <P0DigitalPeripherals pcbX={0} pcbY={0} ethernet={{ pcbX: -5, pcbY: 0 }} hub75={{ pcbX: 42, pcbY: 0 }} />
    </board>
  )
  return pcbCircuitJson
}

function traces(circuitJson: CircuitJson) {
  return circuitJson.flatMap((element) =>
    element.type === "source_trace" && typeof element.display_name === "string" ? [element.display_name] : []
  )
}

function sourceComponents(circuitJson: CircuitJson) {
  return circuitJson.filter((element) => element.type === "source_component")
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

function artifactWithPortHint(artifacts: ReturnType<typeof pcbArtifacts>, hint: string): PortedPlatedHole {
  const artifact = artifacts.find((element): element is PortedPlatedHole =>
    isPortedPlatedHole(element) ? element.port_hints.includes(hint) : false
  )
  if (artifact === undefined) throw new RangeError(`missing PCB port ${hint}`)
  return artifact
}

describe("P0 digital peripherals", () => {
  it("renders one WIZ850io module, two HUB75 buffers, and the keyed HUB75 connector without errors", () => {
    const circuitJson = renderCircuit()
    const names = sourceComponents(circuitJson).map((component) => component.name)

    expect(circuitJson.filter((element) => element.type.includes("error"))).toEqual([])
    expect(names).toEqual(expect.arrayContaining(["U_ETHERNET", "U_DISPLAY_BUFFER_A", "U_DISPLAY_BUFFER_B", "J_HUB75"]))
    expect(names).not.toEqual(expect.arrayContaining(["U_W5500", "J_ETH", "Y_W5500"]))
    expect(names.some((name) => /^(FB_W5500|R_W5500|C_W5500|R_ETH|C_ETH|TP_W5500)/.test(name))).toBe(false)
    expect(JSON.stringify(sourceComponents(circuitJson))).toContain("WIZ850io")
    expect(JSON.stringify(sourceComponents(circuitJson))).not.toContain("7499011121A")
    expect(JSON.stringify(sourceComponents(circuitJson))).toContain("SN74AHCT245PWR")
  })

  it("maps the WIZ850io headers to the allocated SPI, reset, power, and ground nets", () => {
    const renderedTraces = traces(renderCircuit())

    expect(renderedTraces).toEqual(
      expect.arrayContaining([
        "U_ETHERNET.4 to net.APP_SPI_SCK",
        "U_ETHERNET.3 to net.APP_SPI_MOSI",
        "U_ETHERNET.12 to net.APP_SPI_MISO",
        "U_ETHERNET.5 to net.ETH_CS_N",
        "U_ETHERNET.11 to net.APP_RESET_N",
        "U_ETHERNET.1 to net.APP_GND",
        "U_ETHERNET.2 to net.APP_GND",
        "U_ETHERNET.7 to net.APP_GND",
        "U_ETHERNET.8 to net.APP_3V3",
        "U_ETHERNET.9 to net.APP_3V3"
      ])
    )
    expect(renderedTraces.some((trace) => trace.includes("U_W5500") || trace.includes("J_ETH."))).toBe(false)
  })

  it("renders the official two-header WIZ850io socket pattern", () => {
    const circuitJson = renderPcbCircuit()
    const moduleArtifacts = pcbArtifacts(circuitJson, "U_ETHERNET")
    const holes = moduleArtifacts.filter(isPortedPlatedHole)

    expect(circuitJson.filter((element) => element.type.includes("error"))).toEqual([])
    expect(ethernetModule.manufacturerPartNumber).toBe("WIZ850io")
    expect(ethernetModulePins).toHaveLength(12)
    expect(holes).toHaveLength(12)
    expect(artifactWithPortHint(moduleArtifacts, "J1.1")).toMatchObject({
      hole_diameter: 1,
      rect_pad_width: 1.7,
      rect_pad_height: 1.7,
      port_hints: expect.arrayContaining(["APP_GND"])
    })
    const j1PinOne = artifactWithPortHint(moduleArtifacts, "J1.1")
    const j1Int = artifactWithPortHint(moduleArtifacts, "J1.6")
    const j2Miso = artifactWithPortHint(moduleArtifacts, "J2.6")
    expect(j1Int).toMatchObject({ port_hints: expect.arrayContaining(["APP_W5500_INT_N"]) })
    expect(traces(renderCircuit()).some((trace) => trace.includes("APP_W5500_INT_N"))).toBe(false)
    expect(j2Miso).toMatchObject({ port_hints: expect.arrayContaining(["APP_SPI_MISO"]) })
    expect(j1Int.x).toBeCloseTo(j1PinOne.x)
    expect(j1Int.y - j1PinOne.y).toBeCloseTo(12.7)
    expect(j2Miso.x - j1PinOne.x).toBeCloseTo(20.32)
  })

  it("retains the HUB75 safe defaults and reset-only enable gate", () => {
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
