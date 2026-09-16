import type pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"
import {
  legalEditionSchema,
  legalEditionsRequestSchema,
  legalProvisionSummarySchema,
  legalProvisionsRequestSchema
} from "../api-client/legal-browse-contract.js"
import { getRequestContext } from "../auth/request-context.js"
import { digest } from "../ingestion/regulations/contracts.js"
import { requireRights } from "../ingestion/regulations/storage.js"
import { LegislationError } from "../legislation/errors.js"

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
  return {
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
