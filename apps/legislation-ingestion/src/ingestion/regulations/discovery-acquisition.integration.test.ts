import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { unitIdentity } from "@repo/legislation-core/legal-text/contracts"
import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import pg from "pg"
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { acquireLegalDiscoveryArtifact } from "./discovery-acquisition.js"
import {
  commitLegalDiscoveryPage,
  legalDiscoveryUnitSchema,
  startLegalDiscoveryAttempt
} from "./discovery-checkpoint.js"
import {
  completeLegalDiscoveryDispatch,
  planLegalDiscoveryDispatchPage,
  submitLegalDiscoveryDispatch
} from "./discovery-dispatch.js"
import { inspectLegalDiscoveryManifestCompletion } from "./discovery-manifest-completion.js"
import { parseLegalDiscoveryArtifact } from "./discovery-parsing.js"
import { publishLegalDiscoveryUnit } from "./discovery-publication.js"
import { recoverLegalDiscoveryDispatchPage } from "./discovery-recovery.js"
import { registerLegalDiscoveryManifest } from "./discovery-registration.js"
import { inspectLegalDiscoveryStart } from "./discovery-start.js"
import { runLegalPassagePreparationBatch } from "./passage-preparation.js"
import { submitLegalPreparation } from "./preparation-dispatch.js"
import { planLegalPreparationPage } from "./preparation-plan.js"
import { recoverLegalPreparationRunPage } from "./preparation-run-recovery.js"
import { inspectLegalPreparationWaveCompletion } from "./preparation-wave-completion.js"
import { RegulatorySourceClient } from "./source-client.js"

const databaseUrl = process.env.REGULATORY_DESTRUCTIVE_TEST_DATABASE_URL
if (databaseUrl !== undefined) {
  const url = new URL(databaseUrl)
  if (url.pathname !== "/regulations_destructive_test" || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) {
    throw new Error("Regulatory acquisition checks require the dedicated local destructive-test database")
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
      "TRUNCATE legislation.legal_preparation_plans,legislation.legal_preparation_dispatches,legislation.legal_artifacts,legislation.legal_import_manifests,legislation.legal_discovery_pages,legislation.legal_discovery_units,legislation.legal_discovery_checkpoints CASCADE"
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
    await expect(inspectLegalDiscoveryManifestCompletion(pool, { manifestId: manifest.id })).resolves.toMatchObject({
      expectedUnits: 1,
      actualUnits: 1,
      exactInventory: true,
      units: { registered: 1, published: 0, quarantined: 0 },
      dispatch: { registered: 0, completed: 0 },
      accounted: false,
      ready: false
    })
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
    await expect(inspectLegalDiscoveryManifestCompletion(pool, { manifestId: manifest.id })).resolves.toMatchObject({
      units: { published: 1, quarantined: 0 },
      dispatch: { registered: 3, completed: 2, incomplete: 1, remoteStateMismatch: 1 },
      publication: { missingCanonical: 0 },
      lexical: { missing: 0, pending: 1 },
      accounted: false,
      ready: false
    })
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
    await expect(inspectLegalDiscoveryManifestCompletion(pool, { manifestId: manifest.id })).resolves.toMatchObject({
      expectedUnits: 1,
      actualUnits: 1,
      exactInventory: true,
      units: { published: 1, quarantined: 0 },
      dispatch: {
        registered: 3,
        completed: 3,
        incomplete: 0,
        remoteStateMismatch: 0,
        failedAttempts: 1
      },
      publication: { missingCanonical: 0 },
      lexical: { missing: 0, pending: 1, delayed: 0 },
      accounted: true,
      ready: true
    })
    await pool.query("UPDATE legislation.legal_rights_profiles SET is_active=false")
    await expect(inspectLegalDiscoveryManifestCompletion(pool, { manifestId: manifest.id })).resolves.toMatchObject({
      rights: { profiles: 1, unavailable: 1 },
      accounted: true,
      ready: false
    })
    await pool.query("UPDATE legislation.legal_rights_profiles SET is_active=true")
    const preparationWaveId = "00000000-0000-4000-8000-000000000001"
    const publishedBefore = z
      .date()
      .parse((await pool.query("SELECT clock_timestamp() AS value")).rows[0].value)
      .toISOString()
    const preparationPlan = await planLegalPreparationPage(pool, {
      waveId: preparationWaveId,
      source: "ecfr",
      model: "openai/text-embedding-3-small",
      publishedBefore,
      pendingOnly: true
    })
    expect(preparationPlan).toMatchObject({ planned: 1, selectedCount: 1, exhausted: true, submitted: false })
    expect(preparationPlan.dispatchIds).toHaveLength(1)
    await expect(inspectLegalPreparationWaveCompletion(pool, { waveId: preparationWaveId })).resolves.toMatchObject({
      planning: { complete: true, selected: 1, registered: 1, fullyRegistered: true },
      dispatch: { pending: 1, completed: 0 },
      preparation: { missing: 1, prepared: 0 },
      lexical: { pending: 1, acknowledged: 0 },
      accounted: false,
      ready: false
    })
    await expect(
      planLegalPreparationPage(pool, {
        waveId: preparationWaveId,
        source: "ecfr",
        model: "openai/text-embedding-3-small",
        publishedBefore,
        pendingOnly: true
      })
    ).resolves.toMatchObject({ planned: 0, selectedCount: 1, exhausted: true })
    const preparationDispatchId = preparationPlan.dispatchIds[0]
    if (preparationDispatchId === undefined) throw new Error("Missing preparation dispatch")
    const preparationInput = {
      waveId: preparationWaveId,
      scope: { kind: "edition" as const, id: firstPublication.editionId },
      model: "openai/text-embedding-3-small" as const,
      limit: 10,
      retryBlocked: false
    }
    await expect(
      submitLegalPreparation(pool, preparationInput, async (_payload, options) => {
        expect(options.idempotencyKey).toBe(`legal-preparation:${preparationDispatchId}:0`)
        return { id: "run-preparation" }
      })
    ).resolves.toMatchObject({
      dispatchId: preparationDispatchId,
      runId: "run-preparation",
      attempt: 0,
      reused: false
    })
    const retainedPreparationRuns = [
      { status: "EXECUTING", message: "an active preparation run must not be replaced" },
      { status: "MISSING", message: "recently missing preparation history must remain protected" }
    ] satisfies { status: "EXECUTING" | "MISSING"; message: string }[]
    for (const { status, message } of retainedPreparationRuns) {
      await expect(
        recoverLegalPreparationRunPage(
          pool,
          { waveId: preparationWaveId, limit: 10 },
          async (runId) => {
            expect(runId).toBe("run-preparation")
            return { status }
          },
          async () => {
            throw new Error(message)
          }
        )
      ).resolves.toMatchObject({
        inspected: 1,
        results: [
          {
            dispatchId: preparationDispatchId,
            status,
            disposition: "retained",
            replacement: false
          }
        ]
      })
    }
    const prematurePreparationCompletion = await recoverLegalPreparationRunPage(
      pool,
      { waveId: preparationWaveId, limit: 10 },
      async (runId) => {
        expect(runId).toBe("run-preparation")
        return { status: "COMPLETED" }
      },
      async () => {
        throw new Error("remote completion without canonical preparation must remain visible")
      }
    )
    expect(prematurePreparationCompletion).toMatchObject({
      inspected: 1,
      results: [
        {
          dispatchId: preparationDispatchId,
          status: "COMPLETED",
          disposition: "state_mismatch",
          replacement: false
        }
      ]
    })
    const recoveredPreparation = await recoverLegalPreparationRunPage(
      pool,
      { waveId: preparationWaveId, limit: 10 },
      async (runId) => {
        expect(runId).toBe("run-preparation")
        return { status: "FAILED" }
      },
      async (_payload, options) => {
        expect(options.idempotencyKey).toBe(`legal-preparation:${preparationDispatchId}:1`)
        return { id: "run-preparation-retry" }
      }
    )
    expect(recoveredPreparation).toMatchObject({
      inspected: 1,
      results: [
        {
          dispatchId: preparationDispatchId,
          status: "FAILED",
          disposition: "replacement_ready",
          replacement: { runId: "run-preparation-retry", attempt: 1, reused: false }
        }
      ]
    })
    const partialPreparation = await runLegalPassagePreparationBatch(pool, { ...preparationInput, limit: 1 })
    expect(partialPreparation).toMatchObject({ state: "pending", processed: 1, total: 2, complete: 1, blocked: 0 })
    await pool.query(
      "UPDATE legislation.legal_passage_preparations SET retry_at=clock_timestamp()+interval '1 hour' WHERE id=$1",
      [partialPreparation.preparationId]
    )
    await expect(inspectLegalPreparationWaveCompletion(pool, { waveId: preparationWaveId })).resolves.toMatchObject({
      preparation: { pending: 1, delayed: 1, prepared: 0 },
      lexical: { pending: 1 },
      accounted: false,
      ready: false
    })
    await pool.query("UPDATE legislation.legal_passage_preparations SET retry_at=clock_timestamp() WHERE id=$1", [
      partialPreparation.preparationId
    ])
    await expect(runLegalPassagePreparationBatch(pool, preparationInput)).resolves.toMatchObject({
      state: "prepared",
      total: 2,
      complete: 2,
      blocked: 0
    })
    const preparationCompletion = await recoverLegalPreparationRunPage(
      pool,
      { waveId: preparationWaveId, limit: 10 },
      async (runId) => {
        expect(runId).toBe("run-preparation-retry")
        return { status: "COMPLETED" }
      },
      async () => {
        throw new Error("canonically prepared work must not be replaced")
      }
    )
    expect(preparationCompletion).toMatchObject({
      inspected: 1,
      results: [
        {
          dispatchId: preparationDispatchId,
          status: "COMPLETED",
          disposition: "prepared",
          replacement: false
        }
      ]
    })
    await expect(inspectLegalPreparationWaveCompletion(pool, { waveId: preparationWaveId })).resolves.toMatchObject({
      dispatch: { completed: 1 },
      preparation: { prepared: 1, blocked: 0, delayed: 0 },
      lexical: { pending: 1, acknowledged: 0 },
      accounted: true,
      ready: false
    })
    expect(
      (
        await pool.query(
          `SELECT attempt,run_id,run_history,completed_at IS NOT NULL completed,last_observed_status
           FROM legislation.legal_preparation_dispatches WHERE id=$1`,
          [preparationDispatchId]
        )
      ).rows[0]
    ).toEqual({
      attempt: 1,
      run_id: "run-preparation-retry",
      run_history: [expect.objectContaining({ attempt: 0, runId: "run-preparation", status: "FAILED" })],
      completed: true,
      last_observed_status: "COMPLETED"
    })
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

  it("records canonical acquisition completion only after the unit advances", async () => {
    const query = { endpoint: "titles", titles: [2] }
    const attempt = await startLegalDiscoveryAttempt(pool, { sourceId: "ecfr", query })
    const values = {
      sourceId: "ecfr" as const,
      nativeId: "title-2",
      edition: "2026-09-16",
      inventoryHash: "a".repeat(64),
      inventoryRevision: "b".repeat(64),
      sourceUrl: "https://www.ecfr.gov/api/versioner/v1/full/2026-09-16/title-2.xml",
      issueDate: "2026-09-16",
      currencyDate: "2026-09-16",
      sourceModifiedText: "2026-09-16",
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
      nextCursor: { date: "2026-09-16" },
      windowStartedAt: "2026-09-16T00:00:00.000Z",
      windowEndedAt: "2026-09-16T01:00:00.000Z",
      overlapStartedAt: "2026-09-15T23:00:00.000Z",
      sourceCutoff: { date: "2026-09-16" },
      units: [unit]
    })
    const manifest = await registerLegalDiscoveryManifest(pool, {
      sourceId: "ecfr",
      scopeKey: attempt.scopeKey,
      limit: 1
    })
    if (manifest === null) throw new Error("Missing completion manifest")
    const plan = await planLegalDiscoveryDispatchPage(pool, {
      sourceId: "ecfr",
      scopeKey: attempt.scopeKey,
      limit: 1
    })
    const dispatch = plan.dispatches[0]
    if (!dispatch) throw new Error("Missing completion dispatch")
    const before = await inspectLegalDiscoveryStart(pool, {
      environment: "development",
      sourceId: "ecfr",
      scopeKey: attempt.scopeKey,
      limit: 1
    })
    expect(before).toMatchObject({
      environment: "development",
      payload: { sourceId: "ecfr", scopeKey: attempt.scopeKey, afterUnitKey: null, limit: 1 },
      units: { total: 1, registered: 1, runnable: 1, manifested: 1 },
      dispatch: { registered: 1, completed: 0 },
      canApply: true,
      canonicalWrites: false,
      dispatched: false
    })
    const otherEnvironment = await inspectLegalDiscoveryStart(pool, {
      environment: "staging",
      sourceId: "ecfr",
      scopeKey: attempt.scopeKey,
      limit: 1
    })
    expect(otherEnvironment.planId).not.toBe(before.planId)
    await expect(completeLegalDiscoveryDispatch(pool, "acquisition", dispatch.payload)).rejects.toThrow(
      "legal_discovery_dispatch_canonical_completion_missing"
    )

    const body = `<?xml version="1.0"?><DLPSTEXTCLASS><DIV1 N="2" TYPE="TITLE"><HEAD>Title 2</HEAD></DIV1></DLPSTEXTCLASS>`
    const directory = await mkdtemp(join(tmpdir(), "tabra-current-completion-"))
    directories.push(directory)
    await acquireLegalDiscoveryArtifact(
      pool,
      { manifestId: manifest.id, unitKey: unit.key, artifactDirectory: directory },
      {
        client: new RegulatorySourceClient({
          fetch: async () => new Response(body, { headers: { "content-type": "application/xml" } }),
          minimumIntervalMs: 0
        })
      }
    )
    await expect(completeLegalDiscoveryDispatch(pool, "acquisition", dispatch.payload)).resolves.toEqual({
      sourceId: "ecfr",
      scopeKey: attempt.scopeKey
    })
    const after = await inspectLegalDiscoveryStart(pool, {
      environment: "development",
      sourceId: "ecfr",
      scopeKey: attempt.scopeKey,
      limit: 1
    })
    expect(after).toMatchObject({
      units: { total: 1, acquired: 1, runnable: 1 },
      dispatch: { registered: 1, completed: 1 },
      canApply: true
    })
    expect(after.planId).not.toBe(before.planId)
    await expect(completeLegalDiscoveryDispatch(pool, "acquisition", dispatch.payload)).resolves.toEqual({
      sourceId: "ecfr",
      scopeKey: attempt.scopeKey
    })
    await expect(
      pool.query(
        `SELECT completed_at IS NOT NULL completed,last_observed_status,lease_token,lease_expires_at
         FROM legislation.legal_discovery_dispatches WHERE id=$1`,
        [dispatch.id]
      )
    ).resolves.toMatchObject({
      rows: [
        {
          completed: true,
          last_observed_status: "CANONICAL_COMPLETED",
          lease_token: null,
          lease_expires_at: null
        }
      ]
    })
  })
})
