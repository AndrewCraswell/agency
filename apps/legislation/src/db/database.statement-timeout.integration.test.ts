import { randomUUID } from "node:crypto"
import pg from "pg"
import { afterEach, describe, expect, it } from "vitest"
import { createDatabase } from "./database.js"

const databaseUrl = process.env.LEGISLATION_TEST_DATABASE_URL
const databaseConnectionString = databaseUrl ?? "postgresql://legislation:legislation@127.0.0.1:55432/legislation_test"
const describePostgres = databaseUrl === undefined ? describe.skip : describe
const pools = new Set<pg.Pool>()

afterEach(async () => {
  await Promise.all([...pools].map(async (pool) => await pool.end()))
  pools.clear()
})

describePostgres("PostgreSQL statement deadlines", () => {
  it("cancels timed-out work at PostgreSQL and leaves no active statement behind", async () => {
    const applicationName = `legislation-statement-timeout-${randomUUID()}`
    const { pool } = createDatabase(
      {
        apiStatementTimeoutMs: 1_000,
        connectionTimeoutMs: 10_000,
        idleTimeoutMs: 30_000,
        maxConnections: 1,
        url: databaseUrlWithApplicationName(databaseConnectionString, applicationName)
      },
      { statementTimeoutMs: 1_000 }
    )
    const observer = new pg.Pool({
      connectionString: databaseUrlWithApplicationName(databaseConnectionString, `${applicationName}-observer`),
      max: 1
    })
    pools.add(pool)
    pools.add(observer)

    await expect(pool.query("select pg_sleep(2)")).rejects.toMatchObject({ code: "57014" })
    await expect(pool.query<{ value: number }>("select 1 as value")).resolves.toMatchObject({
      rows: [{ value: 1 }]
    })

    const result = await observer.query<{ active: number }>(
      "select count(*)::integer as active from pg_stat_activity where application_name = $1 and state = 'active'",
      [applicationName]
    )

    expect(result.rows).toEqual([{ active: 0 }])
  })
})

function databaseUrlWithApplicationName(value: string, applicationName: string): string {
  const url = new URL(value)
  url.searchParams.set("application_name", applicationName)
  return url.toString()
}
