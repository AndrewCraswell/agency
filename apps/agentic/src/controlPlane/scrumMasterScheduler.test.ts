import { describe, expect, it, vi } from "vitest"
import type { WorkflowRunRecord } from "../persistence/controlPlaneStore"
import { ScrumMasterScheduler } from "./scrumMasterScheduler"

const candidate = {
  schemaVersion: "1" as const,
  source: "linear" as const,
  id: "96ab4b51-9e71-4a0d-b0ca-4c10b6e10e57",
  identifier: "FEN-42",
  title: "Add tests",
  description: "Add focused tests.",
  url: "https://linear.app/example/issue/FEN-42",
  priority: 2,
  createdAt: "2026-07-18T12:00:00.000Z",
  updatedAt: "2026-07-19T12:00:00.000Z",
  state: { id: "dff7a1a0-2c52-4e3f-a325-90d314f81820", name: "Todo", type: "unstarted" as const },
  team: { id: "9539b499-1c48-4770-ab32-da1cbda14d57", key: "FEN", name: "Frontend" }
}

describe("ScrumMasterScheduler", () => {
  it("queues one source-less review when an engineer and unseen work are available", async () => {
    const store = {
      listWorkflowRuns: vi.fn(async () => [] as WorkflowRunRecord[]),
      bindWorkflowRun: vi.fn(async (input) => ({ ...input, runId: input.runId })),
      recordWorkflowEvent: vi.fn(async () => undefined)
    }
    const scheduler = new ScrumMasterScheduler(
      {
        listCandidates: vi.fn(async () => ({
          schemaVersion: "1" as const,
          fetchedAt: "2026-07-19T12:00:00.000Z",
          team: candidate.team,
          issues: [candidate]
        }))
      },
      store as never,
      { repositoryOwner: "AndrewCraswell", repositoryName: "agency" },
      () => "b906f6ca-6be5-4b5a-9c2e-ff1f4f69b0a1"
    )

    await expect(scheduler.schedule()).resolves.toBe(true)
    expect(store.bindWorkflowRun).toHaveBeenCalledWith(expect.objectContaining({ graphVersion: "delivery-v2" }))
    const scheduledInput = store.bindWorkflowRun.mock.calls[0]?.[0]
    expect(scheduledInput).not.toHaveProperty("sourceWorkItemId")
    expect(scheduledInput).not.toHaveProperty("assignedAgentId")
    expect(store.recordWorkflowEvent).toHaveBeenCalledOnce()
  })

  it("does not queue work while the engineer is active", async () => {
    const activeRun = { status: "running", assignedAgentId: "engineer", sourceWorkItemId: candidate.id }
    const store = {
      listWorkflowRuns: vi.fn(async () => [activeRun]),
      bindWorkflowRun: vi.fn(),
      recordWorkflowEvent: vi.fn()
    }
    const scheduler = new ScrumMasterScheduler(
      {
        listCandidates: vi.fn(async () => ({
          schemaVersion: "1" as const,
          fetchedAt: "2026-07-19T12:00:00.000Z",
          team: candidate.team,
          issues: [candidate]
        }))
      },
      store as never,
      { repositoryOwner: "AndrewCraswell", repositoryName: "agency" }
    )

    await expect(scheduler.schedule()).resolves.toBe(false)
    expect(store.bindWorkflowRun).not.toHaveBeenCalled()
  })

  it.each([
    ["source-less review", { status: "queued", assignedAgentId: null, sourceWorkItemId: null }],
    ["already handled task", { status: "completed", assignedAgentId: "engineer", sourceWorkItemId: candidate.id }]
  ])("does not queue work behind an existing %s", async (_name, existingRun) => {
    const store = {
      listWorkflowRuns: vi.fn(async () => [existingRun]),
      bindWorkflowRun: vi.fn(),
      recordWorkflowEvent: vi.fn()
    }
    const scheduler = new ScrumMasterScheduler(
      {
        listCandidates: vi.fn(async () => ({
          schemaVersion: "1" as const,
          fetchedAt: "2026-07-19T12:00:00.000Z",
          team: candidate.team,
          issues: [candidate]
        }))
      },
      store as never,
      { repositoryOwner: "AndrewCraswell", repositoryName: "agency" }
    )

    await expect(scheduler.schedule()).resolves.toBe(false)
    expect(store.bindWorkflowRun).not.toHaveBeenCalled()
  })

  it("suppresses overlapping scheduler ticks and resets after failure", async () => {
    let releaseCandidates: (() => void) | undefined
    const candidatesPending = new Promise<void>((resolve) => {
      releaseCandidates = resolve
    })
    const listCandidates = vi.fn(async () => {
      await candidatesPending
      throw new Error("Linear unavailable")
    })
    const scheduler = new ScrumMasterScheduler(
      { listCandidates },
      { listWorkflowRuns: vi.fn(async () => []) } as never,
      { repositoryOwner: "AndrewCraswell", repositoryName: "agency" }
    )

    const firstTick = scheduler.schedule()
    await expect(scheduler.schedule()).resolves.toBe(false)
    releaseCandidates?.()
    await expect(firstTick).rejects.toThrow("Linear unavailable")
    await expect(scheduler.schedule()).rejects.toThrow("Linear unavailable")
    expect(listCandidates).toHaveBeenCalledTimes(2)
  })
})
