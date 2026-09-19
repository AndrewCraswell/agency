import { digest } from "@repo/legislation-core/legal-text/contracts"
import { regulatoryParserContract } from "@repo/legislation-core/legal-text/parser-contract"
import { storedLegalSourceBlocks } from "@repo/legislation-core/legal-text/reader-text"
import { provisionContent, regulatoryStorageContract } from "@repo/legislation-core/legal-text/storage-contract"
import { load } from "cheerio/slim"
import invariant from "tiny-invariant"
import { z } from "zod"

export const tableSourceReviewContract = "regulatory-table-source-review-2026-09-17"

export const tableDiagnosticSchema = z.strictObject({
  editionId: z.uuid(),
  nativeKey: z.string().min(1),
  versionId: z.uuid(),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  nativeId: z.string().min(1),
  sourceLocator: z.string().min(1),
  ordinal: z.int().nonnegative(),
  lineNumber: z.int().positive(),
  tableIndex: z.int().nonnegative(),
  status: z.literal("classified"),
  reason: z.enum(["passage_table_data_rows_required", "passage_table_unresolved_ditto"])
})

export const tableReviewCanonicalSchema = z.strictObject({
  editionId: z.uuid(),
  versionId: z.uuid(),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  inputContract: z.literal(regulatoryStorageContract),
  heading: z.string(),
  body: z.string(),
  nodeKind: z.string(),
  blocks: z.unknown(),
  language: z.literal("en"),
  nativeKey: z.string().min(1),
  nativeId: z.string().min(1),
  sourceLocator: z.string().min(1),
  ordinal: z.int().nonnegative(),
  sourceId: z.literal("ecfr"),
  generationId: z.string().regex(/^[a-f0-9]{64}$/),
  artifactHash: z.string().regex(/^[a-f0-9]{64}$/),
  sourceUrl: z.url(),
  rightsProfileId: z.string().min(1),
  rightsHash: z.string().regex(/^[a-f0-9]{64}$/)
})

function attributes(value: Record<string, string> | undefined) {
  return Object.fromEntries(Object.entries(value ?? {}).sort(([left], [right]) => left.localeCompare(right)))
}

export function buildTableSourceReview(diagnosticInput: unknown, canonicalInput: unknown) {
  const diagnostic = tableDiagnosticSchema.parse(diagnosticInput)
  const canonical = tableReviewCanonicalSchema.parse(canonicalInput)
  invariant(canonical.editionId === diagnostic.editionId, "table_review_edition_mismatch")
  invariant(canonical.versionId === diagnostic.versionId, "table_review_version_mismatch")
  invariant(canonical.contentHash === diagnostic.contentHash, "table_review_content_hash_mismatch")
  invariant(canonical.nativeKey === diagnostic.nativeKey, "table_review_native_key_mismatch")
  invariant(canonical.nativeId === diagnostic.nativeId, "table_review_native_id_mismatch")
  invariant(canonical.sourceLocator === diagnostic.sourceLocator, "table_review_source_locator_mismatch")
  invariant(canonical.ordinal === diagnostic.ordinal, "table_review_ordinal_mismatch")

  const blocks = storedLegalSourceBlocks({
    body: canonical.body,
    blocks: canonical.blocks,
    inputContract: canonical.inputContract
  })
  invariant(
    provisionContent({
      contract: regulatoryParserContract,
      nodeKind: canonical.nodeKind,
      heading: canonical.heading,
      text: canonical.body,
      blocks
    }) === canonical.contentHash,
    "table_review_canonical_content_mismatch"
  )
  const table = blocks.filter((block) => block.kind === "table")[diagnostic.tableIndex]
  invariant(table, "table_review_table_index_missing")
  const $ = load(table.xml, { xml: true })
  const tableRoots = $("GPOTABLE,TABLE")
  invariant(tableRoots.length > 0, "table_review_table_root_missing")
  const rows = tableRoots
    .find("ROW,TR")
    .toArray()
    .map((row, rowIndex) => ({
      rowIndex,
      tag: row.tagName,
      attributes: attributes(row.attribs),
      cells: $(row)
        .children("ENT,TD,TH")
        .toArray()
        .map((cell, columnIndex) => ({
          columnIndex,
          tag: cell.tagName,
          attributes: attributes(cell.attribs),
          text: $(cell).text()
        }))
    }))
  const identity = {
    contract: tableSourceReviewContract,
    diagnostic,
    canonical: {
      editionId: canonical.editionId,
      versionId: canonical.versionId,
      contentHash: canonical.contentHash,
      inputContract: canonical.inputContract,
      heading: canonical.heading,
      nodeKind: canonical.nodeKind,
      nativeKey: canonical.nativeKey,
      nativeId: canonical.nativeId,
      sourceLocator: canonical.sourceLocator,
      ordinal: canonical.ordinal,
      sourceId: canonical.sourceId,
      generationId: canonical.generationId,
      artifactHash: canonical.artifactHash,
      sourceUrl: canonical.sourceUrl,
      rightsProfileId: canonical.rightsProfileId,
      rightsHash: canonical.rightsHash
    },
    table: {
      blockOrdinal: table.ordinal,
      blockTag: table.tag,
      blockHash: digest(table.xml),
      textHash: digest(table.text),
      text: table.text,
      xml: table.xml,
      nestedTables: tableRoots.filter((_index, element) => $(element).parents("GPOTABLE,TABLE").length > 0).length,
      rows
    }
  }
  return { ...identity, reviewHash: digest(JSON.stringify(identity)) }
}
