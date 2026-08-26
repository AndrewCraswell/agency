import { describe, expect, it } from "vitest"
import P0UsbPower from "./p0-usb-power.circuit.js"
import { renderTestCircuit } from "./test-helper.js"

function render() {
  return renderTestCircuit(<P0UsbPower />, { pcbEnabled: false })
}

function traceNames() {
  return render().flatMap((element) =>
    element.type === "source_trace" && typeof element.display_name === "string" ? [element.display_name] : []
  )
}

describe("P0 USB-C power input", () => {
  it("renders the selected input, protection, and regulator chain", () => {
    const components = new Map<string, unknown>()
    for (const element of render()) {
      if (element.type === "source_component") components.set(element.name, element)
    }

    expect(components.get("J_USB_C")).toMatchObject({ manufacturer_part_number: "10177070-00011LF" })
    expect(components.get("U_USB_PORT_PROTECT")).toMatchObject({
      manufacturer_part_number: "TPD4S201TRGRRQ1"
    })
    expect(components.get("U_USB_DATA_PROTECT")).toMatchObject({ manufacturer_part_number: "TPD2EUSB30DRTR" })
    expect(components.get("D_USB_PD_VBUS_TVS")).toMatchObject({ manufacturer_part_number: "TVS2200DRVR" })
    expect(components.get("U_USB_PD")).toMatchObject({ manufacturer_part_number: "TPS25730ADREFR" })
    expect(components.get("U_EFUSE")).toMatchObject({ manufacturer_part_number: "TPS259474ARPWR" })
    expect(components.get("U_V5_BUCK")).toMatchObject({ manufacturer_part_number: "TPS56A37RPAR" })
    expect(components.get("U_APP_REGULATOR")).toMatchObject({ manufacturer_part_number: "LMR43620MSC3RPERQ1" })
    expect(render().filter((element) => element.type.endsWith("_error"))).toEqual([])
  })

  it("keeps the named protected rails, diagnostic links, and probes connected", () => {
    expect(traceNames()).toEqual(
      expect.arrayContaining([
        "U_USB_PD.20 to net.PD_PPHV_20V",
        "U_EFUSE.IN to net.PD_PPHV_20V",
        "U_EFUSE.pin1 to R_EFUSE_UVLO_UP.pin2",
        "U_EFUSE.OUT to TP_PD_EFUSE_OUT.V20_TO_V5_BUCK",
        "U_EFUSE.OUT to U_V5_BUCK.VIN",
        "L_V5_BUCK.V5 to net.V5",
        "U_APP_REGULATOR.VIN to net.V5",
        "L_APP_REGULATOR.APP_3V3 to net.APP_3V3",
        "TP_V5.V5 to net.V5",
        "TP_APP_3V3.APP_3V3 to net.APP_3V3",
        "TP_SCORING_REFERENCE.V5_ANALOG to net.V5",
        "R_USB_DP_SERIES.pin2 to net.USB_DP",
        "R_USB_DN_SERIES.pin2 to net.USB_DN"
      ])
    )
  })

  it("uses fail-closed defaults for unsafe or unresolved controls", () => {
    const names = traceNames()
    expect(names.some((name) => name.includes("U_V5_BUCK.PG to"))).toBe(false)
    expect(names.some((name) => name.includes("U_APP_REGULATOR.PGOOD"))).toBe(false)
    expect(names.some((name) => name.includes("CHASSIS to net.APP_GND"))).toBe(false)
    expect(names.some((name) => name.includes("SCORING_ISOLATOR"))).toBe(false)
    expect(names.some((name) => name.includes("J_LINK_") || name.includes("J_USB2_SERVICE"))).toBe(false)
  })
})
