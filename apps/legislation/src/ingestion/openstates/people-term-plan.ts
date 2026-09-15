import type { legislativeTerms } from "../../db/schema/schema.js"
import { jurisdictionId, legislativeTermId, personId } from "../../legislation/identifiers.js"
import { inventoryPeopleHistory } from "./people-history.js"
import { peopleSourceProfiles, type PeopleRepositoryFile } from "./people-repository.js"

/** Build source-backed terms without writing or treating observation time as service time. */
export function planPeopleLegislativeTerms(
  files: readonly PeopleRepositoryFile[],
  retrievedAt: Date,
  state: keyof typeof peopleSourceProfiles = "nc"
) {
  if (!Number.isFinite(retrievedAt.getTime())) {
    throw new Error("Invalid retrieval date")
  }
  const inventory = inventoryPeopleHistory(files, state)
  if (inventory.issues.length > 0 || inventory.partialDates > 0) {
    throw new Error("Historical terms require review before normalization")
  }
  const ids = new Set<string>()
  const terms: Array<typeof legislativeTerms.$inferInsert> = inventory.sourceRoles.map((role) => {
    const canonicalPersonId = personId("openstates", role.personId)
    // End dates, file order and current/retired file location must not change identity.
    // Indistinguishable unknown-start terms require review, never silent merging.
    const sourceId = JSON.stringify(["people-role", state, role.chamber, role.district, role.start])
    const id = legislativeTermId(canonicalPersonId, sourceId)
    if (ids.has(id)) {
      throw new Error("Ambiguous legislative term identity")
    }
    ids.add(id)
    let isActive: boolean | null = true
    if (role.end !== null) {
      isActive = role.end > retrievedAt.toISOString().slice(0, 10) ? null : false
    }
    return {
      id,
      personId: canonicalPersonId,
      jurisdictionId: jurisdictionId(state),
      sourceId,
      chamber: role.chamber,
      district: role.district,
      startDate: role.start,
      endDate: role.end,
      isActive,
      party: null,
      role: null,
      officeTitle:
        role.chamber === "upper"
          ? peopleSourceProfiles[state].officeTitles.upper
          : peopleSourceProfiles[state].officeTitles.lower,
      sourceProvider: "openstates",
      sourceUrl: `https://github.com/openstates/people/blob/${peopleSourceProfiles[state].revision}/${role.sourcePath}`,
      sourceRetrievedAt: retrievedAt,
      sourceIsOfficial: false,
      provenanceComplete: true
    }
  })
  return { terms, canonicalWrites: false as const }
}
