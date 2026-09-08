import { createHash } from "node:crypto"
import { describe, expect, it, vi } from "vitest"
import type { GovInfoDirectoryPackage } from "./committee-directory-client.js"
import type { GovInfoPersonCatalog } from "./committee-directory-normalize.js"
import { normalizeGovInfoCommitteeDirectory } from "./committee-directory-normalize.js"
import type { GovInfoCommitteeRecord } from "./committee-directory-parser.js"
import { historicalIdentityReviews } from "./committee-historical-identity-reviews.js"
import { reviewedGovInfoIdentities, validateGovInfoIdentityReview } from "./committee-reviewed-identities.js"
import * as reviewedIdentityModule from "./committee-reviewed-identities.js"

function fixture() {
  const records: GovInfoCommitteeRecord[] = [
    {
      name: "Homeland Security",
      classification: "committee",
      chamber: "lower",
      members: [{ name: "Steven A. Horsford", state: "NV", chamber: "lower" }]
    },
    {
      name: "Cybersecurity",
      parentName: "Homeland Security",
      classification: "subcommittee",
      chamber: "lower",
      members: [{ name: "Steven A. Horsford", state: "NV", chamber: "lower" }]
    },
    {
      name: "Judiciary",
      classification: "committee",
      chamber: "lower",
      members: [{ name: "Jerrold Nadler", state: "NY", chamber: "lower" }]
    },
    {
      name: "Courts",
      parentName: "Judiciary",
      classification: "subcommittee",
      chamber: "lower",
      members: [{ name: "Jerry Nadler", state: "NY", chamber: "lower" }]
    }
  ]
  const directory: GovInfoDirectoryPackage = {
    congress: 113,
    packageId: "CDIR-2014-02-18",
    issuedAt: new Date("2014-02-18"),
    lastModified: new Date("2014-02-18"),
    sourceUrl: new URL("https://www.govinfo.gov/app/details/CDIR-2014-02-18"),
    textUrl: new URL("https://www.govinfo.gov/content/pkg/CDIR-2014-02-18/text/CDIR-2014-02-18.txt")
  }
  const catalog: GovInfoPersonCatalog = {
    people: [
      { id: "person:congress:h001066", name: "Horsford, Steven", givenName: "Steven", familyName: "Horsford" },
      { id: "person:congress:n000002", name: "Nadler, Jerrold", givenName: "Jerrold", familyName: "Nadler" }
    ],
    aliases: [],
    terms: [
      {
        personId: "person:congress:h001066",
        chamber: "lower",
        district: "4",
        sourceId: "113:lower:2013:2015",
        isActive: false
      },
      {
        personId: "person:congress:n000002",
        chamber: "lower",
        district: "10",
        sourceId: "113:lower:2013:2015",
        isActive: false
      }
    ]
  }
  const review: Parameters<typeof validateGovInfoIdentityReview>[0] = {
    packageId: directory.packageId,
    congress: 113,
    fingerprint: digest(records),
    organizations: 4,
    entries: 4,
    identities: [
      {
        printedName: "Steven A. Horsford",
        state: "NV",
        chamber: "lower",
        personId: "person:congress:h001066",
        canonicalName: "Horsford, Steven",
        givenName: "Steven",
        familyName: "Horsford",
        district: "4",
        contexts: [{ name: "Homeland Security" }, { name: "Cybersecurity", parentName: "Homeland Security" }]
      },
      {
        printedName: "Jerry Nadler",
        state: "NY",
        chamber: "lower",
        personId: "person:congress:n000002",
        canonicalName: "Nadler, Jerrold",
        givenName: "Jerrold",
        familyName: "Nadler",
        district: "10",
        contexts: [{ name: "Courts", parentName: "Judiciary" }],
        corroboration: { name: "Jerrold Nadler", count: 1 }
      }
    ]
  }
  return { records, directory, catalog, review }
}

function digest(records: readonly GovInfoCommitteeRecord[]) {
  return createHash("sha256").update(JSON.stringify(records)).digest("hex")
}

describe("offline-reviewed GovInfo identity validation", () => {
  it.each(["Mike McIntrye", "David Drier"])("validates the exact reviewed %s cells", (printedName) => {
    const manifest = historicalIdentityReviews.find((review) => review.packageId === "CDIR-1999-06-15")!
    const identity = manifest.identities.find((candidate) => candidate.printedName === printedName)!
    const records: GovInfoCommitteeRecord[] = identity.contexts.map((context) => ({
      ...context,
      chamber: "lower",
      classification: context.parentName === undefined ? "committee" : "subcommittee",
      members: [{ name: printedName, state: identity.state, chamber: "lower" }]
    }))
    if (identity.corroboration) {
      records.push({
        name: "Armed Services",
        chamber: "lower",
        classification: "committee",
        members: [{ name: identity.corroboration.name, state: identity.state, chamber: "lower" }]
      })
    }
    const directory = {
      ...fixture().directory,
      packageId: manifest.packageId,
      congress: 106,
      issuedAt: new Date("1999-06-15")
    }
    const catalog: GovInfoPersonCatalog = {
      aliases: [],
      people: [
        {
          id: identity.personId,
          name: identity.canonicalName,
          givenName: identity.givenName,
          familyName: identity.familyName
        }
      ],
      terms: [
        {
          personId: identity.personId,
          chamber: "lower",
          district: identity.district,
          isActive: false,
          sourceId: "106:lower:1999:2001"
        }
      ]
    }
    const review = {
      ...manifest,
      identities: [identity],
      organizations: records.length,
      entries: records.length,
      fingerprint: digest(records)
    }
    expect([...validateGovInfoIdentityReview(review, records, directory, catalog).values()]).toEqual(
      identity.contexts.map(() => identity.personId)
    )
    expect(validateGovInfoIdentityReview(review, records, directory, { ...catalog, terms: [] }).size).toBe(0)
    records[0]!.members[0]!.state = "NY"
    expect(
      validateGovInfoIdentityReview({ ...review, fingerprint: digest(records) }, records, directory, catalog).size
    ).toBe(0)
  })
  it("accepts only reviewed name-and-state contradictions under the same corroborated parent", () => {
    const manifest = historicalIdentityReviews.find((review) => review.packageId === "CDIR-1999-06-15")!
    const identity = manifest.identities[0]!
    const records: GovInfoCommitteeRecord[] = [
      {
        name: "Agriculture, Nutrition and Forestry",
        chamber: "upper",
        classification: "committee",
        members: [{ name: "Thad Cochran", state: "MS", chamber: "upper" }]
      },
      ...identity.contexts.map((context) => ({
        ...context,
        chamber: "upper" as const,
        classification: "subcommittee" as const,
        members: [{ name: "Kent Cochran", state: "ND", chamber: "upper" as const }]
      }))
    ]
    const directory = {
      ...fixture().directory,
      packageId: manifest.packageId,
      congress: 106,
      issuedAt: new Date("1999-06-15")
    }
    const catalog: GovInfoPersonCatalog = {
      aliases: [],
      people: [
        {
          id: identity.personId,
          name: identity.canonicalName,
          givenName: identity.givenName,
          familyName: identity.familyName
        }
      ],
      terms: [
        {
          personId: identity.personId,
          chamber: "upper",
          district: null,
          isActive: false,
          sourceId: "106:upper:1999:2001"
        }
      ]
    }
    const review = { ...manifest, identities: [identity], organizations: 3, entries: 3, fingerprint: digest(records) }
    const before = JSON.stringify(records)
    expect([...validateGovInfoIdentityReview(review, records, directory, catalog).values()]).toEqual([
      identity.personId,
      identity.personId
    ])
    expect(JSON.stringify(records)).toBe(before)
    for (const contexts of [
      [],
      [{ name: identity.contexts[0]!.name }],
      [identity.contexts[0]!, { name: identity.contexts[1]!.name, parentName: "Other" }]
    ]) {
      expect(
        validateGovInfoIdentityReview(
          { ...review, identities: [{ ...identity, contexts }] },
          records,
          directory,
          catalog
        ).size
      ).toBe(0)
    }
    records[0]!.members[0]!.name = "Kent Conrad"
    expect(
      validateGovInfoIdentityReview({ ...review, fingerprint: digest(records) }, records, directory, catalog).size
    ).toBe(0)
  })
  it("rejects a different unique strict identity and never uses reviews for ambiguous strict matches", () => {
    const f = fixture()
    const spy = vi
      .spyOn(reviewedIdentityModule, "reviewedGovInfoIdentities")
      .mockReturnValue(new Map([[f.records[0]!.members[0]!, "person:congress:h001066"]]))
    try {
      const alias = { name: "Steven A. Horsford", personId: "person:congress:n000002" }
      expect(() =>
        normalizeGovInfoCommitteeDirectory(f.records, f.directory, { ...f.catalog, aliases: [alias] }, new Date())
      ).toThrow("strict identity conflicts")
      const ambiguous = normalizeGovInfoCommitteeDirectory(
        f.records,
        f.directory,
        {
          ...f.catalog,
          aliases: [alias, { ...alias, personId: "person:congress:h001066" }]
        },
        new Date()
      )
      expect(ambiguous.unmatched.filter((member) => member.name === "Steven A. Horsford")).toHaveLength(2)
    } finally {
      spy.mockRestore()
    }
  })

  it("allows only an explicit source-state mismatch with exact unique parent-state corroboration", () => {
    const records: GovInfoCommitteeRecord[] = [
      {
        name: "Environment and Public Works",
        chamber: "upper",
        classification: "committee",
        members: [{ name: "John W. Warner", chamber: "upper", state: "VA" }]
      },
      {
        name: "Superfund and Waste Management",
        parentName: "Environment and Public Works",
        chamber: "upper",
        classification: "subcommittee",
        members: [{ name: "John W. Warner", chamber: "upper", state: "MO" }]
      },
      {
        name: "Other",
        chamber: "upper",
        classification: "committee",
        members: [{ name: "John W. Warner", chamber: "upper", state: "VA" }]
      }
    ]
    const f = fixture()
    const directory = { ...f.directory, congress: 108, packageId: "CDIR-2003-07-11", issuedAt: new Date("2003-07-11") }
    const catalog: GovInfoPersonCatalog = {
      people: [{ id: "person:congress:w000154", name: "Warner, John", givenName: "JOHN", familyName: "WARNER" }],
      aliases: [],
      terms: [
        {
          personId: "person:congress:w000154",
          chamber: "upper",
          district: null,
          isActive: false,
          sourceId: "108:upper:2003:2005"
        }
      ]
    }
    const identity = {
      printedName: "John W. Warner",
      state: "MO",
      canonicalState: "VA",
      chamber: "upper",
      personId: "person:congress:w000154",
      canonicalName: "Warner, John",
      givenName: "JOHN",
      familyName: "WARNER",
      district: null,
      contexts: [{ name: "Superfund and Waste Management", parentName: "Environment and Public Works" }],
      corroboration: {
        name: "John W. Warner",
        state: "VA",
        count: 1,
        contexts: [{ name: "Environment and Public Works" }]
      }
    } satisfies Parameters<typeof validateGovInfoIdentityReview>[0]["identities"][number]
    const review = {
      packageId: directory.packageId,
      congress: 108,
      fingerprint: digest(records),
      organizations: 3,
      entries: 3,
      identities: [identity]
    }
    expect([...validateGovInfoIdentityReview(review, records, directory, catalog).keys()]).toEqual([
      records[1]!.members[0]
    ])
    for (const altered of [
      { ...identity, canonicalState: undefined },
      { ...identity, canonicalState: "MO" },
      { ...identity, canonicalState: "CA" },
      { ...identity, corroboration: undefined },
      { ...identity, corroboration: { ...identity.corroboration, contexts: [{ name: "Other" }] } },
      { ...identity, corroboration: { ...identity.corroboration, state: "MO" } }
    ]) {
      expect(
        validateGovInfoIdentityReview({ ...review, identities: [altered] }, records, directory, catalog).size
      ).toBe(0)
    }
    records[0]!.members[0]!.state = "MO"
    expect(
      validateGovInfoIdentityReview({ ...review, fingerprint: digest(records) }, records, directory, catalog).size
    ).toBe(0)
  })
  it("returns only exact reviewed cells without rewriting source or canonical data", () => {
    const f = fixture()
    const before = JSON.stringify(f)
    const matches = validateGovInfoIdentityReview(f.review, f.records, f.directory, f.catalog)
    expect([...matches.values()]).toEqual([
      "person:congress:h001066",
      "person:congress:h001066",
      "person:congress:n000002"
    ])
    expect(matches.has(f.records[2]!.members[0]!)).toBe(false)
    expect(JSON.stringify(f)).toBe(before)
  })

  it("does not let a caller's miniature fixture activate the production manifest", () => {
    const f = fixture()
    expect(() => reviewedGovInfoIdentities(f.records, f.directory, f.catalog)).toThrow("re-review required")
    expect(() => normalizeGovInfoCommitteeDirectory(f.records, f.directory, f.catalog, new Date())).toThrow(
      "re-review required"
    )
    const unreviewed = { ...f.directory, packageId: "CDIR-2014-02-19" }
    const normalized = normalizeGovInfoCommitteeDirectory(f.records, unreviewed, f.catalog, new Date())
    expect(normalized.unmatched).toHaveLength(3)
    expect(normalized.snapshot.memberships).toHaveLength(1)
    expect(reviewedGovInfoIdentities(f.records, { ...f.directory, packageId: "CDIR-2014-02-19" }, f.catalog).size).toBe(
      0
    )
  })

  it.each(["digest", "package", "congress", "issueDate", "organizationCount", "entryCount"])(
    "rejects incorrect %s",
    (change) => {
      const f = fixture()
      if (change === "digest") {
        f.review.fingerprint = "0".repeat(64)
      }
      if (change === "package") {
        f.directory.packageId = "CDIR-2014-02-19"
      }
      if (change === "congress") {
        f.directory.congress = 114
      }
      if (change === "issueDate") {
        f.directory.issuedAt = new Date("2014-03-01")
      }
      if (change === "organizationCount") {
        f.review.organizations++
      }
      if (change === "entryCount") {
        f.review.entries++
      }
      expect(validateGovInfoIdentityReview(f.review, f.records, f.directory, f.catalog).size).toBe(0)
    }
  )

  it.each(["name", "given", "family", "missing", "wrongTerm", "futureTerm", "expiredTerm", "district", "chamber"])(
    "rejects a changed canonical %s",
    (change) => {
      const f = fixture()
      const people = f.catalog.people.map((person) => ({ ...person }))
      const terms = f.catalog.terms.map((term) => ({ ...term }))
      if (change === "name") {
        people[0]!.name = "Changed, Steven"
      }
      if (change === "given") {
        people[0]!.givenName = "Stephen"
      }
      if (change === "family") {
        people[0]!.familyName = "Other"
      }
      if (change === "missing") {
        people.shift()
      }
      if (change === "wrongTerm") {
        terms[0]!.sourceId = "114:lower:2015:2017"
      }
      if (change === "futureTerm") {
        terms[0]!.sourceId = "113:lower:2015:2017"
      }
      if (change === "expiredTerm") {
        terms[0]!.sourceId = "113:lower:2011:2013"
      }
      if (change === "district") {
        terms[0]!.district = "3"
      }
      if (change === "chamber") {
        terms[0]!.chamber = "upper"
      }
      expect(
        validateGovInfoIdentityReview(f.review, f.records, f.directory, { ...f.catalog, people, terms }).size
      ).toBe(0)
    }
  )

  it.each(["state", "chamber", "parent", "classification", "count", "corroborator", "duplicate"])(
    "rejects inconsistent %s even if a manifest fingerprint were updated",
    (change) => {
      const f = fixture()
      if (change === "state") {
        f.records[1]!.members[0]!.state = "NY"
      }
      if (change === "chamber") {
        f.records[1]!.members[0]!.chamber = "upper"
      }
      if (change === "parent") {
        f.records[1]!.parentName = "Other"
      }
      if (change === "classification") {
        f.records[1]!.classification = "committee"
      }
      if (change === "count") {
        f.records[1]!.members[0]!.name = "Steven Horsford"
      }
      if (change === "corroborator") {
        f.records[2]!.members[0]!.state = "NV"
      }
      if (change === "duplicate") {
        f.records[1]!.name = "Homeland Security"
      }
      f.review.fingerprint = digest(f.records)
      expect(validateGovInfoIdentityReview(f.review, f.records, f.directory, f.catalog).size).toBe(0)
    }
  )

  it("rejects a second eligible canonical identity or conflicting explicit alias", () => {
    const f = fixture()
    const duplicate = { ...f.catalog.people[0]!, id: "person:congress:other" }
    const extraTerm = { ...f.catalog.terms[0]!, personId: duplicate.id }
    expect(
      validateGovInfoIdentityReview(f.review, f.records, f.directory, {
        ...f.catalog,
        people: [...f.catalog.people, duplicate],
        terms: [...f.catalog.terms, extraTerm]
      }).size
    ).toBe(0)
    expect(
      validateGovInfoIdentityReview(f.review, f.records, f.directory, {
        ...f.catalog,
        aliases: [{ name: "Steven A. Horsford", personId: "person:congress:n000002", state: "NV", chamber: "lower" }]
      }).size
    ).toBe(0)
  })

  it.each(["STEVEN A HORSFORD", "HORSFORD, STEVEN A.", "Steven-A-Horsford", "Horsford, Steven"])(
    "rejects normalized competing identity evidence: %s",
    (name) => {
      const f = fixture()
      const competingId = "person:congress:other"
      const terms = [...f.catalog.terms, { ...f.catalog.terms[0]!, personId: competingId }]
      expect(
        validateGovInfoIdentityReview(f.review, f.records, f.directory, {
          ...f.catalog,
          terms,
          people: [...f.catalog.people, { id: competingId, name, givenName: "Different", familyName: "Different" }]
        }).size
      ).toBe(0)
      expect(
        validateGovInfoIdentityReview(f.review, f.records, f.directory, {
          ...f.catalog,
          terms,
          aliases: [{ name, personId: competingId, state: "NV", chamber: "lower" }]
        }).size
      ).toBe(0)
    }
  )

  it("rejects case-normalized duplicate given and family names", () => {
    const f = fixture()
    const competingId = "person:congress:other"
    expect(
      validateGovInfoIdentityReview(f.review, f.records, f.directory, {
        ...f.catalog,
        terms: [...f.catalog.terms, { ...f.catalog.terms[0]!, personId: competingId }],
        people: [
          ...f.catalog.people,
          { id: competingId, name: "Other display name", givenName: "STEVEN A.", familyName: "HORSFORD" }
        ]
      }).size
    ).toBe(0)
  })
})
