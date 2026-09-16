import { parseDocument } from "yaml"
import { z } from "zod"
import { mergeOpenStatesEntitySnapshots, normalizeOpenStatesCommittees, normalizeOpenStatesPeople } from "./entities.js"

export const northCarolinaPeopleSource = {
  jurisdiction: "ocd-jurisdiction/country:us/state:nc/government",
  revision: "677c6d0a566ad9bd62b6324e502af76acc3d22f3",
  state: "nc"
} as const

export const peopleSourceProfiles = {
  nc: {
    ...northCarolinaPeopleSource,
    officeTitles: { upper: "Senator", lower: "Representative" },
    districts: {
      lower: Array.from({ length: 120 }, (_, i) => String(i + 1)),
      upper: Array.from({ length: 50 }, (_, i) => String(i + 1))
    }
  },
  ak: {
    state: "ak",
    officeTitles: { upper: "Senator", lower: "Representative" },
    jurisdiction: "ocd-jurisdiction/country:us/state:ak/government",
    revision: northCarolinaPeopleSource.revision,
    districts: { lower: Array.from({ length: 40 }, (_, i) => String(i + 1)), upper: Array.from("ABCDEFGHIJKLMNOPQRST") }
  }
} as const

const roleSchema = z.object({
  district: z.string().optional(),
  end_date: z.string().optional(),
  jurisdiction: z.string(),
  start_date: z.string().optional(),
  type: z.string()
})
const namedSchema = z.object({ name: z.string().min(1) })
const personSchema = z
  .object({
    id: z.string().startsWith("ocd-person/"),
    name: z.string().min(1),
    roles: z.array(roleSchema).min(1),
    party: z.array(namedSchema.extend({ end_date: z.string().optional() })).default([]),
    other_names: z.array(namedSchema).default([])
  })
  .passthrough()
const committeeSchema = z
  .object({
    id: z.string().startsWith("ocd-organization/"),
    name: z.string().min(1),
    jurisdiction: z.string(),
    classification: z.literal("committee"),
    chamber: z.enum(["upper", "lower", "legislature"]),
    members: z.array(
      z.object({
        name: z.string().min(1),
        person_id: z.string().startsWith("ocd-person/").optional(),
        role: z.string().min(1)
      })
    )
  })
  .passthrough()

export type PeopleRepositoryFile = { path: string; content: string }

/** Validation-only boundary: never treat missing people or partial files as departures. */
export function validatePeopleRepositorySnapshot(
  files: readonly PeopleRepositoryFile[],
  retrievedAt: Date,
  state: keyof typeof peopleSourceProfiles = "nc"
) {
  const source = peopleSourceProfiles[z.enum(["nc", "ak"]).parse(state)]
  const peopleInputs = []
  const committeeInputs = []
  const paths = new Set<string>()
  const ids = new Set<string>()
  for (const file of files) {
    if (
      !new RegExp(`^data/${source.state}/(legislature|committees)/[^/\\\\]+\\.ya?ml$`).test(file.path) ||
      paths.has(file.path)
    ) {
      throw new Error("Unexpected or duplicate source path")
    }
    paths.add(file.path)
    const document = parseDocument(file.content, { uniqueKeys: true })
    if (document.errors.length > 0) {
      throw new Error(`Invalid YAML: ${file.path}`)
    }
    const input: unknown = document.toJS({ maxAliasCount: 0 })
    if (file.path.includes("/legislature/")) {
      const person = personSchema.parse(input)
      if (ids.has(person.id)) {
        throw new Error("Duplicate source identity")
      }
      ids.add(person.id)
      const roles = person.roles.filter((role) => role.end_date === undefined)
      const role = roles[0]
      if (roles.length !== 1 || role?.jurisdiction !== source.jurisdiction || !["upper", "lower"].includes(role.type)) {
        throw new Error(`Ambiguous current role: ${person.id}`)
      }
      const parties = person.party.filter((party) => party.end_date === undefined)
      if (parties.length > 1) {
        throw new Error(`Ambiguous current party: ${person.id}`)
      }
      peopleInputs.push({
        ...person,
        current_role: { district: role.district, org_classification: role.type },
        other_names: person.other_names.map((name) => name.name),
        party: parties[0]?.name
      })
    } else {
      const committee = committeeSchema.parse(input)
      if (committee.jurisdiction !== source.jurisdiction) {
        throw new Error("Committee jurisdiction does not match source profile")
      }
      if (ids.has(committee.id)) {
        throw new Error("Duplicate source identity")
      }
      ids.add(committee.id)
      committeeInputs.push(committee)
    }
  }
  if (peopleInputs.length === 0 || committeeInputs.length === 0) {
    throw new Error("Incomplete source lanes")
  }
  const peopleById = new Map(peopleInputs.map((person) => [person.id, person]))
  const unresolved: Array<{ committeeId: string; name: string; personId: string | null }> = []
  const committees = committeeInputs.map((committee) => ({
    ...committee,
    memberships: committee.members.flatMap((member) => {
      const person = member.person_id === undefined ? undefined : peopleById.get(member.person_id)
      if (person === undefined) {
        unresolved.push({ committeeId: committee.id, name: member.name, personId: member.person_id ?? null })
        return []
      }
      return [{ person, role: member.role }]
    })
  }))
  const counts = {
    committees: committees.length,
    lower: peopleInputs.filter((person) => person.current_role.org_classification === "lower").length,
    memberships: committeeInputs.reduce((total, committee) => total + committee.members.length, 0),
    people: peopleInputs.length,
    upper: peopleInputs.filter((person) => person.current_role.org_classification === "upper").length
  }
  // Reviewed profiles have single-member districts. A missing seat requires explicit review, even
  // if it is a genuine vacancy; neither a vacancy nor its occupant is inferred.
  const coverageIssues: Array<{ chamber: string; district: string; count: number }> = []
  for (const chamber of ["lower", "upper"] as const) {
    const districts = new Map<string, number>()
    for (const person of peopleInputs) {
      if (person.current_role.org_classification === chamber) {
        const district = person.current_role.district ?? "unknown"
        districts.set(district, (districts.get(district) ?? 0) + 1)
      }
    }
    const expected = new Set<string>(source.districts[chamber])
    for (const district of new Set([...expected, ...districts.keys()])) {
      const count = districts.get(district) ?? 0
      if (count !== 1 || !expected.has(district)) {
        coverageIssues.push({ chamber, district, count })
      }
    }
  }
  // Partial snapshots are never returned as a promotable canonical batch.
  if (unresolved.length > 0 || coverageIssues.length > 0) {
    return { counts, coverageIssues, snapshot: null, status: "rejected" as const, unresolved }
  }
  const context = { jurisdictionCode: source.state, retrievedAt }
  const snapshot = mergeOpenStatesEntitySnapshots(
    normalizeOpenStatesPeople(peopleInputs, context),
    normalizeOpenStatesCommittees(committees, context)
  )
  return { counts, coverageIssues, snapshot, status: "validated" as const, unresolved }
}
