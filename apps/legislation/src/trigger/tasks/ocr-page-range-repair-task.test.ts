import { describe, expect, it, vi } from "vitest"
import { ocrPageRangeRepairPayloadSchema, runOcrPageRangeRepairTask } from "./ocr-page-range-repair-task.js"

describe("OCR page-range repair task", () => {
  it("accepts a bounded explicit list and forwards it unchanged", async () => {
    const repair = vi
      .fn<
        (
          documentIds: readonly string[]
        ) => Promise<Readonly<{ alreadyComplete: number; pages: number; repaired: number; targeted: number }>>
      >()
      .mockResolvedValue({ alreadyComplete: 0, pages: 7, repaired: 2, targeted: 2 })

    await expect(runOcrPageRangeRepairTask({ documentIds: ["document-1", "document-2"] }, { repair })).resolves.toEqual(
      { alreadyComplete: 0, pages: 7, repaired: 2, targeted: 2 }
    )
    expect(repair).toHaveBeenCalledExactlyOnceWith(["document-1", "document-2"])
  })

  it("rejects duplicates, empty batches, implicit selection, and oversized batches", () => {
    expect(() => ocrPageRangeRepairPayloadSchema.parse({ documentIds: [] })).toThrow(/./)
    expect(() => ocrPageRangeRepairPayloadSchema.parse({ documentIds: ["document-1", "document-1"] })).toThrow(/./)
    expect(() =>
      ocrPageRangeRepairPayloadSchema.parse({
        documentIds: Array.from({ length: 26 }, (_, index) => `document-${index}`)
      })
    ).toThrow(/./)
    expect(() => ocrPageRangeRepairPayloadSchema.parse({ jurisdictionId: "us" })).toThrow(/./)
  })
})
