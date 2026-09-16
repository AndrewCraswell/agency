import { isDeepStrictEqual } from "node:util"
import type pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"

const scopeSchema = z.object({
  kind: z.enum(["edition", "publication"]),
  id: z.uuid(),
  preparationId: z.string().regex(/^[a-f0-9]{64}$/),
  count: z.int().positive()
})
const summarySchema = z.object({
  kind: z.enum(["edition", "publication"]),
  id: z.uuid(),
  count: z.int().positive(),
  source_hash: z.string().regex(/^[a-f0-9]{64}$/)
})

export async function requireLegalCopyReceiptRevisions(
  source: pg.PoolClient,
  target: pg.PoolClient,
  value: z.infer<typeof scopeSchema>[]
) {
  const scopes = z.array(scopeSchema).min(1).max(100).parse(value)
  const input = JSON.stringify(scopes)
  const contextWhitespace =
    "\t\n\v\f\r \u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff"
  const canonical = z.array(summarySchema).parse(
    (
      await source.query(
        `WITH selected AS (
      SELECT * FROM jsonb_to_recordset($1::jsonb) AS x(kind text,id uuid,"preparationId" text,count integer)
    ), edition_items AS MATERIALIZED (
      SELECT s.kind,s.id,m.ordinal,m.version_id,
        btrim(concat_ws(E'\\n',c.jurisdiction_id,c.name,m.native_id,v.heading),$2) AS context
      FROM selected s JOIN legislation.legal_edition_provisions m ON m.edition_id=s.id
      JOIN legislation.legal_codes c ON c.id=m.code_id
      JOIN legislation.legal_provision_versions v ON v.id=m.version_id
      WHERE s.kind='edition' ORDER BY m.edition_id,m.ordinal FOR SHARE OF m,c,v
    ), publication_items AS MATERIALIZED (
      SELECT s.kind,s.id,0 AS ordinal,o.version_id,
        btrim(concat_ws(E'\\n',o.jurisdiction_id,publisher.publisher,o.metadata->>'document_number',v.publication_kind,v.heading),$2) AS context
      FROM selected s JOIN legislation.regulatory_document_observations o ON o.id=s.id
      JOIN legislation.regulatory_document_versions v ON v.id=o.version_id
      JOIN legislation.legal_sources publisher ON publisher.id=o.source_id
      WHERE s.kind='publication' ORDER BY o.id FOR SHARE OF o,v,publisher
    ), inventory AS MATERIALIZED (
      SELECT * FROM edition_items UNION ALL SELECT * FROM publication_items
    ), inventory_counts AS (
      SELECT kind,id,count(*) AS count FROM inventory GROUP BY kind,id
    ), locked AS MATERIALIZED (
      SELECT s.kind,s.id,g.id AS generation_id,r.revision
      FROM selected s JOIN legislation.legal_passage_preparations p ON p.id=s."preparationId"
        AND ((s.kind='edition' AND p.edition_id=s.id) OR (s.kind='publication' AND p.observation_id=s.id))
      JOIN legislation.legal_passage_preparation_items i ON i.preparation_id=p.id
      JOIN inventory_counts n ON n.kind=s.kind AND n.id=s.id AND n.count=s.count
      JOIN inventory current_item ON current_item.kind=s.kind AND current_item.id=s.id
        AND current_item.ordinal=i.ordinal AND current_item.version_id=i.version_id AND current_item.context=i.context
      JOIN legislation.legal_passage_generations g ON g.id=i.generation_id
        AND g.context=i.context AND g.tokenizer_id=p.tokenizer_id
        AND ((s.kind='edition' AND g.provision_version_id=i.version_id) OR (s.kind='publication' AND g.document_version_id=i.version_id))
      JOIN legislation.legal_copy_revisions r ON r.generation_id=g.id
      ORDER BY r.generation_id,s.kind,s.id FOR SHARE OF p,i,g,r
    ) SELECT kind,id,count(*)::integer AS count,
      encode(sha256(convert_to(string_agg(generation_id||':'||revision::text,',' ORDER BY generation_id),'UTF8')),'hex') AS source_hash
      FROM locked GROUP BY kind,id ORDER BY kind,id`,
        [input, contextWhitespace]
      )
    ).rows
  )
  const copied = z.array(summarySchema.extend({ target_hash: z.string().regex(/^[a-f0-9]{64}$/) })).parse(
    (
      await target.query(
        `WITH selected AS (
        SELECT * FROM jsonb_to_recordset($1::jsonb) AS x(kind text,id uuid,"preparationId" text,count integer)
      ), locked AS MATERIALIZED (
        SELECT s.kind,s.id,v.generation_id,v.source_revision,r.revision
        FROM selected s JOIN legislation.legal_search_scopes receipt
          ON receipt.scope_kind=s.kind AND receipt.scope_id=s.id AND receipt.preparation_id=s."preparationId"
          AND receipt.generation_count=s.count
          AND (SELECT count(*) FROM legislation.legal_search_scope_revisions all_revisions
            WHERE all_revisions.scope_kind=s.kind AND all_revisions.scope_id=s.id)=s.count
          AND (SELECT count(*) FROM legislation.legal_search_memberships all_members
            WHERE all_members.scope_kind=s.kind AND all_members.scope_id=s.id)=s.count
        JOIN legislation.legal_search_scope_revisions v ON v.scope_kind=s.kind AND v.scope_id=s.id
        JOIN legislation.legal_search_memberships m ON m.scope_kind=v.scope_kind AND m.scope_id=v.scope_id AND m.generation_id=v.generation_id
        JOIN legislation.legal_copy_revisions r ON r.generation_id=v.generation_id AND r.revision=v.target_revision
        ORDER BY r.generation_id,s.kind,s.id FOR SHARE OF receipt,v,m,r
      ) SELECT kind,id,count(*)::integer AS count,
        encode(sha256(convert_to(string_agg(generation_id||':'||source_revision::text,',' ORDER BY generation_id),'UTF8')),'hex') AS source_hash,
        encode(sha256(convert_to(string_agg(generation_id||':'||revision::text,',' ORDER BY generation_id),'UTF8')),'hex') AS target_hash
        FROM locked GROUP BY kind,id ORDER BY kind,id`,
        [input]
      )
    ).rows
  )
  invariant(
    canonical.length === scopes.length &&
      canonical.every((row) =>
        scopes.some((scope) => scope.kind === row.kind && scope.id === row.id && scope.count === row.count)
      ) &&
      isDeepStrictEqual(
        canonical,
        copied.map((row) => summarySchema.parse(row))
      ),
    "legal_search_scope_revision_changed"
  )
  return copied
}
