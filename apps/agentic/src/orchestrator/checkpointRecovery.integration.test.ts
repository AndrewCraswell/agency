import { randomUUID } from "node:crypto"
import { readFile } from "node:fs/promises"
import { describe, expect, it, vi } from "vitest"
import { AssignmentSchema, type Assignment } from "../contracts/assignment"
import { WorkerResultSchema, type WorkerResult } from "../contracts/results"
import type { DraftPullRequestPublisher } from "../github/publisher"
import { createCheckpointRuntime } from "./checkpointRuntime"
import { createWorkflowGraph } from "./graph"

const fixtureUrl = new URL("../../tests/fixtures/worker-repair-assignment.json", import.meta.url)
const timestamp = "2026-07-19T00:00:00.000Z"

async function uniqueAssignment(): Promise<Assignment> {
  const fixture = AssignmentSchema.parse(JSON.parse(await readFile(fixtureUrl, "utf8")))
  return AssignmentSchema.parse({ ...fixture, runId: randomUUID(), roleExecutionId: randomUUID() })
}

function completedWorkerResult(assignment: Assignment): WorkerResult {
  const validation = assignment.validationCommands[0]
  if (validation === undefined) {
    throw new Error("Expected assignment validation command")
  }

  return WorkerResultSchema.parse({
    schemaVersion: "1",
    runId: assignment.runId,
    roleExecutionId: assignment.roleExecutionId,
    status: "completed",
    workspace: {
      provider: "daytona",
      workspaceId: "checkpoint-recovery-workspace",
      lifecycleState: "stopped",
      repositoryPath: "/workspace/repository",
      agentServerUrlReference: "daytona-preview:3000",
      conversationId: "checkpoint-recovery-conversation",
      createdAt: timestamp,
      lastActivityAt: timestamp,
      retentionUntil: "2026-07-20T00:00:00.000Z",
      expiresAt: "2026-07-26T00:00:00.000Z"
    },
    conversationId: "checkpoint-recovery-conversation",
    baseCommitSha: assignment.baseCommitSha,
    resultingCommitSha: assignment.baseCommitSha,
    changedFiles: ["README.md"],
    patchArtifact: "git/patch.diff",
    validationResults: [
      {
        commandId: validation.id,
        exitCode: 0,
        stdoutArtifact: `validation/${validation.id}.stdout.log`,
        stderrArtifact: `validation/${validation.id}.stderr.log`,
        startedAt: timestamp,
        endedAt: timestamp,
        timedOut: false
      }
    ],
    metrics: {
      elapsedMs: 1_000,
      turns: 1,
      promptTokens: 100,
      cachedPromptTokens: null,
      completionTokens: 50,
      estimatedCostUsd: null
    },
    artifacts: [
      {
        relativePath: "git/patch.diff",
        mediaType: "text/x-diff",
        byteLength: 100,
        sha256: "a".repeat(64)
      }
    ],
    failure: null
  })
}

const describePostgres = process.env.POSTGRES_API_URL === undefined ? describe.skip : describe

describePostgres("PostgreSQL checkpoint recovery", () => {
  it("recovers a terminal workflow through a new pool without repeating side effects", async () => {
    const assignment = await uniqueAssignment()
    const runtimeA = await createCheckpointRuntime()
    const runWorker = vi.fn(async () => completedWorkerResult(assignment))
    const publish = vi.fn<DraftPullRequestPublisher["publish"]>().mockResolvedValue({
      branch: `agent/${assignment.runId}`,
      pullRequestNumber: 42,
      pullRequestUrl: "https://github.com/example/repository/pull/42",
      headCommitSha: "b".repeat(40),
      updatedExisting: false
    })

    try {
      const workflowA = createWorkflowGraph({
        artifactRoot: (runId) => `D:/artifacts/${runId}`,
        runWorker,
        publisher: { publish },
        checkpointer: runtimeA.checkpointer,
        now: () => new Date(timestamp)
      })
      await expect(workflowA.invoke(assignment)).resolves.toMatchObject({ terminalStatus: "published" })
    } finally {
      await runtimeA.close()
    }

    const runtimeB = await createCheckpointRuntime()
    try {
      const workflowB = createWorkflowGraph({
        artifactRoot: (runId) => `D:/artifacts/${runId}`,
        runWorker: async () => {
          throw new Error("Recovered workflow must not run the worker again")
        },
        publisher: {
          publish: async () => {
            throw new Error("Recovered workflow must not publish again")
          }
        },
        checkpointer: runtimeB.checkpointer,
        now: () => new Date(timestamp)
      })

      const recovered = await workflowB.invoke(assignment)
      expect(recovered).toMatchObject({ runId: assignment.runId, terminalStatus: "published" })
      expect(runWorker).toHaveBeenCalledOnce()
      expect(publish).toHaveBeenCalledOnce()
    } finally {
      await runtimeB.checkpointer.deleteThread(`workflow:${assignment.runId}`)
      await runtimeB.close()
    }
  })
})
