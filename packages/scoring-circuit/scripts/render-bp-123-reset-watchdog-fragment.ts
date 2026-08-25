import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import {
  bp123ResetWatchdogFragmentArtifactPaths,
  createBp123ResetWatchdogFragmentErcReport,
  renderBp123ResetWatchdogFragmentSchematic
} from "../src/bp-123-reset-watchdog-fragment-artifacts.js"

const sha256 = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex")
const packageRoot = resolve(import.meta.dirname, "..")
const sourcePath = resolve(packageRoot, bp123ResetWatchdogFragmentArtifactPaths.source)
const schematicSvgPath = resolve(packageRoot, bp123ResetWatchdogFragmentArtifactPaths.schematicSvg)
const ercReportPath = resolve(packageRoot, bp123ResetWatchdogFragmentArtifactPaths.ercReport)
const manifestPath = resolve(packageRoot, bp123ResetWatchdogFragmentArtifactPaths.manifest)

const source = await readFile(sourcePath)
const { errorElementTypes, schematicSvg } = renderBp123ResetWatchdogFragmentSchematic()
const ercReport = createBp123ResetWatchdogFragmentErcReport(sha256(source), schematicSvg, errorElementTypes)
const ercReportText = `${JSON.stringify(ercReport, null, 2)}\n`
const manifest = [
  `${sha256(source)}  ${bp123ResetWatchdogFragmentArtifactPaths.source}`,
  `${sha256(schematicSvg)}  ${bp123ResetWatchdogFragmentArtifactPaths.schematicSvg}`,
  `${sha256(ercReportText)}  ${bp123ResetWatchdogFragmentArtifactPaths.ercReport}`
].join("\n")

await mkdir(dirname(schematicSvgPath), { recursive: true })
await Promise.all([
  writeFile(schematicSvgPath, schematicSvg),
  writeFile(ercReportPath, ercReportText),
  writeFile(manifestPath, `${manifest}\n`)
])
