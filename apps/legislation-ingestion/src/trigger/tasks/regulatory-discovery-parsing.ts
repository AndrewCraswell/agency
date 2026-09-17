import { task } from "@trigger.dev/sdk"
import pg from "pg"
import { z } from "zod"
import { parseLegalDiscoveryArtifact } from "../../ingestion/regulations/discovery-parsing.js"

export const regulatoryDiscoveryParsingPayloadSchema = z.strictObject({
  manifestId: z.string().regex(/^[a-f0-9]{64}$/),
  unitKey: z.string().regex(/^[a-f0-9]{64}$/)
})

/** One acquired unit per parser worker. Publication and downstream dispatch remain separate gates. */
export const regulatoryDiscoveryParsing = task({
  id: "regulatory-discovery-parsing",
  maxDuration: 900,
  queue: { name: "regulatory-source-parsing", concurrencyLimit: 4 },
  retry: { maxAttempts: 3, minTimeoutInMs: 60_000, maxTimeoutInMs: 600_000, factor: 2, randomize: true },
  run: async (payload: unknown) => runRegulatoryDiscoveryParsing(payload)
})

export async function runRegulatoryDiscoveryParsing(value: unknown) {
  const payload = regulatoryDiscoveryParsingPayloadSchema.parse(value)
  const databaseUrl = new URL(z.url().parse(process.env.DATABASE_URL))
  if (
    !["postgres:", "postgresql:"].includes(databaseUrl.protocol) ||
    databaseUrl.pathname === "/" ||
    databaseUrl.pathname === "/legislation_passage_search"
  ) {
    throw new Error("Regulatory parsing requires a canonical PostgreSQL database")
  }
  const outputRoot = z.string().trim().min(1).parse(process.env.REGULATORY_NORMALIZED_DIRECTORY)
  const pool = new pg.Pool({
    connectionString: databaseUrl.href,
    max: 2,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 30_000
  })
  try {
    return await parseLegalDiscoveryArtifact(pool, { ...payload, outputRoot })
  } finally {
    await pool.end()
  }
}
