import { describe, expect, it } from "vitest"
import { projectMeetingParticipantRead, type MeetingParticipantProjectionRead } from "./meeting-participant-projection"

function read(): MeetingParticipantProjectionRead {
  return {
    meeting: {
      createdAt: new Date("2026-08-20T15:00:00.000Z"),
      id: "meeting:us:119:1",
      sourceUpdatedAt: new Date("2026-08-21T15:00:00.000Z"),
      sourceUrl: "https://api.congress.gov/v3/committee-meeting/1",
      updatedAt: new Date("2026-08-22T15:00:00.000Z")
    },
    organization: {
      chamber: "upper",
      classification: "committee",
      createdAt: new Date("2026-08-10T15:00:00.000Z"),
      id: "organization:us:senate:rules",
      isActive: true,
      jurisdictionId: "jurisdiction:us",
      name: "Rules Committee",
      parentOrganizationId: "organization:us:senate",
      provenanceComplete: true,
      sourceIsOfficial: false,
      sourceProvider: "Congress.gov",
      sourceRetrievedAt: new Date("2026-08-20T15:00:00.000Z"),
      sourceUpdatedAt: null,
      sourceUrl: "https://api.congress.gov/v3/committee/SRUL00",
      updatedAt: new Date("2026-08-20T15:00:00.000Z")
    },
    participant: {
      eventId: "meeting:us:119:1",
      id: "participant:us:119:1:1",
      name: "Pat Witness",
      role: "witness"
    },
    person: {
      createdAt: new Date("2026-08-10T15:00:00.000Z"),
      familyName: "Witness",
      givenName: "Pat",
      id: "person:us:pat-witness",
      isActive: false,
      jurisdictionId: "jurisdiction:us",
      name: "Pat Witness",
      party: null,
      provenanceComplete: true,
      sourceIsOfficial: false,
      sourceProvider: "Congress.gov",
      sourceRetrievedAt: new Date("2026-08-20T15:00:00.000Z"),
      sourceUpdatedAt: null,
      sourceUrl: "https://api.congress.gov/v3/member/P000001",
      updatedAt: new Date("2026-08-20T15:00:00.000Z")
    }
  }
}

describe("meeting participant projection", () => {
  it("creates canonical participant and linked summaries from the limited persistence read", () => {
    const projected = projectMeetingParticipantRead(read(), "https://api.example.test")

    expect(projected).toMatchObject({
      canonicalUrl:
        "https://api.example.test/api/meetings/meeting%3Aus%3A119%3A1/participants/participant%3Aus%3A119%3A1%3A1",
      meetingId: "meeting:us:119:1",
      organization: { id: "organization:us:senate:rules", type: "organization" },
      person: { id: "person:us:pat-witness", type: "person" },
      type: "meeting-participant"
    })
    expect(projected.person?.sources).toEqual([
      {
        isOfficial: false,
        provider: "Congress.gov",
        retrievedAt: "2026-08-20T15:00:00.000Z",
        sourceUpdatedAt: null,
        sourceUrl: "https://api.congress.gov/v3/member/P000001"
      }
    ])
    expect(projected.organization?.sources).toEqual([
      {
        isOfficial: false,
        provider: "Congress.gov",
        retrievedAt: "2026-08-20T15:00:00.000Z",
        sourceUpdatedAt: null,
        sourceUrl: "https://api.congress.gov/v3/committee/SRUL00"
      }
    ])
    expect(projected.sources[0]?.retrievedAt).toBe("2026-08-20T15:00:00.000Z")
  })

  it("keeps a singleton read valid when its participant selection has no event ID", () => {
    const singletonRead = read()
    const participant = {
      id: singletonRead.participant.id,
      name: singletonRead.participant.name,
      role: singletonRead.participant.role
    }

    expect(projectMeetingParticipantRead({ ...singletonRead, participant }, "https://api.example.test").meetingId).toBe(
      "meeting:us:119:1"
    )
  })

  it("fails closed for incomplete linked provenance or a mismatched parent ID", () => {
    const incomplete = read()
    if (incomplete.person === null) {
      throw new Error("Expected person fixture")
    }
    const incompletePerson = { ...incomplete.person, provenanceComplete: false }
    expect(() =>
      projectMeetingParticipantRead({ ...incomplete, person: incompletePerson }, "https://api.example.test")
    ).toThrow("person canonical provenance is incomplete")

    const mismatched = read()
    const mismatchedParticipant = { ...mismatched.participant, eventId: "meeting:us:119:other" }
    expect(() =>
      projectMeetingParticipantRead({ ...mismatched, participant: mismatchedParticipant }, "https://api.example.test")
    ).toThrow("meeting participant does not belong to its projected meeting")
  })
})
