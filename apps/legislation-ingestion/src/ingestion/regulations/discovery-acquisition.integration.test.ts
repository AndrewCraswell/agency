import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { unitIdentity } from "@repo/legislation-core/legal-text/contracts"
import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import pg from "pg"
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { acquireLegalDiscoveryArtifact } from "./discovery-acquisition.js"
import {
  commitLegalDiscoveryPage,
  legalDiscoveryUnitSchema,
  startLegalDiscoveryAttempt
} from "./discovery-checkpoint.js"
import { planLegalDiscoveryDispatchPage, submitLegalDiscoveryDispatch } from "./discovery-dispatch.js"
import { parseLegalDiscoveryArtifact } from "./discovery-parsing.js"
import { publishLegalDiscoveryUnit } from "./discovery-publication.js"
import { recoverLegalDiscoveryDispatchPage } from "./discovery-recovery.js"
import { registerLegalDiscoveryManifest } from "./discovery-registration.js"
import { planLegalPreparationPage } from "./preparation-plan.js"
import { RegulatorySourceClient } from "./source-client.js"

const databaseUrl = process.env.REGULATORY_TEST_DATABASE_URL
if (databaseUrl !== undefined) {
  const url = new URL(databaseUrl)
  if (url.pathname !== "/regulations_test" || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) {
    throw new Error("Regulatory acquisition checks require a local disposable regulations_test database")
  }
}

describe.skipIf(databaseUrl === undefined).sequential("current discovery acquisition and parsing", () => {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 3 })
  const directories: string[] = []
  beforeAll(async () => {
    await migrate(drizzle(pool), {
      migrationsFolder: fileURLToPath(
        new URL("../../../../../packages/legislation-core/src/database/migrations/", import.meta.url)
      ),
      migrationsSchema: "legislation_migrations",
      migrationsTable: "migrations"
    })
  }, 60_000)
  beforeEach(async () => {
    await pool.query(
      "TRUNCATE legislation.legal_artifacts,legislation.legal_import_manifests,legislation.legal_discovery_pages,legislation.legal_discovery_units,legislation.legal_discovery_checkpoints CASCADE"
    )
    await pool.query(`INSERT INTO legislation.jurisdictions(id,name,classification,country_code)
      VALUES('jurisdiction:us','United States','country','US') ON CONFLICT DO NOTHING`)
  })
  afterEach(async () => {
    await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
  })
  afterAll(async () => pool.end())

  it("commits and reuses one verified artifact, normalized generation and canonical publication", async () => {
    const query = { endpoint: "titles", titles: [1] }
    const attempt = await startLegalDiscoveryAttempt(pool, { sourceId: "ecfr", query })
    const values = {
      sourceId: "ecfr" as const,
      nativeId: "title-1",
      edition: "2026-09-15",
      inventoryHash: "a".repeat(64),
      inventoryRevision: "b".repeat(64),
      sourceUrl: "https://www.ecfr.gov/api/versioner/v1/full/2026-09-15/title-1.xml",
      issueDate: "2026-09-15",
      currencyDate: "2026-09-15",
      sourceModifiedText: "2026-09-15",
      expectedBytes: null,
      format: "xml" as const,
      historical: false as const,
      rightsProfileId: "official-federal-text" as const,
      externalStandardsIncluded: false as const
    }
    const unit = legalDiscoveryUnitSchema.parse({ ...values, key: unitIdentity(values) })
    await commitLegalDiscoveryPage(pool, {
      sourceId: "ecfr",
      query,
      expectedRevision: attempt.revision,
      expectedCursor: null,
      nextCursor: { date: "2026-09-15" },
      windowStartedAt: "2026-09-15T00:00:00.000Z",
      windowEndedAt: "2026-09-15T01:00:00.000Z",
      overlapStartedAt: "2026-09-14T23:00:00.000Z",
      sourceCutoff: { date: "2026-09-15" },
      units: [unit]
    })
    const manifest = await registerLegalDiscoveryManifest(pool, {
      sourceId: "ecfr",
      scopeKey: attempt.scopeKey,
      limit: 1
    })
    expect(manifest).not.toBeNull()
    if (manifest === null) throw new Error("Missing manifest")
    const planInput = { sourceId: "ecfr", scopeKey: attempt.scopeKey, limit: 10 }
    const acquisitionPlan = await planLegalDiscoveryDispatchPage(pool, planInput)
    expect(acquisitionPlan.dispatches).toHaveLength(1)
    expect(acquisitionPlan.dispatches[0]).toMatchObject({ stage: "acquisition", payload: { manifestId: manifest.id } })
    const acquisitionDispatch = acquisitionPlan.dispatches[0]
    if (!acquisitionDispatch) throw new Error("Missing acquisition dispatch")
    const submitted = await submitLegalDiscoveryDispatch(pool, acquisitionDispatch.id, async (stage) => ({
      id: `run-${stage}`
    }))
    expect(submitted).toMatchObject({ runId: "run-acquisition", attempt: 0, reused: false })
    await expect(
      submitLegalDiscoveryDispatch(pool, acquisitionDispatch.id, async () => {
        throw new Error("submitted dispatch must be reused")
      })
    ).resolves.toEqual({ ...submitted, reused: true })
    const retainedActive = await recoverLegalDiscoveryDispatchPage(
      pool,
      { sourceId: "ecfr", scopeKey: attempt.scopeKey, limit: 10 },
      async () => ({ status: "EXECUTING" }),
      async () => {
        throw new Error("an active run must not be replaced")
      }
    )
    expect(retainedActive).toMatchObject({
      inspected: 1,
      results: [
        {
          dispatchId: acquisitionDispatch.id,
          status: "EXECUTING",
          disposition: "retained",
          replacement: false
        }
      ]
    })
    const recovered = await recoverLegalDiscoveryDispatchPage(
      pool,
      { sourceId: "ecfr", scopeKey: attempt.scopeKey, limit: 10 },
      async (runId) => {
        expect(runId).toBe("run-acquisition")
        return { status: "FAILED" }
      },
      async (stage, payload, options) => {
        expect(stage).toBe("acquisition")
        expect(payload).toEqual(acquisitionDispatch.payload)
        expect(options.idempotencyKey).toBe(`legal-discovery:${acquisitionDispatch.id}:1`)
        return { id: "run-acquisition-retry" }
      }
    )
    expect(recovered).toMatchObject({
      inspected: 1,
      exhausted: true,
      results: [
        {
          dispatchId: acquisitionDispatch.id,
          status: "FAILED",
          disposition: "replacement_ready",
          replacement: { runId: "run-acquisition-retry", attempt: 1, reused: false }
        }
      ]
    })
    expect(
      (
        await pool.query(`SELECT attempt,run_id,run_history FROM legislation.legal_discovery_dispatches WHERE id=$1`, [
          acquisitionDispatch.id
        ])
      ).rows[0]
    ).toEqual({
      attempt: 1,
      run_id: "run-acquisition-retry",
      run_history: [expect.objectContaining({ attempt: 0, runId: "run-acquisition", status: "FAILED" })]
    })
    const body = `<?xml version="1.0"?><DLPSTEXTCLASS><DIV1 N="1" TYPE="TITLE"><HEAD>Title 1</HEAD>
      <DIV8 N="1.1" TYPE="SECTION"><HEAD>Current rule</HEAD><P>Current title text.</P></DIV8>
      </DIV1></DLPSTEXTCLASS>`
    const fetcher = vi.fn<typeof fetch>(
      async () => new Response(body, { headers: { "content-type": "application/xml" } })
    )
    const sourceClient = new RegulatorySourceClient({ fetch: fetcher, minimumIntervalMs: 0 })
    const directory = await mkdtemp(join(tmpdir(), "tabra-current-acquisition-"))
    directories.push(directory)
    const input = { manifestId: manifest.id, unitKey: unit.key, artifactDirectory: directory }
    const first = await acquireLegalDiscoveryArtifact(pool, input, { client: sourceClient })
    const second = await acquireLegalDiscoveryArtifact(pool, input, { client: sourceClient })
    expect(first).toMatchObject({ reused: false, bytes: Buffer.byteLength(body) })
    expect(second).toEqual({ ...first, reused: true })
    expect(fetcher).toHaveBeenCalledOnce()
    expect(await readFile(join(directory, "blobs", `${first.artifactHash}.xml`), "utf8")).toBe(body)
    const reconciled = await recoverLegalDiscoveryDispatchPage(
      pool,
      { sourceId: "ecfr", scopeKey: attempt.scopeKey, limit: 10 },
      async (runId) => {
        expect(runId).toBe("run-acquisition-retry")
        return { status: "COMPLETED" }
      },
      async () => {
        throw new Error("an advanced stage must not submit another replacement")
      }
    )
    expect(reconciled).toMatchObject({
      inspected: 1,
      results: [
        {
          dispatchId: acquisitionDispatch.id,
          status: "COMPLETED",
          disposition: "completed",
          replacement: false
        }
      ]
    })
    const parsingPlan = await planLegalDiscoveryDispatchPage(pool, planInput)
    expect(parsingPlan.dispatches).toHaveLength(1)
    expect(parsingPlan.dispatches[0]).toMatchObject({ stage: "parsing", payload: { manifestId: manifest.id } })
    const parsingDispatch = parsingPlan.dispatches[0]
    if (!parsingDispatch) throw new Error("Missing parsing dispatch")
    await expect(
      submitLegalDiscoveryDispatch(pool, parsingDispatch.id, async () => {
        throw new Error("uncertain parsing submission")
      })
    ).rejects.toThrow("uncertain parsing submission")
    const retainedUncertain = await recoverLegalDiscoveryDispatchPage(
      pool,
      { sourceId: "ecfr", scopeKey: attempt.scopeKey, limit: 10 },
      async () => {
        throw new Error("a submission without a run ID must not inspect Trigger history")
      },
      async () => {
        throw new Error("a recent uncertain submission must not be replaced")
      }
    )
    expect(retainedUncertain).toMatchObject({
      inspected: 1,
      results: [{ dispatchId: parsingDispatch.id, status: "MISSING", disposition: "retained", replacement: false }]
    })
    await pool.query(
      `UPDATE legislation.legal_discovery_dispatches
       SET first_attempt_at=clock_timestamp()-interval '7 days' WHERE id=$1`,
      [parsingDispatch.id]
    )
    const replacedUncertain = await recoverLegalDiscoveryDispatchPage(
      pool,
      { sourceId: "ecfr", scopeKey: attempt.scopeKey, limit: 10 },
      async () => {
        throw new Error("a submission without a run ID must not inspect Trigger history")
      },
      async (stage, payload, options) => {
        expect(options.idempotencyKey).toBe(`legal-discovery:${parsingDispatch.id}:1`)
        expect(payload).toEqual(parsingDispatch.payload)
        return { id: `run-${stage}-retry` }
      }
    )
    expect(replacedUncertain).toMatchObject({
      inspected: 1,
      results: [
        {
          dispatchId: parsingDispatch.id,
          status: "MISSING",
          disposition: "replacement_ready",
          replacement: { runId: "run-parsing-retry", attempt: 1, reused: false }
        }
      ]
    })
    const normalized = await mkdtemp(join(tmpdir(), "tabra-current-normalized-"))
    directories.push(normalized)
    const parseInput = { manifestId: manifest.id, unitKey: unit.key, outputRoot: normalized }
    const firstParse = await parseLegalDiscoveryArtifact(pool, parseInput)
    const secondParse = await parseLegalDiscoveryArtifact(pool, parseInput)
    expect(firstParse).toMatchObject({ records: 2, reused: false })
    expect(secondParse).toEqual({ ...firstParse, reused: true })
    const parsingCompletion = await recoverLegalDiscoveryDispatchPage(
      pool,
      { sourceId: "ecfr", scopeKey: attempt.scopeKey, limit: 10 },
      async (runId) => {
        expect(runId).toBe("run-parsing-retry")
        return { status: "COMPLETED" }
      },
      async () => {
        throw new Error("a parsed unit must not be replaced")
      }
    )
    expect(parsingCompletion).toMatchObject({
      inspected: 1,
      results: [
        {
          dispatchId: parsingDispatch.id,
          status: "COMPLETED",
          disposition: "completed",
          replacement: false
        }
      ]
    })
    const publicationPlan = await planLegalDiscoveryDispatchPage(pool, planInput)
    expect(publicationPlan.dispatches).toHaveLength(1)
    expect(publicationPlan.dispatches[0]).toMatchObject({ stage: "publication", payload: { manifestId: manifest.id } })
    const publicationDispatch = publicationPlan.dispatches[0]
    if (!publicationDispatch) throw new Error("Missing publication dispatch")
    await expect(
      submitLegalDiscoveryDispatch(pool, publicationDispatch.id, async (stage) => ({ id: `run-${stage}` }))
    ).resolves.toMatchObject({ runId: "run-publication", reused: false })
    await pool.query(
      `UPDATE legislation.legal_discovery_dispatches
       SET first_attempt_at=clock_timestamp()-interval '8 days' WHERE id=$1`,
      [publicationDispatch.id]
    )
    const replacedMissing = await recoverLegalDiscoveryDispatchPage(
      pool,
      { sourceId: "ecfr", scopeKey: attempt.scopeKey, limit: 10 },
      async (runId) => {
        expect(runId).toBe("run-publication")
        return { status: "MISSING" }
      },
      async (stage, payload, options) => {
        expect(stage).toBe("publication")
        expect(payload).toEqual(publicationDispatch.payload)
        expect(options.idempotencyKey).toBe(`legal-discovery:${publicationDispatch.id}:1`)
        return { id: "run-publication-retry" }
      }
    )
    expect(replacedMissing).toMatchObject({
      inspected: 1,
      results: [
        {
          dispatchId: publicationDispatch.id,
          status: "MISSING",
          disposition: "replacement_ready",
          replacement: { runId: "run-publication-retry", attempt: 1, reused: false }
        }
      ]
    })
    const prematureCompletion = await recoverLegalDiscoveryDispatchPage(
      pool,
      { sourceId: "ecfr", scopeKey: attempt.scopeKey, limit: 10 },
      async (runId) => {
        expect(runId).toBe("run-publication-retry")
        return { status: "COMPLETED" }
      },
      async () => {
        throw new Error("a completed remote run with unchanged canonical state must not be replaced")
      }
    )
    expect(prematureCompletion).toMatchObject({
      inspected: 1,
      results: [
        {
          dispatchId: publicationDispatch.id,
          status: "COMPLETED",
          disposition: "state_mismatch",
          replacement: false
        }
      ]
    })
    const publicationInput = { manifestId: manifest.id, unitKey: unit.key }
    const firstPublication = await publishLegalDiscoveryUnit(pool, publicationInput)
    const secondPublication = await publishLegalDiscoveryUnit(pool, publicationInput)
    expect(firstPublication).toMatchObject({ state: "published", isCurrent: true, reused: false })
    expect(secondPublication).toEqual({ ...firstPublication, reused: true })
    const publicationCompletion = await recoverLegalDiscoveryDispatchPage(
      pool,
      { sourceId: "ecfr", scopeKey: attempt.scopeKey, limit: 10 },
      async () => ({ status: "COMPLETED" }),
      async () => {
        throw new Error("a completed published unit must not be replaced")
      }
    )
    expect(publicationCompletion).toMatchObject({
      inspected: 1,
      results: [
        {
          dispatchId: publicationDispatch.id,
          status: "COMPLETED",
          disposition: "completed",
          replacement: false
        }
      ]
    })
    const preparationWaveId = "00000000-0000-4000-8000-000000000001"
    const publishedBefore = new Date().toISOString()
    const preparationPlan = await planLegalPreparationPage(pool, {
      waveId: preparationWaveId,
      source: "ecfr",
      model: "openai/text-embedding-3-small",
      publishedBefore,
      pendingOnly: true
    })
    expect(preparationPlan).toMatchObject({ planned: 1, selectedCount: 1, exhausted: true, submitted: false })
    expect(preparationPlan.dispatchIds).toHaveLength(1)
    await expect(
      planLegalPreparationPage(pool, {
        waveId: preparationWaveId,
        source: "ecfr",
        model: "openai/text-embedding-3-small",
        publishedBefore,
        pendingOnly: true
      })
    ).resolves.toMatchObject({ planned: 0, selectedCount: 1, exhausted: true })
    await expect(planLegalDiscoveryDispatchPage(pool, planInput)).resolves.toMatchObject({
      selected: 0,
      exhausted: true
    })
    const stored = await pool.query(
      `SELECT state,artifact_hash,"artifact_bytes"::text bytes,storage_locator,
       acquisition_receipt->>'sha256' receipt_hash,parser_hash,normalized_generation,normalized_locator,
       (parse_summary->>'records')::integer records,publication_generation_id,edition_id::text,published_at IS NOT NULL published
       FROM legislation.legal_discovery_units WHERE source_id='ecfr' AND scope_key=$1 AND unit_key=$2`,
      [attempt.scopeKey, unit.key]
    )
    expect(stored.rows[0]).toEqual({
      state: "published",
      artifact_hash: first.artifactHash,
      bytes: String(first.bytes),
      storage_locator: join(directory, "blobs", `${first.artifactHash}.xml`),
      receipt_hash: first.artifactHash,
      parser_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
      normalized_generation: firstParse.generation,
      normalized_locator: join(normalized, firstParse.generation),
      records: 2,
      publication_generation_id: firstPublication.generationId,
      edition_id: firstPublication.editionId,
      published: true
    })
    expect(
      (
        await pool.query(
          `SELECT
           (SELECT count(*)::int FROM legislation.legal_import_generations WHERE state='published') generations,
           (SELECT count(*)::int FROM legislation.legal_editions WHERE published_at IS NOT NULL) editions,
           (SELECT count(*)::int FROM legislation.legal_edition_provisions WHERE edition_id=$1) members,
           (SELECT count(*)::int FROM legislation.legal_derived_outbox WHERE edition_id=$1 AND operation='lexical') lexical_jobs,
           (SELECT count(*)::int FROM legislation.legal_code_heads WHERE edition_id=$1) heads,
           (SELECT count(*)::int FROM legislation.legal_discovery_dispatches) dispatches,
           (SELECT count(*)::int FROM legislation.legal_preparation_dispatches) preparation_dispatches`,
          [firstPublication.editionId]
        )
      ).rows[0]
    ).toEqual({
      generations: 1,
      editions: 1,
      members: 2,
      lexical_jobs: 1,
      heads: 1,
      dispatches: 3,
      preparation_dispatches: 1
    })
  })
})
