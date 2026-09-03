import { describe, expect, it } from "vitest"
import { DocumentExtractionError } from "./extract.js"
import { classifyDocumentFailure, ocrStatusForDocumentFailure } from "./process.js"

describe("document failure classification", () => {
  it("does not fabricate an OCR failure for a generic retryable extraction failure", () => {
    expect(ocrStatusForDocumentFailure({ category: "download-transient", status: "failed" })).toBeUndefined()
    expect(ocrStatusForDocumentFailure({ category: "ocr-required", status: "unsupported" })).toBe("pending")
    expect(ocrStatusForDocumentFailure({ category: "unsupported-format", status: "unsupported" })).toBe("unsupported")
    expect(
      ocrStatusForDocumentFailure({ category: "processing-transient", ocrStatus: "failed", status: "unsupported" })
    ).toBe("failed")
  })

  it("classifies a successfully fetched legacy Word response as terminal without persistence", () => {
    expect(classifyDocumentFailure(new Error("Unsupported document content type: application/msword"))).toEqual({
      category: "unsupported-format",
      message: "Unsupported document content type: application/msword",
      retryable: false
    })
  })

  it("treats corrupt PDF flate streams as terminal malformed documents", () => {
    expect(classifyDocumentFailure(new Error("Bad uncompressed block length in flate stream"))).toEqual({
      category: "malformed-document",
      message: "Bad uncompressed block length in flate stream",
      retryable: false
    })
  })

  it("uses typed extraction outcomes and never mistakes encryption or corruption for OCR eligibility", () => {
    expect(classifyDocumentFailure(new DocumentExtractionError("ocr-required", "PDF has scanned pages"))).toEqual({
      category: "ocr-required",
      message: "PDF has scanned pages",
      retryable: false
    })

    const encrypted = new Error("No password given")
    encrypted.name = "PasswordException"
    expect(classifyDocumentFailure(encrypted)).toEqual({
      category: "unsupported-format",
      message: "No password given",
      retryable: false
    })

    const corrupt = new Error("Unexpected parser failure")
    corrupt.name = "InvalidPDFException"
    expect(classifyDocumentFailure(corrupt)).toEqual({
      category: "malformed-document",
      message: "Unexpected parser failure",
      retryable: false
    })
  })

  it("treats the retired Kentucky LRC host as terminally inaccessible", () => {
    expect(
      classifyDocumentFailure(
        new TypeError("fetch failed"),
        "http://www.lrc.ky.gov/recorddocuments/bill/17RS/HB79/bill.pdf"
      )
    ).toEqual({
      category: "source-inaccessible",
      message: "fetch failed",
      retryable: false
    })
  })

  it("does not broaden Kentucky's terminal classification beyond the exact legacy host", () => {
    expect(
      classifyDocumentFailure(
        new TypeError("fetch failed"),
        "http://lrc.ky.gov/recorddocuments/bill/17RS/HB79/bill.pdf"
      )
    ).toMatchObject({ category: "download-transient", retryable: true })
  })
})
