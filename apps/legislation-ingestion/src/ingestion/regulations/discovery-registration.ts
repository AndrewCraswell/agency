import { isDeepStrictEqual } from "node:util"
import { digest, officialUrl, unitIdentity } from "@repo/legislation-core/legal-text/contracts"
import type pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"
import { legalDiscoveryPayloadHash, legalDiscoveryUnitSchema } from "./discovery-checkpoint.js"

export const legalDiscoveryManifestContract = "regulatory-current-acquisition-2026-09-17" as const

const hashSchema = z.string().regex(/^[a-f0-9]{64}$/)
const sourceSchema = z.enum(["ecfr", "govinfo-fr", "govinfo-cfr"])
const registrationSchema = z.strictObject({
  sourceId: sourceSchema,
  scopeKey: hashSchema,
  limit: z.int().min(1).max(100)
})

export const legalDiscoveryManifestSchema = z.strictObject({
  contract: z.literal(legalDiscoveryManifestContract),
  id: hashSchema,
  sourceId: sourceSchema,
  scopeKey: hashSchema,
  units: z.array(legalDiscoveryUnitSchema).min(1).max(100),
  createdFrom: z.literal("legal-discovery"),
  recurringIngestionEnabled: z.literal(false)
})

export type LegalDiscoveryManifest = z.infer<typeof legalDiscoveryManifestSchema>

function manifestIdentity(value: Omit<LegalDiscoveryManifest, "id">) {
  return digest(
    JSON.stringify([
      value.contract,
      value.sourceId,
      value.scopeKey,
      value.units.map((unit) => [unit.key, legalDiscoveryPayloadHash(unit)])
    ])
  )
}

export function validateLegalDiscoveryManifest(value: unknown) {
  const manifest = legalDiscoveryManifestSchema.parse(value)
  invariant(manifest.id === manifestIdentity(manifest), "legal_discovery_manifest_identity_mismatch")
  invariant(
    new Set(manifest.units.map((unit) => unit.key)).size === manifest.units.length,
    "legal_discovery_manifest_duplicate_unit"
  )
  for (const unit of manifest.units) {
    invariant(unit.sourceId === manifest.sourceId, "legal_discovery_manifest_source_mismatch")
    invariant(unit.key === unitIdentity(unit), "legal_discovery_manifest_unit_identity_mismatch")
    officialUrl(unit.sourceUrl, unit.sourceId)
  }
  return manifest
}

/** Atomically moves one bounded pending page into an immutable current-acquisition manifest. */
export async function registerLegalDiscoveryManifest(pool: pg.Pool, value: unknown) {
  const input = registrationSchema.parse(value)
  const client = await pool.connect()
  try {
    await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE")
    await client.query("SET LOCAL lock_timeout='5s'")
    await client.query("SET LOCAL statement_timeout='30s'")
    const checkpoint = await client.query(
      `SELECT 1 FROM legislation.legal_discovery_checkpoints
       WHERE source_id=$1 AND scope_key=$2 FOR SHARE`,
      [input.sourceId, input.scopeKey]
    )
    invariant(checkpoint.rowCount === 1, "legal_discovery_scope_missing")
    const selected = await client.query(
      `SELECT unit_key,payload_hash,unit FROM legislation.legal_discovery_units
       WHERE source_id=$1 AND scope_key=$2 AND state='pending'
       ORDER BY discovered_at,unit_key FOR UPDATE SKIP LOCKED LIMIT $3`,
      [input.sourceId, input.scopeKey, input.limit]
    )
    if (selected.rows.length === 0) {
      await client.query("COMMIT")
      return null
    }
    const units = selected.rows.map((row) => {
      const parsed = z
        .object({ unit_key: hashSchema, payload_hash: hashSchema, unit: legalDiscoveryUnitSchema })
        .parse(row)
      invariant(parsed.unit.sourceId === input.sourceId, "legal_discovery_registration_source_mismatch")
      invariant(parsed.unit.key === parsed.unit_key, "legal_discovery_registration_key_mismatch")
      invariant(unitIdentity(parsed.unit) === parsed.unit_key, "legal_discovery_registration_identity_mismatch")
      invariant(
        legalDiscoveryPayloadHash(parsed.unit) === parsed.payload_hash,
        "legal_discovery_registration_payload_mismatch"
      )
      return parsed.unit
    })
    const bodyWithoutId = {
      contract: legalDiscoveryManifestContract,
      sourceId: input.sourceId,
      scopeKey: input.scopeKey,
      units,
      createdFrom: "legal-discovery" as const,
      recurringIngestionEnabled: false as const
    }
    const manifest = validateLegalDiscoveryManifest({
      ...bodyWithoutId,
      id: manifestIdentity(bodyWithoutId)
    })
    await client.query(
      `INSERT INTO legislation.legal_import_manifests(id,body) VALUES($1,$2::jsonb)
       ON CONFLICT(id) DO UPDATE SET body=legal_import_manifests.body
       WHERE legal_import_manifests.body=EXCLUDED.body`,
      [manifest.id, JSON.stringify(manifest)]
    )
    const stored = await client.query("SELECT body FROM legislation.legal_import_manifests WHERE id=$1 FOR SHARE", [
      manifest.id
    ])
    const storedManifest = legalDiscoveryManifestSchema.safeParse(stored.rows[0]?.body)
    invariant(
      stored.rowCount === 1 && storedManifest.success && isDeepStrictEqual(storedManifest.data, manifest),
      "legal_discovery_manifest_conflict"
    )
    const updated = await client.query(
      `UPDATE legislation.legal_discovery_units
       SET state='registered',manifest_id=$3,registered_at=clock_timestamp()
       WHERE source_id=$1 AND scope_key=$2 AND state='pending' AND unit_key=ANY($4::text[])`,
      [input.sourceId, input.scopeKey, manifest.id, units.map((unit) => unit.key)]
    )
    invariant(updated.rowCount === units.length, "legal_discovery_registration_lost")
    await client.query("COMMIT")
    return manifest
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}
