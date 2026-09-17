import {
  legalEditionSchema,
  legalEditionDetailSchema,
  legalEditionsRequestSchema,
  legalProvisionDetailSchema,
  legalProvisionEditionMembershipSchema,
  legalProvisionEditionsRequestSchema,
  legalProvisionRequestSchema,
  legalProvisionSummarySchema,
  legalProvisionVersionSummarySchema,
  legalProvisionVersionsRequestSchema,
  legalProvisionsRequestSchema
} from "@repo/legislation-core/api-client/legal-browse-contract"
import { getRequestContext } from "@repo/legislation-core/auth/request-context"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import { digest } from "@repo/legislation-core/legal-text/contracts"
import { requireRights } from "@repo/legislation-core/legal-text/rights"
import type pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"

const continuationSchema = z.strictObject({
  scope: z.string().regex(/^[a-f0-9]{64}$/),
  editionId: z.uuid(),
  after: z.int().min(-1)
})
function continuation(value: string | undefined) {
  if (value === undefined) {
    return undefined
  }
  try {
    return continuationSchema.parse(JSON.parse(Buffer.from(value, "base64url").toString("utf8")))
  } catch {
    throw new LegislationError("invalid_request", "Invalid legal continuation")
  }
}
function encode(scope: string, editionId: string, after: number) {
  return Buffer.from(JSON.stringify({ scope, editionId, after })).toString("base64url")
}
const catalogContinuationSchema = z.strictObject({
  scope: z.string().regex(/^[a-f0-9]{64}$/),
  itemId: z.uuid(),
  after: z.int().nonnegative()
})
function catalogContinuation(value: string | undefined) {
  if (value === undefined) {
    return undefined
  }
  try {
    return catalogContinuationSchema.parse(JSON.parse(Buffer.from(value, "base64url").toString("utf8")))
  } catch {
    throw new LegislationError("invalid_request", "Invalid legal continuation")
  }
}
function encodeCatalogContinuation(scope: string, itemId: string, after: number) {
  return Buffer.from(JSON.stringify({ scope, itemId, after })).toString("base64url")
}
const editionColumns = `e.id,e.code_id AS "codeId",e.source_id AS "sourceId",e.jurisdiction_id AS "jurisdictionId",
  e.rights_profile_id AS "rightsProfileId",e.generation_id AS "sourceObservationId",e.native_key AS "nativeKey",
  e.source_revision AS "sourceRevision",g.unit->>'sourceUrl' AS "sourceUrl",e.issue_date::text AS "issueDate",
  e.currency_date::text AS "sourceCurrencyDate",
  to_char(e.published_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "publishedAt",
  CASE WHEN e.source_id='ecfr' THEN 'current_code_snapshot' ELSE 'annual_volume' END AS scope`

export function createLegalBrowser(pool: pg.Pool, allowedOrganizationIds: readonly string[]) {
  const allowed = new Set(z.array(z.string().min(1).max(256)).max(1000).parse(allowedOrganizationIds))
  async function transaction<T>(operation: (client: pg.PoolClient, caller: string) => Promise<T>) {
    const identity = getRequestContext()?.identity
    if (!identity?.userId) {
      throw new LegislationError("unauthorized", "Bearer token is absent or invalid")
    }
    if (!identity.organizationId || !allowed.has(identity.organizationId)) {
      throw new LegislationError("forbidden", "Access denied")
    }
    const client = await pool.connect()
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ")
      await client.query("SET LOCAL lock_timeout='5s'")
      await client.query("SET LOCAL statement_timeout='15s'")
      const result = await operation(client, digest(JSON.stringify([identity.organizationId, identity.userId])))
      await client.query("COMMIT")
      return result
    } catch (error) {
      await client.query("ROLLBACK")
      if (
        error instanceof Error &&
        (error.message.startsWith("rights_denied:") || error.message === "Invariant failed: rights_profile_unavailable")
      ) {
        throw new LegislationError("forbidden", "Access denied", { cause: error })
      }
      throw error
    } finally {
      client.release()
    }
  }
  async function policyHash(client: pg.PoolClient, profile: string, text: boolean) {
    await requireRights(client, profile, "apiMcp")
    if (text) {
      await requireRights(client, profile, "displayText")
    }
    const row = await client.query(
      "SELECT policy_hash FROM legislation.legal_rights_profiles WHERE id=$1 AND is_active FOR SHARE",
      [profile]
    )
    return z.object({ policy_hash: z.string().regex(/^[a-f0-9]{64}$/) }).parse(row.rows[0]).policy_hash
  }
  async function visibleProvisionRights(client: pg.PoolClient, provisionId: string) {
    const profiles = z
      .array(z.object({ rights_profile_id: z.string().min(1) }))
      .max(1000)
      .parse(
        (
          await client.query(
            `SELECT DISTINCT e.rights_profile_id FROM legislation.legal_edition_provisions m
            JOIN legislation.legal_editions e ON e.id=m.edition_id AND e.code_id=m.code_id
            WHERE m.provision_id=$1 AND e.jurisdiction_id='jurisdiction:us'
              AND e.source_id IN ('ecfr','govinfo-cfr') AND e.published_at IS NOT NULL
            ORDER BY e.rights_profile_id LIMIT 1001`,
            [provisionId]
          )
        ).rows
      )
    if (profiles.length === 0) {
      throw new LegislationError("not_found", "Published legal provision was not found")
    }
    const rights: { id: string; hash: string }[] = []
    for (const profile of profiles) {
      try {
        rights.push({ id: profile.rights_profile_id, hash: await policyHash(client, profile.rights_profile_id, true) })
      } catch (error) {
        if (
          !(error instanceof Error) ||
          (!error.message.startsWith("rights_denied:") &&
            error.message !== "Invariant failed: rights_profile_unavailable")
        ) {
          throw error
        }
      }
    }
    if (rights.length === 0) {
      throw new LegislationError("forbidden", "Access denied")
    }
    return rights
  }
  return {
    getProvision: async (value: string, selection: unknown) =>
      transaction(async (client) => {
        const provisionId = z.uuid().parse(value)
        const input = legalProvisionRequestSchema.parse(selection)
        if (input.asOf !== undefined) {
          throw new LegislationError("conflict", "Historical date selection is not available", {
            details: { reason: "historical_coverage_unavailable" }
          })
        }
        let selectedEditionId: string | null = null
        if (input.editionId !== undefined || input.versionId === undefined) {
          const profile = await client.query(
            `SELECT e.id AS edition_id,e.rights_profile_id FROM legislation.legal_provisions p
            JOIN legislation.legal_edition_provisions m ON m.provision_id=p.id AND m.code_id=p.code_id
            JOIN legislation.legal_editions e ON e.id=m.edition_id AND e.code_id=m.code_id
            WHERE p.id=$1 AND e.jurisdiction_id='jurisdiction:us' AND e.source_id IN ('ecfr','govinfo-cfr')
              AND e.published_at IS NOT NULL
              AND m.edition_id=COALESCE($2::uuid,(SELECT h.edition_id FROM legislation.legal_code_heads h
                WHERE h.code_id=p.code_id AND h.source_id='ecfr'))
              AND ($3::uuid IS NULL OR m.version_id=$3)`,
            [provisionId, input.editionId ?? null, input.versionId ?? null]
          )
          if (profile.rows.length === 0) {
            throw new LegislationError("not_found", "Selected published provision was not found")
          }
          invariant(profile.rows.length === 1, "legal_provision_selection_ambiguous")
          const selected = z
            .object({ edition_id: z.uuid(), rights_profile_id: z.string().min(1) })
            .parse(profile.rows[0])
          await policyHash(client, selected.rights_profile_id, true)
          selectedEditionId = selected.edition_id
        } else {
          const profiles = z
            .array(z.object({ rights_profile_id: z.string().min(1) }))
            .max(1000)
            .parse(
              (
                await client.query(
                  `SELECT DISTINCT e.rights_profile_id FROM legislation.legal_provision_versions v
                  JOIN legislation.legal_edition_provisions m ON m.version_id=v.id AND m.provision_id=v.provision_id
                  JOIN legislation.legal_editions e ON e.id=m.edition_id AND e.code_id=m.code_id
                  WHERE v.id=$1 AND v.provision_id=$2 AND e.jurisdiction_id='jurisdiction:us'
                    AND e.source_id IN ('ecfr','govinfo-cfr') AND e.published_at IS NOT NULL
                  ORDER BY e.rights_profile_id LIMIT 1001`,
                  [input.versionId, provisionId]
                )
              ).rows
            )
          if (profiles.length === 0) {
            throw new LegislationError("not_found", "Published provision version was not found")
          }
          let authorized = false
          for (const profile of profiles) {
            try {
              await policyHash(client, profile.rights_profile_id, true)
              authorized = true
              break
            } catch (error) {
              if (
                !(error instanceof Error) ||
                (!error.message.startsWith("rights_denied:") &&
                  error.message !== "Invariant failed: rights_profile_unavailable")
              ) {
                throw error
              }
            }
          }
          if (!authorized) {
            throw new LegislationError("forbidden", "Access denied")
          }
        }
        const result =
          selectedEditionId === null
            ? await client.query(
                `SELECT jsonb_build_object(
                'id',p.id,'codeId',p.code_id,'identityKey',p.identity_key,'identityBasis',p.identity_basis,
                'selectedVersion',jsonb_build_object('id',v.id,'provisionId',v.provision_id,'codeId',v.code_id,
                  'contentHash',v.content_hash,'inputContract',v.input_contract,'heading',v.heading,
                  'nodeKind',v.node_kind,'language',v.language),
                'selectedContext',NULL,'textPreview',left(v.body,500),
                'previewTruncated',char_length(v.body)>500) AS data
                FROM legislation.legal_provisions p JOIN legislation.legal_provision_versions v
                  ON v.provision_id=p.id AND v.code_id=p.code_id
                WHERE p.id=$1 AND v.id=$2 FOR SHARE OF p,v`,
                [provisionId, input.versionId]
              )
            : await client.query(
                `SELECT jsonb_build_object(
                'id',p.id,'codeId',p.code_id,'identityKey',p.identity_key,'identityBasis',p.identity_basis,
                'selectedVersion',jsonb_build_object('id',v.id,'provisionId',v.provision_id,'codeId',v.code_id,
                  'contentHash',v.content_hash,'inputContract',v.input_contract,'heading',v.heading,
                  'nodeKind',v.node_kind,'language',v.language),
                'selectedContext',jsonb_build_object(
                  'edition',jsonb_build_object('id',e.id,'codeId',e.code_id,'sourceId',e.source_id,
                    'jurisdictionId',e.jurisdiction_id,'rightsProfileId',e.rights_profile_id,
                    'sourceObservationId',e.generation_id,'nativeKey',e.native_key,'sourceRevision',e.source_revision,
                    'sourceUrl',g.unit->>'sourceUrl','issueDate',e.issue_date::text,
                    'sourceCurrencyDate',e.currency_date::text,
                    'publishedAt',to_char(e.published_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
                    'scope',CASE WHEN e.source_id='ecfr' THEN 'current_code_snapshot' ELSE 'annual_volume' END),
                  'parentId',m.parent_id,'ordinal',m.ordinal,'nativeId',m.native_id,
                  'sourceLocator',m.source_locator,
                  'isLatestValidated',EXISTS(SELECT 1 FROM legislation.legal_code_heads h
                    JOIN legislation.legal_edition_provisions current
                      ON current.edition_id=h.edition_id AND current.provision_id=p.id
                    WHERE h.code_id=p.code_id AND h.source_id='ecfr' AND current.version_id=v.id),
                  'textUrl','/api/legal/versions/'||v.id||'/text?editionId='||e.id),
                'textPreview',left(v.body,500),'previewTruncated',char_length(v.body)>500) AS data
                FROM legislation.legal_provisions p
                JOIN legislation.legal_edition_provisions m ON m.provision_id=p.id AND m.code_id=p.code_id
                JOIN legislation.legal_provision_versions v
                  ON v.id=m.version_id AND v.provision_id=m.provision_id AND v.code_id=m.code_id
                JOIN legislation.legal_editions e ON e.id=m.edition_id AND e.code_id=m.code_id
                JOIN legislation.legal_import_generations g ON g.id=e.generation_id
                WHERE p.id=$1 AND m.edition_id=$2 FOR SHARE OF p,m,v,e,g`,
                [provisionId, selectedEditionId]
              )
        invariant(result.rows.length === 1, "legal_provision_disappeared")
        return legalProvisionDetailSchema.parse(result.rows[0]?.data)
      }),
    getEdition: async (value: string) =>
      transaction(async (client) => {
        const editionId = z.uuid().parse(value)
        // Read only the governing profile before authorization; no edition metadata escapes on denial.
        const profile = await client.query(
          `SELECT rights_profile_id FROM legislation.legal_editions
          WHERE id=$1 AND jurisdiction_id='jurisdiction:us' AND source_id IN ('ecfr','govinfo-cfr')
            AND published_at IS NOT NULL`,
          [editionId]
        )
        if (profile.rows.length === 0) {
          throw new LegislationError("not_found", "Published legal edition was not found")
        }
        invariant(profile.rows.length === 1, "legal_edition_identity_ambiguous")
        const rightsProfileId = z.object({ rights_profile_id: z.string() }).parse(profile.rows[0]).rights_profile_id
        await policyHash(client, rightsProfileId, false)
        const rows = await client.query(
          `SELECT ${editionColumns},
          (SELECT count(*)::integer FROM legislation.legal_edition_provisions m WHERE m.edition_id=e.id) AS "publishedMembers",
          EXISTS(SELECT 1 FROM legislation.legal_code_heads h WHERE h.code_id=e.code_id AND h.source_id=e.source_id AND h.edition_id=e.id) AS "isCurrent",
          CASE WHEN ae.id IS NULL THEN NULL ELSE jsonb_build_object(
            'annualEditionId',ae.id,'codeId',ae.code_id,'packageYear',ae.package_year,
            'revisionDate',ae.revision_date::text,'volume',av.volume,
            'expectedVolumes',ae.expected_volumes,'coverage',ae.coverage) END AS "annualVolume"
          FROM legislation.legal_editions e
          JOIN legislation.legal_import_generations g ON g.id=e.generation_id
          LEFT JOIN legislation.legal_annual_edition_volumes av ON av.edition_id=e.id AND av.code_id=e.code_id
          LEFT JOIN legislation.legal_annual_editions ae ON ae.id=av.annual_edition_id AND ae.code_id=e.code_id
          WHERE e.id=$1 AND e.rights_profile_id=$2 AND e.jurisdiction_id='jurisdiction:us'
            AND e.source_id IN ('ecfr','govinfo-cfr') AND e.published_at IS NOT NULL
          FOR SHARE OF e,g`,
          [editionId, rightsProfileId]
        )
        invariant(rows.rows.length === 1, "legal_edition_disappeared")
        return legalEditionDetailSchema.parse(rows.rows[0])
      }),
    listEditions: async (code: string, value: unknown) =>
      transaction(async (client, caller) => {
        const codeId = z.uuid().parse(code)
        const input = legalEditionsRequestSchema.parse(value)
        const cursor = continuation(input.cursor)
        // Only rights identifiers are read before source authorization. No unauthorized counts or metadata escape.
        const profileRows = await client.query(
          `SELECT DISTINCT rights_profile_id FROM legislation.legal_editions
        WHERE code_id=$1 AND jurisdiction_id='jurisdiction:us' AND source_id IN ('ecfr','govinfo-cfr')
          AND published_at IS NOT NULL ORDER BY rights_profile_id LIMIT 1001`,
          [codeId]
        )
        invariant(profileRows.rows.length <= 1000, "legal_editions_rights_limit")
        const rights: { id: string; hash: string }[] = []
        for (const raw of profileRows.rows) {
          const { rights_profile_id: id } = z.object({ rights_profile_id: z.string() }).parse(raw)
          try {
            rights.push({ id, hash: await policyHash(client, id, false) })
          } catch (error) {
            if (
              !(error instanceof Error) ||
              (!error.message.startsWith("rights_denied:") &&
                error.message !== "Invariant failed: rights_profile_unavailable")
            ) {
              throw error
            }
          }
        }
        const rows = await client.query(
          `SELECT ${editionColumns} FROM legislation.legal_editions e
        JOIN legislation.legal_import_generations g ON g.id=e.generation_id
        WHERE e.code_id=$1 AND e.jurisdiction_id='jurisdiction:us' AND e.source_id IN ('ecfr','govinfo-cfr')
          AND e.published_at IS NOT NULL AND e.rights_profile_id=ANY($2::text[])
        ORDER BY e.issue_date DESC NULLS LAST,e.id LIMIT 10001 FOR SHARE OF e,g`,
          [codeId, rights.map((item) => item.id)]
        )
        invariant(rows.rows.length <= 10000, "legal_editions_catalog_limit")
        const catalog = z.array(legalEditionSchema).parse(rows.rows)
        if (catalog.length === 0) {
          throw new LegislationError("not_found", "Published legal code was not found")
        }
        const selected = catalog.filter(
          (row) =>
            (input.sourceId === undefined || row.sourceId === input.sourceId) &&
            (input.issuedFrom === undefined || (row.issueDate !== null && row.issueDate >= input.issuedFrom)) &&
            (input.issuedTo === undefined || (row.issueDate !== null && row.issueDate <= input.issuedTo))
        )
        const scope = digest(
          JSON.stringify([
            "legal-editions-2026-09-15",
            caller,
            codeId,
            input.sourceId ?? null,
            input.issuedFrom ?? null,
            input.issuedTo ?? null,
            input.limit,
            rights,
            selected
          ])
        )
        if (cursor && cursor.scope !== scope) {
          throw new LegislationError("conflict", "Edition continuation no longer matches the visible catalog")
        }
        const after = cursor ? selected.findIndex((row) => row.id === cursor.editionId) : -1
        if (cursor && (after === -1 || cursor.after !== after)) {
          throw new LegislationError("invalid_request", "Invalid edition continuation")
        }
        const items = selected.slice(after + 1, after + 1 + input.limit)
        const truncated = after + 1 + items.length < selected.length
        const last = items.at(-1)
        return {
          items,
          truncated,
          ...(truncated && last ? { nextCursor: encode(scope, last.id, after + items.length) } : {}),
          warnings: [
            "Published source editions only. Annual volumes are separate components, not a complete historical coverage claim."
          ]
        }
      }),
    listProvisionVersions: async (value: string, query: unknown) =>
      transaction(async (client, caller) => {
        const provisionId = z.uuid().parse(value)
        const input = legalProvisionVersionsRequestSchema.parse(query)
        const cursor = catalogContinuation(input.cursor)
        const rights = await visibleProvisionRights(client, provisionId)
        const rows = await client.query(
          `SELECT v.id,v.provision_id AS "provisionId",v.code_id AS "codeId",v.content_hash AS "contentHash",
          v.input_contract AS "inputContract",v.heading,v.node_kind AS "nodeKind",v.language,
          to_char(min(e.published_at) AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "firstObservedAt",
          to_char(max(e.published_at) AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "lastObservedAt",
          count(DISTINCT e.id)::integer AS "editionCount"
          FROM legislation.legal_provision_versions v
          JOIN legislation.legal_edition_provisions m ON m.version_id=v.id AND m.provision_id=v.provision_id
          JOIN legislation.legal_editions e ON e.id=m.edition_id AND e.code_id=m.code_id
          WHERE v.provision_id=$1 AND e.rights_profile_id=ANY($2::text[])
            AND e.jurisdiction_id='jurisdiction:us' AND e.source_id IN ('ecfr','govinfo-cfr')
            AND e.published_at IS NOT NULL AND ($3::text IS NULL OR e.source_id=$3)
          GROUP BY v.id ORDER BY min(e.published_at) DESC,v.id LIMIT 10001`,
          [provisionId, rights.map(({ id }) => id), input.sourceId ?? null]
        )
        invariant(rows.rows.length <= 10000, "legal_provision_versions_catalog_limit")
        const catalog = z.array(legalProvisionVersionSummarySchema).parse(rows.rows)
        const scope = digest(
          JSON.stringify([
            "legal-provision-versions-2026-09-17",
            caller,
            provisionId,
            input.sourceId ?? null,
            input.limit,
            rights,
            catalog
          ])
        )
        if (cursor && cursor.scope !== scope) {
          throw new LegislationError("conflict", "Version continuation no longer matches the visible catalog")
        }
        const after = cursor ? catalog.findIndex(({ id }) => id === cursor.itemId) : -1
        if (cursor && (after === -1 || cursor.after !== after)) {
          throw new LegislationError("invalid_request", "Invalid version continuation")
        }
        const items = catalog.slice(after + 1, after + 1 + input.limit)
        const truncated = after + 1 + items.length < catalog.length
        const last = items.at(-1)
        return {
          items,
          truncated,
          ...(truncated && last ? { nextCursor: encodeCatalogContinuation(scope, last.id, after + items.length) } : {}),
          warnings: [
            "Published source observations only. Version history does not establish continuous daily coverage."
          ]
        }
      }),
    listProvisionEditions: async (value: string, query: unknown) =>
      transaction(async (client, caller) => {
        const provisionId = z.uuid().parse(value)
        const input = legalProvisionEditionsRequestSchema.parse(query)
        const cursor = catalogContinuation(input.cursor)
        const rights = await visibleProvisionRights(client, provisionId)
        const rows = await client.query(
          `SELECT jsonb_build_object(
            'provisionId',m.provision_id,'versionId',m.version_id,
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
          WHERE m.provision_id=$1 AND e.rights_profile_id=ANY($2::text[])
            AND e.jurisdiction_id='jurisdiction:us' AND e.source_id IN ('ecfr','govinfo-cfr')
            AND e.published_at IS NOT NULL AND ($3::uuid IS NULL OR m.version_id=$3)
            AND ($4::text IS NULL OR e.source_id=$4)
          ORDER BY e.id LIMIT 10001 FOR SHARE OF m,e,g`,
          [provisionId, rights.map(({ id }) => id), input.versionId ?? null, input.sourceId ?? null]
        )
        invariant(rows.rows.length <= 10000, "legal_provision_editions_catalog_limit")
        const catalog = z.array(legalProvisionEditionMembershipSchema).parse(rows.rows.map(({ data }) => data))
        const scope = digest(
          JSON.stringify([
            "legal-provision-editions-2026-09-17",
            caller,
            provisionId,
            input.versionId ?? null,
            input.sourceId ?? null,
            input.limit,
            rights,
            catalog
          ])
        )
        if (cursor && cursor.scope !== scope) {
          throw new LegislationError("conflict", "Edition continuation no longer matches the visible catalog")
        }
        const after = cursor ? catalog.findIndex(({ edition }) => edition.id === cursor.itemId) : -1
        if (cursor && (after === -1 || cursor.after !== after)) {
          throw new LegislationError("invalid_request", "Invalid edition continuation")
        }
        const items = catalog.slice(after + 1, after + 1 + input.limit)
        const truncated = after + 1 + items.length < catalog.length
        const last = items.at(-1)
        return {
          items,
          truncated,
          ...(truncated && last
            ? { nextCursor: encodeCatalogContinuation(scope, last.edition.id, after + items.length) }
            : {}),
          warnings: ["Published source memberships only. Annual volumes may be partial components."]
        }
      }),
    listProvisions: async (code: string, value: unknown) =>
      transaction(async (client, caller) => {
        const codeId = z.uuid().parse(code)
        const input = legalProvisionsRequestSchema.parse(value)
        const cursor = continuation(input.cursor)
        if (input.asOf !== undefined) {
          throw new LegislationError("conflict", "Historical date selection is not available", {
            details: { reason: "historical_coverage_unavailable" }
          })
        }
        const selectedId = input.editionId ?? cursor?.editionId
        const rows = await client.query(
          `SELECT ${editionColumns} FROM legislation.legal_editions e
        JOIN legislation.legal_import_generations g ON g.id=e.generation_id
        WHERE e.code_id=$1 AND e.jurisdiction_id='jurisdiction:us' AND e.source_id IN ('ecfr','govinfo-cfr')
          AND e.published_at IS NOT NULL AND
          (($2::uuid IS NOT NULL AND e.id=$2) OR ($2::uuid IS NULL AND e.id=(SELECT h.edition_id FROM legislation.legal_code_heads h WHERE h.code_id=$1 AND h.source_id='ecfr')))
        FOR SHARE OF e,g`,
          [codeId, selectedId ?? null]
        )
        if (rows.rows.length === 0) {
          throw new LegislationError("not_found", "Selected published edition was not found")
        }
        invariant(rows.rows.length === 1, "legal_edition_selection_ambiguous")
        const edition = legalEditionSchema.parse(rows.rows[0])
        const rights = await policyHash(client, edition.rightsProfileId, true)
        const scope = digest(
          JSON.stringify([
            "legal-provisions-2026-09-15",
            caller,
            codeId,
            input.editionId ?? null,
            input.traversal,
            input.parentId ?? null,
            input.nodeKind ?? null,
            input.limit,
            edition,
            rights
          ])
        )
        if (cursor && (cursor.scope !== scope || cursor.editionId !== edition.id)) {
          throw new LegislationError("conflict", "Provision continuation no longer matches the selected edition")
        }
        if (input.parentId !== undefined) {
          const parent = await client.query(
            "SELECT 1 FROM legislation.legal_edition_provisions WHERE edition_id=$1 AND provision_id=$2",
            [edition.id, input.parentId]
          )
          if (parent.rows.length === 0) {
            throw new LegislationError("not_found", "Parent provision was not found in the selected edition")
          }
        }
        const members = await client.query(
          `SELECT m.provision_id AS id,m.code_id AS "codeId",m.edition_id AS "editionId",
        m.version_id AS "versionId",m.parent_id AS "parentId",m.ordinal,m.native_id AS "nativeId",v.node_kind AS "nodeKind",
        v.heading,m.source_locator AS "sourceLocator",
        EXISTS(SELECT 1 FROM legislation.legal_edition_provisions child WHERE child.edition_id=m.edition_id AND child.parent_id=m.provision_id) AS "hasChildren",
        ('/api/legal/versions/'||m.version_id||'/text?editionId='||m.edition_id) AS "textUrl"
        FROM legislation.legal_edition_provisions m JOIN legislation.legal_provision_versions v ON v.id=m.version_id
        WHERE m.edition_id=$1 AND m.ordinal>$2 AND ($3='all' OR m.parent_id IS NOT DISTINCT FROM $4::uuid)
          AND ($5::text IS NULL OR v.node_kind=$5) ORDER BY m.ordinal,m.provision_id LIMIT $6`,
          [
            edition.id,
            cursor?.after ?? -1,
            input.traversal,
            input.parentId ?? null,
            input.nodeKind ?? null,
            input.limit + 1
          ]
        )
        const parsed = z.array(legalProvisionSummarySchema).parse(members.rows)
        const truncated = parsed.length > input.limit
        const items = parsed.slice(0, input.limit)
        const last = items.at(-1)
        return {
          items,
          selectedEdition: edition,
          truncated,
          ...(truncated && last ? { nextCursor: encode(scope, edition.id, last.ordinal) } : {}),
          warnings: ["Selected source structure only. This does not establish legal status or search readiness."]
        }
      })
  }
}
