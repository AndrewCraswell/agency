import { requireLegalCopyReceiptRevisions } from "@repo/legislation-core/legal-text/copy-receipt-revisions"
import type pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"
import { requireLegalPreparationRights } from "./passage-preparation.js"

const hashSchema = z.string().regex(/^[a-f0-9]{64}$/)
export const legalPassagePipelineCompletionSchema = z.strictObject({ preparationId: hashSchema })
const sourceSchema = z.object({
  edition_id: z.uuid().nullable(),
  observation_id: z.uuid().nullable(),
  state: z.enum(["pending", "prepared", "blocked"]),
  inventory_hash: hashSchema,
  expected_count: z.int().positive(),
  lease_active: z.boolean(),
  retry_delayed: z.boolean(),
  items: z.int().nonnegative(),
  prepared_items: z.int().nonnegative(),
  blocked_items: z.int().nonnegative()
})
const targetSchema = z.object({
  memberships: z.int().nonnegative(),
  validation_items: z.int().nonnegative(),
  receipt_revisions: z.int().nonnegative(),
  receipt_preparation_id: hashSchema.nullable(),
  receipt_inventory_hash: hashSchema.nullable(),
  receipt_generations: z.int().positive().nullable(),
  receipt_passages: z.int().nonnegative().nullable()
})

function isRevisionMismatch(error: unknown) {
  return (
    error instanceof Error && error.message.replace(/^Invariant failed: /, "") === "legal_search_scope_revision_changed"
  )
}

/** Reconciles canonical preparation and outbox state with the isolated lexical receipt and revision fences. */
export async function inspectLegalPassagePipelineCompletion(sourcePool: pg.Pool, targetPool: pg.Pool, value: unknown) {
  const input = legalPassagePipelineCompletionSchema.parse(value)
  invariant(sourcePool !== targetPool, "legal_search_requires_separate_database")
  const source = await sourcePool.connect()
  const target = await targetPool.connect()
  try {
    invariant(
      (await source.query("SELECT current_database() AS name")).rows[0]?.name !== "legislation_passage_search",
      "legal_search_wrong_source"
    )
    invariant(
      (await target.query("SELECT current_database() AS name")).rows[0]?.name === "legislation_passage_search",
      "legal_search_wrong_target"
    )
    await source.query("BEGIN ISOLATION LEVEL REPEATABLE READ")
    await target.query("BEGIN ISOLATION LEVEL REPEATABLE READ")
    await source.query("SET LOCAL lock_timeout='5s'")
    await source.query("SET LOCAL statement_timeout='30s'")
    await target.query("SET LOCAL lock_timeout='5s'")
    await target.query("SET LOCAL statement_timeout='30s'")
    const canonicalResult = await source.query(
      `SELECT preparation.edition_id,preparation.observation_id,preparation.state,
           preparation.inventory_hash,preparation.expected_count,
           COALESCE(preparation.lease_token IS NOT NULL
             AND preparation.lease_expires_at>transaction_timestamp(),false) lease_active,
           preparation.retry_at>transaction_timestamp() retry_delayed,
           count(item.ordinal)::integer items,
           count(item.generation_id)::integer prepared_items,
           count(*) FILTER (WHERE item.failure_code IS NOT NULL)::integer blocked_items
           FROM legislation.legal_passage_preparations preparation
           LEFT JOIN legislation.legal_passage_preparation_items item ON item.preparation_id=preparation.id
           WHERE preparation.id=$1
           GROUP BY preparation.id`,
      [input.preparationId]
    )
    invariant(canonicalResult.rowCount === 1, "legal_preparation_not_found")
    const canonical = sourceSchema.parse(canonicalResult.rows[0])
    invariant((canonical.edition_id === null) !== (canonical.observation_id === null), "legal_copy_scope_mismatch")
    const scope =
      canonical.edition_id === null
        ? { kind: "publication" as const, id: z.uuid().parse(canonical.observation_id) }
        : { kind: "edition" as const, id: canonical.edition_id }
    // Match finalization's target-before-source lock order so a live acknowledgement cannot deadlock inspection.
    await target.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `legal-scope:${scope.kind}:${scope.id}`
    ])
    await requireLegalPreparationRights(source, scope)
    const outbox = z
      .object({ state: z.enum(["pending", "acknowledged"]), delayed: z.boolean() })
      .nullable()
      .parse(
        (
          await source.query(
            scope.kind === "edition"
              ? `SELECT state,state='pending' AND retry_at>transaction_timestamp() delayed
                 FROM legislation.legal_derived_outbox WHERE edition_id=$1 AND operation='lexical' FOR SHARE`
              : `SELECT state,state='pending' AND retry_at>transaction_timestamp() delayed
                 FROM legislation.regulatory_publication_outbox WHERE observation_id=$1 AND operation='lexical' FOR SHARE`,
            [scope.id]
          )
        ).rows[0] ?? null
      )
    const copied = targetSchema.parse(
      (
        await target.query(
          `SELECT
           (SELECT count(*)::integer FROM legislation.legal_search_memberships
             WHERE scope_kind=$1 AND scope_id=$2) memberships,
           (SELECT count(*)::integer FROM legislation.legal_copy_validation_items
             WHERE preparation_id=$3) validation_items,
           (SELECT count(*)::integer FROM legislation.legal_search_scope_revisions
             WHERE scope_kind=$1 AND scope_id=$2) receipt_revisions,
           receipt.preparation_id receipt_preparation_id,receipt.inventory_hash receipt_inventory_hash,
           receipt.generation_count receipt_generations,receipt.passage_count receipt_passages
           FROM (SELECT 1) seed LEFT JOIN legislation.legal_search_scopes receipt
             ON receipt.scope_kind=$1 AND receipt.scope_id=$2`,
          [scope.kind, scope.id, input.preparationId]
        )
      ).rows[0]
    )
    const receiptMatches =
      copied.receipt_preparation_id === input.preparationId &&
      copied.receipt_inventory_hash === canonical.inventory_hash &&
      copied.receipt_generations === canonical.expected_count &&
      copied.memberships === canonical.expected_count &&
      copied.validation_items === canonical.expected_count &&
      copied.receipt_revisions === canonical.expected_count
    let revisionBound = false
    if (canonical.state === "prepared" && receiptMatches) {
      try {
        await requireLegalCopyReceiptRevisions(source, target, [
          { ...scope, preparationId: input.preparationId, count: canonical.expected_count }
        ])
        revisionBound = true
      } catch (error) {
        if (!isRevisionMismatch(error)) throw error
      }
    }
    const accounted =
      canonical.items === canonical.expected_count &&
      canonical.prepared_items + canonical.blocked_items === canonical.expected_count
    const ready =
      accounted &&
      canonical.state === "prepared" &&
      canonical.prepared_items === canonical.expected_count &&
      canonical.blocked_items === 0 &&
      !canonical.lease_active &&
      !canonical.retry_delayed &&
      outbox?.state === "acknowledged" &&
      receiptMatches &&
      revisionBound
    await target.query("COMMIT")
    await source.query("COMMIT")
    return {
      preparationId: input.preparationId,
      scope,
      preparation: {
        state: canonical.state,
        expected: canonical.expected_count,
        items: canonical.items,
        prepared: canonical.prepared_items,
        blocked: canonical.blocked_items,
        active: canonical.lease_active,
        delayed: canonical.retry_delayed
      },
      lexical: { state: outbox?.state ?? "missing", delayed: outbox?.delayed ?? false },
      copy: {
        memberships: copied.memberships,
        validationItems: copied.validation_items,
        receiptRevisions: copied.receipt_revisions,
        receiptGenerations: copied.receipt_generations ?? 0,
        receiptPassages: copied.receipt_passages ?? 0,
        receiptMatches,
        revisionBound
      },
      accounted,
      ready,
      canonicalWrites: false as const,
      targetWrites: false as const,
      dispatched: false as const
    }
  } catch (error) {
    await Promise.allSettled([source.query("ROLLBACK"), target.query("ROLLBACK")])
    throw error
  } finally {
    source.release()
    target.release()
  }
}
