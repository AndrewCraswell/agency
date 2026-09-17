import { task } from "@trigger.dev/sdk"
import pg from "pg"
import { z } from "zod"
import { acquireLegalDiscoveryArtifact } from "../../ingestion/regulations/discovery-acquisition.js"

export const regulatoryDiscoveryAcquisitionPayloadSchema = z.strictObject({
  manifestId: z.string().regex(/^[a-f0-9]{64}$/),
  unitKey: z.string().regex(/^[a-f0-9]{64}$/)
})

/** One current source unit per worker. This task does not parse, publish, index or schedule more work. */
export const regulatoryDiscoveryAcquisition = task({
  id: "regulatory-discovery-acquisition",
  maxDuration: 600,
  queue: { name: "regulatory-source-acquisition", concurrencyLimit: 4 },
  retry: { maxAttempts: 4, minTimeoutInMs: 60_000, maxTimeoutInMs: 600_000, factor: 2, randomize: true },
  run: async (payload: unknown) => runRegulatoryDiscoveryAcquisition(payload)
})

export async function runRegulatoryDiscoveryAcquisition(value: unknown) {
  const payload = regulatoryDiscoveryAcquisitionPayloadSchema.parse(value)
  const databaseUrl = new URL(z.url().parse(process.env.DATABASE_URL))
  if (
    !["postgres:", "postgresql:"].includes(databaseUrl.protocol) ||
    databaseUrl.pathname === "/" ||
    databaseUrl.pathname === "/legislation_passage_search"
  ) {
    throw new Error("Regulatory acquisition requires a canonical PostgreSQL database")
  }
  const artifactDirectory = z.string().trim().min(1).parse(process.env.REGULATORY_ARTIFACT_DIRECTORY)
  const pool = new pg.Pool({
    connectionString: databaseUrl.href,
    max: 2,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 30_000
  })
  try {
    return await acquireLegalDiscoveryArtifact(pool, { ...payload, artifactDirectory })
  } finally {
    await pool.end()
  }
}
