import { requireRights } from "@repo/legislation-core/legal-text/rights"
import { isLegalSearchDatabaseName } from "@repo/legislation-core/legal-text/search-database-role"
import type pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"
import { preparationPlanSchema } from "./preparation-plan.js"

export const legalPreparationWaveCompletionSchema = z.strictObject({ waveId: z.uuid() })
const parametersSchema = preparationPlanSchema.omit({ waveId: true })
const count = z.int().nonnegative()

const aggregateSchema = z.object({
  parameters: parametersSchema,
  selected_count: count,
  planning_complete: z.boolean(),
  dispatches: count,
  dispatch_pending: count,
  dispatch_submitting: count,
  dispatch_submitted: count,
  dispatch_completed: count,
  submission_uncertain: count,
  remote_state_mismatch: count,
  failed_attempts: count,
  cancelled_attempts: count,
  preparation_missing: count,
  preparation_pending: count,
  preparation_prepared: count,
  preparation_blocked: count,
  preparation_delayed: count,
  preparation_active: count,
  outbox_missing: count,
  lexical_pending: count,
  lexical_delayed: count,
  lexical_acknowledged: count,
  rights_inactive: count,
  inspected_at: z.date()
})

/** Aggregate one immutable planned wave. It never advances checkpoints or treats an empty runnable queue as success. */
export async function inspectLegalPreparationWaveCompletion(pool: pg.Pool, value: unknown) {
  const input = legalPreparationWaveCompletionSchema.parse(value)
  const client = await pool.connect()
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ")
    await client.query("SET LOCAL lock_timeout='5s'")
    await client.query("SET LOCAL statement_timeout='15s'")
    invariant(
      !isLegalSearchDatabaseName((await client.query("SELECT current_database() AS name")).rows[0]?.name),
      "legal_preparation_wave_wrong_database"
    )
    const profiles = z
      .array(z.object({ id: z.string().min(1) }))
      .max(100)
      .parse(
        (
          await client.query(
            `SELECT DISTINCT coalesce(edition.rights_profile_id,observation.rights_profile_id) AS id
             FROM legislation.legal_preparation_dispatches dispatch
             LEFT JOIN legislation.legal_editions edition
               ON dispatch.scope_kind='edition' AND edition.id=dispatch.scope_id
             LEFT JOIN legislation.regulatory_document_observations observation
               ON dispatch.scope_kind='publication' AND observation.id=dispatch.scope_id
             WHERE dispatch.wave_id=$1`,
            [input.waveId]
          )
        ).rows
      )
    for (const profile of profiles) {
      await requireRights(client, profile.id, "displayText")
      await requireRights(client, profile.id, "localSearch")
    }
    const result = await client.query(
      `SELECT plan.parameters,plan.selected_count,plan.exhausted AS planning_complete,
       count(dispatch.id)::integer AS dispatches,
       count(*) FILTER (WHERE dispatch.state='pending')::integer AS dispatch_pending,
       count(*) FILTER (WHERE dispatch.state='submitting')::integer AS dispatch_submitting,
       count(*) FILTER (WHERE dispatch.state='submitted')::integer AS dispatch_submitted,
       count(*) FILTER (WHERE dispatch.completed_at IS NOT NULL)::integer AS dispatch_completed,
       count(*) FILTER (WHERE dispatch.last_error='submission_uncertain')::integer AS submission_uncertain,
       count(*) FILTER (WHERE dispatch.last_error='completed_without_preparation')::integer AS remote_state_mismatch,
       coalesce(sum((SELECT count(*) FROM jsonb_array_elements(dispatch.run_history) history
         WHERE history->>'status' IN ('CRASHED','EXPIRED','FAILED','SYSTEM_FAILURE','TIMED_OUT'))),0)::integer AS failed_attempts,
       coalesce(sum((SELECT count(*) FROM jsonb_array_elements(dispatch.run_history) history
         WHERE history->>'status'='CANCELED')),0)::integer AS cancelled_attempts,
       count(*) FILTER (WHERE dispatch.id IS NOT NULL AND preparation.id IS NULL)::integer AS preparation_missing,
       count(*) FILTER (WHERE preparation.state='pending')::integer AS preparation_pending,
       count(*) FILTER (WHERE preparation.state='prepared')::integer AS preparation_prepared,
       count(*) FILTER (WHERE preparation.state='blocked')::integer AS preparation_blocked,
       count(*) FILTER (WHERE preparation.state='pending' AND preparation.retry_at>transaction_timestamp())::integer
         AS preparation_delayed,
       count(*) FILTER (WHERE preparation.lease_token IS NOT NULL
         AND preparation.lease_expires_at>transaction_timestamp())::integer AS preparation_active,
       count(*) FILTER (WHERE dispatch.id IS NOT NULL
         AND edition_outbox.id IS NULL AND publication_outbox.id IS NULL)::integer AS outbox_missing,
       count(*) FILTER (WHERE coalesce(edition_outbox.state,publication_outbox.state)='pending')::integer
         AS lexical_pending,
       count(*) FILTER (WHERE coalesce(edition_outbox.state,publication_outbox.state)='pending'
         AND coalesce(edition_outbox.retry_at,publication_outbox.retry_at)>transaction_timestamp())::integer
         AS lexical_delayed,
       count(*) FILTER (WHERE coalesce(edition_outbox.state,publication_outbox.state)='acknowledged')::integer
         AS lexical_acknowledged,
       count(*) FILTER (WHERE dispatch.id IS NOT NULL AND rights.id IS NULL)::integer AS rights_inactive,
       transaction_timestamp() AS inspected_at
       FROM legislation.legal_preparation_plans plan
       LEFT JOIN legislation.legal_preparation_dispatches dispatch ON dispatch.wave_id=plan.wave_id
       LEFT JOIN legislation.legal_passage_preparations preparation ON preparation.id=dispatch.preparation_id
       LEFT JOIN legislation.legal_editions edition
         ON dispatch.scope_kind='edition' AND edition.id=dispatch.scope_id
       LEFT JOIN legislation.regulatory_document_observations observation
         ON dispatch.scope_kind='publication' AND observation.id=dispatch.scope_id
       LEFT JOIN legislation.legal_rights_profiles rights
         ON rights.id=coalesce(edition.rights_profile_id,observation.rights_profile_id) AND rights.is_active
       LEFT JOIN legislation.legal_derived_outbox edition_outbox
         ON dispatch.scope_kind='edition' AND edition_outbox.edition_id=dispatch.scope_id
         AND edition_outbox.operation='lexical'
       LEFT JOIN legislation.regulatory_publication_outbox publication_outbox
         ON dispatch.scope_kind='publication' AND publication_outbox.observation_id=dispatch.scope_id
         AND publication_outbox.operation='lexical'
       WHERE plan.wave_id=$1
       GROUP BY plan.parameters,plan.selected_count,plan.exhausted`,
      [input.waveId]
    )
    invariant(result.rowCount === 1, "legal_preparation_wave_not_found")
    const row = aggregateSchema.parse(result.rows[0])
    const fullyRegistered = row.planning_complete && row.dispatches === row.selected_count
    const terminalPreparations = row.preparation_prepared + row.preparation_blocked
    const accounted =
      fullyRegistered &&
      terminalPreparations === row.selected_count &&
      row.lexical_pending + row.lexical_acknowledged === row.selected_count
    const ready =
      accounted &&
      row.selected_count > 0 &&
      row.dispatch_completed === row.selected_count &&
      row.preparation_prepared === row.selected_count &&
      row.lexical_acknowledged === row.selected_count &&
      row.preparation_missing === 0 &&
      row.outbox_missing === 0 &&
      row.rights_inactive === 0 &&
      row.submission_uncertain === 0 &&
      row.remote_state_mismatch === 0 &&
      row.preparation_delayed === 0 &&
      row.preparation_active === 0
    await client.query("COMMIT")
    return {
      waveId: input.waveId,
      parameters: row.parameters,
      inspectedAt: row.inspected_at.toISOString(),
      planning: {
        complete: row.planning_complete,
        selected: row.selected_count,
        registered: row.dispatches,
        fullyRegistered
      },
      dispatch: {
        pending: row.dispatch_pending,
        submitting: row.dispatch_submitting,
        submitted: row.dispatch_submitted,
        completed: row.dispatch_completed,
        submissionUncertain: row.submission_uncertain,
        remoteStateMismatch: row.remote_state_mismatch,
        failedAttempts: row.failed_attempts,
        cancelledAttempts: row.cancelled_attempts
      },
      preparation: {
        missing: row.preparation_missing,
        pending: row.preparation_pending,
        prepared: row.preparation_prepared,
        blocked: row.preparation_blocked,
        delayed: row.preparation_delayed,
        active: row.preparation_active
      },
      lexical: {
        missing: row.outbox_missing,
        pending: row.lexical_pending,
        delayed: row.lexical_delayed,
        acknowledged: row.lexical_acknowledged
      },
      rightsInactive: row.rights_inactive,
      accounted,
      ready,
      canonicalWrites: false as const,
      dispatched: false as const
    }
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}
