import { describe, expect, it } from "vitest"
import { ReviewResultSchema, stableReviewFindingId } from "../contracts/specialized"
import {
  ReviewCycleRecordSchema,
  WorkflowRunRecordSchema,
  WorkspaceLeaseRecordSchema
} from "../persistence/controlPlaneStore"
import { materializeRepairResult } from "./repairRunner"

const now = new Date("2026-07-19T12:00:00.000Z")

describe("materializeRepairResult", () => {
  it("binds repair evidence to the reviewed candidate and retained conversation", () => {
    const run = WorkflowRunRecordSchema.parse({
      runId: "dff7a1a0-2c52-4e3f-a325-90d314f81820",
      requestDigest: "a".repeat(64),
      status: "running",
      stage: "repairing",
      activeRole: "repairer",
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
      candidateCommitSha: "d".repeat(40),
      reviewerAgentId: "reviewer",
      status: "changes_requested",
      reviewerWorkspaceId: "review-1",
      findings: [],
      createdAt: now,
      updatedAt: now
    })
    const findingIdentity = {
      runId: run.runId,
      reviewAttempt: 1,
      locator: { path: "src/index.ts", line: 10, symbol: null },
      category: "correctness" as const,
      finding: "Wrong result."
    }
    const findingId = stableReviewFindingId(findingIdentity)
    const review = ReviewResultSchema.parse({
      schemaVersion: "1",
      runId: run.runId,
      roleAttempt: {
        schemaVersion: "1",
        runId: run.runId,
        roleExecutionId: "b4ba6ad3-7533-4498-a22f-9b7d2637fb28",
        role: "reviewer",
        attempt: 1,
        modelProfile: {
          schemaVersion: "1",
          profileId: "reviewer-default",
          role: "reviewer",
          provider: "openrouter",
          model: "test",
          reasoningEffort: "high"
        },
        prompt: { schemaVersion: "1", role: "reviewer", version: "v1", sha256: "b".repeat(64) },
        workspace: null,
        budget: {
          schemaVersion: "1",
          limits: { maxTurns: 1, maxInputTokens: 1, maxOutputTokens: 1, maxElapsedMs: 1, maxEstimatedSpendUsd: 1 },
          turns: 1,
          inputTokens: 1,
          outputTokens: 1,
          elapsedMs: 1,
          estimatedSpendUsd: 0,
          actualSpendUsd: null
        },
        startedAt: now.toISOString(),
        endedAt: now.toISOString()
      },
      reviewAttempt: 1,
      candidateCommitSha: cycle.candidateCommitSha,
      disposition: "changes_requested",
      findings: [
        {
          schemaVersion: "1",
          id: findingId,
          runId: run.runId,
          reviewAttempt: 1,
          severity: "high",
          category: "correctness",
          locator: findingIdentity.locator,
          finding: findingIdentity.finding,
          evidence: "Test fails.",
          expectedBehavior: "Test passes.",
          actionable: true,
          confidence: 0.9
        }
      ],
      blockedReasons: []
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
      retentionUntil: now,
      expiresAt: new Date(now.getTime() + 1_000),
      version: 0,
      createdAt: now,
      updatedAt: now
    })
    const repair = materializeRepairResult({
      options: { run, cycle, review, coderWorkspace },
      draft: {
        status: "completed",
        addressedFindingIds: [findingId],
        declinedFindings: [],
        remainingActionableFindingIds: [],
        blockers: []
      },
      roleExecutionId: "32ca67a0-cf75-44e2-8943-b0b988f22c52",
      promptSha256: "c".repeat(64),
      model: "openrouter/openai/gpt-5.6-terra",
      resultingCommitSha: "e".repeat(40),
      changedFiles: ["src/index.ts"],
      validationResults: [],
      startedAt: now,
      endedAt: now,
      promptTokens: 100,
      completionTokens: 20
    })

    expect(repair.reviewedCandidateCommitSha).toBe(cycle.candidateCommitSha)
    expect(repair.resultingCommitSha).toBe("e".repeat(40))
    expect(repair.roleAttempt.workspace?.conversationId).toBe("coder-conversation")
  })
})
