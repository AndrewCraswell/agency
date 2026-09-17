import { setTimeout as delay } from "node:timers/promises"
import { DefaultAzureCredential } from "@azure/identity"
import type { OcrPageSpan } from "./ocr-page-mapping.js"

const cognitiveServicesScope = "https://cognitiveservices.azure.com/.default"
const documentIntelligenceApiVersion = "2024-11-30"

export interface OcrResult {
  pageCount?: number
  pageSpanIssue?: string
  pages?: readonly OcrPageSpan[]
  provider: "azure-document-intelligence"
  text: string
}

export interface OcrClient {
  recognize(input: Readonly<{ bytes: Uint8Array; contentType: string; documentId: string }>): Promise<OcrResult>
}

/** A successful provider analysis found no text; this is not a transport failure. */
export class OcrNoUsableTextError extends Error {
  constructor() {
    super("Azure Document Intelligence returned no usable text")
    this.name = "OcrNoUsableTextError"
  }
}

interface AccessTokenCredential {
  getToken(scopes: string | string[]): Promise<Readonly<{ token: string }> | null>
}

export class AzureDocumentIntelligenceError extends Error {
  readonly retryAfterMs?: number
  readonly retryable: boolean
  readonly status?: number

  constructor(message: string, options: Readonly<{ retryAfterMs?: number; retryable: boolean; status?: number }>) {
    super(message)
    this.name = "AzureDocumentIntelligenceError"
    this.retryable = options.retryable
    this.retryAfterMs = options.retryAfterMs
    this.status = options.status
  }
}

export class AzureDocumentIntelligenceClient implements OcrClient {
  readonly #credential: AccessTokenCredential
  readonly #endpoint: URL
  readonly #fetch: typeof fetch
  readonly #pollIntervalMs: number
  readonly #timeoutMs: number

  constructor(
    endpoint: string,
    options: Readonly<{
      credential?: AccessTokenCredential
      fetch?: typeof fetch
      pollIntervalMs?: number
      timeoutMs?: number
    }> = {}
  ) {
    this.#endpoint = normalizeEndpoint(endpoint)
    this.#credential = options.credential ?? new DefaultAzureCredential()
    this.#fetch = options.fetch ?? fetch
    this.#pollIntervalMs = options.pollIntervalMs ?? 1_000
    this.#timeoutMs = options.timeoutMs ?? 10 * 60_000
  }

  async recognize(input: Readonly<{ bytes: Uint8Array; contentType: string; documentId: string }>): Promise<OcrResult> {
    const token = await this.#credential.getToken(cognitiveServicesScope)
    if (token === null) {
      throw new AzureDocumentIntelligenceError("Azure Document Intelligence authentication returned no token", {
        retryable: true
      })
    }

    const analyzeUrl = new URL(
      `documentintelligence/documentModels/prebuilt-read:analyze?_overload=analyzeDocument&api-version=${documentIntelligenceApiVersion}&stringIndexType=utf16CodeUnit`,
      this.#endpoint
    )
    const response = await this.#fetch(analyzeUrl, {
      body: JSON.stringify({ base64Source: Buffer.from(input.bytes).toString("base64") }),
      headers: {
        authorization: `Bearer ${token.token}`,
        "content-type": "application/json"
      },
      method: "POST",
      signal: AbortSignal.timeout(this.#timeoutMs)
    })
    if (!response.ok) {
      throw await providerError("submit", response)
    }
    const operationLocation = response.headers.get("operation-location")
    if (operationLocation === null) {
      throw new AzureDocumentIntelligenceError("Azure Document Intelligence did not return an operation location", {
        retryable: true,
        status: response.status
      })
    }
    const resultUrl = new URL(operationLocation, this.#endpoint)
    if (resultUrl.protocol !== "https:" || resultUrl.origin !== this.#endpoint.origin) {
      throw new AzureDocumentIntelligenceError("Azure Document Intelligence returned an untrusted operation location", {
        retryable: false
      })
    }

    const deadline = Date.now() + this.#timeoutMs
    while (Date.now() < deadline) {
      await delay(this.#pollIntervalMs)
      const resultResponse = await this.#fetch(resultUrl, {
        headers: { authorization: `Bearer ${token.token}` },
        signal: AbortSignal.timeout(Math.max(deadline - Date.now(), 1))
      })
      if (!resultResponse.ok) {
        throw await providerError("poll", resultResponse)
      }
      const body: unknown = await resultResponse.json()
      if (!isRecord(body) || typeof body.status !== "string") {
        throw new AzureDocumentIntelligenceError("Azure Document Intelligence returned an invalid result", {
          retryable: true
        })
      }
      if (body.status === "running" || body.status === "notStarted") {
        continue
      }
      if (body.status !== "succeeded" || !isRecord(body.analyzeResult)) {
        throw new AzureDocumentIntelligenceError(providerFailureMessage(body), { retryable: false })
      }
      const content = body.analyzeResult.content
      if (typeof content !== "string") {
        throw new AzureDocumentIntelligenceError("Azure Document Intelligence returned an invalid content field", {
          retryable: true
        })
      }
      if (content.trim().length === 0) {
        throw new OcrNoUsableTextError()
      }
      const pages = body.analyzeResult.pages
      const pageSpans = parsePageSpans(pages, content)
      return {
        ...(Array.isArray(pages) && pages.length > 0 ? { pageCount: pages.length } : {}),
        ...(pageSpans.ok ? { pages: pageSpans.pages } : { pageSpanIssue: pageSpans.issue }),
        provider: "azure-document-intelligence",
        text: content
      }
    }
    throw new AzureDocumentIntelligenceError("Azure Document Intelligence timed out", { retryable: true })
  }
}

function normalizeEndpoint(endpoint: string): URL {
  const url = new URL(endpoint)
  if (url.protocol !== "https:" || url.username !== "" || url.password !== "") {
    throw new Error("Azure Document Intelligence endpoint must be an HTTPS origin")
  }
  url.hash = ""
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/`
  url.search = ""
  return url
}

async function providerError(operation: string, response: Response): Promise<AzureDocumentIntelligenceError> {
  const retryAfterMs = retryAfter(response.headers.get("retry-after"))
  const detail = (await response.text()).slice(0, 500)
  return new AzureDocumentIntelligenceError(
    `Azure Document Intelligence ${operation} failed with HTTP ${response.status}${detail === "" ? "" : `: ${detail}`}`,
    {
      ...(retryAfterMs === undefined ? {} : { retryAfterMs }),
      retryable: response.status === 408 || response.status === 429 || response.status >= 500,
      status: response.status
    }
  )
}

function retryAfter(value: string | null): number | undefined {
  if (value === null) {
    return undefined
  }
  const seconds = Number(value)
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1_000
  }
  const date = Date.parse(value)
  return Number.isNaN(date) ? undefined : Math.max(date - Date.now(), 0)
}

function providerFailureMessage(value: Record<string, unknown>): string {
  if (isRecord(value.error)) {
    const details: string[] = []
    const pending: unknown[] = [value.error]
    for (let index = 0; index < Math.min(pending.length, 8); index += 1) {
      const current = pending[index]
      if (!isRecord(current)) {
        continue
      }
      const code = typeof current.code === "string" ? current.code.slice(0, 100) : ""
      const message = typeof current.message === "string" ? current.message.slice(0, 400) : ""
      if (code || message) {
        details.push(`${code ? `[${code}] ` : ""}${message}`.trim())
      }
      if (isRecord(current.innererror)) {
        pending.push(current.innererror)
      }
      if (Array.isArray(current.details)) {
        pending.push(...current.details.slice(0, 3))
      }
    }
    if (details.length > 0) {
      return `Azure Document Intelligence analysis failed: ${details.join("; ")}`
    }
  }
  return `Azure Document Intelligence analysis finished with status ${String(value.status)}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

type PageSpanParseResult =
  | Readonly<{ issue: string; ok: false }>
  | Readonly<{ ok: true; pages: readonly OcrPageSpan[] }>

function parsePageSpans(value: unknown, content: string): PageSpanParseResult {
  if (!Array.isArray(value) || value.length === 0) {
    return { issue: "provider pages are missing or empty", ok: false }
  }
  const spans: OcrPageSpan[] = []
  let previousEnd = 0
  for (const [index, page] of value.entries()) {
    const expectedPageNumber = index + 1
    if (!isRecord(page)) {
      return { issue: `page ${expectedPageNumber} is not an object`, ok: false }
    }
    if (!Number.isSafeInteger(page.pageNumber) || page.pageNumber !== expectedPageNumber) {
      return { issue: `page ${expectedPageNumber} has an invalid page number`, ok: false }
    }
    const pageSpans = page.spans
    if (!Array.isArray(pageSpans) || pageSpans.length === 0) {
      return { issue: `page ${expectedPageNumber} has no spans`, ok: false }
    }

    let pageStart: number | undefined
    for (const [spanIndex, span] of pageSpans.entries()) {
      const spanLabel = `page ${expectedPageNumber} span ${spanIndex + 1}`
      if (!isRecord(span)) {
        return { issue: `${spanLabel} is not an object`, ok: false }
      }
      const offset = span.offset
      const length = span.length
      if (typeof offset !== "number" || !Number.isSafeInteger(offset) || offset < 0) {
        return { issue: `${spanLabel} has an invalid offset`, ok: false }
      }
      if (typeof length !== "number" || !Number.isSafeInteger(length) || length < 0) {
        return { issue: `${spanLabel} has an invalid length`, ok: false }
      }
      if (length === 0 && pageSpans.length !== 1) {
        return { issue: `page ${expectedPageNumber} has a zero-length span mixed with other spans`, ok: false }
      }
      if (offset > Number.MAX_SAFE_INTEGER - length || offset + length > content.length) {
        return { issue: `${spanLabel} has an offset or length outside OCR content`, ok: false }
      }
      if (offset < previousEnd) {
        return { issue: `${spanLabel} overlaps or precedes the previous span`, ok: false }
      }
      const gapLength = offset - previousEnd
      if (content.slice(previousEnd, offset).trim() !== "") {
        return { issue: `${spanLabel} has a meaningful gap of ${gapLength} UTF-16 code units before it`, ok: false }
      }
      pageStart ??= offset
      previousEnd = offset + length
    }

    if (pageStart === undefined) {
      return { issue: `page ${expectedPageNumber} has no spans`, ok: false }
    }
    spans.push({ endOffset: previousEnd, pageNumber: page.pageNumber, startOffset: pageStart })
  }
  const trailingGapLength = content.length - previousEnd
  return content.slice(previousEnd).trim() === ""
    ? { ok: true, pages: spans }
    : { issue: `page spans have a trailing meaningful gap of ${trailingGapLength} UTF-16 code units`, ok: false }
}
