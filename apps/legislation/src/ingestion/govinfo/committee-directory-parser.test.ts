import { describe, expect, it } from "vitest"
import { parseGovInfoCommitteeDirectory } from "./committee-directory-parser.js"

describe("parseGovInfoCommitteeDirectory", () => {
  it("extracts committees, subcommittees, roles, chambers, and districts from text only", () => {
    const records = parseGovInfoCommitteeDirectory(directoryFixture())

    expect(records).toContainEqual({
      chamber: "upper",
      classification: "committee",
      members: [
        { chamber: "upper", name: "Jane Q. Senator", role: "chair", state: "WA" },
        { chamber: "upper", name: "John Senator", role: "ranking-member", state: "OR" }
      ],
      name: "Senate Committee 1"
    })
    expect(records).toContainEqual({
      chamber: "upper",
      classification: "subcommittee",
      members: [{ chamber: "upper", name: "Jane Q. Senator", role: "chair", state: "WA" }],
      name: "OVERSIGHT AND REVIEW",
      parentName: "Senate Committee 10"
    })
    expect(records).toContainEqual({
      chamber: "lower",
      classification: "committee",
      members: [{ chamber: "lower", district: "3", name: "Alex Representative", role: "chair", state: "CA" }],
      name: "House Committee 1"
    })
  })

  it("fails closed when either chamber falls below the completeness threshold", () => {
    expect(() =>
      parseGovInfoCommitteeDirectory(
        "STANDING COMMITTEES OF THE SENATE\n\nOnly Committee\n\nJane Senator (wa)\n\nSTANDING COMMITTEES OF THE HOUSE\n\nOnly Committee\n\nJohn Representative (ca-01)\n\nJOINT COMMITTEES"
      )
    ).toThrow("completeness threshold")
  })

  it("repairs wrapped names and roles without merging the neighboring printed column", () => {
    const fixture = directoryFixture().replace(
      "Alex Representative (ca-03) chairman",
      'Charles J. "Chuck" Fleischmann     Mike Quigley (il-05)\n        (tn-03)                      Grace Meng (ny-06)\nMario Diaz-Balart (fl-26) vice       Steny H. Hoyer (md-05)\n        chair                        Marcy Kaptur (oh-09)'
    )
    const record = parseGovInfoCommitteeDirectory(fixture).find((value) => value.name === "House Committee 1")
    expect(record?.members).toEqual([
      { chamber: "lower", district: "3", name: 'Charles J. "Chuck" Fleischmann', state: "TN" },
      { chamber: "lower", district: "26", name: "Mario Diaz-Balart", role: "vice-chair", state: "FL" },
      { chamber: "lower", district: "5", name: "Mike Quigley", state: "IL" },
      { chamber: "lower", district: "6", name: "Grace Meng", state: "NY" },
      { chamber: "lower", district: "5", name: "Steny H. Hoyer", state: "MD" },
      { chamber: "lower", district: "9", name: "Marcy Kaptur", state: "OH" }
    ])
  })

  it("preserves both columns when a name has extra spacing before its district", () => {
    const fixture = directoryFixture().replace(
      "Alex Representative (ca-03) chairman",
      "Sheri Biggs  (sc-03)                 Bill Foster (il-11)"
    )
    expect(
      parseGovInfoCommitteeDirectory(fixture).find((value) => value.name === "House Committee 1")?.members
    ).toEqual([
      { chamber: "lower", district: "3", name: "Sheri Biggs", state: "SC" },
      { chamber: "lower", district: "11", name: "Bill Foster", state: "IL" }
    ])
  })

  it("rejects annotations that cannot be assigned to a parsed member", () => {
    const fixture = directoryFixture().replace("Alex Representative (ca-03) chairman", "??? (ca-03)")
    expect(() => parseGovInfoCommitteeDirectory(fixture)).toThrow("roster completeness mismatch")
  })
})

function directoryFixture(): string {
  const senate = Array.from({ length: 10 }, (_, index) => {
    const suffix = index + 1
    return `Senate Committee ${suffix}\n\nJane Q. Senator (wa) chairman    John Senator (or) ranking member`
  }).join("\n\n")
  const house = Array.from({ length: 10 }, (_, index) => {
    const suffix = index + 1
    return `House Committee ${suffix}\n\nAlex Representative (ca-03) chairman`
  }).join("\n\n")
  return `STANDING COMMITTEES OF THE SENATE\n\n${senate}\n\nSUBCOMMITTEES\n\nOVERSIGHT AND REVIEW\n\nJane Q. Senator (wa) chair\n\nSTANDING COMMITTEES OF THE HOUSE\n\n${house}\n\nJOINT COMMITTEES`
}
