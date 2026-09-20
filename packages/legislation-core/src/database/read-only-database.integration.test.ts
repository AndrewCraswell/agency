import assert from "node:assert/strict"
import { setTimeout as delay } from "node:timers/promises"
import { eq, sql } from "drizzle-orm"
import { alias, date, integer, pgTable } from "drizzle-orm/pg-core"
import type pg from "pg"
import { afterEach, describe, expect, it } from "vitest"
import { createDatabase, databasePoolSnapshot, withReadOnlyDatabase } from "./database"
import { createReadOnlyDatabase } from "./read-only-database"

const databaseUrl = process.env.LEGISLATION_CORE_TEST_DATABASE_URL
const describePostgres = databaseUrl === undefined ? describe.skip : describe
const pools = new Set<pg.Pool>()

if (databaseUrl !== undefined) {
  const url = new URL(databaseUrl)
  if (url.pathname !== "/legislation_core_test" || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) {
    throw new Error("LEGISLATION_CORE_TEST_DATABASE_URL must target a local disposable legislation_core_test database")
  }
}

afterEach(async () => {
  await Promise.all([...pools].map((pool) => pool.end()))
  pools.clear()
})

function researchPool() {
  assert(databaseUrl)
  const { pool } = createDatabase(
    { connectionTimeoutMs: 150, idleTimeoutMs: 1000, maxConnections: 1, url: databaseUrl },
    { waitForConnection: true }
  )
  pools.add(pool)
  return pool
}

describePostgres("read-only research database", () => {
  it("waits beyond connection establishment time when capacity is busy and releases cancelled checkouts", async () => {
    const pool = researchPool()
    const held = Promise.withResolvers<void>()
    const acquired = Promise.withResolvers<void>()
    const occupied = withReadOnlyDatabase(pool, 1000, async () => {
      acquired.resolve()
      await held.promise
    })
    await acquired.promise
    const caller = new AbortController()
    const cancelled = withReadOnlyDatabase(pool, 1000, async () => "not called", caller.signal)
    const cancellation = new Error("Stopped while queued")
    const rejection = expect(cancelled).rejects.toBe(cancellation)
    caller.abort(cancellation)
    await rejection
    const pending = withReadOnlyDatabase(pool, 1000, async (database) => database.execute(sql`select 1 as value`))
    await delay(400)
    expect(databasePoolSnapshot(pool)).toMatchObject({ active: 1, waiting: 1 })
    held.resolve()
    await occupied
    await expect(pending).resolves.toMatchObject({ rows: [{ value: 1 }] })
    expect(pool.waitingCount).toBe(0)
    expect(pool.idleCount).toBe(1)
  })

  it("acquires only while executing SQL, preserves driver mapping, and pins explicit transactions", async () => {
    const pool = researchPool()
    const database = createReadOnlyDatabase(pool, 1000)
    expect(pool.totalCount).toBe(0)
    const table = pgTable("research_read_fixture", {
      id: integer("id").notNull(),
      day: date("day", { mode: "string" }).notNull()
    })
    await pool.query("create temporary table research_read_fixture (id integer not null, day date not null)")
    await pool.query("insert into research_read_fixture values (1, '2026-01-02')")
    const other = alias(table, "other")
    const query = database
      .select({ record: { id: table.id, day: table.day }, other: { id: other.id } })
      .from(table)
      .leftJoin(other, sql`false`)
      .where(eq(table.id, sql.placeholder("id")))
      .prepare("read_fixture")
    await expect(query.execute({ id: 1 })).resolves.toEqual([{ record: { id: 1, day: "2026-01-02" }, other: null }])
    expect(pool.idleCount).toBe(1)
    const settings = await database.transaction(
      async (transaction) => {
        await transaction.execute(sql`select set_config('application_name', 'research-scoped-transaction', true)`)
        return await transaction.transaction(
          async (nested) =>
            (
              await nested.execute(sql`select current_setting('application_name') as name,
          current_setting('transaction_read_only') as read_only,
          current_setting('transaction_isolation') as isolation,
          current_setting('statement_timeout') as timeout`)
            ).rows
        )
      },
      { isolationLevel: "repeatable read" }
    )
    expect(settings).toEqual([
      {
        name: "research-scoped-transaction",
        read_only: "on",
        isolation: "repeatable read",
        timeout: "1s"
      }
    ])
    expect(pool.idleCount).toBe(1)
    await expect(
      database.execute(sql`insert into research_read_fixture values (2, '2026-01-03')`)
    ).resolves.toMatchObject({ rowCount: 1 })
    // PostgreSQL permits temporary-table writes even in read-only transactions; permanent writes remain prohibited.
    await expect(
      database.execute(sql`create table public.research_forbidden_write (id integer)`)
    ).rejects.toMatchObject({ cause: { code: "25006" } })
  })

  it("cancels active client work, discards the connection and prevents later SQL", async () => {
    const pool = researchPool()
    const caller = new AbortController()
    const database = createReadOnlyDatabase(pool, 1000, caller.signal)
    const pending = database.execute(sql`select pg_sleep(5)`)
    const cancellation = new Error("Stopped active research")
    const rejection = expect(pending).rejects.toBe(cancellation)
    await delay(100)
    caller.abort(cancellation)
    await rejection
    expect(pool.totalCount).toBe(0)
    await expect(database.execute(sql`select 1`)).rejects.toBe(cancellation)
    await expect(pool.query("select 1 as value")).resolves.toMatchObject({ rows: [{ value: 1 }] })
  })

  it("normalizes genuine SQL deadlines and frees capacity after failure", async () => {
    const pool = researchPool()
    const database = createReadOnlyDatabase(pool, 1000)
    await expect(database.execute(sql`select pg_sleep(2)`)).rejects.toMatchObject({
      category: "dependency_unavailable",
      details: { reason: "timeout", retryable: true }
    })
    expect(pool.totalCount).toBe(0)
    await expect(database.execute(sql`select 1 as value`)).resolves.toMatchObject({ rows: [{ value: 1 }] })
  })
})
