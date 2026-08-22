import { Circuit } from "tscircuit"
import { describe, expect, it } from "vitest"
import ScoringCircuit from "./index.circuit.js"

describe("scoring circuit", () => {
  it("renders the complete dual-channel front end to Circuit JSON", () => {
    const circuit = new Circuit()
    circuit.pcbDisabled = true
    circuit.pcbRoutingDisabled = true
    circuit.schematicDisabled = true
    circuit.setPlatform({ partsEngineDisabled: true })
    circuit.add(<ScoringCircuit />)
    circuit.render()

    const circuitJson = circuit.getCircuitJson()
    const sourceNames = circuitJson.flatMap((element) =>
      "name" in element && typeof element.name === "string" ? [element.name] : []
    )

    expect(circuitJson.filter((element) => element.type === "source_trace").length).toBeGreaterThan(20)
    expect(sourceNames).toEqual(
      expect.arrayContaining([
        "J_L",
        "J_R",
        "J_PISTE",
        "J_STM32",
        "J_ESP32",
        "R_L_A_SERIES",
        "R_L_B_SERIES",
        "R_L_C_SERIES",
        "R_R_A_SERIES",
        "R_R_B_SERIES",
        "R_R_C_SERIES"
      ])
    )
  })
})
