import { createDatabase, withReadOnlyDatabase } from "@repo/legislation-core/database/database"
import { Command } from "commander"
import { sql } from "drizzle-orm"
import { z } from "zod"
import { scraperBillState } from "../../src/ingestion/openstates/scraper-bill-profiles.js"
import {
  applyScraperPersonBackfillPlan,
  buildScraperPersonBackfillPlan,
  scraperPersonBackfillPlanSha256
} from "../../src/ingestion/openstates/scraper-person-backfill.js"

const command = new Command()
  .argument("<state>")
  .argument("<session>")
  .option("--database-env <name>", "database URL environment variable", "DATABASE_URL")
  .option("--apply", "apply the exact reviewed null-only relationship plan")
  .option("--expected-plan-sha256 <hash>", "required exact plan digest when applying")
  .option("--sample <count>", "include deterministic relationship samples in a dry run", "0")
  .parse()
const state = scraperBillState.parse(command.args[0])
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
const { database, pool } = createDatabase({
  connectionTimeoutMs: 10_000,
  idleTimeoutMs: 10_000,
  maxConnections: 1,
  url: databaseUrl
})

try {
  if (!options.apply) {
    const plan = await withReadOnlyDatabase(pool, 60_000, (transaction) =>
      buildScraperPersonBackfillPlan(transaction, state, session)
    )
    process.stdout.write(
      `${JSON.stringify({
        applied: false,
        planSha256: scraperPersonBackfillPlanSha256(plan),
        ...plan.summary,
        ...(sample === 0
          ? {}
          : { samples: { positions: plan.positions.slice(0, sample), sponsors: plan.sponsors.slice(0, sample) } })
      })}\n`
    )
  } else {
    const result = await database.transaction(async (transaction) => {
      await transaction.execute(sql`set local lock_timeout = '5s'`)
      await transaction.execute(sql`set local statement_timeout = '60s'`)
      const plan = await buildScraperPersonBackfillPlan(transaction, state, session)
      const planSha256 = scraperPersonBackfillPlanSha256(plan)
      if (planSha256 !== expectedPlanSha256) {
        throw new Error(`Scraper person backfill plan changed; expected ${expectedPlanSha256}, received ${planSha256}`)
      }
      return { plan, planSha256, updates: await applyScraperPersonBackfillPlan(transaction, plan) }
    })
    process.stdout.write(
      `${JSON.stringify({ applied: true, planSha256: result.planSha256, ...result.plan.summary, updates: result.updates })}\n`
    )
  }
} finally {
  await pool.end()
}
