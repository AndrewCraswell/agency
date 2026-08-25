import { describe, expect, it } from "vitest"
import P0Esp32SupportCircuit from "./p0-esp32-support.circuit.js"
import { renderTestCircuit } from "./test-helper.js"

function renderCircuit() {
  return renderTestCircuit(
    <board width="140mm" height="120mm">
      <P0Esp32SupportCircuit pcbX={0} pcbY={-28} />
    </board>
  )
}

function traces(circuitJson: ReturnType<typeof renderCircuit>) {
  return circuitJson.flatMap((element) =>
    element.type === "source_trace" && typeof element.display_name === "string" ? [element.display_name] : []
  )
}

describe("P0 ESP32 support circuit", () => {
  it("PCB-renders the selected module and support block without errors", () => {
    const circuitJson = renderCircuit()
    expect(circuitJson.filter((element) => element.type.includes("error"))).toEqual([])
    const components = circuitJson.filter((element) => element.type === "source_component")
    expect(components.map((component) => component.name)).toEqual(
      expect.arrayContaining([
        "U_APP",
        "C_ESP_3V3_HF",
        "C_ESP_3V3_BULK",
        "U_APP_SUPERVISOR",
        "U_APP_WATCHDOG",
        "TP_RECOVERY_APP_3V3"
      ])
    )
  })

  it("connects bypass, reset, watchdog, USB, and recovery boundaries", () => {
    const renderedTraces = traces(renderCircuit())
    expect(renderedTraces).toEqual(
      expect.arrayContaining([
        "U_APP.APP_3V3 to C_ESP_3V3_HF.pin1",
        "C_ESP_3V3_HF.pin2 to net.APP_GND",
        "U_APP.EN_RESET to net.APP_RESET_N",
        "U_APP.APP_WD_KICK to U_APP_WATCHDOG.APP_WD_KICK",
        "U_APP.USB_DN to net.USB_DN",
        "U_APP.USB_DP to net.USB_DP",
        "U_APP.UART0_RX to TP_UART0_RX.UART0_RX",
        "U_APP.UART0_TX to TP_UART0_TX.UART0_TX",
        "U_APP.BOOT_N to TP_BOOT_N.BOOT_N"
      ])
    )
  })

  it("exports every assigned GPIO boundary while leaving the three spares and strap NC unconnected", () => {
    const renderedTraces = traces(renderCircuit())
    for (const signal of [
      "SAR_SCLK",
      "SAR_DOUT",
      "SAR_CONVST",
      "LAMP_RED",
      "LAMP_GREEN",
      "LAMP_WHITE_LEFT",
      "LAMP_WHITE_RIGHT",
      "BUZZER",
      "APP_SPI_SCK",
      "APP_SPI_MOSI",
      "APP_SPI_MISO",
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
      "HUB75_LAT",
      "HUB75_OE_N",
      "IR_RX",
      "ETH_CS_N",
      "SOURCE_LATCH",
      "SOURCE_OE_N"
    ]) {
      expect(renderedTraces).toContain(`U_APP.${signal} to net.${signal}`)
    }
    for (const reserved of ["NC_STRAP_QUIET", "P0_SPARE_GPIO37"]) {
      expect(renderedTraces.some((trace) => trace.includes(`U_APP.${reserved}`))).toBe(false)
    }
  })
})
