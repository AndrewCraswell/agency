import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
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
import { publishAnnualCfrEdition } from "./annual-cfr-publication.js"
import {
  finalizeAnnualCfrDiscoveryPublication,
  inspectAnnualCfrDiscoveryPublication,
  materializeAnnualCfrDiscoveryUnit
} from "./annual-discovery-publication.js"
import { acquireLegalDiscoveryArtifact } from "./discovery-acquisition.js"
import { completeAnnualCfrMaterializationDispatch, planLegalDiscoveryDispatchPage } from "./discovery-dispatch.js"
import { parseLegalDiscoveryArtifact } from "./discovery-parsing.js"
import { registerHistoricalManifestPage } from "./historical-manifest-registration.js"
import { RegulatorySourceClient } from "./source-client.js"

const databaseUrl = process.env.REGULATORY_DESTRUCTIVE_TEST_DATABASE_URL
if (databaseUrl !== undefined) {
  const url = new URL(databaseUrl)
  if (url.pathname !== "/regulations_destructive_test" || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) {
    throw new Error("Historical registration checks require the dedicated local destructive-test database")
  }
}

function manifestFixture(volumes = 2) {
  const inventoryBody = JSON.stringify({
    files: Array.from({ length: volumes }, (_, index) => ({
      name: `CFR-2023-title1-vol${index + 1}.xml`,
      folder: false,
      link: `https://www.govinfo.gov/bulkdata/CFR/2023/title-1/CFR-2023-title1-vol${index + 1}.xml`
    }))
  })
  const inventoryHash = digest(inventoryBody)
  const inventory = [
    {
      sourceId: "govinfo-cfr" as const,
      url: "https://www.govinfo.gov/bulkdata/json/CFR/2023/title-1/",
      sha256: inventoryHash,
      bytes: Buffer.byteLength(inventoryBody),
      retrievedAt: "2026-09-17T12:00:00.000Z",
      contentType: "application/json",
      body: inventoryBody
    }
  ]
  const units = Array.from({ length: volumes }, (_, index) => index + 1).map((volume) => {
    const values = {
      sourceId: "govinfo-cfr" as const,
      nativeId: `CFR-2023-title1-vol${volume}`,
      edition: "2023",
      sourceUrl: `https://www.govinfo.gov/bulkdata/CFR/2023/title-1/CFR-2023-title1-vol${volume}.xml`,
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
      cutoff: "2023-12-31",
      ecfrTitles: [],
      federalRegister: null,
      annualCfr: { years: [2023], titles: [1] }
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
    unknownSizeUnits: volumes
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
      "TRUNCATE legislation.legal_discovery_dispatches,legislation.legal_artifacts,legislation.legal_discovery_pages,legislation.legal_discovery_units,legislation.legal_discovery_checkpoints,legislation.legal_import_manifests CASCADE"
    )
    await pool.query(`INSERT INTO legislation.jurisdictions(id,name,classification,country_code)
      VALUES('jurisdiction:us','United States','country','US') ON CONFLICT DO NOTHING`)
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

  it("acquires and reuses an admitted historical unit through the shared worker", async () => {
    const manifest = manifestFixture(1)
    const registered = await registerHistoricalManifestPage(pool, {
      manifest,
      sourceId: "govinfo-cfr",
      afterUnitKey: null,
      limit: 1
    })
    const unit = manifest.units.find((candidate) => candidate.key === registered.nextUnitKey)
    if (unit === undefined) throw new Error("Missing registered historical unit")
    const body = await readFile(new URL("./fixtures/cfr-2024-title1-excerpt.xml", import.meta.url), "utf8")
    let requests = 0
    const client = new RegulatorySourceClient({
      fetch: async () => {
        requests++
        return new Response(body, { headers: { "content-type": "application/xml" } })
      },
      minimumIntervalMs: 0
    })
    const directory = await mkdtemp(join(tmpdir(), "tabra-historical-acquisition-"))
    const normalized = await mkdtemp(join(tmpdir(), "tabra-historical-normalized-"))
    try {
      const input = { manifestId: manifest.id, unitKey: unit.key, artifactDirectory: directory }
      const first = await acquireLegalDiscoveryArtifact(pool, input, { client })
      const replay = await acquireLegalDiscoveryArtifact(pool, input, { client })
      expect(first).toMatchObject({ bytes: Buffer.byteLength(body), reused: false })
      expect(replay).toEqual({ ...first, reused: true })
      expect(requests).toBe(1)
      const state = await pool.query(
        "SELECT state,manifest_id,artifact_hash,artifact_bytes::integer FROM legislation.legal_discovery_units WHERE unit_key=$1",
        [unit.key]
      )
      expect(state.rows[0]).toMatchObject({
        state: "acquired",
        manifest_id: manifest.id,
        artifact_hash: first.artifactHash,
        artifact_bytes: Buffer.byteLength(body)
      })
      const parsed = await parseLegalDiscoveryArtifact(pool, {
        manifestId: manifest.id,
        unitKey: unit.key,
        outputRoot: normalized
      })
      expect(parsed).toMatchObject({ manifestId: manifest.id, unitKey: unit.key })
      expect(parsed.records).toBeGreaterThan(0)
      await expect(
        pool.query("SELECT state,normalized_generation FROM legislation.legal_discovery_units WHERE unit_key=$1", [
          unit.key
        ])
      ).resolves.toMatchObject({ rows: [{ state: "parsed", normalized_generation: parsed.generation }] })
      const publicationPlan = await planLegalDiscoveryDispatchPage(pool, {
        sourceId: "govinfo-cfr",
        scopeKey: registered.scopeKey,
        limit: 1
      })
      expect(publicationPlan.dispatches).toHaveLength(1)
      expect(publicationPlan.dispatches[0]?.stage).toBe("publication")
      const materialized = await materializeAnnualCfrDiscoveryUnit(pool, {
        manifestId: manifest.id,
        unitKey: unit.key
      })
      expect(materialized).toMatchObject({ state: "materialized", year: 2023, title: 1, volume: 1 })
      await expect(
        completeAnnualCfrMaterializationDispatch(
          pool,
          { manifestId: manifest.id, unitKey: unit.key },
          materialized.generationId
        )
      ).resolves.toEqual({ sourceId: "govinfo-cfr", scopeKey: registered.scopeKey })
      await expect(
        planLegalDiscoveryDispatchPage(pool, {
          sourceId: "govinfo-cfr",
          scopeKey: registered.scopeKey,
          limit: 1
        })
      ).resolves.toMatchObject({ selected: 0, dispatches: [] })
      const readiness = await inspectAnnualCfrDiscoveryPublication(pool, {
        manifestId: manifest.id,
        year: 2023,
        title: 1
      })
      expect(readiness).toMatchObject({ expectedVolumes: 1, materializedVolumes: 1, ready: true })
      if (readiness.payload === null) throw new Error("Missing annual publication payload")
      await publishAnnualCfrEdition(pool, readiness.payload)
      await expect(finalizeAnnualCfrDiscoveryPublication(pool, readiness.payload)).resolves.toEqual({
        linked: 1,
        reused: false
      })
      await expect(
        pool.query(
          "SELECT state,publication_generation_id,edition_id IS NOT NULL has_edition FROM legislation.legal_discovery_units WHERE unit_key=$1",
          [unit.key]
        )
      ).resolves.toMatchObject({
        rows: [
          {
            state: "published",
            publication_generation_id: materialized.generationId,
            has_edition: true
          }
        ]
      })
    } finally {
      await Promise.all([
        rm(directory, { recursive: true, force: true }),
        rm(normalized, { recursive: true, force: true })
      ])
    }
  })
})
