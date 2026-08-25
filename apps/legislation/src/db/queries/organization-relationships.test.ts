import { drizzle } from "drizzle-orm/node-postgres"
import pg from "pg"
import { afterAll, describe, expect, it } from "vitest"
import * as schema from "../schema/schema.js"
import {
  buildJurisdictionClassificationOrganizationListQuery,
  buildOrganizationBillListQuery,
  buildOrganizationListQuery,
  buildOrganizationMembershipListQuery,
  buildOrganizationMembershipLookupQuery,
  encodeBillCursor,
  encodeMembershipCursor,
  encodeOrganizationCursor,
  listOrganizations
} from "./organization-relationships.js"

const pool = new pg.Pool({ connectionString: "postgresql://organization-relationships-test.invalid/legislation" })
const database = drizzle(pool, { schema })

const organizationDetailDefaults = {
  childRelationsComplete: false,
  description: null,
  detailFactsComplete: false,
  membershipRelationsComplete: false,
  publicContactAddress: null,
  publicContactEmail: null,
  publicContactPhone: null,
  termsOfReference: null,
  websiteUrl: null
} as const

afterAll(async () => {
  await pool.end()
})

describe("organization collection queries", () => {
  it("scopes organizations to a jurisdiction and applies a strict name keyset", () => {
    const cursor = encodeOrganizationCursor(
      {
        ...organizationDetailDefaults,
        id: "organization:ak:committee:1",
        jurisdictionId: "jurisdiction:ak",
        parentOrganizationId: null,
        sourceId: "committee:1",
        name: "Rules",
        classification: "committee",
        chamber: "lower",
        isActive: true,
        provenanceComplete: false,
        sourceIsOfficial: null,
        sourceProvider: null,
        sourceRetrievedAt: null,
        sourceUrl: null,
        sourceUpdatedAt: null,
        upstreamIds: {},
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z")
      },
      "name-asc",
      {
        chamber: "lower",
        classification: "committee",
        isActive: true,
        jurisdictionId: "jurisdiction:ak",
        parentOrganizationId: "organization:ak:house",
        query: "rule",
        sort: "name-asc"
      }
    )
    const query = buildOrganizationListQuery(database, {
      chamber: "lower",
      classification: "committee",
      cursor,
      isActive: true,
      jurisdictionId: "jurisdiction:ak",
      limit: 10,
      parentOrganizationId: "organization:ak:house",
      query: "rule",
      sort: "name-asc"
    })
    const generated = query.toSQL().sql

    expect(generated).toContain('"organizations"."jurisdiction_id" =')
    expect(generated).toContain('"organizations"."classification" =')
    expect(generated).toContain('"organizations"."parent_organization_id" =')
    expect(generated).toContain('"organizations"."name" ilike')
    expect(generated).toContain('"organizations"."name" >')
    expect(generated).toContain(
      'order by "legislation"."organizations"."name" asc, "legislation"."organizations"."id" asc'
    )
    expect(generated).not.toContain(" offset ")
    expect(generated).toContain("limit $")
  })

  it("preserves multi-value universal filters and the canonical updated-at interval", () => {
    const generated = buildOrganizationListQuery(database, {
      classifications: ["committee", "commission"],
      jurisdictionIds: ["jurisdiction:ca", "jurisdiction:ny"],
      parentOrganizationIds: ["organization:ca:house", "organization:ny:senate"],
      updatedFrom: new Date("2026-08-01T00:00:00.000Z"),
      updatedToExclusive: new Date("2026-09-01T00:00:00.000Z")
    }).toSQL().sql

    expect(generated).toContain('"organizations"."jurisdiction_id" in')
    expect(generated).toContain('"organizations"."classification" in')
    expect(generated).toContain('"organizations"."parent_organization_id" in')
    expect(generated).toContain('"organizations"."updated_at" >=')
    expect(generated).toContain('"organizations"."updated_at" <')
  })

  it("binds updated-at bounds into the pagination cursor scope", () => {
    const updatedFrom = new Date("2026-08-01T00:00:00.000Z")
    const updatedToExclusive = new Date("2026-09-01T00:00:00.000Z")
    const scope = {
      chamber: null,
      classification: null,
      isActive: null,
      jurisdictionId: null,
      parentOrganizationId: null,
      query: null,
      sort: "updated-desc" as const,
      updatedFrom: updatedFrom.toISOString(),
      updatedTo: null,
      updatedToExclusive: updatedToExclusive.toISOString()
    }
    const cursor = Buffer.from(
      JSON.stringify({
        id: "organization:ca:committee:1",
        scope,
        sort: "updated-desc",
        updatedAt: "2026-01-01T00:00:00.000Z",
        version: 1
      })
    ).toString("base64url")
    const base = { cursor, sort: "updated-desc" as const, updatedFrom, updatedToExclusive }

    expect(() => buildOrganizationListQuery(database, base)).not.toThrow()
    expect(() =>
      buildOrganizationListQuery(database, { ...base, updatedFrom: new Date("2026-08-02T00:00:00.000Z") })
    ).toThrow("Invalid organization pagination cursor")
  })

  it("keeps commission and committee views as jurisdiction-scoped classification filters", () => {
    const generated = buildJurisdictionClassificationOrganizationListQuery(database, "jurisdiction:ca", "commission", {
      isActive: true
    }).toSQL().sql

    expect(generated).toContain('"organizations"."jurisdiction_id" =')
    expect(generated).toContain('"organizations"."classification" =')
    expect(generated).toContain('"organizations"."is_active" =')
    expect(generated).not.toContain('"organizations"."classification" in')
  })
})

describe("organization membership queries", () => {
  it("preserves historical rows and uses role, person, and ID keyset order", () => {
    const generated = buildOrganizationMembershipListQuery(database, {
      from: "2024-01-01",
      isCurrent: false,
      limit: 20,
      organizationId: "organization:ak:committee:1",
      role: "member",
      to: "2026-01-01"
    }).toSQL().sql

    expect(generated).toContain('"organization_memberships"."organization_id" =')
    expect(generated).toContain('"organization_memberships"."role" =')
    expect(generated).toContain('"organization_memberships"."provenance_complete" =')
    expect(generated).toContain('"organization_memberships"."is_active" =')
    expect(generated).toContain('coalesce("legislation"."organization_memberships"."end_date"')
    expect(generated).toContain('coalesce("legislation"."organization_memberships"."start_date"')
    expect(generated).toContain("order by coalesce")
    expect(generated).toContain('"legislation"."people"."name" asc')
    expect(generated).toContain('"legislation"."organization_memberships"."id" asc')
    expect(generated).not.toContain(" offset ")
  })

  it("scopes direct membership lookup by both path identifiers", () => {
    const generated = buildOrganizationMembershipLookupQuery(
      database,
      "organization:ak:committee:1",
      "membership:ak:committee:1:person:1"
    ).toSQL().sql

    expect(generated).toContain('"organization_memberships"."organization_id" =')
    expect(generated).toContain('"organization_memberships"."id" =')
    expect(generated).toContain("limit $")
  })
})

describe("organization bill queries", () => {
  it("uses persisted bill links, deduplicates through exists, and orders by latest activity", () => {
    const generated = buildOrganizationBillListQuery(database, {
      from: "2026-01-01",
      limit: 15,
      organizationId: "organization:ak:committee:1",
      relationship: "referred-to",
      sessionId: "session:ak:2026",
      status: "pending",
      to: "2026-12-31"
    }).toSQL().sql

    expect(generated).toContain('exists (select 1 from "legislation"."bill_organizations"')
    expect(generated).toContain('"bill_organizations"."organization_id" =')
    expect(generated).toContain('"bill_organizations"."classification" =')
    expect(generated).toContain("left join lateral")
    expect(generated).toContain("max(coalesce")
    expect(generated).toContain("order by coalesce")
    expect(generated).toContain('"legislation"."bills"."id" asc')
    expect(generated).not.toContain(" offset ")
  })
})

describe("organization pagination validation", () => {
  it("rejects a cursor encoded for another organization sort or filter scope", async () => {
    const cursor = encodeOrganizationCursor(
      {
        ...organizationDetailDefaults,
        id: "organization:ak:committee:1",
        jurisdictionId: "jurisdiction:ak",
        parentOrganizationId: null,
        sourceId: "committee:1",
        name: "Rules",
        classification: "committee",
        chamber: null,
        isActive: true,
        provenanceComplete: false,
        sourceIsOfficial: null,
        sourceProvider: null,
        sourceRetrievedAt: null,
        sourceUrl: null,
        sourceUpdatedAt: null,
        upstreamIds: {},
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z")
      },
      "name-asc",
      {
        chamber: null,
        classification: null,
        isActive: null,
        jurisdictionId: null,
        parentOrganizationId: null,
        query: null,
        sort: "name-asc"
      }
    )
    await expect(listOrganizations(database, { cursor, sort: "updated-desc" })).rejects.toMatchObject({
      category: "invalid_request"
    })
    await expect(listOrganizations(database, { limit: 0 })).rejects.toMatchObject({ category: "invalid_request" })

    const scopedCursor = encodeOrganizationCursor(
      {
        ...organizationDetailDefaults,
        id: "organization:ak:committee:1",
        jurisdictionId: "jurisdiction:ak",
        parentOrganizationId: null,
        sourceId: "committee:1",
        name: "Rules",
        classification: "committee",
        chamber: null,
        isActive: true,
        provenanceComplete: false,
        sourceIsOfficial: null,
        sourceProvider: null,
        sourceRetrievedAt: null,
        sourceUrl: null,
        sourceUpdatedAt: null,
        upstreamIds: {},
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z")
      },
      "name-asc",
      {
        chamber: null,
        classification: "committee",
        isActive: null,
        jurisdictionId: "jurisdiction:ak",
        parentOrganizationId: null,
        query: null,
        sort: "name-asc"
      }
    )
    await expect(
      listOrganizations(database, { classification: "subcommittee", cursor: scopedCursor })
    ).rejects.toMatchObject({
      category: "invalid_request"
    })
  })

  it("rejects membership and bill cursors reused across request filters", () => {
    const membershipCursor = encodeMembershipCursor({
      id: "membership:ak:committee:1:person:1",
      personName: "A Person",
      role: "member",
      scope: { from: null, isCurrent: true, organizationId: "organization:ak:committee:1", role: "member", to: null }
    })
    expect(() =>
      buildOrganizationMembershipListQuery(database, {
        cursor: membershipCursor,
        isCurrent: false,
        organizationId: "organization:ak:committee:1"
      })
    ).toThrow("Invalid organization membership pagination cursor")

    const billCursor = encodeBillCursor({
      id: "bill:ak:2026:hb:1",
      scope: {
        from: "2026-01-01",
        organizationId: "organization:ak:committee:1",
        relationship: "referred-to",
        sessionId: "session:ak:2026",
        status: "pending",
        to: "2026-12-31"
      },
      sortAt: "2026-06-01T00:00:00.000Z"
    })
    expect(() =>
      buildOrganizationBillListQuery(database, {
        cursor: billCursor,
        from: "2026-01-01",
        organizationId: "organization:ak:committee:1",
        relationship: "introduced-in",
        sessionId: "session:ak:2026",
        status: "pending",
        to: "2026-12-31"
      })
    ).toThrow("Invalid organization bill pagination cursor")
  })

  it("rejects impossible dates and timestamps before building SQL", () => {
    expect(() =>
      buildOrganizationMembershipListQuery(database, {
        from: "2026-02-30",
        organizationId: "organization:ak:committee:1"
      })
    ).toThrow("from must be an ISO date or RFC3339 timestamp")
    expect(() =>
      buildOrganizationBillListQuery(database, {
        organizationId: "organization:ak:committee:1",
        to: "2026-01-01T25:00:00Z"
      })
    ).toThrow("to must be an ISO date or RFC3339 timestamp")
    expect(() =>
      buildOrganizationBillListQuery(database, {
        from: "2026-03-01",
        organizationId: "organization:ak:committee:1",
        to: "2026-02-28T23:59:59Z"
      })
    ).toThrow("from must be less than or equal to to")
  })

  it("normalizes mixed date and timestamp bounds to the same inclusive day window", () => {
    expect(() =>
      buildOrganizationBillListQuery(database, {
        from: "2026-01-01T12:00:00Z",
        organizationId: "organization:ak:committee:1",
        to: "2026-01-01"
      }).toSQL()
    ).not.toThrow()
    expect(() =>
      buildOrganizationBillListQuery(database, {
        from: "2026-01-02T00:00:00Z",
        organizationId: "organization:ak:committee:1",
        to: "2026-01-01"
      })
    ).toThrow("from must be less than or equal to to")
  })
})
