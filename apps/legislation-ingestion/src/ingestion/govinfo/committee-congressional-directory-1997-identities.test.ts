import { createHash } from "node:crypto"
import { describe, expect, it } from "vitest"
import type { GovInfoPersonCatalog } from "./committee-directory-normalize.js"
import type { GovInfoCommitteeRecord } from "./committee-directory-parser.js"
import { committeeIdentityReviews } from "./committee-review-data.js"
import { validateGovInfoIdentityReview } from "./committee-reviewed-identities.js"

const congress105IdentityReview = committeeIdentityReviews.find((review) => review.packageId === "CDIR-1997-06-04")!

const directory = {
  packageId: "CDIR-1997-06-04",
  congress: 105,
  issuedAt: new Date("1997-06-04"),
  lastModified: new Date("1997-06-04"),
  sourceUrl: new URL("https://www.govinfo.gov/app/details/CDIR-1997-06-04"),
  textUrl: new URL("https://www.govinfo.gov/content/pkg/CDIR-1997-06-04/text/CDIR-1997-06-04.txt")
}

describe("reviewed 1997 source identity contracts", () => {
  for (const identity of congress105IdentityReview.identities) {
    it(`validates ${identity.printedName} without expanding its source scope`, () => {
      // Synthetic contexts exercise the executable manifest contract, not the
      // production source digest. Full-edition acceptance uses the live audit.
      const records: GovInfoCommitteeRecord[] = identity.contexts.map((context) => ({
        ...context,
        classification: context.parentName ? "subcommittee" : "committee",
        chamber: identity.chamber,
        members: [{ name: identity.printedName, state: identity.state, chamber: identity.chamber }]
      }))
      if (identity.corroboration) {
        for (let index = 0; index < identity.corroboration.count; index += 1) {
          records.push({
            name: `Corroborating committee ${index}`,
            classification: "committee",
            chamber: identity.chamber,
            members: [{ name: identity.corroboration.name, state: identity.state, chamber: identity.chamber }]
          })
        }
      }
      const review = {
        ...congress105IdentityReview,
        identities: [identity],
        organizations: records.length,
        entries: records.reduce((count, record) => count + record.members.length, 0),
        fingerprint: digest(records)
      }
      const catalog: GovInfoPersonCatalog = {
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
            chamber: identity.chamber,
            district: identity.district,
            sourceId: `105:${identity.chamber}:1997:1999`,
            isActive: false
          }
        ],
        aliases: []
      }
      expect(validateGovInfoIdentityReview(review, records, directory, catalog).size).toBe(identity.contexts.length)
      expect(validateGovInfoIdentityReview(congress105IdentityReview, records, directory, catalog).size).toBe(0)
      expect(validateGovInfoIdentityReview(review, records, { ...directory, congress: 106 }, catalog).size).toBe(0)
      expect(validateGovInfoIdentityReview(review, records, directory, { ...catalog, terms: [] }).size).toBe(0)
      expect(
        validateGovInfoIdentityReview(review, records, directory, {
          ...catalog,
          people: catalog.people.map((person) => ({ ...person, familyName: "Different" }))
        }).size
      ).toBe(0)
      const changed = records.map((record) => ({
        ...record,
        members: record.members.map((member) =>
          member.name === identity.corroboration?.name ? { ...member, state: "ZZ" } : member
        )
      }))
      expect(
        validateGovInfoIdentityReview({ ...review, fingerprint: digest(changed) }, changed, directory, catalog).size
      ).toBe(identity.corroboration ? 0 : identity.contexts.length)
    })
  }
})

function digest(records: readonly GovInfoCommitteeRecord[]) {
  return createHash("sha256").update(JSON.stringify(records)).digest("hex")
}
