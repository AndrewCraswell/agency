import type { LegislationDatabase } from "@repo/legislation-core/database/database"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import { listMeetings } from "../../legislation/persistence/queries/meeting-read"
import { listOrganizations } from "../../legislation/persistence/queries/organization-relationships"
import { listPeople } from "../../legislation/persistence/queries/people-read"
import type { AmendmentSearchApi } from "./amendment-search"
import { projectAmendmentSearchHits } from "./canonical-amendment-search"
import { projectSupportingMaterialSearchHits } from "./canonical-material-search"
import { projectBillSearchHits } from "./canonical-search"
import type { CivicSearchApi } from "./civic-search"
import { projectMeetingRead } from "./meeting-read-projection"
import { projectOrganizationRow } from "./organization-summary-read-projection"
import { projectPassageSearchHit } from "./passage-search"
import { projectPersonRead } from "./people-read-routes"
import { searchExecution } from "./search-execution"
import {
  type UniversalProductPage,
  type UniversalProductSearchInput,
  type UniversalSearchApi,
  type UniversalSearchCandidate
} from "./universal-search"

type SearchServices = CivicSearchApi & AmendmentSearchApi

/**
 * Adapts the already canonical product-search/read boundaries to the universal
 * merger. Product adapters preserve the documented multi-value filters rather
 * than narrowing them and returning a plausible but wrong result.
 */
export function createProductionUniversalSearchApi(
  service: SearchServices,
  database: LegislationDatabase | undefined,
  apiBaseUrl: string
): UniversalSearchApi {
  return { search: async (input) => await searchProduct(service, database, apiBaseUrl, input) }
}

async function searchProduct(
  service: SearchServices,
  database: LegislationDatabase | undefined,
  apiBaseUrl: string,
  input: UniversalProductSearchInput
): Promise<UniversalProductPage> {
  switch (input.recordType) {
    case "bill":
      return await searchBills(service, apiBaseUrl, input)
    case "amendment":
      return await searchAmendments(service, apiBaseUrl, input)
    case "passage":
      return await searchPassages(service, apiBaseUrl, input)
    case "supporting-material":
      return await searchMaterials(service, apiBaseUrl, input)
    case "person":
      return await searchPeople(database, apiBaseUrl, input)
    case "organization":
      return await searchOrganizations(database, apiBaseUrl, input)
    case "meeting":
      return await searchMeetings(database, apiBaseUrl, input)
  }
}

async function searchBills(service: SearchServices, apiBaseUrl: string, input: UniversalProductSearchInput) {
  const filters = input.filters ?? {}
  const page = await service.searchBills({
    classifications: strings(filters, "classifications"),
    introducedFrom: string(filters, "introducedFrom"),
    introducedTo: string(filters, "introducedTo"),
    jurisdictionIds: strings(input.shared, "jurisdictionIds"),
    limit: input.perTypeLimit,
    mode: input.mode,
    query: input.query,
    sessionIds: strings(input.shared, "sessionIds"),
    sponsorIds: strings(filters, "sponsorIds"),
    statuses: strings(filters, "statuses"),
    subjects: strings(filters, "subjects"),
    ...updatedRange(nullableString(input.shared, "from"), nullableString(input.shared, "to"))
  })
  return {
    items: projectBillSearchHits(page.items, input.mode, apiBaseUrl).map(candidateFromHit),
    models: searchExecution(page.search, input.mode, "bill").models,
    truncated: page.truncated
  }
}

async function searchAmendments(service: SearchServices, apiBaseUrl: string, input: UniversalProductSearchInput) {
  const filters = input.filters ?? {}
  const page = await service.searchAmendmentHits({
    billIds: strings(filters, "billIds"),
    jurisdictionIds: strings(input.shared, "jurisdictionIds"),
    limit: input.perTypeLimit,
    mode: input.mode,
    query: input.query,
    recordTypes: strings(filters, "recordTypes")?.filter(isAmendmentRecordType),
    sessionIds: strings(input.shared, "sessionIds"),
    sponsorPersonIds: strings(filters, "sponsorPersonIds"),
    statuses: strings(filters, "statuses"),
    submittedFrom: string(filters, "submittedFrom"),
    submittedTo: string(filters, "submittedTo"),
    ...updatedRange(nullableString(input.shared, "from"), nullableString(input.shared, "to"))
  })
  return {
    items: projectAmendmentSearchHits(page.items, input.mode, apiBaseUrl).map(candidateFromHit),
    models: searchExecution(page.search, input.mode, "amendment").models,
    truncated: page.truncated
  }
}

async function searchPassages(service: SearchServices, apiBaseUrl: string, input: UniversalProductSearchInput) {
  const filters = input.filters ?? {}
  const page = await service.searchBillText({
    billIds: strings(filters, "billIds"),
    documentClassifications: strings(filters, "documentClassifications"),
    documentIds: strings(filters, "documentIds"),
    headings: strings(filters, "headings"),
    jurisdictionIds: strings(input.shared, "jurisdictionIds"),
    limit: input.perTypeLimit,
    mode: input.mode,
    pageFrom: number(filters, "pageFrom"),
    pageTo: number(filters, "pageTo"),
    query: input.query,
    sessionIds: strings(input.shared, "sessionIds"),
    versionCodes: strings(filters, "versionCodes"),
    ...updatedRange(nullableString(input.shared, "from"), nullableString(input.shared, "to"))
  })
  return {
    items: page.items.map((item, index) =>
      candidateFromHit(projectPassageSearchHit(item, index + 1, apiBaseUrl, input.mode, input.query, false))
    ),
    models: searchExecution(page.search, input.mode, "passage").models,
    truncated: page.truncated
  }
}

async function searchMaterials(service: SearchServices, apiBaseUrl: string, input: UniversalProductSearchInput) {
  const filters = input.filters ?? {}
  const page = await service.searchSupportingMaterialHits({
    amendmentIds: strings(filters, "amendmentIds"),
    billIds: strings(filters, "billIds"),
    classifications: strings(filters, "classifications"),
    documentFrom: string(filters, "documentFrom"),
    documentTo: string(filters, "documentTo"),
    eventIds: strings(filters, "meetingIds"),
    jurisdictionIds: strings(input.shared, "jurisdictionIds"),
    limit: input.perTypeLimit,
    mode: input.mode,
    organizationIds: strings(filters, "organizationIds"),
    query: input.query,
    sessionIds: strings(input.shared, "sessionIds"),
    ...updatedRange(nullableString(input.shared, "from"), nullableString(input.shared, "to"))
  })
  return {
    items: projectSupportingMaterialSearchHits(page.items, input.mode, apiBaseUrl).map(candidateFromHit),
    models: searchExecution(page.search, input.mode, "supporting-material").models,
    truncated: page.truncated
  }
}

async function searchPeople(
  database: LegislationDatabase | undefined,
  apiBaseUrl: string,
  input: UniversalProductSearchInput
): Promise<UniversalProductPage> {
  const filters = input.filters ?? {}
  requireDatabase(database, "person")
  rejectSharedSession(input, "person")
  const jurisdictionIds = intersect(strings(input.shared, "jurisdictionIds"), strings(filters, "jurisdictionIds"))
  const organizationIds = strings(filters, "organizationIds")
  const parties = strings(filters, "parties")
  if (jurisdictionIds?.length === 0) {
    return lexicalReadPage([], false)
  }
  const page = await listPeople(database, {
    isActive: boolean(filters, "isActive"),
    jurisdictionIds,
    limit: input.perTypeLimit,
    organizationIds,
    parties,
    q: input.query,
    ...updatedRange(nullableString(input.shared, "from"), nullableString(input.shared, "to"))
  })
  return lexicalReadPage(
    page.items.map((item) => projectPersonRead(item, apiBaseUrl)),
    page.truncated
  )
}

async function searchOrganizations(
  database: LegislationDatabase | undefined,
  apiBaseUrl: string,
  input: UniversalProductSearchInput
): Promise<UniversalProductPage> {
  const filters = input.filters ?? {}
  requireDatabase(database, "organization")
  rejectSharedSession(input, "organization")
  const jurisdictionIds = intersect(strings(input.shared, "jurisdictionIds"), strings(filters, "jurisdictionIds"))
  if (jurisdictionIds?.length === 0) {
    return lexicalReadPage([], false)
  }
  const page = await listOrganizations(database, {
    classifications: strings(filters, "classifications"),
    isActive: boolean(filters, "isActive"),
    jurisdictionIds,
    limit: input.perTypeLimit,
    parentOrganizationIds: strings(filters, "parentOrganizationIds"),
    query: input.query,
    ...updatedRange(nullableString(input.shared, "from"), nullableString(input.shared, "to"))
  })
  return lexicalReadPage(
    page.items.map((item) => projectOrganizationRow(item, apiBaseUrl)),
    page.truncated
  )
}

async function searchMeetings(
  database: LegislationDatabase | undefined,
  apiBaseUrl: string,
  input: UniversalProductSearchInput
): Promise<UniversalProductPage> {
  const filters = input.filters ?? {}
  requireDatabase(database, "meeting")
  const jurisdictionIds = intersect(strings(input.shared, "jurisdictionIds"), strings(filters, "jurisdictionIds"))
  if (jurisdictionIds?.length === 0) {
    return lexicalReadPage([], false)
  }
  const page = await listMeetings(database, {
    classifications: meetingClassifications(strings(filters, "classifications")),
    from: string(filters, "from") ?? nullableString(input.shared, "from") ?? undefined,
    jurisdictionIds,
    limit: input.perTypeLimit,
    organizationIds: strings(filters, "organizationIds"),
    query: input.query,
    sessionIds: strings(input.shared, "sessionIds"),
    statuses: meetingStatuses(strings(filters, "statuses")),
    to: string(filters, "to") ?? nullableString(input.shared, "to") ?? undefined
  })
  return lexicalReadPage(
    page.items.map((item) => projectMeetingRead(item, apiBaseUrl)),
    page.truncated
  )
}

function lexicalReadPage(
  records: readonly { id: string; sources: readonly unknown[]; type: "meeting" | "organization" | "person" }[],
  truncated: boolean
): UniversalProductPage {
  return {
    items: records.map((record) => ({
      lexicalScore: 1,
      matchedFields: ["name"],
      record,
      recordId: record.id,
      recordType: recordType(record),
      rerankScore: null,
      semanticScore: null,
      snippet: null,
      sources: record.sources
    })),
    models: [],
    truncated
  }
}

function recordType(record: { type: "meeting" | "organization" | "person" }): "meeting" | "organization" | "person" {
  if (record.type === "person" || record.type === "organization" || record.type === "meeting") {
    return record.type
  }
  throw new LegislationError("unprocessable", "lexical search record is not canonical")
}

function candidateFromHit(hit: {
  match: {
    lexicalScore: number | null
    matchedFields: readonly string[]
    rerankScore: number | null
    semanticScore: number | null
    snippet: string | null
  }
  record: unknown
  recordId: string
  recordType: "amendment" | "bill" | "passage" | "supporting-material"
  sources: readonly unknown[]
}): UniversalSearchCandidate {
  return { ...hit.match, record: hit.record, recordId: hit.recordId, recordType: hit.recordType, sources: hit.sources }
}

function updatedRange(from: string | null, to: string | null) {
  if (from === null && to === null) {
    return {}
  }
  const dateOnly = (from ?? to ?? "").length === 10
  const updatedFrom = from === null ? undefined : new Date(dateOnly ? `${from}T00:00:00.000Z` : from)
  if (to === null) {
    return { updatedFrom }
  }
  if (!dateOnly) {
    return { updatedFrom, updatedTo: new Date(to) }
  }
  const updatedToExclusive = new Date(`${to}T00:00:00.000Z`)
  updatedToExclusive.setUTCDate(updatedToExclusive.getUTCDate() + 1)
  return { updatedFrom, updatedToExclusive }
}

function strings(value: Record<string, unknown>, name: string): string[] | undefined {
  const candidate = value[name]
  return Array.isArray(candidate) && candidate.every((item): item is string => typeof item === "string")
    ? [...candidate]
    : undefined
}

function string(value: Record<string, unknown>, name: string): string | undefined {
  return typeof value[name] === "string" ? value[name] : undefined
}

function nullableString(value: Record<string, unknown>, name: string): string | null {
  const candidate = value[name]
  return typeof candidate === "string" ? candidate : null
}

function number(value: Record<string, unknown>, name: string): number | undefined {
  return typeof value[name] === "number" ? value[name] : undefined
}

function boolean(value: Record<string, unknown>, name: string): boolean | undefined {
  return typeof value[name] === "boolean" ? value[name] : undefined
}

function intersect(
  shared: readonly string[] | undefined,
  product: readonly string[] | undefined
): string[] | undefined {
  if (shared === undefined) {
    return product === undefined ? undefined : [...product]
  }
  if (product === undefined) {
    return [...shared]
  }
  const productIds = new Set(product)
  return shared.filter((value) => productIds.has(value))
}

function requireDatabase(
  database: LegislationDatabase | undefined,
  type: string
): asserts database is LegislationDatabase {
  if (database === undefined) {
    throw new LegislationError(
      "dependency_unavailable",
      `${type} universal search requires the canonical read database`
    )
  }
}

function rejectSharedSession(input: UniversalProductSearchInput, type: string): void {
  if (strings(input.shared, "sessionIds") !== undefined) {
    throw new LegislationError("unprocessable", `${type} universal search does not support sessionIds`)
  }
}

function isAmendmentRecordType(value: string): value is "document" | "structured" {
  return value === "document" || value === "structured"
}

function meetingClassifications(
  values: readonly string[] | undefined
): readonly ("hearing" | "meeting" | "other" | "session")[] | undefined {
  if (values === undefined) {
    return undefined
  }
  if (
    values.every(
      (value): value is "hearing" | "meeting" | "other" | "session" =>
        value === "hearing" || value === "meeting" || value === "other" || value === "session"
    )
  ) {
    return values
  }
  throw new LegislationError("unprocessable", "meeting.classifications is not supported")
}

function meetingStatuses(
  values: readonly string[] | undefined
): readonly ("cancelled" | "completed" | "other" | "postponed" | "scheduled")[] | undefined {
  if (values === undefined) {
    return undefined
  }
  if (
    values.every(
      (value): value is "cancelled" | "completed" | "other" | "postponed" | "scheduled" =>
        value === "cancelled" ||
        value === "completed" ||
        value === "other" ||
        value === "postponed" ||
        value === "scheduled"
    )
  ) {
    return values
  }
  throw new LegislationError("unprocessable", "meeting.statuses is not supported")
}
