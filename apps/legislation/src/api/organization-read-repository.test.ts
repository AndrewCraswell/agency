import { drizzle } from "drizzle-orm/node-postgres"
import pg from "pg"
import { afterAll, describe, expect, it } from "vitest"
import {
  encodeOrganizationCursor,
  buildOrganizationListQuery,
  type OrganizationListInput,
  type OrganizationPage
} from "../db/queries/organization-relationships.js"
import * as schema from "../db/schema/schema.js"
import { OrganizationRepository } from "./organization-read-repository.js"

const pool = new pg.Pool({ connectionString: "postgresql://organization-read-test.invalid/legislation" })
const database = drizzle(pool, { schema })

afterAll(async () => {
  await pool.end()
})

const row = {
  chamber: "lower",
  classification: "committee",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  id: "organization:ca:committee:1",
  isActive: true,
  jurisdictionId: "jurisdiction:ca",
  name: "Rules",
  parentOrganizationId: "organization:ca:house",
  provenanceComplete: false,
  sourceId: "rules",
  sourceIsOfficial: null,
  sourceProvider: null,
  sourceRetrievedAt: null,
  sourceUpdatedAt: null,
  sourceUrl: null,
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  upstreamIds: {}
}

describe("organization collection repository", () => {
  it("forwards the complete top-level filter scope to the existing stable query", () => {
    const cursor = encodeOrganizationCursor(row, "updated-desc", {
      chamber: "lower",
      classification: "committee",
      isActive: true,
      jurisdictionId: "jurisdiction:ca",
      parentOrganizationId: "organization:ca:house",
      query: "rule",
      sort: "updated-desc"
    })
    const input: OrganizationListInput = {
      chamber: "lower",
      classification: "committee",
      cursor,
      isActive: true,
      jurisdictionId: "jurisdiction:ca",
      limit: 10,
      parentOrganizationId: "organization:ca:house",
      query: "rule",
      sort: "updated-desc"
    }
    const generated = buildOrganizationListQuery(database, input).toSQL().sql

    expect(generated).toContain('"organizations"."jurisdiction_id" =')
    expect(generated).toContain('"organizations"."classification" =')
    expect(generated).toContain('"organizations"."parent_organization_id" =')
    expect(generated).toContain('"organizations"."chamber" =')
    expect(generated).toContain('"organizations"."is_active" =')
    expect(generated).toContain('"organizations"."name" ilike')
    expect(generated).toContain('"organizations"."updated_at" <')
    expect(generated).toContain(
      'order by "legislation"."organizations"."updated_at" desc, "legislation"."organizations"."id" asc'
    )
    expect(generated).not.toContain(" offset ")
  })

  it("delegates list reads without filtering incomplete rows in the repository", async () => {
    let received: OrganizationListInput | undefined
    const page: OrganizationPage<typeof row> = { items: [row], truncated: false }
    const repository = new OrganizationRepository({
      listOrganizations: async (input) => {
        received = input
        return page
      }
    })

    await expect(
      repository.listOrganizations({ classification: "committee", jurisdictionId: "jurisdiction:ca" })
    ).resolves.toEqual(page)
    expect(received).toEqual({ classification: "committee", jurisdictionId: "jurisdiction:ca" })
  })
})
