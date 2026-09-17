import { isAbsolute } from "node:path"
import { isDeepStrictEqual } from "node:util"
import { regulatoryParseSummarySchema } from "@repo/legislation-core/legal-text/parser-contract"
import type pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"
import { currentReceiptSchema, validateRegulatoryArtifactRetention } from "./artifact-backfill.js"
import { legalDiscoveryPayloadHash, legalDiscoveryUnitSchema } from "./discovery-checkpoint.js"
import { legalDiscoveryManifestSchema } from "./discovery-registration.js"
import { parseRegulatoryArtifact } from "./parser-bridge.js"

const hashSchema = z.string().regex(/^[a-f0-9]{64}$/)
const inputSchema = z.strictObject({ manifestId: hashSchema, unitKey: hashSchema, outputRoot: z.string().min(1) })
const storedUnitSchema = z.object({
  manifest_id: hashSchema,
  payload_hash: hashSchema,
  unit: legalDiscoveryUnitSchema,
  state: z.enum(["acquired", "parsed"]),
  artifact_hash: hashSchema,
  artifact_bytes: z.string(),
  storage_locator: z.string().min(1),
  acquisition_receipt: currentReceiptSchema,
  parser_hash: hashSchema.nullable(),
  normalized_generation: hashSchema.nullable(),
  normalized_locator: z.string().nullable(),
  parse_summary: z.unknown().nullable()
})

/** Parses one acquired current unit and commits only a completely revalidated normalized generation. */
export async function parseLegalDiscoveryArtifact(pool: pg.Pool, value: unknown) {
  const input = inputSchema.parse(value)
  invariant(isAbsolute(input.outputRoot), "legal_discovery_normalized_directory_not_absolute")
  const manifestRow = await pool.query("SELECT body FROM legislation.legal_import_manifests WHERE id=$1", [
    input.manifestId
  ])
  invariant(manifestRow.rowCount === 1, "legal_discovery_manifest_missing")
  const manifest = legalDiscoveryManifestSchema.parse(manifestRow.rows[0]?.body)
  const manifestUnit = manifest.units.find((candidate) => candidate.key === input.unitKey)
  invariant(manifestUnit, "legal_discovery_manifest_unit_missing")
  const before = await pool.query(
    `SELECT manifest_id,payload_hash,unit,state,artifact_hash,artifact_bytes::text,storage_locator,acquisition_receipt,
     parser_hash,normalized_generation,normalized_locator,parse_summary
     FROM legislation.legal_discovery_units
     WHERE source_id=$1 AND scope_key=$2 AND unit_key=$3`,
    [manifest.sourceId, manifest.scopeKey, manifestUnit.key]
  )
  invariant(before.rowCount === 1, "legal_discovery_unit_missing")
  const acquired = storedUnitSchema.parse(before.rows[0])
  invariant(
    acquired.manifest_id === manifest.id &&
      isDeepStrictEqual(acquired.unit, manifestUnit) &&
      acquired.payload_hash === legalDiscoveryPayloadHash(manifestUnit) &&
      acquired.acquisition_receipt.sha256 === acquired.artifact_hash &&
      acquired.acquisition_receipt.bytes === Number(acquired.artifact_bytes),
    "legal_discovery_parser_input_changed"
  )
  await validateRegulatoryArtifactRetention(
    acquired.storage_locator,
    acquired.artifact_hash,
    Number(acquired.artifact_bytes)
  )
  const parsed = await parseRegulatoryArtifact({
    unit: manifestUnit,
    artifactHash: acquired.artifact_hash,
    path: acquired.storage_locator,
    outputRoot: input.outputRoot
  })
  const summary = regulatoryParseSummarySchema.parse(parsed.summary)
  const client = await pool.connect()
  try {
    await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE")
    await client.query("SET LOCAL lock_timeout='5s'")
    await client.query("SET LOCAL statement_timeout='30s'")
    const locked = storedUnitSchema.parse(
      (
        await client.query(
          `SELECT manifest_id,payload_hash,unit,state,artifact_hash,artifact_bytes::text,storage_locator,acquisition_receipt,
           parser_hash,normalized_generation,normalized_locator,parse_summary
           FROM legislation.legal_discovery_units
           WHERE source_id=$1 AND scope_key=$2 AND unit_key=$3 FOR UPDATE`,
          [manifest.sourceId, manifest.scopeKey, manifestUnit.key]
        )
      ).rows[0]
    )
    invariant(
      locked.artifact_hash === acquired.artifact_hash &&
        locked.storage_locator === acquired.storage_locator &&
        isDeepStrictEqual(locked.unit, acquired.unit),
      "legal_discovery_parser_input_changed"
    )
    if (locked.state === "parsed") {
      invariant(
        locked.parser_hash === summary.parserCodeHash &&
          locked.normalized_generation === parsed.generation &&
          locked.normalized_locator === parsed.directory &&
          isDeepStrictEqual(regulatoryParseSummarySchema.parse(locked.parse_summary), summary),
        "legal_discovery_parser_replay_conflict"
      )
    } else {
      const updated = await client.query(
        `UPDATE legislation.legal_discovery_units SET state='parsed',parser_hash=$4,
         normalized_generation=$5,normalized_locator=$6,parse_summary=$7::jsonb,parsed_at=clock_timestamp()
         WHERE source_id=$1 AND scope_key=$2 AND unit_key=$3 AND state='acquired'`,
        [
          manifest.sourceId,
          manifest.scopeKey,
          manifestUnit.key,
          summary.parserCodeHash,
          parsed.generation,
          parsed.directory,
          JSON.stringify(summary)
        ]
      )
      invariant(updated.rowCount === 1, "legal_discovery_parser_lost")
    }
    await client.query("COMMIT")
    return {
      manifestId: manifest.id,
      unitKey: manifestUnit.key,
      generation: parsed.generation,
      records: summary.records,
      reused: parsed.reused
    }
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}
