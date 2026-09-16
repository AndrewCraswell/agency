import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { parseArgs } from "node:util"
import pg from "pg"
import { z } from "zod"
import { replayRegulatoryBackfill } from "../../src/ingestion/regulations/backfill-plan.js"
import { inspectCanonicalRegulatoryReuse } from "../../src/ingestion/regulations/canonical-reuse.js"
import { regulatoryParserCodeHash } from "../../src/ingestion/regulations/parser-bridge.js"

const { values } = parseArgs({
  options: { manifest: { type: "string" }, replay: { type: "string" }, report: { type: "string" } }
})
const manifest = await replayRegulatoryBackfill(
  JSON.parse(await readFile(resolve(z.string().min(1).parse(values.manifest)), "utf8"))
)
const parserCodeHash = await regulatoryParserCodeHash()
const hash = z.string().regex(/^[a-f0-9]{64}$/)
const replay = z
  .object({
    manifestId: hash,
    parserCodeHash: hash,
    results: z.array(
      z.object({ unitKey: hash, artifactHash: hash, directory: z.string().min(1), disposition: z.literal("identical") })
    )
  })
  .parse(JSON.parse(await readFile(resolve(z.string().min(1).parse(values.replay)), "utf8")))
if (
  replay.manifestId !== manifest.id ||
  replay.parserCodeHash !== parserCodeHash ||
  replay.results.length !== manifest.units.length ||
  new Set(replay.results.map((row) => row.unitKey)).size !== manifest.units.length ||
  replay.results.some((row) => !manifest.units.some((unit) => unit.key === row.unitKey))
) {
  throw new Error("Canonical inspection requires a complete matching replay manifest")
}
const connectionString = z.url().parse(process.env.REGULATORY_TEST_DATABASE_URL)
const target = new URL(connectionString)
if (!["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) || target.pathname !== "/regulations_test") {
  throw new Error("Canonical inspection requires an explicit local regulations_test database")
}
const pool = new pg.Pool({
  connectionString,
  max: 1,
  connectionTimeoutMillis: 10_000,
  options: "-c default_transaction_read_only=on"
})
const results = []
const failures = []
const startedAt = new Date().toISOString()
try {
  for (const unit of manifest.units) {
    const retained = replay.results.find((row) => row.unitKey === unit.key)
    if (retained === undefined) {
      throw new Error("Canonical inspection unit missing")
    }
    try {
      if ((await regulatoryParserCodeHash()) !== parserCodeHash) {
        throw new Error("parser_changed_during_audit")
      }
      const result = await inspectCanonicalRegulatoryReuse(pool, {
        unit,
        artifactHash: retained.artifactHash,
        directory: retained.directory,
        parserCodeHash
      })
      results.push({ nativeId: unit.nativeId, ...result })
      process.stdout.write(`${JSON.stringify(results.at(-1))}\n`)
    } catch (error) {
      const message =
        error instanceof Error ? error.message.replace(/^Invariant failed: /, "") : "canonical_inspection_failed"
      const reason = /^[a-z_]+$/.test(message) ? message : "canonical_inspection_failed"
      const sqlState =
        error instanceof Error && "code" in error && typeof error.code === "string" && /^[A-Z0-9]{5}$/.test(error.code)
          ? error.code
          : undefined
      const failure = { unitKey: unit.key, nativeId: unit.nativeId, reason, sqlState }
      failures.push(failure)
      process.stdout.write(`${JSON.stringify(failure)}\n`)
    }
  }
} finally {
  await pool.end()
}
const report = {
  manifestId: manifest.id,
  parserCodeHash,
  startedAt,
  finishedAt: new Date().toISOString(),
  expectedUnits: manifest.units.length,
  verifiedUnits: results.filter((row) => row.status === "verified").length,
  checkedRecords: results.reduce((sum, row) => sum + ("checkedRecords" in row ? row.checkedRecords : 0), 0),
  results,
  failures,
  canonicalWrites: false,
  dispatched: false,
  embeddingsEnabled: false
}
const reportPath = resolve(z.string().min(1).parse(values.report))
await mkdir(dirname(reportPath), { recursive: true })
await writeFile(reportPath, JSON.stringify(report, null, 2), { flag: "wx" })
process.stdout.write(
  `${JSON.stringify({ reportPath, expectedUnits: report.expectedUnits, verifiedUnits: report.verifiedUnits, checkedRecords: report.checkedRecords, failures })}\n`
)
if (report.verifiedUnits !== report.expectedUnits || failures.length > 0) {
  process.exitCode = 1
}
