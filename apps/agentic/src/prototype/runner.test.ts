import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AssignmentSchema, type Assignment } from "../contracts/assignment"
import { OpenHandsError } from "../openhands/client"

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

import { runWorker } from "./runner"

const fixtureUrl = new URL("../../tests/fixtures/worker-repair-assignment.json", import.meta.url)
const changedPath = "apps/structured-data/app/domain/remediation-links.ts"
const temporaryRoots: string[] = []

type FakeWorkspaceState = {
  statusOutput: string
  validationExitCode: number | null
  validationTimedOut: boolean
  commandFailure: { commandId: string; exitCode: number | null; timedOut: boolean } | null
  cleanupMode: string | null
}

async function assignmentFixture(): Promise<Assignment> {
  return AssignmentSchema.parse(JSON.parse(await readFile(fixtureUrl, "utf8")))
}

function fakeWorkspace(state: FakeWorkspaceState) {
  const uploads: string[] = []
  const executeCommand = vi.fn(async (options: { commandId: string }) => {
    if (state.commandFailure?.commandId === options.commandId) {
      return {
        exitCode: state.commandFailure.exitCode,
        output: "command failed",
        timedOut: state.commandFailure.timedOut
      }
    }
    if (options.commandId === "git-status") {
      return { exitCode: 0, output: state.statusOutput, timedOut: false }
    }
    if (options.commandId === "git-head") {
      return { exitCode: 0, output: `${"a".repeat(40)}\n`, timedOut: false }
    }
    if (options.commandId === "remediation-links-test") {
      return {
        exitCode: state.validationExitCode,
        output: state.validationExitCode === 0 ? "tests passed" : "tests failed",
        timedOut: state.validationTimedOut
      }
    }
    return { exitCode: 0, output: "", timedOut: false }
  })
  return {
    executeCommand,
    upload: vi.fn(async (_content: Uint8Array, remotePath: string) => {
      uploads.push(remotePath)
    }),
    startBackgroundSession: vi.fn().mockResolvedValue("server-command-1"),
    signedPreview: vi.fn().mockResolvedValue({ url: "https://agent.example/", token: "preview-token" }),
    download: vi.fn().mockResolvedValue(Buffer.from("diff --git a/file b/file")),
    getBackgroundSessionResult: vi.fn().mockResolvedValue({
      exitCode: 1,
      stdout: "github-secret model-secret",
      stderr: "server failed with github-secret"
    }),
    cleanup: vi.fn(async (mode: string) => {
      state.cleanupMode = mode
    }),
    describe: vi.fn(() => ({
      workspaceId: "workspace-1",
      createdAt: "2026-07-19T00:00:00.000Z",
      lastActivityAt: "2026-07-19T00:01:00.000Z"
    })),
    uploads
  }
}

async function artifactRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "worker-runner-"))
  temporaryRoots.push(root)
  return root
}

function runOptions(assignment: Assignment, root: string) {
  return {
    assignment,
    approvedRepository: `${assignment.repository.owner}/${assignment.repository.name}`,
    workspaceSecretKey: "workspace-secret-key-for-focused-runner-tests",
    cleanupMode: "stop" as const,
    artifactRoot: root,
    secrets: { githubToken: "github-secret", modelProviderApiKey: "model-secret" }
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.waitForReadiness.mockResolvedValue({ attempts: 1 })
  mocks.configureProfile.mockResolvedValue(undefined)
  mocks.verifyProfile.mockResolvedValue(undefined)
  mocks.chat.mockResolvedValue({
    conversationId: "conversation-1",
    finalResponse: "STATUS: COMPLETED",
    usage: { promptTokens: 100, completionTokens: 20 }
  })
})

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe("runWorker", () => {
  it("returns a completed result with independent evidence and cleanup", async () => {
    const assignment = await assignmentFixture()
    const root = await artifactRoot()
    const state: FakeWorkspaceState = {
      statusOutput: ` M ${changedPath}\n`,
      validationExitCode: 0,
      validationTimedOut: false,
      commandFailure: null,
      cleanupMode: null
    }
    const workspace = fakeWorkspace(state)
    mocks.createWorkspace.mockResolvedValue(workspace)
    const progress = vi.fn()

    const result = await runWorker({ ...runOptions(assignment, root), onProgress: progress })

    expect(result).toMatchObject({
      status: "completed",
      conversationId: "conversation-1",
      resultingCommitSha: "a".repeat(40),
      changedFiles: [changedPath],
      patchArtifact: "git/patch.diff",
      failure: null,
      metrics: { promptTokens: 100, completionTokens: 20 }
    })
    expect(result.validationResults).toHaveLength(1)
    expect(result.artifacts.map((artifact) => artifact.relativePath)).toContain("agent/final-response.txt")
    expect(workspace.uploads).toHaveLength(5)
    expect(state.cleanupMode).toBe("stop")
    expect(progress).toHaveBeenCalledWith("Running independent validation")
  })

  it.each([
    {
      name: "path policy violation",
      statusOutput: " M package.json\n",
      validationExitCode: 0,
      validationTimedOut: false,
      finalResponse: "STATUS: COMPLETED",
      expectedStatus: "failed",
      classification: "policy_violation"
    },
    {
      name: "failed validation",
      statusOutput: ` M ${changedPath}\n`,
      validationExitCode: 1,
      validationTimedOut: false,
      finalResponse: "STATUS: COMPLETED",
      expectedStatus: "failed",
      classification: "validation"
    },
    {
      name: "timed out validation",
      statusOutput: ` M ${changedPath}\n`,
      validationExitCode: null,
      validationTimedOut: true,
      finalResponse: "STATUS: COMPLETED",
      expectedStatus: "failed",
      classification: "validation"
    },
    {
      name: "agent-reported blocker",
      statusOutput: "",
      validationExitCode: 0,
      validationTimedOut: false,
      finalResponse: "STATUS: BLOCKED waiting for product input",
      expectedStatus: "blocked",
      classification: "validation"
    }
  ])("classifies $name", async (scenario) => {
    const assignment = await assignmentFixture()
    const root = await artifactRoot()
    const state: FakeWorkspaceState = {
      statusOutput: scenario.statusOutput,
      validationExitCode: scenario.validationExitCode,
      validationTimedOut: scenario.validationTimedOut,
      commandFailure: null,
      cleanupMode: null
    }
    mocks.createWorkspace.mockResolvedValue(fakeWorkspace(state))
    mocks.chat.mockResolvedValue({
      conversationId: "conversation-1",
      finalResponse: scenario.finalResponse,
      usage: { promptTokens: null, completionTokens: null }
    })

    const result = await runWorker(runOptions(assignment, root))

    expect(result.status).toBe(scenario.expectedStatus)
    expect(result.failure?.classification).toBe(scenario.classification)
    expect(state.cleanupMode).toBe("stop")
  })

  it("rejects a repository outside the worker policy and still cleans up", async () => {
    const assignment = await assignmentFixture()
    const root = await artifactRoot()
    const state: FakeWorkspaceState = {
      statusOutput: "",
      validationExitCode: 0,
      validationTimedOut: false,
      commandFailure: null,
      cleanupMode: null
    }
    mocks.createWorkspace.mockResolvedValue(fakeWorkspace(state))

    const result = await runWorker({
      ...runOptions(assignment, root),
      assignment: { ...assignment, repository: { ...assignment.repository, name: "other-repository" } }
    })

    expect(result).toMatchObject({ status: "failed", failure: { classification: "internal" } })
    expect(result.failure?.message).toContain("outside the worker allowlist")
    expect(state.cleanupMode).toBe("stop")
  })

  it("classifies command timeouts and captures redacted server diagnostics", async () => {
    const assignment = await assignmentFixture()
    const root = await artifactRoot()
    const state: FakeWorkspaceState = {
      statusOutput: "",
      validationExitCode: 0,
      validationTimedOut: false,
      commandFailure: { commandId: "git-status", exitCode: null, timedOut: true },
      cleanupMode: null
    }
    mocks.createWorkspace.mockResolvedValue(fakeWorkspace(state))

    const result = await runWorker(runOptions(assignment, root))

    expect(result).toMatchObject({ status: "failed", failure: { classification: "internal" } })
    expect(result.failure?.message).toContain("command timed out")
    expect(await readFile(join(root, "agent", "server.stdout.log"), "utf8")).toBe("[REDACTED] [REDACTED]")
    expect(await readFile(join(root, "agent", "server.stderr.log"), "utf8")).toBe("server failed with [REDACTED]")
  })

  it("maps OpenHands startup failures and preserves the original error when diagnostics fail", async () => {
    const assignment = await assignmentFixture()
    const root = await artifactRoot()
    const state: FakeWorkspaceState = {
      statusOutput: "",
      validationExitCode: 0,
      validationTimedOut: false,
      commandFailure: null,
      cleanupMode: null
    }
    const workspace = fakeWorkspace(state)
    workspace.getBackgroundSessionResult.mockRejectedValue(new Error("diagnostics unavailable"))
    mocks.createWorkspace.mockResolvedValue(workspace)
    mocks.chat.mockRejectedValue(new OpenHandsError("startup", "agent server exited", { retryable: true }))

    const result = await runWorker(runOptions(assignment, root))

    expect(result).toMatchObject({
      status: "failed",
      failure: { classification: "agent_server_startup", message: "agent server exited", retryable: true }
    })
    expect(state.cleanupMode).toBe("stop")
  })

  it("stops before workspace creation when already cancelled", async () => {
    const assignment = await assignmentFixture()
    const root = await artifactRoot()
    const controller = new AbortController()
    controller.abort()

    await expect(runWorker({ ...runOptions(assignment, root), signal: controller.signal })).rejects.toMatchObject({
      name: "AbortError"
    })
    expect(mocks.createWorkspace).not.toHaveBeenCalled()
  })
})
