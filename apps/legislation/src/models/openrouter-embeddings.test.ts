import { describe, expect, it, vi } from "vitest"
import { EMBEDDING_ROUTES } from "./embedding-routing.js"
import {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  MAX_EMBEDDING_INPUT_CHARACTERS,
  OpenRouterEmbeddingClient
} from "./openrouter-embeddings.js"

function successfulResponse(model: string = EMBEDDING_MODEL, dimensions: number = EMBEDDING_DIMENSIONS) {
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

  it("caps inputs below the provider token ceiling", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(successfulResponse())
    const client = new OpenRouterEmbeddingClient({ apiKey: "secret", fetch: fetchMock })

    await client.embed(["A".repeat(MAX_EMBEDDING_INPUT_CHARACTERS + 1_000)])

    const request = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    expect(request.input[0]).toHaveLength(MAX_EMBEDDING_INPUT_CHARACTERS)
  })

  it("uses the canonical Voyage model space and input roles", async () => {
    const voyage = EMBEDDING_ROUTES.bill
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(successfulResponse("voyage-4", voyage.dimensions))
      .mockResolvedValueOnce(successfulResponse("voyage-4", voyage.dimensions))
    const client = new OpenRouterEmbeddingClient({ apiKey: "secret", fetch: fetchMock, route: voyage })

    await expect(client.embed(["bill text"])).resolves.toMatchObject({ model: voyage.model })
    await expect(client.embed(["bill query"], "query")).resolves.toMatchObject({ model: voyage.model })

    const documentRequest = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    const queryRequest = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))
    expect(documentRequest).toMatchObject({ input_type: "document", model: voyage.model })
    expect(documentRequest).not.toHaveProperty("dimensions")
    expect(queryRequest).toMatchObject({ input_type: "query", model: voyage.model })
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

    const unqualifiedProviderModel = new OpenRouterEmbeddingClient({
      apiKey: "secret",
      fetch: vi.fn<typeof fetch>().mockResolvedValue(successfulResponse("text-embedding-3-small"))
    })
    await expect(unqualifiedProviderModel.embed(["text"])).resolves.toMatchObject({ model: EMBEDDING_MODEL })

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
    expect(String(rejection)).toContain("denied")
    expect(client.metrics.failed).toBe(1)
  })
})
