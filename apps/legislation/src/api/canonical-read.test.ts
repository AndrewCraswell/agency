import { describe, expect, it } from "vitest"
import { CanonicalProjectionError } from "./canonical-projection.js"
import {
  projectBillDetailRead,
  projectBillTimelineRead,
  projectDocumentSectionRead,
  projectSupportingMaterialDetailRead,
  projectSupportingMaterialSectionRead,
  projectSupportingMaterialSummaryRead
} from "./canonical-read.js"

const sourceUrl = "https://api.congress.gov/v3/bill/119/hr/1"

function canonical(id: string, path: string) {
  return {
    canonicalUrl: `https://api.example.test${path}`,
    id,
    sources: [
      {
        isOfficial: true,
        provider: "congress",
        retrievedAt: "2026-08-20T15:00:00.000Z",
        sourceUpdatedAt: null,
        sourceUrl
      }
    ],
    updatedAt: "2026-08-20T15:00:00.000Z"
  }
}

function billDetailRead() {
  return {
    abstract: "An exact read fixture",
    amendments: [] as unknown[],
    bill: {
      classification: ["bill"],
      createdAt: "2026-08-20T15:00:00.000Z",
      id: "bill:us:119:hr:1",
      identifier: "HR 1",
      introducedAt: "2026-01-01",
      jurisdictionId: "jurisdiction:us",
      latestActionAt: "2026-02-01T00:00:00.000Z",
      sessionId: "session:us:119",
      sourceUrl,
      status: "introduced",
      subjects: ["Government"],
      title: "Test bill",
      updatedAt: "2026-08-20T15:00:00.000Z",
      upstreamIds: { congress: "119-hr-1" }
    },
    childPageInfo: {
      amendments: { limit: 25, nextCursor: "amendment-next", truncated: true },
      documents: { limit: 25, nextCursor: "document-next", truncated: true },
      votes: { limit: 25, nextCursor: null, truncated: false }
    },
    documents: [] as unknown[],
    latestActions: [] as unknown[],
    organizations: [] as unknown[],
    relations: [] as unknown[],
    sponsors: [] as unknown[],
    voteSummaries: [] as unknown[]
  }
}

function sponsor(id: number) {
  return {
    classification: "primary",
    isPrimary: true,
    person: null,
    sourceName: `Sponsor ${id}`,
    sources: canonical(`sponsor:${id}`, `/api/sponsors/sponsor%3A${id}`).sources
  }
}

function organization(id: number) {
  return {
    ...canonical(`organization:${id}`, `/api/organizations/organization%3A${id}`),
    chamber: null,
    classification: "committee",
    isActive: true,
    jurisdictionId: "jurisdiction:us",
    name: `Organization ${id}`,
    parentOrganizationId: null,
    type: "organization" as const
  }
}

function relatedBill(id: number) {
  return {
    ...canonical(`bill:related:${id}`, `/api/bills/bill%3Arelated%3A${id}`),
    classification: ["bill"],
    identifier: `R ${id}`,
    introducedDate: "2026-01-01",
    jurisdictionId: "jurisdiction:us",
    latestActionAt: "2026-02-01T00:00:00.000Z",
    sessionId: "session:us:119",
    status: null,
    subjects: [],
    title: `Related bill ${id}`,
    type: "bill" as const
  }
}

function relation(id: number) {
  return {
    classification: "related",
    relatedBill: relatedBill(id),
    sources: canonical(`relation:${id}`, `/api/relations/relation%3A${id}`).sources
  }
}

function action(id: number) {
  return {
    ...canonical(`action:${id}`, `/api/bill-actions/action%3A${id}`),
    billId: "bill:us:119:hr:1",
    classifications: ["introduction"],
    date: "2026-02-01",
    description: `Action ${id}`,
    occurredAt: null,
    organization: null,
    sequence: id,
    type: "bill-action" as const
  }
}

function document(id: number) {
  return {
    ...canonical(`document:${id}`, `/api/documents/document%3A${id}`),
    billId: "bill:us:119:hr:1",
    classification: "version",
    contentHash: null,
    documentDate: "2026-02-01",
    mimeType: "application/pdf",
    ocrStatus: "not-required",
    processingStatus: "processed",
    sourceUrl,
    storedUrl: null,
    title: `Document ${id}`,
    type: "document" as const,
    versionCode: null
  }
}

function amendment(id: number) {
  return {
    ...canonical(`amendment:${id}`, `/api/amendments/amendment%3A${id}`),
    billId: "bill:us:119:hr:1",
    documentId: null,
    identifier: `A ${id}`,
    jurisdictionId: "jurisdiction:us",
    recordType: "structured",
    status: null,
    submittedDate: "2026-02-01",
    title: `Amendment ${id}`,
    type: "amendment" as const
  }
}

function vote(id: number) {
  return {
    ...canonical(`vote:${id}`, `/api/votes/vote%3A${id}`),
    billId: "bill:us:119:hr:1",
    classification: null,
    counts: { absent: 0, abstain: 0, no: 0, notVoting: 0, other: 0, paired: 0, present: 0, proxy: 0, yes: 1 },
    date: "2026-02-01",
    heldAt: null,
    motion: `Vote ${id}`,
    organizationId: null,
    question: null,
    result: "passed",
    type: "vote" as const
  }
}

function supportingMaterialRead() {
  return {
    amendmentIds: ["amendment:us:119:hr:1"],
    billIds: ["bill:us:119:hr:1"],
    byteSize: null,
    classification: "committee-report",
    contentType: "application/pdf",
    createdAt: "2026-08-20T15:00:00.000Z",
    documentDate: "2026-02-01",
    id: "material:us:119:committee-report:1",
    jurisdictionId: "jurisdiction:us",
    meetingIds: ["event:us:119:committee:1"],
    organizationIds: ["organization:us:house:committee"],
    pageCount: null,
    processingStatus: "processed",
    sectionCount: 3,
    sourceUrl,
    storedUrl: null,
    textCharacterCount: 1234,
    title: "Committee report",
    updatedAt: "2026-08-20T15:00:00.000Z"
  }
}

function timelineAction() {
  const action = {
    ...canonical("action:us:119:hr:1:1", "/api/bill-actions/action%3Aus%3A119%3Ahr%3A1%3A1"),
    billId: "bill:us:119:hr:1",
    classifications: ["introduction"],
    date: "2026-02-01",
    description: "Introduced",
    occurredAt: "2026-02-01T09:30:00.000Z",
    organization: null,
    sequence: 1,
    type: "bill-action" as const
  }
  return {
    action,
    date: action.date,
    description: action.description,
    id: action.id,
    occurredAt: action.occurredAt,
    sequence: action.sequence,
    sources: action.sources,
    title: "Introduced",
    type: "action" as const
  }
}

describe("canonical bill detail reads", () => {
  it("preserves independent child page state and publisher provenance", () => {
    expect(projectBillDetailRead(billDetailRead(), "https://api.example.test")).toMatchObject({
      abstract: "An exact read fixture",
      canonicalUrl: "https://api.example.test/api/bills/bill%3Aus%3A119%3Ahr%3A1",
      childPageInfo: {
        amendments: { limit: 25, nextCursor: "amendment-next", truncated: true },
        documents: { limit: 25, nextCursor: "document-next", truncated: true },
        votes: { limit: 25, nextCursor: null, truncated: false }
      },
      sources: [{ isOfficial: true, provider: "congress", sourceUrl }],
      type: "bill"
    })
  })

  it("rejects incomplete historical detail before it can become a public response", () => {
    expect(() => projectBillDetailRead({ bill: billDetailRead().bill }, "https://api.example.test")).toThrow(
      CanonicalProjectionError
    )
  })

  it("enforces complete embedded collection maxima and independently bounded child pages", () => {
    const bounded = billDetailRead()
    bounded.sponsors = Array.from({ length: 500 }, (_value, index) => sponsor(index))
    bounded.organizations = Array.from({ length: 250 }, (_value, index) => organization(index))
    bounded.relations = Array.from({ length: 500 }, (_value, index) => relation(index))
    bounded.latestActions = Array.from({ length: 100 }, (_value, index) => action(index))
    expect(projectBillDetailRead(bounded, "https://api.example.test")).toMatchObject({ type: "bill" })

    const sponsorOverflow = billDetailRead()
    sponsorOverflow.sponsors = Array.from({ length: 501 }, (_value, index) => sponsor(index))
    expect(() => projectBillDetailRead(sponsorOverflow, "https://api.example.test")).toThrow(CanonicalProjectionError)

    const organizationOverflow = billDetailRead()
    organizationOverflow.organizations = Array.from({ length: 251 }, (_value, index) => organization(index))
    expect(() => projectBillDetailRead(organizationOverflow, "https://api.example.test")).toThrow(
      CanonicalProjectionError
    )

    const relationOverflow = billDetailRead()
    relationOverflow.relations = Array.from({ length: 501 }, (_value, index) => relation(index))
    expect(() => projectBillDetailRead(relationOverflow, "https://api.example.test")).toThrow(CanonicalProjectionError)

    const actionOverflow = billDetailRead()
    actionOverflow.latestActions = Array.from({ length: 101 }, (_value, index) => action(index))
    expect(() => projectBillDetailRead(actionOverflow, "https://api.example.test")).toThrow(CanonicalProjectionError)

    const documentOverflow = billDetailRead()
    documentOverflow.documents = Array.from({ length: 26 }, (_value, index) => document(index))
    expect(() => projectBillDetailRead(documentOverflow, "https://api.example.test")).toThrow(CanonicalProjectionError)

    const amendmentOverflow = billDetailRead()
    amendmentOverflow.amendments = Array.from({ length: 26 }, (_value, index) => amendment(index))
    expect(() => projectBillDetailRead(amendmentOverflow, "https://api.example.test")).toThrow(CanonicalProjectionError)

    const voteOverflow = billDetailRead()
    voteOverflow.voteSummaries = Array.from({ length: 26 }, (_value, index) => vote(index))
    expect(() => projectBillDetailRead(voteOverflow, "https://api.example.test")).toThrow(CanonicalProjectionError)
  })

  it("accepts only strict ISO date and RFC 3339 timeline branches", () => {
    expect(projectBillTimelineRead(timelineAction())).toMatchObject({
      action: { type: "bill-action" },
      type: "action"
    })
    const invalidDate = timelineAction()
    invalidDate.date = "2026-02-30"
    expect(() => projectBillTimelineRead(invalidDate)).toThrow(CanonicalProjectionError)
    const invalidTimestamp = timelineAction()
    invalidTimestamp.occurredAt = "2026-02-01T09:30:00"
    expect(() => projectBillTimelineRead(invalidTimestamp)).toThrow(CanonicalProjectionError)
  })
})

describe("canonical supporting-material reads", () => {
  it("projects all persisted relationship IDs and leaves unavailable artifact metadata null", () => {
    const read = supportingMaterialRead()
    expect(projectSupportingMaterialSummaryRead(read, "https://api.example.test")).toMatchObject({
      amendmentIds: ["amendment:us:119:hr:1"],
      billIds: ["bill:us:119:hr:1"],
      canonicalUrl: "https://api.example.test/api/supporting-materials/material%3Aus%3A119%3Acommittee-report%3A1",
      meetingIds: ["event:us:119:committee:1"],
      organizationIds: ["organization:us:house:committee"],
      processingStatus: "processed",
      type: "supporting-material"
    })
    expect(projectSupportingMaterialDetailRead(read, "https://api.example.test")).toMatchObject({
      byteSize: null,
      pageCount: null,
      sectionCount: 3,
      storedUrl: null,
      textCharacterCount: 1234
    })
  })

  it("fails closed when the persisted processing status is outside the canonical enum", () => {
    const invalid = { ...supportingMaterialRead(), processingStatus: "unknown" }
    expect(() => projectSupportingMaterialSummaryRead(invalid, "https://api.example.test")).toThrow(
      CanonicalProjectionError
    )
  })
})

describe("canonical section reads", () => {
  it("projects parent-scoped document and supporting-material sections", () => {
    const documentSection = projectDocumentSectionRead(
      {
        document: {
          billId: "bill:us:119:hr:1",
          createdAt: "2026-08-20T15:00:00.000Z",
          id: "document:us:119:hr:1:text",
          sourceUrl: "https://publisher.example/documents/hr-1.txt",
          updatedAt: "2026-08-20T15:00:00.000Z"
        },
        section: {
          contentHash: "a".repeat(64),
          heading: "Section 1",
          id: "document-section:1",
          ordinal: 0,
          pageEnd: 3,
          pageStart: 2,
          sourceEndOffset: 12,
          sourceStartOffset: 0,
          text: "Section text"
        }
      },
      "https://api.example.test"
    )
    const supportingMaterialSection = projectSupportingMaterialSectionRead(
      {
        material: {
          createdAt: "2026-08-20T15:00:00.000Z",
          id: "material:us:119:report:1",
          sourceUrl: "https://publisher.example/materials/report-1.txt",
          updatedAt: "2026-08-20T15:00:00.000Z"
        },
        section: {
          contentHash: "b".repeat(64),
          heading: null,
          id: "material-section:1",
          ordinal: 0,
          text: "Report text"
        }
      },
      "https://api.example.test"
    )

    expect(documentSection).toMatchObject({
      billId: "bill:us:119:hr:1",
      canonicalUrl:
        "https://api.example.test/api/documents/document%3Aus%3A119%3Ahr%3A1%3Atext/sections/document-section%3A1",
      documentId: "document:us:119:hr:1:text",
      endOffset: 12,
      pageEnd: 3,
      pageStart: 2,
      startOffset: 0,
      type: "document-section"
    })
    expect(supportingMaterialSection).toMatchObject({
      canonicalUrl:
        "https://api.example.test/api/supporting-materials/material%3Aus%3A119%3Areport%3A1/sections/material-section%3A1",
      materialId: "material:us:119:report:1",
      pageEnd: null,
      pageStart: null,
      type: "supporting-material-section"
    })
    expect(documentSection.sources).toEqual([
      expect.objectContaining({ isOfficial: false, provider: "publisher.example" })
    ])
    expect(supportingMaterialSection.sources).toEqual([
      expect.objectContaining({ isOfficial: false, provider: "publisher.example" })
    ])
  })

  it("rejects malformed section source provenance before projection", () => {
    expect(() =>
      projectSupportingMaterialSectionRead(
        {
          material: {
            createdAt: "2026-08-20T15:00:00.000Z",
            id: "material:1",
            sourceUrl: "not a URL",
            updatedAt: "2026-08-20T15:00:00.000Z"
          },
          section: {
            contentHash: "a".repeat(64),
            heading: null,
            id: "section:1",
            ordinal: 0,
            text: "Text"
          }
        },
        "https://api.example.test"
      )
    ).toThrow(CanonicalProjectionError)
  })
})
