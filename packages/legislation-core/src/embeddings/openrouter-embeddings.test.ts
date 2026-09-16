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
  it.each(["headers", "body"])("retries a deadline during %s with unchanged input", async (phase) => {
    const timeout = new DOMException("deadline", "TimeoutError")
    const timedResponse = successfulResponse()
    vi.spyOn(timedResponse, "text").mockRejectedValue(timeout)
    const fetchMock = vi.fn<typeof fetch>()
    if (phase === "headers") {
      fetchMock.mockRejectedValueOnce(timeout)
    } else {
      fetchMock.mockResolvedValueOnce(timedResponse)
    }
    fetchMock.mockResolvedValueOnce(successfulResponse())
    const client = new OpenRouterEmbeddingClient({ apiKey: "fixture", fetch: fetchMock })
    await expect(client.embed(["exact text"])).resolves.toMatchObject({ model: EMBEDDING_MODEL })
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(fetchMock.mock.calls[1]?.[1]?.body)
    expect(client.metrics).toMatchObject({ retries: 1, created: 1, failed: 0 })
  })

  it("bounds timeout retries and does not retry other exceptions", async () => {
    const timeout = new DOMException("deadline", "TimeoutError")
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(timeout)
    const client = new OpenRouterEmbeddingClient({ apiKey: "fixture", fetch: fetchMock, maximumAttempts: 2 })
    await expect(client.embed(["text"])).rejects.toBe(timeout)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(client.metrics).toMatchObject({ retries: 1, failed: 1, created: 0 })
    const abort = new DOMException("cancelled", "AbortError")
    fetchMock.mockReset().mockRejectedValue(abort)
    const cancelled = new OpenRouterEmbeddingClient({ apiKey: "fixture", fetch: fetchMock })
    await expect(cancelled.embed(["text"])).rejects.toBe(abort)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("rejects token-dense text before HTTP even when its character count fits", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>()
    const client = new OpenRouterEmbeddingClient({ apiKey: "fixture", fetch })
    await expect(client.embed(["🧭".repeat(3000)])).rejects.toThrow("embedding_input_token_limit")
    expect(fetch).not.toHaveBeenCalled()
  })
  it.each([
    [0, 0],
    [1, 2]
  ])("rejects response index corruption %j even with the correct vector count", async (...indices) => {
    const client = new OpenRouterEmbeddingClient({
      apiKey: "fixture",
      fetch: async () =>
        Response.json({
          model: EMBEDDING_MODEL,
          data: indices.map((index) => ({ index, embedding: Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0.5) }))
        })
    })
    await expect(client.embed(["first", "second"])).rejects.toThrow("indices must cover each input exactly once")
    expect(client.metrics.failed).toBe(2)
  })
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

  it("rejects oversized inputs before the request instead of silently truncating them", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(successfulResponse())
    const client = new OpenRouterEmbeddingClient({ apiKey: "secret", fetch: fetchMock })

    await expect(client.embed(["A".repeat(MAX_EMBEDDING_INPUT_CHARACTERS + 1_000)])).rejects.toThrow(
      "split them before submission"
    )
    expect(fetchMock).not.toHaveBeenCalled()
    expect(client.metrics.created).toBe(0)
  })

  it("rejects provider token-limit errors without shortening or retrying the input", async () => {
    const requests: Array<{ input: string[] }> = []
    const fetchMock = vi.fn<typeof fetch>().mockImplementationOnce(async (_input, init) => {
      requests.push(JSON.parse(String(init?.body)) as { input: string[] })
      return new Response(
        JSON.stringify({ error: { message: "Invalid 'input[1]': maximum input length is 8192 tokens." } }),
        { status: 400 }
      )
    })
    const client = new OpenRouterEmbeddingClient({ apiKey: "test", fetch: fetchMock })

    const inputs = ["short", "x".repeat(MAX_EMBEDDING_INPUT_CHARACTERS)]
    await expect(client.embed(inputs)).rejects.toThrow("HTTP 400")
    expect(requests).toHaveLength(1)
    expect(requests[0]?.input).toEqual(inputs)
    expect(client.metrics).toMatchObject({ retries: 0, created: 0, failed: 2 })
  })

  it("freezes exact inputs across transient retries even if the caller mutates its array", async () => {
    const inputs = ["  Exact source text 🧭\n"]
    const sent: string[] = []
    const client = new OpenRouterEmbeddingClient({
      apiKey: "test",
      fetch: async (_url, init) => {
        sent.push(String(init?.body))
        if (sent.length === 1) {
          inputs.splice(0, 1, "changed", "another input")
          return new Response("busy", { status: 503 })
        }
        return successfulResponse()
      }
    })
    await expect(client.embed(inputs)).resolves.toMatchObject({ model: EMBEDDING_MODEL })
    expect(sent).toHaveLength(2)
    expect(sent[1]).toBe(sent[0])
    expect(JSON.parse(sent[0] ?? "").input).toEqual(["  Exact source text 🧭\n"])
    expect(client.metrics).toMatchObject({ requested: 1, created: 1, retries: 1 })
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

  it.each(["ENOTFOUND", "EAI_AGAIN", "ECONNRESET", "ETIMEDOUT", "UND_ERR_SOCKET"])(
    "retries wrapped connection failure %s with identical inputs",
    async (code) => {
      const failure = new TypeError("fetch failed", { cause: Object.assign(new Error("connection failed"), { code }) })
      const fetchMock = vi.fn<typeof fetch>().mockRejectedValueOnce(failure).mockResolvedValueOnce(successfulResponse())
      const client = new OpenRouterEmbeddingClient({ apiKey: "test", fetch: fetchMock })
      await expect(client.embed(["exact source"])).resolves.toMatchObject({ model: EMBEDDING_MODEL })
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(fetchMock.mock.calls[1]?.[1]?.body).toBe(fetchMock.mock.calls[0]?.[1]?.body)
      expect(client.metrics).toMatchObject({ retries: 1, failed: 0, created: 1 })
    }
  )

  it("bounds persistent DNS retries and preserves the original failure", async () => {
    const failure = new TypeError("fetch failed", {
      cause: Object.assign(new Error("DNS unavailable"), { code: "ENOTFOUND" })
    })
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(failure)
    const client = new OpenRouterEmbeddingClient({ apiKey: "test", fetch: fetchMock, maximumAttempts: 2 })
    await expect(client.embed(["source"])).rejects.toBe(failure)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(client.metrics).toMatchObject({ retries: 1, failed: 1, created: 0 })
  })

  it.each(["CERT_HAS_EXPIRED", "ERR_INVALID_URL", "UNKNOWN"])(
    "does not retry unapproved connection code %s",
    async (code) => {
      const failure = new TypeError("fetch failed", { cause: Object.assign(new Error("connection failed"), { code }) })
      const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(failure)
      const client = new OpenRouterEmbeddingClient({ apiKey: "test", fetch: fetchMock })
      await expect(client.embed(["source"])).rejects.toBe(failure)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    }
  )

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
