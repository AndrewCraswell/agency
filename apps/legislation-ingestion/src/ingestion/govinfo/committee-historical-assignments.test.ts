import { createHash } from "node:crypto"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { GovInfoDirectoryPackage } from "./committee-directory-client.js"
import { normalizeGovInfoCommitteeDirectory, type GovInfoPersonCatalog } from "./committee-directory-normalize.js"
import type { GovInfoCommitteeRecord } from "./committee-directory-parser.js"
import { reviewedHistoricalAssignments } from "./committee-historical-assignments.js"
import * as historicalModule from "./committee-historical-assignments.js"
import { historicalAssignmentReviews } from "./committee-review-data.js"
import { validateGovInfoIdentityReview } from "./committee-reviewed-identities.js"
import * as identityModule from "./committee-reviewed-identities.js"

afterEach(() => vi.restoreAllMocks())

describe("reviewed historical first observations", () => {
  for (const review of historicalAssignmentReviews) {
    it(`validates exact identities and rejects evidence drift for ${review.packageId}`, () => {
      const records: GovInfoCommitteeRecord[] = review.identities.flatMap((identity) =>
        identity.contexts.map((context) => ({
          ...context,
          chamber: identity.chamber,
          classification: context.parentName === undefined ? "committee" : "subcommittee",
          members: [{ name: identity.printedName, state: identity.state, chamber: identity.chamber }]
        }))
      )
      const directory: GovInfoDirectoryPackage = {
        packageId: review.packageId,
        congress: review.congress,
        issuedAt: new Date(review.packageId.slice(5)),
        lastModified: new Date(review.packageId.slice(5)),
        sourceUrl: new URL(`https://www.govinfo.gov/app/details/${review.packageId}`),
        textUrl: new URL(`https://www.govinfo.gov/content/pkg/${review.packageId}/text/${review.packageId}.txt`)
      }
      const identities = [...new Map(review.identities.map((identity) => [identity.personId, identity])).values()]
      const catalog: GovInfoPersonCatalog = {
        people: identities.map((identity) => ({
          id: identity.personId,
          name: identity.canonicalName,
          givenName: identity.givenName,
          familyName: identity.familyName
        })),
        aliases: [],
        terms: identities.flatMap((identity) =>
          [1999, 1973].map((start) => ({
            personId: identity.personId,
            chamber: identity.chamber,
            district: identity.district,
            isActive: false,
            sourceId: `${review.congress}:lower:${start}:2001`
          }))
        )
      }
      const fixtureReview = {
        ...review,
        organizations: records.length,
        entries: records.length,
        fingerprint: createHash("sha256").update(JSON.stringify(records)).digest("hex")
      }
      const validated = validateGovInfoIdentityReview(fixtureReview, records, directory, catalog)
      expect(validated.size).toBe(4)
      expect(() => reviewedHistoricalAssignments(records, directory, catalog)).toThrow("re-review required")
      expect(validateGovInfoIdentityReview(fixtureReview, records, directory, { ...catalog, people: [] }).size).toBe(0)
      expect(validateGovInfoIdentityReview(fixtureReview, records, directory, { ...catalog, terms: [] }).size).toBe(0)
      expect(validateGovInfoIdentityReview(fixtureReview, records, { ...directory, congress: 119 }, catalog).size).toBe(
        0
      )
      const changed = structuredClone(records)
      changed[0]!.members[0]!.role = "chair"
      expect(validateGovInfoIdentityReview(fixtureReview, changed, directory, catalog).size).toBe(0)
      vi.spyOn(historicalModule, "reviewedHistoricalAssignments").mockReturnValue(validated)
      vi.spyOn(identityModule, "reviewedGovInfoIdentities").mockReturnValue(new Map())
      const normalized = normalizeGovInfoCommitteeDirectory(records, directory, catalog, new Date())
      expect(normalized.unmatched).toEqual([])
      expect(normalized.snapshot.memberships).toHaveLength(4)
      for (const membership of normalized.snapshot.memberships) {
        expect(membership).toMatchObject({
          personId: identities[0]!.personId,
          isActive: false,
          endedReason: "historical_at_first_observation",
          detectedStartDate: null,
          detectedEndDate: null,
          lastObservedDate: null
        })
      }
    })
  }
})
