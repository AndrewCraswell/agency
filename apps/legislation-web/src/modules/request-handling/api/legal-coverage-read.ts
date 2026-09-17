import { legalCoverageRequestSchema } from "@repo/legislation-core/api-client/legal-coverage-contract"
import { getRequestContext } from "@repo/legislation-core/auth/request-context"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import { digest } from "@repo/legislation-core/legal-text/contracts"
import { assertRights } from "@repo/legislation-core/legal-text/storage-contract"
import type pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"

const hash = z.string().regex(/^[a-f0-9]{64}$/)
const cursorSchema = z.strictObject({ scope: hash, after: z.uuid() })
const profileSchema = z.object({ id: z.string(), policy: z.unknown(), policy_hash: hash })
const catalogRowSchema = z.object({ id: z.uuid() })
const editionSchema = z.object({
  id: z.uuid(),
  code_id: z.uuid(),
  code_name: z.string().min(1),
  corpus: z.enum(["regulation", "statute"]),
  jurisdiction_id: z.string().min(1),
  source_id: z.enum(["ecfr", "govinfo-cfr"]),
  publisher: z.string().min(1),
  authority: z.enum(["official", "licensed"]),
  issue_date: z.iso.date().nullable(),
  currency_date: z.iso.date().nullable(),
  published_at: z.iso.datetime(),
  collected_at: z.iso.datetime(),
  is_current: z.boolean(),
  record_count: z.int().nonnegative()
})
const preparationSchema = z.object({ edition_id: z.uuid(), preparation_id: hash })
const receiptSchema = z.object({
  scope_id: z.uuid(),
  preparation_id: hash,
  generation_count: z.int().positive(),
  passage_count: z.int().nonnegative(),
  verified_at: z.iso.datetime(),
  revoked: z.boolean()
})
const embeddingSchema = z.object({
  scope_id: z.uuid(),
  model: z.string().min(1),
  dimensions: z.int().positive(),
  registered_generations: z.int().positive(),
  ready_generations: z.int().nonnegative(),
  ready_passages: z.int().nonnegative(),
  ready_at: z.iso.datetime().nullable()
})

const dateTime = (expression: string) => `to_char((${expression}) AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`
const available = { status: "available" as const, isStale: false, reason: null, requestedEditions: 1 as const }
const excluded = (status: "incomplete" | "not_ingested" | "unsupported", reason: string) => ({
  status,
  isStale: false,
  reason,
  requestedEditions: 1 as const,
  availableEditions: 0,
  excludedEditions: 1
})

/** Reports only rights-visible published editions and keeps each derivative stage independent. */
export function createLegalCoverageReader(
  sourcePool: pg.Pool,
  targetPool: pg.Pool | undefined,
  allowedOrganizationIds: readonly string[]
) {
  const allowed = new Set(z.array(z.string().min(1).max(256)).max(1000).parse(allowedOrganizationIds))
  return async (unparsed: unknown) => {
    const identity = getRequestContext()?.identity
    if (!identity?.userId) {
      throw new LegislationError("unauthorized", "Bearer token is absent or invalid")
    }
    if (!identity.organizationId || !allowed.has(identity.organizationId)) {
      throw new LegislationError("forbidden", "Access denied")
    }
    const input = legalCoverageRequestSchema.parse(unparsed)
    let cursor: z.infer<typeof cursorSchema> | undefined
    if (input.cursor !== undefined) {
      try {
        cursor = cursorSchema.parse(JSON.parse(Buffer.from(input.cursor, "base64url").toString("utf8")))
      } catch {
        throw new LegislationError("invalid_request", "Invalid coverage continuation")
      }
    }
    const source = await sourcePool.connect()
    try {
      await source.query("BEGIN ISOLATION LEVEL REPEATABLE READ")
      await source.query("SET LOCAL lock_timeout='5s'")
      await source.query("SET LOCAL statement_timeout='15s'")
      const profiles = await source.query(`SELECT r.id,r.policy,r.policy_hash
        FROM legislation.legal_rights_profiles r WHERE r.is_active AND EXISTS (
          SELECT 1 FROM legislation.legal_editions e WHERE e.rights_profile_id=r.id
          AND e.published_at IS NOT NULL AND e.jurisdiction_id='jurisdiction:us'
          AND e.source_id IN ('ecfr','govinfo-cfr')) ORDER BY r.id LIMIT 1001 FOR SHARE OF r`)
      invariant(profiles.rows.length <= 1000, "legal_coverage_rights_catalog_limit")
      const permitted: { id: string; hash: string }[] = []
      for (const raw of profiles.rows) {
        const profile = profileSchema.parse(raw)
        try {
          const policy = assertRights(profile.policy, "apiMcp")
          invariant(digest(JSON.stringify(policy)) === profile.policy_hash, "rights_profile_modified")
          permitted.push({ id: profile.id, hash: profile.policy_hash })
        } catch (error) {
          if (!(error instanceof Error) || !error.message.startsWith("rights_denied:")) {
            throw error
          }
        }
      }
      const filters = [
        permitted.map((profile) => profile.id),
        input.jurisdictionId ?? null,
        input.codeId ?? null,
        input.corpus ?? null,
        input.sourceId ?? null
      ]
      const where = `e.published_at IS NOT NULL AND e.rights_profile_id=ANY($1::text[])
        AND e.jurisdiction_id='jurisdiction:us' AND e.source_id IN ('ecfr','govinfo-cfr')
        AND ($2::text IS NULL OR e.jurisdiction_id=$2) AND ($3::uuid IS NULL OR e.code_id=$3)
        AND ($4::text IS NULL OR c.kind=$4) AND ($5::text IS NULL OR e.source_id=$5)`
      const catalog = z.array(catalogRowSchema).parse(
        (
          await source.query(
            `SELECT e.id FROM legislation.legal_editions e JOIN legislation.legal_codes c ON c.id=e.code_id
             WHERE ${where} ORDER BY e.id LIMIT 10001`,
            filters
          )
        ).rows
      )
      invariant(catalog.length <= 10000, "legal_coverage_catalog_limit")
      const scope = digest(
        JSON.stringify([
          "legal-coverage-2026-09-17",
          identity.organizationId,
          identity.userId,
          input.jurisdictionId ?? null,
          input.codeId ?? null,
          input.corpus ?? null,
          input.sourceId ?? null,
          input.limit,
          permitted,
          catalog
        ])
      )
      if (cursor !== undefined && cursor.scope !== scope) {
        throw new LegislationError("conflict", "Coverage continuation no longer matches the visible catalog")
      }
      const after = cursor === undefined ? -1 : catalog.findIndex((row) => row.id === cursor.after)
      if (cursor !== undefined && after === -1) {
        throw new LegislationError("invalid_request", "Invalid coverage continuation")
      }
      const selectedIds = catalog.slice(after + 1, after + 1 + input.limit).map((row) => row.id)
      const editions = z.array(editionSchema).parse(
        selectedIds.length === 0
          ? []
          : (
              await source.query(
                `SELECT e.id,e.code_id,c.name AS code_name,c.kind AS corpus,e.jurisdiction_id,e.source_id,
                   s.publisher,s.authority,e.issue_date::text,e.currency_date::text,
                   ${dateTime("e.published_at")} AS published_at,${dateTime("g.created_at")} AS collected_at,
                   EXISTS(SELECT 1 FROM legislation.legal_code_heads h WHERE h.edition_id=e.id) AS is_current,
                   count(m.provision_id)::integer AS record_count
                 FROM legislation.legal_editions e JOIN legislation.legal_codes c ON c.id=e.code_id
                 JOIN legislation.legal_sources s ON s.id=e.source_id
                 JOIN legislation.legal_import_generations g ON g.id=e.generation_id
                 LEFT JOIN legislation.legal_edition_provisions m ON m.edition_id=e.id
                 WHERE ${where} AND e.id=ANY($6::uuid[])
                 GROUP BY e.id,e.code_id,c.name,c.kind,e.jurisdiction_id,e.source_id,s.publisher,s.authority,
                   e.issue_date,e.currency_date,e.published_at,g.created_at ORDER BY e.id`,
                [...filters, selectedIds]
              )
            ).rows
      )
      invariant(editions.length === selectedIds.length, "legal_coverage_catalog_changed")
      const preparations = z.array(preparationSchema).parse(
        selectedIds.length === 0
          ? []
          : (
              await source.query(
                `SELECT p.edition_id,p.id AS preparation_id FROM legislation.legal_passage_preparations p
                 JOIN legislation.legal_derived_outbox o ON o.edition_id=p.edition_id AND o.operation='lexical'
                 WHERE p.edition_id=ANY($1::uuid[]) AND p.state='prepared' AND p.lease_token IS NULL
                   AND o.state='acknowledged' ORDER BY p.edition_id,p.id LIMIT 10001 FOR SHARE OF p,o`,
                [selectedIds]
              )
            ).rows
      )
      invariant(preparations.length <= 10000, "legal_coverage_preparation_limit")
      await source.query("COMMIT")

      let receipts: z.infer<typeof receiptSchema>[] = []
      let embeddings: z.infer<typeof embeddingSchema>[] = []
      if (targetPool !== undefined && selectedIds.length > 0) {
        invariant(sourcePool !== targetPool, "legal_coverage_requires_separate_database")
        const target = await targetPool.connect()
        try {
          await target.query("BEGIN ISOLATION LEVEL REPEATABLE READ")
          await target.query("SET LOCAL lock_timeout='5s'")
          await target.query("SET LOCAL statement_timeout='15s'")
          receipts = z.array(receiptSchema).parse(
            (
              await target.query(
                `SELECT s.scope_id,s.preparation_id,s.generation_count,s.passage_count,
                   ${dateTime("s.verified_at")} AS verified_at,
                   EXISTS(SELECT 1 FROM legislation.legal_search_revocations r
                     WHERE r.scope_kind='edition' AND r.scope_id=s.scope_id) AS revoked
                 FROM legislation.legal_search_scopes s WHERE s.scope_kind='edition'
                   AND s.scope_id=ANY($1::uuid[]) ORDER BY s.scope_id FOR SHARE OF s`,
                [selectedIds]
              )
            ).rows
          )
          embeddings = z.array(embeddingSchema).parse(
            (
              await target.query(
                `SELECT m.scope_id,e.model,e.dimensions,
                   count(DISTINCT e.passage_generation_id)::integer AS registered_generations,
                   count(DISTINCT e.passage_generation_id) FILTER (WHERE e.state='ready')::integer AS ready_generations,
                   coalesce(sum(e.expected_count) FILTER (WHERE e.state='ready'),0)::integer AS ready_passages,
                   ${dateTime("max(e.ready_at) FILTER (WHERE e.state='ready')")} AS ready_at
                 FROM legislation.legal_search_memberships m JOIN legislation.legal_embedding_generations e
                   ON e.passage_generation_id=m.generation_id
                 WHERE m.scope_kind='edition' AND m.scope_id=ANY($1::uuid[])
                 GROUP BY m.scope_id,e.model,e.dimensions ORDER BY m.scope_id,e.model`,
                [selectedIds]
              )
            ).rows
          )
          await target.query("COMMIT")
        } catch (error) {
          await target.query("ROLLBACK")
          throw error
        } finally {
          target.release()
        }
      }
      const items = editions.map((edition) => {
        const receipt = receipts.find((row) => row.scope_id === edition.id)
        const prepared = new Set(
          preparations.filter((row) => row.edition_id === edition.id).map((row) => row.preparation_id)
        )
        const lexicalReady = receipt !== undefined && !receipt.revoked && prepared.has(receipt.preparation_id)
        let lexical
        if (targetPool === undefined) {
          lexical = { ...excluded("unsupported", "search_service_disabled"), passageCount: 0, verifiedAt: null }
        } else if (lexicalReady) {
          lexical = {
            ...available,
            availableEditions: 1,
            excludedEditions: 0,
            passageCount: receipt.passage_count,
            verifiedAt: receipt.verified_at
          }
        } else {
          let reason = "lexical_copy_receipt_mismatch"
          if (receipt === undefined) {
            reason = "lexical_copy_not_ingested"
          } else if (receipt.revoked) {
            reason = "lexical_copy_revoked"
          }
          lexical = {
            ...excluded(receipt === undefined ? "not_ingested" : "incomplete", reason),
            passageCount: receipt?.passage_count ?? 0,
            verifiedAt: receipt?.verified_at ?? null
          }
        }
        const semanticCandidates = embeddings.filter((row) => row.scope_id === edition.id)
        const semanticReady = semanticCandidates.find(
          (row) =>
            lexicalReady &&
            receipt !== undefined &&
            row.ready_generations === receipt.generation_count &&
            row.ready_passages === receipt.passage_count
        )
        let semantic
        if (targetPool === undefined) {
          semantic = {
            ...excluded("unsupported", "search_service_disabled"),
            dimensions: null,
            model: null,
            passageCount: 0,
            readyAt: null
          }
        } else if (semanticReady !== undefined) {
          semantic = {
            ...available,
            availableEditions: 1,
            excludedEditions: 0,
            dimensions: semanticReady.dimensions,
            model: semanticReady.model,
            passageCount: semanticReady.ready_passages,
            readyAt: semanticReady.ready_at
          }
        } else {
          let reason = "semantic_vectors_incomplete"
          if (!lexicalReady) {
            reason = "lexical_copy_not_available"
          } else if (semanticCandidates.length === 0) {
            reason = "semantic_vectors_not_ingested"
          }
          semantic = {
            ...excluded(semanticCandidates.length === 0 ? "not_ingested" : "incomplete", reason),
            dimensions: semanticCandidates[0]?.dimensions ?? null,
            model: semanticCandidates[0]?.model ?? null,
            passageCount: Math.max(0, ...semanticCandidates.map((row) => row.ready_passages)),
            readyAt: null
          }
        }
        return {
          id: edition.id,
          jurisdictionId: edition.jurisdiction_id,
          code: { id: edition.code_id, name: edition.code_name },
          corpus: edition.corpus,
          source: { id: edition.source_id, publisher: edition.publisher, authority: edition.authority },
          edition: {
            id: edition.id,
            issueDate: edition.issue_date,
            sourceCurrencyDate: edition.currency_date,
            publishedAt: edition.published_at,
            isCurrent: edition.is_current
          },
          stages: {
            sourceCollection: {
              ...available,
              availableEditions: 1,
              excludedEditions: 0,
              lastAttemptAt: edition.collected_at,
              lastSuccessAt: edition.published_at
            },
            canonical: {
              ...available,
              availableEditions: 1,
              excludedEditions: 0,
              recordCount: edition.record_count
            },
            lexical,
            semantic
          }
        }
      })
      const truncated = after + 1 + items.length < catalog.length
      const last = items.at(-1)
      return {
        items,
        truncated,
        ...(truncated && last
          ? { nextCursor: Buffer.from(JSON.stringify({ scope, after: last.id })).toString("base64url") }
          : {}),
        warnings: [
          "Coverage reports rights-visible published editions. Excluded counts describe unavailable processing stages, not hidden editions."
        ]
      }
    } catch (error) {
      await source.query("ROLLBACK")
      throw error
    } finally {
      source.release()
    }
  }
}
