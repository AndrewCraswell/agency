import { describe, expect, it } from "vitest"
import type { CanonicalDocumentDetailRead } from "../../legislation/persistence/queries/document-reads"
import { projectDocumentDetailRead, projectDocumentSummaryRead } from "./document-read-projection"

const baseUrl = "https://api.example.test"

function document(): CanonicalDocumentDetailRead {
  return {
    billId: "bill:us:119:hr:1",
    byteSize: null,
    classification: "version",
    contentHash: null,
    createdAt: new Date("2026-08-20T15:00:00Z"),
    documentDate: null,
    failureCategory: null,
    id: "document:us:119:hr:1:ih",
    mimeType: "text/html",
    ocrCompletedAt: null,
    ocrProvider: null,
    ocrStatus: "not-required",
    pageCount: null,
    processingStatus: "processed",
    sectionCount: 0,
    sourceUrl: "https://publisher.example.test/bill/1",
    storedUrl: null,
    textCharacterCount: 0,
    title: "Introduced in House",
    updatedAt: new Date("2026-08-21T15:00:00Z"),
    versionCode: "ih"
  }
}

describe("document read projection", () => {
  it("preserves unknown artifact facts, recorded zeros and unclassified source provenance", () => {
    const value = document()
    const summary = projectDocumentSummaryRead(value, baseUrl)
    const detail = projectDocumentDetailRead(value, baseUrl)

    expect(summary).toMatchObject({
      canonicalUrl: `${baseUrl}/api/documents/document%3Aus%3A119%3Ahr%3A1%3Aih`,
      documentDate: null,
      ocrStatus: "not-required",
      storedUrl: null,
      sources: [{ isOfficial: false, sourceUrl: value.sourceUrl }]
    })
    expect(detail).toMatchObject({
      ...summary,
      byteSize: null,
      pageCount: null,
      sectionCount: 0,
      textCharacterCount: 0
    })
  })

  it.each(["ocrStatus", "processingStatus"])("rejects incomplete persisted %s in both projections", (field) => {
    const value = document()
    Reflect.set(value, field, null)

    for (const project of [projectDocumentSummaryRead, projectDocumentDetailRead]) {
      expect(() => project(value, baseUrl)).toThrow(expect.objectContaining({ category: "unprocessable" }))
    }
  })
})
