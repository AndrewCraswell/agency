import { createReadStream } from "node:fs"
import { readFile, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { createInterface } from "node:readline"
import { parseArgs } from "node:util"
import invariant from "tiny-invariant"
import { z } from "zod"
import { receiptSchema } from "../../src/ingestion/regulations/artifact-backfill.js"
import { digest, validateManifest } from "../../src/ingestion/regulations/contracts.js"
import { replayFrMetadata } from "../../src/ingestion/regulations/fr-metadata.js"
import { reconcileFrIssue } from "../../src/ingestion/regulations/fr-reconciliation.js"
import { validateRegulatoryOutput } from "../../src/ingestion/regulations/parser-bridge.js"
import {
  parserLimits,
  regulatoryParserContract,
  regulatoryRecordSchema
} from "../../src/ingestion/regulations/parser-contract.js"

const { values } = parseArgs({
  options: {
    manifest: { type: "string" },
    date: { type: "string" },
    raw: { type: "string" },
    normalized: { type: "string" },
    metadata: { type: "string" },
    output: { type: "string" }
  }
})
const required = (value: unknown) => resolve(z.string().min(1).parse(value))
const manifest = validateManifest(JSON.parse(await readFile(required(values.manifest), "utf8")))
const date = z.iso.date().parse(values.date)
const unit = manifest.units.find((item) => item.sourceId === "govinfo-fr" && item.issueDate === date)
invariant(unit, "fr_issue_missing_from_manifest")
const metadata = await replayFrMetadata(JSON.parse(await readFile(required(values.metadata), "utf8")))
invariant(metadata.scope.start <= date && metadata.scope.end >= date, "metadata_scope_missing_issue")
const receipt = receiptSchema.parse(
  JSON.parse(await readFile(join(required(values.raw), "units", `${unit.key}.json`), "utf8"))
)
invariant(JSON.stringify(receipt.unit) === JSON.stringify(unit), "receipt_unit_mismatch")
const parserCodeHash = digest(await readFile(new URL("../../python/regulations/parse_xml.py", import.meta.url)))
const generation = digest(
  JSON.stringify([regulatoryParserContract, parserCodeHash, unit.key, receipt.sha256, parserLimits])
)
const directory = join(required(values.normalized), generation)
const summary = await validateRegulatoryOutput(directory, unit, receipt.sha256, parserCodeHash)
const records = []
for (const shard of summary.shards) {
  const stream = createReadStream(join(directory, shard.file), { encoding: "utf8" })
  const lines = createInterface({ input: stream, crlfDelay: Infinity })
  try {
    for await (const line of lines) {
      records.push(regulatoryRecordSchema.parse(JSON.parse(line)))
    }
  } finally {
    lines.close()
    stream.destroy()
  }
}
const report = reconcileFrIssue({ unit, summary, records, metadata: metadata.records, metadataManifestId: metadata.id })
await writeFile(required(values.output), JSON.stringify(report, null, 2), { flag: "wx" })
process.stdout.write(
  `${JSON.stringify({
    report: values.output,
    status: report.status,
    matched: report.matchedPublications,
    gaps: report.gaps,
    outsideScope: report.outsideScope,
    listedPdfsNotAcquired: report.listedPdfsNotAcquired,
    publicationReady: false
  })}\n`
)
if (!report.metadataComplete) {
  process.exitCode = 1
}
