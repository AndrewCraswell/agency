import { describe, expect, it } from "vitest"
import { createGovInfoAssignmentResolver } from "./committee-assignment-index.js"
import type { GovInfoCommitteeRecord } from "./committee-directory-parser.js"

const parent: GovInfoCommitteeRecord = {
  chamber: "lower",
  classification: "committee",
  name: "Agriculture",
  members: [
    { chamber: "lower", name: "Nick Smith", state: "MI" },
    { chamber: "lower", name: "Robert F. Smith", state: "OR" }
  ]
}
const text = `Smith of Michigan (R)                      Agriculture -- Livestock,
                                            Dairy and Poultry; Forestry,
                                            Resource Conservation and
                                            Research.
Smith of Oregon (R)                        Agriculture.
                                           Resources -- National Parks
                                            and Public Lands; Water and
                                            Power.`

describe("GovInfo same-edition assignment disambiguation", () => {
  it("resolves Smith through a positive state-qualified subcommittee assignment", () => {
    const resolve = createGovInfoAssignmentResolver([{ chamber: "lower", title: "assignments", text }])
    expect(
      resolve({ name: "Smith", parent, chamber: "lower", subcommitteeName: "Livestock, Dairy and Poultry" })
    ).toMatchObject({ name: "Nick Smith", state: "MI" })
  })
  it("does not infer membership from parent committee presence or another committee's subcommittee", () => {
    const resolve = createGovInfoAssignmentResolver([{ chamber: "lower", title: "assignments", text }])
    expect(resolve({ name: "Smith", parent, chamber: "lower", subcommitteeName: "Water and Power" })).toBeUndefined()
  })
  it("fails closed if the assignment table supplies no unique candidate", () => {
    const resolve = createGovInfoAssignmentResolver([
      {
        chamber: "lower",
        title: "assignments",
        text: `${text}\nSmith of Oregon (R)                        Agriculture -- Livestock, Dairy and Poultry.`
      }
    ])
    expect(
      resolve({ name: "Smith", parent, chamber: "lower", subcommitteeName: "Livestock, Dairy and Poultry" })
    ).toBeUndefined()
  })
})
