import { describe, expect, it } from "vitest"
import { projectSupportingMaterialSearchHit, projectSupportingMaterialSearchHits } from "./canonical-material-search.js"
import { CanonicalProjectionError } from "./canonical-projection.js"

const candidate = {
  amendmentIds: ["amendment:fixture"],
  billIds: ["bill:fixture"],
  blobPath: null,
  classification: "committee-report",
  contentHash: null,
  contentType: "application/pdf",
  createdAt: new Date("2026-08-24T00:00:00.000Z"),
  documentDate: "2026-08-20",
  id: "material:fixture",
  jurisdictionId: "jurisdiction:fixture",
  lastAttemptAt: null,
  lexicalScore: 0.72,
  matchedFields: ["sectionText", "title"] as const,
  meetingIds: ["meeting:fixture"],
  nextAttemptAt: null,
  organizationIds: ["organization:fixture"],
  processingStatus: "processed",
  processingAttempts: 0,
  processingError: null,
  processingErrorCategory: null,
  rerankScore: null,
  score: 0.72,
  section: {
    contentHash: "a".repeat(64),
    createdAt: new Date("2026-08-24T00:00:00.000Z"),
    embeddedAt: null,
    embedding: null,
    embeddingInputHash: null,
    embeddingModel: null,
    heading: "Summary",
    id: "material:fixture:section:0",
    materialId: "material:fixture",
    ordinal: 0,
    searchVector: null,
    sectionIdentifier: null,
    sourceEndOffset: 32,
    sourceStartOffset: 0,
    text: "A bounded matching material section.",
    updatedAt: new Date("2026-08-24T00:00:00.000Z")
  },
  semanticScore: null,
  snippet: "A bounded <b>matching</b> material section.",
  sourceUpdatedAt: null,
  sourceId: "fixture-material",
  sourceUrl: "https://source.example.test/material",
  text: null,
  title: "Matching committee report",
  updatedAt: new Date("2026-08-24T01:00:00.000Z"),
  upstreamIds: { fixture: "material" }
}

describe("canonical supporting material search projection", () => {
  it("returns the material record, exactly one persisted section, and deduplicated related IDs", () => {
    expect(projectSupportingMaterialSearchHit(candidate, "lexical", 1, "https://api.example.test")).toMatchObject({
      match: {
        lexicalScore: 0.72,
        matchedFields: ["sectionText", "title"],
        mode: "lexical",
        semanticScore: null
      },
      rank: 1,
      record: {
        material: { id: "material:fixture", type: "supporting-material" },
        relatedRecordIds: ["amendment:fixture", "bill:fixture", "meeting:fixture", "organization:fixture"],
        section: { id: "material:fixture:section:0", materialId: "material:fixture" }
      },
      recordId: "material:fixture",
      recordType: "supporting-material",
      score: 0.72
    })
  })

  it("preserves actual semantic and hybrid score semantics without inventing a reranker", () => {
    const semantic = {
      ...candidate,
      lexicalScore: null,
      matchedFields: ["semantic"] as const,
      score: 0.88,
      semanticScore: 0.88,
      snippet: null
    }
    expect(projectSupportingMaterialSearchHit(semantic, "semantic", 1, "https://api.example.test").match).toMatchObject(
      {
        rerankScore: null,
        semanticScore: 0.88
      }
    )
    const hybrid = { ...semantic, lexicalScore: 0.3, matchedFields: ["sectionText", "semantic"] as const, score: 0.04 }
    expect(projectSupportingMaterialSearchHit(hybrid, "hybrid", 1, "https://api.example.test").score).toBe(0.04)
  })

  it("preserves absolute rank after an opaque cursor offset", () => {
    expect(
      projectSupportingMaterialSearchHits([candidate], "lexical", "https://api.example.test", false, 20)[0]?.rank
    ).toBe(21)
  })

  it("fails closed when the candidate lacks a bounded related section or truthful score", () => {
    expect(() =>
      projectSupportingMaterialSearchHit(
        { ...candidate, section: { ...candidate.section, materialId: "material:other" } },
        "lexical",
        1,
        "https://api.example.test"
      )
    ).toThrow(CanonicalProjectionError)
    expect(() =>
      projectSupportingMaterialSearchHit({ ...candidate, score: 0.2 }, "lexical", 1, "https://api.example.test")
    ).toThrow(CanonicalProjectionError)
  })
})
