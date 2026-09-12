import type pg from "pg"
import { databasePoolSnapshot } from "../../db/database.js"
import { isDatabaseReady } from "../../db/readiness.js"

export interface NextDatabaseReadiness {
  check(): Promise<boolean>
  details(): Readonly<{
    databasePool: ReturnType<typeof databasePoolSnapshot>
    passageSearchPool?: ReturnType<typeof databasePoolSnapshot>
  }>
}

export function createNextDatabaseReadiness(pool: pg.Pool, passageSearchPool?: pg.Pool): NextDatabaseReadiness {
  return {
    check: async () =>
      passageSearchPool === undefined
        ? await isDatabaseReady(pool)
        : (await Promise.all([isDatabaseReady(pool), isDatabaseReady(passageSearchPool)])).every(Boolean),
    details: () => ({
      databasePool: databasePoolSnapshot(pool),
      ...(passageSearchPool === undefined ? {} : { passageSearchPool: databasePoolSnapshot(passageSearchPool) })
    })
  }
}
