import { queue, task, type Queue } from "@trigger.dev/sdk"
import { synchronizationQueues } from "../identities.js"
import { executeSynchronizationTask } from "./synchronization-executor.js"
import { executeSynchronizationWorker, type SynchronizationWorkerTaskPayload } from "./worker-contract.js"

export const senateSynchronizationQueue: Queue = queue({
  concurrencyLimit: synchronizationQueues.senate.concurrencyLimit,
  name: synchronizationQueues.senate.name
})

export const senateVotesSync = task({
  id: "senate-votes-sync",
  queue: senateSynchronizationQueue,
  run: async (payload: SynchronizationWorkerTaskPayload, { ctx }) =>
    executeSynchronizationWorker("senate-votes-sync", payload, (intent) =>
      executeSynchronizationTask(intent, ctx.run.id)
    )
})
