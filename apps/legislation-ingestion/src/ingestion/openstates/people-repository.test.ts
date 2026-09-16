import { describe, expect, it } from "vitest"
import {
  northCarolinaPeopleSource,
  peopleSourceProfiles,
  validatePeopleRepositorySnapshot
} from "./people-repository.js"

const person = {
  id: "ocd-person/pilot",
  name: "Pilot Person",
  party: [{ name: "Independent" }],
  roles: [{ type: "lower", district: "1", jurisdiction: northCarolinaPeopleSource.jurisdiction }]
}
const committee = {
  id: "ocd-organization/pilot",
  name: "Pilot Committee",
  classification: "committee",
  chamber: "lower",
  jurisdiction: northCarolinaPeopleSource.jurisdiction,
  members: [{ name: person.name, person_id: person.id, role: "member" }]
}
const files = [
  { path: "data/nc/legislature/pilot.yml", content: JSON.stringify(person) },
  { path: "data/nc/committees/pilot.yml", content: JSON.stringify(committee) }
]
const now = new Date("2026-09-14T00:00:00Z")
it("reuses the validator for Alaska lettered Senate districts without accepting another state's committees", () => {
  const source = peopleSourceProfiles.ak
  const roster = (["lower", "upper"] as const).flatMap((chamber) =>
    source.districts[chamber].map((district) => ({
      path: `data/ak/legislature/${chamber}-${district}.yml`,
      content: JSON.stringify({
        ...person,
        id: `ocd-person/${chamber}-${district}`,
        roles: [{ type: chamber, district, jurisdiction: source.jurisdiction }]
      })
    }))
  )
  const panel = {
    path: "data/ak/committees/test.yml",
    content: JSON.stringify({
      ...committee,
      jurisdiction: source.jurisdiction,
      members: [{ name: person.name, person_id: "ocd-person/lower-1", role: "member" }]
    })
  }
  const result = validatePeopleRepositorySnapshot([...roster, panel], now, "ak")
  expect(result.status).toBe("validated")
  expect(result.counts).toMatchObject({ people: 60, lower: 40, upper: 20 })
  expect(
    validatePeopleRepositorySnapshot([...roster.filter((file) => !file.path.endsWith("upper-A.yml")), panel], now, "ak")
      .coverageIssues
  ).toEqual([{ chamber: "upper", district: "A", count: 0 }])
  expect(() =>
    validatePeopleRepositorySnapshot([...roster, { ...panel, content: JSON.stringify(committee) }], now, "ak")
  ).toThrow("jurisdiction")
  expect(() => validatePeopleRepositorySnapshot([...roster, panel], now, "nc")).toThrow("source path")
})
const completeRoster = [
  ...files,
  ...(["lower", "upper"] as const).flatMap((chamber) =>
    Array.from({ length: chamber === "lower" ? 120 : 50 }, (_, index) => index + 1)
      .filter((district) => chamber !== "lower" || district !== 1)
      .map((district) => ({
        path: `data/nc/legislature/${chamber}-${district}.yml`,
        content: JSON.stringify({
          ...person,
          id: `ocd-person/${chamber}-${district}`,
          roles: [{ type: chamber, district: String(district), jurisdiction: northCarolinaPeopleSource.jurisdiction }]
        })
      }))
  )
]

describe("North Carolina repository pilot", () => {
  it("maps exact IDs into the existing canonical normalizer", () => {
    const result = validatePeopleRepositorySnapshot(completeRoster, now)
    expect(result.status).toBe("validated")
    expect(result.snapshot?.people[0]?.upstreamIds).toMatchObject({ openstates: person.id })
    expect(result.snapshot?.memberships).toHaveLength(1)
    expect(result.counts).toMatchObject({ people: 170, committees: 1, memberships: 1 })
  })
  it("rejects a missing seat even when all committee members resolve", () => {
    const result = validatePeopleRepositorySnapshot(
      completeRoster.filter((file) => !file.path.endsWith("upper-1.yml")),
      now
    )
    expect(result.snapshot).toBeNull()
    expect(result.unresolved).toEqual([])
    expect(result.coverageIssues).toEqual([{ chamber: "upper", district: "1", count: 0 }])
  })
  it("does not mistake duplicate district occupants for full coverage", () => {
    const result = validatePeopleRepositorySnapshot(
      [
        ...completeRoster,
        {
          path: "data/nc/legislature/duplicate-seat.yml",
          content: JSON.stringify({ ...person, id: "ocd-person/another" })
        }
      ],
      now
    )
    expect(result.snapshot).toBeNull()
    expect(result.coverageIssues).toEqual([{ chamber: "lower", district: "1", count: 2 }])
  })
  it("rejects unresolved members instead of matching names or promoting a partial set", () => {
    const result = validatePeopleRepositorySnapshot(
      [
        files[0]!,
        {
          path: files[1]!.path,
          content: JSON.stringify({ ...committee, members: [{ name: person.name, role: "member" }] })
        }
      ],
      now
    )
    expect(result.status).toBe("rejected")
    expect(result.snapshot).toBeNull()
    expect(result.unresolved).toHaveLength(1)
  })
  it("rejects missing lanes, duplicate files, and foreign paths", () => {
    expect(() => validatePeopleRepositorySnapshot([], now)).toThrow("Incomplete")
    expect(() => validatePeopleRepositorySnapshot([...files, files[0]!], now)).toThrow("duplicate")
    expect(() => validatePeopleRepositorySnapshot([{ ...files[0]!, path: "data/ca/legislature/a.yml" }], now)).toThrow(
      "Unexpected"
    )
  })
  it("rejects foreign current roles", () => {
    expect(() =>
      validatePeopleRepositorySnapshot(
        [
          {
            path: files[0]!.path,
            content: JSON.stringify({ ...person, roles: [{ type: "lower", jurisdiction: "foreign" }] })
          },
          files[1]!
        ],
        now
      )
    ).toThrow("Ambiguous current role")
  })
  it("rejects duplicate YAML keys", () => {
    expect(() =>
      validatePeopleRepositorySnapshot([{ path: files[0]!.path, content: "id: one\nid: two" }], now)
    ).toThrow("Invalid YAML")
  })
})
