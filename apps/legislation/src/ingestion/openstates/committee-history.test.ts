import { describe, expect, it } from "vitest"
import { inventoryCommitteeHistory } from "./committee-history.js"
const revision = "eb1a5ec1e1e3c137eac8bd869efea92e09241440"
const date = "2021-05-06T17:27:22Z"
const committee = {
  id: "ocd-organization/test",
  name: "Agriculture",
  classification: "committee",
  parent: "lower",
  members: [{ name: "Unresolved", role: "member", person_id: null }]
}
const file = (value: unknown) => ({ path: "data/nc/committees/test.yml", content: JSON.stringify(value) })
describe("historical committee observations", () => {
  it("retains only an explicit unambiguous HTTPS homepage without guessing from source links", () => {
    const observe = (links: unknown) =>
      inventoryCommitteeHistory([file({ ...committee, links })], revision, date).observations[0]
    expect(observe([{ note: "homepage", url: "https://legislature.example/committee" }])?.websiteUrl).toBe(
      "https://legislature.example/committee"
    )
    expect(observe([{ note: "source", url: "https://legislature.example/committee" }])?.websiteUrl).toBeNull()
    expect(
      observe([
        { note: "homepage", url: "https://legislature.example/a" },
        { note: "homepage", url: "https://legislature.example/b" }
      ])
    ).toMatchObject({ websiteUrl: null, linkIssues: ["ambiguous_homepage"] })
    expect(observe([{ note: "homepage", url: "javascript:alert(1)" }])).toMatchObject({
      websiteUrl: null,
      linkIssues: ["invalid_public_link"]
    })
    expect(observe([{ note: "homepage", url: "https://user:password@legislature.example" }])).toMatchObject({
      websiteUrl: null,
      linkIssues: ["credentialed_public_link"]
    })
    expect(observe("broken metadata")).toMatchObject({ websiteUrl: null, linkIssues: ["invalid_links"] })
  })
  it("validates Alaska without accepting NC paths or jurisdictions", () => {
    const ak = {
      path: "data/ak/committees/test.yml",
      content: JSON.stringify({ ...committee, jurisdiction: "ocd-jurisdiction/country:us/state:ak/government" })
    }
    expect(inventoryCommitteeHistory([ak], revision, date, "ak").committees).toBe(1)
    expect(() => inventoryCommitteeHistory([ak], revision, date, "nc")).toThrow("source path")
    expect(() => inventoryCommitteeHistory([file(committee)], revision, date, "ak")).toThrow("source path")
    expect(() =>
      inventoryCommitteeHistory(
        [{ ...ak, content: JSON.stringify({ ...committee, jurisdiction: "other" }) }],
        revision,
        date,
        "ak"
      )
    ).toThrow("jurisdiction")
  })
  it("preserves multiple explicit roles for the same member", () => {
    const member = { name: "Name", person_id: "ocd-person/test" }
    const result = inventoryCommitteeHistory(
      [
        file({
          ...committee,
          members: [
            { ...member, role: "co-chair" },
            { ...member, role: "ex officio" }
          ]
        })
      ],
      revision,
      date
    )
    expect(result.memberships).toBe(2)
    expect(result.unresolved).toEqual([])
  })
  it("preserves old parent chamber and null identities without guessing dates or departures", () => {
    const result = inventoryCommitteeHistory([file(committee)], revision, date)
    expect(result.observations[0]?.chamber).toBe("lower")
    expect(result.unresolved).toHaveLength(1)
    expect(result.observations[0]?.repositoryObservedAt).toBe(date)
    expect(result.departuresEstablished).toBe(false)
    expect(result.canonicalWrites).toBe(false)
  })
  it("rejects conflicting chambers", () => {
    expect(() => inventoryCommitteeHistory([file({ ...committee, chamber: "upper" })], revision, date)).toThrow(
      "Conflicting"
    )
  })
  it("does not infer a chamber from a parent organization identifier", () => {
    const result = inventoryCommitteeHistory(
      [file({ ...committee, parent: "ocd-organization/parent" })],
      revision,
      date
    )
    expect(result.observations[0]?.chamber).toBeNull()
    expect(result.observations[0]?.parentSourceId).toBe("ocd-organization/parent")
  })
  it("rejects repeated members and foreign jurisdictions", () => {
    const member = { name: "Name", role: "member", person_id: "ocd-person/test" }
    expect(() =>
      inventoryCommitteeHistory([file({ ...committee, members: [member, member] })], revision, date)
    ).toThrow("Duplicate member")
    expect(() => inventoryCommitteeHistory([file({ ...committee, jurisdiction: "other" })], revision, date)).toThrow(
      "jurisdiction"
    )
  })
})
