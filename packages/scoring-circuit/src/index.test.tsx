import { createElement } from "react"
import { Circuit } from "tscircuit"
import { describe, expect, it } from "vitest"
import { cleanSheetBoardArchitecture } from "./clean-sheet-board-architecture.js"
import ScoringCircuit from "./index.circuit.js"

async function renderCanonicalScaffold() {
  const circuit = new Circuit()
  circuit.add(createElement(ScoringCircuit))
  await circuit.renderUntilSettled()
  return circuit.getCircuitJson()
}

describe("canonical clean-sheet P0 board", () => {
  it("renders the provisional board, mounting holes, and direct-wire weapon interface", async () => {
    const circuitJson = await renderCanonicalScaffold()
    const board = circuitJson.find((element) => element.type === "source_board")
    const holes = circuitJson.filter((element) => element.type === "pcb_hole")

    expect(board).toMatchObject({
      title: `${cleanSheetBoardArchitecture.board.title} ${cleanSheetBoardArchitecture.revision}`
    })
    expect(holes).toHaveLength(9)
    expect(circuitJson.filter((element) => element.type === "pcb_plated_hole")).toHaveLength(18)
  })

  it("contains no obsolete components and connects every landing to its probe point", async () => {
    const circuitJson = await renderCanonicalScaffold()
    const serialized = JSON.stringify(circuitJson)

    expect(serialized).toContain("TSOP38438")
    for (const reference of ["U_IR_RX", "R_IR_VS", "C_IR_VS", "R_IR_OUT", "R_IR_PULLUP", "TP_IR_RX"]) {
      expect(serialized).toContain(reference)
    }
    expect(circuitJson.filter((element) => element.type === "source_component")).toHaveLength(8)
    expect(circuitJson.filter((element) => element.type === "source_trace")).toHaveLength(16)
    expect(circuitJson.filter((element) => element.type === "pcb_trace_missing_error").length).toBeGreaterThan(0)
    for (const reference of cleanSheetBoardArchitecture.prohibitedActiveReferences) {
      expect(serialized).not.toContain(reference)
    }
  })
})
