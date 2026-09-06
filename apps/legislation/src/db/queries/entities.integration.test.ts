import { resolve } from "node:path"
import { eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import pg from "pg"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import type { LegislationDatabase } from "../database.js"
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
  const membershipsForTenure = async (organizationId: string) =>
    await database
      .select()
      .from(schema.organizationMemberships)
      .where(eq(schema.organizationMemberships.organizationId, organizationId))

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

  it("imports a complete directory exceeding one statement's bind parameter budget", async () => {
    const input = snapshot({ complete: true, role: "member" })
    const member = input.memberships[0]!
    const largeSnapshot = {
      ...input,
      memberships: Array.from({ length: 4_000 }, (_, index) => ({
        ...member,
        id: `${membershipId}:large:${index}`,
        sourceId: `large:${index}`
      }))
    }
    await replaceEntitySnapshot(database, jurisdictionId, largeSnapshot)
    const rows = await membershipsForTenure(organizationId)
    expect(rows.filter((row) => row.sourceId?.startsWith("large:") && row.isActive)).toHaveLength(4_000)
  }, 120_000)

  it("imports a historical term range exceeding one statement's bind parameter budget", async () => {
    const input = snapshot({ complete: true, role: "member" })
    const term = input.terms[0]!
    const largeSnapshot = {
      ...input,
      terms: Array.from({ length: 4_001 }, (_, index) => ({
        ...term,
        chamber: "lower",
        district: "1",
        endDate: "2025-01-03",
        id: `${termId}:large:${index}`,
        organizationId,
        party: "Independent",
        sourceId: `large-term:${index}`,
        startDate: "2023-01-03"
      }))
    }
    // Prove this fixture exercises the PostgreSQL limit, not only a batch boundary.
    expect(database.insert(schema.legislativeTerms).values(largeSnapshot.terms).toSQL().params.length).toBeGreaterThan(
      65_535
    )
    await replaceEntitySnapshot(database, jurisdictionId, largeSnapshot)
    const rows = await database
      .select()
      .from(schema.legislativeTerms)
      .where(eq(schema.legislativeTerms.personId, personId))
    expect(rows.filter((row) => row.sourceId?.startsWith("large-term:") && row.isActive)).toHaveLength(4_001)
  }, 120_000)

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

  it("preserves current organizations and memberships while checkpointing a historical snapshot", async () => {
    await replaceEntitySnapshot(database, jurisdictionId, snapshot({ complete: true, role: "chair" }))
    const [before] = await database
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.id, organizationId))
    const sessionId = "session:entity-refresh:historical"
    await database.insert(schema.legislativeSessions).values({
      id: sessionId,
      jurisdictionId,
      identifier: "historical",
      name: "Historical session",
      classification: "congress"
    })
    const historical = snapshot({ complete: true, role: "member" })
    await replaceEntitySnapshot(
      database,
      jurisdictionId,
      {
        ...historical,
        people: [],
        terms: [],
        personAliases: [],
        personAliasPersonIds: [],
        organizations: historical.organizations.map((organization) => ({
          ...organization,
          name: "Old name",
          isActive: false
        })),
        memberships: historical.memberships.map((membership) => ({
          ...membership,
          id: `${membership.id}:historical`,
          sourceId: "historical",
          legislativeSessionId: sessionId
        }))
      },
      {
        preserveExistingOrganizations: true,
        replacePeople: false,
        membershipSessionId: sessionId,
        checkpoint: { source: "govinfo", stream: "historical-test", cursor: { fingerprint: "saved" } }
      }
    )
    const [after] = await database
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.id, organizationId))
    expect(after).toEqual(before)
    const [current] = await database
      .select()
      .from(schema.organizationMemberships)
      .where(eq(schema.organizationMemberships.id, membershipId))
    expect(current?.isActive).toBe(true)
    const checkpoint = await database.query.syncCheckpoints.findFirst({
      where: eq(schema.syncCheckpoints.stream, "historical-test")
    })
    expect(checkpoint?.cursor).toEqual({ fingerprint: "saved" })
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

  it("keeps organizations active for a people-only Congress snapshot", async () => {
    const organizationId = "organization:congress:people-only-refresh"
    const congressPersonId = "person:congress:people-only-refresh"
    await database.insert(schema.organizations).values({
      childRelationsComplete: true,
      classification: "committee",
      detailFactsComplete: false,
      id: organizationId,
      isActive: true,
      jurisdictionId,
      membershipRelationsComplete: false,
      name: "People-only refresh committee",
      provenanceComplete: true,
      sourceId: "people-only-refresh",
      sourceIsOfficial: true,
      sourceProvider: "congress",
      sourceRetrievedAt: retrievedAt,
      sourceUrl: "https://api.congress.gov/committee/people-only-refresh"
    })

    await replaceEntitySnapshot(database, jurisdictionId, congressDetailSnapshot(congressPersonId, "person.jpg"), {
      replaceOrganizations: false
    })

    await expect(
      database.select().from(schema.organizations).where(eq(schema.organizations.id, organizationId))
    ).resolves.toEqual([expect.objectContaining({ id: organizationId, isActive: true })])
  })

  it("rejects a people-only snapshot that contains organizations or memberships", async () => {
    await expect(
      replaceEntitySnapshot(database, jurisdictionId, snapshot({ complete: true, role: "member" }), {
        replaceOrganizations: false
      })
    ).rejects.toThrow("people-only entity snapshot cannot contain organizations or memberships")
  })

  it("keeps people active during a provider-scoped organization-only replacement", async () => {
    const fixture = tenureFixture("organization-only")
    await replaceEntitySnapshot(database, jurisdictionId, tenureSnapshot(fixture, [fixture.sourceMembershipId]))

    await replaceEntitySnapshot(
      database,
      jurisdictionId,
      organizationOnlyTenureSnapshot(fixture, [fixture.sourceMembershipId]),
      {
        organizationSourceProvider: "openstates",
        replacePeople: false
      }
    )

    await expect(database.select().from(schema.people).where(eq(schema.people.id, fixture.personId))).resolves.toEqual([
      expect.objectContaining({ id: fixture.personId, isActive: true })
    ])
  })

  it("rejects an organization-only snapshot that contains people or terms", async () => {
    const fixture = tenureFixture("invalid-organization-only")
    await expect(
      replaceEntitySnapshot(database, jurisdictionId, tenureSnapshot(fixture, [fixture.sourceMembershipId]), {
        replacePeople: false
      })
    ).rejects.toThrow("organization-only entity snapshot cannot contain people or terms")
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

  it("keeps an uninterrupted source relationship in its original tenure", async () => {
    const fixture = tenureFixture("uninterrupted")
    await replaceEntitySnapshot(database, jurisdictionId, tenureSnapshot(fixture, [fixture.sourceMembershipId]))
    const first = await membershipsForTenure(fixture.organizationId)
    const original = first[0]
    if (original === undefined) {
      throw new Error("Initial tenure membership was not persisted")
    }

    expect(first).toEqual([
      expect.objectContaining({
        isActive: true,
        organizationId: fixture.organizationId,
        personId: fixture.personId,
        role: "member",
        sourceId: fixture.sourceRelationship,
        tenureOrdinal: 1
      })
    ])

    await replaceEntitySnapshot(database, jurisdictionId, tenureSnapshot(fixture, [fixture.sourceMembershipId]))
    const repeated = await membershipsForTenure(fixture.organizationId)

    expect(repeated).toEqual([expect.objectContaining({ id: original.id, isActive: true, tenureOrdinal: 1 })])
  })

  it("keeps a departed source relationship as an inactive original tenure", async () => {
    const fixture = tenureFixture("departure")
    await replaceEntitySnapshot(database, jurisdictionId, tenureSnapshot(fixture, [fixture.sourceMembershipId]))
    const original = (await membershipsForTenure(fixture.organizationId))[0]
    if (original === undefined) {
      throw new Error("Initial tenure membership was not persisted")
    }
    await replaceEntitySnapshot(database, jurisdictionId, tenureSnapshot(fixture, []))

    expect(await membershipsForTenure(fixture.organizationId)).toEqual([
      expect.objectContaining({
        effectiveEndDate: null,
        id: original.id,
        isActive: false,
        tenureOrdinal: 1
      })
    ])
  })

  it("records the detection date when a complete source snapshot ends a tenure", async () => {
    const fixture = tenureFixture("observed-departure")
    await replaceEntitySnapshot(database, jurisdictionId, tenureSnapshot(fixture, [fixture.sourceMembershipId]))
    await replaceEntitySnapshot(database, jurisdictionId, organizationOnlyTenureSnapshot(fixture, []), {
      membershipDetectionDate: "2026-08-27",
      organizationSourceProvider: "openstates",
      replacePeople: false
    })

    expect(await membershipsForTenure(fixture.organizationId)).toEqual([
      expect.objectContaining({
        detectedEndDate: "2026-08-27",
        endedReason: "roster_removal_detected",
        isActive: false,
        tenureOrdinal: 1
      })
    ])
  })

  it("keeps an active tenure when a membership-incomplete snapshot omits memberships", async () => {
    const fixture = tenureFixture("incomplete")
    await replaceEntitySnapshot(database, jurisdictionId, tenureSnapshot(fixture, [fixture.sourceMembershipId]))
    const original = (await membershipsForTenure(fixture.organizationId))[0]
    if (original === undefined) {
      throw new Error("Initial tenure membership was not persisted")
    }

    await replaceEntitySnapshot(
      database,
      jurisdictionId,
      tenureSnapshot(fixture, [], { membershipRelationsComplete: false })
    )

    expect(await membershipsForTenure(fixture.organizationId)).toEqual([
      expect.objectContaining({ id: original.id, isActive: true, tenureOrdinal: 1 })
    ])
  })

  it("creates a second tenure when the same source relationship returns after a departure", async () => {
    const fixture = tenureFixture("rejoin")
    await replaceEntitySnapshot(database, jurisdictionId, tenureSnapshot(fixture, [fixture.sourceMembershipId]))
    const original = (await membershipsForTenure(fixture.organizationId))[0]
    if (original === undefined) {
      throw new Error("Initial tenure membership was not persisted")
    }
    await replaceEntitySnapshot(database, jurisdictionId, tenureSnapshot(fixture, []))
    await replaceEntitySnapshot(database, jurisdictionId, tenureSnapshot(fixture, [fixture.sourceMembershipId]))

    const memberships = await membershipsForTenure(fixture.organizationId)
    const rejoined = memberships.find((membership) => membership.id !== original.id)

    expect(memberships).toHaveLength(2)
    expect(memberships).toContainEqual(expect.objectContaining({ id: original.id, isActive: false, tenureOrdinal: 1 }))
    expect(rejoined).toEqual(
      expect.objectContaining({
        isActive: true,
        organizationId: fixture.organizationId,
        personId: fixture.personId,
        role: "member",
        tenureOrdinal: 2
      })
    )
  })

  it("scopes complete roster replacement to one legislative session", async () => {
    const fixture = tenureFixture("session-scope")
    const session118 = "session:us:118"
    const session119 = "session:us:119"
    await insertSession(database, session118, "118")
    await insertSession(database, session119, "119")
    await replaceEntitySnapshot(database, jurisdictionId, sessionTenureSnapshot(fixture, session118, "2023-03-01"), {
      membershipDetectionDate: "2023-03-01",
      membershipSessionId: session118
    })
    await replaceEntitySnapshot(database, jurisdictionId, sessionTenureSnapshot(fixture, session119, "2025-02-20"), {
      membershipDetectionDate: "2025-02-20",
      membershipSessionId: session119
    })
    await replaceEntitySnapshot(database, jurisdictionId, sessionTenureSnapshot(fixture, session119), {
      membershipDetectionDate: "2025-06-01",
      membershipSessionId: session119
    })

    expect(await membershipsForTenure(fixture.organizationId)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ isActive: true, legislativeSessionId: session118 }),
        expect.objectContaining({
          detectedEndDate: "2025-06-01",
          endedReason: "roster_removal_detected",
          isActive: false,
          legislativeSessionId: session119
        })
      ])
    )
  })

  it("extends a Congress-ended tenure when a later archived edition is discovered", async () => {
    const fixture = tenureFixture("late-edition")
    const sessionId = "session:us:117"
    await insertSession(database, sessionId, "117")
    await replaceEntitySnapshot(database, jurisdictionId, sessionTenureSnapshot(fixture, sessionId, "2021-02-01"), {
      membershipDetectionDate: "2021-02-01",
      membershipSessionId: sessionId
    })
    const original = (await membershipsForTenure(fixture.organizationId))[0]
    if (original === undefined) {
      throw new Error("Initial Congress tenure was not persisted")
    }
    await database
      .update(schema.organizationMemberships)
      .set({ endedReason: "congress_ended", isActive: false })
      .where(eq(schema.organizationMemberships.id, original.id))

    await replaceEntitySnapshot(database, jurisdictionId, sessionTenureSnapshot(fixture, sessionId, "2021-08-15"), {
      membershipDetectionDate: "2021-08-15",
      membershipSessionId: sessionId
    })

    expect(await membershipsForTenure(fixture.organizationId)).toEqual([
      expect.objectContaining({
        detectedStartDate: "2021-02-01",
        endedReason: null,
        id: original.id,
        isActive: true,
        lastObservedDate: "2021-08-15",
        tenureOrdinal: 1
      })
    ])
  })

  it("rejects duplicate incoming source relationships without changing the active tenure", async () => {
    const fixture = tenureFixture("duplicate")
    await replaceEntitySnapshot(database, jurisdictionId, tenureSnapshot(fixture, [fixture.sourceMembershipId]))
    const original = (await membershipsForTenure(fixture.organizationId))[0]
    if (original === undefined) {
      throw new Error("Initial tenure membership was not persisted")
    }

    await expect(
      replaceEntitySnapshot(
        database,
        jurisdictionId,
        tenureSnapshot(fixture, [fixture.sourceMembershipId, `${fixture.sourceMembershipId}:duplicate`])
      )
    ).rejects.toThrow(/duplicate/i)

    expect(await membershipsForTenure(fixture.organizationId)).toEqual([
      expect.objectContaining({ id: original.id, isActive: true, tenureOrdinal: 1 })
    ])
  })
})

interface TenureFixture {
  organizationId: string
  personId: string
  sourceMembershipId: string
  sourceRelationship: string
}

function tenureFixture(scope: string): TenureFixture {
  const organizationId = `organization:openstates:tenure-${scope}`
  const personId = `person:openstates:tenure-${scope}`
  return {
    organizationId,
    personId,
    sourceMembershipId: `${organizationId}:membership:source-relationship`,
    sourceRelationship: `ocd-organization/tenure-${scope}:ocd-person/tenure-${scope}:member`
  }
}

function tenureSnapshot(
  fixture: TenureFixture,
  membershipIds: readonly string[],
  options: Readonly<{ membershipRelationsComplete?: boolean }> = {}
) {
  const provenance = {
    provenanceComplete: true,
    sourceIsOfficial: false,
    sourceProvider: "openstates",
    sourceRetrievedAt: retrievedAt,
    sourceUrl: `https://legislature.example.test/${fixture.organizationId}`
  }
  return {
    memberships: membershipIds.map((id) => ({
      ...provenance,
      id,
      isActive: true,
      organizationId: fixture.organizationId,
      personId: fixture.personId,
      role: "member",
      sourceId: fixture.sourceRelationship
    })),
    organizations: [
      {
        ...provenance,
        childRelationsComplete: true,
        classification: "committee",
        detailFactsComplete: true,
        id: fixture.organizationId,
        isActive: true,
        jurisdictionId,
        membershipRelationsComplete: options.membershipRelationsComplete ?? true,
        name: "Tenure refresh committee",
        sourceId: fixture.organizationId
      }
    ],
    people: [
      {
        ...provenance,
        id: fixture.personId,
        isActive: true,
        jurisdictionId,
        name: "Tenure Refresh",
        sourceId: fixture.personId,
        upstreamIds: { openstates: fixture.personId }
      }
    ],
    personAliasPersonIds: [],
    personAliases: [],
    terms: []
  }
}

function organizationOnlyTenureSnapshot(fixture: TenureFixture, membershipIds: readonly string[]) {
  const snapshot = tenureSnapshot(fixture, membershipIds)
  return {
    ...snapshot,
    people: [],
    terms: []
  }
}

function sessionTenureSnapshot(fixture: TenureFixture, sessionId: string, detectedAt?: string) {
  const snapshot = tenureSnapshot(fixture, detectedAt === undefined ? [] : [fixture.sourceMembershipId])
  return {
    ...snapshot,
    memberships: snapshot.memberships.map((membership) => ({
      ...membership,
      detectedStartDate: detectedAt,
      id: `${fixture.sourceMembershipId}:${sessionId}`,
      lastObservedDate: detectedAt,
      legislativeSessionId: sessionId,
      sourceId: `${sessionId}:${fixture.sourceRelationship}`
    }))
  }
}

async function insertSession(database: LegislationDatabase, id: string, identifier: string): Promise<void> {
  await database
    .insert(schema.legislativeSessions)
    .values({ id, identifier, jurisdictionId, name: `${identifier}th Congress` })
    .onConflictDoNothing()
}

function congressDetailSnapshot(personId: string, imageName: string) {
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
        name: "Detail Refresh",
        sourceId: bioguideId,
        upstreamIds: { bioguide: bioguideId }
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
        sourceIdentity: `congress:${bioguideId}:jurisdiction:us`
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
