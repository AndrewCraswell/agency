import { describe, expect, it } from "vitest"
import { normalizeCongressCommitteeMeeting, normalizeCongressHearing } from "./events.js"

describe("Congress event normalization", () => {
  it("normalizes a committee meeting with committees, witnesses, bills, and materials", () => {
    const snapshot = normalizeCongressCommitteeMeeting({
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
      id: "event:congress:committee-meeting-119189",
      status: "scheduled"
    })
    expect(snapshot.billIds).toEqual(["bill:us:119:hr:6336"])
    expect(snapshot.participants).toHaveLength(2)
    expect(snapshot.documents).toHaveLength(1)
    expect(snapshot.materials).toHaveLength(1)
    expect(snapshot.materials[0]?.material).toMatchObject({
      classification: "hearing-transcript",
      contentType: "application/pdf"
    })
  })

  it("normalizes a published hearing as an all-day event without inventing a meeting time", () => {
    const snapshot = normalizeCongressHearing({
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
    })
    if (snapshot === undefined) {
      throw new Error("Expected a dated hearing snapshot")
    }

    expect(snapshot.event).toMatchObject({
      allDay: true,
      classification: "published-hearing",
      id: "event:congress:published-hearing-58978",
      status: "published"
    })
    expect(snapshot.materials[0]?.material.classification).toBe("hearing-transcript")
  })

  it("normalizes the provider's alternate cancellation spelling", () => {
    const snapshot = normalizeCongressCommitteeMeeting({
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
    const snapshot = normalizeCongressCommitteeMeeting({
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
    const snapshot = normalizeCongressCommitteeMeeting({
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
    const snapshot = normalizeCongressCommitteeMeeting({
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
