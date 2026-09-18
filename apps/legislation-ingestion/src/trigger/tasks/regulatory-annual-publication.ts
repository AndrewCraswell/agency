import { task } from "@trigger.dev/sdk"
import pg from "pg"
import { z } from "zod"
import { publishAnnualCfrEdition } from "../../ingestion/regulations/annual-cfr-publication.js"

const hashSchema = z.string().regex(/^[a-f0-9]{64}$/)
export const regulatoryAnnualPublicationPayloadSchema = z.strictObject({
  manifestId: hashSchema,
  year: z.int().min(1996).max(9999),
  title: z.int().min(1).max(50),
  generationIds: z.array(hashSchema).min(1).max(200)
})

/** Explicit historical backfill only. All listed volumes become visible atomically after the service revalidates them. */
export const regulatoryAnnualPublication = task({
  id: "regulatory-annual-publication",
  maxDuration: 900,
  queue: { name: "regulatory-source-publication", concurrencyLimit: 2 },
  retry: { maxAttempts: 3, minTimeoutInMs: 60_000, maxTimeoutInMs: 600_000, factor: 2, randomize: true },
  run: async (payload: unknown) => runRegulatoryAnnualPublication(payload)
})

export async function runRegulatoryAnnualPublication(value: unknown) {
  const payload = regulatoryAnnualPublicationPayloadSchema.parse(value)
  const databaseUrl = new URL(z.url().parse(process.env.DATABASE_URL))
  if (
    !["postgres:", "postgresql:"].includes(databaseUrl.protocol) ||
    databaseUrl.pathname === "/" ||
    databaseUrl.pathname === "/legislation_passage_search"
  ) {
    throw new Error("Annual CFR publication requires a canonical PostgreSQL database")
  }
  const pool = new pg.Pool({
    connectionString: databaseUrl.href,
    max: 3,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 60_000
  })
  try {
    const database = await pool.query("SELECT current_database() AS name")
    if (typeof database.rows[0]?.name !== "string" || database.rows[0].name === "legislation_passage_search") {
      throw new Error("Annual CFR publication requires a canonical PostgreSQL database")
    }
    return await publishAnnualCfrEdition(pool, payload)
  } finally {
    await pool.end()
  }
}
