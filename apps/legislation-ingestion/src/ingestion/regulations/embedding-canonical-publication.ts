import { digest } from "@repo/legislation-core/legal-text/contracts"
import { regulatoryParserContract } from "@repo/legislation-core/legal-text/parser-contract"
import { storedLegalSourceBlocks } from "@repo/legislation-core/legal-text/reader-text"
import { assertRights } from "@repo/legislation-core/legal-text/storage-contract"
import invariant from "tiny-invariant"
import { z } from "zod"

const hash = z.string().regex(/^[a-f0-9]{64}$/)
export const evaluationPublicationSelectionSchema = z.strictObject({
  observationId: z.uuid(),
  versionId: z.uuid(),
  contentHash: hash
})

/** Canonical observation verification preserves source-reviewed metadata without upgrading its authority. */
export function verifyEvaluationPublicationSnapshot(value: unknown, selectionValue: unknown) {
  const selection = evaluationPublicationSelectionSchema.parse(selectionValue)
  const row = z
    .object({
      observation_id: z.uuid(),
      document_id: z.uuid(),
      version_id: z.uuid(),
      content_hash: hash,
      pdf_hash: hash,
      source_id: z.literal("govinfo-fr"),
      jurisdiction_id: z.literal("jurisdiction:us"),
      generation_id: hash,
      publication_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      source_locator: z.string().min(1),
      metadata: z.unknown(),
      rights_profile_id: z.string().min(1),
      policy_hash: hash,
      policy: z.unknown(),
      body: z.string(),
      blocks: z.unknown(),
      heading: z.string(),
      publication_kind: z.enum(["final_rule", "proposed_rule", "notice", "other"]),
      input_contract: z.enum(["fr-source-publication-2026-09-15", "fr-html-publication-2026-09-14"]),
      context: z.string().max(16000)
    })
    .parse(value)
  invariant(
    row.observation_id === selection.observationId &&
      row.version_id === selection.versionId &&
      row.content_hash === selection.contentHash,
    "evaluation_publication_selection_mismatch"
  )
  const policy = assertRights(row.policy, "displayText")
  assertRights(policy, "localSearch")
  invariant(policy.embeddings && policy.exports, "evaluation_publication_rights_denied")
  invariant(digest(JSON.stringify(policy)) === row.policy_hash, "evaluation_publication_rights_hash_mismatch")
  invariant(
    Buffer.byteLength(row.body) + Buffer.byteLength(JSON.stringify(row.blocks)) <= 16 * 1024 * 1024,
    "evaluation_publication_source_byte_limit"
  )
  const blocks = storedLegalSourceBlocks({ body: row.body, blocks: row.blocks, inputContract: row.input_contract })
  const contentHash =
    row.input_contract === "fr-source-publication-2026-09-15"
      ? digest(JSON.stringify([regulatoryParserContract, row.heading, row.body, blocks, row.publication_kind]))
      : digest(JSON.stringify(["fr-publication-input-2026-09-14", "html_preformatted", digest(row.body)]))
  invariant(contentHash === row.content_hash, "evaluation_publication_content_mismatch")
  return {
    input: {
      versionId: row.version_id,
      body: row.body,
      blocks: row.blocks,
      inputContract: row.input_contract,
      context: row.context
    },
    provenance: {
      observationId: row.observation_id,
      documentId: row.document_id,
      versionId: row.version_id,
      contentHash: row.content_hash,
      pdfHash: row.pdf_hash,
      sourceId: row.source_id,
      generationId: row.generation_id,
      publicationDate: row.publication_date,
      publicationKind: row.publication_kind,
      sourceLocator: row.source_locator,
      rightsProfileId: row.rights_profile_id,
      rightsHash: row.policy_hash,
      contextHash: digest(row.context.trim()),
      metadata: row.metadata,
      metadataHash: digest(JSON.stringify(row.metadata))
    }
  }
}
