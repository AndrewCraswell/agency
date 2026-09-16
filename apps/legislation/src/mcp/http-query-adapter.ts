import { z } from "zod"
import {
  LegislationApiAbortError,
  LegislationApiClient,
  LegislationApiError,
  LegislationApiProtocolError,
  LegislationApiTimeoutError,
  type ApiRequestBody,
  type FetchLike,
  type PageResponse,
  type Query,
  type QueryValue,
  type ResourceResponse,
  type SearchPageResponse
} from "../api-client/client.js"
import { getRequestContext } from "../auth/request-context.js"
import { LegislationError } from "../legislation/errors.js"
import type { LegislationQueryApi } from "./tools.js"

export type ApiAccessTokenProvider = () => Promise<string | undefined> | string | undefined

export type McpHttpQueryAdapterOptions = Readonly<{
  apiBaseUrl: string
  fetch?: FetchLike
  getApiAccessToken: ApiAccessTokenProvider
  timeoutMs?: number
  legalText?: Readonly<{ allowedOrganizationIds: readonly string[]; getApiAccessToken: ApiAccessTokenProvider }>
}>

/**
 * Adapts MCP query tools to the public HTTP API. The supplied token provider
 * must mint credentials for the API resource audience. It is deliberately
 * separate from the MCP request bearer token, which is only used to authorize
 * the incoming MCP request.
 */
export function createMcpHttpQueryAdapter(options: McpHttpQueryAdapterOptions): LegislationQueryApi {
  const legalText = options.legalText
  const allowed = new Set(
    z
      .array(z.string().min(1).max(256))
      .max(1000)
      .parse(legalText?.allowedOrganizationIds ?? [])
  )
  const canReadLegalText = () => {
    const identity = getRequestContext()?.identity
    return !!identity?.userId && !!identity.organizationId && allowed.has(identity.organizationId)
  }
  const api = new LegislationApiClient({
    baseUrl: options.apiBaseUrl,
    bearerToken: options.getApiAccessToken,
    ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
    ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs })
  })
  async function legalRequestOptions() {
    if (!canReadLegalText()) {
      throw new LegislationError("forbidden", "Access denied")
    }
    const bearerToken = await legalText?.getApiAccessToken()
    if (!bearerToken) {
      throw new LegislationError("forbidden", "Access denied")
    }
    return { ...requestOptions(), bearerToken }
  }

  return withApiErrors({
    ...(legalText === undefined
      ? {}
      : {
          canReadLegalText,
          searchLegal: async (input) => api.searchLegal(input, await legalRequestOptions()),
          listLegalEditions: async ({ codeId, ...input }) =>
            api.listLegalEditions(codeId, input, await legalRequestOptions()),
          listLegalProvisions: async ({ codeId, ...input }) =>
            api.listLegalProvisions(codeId, input, await legalRequestOptions()),
          listLegalCodes: async (input) => {
            if (!canReadLegalText()) {
              throw new LegislationError("forbidden", "Access denied")
            }
            const bearerToken = await legalText.getApiAccessToken()
            if (!bearerToken) {
              throw new LegislationError("forbidden", "Access denied")
            }
            return api.listLegalCodes(input, { ...requestOptions(), bearerToken })
          },
          getLegalText: async ({ versionId, ...input }) => {
            if (!canReadLegalText()) {
              throw new LegislationError("forbidden", "Access denied")
            }
            const bearerToken = await legalText.getApiAccessToken()
            if (!bearerToken) {
              throw new LegislationError("forbidden", "Access denied")
            }
            return api.getLegalText(versionId, input, { ...requestOptions(), bearerToken })
          }
        }),
    compareBillVersions: async ({ billId, documentIds }) => {
      const [leftDocumentId, rightDocumentId] = documentIds
      if (leftDocumentId === undefined || rightDocumentId === undefined) {
        throw new LegislationError("invalid_request", "Exactly two document IDs are required")
      }
      return resourceData(await api.compareBillVersions(billId, leftDocumentId, rightDocumentId, requestOptions()))
    },
    findRelatedBills: async ({ id, ...input }) =>
      pageData(await api.getRelatedBills(id, query(input), requestOptions())),
    getAmendment: async ({ id }) => resourceData(await api.getAmendment(id, requestOptions())),
    getBill: async ({ id, ...input }) => resourceData(await api.getBill(id, query(input), requestOptions())),
    getBillVotes: async ({ billId, ...input }) =>
      pageData(await api.getBillVotes(billId, query(input), requestOptions())),
    getBillText: async ({ id, ...input }) => {
      const page = await api.getBillText(id, query(input), requestOptions())
      return { billId: id, ...pageData(page), sections: page.data }
    },
    getBillTimeline: async ({ id, ...input }) => {
      const page = await api.getBillTimeline(id, query(input), requestOptions())
      return {
        billId: id,
        events: page.data,
        nextChildCursor: page.meta.nextCursor,
        truncated: page.meta.truncated,
        warnings: page.meta.warnings
      }
    },
    getEvent: async ({ id }) => resourceData(await api.getMeeting(id, requestOptions())),
    getOrganization: async ({ id }) => resourceData(await api.getOrganization(id, undefined, requestOptions())),
    getPerson: async ({ id }) => resourceData(await api.getPerson(id, undefined, requestOptions())),
    getSupportingMaterial: async ({ id }) =>
      resourceData(await api.getSupportingMaterial(id, undefined, requestOptions())),
    getVote: async ({ id }) => resourceData(await api.getVote(id, requestOptions())),
    searchAmendments: async (input) => {
      if (input.query === undefined) {
        if (input.mode !== undefined && input.mode !== "lexical") {
          throw new LegislationError("invalid_request", "A query is required for semantic or hybrid amendment search")
        }
        return pageData(await api.listAmendments(amendmentListQuery(input), requestOptions()))
      }
      return searchData(await api.searchAmendments(amendmentSearchBody(input), requestOptions()))
    },
    searchBills: async (input) => searchData(await api.searchBills(body(input), requestOptions())),
    searchBillText: async (input) => searchData(await api.searchBillText(passageSearchBody(input), requestOptions())),
    searchChanges: async (input) =>
      pageData(
        await api.listChanges(query(input, { billId: "recordId", changeType: "classification" }), requestOptions())
      ),
    searchEvents: async (input) => pageData(await api.listMeetings(query(input), requestOptions())),
    searchOrganizations: async (input) =>
      pageData(await api.listOrganizations(query(input, { query: "q" }), requestOptions())),
    searchPeople: async (input) => pageData(await api.listPeople(query(input, { query: "q" }), requestOptions())),
    searchSupportingMaterials: async (input) => {
      if (input.query === undefined) {
        if (input.mode !== undefined && input.mode !== "lexical") {
          throw new LegislationError(
            "invalid_request",
            "A query is required for semantic or hybrid supporting-material search"
          )
        }
        return pageData(await api.listSupportingMaterials(supportingMaterialListQuery(input), requestOptions()))
      }
      return searchData(await api.searchSupportingMaterials(supportingMaterialSearchBody(input), requestOptions()))
    },
    searchVotes: async (input) => pageData(await api.listVotes(query(input), requestOptions()))
  })
}

function withApiErrors(adapter: LegislationQueryApi): LegislationQueryApi {
  const getLegalText = adapter.getLegalText
  const searchLegal = adapter.searchLegal
  const listLegalCodes = adapter.listLegalCodes
  const listLegalEditions = adapter.listLegalEditions
  const listLegalProvisions = adapter.listLegalProvisions
  return {
    ...(searchLegal === undefined ? {} : { searchLegal: async (input) => await apiCall(() => searchLegal(input)) }),
    ...(listLegalEditions === undefined
      ? {}
      : { listLegalEditions: async (input) => await apiCall(() => listLegalEditions(input)) }),
    ...(listLegalProvisions === undefined
      ? {}
      : { listLegalProvisions: async (input) => await apiCall(() => listLegalProvisions(input)) }),
    ...(listLegalCodes === undefined
      ? {}
      : { listLegalCodes: async (input) => await apiCall(() => listLegalCodes(input)) }),
    ...(getLegalText === undefined
      ? {}
      : {
          canReadLegalText: adapter.canReadLegalText,
          getLegalText: async (input) => await apiCall(() => getLegalText(input))
        }),
    compareBillVersions: async (input) => await apiCall(() => adapter.compareBillVersions(input)),
    findRelatedBills: async (input) => await apiCall(() => adapter.findRelatedBills(input)),
    getAmendment: async (input) => await apiCall(() => adapter.getAmendment(input)),
    getBill: async (input) => await apiCall(() => adapter.getBill(input)),
    getBillVotes: async (input) => await apiCall(() => adapter.getBillVotes(input)),
    getBillText: async (input) => await apiCall(() => adapter.getBillText(input)),
    getBillTimeline: async (input) => await apiCall(() => adapter.getBillTimeline(input)),
    getEvent: async (input) => await apiCall(() => adapter.getEvent(input)),
    getOrganization: async (input) => await apiCall(() => adapter.getOrganization(input)),
    getPerson: async (input) => await apiCall(() => adapter.getPerson(input)),
    getSupportingMaterial: async (input) => await apiCall(() => adapter.getSupportingMaterial(input)),
    getVote: async (input) => await apiCall(() => adapter.getVote(input)),
    searchAmendments: async (input) => await apiCall(() => adapter.searchAmendments(input)),
    searchBills: async (input) => await apiCall(() => adapter.searchBills(input)),
    searchBillText: async (input) => await apiCall(() => adapter.searchBillText(input)),
    searchChanges: async (input) => await apiCall(() => adapter.searchChanges(input)),
    searchEvents: async (input) => await apiCall(() => adapter.searchEvents(input)),
    searchOrganizations: async (input) => await apiCall(() => adapter.searchOrganizations(input)),
    searchPeople: async (input) => await apiCall(() => adapter.searchPeople(input)),
    searchSupportingMaterials: async (input) => await apiCall(() => adapter.searchSupportingMaterials(input)),
    searchVotes: async (input) => await apiCall(() => adapter.searchVotes(input))
  }
}

async function apiCall<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    if (error instanceof LegislationError) {
      throw error
    }
    if (error instanceof LegislationApiError) {
      throw new LegislationError(error.category, error.message, {
        cause: error,
        details: {
          ...error.details,
          correlationId: error.correlationId,
          retryable: error.retryable,
          status: error.status
        }
      })
    }
    if (error instanceof LegislationApiTimeoutError || error instanceof LegislationApiAbortError) {
      throw new LegislationError("dependency_unavailable", error.message, {
        cause: error,
        details: { retryable: true }
      })
    }
    if (error instanceof LegislationApiProtocolError) {
      throw new LegislationError("dependency_unavailable", error.message, {
        cause: error,
        details: { retryable: false }
      })
    }
    throw error
  }
}

function requestOptions() {
  const correlationId = getRequestContext()?.correlationId
  return correlationId === undefined ? undefined : { correlationId }
}

function resourceData(response: ResourceResponse): unknown {
  return response.data
}

function pageData(response: PageResponse) {
  return {
    items: response.data,
    nextCursor: response.meta.nextCursor ?? undefined,
    truncated: response.meta.truncated,
    warnings: response.meta.warnings
  }
}

function searchData(response: SearchPageResponse) {
  return {
    ...pageData(response),
    search: { isReranked: response.meta.isReranked, mode: response.meta.mode, models: response.meta.models }
  }
}

function query(input: object, names: Readonly<Record<string, string>> = {}): Query {
  const result: Record<string, QueryValue> = {}
  for (const [name, value] of Object.entries(input)) {
    const queryValue = toQueryValue(value)
    if (queryValue !== undefined) {
      result[names[name] ?? name] = queryValue
    }
  }
  return result
}

function body(input: object, names: Readonly<Record<string, string>> = {}): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [name, value] of Object.entries(input)) {
    const jsonValue = toJsonValue(value)
    if (jsonValue !== undefined) {
      result[names[name] ?? name] = jsonValue
    }
  }
  return result
}

function amendmentListQuery(input: object): Query {
  return query(without(input, ["mode"]), { billId: "billId", sponsorPersonId: "sponsorPersonId" })
}

function amendmentSearchBody(input: object): ApiRequestBody {
  return bodyWithArrayFields(input, {
    billId: "billIds",
    jurisdictionId: "jurisdictionIds",
    sponsorPersonId: "sponsorPersonIds"
  })
}

function supportingMaterialListQuery(input: object): Query {
  return query(without(input, ["mode"]), { eventId: "meetingId" })
}

function supportingMaterialSearchBody(input: object): ApiRequestBody {
  return bodyWithArrayFields(input, {
    amendmentId: "amendmentIds",
    billId: "billIds",
    classification: "classifications",
    eventId: "meetingIds",
    jurisdictionId: "jurisdictionIds",
    organizationId: "organizationIds"
  })
}

function passageSearchBody(input: object): ApiRequestBody {
  const result = body(input, { billId: "billIds", classifications: "documentClassifications" })
  const billId = result.billIds
  if (billId !== undefined) {
    result.billIds = [billId]
  }
  return result
}

function bodyWithArrayFields(input: object, names: Readonly<Record<string, string>>): ApiRequestBody {
  const result = body(input, names)
  for (const target of Object.values(names)) {
    const value = result[target]
    if (value !== undefined) {
      result[target] = [value]
    }
  }
  return result
}

function without(input: object, omitted: readonly string[]): Record<string, unknown> {
  return Object.fromEntries(Object.entries(input).filter(([name]) => !omitted.includes(name)))
}

function toQueryValue(value: unknown): QueryValue {
  if (value === undefined || value === null) {
    return undefined
  }
  if (value instanceof Date) {
    return value.toISOString()
  }
  if (typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
    return value
  }
  if (Array.isArray(value) && value.every(isQueryScalar)) {
    return value
  }
  throw new TypeError("MCP query input contains a value that cannot be represented in an API query string")
}

function toJsonValue(value: unknown): unknown {
  if (value === undefined) {
    return undefined
  }
  if (value instanceof Date) {
    return value.toISOString()
  }
  if (Array.isArray(value)) {
    return value.map(toJsonValue)
  }
  return value
}

function isQueryScalar(value: unknown): value is boolean | number | string {
  return typeof value === "boolean" || typeof value === "number" || typeof value === "string"
}
