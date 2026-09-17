import { loadEnvFile } from "node:process"
import { configure, schedules } from "@trigger.dev/sdk"
import { Command } from "commander"
import { parseSynchronizationEnvironment } from "../../src/trigger/identities.js"
import {
  applySynchronizationScheduleReconciliation,
  planSynchronizationScheduleReconciliation,
  type RemoteSynchronizationSchedule
} from "../../src/trigger/reconciliation.js"
import {
  createScraperScheduleManifest,
  parseScheduledScraperJurisdictions
} from "../../src/trigger/scraper-schedule-manifest.js"

const program = new Command()
  .name("reconcile-scraper-schedules")
  .description("Plan or apply the self-hosted Open States scraper schedules")
  .option("--activate", "activate schedules for OPENSTATES_SCRAPER_ENABLED_STATES")
  .option("--apply", "apply the reconciliation plan; without this flag the command is read-only")
  .option("--environment <environment>", "development, staging, or production", "development")
  .action(reconcile)

try {
  loadLocalEnvironment()
  await program.parseAsync()
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : "Scraper schedule reconciliation failed"}\n`)
  process.exitCode = 1
}

async function reconcile(options: { activate?: boolean; apply?: boolean; environment: string }) {
  const accessToken = process.env.TRIGGER_DEV_API_KEY?.trim() || process.env.TRIGGER_SECRET_KEY?.trim()
  if (accessToken === undefined) throw new Error("TRIGGER_SECRET_KEY or TRIGGER_DEV_API_KEY is required")
  configure({ accessToken })

  const environment = parseSynchronizationEnvironment(options.environment)
  const enabledJurisdictions = parseScheduledScraperJurisdictions(process.env.OPENSTATES_SCRAPER_ENABLED_STATES)
  if (options.activate === true && enabledJurisdictions.length === 0) {
    throw new Error("--activate requires OPENSTATES_SCRAPER_ENABLED_STATES")
  }
  const manifest = createScraperScheduleManifest({
    active: options.activate === true,
    enabledJurisdictions,
    environment
  })
  const prefix = `${environment}:openstates-scraper:`
  const remote = (await listRemoteSchedules()).filter((entry) => entry.deduplicationKey?.startsWith(prefix) === true)
  const plan = planSynchronizationScheduleReconciliation(manifest, remote)

  if (options.apply !== true) {
    process.stdout.write(
      `${JSON.stringify({ actions: plan.actions, active: manifest.filter((entry) => entry.active).length, desired: manifest.length, mode: "plan", unchanged: plan.unchanged }, null, 2)}\n`
    )
    return
  }

  const applied = await applySynchronizationScheduleReconciliation(plan, {
    activate: (id) => schedules.activate(id),
    create: (input) => schedules.create(input),
    deactivate: (id) => schedules.deactivate(id),
    update: (id, input) => schedules.update(id, input)
  })
  const verificationRemote = (await listRemoteSchedules()).filter(
    (entry) => entry.deduplicationKey?.startsWith(prefix) === true
  )
  const verification = planSynchronizationScheduleReconciliation(manifest, verificationRemote)
  if (verification.actions.length > 0 || verification.unchanged !== manifest.length) {
    throw new Error(
      `Scraper schedule reconciliation did not converge: ${verification.actions.length} actions remain and ${verification.unchanged}/${manifest.length} schedules match`
    )
  }
  process.stdout.write(
    `${JSON.stringify({ applied, desired: manifest.length, mode: "apply", unchangedBeforeApply: plan.unchanged, verified: verification.unchanged }, null, 2)}\n`
  )
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

function loadLocalEnvironment(): void {
  try {
    loadEnvFile(new URL("../../.env", import.meta.url))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
  }
}
