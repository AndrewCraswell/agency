import {
  legalAgenciesRequestSchema,
  legalAgencyDirectoryEntrySchema
} from "@repo/legislation-core/api-client/legal-agencies-contract"
import { getRequestContext } from "@repo/legislation-core/auth/request-context"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import { digest } from "@repo/legislation-core/legal-text/contracts"
import { assertRights } from "@repo/legislation-core/legal-text/storage-contract"
import type pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"

const cursorSchema = z.strictObject({ scope: z.string().regex(/^[a-f0-9]{64}$/), after: z.string().min(1).max(256) })
const profileSchema = z.object({ id: z.string(), policy: z.unknown(), policy_hash: z.string() })
const rowSchema = z.strictObject({
  sourceAgencyId: z.string().min(1).max(256),
  nativeId: z.string().min(1).max(256).nullable(),
  name: z.string().min(1).max(2048),
  names: z.array(z.string().min(1).max(2048)).min(1).max(100),
  publicationCount: z.int().positive(),
  firstPublishedOn: z.iso.date(),
  lastPublishedOn: z.iso.date()
})

/** Rights-filtered publisher-reference directory. It never creates or guesses organization identities. */
export function createLegalAgenciesReader(pool: pg.Pool, allowedOrganizationIds: readonly string[]) {
  const allowed = new Set(z.array(z.string().min(1).max(256)).max(1000).parse(allowedOrganizationIds))
  return async (unparsed: unknown) => {
    const identity = getRequestContext()?.identity
    if (!identity?.userId) {
      throw new LegislationError("unauthorized", "Bearer token is absent or invalid")
    }
    if (!identity.organizationId || !allowed.has(identity.organizationId)) {
      throw new LegislationError("forbidden", "Access denied")
    }
    const input = legalAgenciesRequestSchema.parse(unparsed)
    let cursor: z.infer<typeof cursorSchema> | undefined
    if (input.cursor !== undefined) {
      try {
        cursor = cursorSchema.parse(JSON.parse(Buffer.from(input.cursor, "base64url").toString("utf8")))
      } catch {
        throw new LegislationError("invalid_request", "Invalid agency continuation")
      }
    }
    if (input.jurisdictionId !== undefined && input.jurisdictionId !== "jurisdiction:us") {
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
      invariant(profiles.rows.length <= 1000, "legal_agencies_rights_catalog_limit")
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
      const result = await client.query(
        `WITH agency_rows AS (
          SELECT o.id AS observation_id,o.publication_date,agency.ordinality,
            CASE WHEN agency.value ? 'id' THEN 'fr-agency-'||(agency.value->>'id')
              ELSE 'fr-agency-unidentified-'||encode(sha256(convert_to(format('[%s,%s]',
                to_jsonb(o.metadata->>'document_number')::text,agency.ordinality-1),'UTF8')),'hex') END
              AS source_agency_id,
            CASE WHEN agency.value ? 'id' THEN agency.value->>'id' ELSE NULL END AS native_id,
            coalesce(nullif(btrim(agency.value->>'name'),''),btrim(agency.value->>'raw_name')) AS agency_name
          FROM legislation.regulatory_document_observations o
          CROSS JOIN LATERAL jsonb_array_elements(coalesce(o.metadata->'agencies','[]'::jsonb))
            WITH ORDINALITY agency(value,ordinality)
          WHERE o.jurisdiction_id='jurisdiction:us' AND o.source_id='govinfo-fr'
            AND o.rights_profile_id=ANY($1::text[])
            AND coalesce(nullif(btrim(agency.value->>'name'),''),btrim(agency.value->>'raw_name'),'')<>''
        ), grouped AS (
          SELECT source_agency_id,native_id,count(DISTINCT observation_id)::integer AS publication_count,
            min(publication_date)::text AS first_published_on,max(publication_date)::text AS last_published_on,
            array_agg(DISTINCT agency_name ORDER BY agency_name) AS names,
            (array_agg(agency_name ORDER BY publication_date DESC,observation_id DESC,ordinality DESC))[1] AS name
          FROM agency_rows GROUP BY source_agency_id,native_id
        )
        SELECT source_agency_id AS "sourceAgencyId",native_id AS "nativeId",name,names,
          publication_count AS "publicationCount",first_published_on AS "firstPublishedOn",
          last_published_on AS "lastPublishedOn"
        FROM grouped ORDER BY name COLLATE "C",source_agency_id LIMIT 10001`,
        [permitted.map((profile) => profile.id)]
      )
      invariant(result.rows.length <= 10000, "legal_agencies_catalog_limit")
      const query = input.q?.toLocaleLowerCase("en-US")
      const catalog = z
        .array(rowSchema)
        .parse(result.rows)
        .map((row) =>
          legalAgencyDirectoryEntrySchema.parse({
            status: "unresolved",
            organizationId: null,
            sourceAgencyId: row.sourceAgencyId,
            name: row.name,
            aliases: row.names.filter((name) => name !== row.name),
            sourceId: "federal-register",
            nativeId: row.nativeId,
            jurisdictionId: "jurisdiction:us",
            publicationCount: row.publicationCount,
            firstPublishedOn: row.firstPublishedOn,
            lastPublishedOn: row.lastPublishedOn
          })
        )
        .filter(
          (row) =>
            query === undefined ||
            [row.name, ...row.aliases].some((name) => name.toLocaleLowerCase("en-US").includes(query))
        )
      const scope = digest(
        JSON.stringify([
          "legal-agencies-2026-09-17",
          identity.organizationId,
          identity.userId,
          input.jurisdictionId ?? null,
          input.sourceId ?? null,
          input.q ?? null,
          input.limit,
          permitted,
          catalog
        ])
      )
      if (cursor !== undefined && cursor.scope !== scope) {
        throw new LegislationError("conflict", "Agency continuation no longer matches the visible catalog")
      }
      const after = cursor === undefined ? -1 : catalog.findIndex((row) => row.sourceAgencyId === cursor.after)
      if (cursor !== undefined && after === -1) {
        throw new LegislationError("invalid_request", "Invalid agency continuation")
      }
      const items = catalog.slice(after + 1, after + 1 + input.limit)
      const last = items.at(-1)
      const truncated = after + 1 + items.length < catalog.length
      const nextCursor =
        truncated && last !== undefined
          ? Buffer.from(JSON.stringify({ scope, after: last.sourceAgencyId })).toString("base64url")
          : undefined
      await client.query("COMMIT")
      return {
        items,
        truncated,
        ...(nextCursor === undefined ? {} : { nextCursor }),
        warnings: [
          "Federal Register publisher references only. Unresolved source agencies are not canonical organization identities."
        ]
      }
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    } finally {
      client.release()
    }
  }
}
