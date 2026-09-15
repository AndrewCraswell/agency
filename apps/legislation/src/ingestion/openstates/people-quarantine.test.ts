import { describe, expect, it } from "vitest"
import { preparePeopleRepositoryImport } from "./people-import.js"
import { peopleSourceProfiles } from "./people-repository.js"
import cronk from "./test-data/reviewed-cronk-source.json" with { type: "json" }
import hughes from "./test-data/reviewed-hughes-source.json" with { type: "json" }

const now = new Date("2026-09-14T00:00:00Z")
const role = {
  type: "lower",
  jurisdiction: peopleSourceProfiles.ak.jurisdiction,
  district: "1",
  end_date: "2020-01-01"
}
const person = (id: string, roles: unknown[] = [role]) => ({
  path: `data/ak/retired/${id}.yml`,
  content: JSON.stringify({ id: `ocd-person/${id}`, name: id, roles })
})
const good = person("good")
const prepare = (files: ReturnType<typeof person>[]) => preparePeopleRepositoryImport([], files, now, "ak")

describe("people quarantine boundary", () => {
  it.each([
    ["reversed dates", person("bad", [{ ...role, start_date: "2025-01-01" }])],
    ["invalid calendar", person("bad", [{ ...role, end_date: "2020-02-31" }])],
    ["partial precision", person("bad", [{ ...role, start_date: "2010" }])],
    ["unclosed retired role", person("bad", [{ ...role, end_date: undefined }])],
    ["duplicate term", person("bad", [role, role])],
    [
      "overlap",
      person("bad", [
        { ...role, start_date: "2010-01-01" },
        { ...role, start_date: "2015-01-01" }
      ])
    ],
    ["invalid YAML", { ...person("bad"), content: "id: [" }],
    ["missing identity", { ...person("bad"), content: JSON.stringify({ name: "Bad", roles: [role] }) }]
  ])("isolates %s without discarding valid people", (_label, bad) => {
    const result = prepare([good, bad])
    expect(result.status).toBe("partial")
    expect(result.counts).toEqual({ people: 1, terms: 1 })
    expect(result.quarantine).toHaveLength(1)
    expect(result.quarantine[0]?.sha256).toMatch(/^[a-f0-9]{64}$/)
    expect(result.snapshot?.terms[0]?.startDate).toBeNull()
    expect(result.snapshot?.termPersonIds).toBeUndefined()
    expect(result.snapshot?.memberships).toEqual([])
    expect(prepare([good, bad])).toEqual(result)
    expect(prepare([good, person("bad")]).quarantine).toEqual([])
  })
  it("quarantines every duplicate identity irrespective of order or malformed roles", () => {
    const duplicate = { ...person("bad", [{ ...role, end_date: "bad" }]), path: "data/ak/retired/duplicate.yml" }
    for (const files of [
      [good, person("bad"), duplicate],
      [duplicate, good, person("bad")]
    ]) {
      const result = prepare(files)
      expect(result.counts).toEqual({ people: 1, terms: 1 })
      expect(result.quarantine).toHaveLength(2)
    }
  })
  it("contains the real Alaska defects without any person-specific corrections", () => {
    const result = prepare([
      good,
      { path: "data/ak/retired/arbitrary-name.yml", content: hughes },
      { path: "data/ak/legislature/another-name.yml", content: cronk }
    ])
    expect(result.counts).toEqual({ people: 1, terms: 1 })
    expect(result.quarantine).toHaveLength(2)
    expect(result.quarantine.flatMap((entry) => entry.reasons)).toEqual(
      expect.arrayContaining(["reversed_source_dates", "overlapping_source_roles"])
    )
  })
  it("does not offer an empty or wholly quarantined import", () => {
    expect(prepare([]).snapshot).toBeNull()
    expect(prepare([person("bad", [role, role])]).snapshot).toBeNull()
  })
})
