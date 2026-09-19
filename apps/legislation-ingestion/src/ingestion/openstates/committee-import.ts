import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import { replaceEntitySnapshot } from "../../persistence/entities.js"
import { planCommitteeDependencies } from "./committee-dependencies.js"
import { inventoryCommitteeHistory } from "./committee-history.js"
import { normalizeOpenStatesCommittees } from "./entities.js"
import { preparePeopleRepositoryImport } from "./people-import.js"
import { peopleSourceProfiles, type PeopleRepositoryFile } from "./people-repository.js"
import { bindCommitteeInventory, type parseWashingtonCommitteeInventory } from "./washington-committee-inventory.js"

/** Current repository rosters are complete only after every referenced identity is accepted. */
export function prepareCommitteeRepositoryImport(
  currentFiles: readonly PeopleRepositoryFile[],
  historyFiles: readonly PeopleRepositoryFile[],
  retrievedAt: Date,
  state: keyof typeof peopleSourceProfiles,
  revision: string = peopleSourceProfiles[state].revision,
  officialInventory?: ReturnType<typeof parseWashingtonCommitteeInventory>
) {
  if (officialInventory && (state !== "wa" || officialInventory.biennium !== "2025-26"))
    throw new Error("Committee inventory does not match reviewed jurisdiction/session")
  const people = preparePeopleRepositoryImport(currentFiles, historyFiles, retrievedAt, state, revision)
  const inventory = inventoryCommitteeHistory(
    currentFiles.filter((file) => file.path.includes("/committees/")),
    revision,
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
  const completeRosterIds = new Set(plan.eligible.map((committee) => committee.committeeId))
  const detectedAt = retrievedAt.toISOString().slice(0, 10)
  const result = {
    plan,
    snapshot: {
      ...normalized,
      // Embedded names never create or overwrite people. Canonical people must already exist (FK enforced).
      people: [],
      terms: [],
      memberships: normalized.memberships.map((membership) => ({
        ...membership,
        detectedStartDate: detectedAt,
        lastObservedDate: detectedAt
      })),
      organizations: normalized.organizations.map((organization) => ({
        ...organization,
        upstreamIds: { ...organization.upstreamIds, ...observations.get(organization.sourceId)?.officialIdentifiers },
        chamber: observations.get(organization.sourceId)?.chamber ?? null,
        membershipRelationsComplete: completeRosterIds.has(organization.sourceId),
        childRelationsComplete: false,
        detailFactsComplete: false
      }))
    }
  }
  if (officialInventory) {
    result.snapshot.organizations = bindCommitteeInventory(result.snapshot.organizations, officialInventory.entries)
  }
  return result
}

export async function importCommitteeRepository(
  database: LegislationDatabase,
  state: keyof typeof peopleSourceProfiles,
  currentFiles: readonly PeopleRepositoryFile[],
  historyFiles: readonly PeopleRepositoryFile[],
  retrievedAt: Date,
  persist: typeof replaceEntitySnapshot = replaceEntitySnapshot,
  revision: string = peopleSourceProfiles[state].revision,
  officialInventory?: ReturnType<typeof parseWashingtonCommitteeInventory>
) {
  const result = prepareCommitteeRepositoryImport(
    currentFiles,
    historyFiles,
    retrievedAt,
    state,
    revision,
    officialInventory
  )
  if (result.plan.identityEligible.length === 0) {
    return { status: "held" as const, plan: result.plan }
  }
  await persist(database, `jurisdiction:${state}`, result.snapshot, {
    replacePeople: false,
    enforceObservationOrder: true,
    membershipDetectionDate: retrievedAt.toISOString().slice(0, 10),
    organizationSourceProvider: "openstates",
    preserveUnobservedOrganizations: true,
    statementTimeoutMs: 30000,
    checkpoint: {
      source: "openstates",
      stream: `${state}-committee-observations`,
      cursor: {
        revision,
        retrievedAt: retrievedAt.toISOString(),
        ...(officialInventory
          ? { officialInventory: { sha256: officialInventory.sha256, sourceUrl: officialInventory.sourceUrl } }
          : {}),
        complete: result.plan.held.length === 0 && result.plan.identityHeld.length === 0,
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
