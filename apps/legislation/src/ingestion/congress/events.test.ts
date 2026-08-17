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

    expect(snapshot.event).toMatchObject({
      allDay: true,
      classification: "published-hearing",
      id: "event:congress:published-hearing-58978",
      status: "published"
    })
    expect(snapshot.materials[0]?.material.classification).toBe("hearing-transcript")
  })
})
