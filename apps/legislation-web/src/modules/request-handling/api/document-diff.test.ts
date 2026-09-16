import { describe, expect, it } from "vitest"
import type { DocumentSummary } from "./canonical-projection.js"
import { diffText, buildDocumentDiff, type DiffSection } from "./document-diff.js"

const source = {
  isOfficial: true,
  provider: "congress",
  retrievedAt: "2026-08-25T00:00:00.000Z",
  sourceUpdatedAt: null,
  sourceUrl: "https://example.test/source"
} as const

function document(id: string): DocumentSummary {
  return {
    billId: "bill:us:119:hr:1",
    canonicalUrl: `https://api.example.test/api/documents/${id}`,
    classification: "version",
    contentHash: "a".repeat(64),
    documentDate: "2026-01-01",
    id,
    mimeType: "text/plain",
    ocrStatus: "processed",
    processingStatus: "processed",
    sourceUrl: "https://example.test/document",
    sources: [source],
    storedUrl: null,
    title: "Bill text",
    type: "document",
    updatedAt: "2026-08-25T00:00:00.000Z",
    versionCode: "ih"
  }
}

function section(id: string, ordinal: number, text: string, sectionIdentifier: string | null = null): DiffSection {
  return {
    id,
    ordinal,
    sectionIdentifier,
    sourceEndOffset: text.length,
    sourceStartOffset: 0,
    text
  }
}

describe("document diff engine", () => {
  it("emits exact zero-based half-open word offsets and preserves text", () => {
    expect(diffText("one two", "one three", "word")).toEqual([
      { classification: "equal", leftEnd: 4, leftStart: 0, rightEnd: 4, rightStart: 0, text: "one " },
      { classification: "insert", leftEnd: null, leftStart: null, rightEnd: 9, rightStart: 4, text: "three" },
      { classification: "delete", leftEnd: 7, leftStart: 4, rightEnd: null, rightStart: null, text: "two" }
    ])
  })

  it("matches stable section identifiers before ordinal fallback and counts all hunks", () => {
    const result = buildDocumentDiff({
      billId: "bill:us:119:hr:1",
      granularity: "paragraph",
      left: {
        document: document("document:left"),
        sections: [section("left:a", 0, "Unchanged", "A"), section("left:b", 1, "Old", "B")]
      },
      right: {
        document: document("document:right"),
        sections: [
          section("right:new", 0, "New", "N"),
          section("right:a", 1, "Unchanged", "A"),
          section("right:b", 2, "New value", "B")
        ]
      }
    })

    expect(result.counts).toEqual({ added: 1, changed: 1, removed: 0, unchanged: 1 })
    expect(result.allHunks.map((hunk) => hunk.classification)).toEqual(["unchanged", "changed", "added"])
    expect(result.allHunks[1]).toMatchObject({ leftSectionId: "left:b", rightSectionId: "right:b" })
  })

  it("rejects a word-level diff before allocating an unsafe LCS matrix", () => {
    const left = "left ".repeat(2_001)
    const right = "right ".repeat(2_001)

    expect(() => diffText(left, right, "word")).toThrow("Document diff hunk exceeds the allowed size")
  })
})
