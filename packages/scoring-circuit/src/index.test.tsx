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

describe("BP-320 canonical clean-sheet board scaffold", () => {
  it("renders only the provisional board and four mounting holes", async () => {
    const circuitJson = await renderCanonicalScaffold()
    const board = circuitJson.find((element) => element.type === "source_board")
    const holes = circuitJson.filter((element) => element.type === "pcb_hole")

    expect(board).toMatchObject({
      title: `${cleanSheetBoardArchitecture.board.title} ${cleanSheetBoardArchitecture.revision}`
    })
    expect(holes).toHaveLength(4)
  })

  it("contains no obsolete components, traces, or unresolved routes", async () => {
    const circuitJson = await renderCanonicalScaffold()
    const serialized = JSON.stringify(circuitJson)

    expect(circuitJson.filter((element) => element.type === "source_component")).toHaveLength(0)
    expect(circuitJson.filter((element) => element.type === "source_trace")).toHaveLength(0)
    expect(circuitJson.filter((element) => element.type === "pcb_trace_missing_error")).toHaveLength(0)
    for (const reference of cleanSheetBoardArchitecture.prohibitedActiveReferences) {
      expect(serialized).not.toContain(reference)
    }
  })
})
