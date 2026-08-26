import { resolve } from "node:path"
import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import pg from "pg"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import * as schema from "../db/schema/schema.js"
import { SubscriptionRepositoryError } from "./subscription-repository.js"
import { PostgresWebhookReadRepository } from "./webhook-read-repository.js"

const databaseUrl = process.env.LEGISLATION_TEST_DATABASE_URL
const describePostgres = databaseUrl === undefined ? describe.skip : describe
const migrationsFolder = resolve(process.cwd(), "src/db/migrations")
const now = new Date("2026-08-24T12:00:00.000Z")

describePostgres.sequential("PostgresWebhookReadRepository", () => {
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
    await database.insert(schema.webhooks).values([
      {
        createdAt: now,
        eventTypes: ["vote-added"],
        id: "webhook:organization",
        name: "Organization webhook",
        ownerOrganizationId: "org:one",
        ownerUserId: "user:one",
        revision: "00000000-0000-0000-0000-000000000001",
        secretLastFour: "1111",
        status: "active",
        updatedAt: now,
        url: "https://one.example.test/hook"
      },
      {
        createdAt: new Date("2026-08-24T10:00:00.000Z"),
        eventTypes: ["status-changed"],
        id: "webhook:organization-two",
        name: "Second organization webhook",
        ownerOrganizationId: "org:one",
        ownerUserId: "user:three",
        revision: "00000000-0000-0000-0000-000000000003",
        secretLastFour: "3333",
        status: "active",
        updatedAt: new Date("2026-08-24T10:00:00.000Z"),
        url: "https://two.example.test/hook"
      },
      {
        createdAt: new Date("2026-08-24T11:00:00.000Z"),
        eventTypes: ["status-changed"],
        id: "webhook:personal",
        name: "Personal webhook",
        ownerOrganizationId: null,
        ownerUserId: "user:one",
        revision: "00000000-0000-0000-0000-000000000002",
        secretLastFour: "2222",
        status: "paused",
        updatedAt: new Date("2026-08-24T11:00:00.000Z"),
        url: "https://personal.example.test/hook"
      }
    ])
    await database.insert(schema.webhookSigningKeys).values({
      id: "webhook-key:organization",
      secretCiphertext: "ciphertext",
      webhookId: "webhook:organization"
    })
    await database.insert(schema.webhookSigningKeys).values({
      id: "webhook-key:organization-two",
      secretCiphertext: "ciphertext",
      webhookId: "webhook:organization-two"
    })
  })

  afterAll(async () => {
    await pool.query("drop schema if exists legislation cascade")
    await pool.query("drop schema if exists legislation_migrations cascade")
    await pool.end()
  })

  it("shares organization webhooks, includes the caller personal scope, and binds cursors to every filter", async () => {
    const repository = new PostgresWebhookReadRepository(database, () => now)
    const first = await repository.listWebhooks({ limit: 1, owner: { organizationId: "org:one", userId: "user:two" } })
    expect(first.items).toMatchObject([{ activeKeyIds: ["webhook-key:organization"], id: "webhook:organization" }])
    expect(first.nextCursor).toBeDefined()
    await expect(
      repository.listWebhooks({
        cursor: first.nextCursor,
        limit: 1,
        owner: { organizationId: "org:two", userId: "user:two" }
      })
    ).rejects.toBeInstanceOf(SubscriptionRepositoryError)
    await expect(
      repository.listWebhooks({
        cursor: first.nextCursor,
        limit: 1,
        owner: { organizationId: "org:one", userId: "user:two" },
        status: "active"
      })
    ).rejects.toMatchObject({ category: "invalid_cursor" })
    await expect(
      repository.getWebhook({ id: "webhook:personal", owner: { organizationId: "org:one", userId: "user:two" } })
    ).resolves.toBeUndefined()
  })

  it("fails closed when persisted data does not meet the webhook contract", async () => {
    const repository = new PostgresWebhookReadRepository(database, () => now)
    await pool.query("update legislation.webhooks set name = '   ' where id = 'webhook:organization'")
    await expect(
      repository.getWebhook({ id: "webhook:organization", owner: { organizationId: "org:one", userId: "user:one" } })
    ).rejects.toMatchObject({ category: "invalid_persistence" })
  })
})
