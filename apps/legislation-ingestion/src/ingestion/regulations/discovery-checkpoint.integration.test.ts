import { fileURLToPath } from "node:url"
import { digest, unitIdentity } from "@repo/legislation-core/legal-text/contracts"
import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import pg from "pg"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import {
  commitLegalDiscoveryPage,
  legalDiscoveryScope,
  legalDiscoveryUnitSchema,
  startLegalDiscoveryAttempt
} from "./discovery-checkpoint.js"
import { discoverEcfrChanges } from "./ecfr-discovery.js"

const databaseUrl = process.env.REGULATORY_DESTRUCTIVE_TEST_DATABASE_URL
if (databaseUrl !== undefined) {
  const url = new URL(databaseUrl)
  if (url.pathname !== "/regulations_destructive_test" || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) {
    throw new Error("Regulatory discovery checks require the dedicated local destructive-test database")
  }
}

function unit(title: number) {
  const values = {
    sourceId: "ecfr" as const,
    nativeId: `title-${title}`,
    edition: "2026-09-10",
    sourceUrl: `https://www.ecfr.gov/api/versioner/v1/full/2026-09-10/title-${title}.xml`,
    inventoryHash: "a".repeat(64),
    inventoryRevision: String(title).repeat(64).slice(0, 64),
    issueDate: "2026-09-10",
    currencyDate: "2026-09-11",
    sourceModifiedText: "2026-09-09",
    expectedBytes: null,
    format: "xml" as const,
    historical: false,
    rightsProfileId: "official-federal-text" as const,
    externalStandardsIncluded: false as const
  }
  return legalDiscoveryUnitSchema.parse({ ...values, key: unitIdentity(values) })
}

describe.skipIf(databaseUrl === undefined).sequential("durable regulatory discovery checkpoints", () => {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 2 })
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
      "TRUNCATE legislation.legal_discovery_pages,legislation.legal_discovery_units,legislation.legal_discovery_checkpoints CASCADE"
    )
  })
  afterAll(async () => pool.end())

  it("rolls back partial pages, resumes and deduplicates a committed replay", async () => {
    const query = { endpoint: "titles", titles: [1, 3] }
    const attempt = await startLegalDiscoveryAttempt(pool, { sourceId: "ecfr", query })
    expect(attempt).toMatchObject({ revision: 0, committedCursor: null, lastSuccessAt: null })
    const units = [unit(1), unit(3)].sort((left, right) => left.key.localeCompare(right.key))
    const scope = legalDiscoveryScope("ecfr", query)
    const conflict = units[1]!
    await pool.query(
      `INSERT INTO legislation.legal_discovery_units(source_id,scope_key,unit_key,payload_hash,unit)
       VALUES($1,$2,$3,$4,'{}')`,
      [scope.sourceId, scope.scopeKey, conflict.key, "f".repeat(64)]
    )
    const page = {
      sourceId: "ecfr",
      query,
      expectedRevision: attempt.revision,
      expectedCursor: attempt.committedCursor,
      nextCursor: { inventoryDate: "2026-09-11", inventoryHash: "a".repeat(64) },
      windowStartedAt: "2026-09-16T22:00:00Z",
      windowEndedAt: "2026-09-16T23:00:00Z",
      overlapStartedAt: "2026-09-16T21:00:00Z",
      sourceCutoff: { inventoryDate: "2026-09-11" },
      units
    }
    await expect(commitLegalDiscoveryPage(pool, page)).rejects.toThrow()
    expect(
      (
        await pool.query(
          "SELECT count(*)::integer AS count FROM legislation.legal_discovery_units WHERE source_id=$1 AND scope_key=$2",
          [scope.sourceId, scope.scopeKey]
        )
      ).rows[0].count
    ).toBe(1)
    expect(
      (
        await pool.query(
          "SELECT revision,committed_cursor FROM legislation.legal_discovery_checkpoints WHERE source_id=$1 AND scope_key=$2",
          [scope.sourceId, scope.scopeKey]
        )
      ).rows[0]
    ).toEqual({ revision: "0", committed_cursor: null })
    await pool.query(
      "DELETE FROM legislation.legal_discovery_units WHERE source_id=$1 AND scope_key=$2 AND unit_key=$3",
      [scope.sourceId, scope.scopeKey, conflict.key]
    )
    const committed = await commitLegalDiscoveryPage(pool, page)
    expect(committed).toMatchObject({ newUnits: 2, registeredUnits: 2, reused: false })
    expect(committed.checkpoint).toMatchObject({ revision: 1, committedCursor: page.nextCursor })
    expect(await commitLegalDiscoveryPage(pool, page)).toMatchObject({ newUnits: 0, registeredUnits: 2, reused: true })
    const counts = await pool.query(
      `SELECT
      (SELECT count(*)::integer FROM legislation.legal_discovery_units WHERE source_id=$1 AND scope_key=$2) units,
      (SELECT count(*)::integer FROM legislation.legal_discovery_pages WHERE source_id=$1 AND scope_key=$2) pages`,
      [scope.sourceId, scope.scopeKey]
    )
    expect(counts.rows[0]).toEqual({ units: 2, pages: 1 })
  })

  it("discovers changed current titles without duplicating repeated pending work", async () => {
    const titles = Array.from({ length: 50 }, (_, index) => ({
      number: index + 1,
      name: `Title ${index + 1}`,
      reserved: index === 1,
      latest_issue_date: index === 1 ? null : "2026-09-10",
      latest_amended_on: index === 1 ? null : "2026-09-09",
      up_to_date_as_of: index === 1 ? null : "2026-09-11"
    }))
    const body = JSON.stringify({ titles, meta: { date: "2026-09-11", import_in_progress: false } })
    const evidence = {
      sourceId: "ecfr" as const,
      url: "https://www.ecfr.gov/api/versioner/v1/titles.json",
      sha256: digest(body),
      bytes: Buffer.byteLength(body),
      contentType: "application/json",
      body,
      retrievedAt: "2026-09-16T23:00:00.000Z"
    }
    const client = { inventory: async () => evidence }
    const first = await discoverEcfrChanges(pool, { client, titles: [1, 2] })
    expect(first).toMatchObject({ changedTitles: [1], reservedTitles: [2], newUnits: 1, reused: false })
    const replay = await discoverEcfrChanges(pool, { client, titles: [1, 2] })
    expect(replay).toMatchObject({ changedTitles: [1], reservedTitles: [2], newUnits: 0, reused: false })
    expect(replay.checkpoint.revision).toBe(2)
    const counts = await pool.query(`SELECT
      (SELECT count(*)::integer FROM legislation.legal_discovery_units) units,
      (SELECT count(*)::integer FROM legislation.legal_discovery_pages) pages`)
    expect(counts.rows[0]).toEqual({ units: 1, pages: 2 })
  })
})
