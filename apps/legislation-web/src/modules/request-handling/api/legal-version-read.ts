import {
  legalProvisionContextSchema,
  legalProvisionVersionSchema
} from "@repo/legislation-core/api-client/legal-browse-contract"
import {
  legalPublicationVersionContextSchema,
  legalPublicationVersionIdentitySchema,
  legalVersionRequestSchema
} from "@repo/legislation-core/api-client/legal-version-contract"
import { getRequestContext } from "@repo/legislation-core/auth/request-context"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import { requireRights } from "@repo/legislation-core/legal-text/rights"
import type pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"

const ownerSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("provision"), version: legalProvisionVersionSchema }),
  z.strictObject({ kind: z.literal("publication"), version: legalPublicationVersionIdentitySchema })
])
const profileSchema = z.object({ rights_profile_id: z.string().min(1) })

function isRightsFailure(error: unknown) {
  return (
    error instanceof Error &&
    (error.message.startsWith("rights_denied:") || error.message === "Invariant failed: rights_profile_unavailable")
  )
}

export function createLegalVersionReader(pool: pg.Pool, allowedOrganizationIds: readonly string[]) {
  const allowed = new Set(z.array(z.string().min(1).max(256)).max(1000).parse(allowedOrganizationIds))

  async function authorize(client: pg.PoolClient, profileId: string) {
    await requireRights(client, profileId, "apiMcp")
    await requireRights(client, profileId, "displayText")
  }

  async function authorizeAny(client: pg.PoolClient, rows: unknown[]) {
    const profiles = z.array(profileSchema).max(1000).parse(rows)
    if (profiles.length === 0) {
      throw new LegislationError("not_found", "Published legal version was not found")
    }
    for (const profile of profiles) {
      try {
        await authorize(client, profile.rights_profile_id)
        return
      } catch (error) {
        if (!isRightsFailure(error)) {
          throw error
        }
      }
    }
    throw new LegislationError("forbidden", "Access denied")
  }

  return async (value: string, selection: unknown) => {
    const identity = getRequestContext()?.identity
    if (!identity?.userId) {
      throw new LegislationError("unauthorized", "Bearer token is absent or invalid")
    }
    if (!identity.organizationId || !allowed.has(identity.organizationId)) {
      throw new LegislationError("forbidden", "Access denied")
    }
    const versionId = z.uuid().parse(value)
    const input = legalVersionRequestSchema.parse(selection)
    const client = await pool.connect()
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ")
      await client.query("SET LOCAL lock_timeout='5s'")
      await client.query("SET LOCAL statement_timeout='15s'")
      const owners = await client.query(
        `SELECT jsonb_build_object('kind','provision','version',jsonb_build_object(
          'id',v.id,'provisionId',v.provision_id,'codeId',v.code_id,'contentHash',v.content_hash,
          'inputContract',v.input_contract,'heading',v.heading,'nodeKind',v.node_kind,'language',v.language)) AS data
        FROM legislation.legal_provision_versions v WHERE v.id=$1
        UNION ALL
        SELECT jsonb_build_object('kind','publication','version',jsonb_build_object(
          'id',v.id,'documentId',v.document_id,'contentHash',v.content_hash,'inputContract',v.input_contract,
          'heading',v.heading,'publicationKind',v.publication_kind)) AS data
        FROM legislation.regulatory_document_versions v WHERE v.id=$1`,
        [versionId]
      )
      if (owners.rows.length === 0) {
        throw new LegislationError("not_found", "Legal version was not found")
      }
      invariant(owners.rows.length === 1, "legal_version_identity_collision")
      const owner = ownerSchema.parse(owners.rows[0]?.data)

      if (owner.kind === "provision") {
        const profiles = await client.query(
          `SELECT DISTINCT e.rights_profile_id FROM legislation.legal_edition_provisions m
          JOIN legislation.legal_editions e ON e.id=m.edition_id AND e.code_id=m.code_id
          WHERE m.version_id=$1 AND e.jurisdiction_id='jurisdiction:us'
            AND e.source_id IN ('ecfr','govinfo-cfr') AND e.published_at IS NOT NULL
          ORDER BY e.rights_profile_id LIMIT 1001`,
          [versionId]
        )
        invariant(profiles.rows.length <= 1000, "legal_version_rights_catalog_limit")
        await authorizeAny(client, profiles.rows)
        if (input.sourceObservationId !== undefined) {
          throw new LegislationError("invalid_request", "Publication observation cannot select a provision version")
        }
        let selectedContext: z.infer<typeof legalProvisionContextSchema> | null = null
        if (input.editionId !== undefined) {
          const selected = await client.query(
            `SELECT e.rights_profile_id FROM legislation.legal_edition_provisions m
            JOIN legislation.legal_editions e ON e.id=m.edition_id AND e.code_id=m.code_id
            WHERE m.version_id=$1 AND m.edition_id=$2 AND e.jurisdiction_id='jurisdiction:us'
              AND e.source_id IN ('ecfr','govinfo-cfr') AND e.published_at IS NOT NULL`,
            [versionId, input.editionId]
          )
          if (selected.rows.length === 0) {
            throw new LegislationError("not_found", "Selected legal version context was not found")
          }
          invariant(selected.rows.length === 1, "legal_version_edition_membership_ambiguous")
          const profile = profileSchema.parse(selected.rows[0])
          await authorize(client, profile.rights_profile_id)
          const context = await client.query(
            `SELECT jsonb_build_object(
              'edition',jsonb_build_object('id',e.id,'codeId',e.code_id,'sourceId',e.source_id,
                'jurisdictionId',e.jurisdiction_id,'rightsProfileId',e.rights_profile_id,
                'sourceObservationId',e.generation_id,'nativeKey',e.native_key,'sourceRevision',e.source_revision,
                'sourceUrl',g.unit->>'sourceUrl','issueDate',e.issue_date::text,
                'sourceCurrencyDate',e.currency_date::text,
                'publishedAt',to_char(e.published_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
                'scope',CASE WHEN e.source_id='ecfr' THEN 'current_code_snapshot' ELSE 'annual_volume' END),
              'parentId',m.parent_id,'ordinal',m.ordinal,'nativeId',m.native_id,'sourceLocator',m.source_locator,
              'isLatestValidated',EXISTS(SELECT 1 FROM legislation.legal_code_heads h
                WHERE h.code_id=m.code_id AND h.source_id='ecfr' AND h.edition_id=m.edition_id),
              'textUrl','/api/legal/versions/'||m.version_id||'/text?editionId='||m.edition_id) AS data
            FROM legislation.legal_edition_provisions m
            JOIN legislation.legal_editions e ON e.id=m.edition_id AND e.code_id=m.code_id
            JOIN legislation.legal_import_generations g ON g.id=e.generation_id
            WHERE m.version_id=$1 AND m.edition_id=$2 AND e.rights_profile_id=$3
            FOR SHARE OF m,e,g`,
            [versionId, input.editionId, profile.rights_profile_id]
          )
          selectedContext = legalProvisionContextSchema.parse(context.rows[0]?.data)
        }
        await client.query("COMMIT")
        return { kind: "provision" as const, version: owner.version, selectedContext }
      }

      const profiles = await client.query(
        `SELECT DISTINCT o.rights_profile_id FROM legislation.regulatory_document_observations o
        JOIN legislation.regulatory_publication_batches b ON b.generation_id=o.generation_id
        WHERE o.version_id=$1 AND o.jurisdiction_id='jurisdiction:us' AND o.source_id='govinfo-fr'
        ORDER BY o.rights_profile_id LIMIT 1001`,
        [versionId]
      )
      invariant(profiles.rows.length <= 1000, "legal_version_rights_catalog_limit")
      await authorizeAny(client, profiles.rows)
      if (input.editionId !== undefined) {
        throw new LegislationError("invalid_request", "Code edition cannot select a publication version")
      }
      let selectedContext: z.infer<typeof legalPublicationVersionContextSchema> | null = null
      if (input.sourceObservationId !== undefined) {
        const selected = await client.query(
          `SELECT o.rights_profile_id FROM legislation.regulatory_document_observations o
          JOIN legislation.regulatory_publication_batches b ON b.generation_id=o.generation_id
          WHERE o.version_id=$1 AND o.id=$2 AND o.jurisdiction_id='jurisdiction:us' AND o.source_id='govinfo-fr'`,
          [versionId, input.sourceObservationId]
        )
        if (selected.rows.length === 0) {
          throw new LegislationError("not_found", "Selected legal version context was not found")
        }
        invariant(selected.rows.length === 1, "legal_version_publication_observation_ambiguous")
        const profile = profileSchema.parse(selected.rows[0])
        await authorize(client, profile.rights_profile_id)
        const context = await client.query(
          `SELECT jsonb_build_object(
            'sourceObservationId',o.id,'documentId',o.document_id,'versionId',o.version_id,
            'sourceId','federal-register','jurisdictionId',o.jurisdiction_id,'rightsProfileId',o.rights_profile_id,
            'publishedOn',o.publication_date::text,'sourceLocator',o.source_locator,
            'sourceUrl',coalesce(nullif(o.metadata->>'html_url',''),g.unit->>'sourceUrl'),
            'updatedAt',to_char(b.published_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
            'textUrl','/api/legal/versions/'||o.version_id||'/text?sourceObservationId='||o.id) AS data
          FROM legislation.regulatory_document_observations o
          JOIN legislation.regulatory_publication_batches b ON b.generation_id=o.generation_id
          JOIN legislation.legal_import_generations g ON g.id=o.generation_id
          WHERE o.version_id=$1 AND o.id=$2 AND o.rights_profile_id=$3 FOR SHARE OF o,b,g`,
          [versionId, input.sourceObservationId, profile.rights_profile_id]
        )
        selectedContext = legalPublicationVersionContextSchema.parse(context.rows[0]?.data)
      }
      await client.query("COMMIT")
      return { kind: "publication" as const, version: owner.version, selectedContext }
    } catch (error) {
      await client.query("ROLLBACK")
      if (isRightsFailure(error)) {
        throw new LegislationError("forbidden", "Access denied", { cause: error })
      }
      throw error
    } finally {
      client.release()
    }
  }
}
