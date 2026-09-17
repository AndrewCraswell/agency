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
import { registerLegalDiscoveryManifest } from "./discovery-registration.js"
import { RegulatorySourceClient } from "./source-client.js"

const databaseUrl = process.env.REGULATORY_TEST_DATABASE_URL
if (databaseUrl !== undefined) {
  const url = new URL(databaseUrl)
  if (url.pathname !== "/regulations_test" || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) {
    throw new Error("Regulatory acquisition checks require a local disposable regulations_test database")
  }
}

describe.skipIf(databaseUrl === undefined).sequential("current discovery artifact acquisition", () => {
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
  })
  afterEach(async () => {
    await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
  })
  afterAll(async () => pool.end())

  it("commits one verified artifact and reuses its checksum-validated bytes on replay", async () => {
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
    const body = '<?xml version="1.0"?><DLPSTEXTCLASS><DIV1>current title</DIV1></DLPSTEXTCLASS>'
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
    const stored = await pool.query(
      `SELECT state,artifact_hash,"artifact_bytes"::text bytes,storage_locator,
       acquisition_receipt->>'sha256' receipt_hash
       FROM legislation.legal_discovery_units WHERE source_id='ecfr' AND scope_key=$1 AND unit_key=$2`,
      [attempt.scopeKey, unit.key]
    )
    expect(stored.rows[0]).toEqual({
      state: "acquired",
      artifact_hash: first.artifactHash,
      bytes: String(first.bytes),
      storage_locator: join(directory, "blobs", `${first.artifactHash}.xml`),
      receipt_hash: first.artifactHash
    })
  })
})
