import { isDeepStrictEqual } from "node:util"
import { digest, unitIdentity } from "@repo/legislation-core/legal-text/contracts"
import { regulatoryParseSummarySchema } from "@repo/legislation-core/legal-text/parser-contract"
import {
  assertRights,
  provisionContent,
  provisionIdentity,
  regulatoryStorageContract,
  storageBatchBytes,
  storageBatchRecords,
  type RegulatoryRecord
} from "@repo/legislation-core/legal-text/storage-contract"
import type pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"
import { validateRegulatoryArtifactRetention } from "./artifact-backfill.js"
import { validateRegulatoryOutput } from "./parser-bridge.js"
import {
  parseRegulatoryImportManifest,
  regulatoryImportUnitSchema,
  sameRegulatoryImportUnit
} from "./regulatory-import-contract.js"

const candidateSchema = z.object({
  id: z.string(),
  manifest_id: z.string(),
  unit_key: z.string(),
  source_id: z.string(),
  jurisdiction_id: z.string(),
  rights_profile_id: z.string(),
  artifact_hash: z.string(),
  parser_hash: z.string(),
  contract: z.string(),
  unit: regulatoryImportUnitSchema,
  summary: regulatoryParseSummarySchema,
  expected_records: z.int().positive(),
  state: z.string(),
  blocked_reason: z.string().nullable(),
  busy: z.boolean()
})

/** The caller uses a repeatable-read, read-only snapshot; this helper never locks or writes rows. */
async function compareRecords(
  client: pg.PoolClient,
  generationId: string,
  editionId: string,
  codeId: string,
  records: RegulatoryRecord[]
) {
  const expected = records.map((record) => ({
    key: record.recordKey,
    identity: provisionIdentity(record),
    content_hash: provisionContent(record),
    record_hash: digest(JSON.stringify(record)),
    bytes: Buffer.byteLength(JSON.stringify(record)),
    payload: record
  }))
  const result = await client.query<{ key: string; staging_ok: boolean; membership_ok: boolean; content_ok: boolean }>(
    `SELECT x.key,
    (r.payload=x.payload AND r.record_hash=x.record_hash AND r.payload_bytes=x.bytes
      AND r.native_id=x.payload->>'nativeId' AND r.ordinal=(x.payload->>'ordinal')::int
      AND r.parent_key IS NOT DISTINCT FROM x.payload->>'parentKey' AND r.node_kind=x.payload->>'nodeKind'
      AND r.source_locator=x.payload->>'sourceLocator' AND r.identity_key=x.identity) IS TRUE AS staging_ok,
    (m.code_id=$3 AND p.identity_basis=x.payload->>'identityBasis'
      AND m.ordinal=(x.payload->>'ordinal')::int AND m.native_id=x.payload->>'nativeId'
      AND m.source_locator=x.payload->>'sourceLocator' AND m.source_attributes=x.payload->'sourceAttributes'
      AND m.parent_id IS NOT DISTINCT FROM pp.id
      AND ((x.payload->>'parentKey' IS NULL AND m.parent_id IS NULL) OR (x.payload->>'parentKey' IS NOT NULL AND pp.id IS NOT NULL))) IS TRUE AS membership_ok,
    (v.provision_id=p.id AND v.code_id=$3 AND v.content_hash=x.content_hash AND v.input_contract=$5
      AND v.heading=x.payload->>'heading' AND v.body=x.payload->>'text' AND v.node_kind=x.payload->>'nodeKind'
      AND v.blocks=x.payload->'blocks' AND v.language='en') IS TRUE AS content_ok
    FROM jsonb_to_recordset($4::jsonb) AS x(key text,identity text,content_hash text,record_hash text,bytes int,payload jsonb)
    LEFT JOIN legislation.legal_import_records r ON r.generation_id=$1 AND r.record_key=x.key
    LEFT JOIN legislation.legal_provisions p ON p.code_id=$3 AND p.identity_key=x.identity
    LEFT JOIN legislation.legal_edition_provisions m ON m.edition_id=$2 AND m.provision_id=p.id
    LEFT JOIN legislation.legal_provision_versions v ON v.id=m.version_id
    LEFT JOIN legislation.legal_import_records pr ON pr.generation_id=$1 AND pr.record_key=x.payload->>'parentKey'
    LEFT JOIN legislation.legal_provisions pp ON pp.code_id=$3 AND pp.identity_key=pr.identity_key`,
    [generationId, editionId, codeId, JSON.stringify(expected), regulatoryStorageContract]
  )
  invariant(result.rows.length === records.length, "canonical_comparison_row_count_mismatch")
  return result.rows
}

/** Verifies exact eCFR acquisition reuse across parser versions. Other corpora retain their own publication contracts. */
export async function inspectCanonicalRegulatoryReuse(
  pool: pg.Pool,
  input: {
    unit: unknown
    artifactHash: string
    parserCodeHash: string
    directory: string
    artifactValidationPath?: string
  }
) {
  const unit = regulatoryImportUnitSchema.parse(input.unit)
  invariant(unit.sourceId === "ecfr" && unitIdentity(unit) === unit.key, "canonical_reuse_requires_ecfr")
  const artifactHash = z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .parse(input.artifactHash)
  const parserCodeHash = z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .parse(input.parserCodeHash)
  const client = await pool.connect()
  const deadline = Date.now() + 600_000
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY")
    await client.query("SET LOCAL statement_timeout='60s'")
    await client.query("SET LOCAL idle_in_transaction_session_timeout='120s'")
    const candidates = await client.query(
      `SELECT *,coalesce(lease_expires_at>clock_timestamp(),false) AS busy FROM legislation.legal_import_generations
      WHERE unit_key=$1 OR unit->>'key'=$1 ORDER BY id LIMIT 3`,
      [unit.key]
    )
    if (candidates.rows.length === 0) {
      return { status: "missing" as const, unitKey: unit.key, canonicalWrites: false }
    }
    invariant(candidates.rows.length === 1, "canonical_generation_ambiguous")
    const candidate = candidateSchema.parse(candidates.rows[0])
    if (candidate.state !== "published") {
      return { status: "not_published" as const, unitKey: unit.key, generationId: candidate.id, canonicalWrites: false }
    }
    invariant(!candidate.busy, "canonical_generation_busy")
    invariant(
      candidate.blocked_reason === null &&
        candidate.contract === regulatoryStorageContract &&
        candidate.source_id === unit.sourceId &&
        candidate.jurisdiction_id === "jurisdiction:us" &&
        candidate.unit_key === unit.key &&
        candidate.artifact_hash === artifactHash &&
        candidate.parser_hash === candidate.summary.parserCodeHash &&
        sameRegulatoryImportUnit(candidate.unit, unit),
      "canonical_generation_metadata_mismatch"
    )
    const retainedManifest = await client.query<{ body: unknown }>(
      "SELECT body FROM legislation.legal_import_manifests WHERE id=$1",
      [candidate.manifest_id]
    )
    const manifest = parseRegulatoryImportManifest(retainedManifest.rows[0]?.body)
    invariant(
      manifest.id === candidate.manifest_id &&
        isDeepStrictEqual(
          manifest.units.find((item) => item.key === unit.key),
          candidate.unit
        ),
      "canonical_manifest_mismatch"
    )
    const expectedId = digest(
      JSON.stringify([
        regulatoryStorageContract,
        unit.key,
        artifactHash,
        candidate.parser_hash,
        candidate.summary.contract,
        candidate.summary.shards,
        candidate.summary.warnings,
        candidate.summary.sourceDates,
        candidate.rights_profile_id
      ])
    )
    invariant(candidate.id === expectedId, "canonical_generation_identity_mismatch")
    const rights = await client.query<{ policy: unknown; policy_hash: string; is_active: boolean }>(
      "SELECT policy,policy_hash,is_active FROM legislation.legal_rights_profiles WHERE id=$1",
      [candidate.rights_profile_id]
    )
    const right = rights.rows[0]
    invariant(right?.is_active, "rights_profile_unavailable")
    const policy = assertRights(right.policy, "retainRaw")
    assertRights(policy, "displayText")
    assertRights(policy, "localSearch")
    invariant(
      digest(JSON.stringify(policy)) === right.policy_hash &&
        candidate.rights_profile_id === `${unit.rightsProfileId}:${right.policy_hash}`,
      "rights_profile_modified"
    )
    const artifacts = await client.query<{ bytes: string; storage_locator: string }>(
      "SELECT bytes::text,storage_locator FROM legislation.legal_artifacts WHERE hash=$1",
      [artifactHash]
    )
    const artifact = artifacts.rows[0]
    invariant(artifact && Number(artifact.bytes) === candidate.summary.inputBytes, "canonical_artifact_mismatch")
    await validateRegulatoryArtifactRetention(
      input.artifactValidationPath ?? artifact.storage_locator,
      artifactHash,
      Number(artifact.bytes)
    )
    const editions = await client.query<{
      id: string
      code_id: string
      metadata_ok: boolean
      head_id: string | null
      head_ok: boolean
    }>(
      `SELECT e.id,e.code_id,
      (e.jurisdiction_id='jurisdiction:us' AND e.source_id=$2 AND e.rights_profile_id=$3 AND e.native_key=$4
        AND e.source_revision=$5 AND e.issue_date::text IS NOT DISTINCT FROM $6 AND e.currency_date::text IS NOT DISTINCT FROM $7
        AND e.published_at IS NOT NULL AND c.jurisdiction_id='jurisdiction:us' AND c.code_key=$8 AND c.kind='regulation') IS TRUE AS metadata_ok,
      h.edition_id AS head_id,
      (he.published_at IS NOT NULL AND hg.state='published' AND he.issue_date>=e.issue_date) IS TRUE AS head_ok
      FROM legislation.legal_editions e JOIN legislation.legal_codes c ON c.id=e.code_id
      LEFT JOIN legislation.legal_code_heads h ON h.code_id=e.code_id AND h.source_id=e.source_id
      LEFT JOIN legislation.legal_editions he ON he.id=h.edition_id
      LEFT JOIN legislation.legal_import_generations hg ON hg.id=he.generation_id WHERE e.generation_id=$1`,
      [
        candidate.id,
        unit.sourceId,
        candidate.rights_profile_id,
        unit.edition,
        unit.inventoryRevision,
        unit.issueDate,
        unit.currencyDate,
        `cfr-${unit.nativeId}`
      ]
    )
    const edition = editions.rows[0]
    invariant(
      editions.rows.length === 1 && edition?.metadata_ok && edition.head_ok,
      "canonical_edition_metadata_or_head_mismatch"
    )
    const counts = await client.query<{ staged: number; members: number }>(
      `SELECT
      (SELECT count(*)::int FROM legislation.legal_import_records WHERE generation_id=$1) AS staged,
      (SELECT count(*)::int FROM legislation.legal_edition_provisions WHERE edition_id=$2) AS members`,
      [candidate.id, edition.id]
    )
    invariant(
      counts.rows[0]?.staged === candidate.expected_records && counts.rows[0].members === candidate.expected_records,
      "canonical_record_count_mismatch"
    )
    let batch: RegulatoryRecord[] = []
    let bytes = 0
    let checkedRecords = 0
    let mismatchedRecords = 0
    const mismatchSample: Awaited<ReturnType<typeof compareRecords>> = []
    const flush = async () => {
      invariant(Date.now() < deadline, "canonical_audit_deadline_exceeded")
      if (batch.length === 0) {
        return
      }
      const rows = await compareRecords(client, candidate.id, edition.id, edition.code_id, batch)
      checkedRecords += rows.length
      for (const row of rows) {
        if (!row.staging_ok || !row.membership_ok || !row.content_ok) {
          mismatchedRecords++
          if (mismatchSample.length < 20) {
            mismatchSample.push(row)
          }
        }
      }
      batch = []
      bytes = 0
    }
    const summary = await validateRegulatoryOutput(
      input.directory,
      unit,
      artifactHash,
      parserCodeHash,
      async (record) => {
        const size = Buffer.byteLength(JSON.stringify(record))
        if (batch.length > 0 && (batch.length >= storageBatchRecords || bytes + size > storageBatchBytes)) {
          await flush()
        }
        batch.push(record)
        bytes += size
      }
    )
    await flush()
    invariant(
      checkedRecords === summary.records && candidate.expected_records === summary.records,
      "canonical_record_count_mismatch"
    )
    // These attestations must agree even when a parser code change leaves every canonical record unchanged.
    const {
      parserCodeHash: _oldHash,
      elapsedSeconds: _oldTime,
      expatVersion: _oldRuntime,
      ...previous
    } = candidate.summary
    const { parserCodeHash: _newHash, elapsedSeconds: _newTime, expatVersion: _newRuntime, ...current } = summary
    invariant(isDeepStrictEqual(previous, current), "canonical_source_summary_mismatch")
    return {
      status: mismatchedRecords === 0 ? ("verified" as const) : ("invalid" as const),
      unitKey: unit.key,
      generationId: candidate.id,
      editionId: edition.id,
      isCurrent: edition.id === edition.head_id,
      storedParserCodeHash: candidate.parser_hash,
      parserCodeHash,
      checkedRecords,
      mismatchedRecords,
      mismatchSample,
      canonicalWrites: false
    }
  } finally {
    try {
      await client.query("ROLLBACK")
    } finally {
      client.release()
    }
  }
}
