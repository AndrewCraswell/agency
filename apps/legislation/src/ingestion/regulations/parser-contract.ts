import { z } from "zod"

export const regulatoryParserContract = "regulatory-xml-2026-09-14"
const hash = z.string().regex(/^[a-f0-9]{64}$/)
const date = z.iso.date().nullable()
export const parserLimits = {
  maximumInputBytes: 512 * 1024 * 1024,
  maximumOutputBytes: 2 * 1024 * 1024 * 1024,
  maximumNodeBytes: 32 * 1024 * 1024,
  maximumNodeElements: 250_000,
  maximumRecordBytes: 64 * 1024 * 1024,
  maximumRecords: 1_000_000,
  maximumDepth: 64
}

export const regulatoryRecordSchema = z.strictObject({
  contract: z.literal(regulatoryParserContract),
  recordType: z.enum(["provision", "publication"]),
  recordKey: hash,
  parentKey: hash.nullable(),
  ordinal: z.int().nonnegative(),
  nativeId: z.string().min(1).max(4096),
  identityBasis: z.enum(["source_locator", "publisher_hierarchy", "citation", "document_number"]),
  nodeKind: z.string().min(1),
  heading: z.string(),
  text: z.string(),
  textHash: hash,
  blocks: z.array(
    z.strictObject({
      ordinal: z.int().nonnegative(),
      tag: z.string().min(1),
      kind: z.enum(["text", "table", "authority", "heading", "footnote"]),
      text: z.string(),
      xml: z.string()
    })
  ),
  publicationKind: z.enum(["final_rule", "proposed_rule", "notice"]).nullable(),
  legalStatus: z.literal("unknown"),
  sourceLocator: z.string().startsWith("/"),
  sourceAttributes: z.record(z.string(), z.string()),
  provenance: z.strictObject({
    sourceId: z.string().min(1),
    jurisdictionKey: z.string().min(1),
    acquisitionUnitId: hash,
    artifactHash: hash,
    sourceUrl: z.url(),
    publisherIssueDate: date,
    currencyDate: date,
    edition: z.string().min(1),
    rightsProfileId: z.string().min(1)
  })
})

export const regulatoryParseSummarySchema = z.strictObject({
  contract: z.literal(regulatoryParserContract),
  parserCodeHash: hash,
  inputHash: hash,
  inputBytes: z.int().positive(),
  records: z.int().positive(),
  sourceRecords: z.int().positive(),
  sourceElements: z.int().positive(),
  sourceTagCounts: z.record(z.string(), z.int().positive()),
  countsByKind: z.record(z.string(), z.int().positive()),
  maximumDepth: z.int().positive().max(parserLimits.maximumDepth),
  shards: z
    .array(
      z.strictObject({
        file: z.string().regex(/^records-\d{5}\.ndjson$/),
        bytes: z.int().positive(),
        records: z.int().positive(),
        sha256: hash
      })
    )
    .min(1),
  warnings: z.array(
    z.strictObject({
      code: z.enum(["unparsed_source_date", "source_date_mismatch", "quoted_revision_scope_review"]),
      sourceLocator: z.string(),
      detail: z.string()
    })
  ),
  sourceDates: z.array(
    z.strictObject({
      kind: z.enum(["printed_revision", "publication"]),
      value: date,
      rawText: z.string(),
      sourceLocator: z.string()
    })
  ),
  elapsedSeconds: z.number().nonnegative(),
  expatVersion: z.string().min(1),
  canonicalWrites: z.literal(false),
  status: z.literal("parsed"),
  publicationReady: z.literal(false)
})
