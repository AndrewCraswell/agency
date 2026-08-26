import { describe, expect, it } from "vitest"
import type { MeetingRead } from "../db/queries/meeting-read.js"
import { projectMeetingRead } from "./meeting-read-projection.js"

function meeting(calendarId: string | null): MeetingRead {
  return {
    calendarId,
    classification: "meeting",
    description: null,
    endAt: null,
    id: "event:wa:rules-1",
    isRemote: false,
    jurisdictionId: "jurisdiction:wa",
    location: null,
    name: "Rules Committee",
    organizationIds: ["organization:wa:house"],
    publisherLocalDate: "2026-08-17",
    sessionIds: ["session:wa:2026"],
    sourceIsOfficial: true,
    sourceProvider: "wa-legislature",
    sourceRetrievedAt: new Date("2026-08-01T00:00:00.000Z"),
    sourceSequence: 1,
    sourceUpdatedAt: null,
    sourceUrl: "https://leg.wa.gov/events/rules-1",
    startAt: new Date("2026-08-17T17:00:00.000Z"),
    status: "scheduled",
    updatedAt: new Date("2026-08-01T00:00:00.000Z"),
    virtualAccess: null
  }
}

describe("meeting read projection", () => {
  it("projects the persisted singular calendar relation, including no calendar", () => {
    const baseUrl = "https://api.example.test"
    expect(projectMeetingRead(meeting(null), baseUrl)).toMatchObject({ calendarId: null, type: "meeting" })
    expect(projectMeetingRead(meeting("calendar:wa:committee-schedule"), baseUrl)).toMatchObject({
      calendarId: "calendar:wa:committee-schedule",
      type: "meeting"
    })
  })
})
