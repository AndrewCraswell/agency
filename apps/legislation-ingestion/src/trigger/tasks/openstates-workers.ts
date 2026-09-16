import { queue, task, type Queue } from "@trigger.dev/sdk"
import { synchronizationQueues } from "../identities.js"
import { executeSynchronizationTask } from "./synchronization-executor.js"
import { executeSynchronizationWorker, type SynchronizationWorkerTaskPayload } from "./worker-contract.js"

export const openStatesSynchronizationQueue: Queue = queue({
  concurrencyLimit: synchronizationQueues.openstates.concurrencyLimit,
  name: synchronizationQueues.openstates.name
})

export const openStatesBillsSync = task({
  id: "openstates-bills-sync",
  queue: openStatesSynchronizationQueue,
  run: async (payload: SynchronizationWorkerTaskPayload, { ctx }) =>
    executeSynchronizationWorker("openstates-bills-sync", payload, (intent) =>
      executeSynchronizationTask(intent, ctx.run.id)
    )
})

export const openStatesEntitiesSync = task({
  id: "openstates-entities-sync",
  queue: openStatesSynchronizationQueue,
  run: async (payload: SynchronizationWorkerTaskPayload, { ctx }) =>
    executeSynchronizationWorker("openstates-entities-sync", payload, (intent) =>
      executeSynchronizationTask(intent, ctx.run.id)
    )
})

export const openStatesEventsSync = task({
  id: "openstates-events-sync",
  queue: openStatesSynchronizationQueue,
  run: async (payload: SynchronizationWorkerTaskPayload, { ctx }) =>
    executeSynchronizationWorker("openstates-events-sync", payload, (intent) =>
      executeSynchronizationTask(intent, ctx.run.id)
    )
})
