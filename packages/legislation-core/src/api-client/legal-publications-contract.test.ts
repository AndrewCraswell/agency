import { expect, it } from "vitest"
import {
  legalPublicationDetailSchema,
  validateLegalPublicationResponse,
  validateLegalPublicationsResponse
} from "./legal-publications-contract"

const documentId = "00000000-0000-4000-8000-000000000001"
const versionId = "00000000-0000-4000-8000-000000000002"
const observationId = "00000000-0000-4000-8000-000000000003"
const publication = legalPublicationDetailSchema.parse({
  id: documentId,
  versionId,
  sourceObservationId: observationId,
  jurisdictionId: "jurisdiction:us",
  sourceId: "federal-register",
  nativeNumber: "00-100",
  title: "Retirement eligibility",
  citation: "65 FR 2521",
  publicationKind: "final_rule",
  publishedOn: "2000-01-18",
  effectiveOn: null,
  agencies: [
    {
      status: "unresolved",
      organizationId: null,
      sourceAgencyId: "fr-agency-406",
      name: "Personnel Management Office",
      sourceId: "federal-register",
      nativeId: "406"
    }
  ],
  canonicalUrl: `/api/legal/publications/${documentId}`,
  textUrl: `/api/legal/versions/${versionId}/text?sourceObservationId=${observationId}`,
  updatedAt: "2026-09-17T00:00:00Z",
  sourceLocator: "/RULE[1]",
  sourceUrl: "https://www.federalregister.gov/documents/2000/01/18/00-100/example",
  contentHash: "a".repeat(64),
  attribution: "Federal Register"
})
const page = (data: unknown[]) => ({
  data,
  links: { self: "/api/legal/publications", next: null },
  meta: { correlationId: "test", limit: 20, nextCursor: null, truncated: false, warnings: [] }
})
const summary = (({
  sourceLocator: _sourceLocator,
  sourceUrl: _sourceUrl,
  contentHash: _contentHash,
  attribution: _attribution,
  ...value
}) => value)(publication)

it("binds publication filters and exact canonical/text links", () => {
  expect(
    validateLegalPublicationsResponse(page([summary]), {
      sourceId: "federal-register",
      sourceAgencyId: "fr-agency-406",
      kind: "final_rule"
    }).data[0]
  ).toEqual(summary)
  expect(
    validateLegalPublicationResponse(
      { data: publication, links: { self: publication.canonicalUrl }, meta: { correlationId: "test", warnings: [] } },
      documentId,
      versionId
    ).data
  ).toEqual(publication)
})

it("rejects mismatched identities and agency filters", () => {
  expect(() =>
    validateLegalPublicationsResponse(page([summary]), {
      sourceId: "federal-register",
      sourceAgencyId: "fr-agency-1"
    })
  ).toThrow()
  expect(() =>
    validateLegalPublicationResponse(
      {
        data: { ...publication, textUrl: "/wrong" },
        links: { self: publication.canonicalUrl },
        meta: { correlationId: "test", warnings: [] }
      },
      documentId
    )
  ).toThrow()
})
