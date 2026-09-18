import { open, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { mapConcurrent } from "@repo/legislation-core/concurrency/map-concurrent"
import { digest } from "@repo/legislation-core/legal-text/contracts"
import invariant from "tiny-invariant"
import { z } from "zod"
import { frMetadataRecordSchema, isSupportedFrMetadataType, normalizeFrDocumentNumber } from "./fr-metadata-contract.js"
import { frPdfInspectionSchema, validateFrPdfEvidence, validateFrPdfInWorker } from "./fr-pdf-validation.js"
import { frPdfAcquisitionCheckpointSchema, pdfReceiptSchema } from "./fr-pdf.js"

const hash = z.string().regex(/^[a-f0-9]{64}$/)
export const frPdfValidationContract = "fr-pdf-backfill-validation-2026-09-18"
export const frPdfValidationUnitSchema = z.strictObject({
  metadataManifestId: hash,
  acquisitionReportHash: hash,
  validatorCodeHash: hash,
  documentNumber: z.string().min(1),
  publicationDate: z.iso.date(),
  pdfSha256: hash,
  pdfBytes: z.int().positive(),
  expectedPages: z.int().positive()
})
export const frPdfValidationReceiptSchema = z.strictObject({
  contract: z.literal(frPdfValidationContract),
  unit: frPdfValidationUnitSchema,
  inspectedAt: z.iso.datetime(),
  inspection: frPdfInspectionSchema
})
const validatedResultSchema = z.strictObject({
  documentNumber: z.string().min(1),
  status: z.literal("validated"),
  receipt: frPdfValidationReceiptSchema.extend({ reused: z.boolean() })
})
const failedResultSchema = z.strictObject({
  documentNumber: z.string().min(1),
  status: z.literal("failed"),
  reason: z.string().min(1)
})
export const frPdfDateValidationReportSchema = z.strictObject({
  contract: z.literal(frPdfValidationContract),
  metadataManifestId: hash,
  acquisitionReportHash: hash,
  validatorCodeHash: hash,
  date: z.iso.date(),
  expected: z.int().positive(),
  results: z.array(z.discriminatedUnion("status", [validatedResultSchema, failedResultSchema])).min(1),
  validationComplete: z.boolean(),
  publicationReady: z.literal(false),
  canonicalWrites: z.literal(false)
})

function hasCode(error: unknown, code: string) {
  return error instanceof Error && "code" in error && error.code === code
}

export async function validateFrPdfDate(input: {
  records: unknown[]
  acquisitionCheckpoint: unknown
  acquisitionReportHash: string
  validatorCodeHash: string
  pdfDirectory: string
  validationDirectory: string
  concurrency: number
  inspect?: typeof validateFrPdfInWorker
}) {
  const acquisition = frPdfAcquisitionCheckpointSchema.parse(input.acquisitionCheckpoint)
  const acquisitionReportHash = hash.parse(input.acquisitionReportHash)
  const validatorCodeHash = hash.parse(input.validatorCodeHash)
  const concurrency = z.int().min(1).max(4).parse(input.concurrency)
  const records = input.records
    .map((record) => frMetadataRecordSchema.parse(record))
    .filter((record) => record.publication_date === acquisition.date && isSupportedFrMetadataType(record.type))
    .sort((a, b) => a.document_number.localeCompare(b.document_number))
  invariant(records.length === acquisition.expected, "fr_pdf_validation_expected_count_mismatch")
  const acquiredByNumber = new Map(
    acquisition.results.map((result) => [normalizeFrDocumentNumber(result.documentNumber), result] as const)
  )
  invariant(acquiredByNumber.size === records.length, "fr_pdf_validation_acquisition_identity_mismatch")
  for (const directory of [
    input.validationDirectory,
    join(input.validationDirectory, "receipts"),
    join(input.validationDirectory, "temporary")
  ]) {
    await mkdir(directory, { recursive: true })
  }
  const lockPath = join(input.validationDirectory, "writer.lock")
  const lock = await open(lockPath, "wx")
  const inspect = input.inspect ?? validateFrPdfInWorker
  try {
    const results = await mapConcurrent(records, concurrency, async (record) => {
      const documentNumber = normalizeFrDocumentNumber(record.document_number)
      try {
        const acquired = acquiredByNumber.get(documentNumber)
        invariant(acquired, "fr_pdf_validation_acquisition_missing")
        const sourceReceipt = pdfReceiptSchema.strip().parse(acquired.receipt)
        invariant(
          sourceReceipt.unit.metadataManifestId === acquisition.metadataManifestId &&
            sourceReceipt.unit.documentNumber === documentNumber &&
            sourceReceipt.unit.publicationDate === acquisition.date,
          "fr_pdf_validation_acquisition_scope_mismatch"
        )
        const unit = frPdfValidationUnitSchema.parse({
          metadataManifestId: acquisition.metadataManifestId,
          acquisitionReportHash,
          validatorCodeHash,
          documentNumber,
          publicationDate: acquisition.date,
          pdfSha256: sourceReceipt.sha256,
          pdfBytes: sourceReceipt.bytes,
          expectedPages: record.end_page - record.start_page + 1
        })
        const receiptPath = join(input.validationDirectory, "receipts", `${digest(JSON.stringify(unit))}.json`)
        let retained: z.infer<typeof frPdfValidationReceiptSchema> | undefined
        try {
          retained = frPdfValidationReceiptSchema.parse(JSON.parse(await readFile(receiptPath, "utf8")))
          invariant(JSON.stringify(retained.unit) === JSON.stringify(unit), "fr_pdf_validation_receipt_scope_mismatch")
          validateFrPdfEvidence({
            inspection: retained.inspection,
            expectedHash: unit.pdfSha256,
            expectedBytes: unit.pdfBytes,
            expectedPages: unit.expectedPages
          })
        } catch (error) {
          if (!hasCode(error, "ENOENT")) throw error
        }
        if (retained !== undefined) {
          return { documentNumber, status: "validated" as const, receipt: { ...retained, reused: true } }
        }
        const inspection = validateFrPdfEvidence({
          inspection: await inspect(join(input.pdfDirectory, "blobs", `${unit.pdfSha256}.pdf`), documentNumber),
          expectedHash: unit.pdfSha256,
          expectedBytes: unit.pdfBytes,
          expectedPages: unit.expectedPages
        })
        const receipt = frPdfValidationReceiptSchema.parse({
          contract: frPdfValidationContract,
          unit,
          inspectedAt: new Date().toISOString(),
          inspection
        })
        const temporary = join(
          input.validationDirectory,
          "temporary",
          `${digest(JSON.stringify(unit))}.${process.pid}.tmp`
        )
        try {
          await writeFile(temporary, `${JSON.stringify(receipt, null, 2)}\n`, { flag: "wx", flush: true })
          await rename(temporary, receiptPath)
        } finally {
          await rm(temporary, { force: true })
        }
        return { documentNumber, status: "validated" as const, receipt: { ...receipt, reused: false } }
      } catch (error) {
        return {
          documentNumber,
          status: "failed" as const,
          reason: error instanceof Error ? error.message : "PDF validation failed"
        }
      }
    })
    return frPdfDateValidationReportSchema.parse({
      contract: frPdfValidationContract,
      metadataManifestId: acquisition.metadataManifestId,
      acquisitionReportHash,
      validatorCodeHash,
      date: acquisition.date,
      expected: acquisition.expected,
      results,
      validationComplete:
        results.length === acquisition.expected && results.every((result) => result.status === "validated"),
      publicationReady: false,
      canonicalWrites: false
    })
  } finally {
    await lock.close()
    await rm(lockPath, { force: true })
  }
}
