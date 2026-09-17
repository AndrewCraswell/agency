import { task, tasks } from "@trigger.dev/sdk"
import pg from "pg"
import { z } from "zod"
import {
  finalizeLegalPassageCopy,
  legalCopyValidationPageSchema,
  verifyLegalPassageCopyPage
} from "../../ingestion/regulations/passage-copy-readiness.js"

/** Pages only save evidence. Finalization must be requested explicitly after every page has passed. */
export const regulatoryCopyValidation = task({
  id: "regulatory-copy-validation",
  maxDuration: 180,
  queue: { name: "regulatory-copy-validation", concurrencyLimit: 2 },
  run: async (value: unknown, { ctx }) => continueRegulatoryCopyValidation(value, ctx.run.id)
})

const inputSchema = z.union([
  legalCopyValidationPageSchema,
  z.strictObject({ operation: z.literal("finalize"), preparationId: z.string().regex(/^[a-f0-9]{64}$/) })
])
const pageResultSchema = z.object({
  preparationId: z.string().regex(/^[a-f0-9]{64}$/),
  afterOrdinal: z.int().min(-1),
  exhausted: z.boolean(),
  checkpointsWritten: z.int().nonnegative()
})

/** Continues bounded verification and finalizes only after the complete checkpoint inventory passes. */
export async function continueRegulatoryCopyValidation(value: unknown, workflowRunId: string) {
  const input = inputSchema.parse(value)
  const runId = z.string().trim().min(1).max(256).parse(workflowRunId)
  const result = await runRegulatoryCopyValidation(input)
  if ("operation" in input) return { ...result, continuationRunId: null }
  const page = pageResultSchema.parse(result)
  if (page.checkpointsWritten === 0 || page.afterOrdinal <= input.afterOrdinal) {
    throw new Error("regulatory_copy_validation_no_progress")
  }
  const nextPayload = page.exhausted
    ? { operation: "finalize" as const, preparationId: input.preparationId }
    : { ...input, afterOrdinal: page.afterOrdinal }
  const next = await tasks.trigger("regulatory-copy-validation", nextPayload, {
    idempotencyKey: `regulatory-copy-validation:continue:${runId}`
  })
  return { ...result, continuationRunId: next.id }
}

export async function runRegulatoryCopyValidation(value: unknown) {
  const input = inputSchema.parse(value)
  const env = z.object({ DATABASE_URL: z.url(), PASSAGE_SEARCH_DATABASE_URL: z.url() }).parse(process.env)
  const sourceUrl = new URL(env.DATABASE_URL)
  const targetUrl = new URL(env.PASSAGE_SEARCH_DATABASE_URL)
  if (
    ![sourceUrl.protocol, targetUrl.protocol].every((protocol) => ["postgres:", "postgresql:"].includes(protocol)) ||
    sourceUrl.pathname === "/legislation_passage_search" ||
    targetUrl.pathname !== "/legislation_passage_search" ||
    sourceUrl.host === targetUrl.host
  ) {
    throw new Error("Regulatory validation requires the separate PostgreSQL search host")
  }
  const source = new pg.Pool({ connectionString: sourceUrl.href, max: 2, connectionTimeoutMillis: 10_000 })
  const target = new pg.Pool({ connectionString: targetUrl.href, max: 2, connectionTimeoutMillis: 10_000 })
  try {
    return await ("operation" in input
      ? finalizeLegalPassageCopy(source, target, input.preparationId)
      : verifyLegalPassageCopyPage(source, target, input))
  } finally {
    await Promise.allSettled([source.end(), target.end()])
  }
}
