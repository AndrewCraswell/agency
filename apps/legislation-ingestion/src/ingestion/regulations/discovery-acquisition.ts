import { isAbsolute, join } from "node:path"
import { isDeepStrictEqual } from "node:util"
import type pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"
import { acquireCurrentRegulatoryArtifact, currentReceiptSchema } from "./artifact-backfill.js"
import { legalDiscoveryPayloadHash, legalDiscoveryUnitSchema } from "./discovery-checkpoint.js"
import { legalDiscoveryManifestSchema } from "./discovery-registration.js"
import type { RegulatorySourceClient } from "./source-client.js"

const hashSchema = z.string().regex(/^[a-f0-9]{64}$/)
const inputSchema = z.strictObject({
  manifestId: hashSchema,
  unitKey: hashSchema,
  artifactDirectory: z.string().min(1)
})

/** Acquires one registered current unit and commits its immutable artifact reference to the discovery checkpoint. */
export async function acquireLegalDiscoveryArtifact(
  pool: pg.Pool,
  value: unknown,
  options: { maximumBytes?: number; client?: RegulatorySourceClient } = {}
) {
  const input = inputSchema.parse(value)
  invariant(isAbsolute(input.artifactDirectory), "legal_discovery_artifact_directory_not_absolute")
  const manifestRow = await pool.query("SELECT body FROM legislation.legal_import_manifests WHERE id=$1", [
    input.manifestId
  ])
  invariant(manifestRow.rowCount === 1, "legal_discovery_manifest_missing")
  const manifest = legalDiscoveryManifestSchema.parse(manifestRow.rows[0]?.body)
  const unit = manifest.units.find((candidate) => candidate.key === input.unitKey)
  invariant(unit, "legal_discovery_manifest_unit_missing")
  const acquired = await acquireCurrentRegulatoryArtifact(input.artifactDirectory, unit, options)
  const { reused, ...receiptValue } = acquired
  const receipt = currentReceiptSchema.parse(receiptValue)
  const storageLocator = join(input.artifactDirectory, "blobs", `${receipt.sha256}.xml`)
  const client = await pool.connect()
  try {
    await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE")
    await client.query("SET LOCAL lock_timeout='5s'")
    await client.query("SET LOCAL statement_timeout='30s'")
    const selected = await client.query(
      `SELECT manifest_id,payload_hash,unit,state,artifact_hash,artifact_bytes::text,storage_locator,acquisition_receipt
       FROM legislation.legal_discovery_units
       WHERE source_id=$1 AND scope_key=$2 AND unit_key=$3 FOR UPDATE`,
      [manifest.sourceId, manifest.scopeKey, unit.key]
    )
    invariant(selected.rowCount === 1, "legal_discovery_unit_missing")
    const row = z
      .object({
        manifest_id: hashSchema,
        payload_hash: hashSchema,
        unit: legalDiscoveryUnitSchema,
        state: z.enum(["registered", "acquired"]),
        artifact_hash: hashSchema.nullable(),
        artifact_bytes: z.string().nullable(),
        storage_locator: z.string().nullable(),
        acquisition_receipt: z.unknown().nullable()
      })
      .parse(selected.rows[0])
    invariant(
      row.manifest_id === manifest.id &&
        isDeepStrictEqual(row.unit, unit) &&
        row.payload_hash === legalDiscoveryPayloadHash(unit),
      "legal_discovery_acquisition_unit_changed"
    )
    await client.query(
      `INSERT INTO legislation.legal_artifacts(hash,bytes,storage_locator,acquired_at) VALUES($1,$2,$3,$4)
       ON CONFLICT(hash) DO NOTHING`,
      [receipt.sha256, receipt.bytes, storageLocator, receipt.acquiredAt]
    )
    const artifact = await client.query(
      "SELECT bytes::text,storage_locator FROM legislation.legal_artifacts WHERE hash=$1 FOR SHARE",
      [receipt.sha256]
    )
    invariant(
      artifact.rowCount === 1 &&
        artifact.rows[0]?.bytes === String(receipt.bytes) &&
        artifact.rows[0]?.storage_locator === storageLocator,
      "legal_discovery_artifact_conflict"
    )
    if (row.state === "acquired") {
      invariant(
        row.artifact_hash === receipt.sha256 &&
          row.artifact_bytes === String(receipt.bytes) &&
          row.storage_locator === storageLocator &&
          isDeepStrictEqual(currentReceiptSchema.parse(row.acquisition_receipt), receipt),
        "legal_discovery_acquisition_replay_conflict"
      )
    } else {
      const updated = await client.query(
        `UPDATE legislation.legal_discovery_units SET state='acquired',artifact_hash=$4,artifact_bytes=$5,
         storage_locator=$6,acquisition_receipt=$7::jsonb,acquired_at=$8
         WHERE source_id=$1 AND scope_key=$2 AND unit_key=$3 AND state='registered'`,
        [
          manifest.sourceId,
          manifest.scopeKey,
          unit.key,
          receipt.sha256,
          receipt.bytes,
          storageLocator,
          JSON.stringify(receipt),
          receipt.acquiredAt
        ]
      )
      invariant(updated.rowCount === 1, "legal_discovery_acquisition_lost")
    }
    await client.query("COMMIT")
    return { manifestId: manifest.id, unitKey: unit.key, artifactHash: receipt.sha256, bytes: receipt.bytes, reused }
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}
