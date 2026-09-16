import { describe, expect, it } from "vitest"
import { citedAnswerSchema, evidenceSnapshotSchema, formatEvidenceCitation } from "./evidence"

const citation = {
  id: "source-1",
  title: "A source document",
  origin: "canonical",
  publisher: "Example publisher",
  versionLabel: "Introduced version",
  locator: "Section 2",
  sourceUrl: "https://example.org/document",
  content: { state: "available", quote: "The exact retained passage.\nSecond paragraph." }
}

describe("conversation evidence", () => {
  it("preserves the exact quote and version in copied citations", () => {
    expect(formatEvidenceCitation(evidenceSnapshotSchema.parse(citation))).toBe(
      "A source document\nExample publisher\nIntroduced version\nSection 2\nThe exact retained passage.\nSecond paragraph.\nhttps://example.org/document"
    )
  })

  it.each([
    "#citation-unknown",
    "/relative-document",
    "not a URL",
    "https://",
    "",
    "javascript:alert(1)",
    "data:text/html,test",
    "https://user:password@example.org/",
    "https://example.org/?token=private",
    "https://example.org/?X-Amz-Signature=private"
  ])("rejects unsafe source link %s", (sourceUrl) => {
    expect(evidenceSnapshotSchema.safeParse({ ...citation, sourceUrl }).success).toBe(false)
  })

  it("does not invent missing source or version metadata", () => {
    const evidence = evidenceSnapshotSchema.parse({
      id: "missing",
      title: "Unavailable source",
      origin: "web",
      sourceUrl: null,
      content: { state: "unavailable" }
    })
    expect(formatEvidenceCitation(evidence)).toBe("Unavailable source")
  })

  it("binds each marker to a unique retained snapshot", () => {
    const answer = {
      claims: [{ id: "claim-1", text: "An interpretation", citationIds: ["source-1"] }],
      citations: [citation]
    }
    expect(citedAnswerSchema.safeParse(answer).success).toBe(true)
    expect(citedAnswerSchema.safeParse({ ...answer, citations: [] }).success).toBe(false)
    expect(citedAnswerSchema.safeParse({ ...answer, citations: [citation, citation] }).success).toBe(false)
    expect(citedAnswerSchema.safeParse({ ...answer, claims: [answer.claims[0], answer.claims[0]] }).success).toBe(false)
  })

  it("rejects duplicated citation markers in a claim", () => {
    expect(
      citedAnswerSchema.safeParse({
        claims: [{ id: "claim-1", text: "An interpretation", citationIds: ["source-1", "source-1"] }],
        citations: [citation]
      }).success
    ).toBe(false)
  })

  it.each(["not-collected", "unavailable", "failed"])("keeps %s distinct from available text", (state) => {
    expect(evidenceSnapshotSchema.safeParse({ ...citation, content: { state } }).success).toBe(true)
    expect(
      evidenceSnapshotSchema.safeParse({ ...citation, content: { state, quote: "Invented fallback" } }).success
    ).toBe(false)
  })
})
