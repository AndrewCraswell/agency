import { isDeepStrictEqual } from "node:util"
import { digest } from "@repo/legislation-core/legal-text/contracts"
import {
  legalTransferGenerationSchema,
  legalTransferRowSchema
} from "@repo/legislation-core/legal-text/passage-contract"
import type pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"
import { readCopyValidationInventory } from "./copy-validation-inventory.js"
import { readLegalPassageInventory, requireLegalPreparationRights } from "./passage-preparation.js"

/** Read-only application operation. Holds row locks, but never acknowledges jobs or authorizes public search. */
export async function inspectLegalPassageCopy(sourcePool: pg.Pool, targetPool: pg.Pool, preparationId: string) {
  return checkLegalPassageCopy(sourcePool, targetPool, preparationId, false)
}

/** Verify the entire copy, commit its target receipt, then acknowledge only the matching canonical lexical job. */
export async function acknowledgeLegalPassageCopy(sourcePool: pg.Pool, targetPool: pg.Pool, preparationId: string) {
  return checkLegalPassageCopy(sourcePool, targetPool, preparationId, true)
}

/** Finalize previously verified pages without rereading passage bodies. All generations must still match. */
export async function finalizeLegalPassageCopy(sourcePool: pg.Pool, targetPool: pg.Pool, preparationId: string) {
  return checkLegalPassageCopy(sourcePool, targetPool, preparationId, true, undefined, true)
}

export const legalCopyValidationPageSchema = z.strictObject({
  preparationId: z.string().regex(/^[a-f0-9]{64}$/),
  afterOrdinal: z.int().min(-1).default(-1),
  limit: z.int().min(1).max(25).default(10)
})

/** Persist a bounded verification page. Neither exhaustion nor saved checkpoints authorizes serving. */
export async function verifyLegalPassageCopyPage(source: pg.Pool, target: pg.Pool, value: unknown) {
  const input = legalCopyValidationPageSchema.parse(value)
  return checkLegalPassageCopy(source, target, input.preparationId, false, input)
}

async function checkLegalPassageCopy(
  sourcePool: pg.Pool,
  targetPool: pg.Pool,
  preparationId: string,
  acknowledge: boolean,
  page?: z.output<typeof legalCopyValidationPageSchema>,
  useCheckpoints = false
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
      const selection =
        page === undefined
          ? undefined
          : await readCopyValidationInventory(source, scope, id, page.afterOrdinal, page.limit)
      const inventory = selection?.inventory ?? (await readLegalPassageInventory(source, scope))
      if (page === undefined) {
        const retained = await readLegalPassageInventory(source, scope, id)
        invariant(
          inventory.length === job.expected_count &&
            isDeepStrictEqual(inventory, retained) &&
            digest(JSON.stringify(inventory)) === job.inventory_hash,
          "legal_copy_inventory_mismatch"
        )
      }
      const membershipCount = z
        .object({ count: z.int().nonnegative() })
        .parse(
          (
            await target.query(
              "SELECT count(*)::integer AS count FROM legislation.legal_search_memberships WHERE scope_kind=$1 AND scope_id=$2",
              [scope.kind, scope.id]
            )
          ).rows[0]
        )
      // Expected-row verification alone cannot detect extra generations left attached to this scope.
      invariant(membershipCount.count === job.expected_count, "legal_copy_membership_count_mismatch")
      if (useCheckpoints) {
        const count = await target.query(
          "SELECT count(*)::integer AS count FROM legislation.legal_copy_validation_items WHERE preparation_id=$1",
          [id]
        )
        invariant(count.rows[0]?.count === job.expected_count, "legal_copy_checkpoints_incomplete")
      }
      let checked = 0
      let passages = 0
      while (checked < inventory.length) {
        checkDeadline()
        const items = await source.query(
          `SELECT i.ordinal,i.version_id,i.context,row_to_json(g) AS metadata,
          encode(sha256(convert_to(v.body,'UTF8')),'hex') AS current_body_hash,
          legislation.legal_passage_source_hash(v.body,v.heading,v.blocks,v.input_contract) AS current_source_hash,
          provenance.source_hash AS prepared_source_hash
          FROM legislation.legal_passage_preparation_items i JOIN legislation.legal_passage_generations g ON g.id=i.generation_id
          JOIN legislation.${scope.kind === "edition" ? "legal_provision_versions" : "regulatory_document_versions"} v ON v.id=i.version_id
          LEFT JOIN legislation.legal_passage_source_provenance provenance ON provenance.generation_id=g.id
          WHERE i.preparation_id=$1 AND i.ordinal>$2 ORDER BY i.ordinal LIMIT $3 FOR SHARE OF i,g`,
          [id, inventory[checked - 1]?.ordinal ?? page?.afterOrdinal ?? -1, Math.min(25, inventory.length - checked)]
        )
        invariant(items.rows.length > 0, "legal_copy_incomplete_preparation")
        const batch = z
          .array(
            z.object({
              ordinal: z.int(),
              version_id: z.uuid(),
              context: z.string(),
              current_body_hash: z.string().regex(/^[a-f0-9]{64}$/),
              current_source_hash: z.string().regex(/^[a-f0-9]{64}$/),
              prepared_source_hash: z
                .string()
                .regex(/^[a-f0-9]{64}$/)
                .nullable(),
              metadata: legalTransferGenerationSchema
            })
          )
          .parse(items.rows)
        const generationIds = batch.map((item) => item.metadata.id)
        const copied = await target.query(
          "SELECT id,metadata FROM legislation.legal_search_generations WHERE id=ANY($1::text[]) FOR SHARE",
          [generationIds]
        )
        const copiedById = new Map(
          z
            .array(z.object({ id: z.string(), metadata: z.unknown() }))
            .parse(copied.rows)
            .map((row) => [row.id, row.metadata])
        )
        const memberships = await target.query(
          `SELECT generation_id FROM legislation.legal_search_memberships
          WHERE scope_kind=$1 AND scope_id=$2 AND generation_id=ANY($3::text[]) FOR SHARE`,
          [scope.kind, scope.id, generationIds]
        )
        const memberIds = new Set(
          z
            .array(z.object({ generation_id: z.string() }))
            .parse(memberships.rows)
            .map((row) => row.generation_id)
        )
        const checkpoints = useCheckpoints ? await readCopyCheckpoints(source, target, id, generationIds) : undefined
        for (const item of batch) {
          checkDeadline()
          invariant(
            isDeepStrictEqual(
              { ordinal: item.ordinal, version_id: item.version_id, context: item.context.trim() },
              inventory[checked]
            ),
            "legal_copy_inventory_mismatch"
          )
          const metadata = item.metadata
          invariant(metadata.body_hash === item.current_body_hash, "legal_copy_source_body_changed")
          invariant(item.prepared_source_hash === item.current_source_hash, "legal_copy_source_provenance_changed")
          invariant(
            metadata.tokenizer_id === job.tokenizer_id &&
              metadata.context === item.context.trim() &&
              metadata.provision_version_id === (scope.kind === "edition" ? item.version_id : null) &&
              metadata.document_version_id === (scope.kind === "publication" ? item.version_id : null),
            "legal_copy_generation_mismatch"
          )
          invariant(
            copiedById.has(metadata.id) && isDeepStrictEqual(copiedById.get(metadata.id), metadata),
            "legal_copy_missing_or_changed_generation"
          )
          invariant(memberIds.has(metadata.id), "legal_copy_missing_membership")
          if (useCheckpoints) {
            const checkpoint = checkpoints?.get(metadata.id)
            invariant(
              checkpoint !== undefined &&
                checkpoint.ordinal === item.ordinal &&
                checkpoint.scope_kind === scope.kind &&
                checkpoint.scope_id === scope.id &&
                checkpoint.inventory_hash === job.inventory_hash &&
                checkpoint.metadata_hash === digest(JSON.stringify(metadata)) &&
                checkpoint.passage_count === metadata.passage_count,
              "legal_copy_checkpoint_mismatch"
            )
            passages += checkpoint.passage_count
            checked++
            continue
          }
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
          if (page !== undefined || acknowledge) {
            const revision = async (client: pg.PoolClient) => {
              const rows = await client.query(
                "SELECT revision::text FROM legislation.legal_copy_revisions WHERE generation_id=$1 FOR SHARE",
                [metadata.id]
              )
              return rows.rows.length === 0
                ? "0"
                : z
                    .string()
                    .regex(/^[1-9][0-9]*$/)
                    .parse(rows.rows[0]?.revision)
            }
            const sourceRevision = await revision(source)
            const targetRevision = await revision(target)
            await target.query(
              `INSERT INTO legislation.legal_copy_validation_items
              (preparation_id,ordinal,scope_kind,scope_id,inventory_hash,generation_id,metadata_hash,source_revision,target_revision,passage_count)
              VALUES($1,$2,$3,$4,$5,$6,$7,$8::bigint,$9::bigint,$10)
              ON CONFLICT(preparation_id,ordinal) DO UPDATE SET scope_kind=EXCLUDED.scope_kind,scope_id=EXCLUDED.scope_id,
              inventory_hash=EXCLUDED.inventory_hash,generation_id=EXCLUDED.generation_id,metadata_hash=EXCLUDED.metadata_hash,
              source_revision=EXCLUDED.source_revision,target_revision=EXCLUDED.target_revision,passage_count=EXCLUDED.passage_count,
              verified_at=clock_timestamp()`,
              [
                id,
                item.ordinal,
                scope.kind,
                scope.id,
                job.inventory_hash,
                metadata.id,
                digest(JSON.stringify(metadata)),
                sourceRevision,
                targetRevision,
                data.length
              ]
            )
          }
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
        await target.query("DELETE FROM legislation.legal_search_scope_revisions WHERE scope_kind=$1 AND scope_id=$2", [
          scope.kind,
          scope.id
        ])
        const revisions = await target.query(
          `INSERT INTO legislation.legal_search_scope_revisions(scope_kind,scope_id,generation_id,source_revision,target_revision)
          SELECT scope_kind,scope_id,generation_id,source_revision,target_revision
          FROM legislation.legal_copy_validation_items
          WHERE preparation_id=$1 AND scope_kind=$2 AND scope_id=$3 AND inventory_hash=$4`,
          [id, scope.kind, scope.id, job.inventory_hash]
        )
        invariant(revisions.rowCount === checked, "legal_copy_checkpoints_incomplete")
      }
      await target.query("COMMIT")
      await source.query("COMMIT")
      return {
        preparationId: id,
        scope,
        copiedGenerations: checked,
        copiedPassages: passages,
        checkedAt,
        copyComplete: page === undefined,
        ...(page === undefined
          ? {}
          : {
              afterOrdinal: inventory.at(-1)?.ordinal ?? page.afterOrdinal,
              exhausted: selection?.exhausted ?? false,
              checkpointsWritten: checked
            }),
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

async function readCopyCheckpoints(source: pg.PoolClient, target: pg.PoolClient, id: string, generations: string[]) {
  const revisionSchema = z.object({ generation_id: z.string(), revision: z.string().regex(/^[1-9][0-9]*$/) })
  const readRevisions = async (client: pg.PoolClient) => {
    const result = await client.query(
      `SELECT generation_id,revision::text FROM legislation.legal_copy_revisions
      WHERE generation_id=ANY($1::text[]) ORDER BY generation_id FOR SHARE`,
      [generations]
    )
    const rows = z.array(revisionSchema).parse(result.rows)
    // A missing row cannot be locked against a concurrent first insert. Finalization requires durable counters.
    invariant(rows.length === generations.length, "legal_copy_revision_missing")
    return new Map(rows.map((row) => [row.generation_id, row.revision]))
  }
  const sourceRevisions = await readRevisions(source)
  const targetRevisions = await readRevisions(target)
  const result = await target.query(
    `SELECT ordinal,scope_kind,scope_id,inventory_hash,generation_id,metadata_hash,
    source_revision::text,target_revision::text,passage_count FROM legislation.legal_copy_validation_items
    WHERE preparation_id=$1 AND generation_id=ANY($2::text[]) ORDER BY ordinal FOR SHARE`,
    [id, generations]
  )
  const rows = z
    .array(
      z.object({
        ordinal: z.int().nonnegative(),
        scope_kind: z.enum(["edition", "publication"]),
        scope_id: z.uuid(),
        inventory_hash: z.string(),
        generation_id: z.string(),
        metadata_hash: z.string(),
        source_revision: z.string(),
        target_revision: z.string(),
        passage_count: z.int().nonnegative()
      })
    )
    .parse(result.rows)
  invariant(rows.length === generations.length, "legal_copy_checkpoints_incomplete")
  for (const row of rows) {
    invariant(
      sourceRevisions.get(row.generation_id) === row.source_revision &&
        targetRevisions.get(row.generation_id) === row.target_revision,
      "legal_copy_checkpoint_stale"
    )
  }
  const checkpoints = new Map(rows.map((row) => [row.generation_id, row]))
  invariant(checkpoints.size === generations.length, "legal_copy_checkpoint_mismatch")
  return checkpoints
}
