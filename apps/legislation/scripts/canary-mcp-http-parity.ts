import { randomUUID } from "node:crypto"
import { loadConfig } from "../src/config/config.js"
import { createDatabase } from "../src/db/database.js"
import { LegislationQueryService } from "../src/legislation/query-service.js"
import { assertGetBillHttpParity, McpHttpParityMismatchError } from "../src/mcp/http-parity-canary.js"

const apiBaseUrl = requiredEnvironment("LEGISLATION_PARITY_API_BASE_URL")
const billId = requiredEnvironment("LEGISLATION_PARITY_BILL_ID")
const token = requiredEnvironment("LEGISLATION_PARITY_TOKEN")
const correlationId = process.env.LEGISLATION_PARITY_CORRELATION_ID?.trim() || randomUUID()
const config = loadConfig()
const { database, pool } = createDatabase(config.database)

try {
  const report = await assertGetBillHttpParity({
    apiBaseUrl,
    billId,
    correlationId,
    inProcess: new LegislationQueryService(database),
    token
  })
  process.stdout.write(`${JSON.stringify(report)}\n`)
} catch (error) {
  const report = {
    billId,
    correlationId,
    detail: error instanceof McpHttpParityMismatchError ? `strict mismatch at ${error.mismatchPath}` : "request failed",
    method: "getBill",
    status: "failed"
  }
  process.stderr.write(`${JSON.stringify(report)}\n`)
  process.exitCode = 1
} finally {
  await pool.end()
}

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim()
  if (value === undefined || value.length === 0) {
    throw new Error(`${name} is required`)
  }
  return value
}
