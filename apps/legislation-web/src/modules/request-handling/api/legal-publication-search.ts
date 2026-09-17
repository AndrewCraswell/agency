import { createHash } from "node:crypto"
import { isDeepStrictEqual } from "node:util"
import { getRequestContext } from "@repo/legislation-core/auth/request-context"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import { digest } from "@repo/legislation-core/legal-text/contracts"
import { requireLegalCopyReceiptRevisions } from "@repo/legislation-core/legal-text/copy-receipt-revisions"
import {
  legalSearchPublicationScopeProjectionSchema,
  legalTransferGenerationSchema,
  legalTransferRowSchema
} from "@repo/legislation-core/legal-text/passage-contract"
import { requireRights } from "@repo/legislation-core/legal-text/rights"
import { isLegalSearchDatabaseName } from "@repo/legislation-core/legal-text/search-database-role"
import type pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"
import { readLegalPublicationSearchResultPage } from "./legal-search-results"

const hash = z.string().regex(/^[a-f0-9]{64}$/)
const publicationKind = z.enum(["proposed_rule", "final_rule", "notice", "other"])
const requestSchema = z.strictObject({
  query: z.string().trim().min(1).max(500),
  publicationKinds: z.array(publicationKind).min(1).max(4).optional(),
  agencyIds: z.array(z.string().min(1).max(256)).min(1).max(25).optional(),
  publishedFrom: z.iso.date().optional(),
  publishedTo: z.iso.date().optional(),
  limit: z.int().min(1).max(100),
  cursor: z
    .string()
    .regex(/^[A-Za-z0-9_-]+$/)
    .max(2048)
    .optional(),
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
  agency_evidence_hash: hash,
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
const manifestSchema = z.object({
  publication_date: z.iso.date(),
  scopes: z.int().positive(),
  identity_hash: hash,
  rights_profile_ids: z.array(z.string().min(1)).min(1),
  valid: z.boolean()
})
const integritySchema = z.object({ scopes: z.int().nonnegative(), invalid_scopes: z.int().nonnegative() })
const candidateSchema = legalTransferRowSchema.extend({
  scope_id: z.uuid(),
  generation_id: hash,
  metadata: legalTransferGenerationSchema,
  projection: legalSearchPublicationScopeProjectionSchema,
  projection_hash: hash,
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
    invariant(sourcePool !== targetPool, "legal_search_requires_separate_database")
    const filters = [
      input.publicationKinds ?? null,
      input.publishedFrom ?? null,
      input.publishedTo ?? null,
      input.agencyIds ?? null
    ]
    const source = await sourcePool.connect()
    try {
      invariant(
        !isLegalSearchDatabaseName((await source.query("select current_database() as name")).rows[0]?.name),
        "legal_search_wrong_source"
      )
      await source.query("begin isolation level repeatable read")
      await source.query("set local lock_timeout='5s'")
      await source.query("set local statement_timeout='15s'")
      const canonicalManifest = z.array(manifestSchema).parse(
        (
          await source.query(
            `select o.publication_date::text as publication_date,count(*)::int as scopes,
              encode(sha256(convert_to(string_agg(concat_ws(chr(31),o.id::text,'publication',
                'regulatory_publication',o.jurisdiction_id,o.source_id,o.rights_profile_id,agencies.agency_ids::text,
                agencies.evidence_hash,o.id::text,o.version_id::text,v.publication_kind,o.publication_date::text),
                chr(30) order by o.id),'UTF8')),'hex')
                as identity_hash,
              array_agg(distinct o.rights_profile_id order by o.rights_profile_id) as rights_profile_ids,
              true as valid
            from legislation.regulatory_document_observations o
            join legislation.regulatory_document_versions v on v.id=o.version_id
            join legislation.regulatory_publication_outbox x on x.observation_id=o.id
              and x.operation='lexical' and x.state='acknowledged'
            cross join lateral (
              select coalesce(jsonb_agg(to_jsonb(case when agency.value ? 'id'
                then 'fr-agency-'||(agency.value->>'id')
                else 'fr-agency-unidentified-'||encode(sha256(convert_to(format('[%s,%s]',
                  to_jsonb(o.metadata->>'document_number')::text,agency.ordinality-1),'UTF8')),'hex') end)
                order by agency.ordinality) filter (where coalesce(nullif(btrim(agency.value->>'name'),''),
                  btrim(agency.value->>'raw_name'),'')<>''),'[]'::jsonb) as agency_ids,
                encode(sha256(convert_to(coalesce(o.metadata->'agencies','[]'::jsonb)::text,'UTF8')),'hex')
                  as evidence_hash
              from jsonb_array_elements(coalesce(o.metadata->'agencies','[]'::jsonb)) with ordinality agency(value,ordinality)
            ) agencies
            where o.jurisdiction_id='jurisdiction:us' and o.source_id='govinfo-fr'
              and ($1::text[] is null or v.publication_kind=any($1::text[]))
              and ($2::date is null or o.publication_date >= $2::date)
              and ($3::date is null or o.publication_date <= $3::date)
              and ($4::text[] is null or agencies.agency_ids ?| $4::text[])
            group by o.publication_date order by o.publication_date`,
            filters
          )
        ).rows
      )
      if (canonicalManifest.length === 0) {
        throw new LegislationError("not_found", "Published documents were not found")
      }
      const profileIds = [...new Set(canonicalManifest.flatMap((row) => row.rights_profile_ids))].sort()
      const rights: Record<string, string> = {}
      for (const profile of profileIds) {
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
      const target = await targetPool.connect()
      try {
        invariant(
          isLegalSearchDatabaseName((await target.query("select current_database() as name")).rows[0]?.name),
          "legal_search_wrong_target"
        )
        await target.query("begin isolation level repeatable read")
        await target.query("set local lock_timeout='5s'")
        await target.query("set local statement_timeout='15s'")
        const projectedManifest = z.array(manifestSchema).parse(
          (
            await target.query(
              `select projection->>'publication_date' as publication_date,count(*)::int as scopes,
                encode(sha256(convert_to(string_agg(concat_ws(chr(31),scope_id::text,scope_kind,
                  projection->>'corpus',projection->>'jurisdiction_id',projection->>'source_id',
                  projection->>'rights_profile_id',(projection->'agency_ids')::text,
                  projection->>'agency_evidence_hash',
                  projection->>'observation_id',projection->>'document_version_id',
                  projection->>'publication_kind',projection->>'publication_date'),chr(30) order by scope_id),'UTF8')),'hex')
                  as identity_hash,
                array_agg(distinct projection->>'rights_profile_id' order by projection->>'rights_profile_id')
                  as rights_profile_ids,
                bool_and(projection->>'scope_id'=scope_id::text and projection->>'observation_id'=scope_id::text
                  and projection->>'scope_kind'='publication' and projection->>'corpus'='regulatory_publication'
                  and projection->>'jurisdiction_id'='jurisdiction:us' and projection->>'source_id'='govinfo-fr'
                  and jsonb_typeof(projection->'agency_ids')='array' and jsonb_typeof(projection->'agencies')='array'
                  and projection->>'agency_evidence_hash' ~ '^[a-f0-9]{64}$') as valid
              from legislation.legal_search_scope_projections
              where scope_kind='publication' and projection->>'corpus'='regulatory_publication'
                and projection->>'jurisdiction_id'='jurisdiction:us' and projection->>'source_id'='govinfo-fr'
                and ($1::text[] is null or projection->>'publication_kind'=any($1::text[]))
                and ($2::date is null or projection->>'publication_date' >= $2::date::text)
                and ($3::date is null or projection->>'publication_date' <= $3::date::text)
                and ($4::text[] is null or projection->'agency_ids' ?| $4::text[])
              group by projection->>'publication_date' order by projection->>'publication_date'`,
              filters
            )
          ).rows
        )
        if (!isDeepStrictEqual(canonicalManifest, projectedManifest)) {
          throw unavailable()
        }
        const integrity = integritySchema.parse(
          (
            await target.query(
              `with selected as materialized (
                select scope_id from legislation.legal_search_scope_projections
                where scope_kind='publication' and projection->>'corpus'='regulatory_publication'
                  and projection->>'jurisdiction_id'='jurisdiction:us' and projection->>'source_id'='govinfo-fr'
                  and ($1::text[] is null or projection->>'publication_kind'=any($1::text[]))
                  and ($2::date is null or projection->>'publication_date' >= $2::date::text)
                  and ($3::date is null or projection->>'publication_date' <= $3::date::text)
                  and ($4::text[] is null or projection->'agency_ids' ?| $4::text[])
              ), revisions as (
                select v.scope_id,count(*)::int as generations,
                  bool_and(v.target_revision=r.revision) as current,
                  encode(sha256(convert_to(string_agg(v.generation_id,chr(30) order by v.generation_id),'UTF8')),'hex')
                    as inventory
                from selected s join legislation.legal_search_scope_revisions v
                  on v.scope_kind='publication' and v.scope_id=s.scope_id
                join legislation.legal_copy_revisions r on r.generation_id=v.generation_id
                group by v.scope_id
              ), memberships as (
                select m.scope_id,count(*)::int as generations,
                  encode(sha256(convert_to(string_agg(m.generation_id,chr(30) order by m.generation_id),'UTF8')),'hex')
                    as inventory
                from selected s join legislation.legal_search_memberships m
                  on m.scope_kind='publication' and m.scope_id=s.scope_id group by m.scope_id
              ) select count(*)::int as scopes,
                count(*) filter(where receipt.scope_id is null or rev.scope_id is not null
                  or coalesce(revisions.generations,0)<>receipt.generation_count
                  or coalesce(memberships.generations,0)<>receipt.generation_count
                  or revisions.current is not true or revisions.inventory<>memberships.inventory)::int as invalid_scopes
              from selected s
              left join legislation.legal_search_scopes receipt
                on receipt.scope_kind='publication' and receipt.scope_id=s.scope_id
              left join legislation.legal_search_revocations rev
                on rev.scope_kind='publication' and rev.scope_id=s.scope_id
              left join revisions on revisions.scope_id=s.scope_id
              left join memberships on memberships.scope_id=s.scope_id`,
              filters
            )
          ).rows[0]
        )
        const expectedScopes = canonicalManifest.reduce((sum, row) => sum + row.scopes, 0)
        if (integrity.scopes !== expectedScopes || integrity.invalid_scopes !== 0) {
          throw unavailable()
        }
        const revisionHash = createHash("sha256")
        let verifiedScopes = 0
        let receiptCursor: string | null = null
        while (true) {
          const receiptPage = z.array(receiptSchema).parse(
            (
              await target.query(
                `select receipt.scope_id,receipt.preparation_id,receipt.inventory_hash,
                  receipt.generation_count,receipt.passage_count
                from legislation.legal_search_scope_projections projection
                join legislation.legal_search_scopes receipt
                  on receipt.scope_kind=projection.scope_kind and receipt.scope_id=projection.scope_id
                where projection.scope_kind='publication'
                  and projection.projection->>'corpus'='regulatory_publication'
                  and projection.projection->>'jurisdiction_id'='jurisdiction:us'
                  and projection.projection->>'source_id'='govinfo-fr'
                  and ($1::text[] is null or projection.projection->>'publication_kind'=any($1::text[]))
                  and ($2::date is null or projection.projection->>'publication_date' >= $2::date::text)
                  and ($3::date is null or projection.projection->>'publication_date' <= $3::date::text)
                  and ($4::text[] is null or projection.projection->'agency_ids' ?| $4::text[])
                  and ($5::uuid is null or projection.scope_id>$5::uuid)
                order by projection.scope_id limit 100 for share of receipt`,
                [...filters, receiptCursor]
              )
            ).rows
          )
          if (receiptPage.length === 0) {
            break
          }
          const registrations = z.array(registrationSchema).parse(
            (
              await source.query(
                `select p.observation_id,p.id as preparation_id,p.inventory_hash,p.expected_count
                from legislation.legal_passage_preparations p
                join legislation.regulatory_publication_outbox x on x.observation_id=p.observation_id
                  and x.operation='lexical' and x.state='acknowledged'
                where p.id=any($1::text[]) and p.state='prepared' and p.lease_token is null
                order by p.observation_id,p.id for share of p,x`,
                [receiptPage.map((row) => row.preparation_id)]
              )
            ).rows
          )
          if (
            registrations.length !== receiptPage.length ||
            receiptPage.some(
              (receipt) =>
                !registrations.some(
                  (row) =>
                    row.observation_id === receipt.scope_id &&
                    row.preparation_id === receipt.preparation_id &&
                    row.inventory_hash === receipt.inventory_hash &&
                    row.expected_count === receipt.generation_count
                )
            )
          ) {
            throw unavailable()
          }
          const revisions = await requireLegalCopyReceiptRevisions(
            source,
            target,
            receiptPage.map((row) => ({
              kind: "publication",
              id: row.scope_id,
              preparationId: row.preparation_id,
              count: row.generation_count
            }))
          )
          revisionHash.update(JSON.stringify([receiptPage, revisions]))
          verifiedScopes += receiptPage.length
          receiptCursor = receiptPage.at(-1)?.scope_id ?? null
          if (receiptPage.length < 100) {
            break
          }
        }
        if (verifiedScopes !== expectedScopes) {
          throw unavailable()
        }
        const partitionRevisionHash = revisionHash.digest("hex")
        const generation = digest(
          JSON.stringify([canonicalManifest, projectedManifest, integrity, partitionRevisionHash, rights])
        )
        const requestHash = digest(
          JSON.stringify([
            "legal-publication-lexical-2026-09-17",
            identity.organizationId,
            identity.userId,
            input.query,
            input.limit,
            input.requestBinding ?? null
          ])
        )
        const page = await readLegalPublicationSearchResultPage(target, {
          requestHash,
          generation,
          query: input.query,
          publicationKinds: input.publicationKinds,
          agencyIds: input.agencyIds,
          publishedFrom: input.publishedFrom,
          publishedTo: input.publishedTo,
          limit: input.limit,
          ...(input.cursor === undefined ? {} : { cursor: input.cursor })
        })
        const selected = z.array(candidateSchema).parse(
          (
            await target.query(
              `select m.scope_id,p.generation_id,p.id,p.ordinal,p.body,p.input_text,p.data,g.metadata,
                projection.projection,projection.projection_hash,(f.value->>'score')::double precision as score
              from jsonb_array_elements($1::jsonb) with ordinality f(value,position)
              join legislation.legal_search_passages p
                on p.id=f.value->>'id' and p.generation_id=f.value->>'generationId'
              join legislation.legal_search_generations g on g.id=p.generation_id
                and g.metadata->>'document_version_id'=f.value->>'versionId'
              join legislation.legal_search_memberships m on m.scope_kind='publication'
                and m.scope_id=(f.value->>'scopeId')::uuid and m.generation_id=g.id
              join legislation.legal_search_scope_projections projection
                on projection.scope_kind=m.scope_kind and projection.scope_id=m.scope_id
              order by f.position`,
              [JSON.stringify(page.candidates)]
            )
          ).rows
        )
        if (selected.length !== page.candidates.length) {
          throw unavailable()
        }
        for (const candidate of selected) {
          invariant(
            digest(JSON.stringify(candidate.projection)) === candidate.projection_hash,
            "legal_search_projection_mismatch"
          )
        }
        const scopeIds = [...new Set(selected.map((row) => row.scope_id))].sort()
        const publications =
          scopeIds.length === 0
            ? []
            : z.array(publicationSchema).parse(
                (
                  await source.query(
                    `select o.id as observation_id,o.document_id,o.version_id,o.source_id,o.rights_profile_id,
                      v.publication_kind,o.publication_date::text as published_on,
                      nullif(o.metadata->>'effective_on','') as effective_on,v.heading,
                      coalesce(nullif(o.metadata->>'citation',''),d.native_number) as citation,o.source_locator,
                      coalesce(nullif(o.metadata->>'html_url',''),g.unit->>'sourceUrl') as source_url,s.publisher,
                      r.policy->>'attribution' as attribution,
                      encode(sha256(convert_to(coalesce(o.metadata->'agencies','[]'::jsonb)::text,'UTF8')),'hex')
                        as agency_evidence_hash,
                      to_char(a.acquired_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as retrieved_at,
                      to_char(b.published_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as updated_at,
                      v.content_hash as version_hash
                    from legislation.regulatory_document_observations o
                    join legislation.regulatory_document_versions v on v.id=o.version_id
                    join legislation.regulatory_documents d on d.id=o.document_id
                    join legislation.regulatory_publication_batches b on b.generation_id=o.generation_id
                    join legislation.legal_import_generations g on g.id=o.generation_id
                    join legislation.regulatory_publication_outbox x on x.observation_id=o.id
                      and x.operation='lexical' and x.state='acknowledged'
                    join legislation.legal_sources s on s.id=o.source_id
                    join legislation.legal_rights_profiles r on r.id=o.rights_profile_id and r.is_active
                    join legislation.legal_artifacts a on a.hash=v.pdf_hash
                    where o.id=any($1::uuid[]) and o.jurisdiction_id='jurisdiction:us' and o.source_id='govinfo-fr'
                    order by o.id for share of o,v,d,b,g,x,s,r,a`,
                    [scopeIds]
                  )
                ).rows
              )
        if (publications.length !== scopeIds.length) {
          throw unavailable()
        }
        const originals =
          selected.length === 0
            ? []
            : z
                .array(
                  candidateSchema
                    .omit({ score: true, scope_id: true, projection: true, projection_hash: true })
                    .extend({
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
          const publication = publications.find((row) => row.observation_id === candidate.scope_id)
          invariant(
            original &&
              publication &&
              isDeepStrictEqual(legalTransferRowSchema.parse(original), legalTransferRowSchema.parse(candidate)) &&
              isDeepStrictEqual(original.metadata, candidate.metadata) &&
              original.generation_id === candidate.generation_id &&
              candidate.metadata.document_version_id === candidate.data.versionId &&
              candidate.projection.document_version_id === publication.version_id &&
              candidate.projection.publication_kind === publication.publication_kind &&
              candidate.projection.publication_date === publication.published_on &&
              candidate.projection.rights_profile_id === publication.rights_profile_id &&
              candidate.projection.agency_evidence_hash === publication.agency_evidence_hash &&
              digest(candidate.input_text) === candidate.data.inputHash &&
              candidate.id === digest(JSON.stringify([candidate.generation_id, candidate.ordinal])),
            "legal_search_candidate_mismatch"
          )
          return {
            ...publication,
            agencies: candidate.projection.agencies,
            passage: candidate.data,
            passageId: candidate.id,
            score: candidate.score
          }
        })
        await target.query("commit")
        await source.query("commit")
        return {
          hits,
          generation,
          nextCursor: page.nextCursor,
          candidateSetTruncated: page.candidateSetTruncated
        }
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
