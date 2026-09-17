import { isDeepStrictEqual } from "node:util"
import { getRequestContext } from "@repo/legislation-core/auth/request-context"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import { digest } from "@repo/legislation-core/legal-text/contracts"
import { requireLegalCopyReceiptRevisions } from "@repo/legislation-core/legal-text/copy-receipt-revisions"
import {
  legalTransferGenerationSchema,
  legalTransferRowSchema
} from "@repo/legislation-core/legal-text/passage-contract"
import { requireRights } from "@repo/legislation-core/legal-text/rights"
import { isLegalSearchDatabaseName } from "@repo/legislation-core/legal-text/search-database-role"
import type pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"

const hash = z.string().regex(/^[a-f0-9]{64}$/)
const publicationKind = z.enum(["proposed_rule", "final_rule", "notice", "other"])
const requestSchema = z.strictObject({
  query: z.string().trim().min(1).max(500),
  publicationKinds: z.array(publicationKind).min(1).max(4).optional(),
  publishedFrom: z.iso.date().optional(),
  publishedTo: z.iso.date().optional(),
  limit: z.int().min(1).max(100),
  cursor: z.string().optional(),
  requestBinding: hash.optional()
})
const publicationSchema = z.object({
  observation_id: z.uuid(),
  document_id: z.uuid(),
  version_id: z.uuid(),
  source_id: z.literal("govinfo-fr"),
  rights_profile_id: z.string(),
  publication_kind: publicationKind,
  published_on: z.iso.date(),
  effective_on: z.iso.date().nullable(),
  heading: z.string().min(1),
  citation: z.string().min(1),
  source_locator: z.string().min(1),
  source_url: z.url(),
  publisher: z.string().min(1),
  attribution: z.string().nullable(),
  retrieved_at: z.iso.datetime(),
  updated_at: z.iso.datetime(),
  version_hash: hash
})
const registrationSchema = z.object({
  observation_id: z.uuid(),
  preparation_id: hash,
  inventory_hash: hash,
  expected_count: z.literal(1)
})
const receiptSchema = z.object({
  scope_id: z.uuid(),
  preparation_id: hash,
  inventory_hash: hash,
  generation_count: z.literal(1),
  passage_count: z.int().positive()
})
const candidateSchema = legalTransferRowSchema.extend({
  scope_id: z.uuid(),
  generation_id: hash,
  metadata: legalTransferGenerationSchema,
  score: z.number().nonnegative()
})
const unavailable = () =>
  new LegislationError("dependency_unavailable", "Selected publications do not have a verified lexical search copy")

export function createLegalPublicationSearch(
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
    const input = requestSchema.parse(value)
    if (input.cursor !== undefined) {
      throw new LegislationError("conflict", "Search continuation expired or no longer matches the request")
    }
    invariant(sourcePool !== targetPool, "legal_search_requires_separate_database")
    const source = await sourcePool.connect()
    try {
      invariant(
        !isLegalSearchDatabaseName((await source.query("select current_database() as name")).rows[0]?.name),
        "legal_search_wrong_source"
      )
      await source.query("begin isolation level repeatable read")
      await source.query("set local lock_timeout='5s'")
      await source.query("set local statement_timeout='15s'")
      const publications = z.array(publicationSchema).parse(
        (
          await source.query(
            `select o.id as observation_id,o.document_id,o.version_id,o.source_id,o.rights_profile_id,
              v.publication_kind,o.publication_date::text as published_on,
              nullif(o.metadata->>'effective_on','') as effective_on,v.heading,
              coalesce(nullif(o.metadata->>'citation',''),d.native_number) as citation,o.source_locator,
              coalesce(nullif(o.metadata->>'html_url',''),g.unit->>'sourceUrl') as source_url,s.publisher,
              r.policy->>'attribution' as attribution,
              to_char(a.acquired_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as retrieved_at,
              to_char(b.published_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as updated_at,
              v.content_hash as version_hash
            from legislation.regulatory_document_observations o
            join legislation.regulatory_document_versions v on v.id=o.version_id
            join legislation.regulatory_documents d on d.id=o.document_id
            join legislation.regulatory_publication_batches b on b.generation_id=o.generation_id
            join legislation.legal_import_generations g on g.id=o.generation_id
            join legislation.regulatory_publication_outbox x on x.observation_id=o.id and x.state='acknowledged'
            join legislation.legal_sources s on s.id=o.source_id
            join legislation.legal_rights_profiles r on r.id=o.rights_profile_id and r.is_active
            join legislation.legal_artifacts a on a.hash=v.pdf_hash
            where o.jurisdiction_id='jurisdiction:us' and o.source_id='govinfo-fr'
              and ($1::text[] is null or v.publication_kind=any($1::text[]))
              and ($2::date is null or o.publication_date >= $2::date)
              and ($3::date is null or o.publication_date <= $3::date)
            order by o.publication_date desc,o.id limit 101 for share of o,v,d,b,g,x,s,r,a`,
            [input.publicationKinds ?? null, input.publishedFrom ?? null, input.publishedTo ?? null]
          )
        ).rows
      )
      if (publications.length === 0) {
        throw new LegislationError("not_found", "Published documents were not found")
      }
      if (publications.length > 100) {
        throw unavailable()
      }
      const scopeIds = publications.map((row) => row.observation_id)
      const rights: Record<string, string> = {}
      for (const profile of [...new Set(publications.map((row) => row.rights_profile_id))].sort()) {
        await requireRights(source, profile, "apiMcp")
        await requireRights(source, profile, "displayText")
        await requireRights(source, profile, "localSearch")
        rights[profile] = hash.parse(
          (
            await source.query(
              "select policy_hash from legislation.legal_rights_profiles where id=$1 and is_active for share",
              [profile]
            )
          ).rows[0]?.policy_hash
        )
      }
      const registrations = z.array(registrationSchema).parse(
        (
          await source.query(
            `select p.observation_id,p.id as preparation_id,p.inventory_hash,p.expected_count
             from legislation.legal_passage_preparations p
             join legislation.regulatory_publication_outbox x on x.observation_id=p.observation_id
               and x.operation='lexical' and x.state='acknowledged'
             where p.observation_id=any($1::uuid[]) and p.state='prepared' and p.lease_token is null
             order by p.observation_id,p.id for share of p,x`,
            [scopeIds]
          )
        ).rows
      )
      const target = await targetPool.connect()
      try {
        invariant(
          isLegalSearchDatabaseName((await target.query("select current_database() as name")).rows[0]?.name),
          "legal_search_wrong_target"
        )
        await target.query("begin isolation level repeatable read")
        await target.query("set local lock_timeout='5s'")
        await target.query("set local statement_timeout='15s'")
        const receipts = z.array(receiptSchema).parse(
          (
            await target.query(
              `select scope_id,preparation_id,inventory_hash,generation_count,passage_count
               from legislation.legal_search_scopes where scope_kind='publication' and scope_id=any($1::uuid[])
               order by scope_id for share`,
              [scopeIds]
            )
          ).rows
        )
        if (
          receipts.length !== scopeIds.length ||
          receipts.some(
            (receipt) =>
              !registrations.some(
                (row) =>
                  row.observation_id === receipt.scope_id &&
                  row.preparation_id === receipt.preparation_id &&
                  row.inventory_hash === receipt.inventory_hash
              )
          )
        ) {
          throw unavailable()
        }
        if (
          (
            await target.query(
              "select 1 from legislation.legal_search_revocations where scope_kind='publication' and scope_id=any($1::uuid[]) limit 1",
              [scopeIds]
            )
          ).rows.length > 0
        ) {
          throw unavailable()
        }
        const revisions = await requireLegalCopyReceiptRevisions(
          source,
          target,
          receipts.map((row) => ({
            kind: "publication",
            id: row.scope_id,
            preparationId: row.preparation_id,
            count: 1
          }))
        )
        const generation = digest(JSON.stringify([publications, receipts, rights, revisions]))
        const candidates = z.array(candidateSchema).parse(
          (
            await target.query(
              `with ranked as (
                select m.scope_id,p.generation_id,p.id,p.ordinal,p.body,p.input_text,p.data,g.metadata,
                  ts_rank_cd(p.search_vector,q.query) as score,
                  row_number() over (partition by g.metadata->>'document_version_id'
                    order by ts_rank_cd(p.search_vector,q.query) desc,m.scope_id,p.id) as position
                from legislation.legal_search_memberships m
                join legislation.legal_search_generations g on g.id=m.generation_id
                join legislation.legal_search_passages p on p.generation_id=g.id
                cross join websearch_to_tsquery('english',$2) q(query)
                where m.scope_kind='publication' and m.scope_id=any($1::uuid[]) and p.search_vector @@ q.query)
               select scope_id,generation_id,id,ordinal,body,input_text,data,metadata,score
               from ranked where position=1 order by score desc,id,scope_id limit $3`,
              [scopeIds, input.query, input.limit + 1]
            )
          ).rows
        )
        const candidateSetTruncated = candidates.length > input.limit
        const selected = candidates.slice(0, input.limit)
        const originals = z
          .array(
            candidateSchema.omit({ score: true, scope_id: true }).extend({
              observation_id: z.uuid(),
              document_id: z.uuid(),
              heading: z.string(),
              content_hash: hash
            })
          )
          .parse(
            (
              await source.query(
                `select p.id,p.ordinal,p.body,p.input_text,p.data,p.generation_id,row_to_json(g) as metadata,
                o.id as observation_id,o.document_id,v.heading,v.content_hash
               from legislation.legal_passages p
               join legislation.legal_passage_generations g on g.id=p.generation_id
               join legislation.regulatory_document_versions v on v.id=g.document_version_id
               join legislation.regulatory_document_observations o on o.version_id=v.id
               where p.id=any($1::text[]) and o.id=any($2::uuid[]) for share of p,g,v,o`,
                [selected.map((row) => row.id), scopeIds]
              )
            ).rows
          )
        const hits = selected.map((candidate) => {
          const original = originals.find((row) => row.id === candidate.id && row.observation_id === candidate.scope_id)
          invariant(
            original &&
              isDeepStrictEqual(legalTransferRowSchema.parse(original), legalTransferRowSchema.parse(candidate)) &&
              isDeepStrictEqual(original.metadata, candidate.metadata) &&
              original.generation_id === candidate.generation_id &&
              candidate.metadata.document_version_id === candidate.data.versionId &&
              digest(candidate.input_text) === candidate.data.inputHash &&
              candidate.id === digest(JSON.stringify([candidate.generation_id, candidate.ordinal])),
            "legal_search_candidate_mismatch"
          )
          const publication = publications.find((row) => row.observation_id === candidate.scope_id)
          invariant(publication, "legal_search_scope_mismatch")
          return { ...publication, passage: candidate.data, passageId: candidate.id, score: candidate.score }
        })
        await target.query("commit")
        await source.query("commit")
        return { hits, generation, candidateSetTruncated }
      } catch (error) {
        await target.query("rollback")
        throw error
      } finally {
        target.release()
      }
    } catch (error) {
      await source.query("rollback")
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
