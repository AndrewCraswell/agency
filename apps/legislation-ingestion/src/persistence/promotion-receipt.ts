import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import { syncCheckpoints } from "@repo/legislation-core/database/schema/schema"
import { and, eq, sql } from "drizzle-orm"

/** Serialize admission and return true only for an identical committed receipt. Hold through commit. */
export async function promotionAlreadyCommitted(
  transaction: Omit<LegislationDatabase, "$client">,
  receipt: { source: string; stream: string; cursor: Record<string, unknown> }
) {
  if (!receipt.source || !receipt.stream) {
    throw new Error("Invalid batch receipt identity")
  }
  await transaction.execute(sql`select set_config('statement_timeout', '60000', true),
    set_config('lock_timeout', '10000', true), set_config('idle_in_transaction_session_timeout', '120000', true)`)
  await transaction.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${JSON.stringify([receipt.source, receipt.stream])}, 0))`
  )
  const [previous] = await transaction
    .select({ matches: sql<boolean>`${syncCheckpoints.cursor} = ${JSON.stringify(receipt.cursor)}::jsonb` })
    .from(syncCheckpoints)
    .where(and(eq(syncCheckpoints.source, receipt.source), eq(syncCheckpoints.stream, receipt.stream)))
  if (previous && !previous.matches) {
    throw new Error("Batch receipt conflicts with a committed promotion")
  }
  return previous !== undefined
}
