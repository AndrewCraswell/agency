import { digest } from "@repo/legislation-core/legal-text/contracts"
import { rightsPolicySchema } from "@repo/legislation-core/legal-text/storage-contract"
import type pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"

const scopeSchema = z.strictObject({ kind: z.enum(["edition", "publication"]), id: z.uuid() })
type Scope = z.infer<typeof scopeSchema>

/** Remove only derived regulatory copies. Search embeddings cascade with their copied passage generation. */
export async function reconcileLegalSearchScopeRights(sourcePool: pg.Pool, targetPool: pg.Pool, input: Scope) {
  const deadline = Date.now() + 30_000
  const scope = scopeSchema.parse(input)
  invariant(sourcePool !== targetPool, "legal_search_requires_separate_database")
  const target = await targetPool.connect()
  try {
    invariant(
      (await target.query("SELECT current_database() AS name")).rows[0]?.name === "legislation_passage_search",
      "legal_search_wrong_target"
    )
    await target.query("BEGIN")
    await target.query("SET LOCAL lock_timeout='5s'")
    await target.query("SET LOCAL statement_timeout='30s'")
    await target.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `legal-scope:${scope.kind}:${scope.id}`
    ])
    const source = await sourcePool.connect()
    try {
      invariant(
        (await source.query("SELECT current_database() AS name")).rows[0]?.name !== "legislation_passage_search",
        "legal_search_wrong_source"
      )
      await source.query("BEGIN")
      await source.query("SET LOCAL lock_timeout='5s'")
      await source.query("SET LOCAL statement_timeout='30s'")
      const parent =
        scope.kind === "edition"
          ? await source.query("SELECT rights_profile_id FROM legislation.legal_editions WHERE id=$1 FOR SHARE", [
              scope.id
            ])
          : await source.query(
              "SELECT rights_profile_id FROM legislation.regulatory_document_observations WHERE id=$1 FOR SHARE",
              [scope.id]
            )
      invariant(parent.rows.length === 1, "legal_rights_scope_missing")
      const record = z
        .object({ is_active: z.boolean(), policy: rightsPolicySchema, policy_hash: z.string() })
        .parse(
          (
            await source.query(
              "SELECT is_active,policy,policy_hash FROM legislation.legal_rights_profiles WHERE id=$1 FOR SHARE",
              [parent.rows[0].rights_profile_id]
            )
          ).rows[0]
        )
      invariant(digest(JSON.stringify(record.policy)) === record.policy_hash, "rights_profile_modified")
      const allowed = record.is_active && record.policy.displayText && record.policy.localSearch
      let removedMemberships = 0
      let removedGenerations = 0
      let remaining = 0
      if (!allowed) {
        await target.query(
          `INSERT INTO legislation.legal_search_revocations(scope_kind,scope_id) VALUES($1,$2)
          ON CONFLICT(scope_kind,scope_id) DO NOTHING`,
          [scope.kind, scope.id]
        )
        await target.query("DELETE FROM legislation.legal_search_scopes WHERE scope_kind=$1 AND scope_id=$2", [
          scope.kind,
          scope.id
        ])
        const memberships = await target.query(
          `SELECT generation_id FROM legislation.legal_search_memberships
          WHERE scope_kind=$1 AND scope_id=$2 ORDER BY generation_id LIMIT 25 FOR UPDATE`,
          [scope.kind, scope.id]
        )
        for (const item of memberships.rows) {
          invariant(Date.now() < deadline, "legal_rights_cleanup_deadline")
          const id = z.string().parse(item.generation_id)
          await target.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [id])
          await target.query(
            "DELETE FROM legislation.legal_search_memberships WHERE scope_kind=$1 AND scope_id=$2 AND generation_id=$3",
            [scope.kind, scope.id, id]
          )
          removedMemberships++
          if (
            (
              await target.query("SELECT 1 FROM legislation.legal_search_memberships WHERE generation_id=$1 LIMIT 1", [
                id
              ])
            ).rowCount === 0
          ) {
            await target.query("DELETE FROM legislation.legal_search_passages WHERE generation_id=$1", [id])
            removedGenerations +=
              (await target.query("DELETE FROM legislation.legal_search_generations WHERE id=$1", [id])).rowCount ?? 0
          }
        }
        remaining = (
          await target.query(
            "SELECT count(*)::integer AS n FROM legislation.legal_search_memberships WHERE scope_kind=$1 AND scope_id=$2",
            [scope.kind, scope.id]
          )
        ).rows[0].n
        // Restoration requires recopy/reverification; an earlier acknowledgement cannot authorize a removed copy.
        if (scope.kind === "edition") {
          await source.query(
            "UPDATE legislation.legal_derived_outbox SET state='pending',retry_at=clock_timestamp() WHERE edition_id=$1 AND operation='lexical'",
            [scope.id]
          )
        } else {
          await source.query(
            "UPDATE legislation.regulatory_publication_outbox SET state='pending',retry_at=clock_timestamp() WHERE observation_id=$1",
            [scope.id]
          )
        }
      }
      invariant(Date.now() < deadline, "legal_rights_cleanup_deadline")
      await target.query("COMMIT")
      await source.query("COMMIT")
      return { scope, allowed, removedMemberships, removedGenerations, remaining }
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

/** Bounded automatic discovery. Repeat returned cursor; restart at null for the next sweep. No schedules are enabled here. */
export async function reconcileLegalSearchRightsBatch(
  source: pg.Pool,
  target: pg.Pool,
  input: { cursor?: Scope | null } = {}
) {
  const deadline = Date.now() + 60_000
  const cursor = input.cursor ? scopeSchema.parse(input.cursor) : null
  invariant(
    (await target.query("SELECT current_database() AS name")).rows[0]?.name === "legislation_passage_search",
    "legal_search_wrong_target"
  )
  const rows = await target.query(
    `SELECT scope_kind AS kind,scope_id AS id FROM (
      SELECT scope_kind,scope_id FROM legislation.legal_search_memberships
      UNION SELECT scope_kind,scope_id FROM legislation.legal_search_revocations
    ) AS scopes
    WHERE $1::text IS NULL OR (scope_kind,scope_id)>($1::text,$2::uuid) ORDER BY scope_kind,scope_id LIMIT 25`,
    [cursor?.kind ?? null, cursor?.id ?? null]
  )
  const results = []
  let next = cursor
  for (const raw of rows.rows) {
    if (Date.now() >= deadline) {
      return { cursor: next, complete: false, results }
    }
    const scope = scopeSchema.parse(raw)
    const result = await reconcileLegalSearchScopeRights(source, target, scope)
    results.push(result)
    if (result.remaining > 0) {
      return { cursor: next, complete: false, results }
    }
    next = scope
  }
  return { cursor: next, complete: rows.rows.length < 25, results }
}
