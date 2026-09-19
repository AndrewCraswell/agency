import { expect, it } from "vitest"
import { prepareBillDocument } from "./bill-document-lifecycle.js"

const input = {
  id: "doc:new",
  billId: "bill:wa:2025-2026:hb:1002",
  sourceUrl: "https://example.org/bill.pdf",
  classification: "version",
  title: "Bill"
}

it("initializes unevaluated documents without claiming OCR was unnecessary", () => {
  expect(prepareBillDocument(input).ocrStatus).toBe("pending")
  expect(prepareBillDocument({ ...input, processingStatus: "pending", ocrStatus: null }).ocrStatus).toBe("pending")
})

it.each(["processing", "processed", "failed", "unsupported"])("does not infer OCR results from %s", (status) => {
  expect(prepareBillDocument({ ...input, processingStatus: status, ocrStatus: null }).ocrStatus).toBeNull()
})

it("preserves processing provenance and retry state while refreshing metadata", () => {
  const existing = {
    ...input,
    id: "doc:existing",
    title: "Old title",
    processingStatus: "processed",
    text: "retained text",
    blobPath: "retained/file.pdf",
    contentHash: "a".repeat(64),
    pageCount: 3,
    ocrStatus: "processed",
    ocrProvider: "provider",
    ocrCompletedAt: new Date("2026-09-19T00:00:00Z"),
    ocrPageCount: 3,
    lastAttemptAt: new Date("2026-09-18T00:00:00Z"),
    nextAttemptAt: null,
    processingAttempts: 2,
    processingError: null,
    processingErrorCategory: null
  }
  expect(prepareBillDocument({ ...input, title: "Refreshed title", ocrStatus: "pending" }, existing)).toEqual({
    ...existing,
    title: "Refreshed title"
  })
})

it("repairs only the missing pending state on metadata replay and is idempotent", () => {
  const existing = { ...input, processingStatus: "pending", ocrStatus: null }
  const prepared = prepareBillDocument(input, existing)
  expect(prepared.ocrStatus).toBe("pending")
  expect(prepareBillDocument(input, prepared)).toEqual(prepared)
})

it("preserves an explicit OCR state", () => {
  expect(prepareBillDocument({ ...input, ocrStatus: "failed" }).ocrStatus).toBe("failed")
})
