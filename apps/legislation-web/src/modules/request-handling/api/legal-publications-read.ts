import {
  legalPublicationDetailSchema,
  legalPublicationSummarySchema,
  legalPublicationsRequestSchema,
  legalPublicationVersionsRequestSchema
} from "@repo/legislation-core/api-client/legal-publications-contract"
import { getRequestContext } from "@repo/legislation-core/auth/request-context"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import { digest } from "@repo/legislation-core/legal-text/contracts"
import { projectFederalRegisterAgencyReferences } from "@repo/legislation-core/legal-text/federal-register-agencies"
import { assertRights } from "@repo/legislation-core/legal-text/storage-contract"
import type pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"

const cursorSchema = z.strictObject({
  scope: z.string().regex(/^[a-f0-9]{64}$/),
  publishedOn: z.iso.date(),
  observationId: z.uuid()
})
const profileSchema = z.object({ id: z.string(), policy: z.unknown(), policy_hash: z.string() })
const rowSchema = z.strictObject({
  id: z.uuid(),
  versionId: z.uuid(),
  sourceObservationId: z.uuid(),
  nativeNumber: z.string().min(1),
  documentNumber: z.string().min(1),
  title: z.string().min(1),
  citation: z.string().min(1),
  publicationKind: z.enum(["proposed_rule", "final_rule", "notice", "other"]),
  publishedOn: z.iso.date(),
  effectiveOn: z.iso.date().nullable(),
  agencyEvidence: z.array(z.unknown()),
  sourceLocator: z.string().min(1),
  sourceUrl: z.url(),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  attribution: z.string().nullable(),
  updatedAt: z.iso.datetime()
})

type BrowseInput = z.infer<typeof legalPublicationsRequestSchema>

export function createLegalPublicationsReader(pool: pg.Pool, allowedOrganizationIds: readonly string[]) {
  const allowed = new Set(z.array(z.string().min(1).max(256)).max(1000).parse(allowedOrganizationIds))

  async function read(input: BrowseInput, options: Readonly<{ documentId?: string; versionId?: string }> = {}) {
    const identity = getRequestContext()?.identity
    if (!identity?.userId) {
      throw new LegislationError("unauthorized", "Bearer token is absent or invalid")
    }
    if (!identity.organizationId || !allowed.has(identity.organizationId)) {
      throw new LegislationError("forbidden", "Access denied")
    }
    let cursor: z.infer<typeof cursorSchema> | undefined
    if (input.cursor !== undefined) {
      try {
        cursor = cursorSchema.parse(JSON.parse(Buffer.from(input.cursor, "base64url").toString("utf8")))
      } catch {
        throw new LegislationError("invalid_request", "Invalid publication continuation")
      }
    }
    if (
      (input.jurisdictionId !== undefined && input.jurisdictionId !== "jurisdiction:us") ||
      input.agencyId !== undefined
    ) {
      return { items: [], truncated: false, warnings: [] }
    }
    const client = await pool.connect()
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ")
      await client.query("SET LOCAL lock_timeout='5s'")
      await client.query("SET LOCAL statement_timeout='15s'")
      const profiles = await client.query(`SELECT r.id,r.policy,r.policy_hash
        FROM legislation.legal_rights_profiles r WHERE r.is_active AND EXISTS (
          SELECT 1 FROM legislation.regulatory_document_observations o WHERE o.rights_profile_id=r.id
          AND o.jurisdiction_id='jurisdiction:us' AND o.source_id='govinfo-fr'
        ) ORDER BY r.id LIMIT 1001 FOR SHARE OF r`)
      invariant(profiles.rows.length <= 1000, "legal_publications_rights_catalog_limit")
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
      const scope = digest(
        JSON.stringify([
          "legal-publications-2026-09-17",
          identity.organizationId,
          identity.userId,
          {
            jurisdictionId: input.jurisdictionId ?? null,
            sourceId: input.sourceId ?? null,
            sourceAgencyId: input.sourceAgencyId ?? null,
            agencyId: input.agencyId ?? null,
            kind: input.kind ?? null,
            publishedFrom: input.publishedFrom ?? null,
            publishedTo: input.publishedTo ?? null,
            updatedSince: input.updatedSince ?? null,
            limit: input.limit
          },
          options,
          permitted
        ])
      )
      if (cursor !== undefined && cursor.scope !== scope) {
        throw new LegislationError("conflict", "Publication continuation no longer matches the visible catalog")
      }
      const result = await client.query(
        `SELECT d.id,o.version_id AS "versionId",o.id AS "sourceObservationId",d.native_number AS "nativeNumber",
          o.metadata->>'document_number' AS "documentNumber",v.heading AS title,
          coalesce(nullif(o.metadata->>'citation',''),d.native_number) AS citation,
          v.publication_kind AS "publicationKind",o.publication_date::text AS "publishedOn",
          nullif(o.metadata->>'effective_on','') AS "effectiveOn",
          coalesce(o.metadata->'agencies','[]'::jsonb) AS "agencyEvidence",o.source_locator AS "sourceLocator",
          coalesce(nullif(o.metadata->>'html_url',''),g.unit->>'sourceUrl') AS "sourceUrl",v.content_hash AS "contentHash",
          r.policy->>'attribution' AS attribution,
          to_char(b.published_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "updatedAt"
        FROM legislation.regulatory_document_observations o
        JOIN legislation.regulatory_documents d ON d.id=o.document_id
        JOIN legislation.regulatory_document_versions v ON v.id=o.version_id
        JOIN legislation.regulatory_publication_batches b ON b.generation_id=o.generation_id
        JOIN legislation.legal_import_generations g ON g.id=o.generation_id
        JOIN legislation.legal_rights_profiles r ON r.id=o.rights_profile_id AND r.is_active
        CROSS JOIN LATERAL (
          SELECT coalesce(jsonb_agg(to_jsonb(CASE WHEN agency.value ? 'id'
            THEN 'fr-agency-'||(agency.value->>'id') ELSE 'fr-agency-unidentified-'||encode(sha256(convert_to(
              format('[%s,%s]',to_jsonb(o.metadata->>'document_number')::text,agency.ordinality-1),'UTF8')),'hex') END)
            ORDER BY agency.ordinality) FILTER (WHERE coalesce(nullif(btrim(agency.value->>'name'),''),
              btrim(agency.value->>'raw_name'),'')<>''),'[]'::jsonb) AS ids
          FROM jsonb_array_elements(coalesce(o.metadata->'agencies','[]'::jsonb)) WITH ORDINALITY agency(value,ordinality)
        ) agencies
        WHERE o.jurisdiction_id='jurisdiction:us' AND o.source_id='govinfo-fr'
          AND o.rights_profile_id=ANY($1::text[]) AND ($2::text IS NULL OR v.publication_kind=$2)
          AND ($3::date IS NULL OR o.publication_date >= $3::date)
          AND ($4::date IS NULL OR o.publication_date <= $4::date)
          AND ($5::timestamptz IS NULL OR b.published_at >= $5::timestamptz)
          AND ($6::text IS NULL OR agencies.ids ? $6::text)
          AND ($7::uuid IS NULL OR d.id=$7::uuid) AND ($8::uuid IS NULL OR v.id=$8::uuid)
          AND ($9::date IS NULL OR (o.publication_date,o.id) < ($9::date,$10::uuid))
        ORDER BY o.publication_date DESC,o.id DESC LIMIT $11 FOR SHARE OF o,d,v,b,g,r`,
        [
          permitted.map((profile) => profile.id),
          input.kind ?? null,
          input.publishedFrom ?? null,
          input.publishedTo ?? null,
          input.updatedSince ?? null,
          input.sourceAgencyId ?? null,
          options.documentId ?? null,
          options.versionId ?? null,
          cursor?.publishedOn ?? null,
          cursor?.observationId ?? null,
          input.limit + 1
        ]
      )
      const rows = z.array(rowSchema).parse(result.rows)
      const truncated = rows.length > input.limit
      const selected = rows.slice(0, input.limit)
      const items = selected.map((row) => {
        const agencies = projectFederalRegisterAgencyReferences(row.documentNumber, row.agencyEvidence)
          .map((agency) => agency.reference)
          .filter((agency) => agency !== null)
        const { documentNumber: _documentNumber, agencyEvidence: _agencyEvidence, ...publication } = row
        return legalPublicationDetailSchema.parse({
          ...publication,
          jurisdictionId: "jurisdiction:us",
          sourceId: "federal-register",
          agencies,
          canonicalUrl: `/api/legal/publications/${row.id}`,
          textUrl: `/api/legal/versions/${row.versionId}/text?sourceObservationId=${encodeURIComponent(row.sourceObservationId)}`
        })
      })
      const last = selected.at(-1)
      const nextCursor =
        truncated && last
          ? Buffer.from(
              JSON.stringify({ scope, publishedOn: last.publishedOn, observationId: last.sourceObservationId })
            ).toString("base64url")
          : undefined
      await client.query("COMMIT")
      return {
        items,
        truncated,
        ...(nextCursor === undefined ? {} : { nextCursor }),
        warnings: [
          "Federal Register source agencies may be unresolved. Publication metadata does not establish current legal effect."
        ]
      }
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    } finally {
      client.release()
    }
  }

  return {
    listPublications: async (value: unknown) => {
      const page = await read(legalPublicationsRequestSchema.parse(value))
      return {
        ...page,
        items: page.items.map((item) => {
          const {
            sourceLocator: _sourceLocator,
            sourceUrl: _sourceUrl,
            contentHash: _contentHash,
            attribution: _attribution,
            ...summary
          } = item
          return legalPublicationSummarySchema.parse(summary)
        })
      }
    },
    getPublication: async (documentId: string, versionId?: string) => {
      const id = z.uuid().parse(documentId)
      const selectedVersion = versionId === undefined ? undefined : z.uuid().parse(versionId)
      const page = await read(legalPublicationsRequestSchema.parse({ limit: 1 }), {
        documentId: id,
        ...(selectedVersion === undefined ? {} : { versionId: selectedVersion })
      })
      const item = page.items[0]
      if (!item) {
        throw new LegislationError("not_found", "Regulatory publication not found")
      }
      return item
    },
    listVersions: (documentId: string, value: unknown) => {
      const id = z.uuid().parse(documentId)
      const input = legalPublicationVersionsRequestSchema.parse(value)
      return read(legalPublicationsRequestSchema.parse(input), { documentId: id })
    }
  }
}
