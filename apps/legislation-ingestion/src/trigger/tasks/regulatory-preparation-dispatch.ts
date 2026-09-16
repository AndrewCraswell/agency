import { idempotencyKeys, task, tasks } from "@trigger.dev/sdk"
import pg from "pg"
import { z } from "zod"
import {
  preparationDispatchSchema,
  registerLegalPreparationDispatch,
  submitLegalPreparation
} from "../../ingestion/regulations/preparation-dispatch.js"
import { preparationPlanSchema, planLegalPreparationPage } from "../../ingestion/regulations/preparation-plan.js"
import {
  preparationRecoverySchema,
  recoverLegalPreparationPage
} from "../../ingestion/regulations/preparation-recovery.js"

const initialSchema = z
  .strictObject({ dispatches: z.array(preparationDispatchSchema).min(1).max(10) })
  .superRefine((value, ctx) => {
    const identities = value.dispatches.map((item) =>
      JSON.stringify([item.waveId, item.scope.kind, item.scope.id, item.model])
    )
    if (new Set(identities).size !== identities.length) {
      ctx.addIssue({ code: "custom", message: "Duplicate preparation dispatch" })
    }
  })
const schema = z.union([
  initialSchema,
  z.strictObject({ recovery: preparationRecoverySchema }),
  z.strictObject({ plan: preparationPlanSchema })
])

/** Explicit, finite operator wave. Enqueue success does not imply preparation, copy or embedding completion. */
export const regulatoryPreparationDispatch = task({
  id: "regulatory-preparation-dispatch",
  maxDuration: 300,
  queue: { name: "regulatory-preparation-dispatch", concurrencyLimit: 1 },
  retry: { maxAttempts: 4, minTimeoutInMs: 125_000, maxTimeoutInMs: 180_000, factor: 1.5, randomize: true },
  run: async (payload: unknown) => runRegulatoryPreparationDispatch(payload)
})

export async function runRegulatoryPreparationDispatch(value: unknown) {
  const input = schema.parse(value)
  const url = new URL(z.url().parse(process.env.DATABASE_URL))
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    url.pathname === "/" ||
    url.pathname === "/legislation_passage_search"
  ) {
    throw new Error("Regulatory dispatch requires a canonical PostgreSQL database")
  }
  const pool = new pg.Pool({
    connectionString: url.href,
    max: 2,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 15_000
  })
  try {
    const name = (await pool.query("SELECT current_database() AS name")).rows[0]?.name
    if (typeof name !== "string" || name === "legislation_passage_search") {
      throw new Error("Regulatory dispatch requires a canonical PostgreSQL database")
    }
    if ("plan" in input) {
      return await planLegalPreparationPage(pool, input.plan)
    }
    const submit: Parameters<typeof submitLegalPreparation>[2] = async (payload, options) =>
      tasks.trigger("regulatory-passage-preparation", payload, {
        ...options,
        idempotencyKey: await idempotencyKeys.create(options.idempotencyKey, { scope: "global" })
      })
    if ("recovery" in input) {
      return await recoverLegalPreparationPage(pool, input.recovery, submit)
    }
    const results = []
    // Persist the complete bounded wave before admitting its first child.
    for (const dispatch of input.dispatches) {
      await registerLegalPreparationDispatch(pool, dispatch)
    }
    // Serial submission caps outstanding SDK calls; child queue independently caps preparation at two workers.
    for (const dispatch of input.dispatches) {
      results.push(await submitLegalPreparation(pool, dispatch, submit))
    }
    return { submitted: results.length, results }
  } finally {
    await pool.end()
  }
}
