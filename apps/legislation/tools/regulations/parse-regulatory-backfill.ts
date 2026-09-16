import { readFile, mkdir, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { parseArgs } from "node:util"
import { z } from "zod"
import { receiptSchema } from "../../src/ingestion/regulations/artifact-backfill.js"
import { validateManifest } from "../../src/ingestion/regulations/contracts.js"
import { parseRegulatoryArtifact } from "../../src/ingestion/regulations/parser-bridge.js"

const { values } = parseArgs({
  options: {
    manifest: { type: "string" },
    raw: { type: "string" },
    output: { type: "string" },
    python: { type: "string" },
    limit: { type: "string", default: "5" },
    apply: { type: "boolean", default: false }
  }
})
const manifest = validateManifest(JSON.parse(await readFile(resolve(z.string().min(1).parse(values.manifest)), "utf8")))
const limit = z.coerce.number().int().min(1).max(10_000).parse(values.limit)
if (!values.apply) {
  process.stdout.write(
    `${JSON.stringify({ mode: "preview", manifestId: manifest.id, units: manifest.units.length, limit, canonicalWrites: false })}\n`
  )
} else {
  const raw = resolve(z.string().min(1).parse(values.raw))
  const output = resolve(z.string().min(1).parse(values.output))
  const results = []
  const failures = []
  for (const unit of manifest.units.slice(0, limit)) {
    try {
      const receipt = receiptSchema.parse(JSON.parse(await readFile(join(raw, "units", `${unit.key}.json`), "utf8")))
      if (JSON.stringify(receipt.unit) !== JSON.stringify(unit)) {
        throw new Error("Acquisition receipt does not match frozen unit")
      }
      const result = await parseRegulatoryArtifact({
        unit,
        artifactHash: receipt.sha256,
        path: join(raw, "blobs", `${receipt.sha256}.xml`),
        outputRoot: output,
        pythonExecutable: values.python
      })
      const summary = {
        unit: unit.nativeId,
        generation: result.generation,
        directory: result.directory,
        reused: result.reused,
        records: result.summary.records,
        countsByKind: result.summary.countsByKind,
        warnings: result.summary.warnings,
        elapsedSeconds: result.summary.elapsedSeconds,
        publicationReady: false
      }
      results.push(summary)
      process.stdout.write(`${JSON.stringify(summary)}\n`)
    } catch (error) {
      failures.push({
        unit: unit.nativeId,
        error: error instanceof Error ? error.message.slice(0, 300) : "Parser failed"
      })
    }
  }
  await mkdir(output, { recursive: true })
  const report = {
    manifestId: manifest.id,
    results,
    failures,
    expectedUnits: manifest.units.length,
    parsedUnits: results.length,
    pendingUnits: manifest.units.length - results.length,
    canonicalWrites: false,
    published: 0,
    indexed: 0,
    embedded: 0,
    recurringIngestionEnabled: false
  }
  const reportPath = join(output, `parse-report-${Date.now()}.json`)
  await writeFile(reportPath, JSON.stringify(report, null, 2), { flag: "wx" })
  process.stdout.write(`${JSON.stringify({ reportPath, parsedUnits: results.length, failures, published: 0 })}\n`)
  if (failures.length > 0) {
    process.exitCode = 1
  }
}
