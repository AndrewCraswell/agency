import { digest } from "@repo/legislation-core/legal-text/contracts"
import { regulatoryParserContract } from "@repo/legislation-core/legal-text/parser-contract"
import { storedLegalSourceBlocks } from "@repo/legislation-core/legal-text/reader-text"
import {
  assertRights,
  provisionContent,
  regulatoryStorageContract
} from "@repo/legislation-core/legal-text/storage-contract"
import invariant from "tiny-invariant"
import { z } from "zod"

const hash = z.string().regex(/^[a-f0-9]{64}$/)
export const evaluationCodeSelectionSchema = z.strictObject({
  editionId: z.uuid(),
  versionId: z.uuid(),
  contentHash: hash
})

/** Verifies a database snapshot, not publisher authenticity or final evaluation review. */
export function verifyEvaluationCodeSnapshot(value: unknown, selectionValue: unknown) {
  const selection = evaluationCodeSelectionSchema.parse(selectionValue)
  const row = z
    .object({
      edition_id: z.uuid(),
      version_id: z.uuid(),
      content_hash: hash,
      source_id: z.enum(["ecfr", "govinfo-cfr"]),
      jurisdiction_id: z.literal("jurisdiction:us"),
      generation_id: hash,
      native_id: z.string().min(1),
      source_locator: z.string().min(1),
      currency_date: z.string().nullable(),
      issue_date: z.string().nullable(),
      rights_profile_id: z.string().min(1),
      policy_hash: hash,
      policy: z.unknown(),
      body: z.string(),
      blocks: z.unknown(),
      heading: z.string(),
      node_kind: z.string(),
      input_contract: z.literal(regulatoryStorageContract),
      language: z.literal("en"),
      context: z.string().max(16000)
    })
    .parse(value)
  invariant(
    row.edition_id === selection.editionId &&
      row.version_id === selection.versionId &&
      row.content_hash === selection.contentHash,
    "evaluation_code_selection_mismatch"
  )
  const policy = assertRights(row.policy, "displayText")
  assertRights(policy, "localSearch")
  invariant(policy.embeddings && policy.exports, "evaluation_code_rights_denied")
  invariant(digest(JSON.stringify(policy)) === row.policy_hash, "evaluation_code_rights_hash_mismatch")
  invariant(
    Buffer.byteLength(row.body) + Buffer.byteLength(JSON.stringify(row.blocks)) <= 16 * 1024 * 1024,
    "evaluation_code_source_byte_limit"
  )
  const blocks = storedLegalSourceBlocks({ body: row.body, blocks: row.blocks, inputContract: row.input_contract })
  invariant(
    provisionContent({
      contract: regulatoryParserContract,
      nodeKind: row.node_kind,
      heading: row.heading,
      text: row.body,
      blocks
    }) === row.content_hash,
    "evaluation_code_content_mismatch"
  )
  return {
    input: {
      versionId: row.version_id,
      body: row.body,
      blocks: row.blocks,
      inputContract: row.input_contract,
      context: row.context
    },
    provenance: {
      editionId: row.edition_id,
      versionId: row.version_id,
      contentHash: row.content_hash,
      sourceId: row.source_id,
      generationId: row.generation_id,
      nativeId: row.native_id,
      sourceLocator: row.source_locator,
      currencyDate: row.currency_date,
      issueDate: row.issue_date,
      rightsProfileId: row.rights_profile_id,
      rightsHash: row.policy_hash,
      contextHash: digest(row.context.trim())
    }
  }
}
