import { randomUUID } from "node:crypto"
import { rm } from "node:fs/promises"
import { isAbsolute, join } from "node:path"
import { isDeepStrictEqual } from "node:util"
import { regulatoryParseSummarySchema } from "@repo/legislation-core/legal-text/parser-contract"
import type pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"
import type { FileArtifactStore } from "../documents/artifact-store.js"
import {
  regulatoryArtifactReceiptSchema,
  regulatoryArtifactUnitSchema,
  validateRegulatoryArtifactRetention
} from "./artifact-backfill.js"
import { legalDiscoveryPayloadHash } from "./discovery-checkpoint.js"
import { materializeRegulatoryArtifact } from "./durable-artifact.js"
import { retainRegulatoryNormalizedBundle } from "./durable-normalized-bundle.js"
import { parseRegulatoryArtifact } from "./parser-bridge.js"
import { parseRegulatoryImportManifest, sameRegulatoryImportUnit } from "./regulatory-import-contract.js"

const hashSchema = z.string().regex(/^[a-f0-9]{64}$/)
const inputSchema = z.strictObject({ manifestId: hashSchema, unitKey: hashSchema, outputRoot: z.string().min(1) })
const storedUnitSchema = z.object({
  source_id: z.enum(["ecfr", "govinfo-fr", "govinfo-cfr"]),
  scope_key: hashSchema,
  manifest_id: hashSchema,
  payload_hash: hashSchema,
  unit: regulatoryArtifactUnitSchema,
  state: z.enum(["acquired", "parsed"]),
  artifact_hash: hashSchema,
  artifact_bytes: z.string(),
  storage_locator: z.string().min(1),
  acquisition_receipt: regulatoryArtifactReceiptSchema,
  parser_hash: hashSchema.nullable(),
  normalized_generation: hashSchema.nullable(),
  normalized_locator: z.string().nullable(),
  parse_summary: z.unknown().nullable()
})

/** Parses one acquired current or historical unit and commits only a revalidated normalized generation. */
export async function parseLegalDiscoveryArtifact(
  pool: pg.Pool,
  value: unknown,
  options: { sourceStore?: FileArtifactStore; normalizedStore?: FileArtifactStore } = {}
) {
  const input = inputSchema.parse(value)
  invariant(isAbsolute(input.outputRoot), "legal_discovery_normalized_directory_not_absolute")
  const manifestRow = await pool.query("SELECT body FROM legislation.legal_import_manifests WHERE id=$1", [
    input.manifestId
  ])
  invariant(manifestRow.rowCount === 1, "legal_discovery_manifest_missing")
  const manifest = parseRegulatoryImportManifest(manifestRow.rows[0]?.body)
  const manifestUnit = manifest.units.find((candidate) => candidate.key === input.unitKey)
  invariant(manifestUnit, "legal_discovery_manifest_unit_missing")
  const before = await pool.query(
    `SELECT source_id,scope_key,manifest_id,payload_hash,unit,state,artifact_hash,artifact_bytes::text,storage_locator,acquisition_receipt,
     parser_hash,normalized_generation,normalized_locator,parse_summary
     FROM legislation.legal_discovery_units
     WHERE manifest_id=$1 AND unit_key=$2`,
    [manifest.id, manifestUnit.key]
  )
  invariant(before.rowCount === 1, "legal_discovery_unit_missing")
  const acquired = storedUnitSchema.parse(before.rows[0])
  invariant(
    acquired.manifest_id === manifest.id &&
      sameRegulatoryImportUnit(acquired.unit, manifestUnit) &&
      acquired.payload_hash === legalDiscoveryPayloadHash(manifestUnit) &&
      sameRegulatoryImportUnit(acquired.acquisition_receipt.unit, manifestUnit) &&
      acquired.acquisition_receipt.sha256 === acquired.artifact_hash &&
      acquired.acquisition_receipt.bytes === Number(acquired.artifact_bytes),
    "legal_discovery_parser_input_changed"
  )
  const durableSource = acquired.storage_locator.startsWith("regulatory-artifact://")
  invariant(!durableSource || options.sourceStore !== undefined, "legal_discovery_source_store_required")
  const materializedSource = durableSource
    ? join(input.outputRoot, `${randomUUID()}.source.xml`)
    : acquired.storage_locator
  if (durableSource) {
    await materializeRegulatoryArtifact(options.sourceStore!, {
      locator: acquired.storage_locator,
      hash: acquired.artifact_hash,
      bytes: Number(acquired.artifact_bytes),
      localPath: materializedSource
    })
  } else {
    await validateRegulatoryArtifactRetention(
      acquired.storage_locator,
      acquired.artifact_hash,
      Number(acquired.artifact_bytes)
    )
  }
  let parsed
  try {
    parsed = await parseRegulatoryArtifact({
      unit: manifestUnit,
      artifactHash: acquired.artifact_hash,
      path: materializedSource,
      outputRoot: input.outputRoot
    })
  } finally {
    if (durableSource) await rm(materializedSource, { force: true })
  }
  const summary = regulatoryParseSummarySchema.parse(parsed.summary)
  const normalizedLocator =
    options.normalizedStore === undefined
      ? parsed.directory
      : (
          await retainRegulatoryNormalizedBundle(options.normalizedStore, {
            directory: parsed.directory,
            generation: parsed.generation,
            sourceHash: acquired.artifact_hash,
            summary
          })
        ).locator
  const client = await pool.connect()
  try {
    await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE")
    await client.query("SET LOCAL lock_timeout='5s'")
    await client.query("SET LOCAL statement_timeout='30s'")
    const locked = storedUnitSchema.parse(
      (
        await client.query(
          `SELECT source_id,scope_key,manifest_id,payload_hash,unit,state,artifact_hash,artifact_bytes::text,storage_locator,acquisition_receipt,
           parser_hash,normalized_generation,normalized_locator,parse_summary
           FROM legislation.legal_discovery_units
           WHERE source_id=$1 AND scope_key=$2 AND unit_key=$3 FOR UPDATE`,
          [acquired.source_id, acquired.scope_key, manifestUnit.key]
        )
      ).rows[0]
    )
    invariant(
      locked.artifact_hash === acquired.artifact_hash &&
        locked.storage_locator === acquired.storage_locator &&
        sameRegulatoryImportUnit(locked.unit, acquired.unit),
      "legal_discovery_parser_input_changed"
    )
    if (locked.state === "parsed") {
      invariant(
        locked.parser_hash === summary.parserCodeHash &&
          locked.normalized_generation === parsed.generation &&
          locked.normalized_locator === normalizedLocator &&
          isDeepStrictEqual(regulatoryParseSummarySchema.parse(locked.parse_summary), summary),
        "legal_discovery_parser_replay_conflict"
      )
    } else {
      const updated = await client.query(
        `UPDATE legislation.legal_discovery_units SET state='parsed',parser_hash=$4,
         normalized_generation=$5,normalized_locator=$6,parse_summary=$7::jsonb,parsed_at=clock_timestamp()
         WHERE source_id=$1 AND scope_key=$2 AND unit_key=$3 AND state='acquired'`,
        [
          acquired.source_id,
          acquired.scope_key,
          manifestUnit.key,
          summary.parserCodeHash,
          parsed.generation,
          normalizedLocator,
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
