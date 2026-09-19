import { expect, it } from "vitest"
import { findBillDocumentIdentity } from "./bill-document-identity.js"

const stored = {
  id: "old",
  billId: "bill:wa:2025-2026:hb:1000",
  classification: "version",
  sourceUrl: "http://example.gov/1000.pdf?version=1"
}
const incoming = { ...stored, id: "new", sourceUrl: "https://example.gov/1000.pdf?version=1" }

it("reuses the identity of the same default HTTPS download target", () => {
  expect(findBillDocumentIdentity(incoming, [stored])).toBe(stored)
  expect(findBillDocumentIdentity(stored, [incoming])).toBe(incoming)
})

it.each([
  { billId: "bill:wa:2023-2024:hb:1000" },
  { classification: "supporting" },
  { sourceUrl: "https://example.gov/1000.pdf?version=2" },
  { sourceUrl: "https://example.gov/1000.htm?version=1" },
  { sourceUrl: "https://other.gov/1000.pdf?version=1" },
  { sourceUrl: "https://example.gov/1000.PDF?version=1" }
])("does not conflate distinct source identity: %j", (change) => {
  expect(findBillDocumentIdentity({ ...incoming, ...change }, [stored])).toBeUndefined()
})

it("retains exact-ID precedence for already duplicated records without silently merging them", () => {
  expect(findBillDocumentIdentity(incoming, [stored, incoming])).toBe(incoming)
})

it("rejects ambiguous transport aliases", () => {
  expect(() => findBillDocumentIdentity(incoming, [stored, { ...stored, id: "duplicate" }])).toThrow("ambiguous")
})

it("does not reject unrelated unsupported source metadata", () => {
  expect(findBillDocumentIdentity(incoming, [{ ...stored, sourceUrl: "ftp://example.gov/file.pdf" }])).toBeUndefined()
})
