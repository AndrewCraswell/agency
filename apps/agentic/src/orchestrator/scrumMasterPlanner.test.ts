import { describe, expect, it, vi } from "vitest"
import { LinearCandidateListSchema } from "../contracts/linear"
import { ScrumMasterPlanner } from "./scrumMasterPlanner"
import type { ScrumMasterInvocationInput } from "./workItemIntake"

const runId = "dff7a1a0-2c52-4e3f-a325-90d314f81820"
const baseCommitSha = "8c185e6bb5214b2dd27552cd5d7e7ad0349a4cf1"
const timestamp = "2026-07-19T12:00:00.000Z"
const candidate = {
  schemaVersion: "1" as const,
  source: "linear" as const,
  id: "5ee37578-285f-4cf2-a737-a2f56fe1466b",
  identifier: "FEN-421",
  title: "Add focused tests",
  description: "Add unit tests for the profile helper.",
  url: "https://linear.app/example/issue/FEN-421",
  priority: 4,
  state: { id: "ff47e33a-743c-43a8-b5d6-d9c525b2e498", name: "Todo", type: "unstarted" as const },
  team: { id: "b9c888b8-e2d4-4694-8820-065e4c65cdcb", key: "FEN", name: "Fencing Club" }
}

function invocation(): ScrumMasterInvocationInput {
  return {
    request: {
      schemaVersion: "1",
      runId,
      team: "FEN",
      repository: { provider: "github", owner: "AndrewCraswell", name: "agency" }
    },
    candidates: LinearCandidateListSchema.parse({
      schemaVersion: "1",
      fetchedAt: timestamp,
      team: candidate.team,
      issues: [candidate]
    }),
    baseCommitSha,
    prompt: {
      schemaVersion: "1",
      role: "scrum_master",
      version: "v1",
      sha256: "b".repeat(64),
      content: "Return a bounded plan."
    },
    signal: new AbortController().signal
  }
}

describe("ScrumMasterPlanner", () => {
  it("wraps a structured draft with trusted run, issue, SHA, prompt, and budget metadata", async () => {
    const completion = {
      complete: vi.fn(async () => ({
        draft: {
          selectedWorkItemId: candidate.id,
          disposition: "ready" as const,
          objective: "Add focused profile helper tests.",
          acceptanceCriteria: ["The focused tests pass."],
          relevantPaths: ["apps/agentic/src/openhands/profiles.ts"],
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
          taskClass: "small" as const
        },
        promptTokens: 200,
        completionTokens: 100
      }))
    }
    const planner = new ScrumMasterPlanner(
      { apiKey: "test-key", model: "openai/test-model" },
      {
        completion,
        now: () => new Date(timestamp),
        roleExecutionId: () => "af32fd7f-c98c-4a31-88ca-acfb99654c69"
      }
    )

    const result = await planner.plan(invocation())

    expect(result.output).toMatchObject({
      runId,
      sourceWorkItem: candidate,
      baseCommitSha,
      roleAttempt: {
        roleExecutionId: "af32fd7f-c98c-4a31-88ca-acfb99654c69",
        modelProfile: { model: "openai/test-model" },
        prompt: { sha256: "b".repeat(64) },
        budget: { inputTokens: 200, outputTokens: 100 }
      }
    })
    expect(completion.complete).toHaveBeenCalledWith(
      expect.objectContaining({ runId, baseCommitSha, candidates: [candidate] })
    )
  })

  it("selects one task from multiple dependency-ready candidates", async () => {
    const secondCandidate = {
      ...candidate,
      id: "96ab4b51-9e71-4a0d-b0ca-4c10b6e10e57",
      identifier: "FEN-422",
      title: "Add runtime tests"
    }
    const completion = {
      complete: vi.fn(async () => ({
        draft: {
          selectedWorkItemId: secondCandidate.id,
          disposition: "ready" as const,
          objective: "Add runtime tests.",
          acceptanceCriteria: ["Runtime tests pass."],
          relevantPaths: [],
          validationCommands: [{ id: "tests", command: "pnpm test", workingDirectory: ".", timeoutMs: 300_000 }],
          pathPolicy: { allowed: ["apps/agentic/**"], forbidden: [".git/**"] },
          risks: [],
          dependencies: [],
          blockers: [],
          taskClass: "small" as const
        },
        promptTokens: 200,
        completionTokens: 100
      }))
    }
    const planner = new ScrumMasterPlanner({ apiKey: "test-key" }, { completion })
    const input = invocation()
    input.candidates = { ...input.candidates, issues: [candidate, secondCandidate] }

    await expect(planner.plan(input)).resolves.toMatchObject({ output: { sourceWorkItem: secondCandidate } })
  })

  it("rejects a selection outside the candidate set", async () => {
    const completion = {
      complete: vi.fn(async () => ({
        draft: {
          selectedWorkItemId: "96ab4b51-9e71-4a0d-b0ca-4c10b6e10e57",
          disposition: "blocked" as const,
          objective: "No bounded task.",
          acceptanceCriteria: ["A task is selected."],
          relevantPaths: [],
          validationCommands: [{ id: "tests", command: "pnpm test", workingDirectory: ".", timeoutMs: 300_000 }],
          pathPolicy: { allowed: ["apps/agentic/**"], forbidden: [".git/**"] },
          risks: [],
          dependencies: [],
          blockers: [{ category: "ambiguity" as const, message: "No candidate is bounded." }],
          taskClass: "small" as const
        },
        promptTokens: 200,
        completionTokens: 100
      }))
    }
    const planner = new ScrumMasterPlanner({ apiKey: "test-key" }, { completion })

    await expect(planner.plan(invocation())).rejects.toThrow("outside the candidate set")
  })

  it("requires at least one dependency-ready candidate", async () => {
    const completion = { complete: vi.fn() }
    const planner = new ScrumMasterPlanner({ apiKey: "test-key" }, { completion })
    const input = invocation()
    input.candidates = { ...input.candidates, issues: [] }

    await expect(planner.plan(input)).rejects.toThrow("at least one dependency-ready candidate")
    expect(completion.complete).not.toHaveBeenCalled()
  })
})
