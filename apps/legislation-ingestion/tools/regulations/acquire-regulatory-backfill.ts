import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { parseArgs } from "node:util"
import { validateManifest } from "@repo/legislation-core/legal-text/contracts"
import { z } from "zod"
import { acquireRegulatoryBackfill } from "../../src/ingestion/regulations/artifact-backfill.js"
import { planRegulatoryBackfill } from "../../src/ingestion/regulations/backfill-plan.js"

const { values } = parseArgs({
  options: {
    manifest: { type: "string" },
    output: { type: "string" },
    apply: { type: "boolean", default: false },
    limit: { type: "string", default: "4" },
    "maximum-bytes": { type: "string", default: String(256 * 1024 * 1024) }
  }
})
const manifest = validateManifest(JSON.parse(await readFile(resolve(z.string().min(1).parse(values.manifest)), "utf8")))
const rebuilt = await planRegulatoryBackfill(manifest.scope, async (source, url) => {
  const evidence = manifest.inventory.find((item) => item.sourceId === source && item.url === url)
  if (evidence === undefined) {
    throw new Error("Missing retained source inventory")
  }
  return evidence
})
if (rebuilt.id !== manifest.id) {
  throw new Error("Manifest differs from its source inventory")
}
const limit = z.coerce.number().int().min(1).max(10_000).parse(values.limit)
if (!values.apply) {
  process.stdout.write(
    `${JSON.stringify({ mode: "preview", manifestId: manifest.id, units: manifest.units.length, limit, canonicalWrites: false })}\n`
  )
} else {
  const report = await acquireRegulatoryBackfill(manifest, resolve(z.string().min(1).parse(values.output)), {
    limit,
    maximumBytes: z.coerce.number().parse(values["maximum-bytes"]),
    onUnit: (result) => process.stdout.write(`${JSON.stringify(result)}\n`)
  })
  process.stdout.write(`${JSON.stringify({ ...report, acquired: report.acquired.length })}\n`)
  if (report.failures.length > 0) {
    process.exitCode = 1
  }
}
