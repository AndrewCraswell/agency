import { randomUUID } from "node:crypto"
import { analyticsQuerySchema, type AnalyticsQuery } from "@repo/legislation-core/research/analytics-contract"
import { z } from "zod"
import {
  recordCollectionSchema,
  recordResolutionSchema,
  type RecordCollectionInput,
  type RecordResolutionInput
} from "../research/record-contracts"
import { linksSchema, resourceSchema, pageSchema, searchPageSchema } from "./envelopes"
import {
  legalAgenciesRequestSchema,
  validateLegalAgenciesResponse,
  type LegalAgenciesRequest
} from "./legal-agencies-contract"
import {
  legalEditionsRequestSchema,
  legalProvisionEditionsRequestSchema,
  legalProvisionRequestSchema,
  legalProvisionVersionsRequestSchema,
  legalProvisionsRequestSchema,
  validateLegalEditionResponse,
  validateLegalEditionsResponse,
  validateLegalProvisionEditionsResponse,
  validateLegalProvisionResponse,
  validateLegalProvisionVersionsResponse,
  validateLegalProvisionsResponse,
  type LegalEditionsRequest,
  type LegalProvisionEditionsRequest,
  type LegalProvisionRequest,
  type LegalProvisionVersionsRequest,
  type LegalProvisionsRequest
} from "./legal-browse-contract"
import {
  legalCodesRequestSchema,
  validateLegalCodesResponse,
  validateLegalCodeResponse,
  type LegalCodesRequest
} from "./legal-codes-contract"
import {
  legalCoverageRequestSchema,
  validateLegalCoverageResponse,
  type LegalCoverageRequest
} from "./legal-coverage-contract"
import {
  legalPassageRequestSchema,
  legalPassagesRequestSchema,
  validateLegalPassageResponse,
  validateLegalPassagesResponse,
  type LegalPassageRequest,
  type LegalPassagesRequest
} from "./legal-passage-contract"
import {
  legalPublicationsRequestSchema,
  legalPublicationVersionsRequestSchema,
  validateLegalPublicationResponse,
  validateLegalPublicationsResponse,
  validateLegalPublicationVersionsResponse,
  type LegalPublicationsRequest,
  type LegalPublicationVersionsRequest
} from "./legal-publications-contract"
import { legalSearchRequestSchema, validateLegalSearchResponse, type LegalSearchRequest } from "./legal-search-contract"
import { legalTextRequestSchema, validateLegalTextResponse, type LegalTextRequest } from "./legal-text-contract"
import {
  legalVersionRequestSchema,
  validateLegalVersionResponse,
  type LegalVersionRequest
} from "./legal-version-contract"

const errorCategories = [
  "conflict",
  "dependency_unavailable",
  "forbidden",
  "internal",
  "invalid_request",
  "not_found",
  "payload_too_large",
  "precondition_failed",
  "unprocessable",
  "unauthorized"
] as const

const universalSearchPageSchema = searchPageSchema.extend({
  meta: searchPageSchema.shape.meta.extend({
    groups: z.array(
      z
        .object({
          nextCursor: z.string().min(1).nullable(),
          recordType: z.string().min(1),
          returned: z.number().int().nonnegative()
        })
        .strict()
    )
  })
})
const batchSchema = z
  .object({
    data: z.array(z.json()),
    links: linksSchema,
    meta: z
      .object({
        correlationId: z.string().min(1),
        requested: z.number().int().positive(),
        returned: z.number().int().nonnegative(),
        warnings: z.array(z.string())
      })
      .strict()
  })
  .strict()
  .superRefine((response, context) => {
    if (response.meta.returned !== response.data.length) {
      context.addIssue({ code: "custom", message: "Batch returned must equal data length", path: ["meta", "returned"] })
    }
    if (response.meta.returned > response.meta.requested) {
      context.addIssue({
        code: "custom",
        message: "Batch returned must not exceed requested",
        path: ["meta", "returned"]
      })
    }
  })
const errorResponseSchema = z
  .object({
    error: z
      .object({
        category: z.enum(errorCategories),
        correlationId: z.string().min(1),
        message: z.string().min(1),
        details: z.record(z.string(), z.json()).optional(),
        retryable: z.boolean()
      })
      .strict()
  })
  .strict()

export type ResourceResponse = z.infer<typeof resourceSchema>
export type PageResponse = z.infer<typeof pageSchema>
export type SearchPageResponse = z.infer<typeof searchPageSchema>
export type UniversalSearchPageResponse = z.infer<typeof universalSearchPageSchema>
export type BatchResponse = z.infer<typeof batchSchema>
export type ErrorResponse = z.infer<typeof errorResponseSchema>
export type ErrorCategory = ErrorResponse["error"]["category"]
export type QueryValue = boolean | number | string | readonly (boolean | number | string)[] | undefined
export type Query = Readonly<Record<string, QueryValue>>
export type ApiRequestBody = Readonly<Record<string, unknown>>

export type ApiRequestOptions = Readonly<{
  bearerToken?: string
  correlationId?: string
  signal?: AbortSignal
  timeoutMs?: number
}>

export type MutationRequestOptions = ApiRequestOptions & Readonly<{ idempotencyKey: string }>
export type RevisionedMutationRequestOptions = MutationRequestOptions & Readonly<{ ifMatch: string }>

export type LegislationApiClientOptions = Readonly<{
  baseUrl: string
  bearerToken?: string | (() => Promise<string | undefined> | string | undefined)
  fetch?: FetchLike
  timeoutMs?: number
}>

export type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>

type Request = Readonly<{
  body?: object
  contentType?: "application/json" | "application/merge-patch+json"
  headers?: Readonly<Record<string, string>>
  method: "DELETE" | "GET" | "PATCH" | "POST"
  path: string
  query?: Query
}>

export class LegislationApiError extends Error {
  readonly details: ErrorResponse["error"]["details"]
  readonly category: ErrorCategory
  readonly correlationId: string
  readonly retryable: boolean
  readonly status: number

  constructor(status: number, response: ErrorResponse) {
    super(response.error.message)
    this.name = "LegislationApiError"
    this.details = response.error.details
    this.category = response.error.category
    this.correlationId = response.error.correlationId
    this.retryable = response.error.retryable
    this.status = status
  }
}

export class LegislationApiProtocolError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "LegislationApiProtocolError"
  }
}

export class LegislationApiTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`The API request exceeded its ${timeoutMs}ms timeout`)
    this.name = "LegislationApiTimeoutError"
  }
}

export class LegislationApiAbortError extends Error {
  constructor() {
    super("The API request was aborted")
    this.name = "LegislationApiAbortError"
  }
}

export class LegislationApiClient {
  readonly #baseUrl: URL
  readonly #bearerToken: LegislationApiClientOptions["bearerToken"]
  readonly #fetch: FetchLike
  readonly #timeoutMs: number

  constructor(options: LegislationApiClientOptions) {
    this.#baseUrl = parseBaseUrl(options.baseUrl)
    this.#bearerToken = options.bearerToken
    this.#fetch = options.fetch ?? fetch
    this.#timeoutMs = validatedTimeout(options.timeoutMs ?? 30_000)
  }

  listBills(query?: Query, options?: ApiRequestOptions): Promise<PageResponse> {
    return this.#page({ method: "GET", path: "/api/bills", query }, options)
  }

  getBill(id: string, query?: Query, options?: ApiRequestOptions): Promise<ResourceResponse> {
    return this.#resource({ method: "GET", path: `/api/bills/${segment(id)}`, query }, options)
  }

  resolveRecord(input: RecordResolutionInput, options?: ApiRequestOptions): Promise<ResourceResponse> {
    return this.#resource(
      { method: "POST", path: "/api/records/resolve", body: recordResolutionSchema.parse(input) },
      options
    )
  }

  analyzeLegislation(input: AnalyticsQuery, options?: ApiRequestOptions): Promise<ResourceResponse> {
    return this.#resource({ method: "POST", path: "/api/analytics", body: analyticsQuerySchema.parse(input) }, options)
  }

  describeAnalytics(datasets: string[] = [], options?: ApiRequestOptions): Promise<ResourceResponse> {
    return this.#resource({ method: "GET", path: "/api/analytics", query: { dataset: datasets } }, options)
  }

  readRecordCollection(input: RecordCollectionInput, options?: ApiRequestOptions): Promise<ResourceResponse> {
    return this.#resource(
      { method: "POST", path: "/api/records/collection", body: recordCollectionSchema.parse(input) },
      options
    )
  }

  getBills(ids: readonly string[], options?: ApiRequestOptions): Promise<BatchResponse> {
    return this.#batch({ body: { ids }, method: "POST", path: "/api/bills/batch" }, options)
  }

  getBillTimeline(id: string, query?: Query, options?: ApiRequestOptions): Promise<PageResponse> {
    return this.#page({ method: "GET", path: `/api/bills/${segment(id)}/timeline`, query }, options)
  }

  getBillText(id: string, query?: Query, options?: ApiRequestOptions): Promise<PageResponse> {
    return this.#page({ method: "GET", path: `/api/bills/${segment(id)}/sections`, query }, options)
  }

  getBillVotes(id: string, query?: Query, options?: ApiRequestOptions): Promise<PageResponse> {
    return this.#page({ method: "GET", path: `/api/bills/${segment(id)}/votes`, query }, options)
  }

  getRelatedBills(id: string, query?: Query, options?: ApiRequestOptions): Promise<PageResponse> {
    return this.#page({ method: "GET", path: `/api/bills/${segment(id)}/related`, query }, options)
  }

  getBillAmendments(id: string, query?: Query, options?: ApiRequestOptions): Promise<PageResponse> {
    return this.#page({ method: "GET", path: `/api/bills/${segment(id)}/amendments`, query }, options)
  }

  getBillChanges(id: string, query?: Query, options?: ApiRequestOptions): Promise<PageResponse> {
    return this.#page({ method: "GET", path: `/api/bills/${segment(id)}/changes`, query }, options)
  }

  listBillDocuments(id: string, query?: Query, options?: ApiRequestOptions): Promise<PageResponse> {
    return this.#page({ method: "GET", path: `/api/bills/${segment(id)}/documents`, query }, options)
  }

  getAmendments(ids: readonly string[], options?: ApiRequestOptions): Promise<BatchResponse> {
    return this.#batch({ body: { ids }, method: "POST", path: "/api/amendments/batch" }, options)
  }

  listAmendments(query?: Query, options?: ApiRequestOptions): Promise<PageResponse> {
    return this.#page({ method: "GET", path: "/api/amendments", query }, options)
  }

  getAmendment(id: string, options?: ApiRequestOptions): Promise<ResourceResponse> {
    return this.#resource({ method: "GET", path: `/api/amendments/${segment(id)}` }, options)
  }

  getAmendmentsForBills(
    billIds: readonly string[],
    limitPerBill?: number,
    options?: ApiRequestOptions
  ): Promise<BatchResponse> {
    return this.#batch(
      { body: { billIds, limitPerBill }, method: "POST", path: "/api/bills/amendments/batch" },
      options
    )
  }

  listVotes(query?: Query, options?: ApiRequestOptions): Promise<PageResponse> {
    return this.#page({ method: "GET", path: "/api/votes", query }, options)
  }

  getVote(id: string, options?: ApiRequestOptions): Promise<ResourceResponse> {
    return this.#resource({ method: "GET", path: `/api/votes/${segment(id)}` }, options)
  }

  getVotes(ids: readonly string[], options?: ApiRequestOptions): Promise<BatchResponse> {
    return this.#batch({ body: { ids }, method: "POST", path: "/api/votes/batch" }, options)
  }

  listVotePositions(id: string, query?: Query, options?: ApiRequestOptions): Promise<PageResponse> {
    return this.#page({ method: "GET", path: `/api/votes/${segment(id)}/positions`, query }, options)
  }

  listPeople(query?: Query, options?: ApiRequestOptions): Promise<PageResponse> {
    return this.#page({ method: "GET", path: "/api/people", query }, options)
  }

  getPerson(id: string, query?: Query, options?: ApiRequestOptions): Promise<ResourceResponse> {
    return this.#resource({ method: "GET", path: `/api/people/${segment(id)}`, query }, options)
  }

  listPersonBills(id: string, query?: Query, options?: ApiRequestOptions): Promise<PageResponse> {
    return this.#page({ method: "GET", path: `/api/people/${segment(id)}/bills`, query }, options)
  }

  listPersonAmendments(id: string, query?: Query, options?: ApiRequestOptions): Promise<PageResponse> {
    return this.#page({ method: "GET", path: `/api/people/${segment(id)}/amendments`, query }, options)
  }

  listPersonVotes(id: string, query?: Query, options?: ApiRequestOptions): Promise<PageResponse> {
    return this.#page({ method: "GET", path: `/api/people/${segment(id)}/votes`, query }, options)
  }

  listPersonMemberships(id: string, query?: Query, options?: ApiRequestOptions): Promise<PageResponse> {
    return this.#page({ method: "GET", path: `/api/people/${segment(id)}/memberships`, query }, options)
  }

  getPersonTerm(personId: string, termId: string, options?: ApiRequestOptions): Promise<ResourceResponse> {
    return this.#resource({ method: "GET", path: `/api/people/${segment(personId)}/terms/${segment(termId)}` }, options)
  }

  listOrganizations(query?: Query, options?: ApiRequestOptions): Promise<PageResponse> {
    return this.#page({ method: "GET", path: "/api/organizations", query }, options)
  }

  getOrganization(id: string, query?: Query, options?: ApiRequestOptions): Promise<ResourceResponse> {
    return this.#resource({ method: "GET", path: `/api/organizations/${segment(id)}`, query }, options)
  }

  listOrganizationMembers(id: string, query?: Query, options?: ApiRequestOptions): Promise<PageResponse> {
    return this.#page({ method: "GET", path: `/api/organizations/${segment(id)}/members`, query }, options)
  }

  getOrganizationMembership(
    organizationId: string,
    membershipId: string,
    options?: ApiRequestOptions
  ): Promise<ResourceResponse> {
    return this.#resource(
      {
        method: "GET",
        path: `/api/organizations/${segment(organizationId)}/memberships/${segment(membershipId)}`
      },
      options
    )
  }

  listOrganizationMeetings(id: string, query?: Query, options?: ApiRequestOptions): Promise<PageResponse> {
    return this.#page({ method: "GET", path: `/api/organizations/${segment(id)}/meetings`, query }, options)
  }

  listOrganizationBills(id: string, query?: Query, options?: ApiRequestOptions): Promise<PageResponse> {
    return this.#page({ method: "GET", path: `/api/organizations/${segment(id)}/bills`, query }, options)
  }

  listMeetings(query?: Query, options?: ApiRequestOptions): Promise<PageResponse> {
    return this.#page({ method: "GET", path: "/api/meetings", query }, options)
  }

  getMeeting(id: string, options?: ApiRequestOptions): Promise<ResourceResponse> {
    return this.#resource({ method: "GET", path: `/api/meetings/${segment(id)}` }, options)
  }

  listMeetingAgenda(id: string, query?: Query, options?: ApiRequestOptions): Promise<PageResponse> {
    return this.#page({ method: "GET", path: `/api/meetings/${segment(id)}/agenda`, query }, options)
  }

  getMeetingAgendaItem(meetingId: string, itemId: string, options?: ApiRequestOptions): Promise<ResourceResponse> {
    return this.#resource(
      { method: "GET", path: `/api/meetings/${segment(meetingId)}/agenda/${segment(itemId)}` },
      options
    )
  }

  listMeetingDocuments(id: string, query?: Query, options?: ApiRequestOptions): Promise<PageResponse> {
    return this.#page({ method: "GET", path: `/api/meetings/${segment(id)}/documents`, query }, options)
  }

  getMeetingDocument(meetingId: string, documentId: string, options?: ApiRequestOptions): Promise<ResourceResponse> {
    return this.#resource(
      { method: "GET", path: `/api/meetings/${segment(meetingId)}/documents/${segment(documentId)}` },
      options
    )
  }

  listMeetingParticipants(id: string, query?: Query, options?: ApiRequestOptions): Promise<PageResponse> {
    return this.#page({ method: "GET", path: `/api/meetings/${segment(id)}/participants`, query }, options)
  }

  getMeetingParticipant(
    meetingId: string,
    participantId: string,
    options?: ApiRequestOptions
  ): Promise<ResourceResponse> {
    return this.#resource(
      { method: "GET", path: `/api/meetings/${segment(meetingId)}/participants/${segment(participantId)}` },
      options
    )
  }

  listSupportingMaterials(query?: Query, options?: ApiRequestOptions): Promise<PageResponse> {
    return this.#page({ method: "GET", path: "/api/supporting-materials", query }, options)
  }

  getSupportingMaterial(id: string, query?: Query, options?: ApiRequestOptions): Promise<ResourceResponse> {
    return this.#resource({ method: "GET", path: `/api/supporting-materials/${segment(id)}`, query }, options)
  }

  listSupportingMaterialSections(id: string, query?: Query, options?: ApiRequestOptions): Promise<PageResponse> {
    return this.#page({ method: "GET", path: `/api/supporting-materials/${segment(id)}/sections`, query }, options)
  }

  getSupportingMaterialSection(
    materialId: string,
    sectionId: string,
    options?: ApiRequestOptions
  ): Promise<ResourceResponse> {
    return this.#resource(
      { method: "GET", path: `/api/supporting-materials/${segment(materialId)}/sections/${segment(sectionId)}` },
      options
    )
  }

  getDocument(id: string, query?: Query, options?: ApiRequestOptions): Promise<ResourceResponse> {
    return this.#resource({ method: "GET", path: `/api/documents/${segment(id)}`, query }, options)
  }

  async listLegalCodes(query: LegalCodesRequest = {}, options?: ApiRequestOptions) {
    const input = legalCodesRequestSchema.parse(query)
    const result = await this.#request({ method: "GET", path: "/api/legal/codes", query: input }, options)
    try {
      return validateLegalCodesResponse(result, input)
    } catch {
      throw new LegislationApiProtocolError("Invalid legal codes response")
    }
  }

  async listLegalAgencies(query: LegalAgenciesRequest = {}, options?: ApiRequestOptions) {
    const input = legalAgenciesRequestSchema.parse(query)
    const result = await this.#request({ method: "GET", path: "/api/legal/agencies", query: input }, options)
    try {
      return validateLegalAgenciesResponse(result, input)
    } catch {
      throw new LegislationApiProtocolError("Invalid legal agencies response")
    }
  }

  async getRegulatoryCoverage(query: LegalCoverageRequest = {}, options?: ApiRequestOptions) {
    const input = legalCoverageRequestSchema.parse(query)
    const result = await this.#request({ method: "GET", path: "/api/legal/coverage", query: input }, options)
    try {
      return validateLegalCoverageResponse(result, input)
    } catch {
      throw new LegislationApiProtocolError("Invalid regulatory coverage response")
    }
  }

  async listRegulatoryDocuments(query: LegalPublicationsRequest = {}, options?: ApiRequestOptions) {
    const input = legalPublicationsRequestSchema.parse(query)
    const result = await this.#request({ method: "GET", path: "/api/legal/publications", query: input }, options)
    try {
      return validateLegalPublicationsResponse(result, input)
    } catch {
      throw new LegislationApiProtocolError("Invalid regulatory publications response")
    }
  }

  async getRegulatoryDocument(documentId: string, versionId?: string, options?: ApiRequestOptions) {
    const id = z.uuid().parse(documentId)
    const result = await this.#request(
      {
        method: "GET",
        path: `/api/legal/publications/${segment(id)}`,
        query: versionId === undefined ? undefined : { versionId }
      },
      options
    )
    try {
      return validateLegalPublicationResponse(result, id, versionId)
    } catch {
      throw new LegislationApiProtocolError("Invalid regulatory publication response")
    }
  }

  async listRegulatoryDocumentVersions(
    documentId: string,
    query: LegalPublicationVersionsRequest = {},
    options?: ApiRequestOptions
  ) {
    const id = z.uuid().parse(documentId)
    const input = legalPublicationVersionsRequestSchema.parse(query)
    const result = await this.#request(
      { method: "GET", path: `/api/legal/publications/${segment(id)}/versions`, query: input },
      options
    )
    try {
      return validateLegalPublicationVersionsResponse(result, id, input)
    } catch {
      throw new LegislationApiProtocolError("Invalid regulatory publication versions response")
    }
  }

  async getLegalCode(codeId: string, options?: ApiRequestOptions) {
    const id = z.uuid().parse(codeId)
    const result = await this.#request({ method: "GET", path: `/api/legal/codes/${segment(id)}` }, options)
    try {
      return validateLegalCodeResponse(result, id)
    } catch {
      throw new LegislationApiProtocolError("Invalid legal code response")
    }
  }

  async listLegalEditions(codeId: string, query: LegalEditionsRequest = {}, options?: ApiRequestOptions) {
    const input = legalEditionsRequestSchema.parse(query)
    const result = await this.#request(
      { method: "GET", path: `/api/legal/codes/${segment(codeId)}/editions`, query: input },
      options
    )
    try {
      return validateLegalEditionsResponse(result, codeId, input)
    } catch {
      throw new LegislationApiProtocolError("Invalid legal editions response")
    }
  }

  async getLegalEdition(editionId: string, options?: ApiRequestOptions) {
    const id = z.uuid().parse(editionId)
    const result = await this.#request({ method: "GET", path: `/api/legal/editions/${segment(id)}` }, options)
    try {
      return validateLegalEditionResponse(result, id)
    } catch {
      throw new LegislationApiProtocolError("Invalid legal edition response")
    }
  }

  async listLegalProvisions(codeId: string, query: LegalProvisionsRequest = {}, options?: ApiRequestOptions) {
    const input = legalProvisionsRequestSchema.parse(query)
    const result = await this.#request(
      { method: "GET", path: `/api/legal/codes/${segment(codeId)}/provisions`, query: input },
      options
    )
    try {
      return validateLegalProvisionsResponse(result, codeId, input)
    } catch {
      throw new LegislationApiProtocolError("Invalid legal provisions response")
    }
  }

  async getLegalProvision(provisionId: string, query: LegalProvisionRequest = {}, options?: ApiRequestOptions) {
    const id = z.uuid().parse(provisionId)
    const input = legalProvisionRequestSchema.parse(query)
    const result = await this.#request(
      { method: "GET", path: `/api/legal/provisions/${segment(id)}`, query: input },
      options
    )
    try {
      return validateLegalProvisionResponse(result, id, input)
    } catch {
      throw new LegislationApiProtocolError("Invalid legal provision response")
    }
  }

  async listLegalProvisionVersions(
    provisionId: string,
    query: LegalProvisionVersionsRequest = {},
    options?: ApiRequestOptions
  ) {
    const id = z.uuid().parse(provisionId)
    const input = legalProvisionVersionsRequestSchema.parse(query)
    const result = await this.#request(
      { method: "GET", path: `/api/legal/provisions/${segment(id)}/versions`, query: input },
      options
    )
    try {
      return validateLegalProvisionVersionsResponse(result, id, input)
    } catch {
      throw new LegislationApiProtocolError("Invalid legal provision versions response")
    }
  }

  async listLegalProvisionEditions(
    provisionId: string,
    query: LegalProvisionEditionsRequest = {},
    options?: ApiRequestOptions
  ) {
    const id = z.uuid().parse(provisionId)
    const input = legalProvisionEditionsRequestSchema.parse(query)
    const result = await this.#request(
      { method: "GET", path: `/api/legal/provisions/${segment(id)}/editions`, query: input },
      options
    )
    try {
      return validateLegalProvisionEditionsResponse(result, id, input)
    } catch {
      throw new LegislationApiProtocolError("Invalid legal provision editions response")
    }
  }

  async getLegalText(versionId: string, query: LegalTextRequest, options?: ApiRequestOptions) {
    const input = legalTextRequestSchema.parse(query)
    const result = await this.#request(
      { method: "GET", path: `/api/legal/versions/${segment(versionId)}/text`, query: input },
      options
    )
    try {
      return validateLegalTextResponse(result, versionId, input)
    } catch {
      throw new LegislationApiProtocolError("Invalid legal text response")
    }
  }

  async getLegalVersion(versionId: string, query: LegalVersionRequest = {}, options?: ApiRequestOptions) {
    const id = z.uuid().parse(versionId)
    const input = legalVersionRequestSchema.parse(query)
    const result = await this.#request(
      { method: "GET", path: `/api/legal/versions/${segment(id)}`, query: input },
      options
    )
    try {
      return validateLegalVersionResponse(result, id, input)
    } catch {
      throw new LegislationApiProtocolError("Invalid legal version response")
    }
  }

  async listLegalPassages(versionId: string, query: LegalPassagesRequest, options?: ApiRequestOptions) {
    const id = z.uuid().parse(versionId)
    const input = legalPassagesRequestSchema.parse(query)
    const result = await this.#request(
      { method: "GET", path: `/api/legal/versions/${segment(id)}/passages`, query: input },
      options
    )
    try {
      return validateLegalPassagesResponse(result, id, input)
    } catch {
      throw new LegislationApiProtocolError("Invalid legal passages response")
    }
  }

  async getLegalPassage(passageId: string, query: LegalPassageRequest, options?: ApiRequestOptions) {
    const id = z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .parse(passageId)
    const input = legalPassageRequestSchema.parse(query)
    const result = await this.#request(
      { method: "GET", path: `/api/legal/passages/${segment(id)}`, query: input },
      options
    )
    try {
      return validateLegalPassageResponse(result, id, input)
    } catch {
      throw new LegislationApiProtocolError("Invalid legal passage response")
    }
  }

  getDocumentSections(id: string, query?: Query, options?: ApiRequestOptions): Promise<PageResponse> {
    return this.#page({ method: "GET", path: `/api/documents/${segment(id)}/sections`, query }, options)
  }

  getDocumentSection(documentId: string, sectionId: string, options?: ApiRequestOptions): Promise<ResourceResponse> {
    return this.#resource(
      { method: "GET", path: `/api/documents/${segment(documentId)}/sections/${segment(sectionId)}` },
      options
    )
  }

  listChanges(query?: Query, options?: ApiRequestOptions): Promise<PageResponse> {
    return this.#page({ method: "GET", path: "/api/changes", query }, options)
  }

  getChange(id: string, options?: ApiRequestOptions): Promise<ResourceResponse> {
    return this.#resource({ method: "GET", path: `/api/changes/${segment(id)}` }, options)
  }

  listJurisdictions(query?: Query, options?: ApiRequestOptions): Promise<PageResponse> {
    return this.#page({ method: "GET", path: "/api/jurisdictions", query }, options)
  }

  getJurisdiction(id: string, options?: ApiRequestOptions): Promise<ResourceResponse> {
    return this.#resource({ method: "GET", path: `/api/jurisdictions/${segment(id)}` }, options)
  }

  listJurisdictionSessions(id: string, query?: Query, options?: ApiRequestOptions): Promise<PageResponse> {
    return this.#page({ method: "GET", path: `/api/jurisdictions/${segment(id)}/sessions`, query }, options)
  }

  listJurisdictionBills(id: string, query?: Query, options?: ApiRequestOptions): Promise<PageResponse> {
    return this.#page({ method: "GET", path: `/api/jurisdictions/${segment(id)}/bills`, query }, options)
  }

  listJurisdictionOrganizations(id: string, query?: Query, options?: ApiRequestOptions): Promise<PageResponse> {
    return this.#page({ method: "GET", path: `/api/jurisdictions/${segment(id)}/organizations`, query }, options)
  }

  listJurisdictionCommissions(id: string, query?: Query, options?: ApiRequestOptions): Promise<PageResponse> {
    return this.#page({ method: "GET", path: `/api/jurisdictions/${segment(id)}/commissions`, query }, options)
  }

  listJurisdictionCommittees(id: string, query?: Query, options?: ApiRequestOptions): Promise<PageResponse> {
    return this.#page({ method: "GET", path: `/api/jurisdictions/${segment(id)}/committees`, query }, options)
  }

  listJurisdictionMeetings(id: string, query?: Query, options?: ApiRequestOptions): Promise<PageResponse> {
    return this.#page({ method: "GET", path: `/api/jurisdictions/${segment(id)}/meetings`, query }, options)
  }

  getSession(id: string, options?: ApiRequestOptions): Promise<ResourceResponse> {
    return this.#resource({ method: "GET", path: `/api/sessions/${segment(id)}` }, options)
  }

  listSessionBills(id: string, query?: Query, options?: ApiRequestOptions): Promise<PageResponse> {
    return this.#page({ method: "GET", path: `/api/sessions/${segment(id)}/bills`, query }, options)
  }

  listSessionMeetings(id: string, query?: Query, options?: ApiRequestOptions): Promise<PageResponse> {
    return this.#page({ method: "GET", path: `/api/sessions/${segment(id)}/meetings`, query }, options)
  }

  getResources(body: ApiRequestBody, options?: ApiRequestOptions): Promise<BatchResponse> {
    return this.#batch({ body, method: "POST", path: "/api/resources/batch" }, options)
  }

  async searchLegal(body: LegalSearchRequest, options?: ApiRequestOptions) {
    const input = legalSearchRequestSchema.parse(body)
    const result = await this.#request({ method: "POST", path: "/api/search/legal", body: input }, options)
    try {
      return validateLegalSearchResponse(result, input)
    } catch {
      throw new LegislationApiProtocolError("Invalid legal search response")
    }
  }

  searchBills(body: ApiRequestBody, options?: ApiRequestOptions): Promise<SearchPageResponse> {
    return this.#search({ body, method: "POST", path: "/api/search/bills" }, options)
  }

  searchAmendments(body: ApiRequestBody, options?: ApiRequestOptions): Promise<SearchPageResponse> {
    return this.#search({ body, method: "POST", path: "/api/search/amendments" }, options)
  }

  searchBillText(body: ApiRequestBody, options?: ApiRequestOptions): Promise<SearchPageResponse> {
    return this.#search({ body, method: "POST", path: "/api/search/passages" }, options)
  }

  searchSupportingMaterials(body: ApiRequestBody, options?: ApiRequestOptions): Promise<SearchPageResponse> {
    return this.#search({ body, method: "POST", path: "/api/search/supporting-materials" }, options)
  }

  searchAll(body: ApiRequestBody, options?: ApiRequestOptions): Promise<UniversalSearchPageResponse> {
    return this.#universalSearch({ body, method: "POST", path: "/api/search/all" }, options)
  }

  answerLegislativeResearchQuestion(body: ApiRequestBody, options?: ApiRequestOptions): Promise<ResourceResponse> {
    return this.#resource({ body, method: "POST", path: "/api/research/answers" }, options)
  }

  compareBillVersions(
    billId: string,
    leftDocumentId: string,
    rightDocumentId: string,
    options?: ApiRequestOptions,
    pagination: Readonly<{ cursor?: string; limit?: number }> = {}
  ): Promise<ResourceResponse> {
    return this.#resource(
      {
        body: { billId, leftDocumentId, rightDocumentId, ...pagination },
        method: "POST",
        path: "/api/document-diffs"
      },
      options
    )
  }

  listSubscriptions(query?: Query, options?: ApiRequestOptions): Promise<PageResponse> {
    return this.#page({ method: "GET", path: "/api/subscriptions", query }, options)
  }

  createSubscription(body: ApiRequestBody, options: MutationRequestOptions): Promise<ResourceResponse> {
    return this.#resource(
      { body, headers: idempotencyHeaders(options), method: "POST", path: "/api/subscriptions" },
      options
    )
  }

  getSubscription(id: string, options?: ApiRequestOptions): Promise<ResourceResponse> {
    return this.#resource({ method: "GET", path: `/api/subscriptions/${segment(id)}` }, options)
  }

  updateSubscription(
    id: string,
    body: ApiRequestBody,
    options: RevisionedMutationRequestOptions
  ): Promise<ResourceResponse> {
    return this.#resource(
      {
        body,
        contentType: "application/merge-patch+json",
        headers: revisionedMutationHeaders(options),
        method: "PATCH",
        path: `/api/subscriptions/${segment(id)}`
      },
      options
    )
  }

  deleteSubscription(id: string, options: RevisionedMutationRequestOptions): Promise<ResourceResponse> {
    return this.#resource(
      { headers: revisionedMutationHeaders(options), method: "DELETE", path: `/api/subscriptions/${segment(id)}` },
      options
    )
  }

  listSubscriptionEvents(id: string, query?: Query, options?: ApiRequestOptions): Promise<PageResponse> {
    return this.#page({ method: "GET", path: `/api/subscriptions/${segment(id)}/events`, query }, options)
  }

  listSubscriptionDeliveries(id: string, query?: Query, options?: ApiRequestOptions): Promise<PageResponse> {
    return this.#page({ method: "GET", path: `/api/subscriptions/${segment(id)}/deliveries`, query }, options)
  }

  listWebhooks(query?: Query, options?: ApiRequestOptions): Promise<PageResponse> {
    return this.#page({ method: "GET", path: "/api/webhooks", query }, options)
  }

  createWebhook(body: ApiRequestBody, options: MutationRequestOptions): Promise<ResourceResponse> {
    return this.#resource(
      { body, headers: idempotencyHeaders(options), method: "POST", path: "/api/webhooks" },
      options
    )
  }

  getWebhook(id: string, options?: ApiRequestOptions): Promise<ResourceResponse> {
    return this.#resource({ method: "GET", path: `/api/webhooks/${segment(id)}` }, options)
  }

  updateWebhook(
    id: string,
    body: ApiRequestBody,
    options: RevisionedMutationRequestOptions
  ): Promise<ResourceResponse> {
    return this.#resource(
      {
        body,
        contentType: "application/merge-patch+json",
        headers: revisionedMutationHeaders(options),
        method: "PATCH",
        path: `/api/webhooks/${segment(id)}`
      },
      options
    )
  }

  deleteWebhook(id: string, options: RevisionedMutationRequestOptions): Promise<ResourceResponse> {
    return this.#resource(
      { headers: revisionedMutationHeaders(options), method: "DELETE", path: `/api/webhooks/${segment(id)}` },
      options
    )
  }

  rotateWebhookSecret(
    id: string,
    body: ApiRequestBody,
    options: RevisionedMutationRequestOptions
  ): Promise<ResourceResponse> {
    return this.#resource(
      {
        body,
        headers: revisionedMutationHeaders(options),
        method: "POST",
        path: `/api/webhooks/${segment(id)}/rotate-secret`
      },
      options
    )
  }

  verifyWebhook(id: string, options: RevisionedMutationRequestOptions): Promise<ResourceResponse> {
    return this.#resource(
      {
        body: {},
        headers: revisionedMutationHeaders(options),
        method: "POST",
        path: `/api/webhooks/${segment(id)}/verify`
      },
      options
    )
  }

  async #resource(request: Request, options?: ApiRequestOptions): Promise<ResourceResponse> {
    return parseEnvelope(resourceSchema, await this.#request(request, options))
  }

  async #page(request: Request, options?: ApiRequestOptions): Promise<PageResponse> {
    return parseEnvelope(pageSchema, await this.#request(request, options))
  }

  async #search(request: Request, options?: ApiRequestOptions): Promise<SearchPageResponse> {
    return parseEnvelope(searchPageSchema, await this.#request(request, options))
  }

  async #universalSearch(request: Request, options?: ApiRequestOptions): Promise<UniversalSearchPageResponse> {
    return parseEnvelope(universalSearchPageSchema, await this.#request(request, options))
  }

  async #batch(request: Request, options?: ApiRequestOptions): Promise<BatchResponse> {
    return parseEnvelope(batchSchema, await this.#request(request, options))
  }

  async #request(request: Request, options?: ApiRequestOptions): Promise<unknown> {
    const correlationId = options?.correlationId?.trim() || randomUUID()
    const timeoutMs = validatedTimeout(options?.timeoutMs ?? this.#timeoutMs)
    const timeout = new AbortController()
    const timeoutId = setTimeout(() => timeout.abort(), timeoutMs)
    const signal = options?.signal === undefined ? timeout.signal : AbortSignal.any([options.signal, timeout.signal])
    const token = options?.bearerToken ?? (await this.#resolveBearerToken())
    const headers = new Headers({ accept: "application/json", "x-correlation-id": correlationId })
    if (token !== undefined && token.trim().length > 0) {
      headers.set("authorization", `Bearer ${token}`)
    }
    for (const [name, value] of Object.entries(request.headers ?? {})) {
      headers.set(name, value)
    }
    if (request.body !== undefined) {
      headers.set("content-type", request.contentType ?? "application/json")
    }

    try {
      const response = await this.#fetch(urlFor(this.#baseUrl, request.path, request.query), {
        body: request.body === undefined ? undefined : JSON.stringify(request.body),
        headers,
        method: request.method,
        redirect: "error",
        signal
      })
      const payload = await readJson(response)
      assertCorrelation(response, payload, correlationId)
      if (!response.ok) {
        const error = errorResponseSchema.safeParse(payload)
        if (!error.success) {
          throw new LegislationApiProtocolError("The API returned a malformed error response")
        }
        throw new LegislationApiError(response.status, error.data)
      }
      return payload
    } catch (error) {
      if (timeout.signal.aborted) {
        throw new LegislationApiTimeoutError(timeoutMs)
      }
      if (options?.signal?.aborted) {
        throw new LegislationApiAbortError()
      }
      throw error
    } finally {
      clearTimeout(timeoutId)
    }
  }

  async #resolveBearerToken(): Promise<string | undefined> {
    return typeof this.#bearerToken === "function" ? await this.#bearerToken() : this.#bearerToken
  }
}

function parseBaseUrl(value: string): URL {
  const url = new URL(value)
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new TypeError("baseUrl must use http or https")
  }
  if (url.username.length > 0 || url.password.length > 0) {
    throw new TypeError("baseUrl must not contain credentials")
  }
  if (url.search.length > 0 || url.hash.length > 0) {
    throw new TypeError("baseUrl must not contain a query or hash")
  }
  if (url.pathname !== "/") {
    throw new TypeError("baseUrl must not contain a path")
  }
  return url
}

function validatedTimeout(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > 60_000) {
    throw new RangeError("timeoutMs must be an integer between 1 and 60000")
  }
  return value
}

function segment(value: string): string {
  if (value.trim().length === 0) {
    throw new TypeError("Path identifiers must not be empty")
  }
  return encodeURIComponent(value)
}

function idempotencyHeaders(options: MutationRequestOptions): Readonly<Record<string, string>> {
  if (!/^[\x20-\x7E]{8,128}$/.test(options.idempotencyKey)) {
    throw new TypeError("idempotencyKey must be 8 to 128 printable ASCII characters")
  }
  return { "idempotency-key": options.idempotencyKey }
}

function revisionedMutationHeaders(options: RevisionedMutationRequestOptions): Readonly<Record<string, string>> {
  if (options.ifMatch.trim().length === 0 || /[\r\n]/.test(options.ifMatch)) {
    throw new TypeError("ifMatch must not be empty or contain a line break")
  }
  return { ...idempotencyHeaders(options), "if-match": options.ifMatch }
}

function urlFor(baseUrl: URL, path: string, query: Query | undefined): URL {
  const url = new URL(path, baseUrl)
  for (const [name, value] of Object.entries(query ?? {})) {
    if (value === undefined) {
      continue
    }
    for (const item of Array.isArray(value) ? value : [value]) {
      url.searchParams.append(name, String(item))
    }
  }
  return url
}

async function readJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type")
  if (contentType === null || !contentType.toLocaleLowerCase().includes("application/json")) {
    throw new LegislationApiProtocolError("The API response must be JSON")
  }
  try {
    const body: unknown = await response.json()
    return body
  } catch {
    throw new LegislationApiProtocolError("The API response contained invalid JSON")
  }
}

function parseEnvelope<Schema extends z.ZodType>(schema: Schema, payload: unknown): z.output<Schema> {
  const result = schema.safeParse(payload)
  if (!result.success) {
    throw new LegislationApiProtocolError("The API returned a malformed success response")
  }
  return result.data
}

function assertCorrelation(response: Response, payload: unknown, expected: string): void {
  const header = response.headers.get("x-correlation-id")
  if (header !== expected) {
    throw new LegislationApiProtocolError("The API response correlation ID did not match the request")
  }
  const result = z
    .object({ meta: z.object({ correlationId: z.string() }).passthrough() })
    .or(z.object({ error: z.object({ correlationId: z.string() }).passthrough() }))
    .safeParse(payload)
  if (!result.success) {
    return
  }
  const correlationId = "meta" in result.data ? result.data.meta.correlationId : result.data.error.correlationId
  if (correlationId !== expected) {
    throw new LegislationApiProtocolError("The API envelope correlation ID did not match the request")
  }
}
