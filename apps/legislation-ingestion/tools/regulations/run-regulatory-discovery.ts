import { loadEnvFile } from "node:process"
import { configure, tasks } from "@trigger.dev/sdk"
import { Command } from "commander"
import pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"
import { inspectLegalDiscoveryStart } from "../../src/ingestion/regulations/discovery-start.js"

const program = new Command()
  .name("run-regulatory-discovery")
  .description("Preview or explicitly start one bounded regulatory discovery scope")
  .requiredOption("--environment <name>", "exact configured deployment environment")
  .requiredOption("--source <source>", "ecfr, govinfo-fr or govinfo-cfr")
  .requiredOption("--scope <hash>", "persisted discovery scope hash")
  .option("--limit <number>", "controller window size", "25")
  .option("--apply", "submit the controller; without this flag the command is read-only")
  .option("--plan <hash>", "exact preview plan hash required with --apply")
  .action(run)

try {
  loadLocalEnvironment()
  await program.parseAsync()
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : "Regulatory discovery command failed"}\n`)
  process.exitCode = 1
}

async function run(options: {
  apply?: boolean
  environment: string
  limit: string
  plan?: string
  scope: string
  source: string
}) {
  const url = new URL(z.url().parse(process.env.DATABASE_URL))
  invariant(
    ["postgres:", "postgresql:"].includes(url.protocol) &&
      url.pathname !== "/" &&
      url.pathname !== "/legislation_passage_search",
    "legal_discovery_start_wrong_database"
  )
  const pool = new pg.Pool({ connectionString: url.href, max: 1, connectionTimeoutMillis: 10_000 })
  try {
    const report = await inspectLegalDiscoveryStart(pool, {
      environment: options.environment,
      sourceId: options.source,
      scopeKey: options.scope,
      limit: z.coerce.number().int().parse(options.limit)
    })
    if (options.apply !== true) {
      process.stdout.write(`${JSON.stringify({ status: "planned", ...report }, null, 2)}\n`)
      return
    }
    invariant(report.canApply, "legal_discovery_start_no_runnable_units")
    invariant(options.plan === report.planId, "legal_discovery_start_plan_changed")
    invariant(
      process.env.REGULATORY_ENVIRONMENT?.trim() === report.environment,
      "legal_discovery_start_environment_mismatch"
    )
    const accessToken = process.env.TRIGGER_DEV_API_KEY?.trim() || process.env.TRIGGER_SECRET_KEY?.trim()
    invariant(accessToken !== undefined, "legal_discovery_start_trigger_key_missing")
    configure({ accessToken })
    const handle = await tasks.trigger("regulatory-discovery-controller", report.payload, {
      idempotencyKey: `regulatory-discovery-operator:${report.planId}`
    })
    process.stdout.write(
      `${JSON.stringify({ status: "triggered", planId: report.planId, runId: handle.id, payload: report.payload }, null, 2)}\n`
    )
  } finally {
    await pool.end()
  }
}

function loadLocalEnvironment(): void {
  try {
    loadEnvFile(new URL("../../.env", import.meta.url))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
  }
}
