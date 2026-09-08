import type { GovInfoDirectoryPackage } from "./committee-directory-client.js"
import type { GovInfoPersonCatalog } from "./committee-directory-normalize.js"
import type { GovInfoCommitteeMember, GovInfoCommitteeRecord } from "./committee-directory-parser.js"
import { historicalAssignmentReviews } from "./committee-review-data.js"
import { validateGovInfoIdentityReview } from "./committee-reviewed-identities.js"

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
