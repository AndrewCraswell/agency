import { expect, it } from "vitest"
import {
  legalEditionsRequestSchema,
  legalProvisionsRequestSchema,
  validateLegalProvisionsResponse
} from "./legal-browse-contract"

it("rejects conflicting traversal, reversed dates and unsupported filters", () => {
  for (const value of [{ issuedFrom: "2026-01-01", issuedTo: "2025-01-01" }, { sourceId: "vendor" }, { extra: true }]) {
    expect(legalEditionsRequestSchema.safeParse(value).success).toBe(false)
  }
  const id = "00000000-0000-4000-8000-000000000001"
  for (const value of [
    { traversal: "all", parentId: id },
    { editionId: id, asOf: "2025-01-01" },
    { nodeKind: "section OR 1=1" },
    { limit: 101 }
  ]) {
    expect(legalProvisionsRequestSchema.safeParse(value).success).toBe(false)
  }
})

it("rejects a different selected code even when the provision page is empty", () => {
  const id = "00000000-0000-4000-8000-000000000001"
  const other = "00000000-0000-4000-8000-000000000002"
  const response = {
    data: [],
    links: { self: `/api/legal/codes/${id}/provisions`, next: null },
    meta: {
      correlationId: "test",
      limit: 20,
      nextCursor: null,
      truncated: false,
      warnings: [],
      selectedEdition: {
        id,
        codeId: other,
        sourceId: "ecfr",
        jurisdictionId: "jurisdiction:us",
        rightsProfileId: "official",
        sourceObservationId: "a".repeat(64),
        nativeKey: "2026-09-10",
        sourceRevision: "revision",
        sourceUrl: "https://www.ecfr.gov/",
        issueDate: null,
        sourceCurrencyDate: null,
        publishedAt: "2026-09-15T00:00:00Z",
        scope: "current_code_snapshot"
      }
    }
  }
  expect(() => validateLegalProvisionsResponse(response, id, {})).toThrow("legal_provisions_response_mismatch")
})
