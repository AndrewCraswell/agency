import { describe, expect, it } from "vitest"
import { validateLegalSearchResponse, type LegalSearchRequest } from "./legal-search-contract.js"

const hash = "a".repeat(64)
const common = {
  id: "owner",
  versionId: "version",
  passageId: "passage",
  title: "Rule",
  heading: null,
  canonicalUrl: "https://rostra.test/legal/owner",
  updatedAt: "2026-09-15T00:00:00Z",
  citation: "1 CFR 1",
  jurisdiction: { id: "jurisdiction:us", name: "United States" },
  agencies: [
    {
      status: "unresolved",
      organizationId: null,
      sourceAgencyId: "agency",
      name: "Agency",
      sourceId: "ecfr",
      nativeId: null
    }
  ],
  snippet: "Source evidence",
  matchMode: "lexical",
  sourceLocator: "section/1",
  versionHash: hash,
  coverageWarnings: [],
  sources: [
    {
      provider: "ecfr",
      sourceUrl: "https://ecfr.gov/title-1",
      sourceUpdatedAt: null,
      retrievedAt: "2026-09-15T00:00:00Z",
      isOfficial: true,
      publisher: "OFR",
      supplier: "OFR",
      attribution: null
    }
  ]
}
const provision = {
  ...common,
  kind: "provision",
  corpus: "regulation",
  code: { id: "code", name: "CFR" },
  selectedContext: {
    editionId: "edition",
    provisionId: "owner",
    versionId: "version",
    sourceObservationId: "observation",
    sourceId: "ecfr",
    rightsPolicyHash: hash,
    parentId: null,
    sourceLocator: "section/1",
    sourceCurrencyDate: "2026-09-10",
    selectedDate: null,
    basis: "observed_snapshot",
    legalStatus: "unknown"
  }
}
const publication = {
  ...common,
  kind: "publication",
  corpus: "regulatory_publication",
  publicationKind: "final_rule",
  publishedOn: "2026-09-10",
  effectiveOn: "2026-10-10",
  sourceObservationId: "observation"
}
function page(data: unknown[] = [provision]) {
  return {
    data,
    links: { self: "/api/search/legal", next: null },
    meta: {
      correlationId: "test",
      warnings: [],
      limit: 20,
      nextCursor: null,
      truncated: false,
      mode: "lexical",
      models: [],
      isReranked: false,
      legal: {
        lexicalGeneration: hash,
        embeddingGeneration: null,
        effectiveMode: "lexical",
        degraded: false,
        candidateSetTruncated: false
      }
    }
  }
}

describe("request-bound legal search response", () => {
  it("accepts matching selectors, including unresolved source-agency identity", () => {
    expect(
      validateLegalSearchResponse(page(), {
        query: "rule",
        corpora: ["regulation"],
        codeIds: ["code"],
        jurisdictionIds: ["jurisdiction:us"],
        editionIds: ["edition"],
        agencyIds: ["agency"]
      }).data
    ).toHaveLength(1)
  })
  it.each([
    { corpora: ["statute"] },
    { jurisdictionIds: ["jurisdiction:us:ca"] },
    { corpora: ["regulation"], codeIds: ["other"] },
    { agencyIds: ["other"] },
    { corpora: ["regulation"], editionIds: ["other"] },
    { limit: 10 },
    { mode: "semantic" }
  ] satisfies Partial<LegalSearchRequest>[])("rejects request mismatch %j", (overrides) => {
    expect(() => validateLegalSearchResponse(page(), { query: "rule", ...overrides })).toThrow(
      "legal_search_response_mismatch"
    )
  })
  it("requires explicit permission for fallback even when there are no hits", () => {
    const value = page([])
    value.meta.mode = "hybrid"
    value.meta.limit = 10
    value.meta.legal.degraded = true
    expect(() => validateLegalSearchResponse(value, { query: "rule", mode: "hybrid" })).toThrow(
      "legal_search_response_mismatch"
    )
    expect(
      validateLegalSearchResponse(value, { query: "rule", mode: "hybrid", allowDegraded: true }).meta.legal.degraded
    ).toBe(true)
  })
  it("requires publisher-backed exact date selection for asOf", () => {
    const input: LegalSearchRequest = { query: "rule", corpora: ["regulation"], asOf: "2026-09-10" }
    expect(() => validateLegalSearchResponse(page(), input)).toThrow("legal_search_response_mismatch")
    const selectedContext = { ...provision.selectedContext, selectedDate: input.asOf, basis: "publisher_point_in_time" }
    expect(validateLegalSearchResponse(page([{ ...provision, selectedContext }]), input).data).toHaveLength(1)
    expect(() =>
      validateLegalSearchResponse(
        page([{ ...provision, selectedContext: { ...selectedContext, selectedDate: "2026-09-09" } }]),
        input
      )
    ).toThrow("legal_search_response_mismatch")
  })
  it("filters publication dates by publication, not effective date, with inclusive bounds", () => {
    const value = page([publication])
    const input: LegalSearchRequest = {
      query: "rule",
      corpora: ["regulatory_publication"],
      publishedFrom: "2026-09-10",
      publishedTo: "2026-09-10"
    }
    expect(validateLegalSearchResponse(value, input).data).toHaveLength(1)
    for (const change of [
      { publishedFrom: "2026-09-11", publishedTo: undefined },
      { publishedTo: "2026-09-09", publishedFrom: undefined },
      { publicationKinds: ["proposed_rule"] }
    ] satisfies Partial<LegalSearchRequest>[]) {
      expect(() => validateLegalSearchResponse(value, { ...input, ...change })).toThrow(
        "legal_search_response_mismatch"
      )
    }
  })
  it("rejects duplicate exact versions even with distinct matching passages", () => {
    expect(() =>
      validateLegalSearchResponse(page([provision, { ...provision, passageId: "other" }]), { query: "rule" })
    ).toThrow("Duplicate exact search versions")
  })
  it("distinguishes a final capped window from a continuing full page and rejects cursor loops", () => {
    const value = page()
    value.meta.legal.candidateSetTruncated = true
    expect(() => validateLegalSearchResponse(value, { query: "rule" })).toThrow("Truncation must reflect")
    value.meta.truncated = true
    expect(validateLegalSearchResponse(value, { query: "rule" }).meta.nextCursor).toBeNull()
    const continued = {
      ...value,
      links: { ...value.links, next: "/api/search/legal?cursor=next" },
      meta: { ...value.meta, nextCursor: "next", limit: 1 }
    }
    expect(validateLegalSearchResponse(continued, { query: "rule", limit: 1 }).meta.nextCursor).toBe("next")
    expect(() => validateLegalSearchResponse(continued, { query: "rule", limit: 1, cursor: "next" })).toThrow(
      "legal_search_response_mismatch"
    )
    expect(() => validateLegalSearchResponse({ ...continued, data: [] }, { query: "rule", limit: 1 })).toThrow(
      "Continuation requires a full result page"
    )
  })
})
