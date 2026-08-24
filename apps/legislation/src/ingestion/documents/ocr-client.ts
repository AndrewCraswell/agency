import { setTimeout as delay } from "node:timers/promises"
import { DefaultAzureCredential } from "@azure/identity"
import type { OcrPageSpan } from "./ocr-page-mapping.js"

const cognitiveServicesScope = "https://cognitiveservices.azure.com/.default"
const documentIntelligenceApiVersion = "2024-11-30"

export interface OcrResult {
  pageCount?: number
  pages?: readonly OcrPageSpan[]
  provider: "azure-document-intelligence"
  text: string
}

export interface OcrClient {
  recognize(input: Readonly<{ bytes: Uint8Array; contentType: string; documentId: string }>): Promise<OcrResult>
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
      if (typeof content !== "string" || content.trim().length === 0) {
        throw new AzureDocumentIntelligenceError("Azure Document Intelligence returned no usable text", {
          retryable: false
        })
      }
      const pages = body.analyzeResult.pages
      const pageSpans = parsePageSpans(pages, content.length)
      return {
        ...(Array.isArray(pages) && pages.length > 0 ? { pageCount: pages.length } : {}),
        ...(pageSpans === undefined ? {} : { pages: pageSpans }),
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
  if (isRecord(value.error) && typeof value.error.message === "string") {
    return `Azure Document Intelligence analysis failed: ${value.error.message}`
  }
  return `Azure Document Intelligence analysis finished with status ${String(value.status)}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function parsePageSpans(value: unknown, contentLength: number): readonly OcrPageSpan[] | undefined {
  if (!Array.isArray(value) || value.length === 0) {
    return undefined
  }
  const spans: OcrPageSpan[] = []
  for (const [index, page] of value.entries()) {
    if (!isRecord(page) || !Number.isSafeInteger(page.pageNumber) || page.pageNumber !== index + 1) {
      return undefined
    }
    const pageSpans = page.spans
    if (!Array.isArray(pageSpans) || pageSpans.length !== 1 || !isRecord(pageSpans[0])) {
      return undefined
    }
    const span = pageSpans[0]
    const offset = span.offset
    const length = span.length
    if (
      typeof offset !== "number" ||
      typeof length !== "number" ||
      !Number.isSafeInteger(offset) ||
      !Number.isSafeInteger(length) ||
      offset < 0 ||
      length < 1 ||
      offset > Number.MAX_SAFE_INTEGER - length ||
      offset + length > contentLength
    ) {
      return undefined
    }
    spans.push({ endOffset: offset + length, pageNumber: page.pageNumber, startOffset: offset })
  }
  return spans
}
