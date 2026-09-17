import type { SynchronizationScheduleManifestEntry } from "./manifest.js"

export type RemoteSynchronizationSchedule = Readonly<{
  active: boolean
  cron: string
  deduplicationKey?: string | null
  externalId?: string | null
  id: string
  taskIdentifier: string
  timezone: string
}>

export type SynchronizationScheduleReconciliationAction =
  | Readonly<{ schedule: SynchronizationScheduleManifestEntry; type: "create" }>
  | Readonly<{
      id: string
      schedule: SynchronizationScheduleManifestEntry
      type: "update"
    }>
  | Readonly<{
      id: string
      schedule: SynchronizationScheduleManifestEntry
      type: "activate"
    }>
  | Readonly<{
      deduplicationKey: string
      externalId?: string | null
      id: string
      reason: "desired-inactive" | "stale-managed-schedule"
      type: "deactivate"
    }>

export type SynchronizationScheduleReconciliationPlan = Readonly<{
  actions: readonly SynchronizationScheduleReconciliationAction[]
  unchanged: number
}>

export type SynchronizationScheduleMutationClient = Readonly<{
  activate: (id: string) => Promise<unknown>
  create: (input: {
    cron: string
    deduplicationKey: string
    externalId: string
    task: string
    timezone: string
  }) => Promise<{ id: string }>
  deactivate: (id: string) => Promise<unknown>
  update: (id: string, input: { cron: string; externalId: string; task: string; timezone: string }) => Promise<unknown>
}>

export type AppliedSynchronizationSchedulePlan = Readonly<{
  activated: number
  created: number
  deactivated: number
  updated: number
}>

export type SynchronizationScheduleScope = "federal" | "openstates"

export function selectSynchronizationScheduleScope(
  manifest: readonly SynchronizationScheduleManifestEntry[],
  remoteSchedules: readonly RemoteSynchronizationSchedule[],
  scope: SynchronizationScheduleScope
): Readonly<{
  manifest: readonly SynchronizationScheduleManifestEntry[]
  remoteSchedules: readonly RemoteSynchronizationSchedule[]
}> {
  const selectsOpenStates = scope === "openstates"
  return {
    manifest: manifest.filter((schedule) => (schedule.identity.provider === "openstates") === selectsOpenStates),
    remoteSchedules: remoteSchedules.filter((schedule) => {
      const externalMatch = schedule.externalId?.startsWith("openstates:") ?? false
      const keyMatch = schedule.deduplicationKey?.includes(":openstates:") ?? false
      if (externalMatch !== keyMatch && schedule.externalId != null && schedule.deduplicationKey != null) {
        throw new Error(`Trigger.dev schedule provider identity is inconsistent: ${schedule.id}`)
      }
      return (externalMatch || keyMatch) === selectsOpenStates
    })
  }
}

export function planSynchronizationScheduleReconciliation(
  manifest: readonly SynchronizationScheduleManifestEntry[],
  remoteSchedules: readonly RemoteSynchronizationSchedule[]
): SynchronizationScheduleReconciliationPlan {
  const actions: SynchronizationScheduleReconciliationAction[] = []
  const environmentPrefix = managedEnvironmentPrefix(manifest)
  const desiredByKey = new Map(manifest.map((schedule) => [schedule.deduplicationKey, schedule]))
  const remoteByKey = new Map<string, RemoteSynchronizationSchedule>()

  for (const remote of remoteSchedules) {
    const key = remote.deduplicationKey
    if (key !== null && key !== undefined && key.startsWith(environmentPrefix)) {
      if (remoteByKey.has(key)) {
        throw new Error(`Trigger.dev returned duplicate managed schedule key: ${key}`)
      }
      remoteByKey.set(key, remote)
    }
  }

  let unchanged = 0
  for (const schedule of manifest) {
    const remote = remoteByKey.get(schedule.deduplicationKey)
    if (remote === undefined) {
      actions.push({ schedule, type: "create" })
      continue
    }

    let changed = false
    if (!scheduleMatchesRemote(schedule, remote)) {
      actions.push({ id: remote.id, schedule, type: "update" })
      changed = true
    }
    if (remote.active) {
      if (schedule.active) {
        if (!changed) {
          unchanged += 1
        }
        continue
      }
      actions.push({
        deduplicationKey: schedule.deduplicationKey,
        externalId: remote.externalId,
        id: remote.id,
        reason: "desired-inactive",
        type: "deactivate"
      })
      changed = true
    } else if (schedule.active) {
      actions.push({ id: remote.id, schedule, type: "activate" })
      changed = true
    }
    if (!changed) {
      unchanged += 1
    }
  }

  for (const remote of remoteByKey.values()) {
    const key = remote.deduplicationKey
    if (key !== null && key !== undefined && !desiredByKey.has(key) && remote.active) {
      actions.push({
        deduplicationKey: key,
        externalId: remote.externalId,
        id: remote.id,
        reason: "stale-managed-schedule",
        type: "deactivate"
      })
    }
  }

  return { actions, unchanged }
}

export async function applySynchronizationScheduleReconciliation(
  plan: SynchronizationScheduleReconciliationPlan,
  client: SynchronizationScheduleMutationClient
): Promise<AppliedSynchronizationSchedulePlan> {
  const counts = { activated: 0, created: 0, deactivated: 0, updated: 0 }
  const actions = [...plan.actions].sort((left, right) => actionPriority(left.type) - actionPriority(right.type))

  for (const action of actions) {
    if (action.type === "deactivate") {
      await client.deactivate(action.id)
      counts.deactivated += 1
      continue
    }
    if (action.type === "update") {
      await client.update(action.id, mutationInput(action.schedule))
      counts.updated += 1
      continue
    }
    if (action.type === "create") {
      const created = await client.create({
        ...disabledMutationInput(action.schedule),
        deduplicationKey: action.schedule.deduplicationKey
      })
      counts.created += 1
      await client.deactivate(created.id)
      counts.deactivated += 1
      await client.update(created.id, mutationInput(action.schedule))
      counts.updated += 1
      if (action.schedule.active) {
        await client.activate(created.id)
        counts.activated += 1
      }
      continue
    }
    await client.activate(action.id)
    counts.activated += 1
  }

  return counts
}

function managedEnvironmentPrefix(manifest: readonly SynchronizationScheduleManifestEntry[]): string {
  const firstKey = manifest[0]?.deduplicationKey
  if (firstKey === undefined) {
    throw new Error("Synchronization schedule manifest cannot be empty")
  }
  const separator = firstKey.indexOf(":")
  if (separator < 1) {
    throw new Error("Synchronization schedule manifest has an invalid deduplication key")
  }
  const prefix = firstKey.slice(0, separator + 1)
  if (!manifest.every((schedule) => schedule.deduplicationKey.startsWith(prefix))) {
    throw new Error("Synchronization schedule manifest cannot mix environments")
  }
  return prefix
}

function scheduleMatchesRemote(
  desired: SynchronizationScheduleManifestEntry,
  remote: RemoteSynchronizationSchedule
): boolean {
  return (
    remote.cron === desired.cron &&
    remote.externalId === desired.externalId &&
    remote.taskIdentifier === desired.taskIdentifier &&
    remote.timezone === desired.timezone
  )
}

function actionPriority(type: SynchronizationScheduleReconciliationAction["type"]): number {
  if (type === "deactivate") {
    return 0
  }
  if (type === "update") {
    return 1
  }
  if (type === "create") {
    return 2
  }
  return 3
}

function mutationInput(schedule: SynchronizationScheduleManifestEntry) {
  return {
    cron: schedule.cron,
    externalId: schedule.externalId,
    task: schedule.taskIdentifier,
    timezone: schedule.timezone
  }
}

function disabledMutationInput(schedule: SynchronizationScheduleManifestEntry) {
  return {
    ...mutationInput(schedule),
    externalId: `disabled:${schedule.externalId}`
  }
}
