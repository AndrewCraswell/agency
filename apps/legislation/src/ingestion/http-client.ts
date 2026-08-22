import { DeferredIngestionError } from "./deferred.js"

export interface RetryingHttpClientOptions {
  afterAttemptComplete?: (telemetry: HttpRequestTelemetry) => Promise<void>
  beforeAttempt?: () => Promise<void>
  fetch?: typeof fetch
  maxAttempts: number
  minimumIntervalMs?: number
  onAttemptComplete?: (telemetry: HttpRequestTelemetry) => void
  requestTimeoutMs: number
}

export interface HttpClientMetrics {
  attempts: number
  failedRequests: number
  rateLimited: number
  retries: number
  successfulRequests: number
}

/**
 * One completed HTTP attempt, suitable for structured logs or external
 * observability. The URL intentionally omits its query string because provider
 * credentials are commonly passed there.
 */
export interface HttpRequestTelemetry {
  attempt: number
  durationMs: number
  errorName?: string
  method: "GET"
  rateLimitLimit?: number
  rateLimitRemaining?: number
  retryAfterMs?: number
  status?: number
  url: string
}

export class ProviderHttpError extends Error {
  readonly retryable: boolean
  readonly status?: number

  constructor(message: string, options: Readonly<{ retryable: boolean; status?: number }>) {
    super(message)
    this.name = "ProviderHttpError"
    this.retryable = options.retryable
    this.status = options.status
  }
}

/** Lets provider-specific callers yield to their orchestrator instead of retrying in-process. */
export class DeferredHttpRequestError extends DeferredIngestionError {
  constructor(message: string, retryAt: Date, deferKind?: string) {
    super(message, retryAt, deferKind)
    this.name = "DeferredHttpRequestError"
  }
}

export class RetryingHttpClient {
  readonly #afterAttemptComplete?: RetryingHttpClientOptions["afterAttemptComplete"]
  readonly #beforeAttempt?: RetryingHttpClientOptions["beforeAttempt"]
  readonly #fetch: typeof fetch
  readonly #maxAttempts: number
  readonly #minimumIntervalMs: number
  readonly #metrics: HttpClientMetrics = {
    attempts: 0,
    failedRequests: 0,
    rateLimited: 0,
    retries: 0,
    successfulRequests: 0
  }
  readonly #onAttemptComplete?: (telemetry: HttpRequestTelemetry) => void
  readonly #requestTimeoutMs: number
  #cooldownUntil = 0
  #requestGate: Promise<void> = Promise.resolve()
  #nextRequestAt = 0

  constructor(options: RetryingHttpClientOptions) {
    this.#afterAttemptComplete = options.afterAttemptComplete
    this.#beforeAttempt = options.beforeAttempt
    this.#fetch = options.fetch ?? fetch
    this.#maxAttempts = options.maxAttempts
    this.#minimumIntervalMs = Math.max(0, options.minimumIntervalMs ?? 0)
    this.#onAttemptComplete = options.onAttemptComplete
    this.#requestTimeoutMs = options.requestTimeoutMs
  }

  get metrics(): Readonly<HttpClientMetrics> {
    return { ...this.#metrics }
  }

  async get(url: URL, init: RequestInit = {}): Promise<Response> {
    let lastError: unknown
    for (let attempt = 1; attempt <= this.#maxAttempts; attempt += 1) {
      try {
        await this.#beforeAttempt?.()
        await this.#paceRequest()
        this.#metrics.attempts += 1
        const response = await this.#request(url, attempt, init)
        if (response.ok) {
          this.#metrics.successfulRequests += 1
          return response
        }
        const responseDetail = await responseErrorDetail(response)
        const dailyQuotaExceeded =
          responseDetail?.toLowerCase().includes("exceeded limit") === true && responseDetail.includes("/day")
        const retryable =
          response.status === 408 || (response.status === 429 && !dailyQuotaExceeded) || response.status >= 500
        if (response.status === 429) {
          this.#metrics.rateLimited += 1
          this.#extendCooldown(retryDelay(response, attempt))
        }
        if (!retryable || attempt === this.#maxAttempts) {
          this.#metrics.failedRequests += 1
          throw new ProviderHttpError(
            `Provider request failed with HTTP ${response.status}${responseDetail === undefined ? "" : `: ${responseDetail}`}`,
            {
              retryable,
              status: response.status
            }
          )
        }
        this.#metrics.retries += 1
        await delay(retryDelay(response, attempt))
      } catch (error) {
        if (error instanceof DeferredHttpRequestError) {
          throw error
        }
        if (error instanceof ProviderHttpError && !error.retryable) {
          throw error
        }
        lastError = error
        if (attempt === this.#maxAttempts) {
          if (!(error instanceof ProviderHttpError)) {
            this.#metrics.failedRequests += 1
          }
          throw error instanceof ProviderHttpError
            ? error
            : new ProviderHttpError("Provider request failed after retries", { retryable: true })
        }
        this.#metrics.retries += 1
        await delay(Math.min(250 * 2 ** (attempt - 1), 4000))
      }
    }
    throw lastError
  }

  async getBytes(url: URL, maximumBytes: number, init: RequestInit = {}): Promise<Uint8Array> {
    let chunks: Uint8Array[] = []
    let receivedBytes = 0
    for (let attempt = 1; attempt <= this.#maxAttempts; attempt += 1) {
      try {
        await this.#beforeAttempt?.()
        await this.#paceRequest()
        const headers = new Headers(init.headers)
        if (receivedBytes > 0) {
          headers.set("range", `bytes=${receivedBytes}-`)
        }
        this.#metrics.attempts += 1
        const response = await this.#request(url, attempt, { ...init, headers })
        if (!response.ok) {
          const responseDetail = await responseErrorDetail(response)
          const dailyQuotaExceeded =
            responseDetail?.toLowerCase().includes("exceeded limit") === true && responseDetail.includes("/day")
          const retryable =
            response.status === 408 || (response.status === 429 && !dailyQuotaExceeded) || response.status >= 500
          if (response.status === 429) {
            this.#metrics.rateLimited += 1
            this.#extendCooldown(retryDelay(response, attempt))
          }
          if (!retryable || attempt === this.#maxAttempts) {
            this.#metrics.failedRequests += 1
            throw new ProviderHttpError(
              `Provider request failed with HTTP ${response.status}${responseDetail === undefined ? "" : `: ${responseDetail}`}`,
              { retryable, status: response.status }
            )
          }
          this.#metrics.retries += 1
          await delay(retryDelay(response, attempt))
          continue
        }
        if (receivedBytes > 0 && response.status !== 206) {
          chunks = []
          receivedBytes = 0
        }
        const contentLength = Number(response.headers.get("content-length"))
        if (Number.isFinite(contentLength) && receivedBytes + contentLength > maximumBytes) {
          this.#metrics.failedRequests += 1
          throw new ProviderHttpError("Provider response exceeds the configured size limit", { retryable: false })
        }
        const reader = response.body?.getReader()
        if (reader === undefined) {
          const bytes = new Uint8Array(await response.arrayBuffer())
          chunks.push(bytes)
          receivedBytes += bytes.byteLength
        } else {
          for (;;) {
            const next = await reader.read()
            if (next.done) {
              break
            }
            if (receivedBytes + next.value.byteLength > maximumBytes) {
              await reader.cancel()
              this.#metrics.failedRequests += 1
              throw new ProviderHttpError("Provider response exceeds the configured size limit", { retryable: false })
            }
            chunks.push(next.value)
            receivedBytes += next.value.byteLength
          }
        }
        this.#metrics.successfulRequests += 1
        const result = new Uint8Array(receivedBytes)
        let offset = 0
        for (const chunk of chunks) {
          result.set(chunk, offset)
          offset += chunk.byteLength
        }
        return result
      } catch (error) {
        if (error instanceof DeferredHttpRequestError) {
          throw error
        }
        if (error instanceof ProviderHttpError && !error.retryable) {
          throw error
        }
        if (attempt === this.#maxAttempts) {
          if (!(error instanceof ProviderHttpError)) {
            this.#metrics.failedRequests += 1
          }
          throw error instanceof ProviderHttpError
            ? error
            : new ProviderHttpError("Provider download failed after retries", { retryable: true })
        }
        this.#metrics.retries += 1
        await delay(Math.min(250 * 2 ** (attempt - 1), 4000))
      }
    }
    throw new ProviderHttpError("Provider download failed after retries", { retryable: true })
  }

  async #paceRequest(): Promise<void> {
    const previous = this.#requestGate
    const gate = Promise.withResolvers<void>()
    this.#requestGate = gate.promise
    await previous
    try {
      for (;;) {
        const wait = Math.max(this.#nextRequestAt, this.#cooldownUntil) - Date.now()
        if (wait <= 0) {
          break
        }
        await delay(wait)
      }
      this.#nextRequestAt = Date.now() + this.#minimumIntervalMs
    } finally {
      gate.resolve()
    }
  }

  #extendCooldown(milliseconds: number): void {
    this.#cooldownUntil = Math.max(this.#cooldownUntil, Date.now() + milliseconds)
  }

  async #request(url: URL, attempt: number, init: RequestInit): Promise<Response> {
    const startedAt = performance.now()
    try {
      const response = await this.#fetch(url, {
        ...init,
        method: "GET",
        redirect: "follow",
        signal: AbortSignal.timeout(this.#requestTimeoutMs)
      })
      const telemetry: HttpRequestTelemetry = {
        attempt,
        durationMs: Math.round((performance.now() - startedAt) * 10) / 10,
        method: "GET",
        rateLimitLimit: parseNonnegativeHeader(response.headers, "x-ratelimit-limit"),
        rateLimitRemaining: parseNonnegativeHeader(response.headers, "x-ratelimit-remaining"),
        retryAfterMs: retryAfterMilliseconds(response),
        status: response.status,
        url: `${url.origin}${url.pathname}`
      }
      this.#emitAttemptComplete(telemetry)
      await this.#afterAttemptComplete?.(telemetry)
      return response
    } catch (error) {
      this.#emitAttemptComplete({
        attempt,
        durationMs: Math.round((performance.now() - startedAt) * 10) / 10,
        errorName: error instanceof Error ? error.name : "UnknownError",
        method: "GET",
        url: `${url.origin}${url.pathname}`
      })
      throw error
    }
  }

  #emitAttemptComplete(telemetry: HttpRequestTelemetry): void {
    try {
      this.#onAttemptComplete?.(telemetry)
    } catch {
      // Observability must never turn a successful provider call into a failure.
    }
  }
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfterMs = retryAfterMilliseconds(response)
  if (retryAfterMs !== undefined) {
    return retryAfterMs
  }
  if (response.status === 429) {
    return Math.min(15_000 * 2 ** (attempt - 1), 120_000)
  }
  return Math.min(250 * 2 ** (attempt - 1), 4000)
}

function retryAfterMilliseconds(response: Response): number | undefined {
  const retryAfter = response.headers.get("retry-after")
  if (retryAfter === null) {
    return undefined
  }
  const seconds = Number(retryAfter)
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1000, 3_600_000)
  }
  const date = Date.parse(retryAfter)
  return Number.isFinite(date) ? Math.min(Math.max(date - Date.now(), 0), 3_600_000) : undefined
}

function parseNonnegativeHeader(headers: Headers, name: string): number | undefined {
  const value = Number(headers.get(name))
  return Number.isFinite(value) && value >= 0 ? value : undefined
}

async function boundedErrorDetail(response: Response): Promise<string | undefined> {
  try {
    const detail = (await response.clone().text()).replaceAll(/\s+/g, " ").trim().slice(0, 300)
    return detail.length === 0 ? undefined : detail
  } catch {
    return undefined
  }
}

async function responseErrorDetail(response: Response): Promise<string | undefined> {
  if (response.status === 429) {
    return await boundedErrorDetail(response)
  }
  if (response.status >= 500) {
    return await boundedServerErrorDetail(response)
  }
  return undefined
}

async function boundedServerErrorDetail(response: Response): Promise<string | undefined> {
  try {
    const value: unknown = JSON.parse(await response.clone().text())
    if (typeof value !== "object" || value === null) {
      return undefined
    }
    const candidate = Object.entries(value).find(
      ([key, candidateValue]) => ["error", "detail", "message"].includes(key) && typeof candidateValue === "string"
    )
    if (candidate === undefined || typeof candidate[1] !== "string") {
      return undefined
    }
    return candidate[1].replaceAll(/\s+/g, " ").trim().slice(0, 300) || undefined
  } catch {
    return undefined
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

export async function readBounded(response: Response, maximumBytes: number): Promise<Uint8Array> {
  const contentLength = Number(response.headers.get("content-length"))
  if (Number.isFinite(contentLength) && contentLength > maximumBytes) {
    throw new ProviderHttpError("Provider response exceeds the configured size limit", { retryable: false })
  }
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.byteLength > maximumBytes) {
    throw new ProviderHttpError("Provider response exceeds the configured size limit", { retryable: false })
  }
  return bytes
}
