import { isDeepStrictEqual } from "node:util"
import {
  acquisitionUnitSchema,
  digest,
  unitIdentity,
  type AcquisitionUnit
} from "@repo/legislation-core/legal-text/contracts"
import type pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"

const sourceSchema = z.enum(["ecfr", "govinfo-fr", "govinfo-cfr"])
const jsonObjectSchema = z.record(z.string(), z.json())
export const legalDiscoveryUnitSchema = acquisitionUnitSchema
  .omit({ historical: true })
  .extend({ historical: z.literal(false) })
export type LegalDiscoveryUnit = z.infer<typeof legalDiscoveryUnitSchema>
const checkpointSchema = z.strictObject({
  sourceId: sourceSchema,
  scopeKey: z.string().regex(/^[a-f0-9]{64}$/),
  queryHash: z.string().regex(/^[a-f0-9]{64}$/),
  query: jsonObjectSchema,
  committedCursor: z.json().nullable(),
  windowStartedAt: z.iso.datetime().nullable(),
  windowEndedAt: z.iso.datetime().nullable(),
  overlapStartedAt: z.iso.datetime().nullable(),
  sourceCutoff: z.json().nullable(),
  lastAttemptAt: z.iso.datetime().nullable(),
  lastSuccessAt: z.iso.datetime().nullable(),
  lastPageId: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .nullable(),
  revision: z.int().nonnegative()
})
const attemptSchema = z.strictObject({ sourceId: sourceSchema, query: jsonObjectSchema })
const pageSchema = z
  .strictObject({
    sourceId: sourceSchema,
    query: jsonObjectSchema,
    expectedRevision: z.int().nonnegative(),
    expectedCursor: z.json().nullable(),
    nextCursor: z.json().nullable(),
    windowStartedAt: z.iso.datetime({ offset: true }),
    windowEndedAt: z.iso.datetime({ offset: true }),
    overlapStartedAt: z.iso.datetime({ offset: true }),
    sourceCutoff: z.json(),
    units: z.array(legalDiscoveryUnitSchema).max(100)
  })
  .superRefine((value, ctx) => {
    if (value.windowStartedAt > value.windowEndedAt || value.overlapStartedAt > value.windowStartedAt) {
      ctx.addIssue({ code: "custom", message: "Invalid discovery window" })
    }
    if (new Set(value.units.map((unit) => unit.key)).size !== value.units.length) {
      ctx.addIssue({ code: "custom", message: "Duplicate discovery unit" })
    }
  })

type Json = z.infer<ReturnType<typeof z.json>>
function normalizedJson(value: unknown): Json {
  const parsed = z.json().parse(value)
  if (Array.isArray(parsed)) {
    return parsed.map(normalizedJson)
  }
  if (typeof parsed === "object" && parsed !== null) {
    return Object.fromEntries(
      Object.entries(parsed)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, item]) => [key, normalizedJson(item)])
    )
  }
  return parsed
}
function encoded(value: unknown) {
  return JSON.stringify(normalizedJson(value))
}

export function legalDiscoveryPayloadHash(value: unknown) {
  return digest(encoded(value))
}

export function legalDiscoveryScope(sourceId: AcquisitionUnit["sourceId"], query: Readonly<Record<string, unknown>>) {
  const source = sourceSchema.parse(sourceId)
  const parsed = jsonObjectSchema.parse(query)
  const queryHash = digest(encoded(parsed))
  return { sourceId: source, query: parsed, queryHash, scopeKey: digest(encoded([source, parsed])) }
}

const checkpointColumns = `source_id AS "sourceId",scope_key AS "scopeKey",query_hash AS "queryHash",query,
  committed_cursor AS "committedCursor",
  to_char(window_started_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "windowStartedAt",
  to_char(window_ended_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "windowEndedAt",
  to_char(overlap_started_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "overlapStartedAt",
  source_cutoff AS "sourceCutoff",
  to_char(last_attempt_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "lastAttemptAt",
  to_char(last_success_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "lastSuccessAt",
  last_page_id AS "lastPageId",revision::integer`

const sourceMetadata = {
  ecfr: ["Office of the Federal Register and Government Publishing Office", "official"],
  "govinfo-fr": ["Government Publishing Office", "official"],
  "govinfo-cfr": ["Government Publishing Office", "official"]
} as const

async function transaction<T>(pool: pg.Pool, operation: (client: pg.PoolClient) => Promise<T>) {
  const client = await pool.connect()
  try {
    await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE")
    await client.query("SET LOCAL lock_timeout='5s'")
    await client.query("SET LOCAL statement_timeout='30s'")
    const result = await operation(client)
    await client.query("COMMIT")
    return result
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

/** Starts or resumes a durable source/query scope without advancing its committed cursor. */
export async function startLegalDiscoveryAttempt(pool: pg.Pool, value: unknown) {
  const input = attemptSchema.parse(value)
  const scope = legalDiscoveryScope(input.sourceId, input.query)
  return transaction(pool, async (client) => {
    const [publisher, authority] = sourceMetadata[scope.sourceId]
    await client.query(
      `INSERT INTO legislation.legal_sources(id,publisher,authority) VALUES($1,$2,$3)
       ON CONFLICT(id) DO UPDATE SET publisher=legal_sources.publisher
       WHERE legal_sources.publisher=$2 AND legal_sources.authority=$3`,
      [scope.sourceId, publisher, authority]
    )
    const source = await client.query(
      "SELECT publisher,authority FROM legislation.legal_sources WHERE id=$1 FOR SHARE",
      [scope.sourceId]
    )
    invariant(
      source.rows.length === 1 && source.rows[0]?.publisher === publisher && source.rows[0]?.authority === authority,
      "legal_discovery_source_identity_conflict"
    )
    await client.query(
      `INSERT INTO legislation.legal_discovery_checkpoints(source_id,scope_key,query_hash,query)
       VALUES($1,$2,$3,$4::jsonb) ON CONFLICT DO NOTHING`,
      [scope.sourceId, scope.scopeKey, scope.queryHash, encoded(scope.query)]
    )
    const locked = await client.query(
      `SELECT ${checkpointColumns} FROM legislation.legal_discovery_checkpoints
       WHERE source_id=$1 AND scope_key=$2 FOR UPDATE`,
      [scope.sourceId, scope.scopeKey]
    )
    invariant(locked.rows.length === 1, "legal_discovery_checkpoint_missing")
    const checkpoint = checkpointSchema.parse(locked.rows[0])
    invariant(
      checkpoint.queryHash === scope.queryHash && encoded(checkpoint.query) === encoded(scope.query),
      "legal_discovery_scope_collision"
    )
    const updated = await client.query(
      `UPDATE legislation.legal_discovery_checkpoints SET last_attempt_at=clock_timestamp(),updated_at=clock_timestamp()
       WHERE source_id=$1 AND scope_key=$2 RETURNING ${checkpointColumns}`,
      [scope.sourceId, scope.scopeKey]
    )
    return checkpointSchema.parse(updated.rows[0])
  })
}

/** Atomically registers every unit in one bounded page before advancing the source cursor. */
export async function commitLegalDiscoveryPage(pool: pg.Pool, value: unknown) {
  const input = pageSchema.parse(value)
  const scope = legalDiscoveryScope(input.sourceId, input.query)
  const units = input.units
    .map((unit) => {
      invariant(unit.sourceId === scope.sourceId, "legal_discovery_source_mismatch")
      invariant(unit.key === unitIdentity(unit), "legal_discovery_unit_identity_mismatch")
      return { unit, payloadHash: legalDiscoveryPayloadHash(unit) }
    })
    .sort((left, right) => left.unit.key.localeCompare(right.unit.key))
  const pageId = digest(
    encoded({
      contract: "legal-discovery-page-2026-09-16",
      sourceId: scope.sourceId,
      scopeKey: scope.scopeKey,
      expectedRevision: input.expectedRevision,
      expectedCursor: input.expectedCursor,
      nextCursor: input.nextCursor,
      windowStartedAt: input.windowStartedAt,
      windowEndedAt: input.windowEndedAt,
      overlapStartedAt: input.overlapStartedAt,
      sourceCutoff: input.sourceCutoff,
      units: units.map(({ payloadHash, unit }) => ({ key: unit.key, payloadHash }))
    })
  )
  return transaction(pool, async (client) => {
    const selected = await client.query(
      `SELECT ${checkpointColumns} FROM legislation.legal_discovery_checkpoints
       WHERE source_id=$1 AND scope_key=$2 FOR UPDATE`,
      [scope.sourceId, scope.scopeKey]
    )
    invariant(selected.rows.length === 1, "legal_discovery_checkpoint_missing")
    const checkpoint = checkpointSchema.parse(selected.rows[0])
    invariant(
      checkpoint.queryHash === scope.queryHash && encoded(checkpoint.query) === encoded(scope.query),
      "legal_discovery_scope_collision"
    )
    if (
      checkpoint.revision !== input.expectedRevision ||
      !isDeepStrictEqual(normalizedJson(checkpoint.committedCursor), normalizedJson(input.expectedCursor))
    ) {
      if (checkpoint.lastPageId === pageId) {
        return { checkpoint, newUnits: 0, pageId, registeredUnits: units.length, reused: true }
      }
      throw new Error("legal_discovery_checkpoint_changed")
    }
    let newUnits = 0
    for (const item of units) {
      const inserted = await client.query(
        `INSERT INTO legislation.legal_discovery_units(source_id,scope_key,unit_key,payload_hash,unit)
         VALUES($1,$2,$3,$4,$5::jsonb) ON CONFLICT DO NOTHING`,
        [scope.sourceId, scope.scopeKey, item.unit.key, item.payloadHash, encoded(item.unit)]
      )
      newUnits += inserted.rowCount ?? 0
      const stored = await client.query(
        `SELECT payload_hash,unit FROM legislation.legal_discovery_units
         WHERE source_id=$1 AND scope_key=$2 AND unit_key=$3 FOR SHARE`,
        [scope.sourceId, scope.scopeKey, item.unit.key]
      )
      const row = z.object({ payload_hash: z.string(), unit: legalDiscoveryUnitSchema }).parse(stored.rows[0])
      invariant(
        row.payload_hash === item.payloadHash && encoded(row.unit) === encoded(item.unit),
        "legal_discovery_unit_conflict"
      )
    }
    await client.query(
      `INSERT INTO legislation.legal_discovery_pages
       (id,source_id,scope_key,expected_revision,expected_cursor,next_cursor,unit_count)
       VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7)`,
      [
        pageId,
        scope.sourceId,
        scope.scopeKey,
        input.expectedRevision,
        input.expectedCursor === null ? null : encoded(input.expectedCursor),
        input.nextCursor === null ? null : encoded(input.nextCursor),
        units.length
      ]
    )
    const updated = await client.query(
      `UPDATE legislation.legal_discovery_checkpoints SET committed_cursor=$3::jsonb,
       window_started_at=$4,window_ended_at=$5,overlap_started_at=$6,source_cutoff=$7::jsonb,
       last_success_at=clock_timestamp(),last_page_id=$8,revision=revision+1,updated_at=clock_timestamp()
       WHERE source_id=$1 AND scope_key=$2 AND revision=$9 RETURNING ${checkpointColumns}`,
      [
        scope.sourceId,
        scope.scopeKey,
        input.nextCursor === null ? null : encoded(input.nextCursor),
        input.windowStartedAt,
        input.windowEndedAt,
        input.overlapStartedAt,
        encoded(input.sourceCutoff),
        pageId,
        input.expectedRevision
      ]
    )
    invariant(updated.rowCount === 1, "legal_discovery_checkpoint_lost")
    return {
      checkpoint: checkpointSchema.parse(updated.rows[0]),
      newUnits,
      pageId,
      registeredUnits: units.length,
      reused: false
    }
  })
}
