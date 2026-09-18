import { mkdir, open, readFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { loadEnvFile } from "node:process"
import { Command } from "commander"
import pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"
import {
  planHistoricalManifestPage,
  registerHistoricalManifestPage
} from "../../src/ingestion/regulations/historical-manifest-registration.js"

const program = new Command()
  .name("register-regulatory-historical-manifest")
  .description("Preview or register one bounded page from a frozen federal regulatory manifest")
  .requiredOption("--environment <name>", "exact configured deployment environment")
  .requiredOption("--manifest <path>", "complete frozen backfill manifest")
  .requiredOption("--source <source>", "ecfr, govinfo-fr or govinfo-cfr")
  .requiredOption("--output <path>", "exclusive operator receipt path")
  .option("--after <hash>", "last unit key committed by the preceding page")
  .option("--limit <number>", "units registered in this page", "100")
  .option("--apply", "write the page to the canonical database; preview is read-only")
  .option("--plan <hash>", "exact preview page hash required with --apply")
  .action(run)

try {
  loadLocalEnvironment()
  await program.parseAsync()
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : "Historical manifest registration failed"}\n`)
  process.exitCode = 1
}

async function run(options: {
  after?: string
  apply?: boolean
  environment: string
  limit: string
  manifest: string
  output: string
  plan?: string
  source: string
}) {
  const manifestPath = resolve(options.manifest)
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"))
  const request = {
    manifest,
    sourceId: z.enum(["ecfr", "govinfo-fr", "govinfo-cfr"]).parse(options.source),
    afterUnitKey: options.after ?? null,
    limit: z.coerce.number().int().parse(options.limit)
  }
  const plan = planHistoricalManifestPage(request)
  const preview = {
    contract: "historical-regulatory-manifest-registration" as const,
    status: "planned" as const,
    environment: z.string().trim().min(1).max(100).parse(options.environment),
    manifestPath,
    manifestId: plan.manifest.id,
    sourceId: plan.input.sourceId,
    scopeKey: plan.scope.scopeKey,
    pageId: plan.pageId,
    afterUnitKey: plan.input.afterUnitKey,
    nextUnitKey: plan.nextUnitKey,
    registered: plan.units.length,
    exhausted: plan.exhausted,
    recurringIngestionEnabled: false
  }
  const output = resolve(options.output)
  await mkdir(dirname(output), { recursive: true })
  const receiptFile = await open(output, "wx")
  try {
    if (options.apply !== true) {
      await writeReceipt(receiptFile, preview)
      process.stdout.write(`${output}\n`)
      return
    }
    invariant(options.plan === preview.pageId, "historical_manifest_registration_plan_changed")
    invariant(
      process.env.REGULATORY_ENVIRONMENT?.trim() === preview.environment,
      "historical_manifest_registration_environment_mismatch"
    )
    const connectionString = z.url().parse(process.env.DATABASE_URL)
    const databaseUrl = new URL(connectionString)
    invariant(
      ["postgres:", "postgresql:"].includes(databaseUrl.protocol) &&
        databaseUrl.pathname !== "/" &&
        databaseUrl.pathname !== "/legislation_passage_search",
      "historical_manifest_registration_requires_canonical_database"
    )
    const pool = new pg.Pool({ connectionString, max: 1, connectionTimeoutMillis: 10_000, statement_timeout: 30_000 })
    try {
      const result = await registerHistoricalManifestPage(pool, request)
      await writeReceipt(receiptFile, { ...preview, status: "registered", result })
    } catch (error) {
      await writeReceipt(receiptFile, {
        ...preview,
        status: "failed",
        error: (error instanceof Error ? error.message : "Unknown registration failure").slice(0, 1000)
      })
      throw error
    } finally {
      await pool.end()
    }
    process.stdout.write(`${output}\n`)
  } finally {
    await receiptFile.close()
  }
}

async function writeReceipt(file: Awaited<ReturnType<typeof open>>, receipt: unknown) {
  await file.truncate(0)
  await file.write(`${JSON.stringify(receipt, null, 2)}\n`, 0, "utf8")
  await file.sync()
}

function loadLocalEnvironment(): void {
  try {
    loadEnvFile(new URL("../../.env", import.meta.url))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
  }
}
