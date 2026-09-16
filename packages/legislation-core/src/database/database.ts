import { drizzle } from "drizzle-orm/node-postgres"
import pg from "pg"
import * as schema from "./schema/schema"

export type DatabaseConfig = Readonly<{
  url: string
  connectionTimeoutMs: number
  idleTimeoutMs: number
  maxConnections: number
}>

export interface DatabaseSessionOptions {
  /** PostgreSQL-enforced deadline that cancels an in-flight statement. */
  statementTimeoutMs?: number
  synchronousCommit?: "off"
}

export function createDatabase(config: DatabaseConfig, session: DatabaseSessionOptions = {}) {
  assertStatementTimeout(session.statementTimeoutMs)
  const pool = new pg.Pool({
    connectionString: config.url,
    connectionTimeoutMillis: config.connectionTimeoutMs,
    idleTimeoutMillis: config.idleTimeoutMs,
    max: config.maxConnections,
    options: session.synchronousCommit === "off" ? "-c synchronous_commit=off" : undefined,
    statement_timeout: session.statementTimeoutMs
  })

  return {
    database: drizzle(pool, { schema }),
    pool
  }
}

function assertStatementTimeout(value: number | undefined): void {
  if (value === undefined) {
    return
  }
  if (!Number.isSafeInteger(value) || value < 1_000 || value > 60_000) {
    throw new RangeError("statementTimeoutMs must be a safe integer from 1000 through 60000")
  }
}

export type LegislationDatabase = Omit<ReturnType<typeof createDatabase>["database"], "$client">

export async function withReadOnlyDatabase<Result>(
  pool: pg.Pool,
  statementTimeoutMs: number,
  operation: (database: LegislationDatabase) => Promise<Result>
): Promise<Result> {
  assertStatementTimeout(statementTimeoutMs)
  const client = await pool.connect()
  let discard = false
  try {
    await client.query("BEGIN READ ONLY")
    await client.query(
      "SELECT set_config('statement_timeout', $1, true), set_config('idle_in_transaction_session_timeout', '35000', true)",
      [String(statementTimeoutMs)]
    )
    const result = await operation(drizzle(client, { schema }))
    await client.query("COMMIT")
    return result
  } catch (error) {
    try {
      await client.query("ROLLBACK")
    } catch {
      discard = true
    }
    throw error
  } finally {
    client.release(discard)
  }
}

export function databasePoolSnapshot(pool: pg.Pool) {
  const maximum = pool.options.max
  const active = Math.max(pool.totalCount - pool.idleCount, 0)
  return {
    active,
    idle: pool.idleCount,
    maximum,
    saturation: maximum > 0 ? active / maximum : 0,
    total: pool.totalCount,
    waiting: pool.waitingCount
  }
}
