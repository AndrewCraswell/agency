import { digest } from "@repo/legislation-core/legal-text/contracts"
import type pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"
import { requireLegalPreparationRights } from "./passage-preparation.js"
import { preparationDispatchSchema, registerLegalPreparationDispatch } from "./preparation-dispatch.js"

export const preparationPlanSchema = preparationDispatchSchema
  .omit({ scope: true })
  .extend({ source: z.enum(["ecfr", "govinfo-cfr", "govinfo-fr"]), publishedBefore: z.iso.datetime({ offset: true }) })

/** One atomic page of source references and durable intent. Never submits remote work. */
export async function planLegalPreparationPage(pool: pg.Pool, value: unknown) {
  const input = preparationPlanSchema.parse(value)
  const { waveId, ...parameters } = input
  const request = { ...parameters, publishedBefore: new Date(parameters.publishedBefore).toISOString() }
  const requestHash = digest(JSON.stringify(request))
  const kind = request.source === "govinfo-fr" ? "publication" : "edition"
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    await client.query("SET LOCAL lock_timeout='5s'")
    await client.query("SET LOCAL statement_timeout='15s'")
    invariant(
      (await client.query("SELECT current_database() AS name")).rows[0]?.name !== "legislation_passage_search",
      "legal_preparation_wrong_database"
    )
    const registered = await client.query(
      `INSERT INTO legislation.legal_preparation_plans(wave_id,request_hash,parameters)
      SELECT $1,$2,$3::jsonb WHERE $4::timestamptz<=transaction_timestamp()
      ON CONFLICT(wave_id) DO UPDATE SET wave_id=EXCLUDED.wave_id
      WHERE legislation.legal_preparation_plans.request_hash=EXCLUDED.request_hash RETURNING wave_id`,
      [waveId, requestHash, JSON.stringify(request), request.publishedBefore]
    )
    invariant(registered.rows.length === 1, "legal_preparation_plan_changed_or_future_cutoff")
    const state = z
      .object({ after_id: z.uuid().nullable(), exhausted: z.boolean(), selected_count: z.int().nonnegative() })
      .parse(
        (
          await client.query(
            "SELECT after_id,exhausted,selected_count FROM legislation.legal_preparation_plans WHERE wave_id=$1 FOR UPDATE",
            [waveId]
          )
        ).rows[0]
      )
    const rows = state.exhausted
      ? []
      : z.array(z.object({ id: z.uuid() })).parse(
          (
            await client.query(
              kind === "publication"
                ? `SELECT o.id FROM legislation.regulatory_document_observations o
      JOIN legislation.regulatory_publication_batches b ON b.generation_id=o.generation_id
      WHERE o.source_id=$1 AND o.jurisdiction_id='jurisdiction:us' AND b.published_at<=$2::timestamptz
      AND o.id>COALESCE($3::uuid,'00000000-0000-0000-0000-000000000000'::uuid)
      ORDER BY o.id LIMIT 11 FOR SHARE OF o,b`
                : `SELECT id FROM legislation.legal_editions WHERE source_id=$1 AND jurisdiction_id='jurisdiction:us'
      AND published_at IS NOT NULL AND published_at<=$2::timestamptz
      AND id>COALESCE($3::uuid,'00000000-0000-0000-0000-000000000000'::uuid)
      ORDER BY id LIMIT 11 FOR SHARE`,
              [request.source, request.publishedBefore, state.after_id]
            )
          ).rows
        )
    const page = rows.slice(0, 10)
    // Validate the complete page before registering anything; revocation also rolls back the checkpoint.
    for (const row of page) {
      await requireLegalPreparationRights(client, { kind, id: row.id })
    }
    const dispatches = []
    for (const row of page) {
      dispatches.push(
        await registerLegalPreparationDispatch(client, {
          waveId,
          scope: { kind, id: row.id },
          model: request.model,
          limit: request.limit,
          retryBlocked: request.retryBlocked
        })
      )
    }
    const afterId = page.at(-1)?.id ?? state.after_id
    const exhausted = rows.length <= 10
    const selectedCount = state.selected_count + page.length
    await client.query(
      `UPDATE legislation.legal_preparation_plans SET after_id=$2,exhausted=$3,selected_count=$4
      WHERE wave_id=$1`,
      [waveId, afterId, exhausted, selectedCount]
    )
    await client.query("COMMIT")
    return {
      waveId,
      planned: page.length,
      selectedCount,
      afterId,
      exhausted,
      dispatchIds: dispatches.map((item) => item.id),
      submitted: false as const
    }
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}
