import { describe, expect, it, vi } from "vitest"
import { organizationId, organizationMembershipId, personId } from "../../legislation/identifiers.js"
import { RetryingHttpClient } from "../http-client.js"
import {
  fetchHouseClerkCurrentCommitteeRoster,
  houseClerkOrganizationId,
  houseClerkMemberDataMaximumBytes,
  houseClerkMemberDataUrl,
  normalizeHouseClerkCurrentCommitteeRoster,
  parseHouseClerkCurrentCommitteeRoster
} from "./house-clerk-committee-roster.js"

const retrievedAt = new Date("2026-08-26T12:00:00.000Z")
const knownOrganizationIds = new Set([
  organizationId("congress", "HSAS00"),
  organizationId("congress", "HSAS02"),
  organizationId("congress", "HSJU00")
])

function memberData(
  assignments: string,
  committees = '<committee comcode="AS00"><subcommittee subcomcode="AS02"/></committee>'
): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<MemberData publish-date="August 26, 2026">
  <title-info><congress-num>119</congress-num></title-info>
  <members>
    <member>
      <member-info><bioguideID>R000575</bioguideID></member-info>
      <committee-assignments>${assignments}</committee-assignments>
    </member>
  </members>
  <committees>${committees}</committees>
</MemberData>`
}

describe("House Clerk current committee roster", () => {
  it("normalizes official committee and subcommittee assignments with Bioguide identities, rank, and leadership", () => {
    const result = normalizeHouseClerkCurrentCommitteeRoster(
      parseHouseClerkCurrentCommitteeRoster(
        memberData('<committee comcode="AS00" rank="1" leadership="Chair"/><subcommittee subcomcode="AS02" rank="3"/>')
      ),
      { knownOrganizationIds, retrievedAt }
    )
    const committeePersonId = personId("congress", "R000575")

    expect(result).toMatchObject({
      completeOrganizationIds: [organizationId("congress", "HSAS00"), organizationId("congress", "HSAS02")],
      publishDate: "August 26, 2026"
    })
    expect(result.memberships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          classification: "committee",
          id: organizationMembershipId(
            organizationId("congress", "HSAS00"),
            committeePersonId,
            "house-clerk:R000575:committee:AS00"
          ),
          isActive: true,
          label: "Chair",
          organizationId: organizationId("congress", "HSAS00"),
          personId: committeePersonId,
          rank: "1",
          role: "Chair",
          sourceIsOfficial: true,
          sourceProvider: "house-clerk",
          sourceRetrievedAt: retrievedAt,
          sourceUrl: houseClerkMemberDataUrl.toString(),
          title: "Chair"
        }),
        expect.objectContaining({
          classification: "subcommittee",
          organizationId: organizationId("congress", "HSAS02"),
          rank: "3",
          role: "member"
        })
      ])
    )
    expect(result.memberships[0]).not.toHaveProperty("startDate")
    expect(result.memberships[0]).not.toHaveProperty("endDate")
    expect(result.memberships[0]).not.toHaveProperty("sourceUpdatedAt")
  })

  it("crosswalks validated Clerk codes to existing six-character Congress system codes", () => {
    expect(houseClerkOrganizationId("AS00", "committee")).toBe(organizationId("congress", "HSAS00"))
    expect(houseClerkOrganizationId("AS02", "subcommittee")).toBe(organizationId("congress", "HSAS02"))
  })

  it("omits the Clerk's explicit vacant-district placeholder without inventing a person or membership", () => {
    const roster = parseHouseClerkCurrentCommitteeRoster(
      memberData('<committee rank=""/>')
        .replace("<bioguideID>R000575</bioguideID>", "<bioguideID></bioguideID>")
        .replace(
          "<committee-assignments>",
          "<predecessor-info><pred-lastname>Example</pred-lastname></predecessor-info><committee-assignments>"
        )
    )

    expect(roster.members).toEqual([])
  })

  it("rejects a nonempty committee tree with no normalized memberships as an outage", () => {
    const roster = parseHouseClerkCurrentCommitteeRoster(memberData(""))

    expect(() => normalizeHouseClerkCurrentCommitteeRoster(roster, { knownOrganizationIds, retrievedAt })).toThrow(
      "House Clerk roster has no normalized memberships."
    )
  })

  it("marks every tree-declared organization complete, including a committee with no members", () => {
    const roster = parseHouseClerkCurrentCommitteeRoster(
      memberData(
        '<committee comcode="AS00" rank="1"/>',
        '<committee comcode="AS00"><subcommittee subcomcode="AS02"/></committee><committee comcode="JU00"/>'
      )
    )
    const result = normalizeHouseClerkCurrentCommitteeRoster(roster, { knownOrganizationIds, retrievedAt })

    expect(result.completeOrganizationIds).toEqual([
      organizationId("congress", "HSAS00"),
      organizationId("congress", "HSAS02"),
      organizationId("congress", "HSJU00")
    ])
    expect(result.memberships).toHaveLength(1)
    expect(result.memberships[0]?.organizationId).toBe(organizationId("congress", "HSAS00"))
  })

  it("deduplicates exact repeated assignments but rejects conflicting or unknown assignments", () => {
    const duplicate = normalizeHouseClerkCurrentCommitteeRoster(
      parseHouseClerkCurrentCommitteeRoster(
        memberData('<committee comcode="AS00" rank="1"/><committee comcode="AS00" rank="1"/>')
      ),
      { knownOrganizationIds, retrievedAt }
    )
    expect(duplicate.memberships).toHaveLength(1)

    expect(() =>
      normalizeHouseClerkCurrentCommitteeRoster(
        parseHouseClerkCurrentCommitteeRoster(
          memberData('<committee comcode="AS00" rank="1"/><committee comcode="AS00" rank="2"/>')
        ),
        { knownOrganizationIds, retrievedAt }
      )
    ).toThrow("repeats a conflicting assignment")
    expect(() =>
      normalizeHouseClerkCurrentCommitteeRoster(
        parseHouseClerkCurrentCommitteeRoster(memberData('<committee comcode="JU00" rank="1"/>')),
        {
          knownOrganizationIds: new Set([organizationId("congress", "HSAS00"), organizationId("congress", "HSAS02")]),
          retrievedAt
        }
      )
    ).toThrow("unknown committee: JU00")
    expect(() =>
      normalizeHouseClerkCurrentCommitteeRoster(
        parseHouseClerkCurrentCommitteeRoster(memberData('<committee comcode="JU00" rank="1"/>')),
        { knownOrganizationIds, retrievedAt }
      )
    ).toThrow("not declared in the committee tree")
  })

  it("fails closed for malformed XML, unsupported assignment elements, and invalid House codes", () => {
    expect(() => parseHouseClerkCurrentCommitteeRoster("<MemberData>")).toThrow("XML is malformed")
    expect(() => parseHouseClerkCurrentCommitteeRoster(memberData('<assignment code="AS00"/>'))).toThrow(
      "unsupported assignment element"
    )
    expect(() => parseHouseClerkCurrentCommitteeRoster(memberData('<committee comcode="AS01" rank="1"/>'))).toThrow(
      "House committee code"
    )
    expect(() => parseHouseClerkCurrentCommitteeRoster(memberData('<committee rank="1"/>'))).toThrow(
      "Invalid input: expected string"
    )
    expect(() =>
      parseHouseClerkCurrentCommitteeRoster(
        memberData('<committee comcode="AS00" rank="1"/>').replace(
          "<bioguideID>R000575</bioguideID>",
          "<bioguideID></bioguideID>"
        )
      )
    ).toThrow("missing a Bioguide ID")
    expect(() =>
      parseHouseClerkCurrentCommitteeRoster(
        memberData('<committee comcode="AS00" rank="1"/>').replace(
          "<bioguideID>R000575</bioguideID>",
          "<bioguideID>r000575</bioguideID>"
        )
      )
    ).toThrow("Bioguide ID must be one uppercase letter followed by six digits")
    expect(() =>
      parseHouseClerkCurrentCommitteeRoster(
        memberData('<committee comcode="AS00" rank="1"/>').replace(
          "<bioguideID>R000575</bioguideID>",
          "<bioguideID>R00057</bioguideID>"
        )
      )
    ).toThrow("Bioguide ID must be one uppercase letter followed by six digits")
    expect(() =>
      parseHouseClerkCurrentCommitteeRoster(
        memberData('<committee comcode="AS00" rank="1"/>', '<committee comcode="AS00"/><committee comcode="AS00"/>')
      )
    ).toThrow("repeats a committee code")
    expect(() =>
      parseHouseClerkCurrentCommitteeRoster(
        memberData(
          '<committee comcode="AS00" rank="1"/>',
          '<committee comcode="AS00"><subcommittee subcomcode="JU02"/></committee>'
        )
      )
    ).toThrow("is not declared under its committee")
    expect(() =>
      parseHouseClerkCurrentCommitteeRoster(memberData('<subcommittee subcomcode="AS00" rank="1"/>'))
    ).toThrow("must not end in 00")
    expect(() =>
      normalizeHouseClerkCurrentCommitteeRoster(
        parseHouseClerkCurrentCommitteeRoster(memberData('<committee comcode="AS00"/>')),
        { knownOrganizationIds, retrievedAt: new Date("invalid") }
      )
    ).toThrow("retrievedAt must be a valid date")
  })

  it("fetches only the fixed official MemberData document through the bounded retrying HTTP client", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
      expect(String(input)).toBe(houseClerkMemberDataUrl.toString())
      expect(new Headers(init?.headers).get("accept")).toBe("application/xml")
      return new Response(memberData('<committee comcode="AS00" rank="1"/>'), {
        headers: { "content-type": "application/xml" },
        status: 200
      })
    })
    const http = new RetryingHttpClient({ fetch, maxAttempts: 1, requestTimeoutMs: 1000 })

    const result = await fetchHouseClerkCurrentCommitteeRoster(http, { knownOrganizationIds, retrievedAt })

    expect(fetch).toHaveBeenCalledOnce()
    expect(http.metrics.successfulRequests).toBe(1)
    expect(houseClerkMemberDataMaximumBytes).toBe(5 * 1024 * 1024)
    expect(result.memberships).toHaveLength(1)
  })
})
