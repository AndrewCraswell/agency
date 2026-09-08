import type { GovInfoDirectoryPackage } from "./committee-directory-client.js"
import type { GovInfoPersonCatalog } from "./committee-directory-normalize.js"
import type { GovInfoCommitteeMember, GovInfoCommitteeRecord } from "./committee-directory-parser.js"
import { validateGovInfoIdentityReview, type IdentityReview } from "./committee-reviewed-identities.js"

// These Directory compilation notes explicitly retain deceased members' earlier
// assignments. Bioguide B000918 and S000718 independently confirm the identities.
// Neither the package date nor the death date is a detected membership boundary.
const brown: IdentityReview["identities"] = [
  {
    printedName: "øGeorge E. Brown, Jr.¿",
    state: "CA",
    chamber: "lower",
    personId: "person:congress:b000918",
    canonicalName: "Brown, George E., Jr.",
    givenName: "GEORGE",
    familyName: "BROWN",
    district: "42",
    contexts: [
      { name: "Agriculture" },
      { name: "Department Operations, Oversight, Nutrition, and Forestry", parentName: "Agriculture" },
      { name: "Risk Management, Research, and Specialty Crops", parentName: "Agriculture" },
      { name: "Science" }
    ]
  }
]
const spence: IdentityReview["identities"] = [
  {
    printedName: "øFloyd D. Spence¿",
    state: "SC",
    chamber: "lower",
    personId: "person:congress:s000718",
    canonicalName: "Spence, Floyd",
    givenName: "FLOYD",
    familyName: "SPENCE",
    district: "2",
    contexts: [
      { name: "Armed Services" },
      { name: "Military Procurement", parentName: "Armed Services" },
      { name: "Special Oversight Panel on Department of Energy Reorganization", parentName: "Armed Services" }
    ]
  },
  {
    printedName: "øFloyd Spence¿",
    state: "SC",
    chamber: "lower",
    personId: "person:congress:s000718",
    canonicalName: "Spence, Floyd",
    givenName: "FLOYD",
    familyName: "SPENCE",
    district: "2",
    contexts: [{ name: "Veterans’ Affairs" }]
  }
]

export const historicalAssignmentReviews: readonly IdentityReview[] = [
  {
    packageId: "CDIR-1999-06-15",
    congress: 106,
    fingerprint: "49e580bbb11ac221f8a67d4cc70a884e91c32b174b281887805da5cc8d969212",
    organizations: 199,
    entries: 3331,
    identities: brown,
    historicalAtFirstObservation: true
  },
  {
    packageId: "CDIR-2000-02-01",
    congress: 106,
    fingerprint: "54031e31df3d662243a23c2697ff9e7c3a736bed4d04bbe3a676306ba8fb11ae",
    organizations: 199,
    entries: 3331,
    identities: brown,
    historicalAtFirstObservation: true
  },
  {
    packageId: "CDIR-2000-10-01",
    congress: 106,
    fingerprint: "54031e31df3d662243a23c2697ff9e7c3a736bed4d04bbe3a676306ba8fb11ae",
    organizations: 199,
    entries: 3331,
    identities: brown,
    historicalAtFirstObservation: true
  },
  {
    packageId: "CDIR-2001-12-07",
    congress: 107,
    fingerprint: "b3ff886282c54528f780074b48ada0c485d8c99914142939f27c43104d3baee4",
    organizations: 205,
    entries: 3732,
    identities: spence,
    historicalAtFirstObservation: true
  },
  {
    packageId: "CDIR-2002-10-01",
    congress: 107,
    fingerprint: "770d7924b9154cab7085120edad5008ed9ad1b4f3a08c84a1b513568718aec6b",
    organizations: 205,
    entries: 3721,
    identities: spence,
    historicalAtFirstObservation: true
  }
]

export function reviewedHistoricalAssignments(
  records: readonly GovInfoCommitteeRecord[],
  directory: GovInfoDirectoryPackage,
  catalog: GovInfoPersonCatalog
) {
  const review = historicalAssignmentReviews.find(
    (entry) => entry.packageId === directory.packageId && entry.congress === directory.congress
  )
  if (!review) {
    return new Map<GovInfoCommitteeMember, string>()
  }
  const matches = validateGovInfoIdentityReview(review, records, directory, catalog)
  if (matches.size !== review.identities.reduce((count, identity) => count + identity.contexts.length, 0)) {
    throw new Error(`GovInfo historical assignment evidence changed for ${directory.packageId}; re-review required`)
  }
  return matches
}
