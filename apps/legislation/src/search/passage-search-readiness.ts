import { z } from "zod"
import { type ReplicationConnection } from "./passage-search-replication.js"

const sourceSchema = z.object({
  observed_at: z.string(),
  backfill_complete: z.boolean(),
  after_document_id: z.string().nullable(),
  pending: z.string().regex(/^\d+$/),
  failed: z.string().regex(/^\d+$/),
  oldest_pending_at: z.string().nullable()
})

const targetSchema = z.object({
  observed_at: z.string(),
  database_name: z.literal("legislation_passage_search"),
  index_valid: z.boolean(),
  index_ready: z.boolean()
})

async function readSnapshot(connection: ReplicationConnection, query: string) {
  await connection.query("begin read only")
  try {
    await connection.query("set local statement_timeout='10s'")
    await connection.query("set local lock_timeout='1s'")
    return (await connection.query(query)).rows[0]
  } finally {
    await connection.query("rollback")
  }
}

/** Cheap prerequisite check, not a corpus parity audit or permission to cut over. */
export async function inspectPassageSearchReadiness(source: ReplicationConnection, target: ReplicationConnection) {
  if (source === target) {
    throw new Error("Passage readiness requires separate source and target connections")
  }
  const sourceState = sourceSchema.parse(
    await readSnapshot(
      source,
      `select statement_timestamp()::text observed_at,
      coalesce((select completed_at is not null from legislation.passage_search_backfill
        where name='documents'),false) backfill_complete,
      (select after_document_id from legislation.passage_search_backfill where name='documents') after_document_id,
      count(*)::text pending,
      count(*) filter (where attempts>0)::text failed,
      min(enqueued_at)::text oldest_pending_at
      from legislation.passage_search_changes`
    )
  )
  const targetState = targetSchema.parse(
    await readSnapshot(
      target,
      `select statement_timestamp()::text observed_at,
      current_database() database_name,
      coalesce((select indisvalid from pg_index
        where indexrelid=to_regclass('legislation.document_sections_ranked_text_idx')),false) index_valid,
      coalesce((select indisready from pg_index
        where indexrelid=to_regclass('legislation.document_sections_ranked_text_idx')),false) index_ready`
    )
  )
  const blockers: string[] = []
  if (!sourceState.backfill_complete) {
    blockers.push("backfill_incomplete")
  }
  if (sourceState.pending !== "0") {
    blockers.push("pending_changes")
  }
  if (sourceState.failed !== "0") {
    blockers.push("failed_changes")
  }
  if (!targetState.index_valid || !targetState.index_ready) {
    blockers.push("ranked_index_unavailable")
  }
  return {
    source: sourceState,
    target: targetState,
    blockers,
    synchronizationCaughtUpAtObservation: blockers.length === 0,
    cutoverApproved: false,
    remainingAcceptance: ["corpus_parity", "full_corpus_search", "authenticated_api_and_mcp", "ingestion_overlap"]
  }
}
