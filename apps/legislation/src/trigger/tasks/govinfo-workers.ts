import { queue, task } from "@trigger.dev/sdk"
import { synchronizationQueues } from "../identities.js"
import { executeSynchronizationTask } from "./synchronization-executor.js"
import { executeSynchronizationWorker, type SynchronizationWorkerTaskPayload } from "./worker-contract.js"

export const govInfoSynchronizationQueue = queue({
  concurrencyLimit: synchronizationQueues.govinfo.concurrencyLimit,
  name: synchronizationQueues.govinfo.name
})

export const govInfoBillStatusSync = task({
  id: "govinfo-bill-status-sync",
  maxDuration: 3_600,
  queue: govInfoSynchronizationQueue,
  run: async (payload: SynchronizationWorkerTaskPayload, { ctx }) =>
    executeSynchronizationWorker("govinfo-bill-status-sync", payload, (intent) =>
      executeSynchronizationTask(intent, ctx.run.id)
    )
})
