import {
  legalCitationCandidateSchema,
  legalCitationRequestSchema,
  legalCitationResolutionSchema
} from "@repo/legislation-core/api-client/legal-citation-contract"
import { getRequestContext } from "@repo/legislation-core/auth/request-context"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import { requireRights } from "@repo/legislation-core/legal-text/rights"
import type pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"

const cfrIdentity = /^cfr:(\d{1,2}):section:([^\s:]+)$/i
const printedCfr = /^(\d{1,2})\s+c\.?\s*f\.?\s*r\.?\s*(?:§{1,2}\s*)?([^\s:]+)$/i
const bareSection = /^(?:§{1,2}|section)\s*([^\s:]+)$/i

type NormalizedCitation = Readonly<{
  aliases: readonly string[]
  cfrTitle?: number
  normalizedInput: string
  requiresCodeContext: boolean
  section?: string
}>

function cfr(title: string, section: string): NormalizedCitation {
  const numericTitle = Number(title)
  if (!Number.isSafeInteger(numericTitle) || numericTitle < 1 || numericTitle > 50) {
    throw new LegislationError("invalid_request", "Invalid CFR title in citation")
  }
  const identity = `cfr:${numericTitle}:section:${section.toLocaleLowerCase("en-US")}`
  return {
    aliases: [identity],
    cfrTitle: numericTitle,
    normalizedInput: identity,
    requiresCodeContext: false,
    section
  }
}

export function normalizeLegalCitation(value: string): NormalizedCitation {
  const input = value.trim().replaceAll(/\s+/g, " ")
  const canonical = cfrIdentity.exec(input)
  if (canonical?.[1] && canonical[2]) {
    return cfr(canonical[1], canonical[2])
  }
  const printed = printedCfr.exec(input)
  if (printed?.[1] && printed[2]) {
    return cfr(printed[1], printed[2])
  }
  const bare = bareSection.exec(input)
  if (bare?.[1]) {
    const section = bare[1]
    return {
      aliases: [],
      normalizedInput: `section:${section.toLocaleLowerCase("en-US")}`,
      requiresCodeContext: true,
      section
    }
  }
  const exact = input.toLocaleLowerCase("en-US")
  return { aliases: [exact], normalizedInput: exact, requiresCodeContext: false }
}

const selectedEditionSchema = z.strictObject({
  id: z.uuid(),
  code_id: z.uuid(),
  code_key: z.string().min(1),
  rights_profile_id: z.string().min(1)
})

export function createLegalCitationResolver(pool: pg.Pool, allowedOrganizationIds: readonly string[]) {
  const allowed = new Set(z.array(z.string().min(1).max(256)).max(1000).parse(allowedOrganizationIds))
  return async (value: unknown) => {
    const identity = getRequestContext()?.identity
    if (!identity?.userId) {
      throw new LegislationError("unauthorized", "Bearer token is absent or invalid")
    }
    if (!identity.organizationId || !allowed.has(identity.organizationId)) {
      throw new LegislationError("forbidden", "Access denied")
    }
    const input = legalCitationRequestSchema.parse(value)
    if (input.asOf !== undefined) {
      throw new LegislationError("conflict", "Historical date selection is not available", {
        details: { reason: "historical_coverage_unavailable" }
      })
    }
    const normalized = normalizeLegalCitation(input.citation)
    const client = await pool.connect()
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ")
      await client.query("SET LOCAL lock_timeout='5s'")
      await client.query("SET LOCAL statement_timeout='15s'")

      if (input.codeId !== undefined) {
        const code = await client.query(
          "SELECT code_key,jurisdiction_id FROM legislation.legal_codes WHERE id=$1 FOR SHARE",
          [input.codeId]
        )
        if (code.rows.length === 0) {
          throw new LegislationError("invalid_request", "Unknown legal code")
        }
        invariant(code.rows.length === 1, "legal_code_identity_ambiguous")
        const selected = z.strictObject({ code_key: z.string(), jurisdiction_id: z.string() }).parse(code.rows[0])
        if (
          selected.jurisdiction_id !== input.jurisdictionId ||
          (normalized.cfrTitle !== undefined && selected.code_key !== `cfr-title-${normalized.cfrTitle}`)
        ) {
          throw new LegislationError("invalid_request", "Citation and legal code constraints conflict")
        }
      }

      const editions = z
        .array(selectedEditionSchema)
        .max(1000)
        .parse(
          (
            await client.query(
              `SELECT e.id,e.code_id,c.code_key,e.rights_profile_id
            FROM legislation.legal_editions e
            JOIN legislation.legal_codes c ON c.id=e.code_id AND c.jurisdiction_id=e.jurisdiction_id
            WHERE e.published_at IS NOT NULL AND e.jurisdiction_id=$1
              AND e.source_id IN ('ecfr','govinfo-cfr')
              AND ($2::uuid IS NULL OR e.code_id=$2)
              AND ($3::text IS NULL OR c.code_key=$3)
              AND (($4::uuid IS NOT NULL AND e.id=$4) OR
                ($4::uuid IS NULL AND EXISTS(SELECT 1 FROM legislation.legal_code_heads h
                  WHERE h.code_id=e.code_id AND h.source_id='ecfr' AND h.edition_id=e.id)))
            ORDER BY c.code_key,e.id LIMIT 1001 FOR SHARE OF e,c`,
              [
                input.jurisdictionId,
                input.codeId ?? null,
                normalized.cfrTitle === undefined ? null : `cfr-title-${normalized.cfrTitle}`,
                input.editionId ?? null
              ]
            )
          ).rows
        )
      if (input.editionId !== undefined && editions.length === 0) {
        const conflicting = await client.query(
          `SELECT e.code_id,e.jurisdiction_id,c.code_key FROM legislation.legal_editions e
          JOIN legislation.legal_codes c ON c.id=e.code_id
          WHERE e.id=$1 AND e.published_at IS NOT NULL FOR SHARE OF e,c`,
          [input.editionId]
        )
        if (conflicting.rows.length === 1) {
          const selected = z
            .strictObject({ code_id: z.uuid(), code_key: z.string(), jurisdiction_id: z.string() })
            .parse(conflicting.rows[0])
          if (
            selected.jurisdiction_id !== input.jurisdictionId ||
            (input.codeId !== undefined && selected.code_id !== input.codeId) ||
            (normalized.cfrTitle !== undefined && selected.code_key !== `cfr-title-${normalized.cfrTitle}`)
          ) {
            throw new LegislationError(
              "invalid_request",
              "Citation, edition and jurisdiction or code constraints conflict"
            )
          }
        }
      }

      const authorized: string[] = []
      for (const edition of editions) {
        try {
          await requireRights(client, edition.rights_profile_id, "apiMcp")
          await requireRights(client, edition.rights_profile_id, "displayText")
          authorized.push(edition.id)
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
      if (editions.length > 0 && authorized.length === 0) {
        throw new LegislationError("forbidden", "Access denied")
      }

      const candidates = z
        .array(legalCitationCandidateSchema)
        .max(26)
        .parse(
          (
            await client.query(
              `SELECT m.provision_id AS "provisionId",m.version_id AS "versionId",m.code_id AS "codeId",
              m.edition_id AS "editionId",e.jurisdiction_id AS "jurisdictionId",c.code_key AS "codeKey",
              c.name AS "codeName",m.native_id AS citation,p.identity_key AS "identityKey",
              v.node_kind AS "nodeKind",v.heading,m.source_locator AS "sourceLocator",
              ('/api/legal/versions/'||m.version_id||'/text?editionId='||m.edition_id) AS "textUrl"
            FROM legislation.legal_edition_provisions m
            JOIN legislation.legal_editions e ON e.id=m.edition_id AND e.code_id=m.code_id
            JOIN legislation.legal_codes c ON c.id=m.code_id
            JOIN legislation.legal_provisions p ON p.id=m.provision_id AND p.code_id=m.code_id
            JOIN legislation.legal_provision_versions v ON v.id=m.version_id AND v.provision_id=m.provision_id
            WHERE m.edition_id=ANY($1::uuid[]) AND
              ((cardinality($2::text[])>0 AND (lower(m.native_id)=ANY($2::text[]) OR lower(p.identity_key)=ANY($2::text[])))
                OR ($3::text IS NOT NULL AND lower(m.source_attributes->>'N')=lower($3)))
            ORDER BY c.code_key,m.native_id,m.provision_id LIMIT 26 FOR SHARE OF m,e,c,p,v`,
              [authorized, normalized.aliases, normalized.section ?? null]
            )
          ).rows
        )
      const visible = candidates.slice(0, 25)
      const needsScope = normalized.requiresCodeContext && input.codeId === undefined && input.editionId === undefined
      let resolution: z.infer<typeof legalCitationResolutionSchema>
      if (candidates.length === 1 && !needsScope) {
        resolution = legalCitationResolutionSchema.parse({
          input: input.citation,
          normalizedInput: normalized.normalizedInput,
          status: "resolved",
          match: candidates[0],
          candidates: [],
          truncated: false,
          refinement: null
        })
      } else if (candidates.length > 0) {
        resolution = legalCitationResolutionSchema.parse({
          input: input.citation,
          normalizedInput: normalized.normalizedInput,
          status: "ambiguous",
          match: null,
          candidates: visible,
          truncated: candidates.length > visible.length,
          refinement: needsScope ? "code_or_edition_required" : "more_specific_citation_required"
        })
      } else {
        resolution = legalCitationResolutionSchema.parse({
          input: input.citation,
          normalizedInput: normalized.normalizedInput,
          status: "not_found",
          match: null,
          candidates: [],
          truncated: false,
          refinement: null
        })
      }
      await client.query("COMMIT")
      return resolution
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    } finally {
      client.release()
    }
  }
}
