import { expect, it } from "vitest"
import { validateLegalVersionResponse } from "./legal-version-contract"

const versionId = "00000000-0000-4000-8000-000000000001"
const provisionId = "00000000-0000-4000-8000-000000000002"
const codeId = "00000000-0000-4000-8000-000000000003"
const editionId = "00000000-0000-4000-8000-000000000004"
const observationId = "00000000-0000-4000-8000-000000000005"

const envelope = (data: unknown) => ({
  data,
  links: { self: `/api/legal/versions/${versionId}` },
  meta: { correlationId: "test", warnings: [] }
})

it("validates context-neutral provision versions and exact edition context", () => {
  const version = {
    id: versionId,
    provisionId,
    codeId,
    contentHash: "a".repeat(64),
    inputContract: "reader",
    heading: "Purpose",
    nodeKind: "section",
    language: "en"
  }
  expect(
    validateLegalVersionResponse(envelope({ kind: "provision", version, selectedContext: null }), versionId, {}).data
  ).toMatchObject({ kind: "provision", selectedContext: null })
  const selectedContext = {
    edition: {
      id: editionId,
      codeId,
      sourceId: "ecfr",
      jurisdictionId: "jurisdiction:us",
      rightsProfileId: "official",
      sourceObservationId: "b".repeat(64),
      nativeKey: "2026-09-17",
      sourceRevision: "revision",
      sourceUrl: "https://www.ecfr.gov/",
      issueDate: "2026-09-17",
      sourceCurrencyDate: "2026-09-17",
      publishedAt: "2026-09-17T00:00:00Z",
      scope: "current_code_snapshot"
    },
    parentId: null,
    ordinal: 1,
    nativeId: "1 CFR 1.1",
    sourceLocator: "/ECFR[1]",
    isLatestValidated: true,
    textUrl: `/api/legal/versions/${versionId}/text?editionId=${editionId}`
  }
  expect(
    validateLegalVersionResponse(envelope({ kind: "provision", version, selectedContext }), versionId, { editionId })
      .data.selectedContext
  ).toEqual(selectedContext)
})

it("validates publication observation context and rejects crossed selectors", () => {
  const version = {
    id: versionId,
    documentId: provisionId,
    contentHash: "a".repeat(64),
    inputContract: "reader",
    heading: "Published rule",
    publicationKind: "final_rule"
  }
  const selectedContext = {
    sourceObservationId: observationId,
    documentId: provisionId,
    versionId,
    sourceId: "federal-register",
    jurisdictionId: "jurisdiction:us",
    rightsProfileId: "official",
    publishedOn: "2026-09-17",
    sourceLocator: "/RULE[1]",
    sourceUrl: "https://www.federalregister.gov/example",
    updatedAt: "2026-09-17T00:00:00Z",
    textUrl: `/api/legal/versions/${versionId}/text?sourceObservationId=${observationId}`
  }
  const response = envelope({ kind: "publication", version, selectedContext })
  expect(validateLegalVersionResponse(response, versionId, { sourceObservationId: observationId }).data).toMatchObject({
    kind: "publication"
  })
  expect(() => validateLegalVersionResponse(response, versionId, { editionId })).toThrow(
    "legal_version_response_mismatch"
  )
})
