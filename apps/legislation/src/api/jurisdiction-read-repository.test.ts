import { drizzle } from "drizzle-orm/node-postgres"
import pg from "pg"
import { afterAll, describe, expect, it } from "vitest"
import * as schema from "../db/schema/schema.js"
import { LegislationError } from "../legislation/errors.js"
import {
  buildJurisdictionReadQuery,
  JurisdictionRepository,
  type JurisdictionRead
} from "./jurisdiction-read-repository.js"

const pool = new pg.Pool({ connectionString: "postgresql://jurisdiction-read-test.invalid/legislation" })
const database = drizzle(pool, { schema })

afterAll(async () => {
  await pool.end()
})

function jurisdiction(): JurisdictionRead {
  return {
    classification: "state",
    countryCode: "US",
    createdAt: new Date("2026-08-20T15:00:00.000Z"),
    id: "jurisdiction:ca",
    isActive: true,
    name: "California",
    provenanceComplete: true,
    sourceIsOfficial: true,
    sourceProvider: "canonical-foundation",
    sourceRetrievedAt: new Date("2026-08-20T15:00:00.000Z"),
    sourceUpdatedAt: new Date("2026-08-20T14:00:00.000Z"),
    sourceUrl: "https://source.example.test/jurisdictions/ca",
    subdivisionCode: "CA",
    timezone: "America/Los_Angeles",
    updatedAt: new Date("2026-08-20T15:00:00.000Z")
  }
}

describe("jurisdiction detail repository", () => {
  it("binds the canonical jurisdiction ID in the dedicated detail query", () => {
    const generated = buildJurisdictionReadQuery(database, "jurisdiction:ca").toSQL().sql

    expect(generated).toContain('from "legislation"."jurisdictions"')
    expect(generated).toContain('"jurisdictions"."id" =')
    expect(generated).toContain("limit $")
  })

  it("returns the persisted row unchanged and distinguishes absence", async () => {
    let received: string | undefined
    const repository = new JurisdictionRepository({
      findJurisdiction: async (jurisdictionId) => {
        received = jurisdictionId
        return jurisdictionId === "jurisdiction:ca" ? jurisdiction() : undefined
      }
    })

    await expect(repository.getJurisdiction(" jurisdiction:ca ")).resolves.toEqual(jurisdiction())
    expect(received).toBe("jurisdiction:ca")
    await expect(repository.getJurisdiction("jurisdiction:missing")).rejects.toBeInstanceOf(LegislationError)
    await expect(repository.getJurisdiction("jurisdiction:missing")).rejects.toMatchObject({ category: "not_found" })
  })
})
