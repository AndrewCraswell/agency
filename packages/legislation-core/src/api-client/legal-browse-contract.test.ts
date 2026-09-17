import { expect, it } from "vitest"
import {
  legalEditionsRequestSchema,
  legalProvisionEditionMembershipSchema,
  legalProvisionRequestSchema,
  legalProvisionVersionSummarySchema,
  validateLegalEditionResponse,
  validateLegalProvisionEditionsResponse,
  validateLegalProvisionResponse,
  validateLegalProvisionVersionsResponse,
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

it("binds provision detail to its exact version and selected edition context", () => {
  const provisionId = "00000000-0000-4000-8000-000000000001"
  const codeId = "00000000-0000-4000-8000-000000000002"
  const versionId = "00000000-0000-4000-8000-000000000003"
  const editionId = "00000000-0000-4000-8000-000000000004"
  const response = {
    data: {
      id: provisionId,
      codeId,
      identityKey: "section:1",
      identityBasis: "citation",
      selectedVersion: {
        id: versionId,
        provisionId,
        codeId,
        contentHash: "b".repeat(64),
        inputContract: "reader",
        heading: "Purpose",
        nodeKind: "section",
        language: "en"
      },
      selectedContext: {
        edition: {
          id: editionId,
          codeId,
          sourceId: "ecfr",
          jurisdictionId: "jurisdiction:us",
          rightsProfileId: "official",
          sourceObservationId: "a".repeat(64),
          nativeKey: "2026-09-10",
          sourceRevision: "revision",
          sourceUrl: "https://www.ecfr.gov/",
          issueDate: "2026-09-10",
          sourceCurrencyDate: "2026-09-11",
          publishedAt: "2026-09-15T00:00:00Z",
          scope: "current_code_snapshot"
        },
        parentId: null,
        ordinal: 1,
        nativeId: "1 CFR 1.1",
        sourceLocator: "/ECFR[1]",
        isLatestValidated: true,
        textUrl: `/api/legal/versions/${versionId}/text?editionId=${editionId}`
      },
      textPreview: "Evidence",
      previewTruncated: false
    },
    links: { self: `/api/legal/provisions/${provisionId}` },
    meta: { correlationId: "test", warnings: [] }
  }
  expect(validateLegalProvisionResponse(response, provisionId, { editionId, versionId }).data.selectedVersion.id).toBe(
    versionId
  )
  expect(() => validateLegalProvisionResponse(response, provisionId, { versionId })).toThrow(
    "legal_provision_response_mismatch"
  )
  expect(legalProvisionRequestSchema.safeParse({ asOf: "2025-01-01", editionId }).success).toBe(false)
})

it("validates exact edition identity and source context", () => {
  const id = "00000000-0000-4000-8000-000000000001"
  const codeId = "00000000-0000-4000-8000-000000000002"
  const response = {
    data: {
      id,
      codeId,
      sourceId: "govinfo-cfr",
      jurisdictionId: "jurisdiction:us",
      rightsProfileId: "official",
      sourceObservationId: "a".repeat(64),
      nativeKey: "CFR-2025-title1-vol1",
      sourceRevision: "2025-01-01",
      sourceUrl: "https://www.govinfo.gov/app/details/CFR-2025-title1-vol1",
      issueDate: "2025-01-01",
      sourceCurrencyDate: null,
      publishedAt: "2026-09-15T00:00:00Z",
      scope: "annual_volume",
      publishedMembers: 42,
      isCurrent: false,
      annualVolume: {
        annualEditionId: "b".repeat(64),
        codeId,
        packageYear: 2025,
        revisionDate: "2025-01-01",
        volume: 1,
        expectedVolumes: 2,
        coverage: { isComplete: true }
      }
    },
    links: { self: `/api/legal/editions/${id}` },
    meta: { correlationId: "test", warnings: [] }
  }
  expect(validateLegalEditionResponse(response, id).data.annualVolume?.volume).toBe(1)
  expect(() =>
    validateLegalEditionResponse(
      { ...response, data: { ...response.data, annualVolume: { ...response.data.annualVolume!, codeId: id } } },
      id
    )
  ).toThrow("legal_edition_response_mismatch")
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

it("validates ordered immutable provision-version history", () => {
  const provisionId = "00000000-0000-4000-8000-000000000001"
  const codeId = "00000000-0000-4000-8000-000000000002"
  const versions = [
    legalProvisionVersionSummarySchema.parse({
      id: "00000000-0000-4000-8000-000000000004",
      provisionId,
      codeId,
      contentHash: "b".repeat(64),
      inputContract: "reader",
      heading: "Current",
      nodeKind: "section",
      language: "en",
      firstObservedAt: "2026-09-15T00:00:00Z",
      lastObservedAt: "2026-09-16T00:00:00Z",
      editionCount: 2
    }),
    legalProvisionVersionSummarySchema.parse({
      id: "00000000-0000-4000-8000-000000000003",
      provisionId,
      codeId,
      contentHash: "c".repeat(64),
      inputContract: "reader",
      heading: "Prior",
      nodeKind: "section",
      language: "en",
      firstObservedAt: "2025-09-15T00:00:00Z",
      lastObservedAt: "2025-09-15T00:00:00Z",
      editionCount: 1
    })
  ]
  const response = {
    data: versions,
    links: { self: `/api/legal/provisions/${provisionId}/versions`, next: null },
    meta: { correlationId: "test", limit: 20, nextCursor: null, truncated: false, warnings: [] }
  }
  expect(validateLegalProvisionVersionsResponse(response, provisionId, {}).data).toEqual(versions)
  expect(() =>
    validateLegalProvisionVersionsResponse({ ...response, data: versions.toReversed() }, provisionId, {})
  ).toThrow("legal_provision_versions_response_mismatch")
})

it("binds edition memberships to the requested provision and exact version", () => {
  const provisionId = "00000000-0000-4000-8000-000000000001"
  const codeId = "00000000-0000-4000-8000-000000000002"
  const versionId = "00000000-0000-4000-8000-000000000003"
  const editionId = "00000000-0000-4000-8000-000000000004"
  const membership = legalProvisionEditionMembershipSchema.parse({
    provisionId,
    versionId,
    edition: {
      id: editionId,
      codeId,
      sourceId: "ecfr",
      jurisdictionId: "jurisdiction:us",
      rightsProfileId: "official",
      sourceObservationId: "a".repeat(64),
      nativeKey: "2026-09-10",
      sourceRevision: "revision",
      sourceUrl: "https://www.ecfr.gov/",
      issueDate: "2026-09-10",
      sourceCurrencyDate: "2026-09-11",
      publishedAt: "2026-09-15T00:00:00Z",
      scope: "current_code_snapshot"
    },
    parentId: null,
    ordinal: 1,
    nativeId: "1 CFR 1.1",
    sourceLocator: "/ECFR[1]",
    isLatestValidated: true,
    textUrl: `/api/legal/versions/${versionId}/text?editionId=${editionId}`
  })
  const response = {
    data: [membership],
    links: { self: `/api/legal/provisions/${provisionId}/editions`, next: null },
    meta: { correlationId: "test", limit: 20, nextCursor: null, truncated: false, warnings: [] }
  }
  expect(validateLegalProvisionEditionsResponse(response, provisionId, { versionId, sourceId: "ecfr" }).data).toEqual([
    membership
  ])
  expect(() =>
    validateLegalProvisionEditionsResponse(
      { ...response, data: [{ ...membership, versionId: editionId }] },
      provisionId,
      { versionId }
    )
  ).toThrow("legal_provision_editions_response_mismatch")
})
