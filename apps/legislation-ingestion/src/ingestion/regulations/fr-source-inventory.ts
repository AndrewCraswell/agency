import { isDeepStrictEqual } from "node:util"
import { acquisitionUnitSchema, digest } from "@repo/legislation-core/legal-text/contracts"
import { regulatoryParseSummarySchema, regulatoryRecordSchema } from "@repo/legislation-core/legal-text/parser-contract"
import type { RegulatoryLease } from "@repo/legislation-core/legal-text/storage-contract"
import type pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"
import { frMetadataRecordSchema, isSupportedFrMetadataType, normalizeFrDocumentNumber } from "./fr-metadata-contract.js"
import { replayFrMetadata } from "./fr-metadata.js"
import { frSubjectKey } from "./fr-subject.js"
import { withLease } from "./storage.js"

const contract = "fr-source-inventory-2026-09-15"
const reviewedIssueHash = "5c8fa553adc3c2c5b041ac8b1b1cc6cac1edd4945111037bd4f4fbf574566201"
const reviewedCitations = new Map([
  [
    "fr:2000-01-18:65:2537:rule",
    { path: "/FEDREG[1]/RULES[1]/RULE[5]", kind: "final_rule", title: "Revision of Class D Airspace; Hobbs, NM" }
  ],
  [
    "fr:2000-01-18:65:2639:notice",
    {
      path: "/FEDREG[1]/NOTICES[1]/NOTICE[62]",
      kind: "notice",
      title: "Notice of Filing of Plat of an Island; Minnesota"
    }
  ]
])

/** Full source-record accounting. Candidate metadata is not rendition approval or permission to publish text. */
export function buildFrSourceInventory(input: {
  unit: unknown
  summary: unknown
  records: unknown[]
  metadata: unknown[]
}) {
  const unit = acquisitionUnitSchema.parse(input.unit)
  const summary = regulatoryParseSummarySchema.parse(input.summary)
  const records = z.array(regulatoryRecordSchema).min(1).max(1000).parse(input.records)
  const metadata = z
    .array(frMetadataRecordSchema)
    .max(50000)
    .parse(input.metadata)
    .filter((row) => row.publication_date === unit.issueDate && isSupportedFrMetadataType(row.type))
  invariant(
    unit.sourceId === "govinfo-fr" && unit.issueDate !== null && summary.warnings.length === 0,
    "fr_source_inventory_scope_required"
  )
  invariant(
    records.length === summary.records &&
      summary.records === summary.sourceRecords &&
      records.length ===
        (summary.sourceTagCounts.RULE ?? 0) +
          (summary.sourceTagCounts.PRORULE ?? 0) +
          (summary.sourceTagCounts.NOTICE ?? 0),
    "fr_source_inventory_incomplete"
  )
  const rows = records.map((record) => {
    invariant(
      record.recordType === "publication" &&
        record.provenance.sourceId === unit.sourceId &&
        record.provenance.acquisitionUnitId === unit.key &&
        record.provenance.artifactHash === summary.inputHash &&
        record.provenance.publisherIssueDate === unit.issueDate,
      "fr_source_inventory_provenance_mismatch"
    )
    const footers = record.blocks.filter((block) => block.tag === "FRDOC")
    const number = /^\s*\[?FR Doc\.\s+([A-Za-z0-9]+(?:-[A-Za-z0-9]+)+)\s+Filed(?=\s|[0-9])/i.exec(
      footers[0]?.text ?? ""
    )?.[1]
    invariant(footers.length === 1 && number, "fr_source_number_missing")
    const publisherNumber = normalizeFrDocumentNumber(number)
    const citation = record.identityBasis === "citation" ? reviewedCitations.get(record.nativeId) : undefined
    if (record.identityBasis === "citation") {
      invariant(
        citation &&
          publisherNumber === "00-113" &&
          summary.inputHash === reviewedIssueHash &&
          unit.nativeId === "FR-2000-01-18" &&
          citation.path === record.sourceLocator &&
          citation.kind === record.publicationKind &&
          frSubjectKey(citation.title) === frSubjectKey(record.heading),
        "fr_citation_evidence_unreviewed"
      )
    } else {
      invariant(
        record.identityBasis === "document_number" && normalizeFrDocumentNumber(record.nativeId) === publisherNumber,
        "fr_source_identity_mismatch"
      )
    }
    return {
      recordKey: record.recordKey,
      recordHash: digest(JSON.stringify(record)),
      sourceObservationKey: digest(JSON.stringify([summary.inputHash, record.sourceLocator])),
      sourceLocator: record.sourceLocator,
      publisherNumber,
      publicationDate: unit.issueDate,
      identityNamespace: citation ? "federal-register-citation" : "federal-register",
      nativeIdentity: citation ? record.nativeId : publisherNumber,
      citationKey: citation ? record.nativeId : null,
      heading: record.heading,
      kind: record.publicationKind
    }
  })
  invariant(
    new Set(rows.map((row) => row.recordKey)).size === rows.length &&
      new Set(rows.map((row) => row.sourceObservationKey)).size === rows.length &&
      new Set(rows.map((row) => `${row.identityNamespace}:${row.nativeIdentity}`)).size === rows.length,
    "fr_source_inventory_duplicate"
  )
  const observations = rows.map((row) => {
    const candidates = metadata.filter(
      (candidate) => normalizeFrDocumentNumber(candidate.document_number) === row.publisherNumber
    )
    const aliases = rows.filter((candidate) => candidate.publisherNumber === row.publisherNumber)
    const candidate = candidates[0]
    const expectedKind = candidate
      ? {
          Rule: "final_rule",
          "Proposed Rule": "proposed_rule",
          Notice: "notice",
          "Presidential Document": null,
          "Uncategorized Document": null
        }[candidate.type]
      : null
    let metadataStatus = "candidate"
    if (candidates.length === 0) {
      metadataStatus = "missing"
    } else if (candidates.length > 1) {
      metadataStatus = "ambiguous"
    } else if (
      aliases.length > 1 ||
      !candidate ||
      expectedKind !== row.kind ||
      frSubjectKey(candidate.title) !== frSubjectKey(row.heading)
    ) {
      metadataStatus = "conflict"
    }
    return { ...row, metadataStatus, metadataCandidates: candidates }
  })
  const numbers = new Set(rows.map((row) => row.publisherNumber))
  return {
    contract,
    sourceRecords: rows.length,
    uniquePublisherNumbers: numbers.size,
    metadataRecords: metadata.length,
    metadataWithoutSource: metadata
      .filter((row) => !numbers.has(normalizeFrDocumentNumber(row.document_number)))
      .map((row) => row.document_number),
    ambiguousAliases: [...numbers].filter((number) => rows.filter((row) => row.publisherNumber === number).length > 1),
    observations,
    publicationReady: false as const
  }
}

/** A number can resolve to multiple source documents. Never choose the first candidate. */
export async function resolveFrSourceNumber(pool: pg.Pool, date: string, number: string) {
  const rows = await pool.query<{ id: string; identity_namespace: string; native_number: string }>(
    `SELECT DISTINCT d.id,d.identity_namespace,d.native_number FROM legislation.regulatory_source_documents s
    JOIN legislation.regulatory_documents d ON d.id=s.document_id
    JOIN legislation.legal_import_generations g ON g.id=s.generation_id
    JOIN legislation.legal_rights_profiles r ON r.id=g.rights_profile_id AND r.is_active
    WHERE s.publication_date=$1 AND s.publisher_number=$2 ORDER BY d.id LIMIT 101`,
    [z.iso.date().parse(date), normalizeFrDocumentNumber(number)]
  )
  invariant(rows.rows.length <= 100, "fr_source_alias_requires_pagination")
  let status = "missing"
  if (rows.rows.length > 1) {
    status = "ambiguous"
  } else if (rows.rows.length === 1) {
    status = "unique"
  }
  return {
    status,
    documents: rows.rows,
    publicationReady: false
  }
}

/** Fenced registration of identities and source observations only. Existing publication gates remain mandatory. */
export async function registerFrSourceInventory(pool: pg.Pool, lease: RegulatoryLease, metadataInput: unknown) {
  const metadata = await replayFrMetadata(metadataInput)
  return withLease(pool, lease, async (client, generation) => {
    invariant(["blocked", "validated", "published"].includes(generation.state), "fr_source_inventory_requires_staging")
    const count = (
      await client.query<{ count: number; bytes: number }>(
        "SELECT count(*)::int AS count,coalesce(sum(payload_bytes),0)::float8 AS bytes FROM legislation.legal_import_records WHERE generation_id=$1",
        [lease.generationId]
      )
    ).rows[0]
    invariant(
      count && count.count <= 1000 && count.bytes <= 64 * 1024 * 1024,
      "fr_source_inventory_requires_partitioning"
    )
    const staged = await client.query<{ payload: unknown; record_hash: string }>(
      "SELECT payload,record_hash FROM legislation.legal_import_records WHERE generation_id=$1 ORDER BY ordinal",
      [lease.generationId]
    )
    const records = staged.rows.map((row) => {
      const record = regulatoryRecordSchema.parse(row.payload)
      invariant(digest(JSON.stringify(record)) === row.record_hash, "fr_source_inventory_staging_changed")
      return record
    })
    const report = buildFrSourceInventory({
      unit: generation.unit,
      summary: generation.summary,
      records,
      metadata: metadata.records
    })
    const snapshotHash = digest(JSON.stringify([contract, metadata.id, report]))
    const existing = (
      await client.query<{ snapshot_hash: string }>(
        "SELECT snapshot_hash FROM legislation.regulatory_source_inventories WHERE generation_id=$1",
        [lease.generationId]
      )
    ).rows[0]
    if (existing) {
      invariant(existing.snapshot_hash === snapshotHash, "fr_source_inventory_snapshot_conflict")
      const stored = await client.query<{
        record_key: string
        source_observation_key: string
        publisher_number: string
        publication_date: string
        citation_key: string | null
        metadata_status: string
        evidence: unknown
        identity_namespace: string
        native_number: string
      }>(
        `SELECT s.*,s.publication_date::text,d.identity_namespace,d.native_number
        FROM legislation.regulatory_source_documents s JOIN legislation.regulatory_documents d ON d.id=s.document_id
        WHERE s.generation_id=$1`,
        [lease.generationId]
      )
      invariant(
        stored.rows.length === report.sourceRecords &&
          stored.rows.every((row) => {
            const expected = report.observations.find((item) => item.recordKey === row.record_key)
            return (
              expected &&
              isDeepStrictEqual(row.evidence, expected) &&
              row.publisher_number === expected.publisherNumber &&
              row.publication_date === expected.publicationDate &&
              row.source_observation_key === expected.sourceObservationKey &&
              row.citation_key === expected.citationKey &&
              row.metadata_status === expected.metadataStatus &&
              row.identity_namespace === expected.identityNamespace &&
              row.native_number === expected.nativeIdentity
            )
          }),
        "fr_source_inventory_retention_incomplete"
      )
      return { generationId: lease.generationId, ...report, reused: true }
    }
    await client.query(
      "INSERT INTO legislation.regulatory_source_inventories(generation_id,metadata_manifest_id,metadata_manifest,snapshot_hash,coverage) VALUES($1,$2,$3,$4,$5)",
      [lease.generationId, metadata.id, metadata, snapshotHash, report]
    )
    for (const row of report.observations) {
      const document = (
        await client.query<{ id: string }>(
          `INSERT INTO legislation.regulatory_documents(jurisdiction_id,identity_namespace,native_number)
        VALUES('jurisdiction:us',$1,$2) ON CONFLICT(jurisdiction_id,identity_namespace,native_number)
        DO UPDATE SET native_number=excluded.native_number RETURNING id`,
          [row.identityNamespace, row.nativeIdentity]
        )
      ).rows[0]
      invariant(document, "fr_source_document_missing")
      await client.query(
        `INSERT INTO legislation.regulatory_source_documents
        (generation_id,record_key,document_id,source_observation_key,publisher_number,publication_date,citation_key,metadata_status,evidence)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          lease.generationId,
          row.recordKey,
          document.id,
          row.sourceObservationKey,
          row.publisherNumber,
          row.publicationDate,
          row.citationKey,
          row.metadataStatus,
          row
        ]
      )
    }
    return { generationId: lease.generationId, ...report, reused: false }
  })
}
