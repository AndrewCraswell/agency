import { resolve } from "node:path"
import { eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import pg from "pg"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import * as schema from "../schema/schema.js"
import { replaceEntitySnapshot } from "./entities.js"

const databaseUrl = process.env.LEGISLATION_TEST_DATABASE_URL
const describePostgres = databaseUrl === undefined ? describe.skip : describe
const migrationsFolder = resolve(process.cwd(), "src/db/migrations")
const jurisdictionId = "jurisdiction:entity-refresh"
const personId = "person:openstates:entity-refresh"
const organizationId = "organization:openstates:entity-refresh"
const termId = `${personId}:term:entity-refresh`
const membershipId = `${organizationId}:membership:entity-refresh`
const retrievedAt = new Date("2026-08-26T12:00:00.000Z")

if (databaseUrl !== undefined && new URL(databaseUrl).pathname !== "/legislation_test") {
  throw new Error("LEGISLATION_TEST_DATABASE_URL must target the legislation_test database")
}

describePostgres.sequential("replaceEntitySnapshot", () => {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 2 })
  const database = drizzle(pool, { schema })

  beforeAll(async () => {
    await pool.query("drop schema if exists legislation cascade")
    await pool.query("drop schema if exists legislation_migrations cascade")
    await migrate(database, {
      migrationsFolder,
      migrationsSchema: "legislation_migrations",
      migrationsTable: "migrations"
    })
    await database.insert(schema.jurisdictions).values({
      classification: "state",
      countryCode: "US",
      id: jurisdictionId,
      name: "Entity refresh",
      subdivisionCode: "ER"
    })
  })

  afterAll(async () => {
    await pool.query("drop schema if exists legislation cascade")
    await pool.query("drop schema if exists legislation_migrations cascade")
    await pool.end()
  })

  it("refreshes canonical provenance and completeness when snapshot records conflict", async () => {
    await replaceEntitySnapshot(database, jurisdictionId, snapshot({ complete: false, role: "member" }))
    await replaceEntitySnapshot(database, jurisdictionId, snapshot({ complete: true, role: "chair" }))

    const [person] = await database.select().from(schema.people).where(eq(schema.people.id, personId))
    const [term] = await database.select().from(schema.legislativeTerms).where(eq(schema.legislativeTerms.id, termId))
    const [membership] = await database
      .select()
      .from(schema.organizationMemberships)
      .where(eq(schema.organizationMemberships.id, membershipId))

    expect(person).toMatchObject({
      provenanceComplete: true,
      sourceIsOfficial: false,
      sourceProvider: "openstates",
      sourceRetrievedAt: retrievedAt,
      sourceUpdatedAt: new Date("2026-08-25T12:00:00.000Z"),
      sourceUrl: "https://legislature.example.test/entity-refresh/person"
    })
    expect(term).toMatchObject({
      officeTitle: "Representative",
      provenanceComplete: true,
      sourceIsOfficial: false,
      sourceProvider: "openstates",
      sourceRetrievedAt: retrievedAt,
      sourceUpdatedAt: new Date("2026-08-25T12:00:00.000Z"),
      sourceUrl: "https://legislature.example.test/entity-refresh/term"
    })
    expect(membership).toMatchObject({
      label: "Committee chair",
      provenanceComplete: true,
      role: "chair",
      sourceIsOfficial: false,
      sourceProvider: "openstates",
      sourceRetrievedAt: retrievedAt,
      sourceUpdatedAt: new Date("2026-08-25T12:00:00.000Z"),
      sourceUrl: "https://legislature.example.test/entity-refresh/membership"
    })
  })

  it("refreshes Congress-owned person details on a subsequent snapshot", async () => {
    const congressPersonId = "person:congress:detail-refresh"
    await replaceEntitySnapshot(database, jurisdictionId, congressDetailSnapshot(congressPersonId, "first.jpg"))
    await replaceEntitySnapshot(database, jurisdictionId, congressDetailSnapshot(congressPersonId, "second.jpg"))

    const [detail] = await database
      .select()
      .from(schema.personDetails)
      .where(eq(schema.personDetails.personId, congressPersonId))

    expect(detail).toMatchObject({
      imageUrl: "https://api.congress.gov/member/detail-refresh/second.jpg",
      sourceIsOfficial: true,
      sourceProvider: "congress",
      sourceUrl: "https://api.congress.gov/member/detail-refresh"
    })
  })

  it("replaces stale Congress terms only for the detail-hydrated person", async () => {
    const congressPersonId = "person:congress:term-refresh"
    const otherCongressPersonId = "person:congress:other-term-refresh"
    const staleTermId = `${congressPersonId}:term:stale`
    const currentTermId = `${congressPersonId}:term:current`
    const nonCongressTermId = `${congressPersonId}:term:openstates`
    const otherCongressTermId = `${otherCongressPersonId}:term:current`
    await replaceEntitySnapshot(database, jurisdictionId, congressTermSnapshot(congressPersonId, staleTermId, "stale"))
    await replaceEntitySnapshot(
      database,
      jurisdictionId,
      congressTermSnapshot(otherCongressPersonId, otherCongressTermId, "current")
    )
    await replaceEntitySnapshot(database, jurisdictionId, nonCongressTermSnapshot(congressPersonId, nonCongressTermId))
    await replaceEntitySnapshot(database, jurisdictionId, {
      ...congressTermSnapshot(congressPersonId, currentTermId, "current"),
      termPersonIds: [congressPersonId],
      termSourceProvider: "congress"
    })

    const [refreshedPersonTerms, otherCongressPersonTerms] = await Promise.all([
      database.select().from(schema.legislativeTerms).where(eq(schema.legislativeTerms.personId, congressPersonId)),
      database.select().from(schema.legislativeTerms).where(eq(schema.legislativeTerms.personId, otherCongressPersonId))
    ])

    expect(refreshedPersonTerms.map((term) => term.id).sort()).toEqual([currentTermId, nonCongressTermId].sort())
    expect(refreshedPersonTerms).toContainEqual(
      expect.objectContaining({ id: currentTermId, officeTitle: "Representative", sourceProvider: "congress" })
    )
    expect(refreshedPersonTerms).toContainEqual(
      expect.objectContaining({ id: nonCongressTermId, isActive: false, sourceProvider: "openstates" })
    )
    expect(otherCongressPersonTerms).toEqual([
      expect.objectContaining({ id: otherCongressTermId, isActive: false, sourceProvider: "congress" })
    ])
  })
})

function congressDetailSnapshot(personId: string, imageName: string) {
  const sourceUrl = "https://api.congress.gov/member/detail-refresh"
  const provenance = {
    provenanceComplete: true,
    sourceIsOfficial: true,
    sourceProvider: "congress",
    sourceRetrievedAt: retrievedAt,
    sourceUrl
  }
  return {
    memberships: [],
    organizations: [],
    people: [
      {
        ...provenance,
        id: personId,
        isActive: true,
        jurisdictionId,
        name: "Detail Refresh",
        sourceId: "detail-refresh",
        upstreamIds: { bioguide: "detail-refresh" }
      }
    ],
    personAliasPersonIds: [],
    personAliases: [],
    personDetailPersonIds: [personId],
    personDetailSourceProvider: "congress",
    personDetails: [
      {
        ...provenance,
        imageUrl: `https://api.congress.gov/member/detail-refresh/${imageName}`,
        officialUrl: null,
        personId,
        publicEmail: null
      }
    ],
    personJurisdictions: [
      {
        ...provenance,
        jurisdictionId,
        personId,
        sourceIdentity: "congress:detail-refresh:jurisdiction:us"
      }
    ],
    terms: []
  }
}

function congressTermSnapshot(personId: string, termId: string, sourceId: string) {
  const bioguideId = personId.slice("person:congress:".length)
  const sourceUrl = `https://api.congress.gov/member/${bioguideId}`
  const provenance = {
    provenanceComplete: true,
    sourceIsOfficial: true,
    sourceProvider: "congress",
    sourceRetrievedAt: retrievedAt,
    sourceUrl
  }
  return {
    memberships: [],
    organizations: [],
    people: [
      {
        ...provenance,
        id: personId,
        isActive: true,
        jurisdictionId,
        name: "Term Refresh",
        sourceId: bioguideId,
        upstreamIds: { bioguide: bioguideId }
      }
    ],
    personAliasPersonIds: [],
    personAliases: [],
    terms: [
      {
        ...provenance,
        id: termId,
        isActive: true,
        jurisdictionId,
        officeTitle: sourceId === "current" ? "Representative" : undefined,
        personId,
        role: sourceId === "current" ? "Representative" : "House of Representatives",
        sourceId
      }
    ]
  }
}

function nonCongressTermSnapshot(personId: string, termId: string) {
  return {
    memberships: [],
    organizations: [],
    people: [],
    personAliasPersonIds: [],
    personAliases: [],
    terms: [
      {
        id: termId,
        isActive: true,
        jurisdictionId,
        officeTitle: "Representative",
        personId,
        provenanceComplete: true,
        role: "Representative",
        sourceId: "openstates-term-refresh",
        sourceIsOfficial: false,
        sourceProvider: "openstates",
        sourceRetrievedAt: retrievedAt,
        sourceUrl: "https://legislature.example.test/term-refresh"
      }
    ]
  }
}

function snapshot({ complete, role }: { complete: boolean; role: string }) {
  const provenance = complete
    ? {
        provenanceComplete: true,
        sourceIsOfficial: false,
        sourceProvider: "openstates",
        sourceRetrievedAt: retrievedAt,
        sourceUpdatedAt: new Date("2026-08-25T12:00:00.000Z")
      }
    : { provenanceComplete: false }

  return {
    memberships: [
      {
        ...provenance,
        id: membershipId,
        isActive: true,
        label: "Committee chair",
        organizationId,
        personId,
        role,
        sourceId: "entity-refresh:membership",
        sourceUrl: complete ? "https://legislature.example.test/entity-refresh/membership" : undefined
      }
    ],
    organizations: [
      {
        ...provenance,
        childRelationsComplete: true,
        classification: "committee",
        detailFactsComplete: true,
        id: organizationId,
        isActive: true,
        jurisdictionId,
        membershipRelationsComplete: true,
        name: "Entity refresh committee",
        sourceId: "entity-refresh:organization",
        sourceUrl: complete ? "https://legislature.example.test/entity-refresh/organization" : undefined
      }
    ],
    people: [
      {
        ...provenance,
        id: personId,
        isActive: true,
        jurisdictionId,
        name: "Entity Refresh",
        sourceId: "entity-refresh:person",
        sourceUrl: complete ? "https://legislature.example.test/entity-refresh/person" : undefined,
        upstreamIds: { openstates: "entity-refresh:person" }
      }
    ],
    personAliasPersonIds: [],
    personAliases: [],
    terms: [
      {
        ...provenance,
        id: termId,
        isActive: true,
        jurisdictionId,
        officeTitle: "Representative",
        personId,
        role: "Representative",
        sourceId: "entity-refresh:term",
        sourceUrl: complete ? "https://legislature.example.test/entity-refresh/term" : undefined
      }
    ]
  }
}
