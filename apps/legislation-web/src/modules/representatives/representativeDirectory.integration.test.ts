import { randomUUID } from "node:crypto"
import { fileURLToPath } from "node:url"
import * as schema from "@repo/legislation-core/database/schema/schema"
import { eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import pg from "pg"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createRepresentativeDirectoryReader } from "./representativeDirectory"

const databaseUrl = process.env.LEGISLATION_TEST_DATABASE_URL
if (databaseUrl !== undefined && new URL(databaseUrl).pathname !== "/legislation_test") {
  throw new Error("LEGISLATION_TEST_DATABASE_URL must target the legislation_test database")
}

describe.skipIf(databaseUrl === undefined).sequential("representative directory", () => {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 })
  const database = drizzle(pool, { schema })
  const prefix = randomUUID()
  const jurisdictionId = `jurisdiction:representatives-${prefix}`
  const provenance = {
    sourceProvider: "congress",
    sourceUrl: "https://example.test/profile",
    sourceRetrievedAt: new Date("2026-09-19T00:00:00Z"),
    sourceIsOfficial: true,
    provenanceComplete: true
  }
  beforeAll(async () => {
    await migrate(database, {
      migrationsFolder: fileURLToPath(
        new URL("./migrations/", import.meta.resolve("@repo/legislation-core/database/migrate"))
      ),
      migrationsSchema: "legislation_migrations",
      migrationsTable: "migrations"
    })
    await database.insert(schema.jurisdictions).values({
      id: jurisdictionId,
      name: "Directory fixture",
      countryCode: "US",
      classification: "state"
    })
    for (const [suffix, isActive, hasProvenance] of [
      ["primary", true, true],
      ["external", true, true],
      ["retired", false, true],
      ["incomplete", true, false]
    ] as const) {
      const personId = `person:${prefix}:${suffix}`
      await database.insert(schema.people).values({
        id: personId,
        jurisdictionId,
        name: `Directory ${suffix}`,
        sourceId: suffix === "primary" ? "R999001" : suffix,
        isActive,
        ...provenance,
        provenanceComplete: hasProvenance
      })
      await database.insert(schema.personDetails).values({
        personId,
        imageUrl: "https://example.test/portrait.jpg",
        ...provenance
      })
      await database.insert(schema.personExternalIdentifiers).values({
        personId,
        sourceIdentity: `${prefix}:${suffix}`,
        scheme: "bioguide",
        value: "R999001",
        ...provenance
      })
    }
  })
  afterAll(async () => {
    await database.delete(schema.people).where(eq(schema.people.jurisdictionId, jurisdictionId))
    await database.delete(schema.jurisdictions).where(eq(schema.jurisdictions.id, jurisdictionId))
    await pool.end()
  })
  it("returns primary and external matches, excluding retired and unverified identities", async () => {
    const read = createRepresentativeDirectoryReader(pool)
    const directory = await read(
      [{ scheme: "bioguide", value: "R999001" }],
      [jurisdictionId],
      new AbortController().signal
    )
    expect(directory.jurisdictions).toEqual([{ id: jurisdictionId, name: "Directory fixture" }])
    expect([...new Set(directory.profiles.map((entry) => entry.profile.id))].sort()).toEqual([
      `person:${prefix}:external`,
      `person:${prefix}:primary`
    ])
    expect(directory.profiles.every((entry) => entry.profile.imageUrl === "https://example.test/portrait.jpg")).toBe(
      true
    )
  })
  it("does not match an identifier under the wrong scheme or jurisdiction", async () => {
    const read = createRepresentativeDirectoryReader(pool)
    expect(
      (await read([{ scheme: "openstates", value: "R999001" }], [jurisdictionId], new AbortController().signal))
        .profiles
    ).toEqual([])
    expect(
      (await read([{ scheme: "bioguide", value: "R999001" }], ["jurisdiction:missing"], new AbortController().signal))
        .profiles
    ).toEqual([])
  })
})
