import { createHash } from "node:crypto"
import { describe, expect, it } from "vitest"
import { segmentLegalText } from "./extract.js"
import type { OcrResult } from "./ocr-client.js"
import {
  createOcrPageRangeRepairPlan,
  hasCompleteOcrPageRanges,
  type OcrPageRangeRepairSnapshot,
  validateOcrPageRangeRepairConcurrencyGuard
} from "./ocr-page-range-repair.js"

const sourceBytes = new TextEncoder().encode("retained PDF fixture")
const sourceText = " SECTION 1. TITLE.  \r\nFirst page. \r\n\r\n SECTION 2. DATA.\r\nSecond page. "
const canonicalText = "SECTION 1. TITLE.\nFirst page.\n\nSECTION 2. DATA.\nSecond page."
const secondPageStart = sourceText.indexOf(" SECTION 2")

function snapshot(): OcrPageRangeRepairSnapshot {
  return {
    blobPath: "documents/example.pdf",
    contentHash: createHash("sha256").update(sourceBytes).digest("hex"),
    contentType: "application/pdf",
    id: "document:example",
    ocrCompletedAt: new Date("2026-09-03T10:00:00.000Z"),
    ocrPageCount: 2,
    ocrProvider: "azure-document-intelligence",
    ocrStatus: "processed",
    processingStatus: "processed",
    sections: segmentLegalText("document:example", canonicalText).map((section) => ({
      contentHash: section.contentHash,
      documentId: "document:example",
      heading: section.heading ?? null,
      id: section.id,
      ordinal: section.ordinal,
      pageEnd: null,
      pageStart: null,
      sectionIdentifier: section.identifier ?? null,
      sourceEndOffset: section.endOffset,
      sourceStartOffset: section.startOffset,
      text: section.text
    })),
    text: canonicalText,
    updatedAt: new Date("2026-09-03T10:00:00.000Z")
  }
}

function ocrResult(): OcrResult {
  return {
    pageCount: 2,
    pages: [
      { endOffset: secondPageStart, pageNumber: 1, startOffset: 0 },
      { endOffset: sourceText.length, pageNumber: 2, startOffset: secondPageStart }
    ],
    provider: "azure-document-intelligence",
    text: sourceText
  }
}

describe("createOcrPageRangeRepairPlan", () => {
  it("maps every unchanged deterministic section without changing its identity", async () => {
    await expect(createOcrPageRangeRepairPlan(snapshot(), sourceBytes, ocrResult())).resolves.toEqual(
      new Map([
        [snapshot().sections[0]!.id, { pageEnd: 1, pageStart: 1 }],
        [snapshot().sections[1]!.id, { pageEnd: 2, pageStart: 2 }]
      ])
    )
  })

  it("refuses source, page-count, normalized-text, and section-manifest drift", async () => {
    await expect(
      createOcrPageRangeRepairPlan(snapshot(), new TextEncoder().encode("different artifact"), ocrResult())
    ).rejects.toThrow("retained artifact SHA-256")
    await expect(
      createOcrPageRangeRepairPlan(snapshot(), sourceBytes, { ...ocrResult(), pageCount: 3 })
    ).rejects.toThrow("page count")
    await expect(
      createOcrPageRangeRepairPlan(snapshot(), sourceBytes, { ...ocrResult(), text: `${sourceText} changed` })
    ).rejects.toThrow("normalized OCR text changed")

    const changedSection = snapshot()
    changedSection.sections[0] = { ...changedSection.sections[0]!, sourceEndOffset: 1 }
    await expect(createOcrPageRangeRepairPlan(changedSection, sourceBytes, ocrResult())).rejects.toThrow(
      "deterministic section 0 changed"
    )
  })

  it("refuses incomplete provider page spans instead of estimating ranges", async () => {
    await expect(
      createOcrPageRangeRepairPlan(snapshot(), sourceBytes, {
        ...ocrResult(),
        pages: [{ endOffset: sourceText.length, pageNumber: 1, startOffset: 0 }]
      })
    ).rejects.toThrow("complete page-span sequence")
  })
})

describe("hasCompleteOcrPageRanges", () => {
  it("accepts only complete ranges within the stored page count", () => {
    expect(hasCompleteOcrPageRanges([{ pageEnd: 2, pageStart: 1 }], 2)).toBe(true)
    expect(hasCompleteOcrPageRanges([{ pageEnd: 3, pageStart: 1 }], 2)).toBe(false)
    expect(hasCompleteOcrPageRanges([{ pageEnd: null, pageStart: null }], 2)).toBe(false)
  })
})

describe("validateOcrPageRangeRepairConcurrencyGuard", () => {
  it("refuses a same-source normal OCR rewrite before any page update can run", async () => {
    const original = snapshot()
    const ranges = await createOcrPageRangeRepairPlan(original, sourceBytes, ocrResult())
    const rewritten = {
      ...original,
      ocrCompletedAt: new Date("2026-09-03T10:05:00.000Z"),
      updatedAt: new Date("2026-09-03T10:05:00.000Z")
    }

    expect(() => validateOcrPageRangeRepairConcurrencyGuard(original, rewritten, rewritten.sections, ranges)).toThrow(
      "document changed while OCR was running"
    )
  })

  it("treats a concurrent identical metadata-only repair as already complete", async () => {
    const original = snapshot()
    const ranges = await createOcrPageRangeRepairPlan(original, sourceBytes, ocrResult())
    const repairedSections = original.sections.map((section) => ({ ...section, ...ranges.get(section.id)! }))

    expect(validateOcrPageRangeRepairConcurrencyGuard(original, original, repairedSections, ranges)).toBe(
      "already-complete"
    )
  })
})
