import { parseDocument } from "yaml"
import { z } from "zod"
import {
  alaskaCommitteeIdentifiers,
  northCarolinaCommitteeIdentifiers,
  washingtonCommitteeIdentifiers
} from "./committee-identifiers.js"
import { peopleSourceProfiles, type PeopleRepositoryFile } from "./people-repository.js"

const chamberSchema = z.enum(["upper", "lower", "legislature"])
const committeeSchema = z.object({
  id: z.string().startsWith("ocd-organization/"),
  name: z.string().min(1),
  classification: z.enum(["committee", "subcommittee"]),
  jurisdiction: z.string().optional(),
  chamber: chamberSchema.optional(),
  parent: z.string().nullable().optional(),
  links: z.unknown().optional(),
  sources: z.unknown().optional(),
  members: z.array(
    z.object({
      name: z.string().min(1),
      role: z.string().min(1),
      person_id: z.string().startsWith("ocd-person/").nullable().optional()
    })
  )
})

function committeeHomepage(input: unknown) {
  if (input === undefined || input === null) {
    return { websiteUrl: null, linkIssues: [] }
  }
  const links = z.array(z.unknown()).safeParse(input)
  if (!links.success) {
    return { websiteUrl: null, linkIssues: ["invalid_links"] }
  }
  const urls = new Set<string>()
  const linkIssues = new Set<string>()
  for (const value of links.data) {
    const link = z.object({ url: z.url({ protocol: /^https$/ }), note: z.string().optional() }).safeParse(value)
    if (!link.success) {
      linkIssues.add("invalid_public_link")
      continue
    }
    if (link.data.note?.trim().toLowerCase() === "homepage") {
      const url = new URL(link.data.url)
      if (url.username || url.password) {
        linkIssues.add("credentialed_public_link")
      } else {
        urls.add(link.data.url)
      }
    }
  }
  if (urls.size > 1) {
    linkIssues.add("ambiguous_homepage")
  }
  return { websiteUrl: urls.size === 1 ? [...urls][0]! : null, linkIssues: [...linkIssues].sort() }
}

/** Repository observations only: never derive effective dates or departures. */
export function inventoryCommitteeHistory(
  files: readonly PeopleRepositoryFile[],
  revision: string,
  committedAt: string,
  state: keyof typeof peopleSourceProfiles = "nc"
) {
  z.string()
    .regex(/^[a-f0-9]{40}$/)
    .parse(revision)
  z.iso.datetime().parse(committedAt)
  if (files.length === 0) {
    throw new Error("Empty committee snapshot")
  }
  const ids = new Set<string>()
  const paths = new Set<string>()
  const observations = files.map((file) => {
    if (
      !/^data\/[a-z]{2}\/committees\/[^/\\]+\.ya?ml$/.test(file.path) ||
      !file.path.startsWith(`data/${state}/committees/`) ||
      paths.has(file.path)
    ) {
      throw new Error("Unexpected or duplicate committee source path")
    }
    paths.add(file.path)
    const document = parseDocument(file.content, { uniqueKeys: true })
    if (document.errors.length > 0) {
      throw new Error("Invalid committee YAML")
    }
    const committee = committeeSchema.parse(document.toJS({ maxAliasCount: 0 }))
    if (committee.jurisdiction !== undefined && committee.jurisdiction !== peopleSourceProfiles[state].jurisdiction) {
      throw new Error("Committee jurisdiction does not match state")
    }
    if (ids.has(committee.id)) {
      throw new Error("Duplicate committee identity")
    }
    ids.add(committee.id)
    const parentChamber = chamberSchema.safeParse(committee.parent)
    if (committee.chamber !== undefined && parentChamber.success && committee.chamber !== parentChamber.data) {
      throw new Error("Conflicting source chambers")
    }
    const memberIds = new Set<string>()
    for (const member of committee.members) {
      if (member.person_id) {
        const assignment = JSON.stringify([member.person_id, member.role])
        if (memberIds.has(assignment)) {
          throw new Error("Duplicate member identity")
        }
        memberIds.add(assignment)
      }
    }
    return {
      ...committeeHomepage(committee.links),
      officialIdentifiers:
        state === "ak"
          ? {
              ...alaskaCommitteeIdentifiers(
                committee.links,
                committee.chamber ?? (parentChamber.success ? parentChamber.data : null)
              ),
              ...alaskaCommitteeIdentifiers(
                committee.sources,
                committee.chamber ?? (parentChamber.success ? parentChamber.data : null)
              )
            }
          : state === "wa"
            ? {
                ...washingtonCommitteeIdentifiers(
                  committee.links,
                  committee.chamber ?? (parentChamber.success ? parentChamber.data : null)
                ),
                ...washingtonCommitteeIdentifiers(
                  committee.sources,
                  committee.chamber ?? (parentChamber.success ? parentChamber.data : null)
                )
              }
            : {
                ...northCarolinaCommitteeIdentifiers(committee.links),
                ...northCarolinaCommitteeIdentifiers(committee.sources)
              },
      committeeId: committee.id,
      name: committee.name,
      classification: committee.classification,
      chamber: committee.chamber ?? (parentChamber.success ? parentChamber.data : null),
      parentSourceId: committee.parent?.startsWith("ocd-organization/") ? committee.parent : null,
      members: committee.members.map((member) => ({
        name: member.name,
        role: member.role,
        personId: member.person_id ?? null
      })),
      sourcePath: file.path,
      revision,
      repositoryObservedAt: committedAt
    }
  })
  const unresolved = observations.flatMap((committee) =>
    committee.members
      .filter((member) => member.personId === null)
      .map((member) => ({ committeeId: committee.committeeId, name: member.name, reason: "missing_person_id" }))
  )
  return {
    committees: observations.length,
    memberships: observations.reduce((sum, committee) => sum + committee.members.length, 0),
    unresolved,
    observations,
    canonicalWrites: false as const,
    departuresEstablished: false as const,
    completenessEstablished: false as const
  }
}
