import { schedules } from "@trigger.dev/sdk"
import { loadConfig } from "../../config/config.js"
import { createDatabase } from "../../db/database.js"
import { executeGovInfoCommitteeSynchronization } from "../../ingestion/govinfo/committee-directory-sync.js"
import { JobAlreadyRunningError } from "../../ingestion/job.js"
import { requireSuccessfulSynchronizationResult } from "./synchronization-executor.js"

/** New directory editions are infrequent; poll daily without replaying historical Congresses. */
export const committeeDirectorySync = schedules.task({
  id: "govinfo-committee-directory-sync",
  cron: { pattern: "30 9 * * *", timezone: "UTC", environments: ["PRODUCTION"] },
  maxDuration: 3_600,
  queue: { concurrencyLimit: 1 },
  run: async (_payload, { ctx }) => {
    const config = loadConfig()
    const { database, pool } = createDatabase(config.database)
    try {
      return requireSuccessfulSynchronizationResult(
        await executeGovInfoCommitteeSynchronization({
          config,
          congress: config.ingestion.federalEndCongress,
          correlationId: `trigger:${ctx.run.id}`,
          database,
          workflowExecutionId: ctx.run.id
        })
      )
    } catch (error) {
      if (error instanceof JobAlreadyRunningError) {
        return { status: "overlap_skipped" }
      }
      throw error
    } finally {
      await pool.end()
    }
  }
})
