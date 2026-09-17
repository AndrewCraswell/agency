import { task } from "@trigger.dev/sdk"
import pg from "pg"
import { z } from "zod"
import { discoverEcfrChanges } from "../../ingestion/regulations/ecfr-discovery.js"

export const regulatoryEcfrDiscoveryPayloadSchema = z
  .strictObject({
    titles: z.array(z.int().min(1).max(50)).min(1).max(50).optional()
  })
  .superRefine((value, ctx) => {
    if (value.titles !== undefined && new Set(value.titles).size !== value.titles.length) {
      ctx.addIssue({ code: "custom", message: "Duplicate eCFR title" })
    }
  })

/** Manual bounded ingress. No recurring schedule is registered until the G4/SYNC-11 gate passes. */
export const regulatoryEcfrDiscovery = task({
  id: "regulatory-ecfr-discovery",
  maxDuration: 300,
  queue: { name: "regulatory-ecfr-discovery", concurrencyLimit: 1 },
  retry: { maxAttempts: 3, minTimeoutInMs: 60_000, maxTimeoutInMs: 180_000, factor: 2, randomize: true },
  run: async (payload: unknown) => runRegulatoryEcfrDiscovery(payload)
})

export async function runRegulatoryEcfrDiscovery(value: unknown) {
  const payload = regulatoryEcfrDiscoveryPayloadSchema.parse(value)
  const databaseUrl = new URL(z.url().parse(process.env.DATABASE_URL))
  if (
    !["postgres:", "postgresql:"].includes(databaseUrl.protocol) ||
    databaseUrl.pathname === "/" ||
    databaseUrl.pathname === "/legislation_passage_search"
  ) {
    throw new Error("Regulatory discovery requires a canonical PostgreSQL database")
  }
  const pool = new pg.Pool({
    connectionString: databaseUrl.href,
    max: 2,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 30_000
  })
  try {
    return await discoverEcfrChanges(pool, payload)
  } finally {
    await pool.end()
  }
}
