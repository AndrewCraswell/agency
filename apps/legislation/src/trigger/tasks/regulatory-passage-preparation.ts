import { task, tasks } from "@trigger.dev/sdk"
import pg from "pg"
import { z } from "zod"
import {
  legalPreparationScopeSchema,
  runLegalPassagePreparationBatch
} from "../../ingestion/regulations/passage-preparation.js"

const payloadSchema = z.strictObject({
  scope: legalPreparationScopeSchema,
  model: z.enum(["openai/text-embedding-3-small", "voyageai/voyage-4"]),
  limit: z.int().min(1).max(25).default(10),
  retryBlocked: z.boolean().optional()
})
const resultSchema = z
  .strictObject({
    preparationId: z.string().regex(/^[a-f0-9]{64}$/),
    state: z.enum(["pending", "prepared", "blocked"]),
    processed: z.int().min(0).max(25),
    total: z.int().positive(),
    complete: z.int().nonnegative(),
    blocked: z.int().nonnegative()
  })
  .superRefine((result, ctx) => {
    if (
      result.complete + result.blocked > result.total ||
      result.processed > result.complete + result.blocked ||
      (result.state === "prepared") !== (result.complete === result.total) ||
      (result.state === "blocked") !== (result.blocked > 0 && result.complete + result.blocked === result.total)
    ) {
      ctx.addIssue({ code: "custom", message: "regulatory_preparation_invalid_counts" })
    }
  })

/** Explicit backfill dispatch only: tokenization and canonical passages, never provider calls or index promotion. */
export const regulatoryPassagePreparation = task({
  id: "regulatory-passage-preparation",
  maxDuration: 600,
  queue: { name: "regulatory-passage-preparation", concurrencyLimit: 2 },
  // A killed worker can retain its source lease for 120 seconds. Retries must outlive that lease.
  retry: { maxAttempts: 4, minTimeoutInMs: 125_000, maxTimeoutInMs: 180_000, factor: 1.5, randomize: true },
  run: async (payload: unknown, { ctx }) => continueRegulatoryPassagePreparation(payload, ctx.run.id)
})

export async function continueRegulatoryPassagePreparation(unparsed: unknown, workflowRunId: string) {
  const payload = payloadSchema.parse(unparsed)
  const runId = z.string().trim().min(1).max(256).parse(workflowRunId)
  const result = resultSchema.parse(await runRegulatoryPassagePreparation(payload))
  if (result.processed > payload.limit) {
    throw new Error("regulatory_preparation_batch_limit_exceeded")
  }
  if (result.state !== "pending") {
    return { ...result, continuationRunId: null }
  }
  if (result.processed === 0) {
    throw new Error("regulatory_preparation_no_progress")
  }
  // The canonical checkpoint selects the remaining items. Never place offsets or source text in task payloads.
  const next = await tasks.trigger(
    "regulatory-passage-preparation",
    { ...payload, retryBlocked: false },
    {
      idempotencyKey: `regulatory-passage-preparation:continue:${runId}`
    }
  )
  return { ...result, continuationRunId: next.id }
}

export async function runRegulatoryPassagePreparation(unparsed: unknown) {
  const payload = payloadSchema.parse(unparsed)
  const databaseUrl = new URL(z.url().parse(process.env.DATABASE_URL))
  if (
    !["postgres:", "postgresql:"].includes(databaseUrl.protocol) ||
    databaseUrl.pathname === "/" ||
    databaseUrl.pathname === "/legislation_passage_search"
  ) {
    throw new Error("Regulatory preparation requires a canonical PostgreSQL database")
  }
  const pool = new pg.Pool({ connectionString: databaseUrl.href, max: 2, connectionTimeoutMillis: 10_000 })
  try {
    // Verify the actual database too: connection options must not redirect writes into the isolated search store.
    const name = await pool.query("SELECT current_database() AS name")
    if (name.rows[0]?.name === "legislation_passage_search" || typeof name.rows[0]?.name !== "string") {
      throw new Error("Regulatory preparation requires a canonical PostgreSQL database")
    }
    return await runLegalPassagePreparationBatch(pool, payload)
  } finally {
    await pool.end()
  }
}
