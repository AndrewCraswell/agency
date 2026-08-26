import { createHash, randomUUID } from "node:crypto"
import { LegislationError } from "../../legislation/errors.js"
import { toPublicApiError } from "../error-mapping.js"
import type { ModelUsage } from "../research-answers.js"

export type JsonRecord = Readonly<Record<string, unknown>>

export type ApiHeaders = Headers | Readonly<Record<string, string>> | readonly (readonly [string, string])[]

export type JsonResponseOptions = Readonly<{
  correlationId?: string
  headers?: ApiHeaders
}>

const generatedCorrelationIds = new WeakMap<Request, string>()

export function correlationId(request: Request): string {
  const callerValue = request.headers.get("x-correlation-id")?.trim()
  if (callerValue !== undefined && callerValue.length > 0) {
    return callerValue
  }
  const generated = generatedCorrelationIds.get(request) ?? randomUUID()
  generatedCorrelationIds.set(request, generated)
  return generated
}

export function requestUrl(request: Request): URL {
  return new URL(request.url)
}

export function apiResource<T>(request: Request, data: T): JsonRecord {
  return {
    data,
    links: { self: requestUrl(request).pathname },
    meta: { correlationId: correlationId(request), warnings: [] }
  }
}

export function apiPage<T>(
  request: Request,
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
  request: Request,
  page: Readonly<{ items: readonly T[]; nextCursor?: string; truncated: boolean; warnings?: readonly string[] }>,
  limit: number,
  search: Readonly<{ isReranked: boolean; mode: "hybrid" | "lexical" | "semantic"; models: readonly ModelUsage[] }>
): JsonRecord {
  const response = apiPage(request, page, limit)
  const meta = response.meta
  if (!isRecord(meta)) {
    throw new Error("Page metadata is missing")
  }
  return { ...response, meta: { ...meta, ...search } }
}

export function apiBatch<T>(
  request: Request,
  data: readonly T[],
  requested: number,
  warnings: readonly string[] = []
): JsonRecord {
  const url = requestUrl(request)
  return {
    data,
    links: { self: `${url.pathname}${url.search}` },
    meta: { correlationId: correlationId(request), requested, returned: data.length, warnings }
  }
}

export function jsonResponse(
  request: Request,
  status: number,
  body: unknown,
  options: JsonResponseOptions = {}
): Response {
  const correlation = options.correlationId ?? correlationId(request)
  const headers = copyHeaders(options.headers)
  headers.set("content-type", "application/json; charset=utf-8")
  headers.set("x-correlation-id", correlation)

  if (request.method === "GET" && status === 200) {
    const etag = headers.get("etag") ?? weakEtag(body)
    headers.set("etag", etag)
    if (ifNoneMatchMatches(request.headers.get("if-none-match"), etag)) {
      headers.delete("content-type")
      return new Response(null, { headers, status: 304 })
    }
  }

  return new Response(JSON.stringify(body), { headers, status })
}

export function apiErrorResponse(request: Request, error: unknown, options: JsonResponseOptions = {}): Response {
  const publicError = toPublicApiError(error)
  const category = publicError instanceof LegislationError ? publicError.category : "internal"
  const headers = copyHeaders(options.headers)
  if (category === "dependency_unavailable" && !headers.has("retry-after")) {
    headers.set("retry-after", "30")
  }
  const correlation = options.correlationId ?? correlationId(request)
  const body = {
    error: {
      category,
      correlationId: correlation,
      ...(publicError instanceof LegislationError && publicError.details !== undefined
        ? { details: publicError.details }
        : {}),
      message: publicError instanceof LegislationError ? publicError.message : "The request could not be completed",
      retryable: category === "dependency_unavailable"
    }
  }
  return jsonResponse(request, statusForError(category), body, { correlationId: correlation, headers })
}

export async function readJsonBody(request: Request, maximumBytes = 1_048_576): Promise<JsonRecord> {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 1) {
    throw new RangeError("maximumBytes must be a positive safe integer")
  }
  const reader = request.body?.getReader()
  const chunks: Uint8Array[] = []
  let bytes = 0

  try {
    if (reader !== undefined) {
      while (true) {
        const { done, value } = await readBodyChunk(reader, request.signal)
        if (done) {
          break
        }
        if (value === undefined) {
          throw new Error("Request body stream ended without a chunk")
        }
        bytes += value.byteLength
        if (bytes > maximumBytes) {
          await reader.cancel().catch(() => undefined)
          throw new LegislationError("payload_too_large", "Request body exceeds the allowed size")
        }
        chunks.push(value)
      }
    }
  } finally {
    reader?.releaseLock()
  }

  try {
    const value: unknown = JSON.parse(new TextDecoder().decode(joinChunks(chunks, bytes)))
    if (!isRecord(value)) {
      throw new LegislationError("invalid_request", "Request body must be a JSON object")
    }
    return value
  } catch (error) {
    if (error instanceof LegislationError) {
      throw error
    }
    throw new LegislationError("invalid_request", "Request body must be valid JSON")
  }
}

function readBodyChunk(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  signal: AbortSignal
): Promise<Readonly<{ done: boolean; value: Uint8Array | undefined }>> {
  if (signal.aborted) {
    return Promise.reject(abortReason(signal))
  }
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      signal.removeEventListener("abort", onAbort)
      void reader.cancel(signal.reason).catch(() => undefined)
      reject(abortReason(signal))
    }
    signal.addEventListener("abort", onAbort, { once: true })
    void reader.read().then(
      (result) => {
        signal.removeEventListener("abort", onAbort)
        resolve({ done: result.done, value: result.value })
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort)
        reject(error)
      }
    )
  })
}

function abortReason(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException("The request was aborted", "AbortError")
}

function joinChunks(chunks: readonly Uint8Array[], length: number): Uint8Array {
  const result = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.byteLength
  }
  return result
}

function copyHeaders(input: ApiHeaders | undefined): Headers {
  const headers = new Headers()
  if (input === undefined) {
    return headers
  }
  if (input instanceof Headers) {
    input.forEach((value, name) => headers.set(name, value))
    return headers
  }
  if (Array.isArray(input)) {
    for (const [name, value] of input) {
      headers.set(name, value)
    }
    return headers
  }
  for (const [name, value] of Object.entries(input)) {
    headers.set(name, value)
  }
  return headers
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
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
  const representation = JSON.stringify(body, (key, value: unknown) => (key === "correlationId" ? undefined : value))
  const digest = createHash("sha256").update(representation).digest("base64url")
  return `W/"${digest}"`
}

function ifNoneMatchMatches(header: string | null, etag: string): boolean {
  if (header === null) {
    return false
  }
  const normalizedEtag = normalizeEtag(etag)
  return header
    .split(",")
    .some((candidate) => candidate.trim() === "*" || normalizeEtag(candidate.trim()) === normalizedEtag)
}

function normalizeEtag(value: string): string {
  return value.startsWith("W/") || value.startsWith("w/") ? value.slice(2) : value
}
