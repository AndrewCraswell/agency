import { task, tasks } from "@trigger.dev/sdk"
import pg from "pg"
import { z } from "zod"
import { reconcileLegalSearchRightsBatch } from "../../ingestion/regulations/search-rights.js"

/** Maintenance only. Deployment creates neither a recurring schedule nor source ingestion. */
export const regulatorySearchRights = task({
  id: "regulatory-search-rights",
  maxDuration: 180,
  queue: { name: "regulatory-search-rights", concurrencyLimit: 1 },
  run: async (payload: unknown, { ctx }) => continueRegulatorySearchRights(payload, ctx.run.id)
})

/** One durable successor per Trigger run. Retrying a committed batch cannot enqueue a second successor. */
export async function continueRegulatorySearchRights(payload: unknown, workflowRunId: string) {
  const runId = z.string().trim().min(1).max(256).parse(workflowRunId)
  const result = await runRegulatorySearchRights(payload)
  if (result.complete) {
    return { ...result, continuationRunId: null }
  }
  if (result.results.length === 0) {
    throw new Error("regulatory_rights_no_progress")
  }
  const next = await tasks.trigger(
    "regulatory-search-rights",
    { cursor: result.cursor },
    {
      idempotencyKey: `regulatory-search-rights:continue:${runId}`
    }
  )
  return { ...result, continuationRunId: next.id }
}

export async function runRegulatorySearchRights(unparsed: unknown) {
  const payload = z
    .strictObject({
      cursor: z
        .strictObject({ kind: z.enum(["edition", "publication"]), id: z.uuid() })
        .nullable()
        .optional()
    })
    .parse(unparsed)
  const env = z.object({ DATABASE_URL: z.url(), PASSAGE_SEARCH_DATABASE_URL: z.url() }).parse(process.env)
  const sourceUrl = new URL(env.DATABASE_URL)
  const targetUrl = new URL(env.PASSAGE_SEARCH_DATABASE_URL)
  if (targetUrl.pathname !== "/legislation_passage_search" || sourceUrl.host === targetUrl.host) {
    throw new Error("Regulatory search maintenance requires the separate search host")
  }
  const source = new pg.Pool({ connectionString: sourceUrl.href, max: 2, connectionTimeoutMillis: 10000 })
  const target = new pg.Pool({ connectionString: targetUrl.href, max: 2, connectionTimeoutMillis: 10000 })
  try {
    return await reconcileLegalSearchRightsBatch(source, target, payload)
  } finally {
    await Promise.allSettled([source.end(), target.end()])
  }
}
