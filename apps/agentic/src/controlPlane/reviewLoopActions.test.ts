import { describe, expect, it } from "vitest"
import { ReviewResultSchema } from "../contracts/specialized"
import { ReviewCycleRecordSchema, WorkflowRunRecordSchema } from "../persistence/controlPlaneStore"
import { linearOutcomeEvidence } from "./reviewLoopActions"

const now = new Date("2026-07-19T12:00:00.000Z")

describe("linearOutcomeEvidence", () => {
  it("includes every review round and exact terminal commit evidence", () => {
    const run = WorkflowRunRecordSchema.parse({
      runId: "dff7a1a0-2c52-4e3f-a325-90d314f81820",
      requestDigest: "a".repeat(64),
      status: "running",
      stage: "reviewing",
      activeRole: "reviewer",
      graphVersion: "delivery-v1",
      repositoryOwner: "AndrewCraswell",
      repositoryName: "agency",
      sourceWorkItemId: "b0c6449e-380d-4e37-bcc4-4c86dff6bb1d",
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
      reviewRound: 2,
      candidateCommitSha: "d".repeat(40),
      reviewerAgentId: "reviewer",
      status: "running",
      reviewerWorkspaceId: "review-2",
      findings: [],
      createdAt: now,
      updatedAt: now
    })
    const review = ReviewResultSchema.parse({
      schemaVersion: "1",
      runId: run.runId,
      roleAttempt: {
        schemaVersion: "1",
        runId: run.runId,
        roleExecutionId: "b4ba6ad3-7533-4498-a22f-9b7d2637fb28",
        role: "reviewer",
        attempt: 2,
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
      reviewAttempt: 2,
      candidateCommitSha: cycle.candidateCommitSha,
      disposition: "approved",
      findings: [],
      blockedReasons: []
    })
    const firstCycle = ReviewCycleRecordSchema.parse({
      ...cycle,
      reviewRound: 1,
      candidateCommitSha: "c".repeat(40),
      status: "changes_requested",
      reviewerWorkspaceId: "review-1",
      findings: [{ id: "prior-finding" }]
    })

    const evidence = linearOutcomeEvidence({
      run,
      disposition: "merged",
      candidateCommitSha: cycle.candidateCommitSha,
      review,
      history: [firstCycle, cycle],
      mergedCommitSha: "e".repeat(40)
    })

    expect(evidence).toContain("Round 1: changes_requested")
    expect(evidence).toContain("Round 2: running")
    expect(evidence).toContain(`Merged as \`${"e".repeat(40)}\``)
  })
})
