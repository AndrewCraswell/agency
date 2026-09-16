import { parseDocument } from "yaml"
import { z } from "zod"
import { peopleSourceProfiles, type PeopleRepositoryFile } from "./people-repository.js"

// Keep publisher precision. Calendar validation must not turn a year into Jan 1.
const dateSchema = z.union([z.iso.date(), z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/), z.string().regex(/^\d{4}$/)])
const personSchema = z.object({
  id: z.string().startsWith("ocd-person/"),
  name: z.string().min(1),
  roles: z.array(
    z.object({
      type: z.string(),
      jurisdiction: z.string(),
      district: z.string().optional(),
      start_date: dateSchema.optional(),
      end_date: dateSchema.optional()
    })
  )
})

/** Inventory source assertions, not reconstructed or inferred service dates. */
export function inventoryPeopleHistory(
  files: readonly PeopleRepositoryFile[],
  state: keyof typeof peopleSourceProfiles = "nc"
) {
  const source = peopleSourceProfiles[z.enum(["nc", "ak"]).parse(state)]
  const ids = new Set<string>()
  const roles = []
  const issues: Array<{ path: string; reason: string }> = []
  if (files.length === 0) {
    throw new Error("Empty historical snapshot")
  }
  for (const file of files) {
    if (
      !new RegExp(`^data/${state}/(retired|legislature|executive|municipalities)/[^/\\\\]+\\.ya?ml$`).test(file.path)
    ) {
      throw new Error("Unexpected historical source path")
    }
    const document = parseDocument(file.content, { uniqueKeys: true })
    if (document.errors.length > 0) {
      throw new Error(`Invalid YAML: ${file.path}`)
    }
    const person = personSchema.parse(document.toJS({ maxAliasCount: 0 }))
    if (ids.has(person.id)) {
      throw new Error("Duplicate historical person")
    }
    ids.add(person.id)
    const fullDatePeriods: Array<{ start: string; end: string }> = []
    for (const role of person.roles) {
      if (role.jurisdiction !== source.jurisdiction || !["upper", "lower"].includes(role.type)) {
        continue
      }
      if (role.end_date === undefined && file.path.startsWith(`data/${state}/retired/`)) {
        issues.push({ path: file.path, reason: "retired_role_without_end" })
      }
      if (
        role.start_date !== undefined &&
        role.end_date !== undefined &&
        role.start_date.length === role.end_date.length &&
        role.start_date > role.end_date
      ) {
        issues.push({ path: file.path, reason: "reversed_source_dates" })
      }
      if (role.start_date?.length === 10 && role.end_date?.length === 10) {
        fullDatePeriods.push({ start: role.start_date, end: role.end_date })
      }
      roles.push({
        sourcePath: file.path,
        personId: person.id,
        name: person.name,
        chamber: role.type,
        district: role.district ?? null,
        start: role.start_date ?? null,
        end: role.end_date ?? null
      })
    }
    // Same-day transitions are not treated as overlaps. Partial/unknown dates
    // cannot prove that two periods overlap, so retain them without guessing.
    for (let index = 0; index < fullDatePeriods.length; index += 1) {
      const period = fullDatePeriods[index]!
      if (fullDatePeriods.slice(index + 1).some((other) => period.start < other.end && other.start < period.end)) {
        issues.push({ path: file.path, reason: "overlapping_source_roles" })
        break
      }
    }
  }
  const starts = roles.flatMap((role) => (role.start === null ? [] : [role.start])).sort()
  const ends = roles.flatMap((role) => (role.end === null ? [] : [role.end])).sort()
  return {
    status: issues.length === 0 ? "inventoried" : "needs_review",
    files: files.length,
    currentFiles: files.filter((file) => file.path.startsWith(`data/${state}/legislature/`)).length,
    retiredFiles: files.filter((file) => file.path.startsWith(`data/${state}/retired/`)).length,
    otherOfficeFiles: files.filter((file) => new RegExp(`^data/${state}/(executive|municipalities)/`).test(file.path))
      .length,
    peopleWithLegislativeRoles: new Set(roles.map((role) => role.personId)).size,
    roles: roles.length,
    earliestSuppliedStart: starts[0] ?? null,
    latestSuppliedEnd: ends.at(-1) ?? null,
    missingStarts: roles.filter((role) => role.start === null).length,
    missingEnds: roles.filter((role) => role.end === null).length,
    partialDates: [...starts, ...ends].filter((date) => date.length !== 10).length,
    issues,
    sourceRoles: roles,
    completenessEstablished: false,
    canonicalWrites: false
  }
}
