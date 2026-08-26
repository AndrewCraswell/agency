import { describe, expect, it } from "vitest"
import ScoringCircuit from "./index.circuit.js"
import { renderTestCircuit } from "./test-helper.js"

const explicitNonBomBoardFeatures = new Set([
  "J_DISPLAY_POWER_PIGTAIL",
  "J_PISTE_DIRECT",
  "J_WEAPON_DIRECT",
  "TP_APP_3V3",
  "TP_APP_GND",
  "TP_BOOT_N",
  "TP_EN_RESET",
  "TP_IR_RX",
  "TP_PD_EFUSE_OUT",
  "TP_PD_PPHV",
  "TP_RECOVERY_APP_3V3",
  "TP_SCORING_REFERENCE",
  "TP_UART0_RX",
  "TP_UART0_TX",
  "TP_USB_VBUS_PORT",
  "TP_V5"
])

function isPlaceholderManufacturerPartNumber(mpn: string): boolean {
  return /^(?:placeholder|project-derived|review-candidate)(?:$|[-_\s])|^tbd(?:$|[-_\s])/iu.test(mpn)
}

describe("P0 integrated scoring-machine schematic", () => {
  it("distinguishes actual manufacturer part numbers from placeholder forms", () => {
    expect(isPlaceholderManufacturerPartNumber("TBD62783AFWG")).toBe(false)
    for (const placeholder of [
      "TBD",
      "TBD-SELECT-OUTPUT-DRIVER",
      "TBD_SELECT_OUTPUT_DRIVER",
      "PLACEHOLDER",
      "PROJECT-DERIVED-P0-DIRECT-WIRE",
      "REVIEW-CANDIDATE-FOOTPRINT"
    ]) {
      expect(isPlaceholderManufacturerPartNumber(placeholder)).toBe(true)
    }
  })

  it("renders every required hardware block without circuit errors", () => {
    const circuit = renderTestCircuit(<ScoringCircuit />, { pcbEnabled: false })
    expect(circuit.filter((element) => element.type.includes("error"))).toEqual([])
    const names = circuit.flatMap((element) =>
      element.type === "source_component" && typeof element.name === "string" ? [element.name] : []
    )
    expect(names).toHaveLength(250)
    expect(names).toEqual(
      expect.arrayContaining([
        "U_APP",
        "U_USB_PD",
        "U_PHASE_CONTROL_1",
        "U_PHASE_CONTROL_2",
        "U_SOURCE_MUX",
        "U_SINK_MUX",
        "U_SENSE_MUX",
        "U_SAR",
        "U_REF",
        "U_W5500",
        "J_ETH",
        "J_HUB75",
        "U_IR_RX",
        "U_P0_OUTPUT_DRIVER",
        "J_WEAPON_DIRECT",
        "J_PISTE_DIRECT"
      ])
    )
    expect(names.some((name) => name.includes("STM32") || name.includes("ISOLAT"))).toBe(false)
  }, 20_000)

  it("emits a complete populated BOM inventory with no placeholder parts", () => {
    const circuit = renderTestCircuit(<ScoringCircuit />, { pcbEnabled: false })
    const sources = circuit.filter((element) => element.type === "source_component")
    const failures: string[] = []
    const references = new Set<string>()

    for (const source of sources) {
      const reference = source.name
      if (typeof reference !== "string" || reference.trim() === "") {
        failures.push("A source component has a blank reference")
        continue
      }
      if (references.has(reference)) failures.push(`${reference} is duplicated`)
      references.add(reference)

      if (explicitNonBomBoardFeatures.has(reference)) continue
      const mpn = source.manufacturer_part_number
      if (typeof mpn !== "string" || mpn.trim() === "") {
        failures.push(`${reference} has no populated manufacturer part number`)
      } else if (isPlaceholderManufacturerPartNumber(mpn)) {
        failures.push(`${reference} has placeholder manufacturer part number ${mpn}`)
      }
    }

    expect(circuit.filter((element) => element.type.includes("error"))).toEqual([])
    expect(failures).toEqual([])
  }, 20_000)
})
