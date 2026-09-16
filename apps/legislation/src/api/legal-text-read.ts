import type pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"
import { legalTextRequestSchema } from "../api-client/legal-text-contract.js"
import { getRequestContext } from "../auth/request-context.js"
import { digest } from "../ingestion/regulations/contracts.js"
import { buildStoredLegalTextProjection, readLegalTextWindow } from "../ingestion/regulations/reader-text.js"
import { requireRights } from "../ingestion/regulations/storage.js"
import { LegislationError } from "../legislation/errors.js"

const metadataSchema = z.object({
  owner_id: z.uuid(),
  source_id: z.string(),
  jurisdiction_id: z.string(),
  rights_profile_id: z.string(),
  source_locator: z.string(),
  observation_id: z.string(),
  parent_id: z.uuid().nullable(),
  currency_date: z.iso.date().nullable(),
  publication_date: z.iso.date().nullable()
})
const bodySchema = z.object({ body: z.string(), blocks: z.unknown(), input_contract: z.string() })

/** Reads one explicitly selected source. No search receipt, tokenizer, embedding or latest-head dependency. */
export function createLegalTextReader(pool: pg.Pool, allowedOrganizationIds: readonly string[]) {
  const allowed = new Set(z.array(z.string().min(1).max(256)).max(1000).parse(allowedOrganizationIds))
  return async (version: string, unparsed: unknown) => {
    const identity = getRequestContext()?.identity
    if (!identity?.userId) {
      throw new LegislationError("unauthorized", "Bearer token is absent or invalid")
    }
    if (!identity.organizationId || !allowed.has(identity.organizationId)) {
      throw new LegislationError("forbidden", "Access denied")
    }
    const versionId = z.uuid().parse(version)
    const input = legalTextRequestSchema.parse(unparsed)
    const client = await pool.connect()
    try {
      await client.query("BEGIN")
      await client.query("SET LOCAL lock_timeout='5s'")
      await client.query("SET LOCAL statement_timeout='15s'")
      // Lock the selected immutable membership and source rights before requesting any body or source blocks.
      const rows =
        input.editionId !== undefined
          ? await client.query(
              `SELECT v.provision_id AS owner_id,e.source_id,e.jurisdiction_id,
            e.rights_profile_id,m.source_locator,e.generation_id AS observation_id,m.parent_id,
            e.currency_date::text,NULL::text AS publication_date
          FROM legislation.legal_provision_versions v
          JOIN legislation.legal_edition_provisions m ON m.version_id=v.id
          JOIN legislation.legal_editions e ON e.id=m.edition_id
          WHERE v.id=$1 AND e.id=$2 AND e.published_at IS NOT NULL FOR SHARE OF v,m,e`,
              [versionId, input.editionId]
            )
          : await client.query(
              `SELECT v.document_id AS owner_id,o.source_id,o.jurisdiction_id,
            o.rights_profile_id,o.source_locator,o.id::text AS observation_id,NULL::uuid AS parent_id,
            NULL::text AS currency_date,o.publication_date::text
          FROM legislation.regulatory_document_versions v
          JOIN legislation.regulatory_document_observations o ON o.version_id=v.id
          JOIN legislation.regulatory_publication_batches b ON b.generation_id=o.generation_id
          WHERE v.id=$1 AND o.id=$2 FOR SHARE OF v,o,b`,
              [versionId, input.sourceObservationId]
            )
      if (rows.rows.length === 0) {
        throw new LegislationError("not_found", "Selected legal text was not found")
      }
      invariant(rows.rows.length === 1, "legal_text_ambiguous_selection")
      const metadata = metadataSchema.parse(rows.rows[0])
      if (
        metadata.jurisdiction_id !== "jurisdiction:us" ||
        !["ecfr", "govinfo-cfr", "govinfo-fr"].includes(metadata.source_id)
      ) {
        throw new LegislationError("forbidden", "Access denied")
      }
      await requireRights(client, metadata.rights_profile_id, "apiMcp")
      await requireRights(client, metadata.rights_profile_id, "displayText")
      const rights = z
        .object({ policy_hash: z.string().regex(/^[a-f0-9]{64}$/) })
        .parse(
          (
            await client.query(
              "SELECT policy_hash FROM legislation.legal_rights_profiles WHERE id=$1 AND is_active FOR SHARE",
              [metadata.rights_profile_id]
            )
          ).rows[0]
        )
      const table = input.editionId !== undefined ? "legal_provision_versions" : "regulatory_document_versions"
      // The bound excludes oversized values in PostgreSQL, before loading them into the serving process.
      const text = await client.query(
        `SELECT body,blocks,input_contract FROM legislation.${table}
        WHERE id=$1 AND octet_length(body)<=67108864 AND octet_length(blocks::text)<=67108864 FOR SHARE`,
        [versionId]
      )
      if (text.rows.length !== 1) {
        throw new LegislationError("payload_too_large", "Selected source exceeds the reader size limit")
      }
      const stored = bodySchema.parse(text.rows[0])
      const projection = buildStoredLegalTextProjection({
        versionId,
        body: stored.body,
        blocks: stored.blocks,
        inputContract: stored.input_contract
      })
      const selectedContext =
        input.editionId !== undefined
          ? {
              kind: "provision" as const,
              editionId: input.editionId,
              provisionId: metadata.owner_id,
              versionId,
              sourceObservationId: metadata.observation_id,
              sourceId: metadata.source_id,
              rightsPolicyHash: rights.policy_hash,
              parentId: metadata.parent_id,
              sourceLocator: metadata.source_locator,
              sourceCurrencyDate: metadata.currency_date,
              selectedDate: metadata.source_id === "govinfo-cfr" ? metadata.currency_date : null,
              basis:
                metadata.source_id === "govinfo-cfr" ? ("published_edition" as const) : ("observed_snapshot" as const),
              legalStatus: "unknown" as const
            }
          : {
              kind: "publication" as const,
              documentId: metadata.owner_id,
              versionId,
              sourceObservationId: metadata.observation_id,
              sourceId: metadata.source_id,
              sourceLocator: metadata.source_locator,
              rightsPolicyHash: rights.policy_hash,
              publishedOn: z.iso.date().parse(metadata.publication_date),
              legalStatus: "unknown" as const
            }
      const window = readLegalTextWindow(projection, {
        ...input,
        scope: {
          callerKey: digest(JSON.stringify([identity.organizationId, identity.userId])),
          editionId: input.editionId ?? null,
          sourceObservationId: metadata.observation_id,
          rightsPolicyHash: rights.policy_hash
        }
      })
      await client.query("COMMIT")
      return { ...window, selectedContext }
    } catch (error) {
      await client.query("ROLLBACK")
      const message = error instanceof Error ? error.message : ""
      if (message.startsWith("rights_denied:") || message === "Invariant failed: rights_profile_unavailable") {
        throw new LegislationError("forbidden", "Access denied", { cause: error })
      }
      if (message === "Invariant failed: legal_reader_cursor_scope_mismatch") {
        throw new LegislationError("conflict", "Text continuation no longer matches the selected source", {
          cause: error
        })
      }
      if (message === "Invariant failed: invalid_legal_reader_cursor" || error instanceof SyntaxError) {
        throw new LegislationError("invalid_request", "Invalid text continuation", { cause: error })
      }
      if (message === "Invariant failed: legal_reader_anchor_not_found") {
        throw new LegislationError("not_found", "Text anchor was not found", { cause: error })
      }
      throw error
    } finally {
      client.release()
    }
  }
}
