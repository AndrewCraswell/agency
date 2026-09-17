import { idempotencyKeys, runs, task, tasks } from "@trigger.dev/sdk"
import pg from "pg"
import { z } from "zod"
import { legalDiscoveryRunStatusSchema as triggerRunStatusSchema } from "../../ingestion/regulations/discovery-recovery.js"
import {
  preparationRunRecoverySchema,
  recoverLegalPreparationRunPage
} from "../../ingestion/regulations/preparation-run-recovery.js"

function httpStatus(error: unknown) {
  if (typeof error !== "object" || error === null || !("status" in error)) return undefined
  return typeof error.status === "number" ? error.status : undefined
}

export const regulatoryPreparationRecovery = task({
  id: "regulatory-preparation-recovery",
  maxDuration: 300,
  queue: { name: "regulatory-preparation-dispatch", concurrencyLimit: 1 },
  retry: { maxAttempts: 3, minTimeoutInMs: 125_000, maxTimeoutInMs: 180_000, factor: 1.5, randomize: true },
  run: async (payload: unknown) => runRegulatoryPreparationRecovery(payload)
})

export async function runRegulatoryPreparationRecovery(value: unknown) {
  const input = preparationRunRecoverySchema.parse(value)
  const databaseUrl = new URL(z.url().parse(process.env.DATABASE_URL))
  if (
    !["postgres:", "postgresql:"].includes(databaseUrl.protocol) ||
    databaseUrl.pathname === "/" ||
    databaseUrl.pathname === "/legislation_passage_search"
  ) {
    throw new Error("Regulatory preparation recovery requires a canonical PostgreSQL database")
  }
  const pool = new pg.Pool({
    connectionString: databaseUrl.href,
    max: 2,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 30_000
  })
  try {
    return await recoverLegalPreparationRunPage(
      pool,
      input,
      async (runId) => {
        try {
          const remote = await runs.retrieve(runId)
          return { status: triggerRunStatusSchema.parse(remote.status) }
        } catch (error) {
          if (httpStatus(error) === 404) return { status: "MISSING" }
          throw error
        }
      },
      async (payload, options) =>
        tasks.trigger("regulatory-passage-preparation", payload, {
          ...options,
          idempotencyKey: await idempotencyKeys.create(options.idempotencyKey, { scope: "global" })
        })
    )
  } finally {
    await pool.end()
  }
}
