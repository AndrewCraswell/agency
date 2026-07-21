import { randomUUID } from "node:crypto"
import { describe, expect, it, vi } from "vitest"
import type { WorkflowScheduleRecord } from "../persistence/workflowScheduleStore"
import { WorkflowScheduleDispatcher } from "./scheduleDispatcher"

const dueAt = new Date("2026-07-19T12:00:00.000Z")
const now = new Date("2026-07-19T12:05:00.000Z")

function schedule(overrides: Partial<WorkflowScheduleRecord> = {}): WorkflowScheduleRecord {
  return {
    scheduleId: randomUUID(),
    workflowId: randomUUID(),
    workflowVersion: 3,
    triggerNodeId: "delivery-schedule",
    label: "Delivery schedule",
    enabled: true,
    intervalSeconds: 300,
    scheduleExpression: null,
    timezone: "UTC",
    nextRunAt: dueAt,
    lastAttemptedAt: now,
    lastSuccessfulAt: null,
    leaseOwner: "worker-a",
    leaseExpiresAt: new Date("2026-07-19T12:05:30.000Z"),
    failureCode: null,
    failureDetails: null,
    revision: 2,
    createdAt: dueAt,
    updatedAt: now,
    ...overrides
  }
}

function store(claimed: WorkflowScheduleRecord[]) {
  return {
    synchronize: vi.fn(async () => undefined),
    claimDue: vi.fn(async () => claimed),
    beginOccurrence: vi.fn(async () => undefined),
    completeClaim: vi.fn(async () => undefined),
    failClaim: vi.fn(async () => undefined)
  }
}

describe("WorkflowScheduleDispatcher", () => {
  it("synchronizes, claims, and starts one overdue occurrence with a stable key", async () => {
    const claimed = schedule()
    const scheduleStore = store([claimed])
    const events: string[] = []
    scheduleStore.beginOccurrence.mockImplementation(async () => {
      events.push("persisted")
    })
    const startRun = vi.fn(async () => {
      events.push("started")
      return { created: true }
    })
    const definitions = vi.fn(async () => [
      {
        workflowId: claimed.workflowId,
        version: 3,
        nodeId: claimed.triggerNodeId,
        label: claimed.label,
        intervalSeconds: 300,
        scheduleExpression: null,
        timezone: "UTC"
      }
    ])
    const dispatcher = new WorkflowScheduleDispatcher(
      scheduleStore,
      definitions,
      startRun,
      { owner: "worker-a" },
      () => now
    )

    await expect(dispatcher.dispatchDue()).resolves.toEqual({ claimed: 1, started: 1, failed: 0, skipped: false })
    expect(scheduleStore.synchronize).toHaveBeenCalledWith(await definitions(), now)
    expect(startRun).toHaveBeenCalledWith(claimed.workflowId, {
      version: 3,
      input: {
        occurrenceId: `${claimed.scheduleId}:${dueAt.toISOString()}`,
        scheduledAt: dueAt.toISOString(),
        timezone: "UTC",
        dispatchedAt: now.toISOString(),
        latenessMs: 300_000,
        attempt: 1,
        misfireDisposition: "latest",
        synthetic: false
      },
      trigger: {
        type: "schedule",
        key: `${claimed.scheduleId}:${dueAt.toISOString()}`,
        stepId: claimed.triggerNodeId
      }
    })
    expect(scheduleStore.completeClaim).toHaveBeenCalledWith({ schedule: claimed, owner: "worker-a", now })
    expect(scheduleStore.beginOccurrence).toHaveBeenCalledWith({ schedule: claimed, dispatchedAt: now })
    expect(events).toEqual(["persisted", "started"])
  })

  it("persists dispatch failure for retry with the same due occurrence", async () => {
    const claimed = schedule()
    const scheduleStore = store([claimed])
    const failure = new Error("Database unavailable")
    const dispatcher = new WorkflowScheduleDispatcher(
      scheduleStore,
      async () => [],
      vi.fn(async () => Promise.reject(failure)),
      { owner: "worker-a" },
      () => now
    )

    await expect(dispatcher.dispatchDue()).resolves.toEqual({ claimed: 1, started: 0, failed: 1, skipped: false })
    expect(scheduleStore.failClaim).toHaveBeenCalledWith({ schedule: claimed, owner: "worker-a", now, error: failure })
    expect(scheduleStore.completeClaim).not.toHaveBeenCalled()
  })

  it("suppresses overlapping ticks in one worker", async () => {
    let release: (() => void) | undefined
    const definitions = vi.fn(
      () =>
        new Promise<[]>((resolve) => {
          release = () => resolve([])
        })
    )
    const scheduleStore = store([])
    const dispatcher = new WorkflowScheduleDispatcher(
      scheduleStore,
      definitions,
      vi.fn(),
      { owner: "worker-a" },
      () => now
    )

    const first = dispatcher.dispatchDue()
    await expect(dispatcher.dispatchDue()).resolves.toEqual({ claimed: 0, started: 0, failed: 0, skipped: true })
    release?.()
    await expect(first).resolves.toEqual({ claimed: 0, started: 0, failed: 0, skipped: false })
  })

  it("allows only one competing worker to hold a due lease and reclaims an expired lease", async () => {
    const due = schedule({ leaseOwner: "expired-worker", leaseExpiresAt: new Date("2026-07-19T12:04:59.000Z") })
    let leased = false
    let releaseStart: (() => void) | undefined
    const sharedStore = {
      synchronize: vi.fn(async () => undefined),
      claimDue: vi.fn(async ({ owner }: { owner: string }) => {
        if (leased || !due.enabled || (due.leaseExpiresAt !== null && due.leaseExpiresAt > now)) {
          return []
        }
        leased = true
        return [
          { ...due, leaseOwner: owner, leaseExpiresAt: new Date(now.getTime() + 30_000), revision: due.revision + 1 }
        ]
      }),
      beginOccurrence: vi.fn(async () => undefined),
      completeClaim: vi.fn(async () => {
        leased = false
      }),
      failClaim: vi.fn(async () => {
        leased = false
      })
    }
    const startA = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          releaseStart = resolve
        })
    )
    const startB = vi.fn(async () => undefined)
    const workerA = new WorkflowScheduleDispatcher(
      sharedStore,
      async () => [],
      startA,
      { owner: "worker-a" },
      () => now
    )
    const workerB = new WorkflowScheduleDispatcher(
      sharedStore,
      async () => [],
      startB,
      { owner: "worker-b" },
      () => now
    )

    const first = workerA.dispatchDue()
    await vi.waitFor(() => expect(startA).toHaveBeenCalledOnce())
    await expect(workerB.dispatchDue()).resolves.toEqual({ claimed: 0, started: 0, failed: 0, skipped: false })
    expect(startB).not.toHaveBeenCalled()
    releaseStart?.()
    await expect(first).resolves.toEqual({ claimed: 1, started: 1, failed: 0, skipped: false })
  })

  it("retries a failed occurrence with the same journal idempotency key and skips disabled schedules", async () => {
    let current = schedule({ leaseOwner: null, leaseExpiresAt: null, lastAttemptedAt: null })
    const retryStore = {
      synchronize: vi.fn(async () => undefined),
      claimDue: vi.fn(async ({ owner }: { owner: string }) => {
        if (!current.enabled || current.leaseOwner !== null) {
          return []
        }
        current = {
          ...current,
          leaseOwner: owner,
          leaseExpiresAt: new Date(now.getTime() + 30_000),
          revision: current.revision + 1
        }
        return [current]
      }),
      beginOccurrence: vi.fn(async () => undefined),
      completeClaim: vi.fn(async () => {
        current = {
          ...current,
          leaseOwner: null,
          leaseExpiresAt: null,
          nextRunAt: new Date(now.getTime() + 300_000),
          revision: current.revision + 1
        }
      }),
      failClaim: vi.fn(async () => {
        current = { ...current, leaseOwner: null, leaseExpiresAt: null, revision: current.revision + 1 }
      })
    }
    const startRun = vi
      .fn()
      .mockRejectedValueOnce(new Error("Temporary failure"))
      .mockResolvedValueOnce({ created: true })
    const dispatcher = new WorkflowScheduleDispatcher(
      retryStore,
      async () => [],
      startRun,
      { owner: "worker-a" },
      () => now
    )

    await expect(dispatcher.dispatchDue()).resolves.toMatchObject({ failed: 1 })
    await expect(dispatcher.dispatchDue()).resolves.toMatchObject({ started: 1 })
    expect(startRun.mock.calls[0]?.[1].trigger.key).toBe(startRun.mock.calls[1]?.[1].trigger.key)

    current = { ...current, enabled: false, leaseOwner: null, nextRunAt: dueAt }
    await expect(dispatcher.dispatchDue()).resolves.toMatchObject({ claimed: 0 })
  })
})
