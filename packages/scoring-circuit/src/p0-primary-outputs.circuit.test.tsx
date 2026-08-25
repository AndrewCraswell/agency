import { createElement } from "react"
import { describe, expect, it } from "vitest"
import P0PrimaryOutputsCircuit, { p0PrimaryOutputsCircuitContract } from "./p0-primary-outputs.circuit.js"
import { renderTestCircuit } from "./test-helper.js"

function renderCircuit() {
  return renderTestCircuit(createElement(P0PrimaryOutputsCircuit), { pcbEnabled: true })
}

function sourceComponents() {
  return renderCircuit().flatMap((element) =>
    element.type === "source_component" && typeof element.name === "string" ? [element] : []
  )
}

function component(name: string) {
  return sourceComponents().find((candidate) => candidate.name === name)
}

function traces() {
  return renderCircuit().flatMap((element) =>
    element.type === "source_trace" && typeof element.display_name === "string" ? [element.display_name] : []
  )
}

describe("P0 primary lamp and buzzer outputs", () => {
  it("renders the exact source driver, shared PPTC, ESD array, connector, loads, and ballasts on PCB", () => {
    const circuit = renderCircuit()
    const renderedComponents = sourceComponents()

    expect(circuit.filter((element) => element.type.endsWith("_error"))).toEqual([])
    expect(component("U_P0_OUTPUT_DRIVER")).toMatchObject({ manufacturer_part_number: "TBD62783AFWG" })
    expect(component("F_P0_OUTPUTS")).toMatchObject({ manufacturer_part_number: "1206L020YR" })
    expect(component("U_P0_OUTPUT_ESD")).toMatchObject({ manufacturer_part_number: "TPD6E05U06RVZR" })
    expect(component("J_PRIMARY_OUTPUTS")).toMatchObject({ manufacturer_part_number: "39-29-1067" })
    expect(renderedComponents.map((component) => component.name)).toEqual(
      expect.arrayContaining([
        "R_P0_RED_INPUT_PD",
        "R_P0_GREEN_INPUT_PD",
        "R_P0_WHITE_LEFT_INPUT_PD",
        "R_P0_WHITE_RIGHT_INPUT_PD",
        "R_P0_BUZZER_INPUT_PD",
        "R_P0_RED_BALLAST",
        "R_P0_GREEN_BALLAST",
        "R_P0_WHITE_LEFT_BALLAST",
        "R_P0_WHITE_RIGHT_BALLAST",
        "D_P0_RED",
        "D_P0_GREEN",
        "D_P0_WHITE_LEFT",
        "D_P0_WHITE_RIGHT",
        "BZ_P0"
      ])
    )
    expect(circuit.filter((element) => element.type === "pcb_component")).toHaveLength(renderedComponents.length)
  })

  it("binds the allocated ESP32 GPIO signals through five default-low inputs to the five harness circuits", () => {
    expect(p0PrimaryOutputsCircuitContract.gpioOrder).toEqual([
      "ESP32_GPIO7_PRIMARY_LAMP_RED",
      "ESP32_GPIO15_PRIMARY_LAMP_GREEN",
      "ESP32_GPIO17_PRIMARY_LAMP_WHITE_LEFT",
      "ESP32_GPIO10_PRIMARY_LAMP_WHITE_RIGHT",
      "ESP32_GPIO11_PRIMARY_BUZZER"
    ])
    expect(traces()).toEqual(
      expect.arrayContaining([
        "U_P0_OUTPUT_DRIVER.IN1 to net.ESP32_GPIO7_PRIMARY_LAMP_RED",
        "U_P0_OUTPUT_DRIVER.IN2 to net.ESP32_GPIO15_PRIMARY_LAMP_GREEN",
        "U_P0_OUTPUT_DRIVER.IN3 to net.ESP32_GPIO17_PRIMARY_LAMP_WHITE_LEFT",
        "U_P0_OUTPUT_DRIVER.IN4 to net.ESP32_GPIO10_PRIMARY_LAMP_WHITE_RIGHT",
        "U_P0_OUTPUT_DRIVER.IN5 to net.ESP32_GPIO11_PRIMARY_BUZZER",
        "U_P0_OUTPUT_DRIVER.IN1 to R_P0_RED_INPUT_PD.pin1",
        "U_P0_OUTPUT_DRIVER.IN5 to R_P0_BUZZER_INPUT_PD.pin1",
        "R_P0_RED_INPUT_PD.pin2 to net.APP_GND",
        "R_P0_BUZZER_INPUT_PD.pin2 to net.APP_GND",
        "U_P0_OUTPUT_DRIVER.OUT1 to J_PRIMARY_OUTPUTS.CIRCUIT_1_RED",
        "U_P0_OUTPUT_DRIVER.OUT5 to J_PRIMARY_OUTPUTS.CIRCUIT_5_BUZZER",
        "J_PRIMARY_OUTPUTS.APP_GND_RETURN to net.APP_GND"
      ])
    )
    expect(p0PrimaryOutputsCircuitContract.resetState).toContain("off")
    expect(p0PrimaryOutputsCircuitContract.resetState).toContain("100 kilohm")
  })

  it("makes all three unused driver inputs and outputs explicit NC labels", () => {
    expect(p0PrimaryOutputsCircuitContract.unusedDriverPins).toEqual([
      "IN6_NC",
      "IN7_NC",
      "IN8_NC",
      "OUT6_NC",
      "OUT7_NC",
      "OUT8_NC"
    ])
    expect(traces().filter((trace) => trace.includes("_NC"))).toEqual([])
  })
})
