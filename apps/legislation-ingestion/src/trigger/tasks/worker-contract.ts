import { z } from "zod"
import {
  formatSynchronizationIdentity,
  synchronizationQueueFor,
  synchronizationTaskIdentifierFor,
  type SynchronizationIdentity,
  type SynchronizationQueue,
  type SynchronizationWorkerTaskIdentifier
} from "../identities.js"
import { createSynchronizationScheduleManifest, parseManagedSynchronizationIdentity } from "../manifest.js"

export const synchronizationWorkerPayloadSchema = z
  .object({
    correlationId: z.string().trim().min(1).max(200).optional(),
    identity: z.string().trim().min(1).max(200),
    occurrenceKey: z.string().trim().min(1).max(500)
  })
  .strict()

export type SynchronizationWorkerPayload = z.output<typeof synchronizationWorkerPayloadSchema>
export type SynchronizationWorkerTaskPayload = z.input<typeof synchronizationWorkerPayloadSchema>

export type SynchronizationWorkerDispatchIntent = Readonly<{
  correlationId?: string
  identity: SynchronizationIdentity
  identityKey: string
  occurrenceKey: string
  operation: "bill-status-sync" | "current-entities" | "events-sync" | "incremental-sync"
  queue: SynchronizationQueue
  taskIdentifier: SynchronizationWorkerTaskIdentifier
}>

export type SynchronizationWorkerExecutor = (intent: SynchronizationWorkerDispatchIntent) => Promise<unknown>

export type SynchronizationWorkerExecution =
  | Readonly<{ intent: SynchronizationWorkerDispatchIntent; status: "unconfigured" }>
  | Readonly<{ intent: SynchronizationWorkerDispatchIntent; result: unknown; status: "succeeded" }>

export class SynchronizationWorkerPayloadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "SynchronizationWorkerPayloadError"
  }
}

export function createSynchronizationWorkerDispatchIntent(
  taskIdentifier: SynchronizationWorkerTaskIdentifier,
  payload: unknown
): SynchronizationWorkerDispatchIntent {
  const parsedPayload = synchronizationWorkerPayloadSchema.safeParse(payload)
  if (!parsedPayload.success) {
    throw new SynchronizationWorkerPayloadError("Synchronization worker payload is invalid")
  }

  const identity = parseManagedSynchronizationIdentity(
    parsedPayload.data.identity,
    createSynchronizationScheduleManifest({ currentCongress: currentCongress() })
  )
  const expectedTaskIdentifier = synchronizationTaskIdentifierFor(identity)
  if (taskIdentifier !== expectedTaskIdentifier) {
    throw new SynchronizationWorkerPayloadError(
      `Synchronization identity ${formatSynchronizationIdentity(identity)} must run on ${expectedTaskIdentifier}`
    )
  }

  return {
    correlationId: parsedPayload.data.correlationId,
    identity,
    identityKey: formatSynchronizationIdentity(identity),
    occurrenceKey: parsedPayload.data.occurrenceKey,
    operation: ingestionOperationFor(taskIdentifier),
    queue: synchronizationQueueFor(identity),
    taskIdentifier
  }
}

export async function executeSynchronizationWorker(
  taskIdentifier: SynchronizationWorkerTaskIdentifier,
  payload: unknown,
  execute?: SynchronizationWorkerExecutor
): Promise<SynchronizationWorkerExecution> {
  const intent = createSynchronizationWorkerDispatchIntent(taskIdentifier, payload)
  if (execute === undefined) {
    return { intent, status: "unconfigured" }
  }
  return { intent, result: await execute(intent), status: "succeeded" }
}

function currentCongress(): number {
  const value = Number(process.env.FEDERAL_END_CONGRESS ?? "119")
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new SynchronizationWorkerPayloadError("FEDERAL_END_CONGRESS must be a positive integer")
  }
  return value
}

function ingestionOperationFor(
  taskIdentifier: SynchronizationWorkerTaskIdentifier
): SynchronizationWorkerDispatchIntent["operation"] {
  if (taskIdentifier === "govinfo-bill-status-sync") {
    return "bill-status-sync"
  }
  if (taskIdentifier === "openstates-bills-sync") {
    return "incremental-sync"
  }
  if (taskIdentifier === "openstates-entities-sync") {
    return "current-entities"
  }
  if (taskIdentifier === "openstates-events-sync") {
    return "events-sync"
  }
  return "bill-status-sync"
}
