import { describe, expect, it } from "vitest"
import { ocrStatusForFailure } from "./ocr-jobs.js"

describe("OCR lifecycle failure state", () => {
  it("marks terminal unsupported OCR input as unsupported", () => {
    expect(ocrStatusForFailure({ category: "unsupported-format", message: "unsupported", retryable: false })).toBe(
      "unsupported"
    )
  })

  it("keeps retryable and exhausted transient execution errors failed", () => {
    expect(ocrStatusForFailure({ category: "ocr-required", message: "busy", retryable: true })).toBe("failed")
    expect(ocrStatusForFailure({ category: "processing-transient", message: "exhausted", retryable: false })).toBe(
      "failed"
    )
  })
})
