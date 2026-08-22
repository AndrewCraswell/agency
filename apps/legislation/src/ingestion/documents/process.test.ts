import { describe, expect, it } from "vitest"
import { classifyDocumentFailure } from "./process.js"

describe("document failure classification", () => {
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
