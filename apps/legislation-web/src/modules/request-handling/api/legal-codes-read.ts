import { legalCodeSchema, legalCodesRequestSchema } from "@repo/legislation-core/api-client/legal-codes-contract"
import { getRequestContext } from "@repo/legislation-core/auth/request-context"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import { digest } from "@repo/legislation-core/legal-text/contracts"
import { assertRights } from "@repo/legislation-core/legal-text/storage-contract"
import type pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"

const cursorSchema = z.strictObject({ scope: z.string().regex(/^[a-f0-9]{64}$/), after: z.uuid() })
const profileSchema = z.object({ id: z.string(), policy: z.unknown(), policy_hash: z.string() })

/** Bounded metadata catalog. Publication is not a lexical or semantic readiness claim. */
export function createLegalCodesReader(pool: pg.Pool, allowedOrganizationIds: readonly string[]) {
  const allowed = new Set(z.array(z.string().min(1).max(256)).max(1000).parse(allowedOrganizationIds))
  const read = async (unparsed: unknown, codeId?: string) => {
    const identity = getRequestContext()?.identity
    if (!identity?.userId) {
      throw new LegislationError("unauthorized", "Bearer token is absent or invalid")
    }
    if (!identity.organizationId || !allowed.has(identity.organizationId)) {
      throw new LegislationError("forbidden", "Access denied")
    }
    const input = legalCodesRequestSchema.parse(unparsed)
    let cursor: z.infer<typeof cursorSchema> | undefined
    if (input.cursor !== undefined) {
      try {
        cursor = cursorSchema.parse(JSON.parse(Buffer.from(input.cursor, "base64url").toString("utf8")))
      } catch {
        throw new LegislationError("invalid_request", "Invalid code continuation")
      }
    }
    const client = await pool.connect()
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ")
      await client.query("SET LOCAL lock_timeout='5s'")
      await client.query("SET LOCAL statement_timeout='15s'")
      // Lock rights before catalog aggregation. Future licensed sources need an explicit serving policy.
      const profiles = await client.query(`SELECT r.id,r.policy,r.policy_hash
        FROM legislation.legal_rights_profiles r WHERE r.is_active AND EXISTS (
          SELECT 1 FROM legislation.legal_editions e WHERE e.rights_profile_id=r.id
          AND e.published_at IS NOT NULL AND e.jurisdiction_id='jurisdiction:us'
          AND e.source_id IN ('ecfr','govinfo-cfr')) ORDER BY r.id LIMIT 1001 FOR SHARE OF r`)
      invariant(profiles.rows.length <= 1000, "legal_codes_rights_catalog_limit")
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
        `SELECT c.id,c.jurisdiction_id AS "jurisdictionId",
        c.code_key AS "codeKey",c.name,c.kind,('/api/legal/codes/'||c.id) AS "canonicalUrl",
        to_char(max(e.published_at) AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "updatedAt",
        jsonb_agg(DISTINCT jsonb_build_object('sourceId',e.source_id,'rightsProfileId',e.rights_profile_id)
          ORDER BY jsonb_build_object('sourceId',e.source_id,'rightsProfileId',e.rights_profile_id)) AS sources
        FROM legislation.legal_codes c JOIN legislation.legal_editions e ON e.code_id=c.id
        WHERE e.published_at IS NOT NULL AND e.rights_profile_id=ANY($1::text[])
          AND c.jurisdiction_id='jurisdiction:us' AND e.source_id IN ('ecfr','govinfo-cfr')
          AND ($2::text IS NULL OR c.jurisdiction_id=$2) AND ($3::text IS NULL OR c.kind=$3)
          AND ($4::uuid IS NULL OR c.id=$4)
        GROUP BY c.id ORDER BY c.jurisdiction_id COLLATE "C",c.name COLLATE "C",c.id LIMIT 10001`,
        [permitted.map((profile) => profile.id), input.jurisdictionId ?? null, input.kind ?? null, codeId ?? null]
      )
      invariant(result.rows.length <= 10000, "legal_codes_catalog_limit")
      const catalog = z.array(legalCodeSchema).parse(result.rows)
      const scope = digest(
        JSON.stringify([
          "legal-codes-2026-09-15",
          identity.organizationId,
          identity.userId,
          input.jurisdictionId ?? null,
          input.kind ?? null,
          input.limit,
          permitted,
          catalog
        ])
      )
      if (cursor !== undefined && cursor.scope !== scope) {
        throw new LegislationError("conflict", "Code continuation no longer matches the visible catalog")
      }
      const after = cursor === undefined ? -1 : catalog.findIndex((row) => row.id === cursor.after)
      if (cursor !== undefined && after === -1) {
        throw new LegislationError("invalid_request", "Invalid code continuation")
      }
      const items = catalog.slice(after + 1, after + 1 + input.limit)
      const last = items.at(-1)
      const truncated = after + 1 + items.length < catalog.length
      const nextCursor =
        truncated && last !== undefined
          ? Buffer.from(JSON.stringify({ scope, after: last.id })).toString("base64url")
          : undefined
      await client.query("COMMIT")
      return {
        items,
        truncated,
        ...(nextCursor === undefined ? {} : { nextCursor }),
        warnings: [
          "Published federal code metadata only. Catalog membership does not establish complete historical, lexical or semantic coverage."
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
    listCodes: (input: unknown) => read(input),
    getCode: async (codeId: string) => {
      const id = z.uuid().parse(codeId)
      const page = await read({ limit: 1 }, id)
      const code = page.items[0]
      if (code === undefined) {
        throw new LegislationError("not_found", "Legal code not found")
      }
      invariant(code.id === id && page.items.length === 1 && !page.truncated, "legal_code_identity_mismatch")
      return code
    }
  }
}
