import type pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"
import { frMetadataRecordSchema } from "./fr-metadata-contract.js"
import { frPdfInspectionSchema } from "./fr-pdf-validation.js"
import { pdfReceiptSchema } from "./fr-pdf.js"

/** Shared canonical row writer. Caller holds the fenced transaction and validates source and rights evidence first. */
export async function writeFrPublication(
  client: pg.PoolClient,
  input: {
    generationId: string
    rightsProfileId: string
    contract: string
    row: {
      number: string
      contentHash: string
      record: {
        heading: string
        text: string
        blocks: unknown[]
        publicationKind: string | null
        sourceLocator: string
      }
      source: z.infer<typeof frMetadataRecordSchema>
      rendition: {
        receipt: z.infer<typeof pdfReceiptSchema>
        inspection: z.infer<typeof frPdfInspectionSchema>
        storageLocator: string
      }
    }
  }
) {
  const row = input.row
  const { receipt, inspection, storageLocator } = row.rendition
  await client.query(
    `INSERT INTO legislation.legal_artifacts(hash,bytes,storage_locator,acquired_at)
        VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
    [receipt.sha256, receipt.bytes, storageLocator, receipt.acquiredAt]
  )
  const artifact = await client.query<{ bytes: string }>(
    "SELECT bytes FROM legislation.legal_artifacts WHERE hash=$1",
    [receipt.sha256]
  )
  invariant(Number(artifact.rows[0]?.bytes) === receipt.bytes, "fr_artifact_collision")
  const document = await client.query<{ id: string }>(
    `INSERT INTO legislation.regulatory_documents
        (jurisdiction_id,identity_namespace,native_number) VALUES('jurisdiction:us','federal-register',$1)
        ON CONFLICT(jurisdiction_id,identity_namespace,native_number) DO UPDATE SET native_number=excluded.native_number RETURNING id`,
    [row.number]
  )
  const documentId = document.rows[0]?.id
  invariant(documentId, "fr_document_missing")
  const version = await client.query<{ id: string }>(
    `INSERT INTO legislation.regulatory_document_versions
        (document_id,content_hash,input_contract,pdf_hash,heading,body,blocks,publication_kind)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(document_id,content_hash,input_contract,pdf_hash)
        DO UPDATE SET content_hash=excluded.content_hash RETURNING id`,
    [
      documentId,
      row.contentHash,
      input.contract,
      receipt.sha256,
      row.record.heading,
      row.record.text,
      JSON.stringify(row.record.blocks),
      row.record.publicationKind
    ]
  )
  const observation = await client.query<{ id: string }>(
    `INSERT INTO legislation.regulatory_document_observations
        (generation_id,document_id,version_id,source_id,jurisdiction_id,rights_profile_id,publication_date,metadata,source_locator,pdf_receipt,pdf_inspection)
        VALUES($1,$2,$3,'govinfo-fr','jurisdiction:us',$4,$5,$6,$7,$8,$9) RETURNING id`,
    [
      input.generationId,
      documentId,
      version.rows[0]?.id,
      input.rightsProfileId,
      row.source.publication_date,
      row.source,
      row.record.sourceLocator,
      receipt,
      inspection
    ]
  )
  await client.query(
    "INSERT INTO legislation.regulatory_publication_outbox(observation_id,operation) VALUES($1,'lexical')",
    [observation.rows[0]?.id]
  )
}
