import { digest } from "@repo/legislation-core/legal-text/contracts"
import { idempotencyKeys, task, tasks } from "@trigger.dev/sdk"
import pg from "pg"
import { z } from "zod"
import { discoverFrChanges } from "../../ingestion/regulations/fr-discovery.js"

export const regulatoryFrDiscoveryPayloadSchema = z.strictObject({
  bootstrapStart: z.iso.datetime({ offset: true }),
  through: z.iso.datetime({ offset: true }).optional()
})

/** Manual bounded ingress. No recurring schedule is registered until the G4/SYNC-11 gate passes. */
export const regulatoryFrDiscovery = task({
  id: "regulatory-fr-discovery",
  maxDuration: 300,
  queue: { name: "regulatory-fr-discovery", concurrencyLimit: 1 },
  retry: { maxAttempts: 3, minTimeoutInMs: 60_000, maxTimeoutInMs: 180_000, factor: 2, randomize: true },
  run: async (payload: unknown) => continueRegulatoryFrDiscovery(payload)
})

export async function continueRegulatoryFrDiscovery(value: unknown) {
  const result = await runRegulatoryFrDiscovery(value)
  let continuationRunId: string | null = null
  if (!result.complete) {
    const payload = { bootstrapStart: result.bootstrapStart, through: result.through }
    const key = digest(
      JSON.stringify(["regulatory-fr-discovery-continuation-2026-09-18", result.checkpoint.scopeKey, result.cursor])
    )
    const triggered = await tasks.trigger("regulatory-fr-discovery", payload, {
      idempotencyKey: await idempotencyKeys.create(`regulatory-fr-discovery:${key}`, { scope: "global" })
    })
    continuationRunId = z.object({ id: z.string().trim().min(1).max(256) }).parse(triggered).id
  }
  let controllerRunId: string | null = null
  if (result.newUnits > 0) {
    const scope = { sourceId: "govinfo-fr" as const, scopeKey: result.checkpoint.scopeKey }
    const key = digest(
      JSON.stringify(["regulatory-fr-discovery-controller-2026-09-18", scope, result.checkpoint.lastPageId])
    )
    const triggered = await tasks.trigger(
      "regulatory-discovery-controller",
      { ...scope, afterUnitKey: null, limit: 25 },
      {
        idempotencyKey: await idempotencyKeys.create(`regulatory-discovery-controller:${key}`, { scope: "global" })
      }
    )
    controllerRunId = z.object({ id: z.string().trim().min(1).max(256) }).parse(triggered).id
  }
  return { ...result, controllerRunId, continuationRunId }
}

export async function runRegulatoryFrDiscovery(value: unknown) {
  const parsed = regulatoryFrDiscoveryPayloadSchema.parse(value)
  const through = parsed.through ?? new Date().toISOString()
  const databaseUrl = new URL(z.url().parse(process.env.DATABASE_URL))
  if (
    !["postgres:", "postgresql:"].includes(databaseUrl.protocol) ||
    databaseUrl.pathname === "/" ||
    databaseUrl.pathname === "/legislation_passage_search"
  ) {
    throw new Error("Regulatory discovery requires a canonical PostgreSQL database")
  }
  const apiKey = z.string().trim().min(1).parse(process.env.GOVINFO_API_KEY)
  const pool = new pg.Pool({
    connectionString: databaseUrl.href,
    max: 2,
    connectionTimeoutMillis: 10_000
  })
  try {
    const result = await discoverFrChanges(pool, {
      apiKey,
      bootstrapStart: parsed.bootstrapStart,
      through
    })
    return { ...result, bootstrapStart: parsed.bootstrapStart, through }
  } finally {
    await pool.end()
  }
}
