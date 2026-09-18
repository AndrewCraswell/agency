import { createHash, randomUUID } from "node:crypto"
import { createReadStream } from "node:fs"
import { link, mkdir, open, readFile, rm, stat, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { digest } from "@repo/legislation-core/legal-text/contracts"
import invariant from "tiny-invariant"
import { z } from "zod"
import { frMetadataRecordSchema, isSupportedFrMetadataType, normalizeFrDocumentNumber } from "./fr-metadata-contract.js"
import { frPdfLocation } from "./fr-reconciliation.js"
import { RegulatorySourceClient } from "./source-client.js"

const hash = z.string().regex(/^[a-f0-9]{64}$/)
export const pdfUnitSchema = z.strictObject({
  metadataManifestId: hash,
  documentNumber: z.string().min(1),
  publicationDate: z.iso.date(),
  sourceUrl: z.url()
})
export const pdfReceiptSchema = z.strictObject({
  unit: pdfUnitSchema,
  sha256: hash,
  bytes: z.int().positive(),
  acquiredAt: z.iso.datetime(),
  contentType: z.string(),
  etag: z.string().nullable(),
  lastModified: z.string().nullable(),
  status: z.literal("acquired"),
  structuralValidation: z.literal("pending")
})
export const frPdfAcquiredResultSchema = z.strictObject({
  documentNumber: z.string().min(1),
  status: z.literal("acquired"),
  receipt: pdfReceiptSchema.extend({ reused: z.boolean() })
})
export const frPdfAcquisitionCheckpointSchema = z.strictObject({
  metadataManifestId: hash,
  date: z.iso.date(),
  expected: z.int().positive(),
  results: z.array(frPdfAcquiredResultSchema).min(1),
  acquisitionComplete: z.literal(true),
  structuralValidation: z.literal("pending"),
  publicationReady: z.literal(false),
  canonicalWrites: z.literal(false)
})
function hasCode(error: unknown, code: string) {
  return error instanceof Error && "code" in error && error.code === code
}
function validatePdfFraming(prefix: Uint8Array, suffix: Uint8Array) {
  invariant(/^%PDF-\d\.\d/.test(Buffer.from(prefix).subarray(0, 8).toString("ascii")), "fr_pdf_signature_missing")
  invariant(/%%EOF\s*$/.test(Buffer.from(suffix).subarray(-1024).toString("ascii")), "fr_pdf_end_marker_missing")
}
function appendSuffix(current: Buffer, chunk: Uint8Array) {
  const combined = Buffer.concat([current, Buffer.from(chunk)])
  return combined.subarray(Math.max(0, combined.length - 1024))
}
async function inspectPdfFile(path: string, maximumBytes: number) {
  const metadata = await stat(path)
  invariant(metadata.size > 0 && metadata.size <= maximumBytes, "fr_pdf_byte_limit")
  const hash = createHash("sha256")
  let prefix = Buffer.alloc(0)
  let suffix = Buffer.alloc(0)
  let bytes = 0
  for await (const chunk of createReadStream(path)) {
    const data = Buffer.from(chunk)
    bytes += data.length
    invariant(bytes <= maximumBytes, "fr_pdf_byte_limit")
    hash.update(data)
    if (prefix.length < 8) prefix = Buffer.concat([prefix, data]).subarray(0, 8)
    suffix = appendSuffix(suffix, data)
  }
  invariant(bytes === metadata.size, "fr_pdf_length_mismatch")
  return { bytes, sha256: hash.digest("hex"), prefix, suffix }
}
async function retainBytes(directory: string, target: string, bytes: Uint8Array) {
  const temporary = join(directory, "temporary", randomUUID())
  try {
    await writeFile(temporary, bytes, { flag: "wx", flush: true })
    try {
      await link(temporary, target)
    } catch (error) {
      if (!hasCode(error, "EEXIST")) {
        throw error
      }
      invariant(digest(await readFile(target)) === digest(bytes), "fr_pdf_immutable_conflict")
    }
  } finally {
    await rm(temporary, { force: true })
  }
}
async function retainFile(temporary: string, target: string, expectedHash: string, maximumBytes: number) {
  try {
    await link(temporary, target)
  } catch (error) {
    if (!hasCode(error, "EEXIST")) throw error
    const inspected = await inspectPdfFile(target, maximumBytes)
    invariant(inspected.sha256 === expectedHash, "fr_pdf_immutable_conflict")
    validatePdfFraming(inspected.prefix, inspected.suffix)
  }
}
async function acquirePdf(
  directory: string,
  unit: z.infer<typeof pdfUnitSchema>,
  client: RegulatorySourceClient,
  maximumBytes: number
) {
  const receiptPath = join(directory, "receipts", `${digest(JSON.stringify(unit))}.json`)
  let cached: string | null = null
  try {
    cached = await readFile(receiptPath, "utf8")
  } catch (error) {
    if (!hasCode(error, "ENOENT")) {
      throw error
    }
  }
  if (cached !== null) {
    const receipt = pdfReceiptSchema.parse(JSON.parse(cached))
    invariant(JSON.stringify(receipt.unit) === JSON.stringify(unit), "fr_pdf_receipt_scope_mismatch")
    const inspected = await inspectPdfFile(join(directory, "blobs", `${receipt.sha256}.pdf`), maximumBytes)
    invariant(inspected.bytes === receipt.bytes && inspected.sha256 === receipt.sha256, "fr_pdf_cache_corrupt")
    validatePdfFraming(inspected.prefix, inspected.suffix)
    return { ...receipt, reused: true }
  }
  const response = await client.response("govinfo-fr", unit.sourceUrl, "application/pdf")
  const reader = response.body?.getReader()
  invariant(reader, "fr_pdf_body_missing")
  const temporary = join(directory, "temporary", randomUUID())
  let count = 0
  let sha256 = ""
  const contentType = response.headers.get("content-type") ?? ""
  try {
    try {
      invariant(/^application\/pdf(?:;|$)/i.test(contentType), "fr_pdf_content_type")
      const length = response.headers.get("content-length")
      invariant(length === null || Number(length) <= maximumBytes, "fr_pdf_byte_limit")
      const file = await open(temporary, "wx")
      const hash = createHash("sha256")
      let prefix = Buffer.alloc(0)
      let suffix = Buffer.alloc(0)
      try {
        while (true) {
          const chunk = await reader.read()
          if (chunk.done) break
          count += chunk.value.byteLength
          invariant(count <= maximumBytes, "fr_pdf_byte_limit")
          hash.update(chunk.value)
          if (prefix.length < 8) prefix = Buffer.concat([prefix, Buffer.from(chunk.value)]).subarray(0, 8)
          suffix = appendSuffix(suffix, chunk.value)
          await file.write(chunk.value)
        }
        invariant(length === null || Number(length) === count, "fr_pdf_length_mismatch")
        validatePdfFraming(prefix, suffix)
        sha256 = hash.digest("hex")
        await file.sync()
      } finally {
        await file.close()
      }
    } finally {
      await reader.cancel().catch(() => undefined)
    }
    const receipt = pdfReceiptSchema.parse({
      unit,
      sha256,
      bytes: count,
      acquiredAt: new Date().toISOString(),
      contentType,
      etag: response.headers.get("etag"),
      lastModified: response.headers.get("last-modified"),
      status: "acquired",
      structuralValidation: "pending"
    })
    await retainFile(temporary, join(directory, "blobs", `${receipt.sha256}.pdf`), receipt.sha256, maximumBytes)
    await retainBytes(directory, receiptPath, Buffer.from(JSON.stringify(receipt, null, 2)))
    return { ...receipt, reused: false }
  } finally {
    await rm(temporary, { force: true })
  }
}

/** Bounded local acquisition from a replay-validated metadata manifest. No PDF rendering or text substitution. */
export async function acquireFrPdfs(input: {
  metadataManifestId: string
  records: unknown[]
  date: string
  directory: string
  limit: number
  maximumBytes?: number
  client?: RegulatorySourceClient
  onProgress?: (documentNumber: string, status: string) => void
}) {
  const date = z.iso.date().parse(input.date)
  const metadataManifestId = hash.parse(input.metadataManifestId)
  const records = input.records
    .map((record) => frMetadataRecordSchema.parse(record))
    .filter((record) => record.publication_date === date && isSupportedFrMetadataType(record.type))
    .sort((a, b) => a.document_number.localeCompare(b.document_number))
  const limit = z.int().min(1).max(10000).parse(input.limit)
  const maximumBytes = z
    .int()
    .min(1)
    .max(256 * 1024 * 1024)
    .parse(input.maximumBytes ?? 256 * 1024 * 1024)
  const numbers = records.map((record) => normalizeFrDocumentNumber(record.document_number))
  invariant(new Set(numbers).size === records.length, "fr_pdf_duplicate_identity")
  for (const child of ["receipts", "blobs", "temporary"]) {
    await mkdir(join(input.directory, child), { recursive: true })
  }
  const lockPath = join(input.directory, "writer.lock")
  const lock = await open(lockPath, "wx")
  const results = []
  const client = input.client ?? new RegulatorySourceClient()
  try {
    for (const record of records.slice(0, limit)) {
      const documentNumber = normalizeFrDocumentNumber(record.document_number)
      try {
        invariant(record.pdf_url !== null, "fr_pdf_not_listed")
        const unit = pdfUnitSchema.parse({
          metadataManifestId,
          documentNumber,
          publicationDate: date,
          sourceUrl: frPdfLocation(record.pdf_url, documentNumber, date)
        })
        const receipt = await acquirePdf(input.directory, unit, client, maximumBytes)
        results.push({ documentNumber, status: "acquired" as const, receipt })
        input.onProgress?.(documentNumber, "acquired")
      } catch (error) {
        results.push({
          documentNumber,
          status: "failed" as const,
          reason: error instanceof Error ? error.message : "PDF acquisition failed"
        })
        input.onProgress?.(documentNumber, "failed")
      }
    }
    return {
      metadataManifestId,
      date,
      expected: records.length,
      results,
      acquisitionComplete:
        records.length > 0 && results.length === records.length && results.every((r) => r.status === "acquired"),
      structuralValidation: "pending",
      publicationReady: false,
      canonicalWrites: false
    }
  } finally {
    await lock.close()
    await rm(lockPath, { force: true })
  }
}
