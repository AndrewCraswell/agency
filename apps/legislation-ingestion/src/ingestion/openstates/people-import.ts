import { createHash } from "node:crypto"
import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import { parseDocument } from "yaml"
import { z } from "zod"
import { replaceEntitySnapshot } from "../../persistence/entities.js"
import type { EntitySnapshot } from "../entity-snapshot.js"
import { normalizeOpenStatesPeople } from "./entities.js"
import { inventoryPeopleHistory } from "./people-history.js"
import {
  peopleSourceProfiles,
  validatePeopleRepositorySnapshot,
  type PeopleRepositoryFile
} from "./people-repository.js"
import { planPeopleLegislativeTerms } from "./people-term-plan.js"

const personSchema = z.object({
  id: z.string().startsWith("ocd-person/"),
  name: z.string().trim().min(1),
  given_name: z.string().nullish(),
  family_name: z.string().nullish(),
  image: z.string().nullish(),
  email: z.string().nullish(),
  links: z.array(z.object({ url: z.string().trim().min(1), note: z.string().optional() })).default([]),
  party: z.array(z.object({ name: z.string().min(1), end_date: z.string().optional() })).default([]),
  other_names: z.array(z.object({ name: z.string().trim().min(1) })).default([]),
  identifiers: z.array(z.object({ scheme: z.string(), identifier: z.string() })).default([]),
  other_identifiers: z.array(z.object({ scheme: z.string(), identifier: z.string() })).default([])
})

/** Quarantine whole people, not selected roles: incomplete histories must not change their active status. */
export function preparePeopleRepositoryImport(
  currentFiles: readonly PeopleRepositoryFile[],
  retiredFiles: readonly PeopleRepositoryFile[],
  retrievedAt: Date,
  state: keyof typeof peopleSourceProfiles = "nc"
) {
  if (!Number.isFinite(retrievedAt.getTime())) {
    throw new Error("Invalid retrieval date")
  }
  const files = [...currentFiles.filter((file) => file.path.startsWith(`data/${state}/legislature/`)), ...retiredFiles]
  const quarantine: Array<{ path: string; sha256: string; reasons: string[] }> = []
  const quarantineFile = (file: PeopleRepositoryFile, reasons: string[]) => {
    quarantine.push({ path: file.path, sha256: createHash("sha256").update(file.content).digest("hex"), reasons })
  }
  // Identity preflight precedes role validation: duplicate identities are never first-file-wins,
  // including when one of the duplicate files has malformed dates or missing metadata.
  const parsed = files.map((file) => {
    try {
      const document = parseDocument(file.content, { uniqueKeys: true })
      if (document.errors.length) {
        throw new Error("Invalid YAML")
      }
      const value: unknown = document.toJS({ maxAliasCount: 0 })
      return { file, value, identity: z.object({ id: z.string().startsWith("ocd-person/") }).safeParse(value) }
    } catch {
      return { file, value: undefined, identity: z.object({ id: z.string() }).safeParse(undefined) }
    }
  })
  const identityCounts = new Map<string, number>()
  const pathCounts = new Map<string, number>()
  for (const entry of parsed) {
    pathCounts.set(entry.file.path, (pathCounts.get(entry.file.path) ?? 0) + 1)
    if (entry.identity.success) {
      identityCounts.set(entry.identity.data.id, (identityCounts.get(entry.identity.data.id) ?? 0) + 1)
    }
  }
  const candidates = parsed.flatMap(({ file, value, identity }) => {
    if (!identity.success) {
      quarantineFile(file, ["invalid_source_identity_or_yaml"])
      return []
    }
    if (identityCounts.get(identity.data.id) !== 1 || pathCounts.get(file.path) !== 1) {
      quarantineFile(file, ["duplicate_source_identity_or_path"])
      return []
    }
    const person = personSchema.safeParse(value)
    if (!person.success) {
      quarantineFile(file, ["invalid_person_metadata"])
      return []
    }
    let inventory: ReturnType<typeof inventoryPeopleHistory>
    try {
      inventory = inventoryPeopleHistory([file], state)
    } catch {
      quarantineFile(file, ["invalid_role_schema_or_source_path"])
      return []
    }
    const reasons = inventory.issues.map((issue) => issue.reason)
    if (inventory.partialDates > 0) {
      reasons.push("unsupported_date_precision")
    }
    if (
      file.path.startsWith(`data/${state}/legislature/`) &&
      (inventory.sourceRoles.filter((role) => role.end === null).length !== 1 ||
        person.data.party.filter((party) => party.end_date === undefined).length > 1)
    ) {
      reasons.push("ambiguous_current_role_or_party")
    }
    const termKeys = inventory.sourceRoles.map((role) => JSON.stringify([role.chamber, role.district, role.start]))
    if (new Set(termKeys).size !== termKeys.length) {
      reasons.push("ambiguous_term_identity")
    }
    if (reasons.length > 0) {
      quarantineFile(file, [...new Set(reasons)].sort())
      return []
    }
    return [{ file, person: person.data }]
  })
  let coverageIssues: string[]
  try {
    const current = validatePeopleRepositorySnapshot([...currentFiles], retrievedAt, state)
    coverageIssues = current.coverageIssues.map(
      (issue) => `district_coverage:${issue.chamber}:${issue.district}:${issue.count}`
    )
    if (current.unresolved.length > 0) {
      coverageIssues.push("unresolved_committee_members")
    }
  } catch {
    coverageIssues = ["current_snapshot_invalid"]
  }
  quarantine.sort((a, b) => a.path.localeCompare(b.path) || a.sha256.localeCompare(b.sha256))
  const plan =
    candidates.length > 0
      ? planPeopleLegislativeTerms(
          candidates.map(({ file }) => file),
          retrievedAt,
          state
        )
      : { terms: [] }
  const peopleIds = new Set(plan.terms.map((term) => term.personId))
  const normalized = normalizeOpenStatesPeople(
    candidates.map(({ file, person }) => {
      return {
        id: person.id,
        name: person.name,
        given_name: person.given_name ?? undefined,
        family_name: person.family_name ?? undefined,
        image: person.image ?? undefined,
        email: person.email ?? undefined,
        links: person.links,
        party: file.path.startsWith(`data/${state}/legislature/`)
          ? person.party.find((party) => party.end_date === undefined)?.name
          : undefined,
        identifiers: [
          ...new Map(
            [...person.identifiers, ...person.other_identifiers].map((identifier) => [
              JSON.stringify([identifier.scheme, identifier.identifier]),
              identifier
            ])
          ).values()
        ],
        other_names: person.other_names.map((alias) => alias.name),
        openstates_url: `https://github.com/openstates/people/blob/${peopleSourceProfiles[state].revision}/${file.path}`
      }
    }),
    { jurisdictionCode: state, retrievedAt }
  )
  const people = normalized.people
    .filter((person) => peopleIds.has(person.id))
    .map((person) => ({
      ...person,
      isActive: plan.terms.some((term) => term.personId === person.id && term.isActive === true)
    }))
  const counts = { people: people.length, terms: plan.terms.length }
  if (people.length === 0) {
    return { status: "rejected" as const, counts, coverageIssues, quarantine, snapshot: null }
  }
  const snapshot: EntitySnapshot = {
    people,
    terms: plan.terms,
    organizations: [],
    memberships: [],
    personDetails: normalized.personDetails?.filter((detail) => peopleIds.has(detail.personId)),
    personJurisdictions: normalized.personJurisdictions?.filter((jurisdiction) => peopleIds.has(jurisdiction.personId)),
    personAliases: normalized.personAliases.filter((alias) => peopleIds.has(alias.personId)),
    personAliasPersonIds: people.map((person) => person.id),
    personAliasSourceProvider: "openstates",
    personExternalIdentifiers: normalized.personExternalIdentifiers?.filter((identifier) =>
      peopleIds.has(identifier.personId)
    )
  }
  return {
    status: quarantine.length > 0 || coverageIssues.length > 0 ? ("partial" as const) : ("validated" as const),
    counts,
    coverageIssues,
    quarantine,
    snapshot
  }
}

/** Snapshot and checkpoint commit together; rejected input never reaches persistence. */
export async function importPeopleRepository(
  database: LegislationDatabase,
  state: keyof typeof peopleSourceProfiles,
  currentFiles: readonly PeopleRepositoryFile[],
  retiredFiles: readonly PeopleRepositoryFile[],
  retrievedAt: Date,
  persist: typeof replaceEntitySnapshot = replaceEntitySnapshot
) {
  const result = preparePeopleRepositoryImport(currentFiles, retiredFiles, retrievedAt, state)
  if (result.snapshot === null) {
    return result
  }
  await persist(database, `jurisdiction:${state}`, result.snapshot, {
    replaceOrganizations: false,
    preserveUnobservedPeople: true,
    protectTermHistory: true,
    enforceObservationOrder: true,
    statementTimeoutMs: 30000,
    checkpoint: {
      source: "openstates",
      stream: `${state}-people-history`,
      cursor: {
        revision: peopleSourceProfiles[state].revision,
        retrievedAt: retrievedAt.toISOString(),
        complete: result.status === "validated",
        quarantine: result.quarantine,
        coverageIssues: result.coverageIssues
      }
    }
  })
  return {
    status: result.status === "partial" ? ("partially_imported" as const) : ("imported" as const),
    counts: result.counts,
    quarantine: result.quarantine,
    coverageIssues: result.coverageIssues
  }
}
