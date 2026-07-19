import { beforeEach, describe, expect, it, vi } from "vitest"
import { LinearCandidateListSchema } from "../contracts/linear"

const openai = vi.hoisted(() => ({ construct: vi.fn(), parse: vi.fn() }))

vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = { completions: { parse: openai.parse } }

    constructor(options: unknown) {
      openai.construct(options)
    }
  }
}))

import { ScrumMasterPlanner } from "./scrumMasterPlanner"

const runId = "dff7a1a0-2c52-4e3f-a325-90d314f81820"
const candidate = {
  schemaVersion: "1" as const,
  source: "linear" as const,
  id: "5ee37578-285f-4cf2-a737-a2f56fe1466b",
  identifier: "FEN-421",
  title: "Add focused tests",
  description: "Add unit tests for the profile helper.",
  url: "https://linear.app/example/FEN-421",
  priority: 4,
  state: { id: "ff47e33a-743c-43a8-b5d6-d9c525b2e498", name: "Todo", type: "unstarted" as const },
  team: { id: "b9c888b8-e2d4-4694-8820-065e4c65cdcb", key: "FEN", name: "Fencing Club" }
}

const validDraft = {
  selectedWorkItemId: candidate.id,
  disposition: "ready" as const,
  objective: "Add focused profile helper tests.",
  acceptanceCriteria: ["The focused tests pass."],
  relevantPaths: ["apps/agentic/src/openhands/profiles.ts"],
  validationCommands: [
    {
      id: "profile-tests",
      command: "pnpm test",
      workingDirectory: ".",
      timeoutMs: 300_000
    }
  ],
  pathPolicy: { allowed: ["apps/agentic/src/openhands/profiles.test.ts"], forbidden: [".git/**"] },
  risks: [],
  dependencies: [],
  blockers: [],
  taskClass: "small" as const
}

function invocation() {
  return {
    request: {
      schemaVersion: "1" as const,
      runId,
      team: candidate.team.id,
      repository: { provider: "github" as const, owner: "AndrewCraswell", name: "agency" }
    },
    candidates: LinearCandidateListSchema.parse({
      schemaVersion: "1",
      fetchedAt: "2026-07-19T12:00:00.000Z",
      team: candidate.team,
      issues: [candidate]
    }),
    baseCommitSha: "8c185e6bb5214b2dd27552cd5d7e7ad0349a4cf1",
    prompt: {
      schemaVersion: "1" as const,
      role: "scrum_master" as const,
      version: "v1",
      sha256: "b".repeat(64),
      content: "Return a bounded plan."
    },
    signal: new AbortController().signal
  }
}

function parseDraft(request: unknown, draft: unknown) {
  const responseFormat = (request as { response_format: { $parseRaw(content: string): unknown } }).response_format
  return responseFormat.$parseRaw(JSON.stringify(draft))
}

describe("OpenRouter scrum-master completion", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("parses a structured draft and preserves provider usage", async () => {
    openai.parse.mockImplementation(async (request: unknown, options: unknown) => ({
      choices: [{ message: { parsed: parseDraft(request, validDraft) } }],
      usage: { prompt_tokens: 321, completion_tokens: 123 },
      options
    }))
    const planner = new ScrumMasterPlanner(
      { apiKey: "test-key" },
      {
        now: () => new Date("2026-07-19T12:00:00.000Z"),
        roleExecutionId: () => "af32fd7f-c98c-4a31-88ca-acfb99654c69"
      }
    )
    const input = invocation()

    await expect(planner.plan(input)).resolves.toMatchObject({
      output: {
        disposition: "ready",
        roleAttempt: {
          modelProfile: { model: "openai/gpt-5.6" },
          budget: { inputTokens: 321, outputTokens: 123 }
        }
      }
    })
    expect(openai.construct).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: "test-key", baseURL: "https://openrouter.ai/api/v1", maxRetries: 1 })
    )
    expect(openai.parse).toHaveBeenCalledWith(
      expect.objectContaining({ model: "openai/gpt-5.6", max_completion_tokens: 4_000 }),
      { signal: input.signal }
    )
  })

  it.each([
    ["ready plan with blockers", { ...validDraft, blockers: [{ category: "ambiguity", message: "Blocked" }] }],
    ["blocked plan without blockers", { ...validDraft, disposition: "blocked" }]
  ])("rejects a %s", async (_name, draft) => {
    openai.parse.mockImplementation(async (request: unknown) => ({
      choices: [{ message: { parsed: parseDraft(request, draft) } }]
    }))

    await expect(new ScrumMasterPlanner({ apiKey: "test-key" }).plan(invocation())).rejects.toThrow()
  })

  it("rejects an empty structured response", async () => {
    openai.parse.mockResolvedValue({ choices: [{ message: { parsed: null } }] })

    await expect(new ScrumMasterPlanner({ apiKey: "test-key" }).plan(invocation())).rejects.toThrow(
      "returned no structured planning draft"
    )
  })
})
