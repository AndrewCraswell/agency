import { randomUUID } from "node:crypto"
import { readFile, rm } from "node:fs/promises"
import { isAbsolute, join } from "node:path"
import type pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"
import type { FileArtifactStore } from "../documents/artifact-store.js"
import { validateLegalDiscoveryManifest } from "./discovery-registration.js"
import { materializeRegulatoryArtifact, materializeRegulatoryArtifactFromLocator } from "./durable-artifact.js"
import { replayFrMetadata } from "./fr-metadata.js"
import { frRenditionSchema, publishFrIssue } from "./fr-storage.js"
import { claimRegulatoryLease, releaseRegulatoryLease } from "./storage.js"

const hashSchema = z.string().regex(/^[a-f0-9]{64}$/)
export const frPublicationFinalizationInputSchema = z.strictObject({ manifestId: hashSchema, unitKey: hashSchema })
const preparationSchema = z.object({
  scope_key: hashSchema,
  generation_id: hashSchema,
  metadata_manifest_id: hashSchema,
  metadata_locator: z.string().min(1),
  expected_renditions: z.int().positive(),
  validated_renditions: z.int().positive(),
  state: z.enum(["ready", "published"])
})

/** Publishes one fully prepared FR issue, then records its source-specific canonical generation on discovery state. */
export async function finalizeFrIssuePublication(
  pool: pg.Pool,
  value: unknown,
  options: { metadataStore?: FileArtifactStore; pdfStore?: FileArtifactStore; scratchRoot?: string } = {}
) {
  const input = frPublicationFinalizationInputSchema.parse(value)
  const manifestResult = await pool.query<{ body: unknown }>(
    "SELECT body FROM legislation.legal_import_manifests WHERE id=$1",
    [input.manifestId]
  )
  invariant(manifestResult.rowCount === 1, "legal_discovery_manifest_missing")
  const manifest = validateLegalDiscoveryManifest(manifestResult.rows[0]?.body)
  invariant(manifest.sourceId === "govinfo-fr", "fr_publication_finalization_requires_fr")
  invariant(
    manifest.units.some((unit) => unit.key === input.unitKey),
    "legal_discovery_manifest_unit_missing"
  )
  const preparationResult = await pool.query(
    `SELECT scope_key,generation_id,metadata_manifest_id,metadata_locator,expected_renditions,
       validated_renditions,state
     FROM legislation.legal_fr_issue_preparations
     WHERE source_id='govinfo-fr' AND scope_key=$1 AND unit_key=$2`,
    [manifest.scopeKey, input.unitKey]
  )
  invariant(preparationResult.rowCount === 1, "fr_preparation_missing")
  const preparation = preparationSchema.parse(preparationResult.rows[0])
  invariant(preparation.validated_renditions === preparation.expected_renditions, "fr_renditions_incomplete")
  const durableMetadata = preparation.metadata_locator.startsWith("regulatory-artifact://")
  invariant(
    !durableMetadata || (options.metadataStore !== undefined && options.scratchRoot !== undefined),
    "fr_metadata_store_required"
  )
  if (options.scratchRoot !== undefined) invariant(isAbsolute(options.scratchRoot), "fr_scratch_root_not_absolute")
  const metadataPath = durableMetadata
    ? join(options.scratchRoot!, `${randomUUID()}.metadata.json`)
    : preparation.metadata_locator
  if (durableMetadata) {
    await materializeRegulatoryArtifactFromLocator(options.metadataStore!, {
      locator: preparation.metadata_locator,
      localPath: metadataPath,
      maximumBytes: 128 * 1024 * 1024,
      expectedKind: "metadata"
    })
  }
  let metadata: Awaited<ReturnType<typeof replayFrMetadata>>
  try {
    metadata = await replayFrMetadata(JSON.parse(await readFile(metadataPath, "utf8")))
    invariant(metadata.id === preparation.metadata_manifest_id, "fr_metadata_manifest_changed")
  } finally {
    if (durableMetadata) await rm(metadataPath, { force: true })
  }
  const renditionResult = await pool.query(
    `SELECT receipt,inspection,storage_locator AS "storageLocator" FROM legislation.legal_fr_issue_renditions
     WHERE source_id='govinfo-fr' AND scope_key=$1 AND unit_key=$2 AND state='validated'
     ORDER BY document_number`,
    [manifest.scopeKey, input.unitKey]
  )
  invariant(renditionResult.rowCount === preparation.expected_renditions, "fr_rendition_count_mismatch")
  const renditions = renditionResult.rows.map((row) => frRenditionSchema.parse(row))
  for (const rendition of renditions) {
    if (!rendition.storageLocator.startsWith("regulatory-artifact://")) continue
    invariant(options.pdfStore !== undefined && options.scratchRoot !== undefined, "fr_pdf_store_required")
    const path = join(options.scratchRoot, `${randomUUID()}.pdf`)
    try {
      await materializeRegulatoryArtifact(options.pdfStore, {
        locator: rendition.storageLocator,
        hash: rendition.receipt.sha256,
        bytes: rendition.receipt.bytes,
        localPath: path
      })
    } finally {
      await rm(path, { force: true })
    }
  }
  const lease = await claimRegulatoryLease(pool, preparation.generation_id)
  let published
  try {
    published = await publishFrIssue(pool, lease, { metadata, renditions })
  } finally {
    await releaseRegulatoryLease(pool, lease)
  }
  const client = await pool.connect()
  try {
    await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE")
    await client.query("SET LOCAL lock_timeout='5s'")
    await client.query("SET LOCAL statement_timeout='30s'")
    const marked = await client.query(
      `UPDATE legislation.legal_discovery_units
       SET state='published',publication_generation_id=$4,edition_id=NULL,published_at=COALESCE(published_at,clock_timestamp())
       WHERE source_id='govinfo-fr' AND scope_key=$1 AND unit_key=$2 AND manifest_id=$3
         AND state IN ('parsed','published')
         AND (publication_generation_id IS NULL OR publication_generation_id=$4)
       RETURNING publication_generation_id`,
      [manifest.scopeKey, input.unitKey, manifest.id, published.generationId]
    )
    invariant(marked.rowCount === 1, "fr_discovery_publication_conflict")
    const completed = await client.query(
      `UPDATE legislation.legal_fr_issue_preparations
       SET state='published',last_error=NULL,updated_at=clock_timestamp()
       WHERE source_id='govinfo-fr' AND scope_key=$1 AND unit_key=$2
         AND generation_id=$3 AND state IN ('ready','published')
       RETURNING unit_key`,
      [manifest.scopeKey, input.unitKey, published.generationId]
    )
    invariant(completed.rowCount === 1, "fr_preparation_publication_conflict")
    await client.query("COMMIT")
    return { ...published, state: "published" as const, editionId: null, scopeKey: manifest.scopeKey }
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}
