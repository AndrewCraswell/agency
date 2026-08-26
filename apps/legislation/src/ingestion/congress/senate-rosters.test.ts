import { describe, expect, it, vi } from "vitest"
import {
  normalizeSenateCommitteeRosters,
  SenateCommitteeRosterClient,
  senateCommitteeMembershipSourceUrl,
  senateCurrentCommitteeRosterSourceUrl
} from "./senate-rosters.js"

const retrievedAt = new Date("2026-08-26T12:00:00.000Z")

function currentRoster(
  assignments = assignmentsFor("A000001", "S001", "Alice", "Example", "CA", "D", ["SSAP00"])
): string {
  return `<senators>${assignments}</senators>`
}

function assignmentsFor(
  bioguideId: string,
  lisMemberId: string,
  first: string,
  last: string,
  state: string,
  party: string,
  codes: readonly string[],
  positions: Readonly<Record<string, string | undefined>> = {}
): string {
  return `<senator lis_member_id="${lisMemberId}">
    <name><first>${first}</first><last>${last}</last></name>
    <party>${party}</party><state>${state}</state><bioguideId>${bioguideId}</bioguideId>
    <committees>${codes.map((code) => `<committee code="${code}"${positions[code] === undefined ? "" : ` position="${positions[code]}"`}/>`).join("")}</committees>
  </senator>`
}

function committeeRoster(
  parentCode = "SSAP00",
  members = `<member><name><first>Alice</first><last>Example</last></name><state>CA</state><party>D</party><position>Chair</position></member>`,
  subcommitteeCode = "SSAP01"
): string {
  return `<committee_membership>
    <committees>
      <committee_code>${parentCode}</committee_code>
      <members>${members}</members>
      <subcommittee>
        <subcommittee_name>Agriculture</subcommittee_name>
        <committee_code>${subcommitteeCode}</committee_code>
        <members>${members}</members>
      </subcommittee>
    </committees>
  </committee_membership>`
}

describe("Senate official committee roster normalization", () => {
  it("normalizes Bioguide and LIS identities, parent assignments, and exact subcommittee roster matches", () => {
    const current = currentRoster(
      [
        assignmentsFor("A000001", "S001", "Alice", "Example", "CA", "D", ["SSAP00"], { SSAP00: "Chair" }),
        assignmentsFor("B000002", "S002", "Bob", "Example", "OR", "R", ["SSAP00"])
      ].join("")
    )
    const committee = committeeRoster(
      "SSAP00",
      [
        `<member><name><first>Alice</first><last>Example</last></name><state>CA</state><party>D</party><position>Chair</position></member>`,
        `<member><name><first>Bob</first><last>Example</last></name><state>OR</state><party>R</party><position>Member</position></member>`
      ].join("")
    )

    const snapshot = normalizeSenateCommitteeRosters(current, [{ parentCode: "SSAP00", xml: committee }], {
      retrievedAt
    })

    expect(snapshot.completeOrganizationIds).toEqual(["organization:congress:ssap00", "organization:congress:ssap01"])
    expect(snapshot.memberships).toHaveLength(4)
    expect(snapshot.memberships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Chair",
          organizationId: "organization:congress:ssap00",
          personId: "person:congress:a000001",
          role: "Chair",
          sourceId: "senate:SSAP00:A000001:S001",
          sourceRetrievedAt: retrievedAt,
          sourceUrl: senateCurrentCommitteeRosterSourceUrl,
          title: "Chair"
        }),
        expect.objectContaining({
          organizationId: "organization:congress:ssap00",
          personId: "person:congress:b000002",
          role: "member",
          sourceId: "senate:SSAP00:B000002:S002"
        }),
        expect.objectContaining({
          label: "Member",
          organizationId: "organization:congress:ssap01",
          personId: "person:congress:b000002",
          role: "Member",
          sourceId: "senate:SSAP01:B000002:S002",
          sourceUrl: senateCommitteeMembershipSourceUrl("SSAP00")
        })
      ])
    )
    expect(
      snapshot.memberships.every(
        (membership) =>
          membership.endDate === undefined &&
          membership.sourceUpdatedAt === undefined &&
          membership.startDate === undefined
      )
    ).toBe(true)
  })

  it("requires an exact name, state, party, and declared-parent crosswalk for every subcommittee member", () => {
    const current = currentRoster()
    const wrongParty = committeeRoster(
      "SSAP00",
      `<member><name><first>Alice</first><last>Example</last></name><state>CA</state><party>R</party><position>Chair</position></member>`
    )
    const wrongParent = currentRoster(assignmentsFor("A000001", "S001", "Alice", "Example", "CA", "D", ["SSJU00"]))

    expect(() =>
      normalizeSenateCommitteeRosters(current, [{ parentCode: "SSAP00", xml: wrongParty }], { retrievedAt })
    ).toThrow("0 exact current-Senator matches")
    expect(() =>
      normalizeSenateCommitteeRosters(wrongParent, [{ parentCode: "SSAP00", xml: committeeRoster() }], { retrievedAt })
    ).toThrow("0 exact current-Senator matches")
  })

  it("matches an optional current-Senator middle name when the roster publishes it in first name text", () => {
    const current = currentRoster(
      `<senator lis_member_id="S123">
        <name><first>Susan</first><middle>M.</middle><last>Collins</last><suffix> </suffix></name>
        <party>R</party><state>ME</state><bioguideId>C001035</bioguideId>
        <committees><committee code="SSAP00"/></committees>
      </senator>`
    )
    const roster = committeeRoster(
      "SSAP00",
      `<member><name><first>Susan M.</first><last>Collins</last></name><state>ME</state><party>R</party><position>Chairman</position></member>`
    )

    const snapshot = normalizeSenateCommitteeRosters(current, [{ parentCode: "SSAP00", xml: roster }], { retrievedAt })

    expect(snapshot.memberships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          organizationId: "organization:congress:ssap01",
          personId: "person:congress:c001035",
          sourceId: "senate:SSAP01:C001035:S123"
        })
      ])
    )
  })

  it("fails closed for ambiguous crosswalks and duplicate source assignments", () => {
    const ambiguous = currentRoster(
      [
        assignmentsFor("A000001", "S001", "Alice", "Example", "CA", "D", ["SSAP00"]),
        assignmentsFor("A000002", "S002", "Alice", "Example", "CA", "D", ["SSAP00"])
      ].join("")
    )
    const duplicateAssignment = currentRoster(
      assignmentsFor("A000001", "S001", "Alice", "Example", "CA", "D", ["SSAP00", "SSAP00"])
    )

    expect(() =>
      normalizeSenateCommitteeRosters(ambiguous, [{ parentCode: "SSAP00", xml: committeeRoster() }], { retrievedAt })
    ).toThrow("2 exact current-Senator matches")
    expect(() => normalizeSenateCommitteeRosters(duplicateAssignment, [], { retrievedAt })).toThrow(
      "duplicate assignment"
    )
  })

  it("does not materialize joint committees and rejects a requested joint roster", () => {
    const current = currentRoster(
      assignmentsFor("A000001", "S001", "Alice", "Example", "CA", "D", ["SSAP00", "JSEC00"])
    )

    const snapshot = normalizeSenateCommitteeRosters(current, [], { retrievedAt })

    expect(snapshot.completeOrganizationIds).toEqual(["organization:congress:ssap00"])
    expect(snapshot.memberships).toHaveLength(1)
    expect(() =>
      normalizeSenateCommitteeRosters(current, [{ parentCode: "JSEC00", xml: committeeRoster("JSEC00") }], {
        retrievedAt
      })
    ).toThrow("joint committee roster")
  })

  it("requires usable non-joint Senate parent coverage from a nonempty current feed", () => {
    expect(() =>
      normalizeSenateCommitteeRosters(
        currentRoster(assignmentsFor("A000001", "S001", "Alice", "Example", "CA", "D", [])),
        [],
        { retrievedAt }
      )
    ).toThrow("at least one non-joint parent committee assignment")
    expect(() =>
      normalizeSenateCommitteeRosters(
        currentRoster(assignmentsFor("A000001", "S001", "Alice", "Example", "CA", "D", ["JSEC00"])),
        [],
        { retrievedAt }
      )
    ).toThrow("at least one non-joint parent committee assignment")
  })

  it("rejects duplicate subcommittee members, mismatched feed parents, and missing retrieval provenance", () => {
    const duplicateMembers = [
      `<member><name><first>Alice</first><last>Example</last></name><state>CA</state><party>D</party><position>Chair</position></member>`,
      `<member><name><first>Alice</first><last>Example</last></name><state>CA</state><party>D</party><position>Member</position></member>`
    ].join("")

    expect(() =>
      normalizeSenateCommitteeRosters(currentRoster(), [{ parentCode: "SSAP00", xml: committeeRoster("SSJU00") }], {
        retrievedAt
      })
    ).toThrow("does not match requested")
    expect(() =>
      normalizeSenateCommitteeRosters(
        currentRoster(),
        [{ parentCode: "SSAP00", xml: committeeRoster("SSAP00", duplicateMembers) }],
        { retrievedAt }
      )
    ).toThrow("duplicate member")
    expect(() => normalizeSenateCommitteeRosters(currentRoster(), [], { retrievedAt: new Date("invalid") })).toThrow(
      "explicit retrievedAt"
    )
  })

  it("rejects malformed XML and non-official Bioguide and LIS identifier shapes", () => {
    expect(() => normalizeSenateCommitteeRosters("<senators><senator>", [], { retrievedAt })).toThrow(
      "current roster XML is malformed"
    )
    expect(() => normalizeSenateCommitteeRosters("<senators/>", [], { retrievedAt })).toThrow(
      "Senate current roster must contain at least one senator"
    )
    expect(() =>
      normalizeSenateCommitteeRosters(
        currentRoster(assignmentsFor("A001", "S001", "Alice", "Example", "CA", "D", ["SSAP00"])),
        [],
        { retrievedAt }
      )
    ).toThrow("Bioguide ID must be one uppercase letter followed by six digits")
    expect(() =>
      normalizeSenateCommitteeRosters(
        currentRoster(assignmentsFor("A000001", "S1001", "Alice", "Example", "CA", "D", ["SSAP00"])),
        [],
        { retrievedAt }
      )
    ).toThrow("LIS member ID must be one uppercase letter followed by three digits")
  })

  it("uses the bounded shared HTTP client for both official XML feeds", async () => {
    const getBytes = vi.fn<(url: URL, maximumBytes: number) => Promise<Uint8Array>>(async () =>
      new TextEncoder().encode("<senators/>")
    )
    const client = new SenateCommitteeRosterClient({ http: { getBytes }, maximumBytes: 1234 })

    await client.current()
    await client.committee("SSAP00")

    expect(getBytes).toHaveBeenNthCalledWith(1, new URL(senateCurrentCommitteeRosterSourceUrl), 1234)
    expect(getBytes).toHaveBeenNthCalledWith(2, new URL(senateCommitteeMembershipSourceUrl("SSAP00")), 1234)
  })
})
