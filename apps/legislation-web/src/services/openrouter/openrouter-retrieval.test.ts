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

  it.each([
    [401, " \n Invalid key\t ", ": Invalid key"],
    [429, "", ""],
    [503, "x".repeat(510), `: ${"x".repeat(500)}`]
  ] as const)("preserves HTTP %s error details without retrying generation", async (status, body, detail) => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(body, { status }))
    const client = new OpenRouterRetrievalClient({ apiKey: "fixture-key", fetch: fetchMock, maximumAttempts: 3 })

    await expect(client.completeChat(completion)).rejects.toThrow(
      `OpenRouter research generation failed with HTTP ${status}${detail}`
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it.each([{ choices: [] }, { choices: [{ message: { content: "" } }] }, { choices: [{ message: {} }] }])(
    "rejects a malformed provider envelope: %j",
    async (body) => {
      const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json(body))
      const client = new OpenRouterRetrievalClient({ apiKey: "fixture-key", fetch: fetchMock })

      await expect(client.completeChat(completion)).rejects.toThrow(z.ZodError)
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
    const client = new OpenRouterRetrievalClient({ apiKey: "fixture-key", fetch: fetchMock, timeoutMs: 1500 })
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
})
