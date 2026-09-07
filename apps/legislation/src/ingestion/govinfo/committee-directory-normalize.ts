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
      sourceUrl: directoryPackage.sourceUrl.href,
      upstreamIds: { govinfo: `${directoryPackage.packageId}:${sourceId}` }
    }
  })
  const memberships: EntitySnapshot["memberships"] = []
  const sessionId = legislativeSessionId("us", String(directoryPackage.congress))
  const unmatched: GovInfoCommitteeNormalizationResult["unmatched"][number][] = []
  for (const record of records) {
    const canonicalOrganizationId = organizationId("govinfo", organizationSourceId(record))
    for (const member of record.members) {
      const match = matchPerson({ ...member, name: crossCheckedPrintedName(member, records, directoryPackage) }, people)
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
        sourceUrl: directoryPackage.sourceUrl.href,
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

/** Correct only printed artifacts corroborated by another roster in the same edition. */
function crossCheckedPrintedName(
  member: GovInfoCommitteeMember,
  records: readonly GovInfoCommitteeRecord[],
  directory: GovInfoDirectoryPackage
): string {
  if (directory.packageId === "CDIR-2022-10-26" && directory.congress === 117) {
    const suffix = `, ${member.state}`
    if (member.name.endsWith(suffix)) {
      const name = member.name.slice(0, -suffix.length)
      if (
        records.some((record) =>
          record.members.some(
            (candidate) =>
              candidate.name === name && candidate.state === member.state && candidate.chamber === member.chamber
          )
        )
      ) {
        return name
      }
    }
  }
  if (directory.packageId !== "CDIR-2024-04-25" || directory.congress !== 118 || member.chamber !== "lower") {
    return member.name
  }
  const corrections = new Map([
    ["Paul P. Sarbanes", { name: "John P. Sarbanes", state: "MD", district: "3" }],
    ["Debbie Pingell", { name: "Debbie Dingell", state: "MI", district: "6" }],
    ["Vicente Gonzales", { name: "Vicente Gonzalez", state: "TX", district: "34" }],
    ["Garret Graves T4", { name: "Garret Graves", state: "LA", district: "6" }],
    ["Lori Chaves-DeRemer", { name: "Lori Chavez-DeRemer", state: "OR", district: "5" }]
  ])
  const correction = corrections.get(member.name)
  if (correction === undefined || correction.state !== member.state || correction.district !== member.district) {
    return member.name
  }
  const corroborated = records.some((record) =>
    record.members.some(
      (candidate) =>
        candidate.chamber === "lower" &&
        candidate.name === correction.name &&
        candidate.state === correction.state &&
        candidate.district === correction.district
    )
  )
  return corroborated ? correction.name : member.name
}

interface IndexedPerson {
  chamber: CongressionalChamber
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
      // GovInfo prints the senator's preferred first name; Congress.gov uses Thomas.
      ...(person.id === "person:congress:t000476" ? ["Thom Tillis"] : []),
      person.givenName !== null && person.familyName !== null ? `${person.givenName} ${person.familyName}` : undefined,
      ...(aliasesByPerson.get(person.id) ?? [])
    ]
    return [
      {
        chamber,
        names: new Set(names.flatMap((name) => (name === undefined ? [] : nameVariants(name)))),
        personId: person.id
      }
    ]
  })
}

function matchPerson(member: GovInfoCommitteeMember, people: readonly IndexedPerson[]): string | undefined {
  // Directory district annotations contain typos and Congress.gov omits some at-large
  // districts. Require a unique full-name identity within the Congress and chamber.
  const names = nameVariants(member.name)
  const matches = new Set(
    people
      .filter((person) => person.chamber === member.chamber && names.some((name) => person.names.has(name)))
      .map((person) => person.personId)
  )
  return matches.size === 1 ? [...matches][0] : undefined
}

function termAppliesToCongress(term: TermRow, congress: number): boolean {
  return term.sourceId?.startsWith(`${congress}:`) === true
}

function nameVariants(value: string): string[] {
  const withoutNickname = value
    .replaceAll(/\s+(?:["“][^"”]+["”]|[‘’]{2}[^‘’]+[‘’]{2}|\([^()]+\))\s*/g, " ")
    .replace(/,+$/, "")
  const withoutSuffix = withoutNickname.replace(/,?\s+(jr\.?|sr\.?|ii|iii|iv)$/i, "")
  const normalized = normalizeName(withoutSuffix)
  const comma = withoutSuffix.split(",").map((part) => part.trim())
  return [...new Set([normalized, ...(comma.length === 2 ? [normalizeName(`${comma[1]} ${comma[0]}`)] : [])])]
}

function normalizeName(value: string): string {
  return (
    value
      // PDF text may emit a spacing acute accent separately (Luja´n).
      // Remove it before NFKD expands it into a space and combining mark.
      .replaceAll("\u00b4", "")
      .replaceAll("\u0131", "i")
      .normalize("NFKD")
      .replaceAll(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replaceAll(/[^a-z0-9 ]/g, " ")
      .replaceAll(/\s+/g, " ")
      .trim()
  )
}

function canonicalChamber(value: string | null): CongressionalChamber | undefined {
  return value === "lower" || value === "upper" ? value : undefined
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
