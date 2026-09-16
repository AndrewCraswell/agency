import { createHash, randomUUID } from "node:crypto"
import type { IncomingMessage, ServerResponse } from "node:http"
import { getRequestContext } from "@repo/legislation-core/auth/request-context"
import { LegislationError } from "@repo/legislation-core/domain/errors"
import { createLogger, errorContext } from "@repo/legislation-core/observability/logger"
import { toPublicApiError } from "./error-mapping.js"

const apiLogger = createLogger({ level: "error", service: "legislation-api" })

export type HttpApiHandler = (request: IncomingMessage, response: ServerResponse) => Promise<boolean>

export type JsonRecord = Readonly<Record<string, unknown>>

const apiResponseRequests = new WeakMap<ServerResponse, IncomingMessage>()

export function createCompositeHttpApiHandler(handlers: readonly HttpApiHandler[]): HttpApiHandler {
  return async (request, response) => {
    for (const handler of handlers) {
      if (await handler(request, response)) {
        return true
      }
    }
    return false
  }
}

export function prepareApiResponse(response: ServerResponse, request: IncomingMessage): void {
  apiResponseRequests.set(response, request)
}

export function sendApiJson(response: ServerResponse, statusCode: number, body: unknown): void {
  const request = apiResponseRequests.get(response)
  const headers: Record<string, string> = { "content-type": "application/json; charset=utf-8" }
  if (request?.method === "GET" && statusCode === 200) {
    const configuredEtag = response.getHeader("etag")
    const etag = typeof configuredEtag === "string" ? configuredEtag : weakEtag(body)
    headers.etag = etag
    if (ifNoneMatchMatches(request.headers["if-none-match"], etag)) {
      response.writeHead(304, { etag })
      response.end()
      return
    }
  }
  response.writeHead(statusCode, headers)
  response.end(JSON.stringify(body))
}

export function requestUrl(request: IncomingMessage): URL {
  return new URL(request.url ?? "/", "http://localhost")
}

export function correlationId(request: IncomingMessage): string {
  const context = getRequestContext()
  if (context !== undefined) {
    return context.correlationId
  }
  const value = request.headers["x-correlation-id"]
  const callerValue = Array.isArray(value) ? value[0] : value
  return callerValue?.trim() || randomUUID()
}

export function apiResource<T>(request: IncomingMessage, data: T): JsonRecord {
  return {
    data,
    links: { self: requestUrl(request).pathname },
    meta: { correlationId: correlationId(request), warnings: [] }
  }
}

export function apiPage<T>(
  request: IncomingMessage,
  page: Readonly<{ items: readonly T[]; nextCursor?: string; truncated: boolean; warnings?: readonly string[] }>,
  limit: number
): JsonRecord {
  const url = requestUrl(request)
  const nextCursor = page.nextCursor ?? null
  const next =
    nextCursor === null
      ? null
      : (() => {
          const nextUrl = new URL(url)
          nextUrl.searchParams.set("cursor", nextCursor)
          return `${nextUrl.pathname}${nextUrl.search}`
        })()
  return {
    data: page.items,
    links: { next, self: `${url.pathname}${url.search}` },
    meta: {
      correlationId: correlationId(request),
      limit,
      nextCursor,
      truncated: page.truncated,
      warnings: page.warnings ?? []
    }
  }
}

export function apiSearchPage<T>(
  request: IncomingMessage,
  page: Readonly<{ items: readonly T[]; nextCursor?: string; truncated: boolean; warnings?: readonly string[] }>,
  limit: number,
  search: Readonly<{ isReranked: boolean; mode: "hybrid" | "lexical" | "semantic"; models: readonly unknown[] }>
): JsonRecord {
  const response = apiPage(request, page, limit)
  const meta = response.meta
  if (typeof meta !== "object" || meta === null) {
    throw new Error("Page metadata is missing")
  }
  return { ...response, meta: { ...meta, ...search } }
}

export function apiError(request: IncomingMessage, error: unknown): JsonRecord {
  const publicError = toPublicApiError(error)
  const category = publicError instanceof LegislationError ? publicError.category : "internal"
  const status = statusForError(category)
  const message = publicError instanceof LegislationError ? publicError.message : "The request could not be completed"
  const details = publicError instanceof LegislationError ? publicError.details : undefined
  return {
    error: {
      category,
      correlationId: correlationId(request),
      ...(details === undefined ? {} : { details }),
      message,
      retryable: category === "dependency_unavailable"
    },
    status
  }
}

export function sendApiError(request: IncomingMessage, response: ServerResponse, error: unknown): void {
  const publicError = toPublicApiError(error)
  if (!(error instanceof LegislationError)) {
    apiLogger.error("API request failed", {
      correlationId: correlationId(request),
      method: request.method ?? "UNKNOWN",
      path: (request.url ?? "/").split("?", 1)[0] ?? "/",
      ...errorContext(error)
    })
  }
  const body = apiError(request, publicError)
  const status = body.status
  const { status: _status, ...errorBody } = body
  if (
    publicError instanceof LegislationError &&
    publicError.category === "dependency_unavailable" &&
    !response.hasHeader("retry-after")
  ) {
    response.setHeader("retry-after", "30")
  }
  sendApiJson(response, typeof status === "number" ? status : 500, errorBody)
}

export function queryInteger(url: URL, name: string, defaultValue: number, maximum = 100): number {
  const value = url.searchParams.get(name)
  if (value === null) {
    return defaultValue
  }
  if (!/^\d+$/.test(value)) {
    throw new LegislationError("invalid_request", `${name} must be a positive integer`)
  }
  const result = Number(value)
  if (!Number.isSafeInteger(result) || result < 1 || result > maximum) {
    throw new LegislationError("invalid_request", `${name} must be between 1 and ${maximum}`)
  }
  return result
}

export function queryOptionalString(url: URL, name: string): string | undefined {
  const value = url.searchParams.get(name)?.trim()
  if (value === undefined || value.length === 0) {
    return undefined
  }
  return value
}

export function queryOptionalBoolean(url: URL, name: string): boolean | undefined {
  const value = url.searchParams.get(name)
  if (value === null) {
    return undefined
  }
  if (value === "true") {
    return true
  }
  if (value === "false") {
    return false
  }
  throw new LegislationError("invalid_request", `${name} must be true or false`)
}

export function queryOptionalDate(url: URL, name: string): Date | undefined {
  const value = querySingleValue(url, name)
  if (value === undefined) {
    return undefined
  }
  return parseRfc3339Timestamp(value, name)
}

export function queryOptionalIsoDate(url: URL, name: string): string | undefined {
  const value = querySingleValue(url, name)
  return value === undefined ? undefined : parseIsoDate(value, name)
}

export function queryOptionalIsoDateOrRfc3339(url: URL, name: string): string | undefined {
  const value = querySingleValue(url, name)
  if (value === undefined) {
    return undefined
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return parseIsoDate(value, name)
  }
  parseRfc3339Timestamp(value, name, "an ISO date or RFC 3339 timestamp")
  return value
}

export function assertTemporalRange(
  from: string | undefined,
  to: string | undefined,
  names: Readonly<{ from: string; to: string }> = { from: "from", to: "to" }
): void {
  if (from === undefined || to === undefined) {
    return
  }
  const fromIsIsoDate = /^\d{4}-\d{2}-\d{2}$/.test(from)
  const toIsIsoDate = /^\d{4}-\d{2}-\d{2}$/.test(to)
  const fromValue = fromIsIsoDate ? Date.parse(`${from}T00:00:00.000Z`) : Date.parse(from)
  const toValue = toIsIsoDate ? Date.parse(`${to}T00:00:00.000Z`) : Date.parse(to)
  if (fromValue > toValue) {
    throw new LegislationError("invalid_request", `${names.from} must not be after ${names.to}`)
  }
}

function parseIsoDate(value: string, name: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (match === null) {
    throw new LegislationError("invalid_request", `${name} must be an ISO date`)
  }
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const parsed = new Date(Date.UTC(year, month - 1, day))
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    throw new LegislationError("invalid_request", `${name} must be an ISO date`)
  }
  return value
}

function parseRfc3339Timestamp(value: string, name: string, expected = "an RFC 3339 timestamp"): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/.exec(value)
  if (match === null) {
    throw new LegislationError("invalid_request", `${name} must be ${expected}`)
  }
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const hour = Number(match[4])
  const minute = Number(match[5])
  const second = Number(match[6])
  const offset = match[7]
  const offsetHours = offset === "Z" ? 0 : Number(offset.slice(1, 3))
  const offsetMinutes = offset === "Z" ? 0 : Number(offset.slice(4, 6))
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    offsetHours > 23 ||
    offsetMinutes > 59
  ) {
    throw new LegislationError("invalid_request", `${name} must be ${expected}`)
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new LegislationError("invalid_request", `${name} must be ${expected}`)
  }
  const offsetSign = offset === "Z" || offset.startsWith("+") ? 1 : -1
  const local = new Date(date.getTime() + offsetSign * (offsetHours * 60 + offsetMinutes) * 60_000)
  if (
    local.getUTCFullYear() !== year ||
    local.getUTCMonth() !== month - 1 ||
    local.getUTCDate() !== day ||
    local.getUTCHours() !== hour ||
    local.getUTCMinutes() !== minute ||
    local.getUTCSeconds() !== second
  ) {
    throw new LegislationError("invalid_request", `${name} must be ${expected}`)
  }
  return date
}

function querySingleValue(url: URL, name: string): string | undefined {
  const values = url.searchParams.getAll(name)
  if (values.length === 0) {
    return undefined
  }
  if (values.length !== 1) {
    throw new LegislationError("invalid_request", `${name} must appear once`)
  }
  return values[0]?.trim() ?? ""
}

export function assertAllowedQueryParameters(url: URL, allowed: readonly string[]): void {
  const allowedParameters = new Set(allowed)
  for (const name of url.searchParams.keys()) {
    if (!allowedParameters.has(name)) {
      throw new LegislationError("invalid_request", `Unsupported query parameter: ${name}`)
    }
  }
}

export async function readJsonBody(request: IncomingMessage, maximumBytes = 1_048_576): Promise<JsonRecord> {
  const chunks: Buffer[] = []
  let bytes = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    bytes += buffer.byteLength
    if (bytes > maximumBytes) {
      throw new LegislationError("payload_too_large", "Request body exceeds the allowed size")
    }
    chunks.push(buffer)
  }
  try {
    const value: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"))
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new LegislationError("invalid_request", "Request body must be a JSON object")
    }
    return value as JsonRecord
  } catch (error) {
    if (error instanceof LegislationError) {
      throw error
    }
    throw new LegislationError("invalid_request", "Request body must be valid JSON")
  }
}

function statusForError(category: LegislationError["category"] | "internal"): number {
  switch (category) {
    case "invalid_request":
      return 400
    case "unauthorized":
      return 401
    case "forbidden":
      return 403
    case "not_found":
      return 404
    case "conflict":
      return 409
    case "precondition_failed":
      return 412
    case "payload_too_large":
      return 413
    case "unprocessable":
      return 422
    case "dependency_unavailable":
      return 503
    case "internal":
      return 500
  }
}

function weakEtag(body: unknown): string {
  // Correlation IDs identify an individual request and are intentionally not
  // part of the semantic representation validator.
  const representation = JSON.stringify(body, (key, value: unknown) => (key === "correlationId" ? undefined : value))
  const digest = createHash("sha256").update(representation).digest("base64url")
  return `W/"${digest}"`
}

function ifNoneMatchMatches(header: string | string[] | undefined, etag: string): boolean {
  const value = Array.isArray(header) ? header.join(",") : header
  if (value === undefined) {
    return false
  }
  const normalizedEtag = normalizeEtag(etag)
  return value
    .split(",")
    .some((candidate) => candidate.trim() === "*" || normalizeEtag(candidate.trim()) === normalizedEtag)
}

function normalizeEtag(value: string): string {
  return value.startsWith("W/") || value.startsWith("w/") ? value.slice(2) : value
}
