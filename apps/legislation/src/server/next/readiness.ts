import type pg from "pg"
import { databasePoolSnapshot } from "../../db/database.js"
import { isDatabaseReady } from "../../db/readiness.js"

export interface NextDatabaseReadiness {
  check(): Promise<boolean>
  details(): Readonly<{ databasePool: ReturnType<typeof databasePoolSnapshot> }>
}

export function createNextDatabaseReadiness(pool: pg.Pool): NextDatabaseReadiness {
  return {
    check: async () => await isDatabaseReady(pool),
    details: () => ({ databasePool: databasePoolSnapshot(pool) })
  }
}
