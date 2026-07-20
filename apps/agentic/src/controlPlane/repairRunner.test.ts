import { beforeEach, describe, expect, it, vi } from "vitest"
import { ReviewResultSchema, stableReviewFindingId } from "../contracts/specialized"
import {
  ReviewCycleRecordSchema,
  WorkflowRunRecordSchema,
  WorkspaceLeaseRecordSchema
} from "../persistence/controlPlaneStore"

const mocks = vi.hoisted(() => {
  type CommandResult = { exitCode: number | null; output: string; timedOut: boolean }
  type FollowUpResult = {
    finalResponse: string
    usage: { promptTokens: number | null; completionTokens: number | null }
  }
  const state = {
    synchronize: { exitCode: 0, output: "", timedOut: false } as CommandResult,
    health: { exitCode: 1, output: "unhealthy", timedOut: false } as CommandResult,
    status: { exitCode: 0, output: " M src/index.ts\n", timedOut: false } as CommandResult,
    publish: { exitCode: 0, output: `published\n${"e".repeat(40)}`, timedOut: false } as CommandResult,
    validation: { exitCode: 0, output: "ok", timedOut: false } as CommandResult,
    validationPlan: [
      {
        id: "focused-check",
        command: "pnpm --filter agentic test -- src/controlPlane/repairRunner.test.ts",
        workingDirectory: ".",
        timeoutMs: 60_000
      }
    ],
    pathPolicy: {
      relevantPaths: ["src/index.ts"],
      pathPolicy: { allowed: ["src/**"], forbidden: [] as string[] }
    },
    followUp: {
      finalResponse: JSON.stringify({
        status: "completed",
        addressedFindingIds: [],
        declinedFindings: [],
        remainingActionableFindingIds: [],
        blockers: []
      }),
      usage: { promptTokens: 12, completionTokens: 7 }
    } as FollowUpResult
  }
  return {
    state,
    executeCommand: vi.fn(async (input: { commandId: string }) => {
      if (input.commandId.startsWith("synchronize-candidate-")) {
        return state.synchronize
      }
      if (input.commandId.startsWith("check-agent-server-")) {
        return state.health
      }
      if (input.commandId.startsWith("repair-status-")) {
        return state.status
      }
      if (input.commandId.startsWith("publish-repair-")) {
        return state.publish
      }
      if (input.commandId.startsWith("repair-")) {
        return state.validation
      }
      throw new Error(`Unexpected command ${input.commandId}`)
    }),
    start: vi.fn(async () => undefined),
    startBackgroundSession: vi.fn(async () => undefined),
    signedPreview: vi.fn(async () => ({ url: "https://preview.example/" })),
    download: vi.fn(async (path: string) => {
      if (path.endsWith("/validation-plan.json")) {
        return Buffer.from(JSON.stringify(state.validationPlan), "utf8")
      }
      if (path.endsWith("/path-policy.json")) {
        return Buffer.from(JSON.stringify(state.pathPolicy), "utf8")
      }
      throw new Error(`Unexpected download path ${path}`)
    }),
    cleanup: vi.fn(async () => undefined),
    attach: vi.fn(),
    createDaytonaClient: vi.fn(() => ({ client: "daytona" })),
    waitForHttpReadiness: vi.fn(async () => undefined),
    readFile: vi.fn(async () => "Repair system prompt"),
    deriveAgentServerSecrets: vi.fn(() => ({ sessionApiKey: "session-api-key" })),
    createCoderProfile: vi.fn(() => ({ model: "openrouter/test-model" })),
    configureProfile: vi.fn(async () => undefined),
    verifyProfile: vi.fn(async () => undefined),
    followUp: vi.fn(async () => state.followUp),
    openHandsConstructor: vi.fn(),
    artifactWrite: vi.fn(async (path: string) => path)
  }
})

vi.mock("node:fs/promises", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:fs/promises")>()
  return { ...original, readFile: mocks.readFile }
})

vi.mock("../daytona/workspace", async (importOriginal) => {
  const original = await importOriginal<typeof import("../daytona/workspace")>()
  mocks.attach.mockImplementation(async () => ({
    start: mocks.start,
    executeCommand: mocks.executeCommand,
    startBackgroundSession: mocks.startBackgroundSession,
    signedPreview: mocks.signedPreview,
    download: mocks.download,
    cleanup: mocks.cleanup
  }))
  return {
    ...original,
    DaytonaWorkspace: { attach: mocks.attach },
    createDaytonaClient: mocks.createDaytonaClient,
    waitForHttpReadiness: mocks.waitForHttpReadiness
  }
})

vi.mock("../openhands/client", () => {
  mocks.openHandsConstructor.mockImplementation(function MockOpenHandsClient() {
    return {
      configureProfile: mocks.configureProfile,
      verifyProfile: mocks.verifyProfile,
      followUp: mocks.followUp
    }
  })
  return { OpenHandsClient: mocks.openHandsConstructor }
})

vi.mock("../openhands/profiles", async (importOriginal) => {
  const original = await importOriginal<typeof import("../openhands/profiles")>()
  return {
    ...original,
    OPENHANDS_AGENT_SERVER_PORT: 3001,
    createCoderProfile: mocks.createCoderProfile
  }
})

vi.mock("../openhands/secrets", async (importOriginal) => {
  const original = await importOriginal<typeof import("../openhands/secrets")>()
  return { ...original, deriveAgentServerSecrets: mocks.deriveAgentServerSecrets }
})

import { materializeRepairResult, runRepairer } from "./repairRunner"

const now = new Date("2026-07-19T12:00:00.000Z")

function baseContext() {
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
  return { run, cycle, review, coderWorkspace, findingId }
}

function baseOptions(overrides: Partial<ReturnType<typeof baseContext>> = {}) {
  const context = baseContext()
  const merged = { ...context, ...overrides }
  return {
    run: merged.run,
    cycle: merged.cycle,
    review: merged.review,
    coderWorkspace: merged.coderWorkspace,
    artifactRoot: "artifacts/test-run",
    artifactStore: {
      write: mocks.artifactWrite,
      read: vi.fn(async () => Buffer.alloc(0)),
      manifest: vi.fn(() => [])
    },
    githubToken: "github-token",
    modelProviderApiKey: "model-key",
    workspaceSecretKey: "w".repeat(32)
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.state.synchronize = { exitCode: 0, output: "", timedOut: false }
  mocks.state.health = { exitCode: 1, output: "unhealthy", timedOut: false }
  mocks.state.status = { exitCode: 0, output: " M src/index.ts\n", timedOut: false }
  mocks.state.publish = { exitCode: 0, output: `published\n${"e".repeat(40)}`, timedOut: false }
  mocks.state.validation = { exitCode: 0, output: "ok", timedOut: false }
  mocks.state.validationPlan = [
    {
      id: "focused-check",
      command: "pnpm --filter agentic test -- src/controlPlane/repairRunner.test.ts",
      workingDirectory: ".",
      timeoutMs: 60_000
    }
  ]
  mocks.state.pathPolicy = {
    relevantPaths: ["src/index.ts"],
    pathPolicy: { allowed: ["src/**"], forbidden: [] }
  }
  mocks.state.followUp = {
    finalResponse: JSON.stringify({
      status: "completed",
      addressedFindingIds: [],
      declinedFindings: [],
      remainingActionableFindingIds: [],
      blockers: []
    }),
    usage: { promptTokens: 12, completionTokens: 7 }
  }
})

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

  it.each(["blocked", "failed"] as const)("materializes %s drafts with review evidence", (status) => {
    const { run, cycle, review, coderWorkspace, findingId } = baseContext()
    const repair = materializeRepairResult({
      options: { run, cycle, review, coderWorkspace },
      draft: {
        status,
        addressedFindingIds: [],
        declinedFindings: [],
        remainingActionableFindingIds: [findingId],
        blockers: [{ category: "tool", message: "Validation service unavailable." }]
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

    expect(repair.status).toBe(status)
    expect(repair.blockers[0]?.evidence[0]?.uri).toContain(`/pull/${run.pullRequestNumber}`)
  })
})

describe("runRepairer", () => {
  it("fails fast when the retained coder conversation is missing", async () => {
    const context = baseContext()
    const options = baseOptions({
      coderWorkspace: WorkspaceLeaseRecordSchema.parse({ ...context.coderWorkspace, conversationId: null })
    })

    await expect(runRepairer(options)).rejects.toThrow("Retained repair requires the coder conversation ID")
    expect(mocks.attach).not.toHaveBeenCalled()
  })

  it.each([
    { label: "timed out", result: { exitCode: 0, output: "", timedOut: true }, matcher: "command timed out" },
    { label: "nonzero", result: { exitCode: 1, output: "sync failed", timedOut: false }, matcher: "sync failed" }
  ])("fails when candidate synchronization is $label", async ({ result, matcher }) => {
    mocks.state.synchronize = result

    await expect(runRepairer(baseOptions())).rejects.toThrow(matcher)
    expect(mocks.cleanup).toHaveBeenCalledOnce()
  })

  it("starts the local agent server when health check fails", async () => {
    mocks.state.health = { exitCode: 1, output: "down", timedOut: false }

    const output = await runRepairer(baseOptions())

    expect(mocks.startBackgroundSession).toHaveBeenCalledOnce()
    expect(output.candidateCommitSha).toBe("e".repeat(40))
  })

  it("skips starting a local server when health check passes", async () => {
    mocks.state.health = { exitCode: 0, output: "", timedOut: false }

    await runRepairer(baseOptions())

    expect(mocks.startBackgroundSession).not.toHaveBeenCalled()
  })

  it.each([
    {
      label: "fenced",
      response: `\`\`\`json\n${JSON.stringify({
        status: "completed",
        addressedFindingIds: [],
        declinedFindings: [],
        remainingActionableFindingIds: [],
        blockers: []
      })}\n\`\`\``
    },
    {
      label: "plain",
      response: JSON.stringify({
        status: "completed",
        addressedFindingIds: [],
        declinedFindings: [],
        remainingActionableFindingIds: [],
        blockers: []
      })
    }
  ])("parses a $label repairer response body", async ({ response }) => {
    mocks.state.followUp = {
      finalResponse: response,
      usage: { promptTokens: 13, completionTokens: 8 }
    }

    const output = await runRepairer(baseOptions())

    expect(output.repair.status).toBe("completed")
  })

  it.each(["blocked", "failed"] as const)("rejects %s repair drafts", async (status) => {
    mocks.state.followUp = {
      finalResponse: JSON.stringify({
        status,
        addressedFindingIds: [],
        declinedFindings: [],
        remainingActionableFindingIds: ["finding-1"],
        blockers: [{ category: "tool", message: "Needs dependency update." }]
      }),
      usage: { promptTokens: 13, completionTokens: 8 }
    }

    await expect(runRepairer(baseOptions())).rejects.toThrow(`Repairer returned ${status}`)
    expect(mocks.cleanup).toHaveBeenCalledOnce()
  })

  it("rejects repair output with no changed files", async () => {
    mocks.state.status = { exitCode: 0, output: "", timedOut: false }

    await expect(runRepairer(baseOptions())).rejects.toThrow("Repairer produced no changes")
  })

  it("accepts changed files that satisfy path policy", async () => {
    mocks.state.status = { exitCode: 0, output: " M src/feature.ts\n", timedOut: false }
    mocks.state.pathPolicy = {
      relevantPaths: ["src/feature.ts"],
      pathPolicy: { allowed: ["src/**"], forbidden: ["**/*.secret"] }
    }

    const output = await runRepairer(baseOptions())

    expect(output.repair.changedFiles).toEqual(["src/feature.ts"])
  })

  it("rejects changed files outside path policy", async () => {
    mocks.state.status = { exitCode: 0, output: " M scripts/deploy.sh\n", timedOut: false }
    mocks.state.pathPolicy = {
      relevantPaths: ["src/index.ts"],
      pathPolicy: { allowed: ["src/**"], forbidden: ["scripts/**"] }
    }

    await expect(runRepairer(baseOptions())).rejects.toThrow("Repair changed paths outside policy")
  })

  it.each([
    {
      label: "failed",
      validation: { exitCode: 1, output: "test failures", timedOut: false },
      matcher: "Independent repair validation failed"
    },
    {
      label: "timed out",
      validation: { exitCode: 0, output: "", timedOut: true },
      matcher: "Independent repair validation failed"
    }
  ])("rejects when validation $label", async ({ validation, matcher }) => {
    mocks.state.validation = validation

    await expect(runRepairer(baseOptions())).rejects.toThrow(matcher)
  })

  it("publishes a valid commit SHA", async () => {
    mocks.state.publish = { exitCode: 0, output: `ok\n${"f".repeat(40)}`, timedOut: false }

    const output = await runRepairer(baseOptions())

    expect(output.candidateCommitSha).toBe("f".repeat(40))
    expect(mocks.cleanup).toHaveBeenCalledOnce()
  })

  it("rejects an invalid publish SHA", async () => {
    mocks.state.publish = { exitCode: 0, output: "ok\nnot-a-sha", timedOut: false }

    await expect(runRepairer(baseOptions())).rejects.toThrow()
    expect(mocks.cleanup).toHaveBeenCalledOnce()
  })
})
