import { describe, expect, it } from "vitest"
import { segmentLegalText } from "./extract.js"
import { mapOcrPagesToDocumentSections } from "./ocr-page-mapping.js"

describe("mapOcrPagesToDocumentSections", () => {
  it("persists page ranges when source OCR offsets exactly match canonical text", () => {
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

  it("maps pages through canonical whitespace and Unicode normalization", () => {
    const sourceText = "  SECTION 1. CAFE\u0301.  \r\n  First\tpage.  \r\n\r\n SECTION 2. DATA.\rSecond   page.  "
    const canonicalText = "SECTION 1. CAFÉ.\nFirst page.\n\nSECTION 2. DATA.\nSecond page."
    const sections = segmentLegalText("document:example", canonicalText)
    const secondPageStart = sourceText.indexOf(" SECTION 2")

    expect(
      mapOcrPagesToDocumentSections(sourceText, canonicalText, sections, [
        { endOffset: secondPageStart, pageNumber: 1, startOffset: 0 },
        { endOffset: sourceText.length, pageNumber: 2, startOffset: secondPageStart }
      ])
    ).toEqual(
      new Map([
        [sections[0]!.id, { pageEnd: 1, pageStart: 1 }],
        [sections[1]!.id, { pageEnd: 2, pageStart: 2 }]
      ])
    )
  })

  it("uses Azure UTF-16 offsets when supplementary characters precede a page boundary", () => {
    const sourceText = "SECTION 1. TITLE.\r\nA 😀 appears on page one.\r\nSECTION 2. DATA.\r\nPage two text."
    const canonicalText = "SECTION 1. TITLE.\nA 😀 appears on page one.\nSECTION 2. DATA.\nPage two text."
    const sections = segmentLegalText("document:example", canonicalText)
    const secondPageStart = sourceText.indexOf("SECTION 2")

    expect(
      mapOcrPagesToDocumentSections(sourceText, canonicalText, sections, [
        { endOffset: secondPageStart, pageNumber: 1, startOffset: 0 },
        { endOffset: sourceText.length, pageNumber: 2, startOffset: secondPageStart }
      ])
    ).toEqual(
      new Map([
        [sections[0]!.id, { pageEnd: 1, pageStart: 1 }],
        [sections[1]!.id, { pageEnd: 2, pageStart: 2 }]
      ])
    )
  })

  it("maps repeated page text in source order without ambiguity", () => {
    const repeatedPage = "The same sufficiently long legislative text appears on this page."
    const sourceText = `${repeatedPage}\r\n\r\n${repeatedPage}`
    const canonicalText = `${repeatedPage}\n\n${repeatedPage}`
    const sections = segmentLegalText("document:example", canonicalText)
    const secondPageStart = sourceText.lastIndexOf(repeatedPage)

    expect(
      mapOcrPagesToDocumentSections(sourceText, canonicalText, sections, [
        { endOffset: repeatedPage.length, pageNumber: 1, startOffset: 0 },
        { endOffset: sourceText.length, pageNumber: 2, startOffset: secondPageStart }
      ])
    ).toEqual(new Map([[sections[0]!.id, { pageEnd: 2, pageStart: 1 }]]))
  })

  it("maps a section spanning a page boundary to both pages", () => {
    const sourceText = "Legislative findings begin on page one.\r\n\r\nThey continue on page two without a new heading."
    const canonicalText = "Legislative findings begin on page one.\n\nThey continue on page two without a new heading."
    const sections = segmentLegalText("document:example", canonicalText)
    const secondPageStart = sourceText.indexOf("They continue")

    expect(
      mapOcrPagesToDocumentSections(sourceText, canonicalText, sections, [
        { endOffset: secondPageStart, pageNumber: 1, startOffset: 0 },
        { endOffset: sourceText.length, pageNumber: 2, startOffset: secondPageStart }
      ])
    ).toEqual(new Map([[sections[0]!.id, { pageEnd: 2, pageStart: 1 }]]))
  })

  it("keeps sections on exact page boundaries assigned to the correct page", () => {
    const sourceText = "SECTION 1. TITLE.\nFirst page text.\n\nSECTION 2. DATA.\nSecond page text."
    const sections = segmentLegalText("document:example", sourceText)
    const secondPageStart = sourceText.indexOf("SECTION 2")

    expect(
      mapOcrPagesToDocumentSections(sourceText, sourceText, sections, [
        { endOffset: secondPageStart, pageNumber: 1, startOffset: 0 },
        { endOffset: sourceText.length, pageNumber: 2, startOffset: secondPageStart }
      ])
    ).toEqual(
      new Map([
        [sections[0]!.id, { pageEnd: 1, pageStart: 1 }],
        [sections[1]!.id, { pageEnd: 2, pageStart: 2 }]
      ])
    )
  })

  it("preserves a trailing blank page without assigning content to it", () => {
    const text = "SECTION 1. TITLE.\nRecognized text."
    const sections = segmentLegalText("document:example", text)

    expect(
      mapOcrPagesToDocumentSections(text, text, sections, [
        { endOffset: text.length, pageNumber: 1, startOffset: 0 },
        { endOffset: text.length, pageNumber: 2, startOffset: text.length }
      ])
    ).toEqual(new Map([[sections[0]!.id, { pageEnd: 1, pageStart: 1 }]]))
  })

  it("preserves a blank page between content pages and keeps later page numbers", () => {
    const text = "SECTION 1. TITLE.\nFirst page.\n\nSECTION 2. DATA.\nThird page."
    const sections = segmentLegalText("document:example", text)
    const thirdPageStart = text.indexOf("SECTION 2")

    expect(
      mapOcrPagesToDocumentSections(text, text, sections, [
        { endOffset: thirdPageStart, pageNumber: 1, startOffset: 0 },
        { endOffset: thirdPageStart, pageNumber: 2, startOffset: thirdPageStart },
        { endOffset: text.length, pageNumber: 3, startOffset: thirdPageStart }
      ])
    ).toEqual(
      new Map([
        [sections[0]!.id, { pageEnd: 1, pageStart: 1 }],
        [sections[1]!.id, { pageEnd: 3, pageStart: 3 }]
      ])
    )
  })

  it("allows whitespace-only gaps between provider page spans", () => {
    const sourceText = "SECTION 1. TITLE.\nFirst page text.\n\nSECTION 2. DATA.\nSecond page text."
    const sections = segmentLegalText("document:example", sourceText)
    const gapStart = sourceText.indexOf("\n\n")
    const secondPageStart = sourceText.indexOf("SECTION 2")

    expect(
      mapOcrPagesToDocumentSections(sourceText, sourceText, sections, [
        { endOffset: gapStart, pageNumber: 1, startOffset: 0 },
        { endOffset: sourceText.length, pageNumber: 2, startOffset: secondPageStart }
      ])
    ).toEqual(
      new Map([
        [sections[0]!.id, { pageEnd: 1, pageStart: 1 }],
        [sections[1]!.id, { pageEnd: 2, pageStart: 2 }]
      ])
    )
  })

  it("fails closed for incomplete, overlapping, non-sequential, or out-of-bounds provider spans", () => {
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
    expect(
      mapOcrPagesToDocumentSections(text, text, sections, [
        { endOffset: 20, pageNumber: 1, startOffset: 0 },
        { endOffset: text.length, pageNumber: 2, startOffset: 19 }
      ])
    ).toEqual(new Map())
    expect(
      mapOcrPagesToDocumentSections(text, text, sections, [
        { endOffset: text.length + 1, pageNumber: 1, startOffset: 0 }
      ])
    ).toEqual(new Map())
    expect(
      mapOcrPagesToDocumentSections(text, text, sections, [
        { endOffset: 20, pageNumber: 1, startOffset: 0 },
        { endOffset: 19, pageNumber: 2, startOffset: 19 }
      ])
    ).toEqual(new Map())
  })

  it("fails closed when an unassigned provider gap contains text", () => {
    const text = "SECTION 1. TITLE.\nFirst page. UNASSIGNED SECTION 2. DATA.\nSecond page."
    const sections = segmentLegalText("document:example", text)
    const gapStart = text.indexOf(" UNASSIGNED")
    const secondPageStart = text.indexOf("SECTION 2")

    expect(
      mapOcrPagesToDocumentSections(text, text, sections, [
        { endOffset: gapStart, pageNumber: 1, startOffset: 0 },
        { endOffset: text.length, pageNumber: 2, startOffset: secondPageStart }
      ])
    ).toEqual(new Map())
  })

  it("fails closed when canonical text is not the normalized provider text", () => {
    const sourceText = "SECTION 1. TITLE.  \r\nRecognized text."
    const canonicalText = "SECTION 1. DIFFERENT TITLE.\nRecognized text."
    const sections = segmentLegalText("document:example", canonicalText)

    expect(
      mapOcrPagesToDocumentSections(sourceText, canonicalText, sections, [
        { endOffset: sourceText.length, pageNumber: 1, startOffset: 0 }
      ])
    ).toEqual(new Map())
  })

  it("fails closed when a section has malformed canonical offsets", () => {
    const text = "SECTION 1. TITLE.\nRecognized text."
    const [section] = segmentLegalText("document:example", text)
    if (section === undefined) {
      throw new Error("Expected a section fixture")
    }

    expect(
      mapOcrPagesToDocumentSections(
        text,
        text,
        [{ ...section, endOffset: text.length + 1 }],
        [{ endOffset: text.length, pageNumber: 1, startOffset: 0 }]
      )
    ).toEqual(new Map())
  })
})
