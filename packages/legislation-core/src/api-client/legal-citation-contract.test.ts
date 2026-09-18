import { expect, it } from "vitest"
import { legalCitationRequestSchema, validateLegalCitationResponse } from "./legal-citation-contract"

const request = { citation: "21 CFR 177.2800", jurisdictionId: "jurisdiction:us" }
const candidate = {
  provisionId: "00000000-0000-4000-8000-000000000001",
  versionId: "00000000-0000-4000-8000-000000000002",
  codeId: "00000000-0000-4000-8000-000000000003",
  editionId: "00000000-0000-4000-8000-000000000004",
  jurisdictionId: "jurisdiction:us",
  codeKey: "cfr-title-21",
  codeName: "Code of Federal Regulations, title 21",
  citation: "cfr:21:section:177.2800",
  identityKey: "cfr:21:section:177.2800",
  nodeKind: "section",
  heading: "Indirect food additives",
  sourceLocator: "/ECFR[1]/DIV8[1]",
  textUrl:
    "/api/legal/versions/00000000-0000-4000-8000-000000000002/text?editionId=00000000-0000-4000-8000-000000000004"
}
const envelope = (data: unknown) => ({
  data,
  links: { self: "/api/legal/provisions/resolve" },
  meta: { correlationId: "test", warnings: [] }
})

it("requires one temporal selector and rejects unknown input", () => {
  expect(
    legalCitationRequestSchema.safeParse({ ...request, editionId: candidate.editionId, asOf: "2026-09-17" }).success
  ).toBe(false)
  expect(legalCitationRequestSchema.safeParse({ ...request, fuzzy: true }).success).toBe(false)
})

it("validates resolved, ambiguous and absent outcomes", () => {
  expect(
    validateLegalCitationResponse(
      envelope({
        input: request.citation,
        normalizedInput: candidate.citation,
        status: "resolved",
        match: candidate,
        candidates: [],
        truncated: false,
        refinement: null
      }),
      request
    ).data.status
  ).toBe("resolved")
  expect(
    validateLegalCitationResponse(
      envelope({
        input: request.citation,
        normalizedInput: "section:177.2800",
        status: "ambiguous",
        match: null,
        candidates: [candidate],
        truncated: true,
        refinement: "code_or_edition_required"
      }),
      request
    ).data.status
  ).toBe("ambiguous")
  expect(
    validateLegalCitationResponse(
      envelope({
        input: request.citation,
        normalizedInput: candidate.citation,
        status: "not_found",
        match: null,
        candidates: [],
        truncated: false,
        refinement: null
      }),
      request
    ).data.status
  ).toBe("not_found")
})

it("rejects candidates outside the requested scope", () => {
  expect(() =>
    validateLegalCitationResponse(
      envelope({
        input: request.citation,
        normalizedInput: candidate.citation,
        status: "ambiguous",
        match: null,
        candidates: [{ ...candidate, jurisdictionId: "jurisdiction:nc" }],
        truncated: false,
        refinement: "more_specific_citation_required"
      }),
      request
    )
  ).toThrow("legal_citation_response_mismatch")
  expect(() =>
    validateLegalCitationResponse(
      envelope({
        input: request.citation,
        normalizedInput: candidate.citation,
        status: "resolved",
        match: { ...candidate, textUrl: "/api/legal/versions/wrong/text" },
        candidates: [],
        truncated: false,
        refinement: null
      }),
      request
    )
  ).toThrow("legal_citation_response_mismatch")
})
