import { describe, expect, it, vi } from "vitest"
import type { EmbeddingJobResult } from "../../ingestion/embeddings/jobs.js"
import {
  postOcrEmbeddingIdempotencyKey,
  runDocumentSectionEmbeddingRefresh,
  schedulePostOcrEmbeddingRefreshes
} from "./document-section-embedding-tasks.js"

describe("post-OCR document-section embeddings", () => {
  it("continues a targeted document until every section has been scanned", async () => {
    const embed = vi
      .fn<
        (options: Readonly<{ afterId: string; documentId: string; rolloutId: string }>) => Promise<EmbeddingJobResult>
      >()
      .mockResolvedValueOnce({ complete: false, cursor: "section-64", embedded: 64, scanned: 64, skipped: 0 })
      .mockResolvedValueOnce({ complete: true, cursor: "", embedded: 2, scanned: 3, skipped: 1 })

    await expect(runDocumentSectionEmbeddingRefresh("document-1", "ocr-run-1", { embed })).resolves.toEqual({
      complete: true,
      documentId: "document-1",
      embedded: 66,
      scanned: 67,
      skipped: 1
    })
    expect(embed).toHaveBeenNthCalledWith(1, {
      afterId: "",
      documentId: "document-1",
      rolloutId: "ocr-run-1"
    })
    expect(embed).toHaveBeenNthCalledWith(2, {
      afterId: "section-64",
      documentId: "document-1",
      rolloutId: "ocr-run-1"
    })
  })

  it("fails safely when a provider retry cannot advance the persisted cursor", async () => {
    const embed = vi
      .fn<
        (options: Readonly<{ afterId: string; documentId: string; rolloutId: string }>) => Promise<EmbeddingJobResult>
      >()
      .mockResolvedValue({
        complete: false,
        cursor: "section-64",
        embedded: 0,
        scanned: 0,
        skipped: 0
      })

    await expect(
      runDocumentSectionEmbeddingRefresh("document-1", "ocr-run-1", {
        embed: async (options) => {
          if (options.afterId === "") {
            return { complete: false, cursor: "section-64", embedded: 64, scanned: 64, skipped: 0 }
          }
          return await embed(options)
        }
      })
    ).rejects.toThrow("cursor did not advance")
  })

  it("rejects an OCR success that produced no searchable sections", async () => {
    await expect(
      runDocumentSectionEmbeddingRefresh("document-empty", "ocr-run-1", {
        embed: async () => ({ complete: true, cursor: "", embedded: 0, scanned: 0, skipped: 0 })
      })
    ).rejects.toThrow("has no sections to embed")
  })

  it("deduplicates dispatches and gives retries a stable per-run key", async () => {
    const dispatch = vi.fn<(items: readonly unknown[]) => Promise<void>>().mockResolvedValue(undefined)
    const first = { contentHash: "a".repeat(64), id: "document-1" }
    const second = { contentHash: "b".repeat(64), id: "document-2" }

    await expect(schedulePostOcrEmbeddingRefreshes([second, first, second], "ocr-run-1", { dispatch })).resolves.toBe(2)
    expect(dispatch).toHaveBeenCalledOnce()
    expect(dispatch.mock.calls[0]?.[0]).toEqual([
      {
        idempotencyKey: postOcrEmbeddingIdempotencyKey(first),
        payload: { contentHash: first.contentHash, documentId: "document-1", ocrRunId: "ocr-run-1" }
      },
      {
        idempotencyKey: postOcrEmbeddingIdempotencyKey(second),
        payload: { contentHash: second.contentHash, documentId: "document-2", ocrRunId: "ocr-run-1" }
      }
    ])
    expect(postOcrEmbeddingIdempotencyKey(first)).toBe(postOcrEmbeddingIdempotencyKey(first))
    expect(postOcrEmbeddingIdempotencyKey({ ...first, contentHash: "c".repeat(64) })).not.toBe(
      postOcrEmbeddingIdempotencyKey(first)
    )
  })

  it("does not dispatch an empty OCR result", async () => {
    const dispatch = vi.fn<(items: readonly unknown[]) => Promise<void>>()
    await expect(schedulePostOcrEmbeddingRefreshes([], "ocr-run-1", { dispatch })).resolves.toBe(0)
    expect(dispatch).not.toHaveBeenCalled()
  })
})
