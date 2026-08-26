import { mkdir, writeFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import {
  CircuitJsonToKicadPcbConverter,
  CircuitJsonToKicadProConverter,
  CircuitJsonToKicadSchConverter
} from "circuit-json-to-kicad"
import { createElement } from "react"
import { Circuit } from "tscircuit"
import { assertBoardRoutingIsComplete, summarizeBoardRouting } from "./board-routing.js"
import ScoringCircuit from "./index.circuit.js"
import { createPrototypeOrderFiles } from "./prototype-order-files.js"

const projectName = "scoring-development-board"
const outputDirectory = fileURLToPath(new URL("../pcb/", import.meta.url))
const routingRequested = process.argv.includes("--route")

const circuit = new Circuit()
circuit.pcbRoutingDisabled = !routingRequested
circuit.add(createElement(ScoringCircuit))
console.info(routingRequested ? "Routing the complete prototype board" : "Exporting the unrouted prototype placement")
await circuit.renderUntilSettled()

const circuitJson = circuit.getCircuitJson()
const routing = summarizeBoardRouting(circuitJson)
if (routingRequested) assertBoardRoutingIsComplete(routing)
const orderFiles = createPrototypeOrderFiles(circuitJson)
const blockingErrors = circuitJson.filter(
  (element) => element.type.endsWith("_error") && !element.type.startsWith("pcb_trace")
)
if (blockingErrors.length > 0) {
  throw new Error(`PCB export stopped with ${blockingErrors.length} circuit or placement errors`)
}

const schematicConverter = new CircuitJsonToKicadSchConverter(circuitJson)
schematicConverter.runUntilFinished()
const pcbConverter = new CircuitJsonToKicadPcbConverter(circuitJson, { projectName })
pcbConverter.runUntilFinished()
const projectConverter = new CircuitJsonToKicadProConverter(circuitJson, {
  pcbFilename: `${projectName}.kicad_pcb`,
  projectName,
  schematicFilename: `${projectName}.kicad_sch`,
  schematicSheetPlan: schematicConverter.schematicSheetPlan
})
projectConverter.runUntilFinished()

await mkdir(outputDirectory, { recursive: true })
await Promise.all([
  writeFile(`${outputDirectory}${projectName}.circuit.json`, `${JSON.stringify(circuitJson, null, 2)}\n`),
  writeFile(`${outputDirectory}${projectName}.kicad_pcb`, pcbConverter.getOutputString()),
  writeFile(`${outputDirectory}${projectName}.kicad_pro`, projectConverter.getOutputString()),
  writeFile(`${outputDirectory}${projectName}.kicad_sch`, schematicConverter.getOutputString()),
  writeFile(`${outputDirectory}${projectName}.bom.csv`, `${orderFiles.bomCsv}\n`),
  writeFile(`${outputDirectory}${projectName}.placement.csv`, `${orderFiles.placementCsv}\n`)
])

console.info(`Exported editable KiCad project to ${outputDirectory}`)
