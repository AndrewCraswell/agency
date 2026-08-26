import { describe, expect, it, vi } from "vitest"
import type { replaceAuthoritativeOrganizationMembershipRoster } from "../../db/queries/entities.js"
import { organizationId } from "../../legislation/identifiers.js"
import {
  synchronizeCurrentCongressCommitteeRosters,
  type CurrentCongressCommitteeRosterOrganization,
  type CurrentCongressCommitteeRosterReaders
} from "./current-committee-rosters.js"

const retrievedAt = new Date("2026-08-26T12:00:00.000Z")
const houseOrganizationId = organizationId("congress", "HSAS00")
const senateOrganizationId = organizationId("congress", "SSAP00")
const senateSubcommitteeOrganizationId = organizationId("congress", "SSAP01")
const organizations: CurrentCongressCommitteeRosterOrganization[] = [
  { chamber: "lower", classification: "committee", id: houseOrganizationId, sourceId: "HSAS00" },
  { chamber: "upper", classification: "committee", id: senateOrganizationId, sourceId: "SSAP00" },
  { chamber: "upper", classification: "subcommittee", id: senateSubcommitteeOrganizationId, sourceId: "SSAP01" }
]

const currentSenateRoster = `<senators><senator lis_member_id="S001">
  <name><first>Alice</first><last>Example</last></name><party>D</party><state>CA</state><bioguideId>A000001</bioguideId>
  <committees><committee code="SSAP00" position="Chair"/></committees>
</senator></senators>`
const senateCommitteeRoster = `<committee_membership><committees>
  <committee_code>SSAP00</committee_code>
  <members><member><name><first>Alice</first><last>Example</last></name><state>CA</state><party>D</party><position>Chair</position></member></members>
  <subcommittee><subcommittee_name>Agriculture</subcommittee_name><committee_code>SSAP01</committee_code>
  <members><member><name><first>Alice</first><last>Example</last></name><state>CA</state><party>D</party><position>Chair</position></member></members>
  </subcommittee>
</committees></committee_membership>`

describe("current Congress committee roster composition", () => {
  it("writes House and Senate current scopes separately, including an empty complete House committee", async () => {
    const calls: string[] = []
    const replaceRoster = vi.fn<typeof replaceAuthoritativeOrganizationMembershipRoster>(async (_database, input) => {
      calls.push(`write:${input.organizationIds.join(",")}:${input.memberships.length}`)
    })
    const readers = readersFor(calls)

    const result = await synchronizeCurrentCongressCommitteeRosters({
      database: {} as never,
      organizations,
      readers,
      replaceRoster,
      retrievedAt
    })

    expect(calls).toEqual([
      "house",
      `write:${houseOrganizationId}:0`,
      "senate:current",
      "senate:committee:SSAP00",
      `write:${senateOrganizationId},${senateSubcommitteeOrganizationId}:2`
    ])
    expect(result.house.memberships).toEqual([])
    expect(result.house.completeOrganizationIds).toEqual([houseOrganizationId])
    expect(result.senate.completeOrganizationIds).toEqual([senateOrganizationId, senateSubcommitteeOrganizationId])
  })

  it("propagates a Senate source failure after only the completed House scope", async () => {
    const calls: string[] = []
    const replaceRoster = vi.fn<typeof replaceAuthoritativeOrganizationMembershipRoster>(async (_database, input) => {
      calls.push(`write:${input.organizationIds.join(",")}:${input.memberships.length}`)
    })
    const readers = readersFor(calls)
    readers.senate.current = async () => {
      calls.push("senate:current")
      throw new Error("Senate roster unavailable")
    }

    await expect(
      synchronizeCurrentCongressCommitteeRosters({
        database: {} as never,
        organizations,
        readers,
        replaceRoster,
        retrievedAt
      })
    ).rejects.toThrow("Senate roster unavailable")

    expect(calls).toEqual(["house", `write:${houseOrganizationId}:0`, "senate:current"])
  })
})

function readersFor(calls: string[]): CurrentCongressCommitteeRosterReaders {
  return {
    fetchHouseRoster: async (context) => {
      calls.push("house")
      expect(context.knownOrganizationIds).toEqual(new Set(organizations.map((organization) => organization.id)))
      return { completeOrganizationIds: [houseOrganizationId], memberships: [], publishDate: "August 26, 2026" }
    },
    senate: {
      committee: async (parentCode) => {
        calls.push(`senate:committee:${parentCode}`)
        return senateCommitteeRoster
      },
      current: async () => {
        calls.push("senate:current")
        return currentSenateRoster
      }
    }
  }
}
