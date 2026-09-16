import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { parseArgs } from "node:util"
import { digest } from "@repo/legislation-core/legal-text/contracts"
import { z } from "zod"
import { auditRetainedRegulatoryInputs } from "../../src/ingestion/regulations/retained-audit.js"

const { values } = parseArgs({
  options: {
    manifest: { type: "string" },
    locations: { type: "string" },
    output: { type: "string" }
  }
})
const manifestPath = resolve(z.string().min(1).parse(values.manifest))
const locationsPath = resolve(z.string().min(1).parse(values.locations))
const output = resolve(z.string().min(1).parse(values.output))
const parserPath = fileURLToPath(new URL("../../python/regulations/parse_xml.py", import.meta.url))
const report = await auditRetainedRegulatoryInputs({
  manifest: JSON.parse(await readFile(manifestPath, "utf8")),
  locations: JSON.parse(await readFile(locationsPath, "utf8")),
  parserCodeHash: digest(await readFile(parserPath))
})
await mkdir(dirname(output), { recursive: true })
await writeFile(output, JSON.stringify(report, null, 2), { flag: "wx" })
process.stdout.write(
  `${JSON.stringify({ output, manifestId: report.manifestId, expectedUnits: report.expectedUnits, verifiedRawUnits: report.verifiedRawUnits, verifiedNormalizedUnits: report.verifiedNormalizedUnits, verifiedOlderNormalizedUnits: report.verifiedOlderNormalizedUnits, normalizedInventoryIssues: report.normalizedInventoryIssues.length, completeCanonicalAudit: false, dispatchEnabled: false })}\n`
)
if (
  report.normalizedInventoryIssues.length > 0 ||
  report.units.some(
    (unit) =>
      unit.rawStatus === "invalid" ||
      unit.normalizedStatus === "invalid" ||
      unit.retainedGenerations.some((generation) => generation.status === "invalid")
  )
) {
  process.exitCode = 1
}
