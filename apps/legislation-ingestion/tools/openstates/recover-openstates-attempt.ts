import { createDatabase } from "@repo/legislation-core/database/database"
import { recoverLocalScraperOwnership } from "../../src/ingestion/openstates/scraper-recovery.js"

const [token] = process.argv.slice(2)
const url = process.env.LEGISLATION_TEST_DATABASE_URL
if (!token || !url) {
  throw new Error("Usage: recover-openstates-attempt <held-run-id>; requires LEGISLATION_TEST_DATABASE_URL")
}
const target = new URL(url)
if (!["localhost", "127.0.0.1"].includes(target.hostname) || target.pathname !== "/legislation_test") {
  throw new Error("Recovery requires local legislation_test")
}
const { database, pool } = createDatabase({ url, maxConnections: 1, connectionTimeoutMs: 5000, idleTimeoutMs: 10_000 })
try {
  process.stdout.write(`${JSON.stringify(await recoverLocalScraperOwnership(database, token))}\n`)
} finally {
  await pool.end()
}
