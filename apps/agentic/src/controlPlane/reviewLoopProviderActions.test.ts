import { readFile } from "node:fs/promises"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ReviewResultSchema } from "../contracts/specialized"
import {
  ReviewCycleRecordSchema,
  WorkflowRunRecordSchema,
  WorkspaceLeaseRecordSchema
} from "../persistence/controlPlaneStore"

const runners = vi.hoisted(() => ({ runReviewer: vi.fn(), runRepairer: vi.fn() }))

vi.mock("./reviewerRunner", async (importOriginal) => {
  const original = await importOriginal<typeof import("./reviewerRunner")>()
  return { ...original, runReviewer: runners.runReviewer }
})
vi.mock("./repairRunner", async (importOriginal) => {
  const original = await importOriginal<typeof import("./repairRunner")>()
  return { ...original, runRepairer: runners.runRepairer }
})

import { ReviewLoopProviderActions } from "./reviewLoopActions"

const fixtureUrl = new URL("../../tests/fixtures/review-result-approved.json", import.meta.url)
const now = new Date("2026-07-19T12:00:00.000Z")

async function context() {
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
    reviewRound: 1,
    candidateCommitSha: review.candidateCommitSha,
    reviewerAgentId: "reviewer",
    status: "running",
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

describe("ReviewLoopProviderActions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("binds review, merge, repair, and abandonment evidence to provider state", async () => {
    const { review, run, cycle, coderWorkspace } = await context()
    const store = {
      createWorkspaceLease: vi.fn(async () => coderWorkspace),
      updateReviewCycle: vi.fn(async () => cycle),
      listReviewCyclesForRun: vi.fn(async () => [cycle]),
      transitionWorkspaceLease: vi.fn(async () => ({ ...coderWorkspace, version: 1 })),
      recordWorkflowEvent: vi.fn(async () => undefined)
    }
    const github = {
      installationToken: vi.fn(async () => "github-token"),
      recordReviewComment: vi.fn(async () => "comment-1"),
      mergePullRequest: vi.fn(async () => "e".repeat(40)),
      abandonPullRequest: vi.fn(async () => undefined)
    }
    const linear = { recordAgentActivity: vi.fn(async () => undefined) }
    const artifactStore = { provider: "local" }
    const artifactStoreFactory = {
      provider: "local" as const,
      assertReady: vi.fn(async () => undefined),
      forRun: vi.fn(() => artifactStore)
    }
    runners.runReviewer.mockResolvedValue({
      review,
      workspaceId: "review-workspace",
      conversationId: "review-conversation",
      createdAt: now,
      retentionUntil: new Date("2026-07-20T12:00:00.000Z"),
      expiresAt: new Date("2026-07-26T12:00:00.000Z")
    })
    runners.runRepairer.mockResolvedValue({
      candidateCommitSha: "f".repeat(40),
      repair: { addressedFindingIds: ["finding-1"], declinedFindings: [] }
    })
    const actions = new ReviewLoopProviderActions({
      store: store as never,
      github,
      linear,
      artifactRoot: (runId) => `artifacts/${runId}`,
      modelProviderApiKey: "model-key",
      workspaceSecretKey: "w".repeat(32),
      artifactStoreFactory: artifactStoreFactory as never
    })

    await expect(actions.review(run, cycle)).resolves.toEqual(review)
    expect(runners.runReviewer).toHaveBeenCalledWith(
      expect.objectContaining({ artifactStore, githubToken: "github-token" })
    )
    expect(store.createWorkspaceLease).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: "review-workspace", lifecycleState: "deleted" })
    )

    await actions.merge(run, cycle, review)
    expect(github.mergePullRequest).toHaveBeenCalledWith(
      run.repositoryOwner,
      run.repositoryName,
      42,
      cycle.candidateCommitSha
    )
    expect(linear.recordAgentActivity).toHaveBeenCalledWith(
      run.sourceWorkItemId,
      "completed",
      expect.stringContaining(`Merged as \`${"e".repeat(40)}\``)
    )

    await expect(actions.repair(run, cycle, review, coderWorkspace)).resolves.toEqual({
      candidateCommitSha: "f".repeat(40)
    })
    expect(store.transitionWorkspaceLease).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: coderWorkspace.workspaceId,
        expectedVersion: 0,
        lifecycleState: "stopped"
      })
    )
    expect(store.recordWorkflowEvent).toHaveBeenCalledWith(
      run.runId,
      expect.objectContaining({ node: "repair.publish", outcome: "completed" })
    )

    await actions.abandon(run, cycle, review)
    expect(github.abandonPullRequest).toHaveBeenCalledWith(
      run.repositoryOwner,
      run.repositoryName,
      42,
      cycle.candidateCommitSha
    )
    expect(linear.recordAgentActivity).toHaveBeenCalledWith(
      run.sourceWorkItemId,
      "canceled",
      expect.stringContaining("Abandoned after the final bounded review exchange")
    )
  })

  it("runs without an Azure artifact factory and rejects incomplete durable correlations", async () => {
    const { review, run, cycle } = await context()
    runners.runReviewer.mockResolvedValue({
      review,
      workspaceId: "review-workspace",
      conversationId: "review-conversation",
      createdAt: now,
      retentionUntil: now,
      expiresAt: now
    })
    const actions = new ReviewLoopProviderActions({
      store: {
        createWorkspaceLease: vi.fn(async () => ({})),
        updateReviewCycle: vi.fn(async () => cycle),
        listReviewCyclesForRun: vi.fn(async () => [cycle])
      } as never,
      github: {
        installationToken: vi.fn(async () => "github-token"),
        recordReviewComment: vi.fn(async () => "comment-1"),
        mergePullRequest: vi.fn(),
        abandonPullRequest: vi.fn()
      },
      linear: { recordAgentActivity: vi.fn() },
      artifactRoot: () => "artifacts",
      modelProviderApiKey: "model-key",
      workspaceSecretKey: "w".repeat(32)
    })

    await actions.review(run, cycle)
    expect(runners.runReviewer).toHaveBeenCalledWith(expect.not.objectContaining({ artifactStore: expect.anything() }))
    await expect(actions.merge({ ...run, pullRequestNumber: null }, cycle, review)).rejects.toThrow(
      "has no pull request"
    )
    await expect(actions.merge({ ...run, sourceWorkItemId: null }, cycle, review)).rejects.toThrow(
      "has no Linear work item"
    )
  })
})
