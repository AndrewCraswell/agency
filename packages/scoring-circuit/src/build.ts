import { mkdir, writeFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { jlcPartsEngine } from "@tscircuit/parts-engine"
import { renderScene } from "@tscircuit/simple-3d-svg"
import { any_circuit_element } from "circuit-json"
import { convertCircuitJsonToGltf } from "circuit-json-to-gltf"
import { convertCircuitJsonToSimple3dScene } from "circuit-json-to-simple-3d"
import { convertCircuitJsonToPcbSvg, convertCircuitJsonToSchematicSvg } from "circuit-to-svg"
import { build as bundle } from "esbuild"
import { createElement } from "react"
import { Circuit } from "tscircuit"
import { componentDecisions } from "./component-decisions.js"
import ScoringCircuit from "./index.circuit.js"
import {
  criticalPartReadiness,
  summarizeCriticalPartReadiness,
  validateCriticalPartReadiness
} from "./part-readiness.js"

type PlatformPartsEngine = NonNullable<Parameters<InstanceType<typeof Circuit>["setPlatform"]>[0]["partsEngine"]>

const partsEngine = {
  fetchPartCircuitJson: async (parameters) => {
    const circuitJson = await jlcPartsEngine.fetchPartCircuitJson(parameters)
    return circuitJson === undefined ? undefined : any_circuit_element.array().parse(circuitJson)
  },
  findPart: (parameters) => jlcPartsEngine.findPart(parameters)
} satisfies PlatformPartsEngine

const circuit = new Circuit()
circuit.setPlatform({
  enablePartOrientationAnalysis: true,
  partsEngine,
  printBoardInformationToSilkscreen: true,
  projectName: "Competition scoring apparatus",
  unitPreference: "mm"
})
circuit.add(createElement(ScoringCircuit))
await circuit.renderUntilSettled()

const circuitJson = circuit.getCircuitJson()
const routeCount = circuitJson.filter((element) => element.type === "pcb_trace").length
const connectionCount = circuitJson.filter((element) => element.type === "source_trace").length
const unresolvedConnectionCount = circuitJson.filter((element) => element.type === "pcb_trace_missing_error").length
const resolvedSupplierPartCount = circuitJson.filter(
  (element) =>
    element.type === "source_component" &&
    "supplier_part_numbers" in element &&
    Object.values(element.supplier_part_numbers ?? {}).some((partNumbers) => partNumbers.length > 0)
).length
const renderedCadComponentCount = circuitJson.filter((element) => element.type === "cad_component").length
const externallySourcedCadModelCount = circuitJson.filter(
  (element) =>
    element.type === "cad_component" &&
    (element.model_obj_url !== undefined ||
      element.model_stl_url !== undefined ||
      element.model_gltf_url !== undefined ||
      element.model_glb_url !== undefined)
).length
const partReadinessErrors = validateCriticalPartReadiness(criticalPartReadiness)
if (partReadinessErrors.length > 0) {
  throw new Error(`Critical-part readiness validation failed:\n${partReadinessErrors.join("\n")}`)
}
const partReadinessSummary = summarizeCriticalPartReadiness(criticalPartReadiness)
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
  modelPurpose:
    "Architecture, constrained functional placement, prototype autorouting, connector topology, and isolation review",
  prototypeRouting: {
    connectionCount,
    routeCount,
    unresolvedConnectionCount
  },
  partsResolution: {
    engine: "JLC parts engine with EasyEDA footprint and CAD import",
    criticalParts: partReadinessSummary,
    externallySourcedCadModelCount,
    renderedCadComponentCount,
    resolvedSupplierPartCount,
    status:
      "Rendered supplier geometry is a candidate aid only; manufacturer evidence and production approval are tracked separately"
  },
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
    .simulation-layout { display: grid; gap: 16px; }
    .simulation-summary { display: grid; grid-template-columns: repeat(4, minmax(150px, 1fr)); gap: 12px; }
    .simulation-card { border: 1px solid #33424f; border-radius: 8px; padding: 14px; background: #172630; }
    .simulation-card strong { display: block; margin-top: 5px; font-size: 1.35rem; }
    .simulation-card span { color: #b7c7d3; font-size: 0.9rem; }
    .simulation-card.blocked { border-color: #d99124; background: #2a210e; }
    .simulation-chart { width: 100%; min-height: 360px; border: 1px solid #33424f; border-radius: 8px; background: #0d161d; }
    .simulation-chart text { fill: #b7c7d3; font-family: system-ui, sans-serif; font-size: 12px; }
    .simulation-chart .grid { stroke: #33424f; stroke-width: 1; }
    .simulation-chart .boundary-series { fill: none; stroke: #55c2ff; stroke-width: 3; }
    .simulation-chart .slow-series { fill: none; stroke: #ffb84d; stroke-width: 3; }
    .simulation-legend { display: flex; flex-wrap: wrap; gap: 16px; color: #b7c7d3; }
    .simulation-legend span::before { display: inline-block; width: 18px; height: 3px; margin: 0 7px 3px 0; background: #55c2ff; content: ""; }
    .simulation-legend span:last-child::before { background: #ffb84d; }
    .simulation-details { display: grid; grid-template-columns: minmax(260px, 0.8fr) minmax(320px, 1.2fr); gap: 16px; }
    .simulation-details article { border: 1px solid #33424f; border-radius: 8px; padding: 16px; background: #172630; }
    .simulation-details h2 { margin-top: 0; font-size: 1.05rem; }
    .pulse-list { display: flex; flex-wrap: wrap; gap: 8px; padding: 0; list-style: none; }
    .pulse-list li { border: 1px solid #60788a; border-radius: 999px; padding: 6px 10px; }
    .limitation-list { margin-bottom: 0; color: #d5dde3; }
    .simulation-status { padding: 40px 16px; text-align: center; color: #b7c7d3; }
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
      .simulation-summary { grid-template-columns: repeat(2, minmax(130px, 1fr)); }
      .simulation-details { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <h1>Competition scoring apparatus board model</h1>
  <p class="warning"><strong>Architecture review only.</strong> This model is not ready for fabrication. See the readiness report and production plan before ordering hardware.</p>
  <ul class="metrics" aria-label="Prototype routing summary">
    <li><strong>${routeCount}</strong> prototype routes</li>
    <li><strong>${unresolvedConnectionCount}</strong> unresolved connections</li>
    <li><strong>4</strong> functional placement zones</li>
    <li><strong>${resolvedSupplierPartCount}</strong> candidate supplier matches</li>
    <li><strong>${renderedCadComponentCount}</strong> rendered CAD bodies</li>
    <li><strong>${partReadinessSummary.manufacturerVerifiedCad}</strong> manufacturer-verified critical CAD models</li>
    <li><strong>${partReadinessSummary.productionApproved}</strong> fabrication-approved critical parts</li>
  </ul>
  <p class="resources"><a href="../docs/production-board-plan.md">Production plan</a><a href="../docs/analog-front-end.md">Analog front-end</a><a href="../docs/fie-modern-power-proposal.md">Modern power proposal</a><a href="analog-sim/summary.json">Simulation summary</a><a href="readiness-report.json">Readiness report</a><a href="critical-part-readiness.json">Critical-part evidence</a><a href="bom.csv">Component decisions</a><a href="http://127.0.0.1:4178/">Bout test simulator</a></p>
  <div class="tabs" role="tablist" aria-label="Circuit views">
    <button id="tab-pcb" role="tab" aria-selected="true" aria-controls="view-pcb" tabindex="0">PCB</button>
    <button id="tab-schematic" role="tab" aria-selected="false" aria-controls="view-schematic" tabindex="-1">Schematic</button>
    <button id="tab-3d" role="tab" aria-selected="false" aria-controls="view-3d" tabindex="-1">3D</button>
    <button id="tab-simulation" role="tab" aria-selected="false" aria-controls="view-simulation" tabindex="-1">Simulation</button>
    <button id="tab-io" role="tab" aria-selected="false" aria-controls="view-io" tabindex="-1">External I/O</button>
  </div>
  <main>
    <section id="view-pcb" role="tabpanel" aria-labelledby="tab-pcb">
      <figure><figcaption>Constrained component placement with prototype autorouting. Select the image to open it full size.</figcaption><a href="pcb.svg"><img class="dark-render" src="pcb.svg" alt="PCB placement with prototype autorouting"></a></figure>
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
    <section id="view-simulation" role="tabpanel" aria-labelledby="tab-simulation" hidden>
      <figure>
        <figcaption>Analog front-end simulation. This is nominal model evidence, not fabrication approval.</figcaption>
        <div id="simulation-visual" class="simulation-layout">
          <p class="simulation-status" role="status">Loading simulation results</p>
        </div>
      </figure>
    </section>
    <section id="view-io" role="tabpanel" aria-labelledby="tab-io" hidden>
      <figure>
        <figcaption>Replaceable, chassis-supported connector modules. Cable insertion loads are carried by the enclosure, not PCB solder joints.</figcaption>
        <div class="io-assembly">
          <article class="io-module">
            <h2>Left reel</h2>
            <p>Three panel-mounted 4 mm banana sockets</p>
            <div class="socket-row" aria-label="Left reel banana sockets A, B, and C">
              <span class="banana-socket"><span aria-hidden="true"></span><span>A</span></span>
              <span class="banana-socket"><span aria-hidden="true"></span><span>B</span></span>
              <span class="banana-socket"><span aria-hidden="true"></span><span>C</span></span>
            </div>
          </article>
          <article class="io-module">
            <h2>Right reel</h2>
            <p>Three panel-mounted 4 mm banana sockets</p>
            <div class="socket-row" aria-label="Right reel banana sockets A, B, and C">
              <span class="banana-socket"><span aria-hidden="true"></span><span>A</span></span>
              <span class="banana-socket"><span aria-hidden="true"></span><span>B</span></span>
              <span class="banana-socket"><span aria-hidden="true"></span><span>C</span></span>
            </div>
          </article>
          <article class="io-module">
            <h2>Communications</h2>
            <p>Replaceable high-cycle connector module</p>
            <div class="port-row">
              <span class="port-model"><span class="rj45-model" aria-hidden="true"></span><span>Ethernet RJ45</span></span>
              <span class="port-model"><span class="usb-c-model" aria-hidden="true"></span><span>USB-C service and limited service power</span></span>
            </div>
          </article>
          <article class="io-module">
            <h2>Primary power</h2>
            <p>Scoring power does not depend on USB negotiation</p>
            <div class="port-row">
              <span class="port-model"><span class="power-model" aria-hidden="true"></span><span>Locking 24 V DC input</span></span>
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

    const simulationRoot = document.querySelector('#simulation-visual')
    const svgNamespace = 'http://www.w3.org/2000/svg'

    function metricCard(label, value, blocked = false) {
      const card = document.createElement('div')
      card.className = blocked ? 'simulation-card blocked' : 'simulation-card'
      const labelNode = document.createElement('span')
      labelNode.textContent = label
      const valueNode = document.createElement('strong')
      valueNode.textContent = value
      card.append(labelNode, valueNode)
      return card
    }

    function svgNode(name, attributes = {}) {
      const node = document.createElementNS(svgNamespace, name)
      for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value))
      return node
    }

    function renderResponseChart(results) {
      const width = 960
      const height = 380
      const margin = { left: 62, right: 22, top: 24, bottom: 50 }
      const chartWidth = width - margin.left - margin.right
      const chartHeight = height - margin.top - margin.bottom
      const boundary = results.filter((result) => result.family === 'resistance-boundary')
      const slow = results.filter((result) => result.family === 'selected-device-bounded-series-screen')
      const maximumResponse = Math.max(30, ...results.map((result) => result.responseUs))
      const x = (loadOhms) => margin.left + (loadOhms / 500) * chartWidth
      const y = (responseUs) => margin.top + chartHeight - (responseUs / maximumResponse) * chartHeight
      const svg = svgNode('svg', {
        'aria-label': 'Response time by simulated line resistance',
        class: 'simulation-chart',
        role: 'img',
        viewBox: '0 0 ' + width + ' ' + height
      })

      for (const resistance of [0, 100, 200, 300, 400, 500]) {
        svg.append(svgNode('line', { class: 'grid', x1: x(resistance), x2: x(resistance), y1: margin.top, y2: margin.top + chartHeight }))
        const label = svgNode('text', { 'text-anchor': 'middle', x: x(resistance), y: height - 18 })
        label.textContent = String(resistance)
        svg.append(label)
      }
      for (const response of [0, 10, 20, 30]) {
        svg.append(svgNode('line', { class: 'grid', x1: margin.left, x2: width - margin.right, y1: y(response), y2: y(response) }))
        const label = svgNode('text', { 'text-anchor': 'end', x: margin.left - 10, y: y(response) + 4 })
        label.textContent = String(response)
        svg.append(label)
      }
      const xLabel = svgNode('text', { 'text-anchor': 'middle', x: margin.left + chartWidth / 2, y: height - 2 })
      xLabel.textContent = 'Line resistance (ohms)'
      const yLabel = svgNode('text', { 'text-anchor': 'middle', transform: 'rotate(-90 14 190)', x: 14, y: 190 })
      yLabel.textContent = 'Response time (microseconds)'
      svg.append(xLabel, yLabel)

      const points = (series) => series.map((result) => x(result.loadOhms) + ',' + y(result.responseUs)).join(' ')
      svg.append(
        svgNode('polyline', { class: 'boundary-series', points: points(boundary) }),
        svgNode('polyline', { class: 'slow-series', points: points(slow) })
      )
      return svg
    }

    function renderSimulation(summary) {
      const results = Array.isArray(summary.results) ? summary.results : []
      if (results.length === 0) throw new Error('The simulation report contains no cases')
      const maximumResponse = Math.max(...results.map((result) => result.responseUs))
      const maximumError = Math.max(...results.map((result) => result.steadyStateErrorMv))
      simulationRoot.replaceChildren()

      const cards = document.createElement('div')
      cards.className = 'simulation-summary'
      cards.append(
        metricCard('Simulated cases', String(results.length)),
        metricCard('Transient screen', summary.transientScreen?.passed ? 'Pass' : 'Fail', !summary.transientScreen?.passed),
        metricCard('M4-01 corner closure', summary.m401Closure?.status ?? 'DENY', true),
        metricCard('Slowest response', maximumResponse.toFixed(2) + ' us'),
        metricCard('Fabrication status', 'Blocked', true)
      )

      const chart = renderResponseChart(results)
      const legend = document.createElement('div')
      legend.className = 'simulation-legend'
      const boundaryLegend = document.createElement('span')
      boundaryLegend.textContent = '500 pF resistance boundary sweep'
      const slowLegend = document.createElement('span')
      slowLegend.textContent = '10 nF selected-device bounded screen'
      legend.append(boundaryLegend, slowLegend)

      const details = document.createElement('div')
      details.className = 'simulation-details'
      const coverage = document.createElement('article')
      const coverageTitle = document.createElement('h2')
      coverageTitle.textContent = 'Pulse coverage'
      const pulseList = document.createElement('ul')
      pulseList.className = 'pulse-list'
      for (const widthUs of summary.coverage?.pulseWidthUs ?? []) {
        const item = document.createElement('li')
        item.textContent = widthUs >= 1000 ? widthUs / 1000 + ' ms' : widthUs + ' us'
        pulseList.append(item)
      }
      const errorNote = document.createElement('p')
      errorNote.textContent = 'Largest nominal steady-state error: ' + maximumError.toFixed(4) + ' mV.'
      coverage.append(coverageTitle, pulseList, errorNote)

      const limitations = document.createElement('article')
      const limitationsTitle = document.createElement('h2')
      limitationsTitle.textContent = 'Why fabrication is still blocked'
      const limitationList = document.createElement('ul')
      limitationList.className = 'limitation-list'
      for (const limitation of summary.modelLimitations ?? []) {
        const item = document.createElement('li')
        item.textContent = limitation
        limitationList.append(item)
      }
      limitations.append(limitationsTitle, limitationList)
      details.append(coverage, limitations)
      simulationRoot.append(cards, chart, legend, details)
    }

    fetch('analog-sim/summary.json')
      .then((response) => {
        if (!response.ok) throw new Error('Simulation results are unavailable')
        return response.json()
      })
      .then(renderSimulation)
      .catch((error) => {
        const status = simulationRoot.querySelector('.simulation-status')
        if (status) status.textContent = error instanceof Error ? error.message : 'Simulation results are unavailable'
      })
  </script>
  <script defer src="interactive-3d-viewer.js?v=interactive"></script>
</body>
</html>
`

await mkdir("dist", { recursive: true })
await Promise.all([
  writeFile("dist/board.glb", new Uint8Array(boardGlb)),
  writeFile("dist/bom.csv", `${bomCsv}\n`),
  writeFile("dist/bom.json", `${JSON.stringify(componentDecisions, null, 2)}\n`),
  writeFile("dist/circuit.json", `${JSON.stringify(circuitJson, null, 2)}\n`),
  writeFile("dist/index.html", previewHtml),
  writeFile("dist/interactive-3d-viewer.js", interactiveViewerModule),
  writeFile("dist/board-3d.svg", threeDimensionalSvg),
  writeFile("dist/pcb.svg", pcbSvg),
  writeFile("dist/readiness-report.json", `${JSON.stringify(readiness, null, 2)}\n`),
  writeFile("dist/critical-part-readiness.json", `${JSON.stringify(criticalPartReadiness, null, 2)}\n`),
  writeFile("dist/schematic.svg", schematicSvg)
])
