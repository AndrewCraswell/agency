import { createHash } from "node:crypto"
import type { GovInfoDirectoryPackage } from "./committee-directory-client.js"
import type { GovInfoPersonCatalog } from "./committee-directory-normalize.js"
import type { GovInfoCommitteeMember, GovInfoCommitteeRecord } from "./committee-directory-parser.js"
import { committeeIdentityReviews, type IdentityReview } from "./committee-review-data.js"

/** Production callers cannot supply a review; unknown editions get no overrides. */
export function reviewedGovInfoIdentities(
  records: readonly GovInfoCommitteeRecord[],
  directory: GovInfoDirectoryPackage,
  catalog: GovInfoPersonCatalog
) {
  const review = committeeIdentityReviews.find(
    (entry) => entry.packageId === directory.packageId && entry.congress === directory.congress
  )
  if (!review) {
    return new Map<GovInfoCommitteeMember, string>()
  }
  const result = validateGovInfoIdentityReview(review, records, directory, catalog)
  if (result.size !== review.identities.reduce((count, identity) => count + identity.contexts.length, 0)) {
    throw new Error(`GovInfo reviewed identity evidence changed for ${directory.packageId}; re-review required`)
  }
  return result
}

/** Annotations are available only for cells whose edition-bound identity was validated. */
export function reviewedGovInfoAnnotations(
  directory: GovInfoDirectoryPackage,
  validated: ReadonlyMap<GovInfoCommitteeMember, string>
) {
  const review = committeeIdentityReviews.find(
    (entry) => entry.packageId === directory.packageId && entry.congress === directory.congress
  )
  const annotations = new Map<GovInfoCommitteeMember, { label: string; role: "member" | "ranking-member" }>()
  for (const [member, personId] of validated) {
    const identity = review?.identities.find(
      (entry) => entry.printedName === member.name && entry.state === member.state && entry.personId === personId
    )
    if (identity?.annotation) {
      annotations.set(member, identity.annotation)
    }
  }
  return annotations
}

/** Pure validator for repository-reviewed mapping data. Never accepts source-provided review data. */
export function validateGovInfoIdentityReview(
  review: IdentityReview,
  records: readonly GovInfoCommitteeRecord[],
  directory: GovInfoDirectoryPackage,
  catalog: GovInfoPersonCatalog
): Map<GovInfoCommitteeMember, string> {
  const reject = () => new Map<GovInfoCommitteeMember, string>()
  if (
    review.packageId !== directory.packageId ||
    review.congress !== directory.congress ||
    directory.issuedAt.toISOString().slice(0, 10) !== review.packageId.slice(5) ||
    records.length !== review.organizations ||
    records.reduce((count, record) => count + record.members.length, 0) !== review.entries ||
    createHash("sha256").update(JSON.stringify(records)).digest("hex") !== review.fingerprint
  ) {
    return reject()
  }
  const result = new Map<GovInfoCommitteeMember, string>()
  const year = directory.issuedAt.getUTCFullYear()
  const validTerms = catalog.terms.filter((term) => {
    const period = /^(\d+):(lower|upper):(\d{4}):(\d{4}|current)$/.exec(term.sourceId ?? "")
    return (
      period !== null &&
      Number(period[1]) === review.congress &&
      period[2] === term.chamber &&
      Number(period[3]) <= year &&
      (review.historicalAtFirstObservation === true || period[4] === "current" || Number(period[4]) >= year)
    )
  })
  const allCells = records.flatMap((record) => record.members.map((member) => ({ record, member })))
  for (const identity of review.identities) {
    const isStateCorrection = identity.canonicalState !== undefined
    if (
      isStateCorrection &&
      (identity.canonicalState === identity.state ||
        identity.contexts.length === 0 ||
        identity.contexts.some(
          (context) =>
            context.parentName === undefined || context.parentName !== identity.corroboration?.contexts?.[0]?.name
        ) ||
        identity.corroboration?.count !== 1 ||
        identity.corroboration.state !== identity.canonicalState ||
        identity.corroboration.contexts?.length !== 1 ||
        identity.corroboration.contexts[0]?.name !== identity.contexts[0].parentName ||
        identity.corroboration.contexts[0]?.parentName !== undefined)
    ) {
      return reject()
    }
    const people = catalog.people.filter((person) => person.id === identity.personId)
    const person = people[0]
    if (
      people.length !== 1 ||
      person?.name !== identity.canonicalName ||
      person.givenName !== identity.givenName ||
      person.familyName !== identity.familyName ||
      !validTerms.some(
        (term) =>
          term.personId === identity.personId &&
          term.chamber === identity.chamber &&
          term.district === identity.district
      )
    ) {
      return reject()
    }
    // Duplicate canonical identities or conflicting explicit aliases must not
    // let a reviewed override turn a genuine ambiguity into a match.
    const eligibleIds = new Set(
      validTerms.filter((term) => term.chamber === identity.chamber).map((term) => term.personId)
    )
    const identityNames = new Set([
      ...conflictNames(identity.printedName),
      ...conflictNames(identity.canonicalName),
      ...conflictNames(`${identity.givenName} ${identity.familyName}`)
    ])
    if (
      catalog.people.some(
        (candidate) =>
          candidate.id !== identity.personId &&
          eligibleIds.has(candidate.id) &&
          ((conflictKey(candidate.givenName?.split(/\s+/)[0] ?? "") ===
            conflictKey(identity.givenName.split(/\s+/)[0] ?? "") &&
            conflictKey(candidate.familyName ?? "") === conflictKey(identity.familyName)) ||
            conflictNames(candidate.name).some((name) => identityNames.has(name)))
      ) ||
      catalog.aliases.some(
        (alias) =>
          alias.personId !== identity.personId &&
          eligibleIds.has(alias.personId) &&
          conflictNames(alias.name).some((name) => identityNames.has(name)) &&
          (alias.chamber === undefined || alias.chamber === identity.chamber) &&
          (alias.state === undefined || alias.state === identity.state || alias.state === identity.canonicalState)
      )
    ) {
      return reject()
    }
    // Only an explicit reviewed state correction may distinguish target cells
    // from same-name parent cells by the printed (incorrect) source state.
    const cells = allCells.filter(
      ({ member }) => member.name === identity.printedName && (!isStateCorrection || member.state === identity.state)
    )
    if (
      cells.length !== identity.contexts.length ||
      cells.some(
        ({ record, member }) =>
          member.state !== identity.state || member.chamber !== identity.chamber || record.chamber !== identity.chamber
      )
    ) {
      return reject()
    }
    for (const context of identity.contexts) {
      const matches = cells.filter(
        ({ record }) =>
          record.name === context.name &&
          record.parentName === context.parentName &&
          record.classification === (context.parentName === undefined ? "committee" : "subcommittee")
      )
      const cell = matches[0]
      if (matches.length !== 1 || !cell) {
        return reject()
      }
      if (context.parentName !== undefined) {
        const parents = records.filter(
          (record) =>
            record.chamber === identity.chamber &&
            record.classification === "committee" &&
            record.name === context.parentName
        )
        const parentNames = [identity.printedName, identity.corroboration?.name]
        if (
          parents.length !== 1 ||
          parents[0]?.members.filter(
            (member) =>
              parentNames.includes(member.name) &&
              member.state === (identity.canonicalState ?? identity.state) &&
              member.chamber === identity.chamber
          ).length !== 1
        ) {
          return reject()
        }
      }
      result.set(cell.member, identity.personId)
    }
    if (identity.corroboration) {
      const corroborators = allCells.filter(
        ({ record, member }) =>
          member.name === identity.corroboration?.name &&
          (identity.corroboration.contexts === undefined ||
            identity.corroboration.contexts.some(
              (context) =>
                record.name === context.name &&
                record.parentName === context.parentName &&
                record.classification === (context.parentName === undefined ? "committee" : "subcommittee")
            ))
      )
      if (
        corroborators.length !== identity.corroboration.count ||
        corroborators.some(
          ({ record, member }) =>
            member.state !== (identity.corroboration?.state ?? identity.state) ||
            member.chamber !== identity.chamber ||
            record.chamber !== identity.chamber
        )
      ) {
        return reject()
      }
    }
  }
  return result
}

// Conservative rejection keys only: these never generate an accepted match.
function conflictKey(value: string) {
  return value
    .normalize("NFKD")
    .replaceAll(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]/g, "")
}

function conflictNames(value: string) {
  const parts = value.split(",").map((part) => part.trim())
  return [conflictKey(value), ...(parts.length === 2 ? [conflictKey(`${parts[1]} ${parts[0]}`)] : [])]
}
