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
  it("corrects Lofgen only with the exact unique Zoe Lofgren parent identity and positive assignment clause", () => {
    const judiciary: GovInfoCommitteeRecord = {
      chamber: "lower",
      classification: "committee",
      name: "Judiciary",
      members: [{ chamber: "lower", name: "Zoe Lofgren", state: "CA" }]
    }
    const assignment = `Lofgren (D)                                Judiciary -- Courts and
                                            Intellectual Property;
                                            Immigration and Claims.
                                           Science -- Energy and
                                            Environment; Space and
                                            Aeronautics.`
    const resolveText = (source: string) =>
      createGovInfoAssignmentResolver([{ chamber: "lower", title: "assignments", text: source }])
    const resolve = resolveText(assignment)
    const context = {
      name: "Lofgen",
      parent: judiciary,
      chamber: "lower",
      subcommitteeName: "Immigration and Claims"
    } satisfies Parameters<typeof resolve>[0]
    expect(resolve(context)).toEqual(judiciary.members[0])
    expect(resolveText("")(context)).toBeUndefined()
    expect(resolveText(assignment.replace("Immigration and Claims", "Other Claims"))(context)).toBeUndefined()
    expect(resolveText(assignment.replace("Judiciary --", "Other Committee --"))(context)).toBeUndefined()
    expect(resolve({ ...context, name: "Lofgren" })).toBeUndefined()
    expect(resolve({ ...context, subcommitteeName: "Courts and Intellectual Property" })).toBeUndefined()
    expect(resolve({ ...context, chamber: "upper" })).toBeUndefined()
    expect(resolve({ ...context, parent: { ...judiciary, name: "Other Committee" } })).toBeUndefined()
    for (const members of [
      [{ chamber: "lower", name: "Another Lofgren", state: "CA" }],
      [{ chamber: "lower", name: "Zoe Lofgren", state: "NY" }],
      [...judiciary.members, { chamber: "lower", name: "Another Lofgren", state: "NY" }]
    ] satisfies GovInfoCommitteeRecord["members"][]) {
      expect(resolve({ ...context, parent: { ...judiciary, members } })).toBeUndefined()
    }
  })
  it("requires the printed comma initial and state for the 105th Maloney assignment", () => {
    const roster: GovInfoCommitteeRecord = {
      chamber: "lower",
      classification: "committee",
      name: "Banking and Financial Services",
      members: [
        { chamber: "lower", name: "Carolyn B. Maloney", state: "NY" },
        { chamber: "lower", name: "Jim Maloney", state: "CT" }
      ]
    }
    // Positive clauses from the same directory's assignment table; the Jim
    // Maloney excerpt is not intended to reproduce his complete assignment row.
    const assignments = `Maloney, C. of New York (D)                 Banking and Financial Services -- Financial Institutions and Consumer Credit; Domestic and International Monetary Policy.
Maloney, J. of Connecticut (D)              Banking and Financial Services -- Housing and Community Opportunity.`
    const resolveText = (source: string) =>
      createGovInfoAssignmentResolver([{ chamber: "lower", title: "assignments", text: source }])
    const context = {
      name: "Maloney",
      parent: roster,
      chamber: "lower",
      subcommitteeName: "Domestic and International Monetary Policy"
    } satisfies Parameters<ReturnType<typeof resolveText>>[0]
    expect(resolveText(assignments)(context)).toEqual(roster.members[0])
    expect(resolveText(assignments)({ ...context, subcommitteeName: "Housing and Community Opportunity" })).toEqual(
      roster.members[1]
    )
    for (const identity of [
      "Maloney, J. of New York",
      "Maloney, C. of Connecticut",
      "Maloney, C.",
      "Maloney, C. B. of New York"
    ]) {
      expect(resolveText(assignments.replace("Maloney, C. of New York", identity))(context)).toBeUndefined()
    }
    expect(resolveText("")(context)).toBeUndefined()
    expect(resolveText(assignments)({ ...context, subcommitteeName: "Unknown Subcommittee" })).toBeUndefined()
    expect(
      resolveText(assignments)({
        ...context,
        parent: { ...roster, members: [...roster.members, { chamber: "lower", name: "Chris Maloney", state: "NY" }] }
      })
    ).toBeUndefined()
  })
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
