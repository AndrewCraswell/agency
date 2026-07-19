import { describe, expect, it } from "vitest"
import { ReviewCycleRecordSchema, WorkflowRunRecordSchema } from "../persistence/controlPlaneStore"
import { materializeReviewResult } from "./reviewerRunner"

const now = new Date("2026-07-19T12:00:00.000Z")

describe("materializeReviewResult", () => {
  it("assigns stable finding identity and trusted role metadata", () => {
    const run = WorkflowRunRecordSchema.parse({
      runId: "dff7a1a0-2c52-4e3f-a325-90d314f81820",
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
      candidateCommitSha: "d".repeat(40),
      reviewerAgentId: "reviewer",
      status: "queued",
      reviewerWorkspaceId: null,
      findings: [],
      createdAt: now,
      updatedAt: now
    })
    const review = materializeReviewResult({
      run,
      cycle,
      draft: {
        disposition: "changes_requested",
        findings: [
          {
            severity: "high",
            category: "correctness",
            locator: { path: "src/index.ts", line: 10, symbol: null },
            finding: "The branch returns the wrong result.",
            evidence: "The focused test returns false.",
            expectedBehavior: "The branch returns true.",
            actionable: true,
            confidence: 0.95
          }
        ],
        blockedReasons: []
      },
      roleExecutionId: "b4ba6ad3-7533-4498-a22f-9b7d2637fb28",
      conversationId: "c1",
      workspaceId: "review-workspace",
      promptSha256: "b".repeat(64),
      model: "openrouter/openai/gpt-5.6",
      startedAt: now,
      endedAt: now,
      promptTokens: 100,
      completionTokens: 20
    })

    expect(review.findings[0]?.id).toMatch(/^finding_[0-9a-f]{24}$/u)
    expect(review.roleAttempt.workspace).toMatchObject({
      workspaceId: "review-workspace",
      commitSha: cycle.candidateCommitSha,
      conversationId: "c1"
    })
    expect(review.candidateCommitSha).toBe(cycle.candidateCommitSha)
  })
})
