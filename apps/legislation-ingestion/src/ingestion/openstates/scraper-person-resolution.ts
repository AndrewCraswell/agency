import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import { legislativeTerms, people, personAliases } from "@repo/legislation-core/database/schema/schema"
import type { CanonicalBillAggregate } from "@repo/legislation-core/domain/model"
import { eq, inArray } from "drizzle-orm"

type Chamber = "legislature" | "lower" | "upper" | "unicameral"

export interface ScraperPersonCandidate {
  familyName: string | null
  familyNameAliases?: readonly string[]
  names: readonly string[]
  personId: string
  sourcePersonId: string
  terms: readonly {
    chamber: string | null
    endDate: string | null
    startDate: string | null
  }[]
}

export interface ScraperPersonResolutionContext {
  allowChamberHistoryFallback?: boolean
  chamber: Chamber
  name: string
  observedDate?: string
  sessionEndDate?: string
  sessionStartDate?: string
}

export type ScraperPersonResolution =
  | { status: "ambiguous" | "not_found" }
  | { personId: string; sourcePersonId: string; status: "resolved" }

function normalizedName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{Mark}/gu, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
}

function compactPublishedName(value: string) {
  const normalized = normalizedName(value)
  return normalized.includes(" ") ? normalized.replaceAll(" ", "") : undefined
}

function isIsoDate(value: string | undefined): value is string {
  return value !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function familyNameFromPublishedAlias(value: string) {
  const commaName = value.split(",", 1)[0]?.trim()
  if (value.includes(",") && commaName) return commaName
  const tokens = value.trim().split(/\s+/)
  return tokens.length === 2 ? tokens[1] : undefined
}

function terminalFamilyNameToken(value: string | null) {
  if (value === null) return undefined
  const tokens = value.trim().split(/\s+/)
  return tokens.length > 1 ? tokens.at(-1) : undefined
}

function chamberMatches(termChamber: string | null, chamber: Chamber) {
  return chamber === "legislature"
    ? termChamber === "lower" || termChamber === "upper" || termChamber === "unicameral"
    : termChamber === chamber
}

function termMatches(term: ScraperPersonCandidate["terms"][number], context: ScraperPersonResolutionContext) {
  if (!chamberMatches(term.chamber, context.chamber)) return false
  const start = term.startDate ?? "0000-01-01"
  const end = term.endDate ?? "9999-12-31"
  if (isIsoDate(context.observedDate)) {
    return start <= context.observedDate && end >= context.observedDate
  }
  if (!isIsoDate(context.sessionStartDate) || !isIsoDate(context.sessionEndDate)) return false
  return start <= context.sessionEndDate && end >= context.sessionStartDate
}

/** Pre-index source-backed names once so bulk vote and sponsorship resolution is linear in relationship count. */
export function createScraperPersonResolver(candidates: readonly ScraperPersonCandidate[]) {
  const candidatesByName = new Map<string, ScraperPersonCandidate[]>()
  for (const candidate of candidates) {
    const terminalFamilyName = terminalFamilyNameToken(candidate.familyName)
    const publishedNames = [...(candidate.familyNameAliases ?? []), ...candidate.names]
    const names = new Set([
      ...(candidate.familyName === null ? [] : [normalizedName(candidate.familyName)]),
      ...(terminalFamilyName === undefined ? [] : [normalizedName(terminalFamilyName)]),
      ...publishedNames.map(normalizedName),
      ...publishedNames.map(compactPublishedName).filter((value): value is string => value !== undefined)
    ])
    names.delete("")
    for (const name of names) {
      const matching = candidatesByName.get(name) ?? []
      matching.push(candidate)
      candidatesByName.set(name, matching)
    }
  }
  return (context: ScraperPersonResolutionContext): ScraperPersonResolution => {
    const namedCandidates = candidatesByName.get(normalizedName(context.name)) ?? []
    const matches = namedCandidates.filter((candidate) => candidate.terms.some((term) => termMatches(term, context)))
    if (matches.length > 1) return { status: "ambiguous" }
    let match = matches[0]
    if (
      match === undefined &&
      context.allowChamberHistoryFallback === true &&
      isIsoDate(context.observedDate) &&
      (!isIsoDate(context.sessionStartDate) || context.observedDate >= context.sessionStartDate) &&
      (!isIsoDate(context.sessionEndDate) || context.observedDate <= context.sessionEndDate)
    ) {
      const chamberHistoryMatches = namedCandidates.filter((candidate) =>
        candidate.terms.some((term) => chamberMatches(term.chamber, context.chamber))
      )
      if (chamberHistoryMatches.length > 1) return { status: "ambiguous" }
      if (chamberHistoryMatches.length === 0 && namedCandidates.length > 1) return { status: "ambiguous" }
      match =
        chamberHistoryMatches[0] ??
        (namedCandidates.length === 1 && namedCandidates[0]!.terms.length === 0 ? namedCandidates[0] : undefined)
    }
    if (match === undefined) return { status: "not_found" }
    return { status: "resolved", personId: match.personId, sourcePersonId: match.sourcePersonId }
  }
}

/** Resolve only a unique source-backed identity within the same chamber and source-supported tenure. */
export function resolveScraperPersonReference(
  context: ScraperPersonResolutionContext,
  candidates: readonly ScraperPersonCandidate[]
): ScraperPersonResolution {
  return createScraperPersonResolver(candidates)(context)
}

function dateValue(value: unknown) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10)
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10)
  return undefined
}

function chamberValue(value: unknown): Chamber | undefined {
  return value === "legislature" || value === "lower" || value === "upper" || value === "unicameral" ? value : undefined
}

export async function loadScraperPersonCandidates(database: LegislationDatabase, jurisdictionId: string) {
  const personRows = await database
    .select({
      familyName: people.familyName,
      id: people.id,
      name: people.name,
      sourceId: people.sourceId
    })
    .from(people)
    .where(eq(people.jurisdictionId, jurisdictionId))
  const termRows = await database
    .select({
      chamber: legislativeTerms.chamber,
      endDate: legislativeTerms.endDate,
      personId: legislativeTerms.personId,
      startDate: legislativeTerms.startDate
    })
    .from(legislativeTerms)
    .where(eq(legislativeTerms.jurisdictionId, jurisdictionId))
  const eligiblePeople = personRows.filter(
    (person): person is typeof person & { sourceId: string } =>
      typeof person.sourceId === "string" && person.sourceId.startsWith("ocd-person/")
  )
  if (eligiblePeople.length === 0) return []
  const aliasRows = await database
    .select({ name: personAliases.name, personId: personAliases.personId })
    .from(personAliases)
    .where(
      inArray(
        personAliases.personId,
        eligiblePeople.map((person) => person.id)
      )
    )
  const aliasesByPerson = new Map<string, string[]>()
  for (const alias of aliasRows) {
    const names = aliasesByPerson.get(alias.personId) ?? []
    names.push(alias.name)
    aliasesByPerson.set(alias.personId, names)
  }
  const termsByPerson = new Map<string, ScraperPersonCandidate["terms"][number][]>()
  for (const term of termRows) {
    const terms = termsByPerson.get(term.personId) ?? []
    terms.push({ chamber: term.chamber, endDate: term.endDate, startDate: term.startDate })
    termsByPerson.set(term.personId, terms)
  }
  return eligiblePeople.map((person): ScraperPersonCandidate => {
    const aliases = aliasesByPerson.get(person.id) ?? []
    return {
      familyName: person.familyName,
      familyNameAliases: aliases
        .map(familyNameFromPublishedAlias)
        .filter((value): value is string => value !== undefined),
      names: [person.name, ...aliases],
      personId: person.id,
      sourcePersonId: person.sourceId,
      terms: termsByPerson.get(person.id) ?? []
    }
  })
}

/** Enrich name-only scraper relationships without creating people or changing source observation identities. */
export async function resolveScraperAggregatePeople(
  database: LegislationDatabase,
  aggregates: readonly CanonicalBillAggregate[]
) {
  const catalogs = new Map<string, Awaited<ReturnType<typeof loadScraperPersonCandidates>>>()
  const resolvers = new Map<string, ReturnType<typeof createScraperPersonResolver>>()
  const resolved = []
  for (const aggregate of aggregates) {
    const jurisdictionId = aggregate.bill.jurisdictionId
    let candidates = catalogs.get(jurisdictionId)
    if (candidates === undefined) {
      candidates = await loadScraperPersonCandidates(database, jurisdictionId)
      catalogs.set(jurisdictionId, candidates)
      resolvers.set(jurisdictionId, createScraperPersonResolver(candidates))
    }
    const resolvePerson = resolvers.get(jurisdictionId)!
    const chamber = chamberValue(aggregate.bill.chamber)
    const sessionStartDate = dateValue(aggregate.session.startDate)
    const sessionEndDate = dateValue(aggregate.session.endDate)
    if (chamber === undefined) {
      resolved.push(aggregate)
      continue
    }
    const context = { allowChamberHistoryFallback: true, chamber, sessionEndDate, sessionStartDate }
    const billDate =
      dateValue(aggregate.bill.introducedAt) ??
      aggregate.actions
        ?.map((action) => dateValue(action.actionDate ?? action.actionAt))
        .filter((value): value is string => value !== undefined)
        .sort()[0]
    resolved.push({
      ...aggregate,
      sponsors: aggregate.sponsors?.map((sponsor) => {
        if (sponsor.personId !== undefined && sponsor.personId !== null) return sponsor
        const match = resolvePerson({ ...context, name: sponsor.name, observedDate: billDate })
        return match.status === "resolved" ? { ...sponsor, personId: match.personId } : sponsor
      }),
      votes: aggregate.votes?.map((vote) => ({
        ...vote,
        positions: vote.positions?.map((position) => {
          if (position.personId !== undefined && position.personId !== null) return position
          const sourceName = position.sourceName
          if (typeof sourceName !== "string") return position
          const voteChamber = chamberValue(vote.vote.chamber)
          if (voteChamber === undefined) return position
          const match = resolvePerson({
            ...context,
            chamber: voteChamber,
            name: sourceName,
            observedDate: dateValue(vote.vote.heldDate ?? vote.vote.heldAt)
          })
          return match.status === "resolved" ? { ...position, personId: match.personId } : position
        })
      }))
    })
  }
  return resolved
}
