import { describe, expect, it } from "vitest"
import ScoringCircuit from "./index.circuit.js"
import { renderTestCircuit } from "./test-helper.js"

describe("P0 integrated scoring-machine schematic", () => {
  it("renders every required hardware block without circuit errors", () => {
    const circuit = renderTestCircuit(<ScoringCircuit />, { pcbEnabled: false })
    expect(circuit.filter((element) => element.type.includes("error"))).toEqual([])
    const names = circuit.flatMap((element) =>
      element.type === "source_component" && typeof element.name === "string" ? [element.name] : []
    )
    expect(names).toEqual(
      expect.arrayContaining([
        "U_APP",
        "U_BP033_USB_PD",
        "U_SOURCE_CONTROL",
        "U_SOURCE_SWITCH_1",
        "U_SOURCE_SWITCH_2",
        "U_SAR_1",
        "U_SAR_7",
        "U_BP033_W5500",
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
})
