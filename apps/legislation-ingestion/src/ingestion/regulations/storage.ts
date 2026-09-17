import { randomUUID } from "node:crypto"
import { digest } from "@repo/legislation-core/legal-text/contracts"
import {
  parserLimits,
  regulatoryParseSummarySchema,
  regulatoryRecordSchema
} from "@repo/legislation-core/legal-text/parser-contract"
import { requireRights } from "@repo/legislation-core/legal-text/rights"
import {
  leaseSchema,
  officialFederalRights,
  provisionContent,
  provisionIdentity,
  regulatoryStorageContract,
  rightsPolicySchema,
  storageBatchBytes,
  storageBatchRecords,
  type RegulatoryLease,
  type RegulatoryRecord
} from "@repo/legislation-core/legal-text/storage-contract"
import type pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"
import { assessAnnualCfrDates } from "./annual-cfr-dates.js"
import {
  parseRegulatoryImportManifest,
  regulatoryImportReceiptSchema,
  regulatoryImportUnitSchema,
  sameRegulatoryImportUnit
} from "./regulatory-import-contract.js"

const importGenerationSchema = z.object({
  id: z.string(),
  contract: z.string(),
  state: z.enum(["staging", "validated", "materialized", "published", "blocked", "observed"]),
  unit: z.unknown(),
  summary: z.unknown(),
  rights_profile_id: z.string(),
  artifact_hash: z.string(),
  expected_records: z.int().nonnegative()
})
const generationSchema = importGenerationSchema.extend({
  expected_records: z.int().positive(),
  unit: regulatoryImportUnitSchema,
  summary: regulatoryParseSummarySchema
})
type Generation = z.infer<typeof generationSchema>

async function transaction<T>(pool: pg.Pool, action: (client: pg.PoolClient) => Promise<T>) {
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    await client.query("SET LOCAL lock_timeout = '5s'")
    await client.query("SET LOCAL statement_timeout = '60s'")
    const value = await action(client)
    await client.query("COMMIT")
    return value
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

/** Shared fencing and rights enforcement; each source adapter validates its own unit and summary contract. */
export async function withImportLease<T>(
  pool: pg.Pool,
  value: RegulatoryLease,
  action: (client: pg.PoolClient, generation: z.infer<typeof importGenerationSchema>) => Promise<T>
) {
  const lease = leaseSchema.parse(value)
  return transaction(pool, async (client) => {
    const result = await client.query(
      `SELECT * FROM legislation.legal_import_generations
      WHERE id=$1 AND lease_token=$2 AND fence=$3 AND lease_expires_at > clock_timestamp() FOR UPDATE`,
      [lease.generationId, lease.token, lease.fence]
    )
    invariant(result.rows[0], "lease_lost")
    const generation = importGenerationSchema.parse(result.rows[0])
    invariant(
      generation.expected_records > 0 || generation.contract === "fr-html-import-2026-09-14",
      "empty_import_contract_mismatch"
    )
    await requireRights(client, generation.rights_profile_id, "retainRaw")
    const output = await action(client, generation)
    // The token and database clock are checked again after work, before its transaction can commit.
    const renewed = await client.query(
      `UPDATE legislation.legal_import_generations
      SET lease_expires_at=clock_timestamp()+interval '120 seconds'
      WHERE id=$1 AND lease_token=$2 AND fence=$3 AND lease_expires_at > clock_timestamp()`,
      [lease.generationId, lease.token, lease.fence]
    )
    invariant(renewed.rowCount === 1, "lease_lost")
    return output
  })
}

/** XML edition/issue callers retain strict parser-contract validation inside the shared lease transaction. */
export async function withLease<T>(
  pool: pg.Pool,
  value: RegulatoryLease,
  action: (client: pg.PoolClient, generation: Generation) => Promise<T>
) {
  return withImportLease(pool, value, (client, generation) => action(client, generationSchema.parse(generation)))
}

export async function registerRegulatoryImport(
  pool: pg.Pool,
  input: {
    manifest: unknown
    receipt: unknown
    summary: unknown
    artifactLocator: string
  }
) {
  const manifest = parseRegulatoryImportManifest(input.manifest)
  const receipt = regulatoryImportReceiptSchema.parse(input.receipt)
  const summary = regulatoryParseSummarySchema.parse(input.summary)
  const unit = manifest.units.find((item) => item.key === receipt.unit.key)
  invariant(unit && sameRegulatoryImportUnit(unit, receipt.unit), "unit_manifest_mismatch")
  invariant(
    summary.inputHash === receipt.sha256 &&
      summary.inputBytes === receipt.bytes &&
      summary.records === summary.sourceRecords,
    "summary_artifact_mismatch"
  )
  const policy = rightsPolicySchema.parse(officialFederalRights)
  const policyHash = digest(JSON.stringify(policy))
  const profileId = `${unit.rightsProfileId}:${policyHash}`
  const generationId = digest(
    JSON.stringify([
      regulatoryStorageContract,
      unit.key,
      receipt.sha256,
      summary.parserCodeHash,
      summary.contract,
      summary.shards,
      summary.warnings,
      summary.sourceDates,
      profileId
    ])
  )
  await transaction(pool, async (client) => {
    // The jurisdiction must already exist. The importer never invents directory ownership.
    await client.query(
      `INSERT INTO legislation.legal_rights_profiles(id,policy_hash,policy) VALUES($1,$2,$3)
      ON CONFLICT DO NOTHING`,
      [profileId, policyHash, policy]
    )
    const registered = await client.query<{ policy_hash: string }>(
      "SELECT policy_hash FROM legislation.legal_rights_profiles WHERE id=$1",
      [profileId]
    )
    invariant(registered.rows[0]?.policy_hash === policyHash, "rights_profile_collision")
    await requireRights(client, profileId, "retainRaw")
    await client.query(
      `INSERT INTO legislation.legal_sources(id,publisher,authority) VALUES($1,$2,'official') ON CONFLICT DO NOTHING`,
      [unit.sourceId, unit.sourceId === "ecfr" ? "Office of the Federal Register / GPO" : "GPO"]
    )
    await client.query("INSERT INTO legislation.legal_import_manifests(id,body) VALUES($1,$2) ON CONFLICT DO NOTHING", [
      manifest.id,
      manifest
    ])
    await client.query(
      `INSERT INTO legislation.legal_artifacts(hash,bytes,storage_locator,acquired_at) VALUES($1,$2,$3,$4)
      ON CONFLICT DO NOTHING`,
      [receipt.sha256, receipt.bytes, input.artifactLocator, receipt.acquiredAt]
    )
    await client.query(
      `INSERT INTO legislation.legal_import_generations
      (id,manifest_id,unit_key,source_id,jurisdiction_id,rights_profile_id,artifact_hash,parser_hash,contract,unit,summary,expected_records)
      VALUES($1,$2,$3,$4,'jurisdiction:us',$5,$6,$7,$8,$9,$10,$11) ON CONFLICT DO NOTHING`,
      [
        generationId,
        manifest.id,
        unit.key,
        unit.sourceId,
        profileId,
        receipt.sha256,
        summary.parserCodeHash,
        regulatoryStorageContract,
        unit,
        summary,
        summary.records
      ]
    )
  })
  return generationId
}

export async function claimRegulatoryLease(pool: pg.Pool, generationId: string) {
  const token = randomUUID()
  const claimed = await pool.query<{ fence: number }>(
    `UPDATE legislation.legal_import_generations
    SET lease_token=$2, lease_expires_at=clock_timestamp()+interval '120 seconds', fence=fence+1
    WHERE id=$1 AND (lease_expires_at IS NULL OR lease_expires_at <= clock_timestamp()) RETURNING fence`,
    [generationId, token]
  )
  invariant(claimed.rows[0], "generation_busy_or_missing")
  return leaseSchema.parse({ generationId, token, fence: claimed.rows[0].fence })
}

export async function releaseRegulatoryLease(pool: pg.Pool, lease: RegulatoryLease) {
  leaseSchema.parse(lease)
  await pool.query(
    `UPDATE legislation.legal_import_generations SET lease_token=NULL,lease_expires_at=NULL
    WHERE id=$1 AND lease_token=$2 AND fence=$3`,
    [lease.generationId, lease.token, lease.fence]
  )
}

function validateRecord(record: RegulatoryRecord, generation: Generation) {
  const { unit } = generation
  invariant(
    record.recordKey === digest(`${unit.key}\n${record.sourceLocator}`) && record.textHash === digest(record.text),
    "record_hash_mismatch"
  )
  invariant(
    JSON.stringify(record.provenance) ===
      JSON.stringify({
        sourceId: unit.sourceId,
        jurisdictionKey: "us",
        acquisitionUnitId: unit.key,
        artifactHash: generation.artifact_hash,
        sourceUrl: unit.sourceUrl,
        publisherIssueDate: unit.issueDate,
        currencyDate: unit.currencyDate,
        edition: unit.edition,
        rightsProfileId: unit.rightsProfileId
      }),
    "record_provenance_mismatch"
  )
  invariant((record.recordType === "publication") === (unit.sourceId === "govinfo-fr"), "record_kind_mismatch")
  invariant(record.ordinal < generation.expected_records, "record_ordinal_out_of_range")
}

export async function stageRegulatoryRecords(pool: pg.Pool, lease: RegulatoryLease, input: unknown[]) {
  invariant(input.length > 0 && input.length <= storageBatchRecords, "staging_batch_count_limit")
  const records = input.map((item) => regulatoryRecordSchema.parse(item))
  const sizes = records.map((item) => Buffer.byteLength(JSON.stringify(item)))
  invariant(
    sizes.every((size) => size <= parserLimits.maximumRecordBytes) &&
      (records.length === 1 || sizes.reduce((a, b) => a + b, 0) <= storageBatchBytes),
    "staging_batch_byte_limit"
  )
  invariant(new Set(records.map((item) => item.recordKey)).size === records.length, "duplicate_batch_record")
  return withLease(pool, lease, async (client, generation) => {
    invariant(generation.state !== "blocked" && generation.state !== "observed", "generation_blocked")
    records.forEach((record) => validateRecord(record, generation))
    const rows = records.map((payload) => ({
      key: payload.recordKey,
      native: payload.nativeId,
      ordinal: payload.ordinal,
      parent: payload.parentKey,
      kind: payload.nodeKind,
      locator: payload.sourceLocator,
      identity: provisionIdentity(payload),
      bytes: Buffer.byteLength(JSON.stringify(payload)),
      hash: digest(JSON.stringify(payload)),
      payload
    }))
    const stored = await client.query(
      `INSERT INTO legislation.legal_import_records
      (generation_id,record_key,native_id,ordinal,parent_key,node_kind,source_locator,identity_key,payload_bytes,record_hash,payload)
      SELECT $1,x.key,x.native,x.ordinal,x.parent,x.kind,x.locator,x.identity,x.bytes,x.hash,x.payload FROM jsonb_to_recordset($2::jsonb)
        AS x(key text,native text,ordinal integer,parent text,kind text,locator text,identity text,bytes integer,hash text,payload jsonb)
      ON CONFLICT(generation_id,record_key) DO UPDATE SET record_hash=legal_import_records.record_hash
        WHERE legal_import_records.record_hash=excluded.record_hash`,
      [lease.generationId, JSON.stringify(rows)]
    )
    invariant(stored.rowCount === records.length, "staged_record_conflict")
    return stored.rowCount
  })
}

export async function validateStagedRegulatoryImport(pool: pg.Pool, lease: RegulatoryLease) {
  return withLease(pool, lease, async (client, generation) => {
    if (generation.state !== "staging") {
      return generation.state
    }
    const stats = await client.query<{ count: number; roots: number; invalid: number }>(
      `SELECT count(*)::int AS count,
      count(*) FILTER (WHERE r.parent_key IS NULL)::int AS roots,
      count(*) FILTER (WHERE r.parent_key IS NOT NULL AND (p.record_key IS NULL OR p.ordinal >= r.ordinal
        OR NOT starts_with(r.source_locator,p.source_locator||'/')))::int AS invalid
      FROM legislation.legal_import_records r LEFT JOIN legislation.legal_import_records p
        ON p.generation_id=r.generation_id AND p.record_key=r.parent_key WHERE r.generation_id=$1`,
      [lease.generationId]
    )
    const row = stats.rows[0]
    invariant(row?.count === generation.expected_records && row.invalid === 0, "staging_incomplete_or_invalid_parent")
    const kinds = await client.query<{ kind: string; count: number }>(
      `SELECT node_kind AS kind,count(*)::int AS count
      FROM legislation.legal_import_records WHERE generation_id=$1 GROUP BY 1`,
      [lease.generationId]
    )
    invariant(
      kinds.rows.length === Object.keys(generation.summary.countsByKind).length &&
        kinds.rows.every((kind) => generation.summary.countsByKind[kind.kind] === kind.count),
      "staging_kind_count_mismatch"
    )
    if (generation.unit.sourceId !== "govinfo-fr") {
      invariant(row.roots === 1, "invalid_code_roots")
    }
    // Annual volumes need a title-wide completeness contract; FR needs metadata/rendition reconciliation.
    let blockedReason: string | null = null
    if (generation.summary.warnings.some((warning) => warning.code === "quoted_revision_scope_review")) {
      blockedReason = "quoted_revision_scope_review"
    } else if (generation.summary.warnings.length > 0) {
      blockedReason = "source_date_review_required"
    } else if (generation.unit.sourceId === "govinfo-cfr") {
      const date = annualRevision(generation)
      if (date === null) {
        blockedReason = "source_date_review_required"
      }
    } else if (generation.unit.sourceId !== "ecfr") {
      blockedReason = "corpus_publication_contract_pending"
    } else if (generation.unit.issueDate === null) {
      blockedReason = "publisher_issue_date_required"
    }
    const state = blockedReason === null ? "validated" : "blocked"
    await client.query("UPDATE legislation.legal_import_generations SET state=$2,blocked_reason=$3 WHERE id=$1", [
      lease.generationId,
      state,
      blockedReason
    ])
    return state
  })
}

function annualRevision(generation: Generation) {
  const assessment = assessAnnualCfrDates([
    {
      unitKey: generation.unit.key,
      nativeId: generation.unit.nativeId,
      packageYear: Number(generation.unit.edition),
      artifactHash: generation.artifact_hash,
      printedRevisionDates: generation.summary.sourceDates
        .filter((row) => row.kind === "printed_revision" && row.value !== null)
        .map((row) => row.value)
    }
  ]).units[0]
  return assessment?.status === "dates_consistent" ? assessment.sourceRevisionDate : null
}

async function stagedBatch(client: pg.PoolClient, generationId: string, after: number) {
  const candidates = await client.query<{ record_key: string; bytes: number }>(
    `SELECT record_key,payload_bytes AS bytes
    FROM legislation.legal_import_records WHERE generation_id=$1 AND ordinal > $2 ORDER BY ordinal LIMIT $3`,
    [generationId, after, storageBatchRecords]
  )
  const keys: string[] = []
  let bytes = 0
  for (const row of candidates.rows) {
    if (keys.length > 0 && bytes + row.bytes > storageBatchBytes) {
      break
    }
    keys.push(row.record_key)
    bytes += row.bytes
  }
  if (keys.length === 0) {
    return []
  }
  const rows = await client.query<{ payload: unknown }>(
    `SELECT payload FROM legislation.legal_import_records
    WHERE generation_id=$1 AND record_key=ANY($2::text[]) ORDER BY ordinal`,
    [generationId, keys]
  )
  return rows.rows.map((row) => regulatoryRecordSchema.parse(row.payload))
}

export async function materializeRegulatoryEdition(pool: pg.Pool, lease: RegulatoryLease) {
  const edition = await withLease(pool, lease, async (client, generation) => {
    invariant(["validated", "materialized", "published"].includes(generation.state), "generation_not_validated")
    invariant(["ecfr", "govinfo-cfr"].includes(generation.unit.sourceId), "unsupported_canonical_corpus")
    const isAnnual = generation.unit.sourceId === "govinfo-cfr"
    const revision = isAnnual ? annualRevision(generation) : null
    invariant(!isAnnual || revision !== null, "annual_revision_unverified")
    const title = z.coerce
      .number()
      .int()
      .min(1)
      .max(50)
      .parse((isAnnual ? /^CFR-\d{4}-title(\d+)-vol\d+$/ : /^title-(\d+)$/).exec(generation.unit.nativeId)?.[1])
    await client.query(
      `INSERT INTO legislation.legal_codes(jurisdiction_id,code_key,name,kind)
      VALUES('jurisdiction:us',$1,$2,'regulation') ON CONFLICT DO NOTHING`,
      [`cfr-title-${title}`, `Code of Federal Regulations, title ${title}`]
    )
    const code = await client.query<{ id: string }>(
      "SELECT id FROM legislation.legal_codes WHERE jurisdiction_id='jurisdiction:us' AND code_key=$1",
      [`cfr-title-${title}`]
    )
    invariant(code.rows[0], "code_missing")
    const codeId = code.rows[0].id
    await client.query(
      `INSERT INTO legislation.legal_editions
      (code_id,jurisdiction_id,source_id,generation_id,rights_profile_id,native_key,source_revision,issue_date,currency_date)
      VALUES($1,'jurisdiction:us',$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING`,
      [
        codeId,
        generation.unit.sourceId,
        lease.generationId,
        generation.rights_profile_id,
        isAnnual ? generation.unit.nativeId : generation.unit.edition,
        generation.unit.inventoryRevision,
        revision ?? generation.unit.issueDate,
        revision ?? generation.unit.currencyDate
      ]
    )
    const result = await client.query<{ id: string }>(
      "SELECT id FROM legislation.legal_editions WHERE generation_id=$1",
      [lease.generationId]
    )
    invariant(result.rows[0], "edition_missing")
    return { id: result.rows[0].id, codeId, state: generation.state }
  })
  if (edition.state === "materialized" || edition.state === "published") {
    return edition.id
  }
  let after = -1
  while (true) {
    const next = await withLease(pool, lease, async (client, generation) => {
      invariant(generation.state === "validated", "generation_not_validated")
      const records = await stagedBatch(client, lease.generationId, after)
      if (records.length === 0) {
        return null
      }
      const batch = JSON.stringify(
        records.map((record) => ({ identity: provisionIdentity(record), hash: provisionContent(record), record }))
      )
      await client.query(
        `INSERT INTO legislation.legal_provisions(code_id,identity_key,identity_basis)
        SELECT $1,x.identity,x.record->>'identityBasis' FROM jsonb_to_recordset($2::jsonb) AS x(identity text,record jsonb)
        ON CONFLICT DO NOTHING`,
        [edition.codeId, batch]
      )
      await client.query(
        `INSERT INTO legislation.legal_provision_versions
        (provision_id,code_id,content_hash,input_contract,heading,body,node_kind,blocks,language)
        SELECT p.id,p.code_id,x.hash,$3,x.record->>'heading',x.record->>'text',x.record->>'nodeKind',x.record->'blocks','en'
        FROM jsonb_to_recordset($2::jsonb) AS x(identity text,hash text,record jsonb)
        JOIN legislation.legal_provisions p ON p.code_id=$1 AND p.identity_key=x.identity ON CONFLICT DO NOTHING`,
        [edition.codeId, batch, regulatoryStorageContract]
      )
      const members = await client.query(
        `INSERT INTO legislation.legal_edition_provisions
        (edition_id,code_id,provision_id,version_id,parent_id,ordinal,source_locator,source_attributes,native_id)
        SELECT $4,p.code_id,p.id,v.id,parent.id,(x.record->>'ordinal')::int,x.record->>'sourceLocator',
          x.record->'sourceAttributes',x.record->>'nativeId'
        FROM jsonb_to_recordset($2::jsonb) AS x(identity text,hash text,record jsonb)
        JOIN legislation.legal_provisions p ON p.code_id=$1 AND p.identity_key=x.identity
        JOIN legislation.legal_provision_versions v ON v.provision_id=p.id AND v.content_hash=x.hash AND v.input_contract=$3
        LEFT JOIN legislation.legal_import_records pr ON pr.generation_id=$5 AND pr.record_key=x.record->>'parentKey'
        LEFT JOIN legislation.legal_provisions parent ON parent.code_id=$1 AND parent.identity_key=pr.identity_key
        WHERE x.record->>'parentKey' IS NULL OR parent.id IS NOT NULL
        ON CONFLICT(edition_id,provision_id) DO UPDATE SET version_id=legal_edition_provisions.version_id
          WHERE legal_edition_provisions.version_id=excluded.version_id AND legal_edition_provisions.ordinal=excluded.ordinal`,
        [edition.codeId, batch, regulatoryStorageContract, edition.id, lease.generationId]
      )
      invariant(members.rowCount === records.length, "edition_membership_conflict_or_missing_parent")
      return records.at(-1)?.ordinal ?? null
    })
    if (next === null) {
      break
    }
    after = next
  }
  await withLease(pool, lease, async (client, generation) => {
    const count = await client.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM legislation.legal_edition_provisions WHERE edition_id=$1",
      [edition.id]
    )
    invariant(count.rows[0]?.count === generation.expected_records, "edition_incomplete")
    await client.query("UPDATE legislation.legal_import_generations SET state='materialized' WHERE id=$1", [
      lease.generationId
    ])
  })
  return edition.id
}

export async function publishRegulatoryEdition(pool: pg.Pool, lease: RegulatoryLease, expectedHead: string | null) {
  return withLease(pool, lease, async (client, generation) => {
    invariant(generation.unit.sourceId === "ecfr", "annual_requires_complete_title_publication")
    invariant(generation.state === "materialized" || generation.state === "published", "edition_not_materialized")
    await requireRights(client, generation.rights_profile_id, "displayText")
    await requireRights(client, generation.rights_profile_id, "localSearch")
    const result = await client.query<{ id: string; code_id: string; source_id: string; issue_date: string }>(
      "SELECT id,code_id,source_id,issue_date::text FROM legislation.legal_editions WHERE generation_id=$1",
      [lease.generationId]
    )
    const edition = result.rows[0]
    invariant(edition, "edition_missing")
    await client.query("SELECT id FROM legislation.legal_codes WHERE id=$1 FOR UPDATE", [edition.code_id])
    const head = await client.query<{ id: string; issue_date: string }>(
      `SELECT e.id,e.issue_date::text FROM legislation.legal_code_heads h
      JOIN legislation.legal_editions e ON e.id=h.edition_id WHERE h.code_id=$1 AND h.source_id=$2`,
      [edition.code_id, edition.source_id]
    )
    const current = head.rows[0]
    if (generation.state === "published") {
      return { editionId: edition.id, isCurrent: current?.id === edition.id, reused: true }
    }
    invariant((current?.id ?? null) === expectedHead, "head_compare_and_swap_conflict")
    invariant(!current || edition.issue_date !== current.issue_date, "source_revision_precedence_unresolved")
    const count = await client.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM legislation.legal_edition_provisions WHERE edition_id=$1",
      [edition.id]
    )
    invariant(count.rows[0]?.count === generation.expected_records, "edition_incomplete")
    const isCurrent = !current || edition.issue_date > current.issue_date
    await client.query("UPDATE legislation.legal_editions SET published_at=clock_timestamp() WHERE id=$1", [edition.id])
    if (isCurrent) {
      await client.query(
        `INSERT INTO legislation.legal_code_heads(code_id,source_id,edition_id) VALUES($1,$2,$3)
      ON CONFLICT(code_id,source_id) DO UPDATE SET edition_id=excluded.edition_id`,
        [edition.code_id, edition.source_id, edition.id]
      )
    }
    // Embeddings await the held-out model gate. Historical imports do not emit customer change alerts.
    await client.query(
      "INSERT INTO legislation.legal_derived_outbox(edition_id,operation) VALUES($1,'lexical') ON CONFLICT DO NOTHING",
      [edition.id]
    )
    await client.query("UPDATE legislation.legal_import_generations SET state='published' WHERE id=$1", [
      lease.generationId
    ])
    return { editionId: edition.id, isCurrent, reused: false }
  })
}
