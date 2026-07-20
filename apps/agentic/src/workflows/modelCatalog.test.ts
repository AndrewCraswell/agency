import { describe, expect, it, vi } from "vitest"
import { OpenRouterModelCatalog } from "./modelCatalog"

const observedAt = new Date("2026-07-19T12:00:00.000Z")

describe("OpenRouterModelCatalog", () => {
  it("normalizes and sorts bounded provider model observations", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            data: [
              {
                id: "openai/gpt-z",
                name: "GPT Z",
                context_length: 200_000,
                pricing: { prompt: "0.000001", completion: "0.000002", image: "0" },
                architecture: { input_modalities: ["text"], output_modalities: ["text"], tokenizer: "Other" },
                supported_parameters: ["temperature", "response_format", "unknown_parameter"]
              },
              {
                id: "anthropic/claude-a",
                name: "Claude A",
                context_length: 100_000,
                pricing: { prompt: "0.000003", completion: "0.000004" },
                architecture: { input_modalities: ["text"], output_modalities: ["text"] },
                supported_parameters: ["max_tokens"]
              }
            ]
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
    )
    const catalog = new OpenRouterModelCatalog({ apiKey: "secret", fetcher, now: () => observedAt })

    await expect(catalog.list()).resolves.toEqual([
      expect.objectContaining({ modelId: "anthropic/claude-a", observedAt: observedAt.toISOString() }),
      expect.objectContaining({ modelId: "openai/gpt-z", supportedParameters: ["temperature", "response_format"] })
    ])
    expect(fetcher).toHaveBeenCalledWith("https://openrouter.ai/api/v1/models", {
      headers: { Authorization: "Bearer secret" }
    })
  })

  it("rejects missing models and provider failures", async () => {
    const missing = new OpenRouterModelCatalog({
      apiKey: "secret",
      fetcher: async () => new Response(JSON.stringify({ data: [] }), { status: 200 })
    })
    await expect(missing.resolve("openai/missing")).rejects.toThrow("is unavailable")

    const failed = new OpenRouterModelCatalog({
      apiKey: "secret",
      fetcher: async () => new Response(null, { status: 503 })
    })
    await expect(failed.list()).rejects.toThrow("status 503")
  })
})
