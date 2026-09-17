import { createHash } from "node:crypto"
import { describe, expect, it, vi } from "vitest"
import {
  citedAnswerSchema,
  evidenceSnapshotSchema,
  evidenceSourceUrl,
  formatEvidenceCitation,
  projectResearchEvidence,
  type EvidenceSourceContext
} from "./evidence"

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

  it("uses a safe readable destination without replacing copied provenance", () => {
    const readableUrl = "https://example.org/document.pdf"
    const evidence = evidenceSnapshotSchema.parse({ ...citation, readableUrl })
    expect(evidenceSourceUrl(evidence)).toBe(readableUrl)
    expect(formatEvidenceCitation(evidence)).toContain(citation.sourceUrl)
    expect(formatEvidenceCitation(evidence)).not.toContain(readableUrl)
    expect(evidenceSourceUrl({ ...evidence, readableUrl: "javascript:alert(1)" })).toBe(citation.sourceUrl)
    expect(evidenceSourceUrl({ sourceUrl: null, readableUrl })).toBe(readableUrl)
    expect(evidenceSourceUrl({ sourceUrl: "https://example.org/?token=secret" })).toBeNull()
    expect(evidenceSourceUrl({ sourceUrl: null })).toBeNull()
    expect(
      evidenceSnapshotSchema.safeParse({ ...citation, readableUrl: "https://example.org/?signature=secret" }).success
    ).toBe(false)
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

const document = {
  id: "document:one",
  billId: "bill:us:119:hr:1",
  title: "Introduced text",
  classification: "version",
  versionCode: "ih",
  documentDate: "2025-01-03",
  sourceUrl: "https://www.govinfo.gov/content/pkg/BILLS-119hr1ih/xml/BILLS-119hr1ih.xml",
  text: null,
  snippet: null
}
const section = {
  id: "section:one",
  documentId: document.id,
  sectionIdentifier: "Section 2",
  heading: "Retained heading",
  text: "The exact retained passage.\nSecond paragraph.",
  snippet: null
}

function createEvidenceId(identity: string) {
  return `evidence:${createHash("sha256").update(identity).digest("hex")}`
}

function project(data: unknown) {
  return projectResearchEvidence(data, createEvidenceId)
}

describe("research evidence identity", () => {
  it("projects the same action from bill details and timeline without inventing a document quote", () => {
    const action = {
      id: "action:ca:ab2652:10",
      billId: "bill:ca:20232024:ab:2652",
      ordinal: 10,
      description: "In committee: Held under submission.",
      actionDate: "2024-05-16",
      actionAt: null,
      sourceUrl: "https://leginfo.legislature.ca.gov/faces/billHistoryClient.xhtml?bill_id=202320240AB2652"
    }
    const detail = project({ actions: [action], latestAction: action })
    const timeline = project({
      billId: action.billId,
      events: [
        {
          id: action.id,
          type: "action",
          description: action.description,
          date: action.actionDate,
          sourceUrl: action.sourceUrl
        }
      ]
    })
    expect(detail).toHaveLength(1)
    expect(detail[0]).toMatchObject({
      recordId: action.id,
      billId: action.billId,
      title: action.description,
      locator: action.actionDate,
      sourceUrl: action.sourceUrl,
      content: { state: "not-collected" }
    })
    expect(timeline).toEqual(detail)
    expect(project({ latestAction: { ...action, description: "Different recorded action." } })[0]?.id).not.toBe(
      detail[0]?.id
    )
    expect(project({ latestAction: { ...action, actionDate: "2024-05-17" } })[0]?.id).not.toBe(detail[0]?.id)
  })

  it("does not borrow a bill or document URL for an action without its own source", () => {
    const action = {
      id: "action:one",
      billId: document.billId,
      description: "Referred to committee",
      actionDate: "2025-01-03",
      sourceUrl: null
    }
    const result = project({
      document: { ...document, text: "Document body is not an action quotation." },
      actions: [action]
    })
    expect(result.find((source) => source.title === action.description)).toMatchObject({
      sourceUrl: null,
      locator: "2025-01-03",
      content: { state: "not-collected" }
    })
    const missingDate = project({ latestAction: { ...action, actionDate: undefined } })[0]
    expect(missingDate?.locator).toBeUndefined()
    expect(
      project({ latestAction: { ...action, sourceUrl: "https://example.org/?token=secret" } })[0]?.sourceUrl
    ).toBeNull()
    expect(project({ latestAction: { ...action, billId: "bill:other" } })[0]?.id).not.toBe(
      project({ latestAction: action })[0]?.id
    )
    expect(project({ latestAction: { ...action, sourceObservationId: "observation:new" } })[0]?.id).not.toBe(
      project({ latestAction: action })[0]?.id
    )
  })

  it("does not treat unowned actions, unrelated descriptions or other timeline types as action evidence", () => {
    const record = { id: "record:one", description: "A description without an action owner" }
    expect(project({ metadata: record })).toEqual([])
    expect(project({ actions: [record] })).toEqual([])
    expect(project({ billId: document.billId, events: [{ ...record, type: "meeting" }] })).toEqual([])
    expect(project({ billId: document.billId, events: [{ ...record, type: "vote" }] })).toEqual([])
  })

  it("deduplicates repeated search and detail evidence using the supplied identity hash", () => {
    const createId = vi.fn<typeof createEvidenceId>(createEvidenceId)
    const search = { items: [{ document, section, score: 1, snippet: "Search excerpt" }] }
    const detail = { billId: document.billId, document, sections: [section], nextCursor: "next" }
    const searched = projectResearchEvidence(search, createId)
    const read = project(detail)
    expect(searched).toEqual(read)
    expect(project([search, detail])).toEqual(read)
    expect(read).toHaveLength(2)
    expect(read[1]).toMatchObject({
      recordId: document.id,
      billId: document.billId,
      title: document.title,
      sourceUrl: document.sourceUrl,
      versionLabel: "ih, 2025-01-03",
      locator: section.sectionIdentifier,
      content: { state: "available", quote: section.text }
    })
    expect(createId.mock.calls[1]?.[0]).toContain(JSON.stringify(section.text))
    expect(
      project({ ...document, title: "Changed display label", readableUrl: "https://example.org/text.pdf" })[0]?.id
    ).toBe(read[0]?.id)
  })

  it.each([
    { id: "document:two" },
    { billId: "bill:us:119:hr:2" },
    { versionId: "version:two" },
    { versionCode: "eh" },
    { documentDate: "2025-02-03" },
    { sourceObservationId: "observation:two" },
    { versionHash: "changed-version" },
    { text: "Changed passage" },
    { text: "The exact retained passage.\r\nSecond paragraph." }
  ])("separates record, version, observation, and exact text changes at the same URL: %j", (change) => {
    const original = { ...document, text: section.text }
    expect(project([{ ...original, ...change }, original])).toHaveLength(2)
    expect(project({ ...original, ...change })[0]?.id).not.toBe(project(original)[0]?.id)
  })

  it("keeps passages, unlabeled sections, source locators, and record types distinct", () => {
    const original = { ...section, ...document, id: section.id, text: section.text }
    for (const change of [{ id: "section:two" }, { passageId: "passage:two" }]) {
      expect(project([original, { ...original, ...change }])).toHaveLength(2)
    }
    expect(
      project({
        document,
        sections: [
          { ...section, sectionIdentifier: null, heading: null },
          { ...section, id: "section:two", sectionIdentifier: null, heading: null }
        ]
      })
    ).toHaveLength(3)
    expect(
      project([
        { ...document, type: "bill" },
        { ...document, type: "document" }
      ])
    ).toHaveLength(2)
    expect(
      project([
        { ...document, materialId: "same" },
        { ...document, provisionId: "same" }
      ])
    ).toHaveLength(2)
  })

  it("keeps canonical passage identities stable when detail reads enrich display locators", () => {
    const { heading: _heading, sectionIdentifier: _identifier, ...searchSection } = section
    const search = project({ document, sections: [searchSection] })
    const detail = project({ document, sections: [{ ...section, ordinal: 2, sourceLocator: "page:2" }] })
    expect(search[1]?.id).toBe(detail[1]?.id)
    expect(project({ ...document, processingStatus: "failed" })[0]?.content.state).toBe("failed")
    expect(project({ ...document, availability: "restricted" })[0]?.content.state).toBe("unavailable")
  })

  it.each([null, undefined, ""])("does not turn snippets or unretained text into an exact quote", (text) => {
    const result = project({ ...document, text, snippet: "An incomplete search excerpt" })
    expect(result).toHaveLength(1)
    expect(result[0]?.content).toEqual({ state: "not-collected" })
  })

  it("keeps long retrieved passages available and identifies the bounded excerpt", () => {
    const result = project({ ...document, text: "x".repeat(20001) })
    expect(result[0]?.content).toEqual({
      state: "available",
      quote: "x".repeat(20000),
      truncated: true,
      totalCharacters: 20001
    })
  })
  it("distinguishes equal text windows at different source offsets", () => {
    const first = project({
      ...document,
      text: "Repeated text",
      textOffset: 0,
      nextTextOffset: 10000,
      totalCharacters: 30000
    })[0]
    const second = project({
      ...document,
      text: "Repeated text",
      textOffset: 10000,
      nextTextOffset: 20000,
      totalCharacters: 30000
    })[0]
    expect(first?.id).not.toBe(second?.id)
    expect(first?.content).toEqual({
      state: "available",
      quote: "Repeated text",
      truncated: true,
      totalCharacters: 30000
    })
  })

  it("prioritizes exact passages after metadata fills the evidence budget", () => {
    const metadata = Array.from({ length: 45 }, (_, index) => ({ ...document, id: `metadata:${index}` }))
    const result = project([...metadata, { ...document, id: "exact-passage", text: "Exact returned text." }])
    expect(result).toHaveLength(40)
    expect(result.at(-1)?.content).toEqual({ state: "available", quote: "Exact returned text." })
  })

  it("retains nullable document records and never inherits full document text for an empty section", () => {
    expect(project(document)[0]?.content).toEqual({ state: "not-collected" })
    const result = project({
      document: { ...document, text: "Full document body" },
      sections: [{ ...section, text: null }]
    })
    expect(result[1]?.content).toEqual({ state: "not-collected" })
    expect(project({ ...document, text: "x".repeat(20001) })[0]?.id).not.toBe(
      project({ ...document, text: "y".repeat(20001) })[0]?.id
    )
  })

  it.each([
    { documentId: "document:other" },
    { documentId: null },
    { documentId: undefined },
    { billId: "bill:other" },
    { versionCode: "eh" },
    { versionCode: null },
    { documentDate: "2025-02-03" },
    { documentDate: null },
    { versionId: "version:other" },
    { sourceObservationId: "observation:other" },
    { versionHash: "hash:other" }
  ])("does not inherit document metadata across a conflicting or missing owner/version: %j", (change) => {
    const ownUrl = "https://other.example/passage.xml"
    const result = project({ document, sections: [{ ...section, ...change, sourceUrl: ownUrl }] })
    expect(result[1]).toMatchObject({ sourceUrl: ownUrl, title: section.heading })
    expect(result[1]?.versionLabel).not.toBe("ih, 2025-01-03")
  })

  it("does not apply a wrapper's document to foreign bill data or unrelated nested objects", () => {
    const result = project({
      billId: "bill:other",
      document,
      sections: [section],
      metadata: { heading: "Unrelated metadata", text: "Not a source" }
    })
    expect(result[1]).toMatchObject({ title: section.heading, sourceUrl: null })
    expect(result[1]?.versionLabel).toBeUndefined()
    expect(result).toHaveLength(2)
    expect(project({ document, metadata: { heading: "Not a source", text: "Unrelated" } })).toHaveLength(1)
    expect(project({ id: "search-hit:one", document, sections: [section] })).toEqual(
      project({ document, sections: [section] })
    )
  })

  it("retains safe fallback state and lets the resolver see all bounded sources without changing identity", () => {
    const readable = { ...document, id: "readable", sourceUrl: "https://www.govinfo.gov/text.pdf" }
    const contexts: EvidenceSourceContext[] = []
    const result = projectResearchEvidence(
      { documents: [document, readable] },
      createEvidenceId,
      (evidence, source, sources) => {
        contexts.push(source)
        expect(sources).toHaveLength(2)
        return { ...evidence, readableUrl: readable.sourceUrl }
      }
    )
    expect(contexts[0]).toMatchObject(document)
    expect(result[0]).toMatchObject({
      id: project(document)[0]?.id,
      sourceUrl: document.sourceUrl,
      readableUrl: readable.sourceUrl
    })
    expect(
      project({ ...document, sourceUrl: "https://user:secret@example.org/text?token=private" })[0]?.sourceUrl
    ).toBeNull()
  })

  it("keeps scanning source metadata beyond the evidence limit and skips embeddings and rendition traversal", () => {
    const documents = Array.from({ length: 45 }, (_value, index) => ({ ...document, id: `document:${index}` }))
    const result = projectResearchEvidence({ documents }, createEvidenceId, (evidence, _source, sources) => {
      expect(sources).toHaveLength(45)
      return evidence
    })
    expect(result).toHaveLength(40)
    expect(
      project({ ...document, embedding: [document], renditions: [{ ...document, id: "rendition" }] })
    ).toHaveLength(1)
    expect(project([null, 1, { text: 42, child: document }])).toHaveLength(1)
  })
})
