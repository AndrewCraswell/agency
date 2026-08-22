import { mkdir, writeFile } from "node:fs/promises"
import { convertCircuitJsonToPcbSvg, convertCircuitJsonToSchematicSvg } from "circuit-to-svg"
import { createElement } from "react"
import { Circuit } from "tscircuit"
import { componentDecisions } from "./component-decisions.js"
import ScoringCircuit from "./index.circuit.js"

const circuit = new Circuit()
circuit.pcbRoutingDisabled = true
circuit.setPlatform({ partsEngineDisabled: true })
circuit.add(createElement(ScoringCircuit))
circuit.render()

const circuitJson = circuit.getCircuitJson()
const pcbSvg = convertCircuitJsonToPcbSvg(circuitJson, {
  backgroundColor: "#101820",
  includeVersion: true,
  matchBoardAspectRatio: true,
  shouldDrawErrors: true
})
const schematicSvg = convertCircuitJsonToSchematicSvg(circuitJson, { includeVersion: true })
const bomHeader = ["category", "manufacturer", "mpn", "lifecycle", "purpose", "qualification", "manufacturer_url"]
const quoteCsv = (value: string) => `"${value.replaceAll('"', '""')}"`
const bomCsv = [
  bomHeader.join(","),
  ...componentDecisions.map((component) =>
    [
      component.category,
      component.manufacturer,
      component.mpn,
      component.lifecycle,
      component.purpose,
      component.qualification,
      component.manufacturerUrl
    ]
      .map(quoteCsv)
      .join(",")
  )
].join("\n")
const readiness = {
  fabricationReady: false,
  generatedAt: new Date().toISOString(),
  modelPurpose: "Architecture, placement, ownership, connector topology, and isolation review",
  openGates: [
    "Complete and characterize the three-weapon analog front end",
    "Select every connector, protection device, passive, magnetics part, and power inductor",
    "Complete the full production pin map and decoupling network",
    "Run schematic ERC and independent mixed-signal review",
    "Route the controlled four-layer stack-up and pass PCB DRC",
    "Complete SI, PI, thermal, EMC, safety, mechanical, and manufacturing reviews"
  ]
} as const
const previewHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Scoring apparatus board model</title>
  <style>
    :root { color-scheme: dark; font-family: system-ui, sans-serif; background: #0b1117; color: #eef4f8; }
    body { max-width: 1440px; margin: auto; padding: 24px; }
    h1 { margin-bottom: 8px; }
    .warning { border-left: 4px solid #ffb000; padding: 12px 16px; background: #2a210e; }
    .views { display: grid; gap: 24px; margin-top: 24px; }
    figure { margin: 0; padding: 16px; border: 1px solid #33424f; border-radius: 8px; background: #101820; }
    figcaption { margin-bottom: 12px; font-weight: 700; }
    img { display: block; width: 100%; min-height: 320px; object-fit: contain; background: white; }
    a { color: #7cc4ff; margin-right: 16px; }
  </style>
</head>
<body>
  <h1>Competition scoring apparatus board model</h1>
  <p class="warning"><strong>Architecture review only.</strong> This model is not ready for fabrication. See the readiness report and production plan before ordering hardware.</p>
  <p><a href="../docs/production-board-plan.md">Production plan</a><a href="readiness-report.json">Readiness report</a><a href="bom.csv">Component decisions</a></p>
  <main class="views">
    <figure><figcaption>PCB placement and unrouted connectivity. Select to open full size.</figcaption><a href="pcb.svg"><img src="pcb.svg" alt="PCB placement model"></a></figure>
    <figure><figcaption>Logical schematic. Select to open full size.</figcaption><a href="schematic.svg"><img src="schematic.svg" alt="Logical schematic model"></a></figure>
  </main>
</body>
</html>
`

await mkdir("dist", { recursive: true })
await Promise.all([
  writeFile("dist/bom.csv", `${bomCsv}\n`),
  writeFile("dist/bom.json", `${JSON.stringify(componentDecisions, null, 2)}\n`),
  writeFile("dist/circuit.json", `${JSON.stringify(circuitJson, null, 2)}\n`),
  writeFile("dist/index.html", previewHtml),
  writeFile("dist/pcb.svg", pcbSvg),
  writeFile("dist/readiness-report.json", `${JSON.stringify(readiness, null, 2)}\n`),
  writeFile("dist/schematic.svg", schematicSvg)
])
