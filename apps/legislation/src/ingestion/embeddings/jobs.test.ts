import { describe, expect, it } from "vitest"
import {
  billEmbeddingInputHash,
  needsEmbeddingRefresh,
  sectionEmbeddingInputHash,
  selectEmbeddingCandidates
} from "./jobs.js"

describe("embedding freshness", () => {
  it("requires a vector and current model even when the input hash is current", () => {
    const inputHash = billEmbeddingInputHash({ subjects: ["budget"], summary: "A summary", title: "A bill" })

    expect(
      needsEmbeddingRefresh(inputHash, {
        embedding: null,
        embeddingInputHash: inputHash,
        embeddingModel: "openai/text-embedding-3-small"
      })
    ).toBe(true)
    expect(
      needsEmbeddingRefresh(inputHash, {
        embedding: "[0.1]",
        embeddingInputHash: inputHash,
        embeddingModel: null
      })
    ).toBe(true)
    expect(
      needsEmbeddingRefresh(inputHash, {
        embedding: "[0.1]",
        embeddingInputHash: inputHash,
        embeddingModel: "openai/text-embedding-3-small"
      })
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

  it("advances past fresh records to find a later stale record instead of falsely completing", () => {
    const freshInput = billEmbeddingInputHash({ subjects: [], summary: null, title: "Fresh" })
    const records = [
      ...Array.from({ length: 64 }, (_, index) => ({
        embedding: "[0.1]",
        embeddingInputHash: freshInput,
        embeddingModel: "openai/text-embedding-3-small",
        id: `bill:${String(index).padStart(3, "0")}`,
        subjects: [],
        summary: null,
        title: "Fresh"
      })),
      {
        embedding: "[0.1]",
        embeddingInputHash: "stale",
        embeddingModel: "openai/text-embedding-3-small",
        id: "bill:064",
        subjects: [],
        summary: null,
        title: "Changed"
      }
    ]

    const selection = selectEmbeddingCandidates(
      records,
      { afterId: "", limit: 64, scanLimit: 512 },
      (record) => record.title
    )

    expect(selection).toMatchObject({ complete: true, cursor: "", scanned: 65 })
    expect(selection.candidates.map((candidate) => candidate.id)).toEqual(["bill:064"])
  })

  it("keeps an incomplete cursor after scanning a full fresh page", () => {
    const records = Array.from({ length: 512 }, (_, index) => ({
      embedding: "[0.1]",
      embeddingInputHash: billEmbeddingInputHash({ subjects: [], summary: null, title: "Fresh" }),
      embeddingModel: "openai/text-embedding-3-small",
      id: `bill:${String(index).padStart(3, "0")}`,
      subjects: [],
      summary: null,
      title: "Fresh"
    }))

    const selection = selectEmbeddingCandidates(
      records,
      { afterId: "", limit: 64, scanLimit: 512 },
      (record) => record.title
    )

    expect(selection).toMatchObject({ candidates: [], complete: false, cursor: "bill:511", scanned: 512 })
  })

  it("keeps a cursor when a short page holds more stale records than one embedding batch", () => {
    const records = Array.from({ length: 65 }, (_, index) => ({
      embedding: null,
      embeddingInputHash: null,
      embeddingModel: null,
      id: `bill:${String(index).padStart(3, "0")}`,
      subjects: [],
      summary: null,
      title: "Stale"
    }))

    const selection = selectEmbeddingCandidates(
      records,
      { afterId: "", limit: 64, scanLimit: 512 },
      (record) => record.title
    )

    expect(selection).toMatchObject({ complete: false, cursor: "bill:063", scanned: 64 })
    expect(selection.candidates).toHaveLength(64)
  })
})
