import { digest } from "@repo/legislation-core/legal-text/contracts"
import { describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { compareRegulatoryEmbeddingSmoke } from "./embedding-smoke.js"

const manifest = {
  records: [
    { id: "a", versionId: "a1", input: "hazard labels" },
    { id: "b", versionId: "b1", input: "grant costs" }
  ],
  queries: [{ id: "q", input: "hazardous chemical warning", relevantIds: ["a"] }]
}
const requestSchema = z.object({ model: z.string(), input: z.array(z.string()), input_type: z.string().optional() })

describe("regulatory embedding smoke", () => {
  it(
    "retains no-answer rankings separately from answerable metrics and does not claim abstention",
    { timeout: 30_000 },
    async () => {
      const result = await compareRegulatoryEmbeddingSmoke(
        {
          ...manifest,
          queries: [
            ...manifest.queries,
            { id: "unsupported", input: "uncovered jurisdiction", relevantIds: [], answerability: "no_answer" }
          ]
        },
        {
          apiKey: "fixture",
          fetch: async (_url, init) => {
            const request = requestSchema.parse(JSON.parse(String(init?.body)))
            const dimensions = request.model.startsWith("openai/") ? 1536 : 1024
            return Response.json({
              model: request.model,
              data: request.input.map((_, index) => ({
                index,
                embedding: Array.from({ length: dimensions }, (_value, dimension) => Number(dimension === index))
              }))
            })
          }
        }
      )
      for (const system of result.results) {
        expect(system.queries[0]).toMatchObject({ answerability: "answerable", metrics: { recallAt25: 1 } })
        expect(system.queries[1]).toMatchObject({ answerability: "no_answer", metrics: null })
        expect(system.queries[1]?.ranked).toHaveLength(2)
      }
      expect(result.noAnswerEvaluationComplete).toBe(false)
      expect(result.modelSelected).toBe(false)
    }
  )
  it("requires explicit no-answer intent and rejects contradictory relevant IDs before network", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>()
    for (const query of [
      { id: "q", input: "question", relevantIds: [] },
      { id: "q", input: "question", relevantIds: ["a"], answerability: "no_answer" }
    ]) {
      await expect(
        compareRegulatoryEmbeddingSmoke({ ...manifest, queries: [query] }, { apiKey: "fixture", fetch })
      ).rejects.toThrow(z.ZodError)
    }
    expect(fetch).not.toHaveBeenCalled()
  })
  it("batches larger corpora without dropping inputs and aggregates document usage", { timeout: 30_000 }, async () => {
    const lengths: number[] = []
    const records = Array.from({ length: 65 }, (_, index) => ({
      id: `r${index}`,
      versionId: `v${index}`,
      input: `source ${index}`
    }))
    const result = await compareRegulatoryEmbeddingSmoke(
      { records, queries: [{ id: "q", input: "source", relevantIds: ["r64"] }] },
      {
        apiKey: "fixture",
        fetch: async (_url, init) => {
          const request = requestSchema.parse(JSON.parse(String(init?.body)))
          lengths.push(request.input.length)
          const dimensions = request.model.startsWith("openai/") ? 1536 : 1024
          return Response.json({
            model: request.model,
            usage: { total_tokens: 10 },
            data: request.input.map((_, index) => ({
              index,
              embedding: Array.from({ length: dimensions }, (_value, dimension) => Number(dimension === index))
            }))
          })
        }
      }
    )
    expect(lengths).toEqual([64, 1, 1, 64, 1, 1])
    expect(result.results.every((row) => row.tokens === 30 && row.queries[0]?.ranked.length === 65)).toBe(true)
  })
  it("pairs document/query inputs, isolates dimensions and retains exact version retrieval without promotion", async () => {
    const requests: z.infer<typeof requestSchema>[] = []
    const result = await compareRegulatoryEmbeddingSmoke(manifest, {
      apiKey: "fixture",
      fetch: async (_url, init) => {
        const request = requestSchema.parse(JSON.parse(String(init?.body)))
        requests.push(request)
        const dimensions = request.model.startsWith("openai/") ? 1536 : 1024
        return Response.json({
          model: request.model,
          data: request.input.map((_, index) => ({
            index,
            embedding: Array.from({ length: dimensions }, (_value, dimension) => Number(dimension === index))
          })),
          usage: { total_tokens: 10 }
        })
      }
    })
    expect(requests.map((request) => request.input_type)).toEqual([undefined, undefined, "document", "query"])
    expect(requests[0]?.input).toEqual(manifest.records.map((record) => record.input))
    expect(result.results.map((row) => row.dimensions)).toEqual([1536, 1024])
    expect(result.qualification.map((row) => row.model)).toEqual(["openai/text-embedding-3-small", "voyageai/voyage-4"])
    for (const qualified of result.qualification) {
      expect(qualified.tokenizerId.length).toBeGreaterThan(0)
      expect(qualified.records.map((record) => record.inputHash)).toEqual(
        manifest.records.map((record) => digest(record.input))
      )
      expect(
        qualified.records.every((record) => Number.isInteger(record.tokenCount) && Number(record.tokenCount) > 0)
      ).toBe(true)
      expect(qualified.queries[0]?.inputHash).toBe(digest("hazardous chemical warning"))
    }
    expect(result.results.every((row) => row.queries[0]?.ranked[0]?.versionId === "a1")).toBe(true)
    expect(result).toMatchObject({
      modelSelected: false,
      bulkEmbeddingAuthorized: false,
      heldOutEvaluationComplete: false
    })
  })
  it("rejects a token-heavy late batch before sending otherwise valid early batches", { timeout: 30_000 }, async () => {
    const fetch = vi.fn<typeof globalThis.fetch>()
    const records = Array.from({ length: 65 }, (_, index) => ({
      id: `r${index}`,
      versionId: `v${index}`,
      input: index === 64 ? "🙂".repeat(4500) : "valid source"
    }))
    await expect(
      compareRegulatoryEmbeddingSmoke(
        { records, queries: [{ id: "q", input: "source", relevantIds: ["r0"] }] },
        { apiKey: "fixture", fetch }
      )
    ).rejects.toThrow("embedding_input_token_limit")
    expect(fetch).not.toHaveBeenCalled()
  })
  it("rejects an invalid query before embedding documents", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>()
    await expect(
      compareRegulatoryEmbeddingSmoke(
        { ...manifest, queries: [{ id: "q", input: "\ud800", relevantIds: ["a"] }] },
        { apiKey: "fixture", fetch }
      )
    ).rejects.toThrow(z.ZodError)
    expect(fetch).not.toHaveBeenCalled()
  })
  it("rejects oversized inputs before network and rejects unknown judgment IDs", async () => {
    await expect(
      compareRegulatoryEmbeddingSmoke(
        { ...manifest, records: [{ ...manifest.records[0], input: "x".repeat(16001) }, manifest.records[1]] },
        { apiKey: "fixture" }
      )
    ).rejects.toThrow(z.ZodError)
    await expect(
      compareRegulatoryEmbeddingSmoke(
        { ...manifest, queries: [{ id: "q", input: "query", relevantIds: ["missing"] }] },
        { apiKey: "fixture" }
      )
    ).rejects.toThrow("embedding_smoke_invalid_judgments")
  })
  it("rejects wrong dimensions and does not retry provider input errors with shortened text", async () => {
    await expect(
      compareRegulatoryEmbeddingSmoke(manifest, {
        apiKey: "fixture",
        fetch: async () =>
          Response.json({
            model: "text-embedding-3-small",
            data: [
              { index: 0, embedding: [1] },
              { index: 1, embedding: [1] }
            ]
          })
      })
    ).rejects.toThrow("1536-dimensional")
    let calls = 0
    await expect(
      compareRegulatoryEmbeddingSmoke(manifest, {
        apiKey: "fixture",
        fetch: async () => {
          calls++
          return new Response("Invalid 'input[0]': maximum input length", { status: 400 })
        }
      })
    ).rejects.toThrow("HTTP 400")
    expect(calls).toBe(1)
  })
})
