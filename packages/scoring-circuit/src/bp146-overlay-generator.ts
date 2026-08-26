import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

/**
 * The retained BP-146 SVGs are generated from the same explicit project
 * datums as the review footprint. They are not manufacturer CAD and are not
 * an optical or fabrication acceptance record.
 */
export const BP146_OVERLAY_GENERATOR = "deterministic-svg-overlay-generator"
export const BP146_OVERLAY_GENERATOR_VERSION = "2.1.0"

const projectFootprintOverlayPath = "docs/evidence/bp-146/tsop38438-project-footprint-overlay.svg"
const projectAssemblyOverlayPath = "docs/evidence/bp-146/tsop38438-project-assembly-overlay.svg"

function commonPackageMetadata(kind: "footprint" | "assembly") {
  const reviewState = kind === "footprint" ? "fabrication denied" : "physical and fabrication gates denied"
  return `BP-146 TSOP38438 project ${kind} overlay; scale 1:1; blue outline is a deterministic projection of retained manufacturer drawing dimensions, not manufacturer CAD; lens front datum is (2.5,0), the circular front projection has center (2.5,2) and radius 2, the 5 mm-wide rear body block spans y=2 through y=4.8, pin 1 and lead row are at y=3.6 from the 1.2 mm nominal body-back-edge dimension, and package height 6.95 mm is not a board-plane depth; project drill 1.10 mm, copper pad 2.20 mm, mask opening 2.30 mm, 0.24 mm mask web at 2.54 mm pitch; generator ${BP146_OVERLAY_GENERATOR} ${BP146_OVERLAY_GENERATOR_VERSION}; review pending; ${reviewState}.`
}

const packageDrawing = `  <g id="package-drawing" fill="none" stroke="#1d4ed8" stroke-width="0.05">
    <rect x="0" y="2" width="5" height="2.8" />
    <circle cx="2.5" cy="2" r="2" />
    <line x1="0" y1="2" x2="5" y2="2" />
    <circle cx="2.5" cy="0" r="0.3" />
  </g>`

const projectPads = `  <g id="project-pins" fill="none" stroke="#b91c1c" stroke-width="0.05">
    <circle cx="0" cy="3.6" r="1.1" />
    <circle cx="2.54" cy="3.6" r="1.1" />
    <circle cx="5.08" cy="3.6" r="1.1" />
    <circle cx="0" cy="3.6" r="1.15" stroke-dasharray="0.1 0.1" />
    <circle cx="2.54" cy="3.6" r="1.15" stroke-dasharray="0.1 0.1" />
    <circle cx="5.08" cy="3.6" r="1.15" stroke-dasharray="0.1 0.1" />
  </g>`

export function generateBp146FootprintOverlay(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="14mm" height="12mm" viewBox="-4 -3 14 12">
  <metadata>${commonPackageMetadata("footprint")}</metadata>
${packageDrawing}
  <g id="project-footprint" fill="none" stroke="#b91c1c" stroke-width="0.05">
    <rect x="-1.65" y="-0.55" width="8.38" height="5.9" stroke-dasharray="0.15 0.1" />
    <text x="-3.5" y="-1.5" fill="#111827" stroke="none" font-size="0.35">LENS y=0; LEADS y=3.6; 0.55 mm COURTYARD; BLUE PROJECTION; NOT CAD</text>
  </g>
${projectPads}
</svg>
`
}

export function generateBp146AssemblyOverlay(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="14mm" height="14mm" viewBox="-4 -4 14 14">
  <metadata>${commonPackageMetadata("assembly")}; optical axis points negative y; project optical keepout is a 3 mm radial board rule.</metadata>
${packageDrawing}
  <g id="project-assembly" fill="none" stroke="#15803d" stroke-width="0.05">
    <rect x="0" y="2" width="5" height="2.8" stroke-dasharray="0.12 0.08" />
    <circle cx="2.5" cy="2" r="2" stroke-dasharray="0.12 0.08" />
    <circle cx="2.5" cy="0" r="3" stroke-dasharray="0.2 0.12" />
    <line x1="2.5" y1="0" x2="2.5" y2="-3" />
    <text x="-3.5" y="-3.4" fill="#111827" stroke="none" font-size="0.35">AXIS -Y; BODY/LENS OBSTRUCTION; 3 mm KEEPOUT REVIEW ONLY</text>
  </g>
${projectPads}
</svg>
`
}

export const bp146OverlayArtifacts = {
  [projectFootprintOverlayPath]: generateBp146FootprintOverlay(),
  [projectAssemblyOverlayPath]: generateBp146AssemblyOverlay()
} as const

export function writeBp146OverlayArtifacts(packageRoot = fileURLToPath(new URL("../", import.meta.url))) {
  for (const [relativePath, contents] of Object.entries(bp146OverlayArtifacts)) {
    const artifactPath = resolve(packageRoot, relativePath)
    mkdirSync(dirname(artifactPath), { recursive: true })
    writeFileSync(artifactPath, contents, "utf8")
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  writeBp146OverlayArtifacts()
}
