import { mkdir, open } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { loadEnvFile } from "node:process"
import { configure, idempotencyKeys, tasks } from "@trigger.dev/sdk"
import { Command } from "commander"
import pg from "pg"
import invariant from "tiny-invariant"
import { z } from "zod"
import {
  inspectLegalPassageBackfillStart,
  requireLegalPassageBackfillApply
} from "../../src/ingestion/regulations/passage-backfill-start.js"

const sourceSchema = z.enum(["ecfr", "govinfo-cfr", "govinfo-fr"])

const program = new Command()
  .name("run-regulatory-passage-backfill")
  .description("Preview or start one admitted, bounded regulatory passage backfill")
  .requiredOption("--environment <name>", "exact configured deployment environment")
  .requiredOption("--catalog <path>", "frozen passage catalog")
  .requiredOption("--hash <hash>", "exact SHA-256 of the catalog")
  .requiredOption("--wave <uuid>", "immutable wave identifier")
  .requiredOption("--source <source>", "ecfr, govinfo-cfr or govinfo-fr")
  .requiredOption("--cutoff <timestamp>", "inclusive publisher cutoff with UTC offset")
  .requiredOption("--output <path>", "exclusive operator receipt path")
  .option("--limit <number>", "versions prepared by each bounded worker invocation", "10")
  .option("--audit-batch <number>", "catalog entries reconciled per read-only query", "1000")
  .option("--apply", "submit the planning controller; without this flag the command is read-only")
  .option("--plan <hash>", "exact preview plan hash required with --apply")
  .action(run)

try {
  loadLocalEnvironment()
  await program.parseAsync()
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : "Regulatory passage backfill command failed"}\n`)
  process.exitCode = 1
}

async function run(options: {
  apply?: boolean
  auditBatch: string
  catalog: string
  cutoff: string
  environment: string
  hash: string
  limit: string
  output: string
  plan?: string
  source: string
  wave: string
}) {
  const connectionString = z.url().parse(process.env.REGULATORY_TEST_DATABASE_URL)
  const url = new URL(connectionString)
  invariant(
    ["postgres:", "postgresql:"].includes(url.protocol) &&
      ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) &&
      url.pathname === "/regulations_test",
    "legal_passage_backfill_requires_local_pilot"
  )
  const output = resolve(options.output)
  const pool = new pg.Pool({ connectionString, max: 1, connectionTimeoutMillis: 10_000 })
  try {
    const report = await inspectLegalPassageBackfillStart(pool, {
      catalogPath: resolve(options.catalog),
      catalogHash: options.hash,
      environment: options.environment,
      waveId: options.wave,
      source: sourceSchema.parse(options.source),
      publishedBefore: options.cutoff,
      limit: z.coerce.number().int().parse(options.limit),
      batchSize: z.coerce.number().int().parse(options.auditBatch)
    })
    await mkdir(dirname(output), { recursive: true })
    const receiptFile = await open(output, "wx")
    try {
      let receipt: unknown = report
      if (options.apply === true) {
        const payload = requireLegalPassageBackfillApply(report, {
          environment: process.env.REGULATORY_ENVIRONMENT?.trim(),
          model: process.env.REGULATORY_EMBEDDING_MODEL?.trim(),
          planId: options.plan
        })
        const accessToken = process.env.TRIGGER_DEV_API_KEY?.trim() || process.env.TRIGGER_SECRET_KEY?.trim()
        invariant(accessToken !== undefined, "legal_passage_backfill_trigger_key_missing")
        configure({ accessToken })
        try {
          const handle = await tasks.trigger("regulatory-preparation-dispatch", payload, {
            idempotencyKey: await idempotencyKeys.create(`legal-passage-backfill-operator:${report.planId}`, {
              scope: "global"
            }),
            idempotencyKeyTTL: "7d"
          })
          receipt = { ...report, status: "triggered", runId: handle.id }
        } catch (error) {
          await writeReceipt(receiptFile, {
            ...report,
            status: "submission_failed",
            error: (error instanceof Error ? error.message : "Unknown submission failure").slice(0, 1000)
          })
          throw error
        }
      }
      await writeReceipt(receiptFile, receipt)
    } finally {
      await receiptFile.close()
    }
    process.stdout.write(`${output}\n`)
  } finally {
    await pool.end()
  }
}

async function writeReceipt(file: Awaited<ReturnType<typeof open>>, receipt: unknown) {
  const contents = `${JSON.stringify(receipt, null, 2)}\n`
  await file.truncate(0)
  await file.write(contents, 0, "utf8")
  await file.sync()
}

function loadLocalEnvironment(): void {
  try {
    loadEnvFile(new URL("../../.env", import.meta.url))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
  }
}
