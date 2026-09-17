import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { gunzipSync } from "node:zlib"
import {
  acquisitionUnitSchema,
  digest,
  manifestIdentity,
  regulatoryContract,
  unitIdentity,
  type BackfillManifest
} from "@repo/legislation-core/legal-text/contracts"
import { regulatoryRecordSchema } from "@repo/legislation-core/legal-text/parser-contract"
import {
  searchCopiedLegalPassages,
  searchCurrentLegalProvision
} from "@repo/legislation-core/legal-text/passage-search"
import { rightsPolicySchema } from "@repo/legislation-core/legal-text/storage-contract"
import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import pg from "pg"
import invariant from "tiny-invariant"
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest"
import { z } from "zod"
import { assessAnnualCfrEdition } from "./annual-cfr-edition.js"
import { readAnnualCfrSourceObservation } from "./annual-cfr-observations.js"
import { publishAnnualCfrEdition } from "./annual-cfr-publication.js"
import { inspectCanonicalRegulatoryReuse } from "./canonical-reuse.js"
import { publishFrHtmlImport } from "./fr-html-publication.js"
import { frHtmlImportArtifact, registerFrHtmlImport, stageFrHtmlImport } from "./fr-import-registration.js"
import { frMetadataPageSchema, frMetadataRecordSchema } from "./fr-metadata-contract.js"
import { collectFrMetadata } from "./fr-metadata.js"
import { stageReviewedFrPdfRegions } from "./fr-pdf-regions.js"
import { frPdfValidationContract } from "./fr-pdf-validation.js"
import { normalizeFrHtmlPublication } from "./fr-publication-input.js"
import { registerFrSourceInventory, resolveFrSourceNumber } from "./fr-source-inventory.js"
import { publishReviewedFrSourceIssue } from "./fr-source-publication.js"
import { registerFrSourceReviews } from "./fr-source-review.js"
import { publishFrIssue } from "./fr-storage.js"
import { importNormalizedRegulatoryUnit } from "./import-normalized.js"
import { parseRegulatoryArtifact } from "./parser-bridge.js"
import { runLegalPassageCopyBatch } from "./passage-copy-batch.js"
import {
  acknowledgeLegalPassageCopy,
  finalizeLegalPassageCopy,
  inspectLegalPassageCopy,
  verifyLegalPassageCopyPage
} from "./passage-copy-readiness.js"
import { inspectLegalPassagePipelineCompletion } from "./passage-pipeline-completion.js"
import { runLegalPassagePreparationBatch } from "./passage-preparation.js"
import { replicateLegalPassageGeneration } from "./passage-replication.js"
import { materializeLegalPassages, searchLegalPassages } from "./passage-storage.js"
import { registerLegalPreparationDispatch } from "./preparation-dispatch.js"
import { inspectLegalPreparationStatus } from "./preparation-status.js"
import { inspectLegalPreparationWaveCompletion } from "./preparation-wave-completion.js"
import { registerLegalProvisionSourceReview } from "./provision-source-review.js"
import { reconcileLegalSearchRightsBatch, reconcileLegalSearchScopeRights } from "./search-rights.js"
import {
  claimRegulatoryLease,
  materializeRegulatoryEdition,
  publishRegulatoryEdition,
  registerRegulatoryImport,
  releaseRegulatoryLease,
  stageRegulatoryRecords,
  validateStagedRegulatoryImport,
  withImportLease,
  withLease
} from "./storage.js"
import { selectLegalEmbeddingShard } from "./vector-shards.js"
import {
  completeLegalEmbeddingGeneration,
  registerLegalEmbeddingGeneration,
  storeLegalEmbeddingBatch
} from "./vector-storage.js"

const databaseUrl = process.env.REGULATORY_TEST_DATABASE_URL
if (databaseUrl !== undefined) {
  const url = new URL(databaseUrl)
  if (url.pathname !== "/regulations_test" || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) {
    throw new Error("Regulatory integration checks require a local disposable regulations_test database")
  }
}
const directories: string[] = []
const fixtures = new URL("./fixtures/", import.meta.url)
const provenance = z
  .array(z.object({ fixture: z.string(), sourceUnit: acquisitionUnitSchema }))
  .parse(JSON.parse(await readFile(new URL("provenance.json", fixtures), "utf8")))

async function input(options: { date?: string; body?: string; fixture?: string } = {}) {
  const fixture = options.fixture ?? "ecfr-title-1-excerpt.xml"
  const source = provenance.find((entry) => entry.fixture === fixture)
  invariant(source, "missing_fixture")
  const date = options.date ?? "2026-01-01"
  const fixtureBytes = options.fixture ? await readFile(new URL(fixture, fixtures)) : null
  const xml = fixtureBytes
    ? (fixture.endsWith(".gz") ? gunzipSync(fixtureBytes) : fixtureBytes).toString("utf8")
    : `<ECFR><DIV1 N="1" TYPE="TITLE"><HEAD>Title 1</HEAD>${options.body ?? '<DIV8 N="1.1" TYPE="SECTION"><HEAD>First</HEAD><P>Original text</P></DIV8><DIV8 N="1.2" TYPE="SECTION"><HEAD>Second</HEAD><P>Unchanged</P></DIV8>'}</DIV1></ECFR>`
  const directory = await mkdtemp(join(tmpdir(), "rostra-regulatory-storage-"))
  directories.push(directory)
  const path = join(directory, "source.xml")
  await writeFile(path, xml)
  const inventoryBody = JSON.stringify({ fixture: "synthetic storage test", date, hash: digest(xml) })
  const unit = {
    ...source.sourceUnit,
    inventoryHash: digest(inventoryBody),
    inventoryRevision: digest(`${date}\n${xml}`)
  }
  if (!options.fixture) {
    unit.edition = date
    unit.issueDate = date
    unit.currencyDate = date
    unit.sourceUrl = `https://www.ecfr.gov/api/versioner/v1/full/${date}/title-1.xml`
  }
  unit.key = unitIdentity(unit)
  const manifest: BackfillManifest = {
    contract: regulatoryContract,
    id: "0".repeat(64),
    scope: { cutoff: "2026-09-14", ecfrTitles: [1], federalRegister: null, annualCfr: null },
    inventory: [
      {
        sourceId: unit.sourceId,
        url: unit.sourceUrl,
        sha256: digest(inventoryBody),
        bytes: Buffer.byteLength(inventoryBody),
        retrievedAt: "2026-09-14T00:00:00Z",
        contentType: "application/json",
        body: inventoryBody
      }
    ],
    units: [unit],
    exclusions: [],
    status: "inventoried",
    recurringIngestionEnabled: false,
    acquisitionOnly: true,
    estimatedKnownBytes: unit.expectedBytes ?? 0,
    unknownSizeUnits: unit.expectedBytes === null ? 1 : 0
  }
  manifest.id = manifestIdentity(manifest)
  const parsed = await parseRegulatoryArtifact({
    unit,
    artifactHash: digest(xml),
    path,
    outputRoot: join(directory, "normalized")
  })
  const records = []
  for (const shard of parsed.summary.shards) {
    for (const line of (await readFile(join(parsed.directory, shard.file), "utf8")).trimEnd().split("\n")) {
      records.push(regulatoryRecordSchema.parse(JSON.parse(line)))
    }
  }
  const receipt = {
    unit,
    sha256: digest(xml),
    bytes: Buffer.byteLength(xml),
    acquiredAt: "2026-09-14T00:00:00Z",
    contentType: "application/xml",
    etag: null,
    lastModified: null,
    stage: "acquired",
    parseValidated: false
  }
  return {
    manifest,
    receipt,
    summary: parsed.summary,
    records,
    directory: parsed.directory,
    artifactLocator: path,
    parserCodeHash: parsed.summary.parserCodeHash
  }
}

const suite = databaseUrl === undefined ? describe.skip : describe
suite.sequential("regulatory edition storage on real PostgreSQL", () => {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 4, connectionTimeoutMillis: 10_000 })
  beforeAll(async () => {
    invariant(
      (await pool.query("SELECT current_database() AS name")).rows[0].name === "regulations_test",
      "unexpected_database"
    )
    await migrate(drizzle(pool), {
      migrationsFolder: fileURLToPath(
        new URL("./migrations/", import.meta.resolve("@repo/legislation-core/database/migrate"))
      ),
      migrationsSchema: "legislation_migrations",
      migrationsTable: "migrations"
    })
    await pool.query(`INSERT INTO legislation.jurisdictions(id,name,classification,country_code)
      VALUES('jurisdiction:us','United States','country','US') ON CONFLICT DO NOTHING`)
  }, 60_000)
  beforeEach(async () => {
    await pool.query(`TRUNCATE legislation.legal_preparation_plans,legislation.legal_preparation_dispatches,
      legislation.regulatory_documents,legislation.legal_codes,legislation.legal_import_manifests,
      legislation.legal_sources,legislation.legal_rights_profiles,legislation.legal_artifacts CASCADE`)
  })
  afterEach(async () => {
    for (const directory of directories.splice(0)) {
      await rm(directory, { recursive: true, force: true })
    }
  })
  afterAll(async () => {
    await pool.end()
  })

  async function staged(data: Awaited<ReturnType<typeof input>>) {
    const id = await registerRegulatoryImport(pool, data)
    const lease = await claimRegulatoryLease(pool, id)
    for (let i = 0; i < data.records.length; i += 100) {
      await stageRegulatoryRecords(pool, lease, data.records.slice(i, i + 100))
    }
    return { id, lease }
  }

  it.skipIf(!process.env.REGULATORY_SEARCH_TEST_DATABASE_URL)(
    "copies generations atomically to a separate database and detects corruption and revoked rights",
    async () => {
      const targetUrl = new URL(z.string().parse(process.env.REGULATORY_SEARCH_TEST_DATABASE_URL))
      invariant(
        targetUrl.pathname === "/legislation_passage_search" &&
          ["localhost", "127.0.0.1", "[::1]"].includes(targetUrl.hostname),
        "unexpected_search_test_database"
      )
      const target = new pg.Pool({ connectionString: targetUrl.href, max: 3 })
      try {
        if (!(await target.query("SELECT to_regclass('legislation.legal_search_generations') AS name")).rows[0].name) {
          await target.query(
            await readFile(
              new URL(import.meta.resolve("@repo/legislation-core/infra/passage-search/legal.sql")),
              "utf8"
            )
          )
        }
        await target.query(
          "TRUNCATE legislation.legal_search_generations,legislation.legal_search_scopes,legislation.legal_search_revocations CASCADE"
        )
        const data = await materialized(await input())
        await publishRegulatoryEdition(pool, data.lease, null)
        const members = await pool.query(
          "SELECT version_id FROM legislation.legal_edition_provisions WHERE edition_id=$1 ORDER BY ordinal",
          [data.editionId]
        )
        const scope = {
          kind: "provision" as const,
          editionId: data.editionId,
          versionId: z.uuid().parse(members.rows[1].version_id)
        }
        const prepared = await materializeLegalPassages(pool, {
          scope,
          model: "openai/text-embedding-3-small",
          context: "United States CFR"
        })
        const request = { scope, generationId: prepared.generationId }
        await expect(replicateLegalPassageGeneration(pool, pool, request)).rejects.toThrow(
          "legal_search_requires_separate_database"
        )
        await target.query(
          "ALTER TABLE legislation.legal_search_passages ADD CONSTRAINT injected_copy_failure CHECK (ordinal < 0)"
        )
        try {
          await expect(replicateLegalPassageGeneration(pool, target, request)).rejects.toThrow("injected_copy_failure")
          expect(
            (await target.query("SELECT count(*)::int AS n FROM legislation.legal_search_generations")).rows[0].n
          ).toBe(0)
        } finally {
          await target.query("ALTER TABLE legislation.legal_search_passages DROP CONSTRAINT injected_copy_failure")
        }
        const results = await Promise.all([
          replicateLegalPassageGeneration(pool, target, request),
          replicateLegalPassageGeneration(pool, target, request)
        ])
        expect(results.map((result) => result.reused).sort()).toEqual([false, true])
        expect(results[0].passages).toBe(1)
        const searchRequest = { ...request, query: "Original" }
        expect(await searchCopiedLegalPassages(pool, target, { ...searchRequest, query: "CFR" })).toHaveLength(1)
        expect(await searchCopiedLegalPassages(pool, target, searchRequest)).toMatchObject([
          { body: "First\nOriginal text", ordinal: 0 }
        ])
        expect(await searchCopiedLegalPassages(pool, target, { ...searchRequest, query: "unmatchedword" })).toEqual([])
        await expect(
          searchCopiedLegalPassages(pool, target, {
            ...searchRequest,
            scope: { ...scope, versionId: z.uuid().parse(members.rows[2].version_id) }
          })
        ).rejects.toThrow("legal_search_scope_mismatch")
        const originalPassage = (
          await pool.query("SELECT data FROM legislation.legal_passages WHERE generation_id=$1", [request.generationId])
        ).rows[0].data
        await target.query(
          "UPDATE legislation.legal_search_passages SET data=jsonb_set(data,'{inputHash}',to_jsonb(repeat('0',64))) WHERE generation_id=$1",
          [request.generationId]
        )
        await expect(searchCopiedLegalPassages(pool, target, searchRequest)).rejects.toThrow(
          "legal_search_candidate_mismatch"
        )
        await target.query("UPDATE legislation.legal_search_passages SET data=$2::jsonb WHERE generation_id=$1", [
          request.generationId,
          JSON.stringify(originalPassage)
        ])
        expect(
          (
            await target.query(
              "SELECT body FROM legislation.legal_search_passages WHERE search_vector @@ websearch_to_tsquery('english','Original')"
            )
          ).rows
        ).toEqual([{ body: "First\nOriginal text" }])
        await expect(
          replicateLegalPassageGeneration(pool, target, {
            ...request,
            scope: { ...scope, versionId: z.uuid().parse(members.rows[2].version_id) }
          })
        ).rejects.toThrow("legal_search_scope_mismatch")
        const plan = await runLegalPassagePreparationBatch(pool, {
          scope: { kind: "edition", id: data.editionId },
          model: "openai/text-embedding-3-small",
          limit: 25
        })
        await expect(inspectLegalPassageCopy(pool, target, plan.preparationId)).rejects.toThrow(
          "legal_copy_missing_or_changed_generation"
        )
        const items = await pool.query(
          "SELECT version_id,generation_id FROM legislation.legal_passage_preparation_items WHERE preparation_id=$1 ORDER BY ordinal",
          [plan.preparationId]
        )
        for (const item of items.rows) {
          await replicateLegalPassageGeneration(pool, target, {
            scope: { ...scope, versionId: item.version_id },
            generationId: item.generation_id
          })
        }
        expect(await inspectLegalPassageCopy(pool, target, plan.preparationId)).toMatchObject({
          copiedGenerations: 3,
          copiedPassages: 3,
          copyComplete: true,
          publicSearchReady: false,
          acknowledged: false
        })
        await target.query(
          "UPDATE legislation.legal_search_passages SET data=jsonb_set(data,'{inputHash}',to_jsonb(repeat('0',64))) WHERE generation_id=$1",
          [items.rows[0].generation_id]
        )
        await expect(inspectLegalPassageCopy(pool, target, plan.preparationId)).rejects.toThrow(
          "legal_copy_passage_mismatch"
        )
        await target.query("DELETE FROM legislation.legal_search_passages WHERE generation_id=$1", [
          items.rows[0].generation_id
        ])
        await target.query("DELETE FROM legislation.legal_search_memberships WHERE generation_id=$1", [
          items.rows[0].generation_id
        ])
        await target.query("DELETE FROM legislation.legal_search_generations WHERE id=$1", [
          items.rows[0].generation_id
        ])
        await replicateLegalPassageGeneration(pool, target, {
          scope: { ...scope, versionId: items.rows[0].version_id },
          generationId: items.rows[0].generation_id
        })
        await pool.query(
          "UPDATE legislation.legal_passage_preparation_items SET context=context || ' changed' WHERE preparation_id=$1 AND ordinal=0",
          [plan.preparationId]
        )
        await expect(inspectLegalPassageCopy(pool, target, plan.preparationId)).rejects.toThrow(
          "legal_copy_inventory_mismatch"
        )
        await pool.query("UPDATE legislation.legal_rights_profiles SET is_active=false")
        const closedTarget = new pg.Pool({ connectionString: targetUrl.href })
        await closedTarget.end()
        // Revocation must fail before accessing even an unavailable target, not merely filter results afterward.
        await expect(searchCopiedLegalPassages(pool, closedTarget, searchRequest)).rejects.toThrow(
          "rights_profile_unavailable"
        )
        await expect(searchCopiedLegalPassages(pool, target, searchRequest)).rejects.toThrow(
          "rights_profile_unavailable"
        )
        await expect(inspectLegalPassageCopy(pool, target, plan.preparationId)).rejects.toThrow(
          "rights_profile_unavailable"
        )
        await expect(replicateLegalPassageGeneration(pool, target, request)).rejects.toThrow(
          "rights_profile_unavailable"
        )
        await pool.query("UPDATE legislation.legal_rights_profiles SET is_active=true")
        await target.query("DELETE FROM legislation.legal_search_passages")
        await expect(searchCopiedLegalPassages(pool, target, searchRequest)).rejects.toThrow(
          "legal_search_incomplete_generation"
        )
        await expect(replicateLegalPassageGeneration(pool, target, request)).rejects.toThrow(
          "legal_search_copy_mismatch"
        )
        await pool.query(
          "UPDATE legislation.legal_passages SET data=jsonb_set(data,'{inputHash}',to_jsonb(repeat('0',64))) WHERE generation_id=$1",
          [request.generationId]
        )
        await expect(replicateLegalPassageGeneration(pool, target, request)).rejects.toThrow(
          "legal_search_passage_mismatch"
        )
        expect((await pool.query("SELECT state FROM legislation.legal_derived_outbox")).rows).toEqual([
          { state: "pending" }
        ])
      } finally {
        await target.end()
      }
    }
  )
  it.skipIf(!process.env.REGULATORY_SEARCH_TEST_DATABASE_URL)(
    "resumes bounded preparation copies without acknowledging partial or skipped inventories",
    async () => {
      const url = new URL(z.string().parse(process.env.REGULATORY_SEARCH_TEST_DATABASE_URL))
      invariant(
        url.pathname === "/legislation_passage_search" && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname),
        "unexpected_search_test_database"
      )
      const target = new pg.Pool({ connectionString: url.href, max: 2 })
      try {
        if (!(await target.query("SELECT to_regclass('legislation.legal_search_generations') AS name")).rows[0].name) {
          await target.query(
            await readFile(
              new URL(import.meta.resolve("@repo/legislation-core/infra/passage-search/legal.sql")),
              "utf8"
            )
          )
        }
        await target.query(
          "TRUNCATE legislation.legal_search_generations,legislation.legal_search_scopes,legislation.legal_search_revocations CASCADE"
        )
        const first = await materialized(await input())
        await publishRegulatoryEdition(pool, first.lease, null)
        const prepared = await runLegalPassagePreparationBatch(pool, {
          scope: { kind: "edition", id: first.editionId },
          model: "openai/text-embedding-3-small",
          limit: 25
        })
        const waveId = "00000000-0000-4000-8000-000000000004"
        const parameters = {
          source: "ecfr",
          model: "openai/text-embedding-3-small",
          publishedBefore: "2026-09-15T00:00:00.000Z",
          limit: 25,
          retryBlocked: false,
          pendingOnly: true
        }
        await pool.query(
          `INSERT INTO legislation.legal_preparation_plans
           (wave_id,request_hash,parameters,after_id,exhausted,selected_count)
           VALUES($1,$2,$3::jsonb,$4,true,1)`,
          [waveId, digest(JSON.stringify(parameters)), JSON.stringify(parameters), first.editionId]
        )
        const completionDispatch = await registerLegalPreparationDispatch(pool, {
          waveId,
          scope: { kind: "edition", id: first.editionId },
          model: "openai/text-embedding-3-small",
          limit: 25
        })
        await pool.query(
          `UPDATE legislation.legal_preparation_dispatches
           SET state='submitted',first_attempt_at=clock_timestamp(),run_id='run-prepared',
             completed_at=clock_timestamp(),last_observed_status='COMPLETED'
           WHERE id=$1`,
          [completionDispatch.id]
        )
        await expect(inspectLegalPreparationWaveCompletion(pool, { waveId })).resolves.toMatchObject({
          accounted: true,
          ready: false,
          dispatch: { completed: 1 },
          preparation: { prepared: 1 },
          lexical: { pending: 1, acknowledged: 0 }
        })
        await expect(
          inspectLegalPassagePipelineCompletion(pool, target, { preparationId: prepared.preparationId })
        ).resolves.toMatchObject({
          preparation: { state: "prepared", expected: prepared.total, prepared: prepared.total, blocked: 0 },
          lexical: { state: "pending" },
          copy: { memberships: 0, validationItems: 0, receiptMatches: false, revisionBound: false },
          accounted: true,
          ready: false
        })
        const request = { preparationId: prepared.preparationId, limit: 1 }
        const firstBatch = await runLegalPassageCopyBatch(pool, target, request)
        expect(firstBatch).toMatchObject({ copied: 1, exhausted: false, publicSearchReady: false })
        expect(await runLegalPassageCopyBatch(pool, target, request)).toEqual(firstBatch)
        expect(
          (await target.query("SELECT count(*)::int AS count FROM legislation.legal_search_memberships")).rows[0].count
        ).toBe(1)
        await expect(runLegalPassageCopyBatch(pool, target, { ...request, afterOrdinal: 999999 })).rejects.toThrow(
          "legal_copy_cursor_not_in_inventory"
        )
        // Skipping directly to the final valid ordinal may exhaust traversal, but cannot pass whole-copy validation.
        const last = z
          .int()
          .parse(
            (
              await pool.query(
                "SELECT max(ordinal) AS ordinal FROM legislation.legal_passage_preparation_items WHERE preparation_id=$1",
                [prepared.preparationId]
              )
            ).rows[0].ordinal
          )
        expect(await runLegalPassageCopyBatch(pool, target, { ...request, afterOrdinal: last })).toMatchObject({
          copied: 0,
          exhausted: true,
          publicSearchReady: false
        })
        await expect(acknowledgeLegalPassageCopy(pool, target, prepared.preparationId)).rejects.toThrow(/legal_copy_/)
        expect((await pool.query("SELECT state FROM legislation.legal_derived_outbox")).rows[0].state).toBe("pending")
        // A target failure must leave the caller's checkpoint unchanged; replay from that checkpoint completes safely.
        const unavailable = new pg.Pool({ connectionString: url.href })
        await unavailable.end()
        await expect(
          runLegalPassageCopyBatch(pool, unavailable, { ...request, afterOrdinal: firstBatch.afterOrdinal })
        ).rejects.toThrow(/pool/i)
        let result = firstBatch
        while (!result.exhausted) {
          result = await runLegalPassageCopyBatch(pool, target, { ...request, afterOrdinal: result.afterOrdinal })
        }
        expect(
          (await target.query("SELECT count(*)::int AS count FROM legislation.legal_search_memberships")).rows[0].count
        ).toBe(prepared.total)
        expect(
          (await target.query("SELECT count(*)::int AS count FROM legislation.legal_search_scopes")).rows[0].count
        ).toBe(0)
        expect(await acknowledgeLegalPassageCopy(pool, target, prepared.preparationId)).toMatchObject({
          acknowledged: true
        })
        await expect(
          inspectLegalPassagePipelineCompletion(pool, target, { preparationId: prepared.preparationId })
        ).resolves.toMatchObject({
          preparation: { state: "prepared", expected: prepared.total, prepared: prepared.total, blocked: 0 },
          lexical: { state: "acknowledged", delayed: false },
          copy: {
            memberships: prepared.total,
            validationItems: prepared.total,
            receiptRevisions: prepared.total,
            receiptGenerations: prepared.total,
            receiptMatches: true,
            revisionBound: true
          },
          accounted: true,
          ready: true
        })
        await expect(inspectLegalPreparationWaveCompletion(pool, { waveId })).resolves.toMatchObject({
          accounted: true,
          ready: true,
          dispatch: { completed: 1 },
          preparation: { prepared: 1, blocked: 0, delayed: 0 },
          lexical: { pending: 0, acknowledged: 1 },
          rightsInactive: 0
        })
        await pool.query("UPDATE legislation.legal_rights_profiles SET is_active=false")
        await expect(inspectLegalPreparationWaveCompletion(pool, { waveId })).rejects.toThrow(
          "rights_profile_unavailable"
        )
      } finally {
        await target.end()
      }
    }
  )
  it.skipIf(!process.env.REGULATORY_SEARCH_TEST_DATABASE_URL)(
    "acknowledges complete copies, follows only the current head, and reconciles revoked shared copies",
    async () => {
      const url = new URL(z.string().parse(process.env.REGULATORY_SEARCH_TEST_DATABASE_URL))
      invariant(
        url.pathname === "/legislation_passage_search" && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname),
        "unexpected_search_test_database"
      )
      const target = new pg.Pool({ connectionString: url.href, max: 3 })
      try {
        if (!(await target.query("SELECT to_regclass('legislation.legal_search_generations') AS name")).rows[0].name) {
          await target.query(
            await readFile(
              new URL(import.meta.resolve("@repo/legislation-core/infra/passage-search/legal.sql")),
              "utf8"
            )
          )
        }
        await target.query(
          "TRUNCATE legislation.legal_search_generations,legislation.legal_search_scopes,legislation.legal_search_revocations CASCADE"
        )
        const first = await materialized(await input())
        await publishRegulatoryEdition(pool, first.lease, null)
        const head = (
          await pool.query(`SELECT h.code_id,h.source_id,m.native_id,m.version_id FROM legislation.legal_code_heads h
        JOIN legislation.legal_edition_provisions m ON m.edition_id=h.edition_id WHERE m.ordinal=1`)
        ).rows[0]
        const query = { codeId: head.code_id, sourceId: head.source_id, nativeId: head.native_id, query: "Original" }
        await expect(searchCurrentLegalProvision(pool, target, query)).rejects.toThrow(
          "legal_search_current_copy_unavailable"
        )
        const prepareAndCopy = async (editionId: string) => {
          const plan = await runLegalPassagePreparationBatch(pool, {
            scope: { kind: "edition", id: editionId },
            model: "openai/text-embedding-3-small",
            limit: 25
          })
          const items = await pool.query(
            "SELECT version_id,generation_id FROM legislation.legal_passage_preparation_items WHERE preparation_id=$1 ORDER BY ordinal",
            [plan.preparationId]
          )
          for (const item of items.rows) {
            await replicateLegalPassageGeneration(pool, target, {
              scope: { kind: "provision", editionId, versionId: item.version_id },
              generationId: item.generation_id
            })
          }
          return { ...plan, items: items.rows }
        }
        const plan = await prepareAndCopy(first.editionId)
        await target.query("TRUNCATE legislation.legal_copy_validation_items")
        const firstPage = await verifyLegalPassageCopyPage(pool, target, {
          preparationId: plan.preparationId,
          limit: 1
        })
        expect(firstPage).toMatchObject({
          checkpointsWritten: 1,
          copyComplete: false,
          acknowledged: false,
          exhausted: false
        })
        const repeatedPage = await verifyLegalPassageCopyPage(pool, target, {
          preparationId: plan.preparationId,
          limit: 1
        })
        expect(repeatedPage).toMatchObject({ checkpointsWritten: 1, afterOrdinal: firstPage.afterOrdinal })
        await expect(finalizeLegalPassageCopy(pool, target, plan.preparationId)).rejects.toThrow(
          "legal_copy_checkpoints_incomplete"
        )
        const lastPage = await verifyLegalPassageCopyPage(pool, target, {
          preparationId: plan.preparationId,
          afterOrdinal: firstPage.afterOrdinal,
          limit: 2
        })
        expect(lastPage).toMatchObject({
          checkpointsWritten: 2,
          exhausted: true,
          copyComplete: false,
          acknowledged: false
        })
        expect(
          (
            await target.query(
              "SELECT count(*)::integer AS count FROM legislation.legal_copy_validation_items WHERE preparation_id=$1",
              [plan.preparationId]
            )
          ).rows[0]?.count
        ).toBe(3)
        expect(
          (await target.query("SELECT count(*)::integer AS count FROM legislation.legal_search_scopes")).rows[0]?.count
        ).toBe(0)
        expect((await pool.query("SELECT state FROM legislation.legal_derived_outbox")).rows).toEqual([
          { state: "pending" }
        ])
        const changedVersion = z.string().parse(plan.items[0]?.version_id)
        const unboundGeneration = z.string().parse(plan.items[0]?.generation_id)
        await pool.query("DELETE FROM legislation.legal_passage_source_provenance WHERE generation_id=$1", [
          unboundGeneration
        ])
        await expect(
          verifyLegalPassageCopyPage(pool, target, { preparationId: plan.preparationId, limit: 1 })
        ).rejects.toThrow("legal_copy_source_provenance_changed")
        const generationContext = z
          .string()
          .parse(
            (
              await pool.query("SELECT context FROM legislation.legal_passage_generations WHERE id=$1", [
                unboundGeneration
              ])
            ).rows[0]?.context
          )
        expect(
          await materializeLegalPassages(pool, {
            scope: { kind: "provision", editionId: first.editionId, versionId: changedVersion },
            model: "openai/text-embedding-3-small",
            context: generationContext
          })
        ).toMatchObject({ generationId: unboundGeneration, reused: true })
        const sourceBlocks = (
          await pool.query("SELECT blocks FROM legislation.legal_provision_versions WHERE id=$1", [changedVersion])
        ).rows[0]?.blocks
        try {
          await pool.query(
            'UPDATE legislation.legal_provision_versions SET blocks=blocks || \'[{"ordinal":999,"kind":"paragraph","text":"changed markup","xml":"<P>changed markup</P>"}]\'::jsonb WHERE id=$1',
            [changedVersion]
          )
          await expect(
            verifyLegalPassageCopyPage(pool, target, { preparationId: plan.preparationId, limit: 1 })
          ).rejects.toThrow("legal_copy_source_provenance_changed")
        } finally {
          await pool.query("UPDATE legislation.legal_provision_versions SET blocks=$2::jsonb WHERE id=$1", [
            changedVersion,
            JSON.stringify(sourceBlocks)
          ])
        }
        const originalBody = z
          .string()
          .parse(
            (await pool.query("SELECT body FROM legislation.legal_provision_versions WHERE id=$1", [changedVersion]))
              .rows[0]?.body
          )
        try {
          await pool.query("UPDATE legislation.legal_provision_versions SET body=body || ' changed' WHERE id=$1", [
            changedVersion
          ])
          await expect(
            verifyLegalPassageCopyPage(pool, target, { preparationId: plan.preparationId, limit: 1 })
          ).rejects.toThrow("legal_copy_source_body_changed")
        } finally {
          await pool.query("UPDATE legislation.legal_provision_versions SET body=$2 WHERE id=$1", [
            changedVersion,
            originalBody
          ])
        }
        await expect(
          verifyLegalPassageCopyPage(pool, target, { preparationId: plan.preparationId, afterOrdinal: 999999 })
        ).rejects.toThrow("legal_copy_cursor_not_in_inventory")
        const revisionGeneration = z.string().parse(plan.items[0]?.generation_id)
        for (const revisionPool of [pool, target]) {
          const revisionClient = await revisionPool.connect()
          try {
            const readRevision = async () =>
              BigInt(
                z
                  .string()
                  .parse(
                    (
                      await revisionClient.query(
                        "SELECT revision::text FROM legislation.legal_copy_revisions WHERE generation_id=$1",
                        [revisionGeneration]
                      )
                    ).rows[0]?.revision
                  )
              )
            const before = await readRevision()
            await revisionClient.query("BEGIN")
            if (revisionPool === pool) {
              await revisionClient.query(
                "UPDATE legislation.legal_passage_generations SET context=context WHERE id=$1",
                [revisionGeneration]
              )
            } else {
              await revisionClient.query(
                "UPDATE legislation.legal_search_generations SET metadata=metadata WHERE id=$1",
                [revisionGeneration]
              )
            }
            expect(await readRevision()).toBe(before + 1n)
            await revisionClient.query("ROLLBACK")
            expect(await readRevision()).toBe(before)
          } finally {
            await revisionClient.query("ROLLBACK")
            revisionClient.release()
          }
        }
        await expect(finalizeLegalPassageCopy(pool, target, plan.preparationId)).rejects.toThrow(
          "legal_copy_checkpoint_stale"
        )
        await verifyLegalPassageCopyPage(pool, target, { preparationId: plan.preparationId })
        await target.query("UPDATE legislation.legal_search_generations SET metadata=metadata WHERE id=$1", [
          unboundGeneration
        ])
        await expect(finalizeLegalPassageCopy(pool, target, plan.preparationId)).rejects.toThrow(
          "legal_copy_checkpoint_stale"
        )
        await verifyLegalPassageCopyPage(pool, target, { preparationId: plan.preparationId })
        await target.query(
          "ALTER TABLE legislation.legal_search_scopes ADD CONSTRAINT injected_receipt_failure CHECK(generation_count < 0)"
        )
        try {
          await expect(finalizeLegalPassageCopy(pool, target, plan.preparationId)).rejects.toThrow(
            "injected_receipt_failure"
          )
          expect((await pool.query("SELECT state FROM legislation.legal_derived_outbox")).rows).toEqual([
            { state: "pending" }
          ])
        } finally {
          await target.query("ALTER TABLE legislation.legal_search_scopes DROP CONSTRAINT injected_receipt_failure")
        }
        await pool.query(`CREATE FUNCTION legislation.reject_search_ack_commit() RETURNS trigger LANGUAGE plpgsql AS $$
          BEGIN RAISE EXCEPTION 'ack_commit_failure'; END $$;
          CREATE CONSTRAINT TRIGGER reject_search_ack_commit AFTER UPDATE ON legislation.legal_derived_outbox
          DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION legislation.reject_search_ack_commit()`)
        try {
          await expect(finalizeLegalPassageCopy(pool, target, plan.preparationId)).rejects.toThrow("ack_commit_failure")
          expect(
            (await target.query("SELECT count(*)::integer AS n FROM legislation.legal_search_scopes")).rows[0].n
          ).toBe(1)
          expect((await pool.query("SELECT state FROM legislation.legal_derived_outbox")).rows).toEqual([
            { state: "pending" }
          ])
          await expect(searchCurrentLegalProvision(pool, target, query)).rejects.toThrow(
            "legal_search_scope_not_acknowledged"
          )
        } finally {
          await pool.query(
            "DROP TRIGGER reject_search_ack_commit ON legislation.legal_derived_outbox; DROP FUNCTION legislation.reject_search_ack_commit()"
          )
        }
        expect(await finalizeLegalPassageCopy(pool, target, plan.preparationId)).toMatchObject({
          acknowledged: true,
          copiedGenerations: 3,
          publicSearchReady: false
        })
        expect(await finalizeLegalPassageCopy(pool, target, plan.preparationId)).toMatchObject({
          acknowledged: true
        })
        expect(await searchCurrentLegalProvision(pool, target, query)).toHaveLength(1)
        const changedGeneration = z.string().parse(plan.items[1]?.generation_id)
        const passageBefore = (
          await target.query(
            "SELECT id,input_text,data FROM legislation.legal_search_passages WHERE generation_id=$1 ORDER BY ordinal LIMIT 1",
            [changedGeneration]
          )
        ).rows[0]
        await target.query(
          "UPDATE legislation.legal_search_passages SET input_text='unrelatedwords',data=jsonb_set(data,'{inputText}',to_jsonb('unrelatedwords'::text)) WHERE id=$1",
          [passageBefore.id]
        )
        await expect(
          searchCurrentLegalProvision(pool, target, { ...query, query: "nonexistentwords" })
        ).rejects.toThrow("legal_search_scope_revision_changed")
        await target.query("UPDATE legislation.legal_search_passages SET input_text=$2,data=$3::jsonb WHERE id=$1", [
          passageBefore.id,
          passageBefore.input_text,
          JSON.stringify(passageBefore.data)
        ])
        // A repaired and reverified page does not silently replace the acknowledged revision snapshot.
        await verifyLegalPassageCopyPage(pool, target, { preparationId: plan.preparationId })
        await expect(searchCurrentLegalProvision(pool, target, query)).rejects.toThrow(
          "legal_search_scope_revision_changed"
        )
        await finalizeLegalPassageCopy(pool, target, plan.preparationId)
        expect(await searchCurrentLegalProvision(pool, target, query)).toHaveLength(1)
        await pool.query("UPDATE legislation.legal_provision_versions SET heading=heading WHERE id=$1", [
          plan.items[1]?.version_id
        ])
        await expect(
          searchCurrentLegalProvision(pool, target, { ...query, query: "nonexistentwords" })
        ).rejects.toThrow("legal_search_scope_revision_changed")
        await acknowledgeLegalPassageCopy(pool, target, plan.preparationId)
        expect(await searchCurrentLegalProvision(pool, target, query)).toHaveLength(1)
        const canaryInput = {
          scope: { kind: "provision" as const, editionId: first.editionId, versionId: head.version_id },
          generationId: plan.items[1].generation_id,
          preparationId: plan.preparationId,
          query: "Original"
        }
        const searchEdition = () => searchCopiedLegalPassages(pool, target, { ...canaryInput, apiAccess: true })
        expect(await searchEdition()).toHaveLength(1)
        const codeBefore = (await pool.query("SELECT name FROM legislation.legal_codes WHERE id=$1", [query.codeId]))
          .rows[0]
        await pool.query("UPDATE legislation.legal_codes SET name=name||' changed context' WHERE id=$1", [query.codeId])
        try {
          await expect(searchEdition()).rejects.toThrow("legal_search_scope_revision_changed")
          await expect(searchCopiedLegalPassages(pool, target, canaryInput)).rejects.toThrow(
            "legal_search_scope_revision_changed"
          )
        } finally {
          await pool.query("UPDATE legislation.legal_codes SET name=$2 WHERE id=$1", [query.codeId, codeBefore.name])
        }
        const extra = (
          await pool.query(
            `WITH new_provision AS (
          INSERT INTO legislation.legal_provisions(code_id,identity_key,identity_basis) VALUES($1,'membership-extra-test','test') RETURNING id
        ), new_version AS (
          INSERT INTO legislation.legal_provision_versions(provision_id,code_id,content_hash,input_contract,heading,body,node_kind,blocks,language)
          SELECT p.id,v.code_id,v.content_hash,v.input_contract,v.heading,v.body,v.node_kind,v.blocks,v.language
          FROM new_provision p CROSS JOIN legislation.legal_provision_versions v WHERE v.id=$2 RETURNING id,provision_id,code_id
        ) INSERT INTO legislation.legal_edition_provisions(edition_id,code_id,provision_id,version_id,parent_id,ordinal,source_locator,source_attributes,native_id)
          SELECT $3,code_id,provision_id,id,NULL,999999,'test-extra','{}','test-extra' FROM new_version RETURNING provision_id,version_id`,
            [query.codeId, head.version_id, first.editionId]
          )
        ).rows[0]
        try {
          // The extra source member has no passage generation, so generation counters alone cannot detect it.
          await expect(searchEdition()).rejects.toThrow("legal_search_scope_revision_changed")
          await expect(searchCopiedLegalPassages(pool, target, canaryInput)).rejects.toThrow(
            "legal_search_scope_revision_changed"
          )
        } finally {
          await pool.query("DELETE FROM legislation.legal_edition_provisions WHERE edition_id=$1 AND provision_id=$2", [
            first.editionId,
            extra.provision_id
          ])
          await pool.query("DELETE FROM legislation.legal_provision_versions WHERE id=$1", [extra.version_id])
          await pool.query("DELETE FROM legislation.legal_provisions WHERE id=$1", [extra.provision_id])
        }
        expect(await searchEdition()).toHaveLength(1)
        await target.query("UPDATE legislation.legal_search_generations SET metadata=metadata WHERE id=$1", [
          changedGeneration
        ])
        await expect(searchEdition()).rejects.toThrow("legal_search_scope_revision_changed")
        await verifyLegalPassageCopyPage(pool, target, { preparationId: plan.preparationId })
        await expect(searchEdition()).rejects.toThrow("legal_search_scope_revision_changed")
        await finalizeLegalPassageCopy(pool, target, plan.preparationId)
        expect(await searchEdition()).toHaveLength(1)
        const profile = (await pool.query("SELECT id,policy FROM legislation.legal_rights_profiles LIMIT 1")).rows[0]
        const policy = rightsPolicySchema.parse(profile.policy)
        const closedTarget = new pg.Pool({ connectionString: url.href })
        await closedTarget.end()
        for (const restricted of [
          { ...policy, apiMcp: false },
          { ...policy, territories: ["US"] }
        ]) {
          await pool.query("UPDATE legislation.legal_rights_profiles SET policy=$2::jsonb,policy_hash=$3 WHERE id=$1", [
            profile.id,
            JSON.stringify(restricted),
            digest(JSON.stringify(restricted))
          ])
          await expect(
            searchCopiedLegalPassages(pool, closedTarget, { ...canaryInput, apiAccess: true })
          ).rejects.toThrow("rights_denied:")
          expect(await searchCopiedLegalPassages(pool, target, canaryInput)).toHaveLength(1)
        }
        await pool.query("UPDATE legislation.legal_rights_profiles SET policy=$2::jsonb,policy_hash=$3 WHERE id=$1", [
          profile.id,
          JSON.stringify(policy),
          digest(JSON.stringify(policy))
        ])
        const second = await materialized(await input({ date: "2026-02-01" }))
        await publishRegulatoryEdition(pool, second.lease, first.editionId)
        await expect(searchCurrentLegalProvision(pool, target, query)).rejects.toThrow(
          "legal_search_current_copy_unavailable"
        )
        await expect(
          searchCopiedLegalPassages(pool, target, {
            scope: { kind: "provision", editionId: first.editionId, versionId: head.version_id },
            generationId: plan.items[1].generation_id,
            query: "Original",
            requireCurrent: true
          })
        ).rejects.toThrow("legal_search_head_changed")
        const newer = await prepareAndCopy(second.editionId)
        await acknowledgeLegalPassageCopy(pool, target, newer.preparationId)
        await acknowledgeLegalPassageCopy(pool, target, plan.preparationId)
        expect(await searchCurrentLegalProvision(pool, target, query)).toHaveLength(1)
        expect((await pool.query("SELECT edition_id FROM legislation.legal_code_heads")).rows[0].edition_id).toBe(
          second.editionId
        )
        expect(
          (await target.query("SELECT count(*)::integer AS n FROM legislation.legal_search_generations")).rows[0].n
        ).toBe(3)
        await pool.query("UPDATE legislation.legal_rights_profiles SET is_active=false")
        await expect(searchCurrentLegalProvision(pool, target, query)).rejects.toThrow("rights_profile_unavailable")
        await pool.query(`CREATE FUNCTION legislation.reject_cleanup_commit() RETURNS trigger LANGUAGE plpgsql AS $$
          BEGIN RAISE EXCEPTION 'cleanup_commit_failure'; END $$;
          CREATE CONSTRAINT TRIGGER reject_cleanup_commit AFTER UPDATE ON legislation.legal_derived_outbox
          DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION legislation.reject_cleanup_commit()`)
        try {
          await expect(
            reconcileLegalSearchScopeRights(pool, target, { kind: "edition", id: first.editionId })
          ).rejects.toThrow("cleanup_commit_failure")
          expect(
            (await target.query("SELECT count(*)::integer AS n FROM legislation.legal_search_revocations")).rows[0].n
          ).toBe(1)
          expect(
            (
              await target.query(
                "SELECT count(*)::integer AS n FROM legislation.legal_search_memberships WHERE scope_id=$1",
                [first.editionId]
              )
            ).rows[0].n
          ).toBe(0)
        } finally {
          await pool.query(
            "DROP TRIGGER reject_cleanup_commit ON legislation.legal_derived_outbox; DROP FUNCTION legislation.reject_cleanup_commit()"
          )
        }
        expect(
          (await target.query("SELECT count(*)::integer AS n FROM legislation.legal_search_generations")).rows[0].n
        ).toBe(3)
        const sweep = await reconcileLegalSearchRightsBatch(pool, target)
        expect(sweep.complete).toBe(true)
        expect(sweep.results.reduce((sum, row) => sum + row.removedGenerations, 0)).toBe(3)
        expect((await pool.query("SELECT state FROM legislation.legal_derived_outbox")).rows).toEqual([
          { state: "pending" },
          { state: "pending" }
        ])
        await pool.query("UPDATE legislation.legal_rights_profiles SET is_active=true")
        await expect(searchCurrentLegalProvision(pool, target, query)).rejects.toThrow(
          "legal_search_current_copy_unavailable"
        )
        await prepareAndCopy(second.editionId)
        await acknowledgeLegalPassageCopy(pool, target, newer.preparationId)
        expect(await searchCurrentLegalProvision(pool, target, query)).toHaveLength(1)
        expect(
          await reconcileLegalSearchScopeRights(pool, target, { kind: "edition", id: second.editionId })
        ).toMatchObject({ allowed: true, removedMemberships: 0 })
        // Synthetic extra derived rows exercise the cleanup boundary without modifying any canonical document or vector.
        for (let index = 0; index < 30; index++) {
          const id = digest(`cleanup-fixture-${index}`)
          await target.query("INSERT INTO legislation.legal_search_generations(id,metadata) VALUES($1,'{}')", [id])
          await target.query(
            "INSERT INTO legislation.legal_search_memberships(scope_kind,scope_id,generation_id) VALUES('edition',$1,$2)",
            [second.editionId, id]
          )
        }
        await expect(inspectLegalPassageCopy(pool, target, newer.preparationId)).rejects.toThrow(
          "legal_copy_membership_count_mismatch"
        )
        await expect(acknowledgeLegalPassageCopy(pool, target, newer.preparationId)).rejects.toThrow(
          "legal_copy_membership_count_mismatch"
        )
        await pool.query("UPDATE legislation.legal_rights_profiles SET is_active=false")
        const partial = await reconcileLegalSearchRightsBatch(pool, target)
        expect(partial.complete).toBe(false)
        expect(partial.results.find((row) => row.remaining > 0)).toMatchObject({ removedMemberships: 25, remaining: 8 })
        const finished = await reconcileLegalSearchRightsBatch(pool, target, { cursor: partial.cursor })
        expect(finished.complete).toBe(true)
        expect(finished.results.reduce((sum, row) => sum + row.removedMemberships, 0)).toBe(8)
        expect(
          (await target.query("SELECT count(*)::integer AS n FROM legislation.legal_search_generations")).rows[0].n
        ).toBe(0)
      } finally {
        await target.end()
      }
    },
    60_000
  )

  it.skipIf(!process.env.REGULATORY_SEARCH_TEST_DATABASE_URL)(
    "acknowledges and revokes one Federal Register observation without completing the other publications",
    async () => {
      const url = new URL(z.string().parse(process.env.REGULATORY_SEARCH_TEST_DATABASE_URL))
      invariant(
        url.pathname === "/legislation_passage_search" && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname),
        "unexpected_search_test_database"
      )
      const target = new pg.Pool({ connectionString: url.href, max: 2 })
      try {
        if (!(await target.query("SELECT to_regclass('legislation.legal_search_generations') AS name")).rows[0].name) {
          await target.query(
            await readFile(
              new URL(import.meta.resolve("@repo/legislation-core/infra/passage-search/legal.sql")),
              "utf8"
            )
          )
        }
        await target.query(
          "TRUNCATE legislation.legal_search_generations,legislation.legal_search_scopes,legislation.legal_search_revocations CASCADE"
        )
        const data = await frInput()
        await publishFrIssue(pool, data.lease, data)
        const observation = (
          await pool.query("SELECT id,version_id FROM legislation.regulatory_document_observations ORDER BY id LIMIT 1")
        ).rows[0]
        const plan = await runLegalPassagePreparationBatch(pool, {
          scope: { kind: "publication", id: observation.id },
          model: "openai/text-embedding-3-small",
          limit: 25
        })
        const item = (
          await pool.query(
            "SELECT generation_id FROM legislation.legal_passage_preparation_items WHERE preparation_id=$1",
            [plan.preparationId]
          )
        ).rows[0]
        await replicateLegalPassageGeneration(pool, target, {
          scope: { kind: "publication", observationId: observation.id, versionId: observation.version_id },
          generationId: item.generation_id
        })
        expect(await acknowledgeLegalPassageCopy(pool, target, plan.preparationId)).toMatchObject({
          acknowledged: true,
          copiedGenerations: 1
        })
        const publicationSearch = {
          scope: { kind: "publication" as const, observationId: observation.id, versionId: observation.version_id },
          generationId: item.generation_id,
          preparationId: plan.preparationId,
          query: "nonexistentwords"
        }
        expect(await searchCopiedLegalPassages(pool, target, publicationSearch)).toEqual([])
        const observationBefore = (
          await pool.query("SELECT metadata FROM legislation.regulatory_document_observations WHERE id=$1", [
            observation.id
          ])
        ).rows[0]
        await pool.query(
          "UPDATE legislation.regulatory_document_observations SET metadata=jsonb_set(metadata,'{document_number}',to_jsonb('changed-number'::text)) WHERE id=$1",
          [observation.id]
        )
        try {
          await expect(searchCopiedLegalPassages(pool, target, publicationSearch)).rejects.toThrow(
            "legal_search_scope_revision_changed"
          )
        } finally {
          await pool.query("UPDATE legislation.regulatory_document_observations SET metadata=$2::jsonb WHERE id=$1", [
            observation.id,
            JSON.stringify(observationBefore.metadata)
          ])
        }
        expect(await searchCopiedLegalPassages(pool, target, publicationSearch)).toEqual([])
        await pool.query("UPDATE legislation.regulatory_document_versions SET heading=heading WHERE id=$1", [
          observation.version_id
        ])
        await expect(searchCopiedLegalPassages(pool, target, publicationSearch)).rejects.toThrow(
          "legal_search_scope_revision_changed"
        )
        await acknowledgeLegalPassageCopy(pool, target, plan.preparationId)
        expect(await searchCopiedLegalPassages(pool, target, publicationSearch)).toEqual([])
        expect(
          (
            await pool.query(
              "SELECT state,count(*)::integer AS n FROM legislation.regulatory_publication_outbox GROUP BY state ORDER BY state"
            )
          ).rows
        ).toEqual([
          { state: "acknowledged", n: 1 },
          { state: "pending", n: 2 }
        ])
        await pool.query("UPDATE legislation.legal_rights_profiles SET is_active=false")
        expect(
          await reconcileLegalSearchScopeRights(pool, target, { kind: "publication", id: observation.id })
        ).toMatchObject({ removedMemberships: 1, removedGenerations: 1, remaining: 0 })
        expect(
          (
            await pool.query(
              "SELECT count(*)::integer AS n FROM legislation.regulatory_publication_outbox WHERE state='pending'"
            )
          ).rows[0].n
        ).toBe(3)
      } finally {
        await target.end()
      }
    }
  )

  async function materialized(data: Awaited<ReturnType<typeof input>>) {
    const result = await staged(data)
    expect(await validateStagedRegulatoryImport(pool, result.lease)).toBe("validated")
    return { ...result, editionId: await materializeRegulatoryEdition(pool, result.lease) }
  }

  it("persists exact provision source dispositions and rejects changed replay evidence", async () => {
    const data = await materialized(
      await input({
        body: `<DIV8 N="1.1" TYPE="SECTION"><HEAD>Reviewed table</HEAD><P>Introductory text.</P><TABLE><TR><TH>Label</TH><TH>Value</TH></TR><TR><TD>B</TD><TD>......do</TD></TR></TABLE></DIV8>`
      })
    )
    await publishRegulatoryEdition(pool, data.lease, null)
    const row = (
      await pool.query<{
        artifact_hash: string
        blocks: Array<{ kind: string; xml: string }>
        content_hash: string
        generation_id: string
        native_id: string
        policy_hash: string
        rights_profile_id: string
        source_id: string
        source_locator: string
        source_url: string
        version_id: string
      }>(
        `SELECT g.artifact_hash,v.blocks,v.content_hash,e.generation_id,m.native_id,r.policy_hash,
          e.rights_profile_id,e.source_id,m.source_locator,g.unit->>'sourceUrl' AS source_url,m.version_id
        FROM legislation.legal_edition_provisions m
        JOIN legislation.legal_provision_versions v ON v.id=m.version_id
        JOIN legislation.legal_editions e ON e.id=m.edition_id
        JOIN legislation.legal_import_generations g ON g.id=e.generation_id
        JOIN legislation.legal_rights_profiles r ON r.id=e.rights_profile_id
        WHERE m.edition_id=$1 AND m.ordinal=1`,
        [data.editionId]
      )
    ).rows[0]
    invariant(row, "source_review_test_member_missing")
    const table = row.blocks.find((block) => block.kind === "table")
    invariant(table, "source_review_test_table_missing")
    const request = {
      editionId: data.editionId,
      versionId: row.version_id,
      tableIndex: 0,
      disposition: "quarantined_source_gap" as const,
      reason: "publisher_source_missing_reference_row",
      expected: {
        contentHash: row.content_hash,
        blockHash: digest(table.xml),
        nativeId: row.native_id,
        sourceLocator: row.source_locator,
        sourceId: row.source_id,
        generationId: row.generation_id,
        artifactHash: row.artifact_hash,
        sourceUrl: row.source_url,
        rightsProfileId: row.rights_profile_id,
        rightsHash: row.policy_hash
      },
      corroboration: [
        {
          sourceUrl: "https://www.govinfo.gov/example.pdf",
          artifactHash: "1".repeat(64),
          bytes: 100,
          observation: "The annual rendition contains the missing predecessor row."
        }
      ],
      canonicalBodyChanged: false as const,
      contextInjected: false as const,
      derivedPassagesAllowed: false
    }
    const first = await registerLegalProvisionSourceReview(pool, request)
    const replay = await registerLegalProvisionSourceReview(pool, request)
    expect(first.reused).toBe(false)
    expect(replay).toMatchObject({ reviewHash: first.reviewHash, reused: true })
    const prepared = await runLegalPassagePreparationBatch(pool, {
      scope: { kind: "edition", id: data.editionId },
      model: "openai/text-embedding-3-small",
      limit: 25
    })
    expect(prepared).toMatchObject({ state: "blocked", blocked: 1 })
    expect(
      (
        await pool.query(
          "SELECT failure_code FROM legislation.legal_passage_preparation_items WHERE preparation_id=$1 AND version_id=$2",
          [prepared.preparationId, row.version_id]
        )
      ).rows
    ).toEqual([{ failure_code: "source_review_quarantined" }])
    const retried = await runLegalPassagePreparationBatch(pool, {
      scope: { kind: "edition", id: data.editionId },
      model: "openai/text-embedding-3-small",
      limit: 25,
      retryBlocked: true
    })
    expect(retried).toMatchObject({ state: "blocked", blocked: 1, processed: 0 })
    await expect(
      registerLegalProvisionSourceReview(pool, { ...request, reason: "changed_after_review" })
    ).rejects.toThrow("legal_provision_source_review_replay_conflict")
    await expect(
      registerLegalProvisionSourceReview(pool, {
        ...request,
        expected: { ...request.expected, blockHash: "2".repeat(64) }
      })
    ).rejects.toThrow("legal_provision_source_review_table_changed")
  })

  async function annualInputs(
    options: { duplicateSection?: boolean; conflictingDate?: boolean; packageYear?: number } = {}
  ) {
    const packageYear = options.packageYear ?? 2023
    const template = await input({ fixture: "cfr-2024-title1-excerpt.xml" })
    const files = [1, 2].map((volume) => ({
      name: `CFR-${packageYear}-title1-vol${volume}.xml`,
      folder: false,
      link: `https://www.govinfo.gov/bulkdata/CFR/${packageYear}/title-1/CFR-${packageYear}-title1-vol${volume}.xml`
    }))
    const body = JSON.stringify({ files })
    const units = files.map((file) => {
      const unit = {
        ...template.receipt.unit,
        nativeId: file.name.slice(0, -4),
        edition: String(packageYear),
        sourceUrl: file.link,
        inventoryHash: digest(body),
        inventoryRevision: digest(JSON.stringify(file))
      }
      unit.key = unitIdentity(unit)
      return unit
    })
    const manifest = {
      ...template.manifest,
      units,
      estimatedKnownBytes: units.reduce((sum, unit) => sum + (unit.expectedBytes ?? 0), 0),
      unknownSizeUnits: units.filter((unit) => unit.expectedBytes === null).length,
      scope: { ...template.manifest.scope, ecfrTitles: [], annualCfr: { years: [packageYear], titles: [1] } },
      inventory: [
        {
          ...template.manifest.inventory[0],
          sourceId: "govinfo-cfr" as const,
          url: `https://www.govinfo.gov/bulkdata/json/CFR/${packageYear}/title-1/`,
          body,
          sha256: digest(body),
          bytes: Buffer.byteLength(body),
          retrievedAt: "2026-09-14T00:00:00Z",
          contentType: "application/json"
        }
      ]
    }
    manifest.id = manifestIdentity(manifest)
    const outputs = []
    for (const [index, unit] of units.entries()) {
      let xml = await readFile(template.artifactLocator, "utf8")
      if (index === 1 && !options.duplicateSection) {
        xml = xml.replace("1.1</SECTNO>", "1.2</SECTNO>")
      }
      if (index === 1 && options.conflictingDate) {
        xml = xml.replaceAll("January 1, 2023", "April 1, 2023")
      }
      const path = join(await mkdtemp(join(tmpdir(), "rostra-annual-volume-")), "source.xml")
      directories.push(resolve(path, ".."))
      await writeFile(path, xml)
      const parsed = await parseRegulatoryArtifact({
        unit,
        artifactHash: digest(xml),
        path,
        outputRoot: resolve(path, "../normalized")
      })
      const receipt = { ...template.receipt, unit, sha256: digest(xml), bytes: Buffer.byteLength(xml) }
      outputs.push({
        manifest,
        receipt,
        summary: parsed.summary,
        directory: parsed.directory,
        parserCodeHash: parsed.summary.parserCodeHash,
        artifactLocator: path
      })
    }
    return { manifest, outputs }
  }
  it("atomically stores/replays concurrent passage generations and gates lexical reads on source rights", async () => {
    const data = await materialized(await input())
    const members = await pool.query(
      "SELECT version_id FROM legislation.legal_edition_provisions WHERE edition_id=$1 ORDER BY ordinal",
      [data.editionId]
    )
    const versionId = z.uuid().parse(members.rows[1]?.version_id)
    const scope = { kind: "provision" as const, versionId, editionId: data.editionId }
    const request = { scope, model: "openai/text-embedding-3-small" as const, context: "United States CFR" }
    await expect(materializeLegalPassages(pool, request)).rejects.toThrow("legal_passage_source_unavailable")
    await publishRegulatoryEdition(pool, data.lease, null)
    const results = await Promise.all([
      materializeLegalPassages(pool, request),
      materializeLegalPassages(pool, request)
    ])
    expect(results.map((result) => result.reused).sort()).toEqual([false, true])
    expect(results[0]?.generationId).toBe(results[1]?.generationId)
    const generationId = z.string().parse(results[0]?.generationId)
    expect(await searchLegalPassages(pool, { scope, generationId, query: "Original" })).toHaveLength(1)
    await expect(
      searchLegalPassages(pool, {
        scope: { ...scope, versionId: z.uuid().parse(members.rows[2]?.version_id) },
        generationId,
        query: "Original"
      })
    ).rejects.toThrow("legal_passage_generation_scope_mismatch")
    expect((await pool.query("SELECT state FROM legislation.legal_derived_outbox")).rows).toEqual([
      { state: "pending" }
    ])
    await pool.query("UPDATE legislation.legal_rights_profiles SET is_active=false")
    await expect(searchLegalPassages(pool, { scope, generationId, query: "Original" })).rejects.toThrow(
      "rights_profile_unavailable"
    )
    await expect(materializeLegalPassages(pool, request)).rejects.toThrow("rights_profile_unavailable")
  })

  it.skipIf(!process.env.REGULATORY_SEARCH_TEST_DATABASE_URL)(
    "isolates dimension-constrained regulatory vectors and completes only an exact passage inventory",
    async () => {
      const targetUrl = new URL(z.string().parse(process.env.REGULATORY_SEARCH_TEST_DATABASE_URL))
      invariant(
        targetUrl.pathname === "/legislation_passage_search" &&
          ["localhost", "127.0.0.1", "[::1]"].includes(targetUrl.hostname),
        "unexpected_search_test_database"
      )
      const target = new pg.Pool({ connectionString: targetUrl.href, max: 3 })
      try {
        if (!(await target.query("SELECT to_regclass('legislation.legal_search_generations') AS name")).rows[0].name) {
          await target.query(
            await readFile(
              new URL(import.meta.resolve("@repo/legislation-core/infra/passage-search/legal.sql")),
              "utf8"
            )
          )
        }
        await target.query(
          "TRUNCATE legislation.legal_search_generations,legislation.legal_search_scopes,legislation.legal_search_revocations CASCADE"
        )
        const data = await materialized(await input())
        await publishRegulatoryEdition(pool, data.lease, null)
        const member = await pool.query(
          "SELECT version_id FROM legislation.legal_edition_provisions WHERE edition_id=$1 AND ordinal=1",
          [data.editionId]
        )
        const scope = {
          kind: "provision" as const,
          versionId: z.uuid().parse(member.rows[0]?.version_id),
          editionId: data.editionId
        }
        const prepared = await materializeLegalPassages(pool, {
          scope,
          model: "openai/text-embedding-3-small",
          context: "United States CFR"
        })
        expect(prepared.passages).toBe(1)
        await replicateLegalPassageGeneration(pool, target, { scope, generationId: prepared.generationId })
        const passage = (
          await target.query<{ id: string; input_hash: string }>(
            "SELECT id,data->>'inputHash' AS input_hash FROM legislation.legal_search_passages WHERE generation_id=$1",
            [prepared.generationId]
          )
        ).rows[0]
        invariant(passage, "vector_test_passage_missing")
        const registration = {
          passageGenerationId: prepared.generationId,
          model: "openai/text-embedding-3-small" as const,
          inputContract: "legal-passage-context-text",
          manifestHash: digest(JSON.stringify([passage.id, passage.input_hash])),
          expectedCount: 1
        }
        const generation = await registerLegalEmbeddingGeneration(target, registration)
        expect(generation).toMatchObject({ dimensions: 1536, state: "pending", reused: false })
        await expect(registerLegalEmbeddingGeneration(target, { ...registration, expectedCount: 2 })).rejects.toThrow(
          "legal_embedding_passage_inventory_mismatch"
        )
        expect(await registerLegalEmbeddingGeneration(target, registration)).toMatchObject({
          generationId: generation.generationId,
          state: "pending",
          reused: true
        })
        const shardIndex = Number.parseInt(passage.id.slice(0, 2), 16) % 16
        const shardRequest = { generationId: generation.generationId, shardCount: 16 as const, shardIndex }
        const selected = await selectLegalEmbeddingShard(target, shardRequest)
        expect(selected).toMatchObject({
          dimensions: 1536,
          exhausted: true,
          scanned: 1,
          shardCount: 16,
          shardIndex,
          items: [{ passageId: passage.id, inputHash: passage.input_hash }]
        })
        expect(
          await selectLegalEmbeddingShard(target, {
            ...shardRequest,
            shardIndex: (shardIndex + 1) % 16
          })
        ).toMatchObject({ exhausted: true, items: [], scanned: 0 })
        const vector = Array.from({ length: 1536 }, (_value, index) => (index === 0 ? 1 : 0))
        const batch = {
          generationId: generation.generationId,
          model: registration.model,
          items: [{ passageId: passage.id, inputHash: passage.input_hash, embedding: vector }]
        }
        expect(await storeLegalEmbeddingBatch(target, batch)).toEqual({ inserted: 1, reused: 0 })
        expect(await selectLegalEmbeddingShard(target, shardRequest)).toMatchObject({
          exhausted: true,
          items: [],
          scanned: 0
        })
        expect(await storeLegalEmbeddingBatch(target, batch)).toEqual({ inserted: 0, reused: 1 })
        await expect(
          storeLegalEmbeddingBatch(target, {
            ...batch,
            items: [
              {
                ...batch.items[0],
                embedding: Array.from({ length: 1536 }, (_value, index) => (index === 1 ? 1 : 0))
              }
            ]
          })
        ).rejects.toThrow("legal_embedding_batch_replay_conflict")
        await expect(
          storeLegalEmbeddingBatch(target, {
            ...batch,
            items: [{ ...batch.items[0], inputHash: "0".repeat(64) }]
          })
        ).rejects.toThrow("legal_embedding_input_mismatch")
        await expect(
          storeLegalEmbeddingBatch(target, {
            ...batch,
            items: [{ ...batch.items[0], embedding: [1] }]
          })
        ).rejects.toThrow("legal_embedding_invalid_vector")
        await expect(
          storeLegalEmbeddingBatch(target, {
            ...batch,
            model: "voyageai/voyage-4",
            items: [{ ...batch.items[0], embedding: Array.from({ length: 1024 }, () => 1) }]
          })
        ).rejects.toThrow("legal_embedding_generation_route_mismatch")
        expect(await completeLegalEmbeddingGeneration(target, generation.generationId)).toMatchObject({
          vectors: 1,
          reused: false
        })
        expect(await completeLegalEmbeddingGeneration(target, generation.generationId)).toMatchObject({
          vectors: 1,
          reused: true
        })
        expect(await storeLegalEmbeddingBatch(target, batch)).toEqual({ inserted: 0, reused: 1 })
        expect(await registerLegalEmbeddingGeneration(target, registration)).toMatchObject({
          state: "embedded",
          reused: true
        })
        await expect(
          target.query("UPDATE legislation.legal_openai_small_embeddings SET dimensions=1024 WHERE generation_id=$1", [
            generation.generationId
          ])
        ).rejects.toThrow()
        await pool.query("UPDATE legislation.legal_rights_profiles SET is_active=false")
        expect(
          await reconcileLegalSearchScopeRights(pool, target, { kind: "edition", id: data.editionId })
        ).toMatchObject({ allowed: false, removedGenerations: 1, removedMemberships: 1, remaining: 0 })
        expect(
          (
            await target.query(
              "SELECT (SELECT count(*)::integer FROM legislation.legal_embedding_generations) AS generations,(SELECT count(*)::integer FROM legislation.legal_openai_small_embeddings) AS vectors"
            )
          ).rows[0]
        ).toEqual({ generations: 0, vectors: 0 })
        await expect(registerLegalEmbeddingGeneration(target, registration)).rejects.toThrow(
          "legal_embedding_search_membership_unavailable"
        )
      } finally {
        await target.end()
      }
    }
  )

  it("rolls back failed passage writes and detects missing retained passage rows on replay", async () => {
    const data = await materialized(
      await input({
        body: `<DIV8 N="1.1" TYPE="SECTION"><HEAD>Workplace safety</HEAD><P>${"Workplace safety procedures and protective equipment. ".repeat(600)}</P></DIV8>`
      })
    )
    await publishRegulatoryEdition(pool, data.lease, null)
    const member = await pool.query(
      "SELECT version_id FROM legislation.legal_edition_provisions WHERE edition_id=$1 AND ordinal=1",
      [data.editionId]
    )
    const request = {
      scope: {
        kind: "provision" as const,
        versionId: z.uuid().parse(member.rows[0]?.version_id),
        editionId: data.editionId
      },
      model: "openai/text-embedding-3-small" as const,
      context: "United States CFR"
    }
    await pool.query(
      "CREATE FUNCTION legislation.passage_write_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.ordinal=1 THEN RAISE EXCEPTION 'passage_injected_failure'; END IF; RETURN NEW; END $$"
    )
    await pool.query(
      "CREATE TRIGGER passage_write_fault BEFORE INSERT ON legislation.legal_passages FOR EACH ROW EXECUTE FUNCTION legislation.passage_write_fault()"
    )
    try {
      await expect(materializeLegalPassages(pool, request)).rejects.toThrow("passage_injected_failure")
      expect(
        (await pool.query("SELECT count(*)::integer AS count FROM legislation.legal_passage_generations")).rows[0]
          ?.count
      ).toBe(0)
    } finally {
      await pool.query("DROP TRIGGER passage_write_fault ON legislation.legal_passages")
      await pool.query("DROP FUNCTION legislation.passage_write_fault()")
    }
    const result = await materializeLegalPassages(pool, request)
    expect(result.passages).toBeGreaterThan(1)
    await pool.query("DELETE FROM legislation.legal_passages WHERE generation_id=$1 AND ordinal=1", [
      result.generationId
    ])
    await expect(materializeLegalPassages(pool, request)).rejects.toThrow("legal_passage_replay_mismatch")
  })

  it("inspects bounded preparation blockers, live leases and missing checkpoints without writing", async () => {
    const badTable = `<TABLE><TR><TD>${"Long source label ".repeat(1800).trim()}</TD><TD>Do.</TD></TR></TABLE>`
    const data = await materialized(
      await input({
        body: `<DIV8 N="1.1" TYPE="SECTION"><HEAD>First ambiguous table</HEAD>${badTable}</DIV8><DIV8 N="1.2" TYPE="SECTION"><HEAD>Second ambiguous table</HEAD>${badTable}</DIV8><DIV8 N="1.3" TYPE="SECTION"><HEAD>Valid section</HEAD><P>Later valid text.</P></DIV8>`
      })
    )
    await publishRegulatoryEdition(pool, data.lease, null)
    const request = {
      scope: { kind: "edition" as const, id: data.editionId },
      model: "openai/text-embedding-3-small" as const,
      limit: 2
    }
    const prepared = await runLegalPassagePreparationBatch(pool, request)
    const inspection = { preparationId: prepared.preparationId, limit: 1 }
    expect(await inspectLegalPreparationStatus(pool, inspection)).toMatchObject({
      checkpointState: "pending",
      counts: { expected: 4, present: 4, prepared: 1, blocked: 1, unattempted: 2, missing: 0, unexpected: 0 },
      failures: [{ ordinal: 1, reason: "passage_table_unresolved_ditto" }],
      nextAfterOrdinal: null,
      canonicalWrites: false,
      dispatched: false,
      publicSearchReady: false
    })
    await runLegalPassagePreparationBatch(pool, request)
    const before = (
      await pool.query("SELECT row_to_json(p) AS job FROM legislation.legal_passage_preparations p WHERE id=$1", [
        prepared.preparationId
      ])
    ).rows[0].job
    const first = await inspectLegalPreparationStatus(pool, inspection)
    expect(first).toMatchObject({
      checkpointState: "blocked",
      counts: { prepared: 2, blocked: 2, unattempted: 0 },
      nextAfterOrdinal: 1
    })
    expect(first.failures).toHaveLength(1)
    const second = await inspectLegalPreparationStatus(pool, { ...inspection, afterOrdinal: first.nextAfterOrdinal })
    expect(second.failures).toHaveLength(1)
    expect(second.failures[0]?.ordinal).toBe(2)
    expect(second.nextAfterOrdinal).toBeNull()
    expect(
      (
        await pool.query("SELECT row_to_json(p) AS job FROM legislation.legal_passage_preparations p WHERE id=$1", [
          prepared.preparationId
        ])
      ).rows[0].job
    ).toEqual(before)
    await pool.query(
      "UPDATE legislation.legal_passage_preparations SET lease_token=gen_random_uuid(),lease_expires_at=clock_timestamp()+interval '1 minute',retry_at=clock_timestamp()+interval '2 minutes' WHERE id=$1",
      [prepared.preparationId]
    )
    const leased = await inspectLegalPreparationStatus(pool, inspection)
    expect(leased.lease.active).toBe(true)
    expect(leased.retry.delayed).toBe(true)
    expect(JSON.stringify(leased)).not.toContain("lease_token")
    await pool.query("DELETE FROM legislation.legal_passage_preparation_items WHERE preparation_id=$1 AND ordinal=3", [
      prepared.preparationId
    ])
    expect(await inspectLegalPreparationStatus(pool, inspection)).toMatchObject({
      counts: { expected: 4, present: 3, missing: 1 }
    })
    await pool.query("UPDATE legislation.legal_rights_profiles SET is_active=false")
    await expect(inspectLegalPreparationStatus(pool, inspection)).rejects.toThrow("rights_profile_unavailable")
    await expect(inspectLegalPreparationStatus(pool, { preparationId: "f".repeat(64) })).rejects.toThrow(
      "legal_preparation_not_found"
    )
    await expect(inspectLegalPreparationStatus(pool, { ...inspection, limit: 101 })).rejects.toThrow(z.ZodError)
  })

  it("records source blockers, finishes later records, and retries only on explicit dispatch", async () => {
    const data = await materialized(
      await input({
        body: `<DIV8 N="1.1" TYPE="SECTION"><HEAD>Ambiguous table</HEAD><TABLE><TR><TD>${"Long source label ".repeat(1800).trim()}</TD><TD>Do.</TD></TR></TABLE></DIV8><DIV8 N="1.2" TYPE="SECTION"><HEAD>Later valid section</HEAD><P>Keep preparing later text.</P></DIV8>`
      })
    )
    await publishRegulatoryEdition(pool, data.lease, null)
    const request = {
      scope: { kind: "edition" as const, id: data.editionId },
      model: "openai/text-embedding-3-small" as const,
      limit: 2
    }
    const first = await runLegalPassagePreparationBatch(pool, request)
    expect(first).toMatchObject({ state: "pending", processed: 2, total: 3, complete: 1, blocked: 1 })
    const result = await runLegalPassagePreparationBatch(pool, request)
    expect(result).toMatchObject({ state: "blocked", processed: 1, total: 3, complete: 2, blocked: 1 })
    const failures = await pool.query(
      "SELECT ordinal,version_id,failure_code,failed_at,generation_id FROM legislation.legal_passage_preparation_items WHERE preparation_id=$1 AND failure_code IS NOT NULL",
      [result.preparationId]
    )
    expect(failures.rows).toHaveLength(1)
    expect(failures.rows[0]).toMatchObject({
      ordinal: 1,
      failure_code: "passage_table_unresolved_ditto",
      generation_id: null
    })
    expect(failures.rows[0].failed_at).toBeInstanceOf(Date)
    expect((await pool.query("SELECT state FROM legislation.legal_derived_outbox")).rows).toEqual([
      { state: "pending" }
    ])
    const unavailableTarget = new pg.Pool({
      connectionString: "postgresql://unused:unused@127.0.0.1:1/legislation_passage_search",
      connectionTimeoutMillis: 100
    })
    try {
      await expect(
        runLegalPassageCopyBatch(pool, unavailableTarget, { preparationId: result.preparationId })
      ).rejects.toThrow(z.ZodError)
    } finally {
      await unavailableTarget.end()
    }
    expect(await runLegalPassagePreparationBatch(pool, request)).toMatchObject({
      state: "blocked",
      processed: 0,
      complete: 2,
      blocked: 1
    })
    expect(
      (
        await pool.query(
          "SELECT failed_at FROM legislation.legal_passage_preparation_items WHERE preparation_id=$1 AND ordinal=1",
          [result.preparationId]
        )
      ).rows[0].failed_at
    ).toEqual(failures.rows[0].failed_at)
    await pool.query(
      "UPDATE legislation.legal_passage_preparations SET lease_token=gen_random_uuid(),lease_expires_at=clock_timestamp()+interval '1 minute' WHERE id=$1",
      [result.preparationId]
    )
    await expect(runLegalPassagePreparationBatch(pool, { ...request, retryBlocked: true })).rejects.toThrow(
      "legal_preparation_busy_or_delayed"
    )
    expect(
      (
        await pool.query(
          "SELECT count(failure_code)::int AS n FROM legislation.legal_passage_preparation_items WHERE preparation_id=$1",
          [result.preparationId]
        )
      ).rows[0].n
    ).toBe(1)
    await pool.query(
      "UPDATE legislation.legal_passage_preparations SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",
      [result.preparationId]
    )
    expect(await runLegalPassagePreparationBatch(pool, { ...request, retryBlocked: true })).toMatchObject({
      state: "blocked",
      processed: 1,
      complete: 2,
      blocked: 1
    })
    expect((await pool.query("SELECT count(*)::int AS n FROM legislation.legal_passage_generations")).rows[0].n).toBe(2)
    await pool.query("UPDATE legislation.legal_rights_profiles SET is_active=false")
    await expect(runLegalPassagePreparationBatch(pool, { ...request, retryBlocked: true })).rejects.toThrow(
      "rights_profile_unavailable"
    )
    expect(
      (
        await pool.query(
          "SELECT count(failure_code)::int AS n FROM legislation.legal_passage_preparation_items WHERE preparation_id=$1",
          [result.preparationId]
        )
      ).rows[0].n
    ).toBe(1)
  })

  it("rolls back a blocked checkpoint when its lease expires during the write", async () => {
    const data = await materialized(
      await input({
        body: `<DIV8 N="1.1" TYPE="SECTION"><HEAD>Ambiguous</HEAD><TABLE><TR><TD>${"Long source label ".repeat(1800).trim()}</TD><TD>Do.</TD></TR></TABLE></DIV8>`
      })
    )
    await publishRegulatoryEdition(pool, data.lease, null)
    const request = {
      scope: { kind: "edition" as const, id: data.editionId },
      model: "openai/text-embedding-3-small" as const,
      limit: 1
    }
    const first = await runLegalPassagePreparationBatch(pool, request)
    await pool.query(
      "CREATE FUNCTION legislation.preparation_block_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.failure_code IS NOT NULL THEN UPDATE legislation.legal_passage_preparations SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE id=NEW.preparation_id; END IF; RETURN NEW; END $$"
    )
    await pool.query(
      "CREATE TRIGGER preparation_block_fault BEFORE UPDATE ON legislation.legal_passage_preparation_items FOR EACH ROW EXECUTE FUNCTION legislation.preparation_block_fault()"
    )
    try {
      await expect(runLegalPassagePreparationBatch(pool, request)).rejects.toThrow("legal_preparation_lease_lost")
      expect(
        (
          await pool.query(
            "SELECT count(failure_code)::int AS n FROM legislation.legal_passage_preparation_items WHERE preparation_id=$1",
            [first.preparationId]
          )
        ).rows[0].n
      ).toBe(0)
    } finally {
      await pool.query("DROP TRIGGER preparation_block_fault ON legislation.legal_passage_preparation_items")
      await pool.query("DROP FUNCTION legislation.preparation_block_fault()")
    }
    await pool.query(
      "UPDATE legislation.legal_passage_preparations SET retry_at=clock_timestamp()-interval '1 second' WHERE id=$1",
      [first.preparationId]
    )
    expect(await runLegalPassagePreparationBatch(pool, request)).toMatchObject({
      state: "blocked",
      complete: 1,
      blocked: 1
    })
  })

  it("resumes bounded passage preparation, excludes live leases, and verifies a complete denominator", async () => {
    const data = await materialized(await input())
    await publishRegulatoryEdition(pool, data.lease, null)
    const request = {
      scope: { kind: "edition" as const, id: data.editionId },
      model: "openai/text-embedding-3-small" as const,
      limit: 1
    }
    const first = await runLegalPassagePreparationBatch(pool, request)
    expect(first).toMatchObject({ state: "pending", processed: 1, total: 3, complete: 1 })
    await pool.query(
      "UPDATE legislation.legal_passage_preparations SET lease_token=gen_random_uuid(),lease_expires_at=clock_timestamp()+interval '1 minute' WHERE id=$1",
      [first.preparationId]
    )
    await expect(runLegalPassagePreparationBatch(pool, request)).rejects.toThrow("legal_preparation_busy_or_delayed")
    await pool.query(
      "UPDATE legislation.legal_passage_preparations SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",
      [first.preparationId]
    )
    expect(await runLegalPassagePreparationBatch(pool, request)).toMatchObject({ state: "pending", complete: 2 })
    expect(await runLegalPassagePreparationBatch(pool, request)).toMatchObject({ state: "prepared", complete: 3 })
    expect(await runLegalPassagePreparationBatch(pool, request)).toMatchObject({
      state: "prepared",
      processed: 0,
      complete: 3
    })
    expect((await pool.query("SELECT state FROM legislation.legal_derived_outbox")).rows).toEqual([
      { state: "pending" }
    ])
    await pool.query(
      "UPDATE legislation.legal_passage_preparation_items SET context=context||' changed' WHERE preparation_id=$1 AND ordinal=1",
      [first.preparationId]
    )
    await expect(runLegalPassagePreparationBatch(pool, request)).rejects.toThrow(
      "legal_preparation_checkpoint_inventory_changed"
    )
    await pool.query(
      "UPDATE legislation.legal_passage_preparation_items i SET context=g.context FROM legislation.legal_passage_generations g WHERE i.generation_id=g.id AND i.preparation_id=$1",
      [first.preparationId]
    )
    await pool.query(
      "UPDATE legislation.legal_passage_preparations SET retry_at=clock_timestamp()-interval '1 second' WHERE id=$1",
      [first.preparationId]
    )
    await pool.query(
      "DELETE FROM legislation.legal_passages WHERE generation_id IN (SELECT generation_id FROM legislation.legal_passage_preparation_items WHERE preparation_id=$1 AND ordinal=1)",
      [first.preparationId]
    )
    await expect(runLegalPassagePreparationBatch(pool, request)).rejects.toThrow(
      "legal_preparation_passage_inventory_mismatch"
    )
  })

  it("recovers a committed generation after checkpoint failure and refuses an expired checkpoint lease", async () => {
    const data = await materialized(await input())
    await publishRegulatoryEdition(pool, data.lease, null)
    const request = {
      scope: { kind: "edition" as const, id: data.editionId },
      model: "openai/text-embedding-3-small" as const,
      limit: 1
    }
    await pool.query(
      "CREATE FUNCTION legislation.preparation_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'checkpoint_failure'; END $$"
    )
    await pool.query(
      "CREATE TRIGGER preparation_fault BEFORE UPDATE ON legislation.legal_passage_preparation_items FOR EACH ROW EXECUTE FUNCTION legislation.preparation_fault()"
    )
    try {
      await expect(runLegalPassagePreparationBatch(pool, request)).rejects.toThrow("checkpoint_failure")
    } finally {
      await pool.query("DROP TRIGGER preparation_fault ON legislation.legal_passage_preparation_items")
      await pool.query("DROP FUNCTION legislation.preparation_fault()")
    }
    expect(
      (await pool.query("SELECT count(*)::integer AS count FROM legislation.legal_passage_generations")).rows[0]?.count
    ).toBe(1)
    await expect(runLegalPassagePreparationBatch(pool, request)).rejects.toThrow("legal_preparation_busy_or_delayed")
    await pool.query("UPDATE legislation.legal_passage_preparations SET retry_at=clock_timestamp()-interval '1 second'")
    expect(await runLegalPassagePreparationBatch(pool, request)).toMatchObject({ complete: 1 })
    expect(
      (await pool.query("SELECT count(*)::integer AS count FROM legislation.legal_passage_generations")).rows[0]?.count
    ).toBe(1)
    await pool.query(
      "CREATE FUNCTION legislation.preparation_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN UPDATE legislation.legal_passage_preparations SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE id=NEW.preparation_id; RETURN NEW; END $$"
    )
    await pool.query(
      "CREATE TRIGGER preparation_fault BEFORE UPDATE ON legislation.legal_passage_preparation_items FOR EACH ROW EXECUTE FUNCTION legislation.preparation_fault()"
    )
    try {
      await expect(runLegalPassagePreparationBatch(pool, request)).rejects.toThrow("legal_preparation_lease_lost")
    } finally {
      await pool.query("DROP TRIGGER preparation_fault ON legislation.legal_passage_preparation_items")
      await pool.query("DROP FUNCTION legislation.preparation_fault()")
    }
    expect(
      (
        await pool.query(
          "SELECT count(generation_id)::integer AS count FROM legislation.legal_passage_preparation_items"
        )
      ).rows[0]?.count
    ).toBe(1)
  })

  async function publishAnnualAnchor(data: Awaited<ReturnType<typeof annualInputs>>) {
    const imports = []
    for (const volume of data.outputs) {
      imports.push(await importNormalizedRegulatoryUnit(pool, volume))
    }
    await publishAnnualCfrEdition(pool, {
      manifestId: data.manifest.id,
      year: 2023,
      title: 1,
      generationIds: imports.map((row) => row.generationId)
    })
    return imports
  }
  it("retains later annual packages as observations of the published revision without new editions or derived work", async () => {
    const anchorData = await annualInputs()
    await publishAnnualAnchor(anchorData)
    for (const volume of anchorData.outputs) {
      expect(await importNormalizedRegulatoryUnit(pool, volume)).toMatchObject({
        state: "published",
        publicationReady: true
      })
    }
    for (const year of [2024, 2025]) {
      const data = await annualInputs({ packageYear: year })
      for (const volume of data.outputs) {
        const imported = await importNormalizedRegulatoryUnit(pool, volume)
        expect(imported).toMatchObject({
          state: "observed",
          reused: false,
          observation: {
            packageYear: year,
            revisionDate: "2023-01-01",
            canCreatePackageYearEdition: false
          }
        })
        expect(await readAnnualCfrSourceObservation(pool, imported.generationId)).toMatchObject({
          packageYear: year,
          revisionDate: "2023-01-01",
          sourceUrl: volume.receipt.unit.sourceUrl
        })
        expect(await importNormalizedRegulatoryUnit(pool, volume)).toMatchObject({ state: "observed", reused: true })
      }
    }
    const counts = (
      await pool.query(`SELECT
      (SELECT count(*)::int FROM legislation.legal_editions) editions,
      (SELECT count(*)::int FROM legislation.legal_annual_editions) annual,
      (SELECT count(*)::int FROM legislation.legal_annual_source_observations) observations,
      (SELECT count(*)::int FROM legislation.legal_derived_outbox) outbox`)
    ).rows[0]
    expect(counts).toEqual({ editions: 2, annual: 1, observations: 4, outbox: 2 })
    await pool.query("UPDATE legislation.legal_rights_profiles SET is_active=false")
    const observation = (
      await pool.query("SELECT generation_id FROM legislation.legal_annual_source_observations LIMIT 1")
    ).rows[0]
    expect(await readAnnualCfrSourceObservation(pool, observation.generation_id)).toBeNull()
  }, 60_000)
  it("retries a blocked observation only after the anchor's complete title has published", async () => {
    const later = (await annualInputs({ packageYear: 2024 })).outputs[0]
    invariant(later, "missing_test_volume")
    const initial = await importNormalizedRegulatoryUnit(pool, later)
    expect(initial.state).toBe("blocked")
    const anchor = await annualInputs()
    for (const volume of anchor.outputs) {
      await importNormalizedRegulatoryUnit(pool, volume)
    }
    expect((await importNormalizedRegulatoryUnit(pool, later)).state).toBe("blocked")
    await publishAnnualAnchor(anchor)
    expect(await importNormalizedRegulatoryUnit(pool, later)).toMatchObject({
      generationId: initial.generationId,
      state: "observed"
    })
    expect(
      (await pool.query("SELECT count(*)::int AS n FROM legislation.legal_annual_source_observations")).rows[0].n
    ).toBe(1)
  }, 60_000)
  it.each(["staged", "canonical"])(
    "rejects %s content drift despite matching source hashes and counts",
    async (target) => {
      const later = (await annualInputs({ packageYear: 2024 })).outputs[0]
      invariant(later, "missing_test_volume")
      const initial = await importNormalizedRegulatoryUnit(pool, later)
      await publishAnnualAnchor(await annualInputs())
      if (target === "staged") {
        await pool.query(
          "UPDATE legislation.legal_import_records SET payload=jsonb_set(payload,'{text}',to_jsonb('damaged text'::text)) WHERE generation_id=$1",
          [initial.generationId]
        )
      } else {
        await pool.query("UPDATE legislation.legal_provision_versions SET body='damaged text'")
      }
      await expect(importNormalizedRegulatoryUnit(pool, later)).rejects.toThrow("annual_observation_content_mismatch")
      expect(
        (await pool.query("SELECT count(*)::int AS n FROM legislation.legal_annual_source_observations")).rows[0].n
      ).toBe(0)
      expect(
        (await pool.query("SELECT state FROM legislation.legal_import_generations WHERE id=$1", [initial.generationId]))
          .rows[0].state
      ).toBe("blocked")
    },
    60_000
  )
  it("requires the publisher's complete annual volume set and atomically publishes/replays it", async () => {
    const data = await annualInputs()
    const imports = []
    for (const volume of data.outputs) {
      imports.push(await importNormalizedRegulatoryUnit(pool, volume))
    }
    expect(imports.map((row) => row.state)).toEqual(["materialized", "materialized"])
    const request = {
      manifestId: data.manifest.id,
      year: 2023,
      title: 1,
      generationIds: imports.map((row) => row.generationId)
    }
    await expect(
      publishAnnualCfrEdition(pool, { ...request, generationIds: request.generationIds.slice(0, 1) })
    ).rejects.toThrow("annual_title_incomplete_or_date_conflict")
    expect(
      (await pool.query("SELECT count(*)::int AS n FROM legislation.legal_editions WHERE published_at IS NOT NULL"))
        .rows[0].n
    ).toBe(0)
    const lease = await claimRegulatoryLease(pool, request.generationIds[0] ?? "")
    await expect(publishRegulatoryEdition(pool, lease, null)).rejects.toThrow(
      "annual_requires_complete_title_publication"
    )
    await releaseRegulatoryLease(pool, lease)
    const result = await publishAnnualCfrEdition(pool, request)
    expect(result).toMatchObject({ volumes: 2, revisionDate: "2023-01-01", reused: false })
    expect(await publishAnnualCfrEdition(pool, request)).toMatchObject({ ...result, reused: true })
    expect((await pool.query("SELECT count(*)::int AS n FROM legislation.legal_derived_outbox")).rows[0].n).toBe(2)
    expect((await pool.query("SELECT count(*)::int AS n FROM legislation.legal_code_heads")).rows[0].n).toBe(0)
    const members = data.outputs.map((row, index) => ({
      generationId: request.generationIds[index],
      unitKey: row.receipt.unit.key,
      summary: row.summary
    }))
    expect(assessAnnualCfrEdition({ manifest: data.manifest, year: 2023, title: 1, members }).isComplete).toBe(true)
    const incompleteUnits = data.manifest.units.slice(0, 1)
    const incomplete = {
      ...data.manifest,
      units: incompleteUnits,
      estimatedKnownBytes: incompleteUnits.reduce((sum, unit) => sum + (unit.expectedBytes ?? 0), 0),
      unknownSizeUnits: incompleteUnits.filter((unit) => unit.expectedBytes === null).length
    }
    incomplete.id = manifestIdentity(incomplete)
    expect(() =>
      assessAnnualCfrEdition({ manifest: incomplete, year: 2023, title: 1, members: members.slice(0, 1) })
    ).toThrow("annual_manifest_volume_denominator_mismatch")
  }, 60000)
  it("refuses overlapping provisions across annual volumes without partial publication", async () => {
    const data = await annualInputs({ duplicateSection: true })
    const generationIds = []
    for (const row of data.outputs) {
      generationIds.push((await importNormalizedRegulatoryUnit(pool, row)).generationId)
    }
    await expect(
      publishAnnualCfrEdition(pool, { manifestId: data.manifest.id, year: 2023, title: 1, generationIds })
    ).rejects.toThrow("annual_duplicate_provision_across_volumes")
    expect((await pool.query("SELECT count(*)::int AS n FROM legislation.legal_annual_editions")).rows[0].n).toBe(0)
  }, 60000)
  it("refuses inconsistent volume revisions even when both dates match the package year", async () => {
    const data = await annualInputs({ conflictingDate: true })
    const generationIds = []
    for (const row of data.outputs) {
      generationIds.push((await importNormalizedRegulatoryUnit(pool, row)).generationId)
    }
    await expect(
      publishAnnualCfrEdition(pool, { manifestId: data.manifest.id, year: 2023, title: 1, generationIds })
    ).rejects.toThrow("annual_title_incomplete_or_date_conflict")
  }, 60000)
  it("shares lease enforcement across formats while rejecting non-XML input in XML writers", async () => {
    const data = await staged(await input())
    await pool.query("UPDATE legislation.legal_import_generations SET unit=$2,summary=$3 WHERE id=$1", [
      data.id,
      { format: "html_preformatted", sourceId: "govinfo-fr" },
      { contract: "synthetic-html-generation" }
    ])
    const format = await withImportLease(
      pool,
      data.lease,
      async (_client, generation) => z.object({ format: z.literal("html_preformatted") }).parse(generation.unit).format
    )
    expect(format).toBe("html_preformatted")
    let xmlCallbackRan = false
    await expect(
      withLease(pool, data.lease, async () => {
        xmlCallbackRan = true
      })
    ).rejects.toBeInstanceOf(z.ZodError)
    expect(xmlCallbackRan).toBe(false)
    await pool.query("UPDATE legislation.legal_rights_profiles SET is_active=false")
    await expect(withImportLease(pool, data.lease, async () => "unreachable")).rejects.toThrow(
      "rights_profile_unavailable"
    )
  })
  it("rolls back format-neutral work when the lease expires before commit", async () => {
    const data = await staged(await input())
    await expect(
      withImportLease(pool, data.lease, async (client) => {
        await client.query(
          "UPDATE legislation.legal_import_generations SET blocked_reason='must roll back',lease_expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",
          [data.id]
        )
      })
    ).rejects.toThrow("lease_lost")
    const row = await pool.query<{ blocked_reason: string | null }>(
      "SELECT blocked_reason FROM legislation.legal_import_generations WHERE id=$1",
      [data.id]
    )
    expect(row.rows[0]?.blocked_reason).toBeNull()
  })
  async function counts() {
    const result = await pool.query(`SELECT
      (SELECT count(*)::int FROM legislation.legal_provisions) AS provisions,
      (SELECT count(*)::int FROM legislation.legal_provision_versions) AS versions,
      (SELECT count(*)::int FROM legislation.legal_edition_provisions) AS memberships,
      (SELECT count(*)::int FROM legislation.legal_code_heads) AS heads,
      (SELECT count(*)::int FROM legislation.legal_derived_outbox) AS outbox`)
    return result.rows[0]
  }

  it("registers all 110 source records with two distinct citation identities and preserves contested metadata", async () => {
    const data = await input({ fixture: "fr-2000-01-18.xml.gz" })
    const stagedData = await staged(data)
    expect(await validateStagedRegulatoryImport(pool, stagedData.lease)).toBe("blocked")
    const template = frMetadataPageSchema.parse(
      JSON.parse(await readFile(new URL("fr-2024-01-02-metadata.json", fixtures), "utf8"))
    ).results[0]
    invariant(template, "metadata_fixture_missing")
    const mixed = {
      ...template,
      document_number: "00-113",
      publication_date: "2000-01-18",
      volume: 65,
      type: "Rule",
      start_page: 2639,
      end_page: 2639,
      title: "Notice of Filing of Plat of an Island; Minnesota"
    }
    const metadata = await collectFrMetadata(
      { start: "2000-01-18", end: "2000-01-18", cutoff: "2026-09-14" },
      async (url) => {
        const body = JSON.stringify({ count: 1, total_pages: 1, next_page_url: null, results: [mixed] })
        return {
          url,
          body,
          sha256: digest(body),
          bytes: Buffer.byteLength(body),
          contentType: "application/json",
          retrievedAt: "2026-09-14T00:00:00Z"
        }
      }
    )
    const report = await registerFrSourceInventory(pool, stagedData.lease, metadata)
    expect(report).toMatchObject({
      sourceRecords: 110,
      uniquePublisherNumbers: 109,
      ambiguousAliases: ["00-113"],
      reused: false,
      publicationReady: false
    })
    const disputed = report.observations.filter((row) => row.publisherNumber === "00-113")
    expect(disputed).toHaveLength(2)
    expect(
      disputed.every((row) => row.metadataStatus === "conflict" && row.metadataCandidates[0]?.title === mixed.title)
    ).toBe(true)
    expect(new Set(disputed.map((row) => row.citationKey)).size).toBe(2)
    const alias = await resolveFrSourceNumber(pool, "2000-01-18", "00-113")
    expect(alias.status).toBe("ambiguous")
    expect(alias.documents).toHaveLength(2)
    expect(await registerFrSourceInventory(pool, stagedData.lease, metadata)).toMatchObject({
      reused: true,
      sourceRecords: 110
    })
    expect(await resolveFrSourceNumber(pool, "2000-01-18", "00-113")).toEqual(alias)
    const counts = (
      await pool.query(`SELECT
      (SELECT count(*)::int FROM legislation.regulatory_documents) documents,
      (SELECT count(*)::int FROM legislation.regulatory_source_documents) sources,
      (SELECT count(*)::int FROM legislation.regulatory_document_versions) versions,
      (SELECT count(*)::int FROM legislation.regulatory_publication_outbox) outbox`)
    ).rows[0]
    expect(counts).toEqual({ documents: 110, sources: 110, versions: 0, outbox: 0 })
    const issuePdfPath = fileURLToPath(new URL("fr-2000-01-18.pdf", fixtures))
    const reviewed = await registerFrSourceReviews(pool, stagedData.lease, { metadata, issuePdfPath })
    expect(reviewed.reviews).toHaveLength(3)
    expect(reviewed.reviews.map((row) => row.evidence.reviewedFields)).toEqual([
      {
        title: "Revision of Class D Airspace; Hobbs, NM",
        publicationKind: "final_rule",
        publicationDate: "2000-01-18",
        startPage: 2537,
        endPage: 2538
      },
      { title: mixed.title, publicationKind: "notice", publicationDate: "2000-01-18", startPage: 2639, endPage: 2639 },
      {
        title:
          "Ambient Air Monitoring Reference and Equivalent Methods: Designation of a New Equivalent Method for SO2",
        publicationKind: "notice",
        publicationDate: "2000-01-18",
        startPage: 2610,
        endPage: 2611
      }
    ])
    expect(
      reviewed.reviews.every(
        (row) => !row.evidence.publicationReady && !row.evidence.issuePdf.isolatedDocumentTextValidated
      )
    ).toBe(true)
    expect(
      (await registerFrSourceReviews(pool, stagedData.lease, { metadata, issuePdfPath })).reviews.every(
        (row) => row.reused
      )
    ).toBe(true)
    expect(await registerFrSourceInventory(pool, stagedData.lease, metadata)).toMatchObject({ reused: true })
    expect(
      (await pool.query("SELECT count(*)::int AS n FROM legislation.regulatory_document_versions")).rows[0].n
    ).toBe(0)
    const damagedPdf = Buffer.from(await readFile(issuePdfPath))
    damagedPdf[0] = 0
    const damagedPath = join(data.directory, "damaged.pdf")
    await writeFile(damagedPath, damagedPdf)
    await expect(
      registerFrSourceReviews(pool, stagedData.lease, { metadata, issuePdfPath: damagedPath })
    ).rejects.toThrow("fr_review_pdf_unreviewed")
    const lastReview = reviewed.reviews[2]
    invariant(lastReview, "review_fixture_missing")
    // If a later row conflicts, earlier new review rows in the same transaction must roll back.
    await pool.query("DELETE FROM legislation.regulatory_source_reviews WHERE generation_id=$1 AND record_key<>$2", [
      stagedData.id,
      lastReview.recordKey
    ])
    await pool.query("UPDATE legislation.regulatory_source_reviews SET evidence='{}' WHERE generation_id=$1", [
      stagedData.id
    ])
    await expect(registerFrSourceReviews(pool, stagedData.lease, { metadata, issuePdfPath })).rejects.toThrow(
      "fr_review_replay_conflict"
    )
    expect((await pool.query("SELECT count(*)::int AS n FROM legislation.regulatory_source_reviews")).rows[0].n).toBe(1)
    await pool.query(
      "UPDATE legislation.regulatory_source_documents SET evidence='{}' WHERE generation_id=$1 AND publisher_number='00-113'",
      [stagedData.id]
    )
    await expect(registerFrSourceInventory(pool, stagedData.lease, metadata)).rejects.toThrow(
      "fr_source_inventory_retention_incomplete"
    )
    await pool.query("UPDATE legislation.legal_rights_profiles SET is_active=false")
    expect((await resolveFrSourceNumber(pool, "2000-01-18", "00-113")).status).toBe("missing")
    await expect(registerFrSourceReviews(pool, stagedData.lease, { metadata, issuePdfPath })).rejects.toThrow(
      "rights_profile_unavailable"
    )
  }, 60_000)
  it("keeps source identity registration separate from existing publication and rejects partial staged inputs", async () => {
    const data = await frInput()
    const inventory = await registerFrSourceInventory(pool, data.lease, data.metadata)
    expect(inventory.sourceRecords).toBe(3)
    expect(await publishFrIssue(pool, data.lease, data)).toMatchObject({ publications: 3 })
    expect((await pool.query("SELECT count(*)::int AS n FROM legislation.regulatory_documents")).rows[0].n).toBe(3)
    await pool.query("DELETE FROM legislation.regulatory_source_documents WHERE generation_id=$1", [data.id])
    await pool.query("DELETE FROM legislation.legal_import_records WHERE generation_id=$1 AND ordinal=0", [data.id])
    await expect(registerFrSourceInventory(pool, data.lease, data.metadata)).rejects.toThrow(
      "fr_source_inventory_incomplete"
    )
  }, 60_000)
  it("refuses document-number publication when the source alias points to multiple identities", async () => {
    const data = await frInput()
    const inventory = await registerFrSourceInventory(pool, data.lease, data.metadata)
    const first = inventory.observations[0]
    const other = inventory.observations[1]
    invariant(first && other, "source_fixture_missing")
    // A second source identity claiming the same number must prevent all number-only publication.
    await pool.query(
      "UPDATE legislation.regulatory_source_documents SET publisher_number=$2 WHERE generation_id=$1 AND record_key=$3",
      [data.id, first.publisherNumber, other.recordKey]
    )
    await expect(publishFrIssue(pool, data.lease, data)).rejects.toThrow("fr_publisher_number_ambiguous")
    expect(
      (await pool.query("SELECT count(*)::int AS n FROM legislation.regulatory_document_versions")).rows[0].n
    ).toBe(0)
    expect(
      (await pool.query("SELECT count(*)::int AS n FROM legislation.regulatory_publication_batches")).rows[0].n
    ).toBe(0)
  }, 60_000)
  it("atomically publishes all 110 XML source identities with reviewed PDF regions and detects damaged replay", async () => {
    const data = await input({ fixture: "fr-2000-01-18.xml.gz" })
    const stagedData = await staged(data)
    await validateStagedRegulatoryImport(pool, stagedData.lease)
    const template = frMetadataPageSchema.parse(
      JSON.parse(await readFile(new URL("fr-2024-01-02-metadata.json", fixtures), "utf8"))
    ).results[0]
    invariant(template, "metadata_fixture_missing")
    const selected = [
      ...new Map(
        data.records.map((record) => {
          const number = record.identityBasis === "citation" ? "00-113" : record.nativeId
          return [
            number,
            frMetadataRecordSchema.parse({
              ...template,
              document_number: number,
              publication_date: "2000-01-18",
              title: record.heading.replace(/SO\s+2$/, "SO2"),
              volume: 65,
              start_page: 1,
              end_page: 1,
              type:
                number === "00-113"
                  ? "Rule"
                  : { final_rule: "Rule", notice: "Notice", proposed_rule: "Proposed Rule" }[
                      record.publicationKind ?? "notice"
                    ],
              pdf_url: `https://www.govinfo.gov/content/pkg/FR-2000-01-18/pdf/${number}.pdf`
            })
          ] as const
        })
      ).values()
    ]
    const metadata = await collectFrMetadata(
      { start: "2000-01-18", end: "2000-01-18", cutoff: "2026-09-14" },
      async (url) => {
        const body = JSON.stringify({ count: selected.length, total_pages: 1, next_page_url: null, results: selected })
        return {
          url,
          body,
          sha256: digest(body),
          bytes: Buffer.byteLength(body),
          contentType: "application/json",
          retrievedAt: "2026-09-14T00:00:00Z"
        }
      }
    )
    // Synthetic individual PDF evidence isolates database behavior. The reviewed issue PDF is the actual fixture;
    // production loadReviewedFrSourceIssue separately replays all real HTML/PDF bytes and inspections.
    const publications = metadata.records
      .filter((record) => record.document_number !== "00-113")
      .map((record) => {
        invariant(record.pdf_url, "missing_pdf_url")
        const pdfBytes = Buffer.from(record.document_number)
        const sha256 = digest(pdfBytes)
        const kind = {
          Rule: "Rules and Regulations",
          Notice: "Notices",
          "Proposed Rule": "Proposed Rules",
          "Presidential Document": "Presidential Documents"
        }[record.type]
        return normalizeFrHtmlPublication({
          metadataRecord: record,
          metadataManifestId: metadata.id,
          htmlBytes: Buffer.from(
            `<pre>[Federal Register Volume 65, Number 11 (Tuesday, January 18, 2000)]\n[${kind}]\n[Pages 1-1]\n[FR Doc No: ${record.document_number}]\n${record.title}\nSynthetic publication text.\n[FR Doc. ${record.document_number} Filed 1-14-00]</pre>`
          ),
          htmlSourceUrl: record.pdf_url.replace("/pdf/", "/html/").replace(".pdf", ".htm"),
          pdfBytes,
          pdfReceipt: {
            unit: {
              metadataManifestId: metadata.id,
              documentNumber: record.document_number,
              publicationDate: record.publication_date,
              sourceUrl: record.pdf_url
            },
            sha256,
            bytes: pdfBytes.length,
            acquiredAt: "2026-09-14T00:00:00Z",
            contentType: "application/pdf",
            etag: null,
            lastModified: null,
            status: "acquired",
            structuralValidation: "pending"
          },
          pdfInspection: {
            contract: frPdfValidationContract,
            artifactHash: sha256,
            bytes: pdfBytes.length,
            parserVersion: "synthetic-database-test",
            pages: 1,
            textHash: digest("text"),
            textCharacters: 10,
            emptyTextPages: [],
            documentNumberFound: true,
            parserChecks: "all_pages_text_and_operators",
            renderingChecked: false
          }
        })
      })
    const issuePdf = fileURLToPath(new URL("fr-2000-01-18.pdf", fixtures))
    const regions = await stageReviewedFrPdfRegions(issuePdf, join(data.directory, "regions"))
    const loaded = {
      issuePdf,
      issueRetainedAt: "2026-09-15T00:00:00Z",
      regions: regions.artifact,
      html: {
        metadata,
        publications,
        artifacts: publications.map((row) => ({
          hash: row.supportingPdf.receipt.sha256,
          bytes: row.supportingPdf.receipt.bytes,
          locator: "synthetic-test-pdf",
          acquiredAt: row.supportingPdf.receipt.acquiredAt
        })),
        date: "2000-01-18",
        quarantine: [],
        coverage: { metadataExpected: 109, verified: 108, quarantined: 1, issueInventoryVerified: false },
        bytes: 100,
        normalizerHash: digest("synthetic-database-test")
      }
    }
    await pool.query(
      "ALTER TABLE legislation.regulatory_publication_outbox ADD CONSTRAINT injected_source_failure CHECK(operation <> 'lexical')"
    )
    try {
      await expect(publishReviewedFrSourceIssue(pool, stagedData.lease, loaded)).rejects.toThrow(
        "injected_source_failure"
      )
      expect(
        (await pool.query("SELECT count(*)::int AS n FROM legislation.regulatory_document_versions")).rows[0].n
      ).toBe(0)
      expect(
        (await pool.query("SELECT count(*)::int AS n FROM legislation.regulatory_source_renditions")).rows[0].n
      ).toBe(0)
    } finally {
      await pool.query("ALTER TABLE legislation.regulatory_publication_outbox DROP CONSTRAINT injected_source_failure")
    }
    await expect(
      publishReviewedFrSourceIssue(pool, stagedData.lease, {
        ...loaded,
        html: { ...loaded.html, publications: publications.slice(1) }
      })
    ).rejects.toThrow("unresolved")
    expect(await publishReviewedFrSourceIssue(pool, stagedData.lease, loaded)).toMatchObject({
      reused: false,
      coverage: { sourceRecords: 110, publications: 110, documentPdfs: 107, reviewedIssuePdfs: 3, unresolved: 0 }
    })
    const rows = (
      await pool.query(`SELECT d.native_number,v.publication_kind,v.body FROM legislation.regulatory_documents d
      JOIN legislation.regulatory_document_versions v ON v.document_id=d.id WHERE d.identity_namespace='federal-register-citation' ORDER BY d.native_number`)
    ).rows
    expect(rows).toHaveLength(2)
    expect(rows[0].body).toContain("Hobbs")
    expect(rows[0].body).not.toContain("Seretha Lake")
    expect(rows[1].body).toContain("Seretha Lake")
    expect(rows[1].publication_kind).toBe("notice")
    expect(await publishReviewedFrSourceIssue(pool, stagedData.lease, loaded)).toMatchObject({ reused: true })
    expect(
      (await pool.query("SELECT count(*)::int AS n FROM legislation.regulatory_publication_outbox")).rows[0].n
    ).toBe(110)
    await pool.query(
      "UPDATE legislation.regulatory_document_versions SET body='corrupted' WHERE id=(SELECT id FROM legislation.regulatory_document_versions LIMIT 1)"
    )
    await expect(publishReviewedFrSourceIssue(pool, stagedData.lease, loaded)).rejects.toThrow("replay_incomplete")
    await pool.query("UPDATE legislation.legal_rights_profiles SET is_active=false")
    await expect(publishReviewedFrSourceIssue(pool, stagedData.lease, loaded)).rejects.toThrow(
      "rights_profile_unavailable"
    )
  }, 90000)

  async function frInput() {
    const data = await input({ fixture: "fr-2024-01-02-excerpt.xml" })
    const all = frMetadataPageSchema.parse(
      JSON.parse(await readFile(new URL("fr-2024-01-02-metadata.json", fixtures), "utf8"))
    )
    const selected = all.results.filter((record) => data.records.some((row) => row.nativeId === record.document_number))
    const metadata = await collectFrMetadata(
      { start: "2024-01-02", end: "2024-01-02", cutoff: "2026-09-14" },
      async (url) => {
        const body = JSON.stringify({ count: selected.length, total_pages: 1, next_page_url: null, results: selected })
        return {
          url,
          body,
          sha256: digest(body),
          bytes: Buffer.byteLength(body),
          contentType: "application/json",
          retrievedAt: "2026-09-14T00:00:00Z"
        }
      }
    )
    // Synthetic parsed-rendition evidence isolates database behavior; actual PDF parsing has separate tests/live validation.
    const renditions = selected.map((record) => ({
      receipt: {
        unit: {
          metadataManifestId: metadata.id,
          documentNumber: record.document_number,
          publicationDate: record.publication_date,
          sourceUrl: record.pdf_url
        },
        sha256: digest(record.document_number),
        bytes: 100,
        acquiredAt: "2026-09-14T00:00:00Z",
        contentType: "application/pdf",
        etag: null,
        lastModified: null,
        status: "acquired",
        structuralValidation: "pending"
      },
      inspection: {
        contract: frPdfValidationContract,
        artifactHash: digest(record.document_number),
        bytes: 100,
        parserVersion: "synthetic-database-test",
        pages: record.end_page - record.start_page + 1,
        textHash: digest("text"),
        textCharacters: 10,
        emptyTextPages: [],
        documentNumberFound: true,
        parserChecks: "all_pages_text_and_operators",
        renderingChecked: false
      },
      storageLocator: "synthetic-test-artifact"
    }))
    const stagedData = await staged(data)
    expect(await validateStagedRegulatoryImport(pool, stagedData.lease)).toBe("blocked")
    return { ...stagedData, metadata, renditions }
  }
  async function htmlInput() {
    const source = await frInput()
    const artifacts: { hash: string; bytes: number; locator: string; acquiredAt: string }[] = []
    const publications = source.metadata.records.map((record, index) => {
      const rendition = source.renditions[index]
      invariant(rendition && record.pdf_url, "missing_html_test_rendition")
      // Synthetic artifact evidence isolates storage behavior; live CLI smoke revalidates actual PDFs.
      const pdfBytes = Buffer.from(record.document_number)
      const sha256 = digest(pdfBytes)
      const kind = {
        Rule: "Rules and Regulations",
        "Proposed Rule": "Proposed Rules",
        Notice: "Notices",
        "Presidential Document": "Presidential Documents"
      }[record.type]
      const htmlBytes = Buffer.from(
        `<pre>[Federal Register Volume ${record.volume}, Number 1 (Tuesday, January 2, 2024)]\n[${kind}]\n[Pages ${record.start_page}-${record.end_page}]\n[FR Doc No: ${record.document_number}]\n${record.title}\nSynthetic publication text.\n[FR Doc. ${record.document_number} Filed 1-1-24]</pre>`
      )
      const publication = normalizeFrHtmlPublication({
        metadataRecord: record,
        metadataManifestId: source.metadata.id,
        htmlBytes,
        htmlSourceUrl: record.pdf_url.replace("/pdf/", "/html/").replace(".pdf", ".htm"),
        pdfBytes,
        pdfReceipt: { ...rendition.receipt, sha256, bytes: pdfBytes.length },
        pdfInspection: { ...rendition.inspection, artifactHash: sha256, bytes: pdfBytes.length }
      })
      artifacts.push(
        {
          hash: digest(htmlBytes),
          bytes: htmlBytes.length,
          locator: `synthetic:${record.document_number}.htm`,
          acquiredAt: "2026-09-14T00:00:00Z"
        },
        {
          hash: sha256,
          bytes: pdfBytes.length,
          locator: `synthetic:${record.document_number}.pdf`,
          acquiredAt: "2026-09-14T00:00:00Z"
        }
      )
      return publication
    })
    return {
      metadata: source.metadata,
      artifacts,
      date: "2024-01-02",
      publications,
      quarantine: [],
      coverage: {
        metadataExpected: publications.length,
        verified: publications.length,
        quarantined: 0,
        issueInventoryVerified: false
      },
      bytes: Buffer.byteLength(JSON.stringify(publications)),
      normalizerHash: digest("synthetic normalizer")
    }
  }
  it("registers and stages format-aware HTML sets with stable replay and no canonical writes", async () => {
    const data = await htmlInput()
    const artifact = {
      body: frHtmlImportArtifact(data),
      locator: "synthetic:html-input",
      acquiredAt: "2026-09-14T00:00:00Z"
    }
    const registered = await registerFrHtmlImport(pool, data, artifact)
    expect(await registerFrHtmlImport(pool, data, artifact)).toEqual(registered)
    const lease = await claimRegulatoryLease(pool, registered.generationId)
    expect(await stageFrHtmlImport(pool, lease, data)).toMatchObject({
      records: 3,
      state: "validated",
      published: false
    })
    expect(await stageFrHtmlImport(pool, lease, data)).toMatchObject({ records: 3 })
    expect(
      (await pool.query("SELECT count(*)::int AS count FROM legislation.regulatory_documents")).rows[0].count
    ).toBe(0)
    await expect(withLease(pool, lease, async () => "invalid XML dispatch")).rejects.toBeInstanceOf(z.ZodError)
    const changed = { ...data, publications: data.publications.slice(1) }
    await expect(stageFrHtmlImport(pool, lease, changed)).rejects.toThrow("coverage_mismatch")
    await pool.query("UPDATE legislation.legal_rights_profiles SET is_active=false")
    await expect(stageFrHtmlImport(pool, lease, data)).rejects.toThrow("rights_profile_unavailable")
  })
  async function stagedHtml() {
    const data = await htmlInput()
    const registration = await registerFrHtmlImport(pool, data, {
      body: frHtmlImportArtifact(data),
      locator: "synthetic:html-input",
      acquiredAt: "2026-09-14T00:00:00Z"
    })
    const lease = await claimRegulatoryLease(pool, registration.generationId)
    await stageFrHtmlImport(pool, lease, data)
    return { data, lease }
  }
  it.each([1, 3])(
    "persists %i quarantined records and publishes only the verified partition with stable replay",
    async (quarantined) => {
      const all = await htmlInput()
      const rejected = all.publications[0]
      invariant(rejected, "missing_quarantine_fixture")
      const data = {
        ...all,
        publications: all.publications.slice(quarantined),
        coverage: { metadataExpected: 3, verified: 3 - quarantined, quarantined, issueInventoryVerified: false },
        quarantine: all.publications.slice(0, quarantined).map((rejected) => ({
          documentNumber: rejected.nativeNumber,
          reason: "fr_html_subject_mismatch",
          metadataHash: rejected.metadataHash,
          htmlHash: rejected.textVersion.artifactHash,
          pdfHash: rejected.supportingPdf.receipt.sha256,
          sourceUrl: rejected.textVersion.sourceUrl
        }))
      }
      expect(() => frHtmlImportArtifact({ ...data, quarantine: [] })).toThrow("coverage_mismatch")
      expect(() => frHtmlImportArtifact({ ...data, artifacts: [] })).toThrow("quarantine_evidence_missing")
      const registered = await registerFrHtmlImport(pool, data, {
        body: frHtmlImportArtifact(data),
        locator: "synthetic:quarantine-set",
        acquiredAt: "2026-09-15T00:00:00Z"
      })
      const summary = await pool.query("SELECT summary FROM legislation.legal_import_generations WHERE id=$1", [
        registered.generationId
      ])
      expect(summary.rows[0].summary).toMatchObject({ quarantine: data.quarantine, coverage: data.coverage })
      const lease = await claimRegulatoryLease(pool, registered.generationId)
      await stageFrHtmlImport(pool, lease, data)
      expect(await publishFrHtmlImport(pool, lease, data)).toMatchObject({
        publications: 3 - quarantined,
        reused: false
      })
      expect(await publishFrHtmlImport(pool, lease, data)).toMatchObject({
        publications: 3 - quarantined,
        reused: true
      })
      const batch = await pool.query(
        "SELECT reconciliation FROM legislation.regulatory_publication_batches WHERE generation_id=$1",
        [registered.generationId]
      )
      expect(batch.rows[0].reconciliation).toMatchObject({ quarantine: data.quarantine, coverage: data.coverage })
      expect(
        (await pool.query("SELECT count(*)::int AS n FROM legislation.regulatory_publication_outbox")).rows[0].n
      ).toBe(3 - quarantined)
      expect(
        (
          await pool.query("SELECT count(*)::int AS n FROM legislation.regulatory_documents WHERE native_number=$1", [
            rejected.nativeNumber
          ])
        ).rows[0].n
      ).toBe(0)
    }
  )
  it("publishes HTML into canonical documents with raw artifact attachment and stable replay", async () => {
    const { data, lease } = await stagedHtml()
    expect(await publishFrHtmlImport(pool, lease, data)).toMatchObject({ publications: 3, reused: false })
    const first = await pool.query(
      "SELECT id,document_id,version_id FROM legislation.regulatory_document_observations ORDER BY id"
    )
    expect(await publishFrHtmlImport(pool, lease, data)).toMatchObject({ publications: 3, reused: true })
    expect(
      (
        await pool.query(
          "SELECT id,document_id,version_id FROM legislation.regulatory_document_observations ORDER BY id"
        )
      ).rows
    ).toEqual(first.rows)
    expect(
      (await pool.query("SELECT count(*)::int AS n FROM legislation.regulatory_publication_outbox")).rows[0].n
    ).toBe(3)
    const versions = await pool.query<{ body: string; blocks: unknown; heading: string; input_contract: string }>(
      "SELECT body,blocks,heading,input_contract FROM legislation.regulatory_document_versions ORDER BY body"
    )
    expect(
      versions.rows.every((row) => row.heading === "" && row.input_contract === "fr-html-publication-2026-09-14")
    ).toBe(true)
    expect(versions.rows.map((row) => row.body).sort()).toEqual(
      data.publications.map((row) => row.textVersion.text).sort()
    )
    expect(
      (
        await pool.query("SELECT count(*)::int AS n FROM legislation.legal_artifacts WHERE hash=ANY($1::text[])", [
          data.artifacts.map((artifact) => artifact.hash)
        ])
      ).rows[0].n
    ).toBe(data.artifacts.length)
  })
  it("stores publication passages separately and refuses another observation's version", async () => {
    const { data, lease } = await stagedHtml()
    await publishFrHtmlImport(pool, lease, data)
    const observations = await pool.query(
      "SELECT id,version_id FROM legislation.regulatory_document_observations ORDER BY id"
    )
    const scope = {
      kind: "publication" as const,
      versionId: z.uuid().parse(observations.rows[0]?.version_id),
      observationId: z.uuid().parse(observations.rows[0]?.id)
    }
    const result = await materializeLegalPassages(pool, {
      scope,
      model: "openai/text-embedding-3-small",
      context: "Federal Register notice"
    })
    expect(
      await searchLegalPassages(pool, { scope, generationId: result.generationId, query: "Synthetic" })
    ).toHaveLength(1)
    await expect(
      searchLegalPassages(pool, {
        scope: { ...scope, observationId: z.uuid().parse(observations.rows[1]?.id) },
        generationId: result.generationId,
        query: "Synthetic"
      })
    ).rejects.toThrow("legal_passage_source_unavailable")
    expect(
      (
        await pool.query(
          "SELECT count(*)::integer AS count FROM legislation.regulatory_publication_outbox WHERE state='pending'"
        )
      ).rows[0]?.count
    ).toBe(3)
    expect(
      await runLegalPassagePreparationBatch(pool, {
        scope: { kind: "publication", id: scope.observationId },
        model: "openai/text-embedding-3-small"
      })
    ).toMatchObject({ state: "prepared", total: 1, complete: 1 })
  })
  it("rolls back HTML publication while retaining acquired evidence when outbox insertion fails", async () => {
    const { data, lease } = await stagedHtml()
    await pool.query(
      "ALTER TABLE legislation.regulatory_publication_outbox ADD CONSTRAINT html_injected_failure CHECK(operation <> 'lexical')"
    )
    try {
      await expect(publishFrHtmlImport(pool, lease, data)).rejects.toThrow("html_injected_failure")
      expect((await pool.query("SELECT count(*)::int AS n FROM legislation.regulatory_documents")).rows[0].n).toBe(0)
      expect(
        (await pool.query("SELECT count(*)::int AS n FROM legislation.regulatory_publication_batches")).rows[0].n
      ).toBe(0)
      expect(
        (
          await pool.query("SELECT count(*)::int AS n FROM legislation.legal_artifacts WHERE hash=ANY($1::text[])", [
            data.artifacts.map((artifact) => artifact.hash)
          ])
        ).rows[0].n
      ).toBe(data.artifacts.length)
    } finally {
      await pool.query("ALTER TABLE legislation.regulatory_publication_outbox DROP CONSTRAINT html_injected_failure")
    }
    expect(await publishFrHtmlImport(pool, lease, data)).toMatchObject({ publications: 3 })
  })
  it("rejects modified staged HTML, missing raw evidence and revoked rights", async () => {
    const { data, lease } = await stagedHtml()
    await expect(publishFrHtmlImport(pool, lease, { ...data, artifacts: [] })).rejects.toThrow("artifact_missing")
    await pool.query(
      "UPDATE legislation.legal_import_records SET payload=jsonb_set(payload,'{textVersion,text}','\"changed\"'::jsonb) WHERE generation_id=$1",
      [lease.generationId]
    )
    await expect(publishFrHtmlImport(pool, lease, data)).rejects.toThrow("staging_mismatch")
    await pool.query("UPDATE legislation.legal_rights_profiles SET is_active=false")
    await expect(publishFrHtmlImport(pool, lease, data)).rejects.toThrow("rights_profile_unavailable")
    expect((await pool.query("SELECT count(*)::int AS n FROM legislation.regulatory_documents")).rows[0].n).toBe(0)
  })

  it("publishes reconciled FR records atomically and replays stable document/version IDs", async () => {
    const data = await frInput()
    expect(await publishFrIssue(pool, data.lease, data)).toMatchObject({ publications: 3, reused: false })
    const first = await pool.query(
      "SELECT id,document_id,version_id FROM legislation.regulatory_document_observations ORDER BY id"
    )
    expect(await publishFrIssue(pool, data.lease, data)).toMatchObject({ publications: 3, reused: true })
    expect(
      (
        await pool.query(
          "SELECT id,document_id,version_id FROM legislation.regulatory_document_observations ORDER BY id"
        )
      ).rows
    ).toEqual(first.rows)
    expect(
      (await pool.query("SELECT count(*)::int AS n FROM legislation.regulatory_publication_outbox")).rows[0].n
    ).toBe(3)
    expect(
      (
        await pool.query(
          "SELECT metadata->>'correction_of' AS target FROM legislation.regulatory_document_observations WHERE metadata->>'document_number'='C1-2023-27742'"
        )
      ).rows[0].target
    ).toContain("2023-27742")
  })

  it("rejects missing or mismatched PDF evidence before exposing any FR publication", async () => {
    const data = await frInput()
    await expect(publishFrIssue(pool, data.lease, { ...data, renditions: data.renditions.slice(1) })).rejects.toThrow(
      "rendition_count_mismatch"
    )
    await expect(
      publishFrIssue(pool, data.lease, {
        ...data,
        renditions: data.renditions.map((r) => ({ ...r, inspection: { ...r.inspection, documentNumberFound: false } }))
      })
    ).rejects.toThrow("identity_unconfirmed")
    expect((await pool.query("SELECT count(*)::int AS n FROM legislation.regulatory_documents")).rows[0].n).toBe(0)
  })

  it("rolls back all FR visibility when derived work fails and recovers on retry", async () => {
    const data = await frInput()
    await pool.query(
      "ALTER TABLE legislation.regulatory_publication_outbox ADD CONSTRAINT injected_failure CHECK(operation <> 'lexical')"
    )
    try {
      await expect(publishFrIssue(pool, data.lease, data)).rejects.toThrow("injected_failure")
      expect((await pool.query("SELECT count(*)::int AS n FROM legislation.regulatory_documents")).rows[0].n).toBe(0)
      expect(
        (await pool.query("SELECT count(*)::int AS n FROM legislation.regulatory_publication_batches")).rows[0].n
      ).toBe(0)
    } finally {
      await pool.query("ALTER TABLE legislation.regulatory_publication_outbox DROP CONSTRAINT injected_failure")
    }
    expect(await publishFrIssue(pool, data.lease, data)).toMatchObject({ publications: 3 })
  })

  it("blocks FR publication under revoked rights or an expired lease", async () => {
    const data = await frInput()
    await pool.query("UPDATE legislation.legal_rights_profiles SET is_active=false")
    await expect(publishFrIssue(pool, data.lease, data)).rejects.toThrow("rights_profile_unavailable")
    await pool.query("UPDATE legislation.legal_rights_profiles SET is_active=true")
    await pool.query(
      "UPDATE legislation.legal_import_generations SET lease_expires_at=clock_timestamp()-interval '1 second'"
    )
    await expect(publishFrIssue(pool, data.lease, data)).rejects.toThrow("lease_lost")
    expect((await pool.query("SELECT count(*)::int AS n FROM legislation.regulatory_documents")).rows[0].n).toBe(0)
  })

  it("replays the real parser-to-database path without duplicate versions or outbox work", async () => {
    const data = await input()
    const first = await importNormalizedRegulatoryUnit(pool, data)
    const second = await importNormalizedRegulatoryUnit(pool, data)
    expect(first).toMatchObject({ state: "published", isCurrent: true, reused: false })
    expect(second).toMatchObject({ generationId: first.generationId, state: "published", reused: true })
    expect(await counts()).toEqual({ provisions: 3, versions: 3, memberships: 3, heads: 1, outbox: 1 })
    expect((await pool.query("SELECT operation FROM legislation.legal_derived_outbox")).rows).toEqual([
      { operation: "lexical" }
    ])
  })

  it(
    "verifies every canonical record and reuses older-parser publication through a read-only dispatch connection",
    { timeout: 30_000 },
    async () => {
      const data = await input({
        body: Array.from(
          { length: 205 },
          (_, index) =>
            `<DIV8 N="1.${index}" TYPE="SECTION"><HEAD>Section ${index}</HEAD><P>Exact retained content ${index}.</P></DIV8>`
        ).join("")
      })
      const older = await materialized({
        ...data,
        summary: { ...data.summary, parserCodeHash: digest("older parser") }
      })
      await publishRegulatoryEdition(pool, older.lease, null)
      await releaseRegulatoryLease(pool, older.lease)
      const before = await counts()
      const generationBefore = (
        await pool.query("SELECT id,fence,state,lease_token FROM legislation.legal_import_generations")
      ).rows
      const readonly = new pg.Pool({
        connectionString: databaseUrl,
        max: 1,
        options: "-c default_transaction_read_only=on"
      })
      try {
        const inspection = await inspectCanonicalRegulatoryReuse(readonly, {
          unit: data.receipt.unit,
          artifactHash: data.receipt.sha256,
          directory: data.directory,
          parserCodeHash: data.parserCodeHash
        })
        expect(inspection).toMatchObject({
          status: "verified",
          checkedRecords: 206,
          mismatchedRecords: 0,
          generationId: older.id,
          isCurrent: true,
          canonicalWrites: false
        })
        // A newly frozen outer inventory does not change the retained acquisition identity.
        const sourceInventory = data.manifest.inventory[0]
        invariant(sourceInventory, "missing_inventory")
        const body = JSON.stringify({ fixture: "new enclosing inventory" })
        const inventory = { ...sourceInventory, body, sha256: digest(body), bytes: Buffer.byteLength(body) }
        const manifest = {
          ...data.manifest,
          inventory: [inventory],
          units: [{ ...data.receipt.unit, inventoryHash: inventory.sha256 }]
        }
        manifest.id = manifestIdentity(manifest)
        expect(await importNormalizedRegulatoryUnit(readonly, { ...data, manifest, reuseOnly: true })).toMatchObject({
          generationId: older.id,
          editionId: older.editionId,
          state: "published",
          reused: true
        })
      } finally {
        await readonly.end()
      }
      expect(await counts()).toEqual(before)
      expect(
        (await pool.query("SELECT id,fence,state,lease_token FROM legislation.legal_import_generations")).rows
      ).toEqual(generationBefore)
      expect((await pool.query("SELECT count(*)::int AS n FROM legislation.legal_import_manifests")).rows[0].n).toBe(1)
    }
  )

  it.each([
    [
      "text",
      "UPDATE legislation.legal_provision_versions SET body='corrupted' WHERE id=(SELECT version_id FROM legislation.legal_edition_provisions WHERE ordinal=1)"
    ],
    [
      "blocks",
      "UPDATE legislation.legal_provision_versions SET blocks='[]'::jsonb WHERE id=(SELECT version_id FROM legislation.legal_edition_provisions WHERE ordinal=1)"
    ],
    [
      "staged payload",
      "UPDATE legislation.legal_import_records SET payload=jsonb_set(payload,'{heading}','\"corrupted\"') WHERE ordinal=1"
    ],
    ["staged hash", "UPDATE legislation.legal_import_records SET record_hash=repeat('0',64) WHERE ordinal=1"],
    ["native identity", "UPDATE legislation.legal_edition_provisions SET native_id='corrupted' WHERE ordinal=1"],
    ["hierarchy", "UPDATE legislation.legal_edition_provisions SET parent_id=NULL WHERE ordinal=1"]
  ])("refuses canonical reuse after %s corruption without creating replacement work", async (_name, sql) => {
    const data = await input()
    await importNormalizedRegulatoryUnit(pool, data)
    await pool.query(sql)
    const before = await counts()
    const inspection = await inspectCanonicalRegulatoryReuse(pool, {
      unit: data.receipt.unit,
      artifactHash: data.receipt.sha256,
      directory: data.directory,
      parserCodeHash: data.parserCodeHash
    })
    expect(inspection).toMatchObject({ status: "invalid", checkedRecords: 3, mismatchedRecords: 1 })
    await expect(importNormalizedRegulatoryUnit(pool, { ...data, reuseOnly: true })).rejects.toThrow(
      "canonical_reuse_content_mismatch"
    )
    expect(await counts()).toEqual(before)
    expect((await pool.query("SELECT count(*)::int AS n FROM legislation.legal_import_generations")).rows[0].n).toBe(1)
  })

  it.each([
    ["DELETE FROM legislation.legal_edition_provisions WHERE ordinal=2", "canonical_record_count_mismatch"],
    ["UPDATE legislation.legal_editions SET currency_date='2020-01-01'", "canonical_edition_metadata_or_head_mismatch"],
    ["DELETE FROM legislation.legal_code_heads", "canonical_edition_metadata_or_head_mismatch"],
    ["UPDATE legislation.legal_rights_profiles SET is_active=false", "rights_profile_unavailable"],
    [
      "UPDATE legislation.legal_import_generations SET summary=jsonb_set(summary,'{sourceElements}','999999')",
      "canonical_source_summary_mismatch"
    ]
  ])("rejects damaged canonical completeness or metadata: %s", async (sql, reason) => {
    const data = await input()
    await importNormalizedRegulatoryUnit(pool, data)
    await pool.query(sql)
    await expect(importNormalizedRegulatoryUnit(pool, { ...data, reuseOnly: true })).rejects.toThrow(reason)
    expect((await pool.query("SELECT count(*)::int AS n FROM legislation.legal_import_generations")).rows[0].n).toBe(1)
  })

  it("does not dispatch missing reuse-only units or inspect a publication held by an active writer", async () => {
    const data = await input()
    await expect(importNormalizedRegulatoryUnit(pool, { ...data, reuseOnly: true })).rejects.toThrow(
      "canonical_reuse_required"
    )
    expect((await pool.query("SELECT count(*)::int AS n FROM legislation.legal_import_generations")).rows[0].n).toBe(0)
    const imported = await importNormalizedRegulatoryUnit(pool, data)
    const lease = await claimRegulatoryLease(pool, imported.generationId)
    await expect(importNormalizedRegulatoryUnit(pool, { ...data, reuseOnly: true })).rejects.toThrow(
      "canonical_generation_busy"
    )
    await releaseRegulatoryLease(pool, lease)
  })

  it("resumes interrupted staging and enforces complete parent membership before publication", async () => {
    const data = await input()
    const id = await registerRegulatoryImport(pool, data)
    const lease = await claimRegulatoryLease(pool, id)
    await stageRegulatoryRecords(pool, lease, data.records.slice(0, 1))
    await expect(validateStagedRegulatoryImport(pool, lease)).rejects.toThrow("staging_incomplete")
    await expect(publishRegulatoryEdition(pool, lease, null)).rejects.toThrow("not_materialized")
    await releaseRegulatoryLease(pool, lease)
    const resumed = await claimRegulatoryLease(pool, id)
    expect(resumed.fence).toBeGreaterThan(lease.fence)
    await stageRegulatoryRecords(pool, resumed, data.records)
    await validateStagedRegulatoryImport(pool, resumed)
    await materializeRegulatoryEdition(pool, resumed)
    expect(await publishRegulatoryEdition(pool, resumed, null)).toMatchObject({ isCurrent: true })
  })

  it("rolls back an entire staging batch on an immutable-record conflict", async () => {
    const data = await input()
    const id = await registerRegulatoryImport(pool, data)
    const lease = await claimRegulatoryLease(pool, id)
    const original = data.records[0]
    const later = data.records[1]
    invariant(original && later, "missing_record")
    await stageRegulatoryRecords(pool, lease, [original])
    const changed = { ...original, text: "Changed", textHash: digest("Changed") }
    await expect(stageRegulatoryRecords(pool, lease, [later, changed])).rejects.toThrow("staged_record_conflict")
    expect(
      (await pool.query("SELECT count(*)::int AS count FROM legislation.legal_import_records")).rows[0].count
    ).toBe(1)
    await expect(stageRegulatoryRecords(pool, lease, [original, original])).rejects.toThrow("duplicate_batch_record")
  })

  it("permits one lease claimant and rejects an expired worker even after materialization", async () => {
    const data = await input()
    const id = await registerRegulatoryImport(pool, data)
    const races = await Promise.allSettled([claimRegulatoryLease(pool, id), claimRegulatoryLease(pool, id)])
    expect(races.filter((item) => item.status === "fulfilled")).toHaveLength(1)
    const winner = races.find((item) => item.status === "fulfilled")
    invariant(winner?.status === "fulfilled", "no_winner")
    await stageRegulatoryRecords(pool, winner.value, data.records)
    await validateStagedRegulatoryImport(pool, winner.value)
    await materializeRegulatoryEdition(pool, winner.value)
    await pool.query(
      "UPDATE legislation.legal_import_generations SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",
      [id]
    )
    const replacement = await claimRegulatoryLease(pool, id)
    await releaseRegulatoryLease(pool, winner.value)
    await expect(publishRegulatoryEdition(pool, winner.value, null)).rejects.toThrow("lease_lost")
    expect(await publishRegulatoryEdition(pool, replacement, null)).toMatchObject({ isCurrent: true })
  })

  it("keeps a prior edition visible when a new edition has a missing canonical child", async () => {
    const first = await materialized(await input())
    await publishRegulatoryEdition(pool, first.lease, null)
    const next = await materialized(await input({ date: "2026-02-01" }))
    await pool.query("DELETE FROM legislation.legal_edition_provisions WHERE edition_id=$1 AND ordinal=2", [
      next.editionId
    ])
    await expect(publishRegulatoryEdition(pool, next.lease, first.editionId)).rejects.toThrow("edition_incomplete")
    expect((await pool.query("SELECT edition_id FROM legislation.legal_code_heads")).rows).toEqual([
      { edition_id: first.editionId }
    ])
    expect((await counts()).outbox).toBe(1)
  })

  it("reuses unchanged versions, preserves removed historical sections, and prevents older imports replacing the head", async () => {
    const first = await materialized(await input({ date: "2026-02-01" }))
    await publishRegulatoryEdition(pool, first.lease, null)
    const newer = await materialized(
      await input({
        date: "2026-03-01",
        body: '<DIV8 N="1.1" TYPE="SECTION"><HEAD>First</HEAD><P>Changed text</P></DIV8>'
      })
    )
    await publishRegulatoryEdition(pool, newer.lease, first.editionId)
    const older = await materialized(await input({ date: "2026-01-01" }))
    expect(await publishRegulatoryEdition(pool, older.lease, newer.editionId)).toMatchObject({ isCurrent: false })
    expect(await counts()).toEqual({ provisions: 3, versions: 4, memberships: 8, heads: 1, outbox: 3 })
    expect((await pool.query("SELECT edition_id FROM legislation.legal_code_heads")).rows).toEqual([
      { edition_id: newer.editionId }
    ])
    const historical = await pool.query(
      `SELECT v.body FROM legislation.legal_edition_provisions m JOIN legislation.legal_provision_versions v ON v.id=m.version_id
      WHERE m.edition_id=$1 AND m.native_id='cfr:1:section:1.2'`,
      [first.editionId]
    )
    expect(historical.rows[0].body).toContain("Unchanged")
  })

  it("keeps provision identity and text version when its parent changes", async () => {
    const first = await materialized(await input())
    await publishRegulatoryEdition(pool, first.lease, null)
    const newer = await materialized(
      await input({
        date: "2026-02-01",
        body: '<DIV3 N="I" TYPE="CHAPTER"><HEAD>Chapter I</HEAD><DIV8 N="1.1" TYPE="SECTION"><HEAD>First</HEAD><P>Original text</P></DIV8></DIV3>'
      })
    )
    await publishRegulatoryEdition(pool, newer.lease, first.editionId)
    const versions =
      await pool.query(`SELECT provision_id,version_id,parent_id FROM legislation.legal_edition_provisions
      WHERE native_id='cfr:1:section:1.1' ORDER BY edition_id`)
    expect(new Set(versions.rows.map((row) => row.provision_id)).size).toBe(1)
    expect(new Set(versions.rows.map((row) => row.version_id)).size).toBe(1)
    expect(new Set(versions.rows.map((row) => row.parent_id)).size).toBe(2)
  })

  it("rejects stale compare-and-swap and same-date corrections without source precedence", async () => {
    const first = await materialized(await input())
    await publishRegulatoryEdition(pool, first.lease, null)
    const correction = await materialized(
      await input({ body: '<DIV8 N="1.1" TYPE="SECTION"><P>Correction</P></DIV8>' })
    )
    await expect(publishRegulatoryEdition(pool, correction.lease, null)).rejects.toThrow("compare_and_swap")
    await expect(publishRegulatoryEdition(pool, correction.lease, first.editionId)).rejects.toThrow(
      "precedence_unresolved"
    )
    expect((await counts()).outbox).toBe(1)
  })

  it("fails closed when source rights are withdrawn between staging and publication", async () => {
    const result = await materialized(await input())
    await pool.query("UPDATE legislation.legal_rights_profiles SET is_active=false")
    await expect(publishRegulatoryEdition(pool, result.lease, null)).rejects.toThrow("rights_profile_unavailable")
    expect(await counts()).toMatchObject({ heads: 0, outbox: 0 })
  })

  it.each([
    ["cfr-2024-title1-excerpt.xml", "source_date_review_required"],
    ["fr-2024-01-02-excerpt.xml", "corpus_publication_contract_pending"]
  ])("retains %s in staging with an explicit publication blocker", async (fixture, reason) => {
    const data = await input({ fixture })
    const result = await importNormalizedRegulatoryUnit(pool, data)
    expect(result).toMatchObject({ state: "blocked", reason })
    expect(await importNormalizedRegulatoryUnit(pool, data)).toMatchObject({ state: "blocked", reused: true, reason })
    expect(await counts()).toEqual({ provisions: 0, versions: 0, memberships: 0, heads: 0, outbox: 0 })
  })

  it("materializes a hierarchy across bounded transaction boundaries", async () => {
    const body = Array.from(
      { length: 205 },
      (_, i) => `<DIV8 N="1.${i}" TYPE="SECTION"><P>Section ${i}</P></DIV8>`
    ).join("")
    const data = await input({ body })
    const result = await importNormalizedRegulatoryUnit(pool, data)
    expect(result).toMatchObject({ state: "published" })
    expect(await counts()).toEqual({ provisions: 206, versions: 206, memberships: 206, heads: 1, outbox: 1 })
  })

  it.each(["outbox_failure", "lease_expiry"])("rolls back publication on %s after the head write", async (fault) => {
    const result = await materialized(await input())
    const injected =
      fault === "outbox_failure"
        ? "RAISE EXCEPTION 'synthetic_outbox_failure';"
        : "UPDATE legislation.legal_import_generations SET lease_expires_at=clock_timestamp()-interval '1 second'; RETURN NEW;"
    // Fixed test-only SQL in a verified disposable database; no source strings are interpolated.
    await pool.query(
      `CREATE FUNCTION legislation.regulatory_storage_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN ${injected} END $$`
    )
    await pool.query(`CREATE TRIGGER regulatory_storage_fault BEFORE INSERT ON legislation.legal_derived_outbox
      FOR EACH ROW EXECUTE FUNCTION legislation.regulatory_storage_fault()`)
    try {
      await expect(publishRegulatoryEdition(pool, result.lease, null)).rejects.toThrow(
        fault === "outbox_failure" ? "synthetic_outbox_failure" : "lease_lost"
      )
      expect(await counts()).toMatchObject({ heads: 0, outbox: 0 })
      expect((await pool.query("SELECT published_at FROM legislation.legal_editions")).rows).toEqual([
        { published_at: null }
      ])
    } finally {
      await pool.query("DROP TRIGGER regulatory_storage_fault ON legislation.legal_derived_outbox")
      await pool.query("DROP FUNCTION legislation.regulatory_storage_fault()")
    }
    expect(await publishRegulatoryEdition(pool, result.lease, null)).toMatchObject({ isCurrent: true, reused: false })
  })

  it("rejects damaged retained XML before registering a database generation", async () => {
    const data = await input()
    await writeFile(data.artifactLocator, "broken")
    await expect(importNormalizedRegulatoryUnit(pool, data)).rejects.toThrow("artifact_retention_mismatch")
    expect(
      (await pool.query("SELECT count(*)::int AS count FROM legislation.legal_import_generations")).rows[0].count
    ).toBe(0)
  })
})
