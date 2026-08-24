import { randomUUID } from "node:crypto"
import { LegislationApiClient, type FetchLike } from "../api-client/client.js"
import { runWithRequestContext } from "../auth/request-context.js"
import { decodeSearchCursor } from "../search/search.js"
import {
  normalizeDirectBillSearchPage,
  normalizeHttpBillSearchPage,
  type DirectBillSearchPage
} from "./canonical-search-output.js"
import { HttpLegislationQueryAdapter } from "./http-query-adapter.js"
import type { LegislationQueryApi } from "./tools.js"

type GetBillInput = Parameters<LegislationQueryApi["getBill"]>[0]
type GetBillQueryApi = Pick<LegislationQueryApi, "getBill">
type SearchBillsInput = Parameters<LegislationQueryApi["searchBills"]>[0]
type SearchBillsQueryApi = Readonly<{ searchBills: (input: SearchBillsInput) => Promise<DirectBillSearchPage> }>

export type GetBillHttpParityReport = Readonly<{
  billId: string
  correlationId: string
  method: "getBill"
  status: "passed"
}>

export type SearchBillsHttpParityReport = Readonly<{
  correlationId: string
  method: "searchBills"
  query: string
  status: "passed"
}>

export class McpHttpParityMismatchError extends Error {
  readonly method: "getBill" | "searchBills"
  readonly mismatchPath: string

  constructor(mismatchPath: string, method: "getBill" | "searchBills" = "getBill") {
    super(`MCP HTTP parity failed for ${method} at ${mismatchPath}`)
    this.name = "McpHttpParityMismatchError"
    this.method = method
    this.mismatchPath = mismatchPath
  }
}

/**
 * Compares one direct query-service bill result with the API-backed MCP
 * adapter using identical input, caller bearer token, and correlation ID.
 * It deliberately throws on any difference, allowing no partial pass.
 */
export async function assertGetBillHttpParity(
  options: Readonly<{
    apiBaseUrl: string
    billId: string
    correlationId?: string
    fetch?: FetchLike
    inProcess: GetBillQueryApi
    token: string
  }>
): Promise<GetBillHttpParityReport> {
  const token = nonEmpty(options.token, "token")
  const billId = nonEmpty(options.billId, "billId")
  const correlationId = options.correlationId?.trim() || randomUUID()
  const input: GetBillInput = { childLimit: 25, id: billId }
  const http = new HttpLegislationQueryAdapter(
    new LegislationApiClient({ baseUrl: options.apiBaseUrl, fetch: options.fetch })
  )

  const [inProcess, remote] = await runWithRequestContext(
    { bearerToken: token, correlationId },
    async () => await Promise.all([options.inProcess.getBill(input), http.getBill(input)])
  )
  const mismatchPath = firstMismatchPath(normalizeJson(inProcess), normalizeJson(remote))
  if (mismatchPath !== undefined) {
    throw new McpHttpParityMismatchError(mismatchPath)
  }
  return { billId, correlationId, method: "getBill", status: "passed" }
}

/**
 * An explicit canary for the next search cutover. The live MCP search result
 * remains untouched until this canonical comparison is accepted by operators.
 */
export async function assertSearchBillsHttpParity(
  options: Readonly<{
    apiBaseUrl: string
    correlationId?: string
    fetch?: FetchLike
    inProcess: SearchBillsQueryApi
    input: SearchBillsInput
    token: string
  }>
): Promise<SearchBillsHttpParityReport> {
  const token = nonEmpty(options.token, "token")
  const query = nonEmpty(options.input.query, "input.query")
  const correlationId = options.correlationId?.trim() || randomUUID()
  const mode = options.input.mode ?? "lexical"
  const input = { ...options.input, mode, query }
  const rankOffset = decodeSearchCursor(input.cursor)
  const client = new LegislationApiClient({ baseUrl: options.apiBaseUrl, fetch: options.fetch })
  const [directResult, httpResult] = await runWithRequestContext(
    { bearerToken: token, correlationId },
    async () =>
      await Promise.all([
        options.inProcess.searchBills(input),
        client.searchBills(input, { bearerToken: token, correlationId })
      ])
  )
  const direct = normalizeDirectBillSearchPage(directResult, {
    apiBaseUrl: options.apiBaseUrl,
    correlationId,
    limit: input.limit ?? 20,
    mode,
    rankOffset
  })
  const remote = normalizeHttpBillSearchPage(httpResult)
  const mismatchPath = firstMismatchPath(normalizeJson(direct), normalizeJson(remote))
  if (mismatchPath !== undefined) {
    throw new McpHttpParityMismatchError(mismatchPath, "searchBills")
  }
  return { correlationId, method: "searchBills", query, status: "passed" }
}

function nonEmpty(value: string, name: string): string {
  const normalized = value.trim()
  if (normalized.length === 0) {
    throw new TypeError(`${name} must not be empty`)
  }
  return normalized
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function normalizeJson(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString()
  }
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return value
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeJson(item) ?? null)
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, normalizeJson(item)])
    )
  }
  if (value === undefined) {
    return undefined
  }
  throw new TypeError("Parity values must be JSON-compatible")
}

function firstMismatchPath(left: unknown, right: unknown, path = "$"): string | undefined {
  if (Object.is(left, right)) {
    return undefined
  }
  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) {
      return `${path}.length`
    }
    for (const [index, item] of left.entries()) {
      const mismatch = firstMismatchPath(item, right[index], `${path}[${index}]`)
      if (mismatch !== undefined) {
        return mismatch
      }
    }
    return undefined
  }
  if (isRecord(left) && isRecord(right)) {
    const leftKeys = Object.keys(left)
    const rightKeys = Object.keys(right)
    if (leftKeys.length !== rightKeys.length || leftKeys.some((key, index) => key !== rightKeys[index])) {
      return `${path}.keys`
    }
    for (const key of leftKeys) {
      const mismatch = firstMismatchPath(left[key], right[key], `${path}.${key}`)
      if (mismatch !== undefined) {
        return mismatch
      }
    }
    return undefined
  }
  return path
}
