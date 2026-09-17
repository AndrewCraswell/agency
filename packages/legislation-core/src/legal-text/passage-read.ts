import type { legalPassageScopeSchema } from "@repo/legislation-core/legal-text/passage-contract"
import { requireRights } from "@repo/legislation-core/legal-text/rights"
import type pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"

const scopeMetadataSchema = z.object({
  rights_profile_id: z.string(),
  source_id: z.string(),
  jurisdiction_id: z.string()
})

export async function readLegalPassageScope(client: pg.PoolClient, scope: z.infer<typeof legalPassageScopeSchema>) {
  const result =
    scope.kind === "provision"
      ? await client.query(
          `SELECT e.rights_profile_id,e.source_id,e.jurisdiction_id
      FROM legislation.legal_edition_provisions m JOIN legislation.legal_provision_versions v ON v.id=m.version_id
      JOIN legislation.legal_editions e ON e.id=m.edition_id
      WHERE v.id=$1 AND e.id=$2 AND e.published_at IS NOT NULL FOR SHARE OF v,e,m`,
          [scope.versionId, scope.editionId]
        )
      : await client.query(
          `SELECT o.rights_profile_id,o.source_id,o.jurisdiction_id
      FROM legislation.regulatory_document_observations o JOIN legislation.regulatory_document_versions v ON v.id=o.version_id
      JOIN legislation.regulatory_publication_batches b ON b.generation_id=o.generation_id
      WHERE v.id=$1 AND o.id=$2 FOR SHARE OF v,o,b`,
          [scope.versionId, scope.observationId]
        )
  invariant(result.rows.length === 1, "legal_passage_source_unavailable")
  const snapshot = scopeMetadataSchema.parse(result.rows[0])
  await requireRights(client, snapshot.rights_profile_id, "displayText")
  await requireRights(client, snapshot.rights_profile_id, "localSearch")
  return snapshot
}
