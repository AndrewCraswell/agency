import { describe, expect, test } from "vitest"
import { AzureDocumentIntelligenceError, OcrNoUsableTextError } from "./ocr-client.js"
import { ocrStatusForFailure } from "./ocr-jobs.js"
import { classifyOcrFailure } from "./ocr-retry.js"

describe("classifyOcrFailure", () => {
  test("classifies a successful empty analysis as terminal unsupported content, not a transient error", () => {
    const failure = classifyOcrFailure(new OcrNoUsableTextError(), 1, 0)
    expect(failure).toEqual({
      category: "unsupported-format",
      message: "Azure Document Intelligence returned no usable text",
      retryable: false
    })
    expect(ocrStatusForFailure(failure)).toBe("unsupported")
    expect(failure.nextAttemptAt).toBeUndefined()
  })

  test("does not retry documents that produced too little usable text", () => {
    expect(classifyOcrFailure(new Error("Document produced too little usable text"), 1, 0)).toEqual({
      category: "malformed-document",
      message: "Document produced too little usable text",
      retryable: false
    })
  })

  test("uses short minute-scale fallback delays", () => {
    expect(classifyOcrFailure(new Error("Temporary OCR transport failure"), 1, 0).nextAttemptAt).toEqual(
      new Date(15_000)
    )
    expect(classifyOcrFailure(new Error("Temporary OCR transport failure"), 4, 0).nextAttemptAt).toEqual(
      new Date(120_000)
    )
  })

  test("caps provider retry-after delays at five minutes", () => {
    const error = new AzureDocumentIntelligenceError("Azure throttled OCR", {
      retryAfterMs: 60 * 60_000,
      retryable: true,
      status: 429
    })
    expect(classifyOcrFailure(error, 2, 0).nextAttemptAt).toEqual(new Date(5 * 60_000))
  })

  test("stops after the fifth attempt", () => {
    expect(classifyOcrFailure(new Error("Temporary OCR transport failure"), 5, 0)).toMatchObject({
      retryable: false
    })
  })
})
