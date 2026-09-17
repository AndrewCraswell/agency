import { digest } from "@repo/legislation-core/legal-text/contracts"
import { federalRegisterAgencyEvidenceSchema } from "@repo/legislation-core/legal-text/federal-register-agencies"
import { z } from "zod"

export const frMetadataContract = "federal-register-metadata-2026-09-14"
export const frDocumentTypes = ["RULE", "PRORULE", "NOTICE", "PRESDOCU"] as const
export const frTypeNames = {
  RULE: "Rule",
  PRORULE: "Proposed Rule",
  NOTICE: "Notice",
  PRESDOCU: "Presidential Document"
} as const
export const frMetadataFields = [
  "document_number",
  "title",
  "type",
  "publication_date",
  "abstract",
  "action",
  "agencies",
  "cfr_references",
  "docket_ids",
  "regulation_id_numbers",
  "dates",
  "effective_on",
  "comments_close_on",
  "significant",
  "html_url",
  "pdf_url",
  "full_text_xml_url",
  "json_url",
  "citation",
  "start_page",
  "end_page",
  "volume",
  "correction_of",
  "corrections"
]

export function normalizeFrDocumentNumber(value: string) {
  const normalized = value.trim().toUpperCase()
  return z
    .string()
    .regex(/^[A-Z0-9]+(?:-[A-Z0-9]+)+$/)
    .max(128)
    .parse(normalized)
}

export const frMetadataScopeSchema = z
  .strictObject({ start: z.iso.date(), end: z.iso.date(), cutoff: z.iso.date() })
  .superRefine((scope, ctx) => {
    const days = (Date.parse(scope.end) - Date.parse(scope.start)) / 86_400_000
    if (scope.start < "2000-01-01" || days < 0 || days > 30 || scope.end > scope.cutoff) {
      ctx.addIssue({ code: "custom", message: "Select at most 31 frozen days in 2000+ with start <= end <= cutoff" })
    }
  })
export type FrMetadataScope = z.infer<typeof frMetadataScopeSchema>
export const frAgencyEvidenceSchema = federalRegisterAgencyEvidenceSchema
export const frMetadataRecordSchema = z
  .object({
    document_number: z.string().min(1).max(128),
    title: z.string().min(1),
    type: z.enum(["Rule", "Proposed Rule", "Notice", "Presidential Document"]),
    publication_date: z.iso.date(),
    abstract: z.string().nullable(),
    action: z.string().nullable(),
    agencies: z.array(frAgencyEvidenceSchema),
    cfr_references: z.array(
      z.object({
        title: z.int().positive(),
        part: z.union([z.string(), z.int()]).nullable(),
        chapter: z.union([z.string(), z.int()]).nullable().optional(),
        citation_url: z.url().nullable().optional()
      })
    ),
    docket_ids: z.array(z.string()),
    regulation_id_numbers: z.array(z.string()),
    dates: z.string().nullable(),
    effective_on: z.iso.date().nullable(),
    comments_close_on: z.iso.date().nullable(),
    significant: z.boolean().nullable(),
    html_url: z.url(),
    pdf_url: z.url().nullable(),
    full_text_xml_url: z.url().nullable(),
    json_url: z.url(),
    citation: z.string(),
    start_page: z.int().nonnegative(),
    end_page: z.int().nonnegative(),
    volume: z.int().positive(),
    correction_of: z.url().nullable(),
    corrections: z.array(z.url())
  })
  .superRefine((record, ctx) => {
    if (record.end_page < record.start_page) {
      ctx.addIssue({ code: "custom", message: "Invalid FR page range" })
    }
    try {
      normalizeFrDocumentNumber(record.document_number)
    } catch {
      ctx.addIssue({ code: "custom", message: "Invalid FR document number" })
    }
  })
export type FrMetadataRecord = z.infer<typeof frMetadataRecordSchema>
export const frMetadataPageSchema = z.object({
  count: z.int().nonnegative(),
  total_pages: z.int().nonnegative(),
  next_page_url: z.url().nullable().optional(),
  results: z.array(frMetadataRecordSchema).max(1000)
})
export const frPageEvidenceSchema = z.strictObject({
  url: z.url(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  bytes: z
    .int()
    .nonnegative()
    .max(8 * 1024 * 1024),
  body: z.string(),
  retrievedAt: z.iso.datetime(),
  contentType: z.string()
})
export type FrPageEvidence = z.infer<typeof frPageEvidenceSchema>

export function validateFrPageEvidence(value: unknown) {
  const evidence = frPageEvidenceSchema.parse(value)
  if (
    digest(evidence.body) !== evidence.sha256 ||
    Buffer.byteLength(evidence.body) !== evidence.bytes ||
    !evidence.contentType.toLowerCase().includes("json")
  ) {
    throw new Error("invalid_metadata_evidence")
  }
  return evidence
}

export const frPartitionSchema = z.strictObject({
  start: z.iso.date(),
  end: z.iso.date(),
  type: z.enum(frDocumentTypes).nullable(),
  state: z.enum(["complete", "split"]),
  reportedCount: z.int().nonnegative(),
  records: z.int().nonnegative(),
  pageHashes: z.array(z.string().regex(/^[a-f0-9]{64}$/)).min(1)
})
export const frMetadataManifestSchema = z.strictObject({
  contract: z.literal(frMetadataContract),
  id: z.string().regex(/^[a-f0-9]{64}$/),
  scope: frMetadataScopeSchema,
  pageSize: z.int().min(1).max(1000),
  saturationLimit: z.int().min(2).max(10000),
  pages: z.array(frPageEvidenceSchema).max(1000),
  partitions: z.array(frPartitionSchema).max(156),
  records: z.array(frMetadataRecordSchema).max(50000),
  status: z.literal("metadata_complete"),
  canonicalWrites: z.literal(false),
  recurringIngestionEnabled: z.literal(false)
})
export type FrMetadataManifest = z.infer<typeof frMetadataManifestSchema>
