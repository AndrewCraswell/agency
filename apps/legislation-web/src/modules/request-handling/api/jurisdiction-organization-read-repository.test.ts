import * as schema from "@repo/legislation-core/database/schema/schema"
import { drizzle } from "drizzle-orm/node-postgres"
import pg from "pg"
import { afterAll, describe, expect, it } from "vitest"
import { buildJurisdictionOrganizationListQuery } from "../../legislation/persistence/queries/organization-relationships.js"
import {
  buildJurisdictionExistenceQuery,
  JurisdictionOrganizationRepository,
  type JurisdictionOrganizationListInput
} from "./jurisdiction-organization-read-repository.js"

const pool = new pg.Pool({ connectionString: "postgresql://jurisdiction-organization-read-test.invalid/legislation" })
const database = drizzle(pool, { schema })

afterAll(async () => {
  await pool.end()
})

const jurisdictionId = "jurisdiction:ca"

describe("jurisdiction organization repository", () => {
  it("checks the jurisdiction parent before returning a collection", () => {
    const generated = buildJurisdictionExistenceQuery(database, jurisdictionId).toSQL().sql

    expect(generated).toContain('from "legislation"."jurisdictions"')
    expect(generated).toContain('"jurisdictions"."id" =')
  })

  it("forwards jurisdiction organization filters to the stable existing query", () => {
    const generated = buildJurisdictionOrganizationListQuery(database, jurisdictionId, {
      classification: "committee",
      isActive: true,
      limit: 10,
      parentOrganizationId: "organization:ca:house",
      query: "rules"
    }).toSQL().sql

    expect(generated).toContain('"organizations"."jurisdiction_id" =')
    expect(generated).toContain('"organizations"."classification" =')
    expect(generated).toContain('"organizations"."parent_organization_id" =')
    expect(generated).toContain('"organizations"."is_active" =')
    expect(generated).toContain('"organizations"."name" ilike')
    expect(generated).toContain(
      'order by "legislation"."organizations"."name" asc, "legislation"."organizations"."id" asc'
    )
    expect(generated).not.toContain(" offset ")
  })

  it("uses fixed classifications for commissions and committees", async () => {
    const received: JurisdictionOrganizationListInput[] = []
    const repository = new JurisdictionOrganizationRepository({
      jurisdictionExists: async () => true,
      listJurisdictionOrganizations: async () => ({ items: [], truncated: false }),
      listJurisdictionOrganizationsByClassification: async (_id, classification, input) => {
        received.push({
          ...input,
          classification,
          collection: classification === "commission" ? "commissions" : "committees",
          jurisdictionId
        } as JurisdictionOrganizationListInput)
        return { items: [], truncated: false }
      }
    })

    await repository.listOrganizations({ collection: "commissions", isActive: true, jurisdictionId, query: "audit" })
    await repository.listOrganizations({
      chamber: "lower",
      collection: "committees",
      jurisdictionId,
      parentOrganizationId: "organization:ca:house"
    })

    expect(received).toEqual([
      {
        classification: "commission",
        collection: "commissions",
        isActive: true,
        jurisdictionId,
        query: "audit"
      },
      {
        chamber: "lower",
        classification: "committee",
        collection: "committees",
        jurisdictionId,
        parentOrganizationId: "organization:ca:house"
      }
    ])
  })

  it("does not list when the jurisdiction parent is absent", async () => {
    let listed = false
    const repository = new JurisdictionOrganizationRepository({
      jurisdictionExists: async () => false,
      listJurisdictionOrganizations: async () => {
        listed = true
        return { items: [], truncated: false }
      },
      listJurisdictionOrganizationsByClassification: async () => ({ items: [], truncated: false })
    })

    await expect(repository.assertJurisdictionExists(jurisdictionId)).rejects.toMatchObject({ category: "not_found" })
    expect(listed).toBe(false)
  })
})
