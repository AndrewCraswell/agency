import { schedules, tasks } from "@trigger.dev/sdk"
import {
  formatSynchronizationIdentity,
  synchronizationTaskIdentifierFor,
  type SynchronizationIdentity
} from "../identities.js"
import { createSynchronizationScheduleManifest, parseManagedSynchronizationIdentity } from "../manifest.js"
import type { congressWaveCoordinator } from "./congress-wave-coordinator.js"
import type { govInfoBillStatusSync } from "./govinfo-workers.js"
import type { openStatesBillsSync, openStatesEntitiesSync, openStatesEventsSync } from "./openstates-workers.js"
import type { SynchronizationWorkerTaskPayload } from "./worker-contract.js"

type SynchronizationWorkerTask =
  | typeof govInfoBillStatusSync
  | typeof openStatesBillsSync
  | typeof openStatesEntitiesSync
  | typeof openStatesEventsSync
  | typeof congressWaveCoordinator

export const scheduleDispatcher = schedules.task({
  id: "schedule-dispatcher",
  maxDuration: 60,
  run: dispatchSynchronization
})

export function scheduledTaskIdentifierFor(identity: SynchronizationIdentity): string {
  return synchronizationTaskIdentifierFor(identity)
}

async function dispatchSynchronization(
  payload: Readonly<{ externalId?: string; scheduleId: string; timestamp: Date }>
) {
  const currentCongress = Number(process.env.FEDERAL_END_CONGRESS ?? "119")
  const manifest = createSynchronizationScheduleManifest({ currentCongress })
  const identity = parseManagedSynchronizationIdentity(payload.externalId, manifest)
  const identityKey = formatSynchronizationIdentity(identity)
  const occurrenceKey = `${payload.scheduleId}:${payload.timestamp.toISOString()}`
  if (identity.provider === "congress") {
    const hour = payload.timestamp.toISOString().slice(0, 13)
    const handle = await tasks.trigger<typeof congressWaveCoordinator>(
      "congress-wave-coordinator",
      { currentCongress, kind: "recurring" },
      {
        concurrencyKey: "congress-wave",
        idempotencyKey: `congress-recurring:${hour}`,
        tags: ["provider:congress", "sync:congress-wave"]
      }
    )
    return {
      dispatched: true,
      identity: identityKey,
      scheduledAt: payload.timestamp.toISOString(),
      taskIdentifier: "congress-wave-coordinator",
      workerRunId: handle.id
    }
  }
  const taskIdentifier = synchronizationTaskIdentifierFor(identity)
  const workerPayload: SynchronizationWorkerTaskPayload = {
    correlationId: `${identityKey}:${occurrenceKey}`,
    identity: identityKey,
    occurrenceKey
  }
  const handle = await tasks.trigger<SynchronizationWorkerTask>(taskIdentifier, workerPayload, {
    concurrencyKey: identityKey,
    idempotencyKey: occurrenceKey,
    tags: [`provider:${identity.provider}`, `sync:${identityKey}`]
  })

  return {
    dispatched: true,
    identity: identityKey,
    scheduledAt: payload.timestamp.toISOString(),
    taskIdentifier,
    workerRunId: handle.id
  }
}
