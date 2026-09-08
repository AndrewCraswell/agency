import { createHash } from "node:crypto"
import { congress105IdentityReview } from "./committee-congressional-directory-1997-identities.js"
import type { GovInfoDirectoryPackage } from "./committee-directory-client.js"
import type { GovInfoPersonCatalog } from "./committee-directory-normalize.js"
import type { GovInfoCommitteeMember, GovInfoCommitteeRecord } from "./committee-directory-parser.js"
import { historicalIdentityReviews } from "./committee-historical-identity-reviews.js"

type ReviewedIdentity = {
  printedName: string
  state: string
  canonicalState?: string
  chamber: "lower" | "upper"
  personId: string
  canonicalName: string
  givenName: string
  familyName: string
  district: string | null
  contexts: readonly { name: string; parentName?: string }[]
  corroboration?: {
    name: string
    count: number
    state?: string
    contexts?: readonly { name: string; parentName?: string }[]
  }
}

export type IdentityReview = {
  historicalAtFirstObservation?: true
  packageId: string
  congress: number
  fingerprint: string
  organizations: number
  entries: number
  identities: readonly ReviewedIdentity[]
}

// Offline-reviewed identities, not a nickname dictionary. Fingerprint covers
// JSON.stringify of the complete parsed roster, not raw PDF bytes. Membership
// evidence remains GovInfo; these IDs already exist in the Congress.gov catalog.
const reviews: readonly IdentityReview[] = [
  congress105IdentityReview,
  ...historicalIdentityReviews,
  {
    packageId: "CDIR-2014-02-18",
    congress: 113,
    fingerprint: "39ae93fceb0701656572030d8d02f279c30b900f6bd6be2568a3de5a24df8d5d",
    organizations: 210,
    entries: 3530,
    identities: [
      {
        // GovInfo STANDING COMMITTEES OF THE HOUSE prints the eight NV cells
        // below. Same-edition member metadata identifies H001066 as Steven
        // Horsford; the printed extra A. does not establish another identity.
        printedName: "Steven A. Horsford",
        state: "NV",
        chamber: "lower",
        personId: "person:congress:h001066",
        canonicalName: "Horsford, Steven",
        givenName: "Steven",
        familyName: "Horsford",
        district: "4",
        contexts: [
          { name: "Homeland Security" },
          {
            name: "Cybersecurity, Infrastructure Protection, and Security Technologies",
            parentName: "Homeland Security"
          },
          { name: "Natural Resources" },
          { name: "Energy and Mineral Resources", parentName: "Natural Resources" },
          { name: "Public Lands and Environmental Regulation", parentName: "Natural Resources" },
          { name: "Oversight and Government Reform" },
          {
            name: "Economic Growth, Job Creation and Regulatory Affairs",
            parentName: "Oversight and Government Reform"
          },
          { name: "Energy Policy, Health Care and Entitlements", parentName: "Oversight and Government Reform" }
        ]
      },
      {
        // The same House granule prints Jerry in this Judiciary child, but
        // Jerrold in five other NY cells including its parent. Same-edition
        // metadata identifies N000002; no external nickname source is used.
        printedName: "Jerry Nadler",
        state: "NY",
        chamber: "lower",
        personId: "person:congress:n000002",
        canonicalName: "Nadler, Jerrold",
        givenName: "Jerrold",
        familyName: "Nadler",
        district: "10",
        contexts: [{ name: "Courts, Intellectual Property, and the Internet", parentName: "Judiciary" }],
        corroboration: { name: "Jerrold Nadler", count: 5 }
      }
    ]
  }
]

/** Production callers cannot supply a review; unknown editions get no overrides. */
export function reviewedGovInfoIdentities(
  records: readonly GovInfoCommitteeRecord[],
  directory: GovInfoDirectoryPackage,
  catalog: GovInfoPersonCatalog
) {
  const review = reviews.find(
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

/** Pure validator for code-reviewed manifests. Never accepts source-provided review data. */
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
        identity.contexts.length !== 1 ||
        identity.contexts[0]?.parentName === undefined ||
        identity.corroboration?.name !== identity.printedName ||
        identity.corroboration.count !== 1 ||
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
