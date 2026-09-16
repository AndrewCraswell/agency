import * as schema from "@repo/legislation-core/database/schema/schema"
import { drizzle } from "drizzle-orm/node-postgres"
import pg from "pg"
import { afterAll, describe, expect, it } from "vitest"
import { assertOpenStatesOrganizationDependencies, insertMissingOrganizationObservations } from "./bill-aggregates.js"

const pool = new pg.Pool({ connectionString: "postgresql://organization-observations.invalid/legislation" })
const database = drizzle(pool, { schema })
afterAll(async () => {
  await pool.end()
})

describe("OpenStates bill organization dependencies", () => {
  it("rejects missing source references as retryable dependencies instead of silently dropping them", () => {
    const missing = "organization:openstates:committee-rules"
    expect(() => assertOpenStatesOrganizationDependencies([missing, missing], new Set())).toThrowError(
      expect.objectContaining({
        category: "dependency_unavailable",
        details: { missingOrganizationIds: [missing] }
      })
    )
  })

  it("permits the same references once their entities have been imported", () => {
    const id = "organization:openstates:committee-rules"
    expect(() => assertOpenStatesOrganizationDependencies([id, id], new Set([id]))).not.toThrow()
  })

  it("does not impose a new dependency contract on other source adapters", () => {
    expect(() => assertOpenStatesOrganizationDependencies(["organization:congress:hsag00"], new Set())).not.toThrow()
    expect(() => assertOpenStatesOrganizationDependencies([], new Set())).not.toThrow()
  })

  it("uses insert-only conflict behavior so existing rich organization rows cannot be overwritten", () => {
    const observation = {
      id: "organization:openstates:rules",
      jurisdictionId: "jurisdiction:wa",
      sourceId: "rules",
      name: "Rules"
    }
    const query = insertMissingOrganizationObservations(database, [observation, observation]).toSQL()
    expect(query.sql).toContain("on conflict do nothing")
    expect(query.sql).not.toContain("do update")
    expect(query.params.filter((value) => value === observation.id)).toHaveLength(1)
  })
})
