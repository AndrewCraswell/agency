import pg from "pg"
import { z } from "zod"
import {
  parseQueryPlanDiagnosticInput,
  runQueryPlanDiagnostic
} from "../src/modules/legislation/query-plan-diagnostics"

const argumentSchema = z.object({
  allowProduction: z.boolean(),
  fixture: z.string().min(1),
  query: z.string().min(1),
  timeoutMs: z.number().int()
})

const options = argumentSchema.parse(parseArguments(process.argv.slice(2)))
const environment = process.env.RAILWAY_ENVIRONMENT_NAME?.trim().toLowerCase()
if (environment === "production" && !options.allowProduction) {
  throw new Error("Production diagnostics require the explicit --allow-production flag")
}
const input = parseQueryPlanDiagnosticInput(options)
const connectionString = process.env.DATABASE_DIRECT_URL ?? process.env.DATABASE_PUBLIC_URL ?? process.env.DATABASE_URL
if (!connectionString) {
  throw new Error("DATABASE_DIRECT_URL, DATABASE_PUBLIC_URL, or DATABASE_URL is required")
}

const pool = new pg.Pool({ connectionString, max: 1 })
try {
  const client = await pool.connect()
  try {
    const report = await runQueryPlanDiagnostic(client, input)
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
  } finally {
    client.release()
  }
} finally {
  await pool.end()
}

function parseArguments(arguments_: readonly string[]) {
  const parsed: {
    allowProduction: boolean
    fixture?: string
    query?: string
    timeoutMs: number
  } = {
    allowProduction: false,
    timeoutMs: 20_000
  }
  for (const argument of arguments_) {
    if (argument === "--allow-production") {
      parsed.allowProduction = true
    } else if (argument.startsWith("--fixture=")) {
      parsed.fixture = argument.slice("--fixture=".length)
    } else if (argument.startsWith("--query=")) {
      parsed.query = argument.slice("--query=".length)
    } else if (argument.startsWith("--timeout-ms=")) {
      parsed.timeoutMs = Number(argument.slice("--timeout-ms=".length))
    } else {
      throw new Error(`Unknown argument: ${argument}`)
    }
  }
  return parsed
}
