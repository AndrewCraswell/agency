import { isDeepStrictEqual } from "node:util"
import { validateManifest } from "@repo/legislation-core/legal-text/contracts"
import type pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"
import { legalDiscoveryPayloadHash, legalDiscoveryScope, legalDiscoverySourceMetadata } from "./discovery-checkpoint.js"

const hashSchema = z.string().regex(/^[a-f0-9]{64}$/)
const sourceSchema = z.enum(["ecfr", "govinfo-fr", "govinfo-cfr"])
const inputSchema = z.strictObject({
  manifest: z.unknown(),
  sourceId: sourceSchema,
  afterUnitKey: hashSchema.nullable().default(null),
  limit: z.int().min(1).max(100).default(100)
})
const cursorSchema = z.strictObject({ manifestId: hashSchema, afterUnitKey: hashSchema })

function encoded(value: unknown) {
  return JSON.stringify(value)
}

/** Pure preview that binds an operator action to one exact manifest page. */
export function planHistoricalManifestPage(value: unknown) {
  const input = inputSchema.parse(value)
  const manifest = validateManifest(input.manifest)
  const sourceUnits = manifest.units
    .filter((unit) => unit.sourceId === input.sourceId)
    .sort((left, right) => left.key.localeCompare(right.key))
  invariant(sourceUnits.length > 0, "historical_manifest_source_empty")
  const afterIndex = input.afterUnitKey === null ? -1 : sourceUnits.findIndex((unit) => unit.key === input.afterUnitKey)
  invariant(input.afterUnitKey === null || afterIndex >= 0, "historical_manifest_cursor_unknown")
  const remaining = sourceUnits.slice(afterIndex + 1)
  const units = remaining.slice(0, input.limit)
  invariant(units.length > 0, "historical_manifest_registration_exhausted")
  const nextUnitKey = units.at(-1)!.key
  const exhausted = remaining.length <= input.limit
  const query = {
    contract: "historical-regulatory-manifest-registration-2026-09-17",
    manifestId: manifest.id,
    sourceId: input.sourceId
  }
  const scope = legalDiscoveryScope(input.sourceId, query)
  const expectedCursor =
    input.afterUnitKey === null
      ? null
      : cursorSchema.parse({ manifestId: manifest.id, afterUnitKey: input.afterUnitKey })
  const nextCursor = cursorSchema.parse({ manifestId: manifest.id, afterUnitKey: nextUnitKey })
  const pageId = legalDiscoveryPayloadHash({
    contract: "historical-regulatory-manifest-page-2026-09-17",
    manifestId: manifest.id,
    sourceId: input.sourceId,
    scopeKey: scope.scopeKey,
    expectedCursor,
    nextCursor,
    units: units.map((unit) => [unit.key, legalDiscoveryPayloadHash(unit)])
  })
  return { input, manifest, units, scope, expectedCursor, nextCursor, pageId, nextUnitKey, exhausted }
}

/**
 * Registers one replay-safe page from a complete frozen historical inventory.
 * This boundary performs no provider I/O and leaves every admitted unit ready for
 * the existing acquisition dispatcher.
 */
export async function registerHistoricalManifestPage(pool: pg.Pool, value: unknown) {
  const { input, manifest, units, scope, expectedCursor, nextCursor, pageId, nextUnitKey, exhausted } =
    planHistoricalManifestPage(value)
  const client = await pool.connect()
  try {
    await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE")
    await client.query("SET LOCAL lock_timeout='5s'")
    await client.query("SET LOCAL statement_timeout='30s'")
    const [publisher, authority] = legalDiscoverySourceMetadata[input.sourceId]
    await client.query(
      `INSERT INTO legislation.legal_sources(id,publisher,authority) VALUES($1,$2,$3)
       ON CONFLICT(id) DO UPDATE SET publisher=legal_sources.publisher
       WHERE legal_sources.publisher=$2 AND legal_sources.authority=$3`,
      [input.sourceId, publisher, authority]
    )
    const source = await client.query(
      "SELECT publisher,authority FROM legislation.legal_sources WHERE id=$1 FOR SHARE",
      [input.sourceId]
    )
    invariant(
      source.rowCount === 1 && source.rows[0]?.publisher === publisher && source.rows[0]?.authority === authority,
      "historical_manifest_source_identity_conflict"
    )
    await client.query(
      `INSERT INTO legislation.legal_discovery_checkpoints(source_id,scope_key,query_hash,query,last_attempt_at)
       VALUES($1,$2,$3,$4::jsonb,clock_timestamp()) ON CONFLICT DO NOTHING`,
      [scope.sourceId, scope.scopeKey, scope.queryHash, encoded(scope.query)]
    )
    const checkpointResult = await client.query(
      `SELECT query_hash,query,committed_cursor,last_page_id,revision::integer
       FROM legislation.legal_discovery_checkpoints WHERE source_id=$1 AND scope_key=$2 FOR UPDATE`,
      [scope.sourceId, scope.scopeKey]
    )
    const checkpoint = z
      .object({
        query_hash: hashSchema,
        query: z.record(z.string(), z.json()),
        committed_cursor: cursorSchema.nullable(),
        last_page_id: hashSchema.nullable(),
        revision: z.int().nonnegative()
      })
      .parse(checkpointResult.rows[0])
    invariant(
      checkpoint.query_hash === scope.queryHash && isDeepStrictEqual(checkpoint.query, scope.query),
      "historical_manifest_scope_collision"
    )
    await client.query(
      `INSERT INTO legislation.legal_import_manifests(id,body) VALUES($1,$2::jsonb)
       ON CONFLICT(id) DO UPDATE SET body=legal_import_manifests.body
       WHERE legal_import_manifests.body=EXCLUDED.body`,
      [manifest.id, encoded(manifest)]
    )
    const storedManifest = await client.query(
      "SELECT body FROM legislation.legal_import_manifests WHERE id=$1 FOR SHARE",
      [manifest.id]
    )
    invariant(
      storedManifest.rowCount === 1 && isDeepStrictEqual(validateManifest(storedManifest.rows[0]?.body), manifest),
      "historical_manifest_conflict"
    )
    const existingPage = await client.query(
      `SELECT expected_cursor,next_cursor,unit_count FROM legislation.legal_discovery_pages
       WHERE id=$1 AND source_id=$2 AND scope_key=$3`,
      [pageId, scope.sourceId, scope.scopeKey]
    )
    if (existingPage.rowCount === 1) {
      const row = z
        .object({
          expected_cursor: cursorSchema.nullable(),
          next_cursor: cursorSchema,
          unit_count: z.int().positive().max(100)
        })
        .parse(existingPage.rows[0])
      invariant(
        isDeepStrictEqual(row.expected_cursor, expectedCursor) &&
          isDeepStrictEqual(row.next_cursor, nextCursor) &&
          row.unit_count === units.length,
        "historical_manifest_page_conflict"
      )
      await client.query("COMMIT")
      return {
        manifestId: manifest.id,
        sourceId: input.sourceId,
        scopeKey: scope.scopeKey,
        pageId,
        registered: units.length,
        newUnits: 0,
        nextUnitKey,
        exhausted,
        reused: true
      }
    }
    invariant(
      isDeepStrictEqual(checkpoint.committed_cursor, expectedCursor),
      "historical_manifest_registration_cursor_changed"
    )
    let newUnits = 0
    for (const unit of units) {
      const payloadHash = legalDiscoveryPayloadHash(unit)
      const inserted = await client.query(
        `INSERT INTO legislation.legal_discovery_units
         (source_id,scope_key,unit_key,payload_hash,unit,manifest_id,state,registered_at)
         VALUES($1,$2,$3,$4,$5::jsonb,$6,'registered',clock_timestamp()) ON CONFLICT DO NOTHING`,
        [scope.sourceId, scope.scopeKey, unit.key, payloadHash, encoded(unit), manifest.id]
      )
      newUnits += inserted.rowCount ?? 0
      const stored = await client.query(
        `SELECT payload_hash,unit,manifest_id,state FROM legislation.legal_discovery_units
         WHERE source_id=$1 AND scope_key=$2 AND unit_key=$3 FOR SHARE`,
        [scope.sourceId, scope.scopeKey, unit.key]
      )
      const row = z
        .object({
          payload_hash: hashSchema,
          unit: z.unknown(),
          manifest_id: hashSchema,
          state: z.literal("registered")
        })
        .parse(stored.rows[0])
      invariant(
        row.payload_hash === payloadHash && row.manifest_id === manifest.id && isDeepStrictEqual(row.unit, unit),
        "historical_manifest_unit_conflict"
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
        checkpoint.revision,
        encoded(expectedCursor),
        encoded(nextCursor),
        units.length
      ]
    )
    const updated = await client.query(
      `UPDATE legislation.legal_discovery_checkpoints
       SET committed_cursor=$3::jsonb,source_cutoff=$4::jsonb,last_attempt_at=clock_timestamp(),
         last_success_at=clock_timestamp(),last_page_id=$5,revision=revision+1,updated_at=clock_timestamp()
       WHERE source_id=$1 AND scope_key=$2 AND revision=$6`,
      [
        scope.sourceId,
        scope.scopeKey,
        encoded(nextCursor),
        encoded({ manifestId: manifest.id, cutoff: manifest.scope.cutoff, sourceId: input.sourceId }),
        pageId,
        checkpoint.revision
      ]
    )
    invariant(updated.rowCount === 1, "historical_manifest_checkpoint_lost")
    await client.query("COMMIT")
    return {
      manifestId: manifest.id,
      sourceId: input.sourceId,
      scopeKey: scope.scopeKey,
      pageId,
      registered: units.length,
      newUnits,
      nextUnitKey,
      exhausted,
      reused: false
    }
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}
