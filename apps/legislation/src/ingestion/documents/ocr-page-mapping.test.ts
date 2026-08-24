import { describe, expect, it } from "vitest"
import { segmentLegalText } from "./extract.js"
import { mapOcrPagesToDocumentSections } from "./ocr-page-mapping.js"

describe("mapOcrPagesToDocumentSections", () => {
  it("persists a page range only when source OCR offsets exactly match canonical text", () => {
    const text = "SECTION 1. SHORT TITLE.\nThis is the first page.\nSECTION 2. DATA.\nThis is the second page."
    const sections = segmentLegalText("document:example", text)
    const secondPageStart = text.indexOf("SECTION 2")

    expect(
      mapOcrPagesToDocumentSections(text, text, sections, [
        { endOffset: secondPageStart, pageNumber: 1, startOffset: 0 },
        { endOffset: text.length, pageNumber: 2, startOffset: secondPageStart }
      ])
    ).toEqual(
      new Map([
        [sections[0]!.id, { pageEnd: 1, pageStart: 1 }],
        [sections[1]!.id, { pageEnd: 2, pageStart: 2 }]
      ])
    )
  })

  it("fails closed when canonical normalization changes a provider offset", () => {
    const sourceText = "SECTION 1. TITLE.  \r\nRecognized text."
    const canonicalText = "SECTION 1. TITLE.\nRecognized text."
    const sections = segmentLegalText("document:example", canonicalText)

    expect(
      mapOcrPagesToDocumentSections(sourceText, canonicalText, sections, [
        { endOffset: sourceText.length, pageNumber: 1, startOffset: 0 }
      ])
    ).toEqual(new Map())
  })

  it("fails closed for partial, overlapping, or non-sequential provider pages", () => {
    const text = "SECTION 1. TITLE.\nRecognized text."
    const sections = segmentLegalText("document:example", text)

    expect(
      mapOcrPagesToDocumentSections(text, text, sections, [
        { endOffset: text.length - 1, pageNumber: 1, startOffset: 0 }
      ])
    ).toEqual(new Map())
    expect(
      mapOcrPagesToDocumentSections(text, text, sections, [{ endOffset: text.length, pageNumber: 2, startOffset: 0 }])
    ).toEqual(new Map())
  })
})
