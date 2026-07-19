import { describe, expect, it } from "vitest"
import { CommandResultSchema, WorkerResultSchema, WorkspaceHandleSchema } from "./results"

const workspace = {
  provider: "daytona",
  workspaceId: "sandbox-phase-1",
  lifecycleState: "stopped",
  repositoryPath: "/workspace/repository",
  agentServerUrlReference: "daytona-preview:sandbox-phase-1:3000",
  conversationId: "conversation-1",
  createdAt: "2026-07-18T20:00:00.000Z",
  lastActivityAt: "2026-07-18T20:10:00.000Z",
  retentionUntil: "2026-07-19T20:00:00.000Z",
  expiresAt: "2026-07-25T20:00:00.000Z"
}

const commandResult = {
  commandId: "focused-test",
  exitCode: 0,
  stdoutArtifact: "commands/focused-test.stdout.txt",
  stderrArtifact: "commands/focused-test.stderr.txt",
  startedAt: "2026-07-18T20:05:00.000Z",
  endedAt: "2026-07-18T20:06:00.000Z",
  timedOut: false
}

const completedResult = {
  schemaVersion: "1",
  status: "completed",
  runId: "dff7a1a0-2c52-4e3f-a325-90d314f81820",
  roleExecutionId: "bf32fd7f-c98c-4a31-88ca-acfb99654c69",
  workspace,
  conversationId: "conversation-1",
  baseCommitSha: "8c185e6bb5214b2dd27552cd5d7e7ad0349a4cf1",
  resultingCommitSha: "8c185e6bb5214b2dd27552cd5d7e7ad0349a4cf1",
  changedFiles: [],
  patchArtifact: null,
  validationResults: [commandResult],
  metrics: {
    elapsedMs: 600_000,
    turns: 3,
    promptTokens: 10_000,
    cachedPromptTokens: 5_000,
    completionTokens: 2_000,
    estimatedCostUsd: 0.075
  },
  artifacts: [
    {
      relativePath: "commands/focused-test.stdout.txt",
      mediaType: "text/plain",
      byteLength: 12,
      sha256: "a".repeat(64)
    }
  ],
  failure: null
}

describe("CommandResultSchema", () => {
  it("accepts independently collected command evidence", () => {
    expect(CommandResultSchema.parse(commandResult)).toEqual(commandResult)
  })

  it("rejects an exit code for a timed-out command", () => {
    expect(CommandResultSchema.safeParse({ ...commandResult, timedOut: true }).success).toBe(false)
  })

  it("rejects an end time before the start time", () => {
    expect(CommandResultSchema.safeParse({ ...commandResult, endedAt: "2026-07-18T20:04:00.000Z" }).success).toBe(false)
  })
})

describe("WorkspaceHandleSchema", () => {
  it("rejects malformed provider identifiers", () => {
    expect(WorkspaceHandleSchema.safeParse({ ...workspace, workspaceId: "contains spaces" }).success).toBe(false)
  })
})

describe("WorkerResultSchema", () => {
  it("accepts a completed result without a failure", () => {
    expect(WorkerResultSchema.parse(completedResult)).toEqual(completedResult)
  })

  it("accepts a typed blocked result", () => {
    const result = {
      ...completedResult,
      status: "blocked",
      failure: {
        classification: "policy_violation",
        message: "The requested path is forbidden.",
        retryable: false
      }
    }

    expect(WorkerResultSchema.parse(result)).toEqual(result)
  })

  it("rejects an untyped failed result", () => {
    expect(WorkerResultSchema.safeParse({ ...completedResult, status: "failed" }).success).toBe(false)
  })

  it("rejects malformed artifact digests", () => {
    const artifacts = [{ ...completedResult.artifacts[0], sha256: "abc123" }]
    expect(WorkerResultSchema.safeParse({ ...completedResult, artifacts }).success).toBe(false)
  })

  it("rejects unknown result fields", () => {
    expect(WorkerResultSchema.safeParse({ ...completedResult, agentReport: "trust me" }).success).toBe(false)
  })
})
