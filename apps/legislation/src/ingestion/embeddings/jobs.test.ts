import { describe, expect, it, vi } from "vitest"
import { embeddingRouteFor } from "../../models/embedding-routing.js"
import {
  billEmbeddingInputHash,
  embedSelected,
  legacyEmbeddingInputHash,
  needsEmbeddingRefresh,
  sectionEmbeddingInputHash,
  selectEmbeddingCandidates
} from "./jobs.js"

describe("embedding freshness", () => {
  it("chunks bulk candidates for the provider and groups persistence writes", async () => {
    const route = embeddingRouteFor("bill")
    const candidates = Array.from({ length: 5 }, (_, index) => ({
      embedding: null,
      embeddingInputContract: null,
      embeddingInputHash: null,
      embeddingModel: null,
      id: `bill:${index}`,
      input: `Bill ${index}`,
      inputHash: String(index).padStart(64, "0")
    }))
    const embed = vi.fn<(input: string[]) => Promise<{ embeddings: number[][]; model: string }>>(async (input) => ({
      embeddings: input.map(() => [0.1]),
      model: route.model
    }))
    const persistedBatchSizes: number[] = []
    const persist = vi.fn<(records: unknown[]) => Promise<void>>(async (records) => {
      persistedBatchSizes.push(records.length)
    })

    await expect(
      embedSelected({ embed }, route, { candidates, complete: false, cursor: "bill:4", scanned: 5 }, persist, {
        persistenceBatchSize: 4,
        providerBatchSize: 2
      })
    ).resolves.toMatchObject({ embedded: 5, scanned: 5 })

    expect(embed.mock.calls.map(([input]) => input)).toEqual([["Bill 0", "Bill 1"], ["Bill 2", "Bill 3"], ["Bill 4"]])
    expect(persistedBatchSizes).toEqual([4, 1])
  })

  it("requires a vector and current model even when the input hash is current", () => {
    const route = embeddingRouteFor("bill")
    const inputHash = billEmbeddingInputHash({ subjects: ["budget"], summary: "A summary", title: "A bill" })

    expect(
      needsEmbeddingRefresh(
        inputHash,
        {
          embedding: null,
          embeddingInputContract: route.embeddingInputContract,
          embeddingInputHash: inputHash,
          embeddingModel: route.model
        },
        route
      )
    ).toBe(true)
    expect(
      needsEmbeddingRefresh(
        inputHash,
        {
          embedding: "[0.1]",
          embeddingInputContract: route.embeddingInputContract,
          embeddingInputHash: inputHash,
          embeddingModel: null
        },
        route
      )
    ).toBe(true)
    expect(
      needsEmbeddingRefresh(
        inputHash,
        {
          embedding: "[0.1]",
          embeddingInputContract: route.embeddingInputContract,
          embeddingInputHash: inputHash,
          embeddingModel: route.model
        },
        route
      )
    ).toBe(false)
  })

  it("changes the input hash when searchable bill or section text changes", () => {
    expect(billEmbeddingInputHash({ subjects: ["budget"], summary: "A summary", title: "A bill" })).not.toBe(
      billEmbeddingInputHash({ subjects: ["budget"], summary: "An updated summary", title: "A bill" })
    )
    expect(sectionEmbeddingInputHash({ heading: "Section 1", text: "Original text" })).not.toBe(
      sectionEmbeddingInputHash({ heading: "Section 1", text: "Updated text" })
    )
  })

  it("keeps the legacy inline-vector hash distinct from the canonical route hash", () => {
    const route = embeddingRouteFor("document-section")
    const input = "Section 1\nText"

    expect(legacyEmbeddingInputHash(route.model, input)).not.toBe(
      sectionEmbeddingInputHash({ heading: "Section 1", text: "Text" })
    )
  })

  it("advances past fresh records to find a later stale record instead of falsely completing", () => {
    const route = embeddingRouteFor("bill")
    const freshInput = billEmbeddingInputHash({ subjects: [], summary: null, title: "Fresh" })
    const records = [
      ...Array.from({ length: 64 }, (_, index) => ({
        embedding: "[0.1]",
        embeddingInputContract: route.embeddingInputContract,
        embeddingInputHash: freshInput,
        embeddingModel: route.model,
        id: `bill:${String(index).padStart(3, "0")}`,
        subjects: [],
        summary: null,
        title: "Fresh"
      })),
      {
        embedding: "[0.1]",
        embeddingInputContract: route.embeddingInputContract,
        embeddingInputHash: "stale",
        embeddingModel: route.model,
        id: "bill:064",
        subjects: [],
        summary: null,
        title: "Changed"
      }
    ]

    const selection = selectEmbeddingCandidates(
      records,
      { afterId: "", limit: 64, route, scanLimit: 512 },
      (record) => record.title
    )

    expect(selection).toMatchObject({ complete: true, cursor: "", scanned: 65 })
    expect(selection.candidates.map((candidate) => candidate.id)).toEqual(["bill:064"])
  })

  it("keeps an incomplete cursor after scanning a full fresh page", () => {
    const route = embeddingRouteFor("bill")
    const records = Array.from({ length: 512 }, (_, index) => ({
      embedding: "[0.1]",
      embeddingInputContract: route.embeddingInputContract,
      embeddingInputHash: billEmbeddingInputHash({ subjects: [], summary: null, title: "Fresh" }),
      embeddingModel: route.model,
      id: `bill:${String(index).padStart(3, "0")}`,
      subjects: [],
      summary: null,
      title: "Fresh"
    }))

    const selection = selectEmbeddingCandidates(
      records,
      { afterId: "", limit: 64, route, scanLimit: 512 },
      (record) => record.title
    )

    expect(selection).toMatchObject({ candidates: [], complete: false, cursor: "bill:511", scanned: 512 })
  })

  it("keeps a cursor when a short page holds more stale records than one embedding batch", () => {
    const route = embeddingRouteFor("bill")
    const records = Array.from({ length: 65 }, (_, index) => ({
      embedding: null,
      embeddingInputContract: null,
      embeddingInputHash: null,
      embeddingModel: null,
      id: `bill:${String(index).padStart(3, "0")}`,
      subjects: [],
      summary: null,
      title: "Stale"
    }))

    const selection = selectEmbeddingCandidates(
      records,
      { afterId: "", limit: 64, route, scanLimit: 512 },
      (record) => record.title
    )

    expect(selection).toMatchObject({ complete: false, cursor: "bill:063", scanned: 64 })
    expect(selection.candidates).toHaveLength(64)
  })
})
