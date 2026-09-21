import { describe, expect, it } from "vitest"
import { normalizeSenateVote } from "./votes.js"

const reference = {
  congress: 119,
  session: 1,
  sourceUrl: "https://www.senate.gov/legislative/LIS/roll_call_votes/vote1191/vote_119_1_00363.xml",
  voteNumber: 363
} as const

const xml = `<?xml version="1.0"?><roll_call_vote>
  <congress>119</congress><session>1</session><vote_number>363</vote_number>
  <vote_date>July 1, 2025,  04:08 AM</vote_date>
  <vote_question_text>On the Amendment S.Amdt. 2814 to S.Amdt. 2360 to H.R. 1</vote_question_text>
  <vote_document_text>To strike the section relating to support for artificial intelligence.</vote_document_text>
  <vote_result_text>Amendment Agreed to (99-1)</vote_result_text><question>On the Amendment</question>
  <majority_requirement>1/2</majority_requirement><vote_result>Amendment Agreed to</vote_result>
  <document><document_type></document_type><document_number></document_number></document>
  <amendment><amendment_number>S.Amdt. 2814</amendment_number>
    <amendment_to_document_number>H.R. 1</amendment_to_document_number></amendment>
  <members>
    <member><member_full>Murray (D-WA)</member_full><first_name>Patty</first_name><last_name>Murray</last_name>
      <vote_cast>Yea</vote_cast><lis_member_id>S229</lis_member_id></member>
    <member><member_full>Tillis (R-NC)</member_full><first_name>Thom</first_name><last_name>Tillis</last_name>
      <vote_cast>Nay</vote_cast><lis_member_id>S384</lis_member_id></member>
    <member><member_full>Example (I-ZZ)</member_full><first_name>Example</first_name><last_name>Member</last_name>
      <vote_cast>Not Voting</vote_cast><lis_member_id>S999</lis_member_id></member>
  </members>
</roll_call_vote>`

describe("Senate vote normalization", () => {
  it("normalizes the roll call and links official LIS identities through Bioguide IDs", () => {
    const retrievedAt = new Date("2026-09-20T12:00:00Z")
    const snapshot = normalizeSenateVote(
      xml,
      reference,
      new Map([
        ["S229", "M001111"],
        ["S384", "T000476"]
      ]),
      retrievedAt
    )

    expect(snapshot.vote).toMatchObject({
      amendmentId: "amendment:us:119:samdt:2814",
      billId: "bill:us:119:hr:1",
      chamber: "upper",
      heldDate: "2025-07-01",
      id: "vote:congress:senate-119-1-363",
      noCount: 1,
      notVotingCount: 1,
      organizationId: "organization:congress:senate",
      result: "passed",
      sessionId: "session:us:119",
      sourceProvider: "senate",
      sourceRetrievedAt: retrievedAt,
      timelineComplete: true,
      yesCount: 1
    })
    expect(snapshot.positions).toEqual([
      expect.objectContaining({
        option: "yes",
        personId: "person:congress:m001111",
        sourceIdentity: "S229",
        sourcePersonId: "S229"
      }),
      expect.objectContaining({
        option: "no",
        personId: "person:congress:t000476",
        sourceIdentity: "S384"
      }),
      expect.objectContaining({
        option: "not-voting",
        personId: undefined,
        sourceIdentity: "S999"
      })
    ])
  })

  it("rejects mismatched source identity", () => {
    expect(() => normalizeSenateVote(xml, { ...reference, voteNumber: 364 }, new Map())).toThrow(
      "Senate vote identity mismatch"
    )
  })

  it("accepts repeated document and amendment nodes used by en bloc nomination votes", () => {
    const repeatedNodes = xml
      .replace(
        "</document>",
        "</document><document><document_type>PN</document_type><document_number>806-1</document_number></document>"
      )
      .replace("</amendment>", "</amendment><amendment><amendment_number></amendment_number></amendment>")

    expect(() => normalizeSenateVote(repeatedNodes, reference, new Map())).not.toThrow()
  })

  it.each([
    ["Not Sustained", "failed"],
    ["Sustained", "passed"],
    ["Amendment Not Agreed to", "failed"],
    ["Nomination Confirmed", "passed"],
    ["Veto Overridden", "passed"]
  ] as const)("normalizes the %s result as %s", (result, expected) => {
    const snapshot = normalizeSenateVote(
      xml.replace("<vote_result>Amendment Agreed to</vote_result>", `<vote_result>${result}</vote_result>`),
      reference,
      new Map()
    )

    expect(snapshot.vote.result).toBe(expected)
  })

  it.each([
    ["Guilty", "yes"],
    ["Not Guilty", "no"]
  ] as const)("normalizes the impeachment choice %s as %s", (choice, expected) => {
    const snapshot = normalizeSenateVote(
      xml.replace("<vote_cast>Yea</vote_cast>", `<vote_cast>${choice}</vote_cast>`),
      reference,
      new Map()
    )

    expect(snapshot.positions[0]?.option).toBe(expected)
  })

  it("normalizes an attributed live-pair vote", () => {
    const pairedVote = xml.replace(
      "<vote_cast>Yea</vote_cast>",
      '<vote_cast crp=" " pair="S375">Present, Giving Live Pair</vote_cast>'
    )

    expect(normalizeSenateVote(pairedVote, reference, new Map()).positions[0]?.option).toBe("paired")
  })
})
