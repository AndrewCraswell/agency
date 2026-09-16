import { digest } from "@repo/legislation-core/legal-text/contracts"
import { requireRights } from "@repo/legislation-core/legal-text/rights"
import { storageBatchBytes, type RegulatoryLease } from "@repo/legislation-core/legal-text/storage-contract"
import type pg from "pg"
import invariant from "tiny-invariant"
import { frHtmlImportArtifact } from "./fr-import-registration.js"
import type { loadFrHtmlPublications } from "./fr-publication-files.js"
import { writeFrPublication } from "./fr-publication-write.js"
import { withImportLease } from "./storage.js"

const contract = "fr-html-publication-2026-09-14"

/** Publishes a fully revalidated HTML set and its supporting PDFs atomically under the existing generation lease. */
export async function publishFrHtmlImport(
  pool: pg.Pool,
  lease: RegulatoryLease,
  data: Awaited<ReturnType<typeof loadFrHtmlPublications>>
) {
  const body = frHtmlImportArtifact(data)
  invariant(
    Buffer.byteLength(body) <= storageBatchBytes && data.publications.length <= 1000,
    "fr_html_publication_batch_limit"
  )
  const artifacts = new Map(data.artifacts.map((artifact) => [artifact.hash, artifact]))
  const snapshotHash = digest(JSON.stringify([contract, digest(body)]))
  return withImportLease(pool, lease, async (client, generation) => {
    invariant(
      generation.contract === "fr-html-import-2026-09-14" &&
        generation.artifact_hash === digest(body) &&
        generation.expected_records === data.publications.length,
      "fr_html_publication_generation_mismatch"
    )
    invariant(generation.state === "validated" || generation.state === "published", "fr_html_publication_not_validated")
    await requireRights(client, generation.rights_profile_id, "displayText")
    await requireRights(client, generation.rights_profile_id, "localSearch")
    const staged = await client.query<{ record_key: string; record_hash: string; intact: boolean }>(
      `SELECT record_key,record_hash,payload=$2::jsonb->ordinal AS intact FROM legislation.legal_import_records WHERE generation_id=$1 ORDER BY ordinal`,
      [lease.generationId, JSON.stringify(data.publications)]
    )
    invariant(
      staged.rows.length === data.publications.length &&
        staged.rows.every(
          (row, index) =>
            row.intact &&
            row.record_key === data.publications[index]?.observationKey &&
            row.record_hash === digest(JSON.stringify(data.publications[index]))
        ),
      "fr_html_publication_staging_mismatch"
    )
    const existing = await client.query<{ snapshot_hash: string }>(
      "SELECT snapshot_hash FROM legislation.regulatory_publication_batches WHERE generation_id=$1",
      [lease.generationId]
    )
    if (existing.rows[0]) {
      invariant(
        existing.rows[0].snapshot_hash === snapshotHash && generation.state === "published",
        "fr_html_publication_snapshot_conflict"
      )
      return {
        generationId: lease.generationId,
        publications: data.publications.length,
        coverage: data.coverage,
        reused: true
      }
    }
    invariant(generation.state !== "published", "fr_html_publication_snapshot_missing")
    await client.query(
      "INSERT INTO legislation.regulatory_publication_batches(generation_id,metadata_manifest_id,metadata_manifest,snapshot_hash,reconciliation) VALUES($1,$2,$3,$4,$5)",
      [
        lease.generationId,
        data.metadata.id,
        data.metadata,
        snapshotHash,
        {
          contract,
          sourceFormat: "html_preformatted",
          publications: data.publications.length,
          coverage: data.coverage,
          quarantine: data.quarantine,
          publisherBoundariesVerified: true
        }
      ]
    )
    for (const publication of data.publications) {
      for (const hash of [publication.textVersion.artifactHash, publication.supportingPdf.receipt.sha256]) {
        const artifact = artifacts.get(hash)
        invariant(artifact && artifact.bytes > 0 && artifact.locator.length > 0, "fr_html_publication_artifact_missing")
        await client.query(
          "INSERT INTO legislation.legal_artifacts(hash,bytes,storage_locator,acquired_at) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING",
          [hash, artifact.bytes, artifact.locator, artifact.acquiredAt]
        )
        const stored = await client.query<{ bytes: string }>(
          "SELECT bytes FROM legislation.legal_artifacts WHERE hash=$1",
          [hash]
        )
        invariant(Number(stored.rows[0]?.bytes) === artifact.bytes, "fr_html_publication_artifact_collision")
      }
      const pdf = artifacts.get(publication.supportingPdf.receipt.sha256)
      invariant(pdf, "fr_html_publication_pdf_missing")
      await writeFrPublication(client, {
        identity: { kind: "publisher_number" },
        generationId: lease.generationId,
        rightsProfileId: generation.rights_profile_id,
        contract,
        row: {
          number: publication.nativeNumber,
          contentHash: publication.textVersion.key,
          // Titles belong to metadata observations. No semantic heading was extracted from this preformatted rendition.
          record: {
            heading: "",
            text: publication.textVersion.text,
            blocks: publication.textVersion.blocks,
            publicationKind: publication.publicationKind,
            sourceLocator: `${publication.textVersion.sourceUrl}#css:pre`
          },
          source: publication.metadata,
          rendition: { ...publication.supportingPdf, storageLocator: pdf.locator }
        }
      })
    }
    await client.query(
      "UPDATE legislation.legal_import_generations SET state='published',blocked_reason=NULL WHERE id=$1",
      [lease.generationId]
    )
    return {
      generationId: lease.generationId,
      publications: data.publications.length,
      coverage: data.coverage,
      reused: false
    }
  })
}
