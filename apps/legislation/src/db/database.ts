import { drizzle } from "drizzle-orm/node-postgres"
import pg from "pg"
import type { LegislationConfig } from "../config/config.js"
import * as schema from "./schema/schema.js"

export interface DatabaseSessionOptions {
  synchronousCommit?: "off"
}

export function createDatabase(config: LegislationConfig["database"], session: DatabaseSessionOptions = {}) {
  const pool = new pg.Pool({
    connectionString: config.url,
    connectionTimeoutMillis: config.connectionTimeoutMs,
    idleTimeoutMillis: config.idleTimeoutMs,
    max: config.maxConnections,
    options: session.synchronousCommit === "off" ? "-c synchronous_commit=off" : undefined
  })

  return {
    database: drizzle(pool, { schema }),
    pool
  }
}

export type LegislationDatabase = ReturnType<typeof createDatabase>["database"]

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
