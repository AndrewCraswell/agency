import { describe, expect, it, vi } from "vitest"
import type { OcrDocumentBatchResult } from "../../ingestion/documents/ocr-jobs.js"
import { runTargetedOcrItems } from "./ocr-tasks.js"

describe("runTargetedOcrItems", () => {
  it("waits for and owns transient retries when the caller requires self-contained completion", async () => {
    const retryAt = new Date("2026-08-20T06:30:00.000Z")
    const process = vi
      .fn<(documentIds: readonly string[]) => Promise<OcrDocumentBatchResult>>()
      .mockResolvedValueOnce({ claimed: 2, failed: 1, failures: [], pages: 3, processed: 1, rerouted: 0 })
      .mockResolvedValueOnce({ claimed: 1, failed: 0, failures: [], pages: 2, processed: 1, rerouted: 0 })
    const retryState = vi
      .fn<(documentIds: readonly string[]) => Promise<Readonly<{ itemIds: string[]; nextAttemptAt?: Date }>>>()
      .mockResolvedValueOnce({ itemIds: ["document-2"], nextAttemptAt: retryAt })
      .mockResolvedValueOnce({ itemIds: [] })
    const waitUntil = vi.fn<(date: Date) => Promise<void>>().mockResolvedValue(undefined)

    await expect(
      runTargetedOcrItems(["document-1", "document-2"], { process, retryState, waitUntil })
    ).resolves.toEqual({ claimed: 3, complete: true, failed: 1, pages: 5, processed: 2, rerouted: 0, targeted: 2 })
    expect(process).toHaveBeenNthCalledWith(1, ["document-1", "document-2"])
    expect(process).toHaveBeenNthCalledWith(2, ["document-2"])
    expect(waitUntil).toHaveBeenCalledOnce()
    expect(waitUntil).toHaveBeenCalledWith(retryAt)
  })

  it("defers material retries to the shard controller without holding the OCR child open", async () => {
    const retryAt = new Date("2026-08-20T06:30:00.000Z")
    const process = vi
      .fn<(documentIds: readonly string[]) => Promise<OcrDocumentBatchResult>>()
      .mockResolvedValue({ claimed: 2, failed: 1, failures: [], pages: 3, processed: 1, rerouted: 0 })
    const retryState = vi
      .fn<(documentIds: readonly string[]) => Promise<Readonly<{ itemIds: string[]; nextAttemptAt?: Date }>>>()
      .mockResolvedValue({ itemIds: ["material-2"], nextAttemptAt: retryAt })
    const waitUntil = vi.fn<(date: Date) => Promise<void>>()

    await expect(
      runTargetedOcrItems(["material-1", "material-2"], {
        deferRetries: true,
        process,
        retryState,
        waitUntil
      })
    ).resolves.toEqual({
      claimed: 2,
      complete: false,
      failed: 1,
      nextAttemptAt: retryAt,
      pages: 3,
      processed: 1,
      remaining: 1,
      rerouted: 0,
      targeted: 2
    })
    expect(process).toHaveBeenCalledOnce()
    expect(waitUntil).not.toHaveBeenCalled()
  })

  it("finishes without waiting when every handed-off document is terminal", async () => {
    const waitUntil = vi.fn<(date: Date) => Promise<void>>()
    const result = await runTargetedOcrItems(["document-1"], {
      process: async () => ({ claimed: 1, failed: 0, failures: [], pages: 1, processed: 1, rerouted: 0 }),
      retryState: async () => ({ itemIds: [] }),
      waitUntil
    })

    expect(result).toMatchObject({ complete: true, processed: 1, targeted: 1 })
    expect(waitUntil).not.toHaveBeenCalled()
  })
})
