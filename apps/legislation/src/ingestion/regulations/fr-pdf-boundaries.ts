import { normalizeFrDocumentNumber } from "./fr-metadata-contract.js"

/** Publisher PDFs may contain adjacent publications. Footer detection flags evidence, never trims or approves text. */
export function auditFrPdfBoundaries(text: string, documentNumber: string) {
  const expected = normalizeFrDocumentNumber(documentNumber)
  const normalized = text.replaceAll(/[\u2010-\u2015]/g, "-")
  const sourceDocumentNumbers = [
    ...new Set(
      [...normalized.matchAll(/\bFR\s+Doc\.\s+([A-Za-z0-9]+(?:-[A-Za-z0-9]+)+)\s+Filed(?=\s|[0-9])/gi)].flatMap(
        (match) => (match[1] ? [normalizeFrDocumentNumber(match[1])] : [])
      )
    )
  ].sort()
  const foreignDocumentNumbers = sourceDocumentNumbers.filter((number) => number !== expected)
  let status = "expected_footer_not_found"
  if (foreignDocumentNumbers.length > 0) {
    status = "shared_page_text"
  } else if (sourceDocumentNumbers.includes(expected)) {
    status = "boundaries_unverified"
  }
  return {
    status,
    sourceDocumentNumbers,
    foreignDocumentNumbers,
    expectedFooterFound: sourceDocumentNumbers.includes(expected),
    publicationReady: false
  }
}
