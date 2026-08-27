import type { legislativeTerms, people, personAliases } from "../../db/schema/schema.js"
import {
  jurisdictionId,
  legislativeSessionId,
  organizationId,
  organizationMembershipId
} from "../../legislation/identifiers.js"
import type { EntitySnapshot } from "../entity-snapshot.js"
import type { GovInfoDirectoryPackage } from "./committee-directory-client.js"
import type {
  CongressionalChamber,
  GovInfoCommitteeMember,
  GovInfoCommitteeRecord
} from "./committee-directory-parser.js"

type PersonRow = Pick<typeof people.$inferSelect, "familyName" | "givenName" | "id" | "name">
type AliasRow = Pick<typeof personAliases.$inferSelect, "name" | "personId">
type TermRow = Pick<typeof legislativeTerms.$inferSelect, "chamber" | "district" | "isActive" | "personId" | "sourceId">

export interface GovInfoPersonCatalog {
  aliases: readonly AliasRow[]
  people: readonly PersonRow[]
  terms: readonly TermRow[]
}

export interface GovInfoCommitteeNormalizationResult {
  snapshot: EntitySnapshot
  unmatched: ReadonlyArray<Readonly<{ chamber: CongressionalChamber; name: string; organization: string }>>
}

/** Maps a complete Directory edition onto existing Congress.gov person identities. */
export function normalizeGovInfoCommitteeDirectory(
  records: readonly GovInfoCommitteeRecord[],
  directoryPackage: GovInfoDirectoryPackage,
  catalog: GovInfoPersonCatalog,
  retrievedAt: Date
): GovInfoCommitteeNormalizationResult {
  const people = buildPersonIndex(catalog, directoryPackage.congress)
  const organizations = records.map((record) => {
    const sourceId = organizationSourceId(record)
    return {
      chamber: record.chamber,
      childRelationsComplete: true,
      classification: record.classification,
      detailFactsComplete: true,
      id: organizationId("govinfo", sourceId),
      isActive: true,
      jurisdictionId: jurisdictionId("us"),
      membershipRelationsComplete: true,
      name: record.name,
      parentOrganizationId:
        record.parentName === undefined
          ? null
          : organizationId(
              "govinfo",
              organizationSourceId({ chamber: record.chamber, classification: "committee", name: record.parentName })
            ),
      provenanceComplete: true,
      sourceId,
      sourceIsOfficial: true,
      sourceProvider: "govinfo",
      sourceRetrievedAt: retrievedAt,
      sourceUpdatedAt: directoryPackage.lastModified,
      sourceUrl: directoryPackage.textUrl.href,
      upstreamIds: { govinfo: `${directoryPackage.packageId}:${sourceId}` }
    }
  })
  const memberships: EntitySnapshot["memberships"] = []
  const sessionId = legislativeSessionId("us", String(directoryPackage.congress))
  const unmatched: GovInfoCommitteeNormalizationResult["unmatched"][number][] = []
  for (const record of records) {
    const canonicalOrganizationId = organizationId("govinfo", organizationSourceId(record))
    for (const member of record.members) {
      const match = matchPerson(member, people)
      if (match === undefined) {
        unmatched.push({ chamber: record.chamber, name: member.name, organization: record.name })
        continue
      }
      const sourceId = `${directoryPackage.congress}:${organizationSourceId(record)}:${match}`
      memberships.push({
        classification: "member",
        detectedStartDate: dateOnly(directoryPackage.issuedAt),
        id: organizationMembershipId(canonicalOrganizationId, match, sourceId),
        isActive: true,
        label: member.role ?? "member",
        lastObservedDate: dateOnly(directoryPackage.issuedAt),
        legislativeSessionId: sessionId,
        organizationId: canonicalOrganizationId,
        personId: match,
        provenanceComplete: true,
        role: member.role ?? "member",
        sourceId,
        sourceIsOfficial: true,
        sourceProvider: "govinfo",
        sourceRetrievedAt: retrievedAt,
        sourceUpdatedAt: directoryPackage.lastModified,
        sourceUrl: directoryPackage.textUrl.href,
        title: member.role ?? null
      })
    }
  }
  return {
    snapshot: {
      memberships,
      organizations,
      personAliasPersonIds: [],
      personAliases: [],
      people: [],
      terms: []
    },
    unmatched
  }
}

interface IndexedPerson {
  chamber: CongressionalChamber
  district?: string
  names: Set<string>
  personId: string
}

function buildPersonIndex(catalog: GovInfoPersonCatalog, congress: number): IndexedPerson[] {
  const aliasesByPerson = new Map<string, string[]>()
  for (const alias of catalog.aliases) {
    const aliases = aliasesByPerson.get(alias.personId) ?? []
    aliases.push(alias.name)
    aliasesByPerson.set(alias.personId, aliases)
  }
  const peopleById = new Map(catalog.people.map((person) => [person.id, person]))
  return catalog.terms.flatMap((term) => {
    const person = peopleById.get(term.personId)
    const chamber = canonicalChamber(term.chamber)
    if (person === undefined || chamber === undefined || !termAppliesToCongress(term, congress)) {
      return []
    }
    const names = [
      person.name,
      person.givenName !== null && person.familyName !== null ? `${person.givenName} ${person.familyName}` : undefined,
      ...(aliasesByPerson.get(person.id) ?? [])
    ]
    return [
      {
        chamber,
        ...(term.district === null ? {} : { district: normalizeDistrict(term.district) }),
        names: new Set(names.flatMap((name) => (name === undefined ? [] : nameVariants(name)))),
        personId: person.id
      }
    ]
  })
}

function matchPerson(member: GovInfoCommitteeMember, people: readonly IndexedPerson[]): string | undefined {
  const names = nameVariants(member.name)
  const matches = new Set(
    people
      .filter(
        (person) =>
          person.chamber === member.chamber &&
          (member.district === undefined || person.district === member.district) &&
          names.some((name) => person.names.has(name))
      )
      .map((person) => person.personId)
  )
  return matches.size === 1 ? [...matches][0] : undefined
}

function termAppliesToCongress(term: TermRow, congress: number): boolean {
  if (term.sourceId?.startsWith(`${congress}:`) === true) {
    return true
  }
  return term.isActive === true
}

function nameVariants(value: string): string[] {
  const withoutNickname = value.replaceAll(/\s+["“][^"”]+["”]\s*/g, " ")
  const withoutSuffix = withoutNickname.replace(/,?\s+(jr\.?|sr\.?|ii|iii|iv)$/i, "")
  const normalized = normalizeName(withoutSuffix)
  const comma = withoutSuffix.split(",").map((part) => part.trim())
  return [...new Set([normalized, ...(comma.length === 2 ? [normalizeName(`${comma[1]} ${comma[0]}`)] : [])])]
}

function normalizeName(value: string): string {
  return value
    .normalize("NFKD")
    .replaceAll(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9 ]/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim()
}

function canonicalChamber(value: string | null): CongressionalChamber | undefined {
  return value === "lower" || value === "upper" ? value : undefined
}

function normalizeDistrict(value: string): string {
  const normalized = value.trim().toLowerCase()
  if (normalized === "at" || normalized === "al" || normalized === "dl") {
    return "0"
  }
  return /^\d+$/.test(normalized) ? String(Number(normalized)) : normalized
}

function organizationSourceId(
  record: Pick<GovInfoCommitteeRecord, "chamber" | "classification" | "name" | "parentName">
): string {
  return [record.chamber, record.classification, record.parentName, record.name]
    .filter((value): value is string => value !== undefined)
    .map((value) =>
      value
        .normalize("NFKC")
        .trim()
        .toLowerCase()
        .replaceAll(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
    )
    .join(":")
}

function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10)
}
