import { mkdir, rm, writeFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { runAllChecks } from "@tscircuit/checks"
import {
  convertSoupToExcellonDrillCommandLayers,
  convertSoupToGerberCommands,
  stringifyExcellonDrill,
  stringifyGerberCommandLayers
} from "circuit-json-to-gerber"
import {
  CircuitJsonToKicadPcbConverter,
  CircuitJsonToKicadProConverter,
  CircuitJsonToKicadSchConverter
} from "circuit-json-to-kicad"
import { createElement } from "react"
import { Circuit } from "tscircuit"
import { assertBoardRoutingIsComplete, prototypeBoardRouting, summarizeBoardRouting } from "./board-routing.js"
import ScoringCircuit from "./index.circuit.js"
import { createPrototypeOrderFiles } from "./prototype-order-files.js"

const projectName = "scoring-prototype-board"
const outputDirectory = fileURLToPath(new URL("../pcb/", import.meta.url))
const manufacturingDirectory = `${outputDirectory}manufacturing/`
const routingRequested = process.argv.includes("--route")

const componentsWithAcceptedMetadataWarnings = new Set([
  "BZ_SCORING",
  "D_FAVERO_DATA_1",
  "D_FAVERO_DATA_2",
  "J_FAVERO_DATA_1",
  "J_FAVERO_DATA_2",
  "J_HUB75_DATA",
  "J_HUB75_POWER",
  "Q_BUZZER",
  "U_ETHERNET",
  "U_FAVERO_DATA_1",
  "U_FAVERO_DATA_2",
  "U_IR_RECEIVER",
  "U_USB_C_PD",
  "U_V5_REGULATOR"
])
const acceptedWarningTypes = new Set([
  "source_component_pins_underspecified_warning",
  "source_no_ground_pin_defined_warning",
  "source_no_power_pin_defined_warning"
])

async function assertTscircuitChecksPass(circuitJson: Parameters<typeof runAllChecks>[0]): Promise<void> {
  const results = await runAllChecks(circuitJson)
  const errors = results.filter(({ type }) => type.endsWith("_error"))
  const unexpectedWarnings = results.filter(({ message, type }) => {
    if (type.endsWith("_error")) return false
    const component = message.match(/^(?:All pins on )?([A-Z][A-Z0-9_]*)\b/u)?.[1]
    return (
      !acceptedWarningTypes.has(type) ||
      component === undefined ||
      !componentsWithAcceptedMetadataWarnings.has(component)
    )
  })
  if (errors.length === 0 && unexpectedWarnings.length === 0) return

  const failures = [...errors, ...unexpectedWarnings].map(({ message, type }) => `${type}: ${message}`)
  throw new Error(`tscircuit board validation failed:\n${failures.join("\n")}`)
}

const circuit = new Circuit()
circuit.pcbRoutingDisabled = !routingRequested
circuit.setPlatform(prototypeBoardRouting)
circuit.add(createElement(ScoringCircuit))
console.info(routingRequested ? "Routing the complete prototype board" : "Exporting the unrouted prototype placement")
await circuit.renderUntilSettled()

const circuitJson = circuit.getCircuitJson()
const routing = summarizeBoardRouting(circuitJson)
if (routingRequested && (routing.unroutedConnectionCount > 0 || routing.routingErrorCount > 0)) {
  const examples = circuitJson
    .filter((element) => element.type.endsWith("_error"))
    .slice(0, 30)
    .map((element) => ("message" in element && typeof element.message === "string" ? element.message : element.type))
  console.info(`Routing failure examples:\n${examples.join("\n")}`)
}
if (routingRequested) assertBoardRoutingIsComplete(routing)
if (routingRequested) await assertTscircuitChecksPass(circuitJson)
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
const gerberLayers = routingRequested ? stringifyGerberCommandLayers(convertSoupToGerberCommands(circuitJson)) : {}
const drillLayers = routingRequested ? convertSoupToExcellonDrillCommandLayers({ circuitJson }) : {}

await mkdir(outputDirectory, { recursive: true })
if (routingRequested) {
  await rm(manufacturingDirectory, { force: true, recursive: true })
  await mkdir(manufacturingDirectory, { recursive: true })
}
await Promise.all([
  writeFile(`${outputDirectory}${projectName}.circuit.json`, `${JSON.stringify(circuitJson, null, 2)}\n`),
  writeFile(`${outputDirectory}${projectName}.kicad_pcb`, pcbConverter.getOutputString()),
  writeFile(`${outputDirectory}${projectName}.kicad_pro`, projectConverter.getOutputString()),
  writeFile(`${outputDirectory}${projectName}.kicad_sch`, schematicConverter.getOutputString()),
  writeFile(`${outputDirectory}${projectName}.bom.csv`, `${orderFiles.bomCsv}\n`),
  writeFile(`${outputDirectory}${projectName}.placement.csv`, `${orderFiles.placementCsv}\n`),
  ...Object.entries(gerberLayers).map(([layer, contents]) =>
    writeFile(`${manufacturingDirectory}${layer}.gbr`, contents)
  ),
  ...Object.entries(drillLayers).map(([filename, commands]) =>
    writeFile(`${manufacturingDirectory}${filename}`, stringifyExcellonDrill(commands))
  )
])

console.info(`Exported editable KiCad project to ${outputDirectory}`)
if (routingRequested) console.info(`Exported Gerber and drill files to ${manufacturingDirectory}`)
