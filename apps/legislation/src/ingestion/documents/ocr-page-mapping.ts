import { normalizeLegalText, type ExtractedSection } from "./extract.js"

export interface OcrPageSpan {
  endOffset: number
  pageNumber: number
  startOffset: number
}

export interface DocumentSectionPageRange {
  pageEnd: number
  pageStart: number
}

/**
 * Returns page ranges only when OCR offsets can be carried into the canonical
 * text without transformation. The Read service offsets describe its original
 * content string, whereas persisted section offsets describe normalized legal
 * text. Treat any normalization change as unknown instead of guessing a page.
 */
export function mapOcrPagesToDocumentSections(
  sourceText: string,
  canonicalText: string,
  sections: readonly ExtractedSection[],
  pages: readonly OcrPageSpan[]
): ReadonlyMap<string, DocumentSectionPageRange> {
  if (
    normalizeLegalText(sourceText) !== sourceText ||
    canonicalText !== sourceText ||
    !hasContiguousPageSpans(sourceText, pages)
  ) {
    return new Map()
  }

  const mapped = new Map<string, DocumentSectionPageRange>()
  for (const section of sections) {
    const matchingPages = pages.filter(
      (page) => section.startOffset < page.endOffset && section.endOffset > page.startOffset
    )
    if (matchingPages.length === 0) {
      continue
    }
    mapped.set(section.id, {
      pageEnd: matchingPages.at(-1)?.pageNumber ?? matchingPages[0]!.pageNumber,
      pageStart: matchingPages[0]!.pageNumber
    })
  }
  return mapped
}

function hasContiguousPageSpans(sourceText: string, pages: readonly OcrPageSpan[]): boolean {
  if (pages.length === 0) {
    return false
  }
  let nextOffset = 0
  for (const [index, page] of pages.entries()) {
    if (
      !Number.isSafeInteger(page.pageNumber) ||
      page.pageNumber !== index + 1 ||
      !Number.isSafeInteger(page.startOffset) ||
      !Number.isSafeInteger(page.endOffset) ||
      page.startOffset !== nextOffset ||
      page.endOffset <= page.startOffset
    ) {
      return false
    }
    nextOffset = page.endOffset
  }
  return nextOffset === sourceText.length
}
