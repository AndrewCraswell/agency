import { describe, expect, it, vi } from "vitest"
import { LinearCandidateListSchema, LinearTaskGraphSchema } from "../contracts/linear"
import type { TraceReference } from "../observability/tracing"
import type {
  BindWorkflowRunInput,
  ControlPlaneStore,
  WorkflowEventRecord,
  WorkflowRunRecord,
  WorkspaceLeaseInput,
  WorkspaceLeaseRecord,
  WorkspaceLeaseTransition
} from "../persistence/controlPlaneStore"
import { ControlPlaneService } from "./service"

const now = new Date("2026-07-19T05:20:00.000Z")
const workItemId = "96ab4b51-9e71-4a0d-b0ca-4c10b6e10e57"
const runId = "b906f6ca-6be5-4b5a-9c2e-ff1f4f69b0a1"

function candidateList() {
  return LinearCandidateListSchema.parse({
    schemaVersion: "1",
    fetchedAt: now.toISOString(),
    team: { id: "9539b499-1c48-4770-ab32-da1cbda14d57", key: "FEN", name: "Frontend" },
    issues: [
      {
        schemaVersion: "1",
        source: "linear",
        id: workItemId,
        identifier: "FEN-42",
        title: "Add profile helper tests",
        description: "Add focused unit coverage.",
        url: "https://linear.app/example/issue/FEN-42",
        priority: 4,
        createdAt: "2026-07-01T05:20:00.000Z",
        updatedAt: now.toISOString(),
        state: { id: "dff7a1a0-2c52-4e3f-a325-90d314f81820", name: "Todo", type: "unstarted" },
        team: { id: "9539b499-1c48-4770-ab32-da1cbda14d57", key: "FEN", name: "Frontend" }
      }
    ]
  })
}

function taskGraph() {
  const candidates = candidateList()
  return LinearTaskGraphSchema.parse({
    schemaVersion: "1",
    fetchedAt: candidates.fetchedAt,
    team: candidates.team,
    tasks: candidates.issues.map((issue) => ({ ...issue, project: null, blockedBy: [], blocks: [] })),
    edges: [],
    levels: [{ depth: 0, taskIds: candidates.issues.map((issue) => issue.id) }],
    readyTaskIds: candidates.issues.map((issue) => issue.id),
    blockedTaskIds: []
  })
}

class FakeStore implements ControlPlaneStore {
  readonly records: WorkflowRunRecord[] = []

  async bindWorkflowRun(input: BindWorkflowRunInput): Promise<WorkflowRunRecord> {
    const record: WorkflowRunRecord = {
      ...input,
      sourceWorkItemId: input.sourceWorkItemId ?? null,
      sourceWorkItemIdentifier: input.sourceWorkItemIdentifier ?? null,
      assignedAgentId: input.assignedAgentId ?? null,
      status: "queued",
      stage: "intake",
      activeRole: null,
      pullRequestNumber: null,
      retryCount: 0,
      nextAttemptAt: null,
      createdAt: now,
      updatedAt: now
    }
    this.records.push(record)
    return record
  }

  async findActiveWorkflowRunByWorkItem(id: string): Promise<WorkflowRunRecord | null> {
    return this.records.find((record) => record.sourceWorkItemId === id) ?? null
  }

  assignWorkflowRun(): Promise<WorkflowRunRecord> {
    throw new Error("Not used by this test")
  }

  listWorkflowRuns(): Promise<WorkflowRunRecord[]> {
    return Promise.resolve([...this.records])
  }

  getWorkflowRun(id: string): Promise<WorkflowRunRecord | null> {
    return Promise.resolve(this.records.find((record) => record.runId === id) ?? null)
  }

  listWorkflowEvents(): Promise<WorkflowEventRecord[]> {
    return Promise.resolve([])
  }

  recordWorkflowEvent(): Promise<void> {
    return Promise.resolve()
  }

  recordTrace(_runId: string, _reference: TraceReference): Promise<void> {
    return Promise.resolve()
  }

  setWorkflowProgress(): Promise<WorkflowRunRecord> {
    throw new Error("Not used by this test")
  }

  persistWorkflowState(): Promise<WorkflowRunRecord> {
    throw new Error("Not used by this test")
  }

  createWorkspaceLease(_input: WorkspaceLeaseInput): Promise<WorkspaceLeaseRecord> {
    throw new Error("Not used by this test")
  }

  transitionWorkspaceLease(_input: WorkspaceLeaseTransition): Promise<WorkspaceLeaseRecord> {
    throw new Error("Not used by this test")
  }
}

function createService(store = new FakeStore()) {
  return {
    store,
    service: new ControlPlaneService(
      { listCandidates: async () => candidateList(), listTaskGraph: async () => taskGraph() },
      store,
      { repositoryOwner: "AndrewCraswell", repositoryName: "agency" },
      { now: () => now, runId: () => runId }
    )
  }
}

describe("ControlPlaneService", () => {
  it("returns active Linear tasks with durable run state", async () => {
    const { service } = createService()

    await expect(service.snapshot()).resolves.toMatchObject({
      schemaVersion: "1",
      fetchedAt: now.toISOString(),
      agents: [
        { id: "scrum-master", role: "scrum_master" },
        { id: "engineer", role: "engineer" },
        { id: "reviewer", role: "reviewer" }
      ],
      tasks: [{ id: workItemId, identifier: "FEN-42" }],
      runs: []
    })
  })

  it("reuses the Linear graph across dashboard polls", async () => {
    const store = new FakeStore()
    const listTaskGraph = vi.fn(async () => taskGraph())
    const service = new ControlPlaneService(
      { listCandidates: async () => candidateList(), listTaskGraph },
      store,
      { repositoryOwner: "AndrewCraswell", repositoryName: "agency" },
      { now: () => now, runId: () => runId }
    )

    await Promise.all([service.snapshot(), service.snapshot()])
    await service.snapshot()

    expect(listTaskGraph).toHaveBeenCalledOnce()
  })

  it("polls runs without loading Linear task inventory", async () => {
    const listTaskGraph = vi.fn(async () => taskGraph())
    const service = new ControlPlaneService(
      { listCandidates: async () => candidateList(), listTaskGraph },
      new FakeStore(),
      { repositoryOwner: "AndrewCraswell", repositoryName: "agency" },
      { now: () => now }
    )

    await expect(service.runSnapshot()).resolves.toMatchObject({ agents: expect.any(Array), runs: [] })
    expect(listTaskGraph).not.toHaveBeenCalled()
  })

  it("filters and cursor-paginates work items with stable priority ordering", async () => {
    const baseTask = taskGraph().tasks[0]!
    const inProgressId = "858355f6-a892-4fa9-af05-66c5085cc901"
    const blockedId = "af32fd7f-c98c-4a31-88ca-acfb99654c69"
    const tasks = [
      baseTask,
      {
        ...baseTask,
        id: inProgressId,
        identifier: "FEN-43",
        title: "Build runtime controls",
        priority: 2,
        createdAt: "2026-07-18T05:20:00.000Z",
        state: { ...baseTask.state, name: "In Progress", type: "started" as const }
      },
      {
        ...baseTask,
        id: blockedId,
        identifier: "FEN-44",
        title: "Publish profile changes",
        priority: 3,
        createdAt: "2026-07-05T05:20:00.000Z",
        blockedBy: [{ id: baseTask.id, identifier: baseTask.identifier, stateType: baseTask.state.type }]
      }
    ]
    const store = new FakeStore()
    store.records.push({
      runId,
      graphVersion: "delivery-v1",
      repositoryOwner: "AndrewCraswell",
      repositoryName: "agency",
      sourceWorkItemId: inProgressId,
      sourceWorkItemIdentifier: "FEN-43",
      assignedAgentId: "engineer",
      requestDigest: "a".repeat(64),
      status: "queued",
      stage: "intake",
      activeRole: null,
      pullRequestNumber: null,
      retryCount: 0,
      nextAttemptAt: null,
      createdAt: now,
      updatedAt: now
    })
    const service = new ControlPlaneService(
      {
        listCandidates: async () => candidateList(),
        listTaskGraph: async () => ({ ...taskGraph(), tasks })
      },
      store,
      { repositoryOwner: "AndrewCraswell", repositoryName: "agency" },
      { now: () => now }
    )

    const firstPage = await service.queryWorkItems({ pageSize: 2 })
    expect(firstPage).toMatchObject({
      total: 3,
      items: [{ task: { identifier: "FEN-42" } }, { task: { identifier: "FEN-44" }, status: "blocked" }],
      aggregates: { all: 3, todo: 1, inProgress: 1, blocked: 1 }
    })
    expect(firstPage.nextCursor).not.toBeNull()
    await expect(service.queryWorkItems({ cursor: firstPage.nextCursor, pageSize: 2 })).resolves.toMatchObject({
      items: [{ task: { identifier: "FEN-43" }, status: "in_progress" }],
      nextCursor: null
    })
    await expect(
      service.queryWorkItems({ q: "runtime", repository: "AndrewCraswell/agency", assignee: "engineer", priority: 2 })
    ).resolves.toMatchObject({ total: 1, items: [{ task: { identifier: "FEN-43" } }] })
    await expect(service.queryWorkItems({ age: "week" })).resolves.toMatchObject({ total: 2 })
    await expect(service.queryWorkItems({ cursor: "not-a-cursor" })).rejects.toThrow("Cursor is invalid")
  })

  it("restores dashboard inventory without querying Linear after restart", async () => {
    const listTaskGraph = vi.fn(async () => taskGraph())
    const load = vi.fn(async () => taskGraph().tasks)
    const save = vi.fn(async () => undefined)
    const service = new ControlPlaneService(
      { listCandidates: async () => candidateList(), listTaskGraph },
      new FakeStore(),
      { repositoryOwner: "AndrewCraswell", repositoryName: "agency" },
      { now: () => now, taskInventoryCache: { load, save } }
    )

    await expect(service.snapshot()).resolves.toMatchObject({ tasks: [{ id: workItemId }] })
    expect(load).toHaveBeenCalledOnce()
    expect(listTaskGraph).not.toHaveBeenCalled()
    expect(save).not.toHaveBeenCalled()
  })

  it("serves stale persisted inventory while a Linear refresh is failing", async () => {
    let currentTime = now
    const listTaskGraph = vi.fn(async () => {
      throw new Error("Linear unavailable")
    })
    const service = new ControlPlaneService(
      { listCandidates: async () => candidateList(), listTaskGraph },
      new FakeStore(),
      { repositoryOwner: "AndrewCraswell", repositoryName: "agency" },
      {
        now: () => currentTime,
        taskInventoryCache: { load: async () => taskGraph().tasks, save: vi.fn() }
      }
    )

    await expect(service.snapshot()).resolves.toMatchObject({ tasks: [{ id: workItemId }] })
    currentTime = new Date(now.getTime() + 31 * 60 * 1_000)
    await expect(service.snapshot()).resolves.toMatchObject({ tasks: [{ id: workItemId }] })
    await service.snapshot()

    expect(listTaskGraph).toHaveBeenCalledOnce()
  })

  it("assigns an active task once and returns its existing run on repeated assignment", async () => {
    const { service, store } = createService()

    const created = await service.assign({ workItemId, agentId: "engineer" })
    const repeated = await service.assign({ workItemId, agentId: "engineer" })

    expect(created).toMatchObject({
      created: true,
      run: { runId, status: "queued", stage: "intake", assignedAgentId: "engineer" }
    })
    expect(repeated).toMatchObject({ created: false, run: { runId } })
    expect(store.records).toHaveLength(1)
    expect(store.records[0]?.requestDigest).toMatch(/^[0-9a-f]{64}$/u)
  })

  it("rejects a task outside the active Linear candidate set", async () => {
    const { service } = createService()

    await expect(
      service.assign({ workItemId: "858355f6-a892-4fa9-af05-66c5085cc901", agentId: "engineer" })
    ).rejects.toThrow("not an active assignment candidate")
  })

  it("rejects an agent that cannot perform engineering work", async () => {
    const { service } = createService()

    await expect(service.assign({ workItemId, agentId: "scrum-master" })).rejects.toThrow("is not an engineering agent")
  })

  it("rejects conflicting task and agent assignments", async () => {
    const taskConflict = createService()
    await taskConflict.service.assign({ workItemId, agentId: "engineer" })
    taskConflict.store.records[0] = { ...taskConflict.store.records[0]!, assignedAgentId: null }
    await expect(taskConflict.service.assign({ workItemId, agentId: "engineer" })).rejects.toThrow(
      "already assigned to another run"
    )

    const agentConflict = createService()
    agentConflict.store.records.push({
      ...taskConflict.store.records[0]!,
      runId: "af32fd7f-c98c-4a31-88ca-acfb99654c69",
      sourceWorkItemId: null,
      sourceWorkItemIdentifier: null,
      assignedAgentId: "engineer"
    })
    await expect(agentConflict.service.assign({ workItemId, agentId: "engineer" })).rejects.toThrow(
      "already assigned to a task"
    )
  })
})
