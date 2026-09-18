import { randomUUID } from "node:crypto"
import { readFile, rm } from "node:fs/promises"
import { isAbsolute, join } from "node:path"
import { isDeepStrictEqual } from "node:util"
import { regulatoryRecordSchema } from "@repo/legislation-core/legal-text/parser-contract"
import type pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"
import type { FileArtifactStore } from "../documents/artifact-store.js"
import { currentReceiptSchema } from "./artifact-backfill.js"
import { legalDiscoveryUnitSchema } from "./discovery-checkpoint.js"
import { validateLegalDiscoveryManifest } from "./discovery-registration.js"
import {
  inspectRegulatoryArtifactFile,
  materializeRegulatoryArtifact,
  materializeRegulatoryArtifactFromLocator,
  retainRegulatoryArtifact
} from "./durable-artifact.js"
import { materializeRegulatoryNormalizedBundle } from "./durable-normalized-bundle.js"
import {
  frMetadataRecordSchema,
  isSupportedFrMetadataType,
  normalizeFrDocumentNumber,
  type FrMetadataManifest
} from "./fr-metadata-contract.js"
import { collectFrMetadataToDirectory, replayFrMetadata } from "./fr-metadata.js"
import { frPdfLocation, reconcileFrIssue } from "./fr-reconciliation.js"
import { importNormalizedRegulatoryUnit } from "./import-normalized.js"

const hashSchema = z.string().regex(/^[a-f0-9]{64}$/)
const inputSchema = z.strictObject({
  manifestId: hashSchema,
  unitKey: hashSchema,
  metadataRoot: z.string().min(1)
})
const discoveryRowSchema = z.object({
  source_id: z.literal("govinfo-fr"),
  scope_key: hashSchema,
  manifest_id: hashSchema,
  state: z.enum(["parsed", "published"]),
  unit: legalDiscoveryUnitSchema,
  acquisition_receipt: currentReceiptSchema,
  storage_locator: z.string().min(1),
  parser_hash: hashSchema,
  normalized_locator: z.string().min(1)
})

export const frPublicationRenditionIntentSchema = z.strictObject({
  documentNumber: z.string().regex(/^[A-Z0-9]+(?:-[A-Z0-9]+)+$/),
  sourceUrl: z.url(),
  metadataRecord: frMetadataRecordSchema
})

export function planFrPublicationRenditions(input: {
  issueDate: string
  metadata: FrMetadataManifest
  reconciliation: ReturnType<typeof reconcileFrIssue>
}) {
  const issueDate = z.iso.date().parse(input.issueDate)
  invariant(
    input.metadata.scope.start === issueDate && input.metadata.scope.end === issueDate,
    "fr_metadata_scope_mismatch"
  )
  invariant(input.reconciliation.issueDate === issueDate, "fr_reconciliation_issue_mismatch")
  invariant(input.reconciliation.metadataManifestId === input.metadata.id, "fr_reconciliation_metadata_mismatch")
  invariant(input.reconciliation.metadataComplete, "fr_metadata_incomplete")
  const byNumber = new Map(
    input.metadata.records
      .filter((record) => record.publication_date === issueDate && isSupportedFrMetadataType(record.type))
      .map((record) => [normalizeFrDocumentNumber(record.document_number), record])
  )
  const intents = input.reconciliation.matches.map((match) => {
    const metadataRecord = byNumber.get(match.documentNumber)
    invariant(metadataRecord, "fr_rendition_metadata_missing")
    invariant(metadataRecord.pdf_url !== null, "fr_required_rendition_not_listed")
    return frPublicationRenditionIntentSchema.parse({
      documentNumber: match.documentNumber,
      sourceUrl: frPdfLocation(metadataRecord.pdf_url, match.documentNumber, issueDate),
      metadataRecord
    })
  })
  invariant(intents.length > 0 && intents.length <= 1000, "fr_issue_requires_partitioned_writer")
  invariant(new Set(intents.map((intent) => intent.documentNumber)).size === intents.length, "fr_duplicate_rendition")
  return intents.sort((left, right) => left.documentNumber.localeCompare(right.documentNumber))
}

async function loadOrCollectMetadata(
  directory: string,
  issueDate: string,
  collect: typeof collectFrMetadataToDirectory,
  options: { store?: FileArtifactStore; retainedLocator?: string } = {}
) {
  if (options.retainedLocator?.startsWith("regulatory-artifact://")) {
    invariant(options.store, "fr_metadata_store_required")
    const localPath = join(directory, `${randomUUID()}.metadata.json`)
    try {
      await materializeRegulatoryArtifactFromLocator(options.store, {
        locator: options.retainedLocator,
        localPath,
        maximumBytes: 128 * 1024 * 1024,
        expectedKind: "metadata"
      })
      const manifest = await replayFrMetadata(JSON.parse(await readFile(localPath, "utf8")))
      invariant(
        manifest.scope.start === issueDate && manifest.scope.end === issueDate && manifest.scope.cutoff === issueDate,
        "fr_metadata_scope_mismatch"
      )
      return { manifest, manifestPath: options.retainedLocator, reused: true }
    } finally {
      await rm(localPath, { force: true })
    }
  }
  const manifestPath = join(directory, "manifest.json")
  try {
    const manifest = await replayFrMetadata(JSON.parse(await readFile(manifestPath, "utf8")))
    invariant(
      manifest.scope.start === issueDate && manifest.scope.end === issueDate && manifest.scope.cutoff === issueDate,
      "fr_metadata_scope_mismatch"
    )
    const retained = await retainMetadata(options.store, manifestPath)
    return { manifest, manifestPath: retained ?? manifestPath, reused: true }
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error
  }
  const manifest = await collect(directory, { start: issueDate, end: issueDate, cutoff: issueDate })
  const retained = await retainMetadata(options.store, manifestPath)
  return { manifest, manifestPath: retained ?? manifestPath, reused: false }
}

async function retainMetadata(store: FileArtifactStore | undefined, manifestPath: string) {
  if (store === undefined) return undefined
  const file = await inspectRegulatoryArtifactFile(manifestPath)
  return (
    await retainRegulatoryArtifact(store, {
      kind: "metadata",
      hash: file.hash,
      bytes: file.bytes,
      extension: "json",
      localPath: manifestPath
    })
  ).locator
}

/** Stages one parsed FR issue, freezes its exact-day metadata, and atomically registers resumable PDF work. */
export async function prepareFrIssuePublication(
  pool: pg.Pool,
  value: unknown,
  options: {
    collectMetadata?: typeof collectFrMetadataToDirectory
    sourceStore?: FileArtifactStore
    normalizedStore?: FileArtifactStore
    metadataStore?: FileArtifactStore
  } = {}
) {
  const input = inputSchema.parse(value)
  invariant(isAbsolute(input.metadataRoot), "fr_metadata_root_not_absolute")
  const manifestResult = await pool.query<{ body: unknown }>(
    "SELECT body FROM legislation.legal_import_manifests WHERE id=$1",
    [input.manifestId]
  )
  invariant(manifestResult.rowCount === 1, "legal_discovery_manifest_missing")
  const manifest = validateLegalDiscoveryManifest(manifestResult.rows[0]?.body)
  invariant(manifest.sourceId === "govinfo-fr", "fr_publication_preparation_requires_fr")
  const manifestUnit = manifest.units.find((unit) => unit.key === input.unitKey)
  invariant(manifestUnit?.issueDate, "fr_publication_preparation_unit_missing")
  const selected = await pool.query(
    `SELECT source_id,scope_key,manifest_id,state,unit,acquisition_receipt,storage_locator,parser_hash,normalized_locator
     FROM legislation.legal_discovery_units
     WHERE source_id=$1 AND scope_key=$2 AND unit_key=$3`,
    [manifest.sourceId, manifest.scopeKey, input.unitKey]
  )
  invariant(selected.rowCount === 1, "legal_discovery_unit_missing")
  const row = discoveryRowSchema.parse(selected.rows[0])
  invariant(
    row.manifest_id === manifest.id && isDeepStrictEqual(row.unit, manifestUnit),
    "fr_preparation_input_changed"
  )
  const retainedPreparation = await pool.query<{ metadata_locator: string }>(
    `SELECT metadata_locator FROM legislation.legal_fr_issue_preparations
     WHERE source_id='govinfo-fr' AND scope_key=$1 AND unit_key=$2`,
    [manifest.scopeKey, manifestUnit.key]
  )
  const metadataDirectory = join(input.metadataRoot, manifestUnit.key)
  const metadata = await loadOrCollectMetadata(
    metadataDirectory,
    manifestUnit.issueDate,
    options.collectMetadata ?? collectFrMetadataToDirectory,
    { store: options.metadataStore, retainedLocator: retainedPreparation.rows[0]?.metadata_locator }
  )
  const durableSource = row.storage_locator.startsWith("regulatory-artifact://")
  const durableNormalized = row.normalized_locator.startsWith("regulatory-artifact://")
  invariant(durableSource === durableNormalized, "fr_discovery_durability_mismatch")
  invariant(
    !durableSource || (options.sourceStore !== undefined && options.normalizedStore !== undefined),
    "fr_discovery_artifact_stores_required"
  )
  const materializedSource = durableSource
    ? join(input.metadataRoot, `${randomUUID()}.source.xml`)
    : row.storage_locator
  let materializedDirectory: string | undefined
  let staged: Awaited<ReturnType<typeof importNormalizedRegulatoryUnit>>
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
          outputRoot: input.metadataRoot
        })
      ).directory
    }
    staged = await importNormalizedRegulatoryUnit(pool, {
      manifest,
      receipt: row.acquisition_receipt,
      directory: materializedDirectory ?? row.normalized_locator,
      parserCodeHash: row.parser_hash,
      artifactLocator: row.storage_locator,
      artifactValidationPath: materializedSource
    })
  } finally {
    if (durableSource) await rm(materializedSource, { force: true })
    if (materializedDirectory !== undefined) await rm(materializedDirectory, { recursive: true, force: true })
  }
  invariant(staged.state === "validated" || staged.state === "published", "fr_staging_not_validated")
  const recordsResult = await pool.query<{ payload: unknown }>(
    "SELECT payload FROM legislation.legal_import_records WHERE generation_id=$1 ORDER BY ordinal",
    [staged.generationId]
  )
  const records = recordsResult.rows.map((item) => regulatoryRecordSchema.parse(item.payload))
  const generation = await pool.query<{ summary: unknown }>(
    "SELECT summary FROM legislation.legal_import_generations WHERE id=$1",
    [staged.generationId]
  )
  invariant(generation.rowCount === 1, "fr_generation_missing")
  const verifiedReconciliation = reconcileFrIssue({
    unit: manifestUnit,
    summary: generation.rows[0]?.summary,
    records,
    metadata: metadata.manifest.records,
    metadataManifestId: metadata.manifest.id
  })
  const intents = planFrPublicationRenditions({
    issueDate: manifestUnit.issueDate,
    metadata: metadata.manifest,
    reconciliation: verifiedReconciliation
  })
  const client = await pool.connect()
  try {
    await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE")
    await client.query("SET LOCAL lock_timeout='5s'")
    await client.query("SET LOCAL statement_timeout='30s'")
    const preparation = await client.query(
      `INSERT INTO legislation.legal_fr_issue_preparations
       (source_id,scope_key,unit_key,manifest_id,issue_date,generation_id,metadata_manifest_id,
        metadata_locator,metadata_records,expected_renditions)
       VALUES('govinfo-fr',$1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT(source_id,scope_key,unit_key) DO UPDATE SET updated_at=legal_fr_issue_preparations.updated_at
       WHERE legal_fr_issue_preparations.manifest_id=EXCLUDED.manifest_id
         AND legal_fr_issue_preparations.issue_date=EXCLUDED.issue_date
         AND legal_fr_issue_preparations.generation_id=EXCLUDED.generation_id
         AND legal_fr_issue_preparations.metadata_manifest_id=EXCLUDED.metadata_manifest_id
         AND legal_fr_issue_preparations.metadata_locator=EXCLUDED.metadata_locator
         AND legal_fr_issue_preparations.metadata_records=EXCLUDED.metadata_records
         AND legal_fr_issue_preparations.expected_renditions=EXCLUDED.expected_renditions
         AND legal_fr_issue_preparations.state<>'quarantined'
       RETURNING state,validated_renditions`,
      [
        manifest.scopeKey,
        manifestUnit.key,
        manifest.id,
        manifestUnit.issueDate,
        staged.generationId,
        metadata.manifest.id,
        metadata.manifestPath,
        metadata.manifest.records.length,
        intents.length
      ]
    )
    invariant(preparation.rowCount === 1, "fr_publication_preparation_conflict")
    for (const intent of intents) {
      const inserted = await client.query(
        `INSERT INTO legislation.legal_fr_issue_renditions
         (source_id,scope_key,unit_key,document_number,metadata_manifest_id,metadata_record)
         VALUES('govinfo-fr',$1,$2,$3,$4,$5::jsonb)
         ON CONFLICT(source_id,scope_key,unit_key,document_number) DO UPDATE
           SET updated_at=legal_fr_issue_renditions.updated_at
         WHERE legal_fr_issue_renditions.metadata_manifest_id=EXCLUDED.metadata_manifest_id
           AND legal_fr_issue_renditions.metadata_record=EXCLUDED.metadata_record
           AND legal_fr_issue_renditions.state<>'quarantined'
         RETURNING state`,
        [
          manifest.scopeKey,
          manifestUnit.key,
          intent.documentNumber,
          metadata.manifest.id,
          JSON.stringify(intent.metadataRecord)
        ]
      )
      invariant(inserted.rowCount === 1, "fr_rendition_intent_conflict")
    }
    await client.query("COMMIT")
    return {
      manifestId: manifest.id,
      scopeKey: manifest.scopeKey,
      unitKey: manifestUnit.key,
      issueDate: manifestUnit.issueDate,
      generationId: staged.generationId,
      metadataManifestId: metadata.manifest.id,
      metadataReused: metadata.reused,
      expectedRenditions: intents.length,
      renditions: intents.map(({ documentNumber }) => ({ documentNumber }))
    }
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}
