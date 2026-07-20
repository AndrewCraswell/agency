import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ReviewCycleRecordSchema, WorkflowRunRecordSchema } from "../persistence/controlPlaneStore"
import type { ArtifactStorePort } from "../prototype/artifacts"

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(() => ({ provider: "fake" })),
  createWorkspace: vi.fn(),
  waitForReadiness: vi.fn().mockResolvedValue({ attempts: 1 }),
  configureProfile: vi.fn().mockResolvedValue(undefined),
  verifyProfile: vi.fn().mockResolvedValue(undefined),
  chat: vi.fn()
}))

vi.mock("../daytona/workspace", () => ({
  createDaytonaClient: mocks.createClient,
  DaytonaWorkspace: { create: mocks.createWorkspace },
  waitForHttpReadiness: mocks.waitForReadiness
}))

vi.mock("../openhands/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../openhands/client")>()
  return {
    ...actual,
    OpenHandsClient: class {
      configureProfile = mocks.configureProfile
      verifyProfile = mocks.verifyProfile
      chat = mocks.chat
    }
  }
})

import { materializeReviewResult, runReviewer } from "./reviewerRunner"

const now = new Date("2026-07-19T12:00:00.000Z")

function baseRun(overrides: Partial<ReturnType<typeof WorkflowRunRecordSchema.parse>> = {}) {
  return WorkflowRunRecordSchema.parse({
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
    updatedAt: now,
    ...overrides
  })
}

function baseCycle(runId: string, overrides: Partial<ReturnType<typeof ReviewCycleRecordSchema.parse>> = {}) {
  return ReviewCycleRecordSchema.parse({
    runId,
    reviewRound: 1,
    candidateCommitSha: "d".repeat(40),
    reviewerAgentId: "reviewer",
    status: "queued",
    reviewerWorkspaceId: null,
    findings: [],
    createdAt: now,
    updatedAt: now,
    ...overrides
  })
}

type CommandResult = { exitCode: number | null; output: string; timedOut: boolean }

type FakeWorkspaceState = {
  commands: Array<{ commandId: string; command: string; timeoutMs?: number; environment?: Record<string, string> }>
  uploads: Array<{ remotePath: string; timeoutMs: number }>
  cleanupCalls: Array<{ mode: string; timeoutMs: number }>
}

function fakeWorkspace(options?: {
  metadataCreatedAt?: string | null
  commandById?: Partial<Record<string, CommandResult>>
}) {
  const state: FakeWorkspaceState = {
    commands: [],
    uploads: [],
    cleanupCalls: []
  }
  const createdAt =
    options !== undefined && "metadataCreatedAt" in options ? options.metadataCreatedAt : "2026-07-19T10:00:00.000Z"
  const workspace = {
    describe: vi.fn(() => ({
      workspaceId: "review-workspace-1",
      createdAt,
      lastActivityAt: "2026-07-19T10:01:00.000Z"
    })),
    executeCommand: vi.fn(
      async (command: {
        commandId: string
        command: string
        timeoutMs?: number
        environment?: Record<string, string>
      }) => {
        state.commands.push(command)
        return options?.commandById?.[command.commandId] ?? { exitCode: 0, output: "", timedOut: false }
      }
    ),
    upload: vi.fn(async (_content: Uint8Array, remotePath: string, timeoutMs: number) => {
      state.uploads.push({ remotePath, timeoutMs })
    }),
    startBackgroundSession: vi.fn(async () => "reviewer-agent-server"),
    signedPreview: vi.fn(async () => ({ url: "https://agent.example/", token: "preview-token" })),
    cleanup: vi.fn(async (mode: string, timeoutMs: number) => {
      state.cleanupCalls.push({ mode, timeoutMs })
    })
  }
  return { workspace, state }
}

function fakeArtifactStore(): ArtifactStorePort {
  return {
    write: vi.fn(async (relativePath: string) => relativePath),
    read: vi.fn(async (_relativePath: string) => Buffer.from("context-data")),
    manifest: vi.fn(() => [])
  }
}

function reviewerOptions(overrides?: {
  run?: ReturnType<typeof WorkflowRunRecordSchema.parse>
  cycle?: ReturnType<typeof ReviewCycleRecordSchema.parse>
  artifactStore?: ArtifactStorePort
}) {
  const run = overrides?.run ?? baseRun()
  return {
    run,
    cycle: overrides?.cycle ?? baseCycle(run.runId),
    artifactRoot: "D:/agency/apps/agentic/artifacts/test",
    artifactStore: overrides?.artifactStore ?? fakeArtifactStore(),
    githubToken: "github-token",
    modelProviderApiKey: "provider-key",
    workspaceSecretKey: "workspace-secret-key-for-reviewer-runner-tests"
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.waitForReadiness.mockResolvedValue({ attempts: 1 })
  mocks.configureProfile.mockResolvedValue(undefined)
  mocks.verifyProfile.mockResolvedValue(undefined)
  mocks.chat.mockResolvedValue({
    conversationId: "review-conversation-1",
    finalResponse: JSON.stringify({ disposition: "approved", findings: [], blockedReasons: [] }),
    usage: { promptTokens: 100, completionTokens: 20 }
  })
})

afterEach(() => {
  vi.useRealTimers()
})

describe("materializeReviewResult", () => {
  it("assigns stable finding identity and trusted role metadata", () => {
    const run = baseRun()
    const cycle = baseCycle(run.runId)
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

describe("runReviewer", () => {
  it("fails fast when the run has no pull request number", async () => {
    const run = baseRun({ pullRequestNumber: null })

    await expect(runReviewer(reviewerOptions({ run }))).rejects.toThrow("A review run requires a pull request number")
    expect(mocks.createWorkspace).not.toHaveBeenCalled()
  })

  it.each([
    {
      name: "repository preparation timeout",
      result: { exitCode: null, output: "", timedOut: true }
    },
    {
      name: "repository preparation nonzero exit",
      result: { exitCode: 1, output: "fatal: checkout failed", timedOut: false }
    }
  ])("surfaces $name and still cleans up", async ({ result }) => {
    const { workspace, state } = fakeWorkspace({ commandById: { "prepare-review-repository": result } })
    mocks.createWorkspace.mockResolvedValue(workspace)

    await expect(runReviewer(reviewerOptions())).rejects.toThrow("Reviewer repository preparation failed")
    expect(state.commands[0]?.commandId).toBe("prepare-review-repository")
    expect(state.cleanupCalls).toEqual([{ mode: "delete", timeoutMs: 60_000 }])
  })

  it("uploads review context, protects it, and runs expected workspace commands", async () => {
    const artifactStore = fakeArtifactStore()
    const { workspace, state } = fakeWorkspace()
    mocks.createWorkspace.mockResolvedValue(workspace)

    const result = await runReviewer(reviewerOptions({ artifactStore }))

    expect(result.review.disposition).toBe("approved")
    expect(state.commands.map((command) => command.commandId)).toEqual([
      "prepare-review-repository",
      "prepare-review-context",
      "protect-review-context",
      "verify-review-workspace"
    ])
    expect(state.commands[0]?.command).toContain("remote set-url origin disabled://review-workspace")
    expect(state.commands[0]?.environment).toMatchObject({
      GIT_CONFIG_COUNT: "1",
      GIT_CONFIG_KEY_0: "http.https://github.com/.extraheader"
    })
    expect(state.commands[2]?.command).toBe("chmod -R a-w /workspace/review-context")
    expect(artifactStore.read).toHaveBeenCalledTimes(4)
    expect(artifactStore.read).toHaveBeenCalledWith("context/assignment.md")
    expect(artifactStore.read).toHaveBeenCalledWith("context/acceptance-criteria.json")
    expect(artifactStore.read).toHaveBeenCalledWith("context/validation-plan.json")
    expect(artifactStore.read).toHaveBeenCalledWith("context/path-policy.json")
    expect(state.uploads.map((upload) => upload.remotePath)).toEqual([
      "/workspace/review-context/assignment.md",
      "/workspace/review-context/acceptance-criteria.json",
      "/workspace/review-context/validation-plan.json",
      "/workspace/review-context/path-policy.json"
    ])
    expect(mocks.waitForReadiness).toHaveBeenCalledWith(
      expect.objectContaining({ url: "https://agent.example/health", maxAttempts: 30 })
    )
    expect(state.cleanupCalls).toEqual([{ mode: "delete", timeoutMs: 60_000 }])
  })

  it.each([
    {
      name: "approved disposition from plain JSON",
      response: JSON.stringify({ disposition: "approved", findings: [], blockedReasons: [] }),
      expectedDisposition: "approved",
      expectedFindings: 0,
      expectedBlocked: 0
    },
    {
      name: "changes requested from fenced JSON",
      response: [
        "```json",
        JSON.stringify({
          disposition: "changes_requested",
          findings: [
            {
              severity: "high",
              category: "correctness",
              locator: { path: "src/index.ts", line: 12, symbol: null },
              finding: "Condition is inverted.",
              evidence: "Focused test fails on true branch.",
              expectedBehavior: "True branch should pass.",
              actionable: true,
              confidence: 0.92
            }
          ],
          blockedReasons: []
        }),
        "```"
      ].join("\n"),
      expectedDisposition: "changes_requested",
      expectedFindings: 1,
      expectedBlocked: 0
    },
    {
      name: "blocked disposition from plain JSON",
      response: JSON.stringify({
        disposition: "blocked",
        findings: [],
        blockedReasons: [{ category: "dependency", message: "Required API contract missing." }]
      }),
      expectedDisposition: "blocked",
      expectedFindings: 0,
      expectedBlocked: 1
    }
  ])("parses and materializes $name", async ({ response, expectedDisposition, expectedFindings, expectedBlocked }) => {
    const { workspace } = fakeWorkspace()
    mocks.createWorkspace.mockResolvedValue(workspace)
    mocks.chat.mockResolvedValue({
      conversationId: "review-conversation-1",
      finalResponse: response,
      usage: { promptTokens: 80, completionTokens: 30 }
    })

    const result = await runReviewer(reviewerOptions())

    expect(result.review.disposition).toBe(expectedDisposition)
    expect(result.review.findings).toHaveLength(expectedFindings)
    expect(result.review.blockedReasons).toHaveLength(expectedBlocked)
    if (expectedBlocked > 0) {
      expect(result.review.blockedReasons[0]?.evidence[0]?.uri).toContain("/pull/42")
    }
  })

  it("fails when the reviewer modifies the candidate workspace and still cleans up", async () => {
    const { workspace, state } = fakeWorkspace({
      commandById: {
        "verify-review-workspace": { exitCode: 1, output: " M src/index.ts", timedOut: false }
      }
    })
    mocks.createWorkspace.mockResolvedValue(workspace)

    await expect(runReviewer(reviewerOptions())).rejects.toThrow("Reviewer modified the candidate workspace")
    expect(state.cleanupCalls).toEqual([{ mode: "delete", timeoutMs: 60_000 }])
  })

  it("falls back to current time when workspace metadata is missing createdAt", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-07-20T08:15:00.000Z"))

    const { workspace } = fakeWorkspace({ metadataCreatedAt: null })
    mocks.createWorkspace.mockResolvedValue(workspace)

    const result = await runReviewer(reviewerOptions())

    expect(result.createdAt.toISOString()).toBe("2026-07-20T08:15:00.000Z")
    expect(result.retentionUntil.toISOString()).toBe("2026-07-20T09:15:00.000Z")
    expect(result.expiresAt.toISOString()).toBe("2026-07-21T08:15:00.000Z")
  })

  it("always cleans up when context protection fails", async () => {
    const { workspace, state } = fakeWorkspace({
      commandById: {
        "protect-review-context": { exitCode: 1, output: "chmod failed", timedOut: false }
      }
    })
    mocks.createWorkspace.mockResolvedValue(workspace)

    await expect(runReviewer(reviewerOptions())).rejects.toThrow("Reviewer context protection failed")
    expect(state.cleanupCalls).toEqual([{ mode: "delete", timeoutMs: 60_000 }])
  })
})
