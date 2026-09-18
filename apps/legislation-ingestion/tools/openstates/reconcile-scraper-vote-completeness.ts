import { createDatabase, withReadOnlyDatabase } from "@repo/legislation-core/database/database"
import { Command } from "commander"
import { sql } from "drizzle-orm"
import { z } from "zod"
import {
  applyScraperVoteCompletenessPlan,
  buildScraperVoteCompletenessPlan,
  scraperVoteCompletenessPlanSha256
} from "../../src/ingestion/openstates/scraper-vote-completeness.js"

const command = new Command()
  .argument("<state>")
  .argument("<session>")
  .option("--database-env <name>", "database URL environment variable", "DATABASE_URL")
  .option("--apply", "apply the exact reviewed completeness plan")
  .option("--expected-plan-sha256 <hash>", "required exact plan digest when applying")
  .option("--sample <count>", "include deterministic planned vote samples", "0")
  .parse()
const state = z.enum(["ak", "nc"]).parse(command.args[0])
const session = z
  .string()
  .regex(/^[A-Za-z0-9-]+$/)
  .parse(command.args[1])
const options = command.opts<{ apply?: boolean; databaseEnv: string; expectedPlanSha256?: string; sample: string }>()
const sample = z.coerce.number().int().min(0).max(20).parse(options.sample)
const expectedPlanSha256 = options.expectedPlanSha256
  ? z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .parse(options.expectedPlanSha256)
  : undefined
if (options.apply && expectedPlanSha256 === undefined) {
  throw new Error("--apply requires --expected-plan-sha256 from a reviewed dry run")
}
const databaseUrl = z.string().url().parse(process.env[options.databaseEnv])
const { database, pool } = createDatabase(
  { connectionTimeoutMs: 10_000, idleTimeoutMs: 10_000, maxConnections: 1, url: databaseUrl },
  { statementTimeoutMs: 60_000 }
)

try {
  if (!options.apply) {
    const plan = await withReadOnlyDatabase(pool, 60_000, (transaction) =>
      buildScraperVoteCompletenessPlan(transaction, state, session)
    )
    process.stdout.write(
      `${JSON.stringify({
        applied: false,
        planSha256: scraperVoteCompletenessPlanSha256(plan),
        planned: plan.rows.length,
        rejected: plan.rejected,
        scanned: plan.scanned,
        ...(sample === 0 ? {} : { samples: plan.rows.slice(0, sample) })
      })}\n`
    )
  } else {
    const result = await database.transaction(async (transaction) => {
      await transaction.execute(sql`set local lock_timeout = '5s'`)
      const plan = await buildScraperVoteCompletenessPlan(transaction, state, session)
      const planSha256 = scraperVoteCompletenessPlanSha256(plan)
      if (planSha256 !== expectedPlanSha256) {
        throw new Error(
          `Scraper vote completeness plan changed; expected ${expectedPlanSha256}, received ${planSha256}`
        )
      }
      return { plan, planSha256, updates: await applyScraperVoteCompletenessPlan(transaction, plan) }
    })
    process.stdout.write(
      `${JSON.stringify({
        applied: true,
        planSha256: result.planSha256,
        planned: result.plan.rows.length,
        rejected: result.plan.rejected,
        scanned: result.plan.scanned,
        updates: result.updates
      })}\n`
    )
  }
} finally {
  await pool.end()
}
