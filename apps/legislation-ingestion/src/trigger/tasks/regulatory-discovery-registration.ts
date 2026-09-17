import { task } from "@trigger.dev/sdk"
import pg from "pg"
import { z } from "zod"
import { registerLegalDiscoveryManifest } from "../../ingestion/regulations/discovery-registration.js"

export const regulatoryDiscoveryRegistrationPayloadSchema = z.strictObject({
  sourceId: z.enum(["ecfr", "govinfo-fr", "govinfo-cfr"]),
  scopeKey: z.string().regex(/^[a-f0-9]{64}$/),
  limit: z.int().min(1).max(100).default(100)
})

/** Manual bounded registration only. Acquisition dispatch and recurring schedules remain separate gates. */
export const regulatoryDiscoveryRegistration = task({
  id: "regulatory-discovery-registration",
  maxDuration: 120,
  queue: { name: "regulatory-discovery-registration", concurrencyLimit: 1 },
  retry: { maxAttempts: 3, minTimeoutInMs: 30_000, maxTimeoutInMs: 120_000, factor: 2, randomize: true },
  run: async (payload: unknown) => runRegulatoryDiscoveryRegistration(payload)
})

export async function runRegulatoryDiscoveryRegistration(value: unknown) {
  const payload = regulatoryDiscoveryRegistrationPayloadSchema.parse(value)
  const databaseUrl = new URL(z.url().parse(process.env.DATABASE_URL))
  if (
    !["postgres:", "postgresql:"].includes(databaseUrl.protocol) ||
    databaseUrl.pathname === "/" ||
    databaseUrl.pathname === "/legislation_passage_search"
  ) {
    throw new Error("Regulatory registration requires a canonical PostgreSQL database")
  }
  const pool = new pg.Pool({
    connectionString: databaseUrl.href,
    max: 2,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 30_000
  })
  try {
    const manifest = await registerLegalDiscoveryManifest(pool, payload)
    return manifest === null
      ? { registered: 0, manifestId: null }
      : { registered: manifest.units.length, manifestId: manifest.id }
  } finally {
    await pool.end()
  }
}
