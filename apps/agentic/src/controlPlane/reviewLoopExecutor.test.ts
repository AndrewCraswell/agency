import { readFile } from "node:fs/promises"
import { describe, expect, it, vi } from "vitest"
import { ReviewResultSchema, stableReviewFindingId } from "../contracts/specialized"
import {
  ReviewCycleRecordSchema,
  WorkflowRunRecordSchema,
  WorkspaceLeaseRecordSchema
} from "../persistence/controlPlaneStore"
import { ReviewLoopExecutor, reviewAction, type ReviewLoopStore } from "./reviewLoopExecutor"

const fixtureUrl = new URL("../../tests/fixtures/review-result-approved.json", import.meta.url)
const now = new Date("2026-07-19T12:00:00.000Z")

async function reviewContext(reviewRound = 1) {
  const fixture = JSON.parse(await readFile(fixtureUrl, "utf8")) as Record<string, unknown>
  const candidateCommitSha = reviewRound === 1 ? "d".repeat(40) : "e".repeat(40)
  const review = ReviewResultSchema.parse({
    ...fixture,
    reviewAttempt: reviewRound,
    candidateCommitSha,
    roleAttempt: { ...(fixture.roleAttempt as Record<string, unknown>), attempt: reviewRound }
  })
  const run = WorkflowRunRecordSchema.parse({
    runId: review.runId,
    requestDigest: "a".repeat(64),
    status: "running",
    stage: "reviewing",
    activeRole: "reviewer",
    graphVersion: "delivery-v1",
    repositoryOwner: "AndrewCraswell",
    repositoryName: "agency",
    sourceWorkItemId: "96ab4b51-9e71-4a0d-b0ca-4c10b6e10e57",
    sourceWorkItemIdentifier: "FEN-421",
    assignedAgentId: "engineer",
    pullRequestNumber: 42,
    retryCount: 0,
    nextAttemptAt: null,
    createdAt: now,
    updatedAt: now
  })
  const cycle = ReviewCycleRecordSchema.parse({
    runId: run.runId,
    reviewRound,
    candidateCommitSha,
    reviewerAgentId: "reviewer",
    status: "queued",
    reviewerWorkspaceId: null,
    findings: [],
    createdAt: now,
    updatedAt: now
  })
  const coderWorkspace = WorkspaceLeaseRecordSchema.parse({
    provider: "daytona",
    workspaceId: "coder-workspace",
    runId: run.runId,
    role: "coder",
    roleAttempt: 1,
    lifecycleState: "stopped",
    labels: {},
    conversationId: "coder-conversation",
    profileName: "coder",
    retentionUntil: new Date("2026-07-20T12:00:00.000Z"),
    expiresAt: new Date("2026-07-26T12:00:00.000Z"),
    version: 0,
    createdAt: now,
    updatedAt: now
  })
  return { review, run, cycle, coderWorkspace }
}

function changesRequested(approved: Awaited<ReturnType<typeof reviewContext>>["review"]) {
  const identity = {
    runId: approved.runId,
    reviewAttempt: approved.reviewAttempt,
    locator: { path: "src/index.ts", line: 10, symbol: null },
    category: "correctness" as const,
    finding: "The candidate returns the wrong result."
  }
  return ReviewResultSchema.parse({
    ...approved,
    disposition: "changes_requested",
    findings: [
      {
        schemaVersion: "1",
        id: stableReviewFindingId(identity),
        ...identity,
        severity: "high",
        evidence: "The focused test fails.",
        expectedBehavior: "The focused test passes.",
        actionable: true,
        confidence: 0.95
      }
    ]
  })
}

function blockedReview(approved: Awaited<ReturnType<typeof reviewContext>>["review"]) {
  return ReviewResultSchema.parse({
    ...approved,
    disposition: "blocked",
    blockedReasons: [
      {
        category: "tool",
        message: "The required validation service is unavailable.",
        evidence: [{ uri: "https://example.test/evidence", sha256: "f".repeat(64) }]
      }
    ]
  })
}

function reviewStore(
  context: Awaited<ReturnType<typeof reviewContext>>,
  overrides: Partial<ReviewLoopStore> = {}
): ReviewLoopStore {
  return {
    listReviewCycles: vi.fn(async () => [context.cycle]),
    getWorkflowRun: vi.fn(async () => context.run),
    updateReviewCycle: vi.fn(async (input) => ReviewCycleRecordSchema.parse({ ...context.cycle, ...input })),
    createReviewCycle: vi.fn(async (input) =>
      ReviewCycleRecordSchema.parse({
        ...context.cycle,
        ...input,
        status: "queued",
        reviewerWorkspaceId: null,
        findings: [],
        createdAt: now,
        updatedAt: now
      })
    ),
    getWorkspaceLease: vi.fn(async () => context.coderWorkspace),
    setWorkflowProgress: vi.fn(async () => context.run),
    recordWorkflowEvent: vi.fn(async () => undefined),
    ...overrides
  }
}

describe("reviewAction", () => {
  it.each([
    [1, "approved", "merge"],
    [1, "changes_requested", "repair"],
    [2, "blocked", "block"],
    [3, "approved", "merge"],
    [3, "changes_requested", "abandon"],
    [3, "blocked", "abandon"]
  ] as const)("routes round %s %s to %s", (round, disposition, expected) => {
    expect(reviewAction(round, disposition)).toBe(expected)
  })
})

describe("ReviewLoopExecutor", () => {
  it("merges one approved review cycle and records its terminal state", async () => {
    const review = ReviewResultSchema.parse(JSON.parse(await readFile(fixtureUrl, "utf8")))
    const run = WorkflowRunRecordSchema.parse({
      runId: review.runId,
      requestDigest: "a".repeat(64),
      status: "running",
      stage: "reviewing",
      activeRole: "reviewer",
      graphVersion: "delivery-v1",
      repositoryOwner: "AndrewCraswell",
      repositoryName: "agency",
      sourceWorkItemId: null,
      sourceWorkItemIdentifier: "FEN-421",
      assignedAgentId: "engineer",
      pullRequestNumber: 42,
      retryCount: 0,
      nextAttemptAt: null,
      createdAt: now,
      updatedAt: now
    })
    const cycle = ReviewCycleRecordSchema.parse({
      runId: run.runId,
      reviewRound: 1,
      candidateCommitSha: review.candidateCommitSha,
      reviewerAgentId: "reviewer",
      status: "queued",
      reviewerWorkspaceId: null,
      findings: [],
      createdAt: now,
      updatedAt: now
    })
    const store: ReviewLoopStore = {
      listReviewCycles: vi.fn(async () => [cycle]),
      getWorkflowRun: vi.fn(async () => run),
      updateReviewCycle: vi.fn(async (input) => ReviewCycleRecordSchema.parse({ ...cycle, ...input })),
      createReviewCycle: vi.fn(async () => cycle),
      getWorkspaceLease: vi.fn(async () => null),
      setWorkflowProgress: vi.fn(async () => run),
      recordWorkflowEvent: vi.fn(async () => undefined)
    }
    const merge = vi.fn(async () => undefined)
    const executor = new ReviewLoopExecutor(store, {
      review: vi.fn(async () => review),
      merge,
      repair: vi.fn(async () => ({ candidateCommitSha: "e".repeat(40) })),
      abandon: vi.fn(async () => undefined)
    })

    await expect(executor.dispatchPending()).resolves.toBe(1)

    expect(merge).toHaveBeenCalledOnce()
    expect(store.updateReviewCycle).toHaveBeenLastCalledWith({
      runId: run.runId,
      reviewRound: 1,
      status: "merged",
      findings: []
    })
    expect(store.setWorkflowProgress).toHaveBeenLastCalledWith(run.runId, "published", "completed", null)
  })

  it("returns without work and rejects overlapping dispatch", async () => {
    const context = await reviewContext()
    const emptyStore = reviewStore(context, { listReviewCycles: vi.fn(async () => []) })
    const actions = {
      review: vi.fn(async () => context.review),
      merge: vi.fn(async () => undefined),
      repair: vi.fn(async () => ({ candidateCommitSha: "e".repeat(40) })),
      abandon: vi.fn(async () => undefined)
    }
    await expect(new ReviewLoopExecutor(emptyStore, actions).dispatchPending()).resolves.toBe(0)

    let releaseReview: ((review: typeof context.review) => void) | undefined
    const pendingReview = new Promise<typeof context.review>((resolve) => {
      releaseReview = resolve
    })
    actions.review.mockImplementation(async () => pendingReview)
    const executor = new ReviewLoopExecutor(reviewStore(context), actions)
    const firstDispatch = executor.dispatchPending()
    await vi.waitFor(() => expect(actions.review).toHaveBeenCalledOnce())

    await expect(executor.dispatchPending()).resolves.toBe(0)
    releaseReview?.(context.review)
    await expect(firstDispatch).resolves.toBe(1)
  })

  it("repairs requested changes in the retained coder workspace and queues the next exact SHA", async () => {
    const context = await reviewContext()
    const review = changesRequested(context.review)
    const store = reviewStore(context)
    const repair = vi.fn(async () => ({ candidateCommitSha: "e".repeat(40) }))
    const executor = new ReviewLoopExecutor(store, {
      review: vi.fn(async () => review),
      merge: vi.fn(async () => undefined),
      repair,
      abandon: vi.fn(async () => undefined)
    })

    await expect(executor.dispatchPending()).resolves.toBe(1)

    expect(repair).toHaveBeenCalledWith(context.run, context.cycle, review, context.coderWorkspace)
    expect(store.createReviewCycle).toHaveBeenCalledWith({
      runId: context.run.runId,
      reviewRound: 2,
      candidateCommitSha: "e".repeat(40),
      reviewerAgentId: "reviewer"
    })
    expect(store.setWorkflowProgress).toHaveBeenLastCalledWith(context.run.runId, "running", "reviewing", "reviewer")
  })

  it("blocks an incomplete review and abandons final requested changes", async () => {
    const blockedContext = await reviewContext(2)
    const blocked = blockedReview(blockedContext.review)
    const blockedStore = reviewStore(blockedContext)
    const blockedExecutor = new ReviewLoopExecutor(blockedStore, {
      review: vi.fn(async () => blocked),
      merge: vi.fn(async () => undefined),
      repair: vi.fn(async () => ({ candidateCommitSha: "f".repeat(40) })),
      abandon: vi.fn(async () => undefined)
    })

    await expect(blockedExecutor.dispatchPending()).resolves.toBe(1)
    expect(blockedStore.setWorkflowProgress).toHaveBeenLastCalledWith(
      blockedContext.run.runId,
      "blocked",
      "reviewing",
      null
    )

    const finalContext = await reviewContext(3)
    const finalReview = changesRequested(finalContext.review)
    const finalStore = reviewStore(finalContext)
    const abandon = vi.fn(async () => undefined)
    const finalExecutor = new ReviewLoopExecutor(finalStore, {
      review: vi.fn(async () => finalReview),
      merge: vi.fn(async () => undefined),
      repair: vi.fn(async () => ({ candidateCommitSha: "f".repeat(40) })),
      abandon
    })

    await expect(finalExecutor.dispatchPending()).resolves.toBe(1)
    expect(abandon).toHaveBeenCalledWith(finalContext.run, finalContext.cycle, finalReview)
    expect(finalStore.setWorkflowProgress).toHaveBeenLastCalledWith(
      finalContext.run.runId,
      "blocked",
      "completed",
      null
    )
  })

  it.each(["missing-run", "missing-workspace", "mismatched-review"] as const)(
    "durably records a %s execution failure",
    async (failure) => {
      const context = await reviewContext()
      const store = reviewStore(context, {
        ...(failure === "missing-run" ? { getWorkflowRun: vi.fn(async () => null) } : {}),
        ...(failure === "missing-workspace" ? { getWorkspaceLease: vi.fn(async () => null) } : {})
      })
      const review =
        failure === "mismatched-review"
          ? ReviewResultSchema.parse({ ...context.review, candidateCommitSha: "f".repeat(40) })
          : changesRequested(context.review)
      const executor = new ReviewLoopExecutor(store, {
        review: vi.fn(async () => review),
        merge: vi.fn(async () => undefined),
        repair: vi.fn(async () => ({ candidateCommitSha: "e".repeat(40) })),
        abandon: vi.fn(async () => undefined)
      })

      await expect(executor.dispatchPending()).resolves.toBe(1)

      expect(store.updateReviewCycle).toHaveBeenLastCalledWith({
        runId: context.run.runId,
        reviewRound: 1,
        status: "blocked"
      })
      expect(store.setWorkflowProgress).toHaveBeenLastCalledWith(context.run.runId, "failed", "reviewing", null)
      expect(store.recordWorkflowEvent).toHaveBeenLastCalledWith(
        context.run.runId,
        expect.objectContaining({ node: "review.execute", outcome: "failed" })
      )
    }
  )
})
