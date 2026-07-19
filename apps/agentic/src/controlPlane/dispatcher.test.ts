import { describe, expect, it, vi } from "vitest"
import type { WorkflowRunRecord } from "../persistence/controlPlaneStore"
import { QueuedRunDispatcher } from "./dispatcher"

function run(runId: string): WorkflowRunRecord {
  return {
    runId,
    requestDigest: "a".repeat(64),
    status: "queued",
    stage: "intake",
    activeRole: null,
    graphVersion: "delivery-v1",
    repositoryOwner: "AndrewCraswell",
    repositoryName: "agency",
    sourceWorkItemId: "96ab4b51-9e71-4a0d-b0ca-4c10b6e10e57",
    sourceWorkItemIdentifier: "FEN-42",
    assignedAgentId: "engineer",
    pullRequestNumber: null,
    retryCount: 0,
    nextAttemptAt: null,
    createdAt: new Date("2026-07-19T12:00:00.000Z"),
    updatedAt: new Date("2026-07-19T12:00:00.000Z")
  }
}

describe("QueuedRunDispatcher", () => {
  it("claims queued runs up to the concurrency limit and persists their outcome", async () => {
    const runs = [run("b906f6ca-6be5-4b5a-9c2e-ff1f4f69b0a1"), run("dff7a1a0-2c52-4e3f-a325-90d314f81820")]
    const store = {
      listWorkflowRuns: vi.fn(async () => runs),
      setWorkflowProgress: vi.fn(async (_runId: string, status: string) => ({ ...runs[0], status }))
    }
    const executor = {
      execute: vi.fn(async () => ({ status: "blocked", stage: "planning", activeRole: null }) as const)
    }
    const dispatcher = new QueuedRunDispatcher(store as never, executor, { maxConcurrentRuns: 1 })

    await expect(dispatcher.dispatchPending()).resolves.toBe(1)

    expect(executor.execute).toHaveBeenCalledOnce()
    expect(store.setWorkflowProgress).toHaveBeenNthCalledWith(1, runs[0]?.runId, "running", "planning", "scrum_master")
    expect(store.setWorkflowProgress).toHaveBeenNthCalledWith(2, runs[0]?.runId, "blocked", "planning", null)
  })

  it("records a failed planning stage when execution throws", async () => {
    const queuedRun = run("b906f6ca-6be5-4b5a-9c2e-ff1f4f69b0a1")
    const store = {
      listWorkflowRuns: vi.fn(async () => [queuedRun]),
      setWorkflowProgress: vi.fn(async (_runId: string, status: string) => ({ ...queuedRun, status }))
    }
    const executor = { execute: vi.fn(async () => Promise.reject(new Error("planning failed"))) }
    const dispatcher = new QueuedRunDispatcher(store as never, executor)

    await expect(dispatcher.dispatchPending()).resolves.toBe(1)

    expect(store.setWorkflowProgress).toHaveBeenLastCalledWith(queuedRun.runId, "failed", "planning", null)
  })
})
