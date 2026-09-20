import invariant from "tiny-invariant"
import { afterEach, describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { OpenRouterRetrievalClient, type ChatCompletionRequest } from "./openrouter-retrieval"

const completion: ChatCompletionRequest = {
  messages: [
    { role: "system", content: "Return the requested summary as JSON." },
    { role: "user", content: "Summarize the supplied text." }
  ],
  model: "configured-model",
  responseFormat: { type: "json_object" },
  temperature: 0.4
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe("OpenRouter retrieval client", () => {
  it.each([0, -1, Infinity, 11])("rejects an unbounded or invalid attempt count %s", (maximumAttempts) => {
    expect(() => new OpenRouterRetrievalClient({ apiKey: "fixture", maximumAttempts })).toThrow(z.ZodError)
  })

  it("routes bill queries to Voyage and selectively reranks bill candidates", { timeout: 30_000 }, async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [{ embedding: Array.from({ length: 1024 }, () => 0.25), index: 0 }],
            model: "voyage-4"
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            results: [
              { index: 1, relevance_score: 0.9 },
              { index: 0, relevance_score: 0.7 }
            ]
          }),
          {
            status: 200
          }
        )
      )
    const client = new OpenRouterRetrievalClient({ apiKey: "secret", fetch: fetchMock })

    await expect(client.embed("bill", ["clean water grants"])).resolves.toMatchObject({
      model: "voyageai/voyage-4"
    })
    await expect(
      client.rerank("search_bills", "clean water grants", [
        { id: "a", text: "water infrastructure" },
        { id: "b", text: "municipal clean-water grants" }
      ])
    ).resolves.toEqual([
      { id: "b", relevanceScore: 0.9, text: "municipal clean-water grants" },
      { id: "a", relevanceScore: 0.7, text: "water infrastructure" }
    ])

    const embeddingRequest = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    const rerankRequest = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))
    expect(embeddingRequest).toMatchObject({ input_type: "query", model: "voyageai/voyage-4" })
    expect(rerankRequest).toMatchObject({ model: "cohere/rerank-v3.5", top_n: 2 })
  })

  it("rejects reranking on products where the evaluated route disables it", async () => {
    const client = new OpenRouterRetrievalClient({ apiKey: "secret", fetch: vi.fn<typeof fetch>() })
    await expect(
      client.rerank("search_amendments", "education amendment", [{ id: "a", text: "education" }])
    ).rejects.toThrow("does not have a reranking route")
  })

  it.each(["reported-model", undefined])(
    "passes through caller-owned generation policy and handles reported model %s",
    async (reportedModel) => {
      const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: '{"summary":"Complete"}' } }],
            model: reportedModel
          }),
          { status: 200 }
        )
      )
      const client = new OpenRouterRetrievalClient({
        apiKey: "fixture-key",
        baseUrl: new URL("https://gateway.example.test/api/v1"),
        fetch: fetchMock
      })

      await expect(client.completeChat(completion)).resolves.toEqual({
        content: '{"summary":"Complete"}',
        model: reportedModel ?? completion.model
      })

      expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
        new URL("https://gateway.example.test/api/v1/chat/completions"),
        {
          body: expect.any(String),
          headers: { Authorization: "Bearer fixture-key", "Content-Type": "application/json" },
          method: "POST",
          signal: expect.any(AbortSignal)
        }
      )
      const request = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
      expect(request).toEqual({
        messages: completion.messages,
        model: completion.model,
        provider: { allow_fallbacks: false, data_collection: "deny" },
        response_format: completion.responseFormat,
        temperature: completion.temperature
      })
    }
  )

  it.each([401, 402, 413, 501])("sanitizes permanent HTTP %s failures without retrying", async (status) => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => new Response("private provider detail", { status }))
    const client = new OpenRouterRetrievalClient({ apiKey: "fixture-key", fetch: fetchMock, maximumAttempts: 3 })

    const result = client.completeChat(completion)
    await expect(result).rejects.toThrow(`OpenRouter research generation failed with HTTP ${status}`)
    await expect(result).rejects.not.toThrow("private provider detail")
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it.each([{ choices: [] }, { choices: [{ message: { content: "" } }] }, { choices: [{ message: {} }] }])(
    "rejects a malformed provider envelope: %j",
    async (body) => {
      const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json(body))
      const client = new OpenRouterRetrievalClient({ apiKey: "fixture-key", fetch: fetchMock })

      await expect(client.completeChat(completion)).rejects.toThrow(z.ZodError)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    }
  )

  it("passes the configured timeout signal to fetch and propagates cancellation", async () => {
    const controller = new AbortController()
    const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal)
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (_url, options) => {
      const signal = options?.signal
      invariant(signal)
      return await new Promise<Response>((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), { once: true })
      })
    })
    const client = new OpenRouterRetrievalClient({
      apiKey: "fixture-key",
      fetch: fetchMock,
      generationTimeoutMs: 1500,
      maximumAttempts: 1
    })
    const result = client.completeChat(completion)
    const error = new DOMException("Request timed out", "TimeoutError")
    controller.abort(error)

    await expect(result).rejects.toBe(error)
    expect(timeout).toHaveBeenCalledExactlyOnceWith(1500)
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBe(controller.signal)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("propagates fetch failures without retrying generation", async () => {
    const error = new Error("Fixture connection failure")
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(error)
    const client = new OpenRouterRetrievalClient({ apiKey: "fixture-key", fetch: fetchMock })

    await expect(client.completeChat(completion)).rejects.toBe(error)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("configures each retrieval dependency deadline independently", { timeout: 30_000 }, async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout")
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          data: [{ embedding: Array.from({ length: 1024 }, () => 0.25), index: 0 }],
          model: "voyage-4"
        })
      )
      .mockResolvedValueOnce(Response.json({ results: [{ index: 0, relevance_score: 0.9 }] }))
      .mockResolvedValueOnce(Response.json({ choices: [{ message: { content: "complete" } }] }))
    const client = new OpenRouterRetrievalClient({
      apiKey: "fixture-key",
      fetch: fetchMock,
      embeddingTimeoutMs: 15_000,
      rerankTimeoutMs: 20_000,
      generationTimeoutMs: 25_000
    })
    await client.embed("bill", ["source"])
    await client.rerank("search_bills", "policy", [{ id: "one", text: "source" }])
    await client.completeChat(completion)
    expect(timeout.mock.calls.map(([milliseconds]) => milliseconds)).toEqual([15_000, 20_000, 25_000])
  })

  it("retains a 30-second default for both non-embedding retrieval operations", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout")
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ results: [{ index: 0, relevance_score: 0.9 }] }))
      .mockResolvedValueOnce(Response.json({ choices: [{ message: { content: "complete" } }] }))
    const client = new OpenRouterRetrievalClient({ apiKey: "fixture-key", fetch: fetchMock })
    await client.rerank("search_bills", "policy", [{ id: "one", text: "source" }])
    await client.completeChat(completion)
    expect(timeout.mock.calls.map(([milliseconds]) => milliseconds)).toEqual([30_000, 30_000])
  })

  it.each(["rerank", "chat"] as const)("retries transient %s requests with frozen input", async (operation) => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("busy", { status: 503 }))
      .mockResolvedValueOnce(
        Response.json(
          operation === "rerank"
            ? { results: [{ index: 0, relevance_score: 0.9 }] }
            : { choices: [{ message: { content: "complete" } }] }
        )
      )
    const client = new OpenRouterRetrievalClient({ apiKey: "fixture-key", fetch: fetchMock })
    await (operation === "rerank"
      ? client.rerank("search_bills", "policy", [{ id: "one", text: "source" }])
      : client.completeChat(completion))
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(fetchMock.mock.calls[1]?.[1]?.body)
  })

  it("retries known transport failures, including body failures, but not malformed JSON", async () => {
    const failure = new TypeError("fetch failed", {
      cause: Object.assign(new Error("socket reset"), { code: "ECONNRESET" })
    })
    const brokenBody = Response.json({})
    vi.spyOn(brokenBody, "text").mockRejectedValueOnce(failure)
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce(brokenBody)
      .mockResolvedValueOnce(Response.json({ choices: [{ message: { content: "complete" } }] }))
    const client = new OpenRouterRetrievalClient({ apiKey: "fixture-key", fetch: fetchMock })
    await expect(client.completeChat(completion)).resolves.toMatchObject({ content: "complete" })
    expect(fetchMock).toHaveBeenCalledTimes(3)
    fetchMock.mockReset().mockResolvedValue(new Response("not JSON"))
    await expect(client.completeChat(completion)).rejects.toThrow(SyntaxError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("bounds transient HTTP retries", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () => new Response("busy", { status: 429 }))
    const client = new OpenRouterRetrievalClient({ apiKey: "fixture-key", fetch: fetchMock })
    await expect(client.completeChat(completion)).rejects.toThrow("HTTP 429")
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it.each(["rerank", "chat", "embed"] as const)("rejects pre-cancelled %s without a request", async (operation) => {
    const reason = new DOMException("Caller cancelled", "AbortError")
    const fetchMock = vi.fn<typeof fetch>()
    const client = new OpenRouterRetrievalClient({
      apiKey: "fixture-key",
      fetch: fetchMock,
      signal: AbortSignal.abort(reason)
    })
    const operations = {
      rerank: () => client.rerank("search_bills", "policy", [{ id: "one", text: "source" }]),
      embed: () => client.embed("bill", ["policy"]),
      chat: () => client.completeChat(completion)
    }
    await expect(operations[operation]()).rejects.toBe(reason)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("propagates caller cancellation into an active request", async () => {
    const controller = new AbortController()
    const reason = new DOMException("Caller cancelled", "AbortError")
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (_url, options) => {
      const signal = options?.signal
      invariant(signal)
      return await new Promise<Response>((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), { once: true })
      })
    })
    const client = new OpenRouterRetrievalClient({ apiKey: "fixture-key", fetch: fetchMock, signal: controller.signal })
    const result = client.completeChat(completion)
    controller.abort(reason)
    await expect(result).rejects.toBe(reason)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("stops during retry backoff without another provider request", async () => {
    const controller = new AbortController()
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () => {
      setTimeout(() => controller.abort(), 20)
      return new Response("busy", { status: 503 })
    })
    const client = new OpenRouterRetrievalClient({ apiKey: "fixture-key", fetch: fetchMock, signal: controller.signal })
    await expect(client.completeChat(completion)).rejects.toMatchObject({ name: "AbortError" })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
