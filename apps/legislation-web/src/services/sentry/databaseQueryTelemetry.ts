import { AsyncLocalStorage } from "node:async_hooks"
import { databasePoolSnapshot } from "@repo/legislation-core/database/database"
import type { DatabaseConnectionObservation } from "@repo/legislation-core/database/database"
import { postgresErrorCode } from "@repo/legislation-core/domain/errors"
import * as Sentry from "@sentry/core"
import type pg from "pg"
import type { DatabasePoolName, DatabaseQueryName } from "./databaseQueryNames"

export type { DatabasePoolName, DatabaseQueryName } from "./databaseQueryNames"
const activeDatabaseQuerySpan = new AsyncLocalStorage<Sentry.Span>()
export type DatabaseQueryObserver = <Result>(
  input: Readonly<{ name: DatabaseQueryName; pool: DatabasePoolName; revision: number }>,
  operation: () => Promise<Result>
) => Promise<Result>

export const observeDatabaseQueryWithoutTelemetry: DatabaseQueryObserver = async (_input, operation) =>
  await operation()

export function createDatabaseQueryObserver(
  pools: Readonly<{ canonical: pg.Pool; passageSearch?: pg.Pool }>
): DatabaseQueryObserver {
  return async (input, operation) => {
    const pool = input.pool === "canonical" ? pools.canonical : pools.passageSearch
    if (pool === undefined) {
      throw new Error(`Database telemetry pool is unavailable: ${input.pool}`)
    }
    const before = databasePoolSnapshot(pool)
    return await Sentry.startSpan(
      {
        name: input.name,
        op: "db.query",
        attributes: {
          "db.pool.active": before.active,
          "db.pool.idle": before.idle,
          "db.pool.maximum": before.maximum,
          "db.pool.name": input.pool,
          "db.pool.saturation": before.saturation,
          "db.pool.total": before.total,
          "db.pool.waiting": before.waiting,
          "db.query.name": input.name,
          "db.query.revision": input.revision
        }
      },
      async (span) => {
        const startedAt = performance.now()
        try {
          const result = await activeDatabaseQuerySpan.run(span, operation)
          span.setStatus({ code: 1 })
          const resultCount = databaseResultCount(result)
          if (resultCount !== undefined) {
            span.setAttribute("db.result_count", resultCount)
          }
          return result
        } catch (error) {
          span.setStatus({ code: 2, message: "database_query_failed" })
          const code = postgresErrorCode(error)
          if (code !== undefined) {
            span.setAttribute("db.error_code", code)
          }
          throw error
        } finally {
          const after = databasePoolSnapshot(pool)
          span.setAttributes({
            "db.duration_ms": Math.round(performance.now() - startedAt),
            "db.pool.active_after": after.active,
            "db.pool.idle_after": after.idle,
            "db.pool.saturation_after": after.saturation,
            "db.pool.total_after": after.total,
            "db.pool.waiting_after": after.waiting
          })
        }
      }
    )
  }
}

export function recordDatabaseConnectionAcquired(
  pool: DatabasePoolName,
  observation: DatabaseConnectionObservation
): void {
  const span = activeDatabaseQuerySpan.getStore()
  if (pool === "canonical") {
    span?.setAttribute("db.connection_wait.canonical_ms", observation.durationMs)
  } else {
    span?.setAttribute("db.connection_wait.passage_search_ms", observation.durationMs)
  }
}

function databaseResultCount(result: unknown): number | undefined {
  if (Array.isArray(result)) {
    return result.length
  }
  if (typeof result !== "object" || result === null) {
    return undefined
  }
  for (const field of ["items", "events", "rows"] as const) {
    const value = Reflect.get(result, field)
    if (Array.isArray(value)) {
      return value.length
    }
  }
  return undefined
}
