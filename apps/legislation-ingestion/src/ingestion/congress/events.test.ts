import { describe, expect, it } from "vitest"
import { normalizeCongressCommitteeMeeting, normalizeCongressHearing } from "./events.js"

const context = { retrievedAt: new Date("2026-08-26T12:00:00.000Z") }
const normalizeMeeting = (input: unknown) => normalizeCongressCommitteeMeeting(input, context)

describe("Congress event normalization", () => {
  it("normalizes a committee meeting with committees, witnesses, bills, and materials", () => {
    const snapshot = normalizeMeeting({
      meeting: {
        chamber: "House",
        committees: [{ name: "Energy Subcommittee", systemCode: "hsif03" }],
        congress: 119,
        date: "2026-04-29T14:15:00Z",
        eventId: "119189",
        location: { building: "Rayburn", room: "2123" },
        meetingDocuments: [
          {
            documentType: "Hearing: Transcript",
            format: "PDF",
            name: "Transcript",
            url: "https://congress.gov/transcript.pdf"
          }
        ],
        meetingStatus: "Scheduled",
        relatedItems: { bills: [{ congress: 119, number: "6336", type: "HR" }] },
        title: "AI and the Grid",
        type: "Hearing",
        updateDate: "2026-08-14T22:26:43Z",
        witnessDocuments: [
          {
            documentType: "Witness statement",
            format: "PDF",
            name: "Duplicate transcript URL",
            url: "https://congress.gov/transcript.pdf"
          }
        ],
        witnesses: [{ name: "Ms. Example", organization: "Example Energy", position: "President" }]
      },
      sourceUrl: "https://api.congress.gov/v3/committee-meeting/119/house/119189"
    })

    expect(snapshot.event).toMatchObject({
      canonicalFactsComplete: true,
      classification: "hearing",
      id: "event:congress:committee-meeting-119189",
      isRemote: false,
      organizationRelationsComplete: true,
      provenanceComplete: true,
      publisherLocalDate: "2026-04-29",
      sessionRelationsComplete: true,
      sourceIsOfficial: true,
      sourceProvider: "congress",
      sourceRetrievedAt: context.retrievedAt,
      status: "scheduled"
    })
    expect(snapshot.billIds).toEqual(["bill:us:119:hr:6336"])
    expect(snapshot.organizationIds).toEqual(["organization:congress:hsif03"])
    expect(snapshot.participants).toHaveLength(2)
    expect(snapshot.sessionIds).toEqual(["session:us:119"])
    expect(snapshot.documents).toHaveLength(1)
    expect(snapshot.materials).toHaveLength(1)
    expect(snapshot.materials[0]?.material).toMatchObject({
      classification: "hearing-transcript",
      contentType: "application/pdf"
    })
  })

  it("normalizes a published hearing as an all-day event without inventing a meeting time", () => {
    const snapshot = normalizeCongressHearing(
      {
        hearing: {
          chamber: "House",
          committees: [{ name: "Science Committee", systemCode: "hssy00" }],
          congress: 119,
          dates: [{ date: "2025-03-05" }],
          formats: [{ type: "PDF", url: "https://congress.gov/hearing.pdf" }],
          jacketNumber: 58978,
          title: "Assessing the Threat",
          updateDate: "2026-08-17T01:21:42Z"
        },
        sourceUrl: "https://api.congress.gov/v3/hearing/119/house/58978"
      },
      context
    )
    if (snapshot === undefined) {
      throw new Error("Expected a dated hearing snapshot")
    }

    expect(snapshot.event).toMatchObject({
      allDay: true,
      classification: "hearing",
      id: "event:congress:published-hearing-58978",
      canonicalFactsComplete: true,
      provenanceComplete: true,
      publisherLocalDate: "2025-03-05",
      isRemote: null,
      sessionRelationsComplete: true,
      organizationRelationsComplete: true,
      status: "other"
    })
    expect(snapshot.materials[0]?.material.classification).toBe("hearing-transcript")
    expect(snapshot.sessionIds).toEqual(["session:us:119"])
    expect(snapshot.organizationIds).toEqual(["organization:congress:hssy00"])
  })

  it("derives remote status only from an unambiguous source-declared location", () => {
    const ambiguousLocation = normalizeMeeting({
      meeting: {
        chamber: "House",
        committees: [{ systemCode: "hsag00" }],
        congress: 119,
        date: "2026-08-26T14:00:00Z",
        eventId: "ambiguous-location",
        location: { access: "Online stream", building: "Rayburn" },
        meetingStatus: "Scheduled",
        title: "Ambiguous location",
        type: "Meeting"
      },
      sourceUrl: "https://api.congress.gov/v3/committee-meeting/119/house/ambiguous-location"
    })
    const virtualLocation = normalizeMeeting({
      meeting: {
        chamber: "House",
        committees: [],
        congress: 119,
        date: "2026-08-26T14:00:00Z",
        eventId: "virtual-location",
        location: { address: "Remote online meeting", building: "----------", room: "WEBEX" },
        meetingStatus: "Rescheduled",
        title: "Virtual location",
        type: "Markup"
      },
      sourceUrl: "https://api.congress.gov/v3/committee-meeting/119/house/virtual-location"
    })
    const missingTypeAndStatus = normalizeMeeting({
      meeting: {
        chamber: "House",
        committees: [],
        congress: 119,
        date: "2026-08-26T14:00:00Z",
        eventId: "missing-type-and-status",
        location: { room: "2123" },
        title: "Missing type and status"
      },
      sourceUrl: "https://api.congress.gov/v3/committee-meeting/119/house/missing-type-and-status"
    })
    const missingCommitteeCollection = normalizeMeeting({
      meeting: {
        chamber: "House",
        congress: 119,
        date: "2026-08-26T14:00:00Z",
        eventId: "missing-committees",
        location: { building: "Longworth House Office Building" },
        meetingStatus: "Postponed",
        title: "Missing committee collection",
        type: "Meeting"
      },
      sourceUrl: "https://api.congress.gov/v3/committee-meeting/119/house/missing-committees"
    })
    const missingRetrieval = normalizeCongressCommitteeMeeting(
      {
        meeting: {
          chamber: "House",
          committees: [],
          congress: 119,
          date: "2026-08-26T14:00:00Z",
          eventId: "missing-retrieval",
          location: { room: "2123" },
          meetingStatus: "Scheduled",
          title: "Missing retrieval provenance",
          type: "Meeting"
        },
        sourceUrl: "https://api.congress.gov/v3/committee-meeting/119/house/missing-retrieval"
      },
      {}
    )

    expect(ambiguousLocation.event).toMatchObject({
      canonicalFactsComplete: true,
      isRemote: undefined,
      organizationRelationsComplete: true,
      provenanceComplete: true,
      sessionRelationsComplete: true
    })
    expect(ambiguousLocation.organizationIds).toEqual(["organization:congress:hsag00"])
    expect(virtualLocation.event).toMatchObject({
      canonicalFactsComplete: true,
      classification: "meeting",
      isRemote: true,
      status: "postponed"
    })
    expect(missingTypeAndStatus.event).toMatchObject({
      canonicalFactsComplete: false,
      classification: "other",
      status: "other"
    })
    expect(missingCommitteeCollection.event).toMatchObject({
      canonicalFactsComplete: false,
      classification: "meeting",
      isRemote: false,
      organizationRelationsComplete: false,
      sessionRelationsComplete: true,
      status: "postponed"
    })
    expect(missingCommitteeCollection.organizationIds).toEqual([])
    expect(missingRetrieval.event).toMatchObject({ canonicalFactsComplete: false, provenanceComplete: false })
  })

  it("normalizes the provider's alternate cancellation spelling", () => {
    const snapshot = normalizeMeeting({
      meeting: {
        chamber: "House",
        committees: [],
        congress: 119,
        date: "2026-04-29T14:15:00Z",
        eventId: "119190",
        meetingStatus: "Canceled",
        relatedItems: { bills: [] },
        title: "Cancelled meeting"
      },
      sourceUrl: "https://api.congress.gov/v3/committee-meeting/119/house/119190"
    })

    expect(snapshot.event).toMatchObject({ isDeleted: false, status: "cancelled" })
  })

  it("keeps a committee participant when Congress.gov provides only its system code", () => {
    const snapshot = normalizeMeeting({
      meeting: {
        chamber: "House",
        committees: [{ systemCode: "hsgo00" }],
        congress: 113,
        date: "2014-12-09T14:30:00Z",
        eventId: "102796",
        title: "Full Committee Hearing"
      },
      sourceUrl: "https://api.congress.gov/v3/committee-meeting/113/house/102796"
    })

    expect(snapshot.participants).toContainEqual(
      expect.objectContaining({
        name: "hsgo00",
        organizationId: "organization:congress:hsgo00",
        role: "committee"
      })
    )
  })

  it("deduplicates the repeated committee in the live meeting 338700 payload", () => {
    const snapshot = normalizeMeeting({
      meeting: {
        chamber: "Senate",
        committees: [
          { name: "Senate Judiciary", systemCode: "ssju00" },
          { name: "Senate Judiciary", systemCode: "ssju00" }
        ],
        congress: 119,
        date: "2026-08-05T14:00:00Z",
        eventId: "338700",
        title: "Nomination hearing"
      },
      sourceUrl: "https://api.congress.gov/v3/committee-meeting/119/senate/338700"
    })

    expect(snapshot.participants).toEqual([
      expect.objectContaining({
        id: "event:congress:committee-meeting-338700:participant:fc940c00409c359a9a9de501",
        organizationId: "organization:congress:ssju00"
      })
    ])
  })

  it("ignores a meeting document without a URL while retaining usable material", () => {
    const snapshot = normalizeMeeting({
      meeting: {
        chamber: "House",
        committees: [],
        congress: 113,
        date: "2014-12-09T14:30:00Z",
        eventId: "102797",
        meetingDocuments: [
          { documentType: "Placeholder", name: "Unavailable" },
          { documentType: "Witness statement", name: "Statement", url: "https://congress.gov/statement.pdf" }
        ],
        title: "Full Committee Hearing"
      },
      sourceUrl: "https://api.congress.gov/v3/committee-meeting/113/house/102797"
    })

    expect(snapshot.documents).toHaveLength(1)
    expect(snapshot.materials).toHaveLength(1)
    expect(snapshot.documents[0]?.sourceUrl).toBe("https://congress.gov/statement.pdf")
  })

  it("skips a published hearing when Congress.gov does not provide an event date", () => {
    const snapshot = normalizeCongressHearing({
      hearing: {
        chamber: "House",
        congress: 113,
        jacketNumber: 80170,
        title: "Undated published hearing",
        updateDate: "2025-08-14T15:26:25Z"
      },
      sourceUrl: "https://api.congress.gov/v3/hearing/113/house/80170"
    })

    expect(snapshot).toBeUndefined()
  })
})
