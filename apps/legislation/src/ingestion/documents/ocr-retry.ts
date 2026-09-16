import { AzureDocumentIntelligenceError, OcrNoUsableTextError } from "./ocr-client.js"
import { classifyDocumentFailure, type DocumentFailureCategory } from "./process.js"

export const OCR_MAXIMUM_ATTEMPTS = 5

const OCR_RETRY_BASE_DELAY_MS = 15_000
const OCR_RETRY_MAXIMUM_DELAY_MS = 5 * 60_000

export interface OcrFailureClassification {
  category: DocumentFailureCategory
  message: string
  nextAttemptAt?: Date
  retryable: boolean
}

export function classifyOcrFailure(error: unknown, attempt: number, from = Date.now()): OcrFailureClassification {
  if (error instanceof OcrNoUsableTextError) {
    // Use the existing terminal unsupported-content contract. Keep the precise
    // reason: no recognized text does not prove that a source is blank.
    return { category: "unsupported-format", message: error.message, retryable: false }
  }
  const documentFailure = classifyDocumentFailure(error)
  const providerRetryable = !(error instanceof AzureDocumentIntelligenceError) || error.retryable
  const retryable = documentFailure.retryable && providerRetryable && attempt < OCR_MAXIMUM_ATTEMPTS

  if (!retryable) {
    return {
      category: documentFailure.category === "ocr-required" ? "malformed-document" : documentFailure.category,
      message: documentFailure.message,
      retryable: false
    }
  }

  const providerDelay = error instanceof AzureDocumentIntelligenceError ? error.retryAfterMs : undefined
  const fallbackDelay = OCR_RETRY_BASE_DELAY_MS * 2 ** Math.max(attempt - 1, 0)
  const delay = Math.min(providerDelay ?? fallbackDelay, OCR_RETRY_MAXIMUM_DELAY_MS)
  return {
    category: "ocr-required",
    message: documentFailure.message,
    nextAttemptAt: new Date(from + delay),
    retryable: true
  }
}
