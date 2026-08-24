import type { ReactElement } from "react"
import { Circuit } from "tscircuit"

type RenderTestCircuitOptions = {
  pcbEnabled?: boolean
}

export function renderTestCircuit(circuitElement: ReactElement, { pcbEnabled = true }: RenderTestCircuitOptions = {}) {
  const circuit = new Circuit()
  circuit.pcbDisabled = !pcbEnabled
  circuit.pcbRoutingDisabled = true
  circuit.schematicDisabled = true
  circuit.setPlatform({ partsEngineDisabled: true })
  circuit.add(circuitElement)
  circuit.render()
  return circuit.getCircuitJson()
}
