import type pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"
import { requireLegalPreparationRights } from "./passage-preparation.js"
import { replicateLegalPassageGeneration } from "./passage-replication.js"

const hash = z.string().regex(/^[a-f0-9]{64}$/)
export const legalPassageCopyRequestSchema = z.strictObject({
  preparationId: hash,
  afterOrdinal: z.int().min(-1).default(-1),
  limit: z.int().min(1).max(25).default(10)
})

/** Bounded copy traversal only. Exhaustion never substitutes for whole-scope inspection and acknowledgement. */
export async function runLegalPassageCopyBatch(sourcePool: pg.Pool, targetPool: pg.Pool, unparsed: unknown) {
  const input = legalPassageCopyRequestSchema.parse(unparsed)
  invariant(sourcePool !== targetPool, "legal_search_requires_separate_database")
  const source = await sourcePool.connect()
  const plan = await (async () => {
    try {
      invariant(
        (await source.query("SELECT current_database() AS name")).rows[0]?.name !== "legislation_passage_search",
        "legal_search_wrong_source"
      )
      await source.query("BEGIN")
      await source.query("SET LOCAL lock_timeout='5s'")
      await source.query("SET LOCAL statement_timeout='15s'")
      const job = z
        .object({
          edition_id: z.uuid().nullable(),
          observation_id: z.uuid().nullable(),
          state: z.literal("prepared"),
          lease_token: z.null(),
          expected_count: z.int().positive()
        })
        .parse(
          (
            await source.query("SELECT * FROM legislation.legal_passage_preparations WHERE id=$1 FOR SHARE", [
              input.preparationId
            ])
          ).rows[0]
        )
      invariant((job.edition_id === null) !== (job.observation_id === null), "legal_copy_scope_mismatch")
      const scope =
        job.edition_id === null
          ? { kind: "publication" as const, id: z.uuid().parse(job.observation_id) }
          : { kind: "edition" as const, id: job.edition_id }
      await requireLegalPreparationRights(source, scope)
      const counts = z
        .object({ total: z.int(), complete: z.int() })
        .parse(
          (
            await source.query(
              "SELECT count(*)::integer AS total,count(generation_id)::integer AS complete FROM legislation.legal_passage_preparation_items WHERE preparation_id=$1",
              [input.preparationId]
            )
          ).rows[0]
        )
      invariant(
        counts.total === job.expected_count && counts.complete === counts.total,
        "legal_copy_preparation_incomplete"
      )
      if (input.afterOrdinal !== -1) {
        invariant(
          (
            await source.query(
              "SELECT 1 FROM legislation.legal_passage_preparation_items WHERE preparation_id=$1 AND ordinal=$2",
              [input.preparationId, input.afterOrdinal]
            )
          ).rowCount === 1,
          "legal_copy_cursor_not_in_inventory"
        )
      }
      const items = z
        .array(z.object({ ordinal: z.int().nonnegative(), version_id: z.uuid(), generation_id: hash }))
        .parse(
          (
            await source.query(
              "SELECT ordinal,version_id,generation_id FROM legislation.legal_passage_preparation_items WHERE preparation_id=$1 AND ordinal>$2 ORDER BY ordinal LIMIT $3 FOR SHARE",
              [input.preparationId, input.afterOrdinal, input.limit + 1]
            )
          ).rows
        )
      await source.query("COMMIT")
      return { scope, items, total: counts.total }
    } catch (error) {
      await source.query("ROLLBACK")
      throw error
    } finally {
      source.release()
    }
  })()

  // Every individual copy rechecks canonical ownership and current rights. Release planning locks and connections
  // first so tiny pools cannot deadlock, and rights changes between batches can take effect.
  let afterOrdinal = input.afterOrdinal
  let copied = 0
  const deadline = Date.now() + 45_000
  for (const item of plan.items.slice(0, input.limit)) {
    if (copied > 0 && Date.now() >= deadline) {
      break
    }
    await replicateLegalPassageGeneration(sourcePool, targetPool, {
      scope:
        plan.scope.kind === "edition"
          ? { kind: "provision", editionId: plan.scope.id, versionId: item.version_id }
          : { kind: "publication", observationId: plan.scope.id, versionId: item.version_id },
      generationId: item.generation_id
    })
    afterOrdinal = item.ordinal
    copied++
  }
  return {
    preparationId: input.preparationId,
    afterOrdinal,
    copied,
    total: plan.total,
    exhausted: copied === plan.items.length,
    publicSearchReady: false as const
  }
}
