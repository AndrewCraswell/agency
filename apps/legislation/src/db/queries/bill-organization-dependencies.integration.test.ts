import { resolve } from "node:path"
import { eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import pg from "pg"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { importOpenStatesRecords } from "../../ingestion/openstates/import.js"
import { normalizeOpenStatesBill } from "../../ingestion/openstates/normalize.js"
import * as schema from "../schema/schema.js"
import { upsertBillAggregate } from "./bill-aggregates.js"

const databaseUrl = process.env.LEGISLATION_TEST_DATABASE_URL
const describePostgres = databaseUrl === undefined ? describe.skip : describe
if (databaseUrl !== undefined && new URL(databaseUrl).pathname !== "/legislation_test") {
  throw new Error("LEGISLATION_TEST_DATABASE_URL must target the legislation_test database")
}

describePostgres.sequential("OpenStates bill organization import ordering", () => {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 2 })
  const database = drizzle(pool, { schema })
  const context = { jurisdictionCode: "wa", jurisdictionName: "Washington" }
  const sourceOrganization = { classification: "lower", id: "ocd-organization/import-order", name: "House" }
  const source = {
    id: "ocd-bill/import-order",
    identifier: "HB 9987",
    legislative_session: "2025-2026",
    title: "Explicit organization relationships",
    from_organization: sourceOrganization,
    sources: [{ url: "https://leg.wa.gov/bills/9987" }]
  }
  const aggregate = normalizeOpenStatesBill(source, context).aggregate
  const bareSource = { ...source, from_organization: sourceOrganization.id }
  const organizationId = "organization:openstates:ocd-organization-import-order"

  beforeAll(async () => {
    await pool.query("drop schema if exists legislation cascade")
    await pool.query("drop schema if exists legislation_migrations cascade")
    await migrate(database, {
      migrationsFolder: resolve(process.cwd(), "src/db/migrations"),
      migrationsSchema: "legislation_migrations",
      migrationsTable: "migrations"
    })
  })

  afterAll(async () => {
    await pool.query("drop schema if exists legislation cascade")
    await pool.query("drop schema if exists legislation_migrations cascade")
    await pool.end()
  })

  it("rolls back a single bill instead of committing a missing organization relation", async () => {
    await expect(
      upsertBillAggregate(database, normalizeOpenStatesBill(bareSource, context).aggregate)
    ).rejects.toMatchObject({
      category: "dependency_unavailable"
    })
    await expect(database.select().from(schema.bills).where(eq(schema.bills.id, aggregate.bill.id))).resolves.toEqual(
      []
    )
  })

  it("retains the batch checkpoint and replays the explicit relation after entity import", async () => {
    const options = { concurrency: 1, contentHash: "d".repeat(64), stream: "wa-organization-dependency" }
    const failed = await importOpenStatesRecords(database, context, [bareSource], options)
    expect(failed).toMatchObject({
      checkpoint: { complete: false, index: 0 },
      counts: { failed: 1, inserted: 0 },
      failures: [{ retryable: true }]
    })
    await database.insert(schema.jurisdictions).values(aggregate.jurisdiction)
    await database.insert(schema.organizations).values({
      id: organizationId,
      jurisdictionId: aggregate.jurisdiction.id,
      sourceId: sourceOrganization.id,
      name: sourceOrganization.name,
      classification: "chamber",
      chamber: "lower"
    })
    const replay = await importOpenStatesRecords(database, context, [bareSource], options)
    expect(replay).toMatchObject({ checkpoint: { complete: true, index: 1 }, counts: { failed: 0, inserted: 1 } })
    await expect(
      database.select().from(schema.billOrganizations).where(eq(schema.billOrganizations.billId, aggregate.bill.id))
    ).resolves.toMatchObject([{ organizationId, classification: "origin" }])
  })

  it("preserves a committed bill and its links when a refresh references an unavailable entity", async () => {
    await expect(
      upsertBillAggregate(database, {
        ...aggregate,
        bill: { ...aggregate.bill, title: "Uncommitted refresh" },
        organizations: [
          {
            billId: aggregate.bill.id,
            classification: "action",
            organizationId: "organization:openstates:ocd-organization-not-imported"
          }
        ]
      })
    ).rejects.toMatchObject({ category: "dependency_unavailable" })
    await expect(
      database.select({ title: schema.bills.title }).from(schema.bills).where(eq(schema.bills.id, aggregate.bill.id))
    ).resolves.toEqual([{ title: source.title }])
    await expect(
      database.select().from(schema.billOrganizations).where(eq(schema.billOrganizations.billId, aggregate.bill.id))
    ).resolves.toMatchObject([{ organizationId, classification: "origin" }])
  })

  it("inserts embedded organizations before batch relations while preserving existing directory facts", async () => {
    const embeddedSource = {
      ...source,
      from_organization: { ...sourceOrganization, name: "Older embedded name" },
      actions: [
        {
          description: "Referred to committee",
          organization: { id: "ocd-organization/embedded-committee", classification: "committee", name: "Rules" }
        }
      ]
    }
    const imported = await importOpenStatesRecords(database, context, [embeddedSource], {
      concurrency: 1,
      contentHash: "e".repeat(64),
      stream: "wa-embedded-organizations"
    })
    expect(imported.counts.failed).toBe(0)
    await expect(
      database
        .select({ name: schema.organizations.name })
        .from(schema.organizations)
        .where(eq(schema.organizations.id, organizationId))
    ).resolves.toEqual([{ name: "House" }])
    await expect(
      database
        .select()
        .from(schema.organizations)
        .where(eq(schema.organizations.id, "organization:openstates:ocd-organization-embedded-committee"))
    ).resolves.toMatchObject([
      {
        name: "Rules",
        classification: "committee",
        detailFactsComplete: false,
        membershipRelationsComplete: false
      }
    ])
    await expect(
      database.select().from(schema.billOrganizations).where(eq(schema.billOrganizations.billId, aggregate.bill.id))
    ).resolves.toHaveLength(2)
  })

  it("inserts a source-resolved organization before a single aggregate's relationships", async () => {
    const single = normalizeOpenStatesBill(
      {
        ...source,
        identifier: "HB 9986",
        from_organization: { id: "ocd-organization/single-import", name: "Senate", classification: "upper" }
      },
      context
    ).aggregate
    await upsertBillAggregate(database, single)
    await expect(
      database.select().from(schema.billOrganizations).where(eq(schema.billOrganizations.billId, single.bill.id))
    ).resolves.toMatchObject([
      {
        organizationId: "organization:openstates:ocd-organization-single-import",
        classification: "origin"
      }
    ])
  })
})
