import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import { legislativeTerms, people, personAliases } from "@repo/legislation-core/database/schema/schema"
import type { CanonicalBillAggregate } from "@repo/legislation-core/domain/model"
import { eq, inArray } from "drizzle-orm"

type Chamber = "lower" | "upper" | "unicameral"

export interface ScraperPersonCandidate {
  familyName: string | null
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

function isIsoDate(value: string | undefined): value is string {
  return value !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function termMatches(term: ScraperPersonCandidate["terms"][number], context: ScraperPersonResolutionContext) {
  if (term.chamber !== context.chamber) return false
  const start = term.startDate ?? "0000-01-01"
  const end = term.endDate ?? "9999-12-31"
  if (isIsoDate(context.observedDate)) {
    return start <= context.observedDate && end >= context.observedDate
  }
  if (!isIsoDate(context.sessionStartDate) || !isIsoDate(context.sessionEndDate)) return false
  return start <= context.sessionEndDate && end >= context.sessionStartDate
}

function nameMatches(candidate: ScraperPersonCandidate, sourceName: string) {
  const source = normalizedName(sourceName)
  if (source === "") return false
  return (
    (candidate.familyName !== null && normalizedName(candidate.familyName) === source) ||
    candidate.names.some((name) => normalizedName(name) === source)
  )
}

/** Resolve only a unique source-backed identity within the same chamber and source-supported tenure. */
export function resolveScraperPersonReference(
  context: ScraperPersonResolutionContext,
  candidates: readonly ScraperPersonCandidate[]
): ScraperPersonResolution {
  const matches = candidates.filter(
    (candidate) => nameMatches(candidate, context.name) && candidate.terms.some((term) => termMatches(term, context))
  )
  if (matches.length === 0) return { status: "not_found" }
  if (matches.length !== 1) return { status: "ambiguous" }
  const match = matches[0]!
  return { status: "resolved", personId: match.personId, sourcePersonId: match.sourcePersonId }
}

function dateValue(value: unknown) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10)
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10)
  return undefined
}

function chamberValue(value: unknown): Chamber | undefined {
  return value === "lower" || value === "upper" || value === "unicameral" ? value : undefined
}

export async function loadScraperPersonCandidates(database: LegislationDatabase, jurisdictionId: string) {
  const [personRows, termRows] = await Promise.all([
    database
      .select({
        familyName: people.familyName,
        id: people.id,
        name: people.name,
        sourceId: people.sourceId
      })
      .from(people)
      .where(eq(people.jurisdictionId, jurisdictionId)),
    database
      .select({
        chamber: legislativeTerms.chamber,
        endDate: legislativeTerms.endDate,
        personId: legislativeTerms.personId,
        startDate: legislativeTerms.startDate
      })
      .from(legislativeTerms)
      .where(eq(legislativeTerms.jurisdictionId, jurisdictionId))
  ])
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
  return eligiblePeople.map(
    (person): ScraperPersonCandidate => ({
      familyName: person.familyName,
      names: [person.name, ...(aliasesByPerson.get(person.id) ?? [])],
      personId: person.id,
      sourcePersonId: person.sourceId,
      terms: termsByPerson.get(person.id) ?? []
    })
  )
}

/** Enrich name-only scraper relationships without creating people or changing source observation identities. */
export async function resolveScraperAggregatePeople(
  database: LegislationDatabase,
  aggregates: readonly CanonicalBillAggregate[]
) {
  const catalogs = new Map<string, Awaited<ReturnType<typeof loadScraperPersonCandidates>>>()
  const resolved = []
  for (const aggregate of aggregates) {
    const jurisdictionId = aggregate.bill.jurisdictionId
    let candidates = catalogs.get(jurisdictionId)
    if (candidates === undefined) {
      candidates = await loadScraperPersonCandidates(database, jurisdictionId)
      catalogs.set(jurisdictionId, candidates)
    }
    const chamber = chamberValue(aggregate.bill.chamber)
    const sessionStartDate = dateValue(aggregate.session.startDate)
    const sessionEndDate = dateValue(aggregate.session.endDate)
    if (chamber === undefined) {
      resolved.push(aggregate)
      continue
    }
    const context = { chamber, sessionEndDate, sessionStartDate }
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
        const match = resolveScraperPersonReference(
          { ...context, name: sponsor.name, observedDate: billDate },
          candidates
        )
        return match.status === "resolved" ? { ...sponsor, personId: match.personId } : sponsor
      }),
      votes: aggregate.votes?.map((vote) => ({
        ...vote,
        positions: vote.positions?.map((position) => {
          if (position.personId !== undefined && position.personId !== null) return position
          const sourceName = position.sourceName
          if (typeof sourceName !== "string") return position
          const match = resolveScraperPersonReference(
            { ...context, name: sourceName, observedDate: dateValue(vote.vote.heldDate ?? vote.vote.heldAt) },
            candidates
          )
          return match.status === "resolved" ? { ...position, personId: match.personId } : position
        })
      }))
    })
  }
  return resolved
}
