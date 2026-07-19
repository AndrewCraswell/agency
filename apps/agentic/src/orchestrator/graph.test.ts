import { readFile } from "node:fs/promises"
import { describe, expect, it, vi } from "vitest"
import { AssignmentSchema, type Assignment } from "../contracts/assignment"
import { WorkerResultSchema, type WorkerResult } from "../contracts/results"
import type { DraftPullRequestPublisher } from "../github/publisher"
import { createWorkflowGraph, recordCoderWorkspaceLease } from "./graph"

const fixtureUrl = new URL("../../tests/fixtures/worker-repair-assignment.json", import.meta.url)
const timestamp = "2026-07-19T00:00:00.000Z"

async function assignmentFixture(): Promise<Assignment> {
  return AssignmentSchema.parse(JSON.parse(await readFile(fixtureUrl, "utf8")))
}

function workerResult(
  assignment: Assignment,
  status: "cancelled" | "completed" | "failed" = "completed",
  lifecycleState: "running" | "stopped" = "stopped"
): WorkerResult {
  const validation = assignment.validationCommands[0]
  if (validation === undefined) {
    throw new Error("Expected assignment validation command")
  }

  const base = {
    schemaVersion: "1",
    runId: assignment.runId,
    roleExecutionId: assignment.roleExecutionId,
    workspace: {
      provider: "daytona",
      workspaceId: "workspace-1",
      lifecycleState,
      repositoryPath: "/workspace/repository",
      agentServerUrlReference: "daytona-preview:3000",
      conversationId: "conversation-1",
      createdAt: timestamp,
      lastActivityAt: timestamp,
      retentionUntil: "2026-07-20T00:00:00.000Z",
      expiresAt: "2026-07-26T00:00:00.000Z"
    },
    conversationId: "conversation-1",
    baseCommitSha: assignment.baseCommitSha,
    resultingCommitSha: assignment.baseCommitSha,
    changedFiles: ["apps/structured-data/app/domain/remediation-links.ts"],
    patchArtifact: "git/patch.diff",
    validationResults: [
      {
        commandId: validation.id,
        exitCode: status === "completed" ? 0 : 1,
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
    ]
  }

  if (status === "completed") {
    return WorkerResultSchema.parse({ ...base, status, failure: null })
  }
  return WorkerResultSchema.parse({
    ...base,
    status,
    failure: {
      classification: status === "cancelled" ? "cancelled" : "validation",
      message: status === "cancelled" ? "Workflow cancelled" : "Focused test failed",
      retryable: false
    }
  })
}

describe("workflow graph", () => {
  it("persists the retained coder workspace and conversation", async () => {
    const assignment = await assignmentFixture()
    const result = workerResult(assignment)
    const createWorkspaceLease = vi.fn(async () => {
      throw new Error("Return value is not used")
    })

    await expect(recordCoderWorkspaceLease({ createWorkspaceLease }, assignment, result)).rejects.toThrow(
      "Return value is not used"
    )
    expect(createWorkspaceLease).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-1",
        runId: assignment.runId,
        role: "coder",
        roleAttempt: 1,
        lifecycleState: "stopped",
        conversationId: "conversation-1",
        profileName: "coder"
      })
    )
  })

  it("routes a publishable worker result through publication and cleanup", async () => {
    const assignment = await assignmentFixture()
    const runWorker = vi.fn(async () => workerResult(assignment))
    const publish = vi.fn<DraftPullRequestPublisher["publish"]>().mockResolvedValue({
      branch: `agent/${assignment.runId}`,
      pullRequestNumber: 42,
      pullRequestUrl: "https://github.com/example/repository/pull/42",
      headCommitSha: "b".repeat(40),
      updatedExisting: false
    })
    const workflow = createWorkflowGraph({
      artifactRoot: (runId) => `D:/artifacts/${runId}`,
      runWorker,
      publisher: { publish },
      now: () => new Date(timestamp)
    })

    const result = await workflow.invoke(assignment)
    const repeatedResult = await workflow.invoke(assignment)

    expect(result.terminalStatus).toBe("published")
    expect(result.phase).toBe("cleaned_up")
    expect(result.publicationResult?.pullRequestNumber).toBe(42)
    expect(result.cleanupFailure).toBeNull()
    expect(repeatedResult).toEqual(result)
    expect(result.events.map((graphEvent) => graphEvent.node)).toEqual([
      "prepareAssignment",
      "provisionWorkspace",
      "runCoder",
      "validateResult",
      "publishDraftPr",
      "stopWorkspace"
    ])
    expect(publish).toHaveBeenCalledOnce()
    expect(runWorker).toHaveBeenCalledOnce()
  })

  it("rejects reuse of a thread ID for a different assignment digest", async () => {
    const assignment = await assignmentFixture()
    const publish = vi.fn<DraftPullRequestPublisher["publish"]>().mockResolvedValue({
      branch: `agent/${assignment.runId}`,
      pullRequestNumber: 42,
      pullRequestUrl: "https://github.com/example/repository/pull/42",
      headCommitSha: "b".repeat(40),
      updatedExisting: false
    })
    const workflow = createWorkflowGraph({
      artifactRoot: (runId) => `D:/artifacts/${runId}`,
      runWorker: async () => workerResult(assignment),
      publisher: { publish },
      now: () => new Date(timestamp)
    })
    await workflow.invoke(assignment)

    await expect(workflow.invoke({ ...assignment, objective: `${assignment.objective} changed` })).rejects.toThrow(
      "already bound to a different assignment digest"
    )
    expect(publish).toHaveBeenCalledOnce()
  })

  it("routes failed independent validation through evidence preservation and cleanup", async () => {
    const assignment = await assignmentFixture()
    const publish = vi.fn<DraftPullRequestPublisher["publish"]>()
    const workflow = createWorkflowGraph({
      artifactRoot: (runId) => `D:/artifacts/${runId}`,
      runWorker: async () => workerResult(assignment, "failed"),
      publisher: { publish },
      now: () => new Date(timestamp)
    })

    const result = await workflow.invoke(assignment)

    expect(result.terminalStatus).toBe("failed")
    expect(result.phase).toBe("cleaned_up")
    expect(result.failure).toMatchObject({ node: "validateResult", classification: "validation" })
    expect(result.artifactReferences).toContain("git/patch.diff")
    expect(result.events.map((graphEvent) => graphEvent.node)).toContain("recordFailure")
    expect(result.events.at(-1)?.node).toBe("stopWorkspace")
    expect(publish).not.toHaveBeenCalled()
  })

  it("preserves a successful publication when cleanup reports an independent failure", async () => {
    const assignment = await assignmentFixture()
    const publish = vi.fn<DraftPullRequestPublisher["publish"]>().mockResolvedValue({
      branch: `agent/${assignment.runId}`,
      pullRequestNumber: 42,
      pullRequestUrl: "https://github.com/example/repository/pull/42",
      headCommitSha: "b".repeat(40),
      updatedExisting: false
    })
    const workflow = createWorkflowGraph({
      artifactRoot: (runId) => `D:/artifacts/${runId}`,
      runWorker: async () => workerResult(assignment, "completed", "running"),
      publisher: { publish },
      now: () => new Date(timestamp)
    })

    const result = await workflow.invoke(assignment)

    expect(result.terminalStatus).toBe("published")
    expect(result.publicationResult?.pullRequestNumber).toBe(42)
    expect(result.cleanupFailure).toMatchObject({ node: "stopWorkspace", classification: "cleanup" })
  })

  it("cancels active coder execution and still routes through cleanup", async () => {
    const assignment = await assignmentFixture()
    const publish = vi.fn<DraftPullRequestPublisher["publish"]>()
    let markWorkerStarted: (() => void) | undefined
    const workerStarted = new Promise<void>((resolvePromise) => {
      markWorkerStarted = resolvePromise
    })
    const workflow = createWorkflowGraph({
      artifactRoot: (runId) => `D:/artifacts/${runId}`,
      runWorker: async ({ signal }) => {
        markWorkerStarted?.()
        if (!signal.aborted) {
          await new Promise<void>((resolvePromise) => {
            signal.addEventListener("abort", () => resolvePromise(), { once: true })
          })
        }
        return workerResult(assignment, "cancelled")
      },
      publisher: { publish },
      now: () => new Date(timestamp)
    })

    const invocation = workflow.invoke(assignment)
    await workerStarted
    expect(workflow.cancel(assignment.runId)).toBe(true)
    const result = await invocation

    expect(result.terminalStatus).toBe("cancelled")
    expect(result.phase).toBe("cleaned_up")
    expect(result.failure?.classification).toBe("cancelled")
    expect(result.events.at(-1)?.node).toBe("stopWorkspace")
    expect(publish).not.toHaveBeenCalled()
  })

  it("routes thrown worker errors and cancellation through typed terminal outcomes", async () => {
    const assignment = await assignmentFixture()
    const publish = vi.fn<DraftPullRequestPublisher["publish"]>()
    const failedWorkflow = createWorkflowGraph({
      artifactRoot: (runId) => `D:/artifacts/${runId}`,
      runWorker: async () => {
        throw "worker unavailable"
      },
      publisher: { publish },
      now: () => new Date(timestamp)
    })
    const failed = await failedWorkflow.invoke(assignment)
    expect(failed).toMatchObject({ terminalStatus: "failed", failure: { classification: "worker" } })
    expect(failed.failure?.message).toBe("Unknown workflow failure")

    const cancelledAssignment = { ...assignment, runId: "858355f6-a892-4fa9-af05-66c5085cc901" }
    const cancelledWorkflow = createWorkflowGraph({
      artifactRoot: (runId) => `D:/artifacts/${runId}`,
      runWorker: async () => {
        const error = new Error("cancelled")
        error.name = "AbortError"
        throw error
      },
      publisher: { publish },
      now: () => new Date(timestamp)
    })
    const cancelled = await cancelledWorkflow.invoke(cancelledAssignment)
    expect(cancelled).toMatchObject({ terminalStatus: "cancelled", failure: { classification: "cancelled" } })
    expect(publish).not.toHaveBeenCalled()
  })

  it("collects every independent validation reason from a failed worker result", async () => {
    const assignment = await assignmentFixture()
    const publish = vi.fn<DraftPullRequestPublisher["publish"]>()
    const failedResult = workerResult(assignment, "failed")
    const workflow = createWorkflowGraph({
      artifactRoot: (runId) => `D:/artifacts/${runId}`,
      runWorker: async () =>
        WorkerResultSchema.parse({
          ...failedResult,
          changedFiles: [],
          patchArtifact: null,
          validationResults: failedResult.validationResults.map((result) => ({
            ...result,
            exitCode: null,
            timedOut: true
          }))
        }),
      publisher: { publish },
      now: () => new Date(timestamp)
    })

    const result = await workflow.invoke(assignment)

    expect(result.validationResult?.reasons).toEqual([
      "Coder finished with failed status",
      "Coder produced no patch artifact",
      "Coder produced no changed files",
      "Independent validation did not pass"
    ])
    expect(publish).not.toHaveBeenCalled()
  })

  it("classifies publication rejection and supports state inspection", async () => {
    const assignment = await assignmentFixture()
    const workflow = createWorkflowGraph({
      artifactRoot: (runId) => `D:/artifacts/${runId}`,
      runWorker: async () => workerResult(assignment),
      publisher: {
        publish: async () => {
          throw "publication unavailable"
        }
      },
      now: () => new Date(timestamp)
    })

    const result = await workflow.invoke(assignment)

    expect(result).toMatchObject({ terminalStatus: "failed", failure: { classification: "publication" } })
    expect(result.failure?.message).toBe("Unknown workflow failure")
    await expect(workflow.inspect(assignment.runId)).resolves.toEqual(result)
    await expect(workflow.inspect("62b81077-c4c6-4bbf-8114-b37179186cba")).resolves.toBeNull()
    expect(workflow.cancel(assignment.runId)).toBe(false)
  })
})
