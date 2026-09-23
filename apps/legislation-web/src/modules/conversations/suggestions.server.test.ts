import type { generateText } from "ai"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { researchSuggestionsSchema } from "./suggestions"

const mocks = vi.hoisted(() => ({
  generate:
    vi.fn<
      (
        options: Parameters<typeof generateText>[0]
      ) => Promise<{ output: unknown; totalUsage: { inputTokens: number; outputTokens: number } }>
    >(),
  report: vi.fn<(...args: unknown[]) => void>(),
  update: vi.fn<(attributes: Record<string, unknown>) => void>()
}))

vi.mock("ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("ai")>()),
  generateText: mocks.generate
}))
vi.mock("@sentry/nextjs", () => ({ captureException: mocks.report }))
vi.mock("@langfuse/tracing", () => ({
  startActiveObservation: <Value>(
    _name: string,
    operation: (observation: { update: typeof mocks.update }) => Promise<Value>
  ) => operation({ update: mocks.update })
}))
vi.mock("./agent", () => ({ researchModelId: "openai/gpt-6-luna", createResearchModel: () => "test-luna" }))

const prompt = {
  name: "legislative-research-suggestions",
  type: "text",
  version: 1,
  labels: ["production"],
  prompt: "Generate varied, neutral research ideas for {{current_date}}."
}
const output = researchSuggestionsSchema.parse({
  suggestions: [
    {
      text: "Who sponsors state bills on home insurance costs?",
      description: "Explore sponsors and their proposals",
      kind: "sponsors"
    },
    {
      text: "What actions are recorded on federal grid connection bills?",
      description: "Review recorded actions and dates",
      kind: "actions"
    },
    {
      text: "How do state bills address repair access for farm equipment?",
      description: "Compare repair access proposals",
      kind: "comparison"
    },
    {
      text: "Which committees have held hearings on prescription drug costs?",
      description: "Find hearing records and published materials",
      kind: "hearings"
    },
    {
      text: "How do states define high-risk artificial intelligence?",
      description: "Compare definitions in filed bills",
      kind: "comparison"
    },
    {
      text: "What votes are recorded on housing proposals?",
      description: "Review recorded legislative decisions",
      kind: "actions"
    }
  ]
})
const generated = { output, totalUsage: { inputTokens: 300, outputTokens: 200 } }

beforeEach(async () => {
  vi.resetModules()
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date("2026-09-16T12:00:00Z"))
  vi.stubEnv("OPENROUTER_API_KEY", "test-model-key")
  vi.stubEnv("LANGFUSE_PUBLIC_KEY", "test-public")
  vi.stubEnv("LANGFUSE_SECRET_KEY", "test-secret")
  vi.stubEnv("LANGFUSE_BASE_URL", "https://us.cloud.langfuse.com")
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>().mockImplementation(async () => Response.json(prompt))
  )
  mocks.generate.mockReset().mockResolvedValue(generated)
  await import("./suggestions.server")
}, 60000)

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

it("uses the production Langfuse prompt, current date and Luna with structured output", async () => {
  const { getResearchSuggestions } = await import("./suggestions.server")
  await expect(getResearchSuggestions()).resolves.toEqual(output.suggestions)
  expect(fetch).toHaveBeenCalledWith(
    new URL("https://us.cloud.langfuse.com/api/public/v2/prompts/legislative-research-suggestions?label=production"),
    expect.objectContaining({ cache: "no-store", redirect: "error", signal: expect.any(AbortSignal) })
  )
  expect(mocks.generate).toHaveBeenCalledWith(
    expect.objectContaining({
      model: "test-luna",
      instructions: "Generate varied, neutral research ideas for 2026-09-16.",
      prompt: "Generate exactly six fresh, distinct research ideas covering all four research approaches.",
      maxRetries: 0,
      maxOutputTokens: 2000,
      abortSignal: expect.any(AbortSignal)
    })
  )
  expect(mocks.update).toHaveBeenCalledWith(
    expect.objectContaining({
      model: "openai/gpt-6-luna",
      prompt: { name: prompt.name, version: 1, isFallback: false }
    })
  )
  expect(mocks.update).toHaveBeenCalledWith({ output: output.suggestions, usageDetails: { input: 300, output: 200 } })
})

it("generates independently for concurrent requests and never reuses a completed result", async () => {
  const pending = Promise.withResolvers<typeof generated>()
  mocks.generate.mockReturnValueOnce(pending.promise)
  const { getResearchSuggestions } = await import("./suggestions.server")
  const first = getResearchSuggestions()
  const second = getResearchSuggestions()
  expect(second).not.toBe(first)
  await expect(second).resolves.toEqual(output.suggestions)
  expect(mocks.generate).toHaveBeenCalledTimes(2)
  pending.resolve(generated)
  await first
  await expect(getResearchSuggestions()).resolves.toEqual(output.suggestions)
  expect(mocks.generate).toHaveBeenCalledTimes(3)
  expect(fetch).toHaveBeenCalledTimes(3)
})

it("returns no hardcoded fallback and does not cache a failed generation", async () => {
  mocks.generate.mockRejectedValueOnce(new Error("Provider unavailable"))
  const { getResearchSuggestions } = await import("./suggestions.server")
  await expect(getResearchSuggestions()).resolves.toEqual([])
  await expect(getResearchSuggestions()).resolves.toEqual(output.suggestions)
  expect(mocks.generate).toHaveBeenCalledTimes(2)
  expect(mocks.report).toHaveBeenCalledTimes(1)
})

it.each([
  { ...prompt, name: "legislative-research" },
  { ...prompt, labels: ["latest"] },
  { ...prompt, type: "chat" },
  { ...prompt, prompt: "Use {{private_context}}" }
])("rejects the wrong managed prompt or unsupported template: %j", async (body) => {
  vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(Response.json(body)))
  const { getResearchSuggestions } = await import("./suggestions.server")
  await expect(getResearchSuggestions()).resolves.toEqual([])
  expect(mocks.generate).not.toHaveBeenCalled()
})

it("does not generate when prompt retrieval fails or credentials are absent", async () => {
  vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 503 })))
  const { getResearchSuggestions } = await import("./suggestions.server")
  await expect(getResearchSuggestions()).resolves.toEqual([])
  vi.stubEnv("OPENROUTER_API_KEY", "")
  await expect(getResearchSuggestions()).resolves.toEqual([])
  expect(mocks.generate).not.toHaveBeenCalled()
  expect(fetch).toHaveBeenCalledTimes(1)
})

it.each([
  { suggestions: output.suggestions.slice(0, 4) },
  { suggestions: output.suggestions.slice(0, 5) },
  { suggestions: [...output.suggestions, output.suggestions[0]] },
  { suggestions: Array.from({ length: 6 }, () => output.suggestions[0]) },
  { suggestions: output.suggestions.map((item) => ({ ...item, kind: "comparison" })) },
  { suggestions: output.suggestions.map((item) => ({ ...item, text: "x".repeat(111) })) },
  { suggestions: output.suggestions.map((item) => ({ ...item, kind: "custom-script" })) },
  { suggestions: output.suggestions.map((item) => ({ ...item, description: "Topics \u00b7 policy" })) }
])("rejects invalid generated suggestions: %j", async (invalid) => {
  mocks.generate.mockResolvedValue({ ...generated, output: invalid })
  const { getResearchSuggestions } = await import("./suggestions.server")
  await expect(getResearchSuggestions()).resolves.toEqual([])
})
