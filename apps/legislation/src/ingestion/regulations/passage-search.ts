import { isDeepStrictEqual } from "node:util"
import type pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"
import { digest } from "./contracts.js"
import { requireLegalCopyReceiptRevisions } from "./copy-receipt-revisions.js"
import { legalTransferGenerationSchema, legalTransferRowSchema } from "./passage-replication.js"
import { legalPassageScopeSchema, readLegalPassageScope } from "./passage-storage.js"
import { requireRights } from "./storage.js"

/** Internal version-scoped canary. Live source rights are mandatory even when a search copy already exists. */
export async function searchCopiedLegalPassages(
  sourcePool: pg.Pool,
  targetPool: pg.Pool,
  input: {
    scope: z.infer<typeof legalPassageScopeSchema>
    generationId: string
    query: string
    limit?: number
    requireCurrent?: boolean
    preparationId?: string
    apiAccess?: boolean
  }
) {
  const scope = legalPassageScopeSchema.parse(input.scope)
  const id = z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .parse(input.generationId)
  const query = z.string().trim().min(1).max(500).parse(input.query)
  const limit = z
    .int()
    .min(1)
    .max(50)
    .parse(input.limit ?? 10)
  invariant(sourcePool !== targetPool, "legal_search_requires_separate_database")
  const source = await sourcePool.connect()
  try {
    invariant(
      (await source.query("SELECT current_database() AS name")).rows[0]?.name !== "legislation_passage_search",
      "legal_search_wrong_source"
    )
    await source.query("BEGIN ISOLATION LEVEL REPEATABLE READ")
    await source.query("SET LOCAL lock_timeout='5s'")
    await source.query("SET LOCAL statement_timeout='15s'")
    const sourceScope = await readLegalPassageScope(source, scope)
    if (input.apiAccess) {
      invariant(
        sourceScope.jurisdiction_id === "jurisdiction:us" &&
          ["ecfr", "govinfo-fr", "govinfo-cfr"].includes(sourceScope.source_id),
        "legal_api_source_unsupported"
      )
      await requireRights(source, sourceScope.rights_profile_id, "apiMcp")
      invariant(input.preparationId !== undefined, "legal_api_acknowledgement_required")
    }
    if (input.requireCurrent) {
      invariant(scope.kind === "provision", "legal_search_current_scope_unsupported")
      invariant(
        (
          await source.query("SELECT 1 FROM legislation.legal_code_heads WHERE edition_id=$1 FOR SHARE", [
            scope.editionId
          ])
        ).rowCount === 1,
        "legal_search_head_changed"
      )
    }
    const scopeKind = scope.kind === "provision" ? "edition" : "publication"
    const scopeId = scope.kind === "provision" ? scope.editionId : scope.observationId
    let registration: { inventory_hash: string; expected_count: number } | undefined
    if (input.preparationId !== undefined) {
      const preparationId = z
        .string()
        .regex(/^[a-f0-9]{64}$/)
        .parse(input.preparationId)
      const prepared =
        scope.kind === "provision"
          ? await source.query(
              `SELECT p.inventory_hash,p.expected_count FROM legislation.legal_passage_preparations p
          JOIN legislation.legal_passage_preparation_items i ON i.preparation_id=p.id
          JOIN legislation.legal_derived_outbox o ON o.edition_id=p.edition_id AND o.operation='lexical'
          WHERE p.id=$1 AND p.edition_id=$2 AND i.version_id=$3 AND i.generation_id=$4
          AND p.state='prepared' AND p.lease_token IS NULL AND o.state='acknowledged' FOR SHARE OF p,i,o`,
              [preparationId, scopeId, scope.versionId, id]
            )
          : await source.query(
              `SELECT p.inventory_hash,p.expected_count FROM legislation.legal_passage_preparations p
          JOIN legislation.legal_passage_preparation_items i ON i.preparation_id=p.id
          JOIN legislation.regulatory_publication_outbox o ON o.observation_id=p.observation_id
          WHERE p.id=$1 AND p.observation_id=$2 AND i.version_id=$3 AND i.generation_id=$4
          AND p.state='prepared' AND p.lease_token IS NULL AND o.state='acknowledged' FOR SHARE OF p,i,o`,
              [preparationId, scopeId, scope.versionId, id]
            )
      invariant(prepared.rows.length === 1, "legal_search_scope_not_acknowledged")
      registration = z.object({ inventory_hash: z.string(), expected_count: z.int() }).parse(prepared.rows[0])
    }
    const metadata = legalTransferGenerationSchema.parse(
      (await source.query("SELECT * FROM legislation.legal_passage_generations WHERE id=$1 FOR SHARE", [id])).rows[0]
    )
    invariant(
      metadata.provision_version_id === (scope.kind === "provision" ? scope.versionId : null) &&
        metadata.document_version_id === (scope.kind === "publication" ? scope.versionId : null),
      "legal_search_scope_mismatch"
    )
    // Source validation deliberately precedes target connection. A revoked scope never queries retained text.
    const target = await targetPool.connect()
    try {
      invariant(
        (await target.query("SELECT current_database() AS name")).rows[0]?.name === "legislation_passage_search",
        "legal_search_wrong_target"
      )
      await target.query("BEGIN ISOLATION LEVEL REPEATABLE READ")
      await target.query("SET LOCAL lock_timeout='5s'")
      await target.query("SET LOCAL statement_timeout='15s'")
      invariant(
        (
          await target.query(
            `SELECT 1 FROM legislation.legal_search_memberships
        WHERE scope_kind=$1 AND scope_id=$2 AND generation_id=$3 FOR SHARE`,
            [scopeKind, scopeId, id]
          )
        ).rowCount === 1,
        "legal_search_scope_copy_missing"
      )
      if (registration) {
        const receipt = await target.query(
          `SELECT 1 FROM legislation.legal_search_scopes WHERE scope_kind=$1 AND scope_id=$2
          AND preparation_id=$3 AND inventory_hash=$4 AND generation_count=$5 FOR SHARE`,
          [scopeKind, scopeId, input.preparationId, registration.inventory_hash, registration.expected_count]
        )
        invariant(receipt.rowCount === 1, "legal_search_scope_receipt_changed")
        await requireLegalCopyReceiptRevisions(source, target, [
          {
            kind: scopeKind,
            id: scopeId,
            preparationId: z.string().parse(input.preparationId),
            count: registration.expected_count
          }
        ])
      }
      const stored = await target.query(
        "SELECT metadata FROM legislation.legal_search_generations WHERE id=$1 FOR SHARE",
        [id]
      )
      invariant(
        stored.rows.length === 1 && isDeepStrictEqual(stored.rows[0].metadata, metadata),
        "legal_search_generation_unavailable"
      )
      const count = await target.query(
        "SELECT count(*)::integer AS n FROM legislation.legal_search_passages WHERE generation_id=$1",
        [id]
      )
      invariant(count.rows[0]?.n === metadata.passage_count, "legal_search_incomplete_generation")
      const candidates = z.array(legalTransferRowSchema.extend({ score: z.number().nonnegative() })).parse(
        (
          await target.query(
            `SELECT p.id,p.ordinal,p.body,p.input_text,p.data,ts_rank_cd(p.search_vector,q.query) AS score
         FROM legislation.legal_search_passages p CROSS JOIN websearch_to_tsquery('english',$2) AS q(query)
         WHERE p.generation_id=$1 AND p.search_vector @@ q.query ORDER BY score DESC,p.ordinal LIMIT $3 FOR SHARE OF p`,
            [id, query, limit]
          )
        ).rows
      )
      const originals = z
        .array(legalTransferRowSchema)
        .parse(
          (
            await source.query(
              "SELECT id,ordinal,body,input_text,data FROM legislation.legal_passages WHERE generation_id=$1 AND id=ANY($2::text[]) FOR SHARE",
              [id, candidates.map((row) => row.id)]
            )
          ).rows
        )
      const byId = new Map(originals.map((row) => [row.id, row]))
      const hits = candidates.map(({ score, ...row }) => {
        invariant(
          isDeepStrictEqual(byId.get(row.id), row) &&
            digest(row.input_text) === row.data.inputHash &&
            row.data.versionId === scope.versionId,
          "legal_search_candidate_mismatch"
        )
        return { id: row.id, ordinal: row.ordinal, body: row.body, data: row.data, score }
      })
      await target.query("COMMIT")
      await source.query("COMMIT")
      return hits
    } catch (error) {
      await target.query("ROLLBACK")
      throw error
    } finally {
      target.release()
    }
  } catch (error) {
    await source.query("ROLLBACK")
    throw error
  } finally {
    source.release()
  }
}

/** Resolve a provision from the authoritative source head; recheck it and the selected receipt inside the guarded read. */
export async function searchCurrentLegalProvision(
  source: pg.Pool,
  target: pg.Pool,
  input: {
    codeId: string
    sourceId: string
    nativeId: string
    query: string
    limit?: number
  }
) {
  const codeId = z.uuid().parse(input.codeId)
  const sourceId = z.string().min(1).max(256).parse(input.sourceId)
  const nativeId = z.string().min(1).max(1000).parse(input.nativeId)
  const current = await source.query(
    `SELECT h.edition_id,m.version_id FROM legislation.legal_code_heads h
    JOIN legislation.legal_edition_provisions m ON m.edition_id=h.edition_id
    WHERE h.code_id=$1 AND h.source_id=$2 AND m.native_id=$3`,
    [codeId, sourceId, nativeId]
  )
  invariant(current.rows.length === 1, "legal_search_current_provision_unavailable")
  const row = z.object({ edition_id: z.uuid(), version_id: z.uuid() }).parse(current.rows[0])
  invariant(
    (await target.query("SELECT current_database() AS name")).rows[0]?.name === "legislation_passage_search",
    "legal_search_wrong_target"
  )
  const receipt = await target.query(
    "SELECT preparation_id FROM legislation.legal_search_scopes WHERE scope_kind='edition' AND scope_id=$1",
    [row.edition_id]
  )
  invariant(receipt.rows.length === 1, "legal_search_current_copy_unavailable")
  const preparationId = z.string().parse(receipt.rows[0].preparation_id)
  const item = await source.query(
    "SELECT generation_id FROM legislation.legal_passage_preparation_items WHERE preparation_id=$1 AND version_id=$2",
    [preparationId, row.version_id]
  )
  invariant(item.rows.length === 1, "legal_search_current_copy_unavailable")
  return searchCopiedLegalPassages(source, target, {
    scope: { kind: "provision", editionId: row.edition_id, versionId: row.version_id },
    generationId: z.string().parse(item.rows[0].generation_id),
    preparationId,
    requireCurrent: true,
    query: input.query,
    limit: input.limit
  })
}
