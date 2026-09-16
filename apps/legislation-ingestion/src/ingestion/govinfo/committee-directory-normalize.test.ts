import { describe, expect, it, vi } from "vitest"
import type { GovInfoDirectoryPackage } from "./committee-directory-client.js"
import { normalizeGovInfoCommitteeDirectory } from "./committee-directory-normalize.js"
import type { GovInfoCommitteeRecord } from "./committee-directory-parser.js"

// These are synthetic unit rosters for strict normalization, not complete
// publication snapshots. Reviewed-manifest integration is tested separately.
vi.mock("./committee-reviewed-identities.js", () => ({
  reviewedGovInfoIdentities: () => new Map(),
  reviewedGovInfoAnnotations: () => new Map()
}))

const directoryPackage: GovInfoDirectoryPackage = {
  congress: 119,
  issuedAt: new Date("2026-02-20T00:00:00Z"),
  lastModified: new Date("2026-02-21T00:00:00Z"),
  packageId: "CDIR-2026-02-20",
  textUrl: new URL("https://www.govinfo.gov/content/pkg/CDIR-2026-02-20/text/CDIR-2026-02-20.txt"),
  sourceUrl: new URL("https://www.govinfo.gov/content/pkg/CDIR-2026-02-20/text/CDIR-2026-02-20.txt")
}

describe("normalizeGovInfoCommitteeDirectory", () => {
  it("preserves an explicit leave note without changing the role or inventing effective dates", () => {
    const input = [records()[0]!]
    input[0]!.members[0]!.role = "member"
    input[0]!.members[0]!.note = "Assigned to Commerce and placed on sabbatical leave for the 106th Congress."
    const result = normalizeGovInfoCommitteeDirectory(input, directoryPackage, catalog(), new Date())
    expect(result.snapshot.memberships[0]).toMatchObject({
      label: input[0]!.members[0]!.note,
      role: "member",
      title: "member",
      isActive: true
    })
    expect(result.snapshot.memberships[0]).not.toHaveProperty("effectiveStartDate")
    expect(result.snapshot.memberships[0]).not.toHaveProperty("effectiveEndDate")
  })

  it.each([
    ["J. GRESHAM BARRETT", "Gresham Barrett"],
    ["K. Michael Conaway", "Michael Conaway"],
    ["J. Gresham de la Barrett", "Gresham de la Barrett"]
  ])("omits only a scoped explicit dotted leading initial: %s", (name, printed) => {
    const source = catalog()
    const input = [records()[0]!]
    input[0]!.members[0]!.name = printed
    const aliases = [{ name, personId: source.people[0]!.id, state: "WA", chamber: "upper" as const }]
    expect(
      normalizeGovInfoCommitteeDirectory(input, directoryPackage, { ...source, aliases }, new Date()).unmatched
    ).toEqual([])
    aliases[0]!.state = "SC"
    expect(
      normalizeGovInfoCommitteeDirectory(input, directoryPackage, { ...source, aliases }, new Date()).unmatched
    ).toHaveLength(1)
    aliases[0]!.state = "WA"
    input[0]!.members[0]!.chamber = "lower"
    expect(
      normalizeGovInfoCommitteeDirectory(input, directoryPackage, { ...source, aliases }, new Date()).unmatched
    ).toHaveLength(1)
    input[0]!.members[0]!.chamber = "upper"
    expect(
      normalizeGovInfoCommitteeDirectory(
        input,
        directoryPackage,
        { ...source, aliases: [{ name, personId: source.people[0]!.id }] },
        new Date()
      ).unmatched
    ).toHaveLength(1)
    source.people[0]!.name = name
    expect(
      normalizeGovInfoCommitteeDirectory(input, directoryPackage, { ...source, aliases: [] }, new Date()).unmatched
    ).toHaveLength(1)
    source.people.push({ ...source.people[0]!, id: "person:congress:s000002" })
    source.terms.push({ ...source.terms[0]!, personId: "person:congress:s000002" })
    aliases.push({ ...aliases[0]!, personId: "person:congress:s000002" })
    expect(
      normalizeGovInfoCommitteeDirectory(input, directoryPackage, { ...source, aliases }, new Date()).unmatched
    ).toHaveLength(1)
  })

  it.each([
    ["K Michael Conaway", "Michael Conaway"],
    ["Kenneth Michael Conaway", "Michael Conaway"],
    ["Conaway, K. Michael", "Michael Conaway"],
    ["K. Conaway", "Conaway"],
    ["K. Conaway Jr", "Conaway"],
    ["K. M. Conaway", "M. Conaway"],
    ["K. Michael Conaway", "Mike Conaway"],
    ["J. Gresham de la Barrett", "Gresham Barrett"]
  ])("does not infer a leading-initial variant from %s to %s", (name, printed) => {
    const source = catalog()
    const input = [records()[0]!]
    input[0]!.members[0]!.name = printed
    const aliases = [{ name, personId: source.people[0]!.id, state: "WA", chamber: "upper" as const }]
    expect(
      normalizeGovInfoCommitteeDirectory(input, directoryPackage, { ...source, aliases }, new Date()).unmatched
    ).toHaveLength(1)
  })

  it.each(["CDIR-2003-07-11", "CDIR-2003-11-01", "CDIR-2004-01-01", "CDIR-2004-08-01"])(
    "limits the 108th Eni correction to reviewed and nonconflicting evidence: %s",
    (packageId) => {
      const source = catalog()
      source.people[0]!.name = "Eni F.H. Faleomavaega"
      source.terms[0]!.chamber = "lower"
      source.terms[0]!.sourceId = "108:lower:2003:2005"
      const input = [records()[0]!]
      input[0]!.chamber = "lower"
      input[0]!.members = [
        { name: "Eni Faleomaveaga", state: "AS", chamber: "lower", role: "chair" },
        { name: "Eni F.H. Faleomavaega", state: "AS", chamber: "lower" }
      ]
      const edition = { ...directoryPackage, congress: 108, packageId, issuedAt: new Date("2003-07-11T00:00:00Z") }
      const result = normalizeGovInfoCommitteeDirectory(input, edition, source, new Date())
      expect(result.unmatched).toEqual([])
      expect(result.snapshot.memberships).toHaveLength(2)
      expect(result.snapshot.memberships[0]?.role).toBe("chair")
      expect(
        normalizeGovInfoCommitteeDirectory(input, { ...edition, congress: 109 }, source, new Date()).unmatched
      ).toHaveLength(2)
      expect(
        normalizeGovInfoCommitteeDirectory(input, { ...edition, packageId: "CDIR-2004-08-02" }, source, new Date())
          .unmatched
      ).toHaveLength(1)
      input[0]!.members.push({ name: "Eni F.H. Faleomavaega", state: "CA", chamber: "lower" })
      expect(normalizeGovInfoCommitteeDirectory(input, edition, source, new Date()).unmatched).toHaveLength(1)
      input[0]!.members.pop()
      input[0]!.members.push({ name: "Eni F.H. Faleomavaega", state: "AS", chamber: "upper" })
      expect(normalizeGovInfoCommitteeDirectory(input, edition, source, new Date()).unmatched).toHaveLength(2)
      input[0]!.members.pop()
      input[0]!.members[0]!.state = "CA"
      expect(normalizeGovInfoCommitteeDirectory(input, edition, source, new Date()).unmatched).toHaveLength(1)
      input[0]!.members[0]!.state = "AS"
      input[0]!.members[0]!.chamber = "upper"
      expect(normalizeGovInfoCommitteeDirectory(input, edition, source, new Date()).unmatched).toHaveLength(1)
      input[0]!.members[0]!.chamber = "lower"
      input[0]!.members[0]!.name = "Eni Faleomaveaga Extra"
      expect(normalizeGovInfoCommitteeDirectory(input, edition, source, new Date()).unmatched).toHaveLength(1)
      input[0]!.members[0]!.name = "Eni Faleomaveaga"
      input[0]!.members.pop()
      expect(normalizeGovInfoCommitteeDirectory(input, edition, source, new Date()).unmatched).toHaveLength(1)
      source.people[0]!.name = "William J. Jefferson"
      input[0]!.members = [
        { name: "Willliam Jefferson", state: "LA", chamber: "lower" },
        { name: "William J. Jefferson", state: "LA", chamber: "lower" }
      ]
      expect(normalizeGovInfoCommitteeDirectory(input, edition, source, new Date()).unmatched).toHaveLength(1)
    }
  )

  it.each([
    ["Eni Faleomaveaga", "Eni F.H. Faleomavaega", "AS"],
    ["Willliam Jefferson", "William J. Jefferson", "LA"]
  ])("bounds the reviewed 109th printed correction %s to corroborated source identity", (printed, correct, state) => {
    for (const packageId of ["CDIR-2005-07-11", "CDIR-2006-09-01"]) {
      const source = catalog()
      source.people[0]!.name = correct
      source.people[0]!.givenName = correct
      source.people[0]!.familyName = ""
      source.terms[0]!.chamber = "lower"
      source.terms[0]!.sourceId = "109:lower:2005:2007"
      const input = [records()[0]!]
      input[0]!.chamber = "lower"
      input[0]!.members = [
        { name: printed, state, chamber: "lower", role: "chair" },
        { name: correct, state, chamber: "lower" }
      ]
      const edition = { ...directoryPackage, congress: 109, packageId, issuedAt: new Date("2005-07-11T00:00:00Z") }
      const normalized = normalizeGovInfoCommitteeDirectory(input, edition, source, new Date())
      expect(normalized.unmatched).toEqual([])
      expect(normalized.snapshot.memberships).toHaveLength(2)
      expect(normalized.snapshot.memberships[0]?.role).toBe("chair")
      expect(normalized.snapshot.memberships[0]?.personId).toBe(source.people[0]!.id)
      expect(
        normalizeGovInfoCommitteeDirectory(input, { ...edition, packageId: "CDIR-2006-09-02" }, source, new Date())
          .unmatched
      ).toHaveLength(1)
      expect(
        normalizeGovInfoCommitteeDirectory(input, { ...edition, congress: 110 }, source, new Date()).unmatched
      ).toHaveLength(2)
      input[0]!.members[0]!.name = `${printed} Extra`
      expect(normalizeGovInfoCommitteeDirectory(input, edition, source, new Date()).unmatched).toHaveLength(1)
      input[0]!.members[0]!.name = printed
      input[0]!.members[0]!.state = "CA"
      expect(normalizeGovInfoCommitteeDirectory(input, edition, source, new Date()).unmatched).toHaveLength(1)
      input[0]!.members[0]!.state = state
      input[0]!.members[0]!.chamber = "upper"
      expect(normalizeGovInfoCommitteeDirectory(input, edition, source, new Date()).unmatched).toHaveLength(1)
      input[0]!.members[0]!.chamber = "lower"
      input[0]!.members[1]!.state = "CA"
      expect(normalizeGovInfoCommitteeDirectory(input, edition, source, new Date()).unmatched).toHaveLength(1)
      input[0]!.members[1]!.state = state
      input[0]!.members[1]!.chamber = "upper"
      expect(normalizeGovInfoCommitteeDirectory(input, edition, source, new Date()).unmatched).toHaveLength(2)
      input[0]!.members[1]!.chamber = "lower"
      input[0]!.members.push({ name: correct, state: "CA", chamber: "lower" })
      expect(normalizeGovInfoCommitteeDirectory(input, edition, source, new Date()).unmatched).toHaveLength(1)
      input[0]!.members.pop()
      input[0]!.members.push({ name: correct, state, chamber: "upper" })
      expect(normalizeGovInfoCommitteeDirectory(input, edition, source, new Date()).unmatched).toHaveLength(2)
      input[0]!.members.pop()
      input[0]!.members.push({ name: correct, state, chamber: "lower" })
      expect(normalizeGovInfoCommitteeDirectory(input, edition, source, new Date()).unmatched).toEqual([])
      input[0]!.members.pop()
      source.people.push({ ...source.people[0]!, id: "person:congress:s000002" })
      source.terms.push({ ...source.terms[0]!, personId: "person:congress:s000002" })
      expect(normalizeGovInfoCommitteeDirectory(input, edition, source, new Date()).unmatched).toHaveLength(2)
      source.people.pop()
      source.terms.pop()
      input[0]!.members.pop()
      expect(normalizeGovInfoCommitteeDirectory(input, edition, source, new Date()).unmatched).toHaveLength(1)
    }
  })

  it.each(["2012:2013", "2011:2013", "unknown:2013", ":2013", "2012-or-2011:2013"])(
    "excludes only unambiguously future-starting same-name identities: %s",
    (years) => {
      const source = catalog()
      source.people[0] = {
        id: "person:congress:p000149",
        name: "Payne, Donald M.",
        givenName: "Donald",
        familyName: "Payne"
      }
      source.people.push({ ...source.people[0]!, id: "person:congress:p000604" })
      source.terms[0] = {
        ...source.terms[0]!,
        chamber: "lower",
        personId: "person:congress:p000149",
        sourceId: "112:lower:2011:2012"
      }
      source.terms.push({ ...source.terms[0]!, personId: "person:congress:p000604", sourceId: `112:lower:${years}` })
      const input = [records()[0]!]
      input[0]!.chamber = "lower"
      input[0]!.members = [{ chamber: "lower", name: "Donald M. Payne", state: "NJ" }]
      const edition = {
        ...directoryPackage,
        congress: 112,
        packageId: "CDIR-2011-12-01",
        issuedAt: new Date("2011-12-01T00:00:00Z")
      }
      const result = normalizeGovInfoCommitteeDirectory(input, edition, source, new Date())
      const expectedPeople = years === "2012:2013" ? ["person:congress:p000149"] : []
      expect(result.unmatched).toHaveLength(1 - expectedPeople.length)
      expect(result.snapshot.memberships.map((member) => member.personId)).toEqual(expectedPeople)
    }
  )

  it("permits omitted middle initials only from unique same-state/chamber source names", () => {
    const source = catalog()
    const input = [records()[0]!]
    input[0]!.members[0]!.name = "Timothy Walberg"
    const scoped = {
      ...source,
      aliases: [
        { name: 'TIMOTHY "TIM" L. WALBERG', personId: source.people[0]!.id, state: "WA", chamber: "upper" as const }
      ]
    }
    expect(normalizeGovInfoCommitteeDirectory(input, directoryPackage, scoped, new Date()).unmatched).toEqual([])
    input[0]!.members[0]!.name = "Timothy Q. Walberg"
    expect(normalizeGovInfoCommitteeDirectory(input, directoryPackage, scoped, new Date()).unmatched).toHaveLength(1)
    input[0]!.members[0]!.name = "Tim Walberg"
    expect(normalizeGovInfoCommitteeDirectory(input, directoryPackage, scoped, new Date()).unmatched).toEqual([])
  })

  it.each(["JOHN J.H. (JOE) SCHWARZ", 'John J.H. "Joe" Schwarz', "John J.H. “Joe” Schwarz"])(
    "uses only an explicit first-name-order source nickname: %s",
    (name) => {
      const source = catalog()
      const input = [records()[0]!]
      input[0]!.members[0]!.name = "Joe Schwarz"
      const scoped = {
        ...source,
        aliases: [{ name, personId: source.people[0]!.id, state: "WA", chamber: "upper" as const }]
      }
      expect(normalizeGovInfoCommitteeDirectory(input, directoryPackage, scoped, new Date()).unmatched).toEqual([])
      scoped.aliases[0]!.state = "MI"
      expect(normalizeGovInfoCommitteeDirectory(input, directoryPackage, scoped, new Date()).unmatched).toHaveLength(1)
      scoped.aliases[0]!.state = "WA"
      input[0]!.members[0]!.chamber = "lower"
      expect(normalizeGovInfoCommitteeDirectory(input, directoryPackage, scoped, new Date()).unmatched).toHaveLength(1)
    }
  )

  it.each([
    "John J.H. Schwarz",
    'Schwarz, John J.H. "Joe"',
    "John (Joe) Schwarz; Republican",
    "John (Joe) Schwarz of Michigan"
  ])("does not infer an absent or unstructured source nickname: %s", (name) => {
    const source = catalog()
    const input = [records()[0]!]
    input[0]!.members[0]!.name = "Joe Schwarz"
    const aliases = [{ name, personId: source.people[0]!.id, state: "WA", chamber: "upper" as const }]
    expect(
      normalizeGovInfoCommitteeDirectory(input, directoryPackage, { ...source, aliases }, new Date()).unmatched
    ).toHaveLength(1)
  })

  it("retains the whole surname and does not expand unscoped canonical nicknames", () => {
    const source = catalog()
    const input = [records()[0]!]
    input[0]!.members[0]!.name = "Joe de la Cruz, Jr."
    const name = "John J.H. (Joe) de la Cruz, Jr."
    const aliases = [{ name, personId: source.people[0]!.id, state: "WA", chamber: "upper" as const }]
    expect(
      normalizeGovInfoCommitteeDirectory(input, directoryPackage, { ...source, aliases }, new Date()).unmatched
    ).toEqual([])
    input[0]!.members[0]!.name = "Joe Cruz"
    expect(
      normalizeGovInfoCommitteeDirectory(input, directoryPackage, { ...source, aliases }, new Date()).unmatched
    ).toHaveLength(1)
    input[0]!.members[0]!.name = "Joe de la Cruz, Jr."
    expect(
      normalizeGovInfoCommitteeDirectory(
        input,
        directoryPackage,
        { ...source, aliases: [{ name, personId: source.people[0]!.id }] },
        new Date()
      ).unmatched
    ).toHaveLength(1)
  })

  it("rejects explicitly identical nicknames belonging to two scoped source identities", () => {
    const source = catalog()
    source.people.push({ ...source.people[0]!, id: "person:congress:s000002" })
    source.terms.push({ ...source.terms[0]!, personId: "person:congress:s000002" })
    const input = [records()[0]!]
    input[0]!.members[0]!.name = "Joe Schwarz"
    const aliases = source.people.map((person) => ({
      name: "John (Joe) Schwarz",
      personId: person.id,
      state: "WA",
      chamber: "upper" as const
    }))
    expect(
      normalizeGovInfoCommitteeDirectory(input, directoryPackage, { ...source, aliases }, new Date()).unmatched
    ).toHaveLength(1)
  })

  it("rejects ambiguous omitted-middle names in the same source state and chamber", () => {
    const source = catalog()
    source.people.push({ ...source.people[0]!, id: "person:congress:s000002" })
    source.terms.push({ ...source.terms[0]!, personId: "person:congress:s000002" })
    const input = [records()[0]!]
    input[0]!.members[0]!.name = "Timothy Walberg"
    const scoped = {
      ...source,
      aliases: [
        { name: "Timothy L. Walberg", personId: source.people[0]!.id, state: "WA", chamber: "upper" as const },
        { name: "Timothy Q. Walberg", personId: source.people[1]!.id, state: "WA", chamber: "upper" as const }
      ]
    }
    expect(normalizeGovInfoCommitteeDirectory(input, directoryPackage, scoped, new Date()).unmatched).toHaveLength(1)
  })

  it("corrects the reviewed Louis typo only with same-edition Luis corroboration", () => {
    const source = catalog()
    source.people[0] = {
      id: source.people[0]!.id,
      name: "Luis G. Fortuño",
      givenName: "Luis G.",
      familyName: "Fortuño"
    }
    source.terms[0] = { ...source.terms[0]!, chamber: "lower", sourceId: "110:lower:2007:2009" }
    const input: GovInfoCommitteeRecord[] = [
      {
        name: "Foreign Affairs",
        classification: "committee",
        chamber: "lower",
        members: [
          { name: "Louis G. Fortun˜ o", chamber: "lower", state: "PR" },
          { name: "Luis G. Fortun˜ o", chamber: "lower", state: "PR" }
        ]
      }
    ]
    const edition = { ...directoryPackage, congress: 110, packageId: "CDIR-2007-08-09" }
    expect(normalizeGovInfoCommitteeDirectory(input, edition, source, new Date()).unmatched).toEqual([])
    expect(
      normalizeGovInfoCommitteeDirectory(input, { ...edition, packageId: "CDIR-2006-09-01" }, source, new Date())
        .unmatched
    ).toHaveLength(1)
    input[0]!.members.pop()
    expect(normalizeGovInfoCommitteeDirectory(input, edition, source, new Date()).unmatched).toHaveLength(1)
  })

  it("joins a detached PDF tilde to its word without changing the person's name", () => {
    const source = catalog()
    source.people[0] = {
      id: source.people[0]!.id,
      name: "Luis G. Fortuño",
      givenName: "Luis G.",
      familyName: "Fortuño"
    }
    const input = [records()[0]!]
    input[0]!.members[0]!.name = "Luis G. Fortun˜ o"
    expect(normalizeGovInfoCommitteeDirectory(input, directoryPackage, source, new Date()).unmatched).toEqual([])
  })

  it("disambiguates identical names only with exact same-directory state and chamber aliases", () => {
    const source = catalog()
    source.people.push({ ...source.people[0]!, id: "person:congress:s000002" })
    source.terms.push({ ...source.terms[0]!, personId: "person:congress:s000002" })
    const scopedCatalog = {
      ...source,
      aliases: [
        { name: "Jane Q. Senator", personId: "person:congress:s000001", state: "WA", chamber: "upper" as const },
        { name: "Jane Q. Senator", personId: "person:congress:s000002", state: "OR", chamber: "upper" as const }
      ]
    }
    const input = [records()[0]!]
    const result = normalizeGovInfoCommitteeDirectory(input, directoryPackage, scopedCatalog, new Date())
    expect(result.unmatched).toEqual([])
    expect(result.snapshot.memberships[0]?.personId).toBe("person:congress:s000001")
    input[0]!.members[0]!.state = "CA"
    expect(
      normalizeGovInfoCommitteeDirectory(input, directoryPackage, scopedCatalog, new Date()).unmatched
    ).toHaveLength(1)
  })

  it("does not apply a source-scoped alias to another state or chamber", () => {
    const source = catalog()
    const input = [records()[0]!]
    input[0]!.members[0]!.name = "Janey Senator"
    const wrongState = {
      ...source,
      aliases: [{ name: "Janey Senator", personId: "person:congress:s000001", state: "OR", chamber: "upper" as const }]
    }
    const wrongChamber = {
      ...source,
      aliases: [{ name: "Janey Senator", personId: "person:congress:s000001", state: "WA", chamber: "lower" as const }]
    }
    expect(normalizeGovInfoCommitteeDirectory(input, directoryPackage, wrongState, new Date()).unmatched).toHaveLength(
      1
    )
    expect(
      normalizeGovInfoCommitteeDirectory(input, directoryPackage, wrongChamber, new Date()).unmatched
    ).toHaveLength(1)
  })

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

  it("requires the requested Congress even when an unrelated term is active", () => {
    const source = catalog()
    source.terms[0]!.sourceId = "118:upper:2023:2025"
    expect(normalizeGovInfoCommitteeDirectory(records(), directoryPackage, source, new Date()).unmatched).toHaveLength(
      2
    )
  })

  it("matches a unique full name without treating an absent district as a different person", () => {
    const source = catalog()
    const input = records()
    input[0]!.members[0]!.district = "0"
    expect(normalizeGovInfoCommitteeDirectory(input, directoryPackage, source, new Date()).unmatched).toEqual([])
  })

  it("fails closed on two same-name people in the same Congress and chamber", () => {
    const source = catalog()
    source.people.push({ ...source.people[0]!, id: "person:congress:s000002" })
    source.terms.push({ ...source.terms[0]!, personId: "person:congress:s000002" })
    expect(normalizeGovInfoCommitteeDirectory(records(), directoryPackage, source, new Date()).unmatched[0]?.name).toBe(
      "Jane Q. Senator"
    )
  })

  it("matches detached PDF acute accents without splitting a surname", () => {
    const source = catalog()
    source.people[0]!.name = "Ben Ray Luján"
    source.people[0]!.givenName = "Ben Ray"
    source.people[0]!.familyName = "Luján"
    const input = records()
    input[0]!.members[0]!.name = "Ben Ray Luja´n"
    expect(normalizeGovInfoCommitteeDirectory(input, directoryPackage, source, new Date()).unmatched).toEqual([])
  })

  it.each(["Jane ‘‘Buddy’’ Q. Senator", "Jane Q. Senator, Jr.,", "Jane (Buddy) Q. Senator"])(
    "normalizes printed nicknames and suffix punctuation: %s",
    (name) => {
      const input = records()
      input[0]!.members[0]!.name = name
      expect(normalizeGovInfoCommitteeDirectory(input, directoryPackage, catalog(), new Date()).unmatched).toEqual([])
    }
  )

  it.each([
    ["Benajmin L. Cardin", "Benjamin L. Cardin", "MD"],
    ["Thom Tills", "Thom Tillis", "NC"]
  ])("requires same-edition corroboration for the 115th printed name %s", (printed, correct, state) => {
    const source = catalog()
    source.people[0]!.name = correct
    source.terms[0]!.sourceId = "115:upper:2017:2019"
    const input = records()
    input[0]!.members[0] = { chamber: "upper", name: printed, state }
    input[1]!.members[0] = { chamber: "upper", name: correct, state }
    for (const packageId of ["CDIR-2018-07-27", "CDIR-2018-10-01"]) {
      const edition = { ...directoryPackage, congress: 115, packageId }
      input[1]!.members = [{ chamber: "upper", name: correct, state }]
      expect(normalizeGovInfoCommitteeDirectory(input, edition, source, new Date()).unmatched).toEqual([])
      expect(
        normalizeGovInfoCommitteeDirectory(input, { ...edition, packageId: "CDIR-2018-10-02" }, source, new Date())
          .unmatched
      ).toHaveLength(1)
      expect(
        normalizeGovInfoCommitteeDirectory(input, { ...edition, congress: 116 }, source, new Date()).unmatched
      ).toHaveLength(2)
      input[1]!.members[0]!.state = "CA"
      expect(normalizeGovInfoCommitteeDirectory(input, edition, source, new Date()).unmatched).toHaveLength(1)
      input[1]!.members[0] = { chamber: "lower", name: correct, state }
      expect(normalizeGovInfoCommitteeDirectory(input, edition, source, new Date()).unmatched).toHaveLength(2)
      input[1]!.members = []
      expect(normalizeGovInfoCommitteeDirectory(input, edition, source, new Date()).unmatched).toHaveLength(1)
    }
  })

  it("removes a corroborated redundant state suffix only in the reviewed 117th edition", () => {
    const source = catalog()
    source.terms[0]!.sourceId = "117:upper:2021:2023"
    const input = records()
    input[0]!.members[0]!.name = "Jane Q. Senator, WA"
    input[1]!.members[0]!.name = "Jane Q. Senator"
    const edition = { ...directoryPackage, congress: 117, packageId: "CDIR-2022-10-26" }
    expect(normalizeGovInfoCommitteeDirectory(input, edition, source, new Date()).unmatched).toEqual([])
    expect(
      normalizeGovInfoCommitteeDirectory(input, { ...edition, packageId: "CDIR-2021-01-01" }, source, new Date())
        .unmatched
    ).toHaveLength(1)
    input[1]!.members[0]!.state = "NY"
    expect(normalizeGovInfoCommitteeDirectory(input, edition, source, new Date()).unmatched).toHaveLength(1)
    input[1]!.members[0]!.state = "WA"
    source.people.push({ ...source.people[0]!, id: "person:congress:s000002" })
    source.terms.push({ ...source.terms[0]!, personId: "person:congress:s000002" })
    expect(normalizeGovInfoCommitteeDirectory(input, edition, source, new Date()).unmatched).toHaveLength(2)
  })

  it.each([
    ["John P. Sarbanes", "Paul P. Sarbanes", "MD", "3"],
    ["Lori Chavez-DeRemer", "Lori Chaves-DeRemer", "OR", "5"]
  ])("requires same-edition district corroboration for %s", (correct, printed, state, district) => {
    const source = catalog()
    source.people[0]!.name = correct
    source.people[0]!.givenName = correct
    source.people[0]!.familyName = ""
    source.terms[0]!.sourceId = "118:lower:2023:2025"
    source.terms[0]!.chamber = "lower"
    const input: GovInfoCommitteeRecord[] = [
      {
        name: "Energy and Commerce",
        chamber: "lower",
        classification: "committee",
        members: [
          { name: correct, chamber: "lower", state, district },
          { name: printed, chamber: "lower", state, district }
        ]
      }
    ]
    const edition = { ...directoryPackage, congress: 118, packageId: "CDIR-2024-04-25" }
    expect(normalizeGovInfoCommitteeDirectory(input, edition, source, new Date()).unmatched).toEqual([])
    input[0]!.members.shift()
    expect(normalizeGovInfoCommitteeDirectory(input, edition, source, new Date()).unmatched).toHaveLength(1)
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
