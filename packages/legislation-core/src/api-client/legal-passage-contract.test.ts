import { expect, it } from "vitest"
import {
  legalPassageRequestSchema,
  legalPassagesRequestSchema,
  validateLegalPassageResponse,
  validateLegalPassagesResponse
} from "./legal-passage-contract"

const versionId = "00000000-0000-4000-8000-000000000001"
const editionId = "00000000-0000-4000-8000-000000000002"
const passageId = "a".repeat(64)
const context = {
  kind: "provision" as const,
  editionId,
  provisionId: "00000000-0000-4000-8000-000000000003",
  versionId,
  sourceObservationId: "b".repeat(64),
  sourceId: "ecfr",
  rightsPolicyHash: "c".repeat(64),
  parentId: null,
  sourceLocator: "/ECFR[1]",
  sourceCurrencyDate: "2026-09-17",
  selectedDate: null,
  basis: "observed_snapshot" as const,
  legalStatus: "unknown" as const
}
const passage = {
  id: passageId,
  generationId: "d".repeat(64),
  versionId,
  ordinal: 0,
  start: 0,
  end: 11,
  text: "Source text",
  tokenCount: 3,
  readerSpans: [{ blockId: "e".repeat(64), start: 0, end: 11 }],
  contextSpans: [],
  inputHash: "f".repeat(64),
  rowContinuation: null,
  selectedContext: context,
  textUrl: `/api/legal/versions/${versionId}/text?editionId=${editionId}&anchor=${"e".repeat(64)}`
}

it("requires one exact source context for list and detail reads", () => {
  for (const schema of [legalPassageRequestSchema, legalPassagesRequestSchema]) {
    expect(schema.safeParse({}).success).toBe(false)
    expect(schema.safeParse({ editionId, sourceObservationId: editionId }).success).toBe(false)
    expect(schema.safeParse({ editionId }).success).toBe(true)
  }
})

it("validates bounded ordered pages and binds every passage to the requested context", () => {
  const response = {
    data: [passage],
    links: { self: `/api/legal/versions/${versionId}/passages`, next: null },
    meta: { correlationId: "test", limit: 20, nextCursor: null, truncated: false, warnings: [] }
  }
  expect(validateLegalPassagesResponse(response, versionId, { editionId }).data).toEqual([passage])
  expect(() => validateLegalPassagesResponse(response, versionId, { sourceObservationId: editionId })).toThrow(
    "legal_passages_response_mismatch"
  )
  expect(() =>
    validateLegalPassagesResponse({ ...response, meta: { ...response.meta, truncated: true } }, versionId, {
      editionId
    })
  ).toThrow("legal_passages_response_mismatch")
})

it("validates direct identities without exposing embedding input text", () => {
  const response = {
    data: passage,
    links: { self: `/api/legal/passages/${passageId}` },
    meta: { correlationId: "test", warnings: [] }
  }
  expect(validateLegalPassageResponse(response, passageId, { editionId }).data.text).toBe("Source text")
  expect(() => validateLegalPassageResponse(response, "0".repeat(64), { editionId })).toThrow(
    "legal_passage_response_mismatch"
  )
  expect(() =>
    validateLegalPassageResponse({ ...response, data: { ...passage, inputText: "private" } }, passageId, { editionId })
  ).toThrow()
})
