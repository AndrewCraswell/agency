import type { LegislationDatabase } from "../db/database.js"
import { listMeetings } from "../db/queries/meeting-read.js"
import { listOrganizations } from "../db/queries/organization-relationships.js"
import { listPeople } from "../db/queries/people-read.js"
import { LegislationError } from "../legislation/errors.js"
import type { AmendmentSearchApi } from "./amendment-search.js"
import { projectAmendmentSearchHits } from "./canonical-amendment-search.js"
import { projectSupportingMaterialSearchHits } from "./canonical-material-search.js"
import { projectBillSearchHits } from "./canonical-search.js"
import type { CivicSearchApi } from "./civic-search.js"
import { projectMeetingRead } from "./meeting-read-projection.js"
import { projectOrganizationRow } from "./organization-summary-read-projection.js"
import { projectPassageSearchHit } from "./passage-search.js"
import { projectPersonRead } from "./people-read-routes.js"
import {
  type UniversalProductPage,
  type UniversalProductSearchInput,
  type UniversalSearchApi,
  type UniversalSearchCandidate,
  type SearchModel
} from "./universal-search.js"

type SearchServices = CivicSearchApi & AmendmentSearchApi

/**
 * Adapts the already canonical product-search/read boundaries to the universal
 * merger. It deliberately rejects a selected product's unsupported multi-value
 * filter rather than narrowing it and returning a plausible but wrong result.
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
    models: searchModels(page.search?.models ?? []),
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
    models: searchModels(page.search.models),
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
    models: searchModels(page.search.models),
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
    models: searchModels(page.search.models),
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
  const jurisdictionIds = single(
    combine(strings(input.shared, "jurisdictionIds"), strings(filters, "jurisdictionIds")),
    "person.jurisdictionIds"
  )
  const organizationIds = single(strings(filters, "organizationIds"), "person.organizationIds")
  const parties = single(strings(filters, "parties"), "person.parties")
  const page = await listPeople(database, {
    isActive: boolean(filters, "isActive"),
    jurisdictionId: jurisdictionIds,
    limit: input.perTypeLimit,
    organizationId: organizationIds,
    party: parties,
    q: input.query
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
  const page = await listOrganizations(database, {
    classification: single(strings(filters, "classifications"), "organization.classifications"),
    isActive: boolean(filters, "isActive"),
    jurisdictionId: single(
      combine(strings(input.shared, "jurisdictionIds"), strings(filters, "jurisdictionIds")),
      "organization.jurisdictionIds"
    ),
    limit: input.perTypeLimit,
    parentOrganizationId: single(strings(filters, "parentOrganizationIds"), "organization.parentOrganizationIds"),
    query: input.query
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
  const page = await listMeetings(database, {
    classification: meetingClassification(single(strings(filters, "classifications"), "meeting.classifications")),
    from: string(filters, "from") ?? nullableString(input.shared, "from") ?? undefined,
    jurisdictionId: single(
      combine(strings(input.shared, "jurisdictionIds"), strings(filters, "jurisdictionIds")),
      "meeting.jurisdictionIds"
    ),
    limit: input.perTypeLimit,
    organizationId: single(strings(filters, "organizationIds"), "meeting.organizationIds"),
    query: input.query,
    sessionId: single(strings(input.shared, "sessionIds"), "meeting.sessionIds"),
    status: meetingStatus(single(strings(filters, "statuses"), "meeting.statuses")),
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

function searchModels(models: readonly unknown[]): SearchModel[] {
  return models.map((model) => {
    if (!isSearchModel(model)) {
      throw new LegislationError("unprocessable", "search model metadata is not configured")
    }
    if (model.model === "voyageai/voyage-4" && model.purpose === "embedding") {
      return { dimensions: 1_024, model: "voyageai/voyage-4", provider: "voyageai", purpose: "embedding" }
    }
    if (model.model === "openai/text-embedding-3-small" && model.purpose === "embedding") {
      return { dimensions: 1_536, model: "openai/text-embedding-3-small", provider: "openai", purpose: "embedding" }
    }
    if (model.model === "cohere/rerank-v3.5" && model.purpose === "reranking") {
      return { dimensions: null, model: "cohere/rerank-v3.5", provider: "cohere", purpose: "reranking" }
    }
    throw new LegislationError("unprocessable", "search model metadata is not configured")
  })
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

function single(values: readonly string[] | undefined, name: string): string | undefined {
  if (values === undefined) {
    return undefined
  }
  if (values.length !== 1) {
    throw new LegislationError("unprocessable", `${name} currently accepts one value in universal lexical search`)
  }
  return values[0]
}

function combine(...values: readonly (readonly string[] | undefined)[]): string[] | undefined {
  const combined = values.flatMap((value) => value ?? [])
  return combined.length === 0 ? undefined : [...new Set(combined)]
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

function meetingClassification(value: string | undefined): "hearing" | "meeting" | "other" | "session" | undefined {
  if (value === undefined || value === "hearing" || value === "meeting" || value === "other" || value === "session") {
    return value
  }
  throw new LegislationError("unprocessable", "meeting.classifications is not supported")
}

function meetingStatus(
  value: string | undefined
): "cancelled" | "completed" | "other" | "postponed" | "scheduled" | undefined {
  if (
    value === undefined ||
    value === "cancelled" ||
    value === "completed" ||
    value === "other" ||
    value === "postponed" ||
    value === "scheduled"
  ) {
    return value
  }
  throw new LegislationError("unprocessable", "meeting.statuses is not supported")
}

function isSearchModel(value: unknown): value is { model: string; purpose: "embedding" | "reranking" } {
  return (
    typeof value === "object" &&
    value !== null &&
    (Reflect.get(value, "purpose") === "embedding" || Reflect.get(value, "purpose") === "reranking") &&
    typeof Reflect.get(value, "model") === "string"
  )
}
