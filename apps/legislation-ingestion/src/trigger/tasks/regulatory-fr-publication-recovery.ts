import { digest } from "@repo/legislation-core/legal-text/contracts"
import { idempotencyKeys, task, tasks } from "@trigger.dev/sdk"
import pg from "pg"
import { z } from "zod"
import {
  frPublicationRecoveryInputSchema,
  planFrPublicationRecoveryPage
} from "../../ingestion/regulations/fr-publication-recovery.js"

export const regulatoryFrPublicationRecovery = task({
  id: "regulatory-fr-publication-recovery",
  maxDuration: 300,
  queue: { name: "regulatory-fr-publication-recovery", concurrencyLimit: 1 },
  retry: { maxAttempts: 3, minTimeoutInMs: 60_000, maxTimeoutInMs: 180_000, factor: 2, randomize: true },
  run: async (payload: unknown) => runRegulatoryFrPublicationRecovery(payload)
})

/** Manual bounded recovery only. No source or recovery schedule is registered. */
export async function runRegulatoryFrPublicationRecovery(value: unknown) {
  const input = frPublicationRecoveryInputSchema.parse(value)
  const databaseUrl = new URL(z.url().parse(process.env.DATABASE_URL))
  if (
    !["postgres:", "postgresql:"].includes(databaseUrl.protocol) ||
    databaseUrl.pathname === "/" ||
    databaseUrl.pathname === "/legislation_passage_search"
  ) {
    throw new Error("Federal Register recovery requires a canonical PostgreSQL database")
  }
  const pool = new pg.Pool({
    connectionString: databaseUrl.href,
    max: 2,
    connectionTimeoutMillis: 10_000
  })
  try {
    const page = await planFrPublicationRecoveryPage(pool, input)
    const runs = []
    for (const item of page.items) {
      const taskId = item.kind === "rendition" ? "regulatory-fr-rendition" : "regulatory-fr-publication-finalize"
      const payload =
        item.kind === "rendition"
          ? {
              manifestId: item.manifestId,
              scopeKey: item.scopeKey,
              unitKey: item.unitKey,
              documentNumber: item.documentNumber
            }
          : { manifestId: item.manifestId, unitKey: item.unitKey }
      const identity = digest(JSON.stringify(["regulatory-fr-publication-recovery-2026-09-18", item]))
      const run = await tasks.trigger(taskId, payload, {
        idempotencyKey: await idempotencyKeys.create(`regulatory-fr-publication-recovery:${identity}`, {
          scope: "global"
        })
      })
      runs.push({
        kind: item.kind,
        unitKey: item.unitKey,
        documentNumber: item.documentNumber,
        runId: z.object({ id: z.string().min(1).max(256) }).parse(run).id
      })
    }
    let continuationRunId: string | null = null
    if (!page.exhausted) {
      const continuation = {
        scopeKey: input.scopeKey,
        afterUnitKey: page.afterUnitKey,
        afterDocumentNumber: page.afterDocumentNumber,
        limit: input.limit
      }
      const identity = digest(JSON.stringify(["regulatory-fr-publication-recovery-page-2026-09-18", continuation]))
      const run = await tasks.trigger("regulatory-fr-publication-recovery", continuation, {
        idempotencyKey: await idempotencyKeys.create(`regulatory-fr-publication-recovery:${identity}`, {
          scope: "global"
        })
      })
      continuationRunId = z.object({ id: z.string().min(1).max(256) }).parse(run).id
    }
    return { ...page, runs, continuationRunId }
  } finally {
    await pool.end()
  }
}
