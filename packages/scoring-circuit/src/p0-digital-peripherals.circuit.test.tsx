import { describe, expect, it } from "vitest"
import P0DigitalPeripherals from "./p0-digital-peripherals.circuit.js"
import { renderTestCircuit } from "./test-helper.js"

function renderCircuit() {
  return renderTestCircuit(
    <board width="120mm" height="80mm">
      <chip
        name="U_ESP32"
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
      <chip name="U_APP_RESET_FANOUT" pinLabels={{ pin1: "Y2" }} />
      <P0DigitalPeripherals pcbX={0} pcbY={0} />
    </board>,
    { pcbEnabled: false }
  )
}

function traces(circuitJson: ReturnType<typeof renderCircuit>) {
  return circuitJson.flatMap((element) =>
    element.type === "source_trace" && typeof element.display_name === "string" ? [element.display_name] : []
  )
}

describe("P0 digital peripherals", () => {
  it("renders the selected W5500, MagJack, two AHCT buffers, and keyed HUB75 connector without errors", () => {
    const circuitJson = renderCircuit()
    const sourceComponents = circuitJson.filter((element) => element.type === "source_component")
    const names = sourceComponents.map((component) => component.name)

    expect(circuitJson.filter((element) => element.type.includes("error"))).toEqual([])
    expect(names).toEqual(
      expect.arrayContaining(["U_BP033_W5500", "J_ETH", "U_DISPLAY_BUFFER_A", "U_DISPLAY_BUFFER_B", "J_HUB75"])
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
        "U_ESP32.APP_SPI_SCK to U_BP033_W5500.33",
        "U_ESP32.APP_SPI_MOSI to U_BP033_W5500.35",
        "U_BP033_W5500.34 to U_ESP32.APP_SPI_MISO",
        "U_ESP32.ETH_CS_N to U_BP033_W5500.32",
        "U_APP_RESET_FANOUT.Y2 to U_BP033_W5500.37",
        "U_BP033_W5500.36 to TP_W5500_INT_N.APP_W5500_INT_N",
        "U_BP033_W5500.2 to J_ETH.TD_P",
        "U_BP033_W5500.1 to J_ETH.TD_N",
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
      expect(renderedTraces.some((trace) => trace.startsWith(`U_ESP32.${signal} to U_DISPLAY_BUFFER_`))).toBe(true)
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
