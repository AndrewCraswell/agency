import { describe, expect, it, vi } from "vitest"
import type { WorkerResult } from "../contracts/results"
import { createRepositoryAgentExecutor } from "./repositoryAgentExecutor"

const runId = "019c230c-60c6-7bd8-a9f8-9e5f51b09e30"
const activationId = "a".repeat(64)
const contentDigest = "d".repeat(64)
const snapshot = {
  reference: {
    connectionId: "019c230c-60c6-7bd8-a9f8-9e5f51b09e31",
    repositoryId: "42",
    repositoryName: "agency/repository",
    ref: "main",
    path: ".github/reviewer.agent.md",
    observedCommitSha: "b".repeat(40),
    blobSha: "c".repeat(40),
    contentDigest,
    sourceUrl: "https://github.com/agency/repository/blob/main/.github/reviewer.agent.md",
    name: "Reviewer",
    description: "Review the candidate",
    requestedModel: "openai/gpt-5.4",
    requestedTools: ["read", "search"]
  },
  content: "---\nname: Reviewer\ndescription: Review the candidate\n---\n# Review",
  body: "# Review",
  parserVersion: "1" as const,
  effectiveModel: "openai/gpt-5.4",
  effectiveTools: ["read", "search"]
}

function workerResult(): WorkerResult {
  return {
    schemaVersion: "1",
    runId,
    roleExecutionId: "54aaa965-3cc6-4b82-a3b1-ee816aa9a756",
    status: "completed",
    workspace: {
      provider: "daytona",
      workspaceId: "workspace-1",
      lifecycleState: "stopped",
      repositoryPath: "/workspace/repository",
      agentServerUrlReference: "daytona-preview:8000",
      conversationId: "conversation-1",
      createdAt: "2026-07-19T12:00:00.000Z",
      lastActivityAt: "2026-07-19T12:00:00.000Z",
      retentionUntil: "2026-07-20T12:00:00.000Z",
      expiresAt: "2026-07-26T12:00:00.000Z"
    },
    conversationId: "conversation-1",
    baseCommitSha: "b".repeat(40),
    resultingCommitSha: "e".repeat(40),
    changedFiles: ["src/index.ts"],
    patchArtifact: "git/patch.diff",
    validationResults: [
      {
        commandId: "diff-check",
        exitCode: 0,
        stdoutArtifact: "commands/diff-check.stdout.txt",
        stderrArtifact: "commands/diff-check.stderr.txt",
        startedAt: "2026-07-19T12:00:00.000Z",
        endedAt: "2026-07-19T12:00:01.000Z",
        timedOut: false
      }
    ],
    metrics: {
      elapsedMs: 1000,
      turns: null,
      promptTokens: 100,
      cachedPromptTokens: null,
      completionTokens: 20,
      estimatedCostUsd: null
    },
    artifacts: [{ relativePath: "git/patch.diff", mediaType: "text/plain", byteLength: 5, sha256: "f".repeat(64) }],
    failure: null
  }
}

function input() {
  return {
    runId,
    activationId,
    attemptOrdinal: 1,
    step: {
      id: "review",
      label: "Review",
      position: { x: 0, y: 0 },
      definition: { kind: "repository_agent", version: 1 },
      config: {
        agentReference: snapshot.reference,
        instructions: "Review only the changed files",
        validationCommands: [
          { id: "diff-check", command: "git diff --check", workingDirectory: ".", timeoutMs: 60_000 }
        ],
        allowedPaths: ["src/**"],
        forbiddenPaths: [".git/**"],
        budgets: { maxTurns: 20, maxTokens: 50_000, maxElapsedMs: 600_000 }
      },
      failurePolicy: { mode: "stop" as const, maximumAttempts: 1 }
    },
    input: { context: { issue: "FEN-423" } },
    snapshots: [snapshot]
  }
}

describe("repository agent executor", () => {
  it("runs the publication-approved snapshot at its pinned repository commit", async () => {
    const worker = vi.fn(async () => workerResult())
    const execute = createRepositoryAgentExecutor(worker)

    await expect(execute(input())).resolves.toMatchObject({
      result: {
        status: "completed",
        baseCommitSha: "b".repeat(40),
        resultingCommitSha: "e".repeat(40),
        changedFiles: ["src/index.ts"],
        patchArtifact: "git/patch.diff"
      }
    })
    expect(worker).toHaveBeenCalledWith(
      expect.objectContaining({
        approvedRepository: "agency/repository",
        systemPrompt: expect.stringContaining("# Review"),
        artifactPrefix: `workflow/${activationId}/1`,
        assignment: expect.objectContaining({
          runId,
          baseCommitSha: "b".repeat(40),
          promptVersion: `repository-agent-${contentDigest}`,
          objective: expect.stringContaining('"issue":"FEN-423"')
        })
      })
    )
  })

  it("fails closed when the approved snapshot is absent", async () => {
    const execute = createRepositoryAgentExecutor(vi.fn(async () => workerResult()))
    await expect(execute({ ...input(), snapshots: [] })).rejects.toThrow("snapshot is unavailable")
  })
})
