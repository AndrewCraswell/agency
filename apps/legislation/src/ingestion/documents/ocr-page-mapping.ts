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
 * Carries provider page spans through the same normalization used by document
 * extraction. Each normalized page must be the next meaningful content in the
 * canonical text, with only whitespace allowed between pages. This supports
 * harmless whitespace and Unicode normalization without estimating offsets.
 */
export function mapOcrPagesToDocumentSections(
  sourceText: string,
  canonicalText: string,
  sections: readonly ExtractedSection[],
  pages: readonly OcrPageSpan[]
): ReadonlyMap<string, DocumentSectionPageRange> {
  if (canonicalText !== normalizeLegalText(sourceText)) {
    return new Map()
  }

  const canonicalPages = mapPagesToCanonicalText(sourceText, canonicalText, pages)
  if (canonicalPages === undefined) {
    return new Map()
  }

  const mapped = new Map<string, DocumentSectionPageRange>()
  for (const section of sections) {
    if (!isValidSection(section, canonicalText.length)) {
      return new Map()
    }
    const matchingPages = canonicalPages.filter(
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

function mapPagesToCanonicalText(
  sourceText: string,
  canonicalText: string,
  pages: readonly OcrPageSpan[]
): readonly OcrPageSpan[] | undefined {
  if (pages.length === 0) {
    return undefined
  }

  const mapped: OcrPageSpan[] = []
  let previousSourceEnd = 0
  let previousCanonicalEnd = 0
  for (const [index, page] of pages.entries()) {
    if (
      !Number.isSafeInteger(page.pageNumber) ||
      page.pageNumber !== index + 1 ||
      !Number.isSafeInteger(page.startOffset) ||
      !Number.isSafeInteger(page.endOffset) ||
      page.startOffset < previousSourceEnd ||
      page.endOffset <= page.startOffset ||
      page.endOffset > sourceText.length ||
      normalizeLegalText(sourceText.slice(previousSourceEnd, page.startOffset)) !== ""
    ) {
      return undefined
    }

    const pageText = normalizeLegalText(sourceText.slice(page.startOffset, page.endOffset))
    if (pageText === "") {
      return undefined
    }
    const canonicalStart = canonicalText.indexOf(pageText, previousCanonicalEnd)
    if (canonicalStart === -1 || normalizeLegalText(canonicalText.slice(previousCanonicalEnd, canonicalStart)) !== "") {
      return undefined
    }
    mapped.push({
      endOffset: canonicalStart + pageText.length,
      pageNumber: page.pageNumber,
      startOffset: canonicalStart
    })
    previousSourceEnd = page.endOffset
    previousCanonicalEnd = canonicalStart + pageText.length
  }

  return normalizeLegalText(sourceText.slice(previousSourceEnd)) === "" &&
    normalizeLegalText(canonicalText.slice(previousCanonicalEnd)) === ""
    ? mapped
    : undefined
}

function isValidSection(section: ExtractedSection, canonicalLength: number): boolean {
  return (
    Number.isSafeInteger(section.startOffset) &&
    Number.isSafeInteger(section.endOffset) &&
    section.startOffset >= 0 &&
    section.endOffset > section.startOffset &&
    section.endOffset <= canonicalLength
  )
}
