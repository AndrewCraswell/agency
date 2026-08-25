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
import { benchPrototypeBom } from "./bench-prototype-bom.js"
import { createReadinessReport, resolveSimulatorPresentationUrl } from "./board-artifact.js"
import ScoringCircuit from "./index.circuit.js"
import {
  criticalPartReadiness,
  summarizeCriticalPartReadiness,
  validateCriticalPartReadiness
} from "./part-readiness.js"

type PlatformPartsEngine = NonNullable<Parameters<InstanceType<typeof Circuit>["setPlatform"]>[0]["partsEngine"]>

const simulatorPresentationUrl = resolveSimulatorPresentationUrl(process.env)

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
    Object.values(element.supplier_part_numbers ?? {}).some(
      (partNumbers) => Array.isArray(partNumbers) && partNumbers.length > 0
    )
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
const bomHeader = [
  "reference",
  "function",
  "disposition",
  "quantity",
  "manufacturer",
  "mpn",
  "lifecycle",
  "package",
  "notes",
  "source_url"
]
const quoteCsv = (value: string) => `"${value.replaceAll('"', '""')}"`
const bomCsv = [
  bomHeader.join(","),
  ...benchPrototypeBom.rows.map((component) =>
    [
      component.reference,
      component.function,
      component.disposition,
      String(component.quantity),
      component.manufacturer ?? "",
      component.mpn ?? "",
      component.lifecycle ?? "",
      component.package ?? "",
      component.notes,
      component.source?.url ?? ""
    ]
      .map(quoteCsv)
      .join(",")
  )
].join("\n")
const readiness = createReadinessReport({
  circuitJson,
  criticalPartReadiness,
  readiness: {
    canonicalBenchPrototype: true,
    fabricationReady: false,
    modelAuthority: "canonical-clean-sheet-scaffold",
    modelPurpose:
      "Canonical source, hierarchy, provisional outline, and mounting-hole scaffold for the clean-sheet ESP32-S3 prototype; electrical integration and fabrication remain denied",
    retainedArchitectureRouting: {
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
      "Complete BP-321 through BP-335 clean-sheet schematic sheets, integration, and review",
      "Complete BP-420 through BP-435 stack-up, placement, routing, DRC, and release reviews",
      "Close every unresolved component selection and footprint gate before fabrication",
      "Run the physical bring-up and acceptance work tracked by BP-620 through BP-633"
    ]
  } as const
})
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
  <p class="warning"><strong>Canonical clean-sheet scaffold only.</strong> This model establishes the new board source, outline, hierarchy, and mounting datum. It has no integrated electrical design and is not ready for fabrication. Complete BP-321 through BP-435 before ordering hardware.</p>
  <ul class="metrics" aria-label="Prototype routing summary">
    <li><strong>${routeCount}</strong> scaffold routes</li>
    <li><strong>${unresolvedConnectionCount}</strong> unresolved connections</li>
    <li><strong>12</strong> planned schematic sheets</li>
    <li><strong>${resolvedSupplierPartCount}</strong> candidate supplier matches</li>
    <li><strong>${renderedCadComponentCount}</strong> rendered CAD bodies</li>
    <li><strong>${partReadinessSummary.manufacturerVerifiedCad}</strong> manufacturer-verified critical CAD models</li>
    <li><strong>${partReadinessSummary.productionApproved}</strong> fabrication-approved critical parts</li>
  </ul>
  <p class="resources"><a href="../docs/esp32-prototype-backlog.md">Prototype backlog</a><a href="../docs/clean-sheet-board-architecture.md">Clean-sheet architecture</a><a href="../docs/analog-front-end.md">Analog front-end</a><a href="../docs/fie-modern-power-proposal.md">Modern power proposal</a><a href="analog-sim/summary.json">Simulation summary</a><a href="readiness-report.json">Readiness report</a><a href="critical-part-readiness.json">Critical-part evidence</a><a href="bom.csv">Prototype baseline BOM</a><a href="${simulatorPresentationUrl}">Bout test simulator</a></p>
  <div class="tabs" role="tablist" aria-label="Circuit views">
    <button id="tab-pcb" role="tab" aria-selected="true" aria-controls="view-pcb" tabindex="0">PCB</button>
    <button id="tab-schematic" role="tab" aria-selected="false" aria-controls="view-schematic" tabindex="-1">Schematic</button>
    <button id="tab-3d" role="tab" aria-selected="false" aria-controls="view-3d" tabindex="-1">3D</button>
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
    <section id="view-io" role="tabpanel" aria-labelledby="tab-io" hidden>
      <figure>
        <figcaption>Clean-sheet prototype external interfaces. Weapon-cable geometry remains unmeasured and no production socket is selected.</figcaption>
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
            <h2>Communications</h2>
            <p>Required board interfaces</p>
            <div class="port-row">
              <span class="port-model"><span class="rj45-model" aria-hidden="true"></span><span>Ethernet RJ45</span></span>
              <span class="port-model"><span class="usb-c-model" aria-hidden="true"></span><span>USB-C PD power and service data</span></span>
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
  writeFile("dist/bom.csv", `${bomCsv}\n`),
  writeFile("dist/bom.json", `${JSON.stringify(benchPrototypeBom, null, 2)}\n`),
  writeFile("dist/circuit.json", `${JSON.stringify(circuitJson, null, 2)}\n`),
  writeFile("dist/index.html", previewHtml),
  writeFile("dist/interactive-3d-viewer.js", interactiveViewerModule),
  writeFile("dist/board-3d.svg", threeDimensionalSvg),
  writeFile("dist/pcb.svg", pcbSvg),
  writeFile("dist/readiness-report.json", `${JSON.stringify(readiness, null, 2)}\n`),
  writeFile("dist/critical-part-readiness.json", `${JSON.stringify(criticalPartReadiness, null, 2)}\n`),
  writeFile("dist/schematic.svg", schematicSvg)
])
