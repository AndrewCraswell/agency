import { readFile, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { parseArgs } from "node:util"
import pg from "pg"
import { z } from "zod"
import { receiptSchema } from "../src/ingestion/regulations/artifact-backfill.js"
import { digest, validateManifest } from "../src/ingestion/regulations/contracts.js"
import { importNormalizedRegulatoryUnit } from "../src/ingestion/regulations/import-normalized.js"
import { parserLimits, regulatoryParserContract } from "../src/ingestion/regulations/parser-contract.js"

const { values } = parseArgs({
  options: {
    manifest: { type: "string" },
    raw: { type: "string" },
    normalized: { type: "string" },
    report: { type: "string" },
    limit: { type: "string", default: "5" },
    apply: { type: "boolean", default: false },
    "reuse-only": { type: "boolean", default: false }
  }
})
const manifest = validateManifest(JSON.parse(await readFile(resolve(z.string().min(1).parse(values.manifest)), "utf8")))
const limit = z.coerce.number().int().min(1).max(10_000).parse(values.limit)
if (!values.apply && !values["reuse-only"]) {
  process.stdout.write(
    `${JSON.stringify({
      mode: "preview",
      manifestId: manifest.id,
      units: manifest.units.length,
      limit,
      supportedPublication: "ecfr",
      target: "disposable regulations_test database",
      recurringIngestionEnabled: false
    })}\n`
  )
} else {
  const connectionString = z.url().parse(process.env.REGULATORY_TEST_DATABASE_URL)
  const target = new URL(connectionString)
  if (!["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) || target.pathname !== "/regulations_test") {
    throw new Error("This pilot importer requires a local disposable regulations_test database")
  }
  const raw = resolve(z.string().min(1).parse(values.raw))
  const normalized = resolve(z.string().min(1).parse(values.normalized))
  const reportPath = resolve(z.string().min(1).parse(values.report))
  const parserCodeHash = digest(await readFile(new URL("../python/regulations/parse_xml.py", import.meta.url)))
  const pool = new pg.Pool({
    connectionString,
    max: 3,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 60_000,
    options: values["reuse-only"] ? "-c default_transaction_read_only=on" : undefined
  })
  const results = []
  const failures = []
  const startedAt = new Date().toISOString()
  try {
    const actual = await pool.query<{ name: string }>("SELECT current_database() AS name")
    if (actual.rows[0]?.name !== "regulations_test") {
      throw new Error("Unexpected database identity")
    }
    for (const unit of manifest.units.slice(0, limit)) {
      try {
        const receipt = receiptSchema.parse(JSON.parse(await readFile(join(raw, "units", `${unit.key}.json`), "utf8")))
        const generation = digest(
          JSON.stringify([regulatoryParserContract, parserCodeHash, unit.key, receipt.sha256, parserLimits])
        )
        const result = await importNormalizedRegulatoryUnit(pool, {
          manifest,
          receipt,
          parserCodeHash,
          directory: join(normalized, generation),
          artifactLocator: join(raw, "blobs", `${receipt.sha256}.xml`),
          reuseOnly: values["reuse-only"]
        })
        results.push({ unit: unit.nativeId, ...result })
        process.stdout.write(`${JSON.stringify(results.at(-1))}\n`)
      } catch (error) {
        // Avoid raw PostgreSQL diagnostics: these can contain full legal records or connection details.
        const message = error instanceof Error ? error.message.replace(/^Invariant failed: /, "") : "import_failed"
        const sqlState =
          error instanceof Error &&
          "code" in error &&
          typeof error.code === "string" &&
          /^[A-Z0-9]{5}$/.test(error.code)
            ? error.code
            : undefined
        failures.push({
          unit: unit.nativeId,
          error: /^[a-z_]+$/.test(message) ? message : "import_failed",
          sqlState
        })
      }
    }
  } finally {
    await pool.end()
  }
  const report = {
    manifestId: manifest.id,
    startedAt,
    finishedAt: new Date().toISOString(),
    database: "regulations_test",
    parserCodeHash,
    results,
    failures,
    expectedUnits: manifest.units.length,
    pendingUnits: manifest.units.length - results.length,
    publishedUnits: results.filter((row) => row.state === "published").length,
    blockedUnits: results.filter((row) => row.state === "blocked").length,
    indexed: 0,
    embedded: 0,
    recurringIngestionEnabled: false,
    reuseOnly: values["reuse-only"]
  }
  await writeFile(reportPath, JSON.stringify(report, null, 2), { flag: "wx" })
  process.stdout.write(
    `${JSON.stringify({ reportPath, publishedUnits: report.publishedUnits, blockedUnits: report.blockedUnits, failures })}\n`
  )
  if (failures.length > 0 || report.blockedUnits > 0) {
    process.exitCode = 1
  }
}
