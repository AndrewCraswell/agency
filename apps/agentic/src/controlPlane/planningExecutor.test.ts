import { readFile } from "node:fs/promises"
import { MemorySaver } from "@langchain/langgraph"
import { describe, expect, it, vi } from "vitest"
import { PlanningResultSchema } from "../contracts/specialized"
import type { WorkflowRunRecord } from "../persistence/controlPlaneStore"
import { executePlanDelivery, PlanningRunExecutor } from "./planningExecutor"

const fixtureUrl = new URL("../../tests/fixtures/planning-result-ready.json", import.meta.url)

async function fixturePlan() {
  return PlanningResultSchema.parse(JSON.parse(await readFile(fixtureUrl, "utf8")))
}

function workflowRun(overrides: Partial<WorkflowRunRecord> = {}): WorkflowRunRecord {
  return {
    runId: "dff7a1a0-2c52-4e3f-a325-90d314f81820",
    requestDigest: "a".repeat(64),
    status: "queued",
    stage: "intake",
    activeRole: null,
    graphVersion: "delivery-v2",
    repositoryOwner: "AndrewCraswell",
    repositoryName: "agency",
    sourceWorkItemId: null,
    sourceWorkItemIdentifier: null,
    assignedAgentId: null,
    pullRequestNumber: null,
    retryCount: 0,
    nextAttemptAt: null,
    createdAt: new Date("2026-07-19T12:00:00.000Z"),
    updatedAt: new Date("2026-07-19T12:00:00.000Z"),
    ...overrides
  }
}

async function planningHarness(input: {
  run?: WorkflowRunRecord
  existingRuns?: WorkflowRunRecord[]
  candidates?: Awaited<ReturnType<typeof fixturePlan>>["sourceWorkItem"][]
  disposition?: "ready" | "blocked"
  plannerError?: Error
  deliveryStatus?: "published" | "failed" | "cancelled" | "running"
}) {
  const fixture = await fixturePlan()
  const run = input.run ?? workflowRun()
  const candidates = input.candidates ?? [fixture.sourceWorkItem]
  const existingRuns = input.existingRuns ?? [run]
  const store = {
    listWorkflowRuns: vi.fn(async () => existingRuns),
    recordWorkflowEvent: vi.fn(async () => undefined),
    recordTrace: vi.fn(async () => undefined),
    assignWorkflowRun: vi.fn(async (assignment) => ({ ...run, ...assignment })),
    createReviewCycle: vi.fn(async (cycle) => ({ ...cycle, status: "queued" }))
  }
  const linear = {
    listCandidates: vi.fn(async () => ({
      schemaVersion: "1" as const,
      fetchedAt: "2026-07-19T12:00:00.000Z",
      team: fixture.sourceWorkItem.team,
      issues: candidates
    })),
    recordAgentActivity: vi.fn(async () => undefined)
  }
  const planner = {
    plan: vi.fn(async (invocation) => {
      if (input.plannerError !== undefined) {
        throw input.plannerError
      }
      const { content: _content, ...prompt } = invocation.prompt
      const disposition = input.disposition ?? "ready"
      const blockers = []
      if (disposition === "blocked") {
        blockers.push({
          category: "ambiguity" as const,
          message: "No bounded implementation is available.",
          evidence: [{ uri: fixture.sourceWorkItem.url, sha256: "c".repeat(64) }]
        })
      }
      return {
        output: PlanningResultSchema.parse({
          ...fixture,
          runId: run.runId,
          roleAttempt: { ...fixture.roleAttempt, runId: run.runId, prompt },
          disposition,
          sourceWorkItem: invocation.candidates.issues[0],
          baseCommitSha: invocation.baseCommitSha,
          blockers
        }),
        rawResponse: "{}"
      }
    })
  }
  const publicationResult = {
    branch: `agent/${run.runId}`,
    pullRequestNumber: 42,
    pullRequestUrl: "https://github.com/AndrewCraswell/agency/pull/42",
    headCommitSha: "d".repeat(40),
    updatedExisting: false
  }
  const delivery = {
    invoke: vi.fn(async () => ({
      terminalStatus: input.deliveryStatus ?? ("published" as const),
      publicationResult:
        input.deliveryStatus === "published" || input.deliveryStatus === undefined ? publicationResult : null
    }))
  }
  const executor = new PlanningRunExecutor({
    linear,
    github: { resolveDefaultBranchSha: vi.fn(async () => fixture.baseCommitSha) },
    planner,
    store: store as never,
    checkpointer: new MemorySaver(),
    delivery,
    team: fixture.sourceWorkItem.team.id
  })
  return { executor, run, store, linear, planner, delivery, publicationResult, fixture }
}

describe("executePlanDelivery", () => {
  it.each([
    ["published", { status: "published", stage: "completed", activeRole: null }],
    ["failed", { status: "failed", stage: "completed", activeRole: null }],
    ["cancelled", { status: "cancelled", stage: "completed", activeRole: null }],
    ["running", { status: "running", stage: "coding", activeRole: "coder" }]
  ] as const)("maps a %s delivery result back to dispatch", async (terminalStatus, expected) => {
    const plan = await fixturePlan()
    const invoke = vi.fn(async () => ({ terminalStatus, publicationResult: null }))

    const outcome = await executePlanDelivery(
      plan,
      { provider: "github", owner: "AndrewCraswell", name: "agency" },
      { invoke }
    )

    expect(outcome).toEqual(expected)
    expect(invoke).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: plan.runId,
        repository: { provider: "github", owner: "AndrewCraswell", name: "agency" },
        objective: plan.objective
      })
    )
  })

  it("queues review from the exact published head", async () => {
    const plan = await fixturePlan()
    const publicationResult = {
      branch: `agent/${plan.runId}`,
      pullRequestNumber: 42,
      pullRequestUrl: "https://github.com/AndrewCraswell/agency/pull/42",
      headCommitSha: "d".repeat(40),
      updatedExisting: false
    }
    const onPublished = vi.fn(async () => undefined)

    const outcome = await executePlanDelivery(
      plan,
      { provider: "github", owner: "AndrewCraswell", name: "agency" },
      { invoke: vi.fn(async () => ({ terminalStatus: "published" as const, publicationResult })) },
      onPublished
    )

    expect(onPublished).toHaveBeenCalledWith(publicationResult)
    expect(outcome).toEqual({ status: "running", stage: "reviewing", activeRole: "reviewer" })
  })
})

describe("PlanningRunExecutor", () => {
  it("autonomously assigns selected ready work and queues exact-SHA review", async () => {
    const harness = await planningHarness({})

    await expect(harness.executor.execute(harness.run)).resolves.toEqual({
      status: "running",
      stage: "reviewing",
      activeRole: "reviewer"
    })

    expect(harness.store.assignWorkflowRun).toHaveBeenCalledWith({
      runId: harness.run.runId,
      sourceWorkItemId: harness.fixture.sourceWorkItem.id,
      sourceWorkItemIdentifier: harness.fixture.sourceWorkItem.identifier,
      assignedAgentId: "engineer"
    })
    expect(harness.linear.recordAgentActivity).toHaveBeenCalledWith(
      harness.fixture.sourceWorkItem.id,
      "started",
      expect.stringContaining(harness.run.runId)
    )
    expect(harness.store.createReviewCycle).toHaveBeenCalledWith({
      runId: harness.run.runId,
      reviewRound: 1,
      candidateCommitSha: harness.publicationResult.headCommitSha,
      reviewerAgentId: "reviewer"
    })
  })

  it("executes an explicitly assigned dependency-ready item without reassigning it", async () => {
    const fixture = await fixturePlan()
    const run = workflowRun({
      sourceWorkItemId: fixture.sourceWorkItem.id,
      sourceWorkItemIdentifier: fixture.sourceWorkItem.identifier,
      assignedAgentId: "engineer"
    })
    const harness = await planningHarness({ run, deliveryStatus: "failed" })

    await expect(harness.executor.execute(run)).resolves.toEqual({
      status: "failed",
      stage: "completed",
      activeRole: null
    })
    expect(harness.store.assignWorkflowRun).not.toHaveBeenCalled()
    expect(harness.linear.recordAgentActivity).not.toHaveBeenCalled()
  })

  it("maps blocked and failed planning outcomes without invoking delivery", async () => {
    const blocked = await planningHarness({ disposition: "blocked" })
    await expect(blocked.executor.execute(blocked.run)).resolves.toEqual({
      status: "blocked",
      stage: "planning",
      activeRole: null
    })
    expect(blocked.delivery.invoke).not.toHaveBeenCalled()

    const failed = await planningHarness({ plannerError: new Error("planner unavailable") })
    await expect(failed.executor.execute(failed.run)).resolves.toEqual({
      status: "failed",
      stage: "planning",
      activeRole: null
    })
    expect(failed.delivery.invoke).not.toHaveBeenCalled()
  })

  it("rejects stale assignments and a fully claimed candidate set", async () => {
    const fixture = await fixturePlan()
    const staleRun = workflowRun({
      sourceWorkItemId: "96ab4b51-9e71-4a0d-b0ca-4c10b6e10e57",
      sourceWorkItemIdentifier: "FEN-999",
      assignedAgentId: "engineer"
    })
    const stale = await planningHarness({ run: staleRun })
    await expect(stale.executor.execute(staleRun)).rejects.toThrow("no longer dependency-ready")

    const planningRun = workflowRun()
    const claimedRun = workflowRun({
      runId: "b906f6ca-6be5-4b5a-9c2e-ff1f4f69b0a1",
      sourceWorkItemId: fixture.sourceWorkItem.id,
      assignedAgentId: "engineer"
    })
    const claimed = await planningHarness({ run: planningRun, existingRuns: [planningRun, claimedRun] })
    await expect(claimed.executor.execute(planningRun)).rejects.toThrow(
      "No unassigned dependency-ready Linear tasks are available"
    )
  })

  it("refuses an autonomous handoff while the engineering agent is occupied", async () => {
    const fixture = await fixturePlan()
    const secondCandidate = {
      ...fixture.sourceWorkItem,
      id: "96ab4b51-9e71-4a0d-b0ca-4c10b6e10e57",
      identifier: "FEN-422"
    }
    const planningRun = workflowRun()
    const occupiedRun = workflowRun({
      runId: "b906f6ca-6be5-4b5a-9c2e-ff1f4f69b0a1",
      status: "running",
      sourceWorkItemId: fixture.sourceWorkItem.id,
      assignedAgentId: "engineer"
    })
    const harness = await planningHarness({
      run: planningRun,
      existingRuns: [planningRun, occupiedRun],
      candidates: [fixture.sourceWorkItem, secondCandidate]
    })

    await expect(harness.executor.execute(planningRun)).rejects.toThrow("No engineering agent is currently available")
  })
})
