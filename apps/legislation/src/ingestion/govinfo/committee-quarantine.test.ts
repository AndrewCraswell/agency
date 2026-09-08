import { describe, expect, it, vi } from "vitest"
import type { GovInfoDirectoryPackage } from "./committee-directory-client.js"
import { normalizeGovInfoCommitteeDirectory } from "./committee-directory-normalize.js"
import type { GovInfoCommitteeRecord } from "./committee-directory-parser.js"

vi.mock("./committee-reviewed-identities.js", () => ({ reviewedGovInfoIdentities: () => new Map() }))

function fixture() {
  const directory: GovInfoDirectoryPackage = {
    congress: 117,
    packageId: "CDIR-2022-10-26",
    issuedAt: new Date("2022-10-26"),
    lastModified: new Date("2022-10-26"),
    sourceUrl: new URL("https://www.govinfo.gov/app/details/CDIR-2022-10-26"),
    textUrl: new URL("https://www.govinfo.gov/content/pkg/CDIR-2022-10-26/text/CDIR-2022-10-26.txt")
  }
  const record: GovInfoCommitteeRecord = {
    chamber: "upper",
    classification: "committee",
    name: "Appropriations",
    members: [{ chamber: "upper", name: "Tom Udall", state: "NM" }]
  }
  return { directory, record }
}

function normalize(record: GovInfoCommitteeRecord, directory: GovInfoDirectoryPackage) {
  return normalizeGovInfoCommitteeDirectory([record], directory, { people: [], terms: [], aliases: [] }, new Date())
}

describe("reviewed committee assignment quarantine", () => {
  it("records the disputed assignment separately without fabricating a person or replacement", () => {
    const { record, directory } = fixture()
    const result = normalize(record, directory)
    expect(result.quarantined).toEqual([
      {
        chamber: "upper",
        name: "Tom Udall",
        organization: "Appropriations",
        reason: "source_term_contradiction",
        personId: "person:congress:u000039"
      }
    ])
    expect(result.unmatched).toEqual([])
    expect(result.snapshot.memberships).toEqual([])
    expect(result.snapshot.organizations[0]?.membershipRelationsComplete).toBe(false)
  })

  it.each(["edition", "congress", "committee", "parent", "chamber", "state", "name", "role", "note", "district"])(
    "does not extend the exception to changed %s evidence",
    (change) => {
      const { record, directory } = fixture()
      const member = record.members[0]!
      if (change === "edition") {
        directory.packageId = "CDIR-2024-04-25"
      }
      if (change === "congress") {
        directory.congress = 118
      }
      if (change === "committee") {
        record.name = "Finance"
      }
      if (change === "parent") {
        record.parentName = "Appropriations"
      }
      if (change === "chamber") {
        member.chamber = "lower"
      }
      if (change === "state") {
        member.state = "CO"
      }
      if (change === "name") {
        member.name = "Mark Udall"
      }
      if (change === "role") {
        member.role = "chair"
      }
      if (change === "note") {
        member.note = "Historical assignment"
      }
      if (change === "district") {
        member.district = "1"
      }
      const result = normalize(record, directory)
      expect(result.quarantined).toEqual([])
      expect(result.unmatched).toHaveLength(1)
    }
  )

  it("rejects duplicated reviewed cells", () => {
    const { record, directory } = fixture()
    record.members.push({ ...record.members[0]! })
    expect(() => normalize(record, directory)).toThrow("changed cardinality")
  })
})
