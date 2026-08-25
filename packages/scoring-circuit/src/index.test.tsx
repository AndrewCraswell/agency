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
    expect(circuitJson.filter((element) => element.type === "pcb_plated_hole")).toHaveLength(14)
  })

  it("contains no obsolete components and connects every landing to its probe point", async () => {
    const circuitJson = await renderCanonicalScaffold()
    const serialized = JSON.stringify(circuitJson)

    expect(circuitJson.filter((element) => element.type === "source_component")).toHaveLength(2)
    expect(circuitJson.filter((element) => element.type === "source_trace")).toHaveLength(7)
    expect(circuitJson.filter((element) => element.type === "pcb_trace_missing_error")).toHaveLength(7)
    for (const reference of cleanSheetBoardArchitecture.prohibitedActiveReferences) {
      expect(serialized).not.toContain(reference)
    }
  })
})
