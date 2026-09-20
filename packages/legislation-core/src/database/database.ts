import * as schema from "@repo/legislation-core/database/schema/schema"
import { LegislationError, normalizeLegislationError, postgresErrorCode } from "@repo/legislation-core/domain/errors"
import { sql } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import type { PgTransactionConfig } from "drizzle-orm/pg-core"
import pg from "pg"
import { ConnectionQueue } from "./connection-queue.js"

const connectionQueues = new WeakMap<pg.Pool, ConnectionQueue>()

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
  /** Keep pool queueing separate from the timeout for opening a new connection. */
  waitForConnection?: boolean
}

export function createDatabase(config: DatabaseConfig, session: DatabaseSessionOptions = {}) {
  assertStatementTimeout(session.statementTimeoutMs)
  const queue = session.waitForConnection ? new ConnectionQueue(config.maxConnections) : undefined
  const pool = new pg.Pool({
    connectionString: config.url,
    connectionTimeoutMillis: config.connectionTimeoutMs,
    idleTimeoutMillis: config.idleTimeoutMs,
    max: config.maxConnections,
    options: session.synchronousCommit === "off" ? "-c synchronous_commit=off" : undefined,
    statement_timeout: session.statementTimeoutMs
  })
  if (queue !== undefined) connectionQueues.set(pool, queue)

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
type ReadOnlyTransaction = Parameters<Parameters<LegislationDatabase["transaction"]>[0]>[0]

export async function withReadOnlyDatabase<Result>(
  pool: pg.Pool,
  statementTimeoutMs: number,
  operation: (database: ReadOnlyTransaction) => Promise<Result>,
  signal?: AbortSignal,
  transactionConfig?: PgTransactionConfig
): Promise<Result> {
  assertStatementTimeout(statementTimeoutMs)
  signal?.throwIfAborted()
  const releaseCapacity = await connectionQueues.get(pool)?.acquire(signal)
  if (signal?.aborted) {
    releaseCapacity?.()
    signal.throwIfAborted()
  }
  const connecting = pool.connect()
  let abort: (() => void) | undefined
  const cancelled = new Promise<never>((_resolve, reject) => {
    abort = () => reject(signal?.reason)
    signal?.addEventListener("abort", abort, { once: true })
  })
  let client: pg.PoolClient
  try {
    client = await Promise.race([connecting, cancelled])
  } catch (error) {
    void connecting.then(
      (lateClient) => {
        lateClient.release()
        releaseCapacity?.()
      },
      () => releaseCapacity?.()
    )
    signal?.throwIfAborted()
    // pg-pool exposes these acquisition timeouts without a structured error code.
    if (
      error instanceof Error &&
      (error.message === "timeout exceeded when trying to connect" ||
        error.message === "Connection terminated due to connection timeout" ||
        error.message === "timeout expired")
    ) {
      throw new LegislationError("dependency_unavailable", "The database connection timed out.", {
        cause: error,
        details: { reason: "timeout", retryable: true }
      })
    }
    throw error
  } finally {
    if (abort) signal?.removeEventListener("abort", abort)
  }
  let released = false
  let discard = false
  const cancel = () => {
    released = true
    client.release(true)
  }
  signal?.addEventListener("abort", cancel, { once: true })
  try {
    signal?.throwIfAborted()
    return await drizzle(client, { schema }).transaction(
      async (transaction) => {
        await transaction.execute(
          sql`SELECT set_config('statement_timeout', ${String(statementTimeoutMs)}, true),
          set_config('idle_in_transaction_session_timeout', '35000', true)`
        )
        const result = await operation(transaction)
        signal?.throwIfAborted()
        return result
      },
      { ...transactionConfig, accessMode: "read only" }
    )
  } catch (error) {
    discard = true
    signal?.throwIfAborted()
    if (postgresErrorCode(error) === "57014") throw normalizeLegislationError(error)
    throw error
  } finally {
    signal?.removeEventListener("abort", cancel)
    if (!released) client.release(discard)
    releaseCapacity?.()
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
    waiting: pool.waitingCount + (connectionQueues.get(pool)?.waitingCount ?? 0)
  }
}
