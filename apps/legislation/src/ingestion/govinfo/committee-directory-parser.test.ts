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
