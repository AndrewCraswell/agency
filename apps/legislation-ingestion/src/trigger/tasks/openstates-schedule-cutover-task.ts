import { schedules, task } from "@trigger.dev/sdk"
import { z } from "zod"
import {
  applySynchronizationScheduleReconciliation,
  planSynchronizationScheduleReconciliation,
  type RemoteSynchronizationSchedule
} from "../reconciliation.js"
import { isLegacyAlaskaOrNorthCarolinaApiSchedule, isManagedScraperSchedule } from "../scraper-schedule-cutover.js"
import { createScraperScheduleManifest, parseScheduledScraperJurisdictions } from "../scraper-schedule-manifest.js"

const payloadSchema = z.strictObject({
  confirmation: z.literal("replace-ak-nc-api-pollers-with-self-hosted-scrapers")
})

export const openStatesScheduleCutover = task({
  id: "openstates-schedule-cutover",
  maxDuration: 300,
  retry: { maxAttempts: 1 },
  queue: { name: "openstates-schedule-administration", concurrencyLimit: 1 },
  run: async (raw: unknown, { ctx }) => {
    payloadSchema.parse(raw)
    if (ctx.environment.type !== "PRODUCTION") {
      throw new Error("Open States schedule cutover must run in production")
    }
    const enabledJurisdictions = parseScheduledScraperJurisdictions(process.env.OPENSTATES_SCRAPER_ENABLED_STATES)
    if (!enabledJurisdictions.includes("ak") || !enabledJurisdictions.includes("nc")) {
      throw new Error("Schedule cutover requires both Alaska and North Carolina scraper activation")
    }

    const inactiveManifest = createScraperScheduleManifest({
      active: false,
      enabledJurisdictions,
      environment: "production"
    })
    const staged = await reconcileScraperSchedules(inactiveManifest)

    const beforeLegacy = (await listRemoteSchedules()).filter(isLegacyAlaskaOrNorthCarolinaApiSchedule)
    for (const legacy of beforeLegacy.filter((entry) => entry.active)) {
      await schedules.deactivate(legacy.id)
    }
    const remainingLegacy = (await listRemoteSchedules()).filter(
      (entry) => isLegacyAlaskaOrNorthCarolinaApiSchedule(entry) && entry.active
    )
    if (remainingLegacy.length > 0) {
      throw new Error("Legacy Open States API schedules remain active")
    }

    const activeManifest = createScraperScheduleManifest({
      active: true,
      enabledJurisdictions,
      environment: "production"
    })
    const activated = await reconcileScraperSchedules(activeManifest)
    return {
      status: "cutover_complete" as const,
      legacyApiSchedulesDeactivated: beforeLegacy.filter((entry) => entry.active).length,
      staged,
      activated
    }
  }
})

async function reconcileScraperSchedules(manifest: ReturnType<typeof createScraperScheduleManifest>) {
  const remote = (await listRemoteSchedules()).filter((entry) => isManagedScraperSchedule(entry, "production"))
  const plan = planSynchronizationScheduleReconciliation(manifest, remote)
  const applied = await applySynchronizationScheduleReconciliation(plan, {
    activate: (id) => schedules.activate(id),
    create: (input) => schedules.create(input),
    deactivate: (id) => schedules.deactivate(id),
    update: (id, input) => schedules.update(id, input)
  })
  const verificationRemote = (await listRemoteSchedules()).filter((entry) =>
    isManagedScraperSchedule(entry, "production")
  )
  const verification = planSynchronizationScheduleReconciliation(manifest, verificationRemote)
  if (verification.actions.length > 0 || verification.unchanged !== manifest.length) {
    throw new Error(
      `Scraper schedule reconciliation did not converge: ${verification.actions.length} actions remain and ${verification.unchanged}/${manifest.length} schedules match`
    )
  }
  return { ...applied, verified: verification.unchanged }
}

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
