import { task, tasks } from "@trigger.dev/sdk"
import pg from "pg"
import { z } from "zod"
import {
  legalPassageCopyRequestSchema,
  runLegalPassageCopyBatch
} from "../../ingestion/regulations/passage-copy-batch.js"

/** Explicit copy dispatch. Exhausted traversal still requires the separate whole-copy acknowledgement gate. */
export const regulatoryPassageCopy = task({
  id: "regulatory-passage-copy",
  maxDuration: 180,
  queue: { name: "regulatory-passage-copy", concurrencyLimit: 2 },
  run: async (payload: unknown, { ctx }) => continueRegulatoryPassageCopy(payload, ctx.run.id)
})

export async function continueRegulatoryPassageCopy(unparsed: unknown, workflowRunId: string) {
  const payload = legalPassageCopyRequestSchema.parse(unparsed)
  const runId = z.string().trim().min(1).max(256).parse(workflowRunId)
  const env = z.object({ DATABASE_URL: z.url(), PASSAGE_SEARCH_DATABASE_URL: z.url() }).parse(process.env)
  const sourceUrl = new URL(env.DATABASE_URL)
  const targetUrl = new URL(env.PASSAGE_SEARCH_DATABASE_URL)
  if (
    ![sourceUrl.protocol, targetUrl.protocol].every((protocol) => ["postgres:", "postgresql:"].includes(protocol)) ||
    sourceUrl.pathname === "/legislation_passage_search" ||
    targetUrl.pathname !== "/legislation_passage_search" ||
    sourceUrl.host === targetUrl.host
  ) {
    throw new Error("Regulatory copy requires the separate PostgreSQL search host")
  }
  const source = new pg.Pool({ connectionString: sourceUrl.href, max: 2, connectionTimeoutMillis: 10_000 })
  const target = new pg.Pool({ connectionString: targetUrl.href, max: 2, connectionTimeoutMillis: 10_000 })
  let result: Awaited<ReturnType<typeof runLegalPassageCopyBatch>>
  try {
    result = await runLegalPassageCopyBatch(source, target, payload)
  } finally {
    await Promise.allSettled([source.end(), target.end()])
  }
  if (result.exhausted) {
    return { ...result, continuationRunId: null }
  }
  if (result.copied === 0 || result.afterOrdinal <= payload.afterOrdinal) {
    throw new Error("regulatory_copy_no_progress")
  }
  const next = await tasks.trigger(
    "regulatory-passage-copy",
    { ...payload, afterOrdinal: result.afterOrdinal },
    {
      idempotencyKey: `regulatory-passage-copy:continue:${runId}`
    }
  )
  return { ...result, continuationRunId: next.id }
}
