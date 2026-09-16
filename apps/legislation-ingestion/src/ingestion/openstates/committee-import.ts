import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import { replaceEntitySnapshot } from "../../persistence/entities.js"
import { planCommitteeDependencies } from "./committee-dependencies.js"
import { inventoryCommitteeHistory } from "./committee-history.js"
import { normalizeOpenStatesCommittees } from "./entities.js"
import { preparePeopleRepositoryImport } from "./people-import.js"
import { peopleSourceProfiles, type PeopleRepositoryFile } from "./people-repository.js"

/** Additive observations only. Dependency acceptance does not establish a complete roster or effective dates. */
export function prepareCommitteeRepositoryImport(
  currentFiles: readonly PeopleRepositoryFile[],
  historyFiles: readonly PeopleRepositoryFile[],
  retrievedAt: Date,
  state: keyof typeof peopleSourceProfiles
) {
  const people = preparePeopleRepositoryImport(currentFiles, historyFiles, retrievedAt, state)
  const inventory = inventoryCommitteeHistory(
    currentFiles.filter((file) => file.path.includes("/committees/")),
    peopleSourceProfiles[state].revision,
    retrievedAt.toISOString(),
    state
  )
  const plan = planCommitteeDependencies(
    inventory,
    people.snapshot?.people.flatMap((person) => (person.sourceId ? [person.sourceId] : [])) ?? []
  )
  const normalized = normalizeOpenStatesCommittees(
    plan.identityEligible.map((committee) => ({
      id: committee.committeeId,
      name: committee.name,
      classification: committee.classification,
      website_url: committee.websiteUrl,
      parent_id: committee.parentSourceId,
      sources: [
        { url: `https://raw.githubusercontent.com/openstates/people/${committee.revision}/${committee.sourcePath}` }
      ],
      memberships: (plan.eligible.some((eligible) => eligible.committeeId === committee.committeeId)
        ? committee.members
        : []
      ).map((member) => ({
        person: { id: member.personId, name: member.name },
        role: member.role
      }))
    })),
    { jurisdictionCode: state, retrievedAt }
  )
  const observations = new Map(plan.identityEligible.map((committee) => [committee.committeeId, committee]))
  return {
    plan,
    snapshot: {
      ...normalized,
      // Embedded names never create or overwrite people. Canonical people must already exist (FK enforced).
      people: [],
      terms: [],
      organizations: normalized.organizations.map((organization) => ({
        ...organization,
        upstreamIds: { ...organization.upstreamIds, ...observations.get(organization.sourceId)?.officialIdentifiers },
        chamber: observations.get(organization.sourceId)?.chamber ?? null,
        membershipRelationsComplete: false,
        childRelationsComplete: false,
        detailFactsComplete: false
      }))
    }
  }
}

export async function importCommitteeRepository(
  database: LegislationDatabase,
  state: keyof typeof peopleSourceProfiles,
  currentFiles: readonly PeopleRepositoryFile[],
  historyFiles: readonly PeopleRepositoryFile[],
  retrievedAt: Date,
  persist: typeof replaceEntitySnapshot = replaceEntitySnapshot
) {
  const result = prepareCommitteeRepositoryImport(currentFiles, historyFiles, retrievedAt, state)
  if (result.plan.identityEligible.length === 0) {
    return { status: "held" as const, plan: result.plan }
  }
  await persist(database, `jurisdiction:${state}`, result.snapshot, {
    replacePeople: false,
    organizationObservationOnly: true,
    enforceObservationOrder: true,
    organizationSourceProvider: "openstates",
    statementTimeoutMs: 30000,
    checkpoint: {
      source: "openstates",
      stream: `${state}-committee-observations`,
      cursor: {
        revision: peopleSourceProfiles[state].revision,
        retrievedAt: retrievedAt.toISOString(),
        complete: false,
        eligibleCommittees: result.plan.eligible.length,
        eligibleMemberships: result.plan.eligibleMemberships,
        eligibleIdentities: result.plan.identityEligible.length,
        heldIdentities: result.plan.identityHeld.map(({ committeeId, reasons }) => ({ committeeId, reasons })),
        held: result.plan.held.map(({ committeeId, reasons }) => ({ committeeId, reasons }))
      }
    }
  })
  return { status: "observations_imported" as const, plan: result.plan }
}
