import { databasePoolSnapshot } from "@repo/legislation-core/database/database"
import { isDatabaseReady } from "@repo/legislation-core/database/readiness"
import type pg from "pg"

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
