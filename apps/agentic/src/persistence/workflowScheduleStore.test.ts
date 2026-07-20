import { describe, expect, it, vi } from "vitest"
import { PostgresWorkflowScheduleStore, type PublishedScheduleDefinition } from "./workflowScheduleStore"

const now = new Date("2026-07-19T12:00:00.000Z")

function storedSchedule(
  scheduleId: string,
  workflowId: string,
  triggerNodeId: string,
  overrides: Record<string, unknown> = {}
) {
  return {
    scheduleId,
    workflowId,
    workflowVersion: 1,
    triggerNodeId,
    label: triggerNodeId,
    enabled: 1,
    intervalSeconds: 300,
    scheduleExpression: null,
    timezone: "UTC",
    nextRunAt: new Date("2026-07-19T12:05:00.000Z"),
    lastAttemptedAt: null,
    lastSuccessfulAt: null,
    leaseOwner: null,
    leaseExpiresAt: null,
    failureCode: null,
    failureDetails: null,
    revision: 2,
    createdAt: now,
    updatedAt: now,
    ...overrides
  }
}

describe("PostgresWorkflowScheduleStore", () => {
  it("inserts, preserves, updates, and disables schedules during synchronization", async () => {
    const unchangedWorkflowId = "019c230c-60c6-7bd8-a9f8-9e5f51b09e31"
    const changedWorkflowId = "019c230c-60c6-7bd8-a9f8-9e5f51b09e32"
    const existing = [
      storedSchedule("019c230c-60c6-7bd8-a9f8-9e5f51b09e41", unchangedWorkflowId, "unchanged"),
      storedSchedule("019c230c-60c6-7bd8-a9f8-9e5f51b09e42", changedWorkflowId, "changed"),
      storedSchedule("019c230c-60c6-7bd8-a9f8-9e5f51b09e43", "019c230c-60c6-7bd8-a9f8-9e5f51b09e33", "stale-enabled"),
      storedSchedule("019c230c-60c6-7bd8-a9f8-9e5f51b09e44", "019c230c-60c6-7bd8-a9f8-9e5f51b09e34", "stale-disabled", {
        enabled: 0
      })
    ]
    const values = vi.fn(async () => undefined)
    const where = vi.fn(async () => undefined)
    const set = vi.fn(() => ({ where }))
    const transactionClient = {
      select: vi.fn(() => ({ from: vi.fn(async () => existing) })),
      insert: vi.fn(() => ({ values })),
      update: vi.fn(() => ({ set }))
    }
    const database = {
      transaction: vi.fn(async (callback: (transaction: typeof transactionClient) => Promise<void>) =>
        callback(transactionClient)
      )
    }
    const definitions: PublishedScheduleDefinition[] = [
      {
        workflowId: unchangedWorkflowId,
        version: 1,
        nodeId: "unchanged",
        label: "unchanged",
        intervalSeconds: 300,
        scheduleExpression: null,
        timezone: "UTC"
      },
      {
        workflowId: changedWorkflowId,
        version: 1,
        nodeId: "changed",
        label: "changed",
        intervalSeconds: 300,
        scheduleExpression: null,
        timezone: "America/New_York"
      },
      {
        workflowId: "019c230c-60c6-7bd8-a9f8-9e5f51b09e35",
        version: 1,
        nodeId: "new",
        label: "new",
        intervalSeconds: null,
        scheduleExpression: "0 9 * * 1-5",
        timezone: "America/New_York"
      }
    ]

    await new PostgresWorkflowScheduleStore(database as never).synchronize(definitions, now)

    expect(values).toHaveBeenCalledOnce()
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        workflowId: definitions[2]?.workflowId,
        triggerNodeId: "new",
        scheduleExpression: "0 9 * * 1-5"
      })
    )
    expect(set).toHaveBeenCalledTimes(2)
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ timezone: "America/New_York", revision: 3 }))
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ enabled: 0, revision: 3 }))
  })
})
