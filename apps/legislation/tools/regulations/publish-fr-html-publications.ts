import { writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { parseArgs } from "node:util"
import pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"
import { publishFrHtmlImport } from "../../src/ingestion/regulations/fr-html-publication.js"
import { loadFrHtmlPublications } from "../../src/ingestion/regulations/fr-publication-files.js"
import { claimRegulatoryLease, releaseRegulatoryLease } from "../../src/ingestion/regulations/storage.js"

const { values } = parseArgs({
  options: {
    metadata: { type: "string" },
    date: { type: "string" },
    html: { type: "string" },
    pdf: { type: "string" },
    validation: { type: "string" },
    generation: { type: "string" },
    output: { type: "string" },
    apply: { type: "boolean", default: false }
  }
})
const required = (value: unknown) => z.string().min(1).parse(value)
if (!values.apply) {
  process.stdout.write(
    JSON.stringify({ mode: "preview", target: "local disposable regulations_test", lexicalOutboxOnly: true })
  )
} else {
  const connectionString = z.url().parse(process.env.REGULATORY_TEST_DATABASE_URL)
  const target = new URL(connectionString)
  invariant(
    ["127.0.0.1", "localhost", "[::1]"].includes(target.hostname) && target.pathname === "/regulations_test",
    "local_disposable_database_required"
  )
  const generationId = z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .parse(values.generation)
  const data = await loadFrHtmlPublications({
    metadata: required(values.metadata),
    date: required(values.date),
    html: required(values.html),
    pdf: required(values.pdf),
    validation: required(values.validation)
  })
  const pool = new pg.Pool({ connectionString, max: 3, connectionTimeoutMillis: 10_000 })
  try {
    const lease = await claimRegulatoryLease(pool, generationId)
    try {
      const report = await publishFrHtmlImport(pool, lease, data)
      await writeFile(resolve(required(values.output)), JSON.stringify(report, null, 2), { flag: "wx" })
      process.stdout.write(JSON.stringify(report))
    } finally {
      await releaseRegulatoryLease(pool, lease)
    }
  } finally {
    await pool.end()
  }
}
