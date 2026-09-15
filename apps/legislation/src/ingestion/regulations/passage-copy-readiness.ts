import { isDeepStrictEqual } from "node:util"
import type pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"
import { digest } from "./contracts.js"
import { readLegalPassageInventory, requireLegalPreparationRights } from "./passage-preparation.js"
import { legalTransferGenerationSchema, legalTransferRowSchema } from "./passage-replication.js"

/** Read-only application operation. Holds row locks, but never acknowledges jobs or authorizes public search. */
export async function inspectLegalPassageCopy(sourcePool: pg.Pool, targetPool: pg.Pool, preparationId: string) {
  return checkLegalPassageCopy(sourcePool, targetPool, preparationId, false)
}

/** Verify the entire copy, commit its target receipt, then acknowledge only the matching canonical lexical job. */
export async function acknowledgeLegalPassageCopy(sourcePool: pg.Pool, targetPool: pg.Pool, preparationId: string) {
  return checkLegalPassageCopy(sourcePool, targetPool, preparationId, true)
}

async function checkLegalPassageCopy(
  sourcePool: pg.Pool,
  targetPool: pg.Pool,
  preparationId: string,
  acknowledge: boolean
) {
  const id = z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .parse(preparationId)
  invariant(sourcePool !== targetPool, "legal_search_requires_separate_database")
  const deadline = Date.now() + 60_000
  const checkDeadline = () => invariant(Date.now() < deadline, "legal_copy_inspection_deadline")
  const target = await targetPool.connect()
  try {
    invariant(
      (await target.query("SELECT current_database() AS name")).rows[0]?.name === "legislation_passage_search",
      "legal_search_wrong_target"
    )
    await target.query("BEGIN ISOLATION LEVEL REPEATABLE READ")
    await target.query("SET LOCAL lock_timeout='5s'")
    await target.query("SET LOCAL statement_timeout='60s'")
    const source = await sourcePool.connect()
    try {
      invariant(
        (await source.query("SELECT current_database() AS name")).rows[0]?.name !== "legislation_passage_search",
        "legal_search_wrong_source"
      )
      await source.query("BEGIN ISOLATION LEVEL REPEATABLE READ")
      await source.query("SET LOCAL lock_timeout='5s'")
      await source.query("SET LOCAL statement_timeout='60s'")
      const job = z
        .object({
          edition_id: z.uuid().nullable(),
          observation_id: z.uuid().nullable(),
          state: z.literal("prepared"),
          lease_token: z.null(),
          tokenizer_id: z.string(),
          inventory_hash: z.string(),
          expected_count: z.int().positive()
        })
        .parse(
          (await source.query("SELECT * FROM legislation.legal_passage_preparations WHERE id=$1 FOR SHARE", [id]))
            .rows[0]
        )
      invariant((job.edition_id === null) !== (job.observation_id === null), "legal_copy_scope_mismatch")
      const scope = job.edition_id
        ? { kind: "edition" as const, id: job.edition_id }
        : { kind: "publication" as const, id: z.uuid().parse(job.observation_id) }
      await target.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
        `legal-scope:${scope.kind}:${scope.id}`
      ])
      await requireLegalPreparationRights(source, scope)
      const inventory = await readLegalPassageInventory(source, scope)
      const retained = await readLegalPassageInventory(source, scope, id)
      invariant(
        inventory.length === job.expected_count &&
          isDeepStrictEqual(inventory, retained) &&
          digest(JSON.stringify(inventory)) === job.inventory_hash,
        "legal_copy_inventory_mismatch"
      )
      let checked = 0
      let passages = 0
      while (checked < inventory.length) {
        checkDeadline()
        const items = await source.query(
          `SELECT i.ordinal,i.version_id,i.context,row_to_json(g) AS metadata
          FROM legislation.legal_passage_preparation_items i JOIN legislation.legal_passage_generations g ON g.id=i.generation_id
          WHERE i.preparation_id=$1 AND i.ordinal>$2 ORDER BY i.ordinal LIMIT 25 FOR SHARE OF i,g`,
          [id, inventory[checked - 1]?.ordinal ?? -1]
        )
        invariant(items.rows.length > 0, "legal_copy_incomplete_preparation")
        for (const raw of items.rows) {
          checkDeadline()
          const item = z
            .object({
              ordinal: z.int(),
              version_id: z.uuid(),
              context: z.string(),
              metadata: legalTransferGenerationSchema
            })
            .parse(raw)
          invariant(
            isDeepStrictEqual(
              { ordinal: item.ordinal, version_id: item.version_id, context: item.context.trim() },
              inventory[checked]
            ),
            "legal_copy_inventory_mismatch"
          )
          const metadata = item.metadata
          invariant(
            metadata.tokenizer_id === job.tokenizer_id &&
              metadata.context === item.context.trim() &&
              metadata.provision_version_id === (scope.kind === "edition" ? item.version_id : null) &&
              metadata.document_version_id === (scope.kind === "publication" ? item.version_id : null),
            "legal_copy_generation_mismatch"
          )
          const copied = await target.query(
            "SELECT metadata FROM legislation.legal_search_generations WHERE id=$1 FOR SHARE",
            [metadata.id]
          )
          invariant(
            copied.rows.length === 1 && isDeepStrictEqual(copied.rows[0].metadata, metadata),
            "legal_copy_missing_or_changed_generation"
          )
          invariant(
            (
              await target.query(
                `SELECT 1 FROM legislation.legal_search_memberships
            WHERE scope_kind=$1 AND scope_id=$2 AND generation_id=$3 FOR SHARE`,
                [scope.kind, scope.id, metadata.id]
              )
            ).rowCount === 1,
            "legal_copy_missing_membership"
          )
          const data: z.infer<typeof legalTransferRowSchema>["data"][] = []
          let bytes = 0
          while (true) {
            checkDeadline()
            const values = [metadata.id, data.length - 1]
            const canonical = z.array(legalTransferRowSchema).parse(
              (
                await source.query(
                  `SELECT id,ordinal,body,input_text,data FROM legislation.legal_passages
              WHERE generation_id=$1 AND ordinal>$2 ORDER BY ordinal LIMIT 100 FOR SHARE`,
                  values
                )
              ).rows
            )
            const projected = z.array(legalTransferRowSchema).parse(
              (
                await target.query(
                  `SELECT id,ordinal,body,input_text,data FROM legislation.legal_search_passages
              WHERE generation_id=$1 AND ordinal>$2 ORDER BY ordinal LIMIT 100 FOR SHARE`,
                  values
                )
              ).rows
            )
            invariant(isDeepStrictEqual(canonical, projected), "legal_copy_passage_mismatch")
            bytes += Buffer.byteLength(JSON.stringify(canonical))
            invariant(
              bytes <= 64 * 1024 * 1024 && data.length + canonical.length <= metadata.passage_count,
              "legal_copy_generation_limit"
            )
            for (const row of canonical) {
              invariant(
                row.ordinal === data.length &&
                  row.data.ordinal === row.ordinal &&
                  row.data.versionId === item.version_id &&
                  row.id === digest(JSON.stringify([metadata.id, row.ordinal])) &&
                  row.body === row.data.text &&
                  row.input_text === row.data.inputText &&
                  digest(row.input_text) === row.data.inputHash,
                "legal_copy_passage_mismatch"
              )
              data.push(row.data)
            }
            if (canonical.length < 100) {
              break
            }
          }
          invariant(
            data.length === metadata.passage_count && digest(JSON.stringify(data)) === metadata.manifest_hash,
            "legal_copy_manifest_mismatch"
          )
          passages += data.length
          checked++
        }
      }
      checkDeadline()
      const checkedAt = new Date().toISOString()
      if (acknowledge) {
        const updated =
          scope.kind === "edition"
            ? await source.query(
                "UPDATE legislation.legal_derived_outbox SET state='acknowledged' WHERE edition_id=$1 AND operation='lexical' RETURNING id",
                [scope.id]
              )
            : await source.query(
                "UPDATE legislation.regulatory_publication_outbox SET state='acknowledged' WHERE observation_id=$1 AND operation='lexical' RETURNING id",
                [scope.id]
              )
        invariant(updated.rowCount === 1, "legal_copy_outbox_missing")
        await target.query(
          `INSERT INTO legislation.legal_search_scopes(scope_kind,scope_id,preparation_id,inventory_hash,generation_count,passage_count)
          VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(scope_kind,scope_id) DO UPDATE SET preparation_id=EXCLUDED.preparation_id,
          inventory_hash=EXCLUDED.inventory_hash,generation_count=EXCLUDED.generation_count,passage_count=EXCLUDED.passage_count,verified_at=clock_timestamp()`,
          [scope.kind, scope.id, id, job.inventory_hash, checked, passages]
        )
      }
      await target.query("COMMIT")
      await source.query("COMMIT")
      return {
        preparationId: id,
        scope,
        copiedGenerations: checked,
        copiedPassages: passages,
        checkedAt,
        copyComplete: true,
        publicSearchReady: false,
        acknowledged: acknowledge
      }
    } catch (error) {
      await source.query("ROLLBACK")
      throw error
    } finally {
      source.release()
    }
  } catch (error) {
    await target.query("ROLLBACK")
    throw error
  } finally {
    target.release()
  }
}
