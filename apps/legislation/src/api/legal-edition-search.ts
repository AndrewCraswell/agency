import { isDeepStrictEqual } from "node:util"
import type pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"
import { getRequestContext } from "../auth/request-context.js"
import { digest } from "../ingestion/regulations/contracts.js"
import { requireLegalCopyReceiptRevisions } from "../ingestion/regulations/copy-receipt-revisions.js"
import { legalTransferGenerationSchema, legalTransferRowSchema } from "../ingestion/regulations/passage-replication.js"
import { requireRights } from "../ingestion/regulations/storage.js"
import { LegislationError } from "../legislation/errors.js"
import { readLegalSearchResultPage } from "./legal-search-results.js"

const hash = z.string().regex(/^[a-f0-9]{64}$/)
export const legalEditionSearchRequestSchema = z.strictObject({
  editionIds: z
    .array(z.uuid())
    .min(1)
    .max(100)
    .refine((ids) => new Set(ids).size === ids.length),
  query: z.string().trim().min(1).max(500),
  cursor: z
    .string()
    .regex(/^[A-Za-z0-9_-]+$/)
    .max(2048)
    .optional(),
  limit: z.int().min(1).max(100).default(20),
  requestBinding: hash.optional()
})
const editionSchema = z.object({
  id: z.uuid(),
  code_id: z.uuid(),
  source_id: z.enum(["ecfr", "govinfo-cfr"]),
  rights_profile_id: z.string(),
  currency_date: z.iso.date().nullable(),
  issue_date: z.iso.date().nullable(),
  code_name: z.string().min(1),
  observation_id: hash,
  source_url: z.url(),
  publisher: z.string().min(1),
  retrieved_at: z.iso.datetime(),
  published_at: z.iso.datetime(),
  attribution: z.string().nullable()
})
const registrationSchema = z.object({
  edition_id: z.uuid(),
  preparation_id: hash,
  inventory_hash: hash,
  expected_count: z.int().positive()
})
const summarySchema = z.object({
  scope_id: z.uuid(),
  generations: z.int().positive(),
  passages: z.int().nonnegative(),
  inventory: hash
})
const candidateSchema = legalTransferRowSchema.extend({
  edition_id: z.uuid(),
  generation_id: hash,
  metadata: legalTransferGenerationSchema,
  score: z.number().nonnegative()
})
const unavailable = () =>
  new LegislationError("dependency_unavailable", "Selected editions do not have a verified lexical search copy")

/** Application canary for edition-wide lexical retrieval. No public route, vector calls or implicit scope omission. */
export function createLegalEditionSearch(
  sourcePool: pg.Pool,
  targetPool: pg.Pool,
  allowedOrganizationIds: readonly string[]
) {
  const allowed = new Set(z.array(z.string().min(1).max(256)).max(1000).parse(allowedOrganizationIds))
  return async (value: unknown) => {
    const identity = getRequestContext()?.identity
    if (!identity?.userId) {
      throw new LegislationError("unauthorized", "Bearer token is absent or invalid")
    }
    if (!identity.organizationId || !allowed.has(identity.organizationId)) {
      throw new LegislationError("forbidden", "Access denied")
    }
    const input = legalEditionSearchRequestSchema.parse(value)
    invariant(sourcePool !== targetPool, "legal_search_requires_separate_database")
    const editionIds = [...input.editionIds].sort()
    const source = await sourcePool.connect()
    try {
      invariant(
        (await source.query("SELECT current_database() AS name")).rows[0]?.name !== "legislation_passage_search",
        "legal_search_wrong_source"
      )
      await source.query("BEGIN ISOLATION LEVEL REPEATABLE READ")
      await source.query("SET LOCAL lock_timeout='5s'")
      await source.query("SET LOCAL statement_timeout='15s'")
      const editions = z.array(editionSchema).parse(
        (
          await source.query(
            `SELECT e.id,e.code_id,e.source_id,e.rights_profile_id,
        e.currency_date::text,e.issue_date::text,c.name AS code_name,e.generation_id AS observation_id,
        g.unit->>'sourceUrl' AS source_url,s.publisher,r.policy->>'attribution' AS attribution,
        to_char(a.acquired_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS retrieved_at,
        to_char(e.published_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS published_at
        FROM legislation.legal_editions e JOIN legislation.legal_codes c ON c.id=e.code_id
        JOIN legislation.legal_import_generations g ON g.id=e.generation_id
        JOIN legislation.legal_artifacts a ON a.hash=g.artifact_hash
        JOIN legislation.legal_sources s ON s.id=e.source_id
        JOIN legislation.legal_rights_profiles r ON r.id=e.rights_profile_id
        WHERE e.id=ANY($1::uuid[]) AND e.jurisdiction_id='jurisdiction:us' AND e.source_id IN ('ecfr','govinfo-cfr')
          AND e.published_at IS NOT NULL ORDER BY e.id FOR SHARE OF e,c,g,a,s,r`,
            [editionIds]
          )
        ).rows
      )
      if (editions.length !== editionIds.length) {
        throw new LegislationError("not_found", "Selected published editions were not found")
      }
      const rights: Record<string, string> = {}
      for (const profile of [...new Set(editions.map((edition) => edition.rights_profile_id))].sort()) {
        await requireRights(source, profile, "apiMcp")
        await requireRights(source, profile, "displayText")
        await requireRights(source, profile, "localSearch")
        rights[profile] = hash.parse(
          (
            await source.query(
              "SELECT policy_hash FROM legislation.legal_rights_profiles WHERE id=$1 AND is_active FOR SHARE",
              [profile]
            )
          ).rows[0]?.policy_hash
        )
      }
      const registrations = z.array(registrationSchema).parse(
        (
          await source.query(
            `SELECT p.edition_id,p.id AS preparation_id,p.inventory_hash,p.expected_count
        FROM legislation.legal_passage_preparations p JOIN legislation.legal_derived_outbox o ON o.edition_id=p.edition_id AND o.operation='lexical'
        WHERE p.edition_id=ANY($1::uuid[]) AND p.state='prepared' AND p.lease_token IS NULL AND o.state='acknowledged'
        ORDER BY p.edition_id,p.id LIMIT 1001 FOR SHARE OF p,o`,
            [editionIds]
          )
        ).rows
      )
      // A selected target receipt chooses the preparation when multiple tokenizer preparations exist.
      if (registrations.length > 1000) {
        throw unavailable()
      }
      if (new Set(registrations.map((row) => row.edition_id)).size !== editionIds.length) {
        throw unavailable()
      }
      const target = await targetPool.connect()
      try {
        invariant(
          (await target.query("SELECT current_database() AS name")).rows[0]?.name === "legislation_passage_search",
          "legal_search_wrong_target"
        )
        await target.query("BEGIN ISOLATION LEVEL REPEATABLE READ")
        await target.query("SET LOCAL lock_timeout='5s'")
        await target.query("SET LOCAL statement_timeout='15s'")
        const receipts = z
          .array(
            z.object({
              scope_id: z.uuid(),
              preparation_id: hash,
              inventory_hash: hash,
              generation_count: z.int().positive(),
              passage_count: z.int().nonnegative()
            })
          )
          .parse(
            (
              await target.query(
                `SELECT scope_id,preparation_id,inventory_hash,generation_count,passage_count FROM legislation.legal_search_scopes
          WHERE scope_kind='edition' AND scope_id=ANY($1::uuid[]) ORDER BY scope_id FOR SHARE`,
                [editionIds]
              )
            ).rows
          )
        if (receipts.length !== editionIds.length) {
          throw unavailable()
        }
        for (const receipt of receipts) {
          if (
            !registrations.some(
              (row) =>
                row.edition_id === receipt.scope_id &&
                row.preparation_id === receipt.preparation_id &&
                row.inventory_hash === receipt.inventory_hash &&
                row.expected_count === receipt.generation_count
            )
          ) {
            throw unavailable()
          }
        }
        const revoked = await target.query(
          "SELECT 1 FROM legislation.legal_search_revocations WHERE scope_kind='edition' AND scope_id=ANY($1::uuid[]) LIMIT 1",
          [editionIds]
        )
        if (revoked.rows.length > 0) {
          throw unavailable()
        }
        // Compare sorted version/generation identities and counts in PostgreSQL, without transferring whole editions.
        const canonical = z.array(summarySchema).parse(
          (
            await source.query(
              `SELECT p.edition_id AS scope_id,
          count(*)::int AS generations,coalesce(sum(g.passage_count),0)::int AS passages,
          encode(sha256(convert_to(string_agg(i.version_id::text||':'||i.generation_id||':'||
            encode(sha256(convert_to((to_jsonb(g)-'created_at')::text,'UTF8')),'hex'),',' ORDER BY i.version_id,i.generation_id),'UTF8')),'hex') AS inventory
          FROM legislation.legal_passage_preparations p JOIN legislation.legal_passage_preparation_items i ON i.preparation_id=p.id
          JOIN legislation.legal_passage_generations g ON g.id=i.generation_id
          JOIN legislation.legal_edition_provisions m ON m.edition_id=p.edition_id AND m.version_id=i.version_id AND m.ordinal=i.ordinal
          WHERE p.id=ANY($1::text[]) AND g.provision_version_id=i.version_id AND g.context=btrim(i.context) AND g.tokenizer_id=p.tokenizer_id
          GROUP BY p.edition_id ORDER BY p.edition_id`,
              [receipts.map((row) => row.preparation_id)]
            )
          ).rows
        )
        const copied = z.array(summarySchema).parse(
          (
            await target.query(
              `SELECT m.scope_id,count(DISTINCT m.generation_id)::int AS generations,
          coalesce(sum((g.metadata->>'passage_count')::int),0)::int AS passages,
          encode(sha256(convert_to(string_agg((g.metadata->>'provision_version_id')||':'||m.generation_id||':'||
            encode(sha256(convert_to(g.metadata::text,'UTF8')),'hex'),',' ORDER BY g.metadata->>'provision_version_id',m.generation_id),'UTF8')),'hex') AS inventory
          FROM legislation.legal_search_memberships m JOIN legislation.legal_search_generations g ON g.id=m.generation_id
          WHERE m.scope_kind='edition' AND m.scope_id=ANY($1::uuid[]) GROUP BY m.scope_id ORDER BY m.scope_id`,
              [editionIds]
            )
          ).rows
        )
        if (
          !isDeepStrictEqual(canonical, copied) ||
          canonical.length !== receipts.length ||
          canonical.some(
            (row) =>
              !receipts.some(
                (receipt) =>
                  receipt.scope_id === row.scope_id &&
                  receipt.generation_count === row.generations &&
                  receipt.passage_count === row.passages
              )
          )
        ) {
          throw unavailable()
        }
        const counts = z.array(z.object({ scope_id: z.uuid(), passages: z.int().nonnegative() })).parse(
          (
            await target.query(
              `SELECT m.scope_id,count(p.id)::int AS passages FROM legislation.legal_search_memberships m
          LEFT JOIN legislation.legal_search_passages p ON p.generation_id=m.generation_id
          WHERE m.scope_kind='edition' AND m.scope_id=ANY($1::uuid[]) GROUP BY m.scope_id ORDER BY m.scope_id`,
              [editionIds]
            )
          ).rows
        )
        if (
          counts.length !== receipts.length ||
          counts.some(
            (row) =>
              !receipts.some((receipt) => receipt.scope_id === row.scope_id && receipt.passage_count === row.passages)
          )
        ) {
          throw unavailable()
        }
        const revisions = await requireLegalCopyReceiptRevisions(
          source,
          target,
          receipts.map((receipt) => ({
            kind: "edition",
            id: receipt.scope_id,
            preparationId: receipt.preparation_id,
            count: receipt.generation_count
          }))
        )
        const generation = digest(JSON.stringify([editions, receipts, canonical, rights, revisions]))
        const requestHash = digest(
          JSON.stringify([
            "legal-lexical-2026-09-15",
            identity.organizationId,
            identity.userId,
            editionIds,
            input.query,
            input.limit,
            input.requestBinding ?? null
          ])
        )
        const page = await readLegalSearchResultPage(target, {
          requestHash,
          generation,
          editionIds,
          query: input.query,
          limit: input.limit,
          ...(input.cursor === undefined ? {} : { cursor: input.cursor })
        })
        const selected = z.array(candidateSchema).parse(
          (
            await target.query(
              `SELECT m.scope_id AS edition_id,p.generation_id,p.id,p.ordinal,p.body,p.input_text,p.data,g.metadata,
                (f.value->>'score')::double precision AS score
              FROM jsonb_array_elements($1::jsonb) WITH ORDINALITY f(value,position)
              JOIN legislation.legal_search_passages p ON p.id=f.value->>'id' AND p.generation_id=f.value->>'generationId'
              JOIN legislation.legal_search_generations g ON g.id=p.generation_id AND g.metadata->>'provision_version_id'=f.value->>'versionId'
              JOIN legislation.legal_search_memberships m ON m.scope_kind='edition' AND m.scope_id=(f.value->>'editionId')::uuid AND m.generation_id=g.id
              ORDER BY f.position`,
              [JSON.stringify(page.candidates)]
            )
          ).rows
        )
        if (selected.length !== page.candidates.length) {
          throw unavailable()
        }
        const truncated = page.nextCursor !== null || page.candidateSetTruncated
        const originals = z
          .array(
            legalTransferRowSchema.extend({
              generation_id: hash,
              metadata: legalTransferGenerationSchema,
              edition_id: z.uuid(),
              provision_id: z.uuid(),
              native_id: z.string(),
              heading: z.string(),
              source_locator: z.string(),
              parent_id: z.uuid().nullable(),
              content_hash: hash
            })
          )
          .parse(
            (
              await source.query(
                `SELECT p.id,p.ordinal,p.body,p.input_text,p.data,p.generation_id,row_to_json(g) AS metadata,
            m.edition_id,m.provision_id,m.native_id,v.heading,m.source_locator,m.parent_id,v.content_hash
          FROM legislation.legal_passages p JOIN legislation.legal_passage_generations g ON g.id=p.generation_id
          JOIN legislation.legal_provision_versions v ON v.id=g.provision_version_id
          JOIN legislation.legal_edition_provisions m ON m.version_id=v.id
          WHERE p.id=ANY($1::text[]) AND m.edition_id=ANY($2::uuid[]) FOR SHARE OF p,g,v,m`,
                [selected.map((row) => row.id), editionIds]
              )
            ).rows
          )
        const hits = selected.map((candidate) => {
          const original = originals.find((row) => row.id === candidate.id && row.edition_id === candidate.edition_id)
          invariant(
            original &&
              isDeepStrictEqual(legalTransferRowSchema.parse(original), legalTransferRowSchema.parse(candidate)) &&
              isDeepStrictEqual(original.metadata, candidate.metadata) &&
              original.generation_id === candidate.generation_id &&
              candidate.metadata.provision_version_id === candidate.data.versionId &&
              digest(candidate.input_text) === candidate.data.inputHash &&
              candidate.id === digest(JSON.stringify([candidate.generation_id, candidate.ordinal])),
            "legal_search_candidate_mismatch"
          )
          const edition = editions.find((row) => row.id === candidate.edition_id)
          invariant(edition, "legal_search_scope_mismatch")
          const rightsPolicyHash = rights[edition.rights_profile_id]
          invariant(rightsPolicyHash, "legal_search_rights_missing")
          return {
            passageId: candidate.id,
            provisionId: original.provision_id,
            versionId: candidate.data.versionId,
            editionId: edition.id,
            codeId: edition.code_id,
            nativeId: original.native_id,
            heading: original.heading,
            sourceLocator: original.source_locator,
            sourceId: edition.source_id,
            sourceCurrencyDate: edition.currency_date,
            issueDate: edition.issue_date,
            rightsPolicyHash,
            codeName: edition.code_name,
            sourceObservationId: edition.observation_id,
            sourceUrl: edition.source_url,
            publisher: edition.publisher,
            attribution: edition.attribution,
            retrievedAt: edition.retrieved_at,
            updatedAt: edition.published_at,
            parentId: original.parent_id,
            versionHash: original.content_hash,
            textUrl: `/api/legal/versions/${candidate.data.versionId}/text?editionId=${edition.id}`,
            score: candidate.score,
            passage: candidate.data
          }
        })
        await target.query("COMMIT")
        await source.query("COMMIT")
        return {
          hits,
          truncated,
          nextCursor: page.nextCursor,
          candidateSetTruncated: page.candidateSetTruncated,
          selectedEditions: editionIds,
          mode: "lexical" as const,
          generation,
          warnings: [
            "Selected acknowledged editions only. Results use PostgreSQL full-text ranking; no semantic or historical completeness claim.",
            ...(page.candidateSetTruncated
              ? ["The ranked window is limited to 1,000 versions. Refine the query to find additional matches."]
              : [])
          ]
        }
      } catch (error) {
        await target.query("ROLLBACK")
        throw error
      } finally {
        target.release()
      }
    } catch (error) {
      await source.query("ROLLBACK")
      if (error instanceof Error && error.message === "Invariant failed: legal_search_scope_revision_changed") {
        throw unavailable()
      }
      if (
        error instanceof Error &&
        (error.message.startsWith("rights_denied:") || error.message === "Invariant failed: rights_profile_unavailable")
      ) {
        throw new LegislationError("forbidden", "Access denied", { cause: error })
      }
      throw error
    } finally {
      source.release()
    }
  }
}
