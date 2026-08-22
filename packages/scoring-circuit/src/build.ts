import { mkdir, writeFile } from "node:fs/promises"
import { renderScene } from "@tscircuit/simple-3d-svg"
import { convertCircuitJsonToSimple3dScene } from "circuit-json-to-simple-3d"
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
const threeDimensionalScene = await convertCircuitJsonToSimple3dScene(circuitJson, {
  anglePreset: "right-raised",
  defaultZoomMultiplier: 1.6
})
const threeDimensionalSvg = await renderScene(
  {
    ...threeDimensionalScene,
    boxes: threeDimensionalScene.boxes.map((box) => ({
      ...box,
      objUrl: undefined,
      stlUrl: undefined,
      threeMfUrl: undefined,
      topLabel: undefined
    }))
  },
  { backgroundColor: "#101820", height: 900, width: 1440 }
)
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
    .resources { display: flex; flex-wrap: wrap; gap: 8px 16px; }
    .resources a { margin: 0; }
    .tabs { display: flex; gap: 4px; margin-top: 24px; border-bottom: 1px solid #33424f; overflow-x: auto; }
    [role="tab"] { border: 1px solid transparent; border-bottom: 0; border-radius: 8px 8px 0 0; padding: 10px 16px; background: transparent; color: #a8c5d8; font: inherit; font-weight: 700; cursor: pointer; }
    [role="tab"][aria-selected="true"] { border-color: #33424f; background: #101820; color: #eef4f8; }
    [role="tab"]:focus-visible { outline: 3px solid #7cc4ff; outline-offset: -3px; }
    [role="tabpanel"] { margin-top: 0; }
    [role="tabpanel"][hidden] { display: none; }
    figure { margin: 0; padding: 16px; border: 1px solid #33424f; border-radius: 8px; background: #101820; }
    figcaption { margin-bottom: 12px; font-weight: 700; }
    img { display: block; width: 100%; min-height: 320px; max-height: calc(100vh - 310px); object-fit: contain; background: white; }
    img.dark-render { background: #101820; }
    a { color: #7cc4ff; margin-right: 16px; }
    @media (max-width: 640px) {
      body { padding: 16px; }
      h1 { font-size: 1.6rem; }
      [role="tab"] { flex: 1 0 auto; padding-inline: 12px; }
      figure { padding: 10px; }
      img { min-height: 220px; max-height: none; }
    }
  </style>
</head>
<body>
  <h1>Competition scoring apparatus board model</h1>
  <p class="warning"><strong>Architecture review only.</strong> This model is not ready for fabrication. See the readiness report and production plan before ordering hardware.</p>
  <p class="resources"><a href="../docs/production-board-plan.md">Production plan</a><a href="../docs/analog-front-end.md">Analog front-end</a><a href="../docs/fie-modern-power-proposal.md">Modern power proposal</a><a href="analog-sim/summary.json">Simulation summary</a><a href="readiness-report.json">Readiness report</a><a href="bom.csv">Component decisions</a></p>
  <div class="tabs" role="tablist" aria-label="Circuit views">
    <button id="tab-pcb" role="tab" aria-selected="true" aria-controls="view-pcb" tabindex="0">PCB</button>
    <button id="tab-schematic" role="tab" aria-selected="false" aria-controls="view-schematic" tabindex="-1">Schematic</button>
    <button id="tab-3d" role="tab" aria-selected="false" aria-controls="view-3d" tabindex="-1">3D</button>
  </div>
  <main>
    <section id="view-pcb" role="tabpanel" aria-labelledby="tab-pcb">
      <figure><figcaption>PCB placement and unrouted connectivity. Select the image to open it full size.</figcaption><a href="pcb.svg"><img class="dark-render" src="pcb.svg" alt="PCB placement model"></a></figure>
    </section>
    <section id="view-schematic" role="tabpanel" aria-labelledby="tab-schematic" hidden>
      <figure><figcaption>Logical schematic. Select the image to open it full size.</figcaption><a href="schematic.svg"><img src="schematic.svg" alt="Logical schematic model"></a></figure>
    </section>
    <section id="view-3d" role="tabpanel" aria-labelledby="tab-3d" hidden>
      <figure><figcaption>Generated 3D board model. Select the image to open it full size.</figcaption><a href="board-3d.svg"><img class="dark-render" src="board-3d.svg" alt="Three-dimensional board model"></a></figure>
    </section>
  </main>
  <script>
    const tabs = Array.from(document.querySelectorAll('[role="tab"]'))
    const panels = Array.from(document.querySelectorAll('[role="tabpanel"]'))

    function selectTab(nextTab, moveFocus) {
      for (const tab of tabs) {
        const selected = tab === nextTab
        tab.setAttribute('aria-selected', String(selected))
        tab.tabIndex = selected ? 0 : -1
      }
      for (const panel of panels) panel.hidden = panel.id !== nextTab.getAttribute('aria-controls')
      if (moveFocus) nextTab.focus()
    }

    for (const tab of tabs) {
      tab.addEventListener('click', () => selectTab(tab, false))
      tab.addEventListener('keydown', (event) => {
        const index = tabs.indexOf(tab)
        let nextIndex = index
        if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length
        else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length
        else if (event.key === 'Home') nextIndex = 0
        else if (event.key === 'End') nextIndex = tabs.length - 1
        else return
        event.preventDefault()
        selectTab(tabs[nextIndex], true)
      })
    }
  </script>
</body>
</html>
`

await mkdir("dist", { recursive: true })
await Promise.all([
  writeFile("dist/bom.csv", `${bomCsv}\n`),
  writeFile("dist/bom.json", `${JSON.stringify(componentDecisions, null, 2)}\n`),
  writeFile("dist/circuit.json", `${JSON.stringify(circuitJson, null, 2)}\n`),
  writeFile("dist/index.html", previewHtml),
  writeFile("dist/board-3d.svg", threeDimensionalSvg),
  writeFile("dist/pcb.svg", pcbSvg),
  writeFile("dist/readiness-report.json", `${JSON.stringify(readiness, null, 2)}\n`),
  writeFile("dist/schematic.svg", schematicSvg)
])
