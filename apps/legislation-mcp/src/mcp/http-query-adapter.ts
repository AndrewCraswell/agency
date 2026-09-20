import {
  LegislationApiAbortError,
  LegislationApiClient,
  LegislationApiError,
  LegislationApiProtocolError,
  LegislationApiTimeoutError,
  type ApiRequestBody,
  type ApiRequestOptions,
  type FetchLike,
  type PageResponse,
  type Query,
  type QueryValue,
  type ResourceResponse,
  type SearchPageResponse
} from "@repo/legislation-core/api-client/client"
import { getRequestContext } from "@repo/legislation-core/auth/request-context"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import type { LegislationQueryApi } from "@repo/legislation-core/research/tools"
import { z } from "zod"
import { requestSignals } from "../request-signal.js"

export type ApiAccessTokenProvider = () => Promise<string | undefined> | string | undefined

const votePositionSchema = z.looseObject({
  id: z.string().min(1),
  type: z.literal("vote-position"),
  voteId: z.string().min(1)
})
const voteDetailSchema = z.looseObject({
  id: z.string().min(1),
  type: z.literal("vote"),
  positions: z.array(votePositionSchema),
  positionsPageInfo: z.object({
    limit: z.number().int().positive(),
    nextCursor: z.string().min(1).nullable(),
    truncated: z.boolean()
  })
})

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

  function voteRequestOptions(): ApiRequestOptions {
    const request = requestOptions()
    const deadline = AbortSignal.timeout(options.timeoutMs ?? 30_000)
    return {
      ...request,
      signal: request.signal === undefined ? deadline : AbortSignal.any([request.signal, deadline])
    }
  }

  async function completeVotePositions(data: unknown, request: ApiRequestOptions, expectedId?: string) {
    const parsed = voteDetailSchema.safeParse(data)
    if (!parsed.success) {
      throw new LegislationApiProtocolError("The API returned an invalid vote detail")
    }
    const vote = parsed.data
    if (expectedId !== undefined && vote.id !== expectedId) {
      throw new LegislationApiProtocolError("The API returned a different vote")
    }
    const positions: z.infer<typeof votePositionSchema>[] = []
    const positionIds = new Set<string>()
    const cursors = new Set<string>()
    function appendPage(items: z.infer<typeof votePositionSchema>[], page: typeof vote.positionsPageInfo) {
      if (
        page.truncated !== (page.nextCursor !== null) ||
        items.length > page.limit ||
        (items.length === 0 && (page.truncated || positions.length > 0))
      ) {
        throw new LegislationApiProtocolError("The API returned inconsistent vote position pagination")
      }
      for (const position of items) {
        if (position.voteId !== vote.id || positionIds.has(position.id)) {
          throw new LegislationApiProtocolError("The API returned mismatched or duplicate vote positions")
        }
        positionIds.add(position.id)
        positions.push(position)
      }
    }
    appendPage(vote.positions, vote.positionsPageInfo)
    let cursor = vote.positionsPageInfo.nextCursor
    while (cursor !== null) {
      if (cursors.has(cursor)) {
        throw new LegislationApiProtocolError("The API repeated a vote position cursor")
      }
      cursors.add(cursor)
      const page = await api.listVotePositions(vote.id, { cursor, limit: 100 }, request)
      const parsedPositions = z.array(votePositionSchema).safeParse(page.data)
      if (!parsedPositions.success) {
        throw new LegislationApiProtocolError("The API returned invalid vote positions")
      }
      appendPage(parsedPositions.data, page.meta)
      cursor = page.meta.nextCursor
    }
    return {
      ...vote,
      positions,
      positionsPageInfo: {
        limit: Math.max(vote.positionsPageInfo.limit, positions.length),
        nextCursor: null,
        truncated: false
      }
    }
  }

  return withApiErrors({
    describeAnalytics: async (datasets) =>
      await apiCall(async () => resourceData(await api.describeAnalytics(datasets, requestOptions()))),
    analyzeLegislation: async (input) =>
      await apiCall(async () => resourceData(await api.analyzeLegislation(input, requestOptions()))),
    readRecordCollection: async (input) =>
      await apiCall(async () => resourceData(await api.readRecordCollection(input, requestOptions()))),
    resolveRecord: async (input) =>
      await apiCall(async () => resourceData(await api.resolveRecord(input, requestOptions()))),
    listJurisdictions: async (input) =>
      pageData(await api.listJurisdictions(query(input, { query: "q" }), requestOptions())),
    listSessions: async ({ jurisdictionId, ...input }) =>
      pageData(await api.listJurisdictionSessions(jurisdictionId, query(input), requestOptions())),
    getMemberships: async ({ personId, organizationId, ...input }) => {
      if (personId && organizationId) {
        throw new LegislationError("invalid_request", "Select one person or organization for membership lookup")
      }
      if (personId) return pageData(await api.listPersonMemberships(personId, query(input), requestOptions()))
      if (organizationId)
        return pageData(await api.listOrganizationMembers(organizationId, query(input), requestOptions()))
      throw new LegislationError("invalid_request", "Select a person or organization for membership lookup")
    },
    getSponsoredBills: async ({ id, ...input }) =>
      pageData(await api.listPersonBills(id, query(input), requestOptions())),
    getCommitteeBillActivity: async ({ id, ...input }) =>
      pageData(await api.listOrganizationBills(id, query(input), requestOptions())),
    getDocumentSections: async ({ documentId, ...input }) =>
      pageData(await api.getDocumentSections(documentId, query(input), requestOptions())),
    ...(legalText === undefined
      ? {}
      : {
          canReadLegalText,
          getRegulatoryCoverage: async (input) => api.getRegulatoryCoverage(input, await legalRequestOptions()),
          listLegalAgencies: async (input) => api.listLegalAgencies(input, await legalRequestOptions()),
          listRegulatoryDocuments: async (input) => api.listRegulatoryDocuments(input, await legalRequestOptions()),
          getRegulatoryDocument: async ({ documentId, versionId }) =>
            api.getRegulatoryDocument(documentId, versionId, await legalRequestOptions()),
          searchLegal: async (input) => api.searchLegal(input, await legalRequestOptions()),
          getLegalCode: async ({ codeId }) => api.getLegalCode(codeId, await legalRequestOptions()),
          getLegalEdition: async ({ editionId }) => api.getLegalEdition(editionId, await legalRequestOptions()),
          listLegalEditions: async ({ codeId, ...input }) =>
            api.listLegalEditions(codeId, input, await legalRequestOptions()),
          listLegalProvisions: async ({ codeId, ...input }) =>
            api.listLegalProvisions(codeId, input, await legalRequestOptions()),
          getLegalProvision: async ({ provisionId, ...input }) =>
            api.getLegalProvision(provisionId, input, await legalRequestOptions()),
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
          },
          listLegalPassages: async ({ versionId, ...input }) =>
            api.listLegalPassages(versionId, input, await legalRequestOptions()),
          getLegalPassage: async ({ passageId, ...input }) =>
            api.getLegalPassage(passageId, input, await legalRequestOptions())
        }),
    compareBillVersions: async ({ billId, documentIds, cursor, limit }) => {
      const [leftDocumentId, rightDocumentId] = documentIds
      if (leftDocumentId === undefined || rightDocumentId === undefined) {
        throw new LegislationError("invalid_request", "Exactly two document IDs are required")
      }
      return resourceData(
        await api.compareBillVersions(billId, leftDocumentId, rightDocumentId, requestOptions(), { cursor, limit })
      )
    },
    findRelatedBills: async ({ id, mode, ...input }) =>
      pageData(
        await api.getRelatedBills(
          id,
          query({ ...input, mode: mode === "semantic" ? "similar" : "explicit" }),
          requestOptions()
        )
      ),
    getAmendment: async ({ id }) => resourceData(await api.getAmendment(id, requestOptions())),
    getBill: async ({ id, ...input }) => resourceData(await api.getBill(id, query(input), requestOptions())),
    getBillVotes: async ({ billId, ...input }) => {
      const request = voteRequestOptions()
      const page = await api.getBillVotes(billId, query(input), request)
      const items = []
      for (const vote of page.data) {
        items.push(await completeVotePositions(vote, request))
      }
      return { ...pageData(page), items }
    },
    getBillText: async ({ id, ...input }) => {
      const page = await api.getBillText(id, query(input), requestOptions())
      return { billId: id, ...pageData(page), sections: page.data }
    },
    getBillTimeline: async ({ id, ...input }) => {
      const page = await api.getBillTimeline(id, query(input), requestOptions())
      return {
        billId: id,
        events: page.data,
        nextCursor: page.meta.nextCursor,
        truncated: page.meta.truncated,
        warnings: page.meta.warnings
      }
    },
    getEvent: async ({ id }) => resourceData(await api.getMeeting(id, requestOptions())),
    getOrganization: async ({ id }) => resourceData(await api.getOrganization(id, undefined, requestOptions())),
    getPerson: async ({ id }) => resourceData(await api.getPerson(id, undefined, requestOptions())),
    getSupportingMaterial: async ({ id, ...input }) => {
      const detail = resourceData(await api.getSupportingMaterial(id, undefined, requestOptions()))
      const linkState = z.object({ linksTruncated: z.boolean() }).safeParse(detail)
      if (!linkState.success) {
        throw new LegislationApiProtocolError("The API returned invalid material link pagination")
      }
      const sections = await api.listSupportingMaterialSections(id, query(input), requestOptions())
      return {
        material: detail,
        linksTruncated: linkState.data.linksTruncated,
        sections: sections.data,
        nextCursor: sections.meta.nextCursor,
        truncated: sections.meta.truncated || linkState.data.linksTruncated
      }
    },
    getVote: async ({ id }) => {
      const request = voteRequestOptions()
      return completeVotePositions((await api.getVote(id, request)).data, request, id)
    },
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
  const listLegalPassages = adapter.listLegalPassages
  const getLegalPassage = adapter.getLegalPassage
  const searchLegal = adapter.searchLegal
  const getRegulatoryCoverage = adapter.getRegulatoryCoverage
  const listLegalAgencies = adapter.listLegalAgencies
  const listRegulatoryDocuments = adapter.listRegulatoryDocuments
  const getRegulatoryDocument = adapter.getRegulatoryDocument
  const listLegalCodes = adapter.listLegalCodes
  const getLegalCode = adapter.getLegalCode
  const getLegalEdition = adapter.getLegalEdition
  const listLegalEditions = adapter.listLegalEditions
  const listLegalProvisions = adapter.listLegalProvisions
  const getLegalProvision = adapter.getLegalProvision
  return {
    ...adapter,
    ...(getLegalCode === undefined ? {} : { getLegalCode: async (input) => await apiCall(() => getLegalCode(input)) }),
    ...(getLegalEdition === undefined
      ? {}
      : { getLegalEdition: async (input) => await apiCall(() => getLegalEdition(input)) }),
    ...(searchLegal === undefined ? {} : { searchLegal: async (input) => await apiCall(() => searchLegal(input)) }),
    ...(getRegulatoryCoverage === undefined
      ? {}
      : {
          getRegulatoryCoverage: async (input) => await apiCall(() => getRegulatoryCoverage(input))
        }),
    ...(listLegalAgencies === undefined
      ? {}
      : { listLegalAgencies: async (input) => await apiCall(() => listLegalAgencies(input)) }),
    ...(listRegulatoryDocuments === undefined
      ? {}
      : { listRegulatoryDocuments: async (input) => await apiCall(() => listRegulatoryDocuments(input)) }),
    ...(getRegulatoryDocument === undefined
      ? {}
      : { getRegulatoryDocument: async (input) => await apiCall(() => getRegulatoryDocument(input)) }),
    ...(listLegalEditions === undefined
      ? {}
      : { listLegalEditions: async (input) => await apiCall(() => listLegalEditions(input)) }),
    ...(listLegalProvisions === undefined
      ? {}
      : { listLegalProvisions: async (input) => await apiCall(() => listLegalProvisions(input)) }),
    ...(getLegalProvision === undefined
      ? {}
      : { getLegalProvision: async (input) => await apiCall(() => getLegalProvision(input)) }),
    ...(listLegalCodes === undefined
      ? {}
      : { listLegalCodes: async (input) => await apiCall(() => listLegalCodes(input)) }),
    ...(getLegalText === undefined
      ? {}
      : {
          canReadLegalText: adapter.canReadLegalText,
          getLegalText: async (input) => await apiCall(() => getLegalText(input))
        }),
    ...(listLegalPassages === undefined
      ? {}
      : { listLegalPassages: async (input) => await apiCall(() => listLegalPassages(input)) }),
    ...(getLegalPassage === undefined
      ? {}
      : { getLegalPassage: async (input) => await apiCall(() => getLegalPassage(input)) }),
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
  const signal = requestSignals.getStore()
  return {
    ...(correlationId === undefined ? {} : { correlationId }),
    ...(signal === undefined ? {} : { signal })
  }
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
  return body(input)
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
