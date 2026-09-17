import { isDeepStrictEqual } from "node:util"
import type pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"
import { currentReceiptSchema } from "./artifact-backfill.js"
import { legalDiscoveryUnitSchema } from "./discovery-checkpoint.js"
import { validateLegalDiscoveryManifest } from "./discovery-registration.js"
import { importNormalizedRegulatoryUnit } from "./import-normalized.js"

const hashSchema = z.string().regex(/^[a-f0-9]{64}$/)
const publicationInputSchema = z.strictObject({
  manifestId: hashSchema,
  unitKey: hashSchema
})
const discoveryRowSchema = z.object({
  state: z.enum(["parsed", "published"]),
  unit: legalDiscoveryUnitSchema,
  acquisition_receipt: currentReceiptSchema,
  storage_locator: z.string().min(1),
  parser_hash: hashSchema,
  normalized_locator: z.string().min(1),
  publication_generation_id: hashSchema.nullable(),
  edition_id: z.uuid().nullable()
})
const publicationResultSchema = z.object({
  generationId: hashSchema,
  editionId: z.uuid(),
  state: z.literal("published"),
  isCurrent: z.boolean(),
  reused: z.boolean()
})

/** Publishes one fully parsed current eCFR unit and records the canonical identities on its durable discovery row. */
export async function publishLegalDiscoveryUnit(pool: pg.Pool, value: unknown) {
  const input = publicationInputSchema.parse(value)
  const manifestResult = await pool.query<{ body: unknown }>(
    "SELECT body FROM legislation.legal_import_manifests WHERE id=$1",
    [input.manifestId]
  )
  invariant(manifestResult.rowCount === 1, "legal_discovery_manifest_missing")
  const manifest = validateLegalDiscoveryManifest(manifestResult.rows[0]?.body)
  invariant(manifest.sourceId === "ecfr", "legal_discovery_publication_requires_ecfr")
  const manifestUnit = manifest.units.find((unit) => unit.key === input.unitKey)
  invariant(manifestUnit, "legal_discovery_manifest_unit_missing")

  const selected = await pool.query(
    `SELECT state,unit,acquisition_receipt,storage_locator,parser_hash,normalized_locator,
      publication_generation_id,edition_id
     FROM legislation.legal_discovery_units
     WHERE source_id=$1 AND scope_key=$2 AND unit_key=$3`,
    [manifest.sourceId, manifest.scopeKey, input.unitKey]
  )
  invariant(selected.rowCount === 1, "legal_discovery_unit_missing")
  const row = discoveryRowSchema.parse(selected.rows[0])
  invariant(isDeepStrictEqual(row.unit, manifestUnit), "legal_discovery_publication_unit_mismatch")
  invariant(
    isDeepStrictEqual(row.acquisition_receipt.unit, manifestUnit),
    "legal_discovery_publication_receipt_mismatch"
  )

  const published = publicationResultSchema.parse(
    await importNormalizedRegulatoryUnit(pool, {
      manifest,
      receipt: row.acquisition_receipt,
      directory: row.normalized_locator,
      parserCodeHash: row.parser_hash,
      artifactLocator: row.storage_locator
    })
  )

  const client = await pool.connect()
  try {
    await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE")
    await client.query("SET LOCAL lock_timeout='5s'")
    await client.query("SET LOCAL statement_timeout='30s'")
    const lockedResult = await client.query(
      `SELECT state,unit,acquisition_receipt,storage_locator,parser_hash,normalized_locator,
        publication_generation_id,edition_id
       FROM legislation.legal_discovery_units
       WHERE source_id=$1 AND scope_key=$2 AND unit_key=$3 FOR UPDATE`,
      [manifest.sourceId, manifest.scopeKey, input.unitKey]
    )
    const locked = discoveryRowSchema.parse(lockedResult.rows[0])
    invariant(
      isDeepStrictEqual(locked.unit, row.unit) &&
        isDeepStrictEqual(locked.acquisition_receipt, row.acquisition_receipt) &&
        locked.storage_locator === row.storage_locator &&
        locked.parser_hash === row.parser_hash &&
        locked.normalized_locator === row.normalized_locator,
      "legal_discovery_publication_input_changed"
    )
    if (locked.state === "published") {
      invariant(
        locked.publication_generation_id === published.generationId && locked.edition_id === published.editionId,
        "legal_discovery_publication_conflict"
      )
      await client.query("COMMIT")
      return { ...published, reused: true }
    }
    const updated = await client.query(
      `UPDATE legislation.legal_discovery_units
       SET state='published',publication_generation_id=$4,edition_id=$5,published_at=clock_timestamp()
       WHERE source_id=$1 AND scope_key=$2 AND unit_key=$3 AND state='parsed'`,
      [manifest.sourceId, manifest.scopeKey, input.unitKey, published.generationId, published.editionId]
    )
    invariant(updated.rowCount === 1, "legal_discovery_publication_lost")
    await client.query("COMMIT")
    return published
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}
