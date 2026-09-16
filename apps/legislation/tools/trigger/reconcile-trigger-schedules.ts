import { loadEnvFile } from "node:process"
import { configure, schedules } from "@trigger.dev/sdk"
import { Command } from "commander"
import { parseSynchronizationEnvironment } from "../../src/trigger/identities.js"
import { createSynchronizationScheduleManifest } from "../../src/trigger/manifest.js"
import {
  applySynchronizationScheduleReconciliation,
  planSynchronizationScheduleReconciliation,
  type RemoteSynchronizationSchedule
} from "../../src/trigger/reconciliation.js"
import {
  parseOpenStatesScheduleGate,
  resolveOpenStatesScheduleActivation
} from "../../src/trigger/schedule-activation-policy.js"

const program = new Command()
  .name("reconcile-trigger-schedules")
  .description("Plan or explicitly apply Trigger.dev synchronization schedule reconciliation")
  .option("--activate", "make Congress.gov and GovInfo schedules active")
  .option(
    "--activate-openstates",
    "make OpenStates schedules active; requires --activate, --apply, and OPENSTATES_SCHEDULES_ENABLED=true"
  )
  .option("--apply", "apply the reconciliation plan; without this flag the command is read-only")
  .option("--current-congress <number>", "configured current Congress", "119")
  .option("--environment <environment>", "development, staging, or production", "development")
  .action(reconcile)

try {
  loadLocalEnvironment()
  await program.parseAsync()
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : "Trigger.dev schedule reconciliation failed"}\n`)
  process.exitCode = 1
}

async function reconcile(options: {
  activate?: boolean
  activateOpenstates?: boolean
  apply?: boolean
  currentCongress: string
  environment: string
}) {
  const accessToken = process.env.TRIGGER_DEV_API_KEY?.trim() || process.env.TRIGGER_SECRET_KEY?.trim()
  if (accessToken === undefined) {
    throw new Error("TRIGGER_SECRET_KEY or TRIGGER_DEV_API_KEY is required")
  }
  configure({ accessToken })

  const currentCongress = Number(options.currentCongress)
  if (!Number.isSafeInteger(currentCongress) || currentCongress < 1) {
    throw new Error("current Congress must be a positive integer")
  }
  const environment = parseSynchronizationEnvironment(options.environment)
  if (options.activate === true && options.apply !== true) {
    throw new Error("--activate requires --apply")
  }
  if (options.activateOpenstates === true && options.apply !== true) {
    throw new Error("--activate-openstates requires --apply")
  }
  const openStatesSchedulesEnabled = parseOpenStatesScheduleGate(process.env.OPENSTATES_SCHEDULES_ENABLED)
  const openStatesActive = resolveOpenStatesScheduleActivation({
    activate: options.activate === true,
    activateOpenStates: options.activateOpenstates === true,
    openStatesSchedulesEnabled
  })
  const manifest = createSynchronizationScheduleManifest({
    active: options.activate === true,
    currentCongress,
    environment,
    openStatesActive
  })
  const remoteSchedules = await listRemoteSchedules()

  const plan = planSynchronizationScheduleReconciliation(manifest, remoteSchedules)
  if (options.apply === true) {
    const applied = await applySynchronizationScheduleReconciliation(plan, {
      activate: (id) => schedules.activate(id),
      create: (input) => schedules.create(input),
      deactivate: (id) => schedules.deactivate(id),
      update: (id, input) => schedules.update(id, input)
    })
    const verification = planSynchronizationScheduleReconciliation(manifest, await listRemoteSchedules())
    if (verification.actions.length > 0 || verification.unchanged !== manifest.length) {
      throw new Error(
        `Trigger.dev schedule reconciliation did not converge: ${verification.actions.length} actions remain and ${verification.unchanged}/${manifest.length} schedules match`
      )
    }
    process.stdout.write(
      `${JSON.stringify({ active: activeScheduleCounts(manifest), applied, desired: manifest.length, mode: "apply", unchangedBeforeApply: plan.unchanged, verified: verification.unchanged }, null, 2)}\n`
    )
    return
  }
  process.stdout.write(
    `${JSON.stringify({ actions: plan.actions, active: activeScheduleCounts(manifest), desired: manifest.length, mode: "plan", unchanged: plan.unchanged }, null, 2)}\n`
  )
}

function activeScheduleCounts(manifest: ReturnType<typeof createSynchronizationScheduleManifest>) {
  return {
    congressAndGovInfo: manifest.filter((schedule) => schedule.active && schedule.identity.provider !== "openstates")
      .length,
    openStates: manifest.filter((schedule) => schedule.active && schedule.identity.provider === "openstates").length
  }
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
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error
    }
  }
}
