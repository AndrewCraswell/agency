import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { parseArgs } from "node:util"
import invariant from "tiny-invariant"
import { z } from "zod"
import { isSupportedFrMetadataType } from "../../src/ingestion/regulations/fr-metadata-contract.js"
import { replayFrMetadata } from "../../src/ingestion/regulations/fr-metadata.js"
import { acquireFrPdfs, frPdfAcquisitionCheckpointSchema } from "../../src/ingestion/regulations/fr-pdf.js"
const { values } = parseArgs({
  options: {
    metadataRoot: { type: "string" },
    directory: { type: "string" },
    reports: { type: "string" },
    output: { type: "string" },
    start: { type: "string" },
    end: { type: "string" },
    attempts: { type: "string", default: "3" },
    apply: { type: "boolean", default: false }
  }
})
const path = (value: unknown) => resolve(z.string().min(1).parse(value))
const metadataRoot = path(values.metadataRoot)
const directory = path(values.directory)
const reportsDirectory = path(values.reports)
const output = path(values.output)
const start = z.iso.date().optional().parse(values.start)
const end = z.iso.date().optional().parse(values.end)
invariant(start === undefined || end === undefined || start <= end, "fr_pdf_backfill_invalid_range")
const attempts = z.coerce.number().int().min(1).max(5).parse(values.attempts)

const manifests = []
for (const item of (await readdir(metadataRoot, { withFileTypes: true })).sort((a, b) =>
  a.name.localeCompare(b.name)
)) {
  if (!item.isDirectory() || !/^fr-metadata-\d{4}-\d{2}$/.test(item.name)) continue
  manifests.push(
    await replayFrMetadata(JSON.parse(await readFile(join(metadataRoot, item.name, "manifest.json"), "utf8")))
  )
}
invariant(manifests.length > 0, "fr_pdf_backfill_metadata_missing")
const units = manifests
  .flatMap((manifest) =>
    [
      ...new Set(
        manifest.records
          .filter((record) => isSupportedFrMetadataType(record.type))
          .map((record) => record.publication_date)
      )
    ]
      .sort()
      .map((date) => ({
        date,
        manifest,
        expected: manifest.records.filter(
          (record) => record.publication_date === date && isSupportedFrMetadataType(record.type)
        ).length
      }))
  )
  .filter(({ date }) => (start === undefined || date >= start) && (end === undefined || date <= end))
  .sort((a, b) => a.date.localeCompare(b.date))
invariant(units.length > 0, "fr_pdf_backfill_range_empty")
invariant(new Set(units.map(({ date }) => date)).size === units.length, "fr_pdf_backfill_duplicate_date")

await mkdir(reportsDirectory, { recursive: true })
let checkpointedDates = 0
let acquiredDates = 0
let supportedPublications = 0
let acquiredPublications = 0
for (const unit of units) {
  supportedPublications += unit.expected
  const checkpointPath = join(reportsDirectory, `${unit.date}.json`)
  let checkpoint: z.infer<typeof frPdfAcquisitionCheckpointSchema> | undefined
  try {
    checkpoint = frPdfAcquisitionCheckpointSchema.parse(JSON.parse(await readFile(checkpointPath, "utf8")))
    invariant(
      checkpoint.metadataManifestId === unit.manifest.id &&
        checkpoint.date === unit.date &&
        checkpoint.expected === unit.expected &&
        checkpoint.results.length === unit.expected,
      "fr_pdf_backfill_checkpoint_mismatch"
    )
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error
  }
  if (checkpoint !== undefined) {
    checkpointedDates++
    acquiredPublications += checkpoint.results.length
    process.stdout.write(
      `${JSON.stringify({ date: unit.date, status: "checkpointed", completed: checkpointedDates + acquiredDates, total: units.length })}\n`
    )
    continue
  }
  invariant(values.apply, `fr_pdf_backfill_checkpoint_missing:${unit.date}`)
  let report
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    report = await acquireFrPdfs({
      metadataManifestId: unit.manifest.id,
      records: unit.manifest.records,
      date: unit.date,
      directory,
      limit: 10_000
    })
    if (report.acquisitionComplete) break
    process.stdout.write(
      `${JSON.stringify({ date: unit.date, status: "retrying", attempt, failures: report.results.filter((item) => item.status === "failed").length })}\n`
    )
  }
  if (report?.acquisitionComplete !== true) {
    const failures = report?.results.filter((item) => item.status === "failed") ?? []
    const failedPath = join(
      reportsDirectory,
      `${unit.date}.failed-${new Date().toISOString().replaceAll(":", "-")}.json`
    )
    await writeFile(failedPath, `${JSON.stringify(report, null, 2)}\n`, { flag: "wx", flush: true })
    process.stdout.write(`${JSON.stringify({ date: unit.date, status: "failed", failures, report: failedPath })}\n`)
    throw new Error(
      `fr_pdf_backfill_date_incomplete:${unit.date}:${failures.map((item) => item.documentNumber).join(",")}`
    )
  }
  const complete = frPdfAcquisitionCheckpointSchema.parse(report)
  invariant(
    complete.expected === unit.expected && complete.results.length === unit.expected,
    "fr_pdf_backfill_count_mismatch"
  )
  const temporary = `${checkpointPath}.${process.pid}.tmp`
  try {
    await writeFile(temporary, `${JSON.stringify(complete, null, 2)}\n`, { flag: "wx", flush: true })
    await rename(temporary, checkpointPath)
  } finally {
    await rm(temporary, { force: true })
  }
  acquiredDates++
  acquiredPublications += complete.results.length
  process.stdout.write(
    `${JSON.stringify({ date: unit.date, status: "acquired", publications: complete.results.length, completed: checkpointedDates + acquiredDates, total: units.length })}\n`
  )
}

const summary = {
  contract: "fr-pdf-backfill-2026-09-18",
  observedAt: new Date().toISOString(),
  mode: values.apply ? "applied" : "checkpoint-audit",
  range: { start: units[0]?.date, end: units.at(-1)?.date },
  metadataManifests: manifests.length,
  publicationDates: units.length,
  checkpointedDates,
  acquiredDates,
  supportedPublications,
  acquiredPublications,
  acquisitionComplete: acquiredPublications === supportedPublications,
  structuralValidation: "pending",
  canonicalWrites: false,
  recurringIngestionEnabled: false
}
await writeFile(output, `${JSON.stringify(summary, null, 2)}\n`, { flag: "wx" })
process.stdout.write(`${JSON.stringify({ output, ...summary })}\n`)
