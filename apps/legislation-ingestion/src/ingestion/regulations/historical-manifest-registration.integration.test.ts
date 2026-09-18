import { fileURLToPath } from "node:url"
import {
  acquisitionUnitSchema,
  digest,
  manifestIdentity,
  regulatoryContract,
  unitIdentity,
  validateManifest
} from "@repo/legislation-core/legal-text/contracts"
import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import pg from "pg"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import { registerHistoricalManifestPage } from "./historical-manifest-registration.js"

const databaseUrl = process.env.REGULATORY_DESTRUCTIVE_TEST_DATABASE_URL
if (databaseUrl !== undefined) {
  const url = new URL(databaseUrl)
  if (url.pathname !== "/regulations_destructive_test" || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) {
    throw new Error("Historical registration checks require the dedicated local destructive-test database")
  }
}

function manifestFixture() {
  const inventoryBody = JSON.stringify({ files: ["CFR-2025-title5-vol1.xml", "CFR-2025-title5-vol2.xml"] })
  const inventoryHash = digest(inventoryBody)
  const inventory = [
    {
      sourceId: "govinfo-cfr" as const,
      url: "https://www.govinfo.gov/bulkdata/json/CFR/2025/title-5/",
      sha256: inventoryHash,
      bytes: Buffer.byteLength(inventoryBody),
      retrievedAt: "2026-09-17T12:00:00.000Z",
      contentType: "application/json",
      body: inventoryBody
    }
  ]
  const units = [1, 2].map((volume) => {
    const values = {
      sourceId: "govinfo-cfr" as const,
      nativeId: `CFR-2025-title5-vol${volume}`,
      edition: "2025",
      sourceUrl: `https://www.govinfo.gov/bulkdata/CFR/2025/title-5/CFR-2025-title5-vol${volume}.xml`,
      inventoryHash,
      inventoryRevision: digest(`volume-${volume}`),
      issueDate: null,
      currencyDate: null,
      sourceModifiedText: null,
      expectedBytes: null,
      format: "xml" as const,
      historical: true as const,
      rightsProfileId: "official-federal-text" as const,
      externalStandardsIncluded: false as const
    }
    return acquisitionUnitSchema.parse({ ...values, key: unitIdentity(values) })
  })
  const contents = {
    scope: {
      cutoff: "2025-12-31",
      ecfrTitles: [],
      federalRegister: null,
      annualCfr: { years: [2025], titles: [5] }
    },
    inventory,
    units,
    exclusions: []
  }
  return validateManifest({
    ...contents,
    contract: regulatoryContract,
    id: manifestIdentity(contents),
    status: "inventoried",
    recurringIngestionEnabled: false,
    acquisitionOnly: true,
    estimatedKnownBytes: 0,
    unknownSizeUnits: 2
  })
}

describe.skipIf(databaseUrl === undefined).sequential("historical manifest registration", () => {
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
      "TRUNCATE legislation.legal_discovery_dispatches,legislation.legal_discovery_pages,legislation.legal_discovery_units,legislation.legal_discovery_checkpoints,legislation.legal_import_manifests CASCADE"
    )
  })
  afterAll(async () => pool.end())

  it("registers bounded pages from one immutable full manifest and replays exactly", async () => {
    const manifest = manifestFixture()
    const first = await registerHistoricalManifestPage(pool, {
      manifest,
      sourceId: "govinfo-cfr",
      afterUnitKey: null,
      limit: 1
    })
    expect(first).toMatchObject({ registered: 1, newUnits: 1, exhausted: false, reused: false })
    expect(
      await registerHistoricalManifestPage(pool, {
        manifest,
        sourceId: "govinfo-cfr",
        afterUnitKey: null,
        limit: 1
      })
    ).toEqual({ ...first, newUnits: 0, reused: true })
    const second = await registerHistoricalManifestPage(pool, {
      manifest,
      sourceId: "govinfo-cfr",
      afterUnitKey: first.nextUnitKey,
      limit: 1
    })
    expect(second).toMatchObject({ registered: 1, newUnits: 1, exhausted: true, reused: false })
    const counts = await pool.query(
      `SELECT
       (SELECT count(*)::integer FROM legislation.legal_import_manifests) manifests,
       (SELECT count(*)::integer FROM legislation.legal_discovery_units WHERE state='registered') units,
       (SELECT count(*)::integer FROM legislation.legal_discovery_pages) pages`
    )
    expect(counts.rows[0]).toEqual({ manifests: 1, units: 2, pages: 2 })
  })

  it("rejects a skipped or foreign cursor before registering any unit", async () => {
    const manifest = manifestFixture()
    await expect(
      registerHistoricalManifestPage(pool, {
        manifest,
        sourceId: "govinfo-cfr",
        afterUnitKey: "f".repeat(64),
        limit: 1
      })
    ).rejects.toThrow("historical_manifest_cursor_unknown")
    const counts = await pool.query("SELECT count(*)::integer count FROM legislation.legal_discovery_units")
    expect(counts.rows[0]?.count).toBe(0)
  })

  it("rejects tampered manifest identity before writing source state", async () => {
    const manifest = manifestFixture()
    await expect(
      registerHistoricalManifestPage(pool, {
        manifest: { ...manifest, id: "0".repeat(64) },
        sourceId: "govinfo-cfr",
        afterUnitKey: null,
        limit: 1
      })
    ).rejects.toThrow("identity")
    const counts = await pool.query("SELECT count(*)::integer count FROM legislation.legal_discovery_checkpoints")
    expect(counts.rows[0]?.count).toBe(0)
  })
})
