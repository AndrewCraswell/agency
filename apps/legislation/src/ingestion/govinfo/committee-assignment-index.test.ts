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
  it("does not use a positive Ney assignment to resolve a different surname ending in ney", () => {
    const roster: GovInfoCommitteeRecord = {
      chamber: "lower",
      classification: "committee",
      name: "Banking and Financial Services",
      members: [
        { chamber: "lower", name: "Robert W. Ney", state: "OH" },
        { chamber: "lower", name: "Cynthia McKinney", state: "OH" },
        { chamber: "lower", name: "Tom Feeney", state: "OH" },
        { chamber: "lower", name: "John F. Tierney", state: "OH" }
      ]
    }
    const resolve = createGovInfoAssignmentResolver([
      {
        chamber: "lower",
        title: "assignments",
        text: "Ney of Ohio (R)                           Banking and Financial Services -- Housing."
      }
    ])
    const context = { name: "Ney", parent: roster, chamber: "lower", subcommitteeName: "Housing" } satisfies Parameters<
      typeof resolve
    >[0]
    expect(resolve(context)).toEqual(roster.members[0])
    expect(resolve({ ...context, parent: { ...roster, members: roster.members.slice(1) } })).toBeUndefined()
    expect(
      resolve({
        ...context,
        parent: { ...roster, members: [...roster.members, { chamber: "lower", name: "Another Ney", state: "OH" }] }
      })
    ).toBeUndefined()
  })
  it("resolves Thumond only through the positive Thurmond Antitrust assignment", () => {
    const senate: GovInfoCommitteeRecord = {
      chamber: "upper",
      classification: "committee",
      name: "Judiciary",
      members: [{ chamber: "upper", name: "Strom Thurmond", state: "SC" }]
    }
    const resolve = createGovInfoAssignmentResolver([
      {
        chamber: "upper",
        title: "assignments",
        text: "Thurmond (R)                               Judiciary -- Administrative Oversight and the Courts; Antitrust, Business Rights and Competition; Constitution, Federalism and Property Rights."
      }
    ])
    const context = {
      name: "Thumond",
      parent: senate,
      chamber: "upper",
      subcommitteeName: "Antitrust, Business Rights and Competition"
    } satisfies Parameters<typeof resolve>[0]
    expect(resolve(context)).toEqual(senate.members[0])
    expect(createGovInfoAssignmentResolver([])(context)).toBeUndefined()
    expect(resolve({ ...context, subcommitteeName: "Administrative Oversight and the Courts" })).toBeUndefined()
    expect(resolve({ ...context, parent: { ...senate, name: "Other Committee" } })).toBeUndefined()
    expect(
      resolve({
        ...context,
        parent: { ...senate, members: [...senate.members, { chamber: "upper", name: "Another Thurmond", state: "OR" }] }
      })
    ).toBeUndefined()
  })
  it("resolves Nickels only with the source's positive Nickles Investigations assignment", () => {
    const senate: GovInfoCommitteeRecord = {
      chamber: "upper",
      classification: "committee",
      name: "Governmental Affairs",
      members: [{ chamber: "upper", name: "Don Nickles", state: "OK" }]
    }
    const resolve = createGovInfoAssignmentResolver([
      {
        chamber: "upper",
        title: "assignments",
        text: "Nickles (R)                                Governmental Affairs -- International Security, Proliferation and Federal Services; Investigations."
      }
    ])
    const context = {
      name: "Nickels",
      parent: senate,
      chamber: "upper",
      subcommitteeName: "Permanent Subcommittee on Investigations"
    } satisfies Parameters<typeof resolve>[0]
    expect(resolve(context)).toEqual(senate.members[0])
    expect(createGovInfoAssignmentResolver([])(context)).toBeUndefined()
    expect(resolve({ ...context, subcommitteeName: "Other Investigations" })).toBeUndefined()
    expect(
      resolve({
        ...context,
        parent: { ...senate, members: [...senate.members, { chamber: "upper", name: "Another Nickles", state: "OR" }] }
      })
    ).toBeUndefined()
  })
  it("corrects Aschcroft only with a positive same-edition assignment and unique parent member", () => {
    const senate: GovInfoCommitteeRecord = {
      chamber: "upper",
      classification: "committee",
      name: "Commerce, Science and Transportation",
      members: [{ chamber: "upper", name: "John Ashcroft", state: "MO" }]
    }
    const resolve = createGovInfoAssignmentResolver([
      {
        chamber: "upper",
        title: "assignments",
        text: "Ashcroft (R)                               Commerce, Science and Transportation -- Manufacturing and Competitiveness."
      }
    ])
    const context = {
      name: "Aschcroft",
      parent: senate,
      chamber: "upper",
      subcommitteeName: "Manufacturing and Competitiveness"
    } satisfies Parameters<typeof resolve>[0]
    expect(resolve(context)).toEqual(senate.members[0])
    expect(createGovInfoAssignmentResolver([])(context)).toBeUndefined()
    expect(resolve({ ...context, subcommitteeName: "Communications" })).toBeUndefined()
    expect(
      resolve({
        ...context,
        parent: { ...senate, members: [...senate.members, { chamber: "upper", name: "Another Ashcroft", state: "OR" }] }
      })
    ).toBeUndefined()
  })
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
