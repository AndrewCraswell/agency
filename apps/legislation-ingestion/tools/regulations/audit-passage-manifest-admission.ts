import { parseArgs } from "node:util"
import pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"
import { auditLegalPassageManifestAdmission } from "../../src/ingestion/regulations/passage-manifest-admission.js"

const { values } = parseArgs({
  options: {
    catalog: { type: "string" },
    hash: { type: "string" },
    batch: { type: "string" }
  }
})
const url = new URL(z.url().parse(process.env.REGULATORY_TEST_DATABASE_URL))
invariant(
  ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) && url.pathname === "/regulations_test",
  "legal_passage_admission_requires_local_pilot"
)
const pool = new pg.Pool({ connectionString: url.href, max: 1, connectionTimeoutMillis: 10_000 })
try {
  const report = await auditLegalPassageManifestAdmission(pool, {
    catalogPath: z.string().min(1).parse(values.catalog),
    catalogHash: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .parse(values.hash),
    batchSize: values.batch === undefined ? undefined : z.coerce.number().int().parse(values.batch)
  })
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
} finally {
  await pool.end()
}
