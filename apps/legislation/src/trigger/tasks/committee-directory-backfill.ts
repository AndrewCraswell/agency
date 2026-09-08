import { schemaTask } from "@trigger.dev/sdk"
import { z } from "zod"
import { loadConfig } from "../../config/config.js"
import { createDatabase } from "../../db/database.js"
import { executeGovInfoCommitteeSynchronization } from "../../ingestion/govinfo/committee-directory-sync.js"
import { requireSuccessfulSynchronizationResult } from "./synchronization-executor.js"

export const committeeDirectoryBackfillPayload = z.strictObject({ congress: z.number().int().min(105).max(118) })

/** Manually dispatch one validated historical Congress; never restart or schedule a range implicitly. */
export const committeeDirectoryBackfill = schemaTask({
  id: "govinfo-committee-directory-backfill",
  schema: committeeDirectoryBackfillPayload,
  // Editions checkpoint atomically; retries resume instead of replaying committed editions.
  // The old one-hour ceiling interrupted a four-edition Congress.
  maxDuration: 86_400,
  queue: { concurrencyLimit: 1, name: "govinfo-committee-publication" },
  run: async (payload, { ctx }) => runCommitteeDirectoryBackfill(payload, ctx.run.id)
})

export async function runCommitteeDirectoryBackfill(payload: unknown, runId: string) {
  const { congress } = committeeDirectoryBackfillPayload.parse(payload)
  const config = loadConfig()
  const { database, pool } = createDatabase(config.database)
  try {
    return requireSuccessfulSynchronizationResult(
      await executeGovInfoCommitteeSynchronization({
        config,
        congress,
        correlationId: `trigger:${runId}`,
        database,
        workflowExecutionId: runId
      })
    )
  } finally {
    await pool.end()
  }
}
