import { fileURLToPath } from "node:url"
import { unitIdentity } from "@repo/legislation-core/legal-text/contracts"
import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import pg from "pg"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import { startLegalDiscoveryAttempt, commitLegalDiscoveryPage } from "./discovery-checkpoint.js"
import { registerLegalDiscoveryManifest } from "./discovery-registration.js"

const databaseUrl = process.env.REGULATORY_DESTRUCTIVE_TEST_DATABASE_URL
if (databaseUrl !== undefined) {
  const url = new URL(databaseUrl)
  if (url.pathname !== "/regulations_destructive_test" || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) {
    throw new Error("Regulatory registration checks require the dedicated local destructive-test database")
  }
}

describe.skipIf(databaseUrl === undefined).sequential("discovery manifest registration", () => {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 4 })
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
      "TRUNCATE legislation.legal_import_manifests,legislation.legal_discovery_pages,legislation.legal_discovery_units,legislation.legal_discovery_checkpoints CASCADE"
    )
  })
  afterAll(async () => pool.end())

  it("registers bounded immutable manifests and exhausts pending work without duplication", async () => {
    const query = { endpoint: "titles", titles: [1, 2, 3] }
    const attempt = await startLegalDiscoveryAttempt(pool, { sourceId: "ecfr", query })
    const units = [1, 2, 3].map((title) => {
      const values = {
        sourceId: "ecfr" as const,
        nativeId: `title-${title}`,
        edition: "2026-09-15",
        inventoryHash: "a".repeat(64),
        inventoryRevision: `${title}`.repeat(64),
        sourceUrl: `https://www.ecfr.gov/api/versioner/v1/full/2026-09-15/title-${title}.xml`,
        issueDate: "2026-09-15",
        currencyDate: "2026-09-15",
        sourceModifiedText: "2026-09-15",
        expectedBytes: null,
        format: "xml" as const,
        historical: false as const,
        rightsProfileId: "official-federal-text" as const,
        externalStandardsIncluded: false as const
      }
      return { ...values, key: unitIdentity(values) }
    })
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
      units
    })
    const first = await registerLegalDiscoveryManifest(pool, {
      sourceId: "ecfr",
      scopeKey: attempt.scopeKey,
      limit: 2
    })
    const second = await registerLegalDiscoveryManifest(pool, {
      sourceId: "ecfr",
      scopeKey: attempt.scopeKey,
      limit: 2
    })
    expect(first?.units).toHaveLength(2)
    expect(second?.units).toHaveLength(1)
    expect(
      await registerLegalDiscoveryManifest(pool, { sourceId: "ecfr", scopeKey: attempt.scopeKey, limit: 2 })
    ).toBeNull()
    const counts = await pool.query(
      `SELECT
       (SELECT count(*)::integer FROM legislation.legal_discovery_units WHERE state='registered') registered,
       (SELECT count(*)::integer FROM legislation.legal_discovery_units WHERE state='pending') pending,
       (SELECT count(*)::integer FROM legislation.legal_import_manifests) manifests`
    )
    expect(counts.rows[0]).toEqual({ registered: 3, pending: 0, manifests: 2 })
  })
})
