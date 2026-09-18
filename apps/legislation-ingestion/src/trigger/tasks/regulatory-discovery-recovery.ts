import { idempotencyKeys, runs, task, tasks } from "@trigger.dev/sdk"
import pg from "pg"
import { z } from "zod"
import { legalDiscoveryTaskIdentifier } from "../../ingestion/regulations/discovery-dispatch.js"
import {
  legalDiscoveryRecoverySchema,
  legalDiscoveryRunStatusSchema,
  recoverLegalDiscoveryDispatchPage
} from "../../ingestion/regulations/discovery-recovery.js"

function httpStatus(error: unknown) {
  if (typeof error !== "object" || error === null || !("status" in error)) return undefined
  return typeof error.status === "number" ? error.status : undefined
}

/** Manual bounded reconciliation. It observes remote runs but never activates a source schedule. */
export const regulatoryDiscoveryRecovery = task({
  id: "regulatory-discovery-recovery",
  maxDuration: 300,
  queue: { name: "regulatory-discovery-controller", concurrencyLimit: 1 },
  retry: { maxAttempts: 3, minTimeoutInMs: 125_000, maxTimeoutInMs: 180_000, factor: 1.5, randomize: true },
  run: async (payload: unknown) => runRegulatoryDiscoveryRecovery(payload)
})

export async function runRegulatoryDiscoveryRecovery(value: unknown) {
  const input = legalDiscoveryRecoverySchema.parse(value)
  const databaseUrl = new URL(z.url().parse(process.env.DATABASE_URL))
  if (
    !["postgres:", "postgresql:"].includes(databaseUrl.protocol) ||
    databaseUrl.pathname === "/" ||
    databaseUrl.pathname === "/legislation_passage_search"
  ) {
    throw new Error("Regulatory discovery recovery requires a canonical PostgreSQL database")
  }
  const pool = new pg.Pool({
    connectionString: databaseUrl.href,
    max: 2,
    connectionTimeoutMillis: 10_000
  })
  try {
    return await recoverLegalDiscoveryDispatchPage(
      pool,
      input,
      async (runId) => {
        try {
          const remote = await runs.retrieve(runId)
          return { status: legalDiscoveryRunStatusSchema.parse(remote.status) }
        } catch (error) {
          if (httpStatus(error) === 404) return { status: "MISSING" }
          throw error
        }
      },
      async (stage, payload, options) =>
        tasks.trigger(legalDiscoveryTaskIdentifier(stage), payload, {
          ...options,
          idempotencyKey: await idempotencyKeys.create(options.idempotencyKey, { scope: "global" })
        })
    )
  } finally {
    await pool.end()
  }
}
