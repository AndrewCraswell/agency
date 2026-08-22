import { mkdir, writeFile } from "node:fs/promises"
import { createElement } from "react"
import { Circuit } from "tscircuit"
import ScoringCircuit from "./index.circuit.js"

const circuit = new Circuit()
circuit.pcbRoutingDisabled = true
circuit.schematicDisabled = true
circuit.setPlatform({ partsEngineDisabled: true })
circuit.add(createElement(ScoringCircuit))
circuit.render()

await mkdir("dist", { recursive: true })
await writeFile("dist/circuit.json", `${JSON.stringify(circuit.getCircuitJson(), null, 2)}\n`)
