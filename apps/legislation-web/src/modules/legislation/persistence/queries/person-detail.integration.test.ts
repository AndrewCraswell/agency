import { randomUUID } from "node:crypto"
import { fileURLToPath } from "node:url"
import * as schema from "@repo/legislation-core/database/schema/schema"
import { eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import pg from "pg"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { projectPersonDetailRead } from "../../../request-handling/api/person-detail-read-routes"
import { getPersonDetailRead } from "./person-detail-read"

const databaseUrl = process.env.LEGISLATION_TEST_DATABASE_URL
if (databaseUrl !== undefined && new URL(databaseUrl).pathname !== "/legislation_test") {
  throw new Error("LEGISLATION_TEST_DATABASE_URL must target the legislation_test database")
}

describe.skipIf(databaseUrl === undefined).sequential("canonical person detail projection", () => {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 2 })
  const database = drizzle(pool, { schema })
  const prefix = `reader:${randomUUID()}`
  const jurisdictionId = `jurisdiction:${prefix}`
  beforeAll(async () => {
    await migrate(database, {
      migrationsFolder: fileURLToPath(
        new URL("./migrations/", import.meta.resolve("@repo/legislation-core/database/migrate"))
      ),
      migrationsSchema: "legislation_migrations",
      migrationsTable: "migrations"
    })
    await database
      .insert(schema.jurisdictions)
      .values({ id: jurisdictionId, classification: "state", countryCode: "US", name: "Reader fixture" })
  })
  afterAll(async () => {
    await database.delete(schema.people).where(eq(schema.people.jurisdictionId, jurisdictionId))
    await database.delete(schema.jurisdictions).where(eq(schema.jurisdictions.id, jurisdictionId))
    await pool.end()
  })
  it.each(["Senator", "Representative"])("projects a canonical %s without importer fixtures", async (officeTitle) => {
    const personId = `person:${prefix}:${officeTitle}`
    const provenance = {
      sourceProvider: "fixture",
      sourceUrl: "https://example.test/person",
      sourceIsOfficial: true,
      sourceRetrievedAt: new Date("2026-09-14T00:00:00Z"),
      provenanceComplete: true
    }
    await database
      .insert(schema.people)
      .values({ id: personId, jurisdictionId, name: "Reader person", isActive: true, ...provenance })
    await database.insert(schema.personDetails).values({ personId, ...provenance })
    await database
      .insert(schema.personJurisdictions)
      .values({ personId, jurisdictionId, sourceIdentity: personId, ...provenance })
    await database.insert(schema.legislativeTerms).values({
      id: `term:${personId}`,
      personId,
      jurisdictionId,
      officeTitle,
      isActive: true,
      ...provenance
    })
    const detail = projectPersonDetailRead(await getPersonDetailRead(database, personId), "https://api.example.test")
    expect(detail.id).toBe(personId)
    expect(detail.jurisdictionIds).toContain(jurisdictionId)
    expect(detail.terms).toHaveLength(1)
    expect(detail.terms.every((term) => term.officeTitle === "Senator" || term.officeTitle === "Representative")).toBe(
      true
    )
  })
})
