import {
  legalPassageRequestSchema,
  legalPassageSchema,
  legalPassagesRequestSchema
} from "@repo/legislation-core/api-client/legal-passage-contract"
import { getRequestContext } from "@repo/legislation-core/auth/request-context"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import { digest } from "@repo/legislation-core/legal-text/contracts"
import { requireLegalCopyReceiptRevisions } from "@repo/legislation-core/legal-text/copy-receipt-revisions"
import { legalTransferRowSchema } from "@repo/legislation-core/legal-text/passage-contract"
import { requireRights } from "@repo/legislation-core/legal-text/rights"
import type pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"

const hash = z.string().regex(/^[a-f0-9]{64}$/)
const cursorSchema = z.strictObject({ scope: hash, afterOrdinal: z.int().nonnegative(), afterId: hash })
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
const generationSchema = z.object({ generation_id: hash })

function dependencyUnavailable() {
  return new LegislationError("dependency_unavailable", "Selected source does not have one verified passage generation")
}

/** Serves source-backed retrieval passages only from a completed, acknowledged preparation. */
export function createLegalPassageReader(
  pool: pg.Pool,
  searchPool: pg.Pool | undefined,
  allowedOrganizationIds: readonly string[]
) {
  const allowed = new Set(z.array(z.string().min(1).max(256)).max(1000).parse(allowedOrganizationIds))

  async function readSelection(
    client: pg.PoolClient,
    versionId: string,
    input: z.infer<typeof legalPassageRequestSchema>
  ) {
    const rows =
      input.editionId !== undefined
        ? await client.query(
            `SELECT v.provision_id AS owner_id,e.source_id,e.jurisdiction_id,e.rights_profile_id,
              m.source_locator,e.generation_id AS observation_id,m.parent_id,e.currency_date::text,
              NULL::text AS publication_date
            FROM legislation.legal_provision_versions v
            JOIN legislation.legal_edition_provisions m ON m.version_id=v.id
            JOIN legislation.legal_editions e ON e.id=m.edition_id
            WHERE v.id=$1 AND e.id=$2 AND e.published_at IS NOT NULL FOR SHARE OF v,m,e`,
            [versionId, input.editionId]
          )
        : await client.query(
            `SELECT v.document_id AS owner_id,o.source_id,o.jurisdiction_id,o.rights_profile_id,
              o.source_locator,o.id::text AS observation_id,NULL::uuid AS parent_id,
              NULL::text AS currency_date,o.publication_date::text
            FROM legislation.regulatory_document_versions v
            JOIN legislation.regulatory_document_observations o ON o.version_id=v.id
            JOIN legislation.regulatory_publication_batches b ON b.generation_id=o.generation_id
            WHERE v.id=$1 AND o.id=$2 FOR SHARE OF v,o,b`,
            [versionId, input.sourceObservationId]
          )
    if (rows.rows.length === 0) {
      throw new LegislationError("not_found", "Selected legal version context was not found")
    }
    invariant(rows.rows.length === 1, "legal_passage_ambiguous_selection")
    const metadata = metadataSchema.parse(rows.rows[0])
    if (
      metadata.jurisdiction_id !== "jurisdiction:us" ||
      !["ecfr", "govinfo-cfr", "govinfo-fr"].includes(metadata.source_id)
    ) {
      throw new LegislationError("forbidden", "Access denied")
    }
    await requireRights(client, metadata.rights_profile_id, "apiMcp")
    await requireRights(client, metadata.rights_profile_id, "displayText")
    const rights = hash.parse(
      (
        await client.query(
          "SELECT policy_hash FROM legislation.legal_rights_profiles WHERE id=$1 AND is_active FOR SHARE",
          [metadata.rights_profile_id]
        )
      ).rows[0]?.policy_hash
    )
    if (searchPool === undefined) {
      throw dependencyUnavailable()
    }
    const scopeKind = input.editionId !== undefined ? "edition" : "publication"
    const scopeId = input.editionId ?? input.sourceObservationId!
    const target = await searchPool.connect()
    try {
      await target.query("BEGIN ISOLATION LEVEL REPEATABLE READ")
      await target.query("SET LOCAL lock_timeout='5s'")
      await target.query("SET LOCAL statement_timeout='15s'")
      const receipts = z.array(z.object({ preparation_id: hash, generation_count: z.int().positive() })).parse(
        (
          await target.query(
            `SELECT preparation_id,generation_count FROM legislation.legal_search_scopes
              WHERE scope_kind=$1 AND scope_id=$2 FOR SHARE`,
            [scopeKind, scopeId]
          )
        ).rows
      )
      if (receipts.length !== 1) {
        throw dependencyUnavailable()
      }
      const receipt = receipts[0]!
      if (
        (
          await target.query(
            "SELECT 1 FROM legislation.legal_search_revocations WHERE scope_kind=$1 AND scope_id=$2 LIMIT 1",
            [scopeKind, scopeId]
          )
        ).rowCount !== 0
      ) {
        throw dependencyUnavailable()
      }
      const generations =
        input.editionId !== undefined
          ? await client.query(
              `SELECT i.generation_id FROM legislation.legal_passage_preparations p
              JOIN legislation.legal_passage_preparation_items i ON i.preparation_id=p.id
              JOIN legislation.legal_derived_outbox o ON o.edition_id=p.edition_id AND o.operation='lexical'
              WHERE p.id=$1 AND p.edition_id=$2 AND i.version_id=$3 AND i.generation_id IS NOT NULL
                AND p.state='prepared' AND p.lease_token IS NULL AND o.state='acknowledged'
              ORDER BY i.generation_id LIMIT 1001 FOR SHARE OF p,i,o`,
              [receipt.preparation_id, input.editionId, versionId]
            )
          : await client.query(
              `SELECT i.generation_id FROM legislation.legal_passage_preparations p
              JOIN legislation.legal_passage_preparation_items i ON i.preparation_id=p.id
              JOIN legislation.regulatory_publication_outbox o ON o.observation_id=p.observation_id
              WHERE p.id=$1 AND p.observation_id=$2 AND i.version_id=$3 AND i.generation_id IS NOT NULL
                AND p.state='prepared' AND p.lease_token IS NULL AND o.state='acknowledged'
              ORDER BY i.generation_id LIMIT 1001 FOR SHARE OF p,i,o`,
              [receipt.preparation_id, input.sourceObservationId, versionId]
            )
      if (generations.rows.length > 1000) {
        throw dependencyUnavailable()
      }
      const generationIds = [
        ...new Set(
          z
            .array(generationSchema)
            .parse(generations.rows)
            .map((row) => row.generation_id)
        )
      ]
      if (generationIds.length !== 1) {
        throw dependencyUnavailable()
      }
      const generationId = generationIds[0]!
      if (
        (
          await target.query(
            `SELECT 1 FROM legislation.legal_search_memberships
            WHERE scope_kind=$1 AND scope_id=$2 AND generation_id=$3 FOR SHARE`,
            [scopeKind, scopeId, generationId]
          )
        ).rowCount !== 1
      ) {
        throw dependencyUnavailable()
      }
      await requireLegalCopyReceiptRevisions(client, target, [
        { kind: scopeKind, id: scopeId, preparationId: receipt.preparation_id, count: receipt.generation_count }
      ])
      const generation = z
        .object({
          provision_version_id: z.uuid().nullable(),
          document_version_id: z.uuid().nullable(),
          passage_count: z.int().nonnegative()
        })
        .parse(
          (
            await client.query(
              `SELECT provision_version_id,document_version_id,passage_count
              FROM legislation.legal_passage_generations WHERE id=$1 FOR SHARE`,
              [generationId]
            )
          ).rows[0]
        )
      const storedCount = z
        .int()
        .nonnegative()
        .parse(
          (
            await client.query(
              "SELECT count(*)::integer AS count FROM legislation.legal_passages WHERE generation_id=$1",
              [generationId]
            )
          ).rows[0]?.count
        )
      if (
        generation.provision_version_id !== (input.editionId === undefined ? null : versionId) ||
        generation.document_version_id !== (input.sourceObservationId === undefined ? null : versionId) ||
        generation.passage_count !== storedCount
      ) {
        throw dependencyUnavailable()
      }
      const selectedContext =
        input.editionId !== undefined
          ? {
              kind: "provision" as const,
              editionId: input.editionId,
              provisionId: metadata.owner_id,
              versionId,
              sourceObservationId: metadata.observation_id,
              sourceId: metadata.source_id,
              rightsPolicyHash: rights,
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
              rightsPolicyHash: rights,
              publishedOn: z.iso.date().parse(metadata.publication_date),
              legalStatus: "unknown" as const
            }
      await target.query("COMMIT")
      return { generationId, rights, selectedContext }
    } catch (error) {
      await target.query("ROLLBACK")
      throw error
    } finally {
      target.release()
    }
  }

  function authorize() {
    const identity = getRequestContext()?.identity
    if (!identity?.userId) {
      throw new LegislationError("unauthorized", "Bearer token is absent or invalid")
    }
    if (!identity.organizationId || !allowed.has(identity.organizationId)) {
      throw new LegislationError("forbidden", "Access denied")
    }
    return identity
  }

  function project(
    row: z.infer<typeof legalTransferRowSchema>,
    generationId: string,
    selectedContext: Awaited<ReturnType<typeof readSelection>>["selectedContext"]
  ) {
    invariant(row.data.versionId === selectedContext.versionId, "legal_passage_version_mismatch")
    const anchor = row.data.readerSpans[0]?.blockId
    const selector =
      selectedContext.kind === "provision"
        ? `editionId=${selectedContext.editionId}`
        : `sourceObservationId=${selectedContext.sourceObservationId}`
    return legalPassageSchema.parse({
      id: row.id,
      generationId,
      versionId: row.data.versionId,
      ordinal: row.ordinal,
      start: row.data.start,
      end: row.data.end,
      text: row.body,
      tokenCount: row.data.tokenCount,
      readerSpans: row.data.readerSpans,
      contextSpans: row.data.contextSpans,
      inputHash: row.data.inputHash,
      rowContinuation: row.data.rowContinuation,
      selectedContext,
      textUrl: `/api/legal/versions/${row.data.versionId}/text?${selector}${anchor ? `&anchor=${anchor}` : ""}`
    })
  }

  async function transaction<T>(action: (client: pg.PoolClient) => Promise<T>) {
    const client = await pool.connect()
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ")
      await client.query("SET LOCAL lock_timeout='5s'")
      await client.query("SET LOCAL statement_timeout='15s'")
      const result = await action(client)
      await client.query("COMMIT")
      return result
    } catch (error) {
      await client.query("ROLLBACK")
      const message = error instanceof Error ? error.message : ""
      if (message.startsWith("rights_denied:") || message === "Invariant failed: rights_profile_unavailable") {
        throw new LegislationError("forbidden", "Access denied", { cause: error })
      }
      throw error
    } finally {
      client.release()
    }
  }

  return {
    listPassages: async (value: string, unparsed: unknown) => {
      const identity = authorize()
      const versionId = z.uuid().parse(value)
      const input = legalPassagesRequestSchema.parse(unparsed)
      let cursor: z.infer<typeof cursorSchema> | undefined
      if (input.cursor !== undefined) {
        try {
          cursor = cursorSchema.parse(JSON.parse(Buffer.from(input.cursor, "base64url").toString("utf8")))
        } catch {
          throw new LegislationError("invalid_request", "Invalid passage continuation")
        }
      }
      return transaction(async (client) => {
        const selection = await readSelection(client, versionId, input)
        const scope = digest(
          JSON.stringify([
            "legal-passages-2026-09-17",
            identity.organizationId,
            identity.userId,
            versionId,
            input.editionId ?? null,
            input.sourceObservationId ?? null,
            selection.generationId,
            selection.rights,
            input.limit
          ])
        )
        if (cursor !== undefined && cursor.scope !== scope) {
          throw new LegislationError("conflict", "Passage continuation no longer matches the selected source")
        }
        const rows = z.array(legalTransferRowSchema).parse(
          (
            await client.query(
              `SELECT id,ordinal,body,input_text,data FROM legislation.legal_passages
          WHERE generation_id=$1 AND ($2::integer IS NULL OR (ordinal,id)>($2,$3))
          ORDER BY ordinal,id LIMIT $4 FOR SHARE`,
              [selection.generationId, cursor?.afterOrdinal ?? null, cursor?.afterId ?? null, input.limit + 1]
            )
          ).rows
        )
        const truncated = rows.length > input.limit
        const page = rows.slice(0, input.limit)
        const last = page.at(-1)
        const nextCursor =
          truncated && last
            ? Buffer.from(JSON.stringify({ scope, afterOrdinal: last.ordinal, afterId: last.id })).toString("base64url")
            : undefined
        return {
          items: page.map((row) => project(row, selection.generationId, selection.selectedContext)),
          truncated,
          ...(nextCursor ? { nextCursor } : {}),
          warnings: ["Passages are retrieval excerpts. Use textUrl for the exact source text."]
        }
      })
    },
    getPassage: async (value: string, unparsed: unknown) => {
      authorize()
      const passageId = hash.parse(value)
      const input = legalPassageRequestSchema.parse(unparsed)
      return transaction(async (client) => {
        const identityRow = (
          await client.query(
            `SELECT coalesce(g.provision_version_id,g.document_version_id) AS version_id
          FROM legislation.legal_passages p JOIN legislation.legal_passage_generations g ON g.id=p.generation_id
          WHERE p.id=$1 FOR SHARE OF p,g`,
            [passageId]
          )
        ).rows[0]
        if (identityRow === undefined) {
          throw new LegislationError("not_found", "Legal passage was not found")
        }
        const identity = z.object({ version_id: z.uuid() }).parse(identityRow)
        const selection = await readSelection(client, identity.version_id, input)
        const rows = z.array(legalTransferRowSchema).parse(
          (
            await client.query(
              `SELECT id,ordinal,body,input_text,data FROM legislation.legal_passages
          WHERE id=$1 AND generation_id=$2 FOR SHARE`,
              [passageId, selection.generationId]
            )
          ).rows
        )
        if (rows.length !== 1) {
          throw new LegislationError("not_found", "Legal passage was not found")
        }
        return project(rows[0]!, selection.generationId, selection.selectedContext)
      })
    }
  }
}
