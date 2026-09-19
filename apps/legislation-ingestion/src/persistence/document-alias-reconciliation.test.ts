import { expect, it } from "vitest"
import { assertUntouchedDocumentAlias } from "./document-alias-reconciliation.js"

const pending = {
  id: "new",
  billId: "bill:wa:2025-2026:hb:1002",
  classification: "version",
  sourceUrl: "https://example.gov/1002.pdf",
  contentHash: null,
  processingStatus: "pending",
  processingAttempts: 0,
  text: null,
  blobPath: null,
  ocrStatus: null,
  ocrProvider: null,
  ocrCompletedAt: null,
  ocrPageCount: null
}
const hash = "a".repeat(64)
const keep = {
  ...pending,
  id: "old",
  sourceUrl: "http://example.gov/1002.pdf",
  processingStatus: "processed",
  contentHash: hash
}
it("accepts only freshly verified untouched transport aliases", () => {
  expect(() => assertUntouchedDocumentAlias(keep, pending, hash)).not.toThrow()
})
it.each([
  { id: "old" },
  { billId: "other" },
  { classification: "amendment" },
  { sourceUrl: "https://example.gov/1002.pdf?version=2" },
  { sourceUrl: keep.sourceUrl },
  { processingStatus: "processing" },
  { processingStatus: "processed" },
  { processingAttempts: 1 },
  { contentHash: hash },
  { text: "retained" },
  { blobPath: "file.pdf" },
  { ocrStatus: "failed" },
  { ocrProvider: "provider" },
  { ocrCompletedAt: new Date() },
  { ocrPageCount: 1 }
])("rejects unsafe removal: %j", (change) => {
  expect(() => assertUntouchedDocumentAlias(keep, { ...pending, ...change }, hash)).toThrow()
})
it("rejects changed bytes or unprocessed targets", () => {
  expect(() => assertUntouchedDocumentAlias(keep, pending, "b".repeat(64))).toThrow()
  expect(() => assertUntouchedDocumentAlias({ ...keep, processingStatus: "pending" }, pending, hash)).toThrow()
})
