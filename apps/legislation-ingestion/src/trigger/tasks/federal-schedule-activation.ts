import { schedules, task } from "@trigger.dev/sdk"
import { z } from "zod"
import { createSynchronizationScheduleManifest, defaultCurrentCongress } from "../manifest.js"
import {
  applySynchronizationScheduleReconciliation,
  planSynchronizationScheduleReconciliation,
  selectSynchronizationScheduleScope,
  type RemoteSynchronizationSchedule
} from "../reconciliation.js"

const payloadSchema = z.strictObject({
  confirmation: z.literal("activate-production-federal-schedules")
})

export const federalScheduleActivation = task({
  id: "federal-schedule-activation",
  maxDuration: 300,
  retry: { maxAttempts: 1 },
  queue: { name: "federal-schedule-administration", concurrencyLimit: 1 },
  run: async (raw: unknown, { ctx }) => {
    payloadSchema.parse(raw)
    if (ctx.environment.type !== "PRODUCTION") {
      throw new Error("Federal schedule activation must run in production")
    }

    const currentCongress = Number(process.env.FEDERAL_END_CONGRESS ?? defaultCurrentCongress)
    const manifest = createSynchronizationScheduleManifest({
      active: true,
      currentCongress,
      environment: "production"
    })
    const selected = selectSynchronizationScheduleScope(manifest, await listRemoteSchedules(), "federal")
    const plan = planSynchronizationScheduleReconciliation(selected.manifest, selected.remoteSchedules)
    const applied = await applySynchronizationScheduleReconciliation(plan, {
      activate: (id) => schedules.activate(id),
      create: (input) => schedules.create(input),
      deactivate: (id) => schedules.deactivate(id),
      update: (id, input) => schedules.update(id, input)
    })
    const verificationScope = selectSynchronizationScheduleScope(manifest, await listRemoteSchedules(), "federal")
    const verification = planSynchronizationScheduleReconciliation(
      verificationScope.manifest,
      verificationScope.remoteSchedules
    )
    if (verification.actions.length > 0 || verification.unchanged !== selected.manifest.length) {
      throw new Error(
        `Federal schedule activation did not converge: ${verification.actions.length} actions remain and ${verification.unchanged}/${selected.manifest.length} schedules match`
      )
    }
    return { applied, status: "activated" as const, verified: verification.unchanged }
  }
})

async function listRemoteSchedules(): Promise<RemoteSynchronizationSchedule[]> {
  const remoteSchedules: RemoteSynchronizationSchedule[] = []
  for await (const remote of schedules.list({ perPage: 100 })) {
    remoteSchedules.push({
      active: remote.active,
      cron: remote.generator.expression,
      deduplicationKey: remote.deduplicationKey,
      externalId: remote.externalId,
      id: remote.id,
      taskIdentifier: remote.task,
      timezone: remote.timezone
    })
  }
  return remoteSchedules
}
