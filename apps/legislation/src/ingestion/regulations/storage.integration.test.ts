import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import pg from "pg"
import invariant from "tiny-invariant"
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest"
import { z } from "zod"
import { createLegalSearchCanary } from "../../api/legal-search-canary.js"
import { runWithRequestContext } from "../../auth/request-context.js"
import { assessAnnualCfrEdition } from "./annual-cfr-edition.js"
import { publishAnnualCfrEdition } from "./annual-cfr-publication.js"
import { inspectCanonicalRegulatoryReuse } from "./canonical-reuse.js"
import {
  acquisitionUnitSchema,
  digest,
  manifestIdentity,
  regulatoryContract,
  unitIdentity,
  type BackfillManifest
} from "./contracts.js"
import { publishFrHtmlImport } from "./fr-html-publication.js"
import { frHtmlImportArtifact, registerFrHtmlImport, stageFrHtmlImport } from "./fr-import-registration.js"
import { frMetadataPageSchema } from "./fr-metadata-contract.js"
import { collectFrMetadata } from "./fr-metadata.js"
import { frPdfValidationContract } from "./fr-pdf-validation.js"
import { normalizeFrHtmlPublication } from "./fr-publication-input.js"
import { publishFrIssue } from "./fr-storage.js"
import { importNormalizedRegulatoryUnit } from "./import-normalized.js"
import { parseRegulatoryArtifact } from "./parser-bridge.js"
import { regulatoryRecordSchema } from "./parser-contract.js"
import { runLegalPassageCopyBatch } from "./passage-copy-batch.js"
import { acknowledgeLegalPassageCopy, inspectLegalPassageCopy } from "./passage-copy-readiness.js"
import { runLegalPassagePreparationBatch } from "./passage-preparation.js"
import { replicateLegalPassageGeneration } from "./passage-replication.js"
import { searchCopiedLegalPassages, searchCurrentLegalProvision } from "./passage-search.js"
import { materializeLegalPassages, searchLegalPassages } from "./passage-storage.js"
import { reconcileLegalSearchRightsBatch, reconcileLegalSearchScopeRights } from "./search-rights.js"
import { rightsPolicySchema } from "./storage-contract.js"
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
  const xml = options.fixture
    ? await readFile(new URL(fixture, fixtures), "utf8")
    : `<ECFR><DIV1 N="1" TYPE="TITLE"><HEAD>Title 1</HEAD>${options.body ?? '<DIV8 N="1.1" TYPE="SECTION"><HEAD>First</HEAD><P>Original text</P></DIV8><DIV8 N="1.2" TYPE="SECTION"><HEAD>Second</HEAD><P>Unchanged</P></DIV8>'}</DIV1></ECFR>`
  const directory = await mkdtemp(join(tmpdir(), "tabra-regulatory-storage-"))
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
      migrationsFolder: resolve("src/db/migrations"),
      migrationsSchema: "legislation_migrations",
      migrationsTable: "migrations"
    })
    await pool.query(`INSERT INTO legislation.jurisdictions(id,name,classification,country_code)
      VALUES('jurisdiction:us','United States','country','US') ON CONFLICT DO NOTHING`)
  }, 60_000)
  beforeEach(async () => {
    await pool.query(`TRUNCATE legislation.regulatory_documents,legislation.legal_codes,legislation.legal_import_manifests,
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
          await target.query(await readFile(resolve("infra/passage-search/legal.sql"), "utf8"))
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
          await target.query(await readFile(resolve("infra/passage-search/legal.sql"), "utf8"))
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
          await target.query(await readFile(resolve("infra/passage-search/legal.sql"), "utf8"))
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
        await target.query(
          "ALTER TABLE legislation.legal_search_scopes ADD CONSTRAINT injected_receipt_failure CHECK(generation_count < 0)"
        )
        try {
          await expect(acknowledgeLegalPassageCopy(pool, target, plan.preparationId)).rejects.toThrow(
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
          await expect(acknowledgeLegalPassageCopy(pool, target, plan.preparationId)).rejects.toThrow(
            "ack_commit_failure"
          )
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
        expect(await acknowledgeLegalPassageCopy(pool, target, plan.preparationId)).toMatchObject({
          acknowledged: true,
          copiedGenerations: 3,
          publicSearchReady: false
        })
        expect(await acknowledgeLegalPassageCopy(pool, target, plan.preparationId)).toMatchObject({
          acknowledged: true
        })
        expect(await searchCurrentLegalProvision(pool, target, query)).toHaveLength(1)
        const canary = createLegalSearchCanary(pool, target, ["org-regulatory-test"])
        const canaryInput = {
          scope: { kind: "provision" as const, editionId: first.editionId, versionId: head.version_id },
          generationId: plan.items[1].generation_id,
          preparationId: plan.preparationId,
          query: "Original"
        }
        const context = {
          correlationId: "regulatory-access-test",
          identity: { userId: "test-user", organizationId: "org-regulatory-test" }
        }
        expect(await runWithRequestContext(context, () => canary(canaryInput))).toHaveLength(1)
        const profile = (await pool.query("SELECT id,policy FROM legislation.legal_rights_profiles LIMIT 1")).rows[0]
        const policy = rightsPolicySchema.parse(profile.policy)
        const closedTarget = new pg.Pool({ connectionString: url.href })
        await closedTarget.end()
        const blockedCanary = createLegalSearchCanary(pool, closedTarget, ["org-regulatory-test"])
        for (const restricted of [
          { ...policy, apiMcp: false },
          { ...policy, territories: ["US"] }
        ]) {
          await pool.query("UPDATE legislation.legal_rights_profiles SET policy=$2::jsonb,policy_hash=$3 WHERE id=$1", [
            profile.id,
            JSON.stringify(restricted),
            digest(JSON.stringify(restricted))
          ])
          await expect(runWithRequestContext(context, () => blockedCanary(canaryInput))).rejects.toMatchObject({
            category: "forbidden"
          })
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
    15000
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
          await target.query(await readFile(resolve("infra/passage-search/legal.sql"), "utf8"))
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
  async function annualInputs(options: { duplicateSection?: boolean; conflictingDate?: boolean } = {}) {
    const template = await input({ fixture: "cfr-2024-title1-excerpt.xml" })
    const files = [1, 2].map((volume) => ({
      name: `CFR-2023-title1-vol${volume}.xml`,
      folder: false,
      link: `https://www.govinfo.gov/bulkdata/CFR/2023/title-1/CFR-2023-title1-vol${volume}.xml`
    }))
    const body = JSON.stringify({ files })
    const units = files.map((file) => {
      const unit = {
        ...template.receipt.unit,
        nativeId: file.name.slice(0, -4),
        edition: "2023",
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
      scope: { ...template.manifest.scope, ecfrTitles: [], annualCfr: { years: [2023], titles: [1] } },
      inventory: [
        {
          ...template.manifest.inventory[0],
          sourceId: "govinfo-cfr" as const,
          url: "https://www.govinfo.gov/bulkdata/json/CFR/2023/title-1/",
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
      const path = join(await mkdtemp(join(tmpdir(), "tabra-annual-volume-")), "source.xml")
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

  it("enforces code/version and edition/parent foreign keys in PostgreSQL", async () => {
    const first = await materialized(await input())
    await publishRegulatoryEdition(pool, first.lease, null)
    const row = (await pool.query("SELECT * FROM legislation.legal_edition_provisions WHERE ordinal=1")).rows[0]
    invariant(row, "missing_member")
    const other = (
      await pool.query(`INSERT INTO legislation.legal_codes(jurisdiction_id,code_key,name,kind)
      VALUES('jurisdiction:us','other','Other','regulation') RETURNING id`)
    ).rows[0]
    await expect(
      pool.query("UPDATE legislation.legal_edition_provisions SET code_id=$1 WHERE edition_id=$2", [
        other.id,
        first.editionId
      ])
    ).rejects.toMatchObject({ code: "23503" })
    await expect(
      pool.query(
        "UPDATE legislation.legal_edition_provisions SET parent_id=gen_random_uuid() WHERE edition_id=$1 AND ordinal=1",
        [first.editionId]
      )
    ).rejects.toMatchObject({ code: "23503" })
    await expect(
      pool.query(
        "UPDATE legislation.legal_edition_provisions SET parent_id=provision_id WHERE edition_id=$1 AND ordinal=1",
        [first.editionId]
      )
    ).rejects.toMatchObject({ code: "23514" })
    expect((await counts()).memberships).toBe(3)
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
