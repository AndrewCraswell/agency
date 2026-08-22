import { describe, expect, it, vi } from "vitest"
import { OpenRouterRetrievalClient } from "./openrouter-retrieval.js"

describe("OpenRouter retrieval client", () => {
  it("routes bill queries to Voyage and selectively reranks bill candidates", async () => {
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
})
