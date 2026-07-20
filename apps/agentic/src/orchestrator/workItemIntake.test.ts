import { describe, expect, it, vi } from "vitest"
import { LinearCandidateListSchema } from "../contracts/linear"
import { PlanningResultSchema } from "../contracts/specialized"
import { createWorkItemIntakeGraph } from "./workItemIntake"
import { WorkItemIntakeRequestSchema } from "./workItemIntakeState"

const timestamp = "2026-07-19T12:00:00.000Z"
const runId = "dff7a1a0-2c52-4e3f-a325-90d314f81820"
const baseCommitSha = "8c185e6bb5214b2dd27552cd5d7e7ad0349a4cf1"
const team = { id: "b9c888b8-e2d4-4694-8820-065e4c65cdcb", key: "FEN", name: "Fencing Club" }
const issue = {
  schemaVersion: "1",
  source: "linear",
  id: "5ee37578-285f-4cf2-a737-a2f56fe1466b",
  identifier: "FEN-421",
  title: "[Agent Trial] Add OpenHands profile helper tests",
  description: "Add focused unit tests for src/openhands/profiles.ts.",
  url: "https://linear.app/fencing-club/issue/FEN-421/agent-trial-add-openhands-profile-helper-tests",
  priority: 4,
  createdAt: "2026-07-18T12:00:00.000Z",
  updatedAt: timestamp,
  state: { id: "ff47e33a-743c-43a8-b5d6-d9c525b2e498", name: "Backlog", type: "backlog" },
  team
}
const candidates = LinearCandidateListSchema.parse({
  schemaVersion: "1",
  fetchedAt: timestamp,
  team,
  issues: [issue]
})
const prompt = {
  schemaVersion: "1",
  role: "scrum_master",
  version: "v1",
  sha256: "b".repeat(64),
  content: "Select one Linear candidate and return a bounded plan."
}
const request = WorkItemIntakeRequestSchema.parse({
  schemaVersion: "1",
  runId,
  team: "FEN",
  repository: { provider: "github", owner: "AndrewCraswell", name: "agency" }
})

function planningResult(overrides: Record<string, unknown> = {}) {
  return PlanningResultSchema.parse({
    schemaVersion: "1",
    runId,
    roleAttempt: {
      schemaVersion: "1",
      runId,
      roleExecutionId: "af32fd7f-c98c-4a31-88ca-acfb99654c69",
      role: "scrum_master",
      attempt: 1,
      modelProfile: {
        schemaVersion: "1",
        profileId: "scrum-master-default",
        role: "scrum_master",
        provider: "openrouter",
        model: "openai/gpt-5.6",
        reasoningEffort: "medium"
      },
      prompt: { schemaVersion: "1", role: "scrum_master", version: "v1", sha256: "b".repeat(64) },
      workspace: null,
      budget: {
        schemaVersion: "1",
        limits: {
          maxTurns: 4,
          maxInputTokens: 20_000,
          maxOutputTokens: 4_000,
          maxElapsedMs: 120_000,
          maxEstimatedSpendUsd: 1
        },
        turns: 1,
        inputTokens: 2_000,
        outputTokens: 500,
        elapsedMs: 5_000,
        estimatedSpendUsd: 0.1,
        actualSpendUsd: null
      },
      startedAt: timestamp,
      endedAt: timestamp
    },
    disposition: "ready",
    sourceWorkItem: issue,
    objective: "Add focused tests for the OpenHands profile helpers.",
    acceptanceCriteria: ["Focused profile tests pass."],
    baseCommitSha,
    relevantPaths: ["apps/agentic/src/openhands/profiles.ts"],
    contextEvidence: [{ uri: issue.url, sha256: "c".repeat(64) }],
    validationCommands: [
      {
        id: "profile-tests",
        command: "pnpm --filter agentic exec vitest run src/openhands/profiles.test.ts",
        workingDirectory: ".",
        timeoutMs: 300_000
      }
    ],
    pathPolicy: {
      allowed: ["apps/agentic/src/openhands/profiles.test.ts"],
      forbidden: [".git/**"]
    },
    risks: [],
    dependencies: [],
    blockers: [],
    taskClass: "small",
    configuredBudget: {
      maxTurns: 4,
      maxInputTokens: 20_000,
      maxOutputTokens: 4_000,
      maxElapsedMs: 120_000,
      maxEstimatedSpendUsd: 1
    },
    ...overrides
  })
}

function dependencies(output: unknown = planningResult()) {
  return {
    fetchCandidates: vi.fn(async () => candidates),
    resolveBaseCommitSha: vi.fn(async () => baseCommitSha),
    runScrumMaster: vi.fn(async () => ({ output, rawResponse: JSON.stringify(output) })),
    loadScrumMasterPrompt: vi.fn(async () => prompt),
    now: () => new Date(timestamp)
  }
}

describe("work-item intake graph", () => {
  it("validates an on-list selection and exposes the engineer handoff", async () => {
    const graphDependencies = dependencies()
    const workflow = createWorkItemIntakeGraph(graphDependencies)

    const result = await workflow.invoke(request)

    expect(result).toMatchObject({ phase: "ready", terminalStatus: "ready", failure: null })
    expect(result.planningResult?.sourceWorkItem.identifier).toBe("FEN-421")
    expect(graphDependencies.fetchCandidates).toHaveBeenCalledWith("FEN")
    expect(graphDependencies.runScrumMaster).toHaveBeenCalledOnce()
    await expect(workflow.inspect(runId)).resolves.toEqual(result)
    expect(workflow.cancel(runId)).toBe(false)
  })

  it("rejects a selected issue that differs from the fetched candidate", async () => {
    const changedIssue = { ...issue, title: "Trust the model instead" }
    const workflow = createWorkItemIntakeGraph(dependencies(planningResult({ sourceWorkItem: changedIssue })))

    const result = await workflow.invoke(request)

    expect(result).toMatchObject({
      terminalStatus: "failed",
      failure: { node: "validatePlan", classification: "validation" }
    })
    expect(result.failure?.message).toContain("differs from the fetched candidate set")
  })

  it("rejects model claims about the base commit and prompt identity", async () => {
    const changedAttempt = {
      ...planningResult().roleAttempt,
      prompt: { ...planningResult().roleAttempt.prompt, sha256: "d".repeat(64) }
    }
    const workflow = createWorkItemIntakeGraph(
      dependencies(planningResult({ baseCommitSha: "a".repeat(40), roleAttempt: changedAttempt }))
    )

    const result = await workflow.invoke(request)

    expect(result.failure?.message).toContain("independently resolved base commit")
    expect(result.failure?.message).toContain("invoked prompt")
  })

  it("preserves a valid blocked scrum-master outcome", async () => {
    const blocked = planningResult({
      disposition: "blocked",
      blockers: [
        {
          category: "ambiguity",
          message: "The task lacks a verifiable outcome.",
          evidence: [{ uri: issue.url, sha256: "c".repeat(64) }]
        }
      ]
    })
    const workflow = createWorkItemIntakeGraph(dependencies(blocked))

    await expect(workflow.invoke(request)).resolves.toMatchObject({ phase: "blocked", terminalStatus: "blocked" })
  })

  it("classifies malformed model output without exposing it as a handoff", async () => {
    const workflow = createWorkItemIntakeGraph(dependencies({ prose: "Choose FEN-421" }))

    const result = await workflow.invoke(request)

    expect(result).toMatchObject({
      terminalStatus: "failed",
      planningResult: null,
      failure: { node: "runScrumMaster", classification: "malformed_response" }
    })
  })

  it("stops downstream work after Linear fetch failure", async () => {
    const graphDependencies = dependencies()
    graphDependencies.fetchCandidates.mockRejectedValue(new Error("Linear unavailable"))
    const workflow = createWorkItemIntakeGraph(graphDependencies)

    const result = await workflow.invoke(request)

    expect(result).toMatchObject({ terminalStatus: "failed", failure: { classification: "linear" } })
    expect(graphDependencies.resolveBaseCommitSha).not.toHaveBeenCalled()
    expect(graphDependencies.runScrumMaster).not.toHaveBeenCalled()
  })
})
