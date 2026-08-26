import { describe, expect, it } from "vitest"
import P0UsbPower from "./p0-usb-power.circuit.js"
import { renderTestCircuit } from "./test-helper.js"

function render() {
  return renderTestCircuit(<P0UsbPower pcbX={0} pcbY={0} />, { pcbEnabled: false })
}

function components() {
  return new Map(
    render()
      .filter((element) => element.type === "source_component")
      .map((element) => [element.name, element] as const)
  )
}

function traceNames() {
  return render().flatMap((element) =>
    element.type === "source_trace" && typeof element.display_name === "string" ? [element.display_name] : []
  )
}

function traceWidths() {
  return new Map(
    render().flatMap((element) =>
      element.type === "source_trace" &&
      typeof element.display_name === "string" &&
      element.min_trace_thickness !== undefined
        ? [[element.display_name, element.min_trace_thickness] as const]
        : []
    )
  )
}

describe("P0 simplified wired power and USB data island", () => {
  it("uses an off-board power assembly and keeps only carrier essentials", () => {
    const rendered = components()
    expect(rendered.get("J_POWER_INPUT")).toMatchObject({
      manufacturer_part_number: "OSTVN02A150"
    })
    expect(rendered.get("F_MAIN_5V")).toMatchObject({ manufacturer_part_number: "0451003.NRL" })
    expect(rendered.get("U_USB_DATA_PROTECT")).toMatchObject({
      manufacturer_part_number: "TPD2EUSB30DRTR"
    })
    expect(rendered.get("U_APP_REGULATOR")).toMatchObject({ manufacturer_part_number: "LMR43620MSC3RPERQ1" })
    expect(rendered.get("R_USB_CC1_RD")).toMatchObject({ resistance: 5100 })
    expect(rendered.get("R_USB_CC2_RD")).toMatchObject({ resistance: 5100 })
    expect(rendered.size).toBeLessThanOrEqual(22)
    for (const retiredReference of ["J_PD_MODULE", "J_5V_MODULE", "U_USB_PD", "U_EFUSE", "U_V5_BUCK"]) {
      expect(rendered.has(retiredReference)).toBe(false)
    }
  })

  it("connects USB device termination, diagnostics, wired 5 V input, and application regulation", () => {
    expect(traceNames()).toEqual(
      expect.arrayContaining([
        "U_USB_DATA_PROTECT.pin1 to net.USB_DP",
        "U_USB_DATA_PROTECT.pin2 to net.USB_DN",
        "J_USB_C.CC1 to R_USB_CC1_RD.pin1",
        "R_USB_CC1_RD.pin2 to net.APP_GND",
        "J_USB_C.CC2 to R_USB_CC2_RD.pin1",
        "R_USB_CC2_RD.pin2 to net.APP_GND",
        "J_POWER_INPUT.V5_INPUT to F_MAIN_5V.V5_INPUT",
        "F_MAIN_5V.V5_FUSED to net.V5",
        "TP_V5.V5 to net.V5",
        "U_APP_REGULATOR.VIN to net.V5",
        "L_APP_REGULATOR.APP_3V3 to net.APP_3V3",
        "TP_APP_3V3.APP_3V3 to net.APP_3V3"
      ])
    )
  })

  it("does not expose a second input, module control, or optional USB test wiring", () => {
    const names = traceNames()
    expect(names.some((name) => name.includes("J_PD_MODULE") || name.includes("J_5V_MODULE"))).toBe(false)
    expect(names.some((name) => name.includes("S_POWER") || name.includes("J_LINK") || name.includes("LAB"))).toBe(
      false
    )
    expect(names.some((name) => name.includes("TP_USB_") || name.includes("SBU"))).toBe(false)
    expect(names.some((name) => name.includes("PD_SDA") || name.includes("PGOOD"))).toBe(false)
  })

  it("keeps only the fused 5 V and retained application rail trunks wide", () => {
    expect(traceWidths()).toEqual(
      new Map([
        ["J_POWER_INPUT.V5_INPUT to F_MAIN_5V.V5_INPUT", 1.9],
        ["F_MAIN_5V.V5_FUSED to net.V5", 1.9],
        ["J_POWER_INPUT.APP_GND to net.APP_GND", 1.9],
        ["U_APP_REGULATOR.VIN to net.V5", 0.3],
        ["L_APP_REGULATOR.APP_3V3 to net.APP_3V3", 0.3]
      ])
    )
  })
})
