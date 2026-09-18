import { randomUUID } from "node:crypto"
import { rm } from "node:fs/promises"
import { isAbsolute, join } from "node:path"
import { isDeepStrictEqual } from "node:util"
import { validateManifest } from "@repo/legislation-core/legal-text/contracts"
import type pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"
import type { FileArtifactStore } from "../documents/artifact-store.js"
import { regulatoryArtifactReceiptSchema, regulatoryArtifactUnitSchema } from "./artifact-backfill.js"
import { materializeRegulatoryArtifact } from "./durable-artifact.js"
import { materializeRegulatoryNormalizedBundle } from "./durable-normalized-bundle.js"
import { importNormalizedRegulatoryUnit } from "./import-normalized.js"
import { sameRegulatoryImportUnit } from "./regulatory-import-contract.js"

const hashSchema = z.string().regex(/^[a-f0-9]{64}$/)
const inputSchema = z.strictObject({ manifestId: hashSchema, unitKey: hashSchema })
const annualScopeSchema = z.strictObject({
  manifestId: hashSchema,
  year: z.int().min(1996).max(9999),
  title: z.int().min(1).max(50)
})
const annualIdentity = /^CFR-(\d{4})-title(\d+)-vol(\d+)$/
const rowSchema = z.object({
  source_id: z.literal("govinfo-cfr"),
  scope_key: hashSchema,
  manifest_id: hashSchema,
  state: z.enum(["parsed", "published"]),
  unit: regulatoryArtifactUnitSchema,
  acquisition_receipt: regulatoryArtifactReceiptSchema,
  storage_locator: z.string().min(1),
  parser_hash: hashSchema,
  normalized_locator: z.string().min(1)
})
const materializedResultSchema = z.object({
  generationId: hashSchema,
  editionId: z.uuid(),
  state: z.enum(["materialized", "published"])
})

function annualUnitIdentity(unit: z.infer<typeof regulatoryArtifactUnitSchema>) {
  const match = annualIdentity.exec(unit.nativeId)
  invariant(match && unit.sourceId === "govinfo-cfr" && unit.edition === match[1], "annual_cfr_unit_identity_invalid")
  return {
    year: z.coerce.number().int().min(1996).parse(match[1]),
    title: z.coerce.number().int().min(1).max(50).parse(match[2]),
    volume: z.coerce.number().int().positive().parse(match[3])
  }
}

/** Materializes one annual volume while leaving its discovery row unpublished until the complete-title barrier passes. */
export async function materializeAnnualCfrDiscoveryUnit(
  pool: pg.Pool,
  value: unknown,
  options: { sourceStore?: FileArtifactStore; normalizedStore?: FileArtifactStore; scratchRoot?: string } = {}
) {
  const input = inputSchema.parse(value)
  const manifestResult = await pool.query<{ body: unknown }>(
    "SELECT body FROM legislation.legal_import_manifests WHERE id=$1",
    [input.manifestId]
  )
  invariant(manifestResult.rowCount === 1, "legal_discovery_manifest_missing")
  const manifest = validateManifest(manifestResult.rows[0]?.body)
  const manifestUnit = manifest.units.find((unit) => unit.key === input.unitKey)
  invariant(manifestUnit?.sourceId === "govinfo-cfr", "annual_cfr_manifest_unit_missing")
  const identity = annualUnitIdentity(manifestUnit)
  const selected = await pool.query(
    `SELECT source_id,scope_key,manifest_id,state,unit,acquisition_receipt,storage_locator,parser_hash,normalized_locator
     FROM legislation.legal_discovery_units WHERE manifest_id=$1 AND unit_key=$2`,
    [manifest.id, manifestUnit.key]
  )
  invariant(selected.rowCount === 1, "legal_discovery_unit_missing")
  const row = rowSchema.parse(selected.rows[0])
  invariant(
    row.manifest_id === manifest.id &&
      sameRegulatoryImportUnit(row.unit, manifestUnit) &&
      sameRegulatoryImportUnit(row.acquisition_receipt.unit, manifestUnit),
    "annual_cfr_discovery_input_mismatch"
  )
  const durableSource = row.storage_locator.startsWith("regulatory-artifact://")
  const durableNormalized = row.normalized_locator.startsWith("regulatory-artifact://")
  invariant(durableSource === durableNormalized, "legal_discovery_durability_mismatch")
  invariant(
    !durableSource ||
      (options.sourceStore !== undefined && options.normalizedStore !== undefined && options.scratchRoot !== undefined),
    "legal_discovery_artifact_stores_required"
  )
  if (options.scratchRoot !== undefined)
    invariant(isAbsolute(options.scratchRoot), "legal_discovery_scratch_not_absolute")
  const materializedSource = durableSource
    ? join(options.scratchRoot!, `${randomUUID()}.source.xml`)
    : row.storage_locator
  let materializedDirectory: string | undefined
  try {
    if (durableSource) {
      await materializeRegulatoryArtifact(options.sourceStore!, {
        locator: row.storage_locator,
        hash: row.acquisition_receipt.sha256,
        bytes: row.acquisition_receipt.bytes,
        localPath: materializedSource
      })
      materializedDirectory = (
        await materializeRegulatoryNormalizedBundle(options.normalizedStore!, {
          locator: row.normalized_locator,
          outputRoot: options.scratchRoot!
        })
      ).directory
    }
    const result = materializedResultSchema.parse(
      await importNormalizedRegulatoryUnit(pool, {
        manifest,
        receipt: row.acquisition_receipt,
        directory: materializedDirectory ?? row.normalized_locator,
        parserCodeHash: row.parser_hash,
        artifactLocator: row.storage_locator,
        artifactValidationPath: materializedSource
      })
    )
    const unchanged = rowSchema.parse(
      (
        await pool.query(
          `SELECT source_id,scope_key,manifest_id,state,unit,acquisition_receipt,storage_locator,parser_hash,normalized_locator
           FROM legislation.legal_discovery_units WHERE source_id=$1 AND scope_key=$2 AND unit_key=$3`,
          [row.source_id, row.scope_key, manifestUnit.key]
        )
      ).rows[0]
    )
    invariant(isDeepStrictEqual(unchanged, row), "annual_cfr_discovery_input_changed")
    return { ...result, ...identity, scopeKey: row.scope_key, manifestId: manifest.id, unitKey: manifestUnit.key }
  } finally {
    if (durableSource) await rm(materializedSource, { force: true })
    if (materializedDirectory !== undefined) await rm(materializedDirectory, { recursive: true, force: true })
  }
}

/** Returns an exact publication payload only after every manifest volume for the title is materialized. */
export async function inspectAnnualCfrDiscoveryPublication(pool: pg.Pool, value: unknown) {
  const input = annualScopeSchema.parse(value)
  const stored = await pool.query<{ body: unknown }>(
    "SELECT body FROM legislation.legal_import_manifests WHERE id=$1",
    [input.manifestId]
  )
  invariant(stored.rowCount === 1, "legal_discovery_manifest_missing")
  const manifest = validateManifest(stored.rows[0]?.body)
  const expected = manifest.units
    .filter((unit) => unit.sourceId === "govinfo-cfr")
    .map((unit) => ({ unit, identity: annualUnitIdentity(unit) }))
    .filter(({ identity }) => identity.year === input.year && identity.title === input.title)
    .sort((left, right) => left.identity.volume - right.identity.volume)
  invariant(expected.length > 0, "annual_cfr_title_not_in_manifest")
  invariant(
    new Set(expected.map(({ identity }) => identity.volume)).size === expected.length,
    "annual_cfr_duplicate_volume"
  )
  const rows = z
    .array(
      z.object({
        id: hashSchema,
        unit_key: hashSchema,
        state: z.enum(["materialized", "published"])
      })
    )
    .parse(
      (
        await pool.query(
          `SELECT id,unit_key,state FROM legislation.legal_import_generations
           WHERE manifest_id=$1 AND source_id='govinfo-cfr' AND unit_key=ANY($2::text[])
             AND state IN ('materialized','published') ORDER BY unit_key,id`,
          [manifest.id, expected.map(({ unit }) => unit.key)]
        )
      ).rows
    )
  const byUnit = new Map<string, string>()
  for (const row of rows) {
    invariant(!byUnit.has(row.unit_key), "annual_cfr_multiple_materialized_generations")
    byUnit.set(row.unit_key, row.id)
  }
  const pendingUnitKeys = expected.map(({ unit }) => unit.key).filter((key) => !byUnit.has(key))
  const generationIds = expected.flatMap(({ unit }) => {
    const generation = byUnit.get(unit.key)
    return generation === undefined ? [] : [generation]
  })
  return {
    manifestId: manifest.id,
    year: input.year,
    title: input.title,
    expectedVolumes: expected.length,
    materializedVolumes: generationIds.length,
    pendingUnitKeys,
    ready: pendingUnitKeys.length === 0,
    payload:
      pendingUnitKeys.length === 0
        ? { manifestId: manifest.id, year: input.year, title: input.title, generationIds }
        : null
  }
}

/** Links an atomically published annual title back to every durable source-stage row. */
export async function finalizeAnnualCfrDiscoveryPublication(pool: pg.Pool, value: unknown) {
  const input = annualScopeSchema.extend({ generationIds: z.array(hashSchema).min(1).max(200) }).parse(value)
  const readiness = await inspectAnnualCfrDiscoveryPublication(pool, {
    manifestId: input.manifestId,
    year: input.year,
    title: input.title
  })
  invariant(readiness.ready && readiness.payload !== null, "annual_cfr_discovery_not_ready")
  invariant(
    isDeepStrictEqual([...input.generationIds].sort(), [...readiness.payload.generationIds].sort()),
    "annual_cfr_discovery_generation_mismatch"
  )
  const client = await pool.connect()
  try {
    await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE")
    await client.query("SET LOCAL lock_timeout='5s'")
    await client.query("SET LOCAL statement_timeout='30s'")
    const linked = await client.query(
      `SELECT unit.source_id,unit.scope_key,unit.unit_key,unit.state,unit.publication_generation_id,unit.edition_id,
         generation.id generation_id,edition.id canonical_edition_id
       FROM legislation.legal_discovery_units unit
       JOIN legislation.legal_import_generations generation
         ON generation.manifest_id=unit.manifest_id AND generation.unit_key=unit.unit_key
       JOIN legislation.legal_editions edition ON edition.generation_id=generation.id
       WHERE unit.manifest_id=$1 AND generation.id=ANY($2::text[]) AND generation.state='published'
       FOR UPDATE OF unit`,
      [input.manifestId, input.generationIds]
    )
    if (linked.rowCount === 0) {
      const admitted = await client.query(
        `SELECT count(*)::integer count FROM legislation.legal_discovery_units unit
         JOIN legislation.legal_import_generations generation
           ON generation.manifest_id=unit.manifest_id AND generation.unit_key=unit.unit_key
         WHERE unit.manifest_id=$1 AND generation.id=ANY($2::text[])`,
        [input.manifestId, input.generationIds]
      )
      invariant(admitted.rows[0]?.count === 0, "annual_cfr_discovery_generation_missing")
      await client.query("COMMIT")
      return { linked: 0, reused: true }
    }
    invariant(linked.rowCount === input.generationIds.length, "annual_cfr_discovery_generation_missing")
    let reused = true
    for (const value of linked.rows) {
      const row = z
        .object({
          source_id: z.literal("govinfo-cfr"),
          scope_key: hashSchema,
          unit_key: hashSchema,
          state: z.enum(["parsed", "published"]),
          publication_generation_id: hashSchema.nullable(),
          edition_id: z.uuid().nullable(),
          generation_id: hashSchema,
          canonical_edition_id: z.uuid()
        })
        .parse(value)
      if (row.state === "published") {
        invariant(
          row.publication_generation_id === row.generation_id && row.edition_id === row.canonical_edition_id,
          "annual_cfr_discovery_publication_conflict"
        )
        continue
      }
      const updated = await client.query(
        `UPDATE legislation.legal_discovery_units SET state='published',publication_generation_id=$4,
         edition_id=$5,published_at=clock_timestamp()
         WHERE source_id=$1 AND scope_key=$2 AND unit_key=$3 AND state='parsed'`,
        [row.source_id, row.scope_key, row.unit_key, row.generation_id, row.canonical_edition_id]
      )
      invariant(updated.rowCount === 1, "annual_cfr_discovery_publication_lost")
      reused = false
    }
    await client.query("COMMIT")
    return { linked: linked.rowCount, reused }
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}
