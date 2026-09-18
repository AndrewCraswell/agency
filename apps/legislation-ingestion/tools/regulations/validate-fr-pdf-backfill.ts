import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { parseArgs } from "node:util"
import { digest } from "@repo/legislation-core/legal-text/contracts"
import invariant from "tiny-invariant"
import { z } from "zod"
import { isSupportedFrMetadataType } from "../../src/ingestion/regulations/fr-metadata-contract.js"
import { replayFrMetadata } from "../../src/ingestion/regulations/fr-metadata.js"
import {
  frPdfDateValidationReportSchema,
  validateFrPdfDate
} from "../../src/ingestion/regulations/fr-pdf-backfill-validation.js"
import { frPdfAcquisitionCheckpointSchema } from "../../src/ingestion/regulations/fr-pdf.js"

const { values } = parseArgs({
  options: {
    metadataRoot: { type: "string" },
    directory: { type: "string" },
    acquisitions: { type: "string" },
    validations: { type: "string" },
    reports: { type: "string" },
    output: { type: "string" },
    start: { type: "string" },
    end: { type: "string" },
    concurrency: { type: "string", default: "2" },
    apply: { type: "boolean", default: false }
  }
})
const path = (value: unknown) => resolve(z.string().min(1).parse(value))
const metadataRoot = path(values.metadataRoot)
const pdfDirectory = path(values.directory)
const acquisitionsDirectory = path(values.acquisitions)
const validationDirectory = path(values.validations)
const reportsDirectory = path(values.reports)
const output = path(values.output)
const start = z.iso.date().optional().parse(values.start)
const end = z.iso.date().optional().parse(values.end)
invariant(start === undefined || end === undefined || start <= end, "fr_pdf_validation_invalid_range")
const concurrency = z.coerce.number().int().min(1).max(4).parse(values.concurrency)
const startMonth = start?.slice(0, 7)
const endMonth = end?.slice(0, 7)

const manifestInventory: Array<{
  path: string
  id: string
  units: Array<{ date: string; expected: number }>
}> = []
const plannedDates: string[] = []
for (const item of (await readdir(metadataRoot, { withFileTypes: true })).sort((a, b) =>
  a.name.localeCompare(b.name)
)) {
  if (!item.isDirectory() || !/^fr-metadata-\d{4}-\d{2}$/.test(item.name)) continue
  const month = item.name.slice("fr-metadata-".length)
  if ((startMonth !== undefined && month < startMonth) || (endMonth !== undefined && month > endMonth)) continue
  const manifestPath = join(metadataRoot, item.name, "manifest.json")
  const manifest = await replayFrMetadata(JSON.parse(await readFile(manifestPath, "utf8")))
  const units = [
    ...new Set(
      manifest.records
        .filter((record) => isSupportedFrMetadataType(record.type))
        .map((record) => record.publication_date)
    )
  ]
    .sort()
    .filter((date) => (start === undefined || date >= start) && (end === undefined || date <= end))
    .map((date) => ({
      date,
      expected: manifest.records.filter(
        (record) => record.publication_date === date && isSupportedFrMetadataType(record.type)
      ).length
    }))
  plannedDates.push(...units.map(({ date }) => date))
  manifestInventory.push({ path: manifestPath, id: manifest.id, units })
}
invariant(manifestInventory.length > 0, "fr_pdf_validation_metadata_missing")
invariant(plannedDates.length > 0, "fr_pdf_validation_range_empty")
invariant(new Set(plannedDates).size === plannedDates.length, "fr_pdf_validation_duplicate_date")
invariant(
  plannedDates.every((date, index) => index === 0 || plannedDates[index - 1]! < date),
  "fr_pdf_validation_date_order_invalid"
)

const validatorCodeHash = digest(
  Buffer.concat([
    await readFile(new URL("../../src/ingestion/regulations/fr-pdf-validation.ts", import.meta.url)),
    await readFile(new URL("../../src/ingestion/regulations/fr-pdf-backfill-validation.ts", import.meta.url))
  ])
)
await mkdir(reportsDirectory, { recursive: true })
let checkpointedDates = 0
let validatedDates = 0
let supportedPublications = 0
let validatedPublications = 0
let reusedPublicationReceipts = 0
for (const inventory of manifestInventory) {
  const manifest = await replayFrMetadata(JSON.parse(await readFile(inventory.path, "utf8")))
  invariant(manifest.id === inventory.id, "fr_pdf_validation_manifest_changed_after_preflight")
  for (const unit of inventory.units) {
    supportedPublications += unit.expected
    const acquisitionPath = join(acquisitionsDirectory, `${unit.date}.json`)
    const acquisitionBytes = await readFile(acquisitionPath)
    const acquisitionReportHash = digest(acquisitionBytes)
    const acquisitionCheckpoint = frPdfAcquisitionCheckpointSchema.parse(JSON.parse(acquisitionBytes.toString("utf8")))
    invariant(
      acquisitionCheckpoint.metadataManifestId === manifest.id &&
        acquisitionCheckpoint.date === unit.date &&
        acquisitionCheckpoint.expected === unit.expected &&
        acquisitionCheckpoint.results.length === unit.expected,
      "fr_pdf_validation_acquisition_checkpoint_mismatch"
    )
    const checkpointPath = join(reportsDirectory, `${unit.date}.json`)
    let checkpoint: z.infer<typeof frPdfDateValidationReportSchema> | undefined
    try {
      const retained = frPdfDateValidationReportSchema.parse(JSON.parse(await readFile(checkpointPath, "utf8")))
      const reusable =
        retained.metadataManifestId === manifest.id &&
        retained.acquisitionReportHash === acquisitionReportHash &&
        retained.validatorCodeHash === validatorCodeHash &&
        retained.date === unit.date &&
        retained.expected === unit.expected &&
        retained.results.length === unit.expected &&
        retained.validationComplete &&
        retained.results.every((result) => result.status === "validated")
      if (reusable) {
        checkpoint = retained
      } else {
        const supersededPath = `${checkpointPath}.superseded-${retained.validatorCodeHash}-${retained.acquisitionReportHash}`
        await rename(checkpointPath, supersededPath)
        process.stdout.write(
          `${JSON.stringify({ date: unit.date, status: "checkpoint_superseded", report: supersededPath })}\n`
        )
      }
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error
    }
    if (checkpoint !== undefined) {
      checkpointedDates++
      validatedPublications += checkpoint.results.length
      reusedPublicationReceipts += checkpoint.results.length
      process.stdout.write(
        `${JSON.stringify({ date: unit.date, status: "checkpointed", completed: checkpointedDates + validatedDates, total: plannedDates.length })}\n`
      )
      continue
    }
    invariant(values.apply, `fr_pdf_validation_checkpoint_missing:${unit.date}`)
    const report = await validateFrPdfDate({
      records: manifest.records,
      acquisitionCheckpoint,
      acquisitionReportHash,
      validatorCodeHash,
      pdfDirectory,
      validationDirectory,
      concurrency
    })
    if (!report.validationComplete) {
      const failedPath = join(
        reportsDirectory,
        `${unit.date}.failed-${new Date().toISOString().replaceAll(":", "-")}.json`
      )
      await writeFile(failedPath, `${JSON.stringify(report, null, 2)}\n`, { flag: "wx", flush: true })
      const failures = report.results.filter((result) => result.status === "failed")
      process.stdout.write(`${JSON.stringify({ date: unit.date, status: "failed", failures, report: failedPath })}\n`)
      throw new Error(
        `fr_pdf_validation_date_incomplete:${unit.date}:${failures.map((result) => result.documentNumber).join(",")}`
      )
    }
    const temporary = `${checkpointPath}.${process.pid}.tmp`
    try {
      await writeFile(temporary, `${JSON.stringify(report, null, 2)}\n`, { flag: "wx", flush: true })
      await rename(temporary, checkpointPath)
    } finally {
      await rm(temporary, { force: true })
    }
    validatedDates++
    validatedPublications += report.results.length
    reusedPublicationReceipts += report.results.filter(
      (result) => result.status === "validated" && result.receipt.reused
    ).length
    process.stdout.write(
      `${JSON.stringify({ date: unit.date, status: "validated", publications: report.results.length, completed: checkpointedDates + validatedDates, total: plannedDates.length })}\n`
    )
  }
}

const summary = {
  contract: "fr-pdf-structural-backfill-2026-09-18",
  observedAt: new Date().toISOString(),
  mode: values.apply ? "applied" : "checkpoint-audit",
  range: { start: plannedDates[0], end: plannedDates.at(-1) },
  metadataManifests: manifestInventory.length,
  publicationDates: plannedDates.length,
  checkpointedDates,
  validatedDates,
  supportedPublications,
  validatedPublications,
  reusedPublicationReceipts,
  validationComplete: validatedPublications === supportedPublications,
  publicationReady: false,
  canonicalWrites: false,
  recurringIngestionEnabled: false
}
await writeFile(output, `${JSON.stringify(summary, null, 2)}\n`, { flag: "wx" })
process.stdout.write(`${JSON.stringify({ output, ...summary })}\n`)
