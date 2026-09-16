import { parseDocument } from "yaml"
import { z } from "zod"
import { inventoryCommitteeHistory } from "./committee-history.js"
import { inventoryPeopleHistory } from "./people-history.js"
import type { PeopleRepositoryFile } from "./people-repository.js"

const identifier = z.object({ scheme: z.string(), identifier: z.string() })
const personSchema = z.object({
  id: z.string().startsWith("ocd-person/"),
  identifiers: z.array(identifier).default([]),
  other_identifiers: z.array(identifier).default([])
})

/** Resolve only explicit source identifiers. Names never participate in identity decisions. */
export function reconcileNorthCarolinaCommittees(
  committees: readonly PeopleRepositoryFile[],
  people: readonly PeopleRepositoryFile[],
  revision: string,
  committedAt: string
) {
  const history = inventoryPeopleHistory(people)
  if (history.issues.length > 0) {
    throw new Error("People history requires review")
  }
  const eligible = new Set(history.sourceRoles.map((role) => role.personId))
  const identities = new Map<string, Set<string>>()
  for (const file of people) {
    const document = parseDocument(file.content, { uniqueKeys: true })
    if (document.errors.length > 0) {
      throw new Error("Invalid people YAML")
    }
    const person = personSchema.parse(document.toJS({ maxAliasCount: 0 }))
    // Include all identity claims when detecting collisions, even for non-legislators.
    const claims = [
      person.id,
      ...[...person.identifiers, ...person.other_identifiers]
        .filter((value) => value.scheme === "openstates" && value.identifier.startsWith("ocd-person/"))
        .map((value) => value.identifier)
    ]
    for (const claim of claims) {
      const owners = identities.get(claim) ?? new Set<string>()
      owners.add(person.id)
      identities.set(claim, owners)
    }
  }
  const inventory = inventoryCommitteeHistory(committees, revision, committedAt)
  const observations = inventory.observations.map((committee) => ({
    ...committee,
    members: committee.members.map((member) => {
      const owners = member.personId === null ? undefined : identities.get(member.personId)
      const owner = owners?.size === 1 ? [...owners][0] : undefined
      let reason: string | null = null
      if (member.personId === null) {
        reason = "missing_person_id"
      } else if (owners === undefined) {
        reason = "unknown_person_id"
      } else if (owners.size !== 1) {
        reason = "ambiguous_person_id"
      } else if (owner === undefined || !eligible.has(owner)) {
        reason = "no_legislative_service"
      }
      return { ...member, sourcePersonId: member.personId, resolvedPersonId: reason === null ? owner! : null, reason }
    })
  }))
  const unresolved = observations.flatMap((committee) =>
    committee.members
      .filter((member) => member.reason !== null)
      .map((member) => ({ committeeId: committee.committeeId, sourcePath: committee.sourcePath, ...member }))
  )
  return {
    status: unresolved.length === 0 ? ("resolved" as const) : ("needs_review" as const),
    observations,
    unresolved,
    memberships: inventory.memberships,
    resolvedMemberships: inventory.memberships - unresolved.length,
    // Identity resolution does not establish temporal completeness or authorize promotion.
    canonicalWrites: false as const,
    departuresEstablished: false as const,
    completenessEstablished: false as const
  }
}
