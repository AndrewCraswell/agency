import { mkdir, writeFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { renderScene } from "@tscircuit/simple-3d-svg"
import { convertCircuitJsonToGltf } from "circuit-json-to-gltf"
import { convertCircuitJsonToSimple3dScene } from "circuit-json-to-simple-3d"
import { convertCircuitJsonToPcbSvg, convertCircuitJsonToSchematicSvg } from "circuit-to-svg"
import { build as bundle } from "esbuild"
import { createElement } from "react"
import { Circuit } from "tscircuit"
import {
  isRoutingError,
  isSameFootprintClearanceError,
  prototypeBoardRouting,
  summarizeBoardRouting
} from "./board-routing.js"
import ScoringCircuit from "./index.circuit.js"
import { createPrototypeOrderFiles } from "./prototype-order-files.js"

const simulatorPresentationUrl = process.env.SCORING_SIMULATOR_ORIGIN ?? "../simulator/"

const circuit = new Circuit()
circuit.pcbRoutingDisabled = false
circuit.setPlatform({
  ...prototypeBoardRouting,
  enablePartOrientationAnalysis: true,
  printBoardInformationToSilkscreen: true,
  projectName: "Competition scoring apparatus",
  unitPreference: "mm"
})
circuit.add(createElement(ScoringCircuit))
await circuit.renderUntilSettled()

const circuitJson = circuit.getCircuitJson()
const pcbPadComponentById = new Map<string, string>()
for (const element of circuitJson) {
  let padId: string | undefined
  let componentId: string | undefined
  if (element.type === "pcb_smtpad") ({ pcb_component_id: componentId, pcb_smtpad_id: padId } = element)
  else if (element.type === "pcb_plated_hole") ({ pcb_component_id: componentId, pcb_plated_hole_id: padId } = element)
  else if (element.type === "pcb_port") ({ pcb_component_id: componentId, pcb_port_id: padId } = element)
  if (padId !== undefined && componentId !== undefined) pcbPadComponentById.set(padId, componentId)
}
const placementErrorTypes = new Set([
  "pcb_courtyard_overlap_error",
  "pcb_footprint_overlap_error",
  "pcb_pad_pad_clearance_error",
  "pcb_placement_error"
])
const placementErrors = circuitJson.filter((element) => {
  if (!placementErrorTypes.has(element.type)) return false
  if (element.type !== "pcb_pad_pad_clearance_error") return true
  return !isSameFootprintClearanceError(element, pcbPadComponentById)
})
if (placementErrors.length > 0) {
  const counts = Object.entries(Object.groupBy(placementErrors, (element) => element.type))
    .map(([type, elements]) => `${type}: ${elements?.length ?? 0}`)
    .join(", ")
  const examples = Object.values(Object.groupBy(placementErrors, (element) => element.type))
    .flatMap((elements) => elements?.slice(0, 8) ?? [])
    .map((element) => ("message" in element && typeof element.message === "string" ? element.message : element.type))
    .join("\n")
  throw new Error(`PCB placement validation failed (${counts})\n${examples}`)
}
const routing = summarizeBoardRouting(circuitJson)
console.info(
  `PCB routing: ${routing.routedConnectionCount}/${routing.sourceConnectionCount} connections routed; ` +
    `${routing.unroutedConnectionCount} unresolved; ${routing.routingErrorCount} routing/DRC errors`
)
if (routing.routingErrorCount > 0) {
  await mkdir("dist", { recursive: true })
  await writeFile("dist/routing-diagnostic.json", JSON.stringify(circuitJson, null, 2))
  const examples = circuitJson
    .filter(isRoutingError)
    .slice(0, 30)
    .map((element) => {
      const sourceTraceId = "source_trace_id" in element ? element.source_trace_id : undefined
      const message = "message" in element ? element.message : undefined
      return `${element.type}${sourceTraceId === undefined ? "" : ` ${sourceTraceId}`}: ${message ?? "no message"}`
    })
    .join("\n")
  console.info(`PCB routing error examples:\n${examples}`)
  console.info("Incomplete routing snapshot: dist/routing-diagnostic.json")
}
const sourceComponents = circuitJson
  .filter((element) => element.type === "source_component")
  .toSorted((left, right) => (left.name ?? "").localeCompare(right.name ?? ""))
const orderFiles = createPrototypeOrderFiles(circuitJson)
const resolvedPartCount = orderFiles.bom.reduce((count, row) => count + row.quantity, 0)
const renderedCadComponentCount = circuitJson.filter((element) => element.type === "cad_component").length
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
const threeDimensionalSvg = await renderScene(threeDimensionalScene, {
  backgroundColor: "#101820",
  height: 900,
  width: 1440
})
const boardGlb = await convertCircuitJsonToGltf(circuitJson, {
  boardTextureResolution: 1024,
  format: "glb",
  includeModels: true
})
if (!(boardGlb instanceof ArrayBuffer)) throw new Error("The interactive 3D board model was not generated")
const embeddedBoardGlb = Buffer.from(boardGlb).toString("base64")
const interactiveViewerBuild = await bundle({
  bundle: true,
  entryPoints: [fileURLToPath(new URL("../assets/interactive-3d-viewer.js", import.meta.url))],
  format: "iife",
  minify: true,
  platform: "browser",
  target: "es2022",
  write: false
})
const interactiveViewerModule = interactiveViewerBuild.outputFiles[0]?.text
if (!interactiveViewerModule) throw new Error("Interactive 3D viewer bundle was not generated")
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
    .metrics { display: flex; flex-wrap: wrap; gap: 8px; margin: 16px 0 0; padding: 0; list-style: none; }
    .metrics li { border: 1px solid #33424f; border-radius: 6px; padding: 8px 12px; background: #101820; }
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
    .viewer-shell { position: relative; min-height: 320px; height: min(58vh, 620px); overflow: hidden; background: #101820; }
    .viewer-shell canvas { display: block; width: 100%; height: 100%; cursor: grab; touch-action: none; }
    .viewer-shell canvas:active { cursor: grabbing; }
    .viewer-shell canvas:focus-visible { outline: 3px solid #7cc4ff; outline-offset: -3px; }
    .viewer-status { position: absolute; inset: 50% auto auto 50%; transform: translate(-50%, -50%); margin: 0; padding: 10px 14px; border-radius: 6px; background: rgb(11 17 23 / 88%); color: #eef4f8; font-weight: 700; }
    .viewer-status[hidden] { display: none; }
    .viewer-controls { position: absolute; top: 12px; right: 12px; display: flex; gap: 8px; }
    .viewer-controls button { border: 1px solid #60788a; border-radius: 6px; padding: 8px 12px; background: #172630; color: #eef4f8; font: inherit; font-weight: 700; cursor: pointer; }
    .viewer-help { margin: 10px 0 0; color: #b7c7d3; }
    .io-assembly { display: grid; grid-template-columns: repeat(2, minmax(240px, 1fr)); gap: 16px; }
    .io-module { border: 1px solid #60788a; border-radius: 10px; padding: 18px; background: #172630; }
    .io-module h2 { margin: 0 0 6px; font-size: 1.05rem; }
    .io-module p { margin: 0 0 16px; color: #b7c7d3; }
    .socket-row { display: flex; gap: 18px; align-items: end; }
    .banana-socket { display: grid; gap: 6px; justify-items: center; font-weight: 700; }
    .banana-socket span:first-child { width: 34px; height: 34px; border: 7px solid #c6ccd1; border-radius: 50%; background: #111820; box-shadow: inset 0 0 0 3px #677581; }
    .port-row { display: flex; flex-wrap: wrap; gap: 22px; align-items: end; }
    .port-model { display: grid; gap: 8px; justify-items: center; font-weight: 700; text-align: center; }
    .rj45-model { width: 70px; height: 56px; border: 6px solid #aeb7bd; border-radius: 5px; background: linear-gradient(#243a47 65%, #c8a95b 65%); }
    .rj14-model { width: 52px; height: 42px; border: 5px solid #30383f; border-radius: 4px; background: linear-gradient(90deg, transparent 18%, #b9913c 18% 27%, transparent 27% 39%, #b9913c 39% 48%, transparent 48% 60%, #b9913c 60% 69%, transparent 69% 81%, #b9913c 81% 90%, transparent 90%), #111820; }
    .usb-c-model { width: 70px; height: 28px; border: 6px solid #aeb7bd; border-radius: 18px; background: #111820; }
    .power-model { width: 54px; height: 54px; border: 7px solid #c6ccd1; border-radius: 50%; background: radial-gradient(circle, #111820 0 34%, #83919a 36% 45%, #111820 47%); }
    a { color: #7cc4ff; margin-right: 16px; }
    @media (max-width: 640px) {
      body { padding: 16px; }
      h1 { font-size: 1.6rem; }
      [role="tab"] { flex: 1 0 auto; padding-inline: 12px; }
      figure { padding: 10px; }
      img { min-height: 220px; max-height: none; }
      .viewer-shell { min-height: 300px; height: 52vh; }
      .io-assembly { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <h1>Competition scoring apparatus board model</h1>
  <p class="warning"><strong>Routed prototype preview.</strong> Review the checked-in KiCad board and fabrication plots before ordering. The assembled board still requires electrical validation.</p>
  <ul class="metrics" aria-label="Prototype routing summary">
    <li><strong>${routing.routedConnectionCount}</strong> routed connections</li>
    <li><strong>${routing.unroutedConnectionCount}</strong> unresolved connections</li>
    <li><strong>${sourceComponents.length}</strong> placed source components</li>
    <li><strong>${resolvedPartCount}</strong> parts with manufacturer numbers</li>
    <li><strong>${renderedCadComponentCount}</strong> rendered CAD bodies</li>
  </ul>
  <p class="resources"><a href="../docs/esp32-prototype-backlog.md">Prototype checklist</a><a href="../docs/clean-sheet-board-architecture.md">Board architecture</a><a href="bom.csv">Prototype BOM</a><a href="placement.csv">Placement file</a><a href="${simulatorPresentationUrl}">Bout test simulator</a></p>
  <div class="tabs" role="tablist" aria-label="Circuit views">
    <button id="tab-pcb" role="tab" aria-selected="true" aria-controls="view-pcb" tabindex="0">PCB</button>
    <button id="tab-schematic" role="tab" aria-selected="false" aria-controls="view-schematic" tabindex="-1">Schematic</button>
    <button id="tab-3d" role="tab" aria-selected="false" aria-controls="view-3d" tabindex="-1">3D</button>
    <button id="tab-io" role="tab" aria-selected="false" aria-controls="view-io" tabindex="-1">External I/O</button>
  </div>
  <main>
    <section id="view-pcb" role="tabpanel" aria-labelledby="tab-pcb">
      <figure><figcaption>Routed component placement. Select the image to open it full size.</figcaption><a href="pcb.svg"><img class="dark-render" src="pcb.svg" alt="Routed PCB component placement"></a></figure>
    </section>
    <section id="view-schematic" role="tabpanel" aria-labelledby="tab-schematic" hidden>
      <figure><figcaption>Logical schematic. Select the image to open it full size.</figcaption><a href="schematic.svg"><img src="schematic.svg" alt="Logical schematic model"></a></figure>
    </section>
    <section id="view-3d" role="tabpanel" aria-labelledby="tab-3d" hidden>
      <figure>
        <figcaption>Interactive 3D board model.</figcaption>
        <div class="viewer-shell">
          <canvas id="board-3d-canvas" tabindex="0" aria-label="Interactive three-dimensional board model. Drag to rotate and scroll to zoom."></canvas>
          <p id="board-3d-status" class="viewer-status" role="status">Loading detailed board model</p>
          <div class="viewer-controls"><button id="reset-3d-view" type="button">Reset view</button></div>
        </div>
        <p class="viewer-help">Drag to rotate. Scroll to zoom. Use the arrow keys when the model is focused. <a href="board-3d.svg">Open the static 3D export</a>.</p>
      </figure>
    </section>
    <section id="view-io" role="tabpanel" aria-labelledby="tab-io" hidden>
      <figure>
        <figcaption>Prototype external interfaces. Direct-wire landing, probe, and strain-relief geometry is placed; no production socket is selected.</figcaption>
        <div class="io-assembly">
          <article class="io-module">
            <h2>Left weapon cable</h2>
            <p>Three labeled plated-through solder landings with separate strain relief</p>
            <div class="socket-row" aria-label="Left weapon cable solder landings A, B, and C">
              <span class="banana-socket"><span aria-hidden="true"></span><span>A</span></span>
              <span class="banana-socket"><span aria-hidden="true"></span><span>B</span></span>
              <span class="banana-socket"><span aria-hidden="true"></span><span>C</span></span>
            </div>
          </article>
          <article class="io-module">
            <h2>Right weapon cable</h2>
            <p>Three labeled plated-through solder landings with separate strain relief</p>
            <div class="socket-row" aria-label="Right weapon cable solder landings A, B, and C">
              <span class="banana-socket"><span aria-hidden="true"></span><span>A</span></span>
              <span class="banana-socket"><span aria-hidden="true"></span><span>B</span></span>
              <span class="banana-socket"><span aria-hidden="true"></span><span>C</span></span>
            </div>
          </article>
          <article class="io-module">
            <h2>Piste reference</h2>
            <p>One separate labeled plated-through landing and probe point</p>
            <div class="socket-row" aria-label="Piste reference solder landing">
              <span class="banana-socket"><span aria-hidden="true"></span><span>PISTE</span></span>
            </div>
          </article>
          <article class="io-module">
            <h2>Encrypted IR receiver</h2>
            <p>Vishay TSOP38438 with a filtered 3.3 V supply, GPIO38 output, probe point, and front-edge optical keepout</p>
          </article>
          <article class="io-module">
            <h2>Scoring indicators</h2>
            <p>Left red and white, plus right green and white, 5 mm lamps provide on-target and off-target bench feedback</p>
          </article>
          <article class="io-module">
            <h2>Sound</h2>
            <p>One on-board TDK PS1240P02BT piezo sounder is switched from GPIO48 at its 4 kHz rated frequency</p>
          </article>
          <article class="io-module">
            <h2>64x32 RGB display</h2>
            <p>One keyed 2x8 HUB75 data header and one four-pin 5 V power header connect a 64x32, 1/16-scan panel</p>
          </article>
          <article class="io-module">
            <h2>Communications</h2>
            <p>One LAN/Cyrano port and two isolated FA-05 DATA-LINE outputs for Favero lamp repeaters</p>
            <div class="port-row">
              <span class="port-model"><span class="rj45-model" aria-hidden="true"></span><span>Ethernet RJ45</span></span>
              <span class="port-model"><span class="rj14-model" aria-hidden="true"></span><span>FA-05 repeater 1</span></span>
              <span class="port-model"><span class="rj14-model" aria-hidden="true"></span><span>FA-05 repeater 2</span></span>
              <span class="port-model"><span class="usb-c-model" aria-hidden="true"></span><span>USB-C PD power</span></span>
            </div>
          </article>
        </div>
      </figure>
    </section>
  </main>
  <script id="board-3d-model" type="application/octet-stream">${embeddedBoardGlb}</script>
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
      window.dispatchEvent(new CustomEvent('circuit-view-changed', { detail: nextTab.getAttribute('aria-controls') }))
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
  <script defer src="interactive-3d-viewer.js?v=interactive"></script>
</body>
</html>
`

await mkdir("dist", { recursive: true })
await Promise.all([
  writeFile("dist/board.glb", new Uint8Array(boardGlb)),
  writeFile("dist/bom.csv", `${orderFiles.bomCsv}\n`),
  writeFile("dist/bom.json", `${JSON.stringify(orderFiles.bom, null, 2)}\n`),
  writeFile("dist/circuit.json", `${JSON.stringify(circuitJson, null, 2)}\n`),
  writeFile("dist/index.html", previewHtml),
  writeFile("dist/interactive-3d-viewer.js", interactiveViewerModule),
  writeFile("dist/placement.csv", `${orderFiles.placementCsv}\n`),
  writeFile("dist/board-3d.svg", threeDimensionalSvg),
  writeFile("dist/pcb.svg", pcbSvg),
  writeFile("dist/schematic.svg", schematicSvg)
])
