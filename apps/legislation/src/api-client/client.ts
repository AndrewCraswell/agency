import { randomUUID } from "node:crypto"
import { z } from "zod"

const errorCategories = [
  "conflict",
  "dependency_unavailable",
  "forbidden",
  "internal",
  "invalid_request",
  "not_found",
  "payload_too_large",
  "precondition_failed",
  "rate_limited",
  "unprocessable",
  "unauthorized"
] as const

const linksSchema = z.object({ self: z.string().min(1) }).strict()
const resourceSchema = z
  .object({
    data: z.json(),
    links: linksSchema,
    meta: z.object({ correlationId: z.string().min(1), warnings: z.array(z.string()) }).strict()
  })
  .strict()
const pageSchema = z
  .object({
    data: z.array(z.json()),
    links: linksSchema.extend({ next: z.string().min(1).nullable() }).strict(),
    meta: z
      .object({
        correlationId: z.string().min(1),
        limit: z.number().int().positive(),
        nextCursor: z.string().min(1).nullable(),
        truncated: z.boolean(),
        warnings: z.array(z.string())
      })
      .strict()
  })
  .strict()
const searchPageSchema = pageSchema.extend({
  meta: pageSchema.shape.meta.extend({
    isReranked: z.boolean(),
    mode: z.enum(["hybrid", "lexical", "semantic"]),
    models: z.array(z.json())
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
        retryable: z.boolean()
      })
      .strict()
  })
  .strict()

export type ResourceResponse = z.infer<typeof resourceSchema>
export type PageResponse = z.infer<typeof pageSchema>
export type SearchPageResponse = z.infer<typeof searchPageSchema>
export type BatchResponse = z.infer<typeof batchSchema>
export type ErrorResponse = z.infer<typeof errorResponseSchema>
export type ErrorCategory = ErrorResponse["error"]["category"]
export type SearchMode = SearchPageResponse["meta"]["mode"]
export type QueryValue = boolean | number | string | readonly (boolean | number | string)[] | undefined
export type Query = Readonly<Record<string, QueryValue>>
export type ApiRequestBody = Readonly<Record<string, unknown>>

export type ApiRequestOptions = Readonly<{
  bearerToken?: string
  correlationId?: string
  signal?: AbortSignal
  timeoutMs?: number
}>

export type LegislationApiClientOptions = Readonly<{
  baseUrl: string
  bearerToken?: string | (() => Promise<string | undefined> | string | undefined)
  fetch?: FetchLike
  timeoutMs?: number
}>

export type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>

type Request = Readonly<{
  body?: ApiRequestBody
  method: "GET" | "POST"
  path: string
  query?: Query
}>

export class LegislationApiError extends Error {
  readonly category: ErrorCategory
  readonly correlationId: string
  readonly retryable: boolean
  readonly status: number

  constructor(status: number, response: ErrorResponse) {
    super(response.error.message)
    this.name = "LegislationApiError"
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

  listPeople(query?: Query, options?: ApiRequestOptions): Promise<PageResponse> {
    return this.#page({ method: "GET", path: "/api/people", query }, options)
  }

  getPerson(id: string, query?: Query, options?: ApiRequestOptions): Promise<ResourceResponse> {
    return this.#resource({ method: "GET", path: `/api/people/${segment(id)}`, query }, options)
  }

  listOrganizations(query?: Query, options?: ApiRequestOptions): Promise<PageResponse> {
    return this.#page({ method: "GET", path: "/api/organizations", query }, options)
  }

  getOrganization(id: string, query?: Query, options?: ApiRequestOptions): Promise<ResourceResponse> {
    return this.#resource({ method: "GET", path: `/api/organizations/${segment(id)}`, query }, options)
  }

  listMeetings(query?: Query, options?: ApiRequestOptions): Promise<PageResponse> {
    return this.#page({ method: "GET", path: "/api/meetings", query }, options)
  }

  getMeeting(id: string, options?: ApiRequestOptions): Promise<ResourceResponse> {
    return this.#resource({ method: "GET", path: `/api/meetings/${segment(id)}` }, options)
  }

  listSupportingMaterials(query?: Query, options?: ApiRequestOptions): Promise<PageResponse> {
    return this.#page({ method: "GET", path: "/api/supporting-materials", query }, options)
  }

  getSupportingMaterial(id: string, query?: Query, options?: ApiRequestOptions): Promise<ResourceResponse> {
    return this.#resource({ method: "GET", path: `/api/supporting-materials/${segment(id)}`, query }, options)
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

  listJurisdictions(query?: Query, options?: ApiRequestOptions): Promise<PageResponse> {
    return this.#page({ method: "GET", path: "/api/jurisdictions", query }, options)
  }

  getJurisdiction(id: string, options?: ApiRequestOptions): Promise<ResourceResponse> {
    return this.#resource({ method: "GET", path: `/api/jurisdictions/${segment(id)}` }, options)
  }

  listJurisdictionSessions(id: string, query?: Query, options?: ApiRequestOptions): Promise<PageResponse> {
    return this.#page({ method: "GET", path: `/api/jurisdictions/${segment(id)}/sessions`, query }, options)
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

  answerLegislativeResearchQuestion(body: ApiRequestBody, options?: ApiRequestOptions): Promise<ResourceResponse> {
    return this.#resource({ body, method: "POST", path: "/api/research/answers" }, options)
  }

  compareBillVersions(
    billId: string,
    leftDocumentId: string,
    rightDocumentId: string,
    options?: ApiRequestOptions
  ): Promise<ResourceResponse> {
    return this.#resource(
      {
        body: { billId, leftDocumentId, rightDocumentId },
        method: "POST",
        path: "/api/document-diffs"
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
    if (request.body !== undefined) {
      headers.set("content-type", "application/json")
    }

    try {
      const response = await this.#fetch(urlFor(this.#baseUrl, request.path, request.query), {
        body: request.body === undefined ? undefined : JSON.stringify(request.body),
        headers,
        method: request.method,
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
