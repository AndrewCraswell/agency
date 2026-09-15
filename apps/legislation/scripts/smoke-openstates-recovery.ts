import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { randomUUID } from "node:crypto"
import { hostname } from "node:os"
import { promisify } from "node:util"
import { createDatabase } from "../src/db/database.js"
import { claimBillBatchOwnership, readBillBatchOwnership } from "../src/db/queries/bill-batch-ownership.js"
import { getLocalDockerRuntimeId } from "../src/ingestion/openstates/scraper-docker.js"
import { ncBillPromotionOwnership } from "../src/ingestion/openstates/scraper-promotion.js"
import { recoverLocalScraperOwnership } from "../src/ingestion/openstates/scraper-recovery.js"

const [mode, suppliedToken] = process.argv.slice(2)
const url = process.env.LEGISLATION_TEST_DATABASE_URL
if (!url) {
  throw new Error("LEGISLATION_TEST_DATABASE_URL is required")
}
const target = new URL(url)
if (!["localhost", "127.0.0.1"].includes(target.hostname) || target.pathname !== "/legislation_test") {
  throw new Error("Recovery smoke requires local legislation_test")
}
const { database, pool } = createDatabase({ url, maxConnections: 1, connectionTimeoutMs: 5000, idleTimeoutMs: 10_000 })
try {
  if (mode === "claim" && suppliedToken) {
    // Intentional isolated control-state fixture: exit without release, but never launch an actual scraper.
    await claimBillBatchOwnership(database, { ...ncBillPromotionOwnership, token: suppliedToken }, 120, {
      requireConfirmedRelease: true,
      executor: { host: hostname(), pid: process.pid, runtimeId: await getLocalDockerRuntimeId() }
    })
  } else if (mode === undefined) {
    const token = `recovery-smoke-${randomUUID()}`
    await promisify(execFile)(
      process.execPath,
      ["--import", "tsx", "scripts/smoke-openstates-recovery.ts", "claim", token],
      {
        timeout: 30_000,
        windowsHide: true,
        maxBuffer: 1024 * 1024
      }
    )
    const result = await recoverLocalScraperOwnership(database, token)
    const record = await readBillBatchOwnership(database, { ...ncBillPromotionOwnership, token })
    assert.equal(record?.released, true)
    process.stdout.write(
      `${JSON.stringify({ ...result, heldExecutorFixture: true, canonicalWrites: false, productionWrites: false })}\n`
    )
  } else {
    throw new Error("Invalid recovery smoke arguments")
  }
} finally {
  await pool.end()
}
