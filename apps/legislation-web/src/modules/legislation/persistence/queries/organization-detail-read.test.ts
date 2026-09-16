import * as schema from "@repo/legislation-core/database/schema/schema"
import { drizzle } from "drizzle-orm/node-postgres"
import pg from "pg"
import { afterAll, describe, expect, it } from "vitest"
import {
  assertOrganizationDetailComplete,
  buildOrganizationChildrenQuery,
  buildOrganizationDetailLookupQuery,
  type OrganizationDetailOrganizationRow
} from "./organization-detail-read.js"

const pool = new pg.Pool({ connectionString: "postgresql://organization-detail-read-test.invalid/legislation" })
const database = drizzle(pool, { schema })

afterAll(async () => {
  await pool.end()
})

function organizationRow(
  overrides: Partial<OrganizationDetailOrganizationRow> = {}
): OrganizationDetailOrganizationRow {
  return {
    chamber: "lower",
    childRelationsComplete: true,
    classification: "committee",
    createdAt: new Date("2026-08-20T15:00:00.000Z"),
    description: null,
    detailFactsComplete: true,
    id: "organization:us:rules",
    isActive: true,
    jurisdictionId: "jurisdiction:us",
    membershipRelationsComplete: true,
    name: "Rules Committee",
    parentOrganizationId: null,
    provenanceComplete: true,
    publicContactAddress: null,
    publicContactEmail: null,
    publicContactPhone: null,
    sourceId: "HSRU00",
    sourceIsOfficial: true,
    sourceProvider: "congress",
    sourceRetrievedAt: new Date("2026-08-20T15:00:00.000Z"),
    sourceUpdatedAt: null,
    sourceUrl: "https://api.congress.gov/committee/house-rules/HSRU00",
    termsOfReference: null,
    updatedAt: new Date("2026-08-20T15:00:00.000Z"),
    upstreamIds: { congress: "HSRU00" },
    websiteUrl: null,
    ...overrides
  }
}

describe("organization detail read query", () => {
  it("uses exact parent lookup and deterministic bounded child SQL", () => {
    const lookupSql = buildOrganizationDetailLookupQuery(database, "organization:us:rules").toSQL().sql
    const childrenSql = buildOrganizationChildrenQuery(database, "organization:us:rules").toSQL().sql

    expect(lookupSql).toContain('where "legislation"."organizations"."id" =')
    expect(childrenSql).toContain('where "legislation"."organizations"."parent_organization_id" =')
    expect(childrenSql).toContain(
      'order by "legislation"."organizations"."name" asc, "legislation"."organizations"."id" asc'
    )
    expect(childrenSql).toContain("limit")
  })

  it("requires persisted profile and complete source relationship sets before projection", () => {
    expect(() => assertOrganizationDetailComplete(organizationRow())).not.toThrow()
    expect(() => assertOrganizationDetailComplete(organizationRow({ detailFactsComplete: false }))).toThrow(
      "source-complete detail profile"
    )
    expect(() => assertOrganizationDetailComplete(organizationRow({ childRelationsComplete: false }))).toThrow(
      "source-complete child relationships"
    )
    expect(() => assertOrganizationDetailComplete(organizationRow({ membershipRelationsComplete: false }))).toThrow(
      "source-complete memberships"
    )
    expect(() => assertOrganizationDetailComplete(organizationRow({ provenanceComplete: false }))).toThrow(
      "not canonically complete"
    )
  })
})
