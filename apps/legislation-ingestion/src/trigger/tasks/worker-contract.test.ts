import { describe, expect, it } from "vitest"
import {
  createSynchronizationWorkerDispatchIntent,
  executeSynchronizationWorker,
  SynchronizationWorkerPayloadError
} from "./worker-contract.js"

describe("synchronization worker contract", () => {
  it("creates a queue-aware dispatch intent for a matching managed identity", () => {
    const intent = createSynchronizationWorkerDispatchIntent("openstates-bills-sync", {
      correlationId: "development:openstates:bills:ca:run-123",
      identity: "openstates:bills:ca",
      occurrenceKey: "schedule-ca-bills:2026-08-18T12:04:00.000Z"
    })

    expect(intent).toMatchObject({
      identityKey: "openstates:bills:ca",
      operation: "incremental-sync",
      queue: { concurrencyLimit: 3, name: "openstates" },
      taskIdentifier: "openstates-bills-sync"
    })
  })

  it("rejects invalid, unmanaged, and misrouted payload identities", () => {
    expect(() =>
      createSynchronizationWorkerDispatchIntent("openstates-bills-sync", {
        identity: "openstates:bills:ca"
      })
    ).toThrow(SynchronizationWorkerPayloadError)
    expect(() =>
      createSynchronizationWorkerDispatchIntent("openstates-bills-sync", {
        identity: "openstates:bills:zz",
        occurrenceKey: "occurrence"
      })
    ).toThrow("Open States identity")
    expect(() =>
      createSynchronizationWorkerDispatchIntent("openstates-events-sync", {
        identity: "openstates:bills:ca",
        occurrenceKey: "occurrence"
      })
    ).toThrow(SynchronizationWorkerPayloadError)
    expect(() =>
      createSynchronizationWorkerDispatchIntent("openstates-bills-sync", {
        identity: "openstates:bills:ca",
        mode: "shadow",
        occurrenceKey: "occurrence"
      })
    ).toThrow(SynchronizationWorkerPayloadError)
  })

  it("always invokes the configured executor", async () => {
    let executions = 0

    const result = await executeSynchronizationWorker(
      "openstates-events-sync",
      {
        identity: "openstates:events:ca",
        occurrenceKey: "occurrence"
      },
      async () => {
        executions += 1
        return { ingested: true }
      }
    )

    expect(result).toMatchObject({ result: { ingested: true }, status: "succeeded" })
    expect(executions).toBe(1)
  })

  it("routes the managed GovInfo identity to its isolated worker and queue", () => {
    const intent = createSynchronizationWorkerDispatchIntent("govinfo-bill-status-sync", {
      identity: "govinfo:bill-status:119",
      occurrenceKey: "govinfo-daily:2026-08-18T11:45:00Z"
    })

    expect(intent).toMatchObject({
      identityKey: "govinfo:bill-status:119",
      operation: "bill-status-sync",
      queue: { concurrencyLimit: 1, name: "govinfo" },
      taskIdentifier: "govinfo-bill-status-sync"
    })
  })

  it("routes Senate votes to the isolated Senate worker and queue", () => {
    const intent = createSynchronizationWorkerDispatchIntent("senate-votes-sync", {
      identity: "senate:votes:119",
      occurrenceKey: "senate-hourly:2026-08-18T12:40:00Z"
    })

    expect(intent).toMatchObject({
      identityKey: "senate:votes:119",
      operation: "votes-sync",
      queue: { concurrencyLimit: 4, name: "senate" },
      taskIdentifier: "senate-votes-sync"
    })
  })

  it("allows historical Senate identities that are not recurring schedules", () => {
    const intent = createSynchronizationWorkerDispatchIntent("senate-votes-sync", {
      identity: "senate:votes:115",
      occurrenceKey: "historical-backfill"
    })

    expect(intent).toMatchObject({
      identity: { domain: "votes", provider: "senate", scope: 115 },
      identityKey: "senate:votes:115",
      taskIdentifier: "senate-votes-sync"
    })
  })

  it("passes the parsed intent to the executor", async () => {
    let executions = 0

    const result = await executeSynchronizationWorker(
      "openstates-entities-sync",
      {
        identity: "openstates:entities:ca",
        occurrenceKey: "occurrence"
      },
      async (intent) => {
        executions += 1
        return { operation: intent.operation }
      }
    )

    expect(result).toMatchObject({ result: { operation: "current-entities" }, status: "succeeded" })
    expect(executions).toBe(1)
  })

  it("reports an unavailable executor", async () => {
    const result = await executeSynchronizationWorker("openstates-entities-sync", {
      identity: "openstates:entities:ca",
      occurrenceKey: "occurrence"
    })

    expect(result.status).toBe("unconfigured")
  })
})
