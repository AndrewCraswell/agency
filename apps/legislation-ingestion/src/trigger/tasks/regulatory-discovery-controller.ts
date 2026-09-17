import { idempotencyKeys, task, tasks } from "@trigger.dev/sdk"
import pg from "pg"
import { z } from "zod"
import {
  legalDiscoveryDispatchPlanSchema,
  legalDiscoveryTaskIdentifier,
  planLegalDiscoveryDispatchPage,
  submitLegalDiscoveryDispatch
} from "../../ingestion/regulations/discovery-dispatch.js"
import { registerLegalDiscoveryManifest } from "../../ingestion/regulations/discovery-registration.js"

/** Manual bounded fan-out. Re-run after children advance durable state; no recurring schedule is registered here. */
export const regulatoryDiscoveryController = task({
  id: "regulatory-discovery-controller",
  maxDuration: 300,
  queue: { name: "regulatory-discovery-controller", concurrencyLimit: 1 },
  retry: { maxAttempts: 4, minTimeoutInMs: 125_000, maxTimeoutInMs: 180_000, factor: 1.5, randomize: true },
  run: async (payload: unknown) => runRegulatoryDiscoveryController(payload)
})

export async function runRegulatoryDiscoveryController(value: unknown) {
  const input = legalDiscoveryDispatchPlanSchema.parse(value)
  const databaseUrl = new URL(z.url().parse(process.env.DATABASE_URL))
  if (
    !["postgres:", "postgresql:"].includes(databaseUrl.protocol) ||
    databaseUrl.pathname === "/" ||
    databaseUrl.pathname === "/legislation_passage_search"
  ) {
    throw new Error("Regulatory discovery controller requires a canonical PostgreSQL database")
  }
  const pool = new pg.Pool({
    connectionString: databaseUrl.href,
    max: 2,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 30_000
  })
  try {
    const manifest = await registerLegalDiscoveryManifest(pool, {
      sourceId: input.sourceId,
      scopeKey: input.scopeKey,
      limit: input.limit
    })
    const plan = await planLegalDiscoveryDispatchPage(pool, input)
    const results = []
    for (const dispatch of plan.dispatches) {
      results.push(
        await submitLegalDiscoveryDispatch(pool, dispatch.id, async (stage, payload, options) =>
          tasks.trigger(legalDiscoveryTaskIdentifier(stage), payload, {
            ...options,
            idempotencyKey: await idempotencyKeys.create(options.idempotencyKey, { scope: "global" })
          })
        )
      )
    }
    return {
      registered: manifest?.units.length ?? 0,
      manifestId: manifest?.id ?? null,
      selected: plan.selected,
      submitted: results.length,
      afterUnitKey: plan.afterUnitKey,
      exhausted: plan.exhausted,
      results
    }
  } finally {
    await pool.end()
  }
}
