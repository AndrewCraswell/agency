import { isDeepStrictEqual } from "node:util"
import type pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"

const item = z.object({ ordinal: z.int().nonnegative(), version_id: z.uuid(), context: z.string().max(16000).trim() })

/** Compare only the selected inventory page. Finalization must still verify the complete inventory hash. */
export async function readCopyValidationInventory(
  source: pg.PoolClient,
  scope: { kind: "edition" | "publication"; id: string },
  preparationId: string,
  afterOrdinal: number,
  limit: number
) {
  if (afterOrdinal !== -1) {
    invariant(
      (
        await source.query(
          "SELECT 1 FROM legislation.legal_passage_preparation_items WHERE preparation_id=$1 AND ordinal=$2 FOR SHARE",
          [preparationId, afterOrdinal]
        )
      ).rowCount === 1,
      "legal_copy_cursor_not_in_inventory"
    )
  }
  const canonical = z.array(item).parse(
    (
      await source.query(
        scope.kind === "edition"
          ? `SELECT m.ordinal,m.version_id,left(concat_ws(E'\\n',c.jurisdiction_id,c.name,m.native_id,v.heading),16001) AS context
        FROM legislation.legal_edition_provisions m JOIN legislation.legal_codes c ON c.id=m.code_id
        JOIN legislation.legal_provision_versions v ON v.id=m.version_id
        WHERE m.edition_id=$1 AND m.ordinal>$2 ORDER BY m.ordinal LIMIT $3 FOR SHARE OF m,c,v`
          : `SELECT 0 AS ordinal,o.version_id,left(concat_ws(E'\\n',o.jurisdiction_id,s.publisher,o.metadata->>'document_number',v.publication_kind,v.heading),16001) AS context
        FROM legislation.regulatory_document_observations o JOIN legislation.regulatory_document_versions v ON v.id=o.version_id
        JOIN legislation.legal_sources s ON s.id=o.source_id WHERE o.id=$1 AND 0>$2 LIMIT $3 FOR SHARE OF o,v,s`,
        [scope.id, afterOrdinal, limit + 1]
      )
    ).rows
  )
  const retained = z.array(item).parse(
    (
      await source.query(
        `SELECT ordinal,version_id,left(context,16001) AS context FROM legislation.legal_passage_preparation_items
    WHERE preparation_id=$1 AND ordinal>$2 ORDER BY ordinal LIMIT $3 FOR SHARE`,
        [preparationId, afterOrdinal, limit + 1]
      )
    ).rows
  )
  invariant(isDeepStrictEqual(canonical, retained), "legal_copy_inventory_mismatch")
  return { inventory: canonical.slice(0, limit), exhausted: canonical.length <= limit }
}
