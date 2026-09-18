import { digest } from "@repo/legislation-core/legal-text/contracts"
import { requireRights } from "@repo/legislation-core/legal-text/rights"
import { officialFederalRights, storageBatchBytes } from "@repo/legislation-core/legal-text/storage-contract"
import type { RegulatoryLease } from "@repo/legislation-core/legal-text/storage-contract"
import type pg from "pg"
import invariant from "tiny-invariant"
import { isSupportedFrMetadataType } from "./fr-metadata-contract.js"
import type { loadFrHtmlPublications } from "./fr-publication-files.js"
import { withImportLease } from "./storage.js"

type Loaded = Awaited<ReturnType<typeof loadFrHtmlPublications>>
const contract = "fr-html-import-2026-09-14"

/** Registers a locally revalidated, bounded HTML set. Caller retains the exact input artifact before registration. */
export async function registerFrHtmlImport(
  pool: pg.Pool,
  data: Loaded,
  artifact: { body: string; locator: string; acquiredAt: string }
) {
  invariant(data.publications.length <= 1000, "fr_html_import_count_limit")
  const body = frHtmlImportArtifact(data)
  invariant(
    body === artifact.body && Buffer.byteLength(body) <= storageBatchBytes,
    "fr_html_import_artifact_mismatch_or_limit"
  )
  const artifactHash = digest(body)
  const policyHash = digest(JSON.stringify(officialFederalRights))
  const profileId = `official-federal-text:${policyHash}`
  const id = digest(JSON.stringify([contract, data.metadata.id, artifactHash, profileId]))
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    await client.query("SET LOCAL lock_timeout='5s'")
    await client.query("SET LOCAL statement_timeout='60s'")
    await client.query(
      "INSERT INTO legislation.legal_rights_profiles(id,policy_hash,policy) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
      [profileId, policyHash, officialFederalRights]
    )
    await requireRights(client, profileId, "retainRaw")
    await client.query(
      "INSERT INTO legislation.legal_sources(id,publisher,authority) VALUES('govinfo-fr','GPO','official') ON CONFLICT DO NOTHING"
    )
    await client.query("INSERT INTO legislation.legal_import_manifests(id,body) VALUES($1,$2) ON CONFLICT DO NOTHING", [
      data.metadata.id,
      data.metadata
    ])
    await client.query(
      "INSERT INTO legislation.legal_artifacts(hash,bytes,storage_locator,acquired_at) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING",
      [artifactHash, Buffer.byteLength(body), artifact.locator, artifact.acquiredAt]
    )
    for (const evidence of data.artifacts) {
      await client.query(
        "INSERT INTO legislation.legal_artifacts(hash,bytes,storage_locator,acquired_at) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING",
        [evidence.hash, evidence.bytes, evidence.locator, evidence.acquiredAt]
      )
      const stored = await client.query<{ bytes: string }>(
        "SELECT bytes FROM legislation.legal_artifacts WHERE hash=$1",
        [evidence.hash]
      )
      invariant(Number(stored.rows[0]?.bytes) === evidence.bytes, "fr_html_import_artifact_collision")
    }
    await client.query(
      `INSERT INTO legislation.legal_import_generations
      (id,manifest_id,unit_key,source_id,jurisdiction_id,rights_profile_id,artifact_hash,parser_hash,contract,unit,summary,expected_records)
      VALUES($1,$2,$1,'govinfo-fr','jurisdiction:us',$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING`,
      [
        id,
        data.metadata.id,
        profileId,
        artifactHash,
        data.normalizerHash,
        contract,
        { format: "html_publication_set", sourceId: "govinfo-fr", issueDate: data.date },
        {
          contract,
          records: data.publications.length,
          normalizedArtifactHash: artifactHash,
          coverage: data.coverage,
          quarantine: data.quarantine
        },
        data.publications.length
      ]
    )
    await client.query("COMMIT")
    return { generationId: id, artifactHash, contract }
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

export function frHtmlImportArtifact(data: Loaded) {
  const expected = data.metadata.records.filter(
    (row) => row.publication_date === data.date && isSupportedFrMetadataType(row.type)
  )
  const hashes = [
    ...data.publications.map((row) => row.metadataHash),
    ...data.quarantine.map((row) => row.metadataHash)
  ]
  invariant(
    expected.length > 0 &&
      expected.length <= 1000 &&
      hashes.length === expected.length &&
      new Set(hashes).size === hashes.length &&
      expected.every((row) => hashes.includes(digest(JSON.stringify(row)))) &&
      data.coverage.metadataExpected === expected.length &&
      data.coverage.verified === data.publications.length &&
      data.coverage.quarantined === data.quarantine.length &&
      data.coverage.issueInventoryVerified === false,
    "fr_html_import_coverage_mismatch"
  )
  invariant(
    data.quarantine.every(
      (row) =>
        row.reason === "fr_html_subject_mismatch" &&
        [row.htmlHash, row.pdfHash].every((hash) => data.artifacts.some((artifact) => artifact.hash === hash))
    ),
    "fr_html_quarantine_evidence_missing"
  )
  return JSON.stringify({
    contract,
    metadataManifestId: data.metadata.id,
    date: data.date,
    normalizerHash: data.normalizerHash,
    publications: data.publications,
    coverage: data.coverage,
    quarantine: data.quarantine
  })
}

/** Stages the whole bounded set under one fenced transaction; exact replay is immutable. No canonical/outbox writes. */
export async function stageFrHtmlImport(pool: pg.Pool, lease: RegulatoryLease, data: Loaded) {
  const body = frHtmlImportArtifact(data)
  invariant(Buffer.byteLength(body) <= storageBatchBytes, "fr_html_import_byte_limit")
  return withImportLease(pool, lease, async (client, generation) => {
    invariant(
      generation.contract === contract &&
        generation.artifact_hash === digest(body) &&
        generation.expected_records === data.publications.length,
      "fr_html_import_generation_mismatch"
    )
    invariant(generation.state === "staging" || generation.state === "validated", "fr_html_import_state_mismatch")
    const rows = data.publications.map((payload, ordinal) => ({
      key: payload.observationKey,
      native: payload.nativeNumber,
      ordinal,
      kind: payload.publicationKind,
      locator: payload.textVersion.sourceLocator,
      bytes: Buffer.byteLength(JSON.stringify(payload)),
      hash: digest(JSON.stringify(payload)),
      payload
    }))
    const result = await client.query(
      `INSERT INTO legislation.legal_import_records
      (generation_id,record_key,native_id,ordinal,parent_key,node_kind,source_locator,identity_key,payload_bytes,record_hash,payload)
      SELECT $1,x.key,x.native,x.ordinal,NULL,x.kind,x.locator,x.native,x.bytes,x.hash,x.payload FROM jsonb_to_recordset($2::jsonb)
      AS x(key text,native text,ordinal integer,kind text,locator text,bytes integer,hash text,payload jsonb)
      ON CONFLICT(generation_id,record_key) DO UPDATE SET record_hash=legal_import_records.record_hash WHERE legal_import_records.record_hash=excluded.record_hash`,
      [lease.generationId, JSON.stringify(rows)]
    )
    invariant(result.rowCount === data.publications.length, "fr_html_staged_record_conflict")
    const count = await client.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM legislation.legal_import_records WHERE generation_id=$1",
      [lease.generationId]
    )
    invariant(count.rows[0]?.count === data.publications.length, "fr_html_staged_count_mismatch")
    await client.query("UPDATE legislation.legal_import_generations SET state='validated' WHERE id=$1", [
      lease.generationId
    ])
    return { generationId: lease.generationId, records: result.rowCount, state: "validated", published: false }
  })
}
