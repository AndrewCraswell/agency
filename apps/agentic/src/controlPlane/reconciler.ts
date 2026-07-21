import { z } from "zod"
import { resolveRuntimeSecrets } from "../azure/secretProvider"
import { createControlPlaneRuntime } from "../persistence/controlPlaneRuntime"

const ReconcilerEnvironmentSchema = z.object({
  WEBHOOK_STALE_AFTER_MS: z.coerce
    .number()
    .int()
    .min(60_000)
    .max(24 * 60 * 60 * 1_000)
    .default(15 * 60 * 1_000),
  WEBHOOK_MAX_ATTEMPTS: z.coerce.number().int().positive().max(10).default(3)
})

const runtimeEnvironment = await resolveRuntimeSecrets(process.env, ["POSTGRES_API_URL"])
const environment = ReconcilerEnvironmentSchema.parse(runtimeEnvironment)
const runtime = await createControlPlaneRuntime(runtimeEnvironment)

try {
  const staleBefore = new Date(Date.now() - environment.WEBHOOK_STALE_AFTER_MS)
  const requeued = await runtime.webhookStore.requeueRecoverable(staleBefore, environment.WEBHOOK_MAX_ATTEMPTS)
  const providerDeliveries = await runtime.providerDeliveryStore.recover(staleBefore, environment.WEBHOOK_MAX_ATTEMPTS)
  const effects = await runtime.workflowJournalStore.reconcileStaleEffects(staleBefore)
  process.stdout.write(`Requeued ${requeued} recoverable webhook deliveries.\n`)
  process.stdout.write(`Recovered ${providerDeliveries} provider deliveries.\n`)
  process.stdout.write(`Marked ${effects} stale provider effects for reconciliation.\n`)
} finally {
  await runtime.close()
}
