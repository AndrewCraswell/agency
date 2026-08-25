import { describe, expect, it } from "vitest"
import {
  CanonicalProjectionError,
  projectAmendmentDetail,
  projectAmendmentSummary,
  projectBillDetail,
  projectBillSummary,
  projectChangeEvent,
  projectDocumentDetail,
  projectDocumentSection,
  projectDocumentSummary,
  projectAgendaItem,
  projectEventDocument,
  projectJurisdiction,
  projectLegislativeTerm,
  projectMeetingDetail,
  projectMeetingOutcome,
  projectMeetingParticipant,
  projectMeetingSummary,
  projectMembership,
  projectOrganizationDetail,
  projectOrganizationSummary,
  projectPersonDetail,
  projectPersonSummary,
  projectSession,
  projectSupportingMaterialDetail,
  projectSupportingMaterialSection,
  projectSupportingMaterialSummary,
  projectVoteDetail,
  projectVoteSummary,
  type ProjectionContext,
  type SourceReferences
} from "./canonical-projection.js"

const context: ProjectionContext = {
  apiBaseUrl: "https://legislation.example.test/",
  sources: [
    {
      provider: "openstates",
      sourceUrl: "https://source.example.test/records/1",
      sourceUpdatedAt: "2026-08-20T10:00:00-04:00",
      retrievedAt: new Date("2026-08-20T15:00:00Z"),
      isOfficial: true
    }
  ],
  updatedAt: "2026-08-21T12:30:00-04:00"
}

const billInput = {
  id: "bill:us-ca:2025-2026:ab:123",
  sourceUrl: "https://source.example.test/bills/123",
  jurisdictionId: "ocd-jurisdiction/country:us/state:ca/government",
  sessionId: "session:ca:2025-2026",
  identifier: "AB 123",
  title: "A test bill",
  classification: ["bill"],
  status: "introduced",
  subjects: ["Health"],
  introducedDate: "2026-01-05",
  latestActionAt: "2026-02-03T12:30:00-08:00"
} as const

const amendmentInput = {
  id: "amendment:ca:123",
  sourceUrl: "https://source.example.test/amendments/123",
  billId: billInput.id,
  jurisdictionId: billInput.jurisdictionId,
  recordType: "structured",
  identifier: "A1",
  title: "Amendment 1",
  submittedDate: "2026-02-01",
  status: null,
  documentId: null
} as const

const voteInput = {
  id: "vote:ca:123",
  sourceUrl: "https://source.example.test/votes/123",
  billId: billInput.id,
  organizationId: null,
  motion: "Do pass",
  question: null,
  classification: null,
  heldAt: null,
  date: "2026-02-02",
  result: "passed",
  counts: { yes: 7, no: 2, absent: 0, abstain: 1, notVoting: 0, present: 0, proxy: 0, paired: 0, other: 0 }
} as const

const documentInput = {
  id: "document:ca:123",
  sourceUrl: "https://source.example.test/documents/123.pdf",
  billId: billInput.id,
  classification: "version",
  title: "Introduced text",
  documentDate: null,
  versionCode: null,
  mimeType: null,
  storedUrl: null,
  processingStatus: "pending",
  ocrStatus: "not-required",
  contentHash: null
} as const

describe("canonical legislative projections", () => {
  it("projects jurisdiction and session wire fields without manufacturing unknown source values", () => {
    const jurisdiction = projectJurisdiction(
      {
        id: "ocd-jurisdiction/country:us/state:ca/government",
        sourceUrl: "https://source.example.test/jurisdictions/ca",
        name: "California",
        classification: "state",
        timezone: null,
        isActive: true
      },
      context
    )
    const session = projectSession(
      {
        id: "session:ca:2025-2026",
        sourceUrl: "https://source.example.test/sessions/2025",
        jurisdictionId: jurisdiction.id,
        name: "2025-2026 Regular Session",
        classification: "primary",
        startDate: "2025-12-01",
        endDate: null,
        isActive: true
      },
      context
    )

    expect(jurisdiction).toMatchObject({
      canonicalUrl:
        "https://legislation.example.test/api/jurisdictions/ocd-jurisdiction%2Fcountry%3Aus%2Fstate%3Aca%2Fgovernment",
      timezone: null,
      sources: [{ sourceUpdatedAt: "2026-08-20T14:00:00.000Z", retrievedAt: "2026-08-20T15:00:00.000Z" }],
      updatedAt: "2026-08-21T16:30:00.000Z"
    })
    expect(session).toMatchObject({ classification: "primary", endDate: null, type: "session" })
  })

  it("projects summaries and details with contract field names and independent child metadata", () => {
    const document = projectDocumentSummary(documentInput, context)
    const amendment = projectAmendmentSummary(amendmentInput, context)
    const vote = projectVoteSummary(voteInput, context)
    const detail = projectBillDetail(
      {
        bill: billInput,
        abstract: null,
        sponsors: [],
        organizations: [],
        documents: [document],
        relations: [],
        amendments: [amendment],
        latestActions: [],
        voteSummaries: [vote],
        childPageInfo: {
          documents: { limit: 25, nextCursor: null, truncated: false },
          amendments: { limit: 25, nextCursor: "next", truncated: true },
          votes: { limit: 25, nextCursor: null, truncated: false }
        }
      },
      context
    )

    expect(projectBillSummary(billInput, context)).toMatchObject({
      introducedDate: "2026-01-05",
      latestActionAt: "2026-02-03T20:30:00.000Z",
      status: "introduced",
      type: "bill"
    })
    expect(projectBillSummary({ ...billInput, status: null }, context).status).toBeNull()
    expect(detail).toMatchObject({
      abstract: null,
      documents: [{ mimeType: null, storedUrl: null }],
      childPageInfo: { amendments: { nextCursor: "next", truncated: true } }
    })
  })

  it("projects amendment and vote details without claiming unavailable child data", () => {
    const amendment = projectAmendmentDetail(
      { amendment: amendmentInput, description: null, sponsors: [], actions: [], documents: [] },
      context
    )
    const vote = projectVoteDetail(
      {
        vote: voteInput,
        positions: [],
        positionsPageInfo: { limit: 25, nextCursor: null, truncated: false }
      },
      context
    )

    expect(amendment).toMatchObject({ description: null, sponsors: [], actions: [], documents: [] })
    expect(vote).toMatchObject({ heldAt: null, positions: [], result: "passed" })
  })

  it("keeps unknown document metadata null and validates known numeric metadata", () => {
    const summary = projectDocumentSummary(documentInput, context)
    const detail = projectDocumentDetail(
      {
        ...documentInput,
        byteSize: null,
        pageCount: null,
        sectionCount: 0,
        textCharacterCount: 0,
        failureCategory: null
      },
      context
    )

    expect(summary).toMatchObject({ documentDate: null, mimeType: null, storedUrl: null, contentHash: null })
    expect(detail).toMatchObject({ byteSize: null, pageCount: null, sectionCount: 0, textCharacterCount: 0 })
  })

  it("projects document sections with encoded canonical paths and rejects invalid offsets", () => {
    const input = {
      id: "section:1/2",
      sourceUrl: documentInput.sourceUrl,
      documentId: documentInput.id,
      billId: billInput.id,
      ordinal: 0,
      heading: null,
      text: "Section text",
      startOffset: 0,
      endOffset: 12,
      pageStart: null,
      pageEnd: null,
      contentHash: "a".repeat(64)
    }

    expect(projectDocumentSection(input, context)).toMatchObject({
      canonicalUrl: "https://legislation.example.test/api/documents/document%3Aca%3A123/sections/section%3A1%2F2",
      pageStart: null,
      pageEnd: null
    })
    expect(() => projectDocumentSection({ ...input, startOffset: 13 }, context)).toThrow(
      "endOffset must not precede startOffset"
    )
  })

  it("projects supporting material relationship IDs and detail metadata", () => {
    const input = {
      id: "material:ca:123",
      sourceUrl: "https://source.example.test/materials/123.pdf",
      jurisdictionId: billInput.jurisdictionId,
      classification: "analysis",
      title: "Committee analysis",
      billIds: [billInput.id],
      amendmentIds: [amendmentInput.id],
      meetingIds: [],
      organizationIds: [],
      documentDate: null,
      mimeType: "application/pdf",
      processingStatus: "processed"
    } as const
    const detail = projectSupportingMaterialDetail(
      {
        ...input,
        storedUrl: null,
        byteSize: 1200,
        pageCount: 3,
        sectionCount: 4,
        textCharacterCount: 5000
      },
      context
    )

    expect(projectSupportingMaterialSummary(input, context)).toMatchObject({
      billIds: [billInput.id],
      amendmentIds: [amendmentInput.id],
      documentDate: null
    })
    expect(detail).toMatchObject({ storedUrl: null, pageCount: 3, sectionCount: 4 })
  })

  it("projects supporting material sections to a real singular retrieval route", () => {
    const section = projectSupportingMaterialSection(
      {
        id: "material-section:123",
        sourceUrl: "https://source.example.test/materials/123.pdf",
        materialId: "material:ca:123",
        ordinal: 2,
        heading: null,
        text: "Analysis text",
        pageStart: 1,
        pageEnd: 2,
        contentHash: "b".repeat(64)
      },
      context
    )

    expect(section).toMatchObject({
      canonicalUrl:
        "https://legislation.example.test/api/supporting-materials/material%3Aca%3A123/sections/material-section%3A123",
      type: "supporting-material-section",
      pageStart: 1,
      pageEnd: 2
    })
  })

  it("requires a complete positive supporting-material page range", () => {
    const input = {
      contentHash: "b".repeat(64),
      heading: null,
      id: "material-section:123",
      materialId: "material:ca:123",
      ordinal: 2,
      sourceUrl: "https://source.example.test/materials/123.pdf",
      text: "Analysis text"
    }

    expect(() => projectSupportingMaterialSection({ ...input, pageEnd: 1, pageStart: 0 }, context)).toThrow(
      "supporting material section pageStart must be a positive safe integer"
    )
    expect(() => projectSupportingMaterialSection({ ...input, pageEnd: null, pageStart: 1 }, context)).toThrow(
      "supporting material section pages must both be null or both be present"
    )
    expect(() => projectSupportingMaterialSection({ ...input, pageEnd: 1, pageStart: null }, context)).toThrow(
      "supporting material section pages must both be null or both be present"
    )
  })

  it("projects canonical people, organizations, memberships, and terms", () => {
    const personInput = {
      id: "person:ca:1",
      sourceUrl: "https://source.example.test/people/1",
      name: "Alex Example",
      givenName: "Alex",
      familyName: "Example",
      party: null,
      imageUrl: null,
      isActive: true,
      jurisdictionIds: [billInput.jurisdictionId]
    } as const
    const organizationInput = {
      id: "organization:ca:assembly",
      sourceUrl: "https://source.example.test/organizations/assembly",
      jurisdictionId: billInput.jurisdictionId,
      name: "Assembly",
      classification: "chamber",
      parentOrganizationId: null,
      chamber: "lower",
      isActive: true
    } as const
    const person = projectPersonSummary(personInput, context)
    const organization = projectOrganizationSummary(organizationInput, context)
    const term = projectLegislativeTerm(
      {
        id: "term:ca:1",
        sourceUrl: personInput.sourceUrl,
        personId: person.id,
        jurisdictionId: billInput.jurisdictionId,
        organizationId: organization.id,
        district: "1",
        officeTitle: "Assembly Member",
        startDate: "2025-01-01",
        endDate: null,
        isCurrent: true
      },
      context
    )
    const membership = projectMembership(
      {
        id: "membership:ca:1",
        sourceUrl: personInput.sourceUrl,
        person,
        organization,
        role: "member",
        label: null,
        startDate: "2025-01-01",
        endDate: null,
        isCurrent: true
      },
      context
    )

    expect(
      projectPersonDetail(
        {
          person: personInput,
          otherNames: [],
          email: null,
          officialUrl: null,
          externalIdentifiers: [],
          terms: [term],
          memberships: [membership],
          membershipsPageInfo: { limit: 25, nextCursor: null, truncated: false }
        },
        context
      )
    ).toMatchObject({ email: null, terms: [{ officeTitle: "Assembly Member" }] })
    expect(
      projectOrganizationDetail(
        {
          organization: organizationInput,
          description: null,
          websiteUrl: null,
          contact: null,
          children: [],
          memberships: [membership],
          termsOfReference: null,
          childPageInfo: { memberships: { limit: 25, nextCursor: null, truncated: false } }
        },
        context
      )
    ).toMatchObject({ classification: "chamber", memberships: [{ role: "member" }] })
    expect(membership.canonicalUrl).toBe(
      "https://legislation.example.test/api/organizations/organization%3Aca%3Aassembly/memberships/membership%3Aca%3A1"
    )
  })

  it("projects meeting details and all documented nested meeting records", () => {
    const meetingInput = {
      id: "meeting:ca:1",
      sourceUrl: "https://source.example.test/meetings/1",
      jurisdictionId: billInput.jurisdictionId,
      sessionIds: [billInput.sessionId],
      organizationIds: [],
      calendarId: null,
      title: "Health hearing",
      description: null,
      classification: "hearing",
      status: "scheduled",
      startsAt: "2026-03-01T10:00:00-08:00",
      endsAt: null,
      date: "2026-03-01",
      location: { name: null, address: null, room: null, virtualUrl: null },
      isRemote: false
    } as const
    const participant = projectMeetingParticipant(
      {
        id: "participant:1",
        sourceUrl: meetingInput.sourceUrl,
        meetingId: meetingInput.id,
        person: null,
        organization: null,
        name: "Public witness",
        role: null
      },
      context
    )
    const agenda = projectAgendaItem(
      {
        id: "agenda:1",
        sourceUrl: meetingInput.sourceUrl,
        meetingId: meetingInput.id,
        ordinal: 0,
        title: "Opening",
        description: null,
        billIds: [],
        amendmentIds: [],
        materialIds: [],
        status: null
      },
      context
    )
    const document = projectEventDocument(
      {
        id: "event-document:1",
        sourceUrl: "https://source.example.test/meetings/1/agenda.pdf",
        meetingId: meetingInput.id,
        title: "Agenda",
        classification: "agenda",
        documentId: null,
        materialId: null
      },
      context
    )
    const outcome = projectMeetingOutcome(
      {
        id: "outcome:1",
        sourceUrl: meetingInput.sourceUrl,
        meetingId: meetingInput.id,
        agendaItemId: agenda.id,
        classification: "note",
        description: "No action taken",
        billActionId: null,
        voteId: null,
        linkMethod: "explicit"
      },
      context
    )

    expect(projectMeetingSummary(meetingInput, context)).toMatchObject({
      startsAt: "2026-03-01T18:00:00.000Z",
      date: "2026-03-01",
      classification: "hearing"
    })
    expect(
      projectMeetingDetail(
        {
          meeting: meetingInput,
          organizations: [],
          participants: [participant],
          agenda: [agenda],
          documents: [document],
          outcomes: [outcome],
          childPageInfo: {
            participants: { limit: 25, nextCursor: null, truncated: false },
            agenda: { limit: 25, nextCursor: null, truncated: false },
            documents: { limit: 25, nextCursor: null, truncated: false },
            outcomes: { limit: 25, nextCursor: null, truncated: false }
          }
        },
        context
      )
    ).toMatchObject({ participants: [{ name: "Public witness" }], agenda: [{ ordinal: 0 }] })
  })

  it("clones change snapshots and preserves null source timestamps", () => {
    const before = { status: "introduced" }
    const change = projectChangeEvent(
      {
        id: "change:123",
        recordType: "bill",
        recordId: billInput.id,
        classification: "update",
        changedFields: ["status"],
        before,
        after: null,
        jurisdictionId: billInput.jurisdictionId,
        organizationId: null,
        personId: null,
        observedAt: "2026-02-03T12:00:00Z",
        sourceUpdatedAt: null
      },
      context
    )
    before.status = "mutated"

    expect(change).toMatchObject({
      before: { status: "introduced" },
      after: null,
      sourceUpdatedAt: null,
      observedAt: "2026-02-03T12:00:00.000Z"
    })
  })

  it("accepts explicit RFC 3339 offsets and rejects ambiguous timestamp strings", () => {
    expect(projectBillSummary(billInput, { ...context, updatedAt: "2026-01-02T03:04:05+05:30" }).updatedAt).toBe(
      "2026-01-01T21:34:05.000Z"
    )

    for (const updatedAt of ["2026-01-01", "01/02/2026", "2026-01-01T12:00:00"]) {
      expect(() => projectBillSummary(billInput, { ...context, updatedAt })).toThrow(
        "canonical updatedAt must be an RFC 3339 timestamp with an explicit timezone"
      )
    }
  })

  it("allows 64 KiB change snapshots and rejects larger UTF-8 JSON", () => {
    const emptySnapshotBytes = new TextEncoder().encode(JSON.stringify({ value: "" })).byteLength
    const baseInput = {
      id: "change:size",
      recordType: "bill",
      recordId: billInput.id,
      classification: "update" as const,
      changedFields: ["title"],
      after: null,
      jurisdictionId: billInput.jurisdictionId,
      organizationId: null,
      personId: null,
      observedAt: "2026-02-03T12:00:00Z",
      sourceUpdatedAt: null
    }
    const atBoundary = { value: "a".repeat(64 * 1024 - emptySnapshotBytes) }

    expect(projectChangeEvent({ ...baseInput, before: atBoundary }, context).before).toEqual(atBoundary)
    expect(() => projectChangeEvent({ ...baseInput, before: { value: `${atBoundary.value}a` } }, context)).toThrow(
      "change before must not exceed 64 KiB of UTF-8 JSON"
    )
  })

  it("fails closed when required provenance or contract values are invalid", () => {
    expect(() => projectBillSummary({ ...billInput, status: "" }, context)).toThrow(CanonicalProjectionError)
    expect(() =>
      projectBillSummary(billInput, {
        ...context,
        sources: [{ ...context.sources[0], sourceUrl: "not-a-url" }]
      })
    ).toThrow("source URL must be an absolute URL")
    expect(() => projectVoteSummary({ ...voteInput, counts: { ...voteInput.counts, yes: -1 } }, context)).toThrow(
      "vote count yes must be a nonnegative safe integer"
    )
    expect(() =>
      projectSession(
        {
          id: "session:invalid",
          sourceUrl: "https://source.example.test/sessions/invalid",
          jurisdictionId: billInput.jurisdictionId,
          name: "Invalid session",
          classification: "primary",
          startDate: "2026-02-31",
          endDate: null,
          isActive: false
        },
        context
      )
    ).toThrow("session startDate must be an ISO date")
    const document = projectDocumentSummary(documentInput, context)
    expect(() =>
      projectBillDetail(
        {
          bill: billInput,
          abstract: null,
          sponsors: [],
          organizations: [],
          documents: [{ ...document, sources: [] as unknown as SourceReferences }],
          relations: [],
          amendments: [],
          latestActions: [],
          voteSummaries: [],
          childPageInfo: {
            documents: { limit: 25, nextCursor: null, truncated: false },
            amendments: { limit: 25, nextCursor: null, truncated: false },
            votes: { limit: 25, nextCursor: null, truncated: false }
          }
        },
        context
      )
    ).toThrow("bill document sources must be non-empty")
    expect(() =>
      projectVoteDetail(
        { vote: voteInput, positions: [], positionsPageInfo: { limit: -1, nextCursor: null, truncated: false } },
        context
      )
    ).toThrow("vote positions limit must be an integer between 1 and 100")
    expect(() =>
      projectVoteDetail(
        { vote: voteInput, positions: [], positionsPageInfo: { limit: 25, nextCursor: "", truncated: true } },
        context
      )
    ).toThrow("vote positions nextCursor must be null or non-empty")
    expect(() =>
      projectBillDetail(
        {
          bill: billInput,
          abstract: null,
          sponsors: [
            {
              person: null,
              sourceName: "Publisher",
              classification: "primary",
              isPrimary: true,
              sources: [] as unknown as SourceReferences
            }
          ],
          organizations: [],
          documents: [],
          relations: [],
          amendments: [],
          latestActions: [],
          voteSummaries: [],
          childPageInfo: {
            documents: { limit: 25, nextCursor: null, truncated: false },
            amendments: { limit: 25, nextCursor: null, truncated: false },
            votes: { limit: 25, nextCursor: null, truncated: false }
          }
        },
        context
      )
    ).toThrow("sponsor sources must be non-empty")
    const relatedBill = projectBillSummary(billInput, context)
    expect(() =>
      projectBillDetail(
        {
          bill: billInput,
          abstract: null,
          sponsors: [],
          organizations: [],
          documents: [],
          relations: [
            {
              relatedBill,
              classification: "related",
              sources: [] as unknown as SourceReferences
            }
          ],
          amendments: [],
          latestActions: [],
          voteSummaries: [],
          childPageInfo: {
            documents: { limit: 25, nextCursor: null, truncated: false },
            amendments: { limit: 25, nextCursor: null, truncated: false },
            votes: { limit: 25, nextCursor: null, truncated: false }
          }
        },
        context
      )
    ).toThrow("bill relation sources must be non-empty")
  })
})
