import { describe, expect, it, vi } from "vitest"
import { ACTIVE_RUNTIME_SELECTION } from "../contracts/runtimeSelection"
import {
  PostgresControlPlaneStore,
  ReviewCycleRecordSchema,
  WorkflowRunRecordSchema,
  WorkspaceLeaseRecordSchema
} from "./controlPlaneStore"

const now = new Date("2026-07-19T12:00:00.000Z")
const runId = "dff7a1a0-2c52-4e3f-a325-90d314f81820"

function run(overrides: Record<string, unknown> = {}) {
  return WorkflowRunRecordSchema.parse({
    runId,
    requestDigest: "a".repeat(64),
    status: "queued",
    stage: "intake",
    activeRole: null,
    graphVersion: "delivery-v1",
    repositoryOwner: "AndrewCraswell",
    repositoryName: "agency",
    sourceWorkItemId: null,
    sourceWorkItemIdentifier: null,
    assignedAgentId: null,
    pullRequestNumber: null,
    retryCount: 0,
    nextAttemptAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides
  })
}

function lease(overrides: Record<string, unknown> = {}) {
  return WorkspaceLeaseRecordSchema.parse({
    provider: "daytona",
    workspaceId: "workspace-1",
    runId,
    role: "coder",
    roleAttempt: 1,
    lifecycleState: "running",
    labels: { repository: "AndrewCraswell/agency" },
    conversationId: "conversation-1",
    profileName: "coder",
    retentionUntil: new Date("2026-07-20T12:00:00.000Z"),
    expiresAt: new Date("2026-07-26T12:00:00.000Z"),
    version: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides
  })
}

function reviewCycle(overrides: Record<string, unknown> = {}) {
  return ReviewCycleRecordSchema.parse({
    runId,
    reviewRound: 1,
    candidateCommitSha: "b".repeat(40),
    reviewerAgentId: "reviewer",
    status: "queued",
    reviewerWorkspaceId: null,
    findings: [],
    createdAt: now,
    updatedAt: now,
    ...overrides
  })
}

function databaseHarness(input: { select?: unknown[][]; returning?: unknown[][] } = {}) {
  const selectResults = [...(input.select ?? [])]
  const returningResults = [...(input.returning ?? [])]
  const insertedValues: unknown[] = []
  const updatedValues: unknown[] = []

  const nextSelect = async () => selectResults.shift() ?? []
  const selectChain: Record<string, unknown> = {}
  selectChain.where = vi.fn(() => selectChain)
  selectChain.orderBy = vi.fn(() => selectChain)
  selectChain.limit = vi.fn(nextSelect)
  // oxlint-disable-next-line unicorn/no-thenable -- Drizzle query builders are intentionally awaitable.
  Object.defineProperty(selectChain, "then", {
    value: (resolve: (value: unknown[]) => unknown, reject: (error: unknown) => unknown) =>
      nextSelect().then(resolve, reject)
  })

  function mutationChain() {
    const chain = {
      onConflictDoNothing: vi.fn(() => chain),
      returning: vi.fn(async () => returningResults.shift() ?? []),
      where: vi.fn(() => chain)
    }
    return chain
  }

  const database = {
    select: vi.fn(() => ({ from: vi.fn(() => selectChain) })),
    insert: vi.fn(() => ({
      values: vi.fn((values: unknown) => {
        insertedValues.push(values)
        return mutationChain()
      })
    })),
    update: vi.fn(() => ({
      set: vi.fn((values: unknown) => {
        updatedValues.push(values)
        return mutationChain()
      })
    }))
  }
  const transaction = vi.fn(async (operation: (transaction: typeof database) => Promise<void>) => operation(database))
  return {
    database: { ...database, transaction },
    insertedValues,
    updatedValues,
    transaction
  }
}

function store(harness: ReturnType<typeof databaseHarness>) {
  return new PostgresControlPlaneStore(harness.database as never, { now: () => now })
}

const binding = {
  runId,
  requestDigest: "a".repeat(64),
  graphVersion: "delivery-v1",
  repositoryOwner: "AndrewCraswell",
  repositoryName: "agency"
}

describe("PostgresControlPlaneStore workflow runs", () => {
  it("atomically binds a workflow and immutable runtime selection", async () => {
    const harness = databaseHarness({ select: [[run()], [{ selection: ACTIVE_RUNTIME_SELECTION }]] })

    await expect(store(harness).bindWorkflowRun(binding)).resolves.toEqual(run())

    expect(harness.transaction).toHaveBeenCalledOnce()
    expect(harness.insertedValues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ runId, status: "queued", stage: "intake" }),
        expect.objectContaining({ runId, selection: ACTIVE_RUNTIME_SELECTION })
      ])
    )
  })

  it("rejects an existing run bound to different request or runtime data", async () => {
    const requestMismatch = databaseHarness({
      select: [[run({ requestDigest: "c".repeat(64) })], [{ selection: ACTIVE_RUNTIME_SELECTION }]]
    })
    await expect(store(requestMismatch).bindWorkflowRun(binding)).rejects.toThrow("different request digest")

    const runtimeMismatch = databaseHarness({
      select: [[run()], [{ selection: { ...ACTIVE_RUNTIME_SELECTION, selectionVersion: 2 } }]]
    })
    await expect(store(runtimeMismatch).bindWorkflowRun(binding)).rejects.toThrow()
  })

  it("assigns an unbound workflow and preserves an idempotent assignment", async () => {
    const assigned = run({
      sourceWorkItemId: "96ab4b51-9e71-4a0d-b0ca-4c10b6e10e57",
      sourceWorkItemIdentifier: "FEN-42",
      assignedAgentId: "engineer"
    })
    const assignment = {
      runId,
      sourceWorkItemId: assigned.sourceWorkItemId as string,
      sourceWorkItemIdentifier: assigned.sourceWorkItemIdentifier as string,
      assignedAgentId: assigned.assignedAgentId as string
    }
    const assignHarness = databaseHarness({ select: [[run()]], returning: [[assigned]] })
    await expect(store(assignHarness).assignWorkflowRun(assignment)).resolves.toEqual(assigned)

    const idempotentHarness = databaseHarness({ select: [[assigned]] })
    await expect(store(idempotentHarness).assignWorkflowRun(assignment)).resolves.toEqual(assigned)

    const mismatchHarness = databaseHarness({ select: [[assigned]] })
    await expect(
      store(mismatchHarness).assignWorkflowRun({ ...assignment, assignedAgentId: "another-engineer" })
    ).rejects.toThrow("different work-item or agent assignment")
  })

  it("updates workflow progress and reports a missing run", async () => {
    const updated = run({ status: "running", stage: "coding", activeRole: "coder" })
    const harness = databaseHarness({ returning: [[updated]] })
    await expect(store(harness).setWorkflowProgress(runId, "running", "coding", "coder")).resolves.toEqual(updated)
    expect(harness.updatedValues).toContainEqual(
      expect.objectContaining({ status: "running", stage: "coding", activeRole: "coder" })
    )

    await expect(
      store(databaseHarness({ returning: [[]] })).setWorkflowProgress(runId, "running", "coding", null)
    ).rejects.toThrow("does not exist")
  })

  it.each([
    ["running", "running", "coding"],
    ["published", "published", "completed"],
    ["cancelled", "cancelled", "completed"],
    ["failed", "failed", "completed"]
  ] as const)("persists %s graph state as %s/%s", async (terminalStatus, status, stage) => {
    const persisted = run({ status, stage, pullRequestNumber: terminalStatus === "published" ? 42 : null })
    const harness = databaseHarness({ select: [[persisted]] })
    const events =
      terminalStatus === "running"
        ? [{ node: "runCoder", outcome: "completed", summary: "Coder finished", at: now.toISOString() }]
        : []

    await expect(
      store(harness).persistWorkflowState({
        runId,
        terminalStatus,
        events,
        publicationResult: terminalStatus === "published" ? { pullRequestNumber: 42 } : null
      } as never)
    ).resolves.toEqual(persisted)
    expect(harness.updatedValues).toContainEqual(
      expect.objectContaining({ status, stage, pullRequestNumber: terminalStatus === "published" ? 42 : null })
    )
  })

  it("lists and retrieves workflow runs and their events", async () => {
    const event = {
      eventId: 1,
      eventKey: "d".repeat(64),
      runId,
      node: "runCoder",
      outcome: "completed",
      summary: "Coder finished",
      details: {},
      createdAt: now
    }
    const harness = databaseHarness({ select: [[run()], [run()], [], [event]] })
    const subject = store(harness)

    await expect(subject.listWorkflowRuns()).resolves.toEqual([run()])
    await expect(subject.getWorkflowRun(runId)).resolves.toEqual(run())
    await expect(subject.getWorkflowRun(runId)).resolves.toBeNull()
    await expect(subject.listWorkflowEvents(runId)).resolves.toEqual([event])
  })

  it("records idempotent workflow and trace events", async () => {
    const harness = databaseHarness()
    const subject = store(harness)
    await subject.recordWorkflowEvent(runId, {
      sourceId: "source-1",
      node: "runCoder",
      outcome: "completed",
      summary: "Coder finished",
      createdAt: now
    })
    await subject.recordTrace(runId, {
      traceId: "858355f6-a892-4fa9-af05-66c5085cc901",
      runId: "9539b499-1c48-4770-ab32-da1cbda14d57",
      projectName: "Agency",
      name: "workflow.runCoder"
    })

    expect(harness.insertedValues).toHaveLength(2)
    expect(harness.insertedValues).toContainEqual(
      expect.objectContaining({ eventKey: expect.stringMatching(/^[0-9a-f]{64}$/u), outcome: "started" })
    )
  })

  it("finds active work-item and pull-request correlations", async () => {
    const harness = databaseHarness({ select: [[run()], [], [run()]] })
    const subject = store(harness)

    await expect(subject.findActiveWorkflowRunByWorkItem("96ab4b51-9e71-4a0d-b0ca-4c10b6e10e57")).resolves.toEqual(
      run()
    )
    await expect(subject.findActiveWorkflowRunByWorkItem("96ab4b51-9e71-4a0d-b0ca-4c10b6e10e57")).resolves.toBeNull()
    await expect(subject.findWorkflowRunByPullRequest("AndrewCraswell", "agency", 42)).resolves.toEqual(run())
  })
})

describe("PostgresControlPlaneStore reviews and workspaces", () => {
  it("retrieves, creates, and validates review cycles", async () => {
    const cycle = reviewCycle()
    const harness = databaseHarness({ select: [[cycle], [cycle], [cycle], [cycle]] })
    const subject = store(harness)

    await expect(
      subject.createReviewCycle({
        runId,
        reviewRound: 1,
        candidateCommitSha: cycle.candidateCommitSha,
        reviewerAgentId: "reviewer"
      })
    ).resolves.toEqual(cycle)
    await expect(subject.latestReviewCycle(runId)).resolves.toEqual(cycle)
    await expect(subject.listReviewCyclesForRun(runId)).resolves.toEqual([cycle])
    await expect(subject.listReviewCycles(["queued"])).resolves.toEqual([cycle])

    const mismatch = databaseHarness({ select: [[reviewCycle({ reviewerAgentId: "another-reviewer" })]] })
    await expect(
      store(mismatch).createReviewCycle({
        runId,
        reviewRound: 1,
        candidateCommitSha: cycle.candidateCommitSha,
        reviewerAgentId: "reviewer"
      })
    ).rejects.toThrow("already bound differently")
  })

  it("updates review findings and reports missing cycles", async () => {
    const updated = reviewCycle({ status: "changes_requested", reviewerWorkspaceId: "review-1", findings: [{ id: 1 }] })
    const harness = databaseHarness({ returning: [[updated]] })
    await expect(
      store(harness).updateReviewCycle({
        runId,
        reviewRound: 1,
        status: "changes_requested",
        reviewerWorkspaceId: "review-1",
        findings: [{ id: 1 }]
      })
    ).resolves.toEqual(updated)

    await expect(
      store(databaseHarness({ returning: [[]] })).updateReviewCycle({ runId, reviewRound: 1, status: "blocked" })
    ).rejects.toThrow("does not exist")
  })

  it("returns null for absent review cycles and workspace leases", async () => {
    const harness = databaseHarness({ select: [[], [], []] })
    const subject = store(harness)
    await expect(subject.latestReviewCycle(runId)).resolves.toBeNull()
    await expect(subject.getWorkspaceLease(runId, "coder", 1)).resolves.toBeNull()
    await expect(subject.findWorkflowRunByPullRequest("AndrewCraswell", "agency", 42)).resolves.toBeNull()
  })

  it("creates and optimistically transitions workspace leases", async () => {
    const created = lease()
    const transitioned = lease({ lifecycleState: "stopped", version: 1 })
    const harness = databaseHarness({ returning: [[created], [transitioned]] })
    const subject = store(harness)

    await expect(
      subject.createWorkspaceLease({
        provider: "daytona",
        workspaceId: created.workspaceId,
        runId,
        role: "coder",
        roleAttempt: 1,
        lifecycleState: "running",
        labels: created.labels,
        conversationId: created.conversationId ?? undefined,
        profileName: created.profileName ?? undefined,
        retentionUntil: created.retentionUntil,
        expiresAt: created.expiresAt
      })
    ).resolves.toEqual(created)
    await expect(
      subject.transitionWorkspaceLease({
        provider: "daytona",
        workspaceId: created.workspaceId,
        expectedVersion: 0,
        lifecycleState: "stopped",
        conversationId: null,
        profileName: null,
        retentionUntil: transitioned.retentionUntil,
        expiresAt: transitioned.expiresAt
      })
    ).resolves.toEqual(transitioned)

    await expect(
      store(databaseHarness({ returning: [[]] })).transitionWorkspaceLease({
        provider: "daytona",
        workspaceId: created.workspaceId,
        expectedVersion: 0,
        lifecycleState: "stopped"
      })
    ).rejects.toThrow("changed by another orchestrator process")
  })

  it("retrieves an existing workspace lease", async () => {
    const existing = lease()
    await expect(
      store(databaseHarness({ select: [[existing]] })).getWorkspaceLease(runId, "coder", 1)
    ).resolves.toEqual(existing)
  })
})
