import { describe, expect, it } from "vitest"
import type { GovInfoDirectoryPackage } from "./committee-directory-client.js"
import { normalizeGovInfoCommitteeDirectory } from "./committee-directory-normalize.js"
import type { GovInfoCommitteeRecord } from "./committee-directory-parser.js"

const directoryPackage: GovInfoDirectoryPackage = {
  congress: 119,
  issuedAt: new Date("2026-02-20T00:00:00Z"),
  lastModified: new Date("2026-02-21T00:00:00Z"),
  packageId: "CDIR-2026-02-20",
  textUrl: new URL("https://www.govinfo.gov/content/pkg/CDIR-2026-02-20/text/CDIR-2026-02-20.txt")
}

describe("normalizeGovInfoCommitteeDirectory", () => {
  it("matches existing people and emits a complete organization-only snapshot", () => {
    const result = normalizeGovInfoCommitteeDirectory(records(), directoryPackage, catalog(), new Date("2026-08-26"))

    expect(result.unmatched).toEqual([])
    expect(result.snapshot.people).toEqual([])
    expect(result.snapshot.terms).toEqual([])
    expect(result.snapshot.organizations).toEqual([
      expect.objectContaining({
        classification: "committee",
        id: "organization:govinfo:upper-committee-agriculture",
        membershipRelationsComplete: true,
        name: "Agriculture"
      }),
      expect.objectContaining({
        classification: "subcommittee",
        parentOrganizationId: "organization:govinfo:upper-committee-agriculture"
      })
    ])
    expect(result.snapshot.memberships).toEqual([
      expect.objectContaining({
        detectedStartDate: "2026-02-20",
        isActive: true,
        lastObservedDate: "2026-02-20",
        legislativeSessionId: "session:us:119",
        personId: "person:congress:s000001",
        role: "chair",
        sourceId: "119:upper:committee:agriculture:person:congress:s000001"
      }),
      expect.objectContaining({ personId: "person:congress:s000001", role: "member" })
    ])
  })

  it("reports ambiguous or absent people instead of inventing identities", () => {
    const result = normalizeGovInfoCommitteeDirectory(
      records(),
      directoryPackage,
      {
        ...catalog(),
        people: [],
        terms: []
      },
      new Date("2026-08-26")
    )

    expect(result.snapshot.memberships).toEqual([])
    expect(result.unmatched).toHaveLength(2)
  })
})

function records(): GovInfoCommitteeRecord[] {
  return [
    {
      chamber: "upper",
      classification: "committee",
      members: [{ chamber: "upper", name: "Jane Q. Senator", role: "chair", state: "WA" }],
      name: "Agriculture"
    },
    {
      chamber: "upper",
      classification: "subcommittee",
      members: [{ chamber: "upper", name: "Jane Senator", state: "WA" }],
      name: "Food Safety",
      parentName: "Agriculture"
    }
  ]
}

function catalog() {
  return {
    aliases: [{ name: "Jane Senator", personId: "person:congress:s000001" }],
    people: [
      {
        familyName: "Senator",
        givenName: "Jane Q.",
        id: "person:congress:s000001",
        name: "Senator, Jane Q."
      }
    ],
    terms: [
      {
        chamber: "upper",
        district: null,
        isActive: true,
        personId: "person:congress:s000001",
        sourceId: "119:upper:2025:2027"
      }
    ]
  }
}
