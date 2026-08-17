import { describe, expect, it, vi } from "vitest"
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL, OpenRouterEmbeddingClient } from "./openrouter-embeddings.js"

function successfulResponse(model = EMBEDDING_MODEL, dimensions = EMBEDDING_DIMENSIONS) {
  return new Response(
    JSON.stringify({
      data: [{ embedding: Array.from({ length: dimensions }, () => 0.5), index: 0 }],
      model,
      usage: { prompt_tokens: 3, total_tokens: 3 }
    }),
    { headers: { "Content-Type": "application/json" }, status: 200 }
  )
}

describe("OpenRouter embedding client", () => {
  it("pins model, dimensions, privacy routing, and validates the response", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(successfulResponse())
    const client = new OpenRouterEmbeddingClient({
      apiKey: "secret",
      baseUrl: new URL("https://openrouter.ai/api/v1"),
      fetch: fetchMock
    })

    await expect(client.embed(["legislative text"])).resolves.toMatchObject({
      embeddings: [expect.arrayContaining([0.5])],
      model: EMBEDDING_MODEL,
      totalTokens: 3
    })
    const request = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    expect(fetchMock.mock.calls[0]?.[0]).toEqual(new URL("https://openrouter.ai/api/v1/embeddings"))
    expect(request).toMatchObject({
      dimensions: 1536,
      model: EMBEDDING_MODEL,
      provider: { allow_fallbacks: false, data_collection: "deny" }
    })
  })

  it("retries transient failures and rejects model or dimension drift", async () => {
    const transientFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("busy", { status: 429 }))
      .mockResolvedValueOnce(successfulResponse())
    const client = new OpenRouterEmbeddingClient({ apiKey: "secret", fetch: transientFetch })
    await expect(client.embed(["retry"])).resolves.toMatchObject({ model: EMBEDDING_MODEL })
    expect(transientFetch).toHaveBeenCalledTimes(2)
    expect(client.metrics).toMatchObject({ created: 1, rateLimited: 1, requested: 1, retries: 1 })

    const wrongModel = new OpenRouterEmbeddingClient({
      apiKey: "secret",
      fetch: vi.fn<typeof fetch>().mockResolvedValue(successfulResponse("another/model"))
    })
    await expect(wrongModel.embed(["text"])).rejects.toThrow("unexpected model")

    const wrongDimensions = new OpenRouterEmbeddingClient({
      apiKey: "secret",
      fetch: vi.fn<typeof fetch>().mockResolvedValue(successfulResponse(EMBEDDING_MODEL, 3))
    })
    await expect(wrongDimensions.embed(["text"])).rejects.toThrow("1536-dimensional")
  })

  it("does not leak the API key in errors", async () => {
    const client = new OpenRouterEmbeddingClient({
      apiKey: "super-secret",
      fetch: vi.fn<typeof fetch>().mockResolvedValue(new Response("denied", { status: 401 }))
    })
    const rejection = await client.embed(["text"]).catch((error: unknown) => error)
    expect(String(rejection)).not.toContain("super-secret")
    expect(client.metrics.failed).toBe(1)
  })
})
