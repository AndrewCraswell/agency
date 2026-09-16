import { describe, expect, it } from "vitest"
import { legalSearchPageSchema, legalSearchRequestSchema } from "./legal-search-contract"

const generation = "a".repeat(64)
function page() {
  return {
    data: [],
    links: { self: "/api/search/legal", next: null },
    meta: {
      correlationId: "request",
      warnings: [],
      limit: 20,
      nextCursor: null,
      truncated: false,
      mode: "lexical",
      isReranked: false,
      models: [],
      legal: {
        lexicalGeneration: generation,
        embeddingGeneration: null,
        effectiveMode: "lexical",
        degraded: false,
        candidateSetTruncated: false
      }
    }
  }
}

describe("legal search wire contract", () => {
  it("normalizes shared defaults and accepts state code selectors without granting coverage", () => {
    expect(legalSearchRequestSchema.parse({ query: " grants " })).toEqual({
      query: "grants",
      mode: "lexical",
      corpora: ["regulation", "regulatory_publication"],
      allowDegraded: false,
      limit: 20
    })
    expect(legalSearchRequestSchema.parse({ query: "x", mode: "hybrid" }).limit).toBe(10)
    expect(
      legalSearchRequestSchema.parse({
        query: "x",
        corpora: ["statute", "regulation"],
        jurisdictionIds: ["jurisdiction:us:ca"],
        asOf: "2024-02-29"
      }).asOf
    ).toBe("2024-02-29")
    expect(
      legalSearchRequestSchema.parse({
        query: "x",
        corpora: ["regulatory_publication"],
        publishedFrom: "2024-01-01",
        publishedTo: "2024-01-01"
      }).publishedTo
    ).toBe("2024-01-01")
  })

  it.each([
    { asOf: "2024-01-01" },
    { codeIds: ["code"] },
    { corpora: ["regulatory_publication"], codeIds: ["code"] },
    { corpora: ["regulation"], asOf: "2024-01-01", editionIds: ["edition"] },
    { publishedFrom: "2024-01-01" },
    { corpora: ["regulatory_publication"], publishedFrom: "2024-02-01", publishedTo: "2024-01-01" },
    { corpora: ["regulation"], asOf: "2023-02-29" },
    { mode: "semantic", limit: 26 },
    { limit: 101 },
    { limit: 1.5 },
    { query: " " },
    { query: "x".repeat(501) },
    { jurisdictionIds: [] },
    { agencyIds: ["a", "a"] },
    { codeIds: ["a", " a "] },
    { corpora: ["regulation", "regulation"] },
    { model: "caller-selected" },
    { organizationId: "spoofed" },
    { allowDegraded: "true" },
    { cursor: "" }
  ])("rejects invalid or ambiguous request %j", (input) => {
    expect(legalSearchRequestSchema.safeParse({ query: "x", ...input }).success).toBe(false)
  })

  it("validates lexical, semantic and explicitly degraded metadata", () => {
    expect(legalSearchPageSchema.parse(page()).meta.legal.embeddingGeneration).toBeNull()
    const value = page()
    expect(
      legalSearchPageSchema.safeParse({
        ...value,
        meta: {
          ...value.meta,
          mode: "semantic",
          limit: 10,
          models: [{ provider: "voyageai", model: "voyage-4", purpose: "embedding", dimensions: 1024 }],
          legal: { ...value.meta.legal, effectiveMode: "semantic", embeddingGeneration: generation }
        }
      }).success
    ).toBe(true)
    expect(
      legalSearchPageSchema.safeParse({
        ...value,
        meta: { ...value.meta, mode: "hybrid", limit: 10, legal: { ...value.meta.legal, degraded: true } }
      }).success
    ).toBe(true)
  })

  it.each([
    { legal: { ...page().meta.legal, embeddingGeneration: generation } },
    { legal: { ...page().meta.legal, degraded: true } },
    { legal: { ...page().meta.legal, effectiveMode: "hybrid" } },
    { isReranked: true },
    { models: [{ provider: "unknown" }] },
    { nextCursor: "next" },
    { limit: 101 },
    { unknown: true }
  ])("rejects inconsistent response metadata %j", (meta) => {
    const value = page()
    expect(legalSearchPageSchema.safeParse({ ...value, meta: { ...value.meta, ...meta } }).success).toBe(false)
  })

  it("preserves exact publication provenance and rejects oversized or duplicate hits", () => {
    const value = page()
    const hit = {
      kind: "publication",
      corpus: "regulatory_publication",
      id: "publication",
      canonicalUrl: "https://rostra.test/publication",
      sources: [
        {
          provider: "govinfo-fr",
          sourceUrl: "https://govinfo.gov/document",
          sourceUpdatedAt: null,
          retrievedAt: "2026-09-15T00:00:00Z",
          isOfficial: true,
          publisher: "GPO",
          supplier: "GPO",
          attribution: null
        }
      ],
      updatedAt: "2026-09-15T00:00:00Z",
      versionId: "version",
      passageId: "passage",
      title: "Rule",
      heading: null,
      citation: "90 FR 1",
      jurisdiction: { id: "jurisdiction:us", name: "United States" },
      agencies: [],
      snippet: "text",
      matchMode: "lexical",
      sourceLocator: "document/paragraph/1",
      versionHash: generation,
      coverageWarnings: [],
      publicationKind: "final_rule",
      publishedOn: "2025-01-01",
      effectiveOn: null,
      sourceObservationId: "observation"
    }
    expect(legalSearchPageSchema.safeParse({ ...value, data: [hit] }).success).toBe(true)
    for (const data of [
      [hit, hit],
      [{ ...hit, snippet: "x".repeat(501) }],
      [{ ...hit, sources: [] }],
      [{ ...hit, matchMode: "semantic" }],
      [{ ...hit, internalPolicy: {} }]
    ]) {
      expect(legalSearchPageSchema.safeParse({ ...value, data }).success).toBe(false)
    }
    const {
      publicationKind: _kind,
      publishedOn: _published,
      effectiveOn: _effective,
      sourceObservationId: _observation,
      ...common
    } = hit
    const provision = {
      ...common,
      id: "provision",
      kind: "provision",
      corpus: "regulation",
      code: { id: "cfr", name: "CFR" },
      selectedContext: {
        editionId: "edition",
        provisionId: "provision",
        versionId: "version",
        sourceObservationId: "observation",
        sourceId: "ecfr",
        rightsPolicyHash: generation,
        parentId: null,
        sourceLocator: hit.sourceLocator,
        sourceCurrencyDate: null,
        selectedDate: null,
        basis: "observed_snapshot",
        legalStatus: "unknown"
      }
    }
    expect(legalSearchPageSchema.safeParse({ ...value, data: [provision] }).success).toBe(true)
    expect(
      legalSearchPageSchema.safeParse({ ...value, data: [{ ...provision, versionId: "other-version" }] }).success
    ).toBe(false)
  })
})
