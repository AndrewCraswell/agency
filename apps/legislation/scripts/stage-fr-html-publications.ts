import { readFile, writeFile, mkdir } from "node:fs/promises"
import { join, resolve } from "node:path"
import { parseArgs } from "node:util"
import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"
import { digest } from "../src/ingestion/regulations/contracts.js"
import {
  frHtmlImportArtifact,
  registerFrHtmlImport,
  stageFrHtmlImport
} from "../src/ingestion/regulations/fr-import-registration.js"
import { loadFrHtmlPublications } from "../src/ingestion/regulations/fr-publication-files.js"
import { claimRegulatoryLease, releaseRegulatoryLease } from "../src/ingestion/regulations/storage.js"

const { values } = parseArgs({
  options: {
    metadata: { type: "string" },
    date: { type: "string" },
    html: { type: "string" },
    pdf: { type: "string" },
    validation: { type: "string" },
    artifacts: { type: "string" },
    output: { type: "string" },
    apply: { type: "boolean", default: false }
  }
})
const required = (value: unknown) => z.string().min(1).parse(value)
if (!values.apply) {
  process.stdout.write(
    JSON.stringify({ mode: "preview", target: "local disposable regulations_test", publicationReady: false })
  )
} else {
  const connectionString = z.url().parse(process.env.REGULATORY_TEST_DATABASE_URL)
  const target = new URL(connectionString)
  invariant(
    ["127.0.0.1", "localhost", "[::1]"].includes(target.hostname) && target.pathname === "/regulations_test",
    "local_disposable_database_required"
  )
  const data = await loadFrHtmlPublications({
    metadata: required(values.metadata),
    date: required(values.date),
    html: required(values.html),
    pdf: required(values.pdf),
    validation: required(values.validation)
  })
  const body = frHtmlImportArtifact(data)
  const directory = resolve(required(values.artifacts))
  await mkdir(directory, { recursive: true })
  const locator = join(directory, `${digest(body)}.json`)
  try {
    await writeFile(locator, body, { flag: "wx", flush: true })
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) {
      throw error
    }
    invariant((await readFile(locator, "utf8")) === body, "fr_html_import_artifact_conflict")
  }
  const pool = new pg.Pool({ connectionString, max: 3, connectionTimeoutMillis: 10_000 })
  try {
    await migrate(drizzle(pool), {
      migrationsFolder: resolve("src/db/migrations"),
      migrationsSchema: "legislation_migrations",
      migrationsTable: "migrations"
    })
    await pool.query(
      "INSERT INTO legislation.jurisdictions(id,name,classification,country_code) VALUES('jurisdiction:us','United States','country','US') ON CONFLICT DO NOTHING"
    )
    const registered = await registerFrHtmlImport(pool, data, { body, locator, acquiredAt: new Date().toISOString() })
    const lease = await claimRegulatoryLease(pool, registered.generationId)
    try {
      const report = await stageFrHtmlImport(pool, lease, data)
      await writeFile(resolve(required(values.output)), JSON.stringify(report, null, 2), { flag: "wx" })
      process.stdout.write(JSON.stringify(report))
    } finally {
      await releaseRegulatoryLease(pool, lease)
    }
  } finally {
    await pool.end()
  }
}
