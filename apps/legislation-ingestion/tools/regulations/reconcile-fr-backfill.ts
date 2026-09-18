import { createReadStream } from "node:fs"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { createInterface } from "node:readline"
import { parseArgs } from "node:util"
import { digest, validateManifest, type AcquisitionUnit } from "@repo/legislation-core/legal-text/contracts"
import {
  parserLimits,
  regulatoryParserContract,
  regulatoryRecordSchema
} from "@repo/legislation-core/legal-text/parser-contract"
import invariant from "tiny-invariant"
import { z } from "zod"
import { receiptSchema } from "../../src/ingestion/regulations/artifact-backfill.js"
import {
  runFrReconciliationBatch,
  summarizeFrReconciliationBatch,
  type FrReconciliationSuccess,
  type FrReconciliationUnit
} from "../../src/ingestion/regulations/fr-backfill-reconciliation.js"
import { replayFrMetadata } from "../../src/ingestion/regulations/fr-metadata.js"
import { reconcileFrIssue } from "../../src/ingestion/regulations/fr-reconciliation.js"
import { validateRegulatoryOutput } from "../../src/ingestion/regulations/parser-bridge.js"

const { values } = parseArgs({
  options: {
    manifest: { type: "string" },
    raw: { type: "string" },
    normalized: { type: "string" },
    "metadata-root": { type: "string" },
    output: { type: "string" },
    concurrency: { type: "string", default: "4" },
    limit: { type: "string", default: "10000" }
  }
})
const required = (value: unknown) => resolve(z.string().min(1).parse(value))
const manifest = validateManifest(JSON.parse(await readFile(required(values.manifest), "utf8")))
const rawRoot = required(values.raw)
const normalizedRoot = required(values.normalized)
const metadataRoot = required(values["metadata-root"])
const outputRoot = required(values.output)
const concurrency = z.coerce.number().int().min(1).max(16).parse(values.concurrency)
const limit = z.coerce.number().int().min(1).max(10_000).parse(values.limit)
const units = manifest.units
  .filter(
    (unit): unit is AcquisitionUnit & { issueDate: string } => unit.sourceId === "govinfo-fr" && unit.issueDate !== null
  )
  .slice(0, limit)
invariant(units.length > 0, "manifest_has_no_fr_issues")
await mkdir(join(outputRoot, "issues"), { recursive: true })
const parserCodeHash = digest(await readFile(new URL("../../python/regulations/parse_xml.py", import.meta.url)))

async function writeReplayStable(path: string, value: unknown) {
  const body = `${JSON.stringify(value, null, 2)}\n`
  try {
    await writeFile(path, body, { flag: "wx" })
    return false
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error
    invariant((await readFile(path, "utf8")) === body, "reconciliation_report_replay_mismatch")
    return true
  }
}

async function readRecords(directory: string, shards: readonly { file: string }[]) {
  const records: z.infer<typeof regulatoryRecordSchema>[] = []
  for (const shard of shards) {
    const stream = createReadStream(join(directory, shard.file), { encoding: "utf8" })
    const lines = createInterface({ input: stream, crlfDelay: Infinity })
    try {
      for await (const line of lines) records.push(regulatoryRecordSchema.parse(JSON.parse(line)))
    } finally {
      lines.close()
      stream.destroy()
    }
  }
  return records
}

const byKey = new Map(units.map((unit) => [unit.key, unit]))
const batch = await runFrReconciliationBatch({
  units,
  concurrency,
  loadMetadata: async (month) =>
    replayFrMetadata(JSON.parse(await readFile(join(metadataRoot, `fr-metadata-${month}`, "manifest.json"), "utf8"))),
  reconcile: async (selected: FrReconciliationUnit, metadata): Promise<FrReconciliationSuccess> => {
    const unit = byKey.get(selected.key)
    invariant(unit, "fr_unit_disappeared")
    const receipt = receiptSchema.parse(JSON.parse(await readFile(join(rawRoot, "units", `${unit.key}.json`), "utf8")))
    invariant(JSON.stringify(receipt.unit) === JSON.stringify(unit), "receipt_unit_mismatch")
    const generation = digest(
      JSON.stringify([regulatoryParserContract, parserCodeHash, unit.key, receipt.sha256, parserLimits])
    )
    const directory = join(normalizedRoot, generation)
    const summary = await validateRegulatoryOutput(directory, unit, receipt.sha256, parserCodeHash)
    const records = await readRecords(directory, summary.shards)
    const report = reconcileFrIssue({
      unit,
      summary,
      records,
      metadata: metadata.records,
      metadataManifestId: metadata.id
    })
    invariant(report.metadataComplete, `fr_issue_incomplete:${report.gaps.map((gap) => gap.reason).join(",")}`)
    const reportPath = join(outputRoot, "issues", `${unit.issueDate}.json`)
    await writeReplayStable(reportPath, report)
    return {
      unitKey: unit.key,
      issueDate: unit.issueDate,
      status: "reconciled",
      matchedPublications: report.matchedPublications,
      metadataPublications: report.metadataPublications,
      outsideScope: report.outsideScope.length,
      listedPdfsNotAcquired: report.listedPdfsNotAcquired,
      reportId: report.id,
      reportPath
    }
  }
})
const totals = summarizeFrReconciliationBatch(batch.outcomes)
const aggregate = {
  contract: "fr-backfill-reconciliation-2026-09-17",
  manifestId: manifest.id,
  parserCodeHash,
  concurrency,
  months: batch.months,
  ...totals,
  canonicalWrites: false,
  published: 0,
  indexed: 0,
  embedded: 0,
  recurringIngestionEnabled: false,
  status: totals.failedIssues === 0 && totals.reconciledIssues === units.length ? "reconciled" : "incomplete"
}
const aggregatePath = join(outputRoot, "summary.json")
await writeReplayStable(aggregatePath, aggregate)
process.stdout.write(`${JSON.stringify({ report: aggregatePath, ...aggregate })}\n`)
if (aggregate.status !== "reconciled") process.exitCode = 1
