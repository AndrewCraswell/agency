import { randomUUID } from "node:crypto"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import { digest } from "@repo/legislation-core/legal-text/contracts"
import type pg from "pg"
import { z } from "zod"

const hash = z.string().regex(/^[a-f0-9]{64}$/)
const candidateSchema = z.strictObject({
  id: hash,
  scopeKind: z.enum(["edition", "publication"]),
  scopeId: z.uuid(),
  generationId: hash,
  versionId: z.uuid(),
  score: z.number().nonnegative()
})
const candidatesSchema = z
  .array(candidateSchema)
  .max(1000)
  .refine((rows) => new Set(rows.map((row) => row.versionId)).size === rows.length)
const cursorSchema = z.strictObject({ id: z.uuid(), offset: z.int().min(1).max(999), hash })
const stale = () => new LegislationError("conflict", "Search continuation expired or no longer matches the request")

type FrozenPageInput = {
  requestHash: string
  generation: string
  limit: number
  cursor?: string
  scopeKind: "edition" | "publication"
  scopeIds?: readonly string[]
  rank: () => Promise<unknown[]>
}

/** Caller validates source rights and complete selected-copy integrity before invoking this in the target transaction. */
async function readFrozenLegalSearchResultPage(client: pg.PoolClient, input: FrozenPageInput) {
  let snapshotId: string | undefined
  let offset = 0
  let candidates: z.infer<typeof candidatesSchema>
  let windowTruncated: boolean
  let candidateHash: string
  if (input.cursor !== undefined) {
    let cursor: z.infer<typeof cursorSchema>
    try {
      cursor = cursorSchema.parse(JSON.parse(Buffer.from(input.cursor, "base64url").toString("utf8")))
    } catch {
      throw new LegislationError("invalid_request", "Invalid search continuation")
    }
    if (cursor.offset % input.limit !== 0) {
      throw stale()
    }
    const rows = await client.query(
      `SELECT candidates,candidate_hash,window_truncated FROM legislation.legal_search_results
      WHERE id=$1 AND request_hash=$2 AND generation=$3 AND expires_at>clock_timestamp() FOR SHARE`,
      [cursor.id, input.requestHash, input.generation]
    )
    if (rows.rows.length !== 1) {
      throw stale()
    }
    const parsed = z
      .object({ candidates: candidatesSchema, candidate_hash: hash, window_truncated: z.boolean() })
      .safeParse(rows.rows[0])
    if (!parsed.success) {
      throw stale()
    }
    const stored = parsed.data
    candidates = stored.candidates
    candidateHash = digest(JSON.stringify(candidates))
    if (
      candidateHash !== stored.candidate_hash ||
      candidateHash !== cursor.hash ||
      cursor.offset >= candidates.length
    ) {
      throw stale()
    }
    windowTruncated = stored.window_truncated
    snapshotId = cursor.id
    offset = cursor.offset
  } else {
    const ranked = z
      .array(candidateSchema)
      .max(1001)
      .parse(await input.rank())
    windowTruncated = ranked.length > 1000
    candidates = candidatesSchema.parse(ranked.slice(0, 1000))
    candidateHash = digest(JSON.stringify(candidates))
    if (candidates.length > input.limit) {
      // Bounded cleanup skips active readers; source text and embeddings never enter this cache.
      await client.query(`DELETE FROM legislation.legal_search_results WHERE id IN (
        SELECT id FROM legislation.legal_search_results WHERE expires_at<=clock_timestamp()
        ORDER BY expires_at,id LIMIT 100 FOR UPDATE SKIP LOCKED)`)
      snapshotId = randomUUID()
      await client.query(
        `INSERT INTO legislation.legal_search_results(id,request_hash,generation,candidates,candidate_hash,window_truncated)
        VALUES($1,$2,$3,$4::jsonb,$5,$6)`,
        [snapshotId, input.requestHash, input.generation, JSON.stringify(candidates), candidateHash, windowTruncated]
      )
    }
  }
  const selected = candidates.slice(offset, offset + input.limit)
  if (
    selected.some(
      (candidate) =>
        candidate.scopeKind !== input.scopeKind ||
        (input.scopeIds !== undefined && !input.scopeIds.includes(candidate.scopeId))
    )
  ) {
    throw stale()
  }
  const nextOffset = offset + selected.length
  const nextCursor =
    snapshotId !== undefined && nextOffset < candidates.length
      ? Buffer.from(JSON.stringify({ id: snapshotId, offset: nextOffset, hash: candidateHash })).toString("base64url")
      : null
  return { candidates: selected, nextCursor, candidateSetTruncated: windowTruncated }
}

export async function readLegalSearchResultPage(
  client: pg.PoolClient,
  input: {
    requestHash: string
    generation: string
    editionIds: string[]
    query: string
    limit: number
    cursor?: string
  }
) {
  return readFrozenLegalSearchResultPage(client, {
    requestHash: input.requestHash,
    generation: input.generation,
    limit: input.limit,
    scopeKind: "edition",
    scopeIds: input.editionIds,
    ...(input.cursor === undefined ? {} : { cursor: input.cursor }),
    rank: async () =>
      (
        await client.query(
          `WITH ranked AS (
      SELECT 'edition' AS "scopeKind",m.scope_id AS "scopeId",p.generation_id AS "generationId",p.id,
        g.metadata->>'provision_version_id' AS "versionId",ts_rank_cd(p.search_vector,q.query) AS score,
        row_number() OVER (PARTITION BY g.metadata->>'provision_version_id'
          ORDER BY ts_rank_cd(p.search_vector,q.query) DESC,m.scope_id,p.id) AS position
      FROM legislation.legal_search_memberships m JOIN legislation.legal_search_generations g ON g.id=m.generation_id
      JOIN legislation.legal_search_passages p ON p.generation_id=g.id CROSS JOIN websearch_to_tsquery('english',$2) q(query)
      WHERE m.scope_kind='edition' AND m.scope_id=ANY($1::uuid[]) AND p.search_vector @@ q.query)
      SELECT id,"scopeKind","scopeId","generationId","versionId",score FROM ranked WHERE position=1
      ORDER BY score DESC,id,"scopeId" LIMIT 1001`,
          [input.editionIds, input.query]
        )
      ).rows
  })
}

export async function readLegalPublicationSearchResultPage(
  client: pg.PoolClient,
  input: {
    requestHash: string
    generation: string
    query: string
    publicationKinds?: string[]
    agencyIds?: string[]
    publishedFrom?: string
    publishedTo?: string
    limit: number
    cursor?: string
  }
) {
  return readFrozenLegalSearchResultPage(client, {
    requestHash: input.requestHash,
    generation: input.generation,
    limit: input.limit,
    scopeKind: "publication",
    ...(input.cursor === undefined ? {} : { cursor: input.cursor }),
    rank: async () =>
      (
        await client.query(
          `WITH ranked AS (
            SELECT 'publication' AS "scopeKind",projection.scope_id AS "scopeId",
              p.generation_id AS "generationId",p.id,g.metadata->>'document_version_id' AS "versionId",
              ts_rank_cd(p.search_vector,q.query) AS score,
              row_number() OVER (PARTITION BY g.metadata->>'document_version_id'
                ORDER BY ts_rank_cd(p.search_vector,q.query) DESC,projection.scope_id,p.id) AS position
            FROM legislation.legal_search_scope_projections projection
            JOIN legislation.legal_search_memberships m
              ON m.scope_kind=projection.scope_kind AND m.scope_id=projection.scope_id
            JOIN legislation.legal_search_generations g ON g.id=m.generation_id
            JOIN legislation.legal_search_passages p ON p.generation_id=g.id
            CROSS JOIN websearch_to_tsquery('english',$2) q(query)
            WHERE projection.scope_kind='publication'
              AND projection.projection->>'corpus'='regulatory_publication'
              AND projection.projection->>'jurisdiction_id'='jurisdiction:us'
              AND projection.projection->>'source_id'='govinfo-fr'
              AND ($1::text[] IS NULL OR projection.projection->>'publication_kind'=ANY($1::text[]))
              AND ($3::date IS NULL OR projection.projection->>'publication_date' >= $3::date::text)
              AND ($4::date IS NULL OR projection.projection->>'publication_date' <= $4::date::text)
              AND ($5::text[] IS NULL OR projection.projection->'agency_ids' ?| $5::text[])
              AND p.search_vector @@ q.query)
           SELECT id,"scopeKind","scopeId","generationId","versionId",score FROM ranked WHERE position=1
           ORDER BY score DESC,id,"scopeId" LIMIT 1001`,
          [
            input.publicationKinds ?? null,
            input.query,
            input.publishedFrom ?? null,
            input.publishedTo ?? null,
            input.agencyIds ?? null
          ]
        )
      ).rows
  })
}
