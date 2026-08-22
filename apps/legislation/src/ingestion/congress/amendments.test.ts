import { describe, expect, it } from "vitest"
import { normalizeCongressAmendmentBundle } from "./amendments.js"

describe("Congress amendment normalization", () => {
  it("normalizes amendment actions, sponsor, related bill, and available text", () => {
    const snapshot = normalizeCongressAmendmentBundle({
      actions: [
        {
          actionCode: "Intro-S",
          actionDate: "2025-01-03",
          type: "IntroReferral"
        },
        {
          actionCode: "73000",
          actionDate: "2025-01-03",
          actionTime: "15:40:08",
          text: "On agreeing to the amendment Failed by voice vote.",
          type: "Floor"
        }
      ],
      amendment: {
        amendedBill: { congress: 119, number: "1", type: "HRES" },
        chamber: "House of Representatives",
        congress: 119,
        description: "An amendment to elect officers of the House.",
        latestAction: { text: "On agreeing to the amendment Failed by voice vote." },
        number: "1",
        sponsors: [{ bioguideId: "A000371", fullName: "Rep. Aguilar, Pete [D-CA-33]" }],
        submittedDate: "2025-01-03T05:00:00Z",
        type: "HAMDT",
        updateDate: "2025-01-06T19:45:32Z"
      },
      sourceUrl: "https://api.congress.gov/v3/amendment/119/hamdt/1",
      textVersions: [
        {
          date: "2025-01-03T17:10:00Z",
          formats: [{ type: "PDF", url: "https://www.congress.gov/example.pdf" }],
          type: "Offered"
        }
      ]
    })

    expect(snapshot.amendment).toMatchObject({
      billId: "bill:us:119:hres:1",
      chamber: "lower",
      id: "amendment:us:119:hamdt:1",
      sponsorPersonId: "person:congress:a000371",
      status: "failed"
    })
    expect(snapshot.actions[0]).toMatchObject({ description: "Intro-S", classification: ["introreferral"] })
    expect(snapshot.actions[1]).toMatchObject({ actionDate: "2025-01-03", classification: ["floor"] })
    expect(snapshot.materials[0]).toMatchObject({
      link: { amendmentId: "amendment:us:119:hamdt:1", billId: "bill:us:119:hres:1" },
      material: {
        classification: "amendment-text",
        contentType: "application/pdf",
        id: expect.stringMatching(/^material:congress:/)
      }
    })
  })

  it("retains an identified sponsor name when Congress.gov omits its bioguide ID", () => {
    const snapshot = normalizeCongressAmendmentBundle({
      actions: [],
      amendment: {
        congress: 119,
        number: "2",
        sponsors: [{ fullName: "Sen. Example, Pat [I-EX]" }],
        type: "SAMDT"
      },
      sourceUrl: "https://api.congress.gov/v3/amendment/119/samdt/2",
      textVersions: []
    })

    expect(snapshot.amendment).toMatchObject({
      sponsorName: "Sen. Example, Pat [I-EX]",
      sponsorPersonId: undefined,
      sponsorSourceId: undefined
    })
  })
})
