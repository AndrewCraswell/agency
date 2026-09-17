import { task } from "@trigger.dev/sdk"
import pg from "pg"
import { z } from "zod"
import { completeLegalDiscoveryDispatch } from "../../ingestion/regulations/discovery-dispatch.js"
import { publishLegalDiscoveryUnit } from "../../ingestion/regulations/discovery-publication.js"
import { continueRegulatoryDiscoveryStage } from "./regulatory-discovery-continuation.js"

export const regulatoryDiscoveryPublicationPayloadSchema = z.strictObject({
  manifestId: z.string().regex(/^[a-f0-9]{64}$/),
  unitKey: z.string().regex(/^[a-f0-9]{64}$/)
})

/** One parsed current eCFR unit per publication worker. Derived-stage dispatch remains separately gated. */
export const regulatoryDiscoveryPublication = task({
  id: "regulatory-discovery-publication",
  maxDuration: 900,
  queue: { name: "regulatory-source-publication", concurrencyLimit: 2 },
  retry: { maxAttempts: 3, minTimeoutInMs: 60_000, maxTimeoutInMs: 600_000, factor: 2, randomize: true },
  run: async (payload: unknown) => continueRegulatoryDiscoveryPublication(payload)
})

export async function continueRegulatoryDiscoveryPublication(value: unknown) {
  const result = await runRegulatoryDiscoveryPublication(value)
  const next = await continueRegulatoryDiscoveryStage("publication", result.payload, result.controllerScope)
  return { ...result, continuationRunId: next.id }
}

export async function runRegulatoryDiscoveryPublication(value: unknown) {
  const payload = regulatoryDiscoveryPublicationPayloadSchema.parse(value)
  const databaseUrl = new URL(z.url().parse(process.env.DATABASE_URL))
  if (
    !["postgres:", "postgresql:"].includes(databaseUrl.protocol) ||
    databaseUrl.pathname === "/" ||
    databaseUrl.pathname === "/legislation_passage_search"
  ) {
    throw new Error("Regulatory publication requires a canonical PostgreSQL database")
  }
  const pool = new pg.Pool({
    connectionString: databaseUrl.href,
    max: 2,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 60_000
  })
  try {
    const result = await publishLegalDiscoveryUnit(pool, payload)
    const controllerScope = await completeLegalDiscoveryDispatch(pool, "publication", payload)
    return { ...result, payload, controllerScope }
  } finally {
    await pool.end()
  }
}
