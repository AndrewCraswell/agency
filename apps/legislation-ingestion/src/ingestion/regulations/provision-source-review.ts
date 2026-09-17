import { isDeepStrictEqual } from "node:util"
import { digest } from "@repo/legislation-core/legal-text/contracts"
import { regulatoryParserContract } from "@repo/legislation-core/legal-text/parser-contract"
import { storedLegalSourceBlocks } from "@repo/legislation-core/legal-text/reader-text"
import {
  assertRights,
  provisionContent,
  regulatoryStorageContract
} from "@repo/legislation-core/legal-text/storage-contract"
import type pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"

export const legalProvisionSourceReviewContract = "legal-provision-source-review-2026-09-17"

const sha256 = z.string().regex(/^[a-f0-9]{64}$/)

export const legalProvisionSourceReviewRequestSchema = z.strictObject({
  editionId: z.uuid(),
  versionId: z.uuid(),
  tableIndex: z.int().nonnegative(),
  disposition: z.enum(["accepted_context", "quarantined_source_gap", "non_data_table"]),
  reason: z.string().min(1),
  expected: z.strictObject({
    contentHash: sha256,
    blockHash: sha256,
    nativeId: z.string().min(1),
    sourceLocator: z.string().min(1),
    sourceId: z.string().min(1),
    generationId: sha256,
    artifactHash: sha256,
    sourceUrl: z.url(),
    rightsProfileId: z.string().min(1),
    rightsHash: sha256
  }),
  corroboration: z.array(
    z.strictObject({
      sourceUrl: z.url(),
      artifactHash: sha256,
      bytes: z.int().positive(),
      observation: z.string().min(1)
    })
  ),
  canonicalBodyChanged: z.literal(false),
  contextInjected: z.literal(false),
  derivedPassagesAllowed: z.boolean()
})

const canonicalRowSchema = z.strictObject({
  content_hash: sha256,
  input_contract: z.literal(regulatoryStorageContract),
  heading: z.string(),
  body: z.string(),
  node_kind: z.string(),
  blocks: z.unknown(),
  language: z.literal("en"),
  native_id: z.string().min(1),
  source_locator: z.string().min(1),
  source_id: z.string().min(1),
  generation_id: sha256,
  artifact_hash: sha256,
  unit: z.object({ sourceUrl: z.url() }),
  rights_profile_id: z.string().min(1),
  policy: z.unknown(),
  policy_hash: sha256
})

async function validateLegalProvisionSourceReview(client: pg.PoolClient, requestInput: unknown) {
  const request = legalProvisionSourceReviewRequestSchema.parse(requestInput)
  invariant(
    request.disposition !== "quarantined_source_gap" || request.derivedPassagesAllowed === false,
    "legal_provision_source_review_quarantine_must_block_passages"
  )
  const canonical = canonicalRowSchema.parse(
    (
      await client.query(
        `SELECT v.content_hash,v.input_contract,v.heading,v.body,v.node_kind,v.blocks,v.language,
            m.native_id,m.source_locator,e.source_id,e.generation_id,g.artifact_hash,g.unit,
            e.rights_profile_id,r.policy,r.policy_hash
          FROM legislation.legal_edition_provisions m
          JOIN legislation.legal_provision_versions v ON v.id=m.version_id
          JOIN legislation.legal_editions e ON e.id=m.edition_id AND e.published_at IS NOT NULL
          JOIN legislation.legal_import_generations g ON g.id=e.generation_id AND g.state='published'
          JOIN legislation.legal_rights_profiles r ON r.id=e.rights_profile_id AND r.is_active
          WHERE m.edition_id=$1 AND m.version_id=$2
          FOR SHARE OF m,v,e,g,r`,
        [request.editionId, request.versionId]
      )
    ).rows[0]
  )
  const policy = assertRights(canonical.policy, "displayText")
  assertRights(policy, "localSearch")
  invariant(digest(JSON.stringify(policy)) === canonical.policy_hash, "legal_provision_source_review_rights_changed")
  invariant(canonical.content_hash === request.expected.contentHash, "legal_provision_source_review_content_changed")
  invariant(canonical.native_id === request.expected.nativeId, "legal_provision_source_review_identity_changed")
  invariant(
    canonical.source_locator === request.expected.sourceLocator,
    "legal_provision_source_review_locator_changed"
  )
  invariant(canonical.source_id === request.expected.sourceId, "legal_provision_source_review_source_changed")
  invariant(
    canonical.generation_id === request.expected.generationId &&
      canonical.artifact_hash === request.expected.artifactHash &&
      canonical.unit.sourceUrl === request.expected.sourceUrl,
    "legal_provision_source_review_artifact_changed"
  )
  invariant(
    canonical.rights_profile_id === request.expected.rightsProfileId &&
      canonical.policy_hash === request.expected.rightsHash,
    "legal_provision_source_review_rights_changed"
  )
  const blocks = storedLegalSourceBlocks({
    body: canonical.body,
    blocks: canonical.blocks,
    inputContract: canonical.input_contract
  })
  invariant(
    provisionContent({
      contract: regulatoryParserContract,
      nodeKind: canonical.node_kind,
      heading: canonical.heading,
      text: canonical.body,
      blocks
    }) === canonical.content_hash,
    "legal_provision_source_review_canonical_content_changed"
  )
  const table = blocks.filter((block) => block.kind === "table")[request.tableIndex]
  invariant(table && digest(table.xml) === request.expected.blockHash, "legal_provision_source_review_table_changed")

  const evidence = {
    contract: legalProvisionSourceReviewContract,
    editionId: request.editionId,
    versionId: request.versionId,
    tableIndex: request.tableIndex,
    disposition: request.disposition,
    reason: request.reason,
    canonical: request.expected,
    corroboration: request.corroboration,
    canonicalBodyChanged: request.canonicalBodyChanged,
    contextInjected: request.contextInjected,
    derivedPassagesAllowed: request.derivedPassagesAllowed
  }
  return { request, evidence, reviewHash: digest(JSON.stringify(evidence)) }
}

/** Validate a proposed review against one stable database snapshot without writing it. */
export async function inspectLegalProvisionSourceReview(pool: pg.Pool, requestInput: unknown) {
  const client = await pool.connect()
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ")
    const result = await validateLegalProvisionSourceReview(client, requestInput)
    await client.query("COMMIT")
    return result
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

/**
 * Persist an operator-reviewed table disposition only while every canonical and publisher identity still matches.
 * The review never mutates canonical source text or borrows corroborating text into passage inputs.
 */
export async function registerLegalProvisionSourceReview(pool: pg.Pool, requestInput: unknown) {
  const client = await pool.connect()
  try {
    await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE")
    const { request, evidence, reviewHash } = await validateLegalProvisionSourceReview(client, requestInput)
    const inserted = (
      await client.query(
        `INSERT INTO legislation.legal_provision_source_reviews
          (edition_id,version_id,table_index,block_hash,review_hash,disposition,evidence)
        VALUES($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT(edition_id,version_id,table_index) DO NOTHING
        RETURNING review_hash`,
        [
          request.editionId,
          request.versionId,
          request.tableIndex,
          request.expected.blockHash,
          reviewHash,
          request.disposition,
          evidence
        ]
      )
    ).rowCount
    const stored = (
      await client.query<{ block_hash: string; review_hash: string; disposition: string; evidence: unknown }>(
        `SELECT block_hash,review_hash,disposition,evidence
        FROM legislation.legal_provision_source_reviews
        WHERE edition_id=$1 AND version_id=$2 AND table_index=$3`,
        [request.editionId, request.versionId, request.tableIndex]
      )
    ).rows[0]
    invariant(
      stored?.block_hash === request.expected.blockHash &&
        stored.review_hash === reviewHash &&
        stored.disposition === request.disposition &&
        isDeepStrictEqual(stored.evidence, evidence),
      "legal_provision_source_review_replay_conflict"
    )
    await client.query("COMMIT")
    return { reviewHash, evidence, reused: inserted === 0 }
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}
