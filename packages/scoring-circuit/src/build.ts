import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
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
const outputDirectory = fileURLToPath(new URL("../dist/", import.meta.url))
const outputPath = (filename: string) => join(outputDirectory, filename)

await mkdir(outputDirectory, { recursive: true })
await Promise.all(
  ["board-3d.svg", "board.glb", "interactive-3d-viewer.js", "pcb.svg", "schematic.svg"].map((filename) =>
    rm(outputPath(filename), { force: true })
  )
)

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
  await mkdir(outputDirectory, { recursive: true })
  await writeFile(outputPath("routing-diagnostic.json"), JSON.stringify(circuitJson, null, 2))
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
const estimatedBomTotalUsd = orderFiles.bom.reduce(
  (total, { estimatedExtendedPriceUsd }) => total + estimatedExtendedPriceUsd,
  0
)
const renderedCadComponentCount = circuitJson.filter((element) => element.type === "cad_component").length
const runframeBundlePath = fileURLToPath(import.meta.resolve("@tscircuit/runframe/standalone-preview"))
const runframePackageJson = JSON.parse(await readFile(join(dirname(runframeBundlePath), "../package.json"), "utf8"))
const runframeVersion = String(runframePackageJson.version)
const runframeHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Scoring apparatus circuit preview</title>
  <style>html, body, #root { height: 100%; margin: 0; }</style>
</head>
<body>
  <div id="root">Loading circuit viewer...</div>
  <script>
    window.CIRCUIT_JSON_PREVIEW_PROPS = {
      availableTabs: ["pcb", "schematic", "cad"],
      defaultActiveTab: "pcb",
      isWebEmbedded: true,
      projectName: "competition-scoring-apparatus",
      readOnly: true,
      showCodeTab: false,
      showFileMenu: false,
      showJsonTab: false,
      showRightHeaderContent: true,
      showToggleFullScreen: true
    }
    fetch("circuit.json")
      .then((response) => {
        if (!response.ok) throw new Error("Circuit data could not be loaded")
        return response.json()
      })
      .then((circuitJson) => {
        window.CIRCUIT_JSON = circuitJson
        const viewerScript = document.createElement("script")
        viewerScript.type = "module"
        viewerScript.src = "runframe-preview.js?v=${runframeVersion}"
        viewerScript.onerror = () => { document.getElementById("root").textContent = "Circuit viewer could not be loaded." }
        document.body.append(viewerScript)
      })
      .catch(() => { document.getElementById("root").textContent = "Circuit data could not be loaded." })
  </script>
</body>
</html>
`
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
    main { display: grid; gap: 24px; margin-top: 24px; }
    figure { margin: 0; padding: 16px; border: 1px solid #33424f; border-radius: 8px; background: #101820; }
    figcaption { margin-bottom: 12px; font-weight: 700; }
    .runframe { display: block; width: 100%; height: min(72vh, 820px); min-height: 520px; border: 0; border-radius: 6px; background: white; }
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
      figure { padding: 10px; }
      .runframe { height: 68vh; min-height: 420px; }
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
    <li><strong>${resolvedPartCount}</strong> priced parts with manufacturer numbers</li>
    <li><strong>$${estimatedBomTotalUsd.toFixed(2)}</strong> estimated component cost, excluding the bare PCB, assembly, shipping, tax, and off-board equipment</li>
    <li><strong>${renderedCadComponentCount}</strong> rendered CAD bodies</li>
  </ul>
  <p class="resources"><a href="../usb-scoring-platform/design-review.md">Current hardware review</a><a href="../docs/clean-sheet-board-architecture.md">Board architecture</a><a href="bom.csv">Prototype BOM</a><a href="placement.csv">Placement file</a><a href="${simulatorPresentationUrl}">Bout test simulator</a></p>
  <main>
    <section aria-labelledby="board-preview-heading">
      <figure>
        <figcaption id="board-preview-heading">Interactive tscircuit preview. Use its PCB, Schematic, and 3D views to inspect the generated board.</figcaption>
        <iframe class="runframe" src="runframe.html?v=${runframeVersion}" title="Interactive PCB, schematic, and three-dimensional board preview"></iframe>
      </figure>
    </section>
    <section aria-labelledby="external-connections-heading">
      <figure>
        <figcaption id="external-connections-heading">External connections</figcaption>
        <p>Prototype interfaces with selected connector part numbers and clearly identified custom conductor landings.</p>
        <div class="io-assembly">
          <article class="io-module">
            <h2>Sullins PREC003SAAN-RC - left weapon harness landing</h2>
            <p>The left fencer's three-pin cable connects the weapon, conductive clothing, and return circuit to the scoring machine. The board's 2.54 mm header is a wire landing, not the cable's mating socket. Three wires connect it to the off-board assembly made from Ok Fencing-supplied 4 mm female banana sockets. Those sockets are arranged in one line with the outer sockets 15 mm and 20 mm from the centre socket under FIE m.55.6.</p>
            <div class="socket-row" aria-label="Left weapon cable solder landings A, B, and C">
              <span class="banana-socket"><span aria-hidden="true"></span><span>A</span></span>
              <span class="banana-socket"><span aria-hidden="true"></span><span>B</span></span>
              <span class="banana-socket"><span aria-hidden="true"></span><span>C</span></span>
            </div>
          </article>
          <article class="io-module">
            <h2>Sullins PREC003SAAN-RC - right weapon harness landing</h2>
            <p>The right fencer's three-pin cable connects the weapon, conductive clothing, and return circuit to the scoring machine. The board's 2.54 mm header is a wire landing, not the cable's mating socket. Three wires connect it to the off-board assembly made from Ok Fencing-supplied 4 mm female banana sockets. Those sockets are arranged in one line with the outer sockets 15 mm and 20 mm from the centre socket under FIE m.55.6.</p>
            <div class="socket-row" aria-label="Right weapon cable solder landings A, B, and C">
              <span class="banana-socket"><span aria-hidden="true"></span><span>A</span></span>
              <span class="banana-socket"><span aria-hidden="true"></span><span>B</span></span>
              <span class="banana-socket"><span aria-hidden="true"></span><span>C</span></span>
            </div>
          </article>
          <article class="io-module">
            <h2>Sullins PREC001SAAN-RC - piste-reference harness landing</h2>
            <p>This single board pin is a wire landing for an off-board Ok Fencing-supplied 4 mm female banana socket. The socket connects the scoring circuit's piste reference to the conductive metal piste. It lets the machine recognize a blade touching the floor and reject it instead of showing a valid hit, as required by FIE m.51.1. This is a scoring reference, not protective-earth wiring.</p>
            <div class="socket-row" aria-label="Piste reference solder landing">
              <span class="banana-socket"><span aria-hidden="true"></span><span>PISTE</span></span>
            </div>
          </article>
          <article class="io-module">
            <h2>Vishay TSOP38438 - 38 kHz IR receiver</h2>
            <p>This front-facing sensor receives and demodulates the handheld remote's infrared signal, then sends the digital pulse stream to ESP32 GPIO38. The ESP32 firmware authenticates and decodes the encrypted command so the referee can control the scoring machine without a cable.</p>
          </article>
          <article class="io-module">
            <h2>PS1240P02BT - scoring sounder</h2>
            <p>Produces the audible hit signal from GPIO48 at its rated 4 kHz frequency so fencers and officials hear when the machine registers a touch.</p>
          </article>
          <article class="io-module">
            <h2>TST-108-02-G-D and 645004114822 - 64x32 RGB display</h2>
            <p>The Samtec keyed 2x8 header carries HUB75 image data and the Wuerth four-pin header carries 5 V power to the 64x32, 1/16-scan panel that displays score, time, cards, and match state.</p>
          </article>
          <article class="io-module">
            <h2>WIZ850io - Ethernet and Cyrano</h2>
            <p>The module's RJ45 Ethernet socket carries Cyrano score and bout updates from the scoring machine to bout-committee software and other networked competition systems.</p>
            <div class="port-row">
              <span class="port-model"><span class="rj45-model" aria-hidden="true"></span><span>WIZ850io RJ45</span></span>
            </div>
          </article>
          <article class="io-module">
            <h2>TE 5520250-2 - FA-05 repeater 1</h2>
            <p>This isolated 6P4C RJ14 DATA-LINE output connects the first Favero FA-05 lamp repeater, typically placed at one end of the piste so spectators and officials can see the hit lights.</p>
            <div class="port-row"><span class="port-model"><span class="rj14-model" aria-hidden="true"></span><span>TE 5520250-2</span></span></div>
          </article>
          <article class="io-module">
            <h2>TE 5520250-2 - FA-05 repeater 2</h2>
            <p>This second isolated 6P4C RJ14 DATA-LINE output connects another Favero FA-05 lamp repeater, normally at the opposite end of the piste for the same score-light visibility.</p>
            <div class="port-row"><span class="port-model"><span class="rj14-model" aria-hidden="true"></span><span>TE 5520250-2</span></span></div>
          </article>
          <article class="io-module">
            <h2>Adafruit 5807 - USB-C PD power</h2>
            <p>This USB-C socket is the normal power input. The Adafruit HUSB238 module requests 20 V from a compatible USB-C PD supply, and the on-board Pololu regulator converts it to the 5 V used by the prototype.</p>
            <div class="port-row"><span class="port-model"><span class="usb-c-model" aria-hidden="true"></span><span>Adafruit 5807</span></span></div>
          </article>
        </div>
      </figure>
    </section>
  </main>
</body>
</html>
`

await Promise.all([
  writeFile(outputPath("bom.csv"), `${orderFiles.bomCsv}\n`),
  writeFile(outputPath("bom.json"), `${JSON.stringify(orderFiles.bom, null, 2)}\n`),
  writeFile(outputPath("circuit.json"), `${JSON.stringify(circuitJson, null, 2)}\n`),
  writeFile(outputPath("index.html"), previewHtml),
  writeFile(outputPath("placement.csv"), `${orderFiles.placementCsv}\n`),
  writeFile(outputPath("runframe.html"), runframeHtml),
  copyFile(runframeBundlePath, outputPath("runframe-preview.js"))
])
