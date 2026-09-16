import { createHash } from "node:crypto"
import { describe, expect, it } from "vitest"
import type { GovInfoDirectoryPackage } from "./committee-directory-client.js"
import type { GovInfoPersonCatalog } from "./committee-directory-normalize.js"
import type { GovInfoCommitteeRecord } from "./committee-directory-parser.js"
import { committeeIdentityReviews } from "./committee-review-data.js"
import { validateGovInfoIdentityReview } from "./committee-reviewed-identities.js"

describe("historical reviewed identity manifests", () => {
  for (const edition of committeeIdentityReviews.filter((review) => [106, 107, 108, 109].includes(review.congress))) {
    it(`requires the complete source fingerprint for ${edition.packageId}`, () => {
      const directory = directoryFor(edition.packageId, edition.congress)
      expect(validateGovInfoIdentityReview(edition, [], directory, { people: [], terms: [], aliases: [] }).size).toBe(0)
    })

    for (const identity of edition.identities) {
      it(`validates the exact reviewed context contract for ${edition.packageId} ${identity.printedName}`, () => {
        // A synthetic roster exercises the executable per-identity contract;
        // it does not pretend to reproduce or certify the live PDF fingerprint.
        const records: GovInfoCommitteeRecord[] = identity.contexts.map((context) => ({
          ...context,
          classification: context.parentName ? "subcommittee" : "committee",
          chamber: identity.chamber,
          members: [{ name: identity.printedName, state: identity.state, chamber: identity.chamber }]
        }))
        for (const context of identity.contexts) {
          if (
            context.parentName &&
            !records.some((record) => record.name === context.parentName && !record.parentName)
          ) {
            records.push({
              name: context.parentName,
              classification: "committee",
              chamber: identity.chamber,
              members: [
                {
                  name: identity.corroboration?.name ?? identity.printedName,
                  state: identity.canonicalState ?? identity.state,
                  chamber: identity.chamber
                }
              ]
            })
          }
        }
        const directory = directoryFor(edition.packageId, edition.congress)
        const review = {
          ...edition,
          identities: [identity],
          organizations: records.length,
          entries: records.reduce((count, record) => count + record.members.length, 0),
          fingerprint: createHash("sha256").update(JSON.stringify(records)).digest("hex")
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
              sourceId: `${edition.congress}:${identity.chamber}:${directory.issuedAt.getUTCFullYear()}:${directory.issuedAt.getUTCFullYear()}`,
              isActive: false
            }
          ],
          aliases: []
        }
        expect(validateGovInfoIdentityReview(review, records, directory, catalog).size).toBe(identity.contexts.length)
        expect(validateGovInfoIdentityReview(review, records, directory, { ...catalog, terms: [] }).size).toBe(0)
        expect(
          validateGovInfoIdentityReview(review, records, directory, {
            ...catalog,
            people: catalog.people.map((person) => ({ ...person, givenName: "Different" }))
          }).size
        ).toBe(0)
      })
    }
  }
})

function directoryFor(packageId: string, congress: number): GovInfoDirectoryPackage {
  return {
    packageId,
    congress,
    issuedAt: new Date(packageId.slice(5)),
    lastModified: new Date(packageId.slice(5)),
    sourceUrl: new URL(`https://www.govinfo.gov/app/details/${packageId}`),
    textUrl: new URL(`https://www.govinfo.gov/content/pkg/${packageId}/text/${packageId}.txt`)
  }
}
