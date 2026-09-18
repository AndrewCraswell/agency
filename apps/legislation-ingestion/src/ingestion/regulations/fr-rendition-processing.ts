import { randomUUID } from "node:crypto"
import { rm } from "node:fs/promises"
import { isAbsolute, join } from "node:path"
import type pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"
import type { FileArtifactStore } from "../documents/artifact-store.js"
import { createGovInfoProviderRequestAdmission } from "../provider-request-admission.js"
import { materializeRegulatoryArtifact, retainRegulatoryArtifact } from "./durable-artifact.js"
import { frMetadataRecordSchema, normalizeFrDocumentNumber } from "./fr-metadata-contract.js"
import { validateFrPdfEvidence, validateFrPdfInWorker } from "./fr-pdf-validation.js"
import { acquireFrPdfs, pdfReceiptSchema } from "./fr-pdf.js"
import { RegulatorySourceClient } from "./source-client.js"

const hashSchema = z.string().regex(/^[a-f0-9]{64}$/)
export const frRenditionProcessingInputSchema = z.strictObject({
  scopeKey: hashSchema,
  unitKey: hashSchema,
  documentNumber: z.string().regex(/^[A-Z0-9]+(?:-[A-Z0-9]+)+$/),
  pdfRoot: z.string().min(1)
})
const claimedSchema = z.object({
  issue_date: z.coerce.date(),
  metadata_manifest_id: hashSchema,
  metadata_record: frMetadataRecordSchema,
  state: z.enum(["pending", "acquired"]),
  receipt: pdfReceiptSchema.nullable(),
  storage_locator: z.string().nullable(),
  lease_token: z.uuid()
})

function errorCode(error: unknown) {
  return (error instanceof Error ? error.message : "fr_rendition_processing_failed").slice(0, 256)
}

/** Acquires and validates one official PDF under a database lease, then advances its parent issue gate. */
export async function processFrRendition(
  pool: pg.Pool,
  value: unknown,
  options: {
    acquire?: typeof acquireFrPdfs
    inspect?: typeof validateFrPdfInWorker
    pdfStore?: FileArtifactStore
    sourceClient?: RegulatorySourceClient
  } = {}
) {
  const input = frRenditionProcessingInputSchema.parse(value)
  invariant(isAbsolute(input.pdfRoot), "fr_pdf_root_not_absolute")
  const token = randomUUID()
  const claimedResult = await pool.query(
    `UPDATE legislation.legal_fr_issue_renditions rendition
     SET lease_token=$4,lease_expires_at=clock_timestamp()+interval '4 minutes',attempt=attempt+1,
       last_error=NULL,updated_at=clock_timestamp()
     FROM legislation.legal_fr_issue_preparations preparation
     WHERE rendition.source_id='govinfo-fr' AND rendition.scope_key=$1 AND rendition.unit_key=$2
       AND rendition.document_number=$3 AND rendition.state IN ('pending','acquired')
       AND (rendition.lease_token IS NULL OR rendition.lease_expires_at<clock_timestamp())
       AND preparation.source_id=rendition.source_id AND preparation.scope_key=rendition.scope_key
       AND preparation.unit_key=rendition.unit_key AND preparation.state='renditions_pending'
     RETURNING preparation.issue_date,rendition.metadata_manifest_id,rendition.metadata_record,rendition.state,
       rendition.receipt,rendition.storage_locator,rendition.lease_token`,
    [input.scopeKey, input.unitKey, input.documentNumber, token]
  )
  if (claimedResult.rowCount !== 1) {
    const existing = await pool.query<{ preparation_state: string; state: string }>(
      `SELECT rendition.state,preparation.state AS preparation_state
       FROM legislation.legal_fr_issue_renditions rendition
       JOIN legislation.legal_fr_issue_preparations preparation USING(source_id,scope_key,unit_key)
       WHERE rendition.source_id='govinfo-fr' AND rendition.scope_key=$1 AND rendition.unit_key=$2
         AND rendition.document_number=$3`,
      [input.scopeKey, input.unitKey, input.documentNumber]
    )
    invariant(existing.rowCount === 1, "fr_rendition_missing")
    if (existing.rows[0]?.state === "validated") {
      return {
        ...input,
        state: "validated" as const,
        reused: true,
        publicationReady: ["ready", "published"].includes(existing.rows[0].preparation_state)
      }
    }
    throw new Error("fr_rendition_busy_or_not_publishable")
  }
  let claimed = claimedSchema.parse(claimedResult.rows[0])
  invariant(
    normalizeFrDocumentNumber(claimed.metadata_record.document_number) === input.documentNumber,
    "fr_rendition_identity_mismatch"
  )
  invariant(
    claimed.metadata_record.publication_date === claimed.issue_date.toISOString().slice(0, 10),
    "fr_rendition_date_mismatch"
  )
  const directory = join(input.pdfRoot, input.unitKey)
  try {
    if (claimed.state === "pending") {
      const admission = createGovInfoProviderRequestAdmission(pool)
      const sourceClient =
        options.sourceClient ??
        new RegulatorySourceClient({
          beforeAttempt: () => admission.beforeAttempt(),
          afterAttemptComplete: (telemetry) => admission.afterAttempt(telemetry),
          minimumIntervalMs: 0
        })
      const acquired = await (options.acquire ?? acquireFrPdfs)({
        metadataManifestId: claimed.metadata_manifest_id,
        records: [claimed.metadata_record],
        date: claimed.metadata_record.publication_date,
        directory,
        limit: 1,
        client: sourceClient
      })
      invariant(acquired.acquisitionComplete && acquired.results.length === 1, "fr_rendition_acquisition_incomplete")
      const result = acquired.results[0]
      invariant(result?.status === "acquired", "fr_rendition_acquisition_failed")
      const receipt = pdfReceiptSchema.parse(result.receipt)
      const localPath = join(directory, "blobs", `${receipt.sha256}.pdf`)
      const storageLocator =
        options.pdfStore === undefined
          ? localPath
          : (
              await retainRegulatoryArtifact(options.pdfStore, {
                kind: "pdf",
                hash: receipt.sha256,
                bytes: receipt.bytes,
                extension: "pdf",
                localPath
              })
            ).locator
      const saved = await pool.query(
        `UPDATE legislation.legal_fr_issue_renditions
         SET state='acquired',receipt=$5::jsonb,storage_locator=$6,updated_at=clock_timestamp(),
           lease_expires_at=clock_timestamp()+interval '4 minutes'
         WHERE source_id='govinfo-fr' AND scope_key=$1 AND unit_key=$2 AND document_number=$3
           AND lease_token=$4 AND lease_expires_at>clock_timestamp() AND state='pending'
         RETURNING metadata_manifest_id,metadata_record,state,receipt,storage_locator,lease_token,
           (SELECT issue_date FROM legislation.legal_fr_issue_preparations
             WHERE source_id='govinfo-fr' AND scope_key=$1 AND unit_key=$2) issue_date`,
        [input.scopeKey, input.unitKey, input.documentNumber, token, JSON.stringify(receipt), storageLocator]
      )
      invariant(saved.rowCount === 1, "fr_rendition_lease_lost")
      claimed = claimedSchema.parse(saved.rows[0])
    }
    const receipt = pdfReceiptSchema.parse(claimed.receipt)
    invariant(claimed.storage_locator, "fr_rendition_storage_missing")
    const durablePdf = claimed.storage_locator.startsWith("regulatory-artifact://")
    invariant(!durablePdf || options.pdfStore !== undefined, "fr_pdf_store_required")
    const validationPath = durablePdf ? join(directory, `${randomUUID()}.validation.pdf`) : claimed.storage_locator
    try {
      if (durablePdf) {
        await materializeRegulatoryArtifact(options.pdfStore!, {
          locator: claimed.storage_locator,
          hash: receipt.sha256,
          bytes: receipt.bytes,
          localPath: validationPath
        })
      }
      const inspection = validateFrPdfEvidence({
        inspection: await (options.inspect ?? validateFrPdfInWorker)(validationPath, input.documentNumber),
        expectedHash: receipt.sha256,
        expectedBytes: receipt.bytes,
        expectedPages: claimed.metadata_record.end_page - claimed.metadata_record.start_page + 1
      })
      const client = await pool.connect()
      try {
        await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE")
        await client.query("SET LOCAL lock_timeout='5s'")
        await client.query("SET LOCAL statement_timeout='30s'")
        const advanced = await client.query(
          `UPDATE legislation.legal_fr_issue_renditions
         SET state='validated',inspection=$5::jsonb,lease_token=NULL,lease_expires_at=NULL,
           last_error=NULL,updated_at=clock_timestamp()
         WHERE source_id='govinfo-fr' AND scope_key=$1 AND unit_key=$2 AND document_number=$3
           AND lease_token=$4 AND lease_expires_at>clock_timestamp() AND state='acquired'
         RETURNING document_number`,
          [input.scopeKey, input.unitKey, input.documentNumber, token, JSON.stringify(inspection)]
        )
        invariant(advanced.rowCount === 1, "fr_rendition_lease_lost")
        const counted = await client.query<{ count: number }>(
          `SELECT count(*)::integer AS count FROM legislation.legal_fr_issue_renditions
         WHERE source_id='govinfo-fr' AND scope_key=$1 AND unit_key=$2 AND state='validated'`,
          [input.scopeKey, input.unitKey]
        )
        const validated = counted.rows[0]?.count ?? 0
        const preparation = await client.query<{ expected_renditions: number; state: string }>(
          `UPDATE legislation.legal_fr_issue_preparations
         SET validated_renditions=$3,state=CASE WHEN expected_renditions=$3 THEN 'ready' ELSE state END,
           updated_at=clock_timestamp()
         WHERE source_id='govinfo-fr' AND scope_key=$1 AND unit_key=$2 AND state IN ('renditions_pending','ready')
         RETURNING expected_renditions,state`,
          [input.scopeKey, input.unitKey, validated]
        )
        invariant(preparation.rowCount === 1, "fr_preparation_missing")
        await client.query("COMMIT")
        return {
          ...input,
          state: "validated" as const,
          reused: false,
          validatedRenditions: validated,
          expectedRenditions: preparation.rows[0]?.expected_renditions,
          publicationReady: preparation.rows[0]?.state === "ready"
        }
      } catch (error) {
        await client.query("ROLLBACK")
        throw error
      } finally {
        client.release()
      }
    } finally {
      if (durablePdf) await rm(validationPath, { force: true })
    }
  } catch (error) {
    await pool.query(
      `UPDATE legislation.legal_fr_issue_renditions
       SET lease_token=NULL,lease_expires_at=NULL,last_error=$5,updated_at=clock_timestamp()
       WHERE source_id='govinfo-fr' AND scope_key=$1 AND unit_key=$2 AND document_number=$3 AND lease_token=$4`,
      [input.scopeKey, input.unitKey, input.documentNumber, token, errorCode(error)]
    )
    throw error
  }
}
